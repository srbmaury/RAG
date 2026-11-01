"""Evaluate claim citation coverage and citation validity on labeled answer fixtures.

This is intentionally a structural quality gate, not an entailment classifier.
"""

import argparse
import json
from pathlib import Path

from app.citation_audit import audit_citations


def evaluate(cases):
    if not cases:
        raise ValueError('No evaluation cases supplied')
    total = 0
    referenced = 0
    valid = 0
    for case in cases:
        audit = audit_citations(case['answer'], case['sources'])
        for claim in audit['claims']:
            total += 1
            if claim['citations']:
                referenced += 1
            if claim['status'] not in ('missing_citation', 'invalid_citation'):
                valid += 1
    return {
        'cases': len(cases),
        'claims': total,
        'citation_coverage': round(referenced / total, 4) if total else 0,
        'citation_validity': round(valid / referenced, 4) if referenced else 0,
        'note': 'These are structural checks, not semantic factual accuracy.',
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('fixture', type=Path)
    args = parser.parse_args()
    cases = json.loads(args.fixture.read_text(encoding='utf-8'))['cases']
    print(json.dumps(evaluate(cases), indent=2))


if __name__ == '__main__':
    main()
