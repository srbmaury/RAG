# Atlas: evidence-first release

This release focuses on trust and verification rather than adding integrations.

## Answer-quality evaluation

Run from the repository root:

```bash
PYTHONPATH=backend python evals/answer_quality.py evals/answer_quality_cases.json
PYTHONPATH=backend python evals/research_quality_suite.py evals/research_quality_suite.json
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

## Decision timelines and realistic evaluation

The answer UI displays dated source statements only when at least two retrieved
sources share an explicit issue/PR reference. Each timeline event links to its
original source and is labeled `source_reported`. Dates are parsed from source
text, not inferred from retrieval time. These events are **not** automatically
certified as accurate decisions or causal relationships.

`evals/research_quality_suite.json` includes 96 fictional, synthetic,
unreviewed cases across 12 categories. Many are templated variations, so this
suite is useful for regression coverage but **not representative of actual user
traffic**. Its metrics score retrieval of required passages only.

To build a representative benchmark, collect opt-in questions from real Atlas
workflows with consent; strip identifiers and secrets; sample across data
sources, question lengths, access boundaries and tasks; have at least two
independent reviewers annotate relevant sources, answer claims, conflicts,
and permitted abstentions. Resolve disagreements and store immutable dataset
versions. Evaluate retrieval recall, answer correctness, citation entailment,
correct abstention, and temporal ordering separately, with review by category.
Never upload private connected content into public test fixtures.
