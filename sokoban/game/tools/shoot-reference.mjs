/**
 * @file Renders quality bar reference frames from reference/index.html into review/reference/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../..');
const REF_HTML = path.join(ROOT_DIR, 'reference/index.html');
const OUT_DIR = path.join(ROOT_DIR, 'review/reference');

export async function shootReference() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Launching browser to capture reference quality-bar frames...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  // Seeded PRNG for reproducibility
  await page.addInitScript(() => {
    function mulberry32(a) {
      return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    Math.random = mulberry32(7);
  });

  const refUrl = 'file:///' + REF_HTML.replace(/\\/g, '/');
  await page.goto(refUrl, { waitUntil: 'networkidle' });

  // Hide the reference UI panel for all clean quality bar screenshots
  await page.evaluate(() => {
    const panel = document.getElementById('panel');
    if (panel) panel.classList.add('hidden');
    // Start and dismiss veil
    window.hening.start();
    window.hening.skipIntro();
  });

  async function snap(fileName) {
    const outPath = path.join(OUT_DIR, fileName);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
    console.log(`Saved: review/reference/${fileName}`);
  }

  // --- 1. Moods in Room 06 (fajar, siang, senja, malam) ---
  await page.evaluate(() => {
    window.hening.level(1); // Room 06
    window.hening.skipIntro();
    window.hening.arrange(4);
    window.hening.setMood(0);
  });
  await page.waitForTimeout(1500);
  await snap('room06-fajar.jpg');

  await page.evaluate(() => window.hening.setMood(1));
  await page.waitForTimeout(1500);
  await snap('room06-siang.jpg');

  await page.evaluate(() => window.hening.setMood(2));
  await page.waitForTimeout(1500);
  await snap('room06-senja.jpg');

  await page.evaluate(() => window.hening.setMood(3));
  await page.waitForTimeout(1500);
  await snap('room06-malam.jpg');

  // --- 2. Room 07 Senja ---
  await page.evaluate(() => {
    window.hening.level(2); // Room 07
    window.hening.skipIntro();
    window.hening.setMood(2);
  });
  await page.waitForTimeout(1500);
  await snap('room07-senja.jpg');

  // --- 3. Wanderer Scrub Checkpoints (Fajar, closeUp 5, face 1) ---
  await page.evaluate(() => {
    window.hening.level(1);
    window.hening.skipIntro();
    window.hening.setMood(0);
    window.hening.closeUp(5);
    window.hening.face(1);
  });

  // scrub-walk.jpg
  await page.evaluate(() => window.hening.scrub('walk', 0.5, 0));
  await page.waitForTimeout(200);
  await snap('scrub-walk.jpg');

  // scrub-run.jpg
  await page.evaluate(() => window.hening.scrub('run', 0.5, 1));
  await page.waitForTimeout(200);
  await snap('scrub-run.jpg');

  // scrub-push.jpg
  await page.evaluate(() => window.hening.scrub('push', 0.25, 0));
  await page.waitForTimeout(200);
  await snap('scrub-push.jpg');

  // scrub-protest-up.jpg
  await page.evaluate(() => window.hening.scrub('protest', 1.75));
  await page.waitForTimeout(200);
  await snap('scrub-protest-up.jpg');

  // scrub-look-left.jpg
  await page.evaluate(() => window.hening.scrub('look', 1.2));
  await page.waitForTimeout(200);
  await snap('scrub-look-left.jpg');

  // scrub-meditate.jpg
  await page.evaluate(() => window.hening.scrub('meditate', 3));
  await page.waitForTimeout(200);
  await snap('scrub-meditate.jpg');

  // scrub-bow.jpg
  await page.evaluate(() => window.hening.scrub('bow', 1.3));
  await page.waitForTimeout(200);
  await snap('scrub-bow.jpg');

  // --- 4. Focused Life in the Room ---
  await page.evaluate(() => {
    window.hening.scrub(null);
    window.hening.closeUp(1);
    window.hening.level(1);
    window.hening.skipIntro();
  });

  // gate.jpg
  await page.evaluate(() => {
    const gate = window.hening.decor.gate;
    if (gate && gate.group) {
      window.hening.focus(gate.group.position.x, gate.group.position.z, 3.8);
    }
  });
  await page.waitForTimeout(500);
  await snap('gate.jpg');

  // stranger.jpg
  await page.evaluate(() => {
    const stranger = window.hening.decor.stranger;
    if (stranger && stranger.root) {
      window.hening.focus(stranger.root.position.x, stranger.root.position.z, 4.2);
    }
  });
  await page.waitForTimeout(500);
  await snap('stranger.jpg');

  // basin.jpg (first basin in room 6)
  await page.evaluate(() => {
    const basin = window.hening.decor.basins[0];
    if (basin && basin.cells && basin.cells.length > 0) {
      const c = basin.cells[0];
      // Focus on the world coordinate of basin cell
      const x = c.c - 11 / 2 + 0.5; // matching cellX
      const z = c.r - 11 / 2 + 0.5; // matching cellZ
      window.hening.focus(x, z, 4.2);
    }
  });
  await page.waitForTimeout(500);
  await snap('basin.jpg');

  // fountain.jpg (fountain in room 7)
  await page.evaluate(() => {
    window.hening.level(2); // room 7
    window.hening.skipIntro();
    window.hening.setMood(1); // Siang for good daylight
    const pondWithFountain = window.hening.decor.ponds.find((p) => p.fountain);
    if (pondWithFountain && pondWithFountain.fountain) {
      const pos = pondWithFountain.fountain.group.position;
      window.hening.focus(pos.x, pos.z, 4.2);
    }
  });
  await page.waitForTimeout(600);
  await snap('fountain.jpg');

  // --- 5. Finale: room 6, arrange(), wait 4.5s (bow + petals) ---
  await page.evaluate(() => {
    window.hening.focus();
    window.hening.closeUp(1);
    window.hening.level(1);
    window.hening.skipIntro();
    window.hening.setMood(0);
    window.hening.arrange(); // teleports all lanterns -> win() -> bow + petals
  });
  await page.waitForTimeout(4500);
  await snap('finale.jpg');

  // --- 6. Arrival: room 6 reloaded, start(), wait 2.5s (wanderer on stepping stones) ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const panel = document.getElementById('panel');
    if (panel) panel.classList.add('hidden');
    window.hening.level(1); // room 6
    window.hening.start();
  });
  await page.waitForTimeout(2500);
  await snap('arrival.jpg');

  await browser.close();
  console.log('Successfully captured all 18 quality-bar reference frames.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  shootReference().catch((err) => {
    console.error('Shoot reference error:', err);
    process.exit(1);
  });
}
