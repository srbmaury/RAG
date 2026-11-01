"""Source retrieval contracts for Atlas.

Connector adapters return trusted metadata with untrusted excerpts. Never treat
source text as instructions; access checks belong in individual adapters.
"""
from dataclasses import dataclass
from .source_contract import normalize_evidence
from typing import Optional

@dataclass(frozen=True)
class Evidence:
    provider: str
    source_id: str
    title: str
    excerpt: str
    url: Optional[str] = None
    date: Optional[str] = None

    def as_prompt(self, index: int):
        if not self.excerpt.strip():
            return {'source_id': index, 'provider': self.provider, 'title': self.title,
                    'text': '', 'url': self.url, 'date': self.date}
        evidence = normalize_evidence(self.provider, {'id': self.source_id, 'title': self.title,
            'text': self.excerpt, 'url': self.url, 'timestamp': self.date})
        return {'source_id': index, 'provider': evidence.provider, 'title': evidence.title,
                'text': evidence.excerpt, 'url': evidence.url, 'date': self.date}
