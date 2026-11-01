"""Provider-aware deduplication and conservative cross-source evidence ranking.

Never infer a relationship just because two records share a keyword.
These utilities preserve original source IDs and URLs for citation integrity.
"""

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


def prepare_evidence(question, items, *, limit=60, per_provider=20):
    """Deduplicate exact references and rank by topical relevance with source diversity."""
    query_terms = set(tokens(' '.join(natural_search_terms(question))))
    required_overlap = minimum_query_overlap(' '.join(query_terms)) if query_terms else 0
    unique = []
    seen = set()
    for item in items:
        key = fingerprint(item)
        if key in seen:
            continue
        seen.add(key)
        if query_terms:
            item_terms = set(tokens(f'{item.title}\n{item.excerpt}'))
            if len(query_terms & item_terms) < required_overlap:
                continue
        unique.append(item)
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
