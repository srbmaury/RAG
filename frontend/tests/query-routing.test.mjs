import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestedConnectedSource } from '../lib/query-routing.ts';

test('personal and explicit GitHub PR questions route to GitHub', () => {
    assert.equal(requestedConnectedSource('my pull requests'), 'github');
    assert.equal(requestedConnectedSource('List open pull requests from my GitHub'), 'github');
    assert.equal(requestedConnectedSource('Show my PRs'), 'github');
    assert.equal(requestedConnectedSource('Which of my GitHub repos is most active?'), 'github');
    assert.equal(requestedConnectedSource('List at least 10 of my projects from GitHub'), 'github');
    assert.equal(requestedConnectedSource('Which repository is most active?'), null);
    assert.equal(requestedConnectedSource('What does pull request mean?'), null);
});
