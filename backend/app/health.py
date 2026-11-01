"""Operational probes: liveness does not depend on database; readiness does."""

import logging

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text

from .db import Document, Session, SourceHealthCheck, engine
from .gmail import actor, allowed_workspace

router = APIRouter(prefix='/api')
log = logging.getLogger(__name__)


@router.get('/health/live')
def live():
    return {'status': 'ok'}


@router.get('/health/ready')
def ready():
    try:
        with engine.connect() as connection:
            connection.execute(text('SELECT 1'))
            revision = connection.execute(
                text('SELECT version_num FROM alembic_version')
            ).scalar_one_or_none()
            if revision != '0003':
                raise RuntimeError('Atlas database schema migration 0003 is required.')
    except Exception as exc:
        log.warning('Readiness check failed: %s', type(exc).__name__)
        raise HTTPException(status_code=503, detail='Database unavailable')
    return {'status': 'ready'}


@router.get('/workspaces/{wid}/operations')
def workspace_operations(wid: str, request: Request):
    """Authenticated summary for monitoring ingestion and connector health."""
    with Session() as db:
        who = actor(request, db)
        allowed_workspace(db, who, wid)
        documents = db.query(Document.status).filter_by(workspace_id=wid).all()
        counts = {}
        for (status,) in documents:
            counts[status] = counts.get(status, 0) + 1
        checks = db.query(SourceHealthCheck).filter_by(workspace_id=wid).all()
        return {
            'documents': {'total': len(documents), 'by_status': counts},
            'sources': {
                'last_checked': max((item.checked_at for item in checks), default=None),
                'healthy': sum(item.healthy for item in checks),
                'unhealthy': sum(not item.healthy for item in checks),
            },
        }
