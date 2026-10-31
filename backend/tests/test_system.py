import os
import tempfile
import time
from pathlib import Path
from types import SimpleNamespace

os.environ['DATA_DIR'] = tempfile.mkdtemp(prefix='atlas-test-')
os.environ['DATABASE_URL'] = 'sqlite:///' + os.environ['DATA_DIR'] + '/test.db'
os.environ['INLINE_WORKER'] = 'false'
os.environ['OPENAI_API_KEY'] = ''
os.environ['AI_PROVIDER'] = 'none'

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Session, Document, Chunk
from app.worker import run_one, claim
from app.ingest import split_text
from app import ai, config

@pytest.fixture
def client():
    with TestClient(app) as c:
        email = f'{time.time_ns()}@example.com'
        assert c.post('/api/auth/register', json={'email':email,'password':'a-long-password'}).status_code == 200
        yield c

def wid(c): return c.get('/api/workspaces').json()[0]['id']
def upload(c, w, name='brief.md', text='The approved project budget is INR 75000. Maya owns the launch on 15 December 2026.'):
    response = c.post(f'/api/workspaces/{w}/documents', files=[('files',(name,text.encode(),'text/plain'))])
    assert response.status_code == 200
    return response.json()['documents'][0]

def drain():
    for _ in range(30):
        if not run_one(): break


def test_upload_retrieve_deduplicate_delete(client):
    w = wid(client)
    d = upload(client, w)
    assert d['status'] == 'queued'
    duplicate = upload(client, w)
    assert duplicate['id'] == d['id'] and duplicate['duplicate']
    drain()
    docs = client.get(f'/api/workspaces/{w}/documents').json()
    assert docs[0]['status'] == 'ready' and docs[0]['chunk_count'] > 0
    answer = client.post(f'/api/workspaces/{w}/chat', json={'question':'What is the project budget?'}).json()
    assert answer['mode'] == 'local_excerpts'
    assert '75000' in answer['answer']
    assert answer['sources'][0]['document_id'] == d['id']
    preview = client.get(f'/api/workspaces/{w}/documents/{d["id"]}/chunks').json()
    assert preview['chunks'][0]['text'] == answer['sources'][0]['text']
    assert client.delete(f'/api/workspaces/{w}/documents/{d["id"]}').status_code == 200
    assert not (config.DATA / 'files' / d['id']).exists()
    answer = client.post(f'/api/workspaces/{w}/chat', json={'question':'budget'}).json()
    assert answer['mode'] == 'insufficient_evidence' and not answer['sources']


def test_accounts_and_workspace_isolation(client):
    w = wid(client); d = upload(client,w); drain()
    with TestClient(app) as other:
        assert other.get(f'/api/workspaces/{w}/documents').status_code == 401
        other.post('/api/auth/register',json={'email':f'{time.time_ns()}@other.com','password':'another-long-password'})
        for suffix in ['/documents', f'/documents/{d["id"]}/chunks', f'/documents/{d["id"]}/original']:
            assert other.get(f'/api/workspaces/{w}{suffix}').status_code == 404
        assert other.delete(f'/api/workspaces/{w}/documents/{d["id"]}').status_code == 404
        other_w = wid(other)
        assert other.post(f'/api/workspaces/{other_w}/chat',json={'question':'budget','document_ids':[d['id']]}).status_code == 404
        answer = other.post(f'/api/workspaces/{other_w}/chat',json={'question':'budget'}).json()
        assert not answer['sources']
    assert client.post('/api/auth/logout').status_code == 200
    assert client.get('/api/me').status_code == 401


def test_processing_failure_retry_and_lease_recovery(client):
    w = wid(client)
    d = upload(client,w,'broken.pdf','not a PDF')
    drain()
    docs = client.get(f'/api/workspaces/{w}/documents').json()
    assert docs[0]['status'] == 'failed'
    assert client.post(f'/api/workspaces/{w}/documents/{d["id"]}/retry').json()['status'] == 'queued'
    claimed = claim(Document)
    assert claimed[0] == d['id']
    assert claim(Document) is None
    with Session() as db:
        doc = db.get(Document,d['id']); doc.lease = time.time()-1; db.commit()
    reclaimed = claim(Document)
    assert reclaimed == (d['id'], claimed[1]+1)
    drain()


def test_scoped_search_and_unanswerable(client):
    w = wid(client)
    first = upload(client,w,'finance.md','The finance budget is 75000 rupees.')
    second = upload(client,w,'travel.md','Travel reimbursement requires manager approval.')
    drain()
    answer = client.post(f'/api/workspaces/{w}/chat',json={'question':'budget','document_ids':[second['id']]}).json()
    assert answer['mode'] == 'insufficient_evidence'
    answer = client.post(f'/api/workspaces/{w}/chat',json={'question':'budget','document_ids':[first['id']]}).json()
    assert {s['document_id'] for s in answer['sources']} == {first['id']}
    assert client.post(f'/api/workspaces/{w}/chat',json={'question':'   '}).status_code == 422


def test_validation_and_password_login(client):
    w = wid(client)
    bad = upload(client,w,'virus.exe','text')
    assert 'error' in bad and 'id' not in bad
    assert 'error' in upload(client,w,'empty.txt','')
    email = client.get('/api/me').json()['email']
    client.post('/api/auth/logout')
    assert client.post('/api/auth/login',json={'email':email,'password':'wrong-long-password'}).status_code == 401
    assert client.post('/api/auth/login',json={'email':email,'password':'a-long-password'}).status_code == 200
    assert client.get('/api/me').status_code == 200


def test_chunker_preserves_end_and_bounded_size():
    original = 'word ' * 2000 + 'END_MARKER'
    chunks = list(split_text(original))
    assert chunks[-1].endswith('END_MARKER')
    assert all(len(c) <= 1800 for c in chunks)


def test_ai_invalid_citations_rejected(monkeypatch):
    monkeypatch.setattr(config,'API_KEY','test-key')
    fake = SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: SimpleNamespace(output_text='Budget is 99 [7]')))
    monkeypatch.setattr(ai,'client',lambda:fake)
    result = ai.generate('budget',[{'name':'test','page':1,'text':'Budget is 20'}])
    assert result['mode'] == 'citation_check_failed'
    fake.responses.create = lambda **kwargs: SimpleNamespace(output_text='Budget is 20 [1]')
    assert ai.generate('budget',[{'name':'test','page':1,'text':'Budget is 20'}])['mode'] == 'ai'


def test_ai_embedding_order(monkeypatch):
    monkeypatch.setattr(config,'API_KEY','test-key')
    fake = SimpleNamespace(embeddings=SimpleNamespace(create=lambda **kwargs:SimpleNamespace(data=[SimpleNamespace(index=1,embedding=[2]),SimpleNamespace(index=0,embedding=[1])])))
    monkeypatch.setattr(ai,'client',lambda:fake)
    assert ai.embed(['one','two']) == [[1],[2]]


def test_pdf_page_sources_and_blank_page_rejection(client):
    import io
    from pypdf import PdfWriter
    from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject
    writer = PdfWriter()
    page = writer.add_blank_page(width=612,height=792)
    font = DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
    stream = DecodedStreamObject()
    stream.set_data(b'BT /F1 12 Tf 50 700 Td (The approved budget is 12345 rupees.) Tj ET')
    page[NameObject('/Contents')] = writer._add_object(stream)
    out = io.BytesIO(); writer.write(out)
    w = wid(client)
    response = client.post(f'/api/workspaces/{w}/documents',files={'files':('text.pdf',out.getvalue(),'application/pdf')})
    assert response.status_code == 200
    drain()
    result = client.post(f'/api/workspaces/{w}/chat',json={'question':'budget'}).json()
    assert result['sources'][0]['page'] == 1
    assert result['sources'][0]['location_type'] == 'page'
    assert '12345' in result['answer']
    writer.add_blank_page(width=612,height=792)
    out = io.BytesIO(); writer.write(out)
    client.post(f'/api/workspaces/{w}/documents',files={'files':('partial-scan.pdf',out.getvalue(),'application/pdf')})
    drain()
    doc = next(d for d in client.get(f'/api/workspaces/{w}/documents').json() if d['name']=='partial-scan.pdf')
    assert doc['status'] == 'failed' and 'OCR' in doc['error']
    assert doc['chunk_count'] == 0


def test_docx_tables_and_sections(client):
    import io
    from docx import Document as WordDocument
    doc = WordDocument()
    doc.add_paragraph('Launch owner is Maya.')
    table = doc.add_table(rows=1, cols=2)
    table.cell(0,0).text = 'Budget'
    table.cell(0,1).text = '45000'
    out = io.BytesIO(); doc.save(out)
    w = wid(client)
    client.post(f'/api/workspaces/{w}/documents', files={'files':('brief.docx',out.getvalue(),'application/vnd.openxmlformats-officedocument.wordprocessingml.document')})
    drain()
    result = client.post(f'/api/workspaces/{w}/chat',json={'question':'budget'}).json()
    assert result['sources'][0]['location_type'] == 'section'
    assert '45000' in result['answer']


def test_upload_limits(client, monkeypatch):
    from app import main
    w = wid(client)
    upload(client, w)
    drain()
    upload(client, w, 'new.md', 'New evidence changes the budget to 80000.')
    monkeypatch.setattr(main, 'MAX_FILE_BYTES', 10)
    result = upload(client, w, 'too-large.md', 'x' * 11)
    assert 'error' in result and 'id' not in result
    files = list((config.DATA / 'files').iterdir())
    with Session() as db:
        ids = {d.id for d in db.query(Document)}
    assert all(p.name in ids for p in files)


def test_hybrid_semantic_retrieval(client, monkeypatch):
    from app import retrieval
    w = wid(client)
    d = upload(client,w,'retention.md','Customer churn fell by ten percent.')
    drain()
    vector = [1.] + [0.] * 1535
    with Session() as db:
        chunk = db.query(Chunk).filter_by(document_id=d['id']).first()
        chunk.embedding = vector
        chunk.embedding_model = config.EMBED_MODEL
        db.commit()
    monkeypatch.setattr(config,'API_KEY','mock-provider')
    monkeypatch.setattr(retrieval,'embed',lambda texts:[vector for _ in texts])
    # No literal overlap; the mocked embedding supplies the semantic match.
    sources = retrieval.retrieve(w,'subscriber attrition')
    assert sources[0]['document_id'] == d['id']


def test_stale_job_cannot_publish_after_reindex(client):
    from app.ingest import ingest
    w = wid(client); d = upload(client,w)
    job_id, generation = claim(Document)
    with Session() as db:
        doc = db.get(Document,job_id)
        doc.generation += 1
        doc.status = 'queued'
        db.commit()
    ingest(job_id,generation,lambda:True)
    with Session() as db:
        assert db.get(Document,job_id).status == 'queued'
        assert db.query(Chunk).filter_by(document_id=job_id).count() == 0
    drain()


def test_local_chat_is_question_specific_and_topic_changes_do_not_reuse_history(client):
    w = wid(client)
    text = ('# Pilot brief\nThe monthly infrastructure budget is INR 75000. '
            'The Atlas pilot launches on 15 December 2026. '
            'Maya owns the pilot launch. '
            'Scanned PDFs require OCR before uploading.')
    upload(client,w,'pilot.md',text); drain()
    history = []
    def ask(question):
        result = client.post(f'/api/workspaces/{w}/chat',json={'question':question,'history':history}).json()
        history.extend([{'role':'user','content':question},{'role':'assistant','content':result['answer']}])
        return result
    budget = ask('infra budget')
    assert '75000' in budget['answer'] and '15 December' not in budget['answer']
    assert 'OCR' not in budget['answer']
    launch = ask('pilot launch date')
    assert '15 December 2026' in launch['answer'] and '75000' not in launch['answer']
    unrelated = ask('leave policy')
    assert unrelated['mode'] == 'insufficient_evidence' and unrelated['sources'] == []
    repeated = ask('leave policy')
    assert repeated == unrelated
    # Source preview still contains the complete original evidence.
    assert budget['sources'][0]['text'] == text


def test_explicit_followup_retains_context_without_contaminating_new_topics():
    from app.query_context import retrieval_query
    history = [SimpleNamespace(role='user',content='Tell me about the Atlas pilot')]
    assert retrieval_query('What is its budget?',history).endswith('Tell me about the Atlas pilot')
    assert retrieval_query('leave policy',history) == 'leave policy'
    assert retrieval_query('infra budget',history) == 'infra budget'


def test_chunked_upload_offsets_completion_duplicates_and_access(client):
    w = wid(client)
    data = b'A large document has a project budget of 12345.\n' * 20
    start = client.post(f'/api/workspaces/{w}/uploads',json={'name':'large.md','size':len(data)})
    assert start.status_code == 200
    job = start.json()['id']; base = f'/api/workspaces/{w}/uploads/{job}'
    assert client.post(base+'/complete').status_code == 409
    first = client.put(base+'?offset=0',content=data[:100],headers={'Content-Type':'application/octet-stream'})
    assert first.json()['offset'] == 100
    assert client.put(base+'?offset=0',content=data[:100]).status_code == 409
    assert client.get(base).json()['offset'] == 100
    assert client.put(base+'?offset=100',content=data[100:]).status_code == 200
    assert client.put(base+f'?offset={len(data)}',content=b'extra').status_code == 413
    with TestClient(app) as other:
        other.post('/api/auth/register',json={'email':f'{time.time_ns()}@upload.test','password':'another-long-password'})
        ow = wid(other)
        assert other.get(base).status_code == 404
        assert other.get(f'/api/workspaces/{ow}/uploads/{job}').status_code == 404
        assert other.put(f'/api/workspaces/{ow}/uploads/{job}?offset=0',content=b'x').status_code == 404
    result = client.post(base+'/complete')
    assert result.status_code == 200 and not result.json()['duplicate']
    assert client.get(base).status_code == 404
    drain()
    d = result.json()
    assert (config.DATA / 'files' / d['id']).read_bytes() == data
    duplicate = client.post(f'/api/workspaces/{w}/uploads',json={'name':'same.md','size':len(data)}).json()['id']
    path = f'/api/workspaces/{w}/uploads/{duplicate}'
    client.put(path+'?offset=0',content=data)
    completed = client.post(path+'/complete').json()
    assert completed['duplicate'] and completed['id'] == d['id']


def test_staged_upload_validation_and_cancellation(client,monkeypatch):
    from app import main
    w = wid(client)
    monkeypatch.setattr(main,'MAX_FILE_BYTES',100)
    path = f'/api/workspaces/{w}/uploads'
    assert client.post(path,json={'name':'big.pdf','size':101}).status_code == 413
    assert client.post(path,json={'name':'bad.exe','size':10}).status_code == 422
    job = client.post(path,json={'name':'valid.md','size':50}).json()['id']
    assert client.delete(path+'/'+job).status_code == 200
    assert client.get(path+'/'+job).status_code == 404
    assert not (config.DATA/'uploads'/f'{job}.part').exists()


def test_country_count_answers_numeric_evidence_instead_of_titles(client):
    w = wid(client)
    upload(client,w,'Asia.md','## World map\nAsia North America\nNorth America\nA continent in many voices')
    data = ('NORTH AMERICA / ABOUT THIS VOLUME\nA continent in many voices\n'
            'This book uses a broad geographic definition of North America, including Central America and the Caribbean. '
            'It gives each of the region’s 23 sovereign countries its own chapter. '
            'Greenland and Puerto Rico are non-sovereign places in a separate reference section.')
    target = upload(client,w,'North_America.md',data)
    drain()
    result = client.post(f'/api/workspaces/{w}/chat',json={'question':'how many countries are there in North America'}).json()
    assert result['mode'] == 'insufficient_evidence'
    assert result['sources'] == []


def test_saved_conversations_are_scoped_and_editable(client):
    w = wid(client)
    route = f'/api/workspaces/{w}/conversations'
    first = client.post(route, json={'title':'Budget research','messages':[{'role':'user','content':'What is the budget?'}]})
    assert first.status_code == 200
    cid = first.json()['id']
    assert client.get(route).json()[0]['id'] == cid
    assert client.get(f'{route}/{cid}').json()['messages'][0]['content'] == 'What is the budget?'
    updated = client.put(f'{route}/{cid}', json={'title':'Budget research','messages':[
        {'role':'user','content':'What is the budget?'},
        {'role':'assistant','content':'INR 75000 [1]','result':{'answer':'INR 75000 [1]','sources':[],'mode':'ai'}}]})
    assert updated.status_code == 200
    assert len(updated.json()['messages']) == 2
    renamed = client.patch(f'{route}/{cid}',json={'title':'Budget notes'})
    assert renamed.status_code == 200 and renamed.json()['title'] == 'Budget notes'
    with TestClient(app) as other:
        other.post('/api/auth/register',json={'email':f'{time.time_ns()}@second.com','password':'another-long-password'})
        ow = wid(other)
        assert other.get(f'/api/workspaces/{ow}/conversations/{cid}').status_code == 404
        assert other.delete(f'/api/workspaces/{ow}/conversations/{cid}').status_code == 404
    assert client.delete(f'{route}/{cid}').status_code == 200
    assert client.get(f'{route}/{cid}').status_code == 404


def test_insights_endpoints_are_removed(client):
    w = wid(client)
    assert client.get(f'/api/workspaces/{w}/analyses').status_code == 404
    assert client.post(f'/api/workspaces/{w}/analyses',json={'kind':'summary'}).status_code == 404

def test_workspace_deletion_requires_owner_and_confirmation(client):
    w=wid(client)
    document=upload(client,w)
    drain()
    created=client.post(f'/api/workspaces/{w}/conversations',json={'title':'Delete test','messages':[]}).json()
    assert client.request('DELETE',f'/api/workspaces/{w}',json={'name':'wrong'}).status_code==422
    with TestClient(app) as other:
        other.post('/api/auth/register',json={'email':f'{time.time_ns()}@another.com','password':'another-long-password'})
        assert other.request('DELETE',f'/api/workspaces/{w}',json={'name':'My knowledge base'}).status_code==404
    result=client.request('DELETE',f'/api/workspaces/{w}',json={'name':'My knowledge base'})
    assert result.status_code==200
    assert not (config.DATA/'files'/document['id']).exists()
    assert client.get(f'/api/workspaces/{w}/conversations/{created["id"]}').status_code==404
    assert all(item['id']!=w for item in client.get('/api/workspaces').json())


def test_gmail_routes_are_authenticated_and_config_guarded(client, monkeypatch):
    from app import gmail
    w = wid(client)
    route = f'/api/workspaces/{w}/gmail'
    assert client.get(f'/api/gmail/status?wid={w}').json()['connected'] is False
    assert client.post(route+'/search',json={'query':'in:inbox'}).status_code == 409
    assert client.post(route+'/summarize',json={'message_ids':[]}).status_code == 422
    with TestClient(app) as stranger:
        assert stranger.get(f'/api/gmail/status?wid={w}').status_code == 401
    monkeypatch.setattr(gmail,'CLIENT','')
    assert client.get(f'/api/gmail/connect?wid={w}').status_code == 503
