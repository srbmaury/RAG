import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2] / "evals"))
from citation_eval import evaluate


def test_fixture_evaluation_metrics():
    cases = [
        {"answer": "The release date is 2028 [1].", "sources": [{"text": "The release date is 2027."}],
         "expected_status": "number_mismatch"},
        {"answer": "No reference.", "sources": [{"text": "Some evidence."}],
         "expected_status": "missing_citation"},
    ]
    result = evaluate(cases)
    assert result["cases"] == 2
    assert result["accuracy"] == 1.0
