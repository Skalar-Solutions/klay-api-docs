// src/render/sidebar.mjs
import { escapeHtml } from './flag.mjs';

export function opId(op) {
  return `${op.method}-${op.path}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function groupByTag(operations) {
  const order = [];
  const map = new Map();
  for (const op of operations) {
    if (!map.has(op.tag)) { map.set(op.tag, []); order.push(op.tag); }
    map.get(op.tag).push(op);
  }
  return order.map(tag => ({ tag, operations: map.get(tag) }));
}

export function renderSidebar(operations) {
  const groups = groupByTag(operations);
  const sections = groups.map(g => {
    const links = g.operations.map(op => `
      <a class="nav__link" href="#${opId(op)}">
        <span class="nav__method nav__method--${op.method}">${op.method.toUpperCase()}</span>
        <span class="nav__label">${escapeHtml(op.summary || op.path)}</span>
      </a>`).join('');
    return `<div class="nav__group"><div class="nav__tag">${escapeHtml(g.tag)}</div>${links}</div>`;
  }).join('');
  return `<nav class="sidebar" aria-label="API navigation">${sections}</nav>`;
}
