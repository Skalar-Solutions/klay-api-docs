// src/template.mjs
import { escapeHtml } from './render/flag.mjs';
import { renderSidebar } from './render/sidebar.mjs';
import { renderOperation } from './render/operation.mjs';
import { NAV_SCRIPT } from './nav.mjs';

export function renderPage({ info, operations }) {
  const sidebar = renderSidebar(operations);
  const main = operations.map(renderOperation).join('\n');
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(info.title)} · API Reference</title>
  <link rel="icon" type="image/png" href="favicon.png">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <a class="topbar__logo" href="#">
      <svg class="topbar__logo-mark" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="8" height="8" rx="2" fill="#17abc8"/>
        <rect x="11" y="1" width="8" height="8" rx="2" fill="#17abc8" opacity="0.45"/>
        <rect x="1" y="11" width="8" height="8" rx="2" fill="#17abc8" opacity="0.45"/>
        <rect x="11" y="11" width="8" height="8" rx="2" fill="#17abc8" opacity="0.2"/>
      </svg>
      <span class="topbar__brand">Klay</span>
    </a>
    <span class="topbar__label">API Docs</span>
    <span class="topbar__version">v${escapeHtml(info.version)}</span>
  </header>
  <div class="layout">
    ${sidebar}
    <main class="main">
      ${main}
    </main>
  </div>
  <script>${NAV_SCRIPT}</script>
</body>
</html>`;
}
