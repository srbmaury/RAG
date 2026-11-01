import pytest
from fastapi import HTTPException
from app import batch_connectors


def test_jira_host_restricted(monkeypatch):
    monkeypatch.setenv("ATLAS_JIRA_BASE_URL", "http://127.0.0.1:8000")
    with pytest.raises(HTTPException) as error:
        batch_connectors._jira_base()
    assert error.value.status_code == 503


def test_jira_query_uses_fixed_host_and_safe_terms(monkeypatch):
    monkeypatch.setenv("ATLAS_JIRA_BASE_URL", "https://atlas-team.atlassian.net")
    calls = []
    def fake_request(provider, token, url, **kw):
        calls.append((provider, url, kw))
        return {"issues": [{"id": "22", "key": "DEV-4", "fields": {"summary": "Cache",
                "description": {"content": [{"content": [{"text": "Avoid stale cache"}]}]}}}]}
    monkeypatch.setattr(batch_connectors, "_request", fake_request)
    rows = batch_connectors.search("jira", "token", 'cache" OR project=ADMIN')
    assert rows[0]["url"] == "https://atlas-team.atlassian.net/browse/DEV-4"
    assert calls[0][1].startswith("https://atlas-team.atlassian.net/")
    assert "project=ADMIN" not in calls[0][2]["params"]["jql"]


def test_calendar_search_normalizes_event(monkeypatch):
    monkeypatch.setattr(batch_connectors, "_request", lambda *a, **kw: {
        "items": [{"id": "abc", "summary": "Design review",
                   "start": {"dateTime": "2026-11-02T09:00:00Z"},
                   "description": "Atlas changes", "htmlLink": "https://calendar.google.com/event"}]})
    rows = batch_connectors.search("calendar", "token", "Atlas")
    assert rows[0]["provider"] == "calendar"
    assert "2026-11-02" in rows[0]["excerpt"]


def test_outlook_search_normalizes_mail(monkeypatch):
    monkeypatch.setattr(batch_connectors, "_request", lambda *a, **kw: {
        "value": [{"id": "m1", "subject": "Review", "bodyPreview": "Agenda",
                   "receivedDateTime": "2026-11-01", "webLink": "https://outlook.office.com/mail/id"}]})
    rows = batch_connectors.search("outlook", "token", "Review")
    assert rows[0]["id"] == "m1"
    assert "Agenda" in rows[0]["excerpt"]


def test_linear_search_normalizes_issues(monkeypatch):
    monkeypatch.setattr(batch_connectors, "_request", lambda *a, **kw: {
        "data": {"searchIssues": {"nodes": [{"id": "q1", "identifier": "ENG-2",
                    "title": "Bug", "description": "Fix it", "url": "https://linear.app/issue"}]}}})
    rows = batch_connectors.search("linear", "token", "Bug")
    assert rows[0]["title"] == "ENG-2 Bug"


def test_onedrive_query_escapes_quotes(monkeypatch):
    calls = []
    def fake(*args, **kwargs):
        calls.append(args[2])
        return {"value": []}
    monkeypatch.setattr(batch_connectors, "_request", fake)
    assert batch_connectors.search("onedrive", "token", "O'Brien") == []
    assert "O%27%27Brien" in calls[0]
