# Atlas retrieval evaluation

Run from repository root after installing backend requirements:

```sh
PYTHONPATH=backend python evals/retrieval_eval.py evals/retrieval_cases.json --k 1
```

This is a two-case smoke fixture for Atlas's BM25 ranking implementation, not a
representative quality benchmark. Use it to inspect the metric output while
developing. Its synthetic labels are not independently reviewed.

This fixture **does not measure claim-level citation entailment**,
cross-connector retrieval, semantic ranking, or production answer quality.
Lexical citation checks are heuristics, not proof that a claim follows from its
source. Meaningful quality metrics require a representative, human-reviewed set.

The historical document Q&A results are kept in `results/`. Rebuild their
interactive HTML report with `python evals/render.py` from the repository root.
The generated `evals/report.html` is ignored by Git and is not part of the source
tree.
