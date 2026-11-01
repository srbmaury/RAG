# Atlas research reliability milestone

This branch establishes a measurable preparation layer for cross-source evidence:
1. Deduplicate by source record or canonical URL before model-context selection.
2. Relevance-rank retrieved records using simple transparent query/title overlap.
3. Produce optional *candidate* cross-provider relationships without claiming causality.
4. Expose provider authentication limitations prominently in Sources.

## Remaining production milestones

**Authentication and authorization.** Google Calendar and Microsoft Graph connectors
still accept manual short-lived access tokens. Do not advertise them as seamless
OAuth integrations. Design authorization-code + PKCE flows with state, encrypted
refresh tokens, rotation, revocation, and least-privilege permissions. Jira and
Linear also require provider-specific consent/setup and live test accounts.

**Source quality.** Current citation audit flags missing references and some
number/negation discrepancies; it does not establish claim-level entailment.
Build consented, human-labeled question/claim/evidence suites for multiple
sources before claiming research reliability. Measure citation precision,
unsupported claims, Recall@K, latency, duplicate rate, and provider errors.

**Search depth.** Calendar searches are text-only; OneDrive searches file
metadata, Outlook uses preview text, and SharePoint content is not indexed.
Add pagination, bounded time windows, document-body parsing, per-provider
rate-limit handling, and change-based refresh individually.

**Operations.** Add auditing, request budgets, durable retries, network-layer
egress policies for web import, backup/restore verification, monitoring,
and a production threat model before inviting general users.

No changes to the database schema are needed for this milestone.
