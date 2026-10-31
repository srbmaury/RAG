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
    except Exception:
        log.exception('Readiness check failed')
        raise HTTPException(status_code=503,detail='Database unavailable')
    return {'status':'ready'}
