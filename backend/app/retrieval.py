import math
import re
from difflib import SequenceMatcher
from collections import Counter
from sqlalchemy import text
from .db import Session, Chunk, Document, engine
from .ai import embed, enabled, embedding_model_id
from . import config

STOP = set('a an the is are was were of to in and or for on with what which how does do did can could would should please tell me about it this that from many there'.split())
GENERIC_FILENAME_TERMS = set('readme improved improvement improvements document documents project projects file files pdf docx txt md guide note notes review brief product summary overview gateway payment option'.split())
def tokens(value):
    result = []
    for term in re.findall(r'\w+', value.lower()):
        if term in STOP or len(term) <= 1: continue
        if len(term) > 4 and term.endswith('ies'):
            term = term[:-3] + 'y'
        elif len(term) > 4 and re.search(r'(ches|shes|sses|xes|zes)$', term):
            term = term[:-2]
        elif len(term) > 3 and term.endswith('s') and not term.endswith(('ss', 'us', 'is')):
            term = term[:-1]
        result.append(term)
    return result

def bm25(query, chunks):
    terms = tokens(query)
    if not terms or not chunks: return []
    docs = [Counter(tokens(c.text)) for c in chunks]
    lengths = [sum(d.values()) for d in docs]
    average = sum(lengths) / max(len(docs), 1) or 1
    frequency = {t: sum(t in d for d in docs) for t in set(terms)}
    scored = []
    for c, d, length in zip(chunks, docs, lengths):
        score = 0
        for t in set(terms):
            count = d[t]
            idf = math.log(1 + (len(docs) - frequency[t] + .5) / (frequency[t] + .5))
            score += idf * count * 2.5 / (count + 1.5 * (.25 + .75 * length / average))
        if score > 0: scored.append((c, score))
    return sorted(scored, key=lambda x: x[1], reverse=True)[:60]

def source(chunk, name):
    return {'chunk_id': chunk.id, 'document_id': chunk.document_id, 'name': name, 'page': chunk.page, 'text': chunk.text, 'location_type': 'page' if name.lower().endswith('.pdf') else 'section'}

def retrieve(workspace_id, query, document_ids=None, limit=8):
    with Session() as db:
        base = db.query(Chunk).join(Document).filter(Chunk.workspace_id == workspace_id, Document.status == 'ready')
        if document_ids: base = base.filter(Chunk.document_id.in_(document_ids))
        else:
            # When the question names an uploaded file, keep retrieval within that file.
            # This works for arbitrary document names and also supports comparisons by
            # retaining each explicitly named document.
            query_terms = set(tokens(query))
            named = []
            for document_id, name in db.query(Document.id, Document.name).filter_by(workspace_id=workspace_id):
                stem = re.sub(r'[_-]+', ' ', name.rsplit('.', 1)[0])
                terms = set(tokens(stem)) - GENERIC_FILENAME_TERMS
                if any(term in query_terms or any(len(term) > 4 and SequenceMatcher(None, term, q).ratio() >= .9 for q in query_terms) for term in terms):
                    named.append(document_id)
            if named:
                base = base.filter(Chunk.document_id.in_(named))
        semantic = []
        if engine.dialect.name == 'postgresql':
            search = "plainto_tsquery('english', :query)"
            lexical = base.filter(text(f"to_tsvector('english', chunks.text) @@ {search}")).order_by(text(f"ts_rank_cd(to_tsvector('english', chunks.text), {search}) DESC")).params(query=query).limit(60).all()
            if enabled():
                vector = embed([query])[0]
                semantic = base.filter(Chunk.embedding_model == embedding_model_id(), Chunk.embedding.isnot(None), Chunk.embedding.cosine_distance(vector) < .8).order_by(Chunk.embedding.cosine_distance(vector)).limit(60).all()
        else:
            chunks = base.all()
            lexical = [c for c, _ in bm25(query, chunks)]
            if enabled():
                vector = embed([query])[0]
                norm = math.sqrt(sum(v*v for v in vector)) or 1
                ranked = []
                for c in chunks:
                    if c.embedding is not None and c.embedding_model == embedding_model_id():
                        similarity = sum(a*b for a,b in zip(vector, c.embedding)) / (norm * (math.sqrt(sum(v*v for v in c.embedding)) or 1))
                        if similarity > .2: ranked.append((c, similarity))
                semantic = [c for c, _ in sorted(ranked, key=lambda x:x[1], reverse=True)[:60]]
        # Weight exact lexical matches more strongly for precise facts; semantic ranks
        # still recover paraphrases and vocabulary that does not overlap the query.
        scores, candidates = {}, {}
        for ranking, weight in [(lexical, 4.0), (semantic, 1.0)]:
            for rank, c in enumerate(ranking):
                scores[c.id] = scores.get(c.id, 0) + weight / (60 + rank + 1)
                candidates[c.id] = c
        terms = set(tokens(query))
        selected = sorted(candidates.values(), key=lambda c: scores[c.id] + .001 * len(terms & set(tokens(c.text))) / max(len(terms), 1), reverse=True)[:limit]
        names = {d.id: d.name for d in db.query(Document).filter(Document.workspace_id == workspace_id)}
        return [source(c, names[c.document_id]) for c in selected]
