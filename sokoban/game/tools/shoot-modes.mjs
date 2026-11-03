/**
 * @file Renders the screens prompt 03 added (the dupa stick, the gate choice,
 * Mimpi, the helper, Taman Sendiri): the frames its critique rounds look at,
 * and — with `--save` — the latest ones into `review/current/modes/`.
 *
 * Usage:
 *   node tools/shoot-modes.mjs [--round 1] [--only mimpi,helper] [--wait ms] [--save] [--url <game url>]
 *   node tools/shoot-modes.mjs --sheet      compose review/prompts/<--prompt, default 03-modes-garden-fix-1>/sheet.jpg
 *
 * Frames go to `.scratch/modes/round-<n>/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveTarget, launchBrowser, collectConsoleErrors, waitForHening, withParams, parseFlags } from './lib/harness.mjs';
import { scratchDir, saveCurrent } from './review.mjs';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// A small garden the slot list, the editor and the play frames share:
// slot 1 tested, slot 2 half-built (no start yet), slot 3 ready.
const GARDEN_ROOM = ['#########', '#       #', '# .$ $. #', '#   @   #', '#       #', '#########'];
const GARDEN = {
  slots: Array.from({ length: 50 }, (_, i) => {
    if (i === 0) return { rows: GARDEN_ROOM, tested: true, solution: 'uLrR', record: { steps: 4, pushes: 2 } };
    if (i === 1) return { rows: ['#######', '# .$  #', '#  $. #', '#######'], tested: false };
    if (i === 2) return { rows: ['######', '#@$ .#', '######'], tested: false };
    return null;
  }),
};

// Ten rooms with both records, so Batu Catatan's dupa tab has rows to show.
function progressWithDupa() {
  const solved = {};
  for (let n = 1; n <= 10; n += 1) {
    const pushes = 18 + ((n * 7) % 23);
    const steps = pushes * 3 + ((n * 13) % 40);
    solved[n] = {
      bebas: { steps, pushes },
      dupa: { steps: steps + 6, pushes: pushes + 2, timeMs: (8 + ((n * 5) % 9)) * 60000 + n * 7000 },
    };
  }
  return { open: 11, solved, assisted: [], floorsLit: [1], ending: false, lastRoom: 10 };
}

const room = (n, extra = '') => [`h.screen('room', { room: ${n}${extra} })`, `h.skipIntro()`];

/** Each frame: storage before load, steps, keys, then how long to let it settle. */
const FRAMES = [
  { name: 'gate-choice', steps: [`h.progress({ solvedUpTo: 5 })`, `h.screen('courtyard', { at: 'gerbang' })`, `h.screen('gate-choice')`], wait: 1600 },
  { name: 'dupa-stick', steps: [...room(6, ", mode: 'dupa'"), `h.arrange(3)`], wait: 1600 },
  { name: 'dupa-last-minute', steps: [...room(6, ", mode: 'dupa'"), `h.arrange(5)`, `h.dupaLeft(47000)`], wait: 1600 },
  { name: 'dupa-padam', steps: [...room(6, ", mode: 'dupa'"), `h.arrange(2)`, `h.dupaLeft(1200)`], wait: 5200 },
  { name: 'results-dupa', steps: [...room(7, ", mode: 'dupa'"), `h.arrange()`, `h.screen('results', { room: 7, steps: 128, pushes: 41, mode: 'dupa', timeMs: 760000, isRecord: true, solvedLine: 'Semua lentera menyala' })`], wait: 1600 },
  { name: 'records-dupa', storage: { 'hening.progress.v1': progressWithDupa() }, steps: [`h.screen('records')`], keys: ['Tab'], wait: 1400 },
  { name: 'settings-modes', steps: [`h.progress({ solvedUpTo: 12 })`, `h.screen('settings')`], wait: 1400 },
  { name: 'mimpi', steps: [`h.progress({ solvedUpTo: 8 })`, `h.screen('dream', { room: 6 })`], wait: 9000 },
  { name: 'helper', steps: [...room(6), `h.helper()`], keys: ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight'], wait: 1800 },
  { name: 'garden-slots', steps: [`h.garden(${JSON.stringify(GARDEN)})`, `h.screen('garden')`], wait: 1600 },
  { name: 'garden-editor', steps: [`h.garden(${JSON.stringify(GARDEN)})`, `h.screen('garden-editor', { slot: 0 })`], wait: 2000 },
  { name: 'garden-editor-rules', steps: [`h.garden(${JSON.stringify(GARDEN)})`, `h.screen('garden-editor', { slot: 1 })`], wait: 2000 },
  { name: 'garden-play', steps: [`h.garden(${JSON.stringify(GARDEN)})`, `h.screen('room', { garden: true, main: true, slot: 0, rows: ${JSON.stringify(GARDEN_ROOM)} })`], wait: 2600 },
  { name: 'phone-dupa', viewport: PHONE, steps: [...room(6, ", mode: 'dupa'"), `h.arrange(3)`], wait: 1600 },
  { name: 'phone-editor', viewport: PHONE, steps: [`h.garden(${JSON.stringify(GARDEN)})`, `h.screen('garden-editor', { slot: 0 })`], wait: 2000 },
];

/** Prompt 03's deliverable: twelve cells, in its order, captioned in its words. */
const SHEET = [
  ['gate-choice', 'gerbang · pilih jalan'],
  ['dupa-stick', 'dupa · menyala'],
  ['dupa-last-minute', 'dupa · menit terakhir'],
  ['dupa-padam', 'dupa telah padam'],
  ['results-dupa', 'selesai · dupa'],
  ['records-dupa', 'batu catatan · dupa'],
  ['mimpi', 'mimpi'],
  ['helper', 'penunjuk'],
  ['garden-slots', 'taman sendiri · daftar'],
  ['garden-editor', 'taman sendiri · menyunting'],
  ['garden-play', 'taman sendiri · coba'],
  ['phone-editor', 'ponsel · menyunting'],
];

const flags = parseFlags(process.argv.slice(2));

if (flags.sheet) {
  const { makeSheet, paths } = await import('./review.mjs');
  await makeSheet(flags.prompt ? String(flags.prompt) : '03-modes-garden-fix-1', SHEET.map(([name, label]) => ({
    src: path.join(paths.review, 'current', 'modes', `${name}.jpg`),
    label,
  })));
  process.exit(0);
}

const only = flags.only ? String(flags.only).split(',') : null;
const round = flags.round ?? '1';
const outDir = scratchDir(path.join('modes', `round-${round}`));

const target = await resolveTarget(flags.url);
const browser = await launchBrowser();
const problems = [];

for (const frame of FRAMES) {
  if (only && !only.includes(frame.name)) continue;
  const page = await browser.newPage({ viewport: frame.viewport ?? DESKTOP, deviceScaleFactor: 1 });
  const errors = collectConsoleErrors(page);
  if (frame.storage) {
    await page.addInitScript((entries) => {
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, JSON.stringify(v));
    }, frame.storage);
  }
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
  for (const key of frame.keys ?? []) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(flags.wait ? Number(flags.wait) : frame.wait);
  const file = path.join(outDir, `${frame.name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  if (flags.save) await saveCurrent(page, 'modes', frame.name);
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
