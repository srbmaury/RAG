"""Provider-aware deduplication and conservative cross-source evidence ranking.

Never infer a relationship just because two records share a keyword.
These utilities preserve original source IDs and URLs for citation integrity.
"""

import re
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit

from .research_queries import natural_search_terms
from .retrieval import minimum_query_overlap, tokens


def keywords(text):
    return {word for word in tokens(text) if len(word) >= 3}


def canonical_url(url):
    if not url:
        return ''
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in ('https', 'http') or not parsed.hostname:
            return ''
        # Drop marketing fragments/parameters but keep query parameters necessary
        # to identify provider records.
        return urlunsplit(
            (
                parsed.scheme.lower(),
                parsed.netloc.lower(),
                parsed.path.rstrip('/') or '/',
                parsed.query,
                '',
            )
        )
    except ValueError:
        return ''


def fingerprint(item):
    url = canonical_url(item.url)
    if url:
        return ('url', url)
    # Never deduplicate records from different providers solely on similar prose.
    return (item.provider, str(item.source_id))


def score(item, question):
    query = keywords(question)
    if not query:
        return 0
    title = keywords(item.title)
    body = keywords(item.excerpt)
    return 3 * len(query & title) + len(query & body)


def is_repository_activity_question(question):
    return bool(
        re.search(r'\b(?:repos?|repositories)\b', question, re.I)
        and re.search(r'\b(?:active|activity|recent|latest|pushed|push|updated)\b', question, re.I)
    )


def is_repository_listing_question(question):
    return bool(
        re.search(r'\b(?:projects?|repos?|repositories)\b', question, re.I)
        and re.search(r'\b(?:list|show|find|get|name|at\s+least)\b', question, re.I)
    )


def activity_timestamp(item):
    value = getattr(item, 'date', None)
    if not value:
        return float('-inf')
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.timestamp()
    except ValueError:
        return float('-inf')


def prepare_evidence(question, items, *, limit=60, per_provider=20):
    """Deduplicate exact references and rank by topical relevance with source diversity."""
    query_terms = set(tokens(' '.join(natural_search_terms(question))))
    required_overlap = minimum_query_overlap(' '.join(query_terms)) if query_terms else 0
    repository_activity = is_repository_activity_question(question)
    repository_listing = is_repository_listing_question(question)
    unique = []
    seen = set()
    for item in items:
        key = fingerprint(item)
        if key in seen:
            continue
        seen.add(key)
        if query_terms and not (
            (repository_activity or repository_listing) and item.provider == 'github'
        ):
            item_terms = set(tokens(f'{item.title}\n{item.excerpt}'))
            if len(query_terms & item_terms) < required_overlap:
                continue
        unique.append(item)
    if repository_activity:
        ranked = sorted(
            enumerate(unique),
            key=lambda row: (
                -activity_timestamp(row[1]) if row[1].provider == 'github' else 0,
                -score(row[1], question),
                row[0],
            ),
        )
    else:
        ranked = sorted(enumerate(unique), key=lambda row: (-score(row[1], question), row[0]))
    by_provider = {}
    selected = []
    for _, item in ranked:
        n = by_provider.get(item.provider, 0)
        if n >= per_provider:
            continue
        selected.append(item)
        by_provider[item.provider] = n + 1
        if len(selected) >= limit:
            break
    return selected
