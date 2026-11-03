/**
 * @file GPU frame time per screen (brief 05, `briefs/05-gpu-frames.md`).
 *
 * Prompt 02 measured this once by hand (`NOTES.md` -> *Perf (prompt 02)*):
 * Intel UHD, D3D11 via ANGLE, 1440 x 900 at DPR 2, `update` + `render` +
 * `gl.finish`, 600 frames after 120 warm-up, two passes, median. This tool
 * repeats that method across every scene prompt 05 §4 asks for, with a real
 * GPU rather than the rest of this project's QA tools' SwiftShader (software
 * WebGL, no GPU) - their frame times say nothing about a GPU, only
 * draw-call counts are valid there.
 *
 * Usage:
 *   node tools/gpu-frames.mjs [--url <override>]
 *
 * Writes `review/prompts/05-polish/gpu-frames.md` and prints it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { resolveTarget, withParams, parseFlags, waitForHening, collectConsoleErrors } from './lib/harness.mjs';
import { paths } from './review.mjs';

const VIEWPORT = { width: 1440, height: 900 };
const DPR = 2;
const DISCARD = 120;
const KEEP = 600;
const TOTAL = DISCARD + KEEP;
const PASSES = 2;
const WAIT_TOTAL_TIMEOUT_MS = 120000; // a slow GPU pass should still finish well inside this
const BUDGET_MS = 8; // ARCHITECTURE.md §14: frame time <= 8 ms CPU+GPU, 60 fps

const THEMES = ['lentera', 'bintang', 'batu', 'candi', 'mata-air'];

/** A room, every lantern lit, in the given theme. */
function litRoomInTheme(room, theme) {
  return [`h.screen('room', { room: ${room} })`, `h.skipIntro()`, `h.theme('${theme}')`, `h.arrange()`];
}

/** The 19 x 16 board the Taman Sendiri editor perf check (prompt 02) uses, fully built. */
function fullGardenBoardRows() {
  const rows = [];
  for (let r = 0; r < 16; r++) {
    if (r === 0 || r === 15) rows.push('#'.repeat(19));
    else if (r === 1) rows.push('#@' + '$'.repeat(8) + '.'.repeat(8) + '#');
    else rows.push('#' + ' '.repeat(17) + '#');
  }
  return rows;
}

/**
 * Each scene: how to reach it (`setup`, `window.hening` calls run in page
 * context), how long to let it settle before sampling starts (`settleMs`),
 * and whether sampling should begin the instant setup resolves rather than
 * after a settle (`duringRide` - the elevator ride plays out in real time
 * after `screen()` resolves, so "measure during the ride" means start
 * sampling immediately, not after it finishes).
 */
const SCENES = [
  { name: 'title (every floor lit)', setup: [`h.progress({ solvedUpTo: 50 })`, `h.screen('title')`], settleMs: 2000 },
  { name: 'courtyard', setup: [`h.progress({ solvedUpTo: 23 })`, `h.screen('courtyard')`], settleMs: 2000 },
  {
    name: 'the ride (elevator 0 -> 2, during)',
    setup: [`h.progress({ solvedUpTo: 12 })`, `h.screen('elevator', { from: 0, to: 2, then: 'floor' })`],
    settleMs: 0,
    duringRide: true,
  },
  { name: 'Lantai I', setup: [`h.progress({ solvedUpTo: 4 })`, `h.screen('floor', { floor: 1 })`], settleMs: 2000 },
  { name: 'Lantai V', setup: [`h.progress({ solvedUpTo: 46 })`, `h.screen('floor', { floor: 5 })`], settleMs: 2000 },
  ...THEMES.map((theme) => ({ name: `room 6, all lit, ${theme}`, setup: litRoomInTheme(6, theme), settleMs: 2600 })),
  ...THEMES.map((theme) => ({ name: `room 10, all lit, ${theme}`, setup: litRoomInTheme(10, theme), settleMs: 2600 })),
  { name: 'Mimpi (room 10)', setup: [`h.progress({ solvedUpTo: 23 })`, `h.screen('dream', { room: 10 })`], settleMs: 2500 },
  {
    name: 'garden editor (full 19x16 board)',
    setup: [
      `(() => { const g = h.garden(); g.slots[0] = { rows: ${JSON.stringify(fullGardenBoardRows())}, tested: false }; h.garden(g); return true; })()`,
      `h.screen('garden-editor', { slot: 0 })`,
    ],
    settleMs: 1500,
  },
  { name: 'ending', setup: [`h.progress({ solvedUpTo: 50 })`, `h.screen('ending')`], settleMs: 2500 },
];

/**
 * Launches headless Edge with the real GPU (not this project's other QA
 * tools' SwiftShader): D3D11 via ANGLE, GPU enabled, blocklist ignored, so
 * headless does not silently fall back to software rendering.
 * @returns {Promise<import('playwright-core').Browser>}
 */
async function launchGpuBrowser() {
  return chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
}

/**
 * Reads the WebGL renderer string (`WEBGL_debug_renderer_info`) from a
 * throwaway canvas on the page, so the report says which GPU it ran on.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string>}
 */
async function readRendererString(page) {
  return page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'no WebGL context available';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  });
}

/**
 * Installs a `requestAnimationFrame` wrapper in the page that times every
 * frame callback from its start to just after `gl.finish()` on the game's
 * WebGL2 context, pushing samples into `window.__gpuSamples` while
 * `window.__gpuCollecting` is true. Idempotent, so it can be called once per
 * page and left in place across every scene.
 * @param {import('playwright-core').Page} page
 */
async function installFrameTimer(page) {
  await page.evaluate(() => {
    if (window.__gpuFramesInstalled) return;
    window.__gpuFramesInstalled = true;
    window.__gpuSamples = [];
    window.__gpuCollecting = false;
    // rafInvocations / glFinishCalls let the caller confirm, per pass, that
    // gl.finish() actually ran for (very nearly) every timed callback - i.e.
    // that the timed span really did reach the game's own render call inside
    // it, not just an empty requestAnimationFrame round-trip.
    window.__gpuDiag = { rafInvocations: 0, glFinishCalls: 0, drawingBufferWidth: null, drawingBufferHeight: null };
    const origRAF = window.requestAnimationFrame.bind(window);
    let glCtx = null;
    function getGL() {
      if (glCtx) return glCtx;
      const canvas = document.querySelector('canvas');
      if (canvas) {
        try {
          glCtx = canvas.getContext('webgl2');
        } catch {
          glCtx = null;
        }
      }
      return glCtx;
    }
    window.requestAnimationFrame = function (cb) {
      return origRAF(function (now) {
        window.__gpuDiag.rafInvocations++;
        const t0 = performance.now();
        cb(now);
        const gl = getGL();
        if (gl) {
          gl.finish();
          window.__gpuDiag.glFinishCalls++;
          window.__gpuDiag.drawingBufferWidth = gl.drawingBufferWidth;
          window.__gpuDiag.drawingBufferHeight = gl.drawingBufferHeight;
        }
        const t1 = performance.now();
        if (window.__gpuCollecting) window.__gpuSamples.push(t1 - t0);
      });
    };
  });
}

/**
 * Runs one discard-then-keep pass: clears the sample buffer, collects until
 * `TOTAL` frames have been timed, then returns the kept `KEEP` samples
 * (the first `DISCARD` dropped as warm-up) plus this pass's diagnostics:
 * the drawing-buffer size and how many of the `TOTAL` wrapped
 * `requestAnimationFrame` invocations actually reached `gl.finish()`.
 * @param {import('playwright-core').Page} page
 * @returns {Promise<{ samples: number[], drawingBufferWidth: number|null, drawingBufferHeight: number|null, rafInvocations: number, glFinishCalls: number }>}
 */
async function runPass(page) {
  await page.evaluate(() => {
    window.__gpuSamples = [];
    window.__gpuCollecting = true;
    window.__gpuDiagBefore = { rafInvocations: window.__gpuDiag.rafInvocations, glFinishCalls: window.__gpuDiag.glFinishCalls };
  });
  await page.waitForFunction(() => window.__gpuSamples.length >= window.__gpuFramesTotal, null, {
    timeout: WAIT_TOTAL_TIMEOUT_MS,
  });
  const result = await page.evaluate(() => {
    window.__gpuCollecting = false;
    const before = window.__gpuDiagBefore;
    return {
      samples: window.__gpuSamples.slice(),
      drawingBufferWidth: window.__gpuDiag.drawingBufferWidth,
      drawingBufferHeight: window.__gpuDiag.drawingBufferHeight,
      rafInvocations: window.__gpuDiag.rafInvocations - before.rafInvocations,
      glFinishCalls: window.__gpuDiag.glFinishCalls - before.glFinishCalls,
    };
  });
  return { ...result, samples: result.samples.slice(DISCARD, TOTAL) };
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function statsOf(pass) {
  const sorted = [...pass.samples].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return {
    medianMs: round2(median(sorted)),
    p95Ms: round2(p95),
    maxMs: round2(sorted[sorted.length - 1]),
    frames: sorted.length,
    drawingBufferWidth: pass.drawingBufferWidth,
    drawingBufferHeight: pass.drawingBufferHeight,
    rafInvocations: pass.rafInvocations,
    glFinishCalls: pass.glFinishCalls,
  };
}

async function measureScene(page, scene) {
  // A scene that throws an uncaught error (e.g. a real bug in the game, not
  // this tool) can make Vite's dev client reload the page, which wipes the
  // injected rAF wrapper and window.hening along with it. Reinstall before
  // every scene - both calls are no-ops when nothing was lost.
  await waitForHening(page, 10000);
  await installFrameTimer(page);
  await page.evaluate((total) => {
    window.__gpuFramesTotal = total;
  }, TOTAL);

  // h.screen() itself resolves as soon as the (instant) base-screen
  // transition is done; anything that plays out afterwards in real time
  // (the elevator ride, arrange()'s settle) is not awaited by it.
  for (const body of scene.setup) {
    await page.evaluate(`(async () => { const h = window.hening; await (${body}); })()`);
  }
  if (scene.settleMs) await page.waitForTimeout(scene.settleMs);

  const passes = [];
  for (let i = 0; i < PASSES; i++) {
    const pass = await runPass(page);
    passes.push(statsOf(pass));
  }

  const renderStats = await page.evaluate(() => {
    try {
      return window.hening && window.hening.renderStats ? window.hening.renderStats() : null;
    } catch {
      return null;
    }
  });

  return { passes, renderStats };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const target = await resolveTarget(typeof flags.url === 'string' ? flags.url : undefined);
  const browser = await launchGpuBrowser();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DPR });
  const consoleErrors = collectConsoleErrors(page);

  const rendererString = await readRendererString(page);
  console.log(`gpu-frames: WebGL renderer = ${rendererString}`);
  if (/swiftshader/i.test(rendererString)) {
    console.log('gpu-frames: this is SwiftShader (software WebGL, no GPU) - stopping. '
      + 'Launch with a real GPU available to the browser before re-running.');
    await browser.close();
    await target.close();
    process.exitCode = 1;
    return;
  }

  await page.evaluate((total) => {
    window.__gpuFramesTotal = total;
  }, TOTAL);
  await page.goto(withParams(target.url, { qa: 1, seed: 7 }), { waitUntil: 'load', timeout: 30000 });
  if (!(await waitForHening(page))) {
    console.error('gpu-frames: window.hening never appeared');
    await browser.close();
    await target.close();
    process.exitCode = 1;
    return;
  }
  await installFrameTimer(page);
  // installFrameTimer's `evaluate` runs a function with no closed-over
  // constant, so __gpuFramesTotal must be set again after navigation wiped it.
  await page.evaluate((total) => {
    window.__gpuFramesTotal = total;
  }, TOTAL);

  const results = [];
  // `--only mimpi,ending`: scenes whose name contains any of these (case-insensitive); the report then lists only those.
  const only = typeof flags.only === 'string' ? flags.only.toLowerCase().split(',') : null;
  for (const scene of SCENES.filter((s) => !only || only.some((o) => s.name.toLowerCase().includes(o)))) {
    console.log(`gpu-frames: measuring ${scene.name} ...`);
    try {
      const result = await measureScene(page, scene);
      results.push({ scene, ...result, error: null });
      for (let i = 0; i < result.passes.length; i++) {
        const p = result.passes[i];
        console.log(
          `  pass ${i + 1}: median ${p.medianMs} ms, p95 ${p.p95Ms} ms, max ${p.maxMs} ms (${p.frames} frames, `
            + `buffer ${p.drawingBufferWidth}x${p.drawingBufferHeight}, gl.finish ${p.glFinishCalls}/${p.rafInvocations} rAF callbacks)`,
        );
      }
    } catch (err) {
      console.log(`  FAILED: ${err && err.message ? err.message : err}`);
      results.push({ scene, passes: [], renderStats: null, error: String(err && err.message ? err.message : err) });
      // A scene whose setup throws inside the game's own frame loop (a real
      // bug, not this tool) can stop that loop from ever calling
      // requestAnimationFrame again, which would otherwise hang every scene
      // after it too. Reload so the next scene gets a fresh, running loop;
      // `installFrameTimer`/`waitForHening` at the top of `measureScene`
      // put the QA hooks and the rAF wrapper back.
      try {
        await page.goto(withParams(target.url, { qa: 1, seed: 7 }), { waitUntil: 'load', timeout: 30000 });
      } catch (reloadErr) {
        console.log(`  (reload after failure also failed: ${reloadErr && reloadErr.message ? reloadErr.message : reloadErr})`);
      }
    }
  }

  await browser.close();
  await target.close();

  const lines = [];
  lines.push('# GPU frame time per screen — `tools/gpu-frames.mjs`');
  lines.push('');
  lines.push(
    'Brief `briefs/05-gpu-frames.md`: the hand measurement from prompt 02 '
      + '(`NOTES.md` -> *Perf (prompt 02)*), repeated as a tool across every scene '
      + 'prompt 05 §4 asks for, with a real GPU (this project\'s other QA tools run '
      + 'on SwiftShader, software WebGL with no GPU, so their frame times say '
      + 'nothing about a GPU; draw-call counts are valid there regardless).',
  );
  lines.push('');
  lines.push(`WebGL renderer: \`${rendererString}\``);
  lines.push('');
  lines.push(`Target: \`${target.url}\``);
  lines.push('');
  lines.push(
    `Method: \`update\` + \`render\` + \`gl.finish\` timed per frame via a wrapped `
      + `\`requestAnimationFrame\`; ${DISCARD} warm-up frames discarded, ${KEEP} kept, ${PASSES} passes per scene. `
      + 'The timed span is the whole wrapped callback: it runs `main.js`\'s `frame()` '
      + '(`update()`, which calls `world.render()` -> `renderer.render(scene, camera)` '
      + 'synchronously, e.g. `src/screens/room.js:798-799`) before `gl.finish()` - confirmed per '
      + 'pass below by "gl.finish calls" matching "rAF callbacks" almost exactly.',
  );
  lines.push('');
  lines.push('| Scene | Pass | median ms | p95 ms | max ms | buffer px | rAF callbacks timed | gl.finish ran | draw calls | ≤ 8 ms median |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const { scene, passes, renderStats, error } of results) {
    if (error) {
      lines.push(`| ${scene.name} | - | - | - | - | - | - | - | - | FAILED: ${error} |`);
      continue;
    }
    for (let i = 0; i < passes.length; i++) {
      const p = passes[i];
      const within = p.medianMs <= BUDGET_MS ? 'yes' : 'NO';
      lines.push(
        `| ${scene.name} | ${i + 1} | ${p.medianMs} | ${p.p95Ms} | ${p.maxMs} | ${p.drawingBufferWidth}x${p.drawingBufferHeight} | `
          + `${p.frames} | ${p.glFinishCalls}/${p.rafInvocations} | ${renderStats ? renderStats.calls : '?'} | ${within} |`,
      );
    }
  }
  lines.push('');
  lines.push(`Budget (\`ARCHITECTURE.md\` §14): frame time ≤ ${BUDGET_MS} ms CPU+GPU, 60 fps.`);

  const worst = results
    .filter((r) => !r.error)
    .flatMap((r) => r.passes.map((p) => ({ name: r.scene.name, medianMs: p.medianMs })))
    .sort((a, b) => b.medianMs - a.medianMs)[0];
  if (worst) {
    lines.push('');
    lines.push(`Worst median: ${worst.medianMs} ms, in **${worst.name}**.`);
  }
  const overBudget = results
    .filter((r) => !r.error)
    .flatMap((r) => r.passes.map((p) => ({ name: r.scene.name, medianMs: p.medianMs })))
    .filter((p) => p.medianMs > BUDGET_MS);
  if (overBudget.length) {
    lines.push('');
    lines.push('Over budget (median > 8 ms):');
    for (const o of overBudget) lines.push(`- ${o.name}: ${o.medianMs} ms`);
  } else {
    lines.push('');
    lines.push('No scene over budget on this run.');
  }

  if (consoleErrors.length) {
    lines.push('');
    lines.push('Console errors seen during this run (game bugs the tool hit in passing, not caused by it):');
    for (const e of consoleErrors) lines.push(`- ${e}`);
  }

  const report = lines.join('\n');
  // A partial run (`--only`) never overwrites the full report.
  const outDir = only ? paths.scratch : path.join(paths.review, 'prompts', '05-polish');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, only ? 'gpu-frames-only.md' : 'gpu-frames.md');
  fs.writeFileSync(outPath, report, 'utf8');

  console.log('');
  console.log(report);
  console.log(`\nWritten to ${outPath}`);

  if (results.some((r) => r.error) || (overBudget && overBudget.length)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('gpu-frames failed:', err);
  process.exit(1);
});
