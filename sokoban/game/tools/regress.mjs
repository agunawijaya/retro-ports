/**
 * @file Regression against the reference (prompt 01 §4). Drives both the
 * reference (`reference/index.html`) and the game through the **same call
 * sequences and timings** `tools/shoot-reference.mjs` uses for its 18
 * quality-bar frames (thanks to `level(0..2)` the rooms match on both
 * sides), freezing time where the reference frame is static, and writes a
 * game frame plus a labelled side-by-side composite for each into
 * `.scratch/<name>/`. It then saves the latest game frames with
 * `saveCurrent` (default: to `review/current/room/<state>.jpg`, for every
 * name the prompt lists: the 18 shared names, plus `room01`, `room25`,
 * `room50`, `phone-room06` (390x844) and `room01-arrival` (caught on the
 * stepping stones, for "game · ruang 01 kedatangan"), which have no
 * reference equivalent and are rendered game-side only).
 *
 * Fix 1 (prompt 04): the game side reaches every room through the router
 * first (`hening.screen('room', { room: N })`), so the frames show the room
 * screen with its HUD — never the title or courtyard the tower-world-only
 * `level(i)` used to leave on screen.
 *
 * Usage:
 *   node tools/regress.mjs [--url <override>] [--only gate,stranger]
 *     [--no-ref] [--scratch <name>] [--save-target <dir>] [--save-prefix <p>]
 *
 * `--url` overrides the **game** side (normally a throwaway Vite dev server
 * for `game/`); the reference side always loads `reference/index.html`
 * directly. Pointing `--url` at `reference/index.html` itself therefore runs
 * the same 18 calls on the reference API on both sides - the way to prove
 * this tool's call sequences and compositing work before the game's room
 * screen (prompt 01) exists. `--only` limits which named frames are
 * rendered and saved (the preceding state-setting calls still run, since
 * mood/position state is cumulative across the sequence). `--no-ref` skips
 * the reference page entirely (no ref frames, no composites) for trees that
 * do not carry `reference/`. `--scratch` names the output folder under
 * `.scratch/` (default `regress`). `--save-target`/`--save-prefix` redirect
 * the `saveCurrent` writes (e.g. `--save-target themes --save-prefix
 * lentera-instanced-` keeps an instanced render next to the approved set
 * instead of overwriting it).
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  resolveTarget,
  launchBrowser,
  collectConsoleErrors,
  seedRandom,
  heningPresent,
  waitForHening,
  tryHening,
  withParams,
  parseFlags,
} from './lib/harness.mjs';
import { composeSideBySide } from './lib/composite.mjs';
import { paths, scratchDir, saveCurrent } from './review.mjs';

const REF_HTML = path.join(paths.root, 'reference/index.html');
const REF_URL = 'file:///' + REF_HTML.replace(/\\/g, '/');

const SEED = 7;
const DESKTOP = { width: 1920, height: 1080 };
const PHONE = { width: 390, height: 844 };

/**
 * Runs an evaluate body on a page, guarding for a missing `window.hening` or
 * a missing specific call so one unsupported hook does not abort the whole
 * sequence. Returns the reason string on failure, or null on success.
 */
async function step(page, body, label, notes) {
  const present = await heningPresent(page);
  if (!present) {
    notes.push(`${label}: window.hening not present`);
    return false;
  }
  const result = await tryHening(page, body);
  if (!result.ok) {
    notes.push(`${label}: ${result.reason}`);
    return false;
  }
  return true;
}

/**
 * Waits for the "ketuk untuk mulai" start veil (`#start`, `hud.js`) to finish
 * its CSS fade-out after `hening.start()` is called. The veil's own fade
 * takes 1.4s (`hud.css` `.veil { transition: opacity 1.4s ease; }`); a fixed
 * `waitForTimeout` of a few hundred ms raced it under headless/SwiftShader
 * load (room01, room25, room50, phone-room06 and room01-arrival all caught
 * it still mid-fade, a faint giant "Hening" watermark baked into the frame -
 * `review/prompts/04-themes-fix-2/`). Polling the computed opacity instead
 * of guessing a wait time is robust to that load, whatever causes it.
 */
async function waitForStartHidden(page, notes, label) {
  try {
    await page.waitForFunction(
      () => {
        const el = document.getElementById('start');
        return !el || parseFloat(getComputedStyle(el).opacity) < 0.02;
      },
      null,
      { timeout: 4000 }
    );
  } catch {
    notes.push(`${label}: start veil did not finish fading out within 4000ms`);
  }
}

/** Freezes time if the page implements `freezeTime` (the reference does not). */
async function freeze(page, on, notes, label) {
  const present = await heningPresent(page);
  if (!present) return;
  await tryHening(page, `if (window.hening.freezeTime) { window.hening.freezeTime(${on}); } return true;`);
}

/**
 * The 18 shoot-reference.mjs frames, as { name, setup(page, notes), wait, freeze } steps.
 * `setup` performs the state-changing calls; `wait` is the settle timeout (ms)
 * shoot-reference.mjs used after that step; `freeze` marks a truly static
 * instant (scrub checkpoints, focused life-in-the-room shots).
 *
 * `navRoom` (fix 1): the room the **game** side enters through the router
 * before `setup` runs (`hening.screen('room', { room: N })`, N = 5 + the old
 * `level(i)` index). The reference has no router and keeps its own `level(i)`
 * call inside `setup`. `gameSetup` replaces `setup` on the game side only
 * (arrival: the router's own intro plays the walk-in, and `level(1)` would
 * cancel it).
 */
function buildSequence() {
  return [
    {
      name: 'room06-fajar',
      freeze: false,
      wait: 1500,
      navRoom: 6,
      setup: (page, notes) => step(page, 'window.hening.level(1); window.hening.skipIntro(); window.hening.arrange(4); window.hening.setMood(0); return true;', 'room06-fajar', notes),
    },
    { name: 'room06-siang', freeze: false, wait: 1500, setup: (page, notes) => step(page, 'window.hening.setMood(1); return true;', 'room06-siang', notes) },
    { name: 'room06-senja', freeze: false, wait: 1500, setup: (page, notes) => step(page, 'window.hening.setMood(2); return true;', 'room06-senja', notes) },
    { name: 'room06-malam', freeze: false, wait: 1500, setup: (page, notes) => step(page, 'window.hening.setMood(3); return true;', 'room06-malam', notes) },
    {
      name: 'room07-senja',
      freeze: false,
      wait: 1500,
      navRoom: 7,
      setup: (page, notes) => step(page, 'window.hening.level(2); window.hening.skipIntro(); window.hening.setMood(2); return true;', 'room07-senja', notes),
    },
    {
      name: 'scrub-walk',
      freeze: true,
      wait: 200,
      navRoom: 6,
      setup: (page, notes) =>
        step(
          page,
          'window.hening.level(1); window.hening.skipIntro(); window.hening.setMood(0); window.hening.closeUp(5); window.hening.face(1); window.hening.scrub("walk", 0.5, 0); return true;',
          'scrub-walk',
          notes
        ),
    },
    { name: 'scrub-run', freeze: true, wait: 200, setup: (page, notes) => step(page, 'window.hening.scrub("run", 0.5, 1); return true;', 'scrub-run', notes) },
    { name: 'scrub-push', freeze: true, wait: 200, setup: (page, notes) => step(page, 'window.hening.scrub("push", 0.25, 0); return true;', 'scrub-push', notes) },
    { name: 'scrub-protest-up', freeze: true, wait: 200, setup: (page, notes) => step(page, 'window.hening.scrub("protest", 1.75); return true;', 'scrub-protest-up', notes) },
    { name: 'scrub-look-left', freeze: true, wait: 200, setup: (page, notes) => step(page, 'window.hening.scrub("look", 1.2); return true;', 'scrub-look-left', notes) },
    { name: 'scrub-meditate', freeze: true, wait: 200, setup: (page, notes) => step(page, 'window.hening.scrub("meditate", 3); return true;', 'scrub-meditate', notes) },
    { name: 'scrub-bow', freeze: true, wait: 200, setup: (page, notes) => step(page, 'window.hening.scrub("bow", 1.3); return true;', 'scrub-bow', notes) },
    {
      name: 'gate',
      freeze: true,
      wait: 500,
      navRoom: 6,
      setup: (page, notes) =>
        step(
          page,
          'window.hening.scrub(null); window.hening.closeUp(1); window.hening.level(1); window.hening.skipIntro(); const gate = window.hening.decor.gate; if (gate && gate.group) window.hening.focus(gate.group.position.x, gate.group.position.z, 3.8); return true;',
          'gate',
          notes
        ),
    },
    {
      name: 'stranger',
      freeze: true,
      wait: 500,
      setup: (page, notes) =>
        step(
          page,
          'const stranger = window.hening.decor.stranger; if (stranger && stranger.root) window.hening.focus(stranger.root.position.x, stranger.root.position.z, 4.2); return true;',
          'stranger',
          notes
        ),
    },
    {
      name: 'basin',
      freeze: true,
      wait: 500,
      setup: (page, notes) =>
        step(
          page,
          'const basin = window.hening.decor.basins[0]; if (basin && basin.cells && basin.cells.length > 0) { const c = basin.cells[0]; const x = c.c - 11 / 2 + 0.5; const z = c.r - 11 / 2 + 0.5; window.hening.focus(x, z, 4.2); } return true;',
          'basin',
          notes
        ),
    },
    {
      name: 'fountain',
      freeze: true,
      wait: 600,
      navRoom: 7,
      setup: (page, notes) =>
        step(
          page,
          'window.hening.level(2); window.hening.skipIntro(); window.hening.setMood(1); const pondWithFountain = window.hening.decor.ponds.find((p) => p.fountain); if (pondWithFountain && pondWithFountain.fountain) { const pos = pondWithFountain.fountain.group.position; window.hening.focus(pos.x, pos.z, 4.2); } return true;',
          'fountain',
          notes
        ),
    },
    {
      name: 'finale',
      freeze: false,
      wait: 4500,
      navRoom: 6,
      setup: (page, notes) =>
        step(
          page,
          'window.hening.focus(); window.hening.closeUp(1); window.hening.level(1); window.hening.skipIntro(); window.hening.setMood(0); window.hening.arrange(); return true;',
          'finale',
          notes
        ),
    },
    {
      name: 'arrival',
      freeze: false,
      wait: 2500,
      reload: true,
      navRoom: 6,
      // Game side: the router's own arrival plays the walk-in; level(1) would cancel it.
      gameSetup: (page, notes) => step(page, 'window.hening.start(); return true;', 'arrival', notes),
      setup: (page, notes) => step(page, 'window.hening.level(1); window.hening.start(); return true;', 'arrival', notes),
    },
  ];
}

/**
 * Game-only extra renders (no reference equivalent): room01, room25, room50,
 * phone-room06 (start() + skipIntro(), so the veil is gone and the wanderer
 * stands at the start) and room01-arrival (start() only, no skipIntro - the
 * wanderer is caught walking in on the stepping stones after `wait` ms, for
 * the prompt's "game · ruang 01 kedatangan" sheet cell).
 */
function buildExtras() {
  return [
    { name: 'room01', viewport: DESKTOP, room: 1, skipIntro: true, wait: 500 },
    { name: 'room25', viewport: DESKTOP, room: 25, skipIntro: true, wait: 500 },
    { name: 'room50', viewport: DESKTOP, room: 50, skipIntro: true, wait: 500 },
    { name: 'phone-room06', viewport: PHONE, room: 6, skipIntro: true, wait: 500 },
    { name: 'room01-arrival', viewport: DESKTOP, room: 1, skipIntro: false, wait: 2500 },
  ];
}

async function openPage(browser, url, viewport, panelHide) {
  const page = await browser.newPage({ viewport });
  const errors = collectConsoleErrors(page);
  await seedRandom(page, SEED);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
    // file:// reference pages are fine with 'load'; dev-server pages may never go idle
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  });
  await waitForHening(page);
  if (panelHide) {
    await page.evaluate(() => {
      const panel = document.getElementById('panel');
      if (panel) panel.classList.add('hidden');
    }).catch(() => {});
  }
  return { page, errors };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const only = typeof flags.only === 'string' ? new Set(flags.only.split(',').map((s) => s.trim())) : null;
  const noRef = flags['no-ref'] ?? false;
  const saveTarget = typeof flags['save-target'] === 'string' ? flags['save-target'] : 'room';
  const savePrefix = typeof flags['save-prefix'] === 'string' ? flags['save-prefix'] : '';
  const SCRATCH_DIR = scratchDir(typeof flags.scratch === 'string' ? flags.scratch : 'regress');

  const target = await resolveTarget(typeof flags.url === 'string' ? flags.url : undefined);
  const gameBaseUrl = withParams(target.url, { qa: 1, seed: SEED });

  if (!noRef) console.log(`regress: reference = ${REF_URL}`);
  else console.log('regress: --no-ref, the reference side is skipped');
  console.log(`regress: game target = ${gameBaseUrl}`);
  if (typeof flags.url === 'string' && flags.url.includes('reference/index.html')) {
    console.log('regress: --url points at the reference itself - both sides are the reference, proving the call sequence on the real API.');
  }

  const browser = await launchBrowser();

  let refPage = null;
  const refErrors = [];
  if (!noRef) {
    const opened = await openPage(browser, REF_URL, DESKTOP, true);
    refPage = opened.page;
    refErrors.push(...opened.errors);
    await step(refPage, 'window.hening.start(); window.hening.skipIntro(); return true;', 'ref-boot', refErrors);
  }
  const { page: gamePage, errors: gameErrors } = await openPage(browser, gameBaseUrl, DESKTOP, true);
  await step(gamePage, 'if (window.hening.start) window.hening.start(); if (window.hening.skipIntro) window.hening.skipIntro(); return true;', 'game-boot', gameErrors);

  const sequence = buildSequence();
  const savedStates = [];
  const notes = [];

  for (const frame of sequence) {
    if (frame.reload) {
      // arrival: reload both pages before re-running start(). window.hening is
      // installed by a dynamic import of dev/qa.js, so it can still be
      // attaching after 'load'/'networkidle' fire on a reload (the module is
      // cached, no network wait to cover it) - wait for it explicitly before
      // the next calls, the same way openPage() does on the first load.
      if (refPage) {
        await refPage.reload({ waitUntil: 'networkidle' }).catch(() => refPage.reload({ waitUntil: 'load' }));
        await waitForHening(refPage);
        await refPage.evaluate(() => {
          const panel = document.getElementById('panel');
          if (panel) panel.classList.add('hidden');
        }).catch(() => {});
      }
      await gamePage.reload({ waitUntil: 'networkidle' }).catch(() => gamePage.reload({ waitUntil: 'load' }));
      await waitForHening(gamePage);
    }

    const refNotes = [];
    const gameNotes = [];

    // Fix 1: the game side enters the room through the router first, so the
    // frame shows the room screen (HUD and all), not the title/courtyard the
    // tower-world-only level(i) left active.
    if (frame.navRoom) {
      const nav = await tryHening(gamePage, `await window.hening.screen('room', { room: ${frame.navRoom} }); return true;`);
      if (!nav.ok) gameNotes.push(`${frame.name}: router nav to room ${frame.navRoom} failed: ${nav.reason}`);
    }

    if (refPage) await frame.setup(refPage, refNotes);
    await (frame.gameSetup ?? frame.setup)(gamePage, gameNotes);
    // A no-op once the start veil is already hidden; guards the frames that
    // call `hening.start()` themselves (arrival) the same way the extras do.
    await waitForStartHidden(gamePage, gameNotes, frame.name);

    // Evidence the router and the HUD agree on where the game is.
    const where = await tryHening(
      gamePage,
      'const c = window.hening.current ? window.hening.current() : null; const i = window.hening.inspect ? window.hening.inspect() : null; return { base: c && c.base, room: i && i.room };'
    );
    if (where.ok && where.value) gameNotes.push(`router=${where.value.base}, room=${where.value.room}`);

    if (frame.freeze) {
      if (refPage) await freeze(refPage, true, refNotes, frame.name);
      await freeze(gamePage, true, gameNotes, frame.name);
    }

    if (refPage) await refPage.waitForTimeout(frame.wait);
    await gamePage.waitForTimeout(frame.wait);

    const include = !only || only.has(frame.name);
    if (include) {
      const gameShot = path.join(SCRATCH_DIR, `${frame.name}-game.jpg`);
      await gamePage.screenshot({ path: gameShot, type: 'jpeg', quality: 90 });

      if (refPage) {
        const refShot = path.join(SCRATCH_DIR, `${frame.name}-ref.jpg`);
        await refPage.screenshot({ path: refShot, type: 'jpeg', quality: 90 });
        const compositePath = path.join(SCRATCH_DIR, `${frame.name}-composite.jpg`);
        await composeSideBySide(browser, refShot, gameShot, frame.name, compositePath);
      }

      await saveCurrent(gamePage, saveTarget, savePrefix + frame.name);
      savedStates.push(savePrefix + frame.name);
    }

    if (frame.freeze) {
      if (refPage) await freeze(refPage, false, refNotes, frame.name);
      await freeze(gamePage, false, gameNotes, frame.name);
    }

    notes.push({ name: frame.name, ref: refNotes, game: gameNotes });
  }

  await refPage?.close();

  // --- Game-only extras: room01, room25, room50, phone-room06, room01-arrival ---
  for (const extra of buildExtras()) {
    if (only && !only.has(extra.name)) continue;
    const url = withParams(target.url, { qa: 1, room: extra.room, seed: extra.room });
    const page = await browser.newPage({ viewport: extra.viewport });
    const errs = collectConsoleErrors(page);
    await seedRandom(page, SEED);
    const extraNotes = [];
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await waitForHening(page);
      await step(
        page,
        `window.hening.start(); ${extra.skipIntro ? 'window.hening.skipIntro();' : ''} return true;`,
        extra.name,
        extraNotes
      );
      // The qa room shortcut (`main.js`) shows the start veil at boot, same as
      // the title screen does - `hening.start()` above hides it, but the
      // fade takes 1.4s and must finish before the screenshot.
      await waitForStartHidden(page, extraNotes, extra.name);
      await page.waitForTimeout(extra.wait);
    } catch (err) {
      extraNotes.push(String(err && err.message ? err.message : err));
    }
    const gameShot = path.join(SCRATCH_DIR, `${extra.name}-game.jpg`);
    await page.screenshot({ path: gameShot, type: 'jpeg', quality: 90 });
    await saveCurrent(page, saveTarget, savePrefix + extra.name);
    savedStates.push(savePrefix + extra.name);
    notes.push({ name: extra.name, ref: ['no reference equivalent - game only'], game: [...extraNotes, ...errs.map((e) => `console: ${e}`)] });
    await page.close();
  }

  await gamePage.close();
  await browser.close();
  await target.close();

  // --- Report ---
  const lines = [];
  lines.push('# regress notes');
  lines.push('');
  lines.push(`Reference: ${noRef ? 'skipped (--no-ref)' : REF_URL}`);
  lines.push(`Game target: \`${gameBaseUrl}\``);
  lines.push('');
  lines.push(`Saved states (review/current/${saveTarget}/<state>.jpg): ${savedStates.join(', ')}`);
  lines.push('');
  lines.push('| Frame | ref notes | game notes |');
  lines.push('|---|---|---|');
  for (const n of notes) {
    lines.push(`| ${n.name} | ${n.ref.join('; ') || '-'} | ${n.game.join('; ') || '-'} |`);
  }
  const reportPath = path.join(SCRATCH_DIR, 'notes.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(lines.join('\n'));
  console.log(`\nWritten to ${reportPath}`);
  console.log(`Composites and game frames under ${SCRATCH_DIR}`);

  const anyConsoleError = refErrors.length > 0 || gameErrors.length > 0;
  if (anyConsoleError) {
    console.error('Console errors:', { ref: refErrors, game: gameErrors });
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('regress failed:', err);
  process.exit(1);
});
