"""Conservative citation auditing: reference validity, lexical support, and facts.

A passing heuristic is never proof of semantic entailment.
"""

import re

from .retrieval import tokens

REFERENCE = re.compile(r'\[(\d+)\]')
NUMBER = re.compile(r'(?<![\w])(?:\d{1,4}(?:[,.]\d{3})*(?:\.\d+)?%?)(?![\w])')
NEGATIONS = {'not', 'never', 'no', 'without', 'neither', 'cannot', "n't"}


def audit_citations(answer: str, sources: list[dict], *, threshold: float = 0.35) -> dict:
    findings = []
    # Keep citations attached to the preceding clause rather than splitting on decimals.
    statements = [
        s.strip()
        for s in re.split(r'(?<=[.!?])\s+(?=[A-Z*#])|\n+', answer)
        if s.strip() and re.search(r'[A-Za-z]', s)
    ]
    for statement in statements:
        ids = [int(n) for n in REFERENCE.findall(statement)]
        claim = REFERENCE.sub('', statement).strip()
        valid = [n for n in ids if 1 <= n <= len(sources)]
        evidence = ' '.join(str(sources[n - 1].get('text', '')) for n in valid)
        claim_terms = set(tokens(claim))
        evidence_terms = set(tokens(evidence))
        overlap = len(claim_terms & evidence_terms) / len(claim_terms) if claim_terms else 0
        numbers = set(NUMBER.findall(claim))
        evidence_numbers = set(NUMBER.findall(evidence))
        # Check for a conspicuous negation mismatch, but do not interpret it as proof.
        negation_mismatch = bool(NEGATIONS & set(re.findall(r"\b[\w']+\b", claim.lower()))) != bool(
            NEGATIONS & set(re.findall(r"\b[\w']+\b", evidence.lower()))
        )
        if not ids:
            status = 'missing_citation'
        elif len(valid) != len(ids):
            status = 'invalid_citation'
        elif numbers - evidence_numbers:
            status = 'number_mismatch'
        elif negation_mismatch:
            status = 'possible_negation_mismatch'
        elif not claim_terms or overlap < threshold:
            status = 'needs_review'
        else:
            status = 'lexically_supported'
        findings.append(
            {'claim': claim[:500], 'citations': ids, 'overlap': round(overlap, 3), 'status': status}
        )
    return {
        'claims': findings,
        'needs_review': sum(row['status'] != 'lexically_supported' for row in findings),
        'note': 'Heuristic checks only. Lexical support is not proof of entailment; verify original evidence.',
    }
