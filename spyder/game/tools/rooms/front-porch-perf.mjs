// Frame time on the Front Porch, measured the same way as tools/perf.mjs
// (time inside each real animation frame: update + render), while a busy
// state plays live.
//
//   cd game/tools && node rooms/front-porch-perf.mjs [seconds]

import { gameUrl, launch, openQa, watchErrors } from '../common.mjs';
import { paths } from '../review.mjs';
void paths;

const seconds = Number(process.argv[2] ?? 4);
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

async function measure(label, room, state) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addInitScript(timing);
  const page = await context.newPage();
  const errors = watchErrors(page, label);
  await openQa(page, gameUrl(`qa=1&room=${room}`));
  await page.evaluate(async (n) => {
    await window.__spyder.setup(n);
    window.__spyder.play();
  }, state);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__frames = [];
    window.__timing = true;
  });
  await page.waitForTimeout(seconds * 1000);
  const frames = await page.evaluate(() => window.__frames.slice().sort((a, b) => a - b));
  const at = (q) => frames[Math.min(frames.length - 1, Math.floor(frames.length * q))];
  const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
  console.log(`${label.padEnd(22)} ${frames.length} frames in ${seconds} s · mean ${mean.toFixed(2)} ms · median ${at(0.5).toFixed(2)} · p95 ${at(0.95).toFixed(2)}`);
  if (errors.length) console.log(errors.join('\n'));
  await context.close();
}

await measure('porch action', 'front-porch', 'action');
await measure('porch tutorial', 'front-porch', 'tutorial');
await measure('porch makeover', 'front-porch', 'makeover');
await measure('living room action', 'living-room', 'action');
await browser.close();
