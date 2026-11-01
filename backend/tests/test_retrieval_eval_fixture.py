import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2] / 'evals'))
from retrieval_eval import evaluate, lexical_rank


def test_default_retrieval_fixture_is_present_and_runnable():
    path = Path(__file__).parents[2] / 'evals' / 'retrieval_cases.json'
    cases = json.loads(path.read_text(encoding='utf-8'))['cases']
    assert len(cases) >= 2
    report = evaluate(cases, lexical_rank, k=1)
    assert report['cases'] == len(cases)
    assert report['recall_at_k'] == 1
    assert report['precision_at_k'] == 1
    assert report['mrr_at_k'] == 1
