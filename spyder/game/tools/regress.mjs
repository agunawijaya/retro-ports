// Regression check: does the Living Room in the game still look exactly
// like the reference scene?
//
//   node regress.mjs [out-folder] [states] [--baseline]
//
// Both pages get the same seeded Math.random and a parked animation loop,
// then stage the same QA states in the same order. Identical code paths
// therefore draw identical pixels.
//
// Two numbers per state:
//   canvas  the game picture itself, read back from the <canvas>. This is
//           what the refactor must not change. Pass: no pixel differs by
//           more than 1 level (GPU rounding).
//   screen  the whole screenshot, HUD included. Text on the rotated HUD
//           cards is anti-aliased slightly differently from run to run, so
//           this is reported for inspection, not judged.
// It saves <state>-compare.png: reference | game | difference (×8).
//
// The results card is expected to differ on screen (the game adds "Room
// map" and the next-room line); its canvas should still match.
//
// --baseline compares the reference with itself in two pages: the noise
// floor of the browser's own rendering, to judge any difference against.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gameUrl, launch, openQa, referenceUrl, reproducible, stage, watchErrors } from './common.mjs';
import { scratchDir } from './review.mjs';

const args = process.argv.slice(2);
const baseline = args.includes('--baseline');
const plain = args.filter((a) => !a.startsWith('--'));
const outDir = resolve(plain[0] ?? scratchDir('regress'));
const states = (plain[1] ?? 'dirty,action,makeover,clean,results').split(',');
mkdirSync(outDir, { recursive: true });

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await context.addInitScript(reproducible);

const ref = await context.newPage();
const game = await context.newPage();
const errors = [...watchErrors(ref, 'reference'), ...watchErrors(game, 'game')];
await openQa(ref, referenceUrl());
await openQa(game, baseline ? referenceUrl() : gameUrl('qa=1&room=living-room'));

// Warm up: the game arrives from its title screen and the reference from its
// start card, so the HUD fades in differently the first time. Stage once,
// unmeasured, so every compared frame starts from the same settled page.
await stage(ref, 'dirty');
await stage(game, 'dirty');
await Promise.all([ref.waitForTimeout(1000), game.waitForTimeout(1000)]);

const scratch = await context.newPage();
await scratch.setContent('<canvas id="c"></canvas>');

// Pixel statistics for two PNGs (base64); optionally a side-by-side image.
function compare(a, b, picture) {
  return scratch.evaluate(
    async ({ a, b, picture }) => {
      const load = (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = `data:image/png;base64,${src}`;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const W = ia.width;
      const H = ia.height;
      const read = (img) => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, W, H).data;
      };
      const da = read(ia);
      const db = read(ib);
      let changed = 0;
      let big = 0;
      let max = 0;
      let box = null;
      const diff = new ImageData(W, H);
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (d > max) max = d;
        if (d > 0) {
          changed++;
          const p = i / 4;
          const x = p % W;
          const y = (p - x) / W;
          box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y];
        }
        if (d > 24) big++;
        const v = Math.min(255, d * 8);
        diff.data[i] = v;
        diff.data[i + 1] = v * 0.4;
        diff.data[i + 2] = v * 0.2;
        diff.data[i + 3] = 255;
      }
      let png = null;
      if (picture) {
        const out = document.getElementById('c');
        out.width = W * 3;
        out.height = H;
        const g = out.getContext('2d');
        g.drawImage(ia, 0, 0);
        g.drawImage(ib, W, 0);
        g.putImageData(diff, W * 2, 0);
        png = out.toDataURL('image/png').split(',')[1];
      }
      return { changed, big, max, box, png };
    },
    { a, b, picture }
  );
}

const canvasPng = (page) => page.evaluate(() => document.getElementById('stage').toDataURL('image/png').split(',')[1]);
const describe = (r) => `${String(r.changed).padStart(7)} px differ, max ${String(r.max).padStart(3)}${r.box ? `, in x ${r.box[0]}–${r.box[2]} y ${r.box[1]}–${r.box[3]}` : ''}`;

let failed = false;
for (const name of states) {
  await stage(ref, name);
  await stage(game, name);
  await Promise.all([ref.waitForTimeout(1000), game.waitForTimeout(1000)]);

  const canvas = await compare(await canvasPng(ref), await canvasPng(game), false);
  const screen = await compare((await ref.screenshot()).toString('base64'), (await game.screenshot()).toString('base64'), true);
  writeFileSync(join(outDir, `${name}-compare.png`), Buffer.from(screen.png, 'base64'));

  const pass = canvas.max <= 1;
  if (!pass) failed = true;
  console.log(`${name.padEnd(9)} canvas ${describe(canvas)}  ${pass ? 'OK' : 'CHANGED'}`);
  console.log(`${''.padEnd(9)} screen ${describe(screen)}`);
}

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
console.log(failed ? 'REGRESSION: the canvas differs from the reference' : 'REGRESSION: canvas identical to the reference in every state');
await browser.close();
process.exitCode = failed || errors.length ? 1 : 0;
