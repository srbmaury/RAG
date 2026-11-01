"""Read-only query adapters for Calendar, Linear, Jira, OneDrive and Outlook.

Initial connector batch uses provider-issued access tokens. Calendar and Microsoft
Graph access tokens expire; production OAuth refresh is future work. No write
endpoints or arbitrary caller-supplied API hosts are supported.
"""
import os
import re
import time
from urllib.parse import quote
import httpx
from fastapi import HTTPException

NEW_PROVIDERS = ("calendar", "linear", "jira", "onedrive", "outlook")


def _request(provider, token, url, *, params=None, graphql=None):
    """Read-only requests with bounded retries for transient upstream errors."""
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    for attempt in range(3):
        try:
            with httpx.Client(timeout=httpx.Timeout(18, connect=5),
                              follow_redirects=False, trust_env=False) as client:
                if graphql is not None:
                    response = client.post(url, headers=headers, json=graphql)
                else:
                    response = client.get(url, headers=headers, params=params)
                if response.status_code in (429, 502, 503, 504) and attempt < 2:
                    retry_after = response.headers.get("Retry-After", "")
                    delay = min(1.0, float(retry_after)) if retry_after.isdigit() else 0.15 * (2 ** attempt)
                    time.sleep(delay)
                    continue
                response.raise_for_status()
                data = response.json()
            if isinstance(data, dict) and data.get("errors"):
                raise HTTPException(422, f"{provider.title()} rejected the query or permissions.")
            return data
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (401, 403):
                raise HTTPException(422, f"{provider.title()} access expired or is insufficient.") from exc
            if status == 429:
                raise HTTPException(429, f"{provider.title()} rate limit reached.") from exc
            raise HTTPException(502, f"{provider.title()} returned HTTP {status}.") from exc
        except (httpx.RequestError, ValueError) as exc:
            if isinstance(exc, httpx.RequestError) and attempt < 2:
                time.sleep(0.15 * (2 ** attempt))
                continue
            raise HTTPException(502, f"{provider.title()} could not be read.") from exc
    raise HTTPException(502, f"{provider.title()} could not be read.")


def _jira_base():
    # Admin-configured host only: never accept URLs from user queries or tokens.
    base = os.getenv("ATLAS_JIRA_BASE_URL", "").strip().rstrip("/")
    match = re.fullmatch(r"https://([a-zA-Z0-9-]+)\.atlassian\.net", base)
    if not match:
        raise HTTPException(503, "Set ATLAS_JIRA_BASE_URL to a trusted https://tenant.atlassian.net host.")
    return base


def _text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(_text(x) for x in value.get("content", []))
    if isinstance(value, list):
        return " ".join(_text(x) for x in value)
    return ""


def _result(provider, identifier, title, excerpt, url):
    if not identifier:
        return None
    return {"provider": provider, "id": str(identifier), "title": str(title or "Untitled")[:250],
            "excerpt": str(excerpt or "")[:3000], "url": url}


def profile(provider, token):
    if provider == "calendar":
        d = _request(provider, token, "https://www.googleapis.com/calendar/v3/users/me/calendarList",
                     params={"maxResults": 1})
        return "Google Calendar" if "items" in d else "Calendar account"
    if provider == "linear":
        d = _request(provider, token, "https://api.linear.app/graphql",
                     graphql={"query": "query { viewer { name email } }"})
        viewer = d.get("data", {}).get("viewer") or {}
        return viewer.get("email") or viewer.get("name") or "Linear user"
    if provider == "jira":
        d = _request(provider, token, _jira_base() + "/rest/api/3/myself")
        return d.get("displayName") or d.get("accountId") or "Jira user"
    d = _request(provider, token, "https://graph.microsoft.com/v1.0/me",
                 params={"$select": "displayName,userPrincipalName"})
    return d.get("userPrincipalName") or d.get("displayName") or "Microsoft account"


def search(provider, token, query):
    query = query.strip()[:180]
    if provider == "calendar":
        d = _request(provider, token, "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                     params={"q": query, "maxResults": 20, "singleEvents": "true", "orderBy": "startTime",
                             "timeMin": "2000-01-01T00:00:00Z"})
        rows = []
        for e in d.get("items", []):
            start = (e.get("start") or {}).get("dateTime") or (e.get("start") or {}).get("date", "")
            rows.append(_result(provider, e.get("id"), e.get("summary"), f"{start} {e.get('description', '')} {e.get('location', '')}",
                                e.get("htmlLink")))
        return [x for x in rows if x]
    if provider == "linear":
        d = _request(provider, token, "https://api.linear.app/graphql",
                     graphql={"query": "query SearchIssues($query: String!) { searchIssues(term: $query, first: 15) { nodes { id identifier title description url } } }",
                              "variables": {"query": query}})
        nodes = ((d.get("data") or {}).get("searchIssues") or {}).get("nodes", [])
        return [v for e in nodes if (v := _result(provider, e.get("id"), e.get("identifier", "") + " " + e.get("title", ""),
                                                   e.get("description", ""), e.get("url")))]
    if provider == "jira":
        # Atlassian search/JQL API: escape user-supplied terms, never accept raw JQL.
        terms = re.findall(r"[a-zA-Z0-9_-]{2,}", query)[:6]
        if not terms:
            return []
        jql = " OR ".join(f'text ~ "{t}"' for t in terms)
        d = _request(provider, token, _jira_base() + "/rest/api/3/search/jql",
                     params={"jql": jql, "maxResults": 15, "fields": "summary,description,status"})
        result = []
        for e in d.get("issues", []):
            fields = e.get("fields") or {}
            result.append(_result(provider, e.get("id"), f"{e.get('key', '')} {fields.get('summary', '')}",
                                  _text(fields.get("description")), _jira_base() + "/browse/" + quote(e.get("key", ""))))
        return [x for x in result if x]
    if provider == "onedrive":
        # Graph drive search searches the authorized user's drive, not all SharePoint sites.
        d = _request(provider, token, "https://graph.microsoft.com/v1.0/me/drive/root/search(q='" +
                     quote(query.replace("'", "''"), safe="") + "')",
                     params={"$top": 15, "$select": "id,name,webUrl,description,file"})
        return [v for e in d.get("value", []) if (v := _result(provider, e.get("id"), e.get("name"),
                                                               e.get("description") or e.get("name"), e.get("webUrl")))]
    if provider == "outlook":
        d = _request(provider, token, "https://graph.microsoft.com/v1.0/me/messages",
                     params={"$search": '"' + query.replace('"', "") + '"', "$top": 15,
                             "$select": "id,subject,bodyPreview,webLink,receivedDateTime"})
        return [v for e in d.get("value", []) if (v := _result(provider, e.get("id"), e.get("subject"),
                                                               e.get("receivedDateTime", "") + " " + e.get("bodyPreview", ""),
                                                               e.get("webLink")))]
    raise HTTPException(404, "Unknown source provider.")
