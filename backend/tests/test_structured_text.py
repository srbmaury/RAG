import json
from pathlib import Path
import pytest
from app.structured_text import extract_structured
from app.ingest import extract, SUPPORTED

def test_csv_extraction(tmp_path):
    file=tmp_path/'records.csv'
    file.write_text('name,amount\nAlice,20\nBob,30\n',encoding='utf-8')
    assert '.csv' in SUPPORTED
    assert 'Alice | 20' in extract(file,file.name)[0][1]

def test_json_extraction(tmp_path):
    file=tmp_path/'record.json'
    file.write_text(json.dumps({'items':[{'name':'Example'}]}),encoding='utf-8')
    assert 'Example' in extract(file,file.name)[0][1]

def test_html_strips_scripts_and_preserves_text(tmp_path):
    file=tmp_path/'page.html'
    file.write_text('<h1>Study notes</h1><script>secret()</script><p>Important passage</p>',encoding='utf-8')
    text=extract(file,file.name)[0][1]
    assert 'Study notes' in text and 'Important passage' in text
    assert 'secret()' not in text

def test_invalid_json_fails(tmp_path):
    file=tmp_path/'bad.json'
    file.write_text('{broken',encoding='utf-8')
    with pytest.raises(ValueError): extract_structured(file,'.json')

def test_readiness(client):
    assert client.get('/api/health/live').json()=={'status':'ok'}
    assert client.get('/api/health/ready').json()=={'status':'ready'}
