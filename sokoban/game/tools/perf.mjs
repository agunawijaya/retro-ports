/**
 * @file Perf check (prompt 01 §3, extended by prompt 02 §10 /
 * `briefs/02-tower-checks.md`). Measures room 6 with all objects lit
 * (`arrange()`, wait for the results phase, then measure), the largest room
 * by floor-cell count, read from `src/data/rooms.generated.json`, the title
 * (the whole tower, every floor lit), and a fully-lit floor. Reports average
 * and p95 frame ms and draw calls against the §14 budgets.
 *
 * The title and floor scenes use `window.hening.renderStats()`
 * (`dev/qa.js`, prompt 02 §10) rather than `inspect().render`, since `title`
 * and `floor` don't carry a room-world `inspect()` of their own — the draw
 * calls still come from the one shared renderer either way.
 *
 * Usage:
 *   node tools/perf.mjs [--url <override>]
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  GAME_DIR,
  resolveTarget,
  launchBrowser,
  collectConsoleErrors,
  heningPresent,
  tryHening,
  withParams,
  parseFlags,
} from './lib/harness.mjs';
import { scratchDir } from './review.mjs';

const DESKTOP = { width: 1440, height: 900 };
const SAMPLE_MS = 2000;
const RESULTS_TIMEOUT_MS = 20000;

const BUDGET = {
  frameMs: 8, // CPU+GPU, 60 fps
  drawCalls: 150,
};

/**
 * Finds the room with the most floor cells (inside and not a wall) in
 * `rooms.generated.json`, using the same `parseLevel` the game's core and
 * `review.mjs`'s schematic renderer use.
 * @returns {Promise<{ number: number, floorCells: number }>}
 */
async function findLargestRoom() {
  const roomsFile = path.join(GAME_DIR, 'src/data/rooms.generated.json');
  const { parseLevel } = await import('../src/core/level.js');
  const data = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));

  let best = null;
  for (const room of data.rooms) {
    const level = parseLevel(room.rows);
    let floorCells = 0;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (level.inside[r][c] && !level.wall[r][c]) floorCells++;
      }
    }
    if (!best || floorCells > best.floorCells) {
      best = { number: room.number, floorCells };
    }
  }
  return best;
}

/**
 * Loads a room, optionally lights it with `arrange()` and waits for the
 * results phase, then samples `frameStats()` and `inspect().render`.
 * @returns {Promise<object>}
 */
async function measureRoom(browser, baseUrl, room, { lightUp }) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const url = withParams(baseUrl, { qa: 1, room, seed: room });

  const out = { room, lightUp, navError: null, present: false, frameStats: null, render: null, reasons: [] };

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(300);
  } catch (err) {
    out.navError = String(err && err.message ? err.message : err);
    await page.close();
    return { ...out, errors };
  }

  out.present = await heningPresent(page);
  if (!out.present) {
    out.reasons.push('window.hening not present');
    await page.close();
    return { ...out, errors };
  }

  if (lightUp) {
    const arranged = await tryHening(page, 'if (!window.hening.arrange) throw new Error("arrange() not implemented"); if (window.hening.skipIntro) window.hening.skipIntro(); window.hening.arrange(); return true;');
    if (!arranged.ok) {
      out.reasons.push(`arrange(): ${arranged.reason}`);
    } else {
      try {
        await page.waitForFunction(
          () => window.hening && window.hening.inspect && window.hening.inspect().phase === 'results',
          null,
            { timeout: RESULTS_TIMEOUT_MS }
        );
      } catch (err) {
        out.reasons.push(`did not reach results within ${RESULTS_TIMEOUT_MS}ms: ${err.message}`);
      }
    }
  }

  const frameStats = await tryHening(page, `return window.hening.frameStats ? await window.hening.frameStats(${SAMPLE_MS}) : Promise.reject(new Error("frameStats() not implemented"));`);
  if (frameStats.ok) {
    out.frameStats = frameStats.value;
  } else {
    out.reasons.push(`frameStats(): ${frameStats.reason}`);
  }

  const inspect = await tryHening(page, 'return window.hening.inspect ? window.hening.inspect() : Promise.reject(new Error("inspect() not implemented"));');
  if (inspect.ok) {
    out.render = inspect.value?.render ?? null;
  } else {
    out.reasons.push(`inspect(): ${inspect.reason}`);
  }

  await page.close();
  return { ...out, errors };
}

/**
 * Loads `?qa=1` (boots to the title), runs `setupBody` (a `window.hening`
 * call, as a string body for `tryHening`), waits `waitMs` if given, then
 * samples `frameStats()` and `renderStats()`.
 * @param {string} label
 * @param {string} setupBody
 * @param {number} waitMs
 * @returns {Promise<object>}
 */
async function measureScreen(browser, baseUrl, label, setupBody, waitMs) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const url = withParams(baseUrl, { qa: 1 });

  const out = { label, navError: null, present: false, frameStats: null, render: null, reasons: [] };

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(300);
  } catch (err) {
    out.navError = String(err && err.message ? err.message : err);
    await page.close();
    return { ...out, errors };
  }

  out.present = await heningPresent(page);
  if (!out.present) {
    out.reasons.push('window.hening not present');
    await page.close();
    return { ...out, errors };
  }

  const setup = await tryHening(page, setupBody);
  if (!setup.ok) out.reasons.push(`setup: ${setup.reason}`);
  if (waitMs) await page.waitForTimeout(waitMs);

  const frameStats = await tryHening(page, `return window.hening.frameStats ? await window.hening.frameStats(${SAMPLE_MS}) : Promise.reject(new Error("frameStats() not implemented"));`);
  if (frameStats.ok) {
    out.frameStats = frameStats.value;
  } else {
    out.reasons.push(`frameStats(): ${frameStats.reason}`);
  }

  const renderStats = await tryHening(page, 'return window.hening.renderStats ? window.hening.renderStats() : Promise.reject(new Error("renderStats() not implemented"));');
  if (renderStats.ok) {
    out.render = renderStats.value;
  } else {
    out.reasons.push(`renderStats(): ${renderStats.reason}`);
  }

  await page.close();
  return { ...out, errors };
}

function judge(value, budget, lowerIsBetter = true) {
  if (value === undefined || value === null) return '?';
  const pass = lowerIsBetter ? value <= budget : value >= budget;
  return `${value} ${pass ? '(within budget)' : '(OVER BUDGET)'}`;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const largest = await findLargestRoom();

  const target = await resolveTarget(typeof flags.url === 'string' ? flags.url : undefined);
  const browser = await launchBrowser();

  console.log(`perf: target = ${target.url}`);
  console.log(`perf: largest room by floor cells = room ${largest.number} (${largest.floorCells} floor cells)`);
  console.log(`perf: sample window = ${SAMPLE_MS}ms, results timeout = ${RESULTS_TIMEOUT_MS}ms`);

  const room6 = await measureRoom(browser, target.url, 6, { lightUp: true });
  const largestRoomResult = await measureRoom(browser, target.url, largest.number, { lightUp: false });
  const titleResult = await measureScreen(
    browser,
    target.url,
    'title',
    'window.hening.progress({ solvedUpTo: 50 }); window.hening.screen("title"); return true;',
    0,
  );
  const floorLitResult = await measureScreen(
    browser,
    target.url,
    'floor-lit',
    'window.hening.progress({ solvedUpTo: 20 }); window.hening.screen("floor", { floor: 2 }); return true;',
    2000,
  );
  const courtyardResult = await measureScreen(
    browser,
    target.url,
    'courtyard',
    'await window.hening.screen("courtyard"); return true;',
    1000,
  );
  const rideResult = await measureScreen(
    browser,
    target.url,
    'elevator-ride',
    'await window.hening.screen("elevator", { from: 1, to: 2 }); return true;',
    1500,
  );
  const endingResult = await measureScreen(
    browser,
    target.url,
    'ending',
    'await window.hening.screen("ending"); return true;',
    1500,
  );

  const fullBoardRows = [];
  for (let r = 0; r < 16; r++) {
    if (r === 0 || r === 15) fullBoardRows.push('#'.repeat(19));
    else if (r === 1) fullBoardRows.push('#@' + '$'.repeat(8) + '.'.repeat(8) + '#');
    else fullBoardRows.push('#' + ' '.repeat(17) + '#');
  }

  const editorFullResult = await measureScreen(
    browser,
    target.url,
    'garden-editor-full',
    `const g = window.hening.garden(); g.slots[0] = { rows: ${JSON.stringify(fullBoardRows)}, tested: false }; window.hening.garden(g); await window.hening.screen("garden-editor", { slot: 0 }); return true;`,
    1000,
  );

  const mimpiRoom10Result = await measureScreen(
    browser,
    target.url,
    'mimpi-room-10',
    'await window.hening.screen("dream", { room: 10 }); return true;',
    2000,
  );

  await browser.close();
  await target.close();

  const scenes = [
    { label: 'Room 6 (all lit, arrange())', r: room6 },
    { label: `Room ${largest.number} (largest, default)`, r: largestRoomResult },
    { label: 'Title (whole tower, all floors lit)', r: titleResult },
    { label: 'Floor II (lit, progress solvedUpTo 20)', r: floorLitResult },
    { label: 'Courtyard', r: courtyardResult },
    { label: 'The ride (elevator 1 to 2)', r: rideResult },
    { label: 'Ending (capstone)', r: endingResult },
    { label: 'Taman Sendiri editor (full 19×16 board)', r: editorFullResult },
    { label: 'Mimpi (room 10)', r: mimpiRoom10Result },
  ];

  const lines = [];
  lines.push('# perf report');
  lines.push('');
  lines.push(`Target: \`${target.url}\``);
  lines.push('');
  lines.push(`Largest room by floor-cell count: room ${largest.number} (${largest.floorCells} floor cells).`);
  lines.push('');
  lines.push('| Scene | avg ms | p95 ms | draw calls | triangles | notes |');
  lines.push('|---|---|---|---|---|---|');
  for (const { label, r } of scenes) {
    const avg = r.frameStats ? judge(round2(r.frameStats.avgMs), BUDGET.frameMs) : '?';
    const p95 = r.frameStats ? round2(r.frameStats.p95Ms) : '?';
    const draws = r.render ? judge(r.render.calls, BUDGET.drawCalls) : '?';
    const tris = r.render ? r.render.triangles : '?';
    const notes = [r.navError, ...r.reasons, ...r.errors.map((e) => `console: ${e}`)].filter(Boolean).join('; ') || '-';
    lines.push(`| ${label} | ${avg} | ${p95} | ${draws} | ${tris} | ${notes} |`);
  }
  lines.push('');
  lines.push(`Budgets (\`ARCHITECTURE.md\` §14): frame time ≤ ${BUDGET.frameMs}ms, draw calls ≤ ${BUDGET.drawCalls}.`);
  lines.push(
    'Headless frame times above are SwiftShader\'s (software WebGL, no GPU) and say nothing about a real one; draw-call counts are valid regardless.',
  );

  const apiMissing = scenes.some(({ r }) => !r.present || !r.frameStats || !r.render);
  if (apiMissing) {
    lines.push('');
    lines.push('`window.hening`, `inspect()`/`renderStats()` or `frameStats()` were missing for at least one scene - expected before the relevant prompt is built; see notes above.');
  }

  const report = lines.join('\n');
  const outDir = scratchDir('perf');
  const outPath = path.join(outDir, 'report.md');
  fs.writeFileSync(outPath, report, 'utf8');

  console.log(report);
  console.log(`\nWritten to ${outPath}`);

  const anyConsoleError = scenes.some(({ r }) => r.errors.length > 0);
  const anyNavError = scenes.some(({ r }) => r.navError);
  const overBudget = scenes.some(
    ({ r }) =>
      (r.frameStats && r.frameStats.avgMs > BUDGET.frameMs) ||
      (r.render && r.render.calls > BUDGET.drawCalls),
  );

  if (anyConsoleError || anyNavError || overBudget) {
    process.exitCode = 1;
  }
}

function round2(n) {
  return typeof n === 'number' ? Math.round(n * 100) / 100 : n;
}

main().catch((err) => {
  console.error('perf failed:', err);
  process.exit(1);
});
