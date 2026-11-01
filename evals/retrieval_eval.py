"""Reproducible offline evidence-retrieval evaluation.

Fixture JSON shape: {"cases": [{"question": "...", "candidates":
[{"id": "passage-1", "text": "..."}], "relevant_ids": ["passage-1"]}]}.
No external model or real credentials needed.
"""
import argparse
import json
from pathlib import Path


def score_case(ranked_ids, relevant_ids, k=5):
    relevant = set(relevant_ids)
    top = ranked_ids[:k]
    hits = len(set(top) & relevant)
    reciprocal_rank = next((1 / i for i, item in enumerate(top, 1) if item in relevant), 0.0)
    return {"recall_at_k": hits / len(relevant) if relevant else 0.0,
            "precision_at_k": hits / len(top) if top else 0.0,
            "mrr_at_k": reciprocal_rank}


def evaluate(cases, ranker, k=5):
    results = []
    for case in cases:
        ranked = ranker(case["question"], case["candidates"])
        results.append(score_case(ranked, case["relevant_ids"], k=k))
    if not results:
        raise ValueError("Evaluation fixture has no cases.")
    return {"cases": len(results), "k": k,
            **{key: round(sum(row[key] for row in results) / len(results), 4)
               for key in ("recall_at_k", "precision_at_k", "mrr_at_k")}}


def lexical_rank(query, candidates):
    # Same BM25 implementation as production retrieval (without DB dependency).
    from app.retrieval import bm25
    from types import SimpleNamespace
    rows = [SimpleNamespace(id=c["id"], text=c["text"]) for c in candidates]
    return [c.id for c, score in bm25(query, rows)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture", type=Path)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.k < 1:
        parser.error("--k must be positive")
    cases = json.loads(args.fixture.read_text(encoding="utf-8"))["cases"]
    metrics = evaluate(cases, lexical_rank, k=args.k)
    result = json.dumps(metrics, indent=2)
    if args.output:
        args.output.write_text(result + "\n", encoding="utf-8")
    print(result)


if __name__ == "__main__":
    main()
