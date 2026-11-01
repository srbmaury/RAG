import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestedConnectedSource } from '../lib/query-routing.ts';

test('personal and explicit GitHub PR questions route to GitHub', () => {
  assert.equal(requestedConnectedSource('my pull requests'), 'github');
  assert.equal(requestedConnectedSource('List open pull requests from my GitHub'), 'github');
  assert.equal(requestedConnectedSource('Show my PRs'), 'github');
  assert.equal(requestedConnectedSource('What does pull request mean?'), null);
});
