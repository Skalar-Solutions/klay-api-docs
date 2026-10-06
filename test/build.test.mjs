// test/build.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { flattenOperations } from '../scripts/build.mjs';
import yaml from 'js-yaml';

test('flattenOperations yields one entry per path+method with tag', () => {
  const spec = yaml.load(readFileSync(new URL('../klay-api.yml', import.meta.url), 'utf8'));
  const ops = flattenOperations(spec);
  assert.ok(ops.length > 20, `expected >20 operations, got ${ops.length}`);
  for (const op of ops) {
    assert.ok(op.method && op.path && op.tag, `incomplete op: ${JSON.stringify(op).slice(0,80)}`);
  }
});

test('build produces swagger index + reference page with a section per operation', () => {
  execFileSync('node', ['scripts/build.mjs'], { cwd: new URL('..', import.meta.url) });
  const indexUrl = new URL('../dist/index.html', import.meta.url);
  assert.ok(existsSync(indexUrl), 'dist/index.html missing');
  const index = readFileSync(indexUrl, 'utf8');
  assert.ok(index.includes('swagger-ui'), 'dist/index.html is not the swagger view');
  const refUrl = new URL('../dist/reference.html', import.meta.url);
  assert.ok(existsSync(refUrl), 'dist/reference.html missing');
  const html = readFileSync(refUrl, 'utf8');
  const spec = yaml.load(readFileSync(new URL('../klay-api.yml', import.meta.url), 'utf8'));
  const ops = flattenOperations(spec);
  const sectionCount = (html.match(/class="op"/g) || []).length;
  assert.equal(sectionCount, ops.length, 'one <section class="op"> per operation');
});
