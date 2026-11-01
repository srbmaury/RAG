import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleEvidence,sourceLocation} from '../lib/evidence.ts';

const sources=[
 {chunk_id:'a',document_id:'one',name:'one.md',page:1,text:'first',location_type:'section'},
 {chunk_id:'b',document_id:'two',name:'two.md',page:2,text:'second',location_type:'section'},
 {chunk_id:'c',document_id:'three',name:'three.md',page:3,text:'third',location_type:'section'},
];
test('evidence preserves original citation numbering and avoids uncited passages',()=>{
 const found=visibleEvidence({mode:'ai',answer:'Compare [3] and [1]. Repeat [3].',sources});
 assert.deepEqual(found.map(x=>x.number),[1,3]);
 assert.deepEqual(found.map(x=>x.source.chunk_id),['a','c']);
});
test('evidence remains empty for failed verification or absent answers',()=>{
 assert.deepEqual(visibleEvidence(undefined),[]);
 assert.deepEqual(visibleEvidence({mode:'citation_check_failed',answer:'[1]',sources}),[]);
});
test('out-of-range references do not expose evidence',()=>{
 assert.deepEqual(visibleEvidence({mode:'ai',answer:'Not supported [99]',sources}),[]);
});

test('source metadata does not invent numbered sections for connected records',()=>{
 assert.equal(sourceLocation({...sources[0],provider:'github',page:0}),'GitHub');
 assert.equal(sourceLocation({...sources[0],page:0}),'Source excerpt');
 assert.equal(sourceLocation({...sources[0],location_type:'page',page:3}),'Page 3');
});
