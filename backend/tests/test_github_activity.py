from app.main import (
    ConnectedQuestion,
    github_repository_activity_result,
    github_repository_listing_result,
)
from app.sources import Evidence


def test_github_repository_activity_returns_cited_recent_pushes_without_synthesis():
    body = ConnectedQuestion(
        question='Which of my GitHub repos is most active?',
        include_documents=False,
        providers=['github'],
    )
    evidence = [
        Evidence(
            'github',
            'repo-old',
            'owner/older-project',
            'Last push: 2023-04-01T00:00:00Z',
            'https://github.com/owner/older-project',
            '2023-04-01T00:00:00Z',
        ),
        Evidence(
            'github',
            'repo-new',
            'owner/newer-project',
            'Last push: 2025-02-01T00:00:00Z',
            'https://github.com/owner/newer-project',
            '2025-02-01T00:00:00Z',
        ),
    ]

    result = github_repository_activity_result(body.question, body, evidence, document_evidence={})

    assert result['mode'] == 'source_results'
    assert result['scope'] == ['github']
    assert '**owner/newer-project** — last push 2025-02-01 [1]' in result['answer']
    assert '**owner/older-project** — last push 2023-04-01 [2]' in result['answer']
    assert [source['url'] for source in result['sources']] == [
        'https://github.com/owner/newer-project',
        'https://github.com/owner/older-project',
    ]


def test_github_repository_listing_honors_requested_count_without_synthesis():
    body = ConnectedQuestion(
        question='List at least 10 of my projects from GitHub',
        include_documents=False,
        providers=['github'],
    )
    evidence = [
        Evidence(
            'github',
            f'repo-{index}',
            f'srbmaury/project-{index}',
            'A project description',
            f'https://github.com/srbmaury/project-{index}',
        )
        for index in range(12)
    ]

    result = github_repository_listing_result(body.question, body, evidence, {})

    assert result['mode'] == 'source_results'
    assert result['scope'] == ['github']
    assert result['answer'].startswith('Here are 10 of your GitHub projects:')
    assert len(result['sources']) == 10
