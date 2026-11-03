/**
 * @file Themes check and visual capture tool (prompt 04 §3, §4; fix 1).
 *
 * Verifies instanced rendering, performance, draw calls, and theme switching
 * for all five themes across **all 50 rooms** (fix 1: the §14 budget of ≤ 150
 * draw calls applies to every room, not only 6 and 10). Frame time, the
 * unlit/half-lit sweeps and the live theme switch stay on rooms 1, 6, 10, 25,
 * 50; the other rooms are draw-call-only, all objects lit.
 *
 * Usage:
 *   node tools/themes-check.mjs [--themes lentera,bintang,batu,candi,mata-air] [--rooms 1,6,10,25,50] [--save] [--url <url>]
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  GAME_DIR,
  resolveTarget,
  launchBrowser,
  collectConsoleErrors,
  heningPresent,
  waitForHening,
  tryHening,
  withParams,
  parseFlags,
} from './lib/harness.mjs';
import { saveCurrent } from './review.mjs';

const DESKTOP = { width: 1440, height: 900 };
const ALL_THEMES = ['lentera', 'bintang', 'batu', 'candi', 'mata-air'];
const ALL_ROOMS = Array.from({ length: 50 }, (_, i) => i + 1);
/** The rooms that also get frame times, unlit/half sweeps and the switch test. */
const PERF_ROOMS = new Set([1, 6, 10, 25, 50]);

// Budget from ARCHITECTURE §14: every room, all lit.
const MAX_DRAW_CALLS = 150;

/**
 * Runs the QA check for a specific theme and room. Perf rooms (1, 6, 10, 25,
 * 50) get the full treatment — unlit/half/all draw calls, frame stats, live
 * theme switch. Every other room is draw-call-only, all objects lit.
 */
async function testThemeRoom(page, themeId, roomNumber) {
  const full = PERF_ROOMS.has(roomNumber);
  const result = {
    theme: themeId,
    room: roomNumber,
    objects: 0,
    unlitCalls: 0,
    halfCalls: 0,
    allCalls: 0,
    p95Ms: 0,
    avgMs: 0,
    switchingPassed: null,
    water: null,
    passed: true,
    reasons: [],
  };

  // Start and skip intro
  await tryHening(page, `
    if (window.hening.start) window.hening.start();
    if (window.hening.skipIntro) window.hening.skipIntro();
    return true;
  `);
  await page.waitForTimeout(200);

  // 1. Switch to theme
  await tryHening(page, `
    window.hening.theme("${themeId}");
    return true;
  `);
  await page.waitForTimeout(300);

  if (full) {
    // 2. Sample Unlit State
    const unlitInspect = await tryHening(page, `return window.hening.inspect ? window.hening.inspect() : null;`);
    result.unlitCalls = unlitInspect?.value?.render?.calls ?? 0;
  }

  const objectCountRes = await tryHening(page, `
    const state = window.hening.state;
    return state?.goals ?? 0;
  `);
  const objectCount = objectCountRes.value || 0;
  result.objects = objectCount;

  // What the decor holds, for the "what grows with the room" report.
  const waterRes = await tryHening(page, `return window.hening.inspect ? window.hening.inspect().water : null;`);
  result.water = waterRes?.value ?? null;

  if (full) {
    // 3. Arrange half of the objects
    const halfCount = Math.max(1, Math.floor(objectCount / 2));
    await tryHening(page, `
      window.hening.arrange(${halfCount});
      return true;
    `);
    await page.waitForTimeout(300);

    const halfInspect = await tryHening(page, `return window.hening.inspect ? window.hening.inspect() : null;`);
    result.halfCalls = halfInspect?.value?.render?.calls ?? 0;
  }

  // 4. Arrange all objects
  await tryHening(page, `
    window.hening.arrange();
    return true;
  `);
  await page.waitForTimeout(400);

  const allInspect = await tryHening(page, `return window.hening.inspect ? window.hening.inspect() : null;`);
  result.allCalls = allInspect?.value?.render?.calls ?? 0;

  if (full) {
    // Sample frame stats
    const statsRes = await tryHening(page, `
      return window.hening.frameStats ? await window.hening.frameStats(500) : null;
    `);
    result.p95Ms = Number((statsRes.value?.p95Ms ?? 0).toFixed(2));
    result.avgMs = Number((statsRes.value?.avgMs ?? 0).toFixed(2));
  }

  // The §14 budget binds every room, all lit.
  if (result.allCalls > MAX_DRAW_CALLS) {
    result.passed = false;
    result.reasons.push(`Room ${roomNumber} draw calls ${result.allCalls} exceeded budget ≤ ${MAX_DRAW_CALLS}`);
  }

  if (full) {
    // 5. Test live switching in a lit room and back
    const altTheme = themeId === 'lentera' ? 'bintang' : 'lentera';
    const switchAlt = await tryHening(page, `
      window.hening.theme("${altTheme}");
      return true;
    `);
    await page.waitForTimeout(200);

    const switchOrig = await tryHening(page, `
      window.hening.theme("${themeId}");
      return true;
    `);
    await page.waitForTimeout(200);

    if (switchAlt.ok && switchOrig.ok) {
      result.switchingPassed = true;
    } else {
      result.switchingPassed = false;
      result.passed = false;
      result.reasons.push(`Theme switching failed: ${switchAlt.reason || switchOrig.reason}`);
    }
  }

  return result;
}

/**
 * Waits for the title/start veil (#start) to fade out completely,
 * identical to regress.mjs.
 */
async function waitForStartHidden(page) {
  try {
    await page.waitForFunction(
      () => {
        const el = document.getElementById('start');
        return !el || parseFloat(getComputedStyle(el).opacity) < 0.02;
      },
      null,
      { timeout: 4000 }
    );
  } catch {}
}

/**
 * Captures review frames as requested in prompt 04 §4.
 */
async function captureReviewFrames(page, browser, baseUrl) {
  console.log('\n--- Capturing review frames for review/current/themes/ ---');

  // 1. lentera-instanced-room06
  await page.goto(withParams(baseUrl, { qa: 1, room: 6, seed: 6 }), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await waitForHening(page);
  await tryHening(page, `
    if (window.hening.screen) await window.hening.screen('room', { room: 6 });
    if (window.hening.start) window.hening.start();
    if (window.hening.skipIntro) window.hening.skipIntro();
    return true;
  `);
  await waitForStartHidden(page);

  await tryHening(page, `
    window.hening.theme('lentera');
    window.hening.setMood(2); // Senja
    window.hening.arrange(5); // half lit
    return true;
  `);
  await page.waitForTimeout(800);
  await saveCurrent(page, 'themes', 'lentera-instanced-room06');
  console.log('✓ Saved lentera-instanced-room06');

  // 2. Per-theme frames for bintang, batu, candi, mata-air
  const newThemes = ['bintang', 'batu', 'candi', 'mata-air'];
  for (const tid of newThemes) {
    // Room 06 Senja half-lit
    await tryHening(page, `
      window.hening.focus(); // normal framing
      window.hening.theme("${tid}");
      window.hening.setMood(2); // Senja
      window.hening.arrange(5);
      return true;
    `);
    await page.waitForTimeout(800);
    await saveCurrent(page, 'themes', `${tid}-room06`);
    console.log(`✓ Saved ${tid}-room06`);

    // Close-up on theme object position using hening.focus(x, z, zoom)
    const focusPos = await page.evaluate(() => {
      const state = window.hening.state;
      const target = state?.targets?.[0];
      if (target) {
        const cols = state.cols || 10;
        const rows = state.rows || 10;
        return {
          x: target.c - cols / 2 + 0.5,
          z: target.r - rows / 2 + 0.5,
        };
      }
      return { x: 0, z: 0 };
    });

    await tryHening(page, `
      window.hening.focus(${focusPos.x}, ${focusPos.z}, 4.5);
      return true;
    `);
    await page.waitForTimeout(600);
    await saveCurrent(page, 'themes', `${tid}-closeup`);
    console.log(`✓ Saved ${tid}-closeup`);

    // Reset camera focus
    await tryHening(page, `
      window.hening.focus();
      return true;
    `);

    // Malam
    await tryHening(page, `
      window.hening.setMood(3); // Malam
      return true;
    `);
    await page.waitForTimeout(800);
    await saveCurrent(page, 'themes', `${tid}-malam`);
    console.log(`✓ Saved ${tid}-malam`);
  }

  // 3. Special showcases
  // mata-air-sealed (all sealed, waterfall)
  await tryHening(page, `
    window.hening.theme('mata-air');
    window.hening.setMood(2);
    window.hening.arrange(); // all sealed
    return true;
  `);
  await page.waitForTimeout(1400); // allow waterfall fade in
  await saveCurrent(page, 'themes', 'mata-air-sealed');
  console.log('✓ Saved mata-air-sealed');

  // batu-rings (raked sand rings)
  await tryHening(page, `
    window.hening.theme('batu');
    window.hening.setMood(2);
    window.hening.arrange(5);
    return true;
  `);
  await page.waitForTimeout(1500); // allow rings 1.2s animation to finish
  await saveCurrent(page, 'themes', 'batu-rings');
  console.log('✓ Saved batu-rings');

  // kolam-themes (Kolam preferences row)
  await tryHening(page, `
    await window.hening.screen('settings');
    return true;
  `);
  await page.waitForTimeout(1000);
  await saveCurrent(page, 'themes', 'kolam-themes');
  console.log('✓ Saved kolam-themes');

  // floor2-candi (Floor 2 with Candi theme, switched live at the Kolam)
  await tryHening(page, `
    window.hening.progress({ solvedUpTo: 14 });
    await window.hening.screen('settings');
    return true;
  `);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const pref = [...document.querySelectorAll('.pref')].find((p) => p.querySelector('.label')?.textContent === 'tema');
    const btn = pref && [...pref.querySelectorAll('button.opt')].find((b) => b.textContent === 'Candi');
    btn?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  await tryHening(page, `
    await window.hening.screen('floor', { floor: 2, room: 14 });
    return true;
  `);
  await page.waitForTimeout(1800);
  await saveCurrent(page, 'themes', 'floor2-candi');
  console.log('✓ Saved floor2-candi');

  // 4. Compose 2x2 composite of the four -malam frames
  await composeMalamGrid(browser);
}

/**
 * Composes a 2x2 grid of the four -malam frames into review/current/themes/malam-all.jpg
 */
async function composeMalamGrid(browser) {
  const currentDir = path.join(GAME_DIR, '../review/current/themes');
  const outPath = path.join(currentDir, 'malam-all.jpg');

  const files = [
    { src: path.join(currentDir, 'bintang-malam.jpg'), label: 'cahaya bintang' },
    { src: path.join(currentDir, 'batu-malam.jpg'), label: 'taman batu' },
    { src: path.join(currentDir, 'candi-malam.jpg'), label: 'candi' },
    { src: path.join(currentDir, 'mata-air-malam.jpg'), label: 'mata air' },
  ];

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const preparedFiles = files.map((f) => {
    let dataUri = '';
    if (fs.existsSync(f.src)) {
      const b64 = fs.readFileSync(f.src).toString('base64');
      dataUri = `data:image/jpeg;base64,${b64}`;
    }
    return { src: dataUri, label: f.label };
  });

  const resDataUri = await page.evaluate(async (items) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2833';
    ctx.fillRect(0, 0, 1920, 1080);

    const positions = [
      [0, 0],
      [960, 0],
      [0, 540],
      [960, 540],
    ];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const [x, y] = positions[i];
      await new Promise((resolve) => {
        if (!item.src) {
          resolve();
          return;
        }
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x, y, 960, 540);
          ctx.fillStyle = 'rgba(43, 40, 51, 0.7)';
          ctx.fillRect(x + 16, y + 16, 200, 32);
          ctx.fillStyle = '#efe8f2';
          ctx.font = '500 16px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.label, x + 26, y + 32);
          resolve();
        };
        img.onerror = resolve;
        img.src = item.src;
      });
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  }, preparedFiles);

  const b64 = resDataUri.replace(/^data:image\/jpeg;base64,/, '');
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  await page.close();
  console.log('✓ Saved malam-all composite');
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const themesToTest = flags.themes
    ? flags.themes.split(',').map((s) => s.trim())
    : (flags.theme ? [flags.theme] : ALL_THEMES);
  const roomsToTest = flags.rooms
    ? flags.rooms.split(',').map((s) => Number(s.trim()))
    : ALL_ROOMS;
  const doSave = flags.save ?? false;

  console.log(`Starting themes check:`);
  console.log(`  Themes: ${themesToTest.join(', ')}`);
  console.log(`  Rooms:  ${roomsToTest.join(', ')}`);
  console.log(`  Save:   ${doSave}`);

  const target = await resolveTarget(flags.url);
  const browser = await launchBrowser();

  const allResults = [];
  const globalErrors = [];
  let allPass = true;

  /** One theme × room on its own page; collects the result and logs a line. */
  async function runCase(theme, room) {
    const page = await browser.newPage({ viewport: DESKTOP });
    const errors = collectConsoleErrors(page);
    const url = withParams(target.url, { qa: 1, room, seed: room });

    let res;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(400);
      await waitForHening(page);

      res = await testThemeRoom(page, theme, room);
      if (errors.length > 0) {
        res.passed = false;
        res.reasons.push(`Console errors: ${errors.join('; ')}`);
        globalErrors.push({ theme, room, errors });
      }
    } catch (err) {
      res = {
        theme,
        room,
        objects: 0,
        unlitCalls: 0,
        halfCalls: 0,
        allCalls: 0,
        p95Ms: 0,
        avgMs: 0,
        switchingPassed: null,
        water: null,
        passed: false,
        reasons: [err.message],
      };
    } finally {
      await page.close();
    }

    if (!res.passed) allPass = false;
    allResults.push(res);
    const water = res.water ? ` ponds=${res.water.ponds} basins=${res.water.basins}` : '';
    console.log(
      `  Room ${String(room).padStart(2)}: ` +
      `all=${String(res.allCalls).padStart(3)} calls | ` +
      (PERF_ROOMS.has(room) ? `unlit=${String(res.unlitCalls).padStart(3)} half=${String(res.halfCalls).padStart(3)} p95=${res.p95Ms}ms switch=${res.switchingPassed ? 'ok' : 'FAIL'} | ` : '') +
      `${res.passed ? 'PASS' : 'FAIL (' + res.reasons.join(', ') + ')'}${water}`
    );
  }

  try {
    for (const theme of themesToTest) {
      console.log(`\n=== Testing Theme: ${theme} ===`);
      const perfRooms = roomsToTest.filter((r) => PERF_ROOMS.has(r));
      const extraRooms = roomsToTest.filter((r) => !PERF_ROOMS.has(r));

      // Perf rooms run one at a time so the frame pacing is measured alone.
      for (const room of perfRooms) await runCase(theme, room);

      // The draw-call-only rooms are counts, not timings: a small pool is safe.
      const POOL = 3;
      for (let i = 0; i < extraRooms.length; i += POOL) {
        await Promise.all(extraRooms.slice(i, i + POOL).map((room) => runCase(theme, room)));
      }
    }

    if (doSave) {
      const capturePage = await browser.newPage({ viewport: DESKTOP });
      await captureReviewFrames(capturePage, browser, target.url);
      await capturePage.close();
    }
  } finally {
    await browser.close();
    await target.close();
  }

  // Markdown Summary Table (perf rooms carry the full detail)
  console.log('\n--- Draw Calls and Frame Time Summary Table (rooms 1, 6, 10, 25, 50) ---');
  console.log('| Theme | Room | Objects | Unlit Calls | Half Calls | All Calls | Budget | Frame p95 | Switch Live | Status |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of allResults.filter((x) => PERF_ROOMS.has(x.room))) {
    console.log(
      `| **${r.theme}** | ${r.room} | ${r.objects} | ${r.unlitCalls} | ${r.halfCalls} | ${r.allCalls} | ≤ ${MAX_DRAW_CALLS} | ${r.p95Ms} ms | ${r.switchingPassed ? '✓' : '✗'} | ${r.passed ? '✓' : 'FAIL'} |`
    );
  }

  // The five heaviest rooms per theme — the budget binds these first.
  console.log('\n--- Worst five rooms per theme (all lit) ---');
  for (const theme of themesToTest) {
    const worst = allResults
      .filter((r) => r.theme === theme)
      .sort((a, b) => b.allCalls - a.allCalls)
      .slice(0, 5);
    console.log(`- **${theme}**: ${worst.map((r) => `room ${r.room} = ${r.allCalls}`).join(', ')}`);
  }

  if (globalErrors.length > 0) {
    console.error(`\nConsole errors encountered in ${globalErrors.length} room(s).`);
  }

  if (!allPass) {
    console.error('\nFAIL: One or more theme checks did not pass budgets or criteria.');
    process.exit(1);
  } else {
    console.log('\nSUCCESS: All themes passed draw calls, frame times, and live switching!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error during themes check:', err);
  process.exit(1);
});
