// src/render/operation.mjs
import { escapeHtml, renderFlag } from './flag.mjs';
import { renderFields, renderExample } from './schema.mjs';
import { opId } from './sidebar.mjs';

function bodySchema(op) {
  return op.requestBody?.content?.['application/json']?.schema;
}

function renderParams(parameters = []) {
  if (!parameters.length) return '';
  const rows = parameters.map(p => `
    <tr>
      <td class="field__name">${escapeHtml(p.name)}${p.required ? '<span class="field__req">required</span>' : ''}</td>
      <td class="field__type">${escapeHtml(p.in)} · ${escapeHtml(p.schema?.type ?? 'string')}</td>
      <td class="field__desc">${escapeHtml(p.description ?? '')}</td>
    </tr>`).join('');
  return `<h4 class="op__subhead">Parameters</h4><table class="fields"><thead><tr><th>Name</th><th>In · Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderResponses(responses = {}) {
  const blocks = Object.entries(responses).map(([code, r]) => {
    const schema = r.content?.['application/json']?.schema;
    const cls = code.startsWith('2') ? 'ok' : 'err';
    return `<div class="resp resp--${cls}">
      <div class="resp__code">${escapeHtml(code)}</div>
      <div class="resp__desc">${escapeHtml(r.description ?? '')}</div>
      ${schema ? renderFields(schema) : ''}
    </div>`;
  }).join('');
  return `<h4 class="op__subhead">Responses</h4>${blocks}`;
}

export function renderOperation(op) {
  const id = opId(op);
  const body = bodySchema(op);
  const secured = Array.isArray(op.security) && op.security.length;
  return `<section class="op" id="${id}">
    <div class="op__head">
      <span class="op__method op__method--${op.method}">${op.method.toUpperCase()}</span>
      <code class="op__path">${escapeHtml(op.path)}</code>
      ${secured ? '<span class="op__auth">🔒 Auth required</span>' : '<span class="op__auth op__auth--public">Public</span>'}
    </div>
    <h3 class="op__summary">${escapeHtml(op.summary ?? '')}</h3>
    ${renderFlag(op['x-klay-flag'])}
    ${op.description ? `<p class="op__desc">${escapeHtml(op.description)}</p>` : ''}
    ${renderParams(op.parameters)}
    ${body ? `<h4 class="op__subhead">Request body</h4>${renderFields(body)}${renderExample(body)}` : ''}
    ${renderResponses(op.responses)}
  </section>`;
}
