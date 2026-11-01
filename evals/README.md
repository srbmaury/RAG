# Atlas retrieval evaluation

Run from repository root after installing backend requirements:

```sh
PYTHONPATH=backend python evals/retrieval_eval.py evals/sample_cases.json --k 3 --output evals/results.json
```

The offline baseline uses Atlas's production BM25 ranking implementation.
Record Recall@K, Precision@K and MRR@K before modifying retrieval.
Fixtures must contain manually verified relevant passage IDs. Use synthetic
fixtures for CI; redact or obtain authorization before adding real source text.

This baseline **does not yet measure claim-level citation entailment**,
cross-connector retrieval, semantic ranking, or production answer quality.
Those require a separate labeled claims/evidence set and configured providers.

The historical document Q&A results are kept in `results/`. Rebuild their
interactive HTML report with `python evals/render.py` from the repository root.
The generated `evals/report.html` is ignored by Git; the command also refreshes
`REPORT.md` and `QUESTIONS_AND_ANSWERS.md` from the saved dataset and results.
