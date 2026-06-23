// test/flag.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFlag } from '../src/render/flag.mjs';

test('returns empty string when no flag', () => {
  assert.equal(renderFlag(undefined), '');
});

test('renders kind and note with a kind-specific class', () => {
  const html = renderFlag({ kind: 'suspected-bug', note: 'PENDING rejected' });
  assert.match(html, /flag--suspected-bug/);
  assert.match(html, /suspected bug/i);
  assert.match(html, /PENDING rejected/);
});

test('escapes HTML in the note', () => {
  const html = renderFlag({ kind: 'undocumented', note: '<script>x</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
