"""Evaluate Atlas's actual cross-source evidence ordering on labeled fixtures.

Only public/synthetic fixture content; no credentials or network required.
"""

import argparse
import json
from pathlib import Path

from retrieval_eval import score_case

from app.evidence_quality import prepare_evidence
from app.sources import Evidence


def evaluate(cases, k=5):
    if not cases or k < 1:
        raise ValueError('Provide labeled cases and a positive k.')
    scores = []
    for case in cases:
        items = [
            Evidence(
                provider=row['provider'],
                source_id=row['id'],
                title=row['title'],
                excerpt=row['excerpt'],
                url=row.get('url'),
            )
            for row in case['candidates']
        ]
        ranked = prepare_evidence(case['question'], items, limit=max(k, 1))
        identifiers = [f'{item.provider}:{item.source_id}' for item in ranked]
        scores.append(score_case(identifiers, case['relevant_ids'], k))
    metrics = ('recall_at_k', 'precision_at_k', 'mrr_at_k')
    return {
        'cases': len(scores),
        'k': k,
        **{key: round(sum(row[key] for row in scores) / len(scores), 4) for key in metrics},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('fixture', type=Path)
    parser.add_argument('--k', type=int, default=5)
    args = parser.parse_args()
    cases = json.loads(args.fixture.read_text(encoding='utf-8'))['cases']
    print(json.dumps(evaluate(cases, args.k), indent=2))


if __name__ == '__main__':
    main()
