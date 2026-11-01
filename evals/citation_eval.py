"""Offline, deterministic citation-audit benchmark.

Fixture labels describe *known audit signals*, not semantic entailment.
Run with: PYTHONPATH=backend python evals/citation_eval.py evals/citation_cases.json
"""
import argparse
import json
from pathlib import Path

from app.citation_audit import audit_citations


def evaluate(cases):
    if not cases:
        raise ValueError("No citation evaluation cases.")
    correct = 0
    by_label = {}
    for case in cases:
        rows = audit_citations(case["answer"], case["sources"])["claims"]
        if len(rows) != 1:
            raise ValueError("Each fixture case must contain exactly one claim.")
        observed = rows[0]["status"]
        label = case["expected_status"]
        correct += observed == label
        bucket = by_label.setdefault(label, {"correct": 0, "total": 0})
        bucket["total"] += 1
        bucket["correct"] += observed == label
    return {"cases": len(cases), "accuracy": round(correct / len(cases), 4),
            "by_label": {key: {"total": data["total"],
                                "accuracy": round(data["correct"] / data["total"], 4)}
                         for key, data in by_label.items()},
            "warning": "Heuristic metrics, not factual entailment accuracy."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("fixture", type=Path)
    args = parser.parse_args()
    cases = json.loads(args.fixture.read_text(encoding="utf-8"))["cases"]
    print(json.dumps(evaluate(cases), indent=2))


if __name__ == "__main__":
    main()
