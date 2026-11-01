import { test } from 'node:test';
import assert from 'node:assert/strict';
// CI executes TypeScript via Node's built-in type stripping.
import { conversationPlan } from '../lib/conversation.ts';
test('Home starts a new chat and does not send previous history', () => {
    const p = conversationPlan('new', 'old', [{ role: 'assistant', content: 'prior' }], 'New question');
    assert.equal(p.id, null);
    assert.deepEqual(p.history, []);
    assert.equal(p.pending.length, 1);
    assert.equal(p.title, 'New question');
});
test('follow-up preserves conversation identity and context', () => {
    const old = [{ role: 'user', content: 'first' }];
    const p = conversationPlan('followup', 'chat-id', old, 'second');
    assert.equal(p.id, 'chat-id');
    assert.deepEqual(p.history, old);
    assert.equal(p.pending.length, 2);
});
test('empty questions rejected', () => assert.throws(() => conversationPlan('new', null, [], ' ')));
