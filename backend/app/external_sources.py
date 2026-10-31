"""Read-only source connections for GitHub, Notion and Slack.

Personal/provider-issued access tokens are supplied by the owner and encrypted
at rest. Never send them to AI providers or include them in responses.
"""
import logging
import re
from urllib.parse import quote

import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from .db import Session, ExternalConnection
from .gmail import actor, allowed_workspace, crypt

router = APIRouter(prefix='/api')
log = logging.getLogger(__name__)
PROVIDERS = ('github', 'notion', 'slack')

class ConnectRequest(BaseModel):
    token: str = Field(min_length=8, max_length=4096)

class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=250)

def http_json(url, token, provider, params=None, method='GET'):
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/json',
               'User-Agent': 'Atlas-Connected-Research'}
    if provider == 'notion':
        headers['Notion-Version'] = '2022-06-28'
    try:
        with httpx.Client(timeout=20) as client:
            if method == 'POST':
                response = client.post(url, headers=headers, json=params or {})
            else:
                response = client.get(url, headers=headers, params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        log.warning('%s connector upstream HTTP %s', provider, status)
        if status in (401, 403):
            raise HTTPException(422, f'{provider.title()} denied access. Verify token permissions.') from exc
        if provider == 'github' and status == 422:
            # The upstream search API returns 422 for invalid qualifiers and queries.
            # Never disclose request headers, credentials, or raw upstream responses.
            try:
                reason = exc.response.json().get('message', '')
            except (ValueError, AttributeError):
                reason = ''
            if reason == 'Validation Failed':
                reason = 'GitHub rejected the search syntax. Try a simpler keyword or repository filter.'
            raise HTTPException(422, reason[:220] or 'GitHub rejected the search query.') from exc
        if status == 429:
            raise HTTPException(429, f'{provider.title()} rate limit reached.') from exc
        raise HTTPException(502, f'{provider.title()} returned HTTP {status}.') from exc
    except httpx.RequestError as exc:
        log.warning('%s provider request failure %s', provider, type(exc).__name__)
        raise HTTPException(502, f'{provider.title()} could not be reached.') from exc

def profile(provider, token):
    if provider == 'github':
        d = http_json('https://api.github.com/user', token, provider)
        return d.get('login') or str(d.get('id') or 'GitHub user')
    if provider == 'notion':
        d = http_json('https://api.notion.com/v1/users/me', token, provider)
        return d.get('name') or d.get('bot', {}).get('owner', {}).get('workspace', True) and 'Notion integration'
    d = http_json('https://slack.com/api/auth.test', token, provider)
    if not d.get('ok'):
        raise HTTPException(422, 'Slack rejected the access token.')
    return d.get('team') or d.get('user') or 'Slack workspace'

def read_connection(db, user, wid, provider):
    if provider not in PROVIDERS:
        raise HTTPException(404, 'Unsupported source provider.')
    allowed_workspace(db, user, wid)
    row = db.get(ExternalConnection, (wid, provider))
    if not row:
        raise HTTPException(409, f'Connect {provider.title()} first.')
    try:
        return row, crypt().decrypt(row.secret.encode()).decode()
    except Exception as exc:
        log.exception('Could not decrypt source token')
        raise HTTPException(503, 'Connection encryption key does not match stored token.') from exc

@router.get('/workspaces/{wid}/sources')
def statuses(wid: str, request: Request):
    with Session() as db:
        user = actor(request, db)
        allowed_workspace(db, user, wid)
        rows = db.query(ExternalConnection).filter_by(workspace_id=wid).all()
        accounts = {r.provider: r.account for r in rows}
        return [{'provider': p, 'connected': p in accounts, 'account': accounts.get(p)}
                for p in PROVIDERS]

@router.post('/workspaces/{wid}/sources/{provider}')
def connect(wid: str, provider: str, body: ConnectRequest, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(404, 'Unsupported source provider.')
    with Session() as db:
        user = actor(request, db)
        allowed_workspace(db, user, wid)
        account = profile(provider, body.token)
        encrypted = crypt().encrypt(body.token.encode()).decode()
        row = db.get(ExternalConnection, (wid, provider))
        if row:
            row.account, row.secret = account, encrypted
        else:
            db.add(ExternalConnection(workspace_id=wid, provider=provider,
                                      account=account, secret=encrypted))
        db.commit()
        return {'provider': provider, 'connected': True, 'account': account}

@router.delete('/workspaces/{wid}/sources/{provider}')
def disconnect(wid: str, provider: str, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(404, 'Unsupported source provider.')
    with Session() as db:
        user = actor(request, db)
        allowed_workspace(db, user, wid)
        db.query(ExternalConnection).filter_by(workspace_id=wid, provider=provider).delete()
        db.commit()
        return {'ok': True}

def github_search_query(query):
    """Keep explicit GitHub search syntax, simplify natural-language questions."""
    query = query.strip()
    if not query:
        raise HTTPException(422, 'Enter a GitHub search term.')
    qualifiers = ('repo:', 'org:', 'user:', 'is:', 'type:', 'in:', 'label:', 'state:', 'author:', 'assignee:', 'mentions:', 'created:', 'updated:')
    if any(term in query.lower() for term in qualifiers):
        return query[:240]
    words = re.findall(r"[a-zA-Z0-9_][a-zA-Z0-9_.-]*", query)
    stopwords = {'what','which','where','when','why','how','can','you','tell','me','about','the','and','or','my','in','on','for','are','is','was','were','does','did','with','from','please','find','all','issues','pull','requests'}
    terms = [word for word in words if word.lower() not in stopwords]
    return ' '.join(terms[:9])[:180] or ' '.join(words[:5])[:180]


def source_search(provider, token, query):
    if provider == 'github':
        d = http_json('https://api.github.com/search/issues', token, provider,
                      {'q': github_search_query(query), 'per_page': 8})
        return [{'provider': provider, 'id': str(x.get('id')), 'title': x.get('title', ''),
                 'excerpt': (x.get('body') or '')[:1200], 'url': x.get('html_url')}
                for x in d.get('items', [])]
    if provider == 'notion':
        d = http_json('https://api.notion.com/v1/search', token, provider,
                      {'query': query, 'page_size': 8}, method='POST')
        items = []
        for x in d.get('results', []):
            props = x.get('properties') or {}
            title = x.get('title') or (props.get('title') or {}).get('title') or (
                props.get('Name') or {}).get('title') or []
            label = ''.join(t.get('plain_text', '') for t in title) or x.get('object', 'Notion page')
            items.append({'provider': provider, 'id': x['id'], 'title': label,
                          'excerpt': label, 'url': x.get('url')})
        return items
    d = http_json('https://slack.com/api/search.all', token, provider,
                  {'query': query, 'count': 8})
    if not d.get('ok'):
        raise HTTPException(422, 'Slack search denied. Confirm search:read scope and workspace permissions.')
    return [{'provider': provider, 'id': x.get('ts', ''),
             'title': '#' + x.get('channel', {}).get('name', 'channel'),
             'excerpt': (x.get('text') or '')[:1200], 'url': x.get('permalink')}
            for x in d.get('messages', {}).get('matches', [])]

@router.post('/workspaces/{wid}/sources/{provider}/search')
def search(wid: str, provider: str, body: SearchRequest, request: Request):
    with Session() as db:
        user = actor(request, db)
        _, token = read_connection(db, user, wid, provider)
    return {'results': source_search(provider, token, body.query)}
