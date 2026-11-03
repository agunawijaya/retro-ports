/**
 * @file Load check (prompt 05 §4): `dist/hening.html`, copied alone into an
 * empty folder and opened from disk, is interactive — the title answers a tap
 * — within 1.5 s, and the file is ≤ 3 MB.
 *
 * Usage:
 *   node tools/load-check.mjs [--runs 3]
 *
 * "Interactive" is the moment the start veil (`#start`) takes the `hidden`
 * class in answer to a tap, read in the page with `performance.now()` (0 =
 * navigation start). The tool taps the veil every 25 ms from the first moment
 * it exists, so the number is when the page first could answer, not when the
 * tool got round to asking. Runs on the harness browser (SwiftShader), which
 * is slower than a GPU: the number is an upper bound.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, collectConsoleErrors, parseFlags, GAME_DIR } from './lib/harness.mjs';

const BUDGET_MS = 1500;
const BUDGET_BYTES = 3 * 1024 * 1024;

const flags = parseFlags(process.argv.slice(2));
const runs = Number(flags.runs ?? 3);

const built = path.join(GAME_DIR, 'dist', 'hening.html');
if (!fs.existsSync(built)) {
  console.error('load-check: dist/hening.html is missing; run `npm run build` first');
  process.exit(1);
}
const bytes = fs.statSync(built).size;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hening-load-'));
const alone = path.join(dir, 'hening.html');
fs.copyFileSync(built, alone);
const url = pathToFileURL(alone).href;

const browser = await launchBrowser();
const times = [];
const problems = [];
for (let i = 0; i < runs; i++) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = collectConsoleErrors(page);
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  await page.addInitScript(() => {
    window.__answeredAt = null;
    const watch = () => {
      const start = document.getElementById('start');
      if (!start) return requestAnimationFrame(watch);
      new MutationObserver(() => {
        if (window.__answeredAt == null && start.classList.contains('hidden')) window.__answeredAt = performance.now();
      }).observe(start, { attributes: true, attributeFilter: ['class'] });
      const tap = () => {
        if (window.__answeredAt != null) return;
        start.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        start.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        start.click();
        setTimeout(tap, 25);
      };
      tap();
    };
    document.addEventListener('DOMContentLoaded', watch);
  });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__answeredAt != null, null, { timeout: 15000 }).catch(() => {});
  const t = await page.evaluate(() => window.__answeredAt);
  if (t == null) problems.push(`run ${i + 1}: the title never answered a tap within 15 s`);
  else times.push(t);
  const outside = requests.filter((u) => u !== url && !u.startsWith(url.split('?')[0]));
  if (outside.length) problems.push(`run ${i + 1}: ${outside.length} request(s) besides the file itself: ${outside.slice(0, 3).join(', ')}`);
  if (errors.length) problems.push(`run ${i + 1}: console: ${errors.slice(0, 2).join(' | ')}`);
  await context.close();
}
await browser.close();
fs.rmSync(dir, { recursive: true, force: true });

times.sort((a, b) => a - b);
const median = times.length ? times[Math.floor(times.length / 2)] : null;
console.log(`load-check: ${path.relative(process.cwd(), built)} = ${bytes.toLocaleString('en-US')} bytes (${bytes <= BUDGET_BYTES ? 'within' : 'OVER'} 3 MB)`);
console.log(`load-check: opened alone from ${dir} via file://`);
console.log(`load-check: title answered a tap at ${times.map((t) => `${t.toFixed(0)} ms`).join(', ')}; median ${median?.toFixed(0)} ms (${median != null && median <= BUDGET_MS ? 'within' : 'OVER'} 1.5 s)`);
for (const p of problems) console.log(`load-check: ${p}`);
process.exitCode = bytes <= BUDGET_BYTES && median != null && median <= BUDGET_MS && !problems.length ? 0 : 1;
