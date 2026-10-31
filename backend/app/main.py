import hashlib
import logging
import hmac
import os
import secrets
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from .db import Session, init_db, User, Login, Workspace, Document, Chunk, Conversation, GmailConnection, GmailOAuthState, ExternalConnection, DriveOAuthState, uid
from .config import DATA, MAX_FILE_BYTES, COOKIE_SECURE
from . import config
from .ingest import SUPPORTED
from .worker import loop
from .retrieval import retrieve
from .ai import generate, enabled
from .query_context import retrieval_query
from . import uploads
from .gmail import router as gmail_router
from .external_sources import router as external_router
from .drive import router as drive_router
from .health import router as health_router
from starlette.concurrency import run_in_threadpool

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
    if thread: thread.join(timeout=5)

app = FastAPI(title='Atlas Document Intelligence', lifespan=lifespan)
app.include_router(gmail_router)
app.include_router(external_router)
app.include_router(drive_router)
app.include_router(health_router)
log = logging.getLogger('atlas.requests')

@app.middleware('http')
async def request_diagnostics(request: Request, call_next):
    started = time.monotonic()
    request_id = secrets.token_hex(8)
    try:
        response = await call_next(request)
    except Exception:
        log.exception('request_failed id=%s method=%s path=%s', request_id, request.method, request.url.path)
        raise
    elapsed_ms = round((time.monotonic() - started) * 1000)
    response.headers['X-Request-ID'] = request_id
    response.headers['Server-Timing'] = f'api;dur={elapsed_ms}'
    log.info('request id=%s method=%s path=%s status=%s duration_ms=%s',
             request_id, request.method, request.url.path, response.status_code, elapsed_ms)
    return response



def database():
    with Session() as db: yield db

def user(request: Request, db=Depends(database)):
    token = request.cookies.get('atlas_session', '')
    login = db.get(Login, hashlib.sha256(token.encode()).hexdigest()) if token else None
    if not login or login.expires < time.time(): raise HTTPException(401, 'Sign in to continue.')
    return db.get(User, login.user_id)

def workspace(wid, actor, db):
    item = db.query(Workspace).filter_by(id=wid, owner_id=actor.id).first()
    if not item: raise HTTPException(404, 'Workspace not found.')
    return item

def document(wid, did, actor, db):
    workspace(wid, actor, db)
    item = db.query(Document).filter_by(id=did, workspace_id=wid).first()
    if not item: raise HTTPException(404, 'Document not found.')
    return item

def public_doc(d):
    return {key: getattr(d, key) for key in ['id','name','size','status','error','pages','chunk_count','created']}

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
    db.add(Login(token=hashlib.sha256(token.encode()).hexdigest(), user_id=actor.id, expires=time.time() + 604800))
    db.commit()
    response.set_cookie('atlas_session', token, max_age=604800, httponly=True, secure=COOKIE_SECURE, samesite='strict', path='/')
    return {'id': actor.id, 'email': actor.email}

@app.get('/api/workspaces/{wid}/processing-stats')
def processing_stats(wid: str, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    rows = db.query(Document.status, func.count(Document.id)).filter(
        Document.workspace_id == wid).group_by(Document.status).all()
    counts = {name: count for name, count in rows}
    return {
        'queued': counts.get('queued', 0),
        'processing': counts.get('processing', 0),
        'ready': counts.get('ready', 0),
        'failed': counts.get('failed', 0),
    }

@app.get('/api/health')
def health(): return {'status': 'ok'}

@app.post('/api/auth/register')
def register(body: Credentials, response: Response, db=Depends(database)):
    email = body.email.strip().lower()
    if '@' not in email: raise HTTPException(422, 'Enter a valid email address.')
    actor = User(email=email, password=password_hash(body.password))
    db.add(actor)
    try: db.commit()
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
    if not actor or not valid: raise HTTPException(401, 'Invalid email or password.')
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
    return {'id': actor.id, 'email': actor.email, 'mode': 'ai' if enabled() else 'local_excerpts', 'max_file_bytes':MAX_FILE_BYTES}

@app.get('/api/workspaces')
def workspaces(actor=Depends(user), db=Depends(database)):
    return [{'id': w.id, 'name': w.name} for w in db.query(Workspace).filter_by(owner_id=actor.id).order_by(Workspace.created)]

@app.post('/api/workspaces')
def create_workspace(body: Named, actor=Depends(user), db=Depends(database)):
    if not body.name.strip(): raise HTTPException(422, 'Workspace name is required.')
    item = Workspace(owner_id=actor.id, name=body.name.strip())
    db.add(item); db.commit()
    return {'id': item.id, 'name': item.name}

class DeleteWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)

@app.delete('/api/workspaces/{wid}')
def delete_workspace(wid: str, body: DeleteWorkspaceRequest, actor=Depends(user), db=Depends(database)):
    item = workspace(wid, actor, db)
    if body.name != item.name:
        raise HTTPException(422, 'Type the exact workspace name to confirm deletion.')
    documents = db.query(Document).filter_by(workspace_id=wid).all()
    if any(d.status in ('queued', 'processing') for d in documents):
        raise HTTPException(409, 'Wait for document uploads and processing to finish before deleting this workspace.')
    ids = [d.id for d in documents]
    # Use explicit deletes for SQLite and PostgreSQL; no reliance on ORM cascades.
    db.query(GmailOAuthState).filter_by(workspace_id=wid).delete(synchronize_session=False)
    db.query(DriveOAuthState).filter_by(workspace_id=wid).delete(synchronize_session=False)
    db.query(GmailConnection).filter_by(workspace_id=wid).delete(synchronize_session=False)
    db.query(ExternalConnection).filter_by(workspace_id=wid).delete(synchronize_session=False)
    db.query(Conversation).filter_by(workspace_id=wid).delete(synchronize_session=False)
    db.query(Chunk).filter_by(workspace_id=wid).delete(synchronize_session=False)
    db.query(Document).filter_by(workspace_id=wid).delete(synchronize_session=False)
    db.delete(item)
    db.commit()
    for did in ids:
        (DATA / 'files' / did).unlink(missing_ok=True)
    return {'ok': True}

@app.get('/api/workspaces/{wid}/documents')
def documents(wid: str, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    return [public_doc(d) for d in db.query(Document).filter_by(workspace_id=wid).order_by(Document.created.desc())]

@app.post('/api/workspaces/{wid}/uploads')
def start_upload(wid: str, body: UploadRequest, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    return uploads.start(wid, actor.id, body.name, body.size, MAX_FILE_BYTES, SUPPORTED)

@app.get('/api/workspaces/{wid}/uploads/{upload_id}')
def upload_status(wid: str, upload_id: str, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    return uploads.status(upload_id, wid, actor.id)

@app.put('/api/workspaces/{wid}/uploads/{upload_id}')
async def upload_part(wid: str, upload_id: str, request: Request, offset: int = 0, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    data = bytearray()
    async for block in request.stream():
        data.extend(block)
        if len(data) > uploads.PART_BYTES: raise HTTPException(413, 'Upload part exceeds 8 MB.')
    return await run_in_threadpool(uploads.append, upload_id, wid, actor.id, offset, data)

@app.post('/api/workspaces/{wid}/uploads/{upload_id}/complete')
def complete_upload(wid: str, upload_id: str, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    doc, duplicate = uploads.finish(upload_id, wid, actor.id, db)
    return {**public_doc(doc), 'duplicate':duplicate}

@app.delete('/api/workspaces/{wid}/uploads/{upload_id}')
def cancel_upload(wid: str, upload_id: str, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    return uploads.cancel(upload_id, wid, actor.id)

@app.post('/api/workspaces/{wid}/documents')
async def upload(wid: str, files: List[UploadFile] = File(...), actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    if len(files) > 50: raise HTTPException(422, 'Upload at most 50 files per batch.')
    results = []
    for file in files:
        name = Path((file.filename or 'untitled').replace('\\', '/')).name[:200]
        if Path(name).suffix.lower() not in SUPPORTED:
            results.append({'name': name, 'error': 'Supported formats: PDF, DOCX, TXT, MD, CSV, JSON, HTML.'}); continue
        did, count, digest = uid(), 0, hashlib.sha256()
        path = DATA / 'files' / did
        try:
            with path.open('wb') as out:
                while True:
                    block = await file.read(1024 * 1024)
                    if not block: break
                    count += len(block)
                    if count > MAX_FILE_BYTES: raise ValueError(f'File exceeds {MAX_FILE_BYTES // 1024 // 1024} MB limit.')
                    digest.update(block); out.write(block)
            if not count: raise ValueError('File is empty.')
            existing = db.query(Document).filter_by(workspace_id=wid, digest=digest.hexdigest()).first()
            if existing:
                path.unlink(missing_ok=True)
                results.append({**public_doc(existing), 'duplicate': True}); continue
            doc = Document(id=did, workspace_id=wid, name=name, size=count, digest=digest.hexdigest())
            db.add(doc)
            db.commit()
            results.append(public_doc(doc))
        except IntegrityError:
            db.rollback(); path.unlink(missing_ok=True)
            existing = db.query(Document).filter_by(workspace_id=wid, digest=digest.hexdigest()).first()
            if not existing: raise
            results.append({**public_doc(existing), 'duplicate': True})
        except ValueError as exc:
            path.unlink(missing_ok=True)
            results.append({'name': name, 'error': str(exc)})
        except Exception:
            db.rollback(); path.unlink(missing_ok=True)
            raise
        finally: await file.close()
    return {'documents': results}

@app.get('/api/workspaces/{wid}/documents/{did}/chunks')
def chunks(wid: str, did: str, offset: int = 0, actor=Depends(user), db=Depends(database)):
    doc = document(wid, did, actor, db)
    if offset < 0: raise HTTPException(422, 'Offset must be non-negative.')
    return {'document': public_doc(doc), 'chunks': [{'id': c.id, 'page': c.page, 'text': c.text} for c in db.query(Chunk).filter_by(document_id=did).order_by(Chunk.ordinal).offset(offset).limit(50)]}

@app.get('/api/workspaces/{wid}/documents/{did}/original')
def original(wid: str, did: str, actor=Depends(user), db=Depends(database)):
    doc = document(wid, did, actor, db)
    return FileResponse(DATA / 'files' / did, filename=doc.name, content_disposition_type='attachment')

@app.post('/api/workspaces/{wid}/documents/{did}/retry')
def retry(wid: str, did: str, actor=Depends(user), db=Depends(database)):
    doc = document(wid, did, actor, db)
    if doc.status not in ('failed', 'ready'): raise HTTPException(409, 'Document is already queued or processing.')
    db.query(Chunk).filter_by(document_id=did).delete()
    doc.status, doc.error, doc.chunk_count, doc.generation = 'queued', None, 0, doc.generation + 1
    db.commit()
    return public_doc(doc)

@app.delete('/api/workspaces/{wid}/documents/{did}')
def delete(wid: str, did: str, actor=Depends(user), db=Depends(database)):
    doc = document(wid, did, actor, db)
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

def owned_conversation(wid, cid, actor, db):
    workspace(wid, actor, db)
    item = db.query(Conversation).filter_by(id=cid, workspace_id=wid).first()
    if item is None:
        raise HTTPException(404, 'Conversation not found.')
    return item

def conversation_data(item):
    return {'id': item.id, 'title': item.title, 'messages': item.messages or [],
            'created': item.created, 'updated': item.updated}

@app.get('/api/workspaces/{wid}/conversations')
def list_conversations(wid: str, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    items = db.query(Conversation).filter_by(workspace_id=wid).order_by(Conversation.updated.desc()).all()
    return [{'id': c.id, 'title': c.title, 'updated': c.updated} for c in items]

@app.post('/api/workspaces/{wid}/conversations')
def create_conversation(wid: str, body: ConversationPayload, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    item = Conversation(workspace_id=wid, title=body.title.strip(), messages=body.messages)
    db.add(item)
    db.commit()
    return conversation_data(item)

@app.get('/api/workspaces/{wid}/conversations/{cid}')
def get_conversation(wid: str, cid: str, actor=Depends(user), db=Depends(database)):
    return conversation_data(owned_conversation(wid, cid, actor, db))

@app.put('/api/workspaces/{wid}/conversations/{cid}')
def update_conversation(wid: str, cid: str, body: ConversationPayload, actor=Depends(user), db=Depends(database)):
    item = owned_conversation(wid, cid, actor, db)
    item.title = body.title.strip()
    item.messages = body.messages
    item.updated = time.time()
    db.commit()
    return conversation_data(item)

@app.patch('/api/workspaces/{wid}/conversations/{cid}')
def rename_conversation(wid: str, cid: str, body: ConversationRename, actor=Depends(user), db=Depends(database)):
    item = owned_conversation(wid, cid, actor, db)
    item.title = body.title.strip()
    item.updated = time.time()
    db.commit()
    return conversation_data(item)

@app.delete('/api/workspaces/{wid}/conversations/{cid}')
def delete_conversation(wid: str, cid: str, actor=Depends(user), db=Depends(database)):
    db.delete(owned_conversation(wid, cid, actor, db))
    db.commit()
    return {'ok': True}

class ConnectedQuestion(Question):
    include_gmail: bool = False
    gmail_query: str = Field(default='newer_than:30d', max_length=400)
    providers: List[str] = Field(default_factory=list, max_length=4)


@app.post('/api/workspaces/{wid}/connected-chat')
def connected_chat(wid: str, body: ConnectedQuestion, request: Request,
                   actor=Depends(user), db=Depends(database)):
    """Retrieve evidence across workspace documents and optionally live Gmail."""
    workspace(wid, actor, db)
    if not body.question.strip():
        raise HTTPException(422, 'Enter a question.')
    if body.document_ids:
        count = db.query(Document).filter(Document.workspace_id == wid,
                    Document.id.in_(body.document_ids)).count()
        if count != len(set(body.document_ids)):
            raise HTTPException(404, 'Selected document not found.')
    from .gmail import connection, access_token, gmail_get, email_from_json, GMAIL_API
    from .ai import client, ollama_chat
    from .sources import Evidence
    from .external_sources import read_connection, source_search, PROVIDERS
    from .drive import access_token as drive_access_token, drive_search, drive_evidence
    import json
    import re
    if any(p not in (*PROVIDERS, 'drive') for p in body.providers):
        raise HTTPException(422, 'Unknown connected provider.')
    evidence = []
    document_evidence = {}
    try:
        for item in retrieve(wid, retrieval_query(body.question, body.history), body.document_ids)[:6]:
            evidence.append(Evidence('documents', item['chunk_id'], item['name'],
                                     item['text'][:1800], None))
            document_evidence[item['chunk_id']] = item
        if body.include_gmail:
            entry = connection(db, actor, wid)
            token = access_token(entry, db)
            matches = gmail_get(token, GMAIL_API + '/messages',
                    {'q': body.gmail_query, 'maxResults': 8}).get('messages', [])
            for m in matches:
                msg = email_from_json(gmail_get(token, GMAIL_API + '/messages/' + m['id'],
                                               {'format': 'full'}))
                evidence.append(Evidence('gmail', msg['id'], msg['subject'],
                                         (msg['body'] or msg['snippet'])[:1300],
                                         msg['url'], msg['date']))
        if 'drive' in body.providers:
            drive_token=drive_access_token(db,actor,wid)
            drive_items=drive_evidence(drive_token,drive_search(drive_token,body.question))
            for hit in drive_items:
                evidence.append(Evidence('drive',hit['id'],hit['title'],
                                         hit['excerpt'],hit.get('url')))
        for provider in dict.fromkeys(p for p in body.providers if p != 'drive'):
            _, provider_token = read_connection(db, actor, wid, provider)
            for hit in source_search(provider, provider_token, body.question)[:5]:
                evidence.append(Evidence(provider, hit['id'], hit['title'],
                                         hit.get('excerpt', '')[:1300], hit.get('url')))
    except HTTPException:
        raise
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception('Connected retrieval failed')
        raise HTTPException(502, 'Could not retrieve connected sources.') from exc
    if not evidence:
        return {'answer': 'No matching evidence was found in the selected sources.',
                'sources': [], 'mode': 'insufficient_evidence'}
    # A local 8k-context model cannot accept all retrieved source bodies at once.
    # Keep source IDs stable across retries so citations always refer to real evidence.
    from .connected_synthesis import synthesize_connected
    try:
        answer, payload = synthesize_connected(
            body.question, evidence, config.AI_PROVIDER, config.API_KEY,
            config.CHAT_MODEL, client, ollama_chat
        )
    except HTTPException:
        raise
    except ValueError as exc:
        import logging
        logging.getLogger(__name__).warning('Connected model reached generation/context limit: %s', exc)
        raise HTTPException(422, 'The local model could not complete this cross-source answer. Try a narrower Gmail query or fewer source types.') from exc
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception('Connected synthesis failed')
        raise HTTPException(502, 'Connected answer generation failed. Check the AI provider logs.') from exc
    refs = {int(x) for x in re.findall(r'\[(\d+)\]', answer or '')}
    if not refs or any(n < 1 or n > len(payload) for n in refs):
        return {'answer': 'AI did not produce verifiable citations. Try a narrower question.',
                'sources': [], 'mode': 'citation_check_failed'}
    # Preserve positional [n] citations used by the standard chat renderer.
    # Non-document evidence carries a URL so the UI opens the original record.
    sources = []
    for entry in payload:
        original = document_evidence.get(entry.get('origin_id')) if entry.get('provider') == 'documents' else None
        sources.append({
            'chunk_id': original['chunk_id'] if original else str(entry['source_id']),
            'document_id': original['document_id'] if original else '',
            'name': entry['title'],
            'page': original['page'] if original else 0,
            'text': entry['text'],
            'location_type': original['location_type'] if original else entry.get('provider','source'),
            'provider': entry.get('provider'),
            'url': entry.get('url'),
        })
    return {'answer': answer, 'sources': sources, 'mode': 'connected'}


@app.post('/api/workspaces/{wid}/chat')
def chat(wid: str, body: Question, actor=Depends(user), db=Depends(database)):
    workspace(wid, actor, db)
    if not body.question.strip(): raise HTTPException(422, 'Enter a question.')
    if body.document_ids:
        found = db.query(Document).filter(Document.workspace_id == wid, Document.id.in_(body.document_ids)).count()
        if found != len(set(body.document_ids)): raise HTTPException(404, 'Selected document not found.')
    query = retrieval_query(body.question, body.history)
    try:
        sources = retrieve(wid, query, body.document_ids)
        result = generate(body.question, sources, [t.model_dump() for t in body.history])
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception('Chat retrieval or generation failed')
        if isinstance(exc, (ConnectionError, TimeoutError)):
            detail = 'AI provider connection failed or timed out. Check the provider service and retry.'
        else:
            detail = 'Answer generation failed. Check your AI provider configuration and server logs, then retry.'
        raise HTTPException(502, detail) from exc
    # Do not return passages for documents deleted or reindexed during the provider call.
    if sources:
        current = db.query(Chunk.id).filter(Chunk.workspace_id == wid, Chunk.id.in_([s['chunk_id'] for s in sources])).count()
        if current != len(sources): raise HTTPException(409, 'Sources changed during the answer. Ask again.')
    return result
