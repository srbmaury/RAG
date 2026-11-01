import hashlib
import hmac
import logging
import os
import re
import secrets
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool

from . import config, uploads
from .ai import enabled, generate
from .config import COOKIE_SECURE, DATA, MAX_FILE_BYTES
from .connected_oauth import router as connected_oauth_router
from .db import (
    Chunk,
    ConnectedOAuthState,
    Conversation,
    Document,
    DriveOAuthState,
    ExternalConnection,
    GmailConnection,
    GmailOAuthState,
    Login,
    Session,
    SourceHealthCheck,
    User,
    Workspace,
    init_db,
    uid,
)
from .drive import router as drive_router
from .external_sources import router as external_router
from .gmail import router as gmail_router
from .health import router as health_router
from .ingest import SUPPORTED
from .query_context import retrieval_query
from .research_queries import (
    drive_query_for_question,
    filter_credit_card_offer_evidence,
    gmail_query_for_question,
)
from .retrieval import retrieve
from .web_sources import router as web_router
from .worker import loop


@asynccontextmanager
async def lifespan(app):
    init_db()
    (DATA / 'files').mkdir(exist_ok=True)
    stop = threading.Event()
    thread = None
    if os.getenv('INLINE_WORKER', 'true').lower() == 'true':
        thread = threading.Thread(target=loop, args=(stop,), daemon=True)
        thread.start()
    yield
    stop.set()
    if thread:
        thread.join(timeout=5)


app = FastAPI(title='Atlas Document Intelligence', lifespan=lifespan)
app.include_router(gmail_router)
app.include_router(external_router)
app.include_router(drive_router)
app.include_router(health_router)
app.include_router(web_router)
app.include_router(connected_oauth_router)
log = logging.getLogger('atlas.requests')


@app.middleware('http')
async def request_diagnostics(request: Request, call_next):
    started = time.monotonic()
    request_id = secrets.token_hex(8)
    try:
        response = await call_next(request)
    except Exception:
        log.exception(
            'request_failed id=%s method=%s path=%s', request_id, request.method, request.url.path
        )
        raise
    elapsed_ms = round((time.monotonic() - started) * 1000)
    # The frontend and API remain on one origin via the Next.js proxy.
    # These headers protect browser-facing content without assuming a CDN/WAF.
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['X-Request-ID'] = request_id
    response.headers['Server-Timing'] = f'api;dur={elapsed_ms}'
    log.info(
        'request id=%s method=%s path=%s status=%s duration_ms=%s',
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


def database():
    with Session() as db:
        yield db


def user(request: Request, db=Depends(database)):
    token = request.cookies.get('atlas_session', '')
    login = db.get(Login, hashlib.sha256(token.encode()).hexdigest()) if token else None
    if not login or login.expires < time.time():
        raise HTTPException(401, 'Sign in to continue.')
    return db.get(User, login.user_id)


def workspace(workspaceId, actor, db):
    item = db.query(Workspace).filter_by(id=workspaceId, owner_id=actor.id).first()
    if not item:
        raise HTTPException(404, 'Workspace not found.')
    return item


def document(workspaceId, did, actor, db):
    workspace(workspaceId, actor, db)
    item = db.query(Document).filter_by(id=did, workspace_id=workspaceId).first()
    if not item:
        raise HTTPException(404, 'Document not found.')
    return item


def public_doc(d):
    return {
        key: getattr(d, key)
        for key in ['id', 'name', 'size', 'status', 'error', 'pages', 'chunk_count', 'created']
    }


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=200)


class Named(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class Turn(BaseModel):
    role: str = Field(pattern='^(user|assistant)$')
    content: str = Field(max_length=6000)


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_ids: List[str] = Field(default_factory=list, max_length=200)
    history: List[Turn] = Field(default_factory=list, max_length=12)


class UploadRequest(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    size: int = Field(gt=0)


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310000).hex()
    return f'{salt}:{digest}'


def issue_login(actor, response, db):
    token = secrets.token_urlsafe(48)
    db.add(
        Login(
            token=hashlib.sha256(token.encode()).hexdigest(),
            user_id=actor.id,
            expires=time.time() + 604800,
        )
    )
    db.commit()
    response.set_cookie(
        'atlas_session',
        token,
        max_age=604800,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite='strict',
        path='/',
    )
    return {'id': actor.id, 'email': actor.email}


@app.get('/api/workspaces/{workspaceId}/processing-stats')
def processing_stats(workspaceId: str, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    rows = (
        db.query(Document.status, func.count(Document.id))
        .filter(Document.workspace_id == workspaceId)
        .group_by(Document.status)
        .all()
    )
    counts = {name: count for name, count in rows}
    return {
        'queued': counts.get('queued', 0),
        'processing': counts.get('processing', 0),
        'ready': counts.get('ready', 0),
        'failed': counts.get('failed', 0),
    }


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.post('/api/auth/register')
def register(body: Credentials, response: Response, db=Depends(database)):
    email = body.email.strip().lower()
    if '@' not in email:
        raise HTTPException(422, 'Enter a valid email address.')
    actor = User(email=email, password=password_hash(body.password))
    db.add(actor)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Email already registered.')
    db.add(Workspace(owner_id=actor.id, name='My knowledge base'))
    db.commit()
    return issue_login(actor, response, db)


@app.post('/api/auth/login')
def login(body: Credentials, response: Response, db=Depends(database)):
    actor = db.query(User).filter_by(email=body.email.strip().lower()).first()
    # Run PBKDF2 even for unknown users to reduce timing differences.
    stored = actor.password if actor else '0' * 32 + ':' + '0' * 64
    valid = hmac.compare_digest(password_hash(body.password, stored.split(':')[0]), stored)
    if not actor or not valid:
        raise HTTPException(401, 'Invalid email or password.')
    return issue_login(actor, response, db)


@app.post('/api/auth/logout')
def logout(request: Request, response: Response, db=Depends(database)):
    token = request.cookies.get('atlas_session', '')
    db.query(Login).filter_by(token=hashlib.sha256(token.encode()).hexdigest()).delete()
    db.commit()
    response.delete_cookie('atlas_session', path='/')
    return {'ok': True}


@app.get('/api/me')
def me(actor=Depends(user)):
    return {
        'id': actor.id,
        'email': actor.email,
        'mode': 'ai' if enabled() else 'local_excerpts',
        'max_file_bytes': MAX_FILE_BYTES,
    }


@app.get('/api/workspaces')
def workspaces(actor=Depends(user), db=Depends(database)):
    return [
        {'id': w.id, 'name': w.name}
        for w in db.query(Workspace).filter_by(owner_id=actor.id).order_by(Workspace.created)
    ]


@app.post('/api/workspaces')
def create_workspace(body: Named, actor=Depends(user), db=Depends(database)):
    if not body.name.strip():
        raise HTTPException(422, 'Workspace name is required.')
    item = Workspace(owner_id=actor.id, name=body.name.strip())
    db.add(item)
    db.commit()
    return {'id': item.id, 'name': item.name}


class DeleteWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


@app.delete('/api/workspaces/{workspaceId}')
def delete_workspace(
    workspaceId: str, body: DeleteWorkspaceRequest, actor=Depends(user), db=Depends(database)
):
    item = workspace(workspaceId, actor, db)
    if body.name != item.name:
        raise HTTPException(422, 'Type the exact workspace name to confirm deletion.')
    documents = db.query(Document).filter_by(workspace_id=workspaceId).all()
    if any(d.status in ('queued', 'processing') for d in documents):
        raise HTTPException(
            409,
            'Wait for document uploads and processing to finish before deleting this workspace.',
        )
    ids = [d.id for d in documents]
    # Use explicit deletes for SQLite and PostgreSQL; no reliance on ORM cascades.
    db.query(GmailOAuthState).filter_by(workspace_id=workspaceId).delete(synchronize_session=False)
    db.query(DriveOAuthState).filter_by(workspace_id=workspaceId).delete(synchronize_session=False)
    db.query(ConnectedOAuthState).filter_by(workspace_id=workspaceId).delete(synchronize_session=False)
    db.query(GmailConnection).filter_by(workspace_id=workspaceId).delete(synchronize_session=False)
    db.query(ExternalConnection).filter_by(workspace_id=workspaceId).delete(synchronize_session=False)
    db.query(Conversation).filter_by(workspace_id=workspaceId).delete(synchronize_session=False)
    db.query(Chunk).filter_by(workspace_id=workspaceId).delete(synchronize_session=False)
    db.query(Document).filter_by(workspace_id=workspaceId).delete(synchronize_session=False)
    db.delete(item)
    db.commit()
    for did in ids:
        (DATA / 'files' / did).unlink(missing_ok=True)
    return {'ok': True}


@app.get('/api/workspaces/{workspaceId}/documents')
def documents(workspaceId: str, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    return [
        public_doc(d)
        for d in db.query(Document).filter_by(workspace_id=workspaceId).order_by(Document.created.desc())
    ]


@app.post('/api/workspaces/{workspaceId}/uploads')
def start_upload(workspaceId: str, body: UploadRequest, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    return uploads.start(workspaceId, actor.id, body.name, body.size, MAX_FILE_BYTES, SUPPORTED)


@app.get('/api/workspaces/{workspaceId}/uploads/{upload_id}')
def upload_status(workspaceId: str, upload_id: str, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    return uploads.status(upload_id, workspaceId, actor.id)


@app.put('/api/workspaces/{workspaceId}/uploads/{upload_id}')
async def upload_part(
    workspaceId: str,
    upload_id: str,
    request: Request,
    offset: int = 0,
    actor=Depends(user),
    db=Depends(database),
):
    workspace(workspaceId, actor, db)
    data = bytearray()
    async for block in request.stream():
        data.extend(block)
        if len(data) > uploads.PART_BYTES:
            raise HTTPException(413, 'Upload part exceeds 8 MB.')
    return await run_in_threadpool(uploads.append, upload_id, workspaceId, actor.id, offset, data)


@app.post('/api/workspaces/{workspaceId}/uploads/{upload_id}/complete')
def complete_upload(workspaceId: str, upload_id: str, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    doc, duplicate = uploads.finish(upload_id, workspaceId, actor.id, db)
    return {**public_doc(doc), 'duplicate': duplicate}


@app.delete('/api/workspaces/{workspaceId}/uploads/{upload_id}')
def cancel_upload(workspaceId: str, upload_id: str, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    return uploads.cancel(upload_id, workspaceId, actor.id)


@app.post('/api/workspaces/{workspaceId}/documents')
async def upload(
    workspaceId: str, files: List[UploadFile] = File(...), actor=Depends(user), db=Depends(database)
):
    workspace(workspaceId, actor, db)
    if len(files) > 50:
        raise HTTPException(422, 'Upload at most 50 files per batch.')
    results = []
    for file in files:
        name = Path((file.filename or 'untitled').replace('\\', '/')).name[:200]
        if Path(name).suffix.lower() not in SUPPORTED:
            results.append(
                {'name': name, 'error': 'Supported formats: PDF, DOCX, TXT, MD, CSV, JSON, HTML.'}
            )
            continue
        did, count, digest = uid(), 0, hashlib.sha256()
        path = DATA / 'files' / did
        try:
            with path.open('wb') as out:
                while True:
                    block = await file.read(1024 * 1024)
                    if not block:
                        break
                    count += len(block)
                    if count > MAX_FILE_BYTES:
                        raise ValueError(f'File exceeds {MAX_FILE_BYTES // 1024 // 1024} MB limit.')
                    digest.update(block)
                    out.write(block)
            if not count:
                raise ValueError('File is empty.')
            existing = (
                db.query(Document).filter_by(workspace_id=workspaceId, digest=digest.hexdigest()).first()
            )
            if existing:
                path.unlink(missing_ok=True)
                results.append({**public_doc(existing), 'duplicate': True})
                continue
            doc = Document(
                id=did, workspace_id=workspaceId, name=name, size=count, digest=digest.hexdigest()
            )
            db.add(doc)
            db.commit()
            results.append(public_doc(doc))
        except IntegrityError:
            db.rollback()
            path.unlink(missing_ok=True)
            existing = (
                db.query(Document).filter_by(workspace_id=workspaceId, digest=digest.hexdigest()).first()
            )
            if not existing:
                raise
            results.append({**public_doc(existing), 'duplicate': True})
        except ValueError as exc:
            path.unlink(missing_ok=True)
            results.append({'name': name, 'error': str(exc)})
        except Exception:
            db.rollback()
            path.unlink(missing_ok=True)
            raise
        finally:
            await file.close()
    return {'documents': results}


@app.get('/api/workspaces/{workspaceId}/documents/{did}/chunks')
def chunks(workspaceId: str, did: str, offset: int = 0, actor=Depends(user), db=Depends(database)):
    doc = document(workspaceId, did, actor, db)
    if offset < 0:
        raise HTTPException(422, 'Offset must be non-negative.')
    return {
        'document': public_doc(doc),
        'chunks': [
            {'id': c.id, 'page': c.page, 'text': c.text}
            for c in db.query(Chunk)
            .filter_by(document_id=did)
            .order_by(Chunk.ordinal)
            .offset(offset)
            .limit(50)
        ],
    }


@app.get('/api/workspaces/{workspaceId}/documents/{did}/original')
def original(workspaceId: str, did: str, actor=Depends(user), db=Depends(database)):
    doc = document(workspaceId, did, actor, db)
    return FileResponse(
        DATA / 'files' / did, filename=doc.name, content_disposition_type='attachment'
    )


@app.post('/api/workspaces/{workspaceId}/documents/{did}/retry')
def retry(workspaceId: str, did: str, actor=Depends(user), db=Depends(database)):
    doc = document(workspaceId, did, actor, db)
    if doc.status not in ('failed', 'ready'):
        raise HTTPException(409, 'Document is already queued or processing.')
    db.query(Chunk).filter_by(document_id=did).delete()
    doc.status, doc.error, doc.chunk_count, doc.generation = 'queued', None, 0, doc.generation + 1
    db.commit()
    return public_doc(doc)


@app.delete('/api/workspaces/{workspaceId}/documents/{did}')
def delete(workspaceId: str, did: str, actor=Depends(user), db=Depends(database)):
    doc = document(workspaceId, did, actor, db)
    db.delete(doc)
    # Reports can contain copied passages; invalidate them on source deletion.
    db.commit()
    (DATA / 'files' / did).unlink(missing_ok=True)
    return {'ok': True}


class ConversationPayload(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    messages: list[dict] = Field(default_factory=list, max_length=300)


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=120)


def owned_conversation(workspaceId, cid, actor, db):
    workspace(workspaceId, actor, db)
    item = db.query(Conversation).filter_by(id=cid, workspace_id=workspaceId).first()
    if item is None:
        raise HTTPException(404, 'Conversation not found.')
    return item


def conversation_data(item):
    return {
        'id': item.id,
        'title': item.title,
        'messages': item.messages or [],
        'created': item.created,
        'updated': item.updated,
    }


@app.get('/api/workspaces/{workspaceId}/conversations')
def list_conversations(workspaceId: str, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    items = (
        db.query(Conversation)
        .filter_by(workspace_id=workspaceId)
        .order_by(Conversation.updated.desc())
        .all()
    )
    return [{'id': c.id, 'title': c.title, 'updated': c.updated} for c in items]


@app.post('/api/workspaces/{workspaceId}/conversations')
def create_conversation(
    workspaceId: str, body: ConversationPayload, actor=Depends(user), db=Depends(database)
):
    workspace(workspaceId, actor, db)
    item = Conversation(workspace_id=workspaceId, title=body.title.strip(), messages=body.messages)
    db.add(item)
    db.commit()
    return conversation_data(item)


@app.get('/api/workspaces/{workspaceId}/conversations/{cid}')
def get_conversation(workspaceId: str, cid: str, actor=Depends(user), db=Depends(database)):
    return conversation_data(owned_conversation(workspaceId, cid, actor, db))


@app.put('/api/workspaces/{workspaceId}/conversations/{cid}')
def update_conversation(
    workspaceId: str, cid: str, body: ConversationPayload, actor=Depends(user), db=Depends(database)
):
    item = owned_conversation(workspaceId, cid, actor, db)
    item.title = body.title.strip()
    item.messages = body.messages
    item.updated = time.time()
    db.commit()
    return conversation_data(item)


@app.patch('/api/workspaces/{workspaceId}/conversations/{cid}')
def rename_conversation(
    workspaceId: str, cid: str, body: ConversationRename, actor=Depends(user), db=Depends(database)
):
    item = owned_conversation(workspaceId, cid, actor, db)
    item.title = body.title.strip()
    item.updated = time.time()
    db.commit()
    return conversation_data(item)


@app.delete('/api/workspaces/{workspaceId}/conversations/{cid}')
def delete_conversation(workspaceId: str, cid: str, actor=Depends(user), db=Depends(database)):
    db.delete(owned_conversation(workspaceId, cid, actor, db))
    db.commit()
    return {'ok': True}


class ConnectedQuestion(Question):
    include_documents: bool = True
    include_gmail: bool = False
    gmail_query: str = Field(default='newer_than:30d', max_length=400)
    providers: List[str] = Field(default_factory=list, max_length=4)


def collect_connected_evidence(workspaceId, body, actor, db):
    workspace(workspaceId, actor, db)
    if not body.question.strip():
        raise HTTPException(422, 'Enter a question.')
    if body.document_ids:
        count = (
            db.query(Document)
            .filter(Document.workspace_id == workspaceId, Document.id.in_(body.document_ids))
            .count()
        )
        if count != len(set(body.document_ids)):
            raise HTTPException(404, 'Selected document not found.')
    from .drive import access_token as drive_access_token
    from .drive import drive_evidence, drive_search
    from .external_sources import PROVIDERS, read_connection, source_search
    from .gmail import GMAIL_API, access_token, connection, email_from_json, gmail_get
    from .sources import Evidence

    if any(p not in (*PROVIDERS, 'drive') for p in body.providers):
        raise HTTPException(422, 'Unknown connected provider.')
    evidence, document_evidence = [], {}
    try:
        if body.include_documents:
            for item in retrieve(
                workspaceId, retrieval_query(body.question, body.history), body.document_ids
            )[:6]:
                evidence.append(
                    Evidence('documents', item['chunk_id'], item['name'], item['text'][:1800], None)
                )
                document_evidence[item['chunk_id']] = item
        if body.include_gmail:
            entry = connection(db, actor, workspaceId)
            token = access_token(entry, db)
            matches = gmail_get(
                token,
                GMAIL_API + '/messages',
                {'q': gmail_query_for_question(body.gmail_query, body.question), 'maxResults': 8},
            ).get('messages', [])
            for m in matches:
                msg = email_from_json(
                    gmail_get(token, GMAIL_API + '/messages/' + m['id'], {'format': 'full'})
                )
                evidence.append(
                    Evidence(
                        'gmail',
                        msg['id'],
                        msg['subject'],
                        (msg['body'] or msg['snippet'])[:8000],
                        msg['url'],
                        msg['date'],
                    )
                )
        if 'drive' in body.providers:
            drive_token = drive_access_token(db, actor, workspaceId)
            drive_items = drive_evidence(
                drive_token, drive_search(drive_token, drive_query_for_question(body.question))
            )
            for hit in drive_items:
                evidence.append(
                    Evidence('drive', hit['id'], hit['title'], hit['excerpt'], hit.get('url'))
                )
        for provider in dict.fromkeys(p for p in body.providers if p != 'drive'):
            _, provider_token = read_connection(db, actor, workspaceId, provider)
            for hit in source_search(provider, provider_token, body.question):
                excerpt_limit = 8000 if provider == 'slack' else 3000
                evidence.append(
                    Evidence(
                        provider,
                        hit['id'],
                        hit['title'],
                        hit.get('excerpt', '')[:excerpt_limit],
                        hit.get('url'),
                    )
                )
    except HTTPException:
        raise
    except Exception as exc:
        log.exception('Connected retrieval failed')
        raise HTTPException(502, 'Could not retrieve connected sources.') from exc
    from .evidence_quality import prepare_evidence

    filtered = filter_credit_card_offer_evidence(body.question, evidence)
    return prepare_evidence(body.question, filtered), document_evidence


def connected_sources_for_payload(payload, document_evidence):
    sources = []
    for entry in payload:
        original = (
            document_evidence.get(entry.get('origin_id'))
            if entry.get('provider') == 'documents'
            else None
        )
        origin_url = None
        if original and original['name'].lower().endswith('.md'):
            try:
                original_text = (DATA / 'files' / original['document_id']).read_text(
                    encoding='utf-8'
                )[:4096]
            except (OSError, UnicodeError):
                original_text = ''
            match = re.search(r'(?m)^Source URL: (https?://\S+)', original_text)
            if match:
                origin_url = match.group(1)
        sources.append(
            {
                'chunk_id': original['chunk_id'] if original else str(entry['source_id']),
                'document_id': original['document_id'] if original else '',
                'name': entry['title'],
                'page': original['page'] if original else 0,
                'text': entry['text'],
                'location_type': original['location_type']
                if original
                else entry.get('provider', 'source'),
                'provider': entry.get('provider'),
                'url': origin_url or entry.get('url'),
            }
        )
    return sources


def connected_scope(body):
    scope = ['documents'] if body.include_documents else []
    if body.include_gmail:
        scope.append('gmail')
    scope.extend(provider for provider in body.providers if provider not in scope)
    return scope


def no_evidence_result(body):
    labels = {
        'documents': 'uploaded documents',
        'gmail': 'Gmail',
        'drive': 'Google Drive',
        'github': 'GitHub',
        'notion': 'Notion',
        'slack': 'Slack',
    }
    scope = connected_scope(body)
    if not scope:
        answer = 'Choose at least one source, then ask again.'
    else:
        names = ', '.join(labels.get(item, item) for item in scope)
        answer = f'No matching results were found in {names} for this question. Try different keywords or check the source connection.'
    return {'answer': answer, 'sources': [], 'mode': 'insufficient_evidence', 'scope': scope}


def github_pull_request_listing(question, providers):
    import re

    if 'github' not in providers or not re.search(r'\b(?:pull\s*requests?|prs?)\b', question, re.I):
        return False
    return bool(re.search(r'\b(?:list|show|find|get|all|my|mine)\b', question, re.I))


def github_pull_request_list_result(question, body, evidence, document_evidence):
    """Return source-owned PR rows directly for list requests, without model synthesis."""
    if not github_pull_request_listing(question, body.providers):
        return None
    import re

    from .connected_synthesis import source_list_answer
    from .external_sources import requested_result_limit

    matches = [item for item in evidence if item.provider == 'github']
    if not matches:
        return None
    explicit_all = bool(re.search(r'\ball\b', question, re.I))
    limit = requested_result_limit(question, default=12)
    if explicit_all:
        limit = 30
    payload = [
        item.as_prompt(index) | {'origin_id': item.source_id}
        for index, item in enumerate(matches[:limit], 1)
    ]
    return {
        'answer': source_list_answer(payload, len(matches), limit),
        'sources': connected_sources_for_payload(payload, document_evidence),
        'mode': 'source_results',
        'scope': ['github'],
    }


@app.post('/api/workspaces/{workspaceId}/connected-chat')
def connected_chat(
    workspaceId: str, body: ConnectedQuestion, request: Request, actor=Depends(user), db=Depends(database)
):
    """Retrieve evidence across workspace documents and optionally live Gmail."""
    import re

    from .ai import client, ollama_chat

    evidence, document_evidence = collect_connected_evidence(workspaceId, body, actor, db)
    if not evidence:
        return no_evidence_result(body)
    # A local 8k-context model cannot accept all retrieved source bodies at once.
    # Keep source IDs stable across retries so citations always refer to real evidence.
    from .connected_synthesis import synthesize_connected

    listed = github_pull_request_list_result(body.question, body, evidence, document_evidence)
    if listed:
        return listed
    try:
        answer, payload = synthesize_connected(
            body.question,
            evidence,
            config.AI_PROVIDER,
            config.API_KEY,
            config.CHAT_MODEL,
            client,
            ollama_chat,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        import logging

        logging.getLogger(__name__).warning(
            'Connected model reached generation/context limit: %s', exc
        )
        raise HTTPException(
            422,
            'The local model could not complete this cross-source answer. Try a narrower Gmail query or fewer source types.',
        ) from exc
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception('Connected synthesis failed')
        raise HTTPException(
            502, 'Connected answer generation failed. Check the AI provider logs.'
        ) from exc
    refs = {int(x) for x in re.findall(r'\[(\d+)\]', answer or '')}
    if not refs or any(n < 1 or n > len(payload) for n in refs):
        return {
            'answer': 'The model returned an answer without usable source citations. Please retry; no unverified answer is shown.',
            'sources': [],
            'mode': 'citation_check_failed',
            'scope': connected_scope(body),
        }
    # Preserve positional [n] citations used by the standard chat renderer.
    # Non-document evidence carries a URL so the UI opens the original record.
    sources = connected_sources_for_payload(payload, document_evidence)
    from .citation_audit import audit_citations
    from .decision_links import decision_timeline, related_sources

    return {
        'answer': answer,
        'sources': sources,
        'related_sources': related_sources(payload),
        'decision_timeline': decision_timeline(payload),
        'mode': 'connected',
        'citation_audit': audit_citations(answer, payload),
        'scope': connected_scope(body),
    }


@app.post('/api/workspaces/{workspaceId}/connected-chat/stream')
def connected_chat_stream(
    workspaceId: str, body: ConnectedQuestion, request: Request, actor=Depends(user), db=Depends(database)
):
    """Stream answer progress and text as newline-delimited JSON events."""
    import json

    def events():
        yield (
            json.dumps(
                {'type': 'status', 'text': 'Searching selected sources…'}, ensure_ascii=False
            )
            + '\n'
        )
        try:
            evidence, document_evidence = collect_connected_evidence(workspaceId, body, actor, db)
            if not evidence:
                yield (
                    json.dumps(
                        {'type': 'done', 'result': no_evidence_result(body)}, ensure_ascii=False
                    )
                    + '\n'
                )
                return
            listed = github_pull_request_list_result(
                body.question, body, evidence, document_evidence
            )
            if listed:
                yield json.dumps({'type': 'done', 'result': listed}, ensure_ascii=False) + '\n'
                return
            yield (
                json.dumps(
                    {'type': 'status', 'text': 'Writing an answer from the evidence…'},
                    ensure_ascii=False,
                )
                + '\n'
            )
            # Document-only questions use the dedicated citation-checked answer generator.
            # This avoids the cross-source streaming model's short timeout and keeps
            # ordinary document Q&A focused on the user's requested answer.
            if body.include_documents and not body.include_gmail and not body.providers:
                doc_sources = [
                    document_evidence[item.source_id]
                    for item in evidence
                    if item.provider == 'documents' and item.source_id in document_evidence
                ]
                result = generate(
                    body.question, doc_sources, [t.model_dump() for t in body.history]
                )
                result['scope'] = connected_scope(body)
                yield (
                    json.dumps({'type': 'delta', 'text': result['answer']}, ensure_ascii=False)
                    + '\n'
                )
                yield json.dumps({'type': 'done', 'result': result}, ensure_ascii=False) + '\n'
                return
            from .ai import client
            from .connected_synthesis import stream_connected

            for event in stream_connected(
                body.question,
                evidence,
                config.AI_PROVIDER,
                config.API_KEY,
                config.CHAT_MODEL,
                client,
                config.OLLAMA_URL,
                config.OLLAMA_CHAT_MODEL,
            ):
                if event['type'] == 'complete':
                    public_sources = (
                        connected_sources_for_payload(event['sources'], document_evidence)
                        if event['sources']
                        else []
                    )
                    from .decision_links import decision_timeline, related_sources

                    result = {
                        'answer': event['answer'],
                        'sources': public_sources,
                        'related_sources': related_sources(event['sources']),
                        'decision_timeline': decision_timeline(event['sources']),
                        'mode': event['mode'],
                        'scope': connected_scope(body),
                    }
                    yield json.dumps({'type': 'done', 'result': result}, ensure_ascii=False) + '\n'
                else:
                    yield json.dumps(event, ensure_ascii=False) + '\n'
        except HTTPException as exc:
            yield json.dumps({'type': 'error', 'message': exc.detail}, ensure_ascii=False) + '\n'
        except Exception as exc:
            log.exception('Connected streaming answer failed')
            message = 'The answer could not be completed. Check the source connection and AI provider, then retry.'
            if isinstance(exc, ValueError):
                message = str(exc)
            yield json.dumps({'type': 'error', 'message': message}, ensure_ascii=False) + '\n'

    return StreamingResponse(
        events(),
        media_type='application/x-ndjson',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


@app.get('/api/workspaces/{workspaceId}/sources/health')
def source_health(workspaceId: str, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    return {
        'checks': [
            {
                'provider': row.provider,
                'healthy': row.healthy,
                'matches': row.matches,
                'error': row.error,
                'checked_at': row.checked_at,
            }
            for row in db.query(SourceHealthCheck).filter_by(workspace_id=workspaceId).all()
        ]
    }


@app.post('/api/workspaces/{workspaceId}/sources/health/check')
def verify_sources(workspaceId: str, request: Request, actor=Depends(user), db=Depends(database)):
    """Check real provider access; return only status, account, and match counts."""
    workspace(workspaceId, actor, db)
    from .drive import access_token as drive_access
    from .drive import drive_search
    from .external_sources import PROVIDERS, read_connection, verify_source_access
    from .gmail import GMAIL_API, gmail_get
    from .gmail import access_token as gmail_access
    from .gmail import connection as gmail_connection

    checks = []

    def record(provider, connected, callback, account=None):
        check = {
            'provider': provider,
            'connected': connected,
            'healthy': False,
            'account': account,
            'checked_at': time.time(),
            'matches': None,
            'error': None,
        }
        if not connected:
            check['error'] = 'Not connected.'
        else:
            try:
                check['account'], check['matches'] = callback()
                check['healthy'] = True
            except HTTPException as exc:
                check['error'] = exc.detail
            except Exception as exc:
                log.warning('Source verification failed for %s: %s', provider, type(exc).__name__)
                check['error'] = 'Could not verify access. Check the provider connection and retry.'
        saved = db.get(SourceHealthCheck, (workspaceId, provider))
        if saved is None:
            saved = SourceHealthCheck(
                workspace_id=workspaceId,
                provider=provider,
                checked_at=check['checked_at'],
                healthy=check['healthy'],
            )
            db.add(saved)
        saved.checked_at = check['checked_at']
        saved.healthy = check['healthy']
        saved.matches = check['matches']
        saved.error = (check['error'] or '')[:500] or None
        checks.append(check)

    for provider in PROVIDERS:
        row = db.get(ExternalConnection, (workspaceId, provider))
        if row:

            def check_external(p=provider):
                _, token = read_connection(db, actor, workspaceId, p)
                return verify_source_access(p, token)

            record(provider, True, check_external, row.account)
        else:
            record(provider, False, lambda: None)

    gmail_row = db.query(GmailConnection).filter_by(workspace_id=workspaceId).first()
    if gmail_row:

        def check_gmail():
            entry = gmail_connection(db, actor, workspaceId)
            token = gmail_access(entry, db)
            items = gmail_get(
                token, GMAIL_API + '/messages', {'q': 'newer_than:30d', 'maxResults': 1}
            ).get('messages', [])
            return entry.email, len(items)

        record('gmail', True, check_gmail, gmail_row.email)
    else:
        record('gmail', False, lambda: None)

    drive_row = db.get(ExternalConnection, (workspaceId, 'drive'))
    if drive_row:

        def check_drive():
            token = drive_access(db, actor, workspaceId)
            return drive_row.account, len(drive_search(token, ''))

        record('drive', True, check_drive, drive_row.account)
    else:
        record('drive', False, lambda: None)
    db.commit()
    return {'checks': checks}


@app.post('/api/workspaces/{workspaceId}/chat')
def chat(workspaceId: str, body: Question, actor=Depends(user), db=Depends(database)):
    workspace(workspaceId, actor, db)
    if not body.question.strip():
        raise HTTPException(422, 'Enter a question.')
    if body.document_ids:
        found = (
            db.query(Document)
            .filter(Document.workspace_id == workspaceId, Document.id.in_(body.document_ids))
            .count()
        )
        if found != len(set(body.document_ids)):
            raise HTTPException(404, 'Selected document not found.')
    query = retrieval_query(body.question, body.history)
    try:
        sources = retrieve(workspaceId, query, body.document_ids)
        result = generate(body.question, sources, [t.model_dump() for t in body.history])
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception('Chat retrieval or generation failed')
        if isinstance(exc, (ConnectionError, TimeoutError)):
            detail = (
                'AI provider connection failed or timed out. Check the provider service and retry.'
            )
        else:
            detail = 'Answer generation failed. Check your AI provider configuration and server logs, then retry.'
        raise HTTPException(502, detail) from exc
    # Do not return passages for documents deleted or reindexed during the provider call.
    if sources:
        current = (
            db.query(Chunk.id)
            .filter(Chunk.workspace_id == workspaceId, Chunk.id.in_([s['chunk_id'] for s in sources]))
            .count()
        )
        if current != len(sources):
            raise HTTPException(409, 'Sources changed during the answer. Ask again.')
    return result
