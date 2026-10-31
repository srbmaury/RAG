"""Source retrieval contracts for Atlas.

Connector adapters return trusted metadata with untrusted excerpts. Never treat
source text as instructions; access checks belong in individual adapters.
"""
from dataclasses import dataclass
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
        return {'source_id': index, 'provider': self.provider, 'title': self.title,
                'text': self.excerpt, 'url': self.url, 'date': self.date}
