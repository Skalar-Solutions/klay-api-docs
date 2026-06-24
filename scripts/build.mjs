// scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { renderPage } from '../src/template.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export function flattenOperations(spec) {
  const ops = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    const shared = item.parameters ?? [];
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      ops.push({
        method, path,
        tag: (op.tags && op.tags[0]) || 'Other',
        summary: op.summary, description: op.description,
        parameters: [...shared, ...(op.parameters ?? [])],
        requestBody: op.requestBody, responses: op.responses,
        security: op.security, 'x-klay-flag': op['x-klay-flag'],
      });
    }
  }
  return ops;
}

function main() {
  const spec = yaml.load(readFileSync(join(ROOT, 'klay-api.yml'), 'utf8'));
  const operations = flattenOperations(spec);
  const html = renderPage({ info: spec.info, operations });
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist', 'index.html'), html);
  copyFileSync(join(ROOT, 'src', 'styles.css'), join(ROOT, 'dist', 'styles.css'));
  copyFileSync(join(ROOT, 'favicon.png'), join(ROOT, 'dist', 'favicon.png'));
  console.log(`Built dist/index.html — ${operations.length} operations`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main();
