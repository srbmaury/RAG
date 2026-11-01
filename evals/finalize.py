"""Merge the full local-model run with focused reruns and score current rubric."""

import hashlib
import json
from pathlib import Path

from run import grade

root = Path('evals')
dataset_bytes = (root / 'questions.json').read_bytes()
dataset = json.loads(dataset_bytes)
cases = {case['id']: case for case in dataset['questions']}
latest = {}
for path in [
    root / 'results/ollama_initial.jsonl',
    root / 'results/refined.jsonl',
    root / 'results/final_rerun2.jsonl',
    root / 'results/final_rerun3.jsonl',
]:
    if not path.exists():
        continue
    for line in path.read_text().splitlines():
        if line.strip():
            row = json.loads(line)
            latest[row['id']] = row

if set(latest) != set(cases):
    raise SystemExit(f'Expected results for 100 questions; found {len(latest)}.')

output = root / 'results/ollama.jsonl'
with output.open('w') as file:
    for case in dataset['questions']:
        row = latest[case['id']]
        row['question'] = case['question']
        row['dataset_sha256'] = hashlib.sha256(dataset_bytes).hexdigest()
        row['evaluation'] = grade(case, row['result'])
        file.write(json.dumps(row, ensure_ascii=False) + '\n')
print(
    f'Finalized {len(latest)} local-model results; {sum(row["evaluation"]["automatic_pass"] for row in latest.values())} passed the current rubric.'
)
