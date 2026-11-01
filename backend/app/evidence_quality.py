"""Provider-aware deduplication and conservative cross-source evidence ranking.

Never infer a relationship just because two records share a keyword.
These utilities preserve original source IDs and URLs for citation integrity.
"""
import re
from urllib.parse import urlsplit, urlunsplit

STOP = {"the", "and", "for", "with", "from", "what", "which", "this", "that", "about",
        "show", "find", "where", "when", "does", "have", "were", "are", "our", "please"}


def keywords(text):
    return {word for word in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if word not in STOP}


def canonical_url(url):
    if not url:
        return ""
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in ("https", "http") or not parsed.hostname:
            return ""
        # Drop marketing fragments/parameters but keep query parameters necessary
        # to identify provider records.
        return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(),
                           parsed.path.rstrip("/") or "/", parsed.query, ""))
    except ValueError:
        return ""


def fingerprint(item):
    url = canonical_url(item.url)
    if url:
        return ("url", url)
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
    unique = []
    seen = set()
    for item in items:
        key = fingerprint(item)
        if key in seen:
            continue
        seen.add(key)
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


def related_evidence(items, *, min_common=3, max_pairs=20):
    """Show candidate links for review, not asserted relationships."""
    pairs = []
    for i, left in enumerate(items):
        a = keywords(left.title + " " + left.excerpt[:500])
        for right in items[i + 1:]:
            if right.provider == left.provider:
                continue
            common = sorted(a & keywords(right.title + " " + right.excerpt[:500]))
            if len(common) >= min_common:
                pairs.append({"left": {"provider": left.provider, "id": left.source_id},
                              "right": {"provider": right.provider, "id": right.source_id},
                              "shared_terms": common[:12], "status": "candidate_only"})
                if len(pairs) >= max_pairs:
                    return pairs
    return pairs
