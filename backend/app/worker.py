import logging
import threading
import time
from sqlalchemy import or_, and_
from .db import Session, Document, Analysis, Chunk
from .ingest import ingest
from .retrieval import source
from .ai import generate, enabled
from . import config

log = logging.getLogger(__name__)

def claim(model):
    now = time.time()
    with Session() as db:
        eligible = or_(model.status == 'queued', and_(model.status == 'processing', model.lease < now))
        job = db.query(model).filter(eligible).order_by(model.created).first()
        if not job: return None
        generation = job.generation + 1
        changed = db.query(model).filter(model.id == job.id, model.generation == job.generation, eligible).update({'status': 'processing', 'lease': now + 600, 'generation': generation}, synchronize_session=False)
        db.commit()
        return (job.id, generation) if changed else None

def heartbeat(model, job_id, generation):
    with Session() as db:
        changed = db.query(model).filter_by(id=job_id, generation=generation, status='processing').update({'lease': time.time() + 600})
        db.commit()
        return bool(changed)

def analyze(job_id, generation):
    with Session() as db:
        job = db.get(Analysis, job_id)
        if not job: return
        wid, kind = job.workspace_id, job.kind
        docs = db.query(Document).filter_by(workspace_id=wid).order_by(Document.created).all()
        snapshot = {d.id: d.generation for d in docs}
        ready = [d for d in docs if d.status == 'ready']
        excluded = [{'name': d.name, 'status': d.status} for d in docs if d.status != 'ready']
        results = []
        for doc in ready:
            chunks = db.query(Chunk).filter_by(document_id=doc.id).order_by(Chunk.ordinal).all()
            # Every chunk is processed; never silently truncate a collection to top-k.
            batches = []
            for i in range(0, len(chunks), 6):
                if not heartbeat(Analysis, job_id, generation): return
                sources = [source(c, doc.name) for c in chunks[i:i+6]]
                prompt = {'summary': 'Summarize the key facts and decisions.', 'risks': 'Identify explicitly supported risks, unresolved issues, and conflicting claims in these passages. Report each supported item with a citation, even if only one category has evidence. Categories are independent: missing conflicts must not prevent reporting a stated risk or unresolved issue. For a category with no evidence, say no items were stated in these passages; do not refuse the entire report. Distinguish your interpretation from stated facts.', 'timeline': 'Extract events with explicit dates. Do not infer dates.'}[kind]
                result = generate(prompt, sources)
                batches.append(result)
            results.append({'document_id': doc.id, 'name': doc.name, 'batches': batches})
    with Session() as db:
        job = db.get(Analysis, job_id)
        if not job or job.generation != generation or job.status != 'processing': return
        current = {d.id: d.generation for d in db.query(Document).filter_by(workspace_id=wid)}
        if current != snapshot: raise ValueError('Documents changed during analysis. Run it again for a consistent report.')
        job.result = {'kind': kind, 'mode': 'ai' if enabled() else 'local_excerpts', 'coverage': {'total': len(docs), 'analyzed': len(ready), 'excluded': excluded}, 'documents': results, 'note': 'Findings are grouped by document and batch; cross-document synthesis is not yet implemented.'}
        job.status, job.error = 'ready', None
        db.commit()

def run_one():
    for model, handler in [(Document, ingest), (Analysis, analyze)]:
        claimed = claim(model)
        if not claimed: continue
        job_id, generation = claimed
        try:
            if model is Document: handler(job_id, generation, lambda: heartbeat(model, job_id, generation))
            else: handler(job_id, generation)
        except Exception as exc:
            log.exception('Background job failed: %s', job_id)
            # Persist a useful error without exposing provider secrets or response bodies.
            message = str(exc)[:400] if isinstance(exc, (ValueError, UnicodeError)) else 'Processing failed. Check server logs, then retry.'
            with Session() as db:
                db.query(model).filter_by(id=job_id, generation=generation, status='processing').update({'status': 'failed', 'error': message})
                db.commit()
        return True
    return False

def loop(stop):
    while not stop.is_set():
        try: busy = run_one()
        except Exception:
            log.exception('Worker polling failed')
            busy = False
        if not busy: stop.wait(1)

if __name__ == '__main__':
    from .db import init_db
    init_db()
    loop(threading.Event())
