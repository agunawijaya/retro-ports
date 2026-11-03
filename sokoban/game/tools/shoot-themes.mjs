/**
 * @file Renders the theme frames prompt 04 asks for: room 6 per theme in
 * Senja with half the objects lit, a close-up of one lit and one unlit object
 * per theme, Malam, Mata Air all sealed, Taman Batu's rings, the Kolam's theme
 * row and floor II in Candi. With `--save` the latest go to
 * `review/current/themes/`.
 *
 * Usage:
 *   node tools/shoot-themes.mjs [--round 1] [--only candi-closeup,…] [--save] [--url <game url>]
 *   node tools/shoot-themes.mjs --sheet [--prompt 04-themes-fix-3]
 *
 * Frames go to `.scratch/themes/round-<n>/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveTarget, launchBrowser, collectConsoleErrors, waitForHening, withParams, parseFlags, GAME_DIR } from './lib/harness.mjs';
import { scratchDir, saveCurrent } from './review.mjs';

const DESKTOP = { width: 1440, height: 900 };
const THEMES = ['bintang', 'batu', 'candi', 'mata-air'];
const HALF = 5; // room 6 has ten objects
const SENJA = 2;
const MALAM = 3;

// Room 6 on paper, to aim the close-ups: after arrange(5) the first five free
// objects (reading order) stand on the first five free targets.
function room6Pair() {
  const data = JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'src/data/rooms.generated.json'), 'utf8'));
  const rows = data.rooms.find((r) => r.number === 6).rows;
  const cols = Math.max(...rows.map((r) => r.length));
  const targets = [];
  const objects = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if ('.*+'.includes(ch)) targets.push({ r, c });
    if ('$*'.includes(ch)) objects.push({ r, c, onTarget: ch === '*' });
  }));
  const free = objects.filter((o) => !o.onTarget);
  const lit = targets.filter((t) => !objects.some((o) => o.r === t.r && o.c === t.c)).slice(0, HALF);
  const unlit = free.slice(HALF);
  let best = null;
  for (const a of lit) {
    for (const b of unlit) {
      const d = Math.hypot(a.r - b.r, a.c - b.c);
      if (!best || d < best.d) best = { a, b, d };
    }
  }
  const x = (c) => c - cols / 2 + 0.5;
  const z = (r) => r - rows.length / 2 + 0.5;
  return { x: (x(best.a.c) + x(best.b.c)) / 2, z: (z(best.a.r) + z(best.b.r)) / 2 };
}

const pair = room6Pair();
const room6 = (theme, mood, n = HALF) => [`h.screen('room', { room: 6 })`, `h.skipIntro()`, `h.theme('${theme}')`, `h.setMood(${mood})`, `h.arrange(${n})`];

const settings = (theme) => ({ 'hening.settings.v1': { theme, mode: 'bebas', dupaMinutes: 20, volume: { master: 0.8, ambience: 0.6, notes: 0.8 }, reducedMotion: 'system', hints: true } });

const FRAMES = [
  { name: 'lentera-instanced-room06', steps: room6('lentera', SENJA), wait: 2600 },
  ...THEMES.flatMap((t) => [
    { name: `${t}-room06`, steps: room6(t, SENJA), wait: 2600 },
    { name: `${t}-closeup`, steps: [...room6(t, SENJA), `h.focus(${pair.x}, ${pair.z}, 2.6)`], wait: 2600 },
    { name: `${t}-malam`, steps: room6(t, MALAM), wait: 2600 },
  ]),
  { name: 'batu-rings', steps: [...room6('batu', SENJA), `h.focus(${pair.x}, ${pair.z}, 2.6)`], wait: 3200 },
  { name: 'mata-air-sealed', steps: room6('mata-air', SENJA, 99), wait: 4200 },
  { name: 'kolam-themes', storage: settings('candi'), steps: [`h.progress({ solvedUpTo: 12 })`, `h.screen('settings')`], wait: 1500 },
  { name: 'floor2-candi', storage: settings('candi'), steps: [`h.progress({ solvedUpTo: 14 })`, `h.screen('floor', { floor: 2, room: 15 })`], wait: 2200 },
];

/** Prompt 04's deliverable: twelve cells, in its order, captioned in its words. */
const SHEET = [
  ['lentera-instanced-room06', 'lentera · instanced (ruang 06)'],
  ['bintang-room06', 'cahaya bintang · ruang 06'],
  ['bintang-closeup', 'cahaya bintang · dekat'],
  ['batu-room06', 'taman batu · ruang 06'],
  ['batu-rings', 'taman batu · lingkaran pasir'],
  ['candi-room06', 'candi · ruang 06'],
  ['candi-closeup', 'candi · dekat'],
  ['mata-air-room06', 'mata air · ruang 06'],
  ['mata-air-sealed', 'mata air · semua tertutup'],
  ['malam-four', 'malam · keempat tema'],
  ['kolam-themes', 'kolam · tema'],
  ['floor2-candi', 'lantai II · candi'],
];

const flags = parseFlags(process.argv.slice(2));

/** The four Malam frames as one 2 × 2 image, drawn on a page canvas. */
async function composeMalam(browser, dir, out) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const srcs = THEMES.map((t) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, `${t}-malam.jpg`)).toString('base64'));
  const data = await page.evaluate(async (list) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1440; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < list.length; i++) {
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.src = list[i]; });
      ctx.drawImage(img, (i % 2) * 720, Math.floor(i / 2) * 450, 720, 450);
    }
    return canvas.toDataURL('image/jpeg', 0.9);
  }, srcs);
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  await page.close();
}

if (flags.sheet) {
  const { makeSheet, paths } = await import('./review.mjs');
  await makeSheet(flags.prompt ? String(flags.prompt) : '04-themes-fix-3', SHEET.map(([name, label]) => ({
    src: path.join(paths.review, 'current', 'themes', `${name}.jpg`),
    label,
  })));
  process.exit(0);
}

const only = flags.only ? String(flags.only).split(',') : null;
const round = flags.round ?? '1';
const outDir = scratchDir(path.join('themes', `round-${round}`));

const target = await resolveTarget(flags.url);
const browser = await launchBrowser();
const problems = [];

for (const frame of FRAMES) {
  if (only && !only.includes(frame.name)) continue;
  const page = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1 });
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
  await page.waitForTimeout(frame.wait);
  const file = path.join(outDir, `${frame.name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  if (flags.save) await saveCurrent(page, 'themes', frame.name);
  if (errors.length) problems.push(`${frame.name}: ${errors.slice(0, 3).join(' | ')}`);
  console.log(`${frame.name} → ${path.relative(process.cwd(), file)}`);
  await page.close();
}

if (!only || THEMES.every((t) => only.includes(`${t}-malam`))) {
  await composeMalam(browser, outDir, path.join(outDir, 'malam-four.jpg'));
  if (flags.save) {
    const { paths } = await import('./review.mjs');
    fs.copyFileSync(path.join(outDir, 'malam-four.jpg'), path.join(paths.review, 'current', 'themes', 'malam-four.jpg'));
  }
}

await browser.close();
await target.close();
if (problems.length) {
  console.log('\nProblems:');
  for (const p of problems) console.log('  ' + p);
  fs.writeFileSync(path.join(outDir, 'problems.txt'), problems.join('\n'));
}
