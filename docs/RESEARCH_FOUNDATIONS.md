# Research foundations (feature branch)

Atlas now contains three incremental capabilities:

1. Offline document BM25 retrieval evaluation (Recall@K, Precision@K and MRR@K).
2. A typed evidence contract and normalization adapter reused by connected answer
   payloads; existing provider-specific search/fetch code remains in place.
3. An authenticated public webpage import in Documents, persisted through the
   existing Markdown/document ingestion queue.

## Web-import network safety

Application hostname checks are NOT sufficient protection from DNS rebinding.
Web import is disabled by default. Deploy a network firewall or outbound proxy
which denies connections to loopback, RFC1918, link-local, IPv6 local and all
other non-public ranges, including redirects/DNS changes. Only then set
`ATLAS_WEB_EGRESS_PROTECTED=true` in the API environment.

Pages must be HTML, under 2 MB, and have at least 40 characters of extracted text.
Redirects, nonstandard ports, embedded credentials and non-public DNS answers
are rejected. JavaScript rendering and authentication-required pages are unsupported.

## Citation quality

`citation_audit.audit_citations()` provides deterministic claim-by-claim
citation presence, reference validity and lexical overlap reporting. Its
`lexically_supported` label is **not** an entailment guarantee. Semantic
contradiction, numeric consistency, negation and context require further checks.

Run validations:

```sh
PYTHONPATH=backend python -m pytest backend/tests -q
PYTHONPATH=backend python evals/retrieval_eval.py evals/sample_cases.json --k 3
cd frontend && npm run typecheck && npm run build
```

No live-provider E2E run is supplied; verify behavior with test credentials.
