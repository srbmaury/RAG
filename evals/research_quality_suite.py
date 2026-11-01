"""Validate labeled research cases and measure selected-source recall.

This evaluates the actual Atlas evidence ranker, not answer truthfulness.
Dataset review_status must change only after independent human adjudication.
"""
import argparse
import json
from pathlib import Path
from app.sources import Evidence
from app.evidence_quality import prepare_evidence


def evaluate(dataset, k=3):
    cases = dataset.get("cases") or []
    if not cases:
        raise ValueError("Dataset must include cases")
    seen = set()
    scores = {}
    for case in cases:
        identifier = case["id"]
        if identifier in seen:
            raise ValueError("Duplicate case ID: " + identifier)
        seen.add(identifier)
        candidates = [Evidence(provider=row["provider"], source_id=row["id"],
                               title=row["title"], excerpt=row["excerpt"]) for row in case["sources"]]
        ids = [f"{item.provider}:{item.source_id}" for item in prepare_evidence(case["question"], candidates, limit=k)]
        gold = set(case["required_source_ids"])
        available = {f"{item.provider}:{item.source_id}" for item in candidates}
        if not gold or not gold.issubset(available):
            raise ValueError("Gold evidence must be present among candidates: " + identifier)
        label = case["category"]
        row = scores.setdefault(label, {"count": 0, "hits": 0, "top1": 0})
        row["count"] += 1
        row["hits"] += len(gold.intersection(ids)) == len(gold)
        row["top1"] += bool(ids and ids[0] in gold)
    return {"cases": len(cases), "review_status": dataset.get("review_status", "unknown"),
            "source_recall_at_k": round(sum(row["hits"] for row in scores.values()) / len(cases), 4),
            "top1_hit_rate": round(sum(row["top1"] for row in scores.values()) / len(cases), 4),
            "categories": {key: {"cases": value["count"], "recall_at_k": round(value["hits"] / value["count"], 4),
                                 "top1_hit_rate": round(value["top1"] / value["count"], 4)}
                           for key, value in sorted(scores.items())},
            "warning": "Tiny synthetic candidate sets; recall_at_k can be trivial when k exceeds candidate count. Top-1 measures ordering, not factual correctness."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--k", type=int, default=3)
    args = parser.parse_args()
    if args.k < 1:
        parser.error("--k must be positive")
    print(json.dumps(evaluate(json.loads(args.dataset.read_text(encoding="utf-8")), args.k), indent=2))


if __name__ == "__main__":
    main()
