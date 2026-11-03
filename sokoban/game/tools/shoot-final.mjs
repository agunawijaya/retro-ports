/**
 * @file The finished game's frames (prompt 05 §8): `review/current/final/` and
 * the last sheet, `review/prompts/05-polish/sheet.jpg`.
 *
 * Usage:
 *   node tools/shoot-final.mjs [--only title-new,…] [--save] [--url <game url>]
 *   node tools/shoot-final.mjs --sheet
 *
 * Frames go to `.scratch/final/`; `--save` also keeps them in `review/current/final/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveTarget, launchBrowser, collectConsoleErrors, waitForHening, withParams, parseFlags } from './lib/harness.mjs';
import { scratchDir, saveCurrent, paths } from './review.mjs';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const THEMES = ['lentera', 'bintang', 'batu', 'candi', 'mata-air'];
const SENJA = 2;

const room6 = (theme, half = 5) => [`h.screen('room', { room: 6 })`, `h.skipIntro()`, `h.theme('${theme}')`, `h.setMood(${SENJA})`, `h.arrange(${half})`];

const FRAMES = [
  { name: 'title-new', steps: [`h.progress({ solvedUpTo: 0 })`, `h.screen('title')`], wait: 2200 },
  { name: 'title-complete', steps: [`h.progress({ solvedUpTo: 50 })`, `h.screen('title')`], wait: 2200 },
  ...THEMES.map((t) => ({ name: `room06-${t}-senja`, steps: room6(t), wait: 2600 })),
  { name: 'phone-room06', viewport: PHONE, dpr: 2, steps: room6('lentera'), wait: 2600 },
  { name: 'phone-courtyard', viewport: PHONE, dpr: 2, steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('courtyard', { at: 'gerbang' })`], wait: 2000 },
  { name: 'landscape-room06', viewport: LANDSCAPE, dpr: 2, steps: room6('lentera'), wait: 2600 },
  // The end of the hold after the pull-back: the last frame before the dawn veil. Game time, not wall time —
  // under load the clamped delta runs the ending slower than the clock.
  { name: 'ending-pullback', steps: [`h.progress({ solvedUpTo: 50 })`, `h.screen('ending')`], wait: 0, beforeDawn: true },
  { name: 'records-50', steps: [`h.progress({ solvedUpTo: 50 })`, `h.screen('records')`], wait: 1500 },
  // §15 item 2 (screen-left faces keep the left tint): room 6 after E ×0…3. Scratch only, never in final/.
  ...[0, 1, 2, 3].map((k) => ({ name: `rotate-${k}`, scratchOnly: true, steps: [...room6('lentera'), ...Array(k).fill(`h.rotate(1)`)], wait: 1800 })),
];

/** Prompt 05's deliverable: twelve cells, in its order, captioned in its words. */
const SHEET = [
  ['title-new', 'judul · batu baru'],
  ['title-complete', 'judul · 50 ruang selesai'],
  ['room06-lentera-senja', 'ruang 06 · lentera'],
  ['room06-bintang-senja', 'ruang 06 · cahaya bintang'],
  ['room06-batu-senja', 'ruang 06 · taman batu'],
  ['room06-candi-senja', 'ruang 06 · candi'],
  ['room06-mata-air-senja', 'ruang 06 · mata air'],
  ['phone-room06', 'ponsel · ruang 06'],
  ['phone-courtyard', 'ponsel · halaman'],
  ['landscape-room06', 'ponsel mendatar · ruang 06'],
  ['ending-pullback', 'akhir · tumpukan batu'],
  ['records-50', 'batu catatan · 50 ruang'],
];

const flags = parseFlags(process.argv.slice(2));

if (flags.sheet) {
  const { makeSheet } = await import('./review.mjs');
  await makeSheet('05-polish', SHEET.map(([name, label]) => ({
    src: path.join(paths.review, 'current', 'final', `${name}.jpg`),
    label,
  })));
  process.exit(0);
}

const only = flags.only ? String(flags.only).split(',') : null;
const outDir = scratchDir('final');
const target = await resolveTarget(flags.url);
const browser = await launchBrowser();
const problems = [];

for (const frame of FRAMES) {
  if (only && !only.includes(frame.name)) continue;
  const page = await browser.newPage({ viewport: frame.viewport ?? DESKTOP, deviceScaleFactor: frame.dpr ?? 1 });
  const errors = collectConsoleErrors(page);
  await page.goto(withParams(target.url, { qa: 1, seed: 7 }), { waitUntil: 'load', timeout: 30000 });
  if (!(await waitForHening(page))) {
    problems.push(`${frame.name}: window.hening never appeared`);
    await page.close();
    continue;
  }
  for (const body of frame.steps) {
    await page.evaluate(`(async () => { const h = window.hening; await (${body}); })()`).catch((e) => {
      problems.push(`${frame.name}: ${body.slice(0, 60)} → ${e.message}`);
    });
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(frame.wait);
  const file = path.join(outDir, `${frame.name}.jpg`);
  if (frame.beforeDawn) {
    // Shoot every 400 ms; keep the last shot taken while no dawn veil existed.
    let last = null;
    for (let i = 0; i < 100; i++) {
      const dawn = await page.evaluate(() => !!document.querySelector('.dawn'));
      if (dawn) break;
      last = await page.screenshot({ type: 'jpeg', quality: 88 });
      await page.waitForTimeout(400);
    }
    if (!last) problems.push(`${frame.name}: the dawn came before any frame`);
    else {
      fs.writeFileSync(file, last);
      if (flags.save) {
        fs.mkdirSync(path.join(paths.review, 'current', 'final'), { recursive: true });
        fs.writeFileSync(path.join(paths.review, 'current', 'final', `${frame.name}.jpg`), last);
      }
    }
  } else {
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
    if (flags.save && !frame.scratchOnly) await saveCurrent(page, 'final', frame.name);
  }
  if (errors.length) problems.push(`${frame.name}: ${errors.slice(0, 3).join(' | ')}`);
  console.log(`${frame.name} → ${path.relative(process.cwd(), file)}`);
  await page.close();
}

await browser.close();
await target.close();
if (problems.length) {
  console.log('\nProblems:');
  for (const p of problems) console.log('  ' + p);
  fs.writeFileSync(path.join(outDir, 'problems.txt'), problems.join('\n'));
}
