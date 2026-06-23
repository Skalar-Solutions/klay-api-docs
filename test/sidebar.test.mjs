// test/sidebar.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByTag, renderSidebar, opId } from '../src/render/sidebar.mjs';

const ops = [
  { tag: 'Auth', method: 'post', path: '/auth/login', summary: 'Login' },
  { tag: 'Auth', method: 'post', path: '/auth/logout', summary: 'Logout' },
  { tag: 'Metrics', method: 'get', path: '/metrics/summary', summary: 'Summary' },
];

test('groupByTag preserves tag order and groups members', () => {
  const groups = groupByTag(ops);
  assert.deepEqual(groups.map(g => g.tag), ['Auth', 'Metrics']);
  assert.equal(groups[0].operations.length, 2);
});

test('opId is a stable slug of method+path', () => {
  assert.equal(opId({ method: 'post', path: '/auth/login' }), 'post-auth-login');
});

test('renderSidebar emits an anchor per operation', () => {
  const html = renderSidebar(ops);
  assert.match(html, /#post-auth-login/);
  assert.match(html, /#get-metrics-summary/);
  assert.match(html, /Auth/);
});
