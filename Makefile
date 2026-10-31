.PHONY: api worker web test
api:
	PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
worker:
	PYTHONPATH=backend .venv/bin/python -m app.worker
web:
	cd frontend && npm run dev
test:
	PYTHONPATH=backend .venv/bin/pytest backend/tests -q
	cd frontend && npm run typecheck && npm run build
