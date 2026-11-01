from app.decision_links import references, related_sources


def test_explicit_issue_link_only():
    evidence = [
        {"provider": "jira", "source_id": "123", "title": "ATLAS-42 Fix caching", "text": "Task"},
        {"provider": "github", "source_id": "456", "title": "Implement ATLAS-42", "text": "Pull request"},
        {"provider": "notion", "source_id": "789", "title": "Caching discussion", "text": "Redis cache"},
    ]
    assert related_sources(evidence) == [
        {"left": 1, "right": 2, "references": ["ATLAS-42"], "status": "shared_reference"}
    ]


def test_similar_text_not_a_relationship():
    assert related_sources([
        {"provider": "jira", "source_id": "1", "title": "Caching"},
        {"provider": "github", "source_id": "2", "title": "Caching"},
    ]) == []


def test_pr_reference_parsing():
    assert "PR#18" in references("Implemented in PR #18")
