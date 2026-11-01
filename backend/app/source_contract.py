"""Shared, read-only evidence contract for Atlas source adapters.

Adapters can normalize existing provider payloads incrementally. This module
does not grant access: each connector must enforce workspace permissions.
"""

from dataclasses import asdict, dataclass, field
from typing import Any, Mapping, Optional, Protocol, Sequence


@dataclass(frozen=True)
class Evidence:
    source_id: str
    provider: str
    title: str
    excerpt: str
    url: Optional[str] = None
    timestamp: Optional[str] = None
    owner: Optional[str] = None
    content_type: str = 'text/plain'
    scope: Optional[str] = None
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.source_id or not self.provider:
            raise ValueError('Evidence must have a source ID and provider.')
        if not self.excerpt.strip():
            raise ValueError('Evidence excerpt cannot be empty.')

    def to_dict(self) -> dict:
        return asdict(self)


class SourceAdapter(Protocol):
    """Read-only interface; caller handles authentication and permission scope."""

    provider: str

    def search(self, query: str, *, limit: int = 10) -> Sequence[Evidence]: ...

    def fetch(self, source_id: str) -> Evidence: ...


def normalize_evidence(provider: str, record: Mapping[str, Any]) -> Evidence:
    """Normalize a provider result without inventing missing provenance."""
    value = record.get('text') or record.get('excerpt') or record.get('content') or ''
    return Evidence(
        source_id=str(record.get('source_id') or record.get('id') or record.get('chunk_id') or ''),
        provider=provider,
        title=str(record.get('title') or record.get('name') or 'Untitled'),
        excerpt=str(value),
        url=record.get('url'),
        timestamp=record.get('timestamp'),
        owner=record.get('owner'),
        content_type=str(record.get('content_type') or 'text/plain'),
        scope=record.get('scope'),
        metadata=dict(record.get('metadata') or {}),
    )
