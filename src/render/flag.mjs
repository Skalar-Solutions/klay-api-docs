// src/render/flag.mjs
const LABELS = {
  'suspected-bug': 'Suspected bug',
  'not-implemented': 'Not implemented',
  'undocumented': 'Undocumented',
};

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderFlag(flag) {
  if (!flag || !flag.kind) return '';
  if (flag.kind === 'not-implemented') return '';
  const label = LABELS[flag.kind] ?? flag.kind;
  const note = flag.note ? `<span class="flag__note">${escapeHtml(flag.note)}</span>` : '';
  return `<div class="flag flag--${escapeHtml(flag.kind)}"><span class="flag__label">${escapeHtml(label)}</span>${note}</div>`;
}
