"""Fetch and store public HTML pages as regular Atlas documents.

Security: reject local/private IPs, credentials, unsafe schemes, redirects,
large responses, and non-HTML content. The deployer must ALSO enforce outbound
network controls: DNS rebinds can bypass application-level preflight checks.
"""
import hashlib
import ipaddress
import re
import socket
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .config import DATA, MAX_FILE_BYTES
from .db import Session, Document, uid
from .source_contract import Evidence

router = APIRouter(prefix="/api")
MAX_HTML_BYTES = min(2_000_000, MAX_FILE_BYTES)
MAX_TEXT_CHARS = 500_000


class UrlRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2048)


def validate_public_url(raw: str) -> str:
    value = raw.strip()
    parts = urlsplit(value)
    if parts.scheme not in ("https", "http") or not parts.hostname:
        raise ValueError("Enter a valid HTTP(S) URL.")
    if parts.username or parts.password or parts.fragment:
        raise ValueError("URL credentials and fragments are not supported.")
    try:
        port = parts.port
    except ValueError as exc:
        raise ValueError("Invalid URL port.") from exc
    if port not in (None, 80, 443):
        raise ValueError("Only standard HTTP(S) ports are supported.")
    hostname = parts.hostname.rstrip(".").lower()
    if hostname in ("localhost",) or hostname.endswith((".localhost", ".local", ".internal")):
        raise ValueError("Local network addresses are not allowed.")
    try:
        addresses = socket.getaddrinfo(hostname, port or (443 if parts.scheme == "https" else 80),
                                       type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError, OSError) as exc:
        raise ValueError("URL hostname could not be resolved.") from exc
    if not addresses or any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
        raise ValueError("URL must resolve only to public IP addresses.")
    return value


class PageText(HTMLParser):
    ignored = {"script", "style", "nav", "noscript", "svg", "footer"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = []
        self.text = []
        self.title = []
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self.ignored:
            self.skip.append(tag)
        if tag == "title" and not self.skip:
            self.in_title = True
        if tag in ("p", "div", "article", "section", "li", "h1", "h2", "h3", "br"):
            self.text.append("\n")

    def handle_endtag(self, tag):
        if self.skip and self.skip[-1] == tag:
            self.skip.pop()
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if not self.skip:
            (self.title if self.in_title else self.text).append(data)


def extract_html(html: str) -> tuple[str, str]:
    parser = PageText()
    parser.feed(html)
    title = re.sub(r"\s+", " ", "".join(parser.title)).strip()[:180]
    body = re.sub(r"[ \t]+", " ", "".join(parser.text))
    body = re.sub(r"\n{3,}", "\n\n", body).strip()[:MAX_TEXT_CHARS]
    return title or "Web page", body


def fetch_page(url: str) -> tuple[str, str]:
    url = validate_public_url(url)
    try:
        with httpx.Client(timeout=httpx.Timeout(15.0), follow_redirects=False,
                          trust_env=False, headers={"User-Agent": "Atlas-Research/1.0",
                                                     "Accept": "text/html"}) as client:
            with client.stream("GET", url) as response:
                if response.is_redirect:
                    raise ValueError("Redirects are not supported; paste the final public URL.")
                response.raise_for_status()
                media_type = response.headers.get("content-type", "").lower().split(";")[0].strip()
                if media_type not in ("text/html", "application/xhtml+xml"):
                    raise ValueError("The URL must return an HTML page.")
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > MAX_HTML_BYTES:
                        raise ValueError("Page exceeds the HTML size limit.")
                    chunks.append(chunk)
                encoding = response.encoding or "utf-8"
        title, body = extract_html(b"".join(chunks).decode(encoding, errors="replace"))
        if len(body.strip()) < 40:
            raise ValueError("Page has insufficient readable text.")
        return title, body
    except httpx.HTTPError as exc:
        raise ValueError("Could not fetch the requested public webpage.") from exc


def save_webpage(wid: str, url: str, db) -> dict:
    title, body = fetch_page(url)
    text = f"# {title}\n\nSource URL: {url}\n\n{body}\n"
    data = text.encode("utf-8")
    digest = hashlib.sha256(data).hexdigest()
    existing = db.query(Document).filter_by(workspace_id=wid, digest=digest).first()
    if existing:
        return {"id": existing.id, "name": existing.name, "status": existing.status,
                "url": url, "duplicate": True}
    did = uid()
    path = DATA / "files" / did
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.write_bytes(data)
        doc = Document(id=did, workspace_id=wid, name=f"{title[:170]}.md",
                       size=len(data), digest=digest)
        db.add(doc)
        db.commit()
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise
    return {"id": did, "name": doc.name, "status": doc.status,
            "url": url, "duplicate": False}


@router.post("/workspaces/{wid}/web-pages")
def add_web_page(wid: str, body: UrlRequest, request: __import__("fastapi").Request):
    # Import inside handler to avoid circular import with app.main.
    from .gmail import actor, allowed_workspace
    with Session() as db:
        owner = actor(request, db)
        allowed_workspace(db, owner, wid)
        try:
            return save_webpage(wid, body.url, db)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
