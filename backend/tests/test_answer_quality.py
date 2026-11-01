"""Regressions for irrelevant evidence and misleading answer fallbacks."""
from types import SimpleNamespace

from app.retrieval import tokens, has_query_support
from app.connected_synthesis import stream_connected


def test_format_words_are_not_retrieval_concepts():
    assert tokens('Write 10 lines about Kosovo') == ['kosovo']
    assert has_query_support('Write 10 lines about Kosovo',
                             'Pristina is the capital of Kosovo.')
    assert not has_query_support('Write 10 lines about Kosovo',
                                 'A system design guide lists ten search problems.')


def evidence(title, body, source_id='a'):
    return SimpleNamespace(
        provider='documents', title=title, excerpt=body, source_id=source_id,
        as_prompt=lambda n: {'source_id': n, 'provider': 'documents', 'title': title,
                             'text': body}
    )


def test_missing_citations_never_turn_into_retrieval_dump():
    events = list(stream_connected(
        'Write 10 lines about Kosovo',
        [evidence('Europe.pdf', 'Kosovo has its capital in Pristina.')],
        'openai', 'key', 'model',
        lambda: SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: [
            SimpleNamespace(type='response.output_text.delta', delta='Pristina is the capital.')
        ])),
        '', ''))
    result = events[-1]
    assert result['type'] == 'complete'
    assert result['mode'] == 'citation_check_failed'
    assert result['sources'] == []
    assert 'I found' not in result['answer']


def test_valid_cited_answer_remains_synthesis():
    events = list(stream_connected(
        'Write about Kosovo',
        [evidence('Europe.pdf', 'Pristina is the capital of Kosovo.')],
        'openai', 'key', 'model',
        lambda: SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: [
            SimpleNamespace(type='response.output_text.delta', delta='Pristina is the capital. [1]')
        ])),
        '', ''))
    assert events[-1]['mode'] == 'connected'
    assert events[-1]['sources'][0]['title'] == 'Europe.pdf'
