/**
 * @file Flow check (prompt 02 §10 / `briefs/02-tower-checks.md`). Drives the
 * whole tower loop with the keyboard and the pointer, the way a player
 * would: title -> courtyard -> gate -> elevator -> floor -> room -> results
 * -> pause -> floor -> courtyard -> records -> settings -> reload; then the
 * same five steps again with storage disabled; then the floor-II ring and
 * the ending, both reached without the solver (`arrange()` finishes every
 * room).
 *
 * The brief's 13 numbered checks are the rows of the printed table.
 * Sub-assertions inside a step are written to the full log
 * (`.scratch/flow/flow.txt`) but roll up into that one step's PASS/FAIL —
 * the first failing assertion supplies the reason.
 *
 * Usage:
 *   node tools/flow.mjs [--url <override>]
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  resolveTarget,
  launchBrowser,
  collectConsoleErrors,
  waitForHening,
  withParams,
  parseFlags,
} from './lib/harness.mjs';
import { scratchDir } from './review.mjs';

const DESKTOP = { width: 1440, height: 900 };
const WAIT = 15000; // a state change driven by one key press or tap
const WAIT_LONG = 20000; // a ride, a crossfade into a room, or a results departure
const ENDING_WAIT = 40000; // ending -> courtyard: the brief's own budget for this one wait

const rows = []; // { n, name, pass, reason } — the printed table
const log = []; // the full narrative, written to .scratch/flow/flow.txt

function say(line) {
  log.push(line);
}

function recordStep(n, name, pass, reason = '') {
  rows.push({ n, name, pass, reason });
  const msg = `[${pass ? 'PASS' : 'FAIL'}] ${n}. ${name}${reason ? ' — ' + reason : ''}`;
  say(msg);
  console.log(msg);
}

/** Runs `fn`; a thrown error, a `false` return or a string return are all a FAIL (the string is the reason). */
async function check(fn) {
  try {
    const result = await fn();
    if (result === false) return { pass: false, reason: 'assertion failed' };
    if (typeof result === 'string') return { pass: false, reason: result };
    return { pass: true, reason: '' };
  } catch (err) {
    return { pass: false, reason: String(err && err.message ? err.message : err) };
  }
}

/**
 * Steps 1–5 of the brief, as one page sequence: load -> click -> courtyard;
 * 1 -> gate -> elevator -> skip -> floor I (room 1 open); enter -> skipIntro
 * + arrange -> results; enter (default choice) -> room 2; Escape -> pause ->
 * kembali ke menara -> floor I (room 1 solved, room 2 open, room 3 locked).
 * Used for the main run (steps 1–5 of the table) and again, unchanged, for
 * step 10's repeat with storage disabled.
 * @returns {Promise<{name: string, pass: boolean, reason: string}[]>}
 */
async function playFromTitleThroughFloor1(page, targetUrl) {
  const steps = [];
  const add = (name, r) => steps.push({ name, pass: r.pass, reason: r.reason });

  add(
    'load ?qa=1 (title) → click → courtyard',
    await check(async () => {
      await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
      await waitForHening(page, 10000);
      const cur0 = await page.evaluate(() => window.hening?.current?.());
      if (cur0?.base !== 'title') return `base after load was "${cur0?.base}", not "title"`;
      await page.click('#start');
      await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT });
      const cur1 = await page.evaluate(() => window.hening?.current?.());
      if (cur1?.base !== 'courtyard') return `base after the click was "${cur1?.base}", not "courtyard"`;
      return true;
    }),
  );

  add(
    '1 → gate → elevator → skip → floor I, room 1 open',
    await check(async () => {
      await page.keyboard.press('Digit1');
      await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'gerbang', null, { timeout: WAIT });
      const info0 = await page.evaluate(() => window.hening?.screenInfo?.());
      if (info0?.place !== 'gerbang') return `screenInfo().place was "${info0?.place}", not "gerbang"`;
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => {
        const c = window.hening?.current?.();
        return c?.top === 'gate-choice' || c?.base === 'elevator';
      }, null, { timeout: WAIT });
      if (await page.evaluate(() => window.hening?.current?.()?.top === 'gate-choice')) {
        await page.keyboard.press('Enter');
      }
      await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
      await page.keyboard.press('Space'); // any key skips the ride
      await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT_LONG });
      const info1 = await page.evaluate(() => window.hening?.screenInfo?.());
      if (info1?.floor !== 1) return `screenInfo().floor was ${info1?.floor}, not 1`;
      if (info1?.alcoves?.[0]?.state !== 'open') return `alcove 0's state was "${info1?.alcoves?.[0]?.state}", not "open"`;
      return true;
    }),
  );

  add(
    'enter room 1 → skipIntro() + arrange() → results',
    await check(async () => {
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: WAIT_LONG });
      await page.evaluate(() => window.hening?.skipIntro?.());
      await page.evaluate(() => window.hening?.arrange?.());
      await page.waitForFunction(() => window.hening?.current?.()?.top === 'results', null, { timeout: WAIT_LONG });
      const cur = await page.evaluate(() => window.hening?.current?.());
      if (cur?.top !== 'results') return `top was "${cur?.top}", not "results"`;
      return true;
    }),
  );

  add(
    'ruang berikutnya (the default choice) → room 2',
    await check(async () => {
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: WAIT_LONG });
      const insp = await page.evaluate(() => window.hening?.inspect?.());
      if (insp?.room !== 2) return `hening.inspect().room was ${insp?.room}, not 2`;
      return true;
    }),
  );

  add(
    'pause → kembali ke menara → floor I: room 1 solved, room 2 open, room 3 locked',
    await check(async () => {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.hening?.current?.()?.top === 'pause', null, { timeout: WAIT });
      const cur0 = await page.evaluate(() => window.hening?.current?.());
      if (cur0?.top !== 'pause') return `top was "${cur0?.top}", not "pause"`;
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT });
      const info = await page.evaluate(() => window.hening?.screenInfo?.());
      if (info?.floor !== 1) return `screenInfo().floor was ${info?.floor}, not 1`;
      const states = (info?.alcoves ?? []).map((a) => a.state);
      if (states[0] !== 'solved') return `alcove 0's state was "${states[0]}", not "solved"`;
      if (states[1] !== 'open') return `alcove 1's state was "${states[1]}", not "open"`;
      if (states[2] !== 'locked') return `alcove 2's state was "${states[2]}", not "locked"`;
      return true;
    }),
  );

  return steps;
}

/** Step 10: a fresh context whose `localStorage` throws, repeating steps 1–5, then a reload. */
async function step10(browser, targetUrl) {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const errors = collectConsoleErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage disabled for QA');
      },
    });
  });

  const subSteps = await playFromTitleThroughFloor1(page, targetUrl);
  const failed = subSteps.filter((s) => !s.pass);

  let pass = failed.length === 0 && errors.length === 0;
  let reason = '';
  if (failed.length) reason += `sub-steps failed: ${failed.map((s) => `${s.name} (${s.reason})`).join('; ')}. `;
  if (errors.length) reason += `console errors: ${errors.join('; ')}. `;

  try {
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    const progress = await page.evaluate(() => window.hening.progress());
    if (progress.open !== 1) {
      pass = false;
      reason += `after reload, progress.open was ${progress.open}, not 1 (default).`;
    }
  } catch (err) {
    pass = false;
    reason += `reload check: ${String(err && err.message ? err.message : err)}`;
  }

  say('--- step 10: storage disabled, repeating steps 1-5 ---');
  for (const s of subSteps) say(`    [${s.pass ? 'PASS' : 'FAIL'}] ${s.name}${s.reason ? ' — ' + s.reason : ''}`);
  if (errors.length) say(`    console errors during step 10: ${errors.join('; ')}`);
  say('--- step 10: reload, progress back to default ---');

  await page.close();
  await context.close();
  return { pass, reason: reason.trim(), errors };
}

/** Step 11: `solvedUpTo: 9` -> room 10 -> `arrange()` -> an unskipped ride up -> floor II, ring I lit. */
async function step11(browser, targetUrl) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const r = await check(async () => {
    await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.evaluate(() => window.hening?.progress?.({ solvedUpTo: 9 }));
    await page.evaluate(() => window.hening?.screen?.('room', { room: 10 }));
    await page.evaluate(() => window.hening?.skipIntro?.());
    await page.evaluate(() => window.hening?.arrange?.());
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'results', null, { timeout: WAIT_LONG });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    // Let the ride finish on its own — no key press, per the brief.
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT_LONG });
    const info = await page.evaluate(() => window.hening?.screenInfo?.());
    if (info?.floor !== 2) return `screenInfo().floor was ${info?.floor}, not 2`;
    if (!(info?.ringsLit ?? []).includes(1)) return `screenInfo().ringsLit was [${info?.ringsLit}], expected it to include 1`;
    return true;
  });
  await page.close();
  return { ...r, errors };
}

/** Step 12: `solvedUpTo: 49` -> room 50 -> `arrange()` -> results (only "naik") -> elevator -> ending -> courtyard. */
async function step12(browser, targetUrl) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const r = await check(async () => {
    await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.evaluate(() => window.hening?.progress?.({ solvedUpTo: 49 }));
    await page.evaluate(() => window.hening?.screen?.('room', { room: 50 }));
    await page.evaluate(() => window.hening?.skipIntro?.());
    await page.evaluate(() => window.hening?.arrange?.());
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'results', null, { timeout: WAIT_LONG });
    const labels = await page.evaluate(() => Array.from(document.querySelectorAll('.choices .choice')).map((b) => b.textContent));
    if (labels.length !== 1 || labels[0] !== 'naik') return `results showed choices [${labels.join(', ')}], expected only "naik"`;
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'ending', null, { timeout: WAIT_LONG });
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: ENDING_WAIT });
    return true;
  });
  await page.close();
  return { ...r, errors };
}

/** 03.1: gate → choice → dupa → room 1 → dupaLeft(3000) → wait → "dupa telah padam" → ulangi → fresh stick → arrange() → results show the time → Batu Catatan Dupa tab shows it. */
async function check03_1(browser, targetUrl) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const r = await check(async () => {
    await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.click('#start');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT });

    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'gerbang', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'gate-choice', null, { timeout: WAIT });

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');

    await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT_LONG });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: WAIT_LONG });
    await page.evaluate(() => window.hening?.skipIntro?.());

    await page.evaluate(() => window.hening?.dupaLeft?.(3000));
    await page.waitForFunction(() => {
      const headline = document.querySelector('.card-veil .headline, .timeout-card .headline');
      return headline && headline.textContent.includes('dupa telah padam');
    }, null, { timeout: 10000 });

    await page.keyboard.press('Enter'); // ulangi
    await page.waitForFunction(() => window.hening?.inspect?.()?.dupaLeft > 3000, null, { timeout: WAIT });

    await page.evaluate(() => window.hening?.arrange?.());
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'results', null, { timeout: WAIT_LONG });
    const statsText = await page.evaluate(() => document.querySelector('.card-veil .stats')?.textContent ?? '');
    if (!/\d+:\d+/.test(statsText)) return `results stats line "${statsText}" did not show formatted time (MM:SS)`;

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT_LONG });

    await page.keyboard.press('Digit3');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'batu', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'records', null, { timeout: WAIT });

    await page.keyboard.press('Tab');
    const dupaRow = await page.evaluate(() => {
      const list = Array.from(document.querySelectorAll('.rows .row'));
      const row = list.find((el) => el.querySelector('.room')?.textContent === 'ruang 01');
      return row ? row.textContent : null;
    });
    if (!dupaRow) return 'no row for ruang 01 in records Dupa tab';
    if (!/\d+:\d+/.test(dupaRow)) return `records row "${dupaRow}" has no time format`;

    await page.keyboard.press('Escape');
    return true;
  });
  await page.close();
  return { ...r, errors };
}

/** 03.2: gate → tanpa batas → room 2 → helper opens, steps forward 5, closes → the attempt is unchanged → arrange() → results without rekor baru → assisted holds room 2, room 3 open. */
async function check03_2(browser, targetUrl) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const r = await check(async () => {
    await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.click('#start');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT });

    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'gerbang', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'gate-choice', null, { timeout: WAIT });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT_LONG });

    await page.evaluate(() => window.hening?.screen?.('room', { room: 2 }));
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: WAIT_LONG });
    await page.evaluate(() => window.hening?.skipIntro?.());

    await page.evaluate(() => window.hening?.helper?.());
    await page.waitForFunction(() => !!document.querySelector('.helper-strip'), null, { timeout: WAIT });

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.helper-strip'), null, { timeout: WAIT });

    const insp = await page.evaluate(() => ({
      where: window.hening?.where?.(),
      state: window.hening?.state,
    }));
    if (insp.state?.steps !== 0) return `attempt was modified by helper (steps = ${insp.state?.steps})`;

    await page.evaluate(() => window.hening?.arrange?.());
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'results', null, { timeout: WAIT_LONG });

    const recordBadge = await page.evaluate(() => document.querySelector('.card-veil .record'));
    if (recordBadge) return 'results showed "rekor baru" after assisted solve';

    const p = await page.evaluate(() => window.hening?.progress?.());
    if (!p.assisted?.includes(2)) return `progress.assisted did not include room 2: [${p.assisted}]`;
    if (p.solved?.['2']) return 'progress.solved recorded a solve for room 2 despite being assisted';
    if (!(p.open >= 3)) return `progress.open was ${p.open}, expected >= 3`;

    return true;
  });
  await page.close();
  return { ...r, errors };
}

/** 03.3: courtyard, 20 s idle → Mimpi plays → a key wakes the player in the courtyard at the same tile. */
async function check03_3(browser, targetUrl) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const r = await check(async () => {
    await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.click('#start');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT });

    const startInfo = await page.evaluate(() => window.hening?.screenInfo?.());
    const startCell = startInfo?.cell;

    await page.evaluate(() => window.hening?.idle?.());
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'dream', null, { timeout: WAIT_LONG });

    const captionText = await page.evaluate(() => document.querySelector('.dream-caption')?.textContent);
    if (!captionText || !captionText.toUpperCase().includes('MIMPI')) return `dream caption was "${captionText}", expected MIMPI`;

    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT_LONG });

    const endInfo = await page.evaluate(() => window.hening?.screenInfo?.());
    const endCell = endInfo?.cell;
    if (startCell && endCell && (startCell.r !== endCell.r || startCell.c !== endCell.c)) {
      return `player woke at [${endCell.r}, ${endCell.c}], expected [${startCell.r}, ${startCell.c}]`;
    }

    // 05: a dream long enough to light lanterns. The wake above comes before the first
    // one, so a throw on lighting (05's `playNote`, which stopped the frame loop) went unseen.
    await page.evaluate(() => window.hening.screen('dream', { room: 10 }));
    await page.waitForTimeout(15000);
    if (errors.length) return `console error while Mimpi played room 10: ${errors[0]}`;

    return true;
  });
  await page.close();
  return { ...r, errors };
}

/** 03.4: Paviliun → slot 1 → paint a small solvable room (script the clicks) → rules line reaches siap dicoba → coba → solve by script → back in the editor exactly → slot shows teruji → reload → still there. */
async function check03_4(browser, targetUrl) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const r = await check(async () => {
    await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.click('#start');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT });

    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'paviliun', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'garden', null, { timeout: WAIT });

    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'garden-editor', null, { timeout: WAIT });

    const solvable = ['#####', '#@$.#', '#####'];
    await page.evaluate((rows) => {
      const g = window.hening?.garden?.();
      g.slots[0] = { rows, tested: false };
      window.hening?.garden?.(g);
      window.hening?.screen?.('garden-editor', { slot: 0 });
    }, solvable);

    await page.waitForFunction(() => {
      const el = document.querySelector('.editor-rules-line');
      return el && el.textContent.includes('siap dicoba');
    }, null, { timeout: WAIT });

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: WAIT_LONG });

    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'results', null, { timeout: WAIT_LONG });

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'garden-editor', null, { timeout: WAIT_LONG });

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'garden', null, { timeout: WAIT });

    const firstPlaqueStatus = await page.evaluate(() => {
      const p = document.querySelector('.garden-plaque');
      return p ? p.querySelector('.plaque-status')?.textContent : null;
    });
    if (firstPlaqueStatus !== 'teruji') return `slot 1 status was "${firstPlaqueStatus}", expected "teruji"`;

    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    const gReloaded = await page.evaluate(() => window.hening?.garden?.());
    if (!gReloaded.slots[0]?.tested) return 'slot 1 was not saved as tested after reload';

    return true;
  });
  await page.close();
  return { ...r, errors };
}

/** 03.5: Steps 1 and 4 with storage disabled: no errors, forgotten on reload. */
async function check03_5(browser, targetUrl) {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  const errors = collectConsoleErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage disabled for QA');
      },
    });
  });

  const r = await check(async () => {
    await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.click('#start');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT });

    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'gerbang', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'gate-choice', null, { timeout: WAIT });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');

    await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT_LONG });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: WAIT_LONG });
    await page.evaluate(() => window.hening?.skipIntro?.());

    await page.evaluate(() => window.hening?.dupaLeft?.(3000));
    await page.waitForFunction(() => {
      const headline = document.querySelector('.card-veil .headline, .timeout-card .headline');
      return headline && headline.textContent.includes('dupa telah padam');
    }, null, { timeout: 10000 });

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.inspect?.()?.dupaLeft > 3000, null, { timeout: WAIT });

    await page.evaluate(() => window.hening?.arrange?.());
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'results', null, { timeout: WAIT_LONG });

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT_LONG });

    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'paviliun', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'garden', null, { timeout: WAIT });

    const solvable = ['#####', '#@$.#', '#####'];
    await page.evaluate((rows) => {
      const g = window.hening?.garden?.();
      g.slots[0] = { rows, tested: false };
      window.hening?.garden?.(g);
      window.hening?.screen?.('garden-editor', { slot: 0 });
    }, solvable);

    await page.waitForFunction(() => {
      const el = document.querySelector('.editor-rules-line');
      return el && el.textContent.includes('siap dicoba');
    }, null, { timeout: WAIT });

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: WAIT_LONG });

    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'results', null, { timeout: WAIT_LONG });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'garden-editor', null, { timeout: WAIT_LONG });

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'garden', null, { timeout: WAIT });

    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    const pReload = await page.evaluate(() => window.hening?.progress?.());
    const gReload = await page.evaluate(() => window.hening?.garden?.());

    if (pReload.open !== 1) return `progress was not forgotten (open was ${pReload.open}, expected 1)`;
    if (gReload.slots[0] !== null) return 'garden slot 0 was not forgotten on reload';

    return true;
  });

  await page.close();
  await context.close();
  return { ...r, errors };
}

async function measurePixelDiff(page, delayMs = 500) {
  const shotA = await page.screenshot();
  await page.waitForTimeout(delayMs);
  const shotB = await page.screenshot();

  return await page.evaluate(
    async ({ aBase64, bBase64 }) => {
      function loadImg(src) {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        });
      }
      const [imgA, imgB] = await Promise.all([
        loadImg('data:image/png;base64,' + aBase64),
        loadImg('data:image/png;base64,' + bBase64),
      ]);
      const canvas = document.createElement('canvas');
      canvas.width = imgA.width;
      canvas.height = imgA.height;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(imgA, 0, 0);
      const dataA = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      ctx.drawImage(imgB, 0, 0);
      const dataB = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let diffSum = 0;
      const n = dataA.length;
      for (let i = 0; i < n; i += 4) {
        diffSum +=
          Math.abs(dataA[i] - dataB[i]) +
          Math.abs(dataA[i + 1] - dataB[i + 1]) +
          Math.abs(dataA[i + 2] - dataB[i + 2]);
      }
      return diffSum / (canvas.width * canvas.height * 3);
    },
    { aBase64: shotA.toString('base64'), bBase64: shotB.toString('base64') },
  );
}

async function checkReducedMotion(browser, targetUrl) {
  const context = await browser.newContext({ viewport: DESKTOP, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = collectConsoleErrors(page);

  const r = await check(async () => {
    await page.goto(withParams(targetUrl, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.evaluate(() => {
      localStorage.setItem('hening.settings.v1', JSON.stringify({
        theme: 'lentera',
        mode: 'bebas',
        dupaMinutes: 20,
        volume: { master: 0.8, ambience: 0.6, notes: 0.8 },
        reducedMotion: 'on',
        hints: true,
      }));
    });
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);

    // 1. Courtyard
    await page.click('#start');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT });
    await page.waitForTimeout(1200);

    const courtyardDiff = await measurePixelDiff(page);
    say(`reduced-motion courtyard pixel diff: ${courtyardDiff.toFixed(5)}`);
    if (courtyardDiff > 0.05) return `courtyard frames differed by ${courtyardDiff.toFixed(4)} (threshold 0.05)`;

    // 2. Floor I
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'gerbang', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const c = window.hening?.current?.();
      return c?.top === 'gate-choice' || c?.base === 'elevator';
    }, null, { timeout: WAIT });
    if ((await page.evaluate(() => window.hening?.current?.()?.top)) === 'gate-choice') {
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    }
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'floor', null, { timeout: WAIT_LONG });
    await page.waitForTimeout(1200);

    const floorDiff = await measurePixelDiff(page);
    say(`reduced-motion floor pixel diff: ${floorDiff.toFixed(5)}`);
    if (floorDiff > 0.05) return `floor frames differed by ${floorDiff.toFixed(4)} (threshold 0.05)`;

    // 3. Room 6
    await page.goto(withParams(targetUrl, { room: 6, qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: WAIT_LONG });
    await page.waitForTimeout(1200);

    const room6Diff = await measurePixelDiff(page);
    say(`reduced-motion room 6 pixel diff: ${room6Diff.toFixed(5)}`);
    if (room6Diff > 0.05) return `room 6 frames differed by ${room6Diff.toFixed(4)} (threshold 0.05)`;

    return true;
  });

  await page.close();
  await context.close();
  return { ...r, errors };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const target = await resolveTarget(typeof flags.url === 'string' ? flags.url : undefined);
  const browser = await launchBrowser();

  console.log(`flow: target = ${target.url}`);
  say(`flow: target = ${target.url}`);

  const errorsByPage = {};

  // --- steps 1-9: one page, storage enabled ---
  const page = await browser.newPage({ viewport: DESKTOP });
  errorsByPage['steps 1-9'] = collectConsoleErrors(page);

  const steps1to5 = await playFromTitleThroughFloor1(page, target.url);
  steps1to5.forEach((s, i) => recordStep(i + 1, s.name, s.pass, s.reason));

  let r = await check(async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'elevator', null, { timeout: WAIT });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: WAIT_LONG });
    const cur = await page.evaluate(() => window.hening?.current?.());
    if (cur?.base !== 'courtyard') return `base was "${cur?.base}", not "courtyard"`;
    return true;
  });
  recordStep(6, 'Escape → elevator → skip → courtyard', r.pass, r.reason);

  r = await check(async () => {
    await page.keyboard.press('Digit3');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'batu', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'records', null, { timeout: WAIT });
    const rowText = await page.evaluate(() => {
      const list = Array.from(document.querySelectorAll('.rows .row'));
      const row = list.find((el) => el.querySelector('.room')?.textContent === 'ruang 01');
      return row ? row.textContent : null;
    });
    if (!rowText) return 'no row for "ruang 01" in the records card';
    if (!/\d+\s*langkah/.test(rowText)) return `row text "${rowText}" has no "<number> langkah"`;
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'courtyard', null, { timeout: WAIT });
    return true;
  });
  recordStep(7, "3 → Batu Catatan → records shows ruang 01's record → Escape → courtyard", r.pass, r.reason);

  r = await check(async () => {
    await page.keyboard.press('Digit4');
    await page.waitForFunction(() => window.hening?.screenInfo?.()?.place === 'kolam', null, { timeout: WAIT });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'settings', null, { timeout: WAIT });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    const s = await page.evaluate(() => window.hening?.settings?.());
    if (s?.volume?.master !== 0.6) return `settings().volume.master was ${s?.volume?.master}, not 0.6`;
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.hening?.current?.()?.top === 'courtyard', null, { timeout: WAIT });
    return true;
  });
  recordStep(8, '4 → Kolam → settings: ArrowDown + ArrowLeft×2 → volume.master = 0.6', r.pass, r.reason);

  r = await check(async () => {
    await page.goto(withParams(target.url, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page, 10000);
    const progress = await page.evaluate(() => window.hening?.progress?.());
    const solvedRoom1 = progress?.solved?.['1']?.bebas;
    if (!solvedRoom1) return 'progress.solved["1"].bebas is missing after reload';
    if (!(progress.open >= 2)) return `progress.open was ${progress.open}, expected >= 2`;
    const s = await page.evaluate(() => window.hening?.settings?.());
    if (s?.volume?.master !== 0.6) return `settings().volume.master after reload was ${s?.volume?.master}, not 0.6`;
    return true;
  });
  recordStep(9, 'reload ?qa=1: progress (room 1 solved, open ≥ 2) and settings (volume.master 0.6) kept', r.pass, r.reason);

  await page.close();

  // --- step 10: storage disabled ---
  const r10 = await step10(browser, target.url);
  recordStep(10, 'storage disabled (localStorage throws): repeat 1–5 with no console errors, reload → progress default (open === 1)', r10.pass, r10.reason);
  errorsByPage['step 10 (storage disabled)'] = r10.errors;

  // --- step 11: elevator ride up unskipped, ring lit on floor I ---
  const r11 = await step11(browser, target.url);
  recordStep(11, 'progress(solvedUpTo:9) → room 10 → arrange() → elevator up (unskipped) → floor II, ring I lit', r11.pass, r11.reason);
  errorsByPage['step 11'] = r11.errors;

  // --- step 12: the ending ---
  const r12 = await step12(browser, target.url);
  recordStep(12, 'progress(solvedUpTo:49) → room 50 → arrange() → results (only "naik") → elevator → ending → courtyard (≤ 40s)', r12.pass, r12.reason);
  errorsByPage['step 12'] = r12.errors;

  // --- prompt 03 flow checks ---
  const r13 = await check03_1(browser, target.url);
  recordStep(13, '03.1: gate → choice → dupa → room 1 → dupaLeft(3000) → wait → dupa telah padam → ulangi → arrange() → Batu Catatan shows time', r13.pass, r13.reason);
  errorsByPage['step 13 (dupa clock & records)'] = r13.errors;

  const r14 = await check03_2(browser, target.url);
  recordStep(14, '03.2: gate → tanpa batas → room 2 → helper opens, steps 5, closes → attempt unchanged → arrange() → assisted holds room 2, room 3 open', r14.pass, r14.reason);
  errorsByPage['step 14 (helper assisted)'] = r14.errors;

  const r15 = await check03_3(browser, target.url);
  recordStep(15, '03.3: courtyard 20s idle → Mimpi plays → any key wakes player at same tile', r15.pass, r15.reason);
  errorsByPage['step 15 (mimpi idle & wake)'] = r15.errors;

  const r16 = await check03_4(browser, target.url);
  recordStep(16, '03.4: Paviliun → slot 1 → paint solvable room → rules line siap dicoba → coba → solve → editor → slot teruji → reload keeps it', r16.pass, r16.reason);
  errorsByPage['step 16 (taman sendiri editor & coba)'] = r16.errors;

  const r17 = await check03_5(browser, target.url);
  recordStep(17, '03.5: 03.1 and 03.4 with storage disabled: no errors, forgotten on reload', r17.pass, r17.reason);
  errorsByPage['step 17 (storage disabled 03)'] = r17.errors;

  // --- step 18: reduced motion check (prompt 05 §2) ---
  const r18 = await checkReducedMotion(browser, target.url);
  recordStep(18, '05.2: reduced motion forced on → courtyard, floor, and room 6 idle consecutive frames diff < 0.05', r18.pass, r18.reason);
  errorsByPage['step 18 (reduced motion)'] = r18.errors;

  await browser.close();
  await target.close();

  // --- step 19: no console errors anywhere ---
  let anyErrors = false;
  const errorLines = [];
  for (const [label, errs] of Object.entries(errorsByPage)) {
    if (errs.length) {
      anyErrors = true;
      errorLines.push(`${label}: ${errs.join('; ')}`);
    }
  }
  recordStep(19, 'no console errors anywhere', !anyErrors, errorLines.join(' | '));

  // --- report ---
  const lines = [];
  lines.push('# flow report');
  lines.push('');
  lines.push(`Target: \`${target.url}\``);
  lines.push('');
  lines.push('| # | Step | Result | Reason |');
  lines.push('|---|---|---|---|');
  for (const row of rows) {
    lines.push(`| ${row.n} | ${row.name} | ${row.pass ? 'PASS' : 'FAIL'} | ${row.reason || '-'} |`);
  }
  lines.push('');
  lines.push('## Full log');
  lines.push('');
  lines.push('```');
  for (const l of log) lines.push(l);
  lines.push('```');

  const report = lines.join('\n');
  const outDir = scratchDir('flow');
  const outPath = path.join(outDir, 'flow.txt');
  fs.writeFileSync(outPath, report, 'utf8');

  console.log('');
  console.log('| # | Step | Result |');
  console.log('|---|---|---|');
  for (const row of rows) {
    console.log(`| ${row.n} | ${row.name} | ${row.pass ? 'PASS' : 'FAIL'}${row.reason ? ' — ' + row.reason : ''} |`);
  }
  console.log(`\nWritten to ${outPath}`);

  if (rows.some((r) => !r.pass)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('flow failed:', err);
  process.exit(1);
});
