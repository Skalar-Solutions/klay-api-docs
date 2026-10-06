// test/lite.test.mjs — Lite contract (klay-api-lite.yml) + swagger wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

test('lite spec parses: 39 paths, 47 ops, every op has responses', () => {
  const spec = yaml.load(readFileSync(new URL('../klay-api-lite.yml', import.meta.url), 'utf8'));
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.info.version, '0.1.0');
  const paths = Object.keys(spec.paths);
  assert.equal(paths.length, 39);
  let ops = 0;
  for (const [p, item] of Object.entries(spec.paths)) {
    for (const m of METHODS) {
      if (item[m]) {
        ops++;
        assert.ok(item[m].responses, `${m.toUpperCase()} ${p} has no responses`);
      }
    }
  }
  assert.equal(ops, 47);
});

test('swagger.html offers both specs; dist carries them after build', () => {
  const html = readFileSync(new URL('../swagger.html', import.meta.url), 'utf8');
  assert.ok(html.includes('klay-api-lite.yml'), 'lite spec missing from swagger');
  assert.ok(html.includes('klay-api.yml'), 'go spec missing from swagger');
  for (const f of ['../dist/swagger.html', '../dist/klay-api-lite.yml', '../dist/klay-api.yml']) {
    assert.ok(existsSync(new URL(f, import.meta.url)), `${f} missing — run npm run build`);
  }
});
