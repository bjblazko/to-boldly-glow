// Renders each concept page to a PNG next to it.
// Usage (from the repo root): node docs/design/glass-concepts/render.mjs [concept-name…]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dir = path.dirname(fileURLToPath(import.meta.url));
const all = [
  'concept-a-candy-glass', 'concept-b-liquid-prism', 'concept-c-neon-reactor',
  'concept-d-cut-crystal', 'concept-e-dichroic-slab', 'concept-f-deco-jewel',
];
const names = process.argv.length > 2 ? process.argv.slice(2) : all;

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
// CHROMIUM_PATH lets you point at a preinstalled browser whose version differs from Playwright's.
const browser = await chromium.launch({ proxy, executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
for (const name of names) {
  await page.goto(pathToFileURL(path.join(dir, `${name}.html`)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(dir, `${name}.png`);
  await page.screenshot({ path: out });
  console.log(`wrote ${out}`);
}
await browser.close();
