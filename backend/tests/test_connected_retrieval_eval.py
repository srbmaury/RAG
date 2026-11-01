import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2] / "evals"))
from connected_retrieval_eval import evaluate


def test_labeled_cross_source_retrieval_metrics():
    cases = [{"question": "Redis cache",
              "candidates": [
                  {"provider": "notion", "id": "1", "title": "Something unrelated",
                   "excerpt": "Weekly notes"},
                  {"provider": "github", "id": "2", "title": "Redis cache",
                   "excerpt": "Redis cache invalidation"},
              ],
              "relevant_ids": ["github:2"]}]
    result = evaluate(cases, k=1)
    assert result["recall_at_k"] == 1
    assert result["mrr_at_k"] == 1
