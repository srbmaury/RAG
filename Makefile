.PHONY: api worker web test format format-check
api:
	PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
worker:
	PYTHONPATH=backend .venv/bin/python -m app.worker
web:
	cd frontend && npm run dev
test:
	PYTHONPATH=backend .venv/bin/pytest backend/tests -q
	cd frontend && npm test && npm run typecheck && npm run build

format:
	.venv/bin/ruff check --select I --fix backend evals ops load_tests
	.venv/bin/ruff format backend evals ops load_tests
	cd frontend && npm run format
format-check:
	.venv/bin/ruff check backend evals ops load_tests
	.venv/bin/ruff format --check backend evals ops load_tests
	cd frontend && npm run format:check
