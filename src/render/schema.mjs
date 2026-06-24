// src/render/schema.mjs
import { escapeHtml } from './flag.mjs';

function sampleScalar(s) {
  if (s.enum && s.enum.length) return s.enum[0];
  switch (s.type) {
    case 'integer': return 0;
    case 'number': return 0;
    case 'boolean': return true;
    case 'string':
      if (s.format === 'date') return '2026-06-23';
      if (s.format === 'date-time') return '2026-06-23T10:00:00Z';
      if (s.format === 'email') return 'owner@klay.id';
      return 'string';
    default: return null;
  }
}

export function exampleFor(schema) {
  if (!schema) return null;
  if (schema.allOf) return schema.allOf.reduce((acc, s) => Object.assign(acc, exampleFor(s)), {});
  if (schema.type === 'object' || schema.properties) {
    const out = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = exampleFor(v);
    return out;
  }
  if (schema.type === 'array') return [exampleFor(schema.items ?? {})];
  return sampleScalar(schema);
}

function typeLabel(s) {
  if (s.allOf) return 'object';
  if (s.type === 'array') return `array<${s.items?.type ?? 'object'}>`;
  let t = s.type ?? 'object';
  if (s.format) t += ` · ${s.format}`;
  if (s.enum) t += ` · enum`;
  return t;
}

export function renderFields(schema) {
  if (!schema) return '';
  const merged = schema.allOf
    ? schema.allOf.reduce((acc, s) => ({
        properties: { ...acc.properties, ...s.properties },
        required: [...(acc.required ?? []), ...(s.required ?? [])],
      }), { properties: {}, required: [] })
    : schema;
  const required = new Set(merged.required ?? []);
  const props = merged.properties ?? {};
  if (!Object.keys(props).length) return '';
  const rows = Object.entries(props).map(([name, s]) => `
    <tr>
      <td class="field__name">${escapeHtml(name)}${required.has(name) ? '<span class="field__req">required</span>' : ''}</td>
      <td class="field__type">${escapeHtml(typeLabel(s))}</td>
      <td class="field__desc">${escapeHtml(s.description ?? '')}</td>
    </tr>`).join('');
  return `<table class="fields"><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderExample(schema) {
  const ex = exampleFor(schema);
  if (ex === null || ex === undefined) return '';
  return `<pre class="example"><code>${escapeHtml(JSON.stringify(ex, null, 2))}</code></pre>`;
}
