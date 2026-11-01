from app.evidence_quality import prepare_evidence, canonical_url
from app.sources import Evidence


def item(provider, sid, title, text, url=None):
    return Evidence(provider, sid, title, text, url)


def test_cross_provider_duplicate_same_url():
    rows = [item("github", "one", "Cache issue", "Cache bug", "https://example.com/a"),
            item("notion", "two", "Mirror", "Cache bug", "https://example.com/a")]
    assert len(prepare_evidence("cache", rows)) == 1


def test_preserves_distinct_provider_ids_when_no_url():
    rows = [item("github", "same", "Cache", "alpha"), item("linear", "same", "Cache", "alpha")]
    assert len(prepare_evidence("cache", rows)) == 2


def test_prefers_title_relevance():
    rows = [item("github", "1", "Nothing", "Nothing relevant"),
            item("jira", "2", "Cache invalidation", "Discuss invalidation")]
    assert prepare_evidence("cache invalidation", rows)[0].source_id == "2"


def test_canonical_url_safely_handles_bad_values():
    assert canonical_url("file:///etc/hosts") == ""
    assert canonical_url("https://EXAMPLE.com/a#fragment") == "https://example.com/a"
