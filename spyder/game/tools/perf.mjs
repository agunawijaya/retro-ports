// Frame time, measured the way ART-DIRECTION §13 means it: how long one
// real animation frame spends in update + render while a busy room plays.
//
//   node perf.mjs [seconds]
//
// Each requestAnimationFrame callback is timed (the game's whole frame runs
// inside it), the 'action' state is staged — two string spiders, a crawler,
// an egg, a hatchling, a dart — and then left to play in real time. The
// reference scene is measured the same way, so the two can be compared on
// this machine. Budget: ≤ 8 ms per frame with a GPU canvas.

import { gameUrl, launch, openQa, referenceUrl, watchErrors } from './common.mjs';
import { paths } from './review.mjs';
void paths;

const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.slice(2).split('=');
      return [k, v ?? true];
    })
);
const room = typeof flags.room === 'string' ? flags.room : null;
// --no-prewarm and --prewarm=<parts> isolate prewarmRoom's effect on the
// makeover-spike measurement (Prompt 15, L1): the first finds the "before"
// (no pre-warming at all), the second finds which single part removes a spike.
const prewarmQuery = flags['no-prewarm']
  ? '&noprewarm=1'
  : typeof flags.prewarm === 'string'
    ? `&prewarm=${flags.prewarm}`
    : '';
const seconds = Number(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 4);
const browser = await launch(['--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization']);

const timing = () => {
  const realRaf = window.requestAnimationFrame.bind(window);
  window.__frames = [];
  window.requestAnimationFrame = (cb) =>
    realRaf((t) => {
      const t0 = performance.now();
      cb(t);
      if (window.__timing) window.__frames.push(performance.now() - t0);
    });
};

async function measure(label, url, state = 'action') {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(timing);
  const page = await context.newPage();
  const errors = watchErrors(page, label);
  await openQa(page, url);
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  await page.evaluate(async (n) => {
    await window.__spyder.setup(n);
    if (n === 'makeover') {
      // Keep the makeover sweep inside the active masked-blend window (0.6..1.9 s)
      // for the entire measurement so every timed frame pays the full blend cost.
      const origStep = window.__spyder.step;
      void origStep;
      const tick = () => {
        if (window.__keepSweep) {
          window.__spyder.setup('makeover');
        }
      };
      window.__keepSweep = setInterval(tick, 550);
    }
    window.__spyder.play();
  }, state);
  await page.waitForTimeout(500); // let the first frames settle
  await page.evaluate(() => {
    window.__frames = [];
    window.__timing = true;
  });
  await page.waitForTimeout(seconds * 1000);
  await page.evaluate(() => {
    if (window.__keepSweep) clearInterval(window.__keepSweep);
  });
  const frames = await page.evaluate(() => window.__frames.slice().sort((a, b) => a - b));
  const at = (q) => frames[Math.min(frames.length - 1, Math.floor(frames.length * q))];
  const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
  console.log(`${label.padEnd(10)} ${frames.length} frames in ${seconds} s · mean ${mean.toFixed(2)} ms · median ${at(0.5).toFixed(2)} · p95 ${at(0.95).toFixed(2)}`);
  if (errors.length) console.log(errors.join('\n'));
  await context.close();
  return renderer;
}

let renderer;
if (flags['makeover-spike']) {
  const initPage = await browser.newPage();
  await openQa(initPage, gameUrl('qa=1'));
  const builtRooms = await initPage.evaluate(() => window.Spyder.rooms.built().map((r) => r.id));
  await initPage.close();

  const roomsToTest = room ? [room] : builtRooms;
  const prewarmLabel = flags['no-prewarm'] ? 'no prewarm' : typeof flags.prewarm === 'string' ? `prewarm=${flags.prewarm}` : 'full prewarm';
  console.log(`\n── Makeover spike measurement (${roomsToTest.length} room${roomsToTest.length === 1 ? '' : 's'}, ${prewarmLabel}) ──\n`);

  const results = [];
  for (const roomId of roomsToTest) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    const errors = watchErrors(page, roomId);
    await openQa(page, gameUrl(`qa=1&room=${roomId}${prewarmQuery}`));
    await page.evaluate(async () => {
      await document.fonts.ready;
      await window.__spyder.setup('dirty');
    });

    const report = await page.evaluate(async () => {
      window.__spyder.clearRoom();
      const dt = 1 / 60;
      const totalFrames = 360; // 6 seconds
      const frames = [];
      for (let i = 0; i < totalFrames; i++) {
        const t0 = performance.now();
        window.__spyder.step(dt);
        const cost = performance.now() - t0;
        frames.push({ i, cost, t: (i + 1) * dt });
        await new Promise((r) => requestAnimationFrame(r));
      }
      const worst = frames.reduce((a, b) => (b.cost > a.cost ? b : a), frames[0]);
      const mean = frames.reduce((a, b) => a + b.cost, 0) / frames.length;
      return { worst, mean };
    });

    console.log(`${roomId.padEnd(22)} worst: ${report.worst.cost.toFixed(2).padStart(6)} ms (at t = ${report.worst.t.toFixed(2)} s) · mean: ${report.mean.toFixed(2)} ms`);
    if (errors.length) console.log(errors.join('\n'));
    results.push({ id: roomId, ...report });
    await context.close();
  }

  console.log('\n| Room | Worst frame | At makeover time | Mean frame |');
  console.log('|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.id} | ${r.worst.cost.toFixed(2)} ms | ${r.worst.t.toFixed(2)} s | ${r.mean.toFixed(2)} ms |`);
  }
} else if (room) {
  const q = `qa=1&room=${room}`;
  const st = typeof flags.state === 'string' ? flags.state : null;
  if (st) {
    renderer = await measure(`${room}-${st}`, gameUrl(q), st);
  } else {
    renderer = await measure(`${room}-action`, gameUrl(q), 'action');
    await measure(`${room}-makeover`, gameUrl(q), 'makeover');
  }
} else {
  renderer = await measure('game', gameUrl());
  await measure('reference', referenceUrl());
  await measure('makeover', gameUrl(), 'makeover');
  await measure('map', gameUrl(), 'map');
}
if (renderer) console.log('renderer:', renderer);
await browser.close();
