# Atlas: evidence-first release

This release focuses on trust and verification rather than adding integrations.

## Answer-quality evaluation

Run from the repository root:

```bash
PYTHONPATH=backend python evals/answer_quality.py evals/answer_quality_cases.json
PYTHONPATH=backend python evals/connected_retrieval_eval.py evals/connected_cases.json
PYTHONPATH=backend python evals/citation_eval.py evals/citation_cases.json
```

The supplied cases are **synthetic smoke benchmarks**. Citation coverage and
validity are structural checks: they cannot prove a statement is true.
For production evaluation, collect a human-reviewed, permission-safe dataset
of questions, relevant document IDs, expected answer claims, and acceptable
citations. Track datasets by version and compare results before release.
Keep the benchmark separate from user documents and never publish private data.

## Decision intelligence

Atlas links evidence only when distinct sources explicitly reference the same
issue or PR identifier, e.g. `ATLAS-42`. The UI makes each matched source
inspectable. A shared reference is **not** a verified causal or decision link.
No background relationship database is introduced.

## Connected sources

Connect an account in Sources, then run the existing source-health check.
Connector contract tests verify the uniform evidence shape without live tokens.
To validate actual permissions, token expiry, consent and rate limiting,
run a separate opt-in staging pass with authorized provider accounts.
Never place real credentials in test fixtures.

## Load testing

Use the authenticated `load_tests/locustfile.py` against your own isolated
environment. Set `ATLAS_TEST_EMAIL`, `ATLAS_TEST_PASSWORD`, and
`ATLAS_TEST_WORKSPACE_ID`, then start 5 users at 1 user/second.
Increase to 10, 25 and 50 only if previous stages are stable.
Measure p95 latency, failure rate, CPU/memory, DB activity and job backlog.
Do not target public third-party APIs for stress testing.

## Onboarding and deployment

Recommended first-run sequence: deploy with HTTPS; run migrations; verify
`/api/health/ready`; create a workspace; upload one test document; ask one
question; inspect its evidence; connect sources one by one; verify access.
See `docs/OPERATIONS.md` for network hardening and backup/restore guidance.

## Integrations

No new connector is added by default. Extend the provider set only when
user demand and a real authenticated test account justify the maintenance cost.
