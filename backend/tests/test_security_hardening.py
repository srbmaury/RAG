"""Security regression tests for browser headers and outbound fetch policy."""

import pytest
from fastapi.testclient import TestClient

from app import web_sources
from app.main import app


def test_web_fetch_refuses_unprotected_egress_before_dns(monkeypatch):
    monkeypatch.delenv('ATLAS_WEB_EGRESS_PROTECTED', raising=False)

    def unexpected_resolution(_):
        raise AssertionError('DNS should not happen without egress protection')

    monkeypatch.setattr(web_sources, 'validate_public_url', unexpected_resolution)
    with pytest.raises(ValueError, match='outbound firewall'):
        web_sources.fetch_page('https://example.com')


def test_security_headers_present():
    with TestClient(app) as client:
        response = client.get('/api/health/live')
        assert response.status_code == 200
        assert response.headers['x-content-type-options'] == 'nosniff'
        assert response.headers['x-frame-options'] == 'DENY'
        assert response.headers['referrer-policy'] == 'strict-origin-when-cross-origin'
        assert response.headers['x-request-id']
