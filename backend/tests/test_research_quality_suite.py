import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[2] / "evals"))
from research_quality_suite import evaluate


def test_seeded_research_cases_are_balanced_and_labeled():
    dataset = json.loads((Path(__file__).parents[2] / "evals/research_quality_suite.json").read_text())
    summary = evaluate(dataset)
    assert summary["cases"] == 96
    assert len(summary["categories"]) == 12
    assert all(v["cases"] == 8 for v in summary["categories"].values())
    assert summary["review_status"] == "unreviewed"
