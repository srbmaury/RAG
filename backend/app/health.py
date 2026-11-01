"""Operational probes: liveness does not depend on database; readiness does."""
import logging
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from .db import engine

router = APIRouter(prefix='/api')
log = logging.getLogger(__name__)

@router.get('/health/live')
def live():
    return {'status':'ok'}

@router.get('/health/ready')
def ready():
    try:
        with engine.connect() as connection:
            connection.execute(text('SELECT 1'))
            revision = connection.execute(text('SELECT version_num FROM alembic_version')).scalar_one_or_none()
            if revision != '0003':
                raise RuntimeError('Atlas database schema migration 0003 is required.')
    except Exception:
        log.warning('Readiness check failed: %s', type(__import__('sys').exc_info()[1]).__name__)
        raise HTTPException(status_code=503,detail='Database unavailable')
    return {'status':'ready'}
