// Play test of the whole loop, through the real buttons and fades:
//
//   title → New game → house map → every built room in house order
//   (entered from the map or from the results card's "Next room"):
//   play a few seconds → clear it (QA shortcut) → makeover → results →
//   … → Room map (a CLEAN stamp per room) → reload → Continue → the
//   stamps are still there. The first room is also paused and resumed.
//
// then the same with localStorage blocked, which must still play (and
// simply forget on reload).
//
//   node flowtest.mjs [out-folder]

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gameUrl, launch, openQa, watchErrors } from './common.mjs';
import { scratchDir } from './review.mjs';

const outDir = resolve(process.argv[2] ?? scratchDir('flow'));
mkdirSync(outDir, { recursive: true });

const browser = await launch();
let failures = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const screen = (page) => page.evaluate(() => window.__spyder.screen);
const state = (page) => page.evaluate(() => window.__spyder.state);
const settle = (page, ms = 700) => page.waitForTimeout(ms);
const isOpen = (page, card) => page.evaluate((c) => document.querySelector(`[data-card="${c}"]`).classList.contains('is-open'), card);

async function run(label, blockStorage) {
  console.log(`\n── ${label} ──`);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  if (blockStorage) {
    // A browser that refuses site data: every use of localStorage throws.
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      });
    });
  }
  const page = await context.newPage();
  const errors = watchErrors(page, label);
  const tag = blockStorage ? 'nostore-' : '';
  // ?qa=1 only adds window.__spyder; time runs normally until a setup() call.
  await openQa(page, gameUrl('qa=1&room=living-room'));

  check('title shows on load', (await screen(page)) === 'title');
  check('storage', (await page.evaluate(() => window.__spyder.progress.storageAvailable)) === !blockStorage, blockStorage ? 'blocked as intended' : 'available');
  const continueHidden = await page.evaluate(() => document.querySelector('[data-action="continue"]').hidden);
  check('no Continue without a save', continueHidden);

  // Enter = the first button: New game.
  await page.keyboard.press('Enter');
  await settle(page, 900);
  check('New game opens the house map', (await screen(page)) === 'map');
  const order = await page.evaluate(() => window.Spyder.rooms.built().map((r) => r.id));
  const first = order[0];
  const focused = await page.evaluate(() => document.activeElement?.dataset.room);
  check('the first built room has the focus', focused === first, `${focused}; built: ${order.join(', ')}`);
  await page.screenshot({ path: join(outDir, `${tag}1-map.jpg`), type: 'jpeg', quality: 85 });

  // Every built room in house order (one when storage is blocked):
  // enter it from the map or from "Next room", play a little, clear it.
  const rooms = blockStorage ? order.slice(0, 1) : order;
  for (const [i, id] of rooms.entries()) {
    const viaNext = i > 0 && i % 2 === 0; // alternate: map, then the results card's "Next room"
    if (viaNext) await page.click('[data-card="results"] [data-action="next-room"]');
    else {
      if ((await screen(page)) !== 'map') {
        await page.click('[data-card="results"] [data-action="map"]');
        await settle(page, 1000);
      }
      await page.click(`.map-room[data-room="${id}"]`);
    }
    await settle(page, 1500);
    const now = await page.evaluate(() => window.__spyder.world);
    check(`${id}: entered ${viaNext ? 'with Next room' : 'from the map'}`, (await state(page)) === 'playing', await state(page));
    void now;

    // A few seconds of real play: the director (or a tutorial) must send spiders.
    await page.keyboard.press('Tab'); // the porch's "skip the notes"; harmless elsewhere
    await page.keyboard.down('KeyD');
    await settle(page, 600);
    await page.keyboard.up('KeyD');
    await settle(page, 2600);
    const live = await page.evaluate(() => window.__spyder.world);
    check(`${id}: runs in real time and spiders come`, live.time > 2.5 && live.critters > 0, `t ${live.time.toFixed(1)} s, ${live.critters} critters`);

    if (i === 0) {
      await page.keyboard.press('Escape');
      await settle(page);
      check('Esc pauses', (await state(page)) === 'paused' && (await isOpen(page, 'pause')));
      await page.screenshot({ path: join(outDir, `${tag}2-pause.jpg`), type: 'jpeg', quality: 85 });
      await page.keyboard.press('Escape');
      await settle(page);
      check('Esc resumes', (await state(page)) === 'playing' && !(await isOpen(page, 'pause')));
    }

    await page.evaluate(() => window.__spyder.clearRoom());
    await settle(page, 300);
    check(`${id}: clearing starts the makeover`, (await state(page)) === 'makeover', await state(page));
    await settle(page, 6000);
    check(`${id}: results card after the makeover`, (await state(page)) === 'restored' && (await isOpen(page, 'results')));
    const card = await page.evaluate((roomId) => ({
      found: document.querySelector('[data-result="found"]').textContent,
      story: window.Spyder.rooms.get(roomId).storyObject,
      next: document.querySelector('[data-action="next-room"]').hidden ? null : document.querySelector('[data-action="next-room"]').dataset.room,
      soon: document.querySelector('[data-result="next-soon"]').hidden ? null : document.querySelector('[data-result="next-soon"]').textContent,
    }), id);
    check(`${id}: results name its story object`, card.found === card.story, card.found);
    const expectNext = blockStorage ? order[1] ?? null : rooms[i + 1] ?? null;
    if (expectNext) check(`${id}: "Next room" leads to ${expectNext}`, card.next === expectNext, String(card.next));
    // The last built main room (the Attic): the rooms after it are secret
    // and not yet found, so the results card names nothing next rather
    // than spoiling one (room-registry.js's after(), Brief 16-fix).
    else check(`${id}: last built room, no secret found — no next-room line`, card.next === null && card.soon === null, card.soon);
    await page.screenshot({ path: join(outDir, `${tag}3-results-${id}.jpg`), type: 'jpeg', quality: 85 });
  }

  await page.click('[data-card="results"] [data-action="map"]');
  await settle(page, 1000);
  check('Room map from the results', (await screen(page)) === 'map');
  const stamps = await page.evaluate(() => document.querySelectorAll('.room-label--cleared .stamp').length);
  check('the map stamps every cleared room CLEAN', stamps === rooms.length, `${stamps} of ${rooms.length}`);
  const mapLayout = await page.evaluate(() => {
    const bestTexts = Array.from(document.querySelectorAll('.room-label .best')).map((el) => el.textContent.trim());
    const hasBestZero = bestTexts.some((t) => /best\s+0\b/i.test(t));
    const overlaps = [];
    const intersect = (a, b) => a && b && a.width > 0 && b.width > 0 && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    for (const roomEl of document.querySelectorAll('.room-label--cleared')) {
      const id = roomEl.dataset.room;
      const stamp = roomEl.querySelector('.stamp')?.getBoundingClientRect();
      const name = roomEl.querySelector('.room-name')?.getBoundingClientRect();
      const best = roomEl.querySelector('.best')?.getBoundingClientRect();
      if (intersect(stamp, name) || intersect(stamp, best)) overlaps.push(id);
    }
    return { hasBestZero, bestTexts, overlaps };
  });
  check('no cleared room shows "best 0"', !mapLayout.hasBestZero, mapLayout.bestTexts.join(', '));
  check('every CLEAN stamp is clear of the room name and score line', mapLayout.overlaps.length === 0, mapLayout.overlaps.join(', ') || 'none overlap');
  await page.screenshot({ path: join(outDir, `${tag}4-map-clean.jpg`), type: 'jpeg', quality: 85 });

  await page.reload();
  await openQa(page, page.url());
  const resumeVisible = await page.evaluate(() => !document.querySelector('[data-action="continue"]').hidden);
  if (blockStorage) {
    check('after reload without storage: a fresh start, no error', !resumeVisible);
  } else {
    check('after reload: Continue is offered', resumeVisible);
    await page.keyboard.press('Enter');
    await settle(page, 900);
    const kept = await page.evaluate(() => document.querySelectorAll('.room-label--cleared .stamp').length);
    check('after reload: the stamps are still on the map', (await screen(page)) === 'map' && kept === rooms.length, `${kept}`);
    await page.screenshot({ path: join(outDir, '5-map-after-reload.jpg'), type: 'jpeg', quality: 85 });

    // Back to the letter, and Settings round trip (saved and restored).
    await page.keyboard.press('Escape');
    await settle(page, 900);
    check('Esc on the map returns to the title', (await screen(page)) === 'title');
    await page.click('[data-action="settings"]');
    await settle(page);
    await page.click('#tab-visual');
    await page.click('input[name="grain"][value="off"] + span');
    await page.keyboard.press('Escape');
    await settle(page);
    await page.reload();
    await openQa(page, page.url());
    const grain = await page.evaluate(() => window.__spyder.progress.settings.grain);
    check('a changed setting survives a reload', grain === false);
  }

  check('no console errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

await run('normal storage', false);
await run('storage blocked', true);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
await browser.close();
process.exitCode = failures ? 1 : 0;
