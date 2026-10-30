// Render the reference scene's QA states to PNG, using the Edge or Chrome
// already installed on this machine (no browser download needed).
//
//   cd reference/tools
//   npm install            (once: installs playwright-core only)
//   node shoot.mjs [out-folder] [states]
//
// Example: node shoot.mjs ../screens-new title,action,clean

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(process.argv[2] ?? join(root, 'screens-new'));
const states = (process.argv[3] ?? 'title,dirty,action,makeover,clean,results').split(',');

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // try the next installed browser
    }
  }
  throw new Error('Neither Microsoft Edge nor Google Chrome could be started.');
}

mkdirSync(outDir, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(pathToFileURL(join(root, 'living-room.html')).href + '?qa=1');
await page.waitForFunction(() => window.__spyder && window.__spyder.ready, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);

for (const name of states) {
  await page.evaluate((n) => window.__spyder.setup(n), name);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log('saved', name);
}

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
