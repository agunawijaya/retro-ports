/**
 * @file Renders every screen around the rooms (prompt 02 §11): the frames the
 * critique rounds look at, and — with `--save` — the latest ones into
 * `review/current/tower/` through `saveCurrent`.
 *
 * Usage:
 *   node tools/shoot-tower.mjs [--round 1] [--only title,floor1] [--wait ms] [--save] [--url <game url>]
 *   node tools/shoot-tower.mjs --sheet      compose review/prompts/02-tower/sheet.jpg
 *
 * Frames go to `.scratch/tower/round-<n>/`; `--save` also keeps them in
 * `review/current/tower/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveTarget, launchBrowser, collectConsoleErrors, waitForHening, withParams, parseFlags, GAME_DIR } from './lib/harness.mjs';
import { scratchDir, saveCurrent } from './review.mjs';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** A room with every lantern lit behind the card (the bow is still playing). */
const litRoom = (n) => [`h.screen('room', { room: ${n} })`, `h.skipIntro()`, `h.arrange()`];

/** Each frame: how to reach it, then how long to let it settle. */
const FRAMES = [
  { name: 'title', steps: [`h.progress({ solvedUpTo: 0 })`, `h.screen('title')`], wait: 1500 },
  { name: 'courtyard', steps: [`h.progress({ solvedUpTo: 0 })`, `h.screen('courtyard')`], wait: 1500 },
  { name: 'courtyard-caption', steps: [`h.progress({ solvedUpTo: 0 })`, `h.screen('courtyard', { at: 'batu' })`], wait: 1500 },
  { name: 'elevator', steps: [`h.progress({ solvedUpTo: 12 })`, `h.screen('elevator', { from: 0, to: 2, then: 'floor' })`], wait: 5600 },
  { name: 'floor1', steps: [`h.progress({ solvedUpTo: 4 })`, `h.screen('floor', { floor: 1 })`], wait: 1800 },
  { name: 'floor2-progress23', steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('floor', { floor: 2, room: 14 })`], wait: 1800 },
  { name: 'tower-from-courtyard-progress23', steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('courtyard', { at: 'gerbang' })`], wait: 2500 },
  { name: 'results', steps: [...litRoom(7), `h.screen('results', { room: 7, steps: 128, pushes: 41, isRecord: false, solvedLine: 'Semua lentera menyala' })`], wait: 1400 },
  { name: 'results-record', steps: [...litRoom(7), `h.screen('results', { room: 7, steps: 96, pushes: 31, isRecord: true, solvedLine: 'Semua lentera menyala' })`], wait: 1400 },
  { name: 'pause', steps: [`h.screen('room', { room: 6 })`, `h.skipIntro()`, `h.arrange(4)`, `h.screen('pause', { room: 6 })`], wait: 2400 },
  { name: 'records', steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('records')`], wait: 1200 },
  { name: 'settings', steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('settings')`], wait: 1200 },
  { name: 'ending', steps: [`h.progress({ solvedUpTo: 50 })`, `h.screen('ending')`], wait: 6500 },
  // 04b: a stone mid-settle as the platform passes through it (Lantai I is passed at 3.2 s of a two-floor ride).
  { name: 'elevator-settle', steps: [`h.progress({ solvedUpTo: 12 })`, `h.screen('elevator', { from: 0, to: 2, then: 'floor' })`], wait: 3700 },
  { name: 'floor5', steps: [`h.progress({ solvedUpTo: 46 })`, `h.screen('floor', { floor: 5 })`], wait: 1800 },
  { name: 'phone-courtyard', viewport: PHONE, steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('courtyard', { at: 'gerbang' })`], wait: 1800 },
  { name: 'phone-floor', viewport: PHONE, steps: [`h.progress({ solvedUpTo: 23 })`, `h.screen('floor', { floor: 3 })`], wait: 1800 },
];

/** The prompt's deliverable: twelve cells, in its order, captioned in its words. */
const SHEET = [
  ['title', 'judul'],
  ['courtyard', 'halaman'],
  ['courtyard-caption', 'halaman · keterangan tempat'],
  ['elevator', 'elevator'],
  ['floor1', 'lantai I'],
  ['floor2-progress23', 'lantai II (23 ruang selesai)'],
  ['tower-from-courtyard-progress23', 'menara dari halaman (23 ruang selesai)'],
  ['results-record', 'selesai · rekor baru'],
  ['pause', 'jeda'],
  ['records', 'batu catatan'],
  ['settings', 'kolam'],
  ['ending', 'akhir'],
];

/** 04b's deliverable: 02's frame left, the stones right, where they pair (prompt 04b §Deliverable). */
const OLD = (name) => path.join(GAME_DIR, '..', '.scratch', '04b-02-tower', `${name}.jpg`);
const SHEET_04B = [
  [OLD('title'), '02 · judul'], ['title', 'batu · judul'],
  [OLD('courtyard'), '02 · halaman'], ['courtyard', 'batu · halaman'],
  [OLD('elevator'), '02 · elevator'], ['elevator-settle', 'batu · elevator (batu menetap)'],
  [OLD('floor2-progress23'), '02 · lantai II (23 ruang)'], ['floor2-progress23', 'batu · lantai II (23 ruang)'],
  ['floor5', 'batu · lantai V'], ['tower-from-courtyard-progress23', 'batu · menara dari halaman (23 ruang)'],
  [OLD('ending'), '02 · akhir'], ['ending', 'batu · akhir'],
];

const flags = parseFlags(process.argv.slice(2));

if (flags.sheet04b) {
  const { makeSheet, paths } = await import('./review.mjs');
  await makeSheet('04b-floating-stones', SHEET_04B.map(([name, label]) => ({
    src: name.includes(path.sep) || name.includes('/') ? name : path.join(paths.review, 'current', 'tower', `${name}.jpg`),
    label,
  })));
  process.exit(0);
}

if (flags.sheet) {
  const { makeSheet, paths } = await import('./review.mjs');
  await makeSheet('02-tower', SHEET.map(([name, label]) => ({
    src: path.join(paths.review, 'current', 'tower', `${name}.jpg`),
    label,
  })));
  process.exit(0);
}

const only = flags.only ? String(flags.only).split(',') : null;
const round = flags.round ?? '1';
const outDir = scratchDir(path.join('tower', `round-${round}`));

const target = await resolveTarget(flags.url);
const browser = await launchBrowser();
const problems = [];

for (const frame of FRAMES) {
  if (only && !only.includes(frame.name)) continue;
  const page = await browser.newPage({ viewport: frame.viewport ?? DESKTOP, deviceScaleFactor: 1 });
  const errors = collectConsoleErrors(page);
  await page.goto(withParams(target.url, { qa: 1, seed: 7 }), { waitUntil: 'load', timeout: 30000 });
  if (!(await waitForHening(page))) {
    problems.push(`${frame.name}: window.hening never appeared`);
    await page.close();
    continue;
  }
  for (const body of frame.steps) {
    await page.evaluate(`(async () => { const h = window.hening; await (${body}); })()`).catch((e) => {
      problems.push(`${frame.name}: ${body} → ${e.message}`);
    });
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(flags.wait ? Number(flags.wait) : frame.wait);
  const file = path.join(outDir, `${frame.name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  if (flags.save) await saveCurrent(page, 'tower', frame.name);
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
