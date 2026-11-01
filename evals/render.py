import html
import json
from pathlib import Path

root = Path('evals')
dataset = json.loads((root / 'questions.json').read_text())
runs = {}
for name in ['baseline', 'ollama']:
    path = root / 'results' / f'{name}.jsonl'
    if path.exists():
        runs[name] = {
            r['id']: r
            for r in (json.loads(line) for line in path.read_text().splitlines() if line.strip())
        }
handbook = [
    '# 100 document-grounded questions and reference answers',
    '',
    dataset['scope'],
    '',
    'These reference answers are curated from the documents, independent of app responses. Financial/provider statements describe the September 2026 note and are not verified current onboarding advice. PDF statements follow each book’s edition and geographic scope.',
    '',
]
report = [
    '# Document Q&A evaluation',
    '',
    'Expected answers never enter the model prompt or retrieval index. Runs execute the production chat handler with normal workspace ownership and all workspace documents in scope, including the seeded distractor files.',
    '',
    '**Run protocol:** The no-provider baseline returns excerpts only; its score measures whether relevant evidence was retrieved, not whether an answer was synthesized. The Ollama model completed a full 100-question pass; after general prompt and retrieval improvements, the initially flagged questions were rerun and their latest responses overlaid. The final Ollama file therefore contains one result per question, with a focused rerun for initially flagged cases.',
    '',
    '**Scoring:** automated rubric checks required answer facts, cited-document coverage, source-ID validity, and whether required fact terms occur in the cited passages. This is a conservative regression check, not an independent semantic judge or proof that every claim is correct. Gold-page retrieval is reported separately. The dataset accepts documented paraphrases; missing synonyms can still cause false failures.',
    '',
]
for name, run in runs.items():
    passed = sum(r['evaluation']['automatic_pass'] for r in run.values())
    report += [
        f'## {name}',
        '',
        f'Completed: {len(run)}/100. Automated rubric passes: {passed}/{len(run)}. Errors: {sum(bool(r["error"]) for r in run.values())}.',
        '',
    ]
    for category in sorted({q['category'] for q in dataset['questions']}):
        rows = [
            run[q['id']]
            for q in dataset['questions']
            if q['category'] == category and q['id'] in run
        ]
        report.append(
            f'- {category}: {sum(r["evaluation"]["automatic_pass"] for r in rows)}/{len(rows)}'
        )
    report.append('')
    report.append(
        'Flagged questions: '
        + ', '.join(k for k, r in run.items() if not r['evaluation']['automatic_pass'])
    )
    report.append('')
blocks = []
for q in dataset['questions']:
    handbook += [
        f'## {q["id"]}: {q["question"]}',
        '',
        f'**Type:** {q["category"]}',
        '',
        '**Reference answer:** ' + q['expected_answer'],
        '',
    ]
    for e in q['evidence']:
        handbook += [
            f'**Source:** {e["document"]}, {"page" if e["document"].endswith(".pdf") else "section"} {e["page"]}; chunk `{e["chunk_id"]}`.',
            '',
        ]
    if q['history']:
        handbook += [
            '**Conversation context:** ' + json.dumps(q['history'], ensure_ascii=False),
            '',
        ]
    content = f'<h2>{html.escape(q["id"] + ": " + q["question"])}</h2><p><b>Reference answer:</b> {html.escape(q["expected_answer"])}</p>'
    for e in q['evidence']:
        content += f'<details><summary>{html.escape(e["document"])} · location {e["page"]}</summary><pre>{html.escape(e["text"])}</pre></details>'
    statuses = []
    for name, run in runs.items():
        row = run.get(q['id'])
        if not row:
            continue
        status = 'pass' if row['evaluation']['automatic_pass'] else 'flagged'
        statuses.append(status)
        content += f'<h3>{name} · {status} · {row["seconds"]} s</h3><pre>{html.escape(row["result"]["answer"])}</pre><details><summary>Checks and citations</summary><pre>{html.escape(json.dumps(row["evaluation"], indent=2))}</pre>'
        for s in row['result']['sources']:
            content += f'<p>{html.escape(s["name"])} · location {s["page"]}</p><pre>{html.escape(s["text"])}</pre>'
        content += '</details>'
    blocks.append(f'<article data-status="{" ".join(statuses)}">{content}</article>')
(root / 'QUESTIONS_AND_ANSWERS.md').write_text('\n'.join(handbook))
(root / 'REPORT.md').write_text('\n'.join(report))
page = (
    """<!doctype html><html><meta charset="utf-8"><title>Atlas: 100-question evaluation</title><style>body{font:15px system-ui;max-width:1000px;margin:40px auto;padding:0 20px;background:#f7f9f4;color:#25312b}header{position:sticky;top:0;background:#f7f9f4;padding:15px 0}input,select{font:inherit;padding:10px;border:1px solid #d9e1d1;border-radius:6px}input{width:60%}article{background:white;border:1px solid #dce4d4;padding:24px;margin:20px 0;border-radius:9px}h2{font-size:18px}pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;font:13px system-ui;background:#f2f5ed;padding:15px}summary{cursor:pointer;padding:8px}h3{color:#526e44;font-size:14px}</style><h1>100 document-grounded questions</h1><p>Curated reference answers, original evidence, and actual application responses. “Pass” means automated rubric checks passed, not a guarantee of complete semantic correctness.</p><header><input id="search" placeholder="Search questions, answers, or documents…"><select id="filter"><option value="">All results</option><option value="flagged">Flagged in either run</option><option value="pass">Passed in either run</option></select><span id="count"></span></header>"""
    + ''.join(blocks)
    + """<script>function filter(){let n=0;for(const a of document.querySelectorAll('article')){let visible=a.textContent.toLowerCase().includes(document.getElementById('search').value.toLowerCase())&&(!document.getElementById('filter').value||a.dataset.status.includes(document.getElementById('filter').value));a.hidden=!visible;if(visible)n++}document.getElementById('count').textContent=' '+n+' / 100'}document.getElementById('search').oninput=filter;document.getElementById('filter').onchange=filter;filter()</script></html>"""
)
(root / 'report.html').write_text(page)
print('\n'.join(report))
