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
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <span class="topbar__title">${escapeHtml(info.title)}</span>
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
