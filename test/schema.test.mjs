// test/schema.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFields, exampleFor } from '../src/render/schema.mjs';

const objSchema = {
  type: 'object',
  required: ['identifier'],
  properties: {
    identifier: { type: 'string', description: 'Email or klay_id' },
    password: { type: 'string', format: 'password' },
  },
};

test('renderFields lists each property with type and required marker', () => {
  const html = renderFields(objSchema);
  assert.match(html, /identifier/);
  assert.match(html, /string/);
  assert.match(html, /required/i);
  assert.match(html, /Email or klay_id/);
});

test('exampleFor builds a representative object', () => {
  const ex = exampleFor(objSchema);
  assert.equal(typeof ex, 'object');
  assert.ok('identifier' in ex);
});

test('exampleFor renders enum first value and arrays', () => {
  assert.equal(exampleFor({ type: 'string', enum: ['CASH', 'TRANSFER'] }), 'CASH');
  assert.deepEqual(exampleFor({ type: 'array', items: { type: 'integer' } }), [0]);
});

test('exampleFor handles allOf by merging', () => {
  const ex = exampleFor({ allOf: [objSchema, { type: 'object', properties: { extra: { type: 'integer' } } }] });
  assert.ok('identifier' in ex);
  assert.ok('extra' in ex);
});
