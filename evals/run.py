"""Run the real chat handler; expected answers never enter retrieval or prompts."""
import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from datetime import datetime, timezone
from app import config
from app.main import chat,Question
from app.db import Session,Workspace,User


def normalize(value):
    return re.sub(r'\s+',' ',value.casefold()).replace('–','-').replace('—','-')

def contains(value, term):
    term = normalize(term).strip()
    if not term:
        return False
    if len(term) <= 3:
        plural = 's?' if term not in {'no', 'not', 'yes', 'and', 'for', 'the'} else ''
        return re.search(r'(?<!\w)' + re.escape(term) + plural + r'(?!\w)', value) is not None
    if ' ' in term:
        return re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', value) is not None
    return re.search(r'(?<!\w)' + re.escape(term) + r'\w*(?!\w)', value) is not None

def grade(case,result):
    answer=normalize(result.get('answer',''))
    if case['category']=='unanswerable':
        ok=result.get('mode')=='insufficient_evidence'
        return {'automatic_pass':ok,'missing_facts':[],'citation_valid':not result.get('sources'),'expected_sources_cited':True,'gold_page_retrieved':None,'reason':'Correct refusal' if ok else 'Did not decline unsupported request'}
    missing=[alternatives for alternatives in case['required'] if not any(contains(answer,term) for term in alternatives)]
    sources=result.get('sources',[])
    ids=[int(n) for n in re.findall(r'\[(\d+)\]',result.get('answer',''))]
    citation_valid=bool(ids) and all(1<=n<=len(sources) for n in ids)
    cited=[sources[n-1] for n in set(ids) if 1<=n<=len(sources)]
    expected_docs={e['document'] for e in case['evidence']}
    covered=expected_docs <= {s['name'] for s in cited}
    gold_page=all(any(s['name']==e['document'] and s['page']==e['page'] for s in sources) for e in case['evidence'])
    grounded_text=normalize(' '.join(s['text'] for s in cited))
    ungrounded=[alts for alts in case['required'] if not any(contains(grounded_text,term) for term in alts)]
    ok=not missing and citation_valid and covered and not ungrounded and result.get('mode') not in ('citation_check_failed','insufficient_evidence')
    return {'automatic_pass':ok,'missing_facts':missing,'citation_valid':citation_valid,'expected_sources_cited':covered,'gold_page_retrieved':gold_page,'ungrounded_facts':ungrounded,'reason':'Expected facts and source checks passed; semantic review still required' if ok else 'Missing expected facts or supporting citations'}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--provider',choices=['none','ollama'],required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--resume',action='store_true')
    parser.add_argument('--only',help='Comma-separated question IDs for diagnostic reruns')
    args=parser.parse_args()
    raw=Path('evals/questions.json').read_bytes(); dataset=json.loads(raw)
    config.AI_PROVIDER=args.provider
    if args.provider=='none': config.API_KEY=''
    output=Path(args.output); output.parent.mkdir(exist_ok=True,parents=True)
    done=set()
    if args.resume and output.exists():
        done={json.loads(line)['id'] for line in output.read_text().splitlines() if line.strip()}
    elif output.exists(): output.write_text('')
    cases=[q for q in dataset['questions'] if q['id'] not in done and (not args.only or q['id'] in args.only.split(','))]
    with Session() as db:
        workspace=db.get(Workspace,dataset['workspace_id']); actor=db.get(User,workspace.owner_id)
    for index,case in enumerate(cases,1):
        start=time.monotonic()
        try:
            with Session() as db:
                # Same production endpoint handler, full workspace scope, ownership checks.
                result=chat(workspace.id,Question(question=case['question'],history=case['history']),actor,db)
            evaluation=grade(case,result)
            error=None
        except Exception as exc:
            result={'answer':'','sources':[],'mode':'error'}
            evaluation={'automatic_pass':False,'reason':'Request failed'}
            error=f'{type(exc).__name__}: {getattr(exc,"detail",str(exc))}'
        row={'id':case['id'],'question':case['question'],'provider':args.provider,'model':config.OLLAMA_CHAT_MODEL if args.provider=='ollama' else None,'dataset_sha256':hashlib.sha256(raw).hexdigest(),'timestamp':datetime.now(timezone.utc).isoformat(),'seconds':round(time.monotonic()-start,3),'result':result,'evaluation':evaluation,'error':error}
        with output.open('a') as file:file.write(json.dumps(row,ensure_ascii=False)+'\n')
        if index%5==0 or index==len(cases):print(f'{args.provider}: {index}/{len(cases)} complete; latest {case["id"]} pass={evaluation["automatic_pass"]} seconds={row["seconds"]}',flush=True)
if __name__=='__main__':main()
