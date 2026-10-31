# Atlas — Document intelligence

A working first release for bulk document ingestion, private workspaces, source-backed chat, and persistent multi-conversation history. Built with Next.js/TypeScript, FastAPI, SQLAlchemy, and PostgreSQL/pgvector, with an API-key-free local mode.

## Connected-source research (experimental)

The **Connected search** navigation entry can combine workspace document passages and live Gmail results in one AI answer. Gmail is opt-in for each question, with a user-specified Gmail search scope (default: last 30 days). The backend verifies workspace ownership and Gmail connection before retrieving mail. It fetches up to eight matching messages on demand, and up to six document excerpts. Generated answers require citation references; the interface displays source passages and original Gmail URLs.

This initial endpoint **does not yet include production-ready Google Drive, GitHub, Notion, or Slack connectors**. Those require separate per-user OAuth installation, permission scoping, encrypted connection storage, refresh/revocation handling, and provider-specific adapters. Do not enter provider access tokens in the UI. Future adapters should use the evidence contract in `backend/app/sources.py`, avoid bulk ingestion by default, and maintain the original source's permission boundary.

The current connected questions are one-shot, not saved in chat history. Read-only retrieval does not send, edit, or delete Gmail messages. This feature is not yet covered by an end-to-end integration test.

## UI design preview

Open [the interactive Atlas design preview](docs/Atlas_Research_Workspace.html) locally in a browser to review the current Home, Ask Atlas, Documents, Gmail, and workspace-management layouts. This standalone HTML uses fictional sample content and does not connect to the backend. The Next.js frontend in `frontend/app/` remains the source of truth for the working app.

## Run locally

Requires Python 3.9+ and Node 20.9+.

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
cp .env.example .env
```

Start the API from the repository root:

```sh
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000 and create an account. Upload the two files in `samples/` to try questions such as “What budgets were proposed?” or “When is the pilot launch?” The sample documents intentionally disagree on proposed dates and budgets.

Local data is persisted under `data/`, excluded from Git. The browser calls the API through Next.js, keeping session cookies on the same origin. API documentation: http://127.0.0.1:8000/docs.

## Enable AI

Set `AI_PROVIDER=openai` and add `OPENAI_API_KEY` to `.env`, then restart the API. The provided `.env.example` already defaults to `AI_PROVIDER=openai`; older `.env` files may still contain `AI_PROVIDER=none`, which disables generated answers even when a key is present. Credentials stay on the server. This enables embeddings and answers through the OpenAI Responses API. Uploaded passage text is sent to the configured AI provider during embedding and chat; use documents you are authorized to process there. Responses use `store=False` (this does not promise zero provider-side retention).

Defaults are configurable with `CHAT_MODEL` and `EMBED_MODEL`. Embeddings explicitly use 1,536 dimensions. Reindex documents with the circular-arrow button after enabling embeddings or changing the embedding model. Documents indexed without a key remain keyword-searchable until reindexed.

### Run AI fully on this Mac (no API key)

Install [Ollama](https://ollama.com), then download the local chat and embedding models:

```sh
ollama pull qwen3:4b
ollama pull nomic-embed-text
```

In `.env`, set `AI_PROVIDER=ollama` and keep `OLLAMA_URL=http://127.0.0.1:11434` (the defaults in `.env.example` already name these models). Restart the API. To re-embed all documents already indexed in the local database with Ollama, run from the repository root while the API worker is stopped:

```sh
PYTHONPATH=backend .venv/bin/python evals/reindex_local.py
```

New uploads use Ollama embeddings automatically. Document text, questions, and chat history stay on this machine when using the Ollama provider. The 4B model is a compact local model; source-grounded answers can still miss details, so check its citations for important claims.

Without an AI provider, chat returns relevant source excerpts rather than synthesizing answers. The same retrieval path handles every question; it has no separate summary, count, or topic-specific answer rules. Configure Ollama for on-device answer generation and semantic retrieval, or an OpenAI API key for hosted generation. Unrelated questions do not inherit earlier search terms; explicit references such as “its budget” can use the previous question.

## PostgreSQL deployment with Docker

```sh
cp .env.example .env
# Optionally add your API key, then:
docker compose up --build
```

Open http://localhost:3000. Compose runs PostgreSQL/pgvector, an API container, a separate durable worker, and the web app. Database and document files use named volumes. Only the web port is exposed, bound to loopback.

PDF text extraction uses PDFium to handle complex large PDFs without the former pure-Python parser token limit. Staged uploads use filesystem locks and require a Unix-like host (macOS/Linux).

The initial release uses a database-backed job queue with expiring leases and generation fencing instead of Redis/Celery. This keeps local and container execution consistent and recovers interrupted jobs without losing queued work. Original files use a shared filesystem volume; S3 storage is a future extension. The PostgreSQL path uses indexed full-text search and HNSW vector search, fused with reciprocal rank fusion and a lexical-coverage adjustment. It does not include a cross-encoder reranker. SQLite mode uses in-memory BM25 and optional cosine similarity and is intended for development/small collections.

Compose is a development deployment, not a hardened public service. Set a strong `POSTGRES_PASSWORD` before first initialization, place the web app behind HTTPS, and set `COOKIE_SECURE=true` for secure cookies. A changed database password does not update an already initialized PostgreSQL volume automatically.

## What works

- Email/password accounts, hashed passwords, expiring HTTP-only sessions, account-owned workspaces.
- Multiple document uploads; the UI sends files sequentially to keep requests bounded. PDF, DOCX, UTF-8 TXT, Markdown, up to 250 MB/file and 50 files/API request. The browser sends large files in authenticated 8 MB chunks with offset checks and retry recovery; interrupted staging data expires after 24 hours. Individual failures do not stop the rest of a selected batch. Upload progress and per-file errors remain visible.
- Per-workspace SHA-256 deduplication, including a database uniqueness constraint for concurrent uploads.
- Durable queued/processing/ready/failed states, explicit retry/reindex, worker crash recovery.
- PDF page references and text/DOCX section references, overlapping chunks, optional batched embeddings.
- Permission-filtered retrieval, document scope selection, bounded conversation context, source previews and original downloads.
- AI source-ID validation and refusal when no evidence is found. This is **not** automatic verification that every generated claim is entailed by its cited passage.
- Persistent, workspace-scoped conversations with saved messages and source citations, rename, and delete controls.
- Deletion removes originals and indexed chunks. Previously saved citations to deleted documents may no longer point to retrievable source chunks.

## Validation

```sh
PYTHONPATH=backend .venv/bin/pytest backend/tests -q
cd frontend
npm run typecheck
npm run build
```

Tests use an isolated temporary database and no network/API calls. They cover ingestion, retrieval, account isolation, source scoping, duplicate detection, job leases, failed ingestion/retry, source deletion, authentication, chunk boundaries, and mocked AI citation validation.

## Current limits and next milestones

Insights and background collection reports have been removed. The worker now processes ingestion jobs only. Existing deployments may still have a legacy `analyses` table; it is intentionally left untouched until a database migration is available.

This release has not been benchmarked for 10,000 documents/workspace. The architecture supports a separate worker and indexed PostgreSQL retrieval, but capacity, latency, accuracy, and cost targets must be established with representative documents before scaling.

Scanned or partially image-only PDFs fail explicitly with an OCR message; they are never silently treated as fully indexed. OCR, vision/table-aware parsing, additional formats, and object-store integration are pending. DOCX references are logical sections, not rendered Word page numbers.

Also pending: cross-encoder reranking, streamed AI output, shared workspace membership/roles, password recovery/email verification, login/API rate limits and usage quotas, object-store integration, schema migrations, telemetry, backup/restore validation, antivirus/parser sandboxing, and production load/accuracy evaluation. Provider calls have bounded timeouts and retries; errors stay visible rather than falling back to fabricated answers.

Do not expose this development release publicly until the authentication, abuse controls, document parsing isolation, and deployment hardening items are completed. Schema creation is automatic for a fresh database; use a migration system before evolving a deployed database.

## Layout

- `backend/app/main.py`: API, session authentication, access checks, uploads, chat, and conversations.
- `backend/app/ingest.py`: parsing and chunking.
- `backend/app/retrieval.py`: keyword/vector retrieval and fusion.
- `backend/app/ai.py`: embedding and grounded answer generation.
- `backend/app/worker.py`: durable job claiming, leases, ingestion.
- `frontend/app/page.tsx`: workspace, library, saved chats, source viewer.
- `compose.yaml`: PostgreSQL development deployment.

## Gmail connector (read-only, opt-in)

Atlas can connect a Gmail mailbox to a workspace and let you search and summarize selected messages without sending, deleting, or modifying mail. Mail is fetched on demand and is **not automatically added to the RAG document index**. The summarization request sends the selected email text to your configured AI provider (OpenAI or Ollama); for private local processing choose Ollama.

1. Enable Gmail API in a Google Cloud project, configure an OAuth consent screen, and create an OAuth **Web application** client.
2. Set the Google OAuth redirect URI to `http://localhost:3000/api/gmail/callback` for local development. In production use `https://your-atlas-domain/api/gmail/callback` as both the registered redirect URI and `GOOGLE_REDIRECT_URI`.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in the backend environment (`.env` for local development).
4. Generate `GMAIL_TOKEN_ENCRYPTION_KEY` using `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and keep it in a protected secret store. Back up the key; losing it makes stored connections unreadable. Never commit it.
5. Install backend dependencies and restart both services. Open **Gmail** in Atlas, choose **Connect Gmail**, authorize read-only access, and search your mailbox. Select up to 15 messages and choose **Summarize selected**.

**Security and policy:** Gmail's `gmail.readonly` is a **restricted scope**. A public app may need Google's OAuth verification and a security assessment for server-side restricted-scope data handling. Do not launch this integration publicly until you've completed applicable requirements and reviewed the privacy policy and deletion behavior. This implementation encrypts refresh tokens at rest and never puts them in browser state; disconnecting removes Atlas's saved token, though users can additionally revoke consent at Google. No background mailbox sync is configured. Avoid sending sensitive mail to a hosted AI provider unless users understand and consent to that data flow.

**Limits:** Summaries are generated on demand from up to 15 selected messages; HTML-only messages currently fall back to Gmail snippets, attachments are not parsed, and citations link back to Gmail. The integration does not yet provide automatic scheduled digests or inbox-to-document indexing.
