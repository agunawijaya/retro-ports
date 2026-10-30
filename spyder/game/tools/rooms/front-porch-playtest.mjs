// Play the Front Porch from start to finish through the real page, the way
// a player would: real keys, a real mouse, real time.
//
//   title → New game → map (the porch is next) → enter → the six notes,
//   each done by doing what it asks → free play (the director takes over)
//   → clear the room (QA shortcut) → makeover → results naming Ashworth →
//   Room map shows the porch CLEAN → enter again: no notes (auto-skipped).
//
// Then, with a fresh save: Tab skips the notes and the director starts.
//
//   cd game/tools && node rooms/front-porch-playtest.mjs
//
// Shots go to .scratch/porch-playtest/ (git-ignored).

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gameUrl, launch, openQa, watchErrors } from '../common.mjs';
import { scratchDir } from '../review.mjs';

const outDir = resolve(process.argv[2] ?? scratchDir('porch-playtest'));
mkdirSync(outDir, { recursive: true });

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const peek = (page) => page.evaluate(() => window.Spyder.rooms.get('front-porch').qa.peek());
const sleep = (page, ms) => page.waitForTimeout(ms);

async function until(page, test, timeout = 4000) {
  const end = Date.now() + timeout;
  let p = await peek(page);
  while (!test(p) && Date.now() < end) {
    await sleep(page, 50);
    p = await peek(page);
  }
  return p;
}

async function enterPorch(page) {
  await page.click('.map-room[data-room="front-porch"]');
  await sleep(page, 1400);
}

const browser = await launch();

// ── 1. A first visit, played through ─────────────────────────────────
{
  console.log('\n── first visit: the tutorial, played ──');
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const errors = watchErrors(page, 'porch');
  await openQa(page, gameUrl('qa=1&room=front-porch'));

  await page.keyboard.press('Enter');
  await sleep(page, 900);
  const focused = await page.evaluate(() => document.activeElement?.dataset.room);
  check('New game: the map puts the Front Porch first', focused === 'front-porch', focused);
  await enterPorch(page);

  let p = await peek(page);
  check('entering the porch starts the tutorial', p.state === 'playing' && p.active && p.step === 0, `step ${p.step}`);
  check('note 1 is pinned up, alone', /Walk/.test(p.note || '') && p.notesOnPost === 1, p.note);
  await page.screenshot({ path: join(outDir, '1-note-walk.jpg'), type: 'jpeg', quality: 85 });

  // Note 1: walk 300 px.
  await page.keyboard.down('KeyD');
  await sleep(page, 900);
  await page.keyboard.up('KeyD');
  p = await until(page, (q) => q.step === 1);
  check('walking 300 px tears note 1; note 2 goes up', p.step === 1 && /swing/.test(p.note || ''), p.note);

  // Note 2: jump onto the swing.
  await page.keyboard.down('KeyA');
  p = await until(page, (q) => q.hero.x < 470, 5000);
  await page.keyboard.up('KeyA');
  await sleep(page, 250);
  await page.keyboard.down('KeyW');
  await sleep(page, 380);
  await page.keyboard.up('KeyW');
  p = await until(page, (q) => q.hero.on === 'swing', 2000);
  const sway = [];
  for (let i = 0; i < 8; i++) {
    sway.push((await peek(page)).swingOffset);
    await sleep(page, 100);
  }
  const swayRange = Math.max(...sway) - Math.min(...sway);
  check('the hero lands on the swing', p.hero.on === 'swing', `x ${p.hero.x.toFixed(0)}, y ${p.hero.y.toFixed(0)}`);
  check('the swing sways when landed on', swayRange > 4, `range ${swayRange.toFixed(1)} px over 0.8 s`);
  p = await peek(page);
  check('the swing carries the hero', p.hero.on === 'swing', `x0 ${p.swingX0.toFixed(1)}, hero ${p.hero.x.toFixed(1)}`);
  p = await until(page, (q) => q.step === 2 && q.spider);
  check('landing tears note 2; note 3 and its spider appear', p.step === 2 && Boolean(p.spider), p.note);

  // Note 3: shoot the spider hanging above the swing.
  p = await until(page, (q) => q.spider && q.spider.state === 'hovering', 5000);
  await page.screenshot({ path: join(outDir, '2-note-spider.jpg'), type: 'jpeg', quality: 85 });
  for (let shot = 0; shot < 10 && p.step === 2; shot++) {
    if (p.spider) await page.mouse.move(p.spider.x, p.spider.y);
    await page.mouse.down();
    await sleep(page, 120);
    await page.mouse.up();
    p = await until(page, (q) => q.step !== 2, 500);
  }
  p = await until(page, (q) => q.step === 3 && q.spider, 3000);
  check('a kill tears note 3; note 4 and a high spider appear', p.step === 3 && Boolean(p.spider), `${p.note} | spider y ${p.spider?.y.toFixed(0)}`);

  // Note 4: snip the thread above the high spider. From straight below, the
  // dart meets the body first, so step off the swing and well to the side.
  await page.keyboard.press('KeyS');
  await sleep(page, 400);
  await page.keyboard.down('KeyD');
  p = await until(page, (q) => q.hero.x > 1000 && q.hero.on === 'floor', 4000);
  await page.keyboard.up('KeyD');
  await sleep(page, 200);
  p = await until(page, (q) => q.spider && q.spider.state === 'hovering', 5000);
  for (let shot = 0; shot < 12 && p.step === 3; shot++) {
    // Wait until it hangs still, aim high on the thread, let the aim settle.
    p = await until(page, (q) => q.spider && q.spider.state === 'hovering', 4000);
    if (p.spider) await page.mouse.move(p.spider.anchorX, 128);
    await sleep(page, 250);
    await page.mouse.down();
    await sleep(page, 60);
    await page.mouse.up();
    p = await until(page, (q) => q.step !== 3 && q.step !== -1, 900);
  }
  p = await until(page, (q) => q.step === 4, 3000);
  check('the thread snip (or two tries) tears note 4', p.step === 4 && /webs/.test(p.note || ''), `ended by: ${p.lastHow}`);

  // Note 5: tear 15 strands.
  for (const [x, y] of [[262, 196], [278, 362], [1660, 204]]) {
    if ((await peek(page)).step !== 4) break;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await sleep(page, 700);
    await page.mouse.up();
    await sleep(page, 300);
  }
  p = await until(page, (q) => q.step === 5, 3000);
  check('15 strands torn tears note 5; note 6 goes up', p.step === 5 && /Little/.test(p.note || ''), p.note);

  // Note 6: get off the swing, wait for the egg to hatch, land on a hatchling.
  await page.keyboard.press('KeyS');
  await sleep(page, 500);
  await page.keyboard.down('KeyD');
  p = await until(page, (q) => q.hero.x > 760, 3000);
  await page.keyboard.up('KeyD');
  p = await until(page, (q) => q.brood.length > 0, 6000);
  check('an egg drops and hatches two hatchlings', p.brood.length === 2, `${p.brood.length} hatchlings`);
  await page.screenshot({ path: join(outDir, '3-note-hatchlings.jpg'), type: 'jpeg', quality: 85 });
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    p = await peek(page);
    if (p.step !== 5) break;
    await page.keyboard.down('KeyW');
    await sleep(page, 160);
    await page.keyboard.up('KeyW');
    await sleep(page, 650);
  }
  p = await peek(page);
  check('a stomp tears note 6', p.step !== 5, `step ${p.step}, nerve ${p.hero.nerve}`);
  p = await until(page, (q) => !q.active && /rest is yours/.test(q.note || ''), 2000);
  check('a last note says the rest is up to the player', /rest is yours/.test(p.note || ''), p.note);

  // Free play: the director takes over.
  await sleep(page, 4200);
  p = await peek(page);
  check('the last note tears itself off', p.notesOnPost === 0, `${p.notesOnPost} on the post`);
  check('free play: the director sends spiders', p.critters > 0, `${p.critters} alive`);
  await page.screenshot({ path: join(outDir, '4-free-play.jpg'), type: 'jpeg', quality: 85 });

  await page.evaluate(() => window.__spyder.clearRoom());
  await sleep(page, 400);
  check('clearing the room starts the makeover', (await page.evaluate(() => window.__spyder.state)) === 'makeover');
  await sleep(page, 2600);
  await page.screenshot({ path: join(outDir, '5-makeover-3s.jpg'), type: 'jpeg', quality: 85 });
  await sleep(page, 1700);
  await page.screenshot({ path: join(outDir, '6-makeover-door.jpg'), type: 'jpeg', quality: 85 });
  await sleep(page, 1600);
  const found = await page.evaluate(() => document.querySelector('[data-result="found"]').textContent);
  const resultsOpen = await page.evaluate(() => document.querySelector('[data-card="results"]').classList.contains('is-open'));
  check('the results card opens and names Ashworth', resultsOpen && /Ashworth/.test(found), found);
  const next = await page.evaluate(() => {
    const b = document.querySelector('[data-action="next-room"]');
    return b.hidden ? null : b.dataset.room;
  });
  check('Next room points to the Living Room', next === 'living-room', String(next));
  await page.screenshot({ path: join(outDir, '7-results.jpg'), type: 'jpeg', quality: 85 });

  await page.click('[data-card="results"] [data-action="map"]');
  await sleep(page, 1100);
  const cleared = await page.evaluate(() => document.querySelector('.map-room[data-room="front-porch"]')?.className);
  check('the map shows the porch CLEAN', /map-room--cleared/.test(cleared || ''), cleared);
  await page.screenshot({ path: join(outDir, '8-map.jpg'), type: 'jpeg', quality: 85 });

  await enterPorch(page);
  p = await peek(page);
  check('replaying a cleared porch skips the notes', p.state === 'playing' && !p.active && p.notesOnPost === 0, `active ${p.active}`);
  await sleep(page, 2500);
  p = await peek(page);
  check('…and the director runs at once', p.critters > 0, `${p.critters} alive`);

  check('no console errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ── 2. A first visit, skipped with Tab ───────────────────────────────
{
  console.log('\n── first visit: Tab skips the notes ──');
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const errors = watchErrors(page, 'porch-skip');
  await openQa(page, gameUrl('qa=1&room=front-porch'));
  await page.keyboard.press('Enter');
  await sleep(page, 900);
  await enterPorch(page);
  let p = await peek(page);
  check('note 1 is up', /Walk/.test(p.note || ''));
  await page.keyboard.press('Tab');
  await sleep(page, 300);
  p = await peek(page);
  const onCanvas = await page.evaluate(() => document.activeElement?.id);
  check('Tab tears the note and ends the tutorial', !p.active && !p.note, `active ${p.active}`);
  check('Tab keeps the focus on the game', onCanvas === 'stage', onCanvas);
  await sleep(page, 2600);
  p = await peek(page);
  check('after skipping, the director sends spiders', p.critters > 0, `${p.critters} alive`);
  check('no console errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
await browser.close();
process.exitCode = failures ? 1 : 0;
