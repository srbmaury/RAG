"""Resolve explicit conversational references before the shared RAG search path."""
import re


def retrieval_query(question, history):
    """Carry the last user topic only when the new question explicitly refers back."""
    prior = [turn.content for turn in history if turn.role == 'user'][-1:]
    refers_back = re.search(
        r'\b(its|their|them|those)\b|\b(?:about|of|for) (?:it|that)\b|\b(?:is|was|does|did|will) it\b',
        question,
        re.I,
    )
    if prior and refers_back:
        return question + ' ' + prior[0]
    return question
