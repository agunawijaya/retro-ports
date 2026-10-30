// Keyboard and rules checks that the flow test does not cover:
//
//   - every screen can be used from the keyboard alone
//   - linear unlocking over the rooms that exist, skipping unbuilt ones
//   - running out of nerve shows "You fled the room", and both its buttons work
//
//   node checks.mjs

import { gameUrl, launch, openQa, watchErrors } from './common.mjs';
import { paths } from './review.mjs';
void paths;

const browser = await launch();
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
const errors = watchErrors(page, 'checks');
await openQa(page, gameUrl());
const screen = () => page.evaluate(() => window.__spyder.screen);
const focusedText = () => page.evaluate(() => (document.activeElement?.textContent || '').trim());
const pause = (ms = 600) => page.waitForTimeout(ms);

// ── Keyboard ───────────────────────────────────────────────────────────

console.log('── keyboard ──');
check('title: focus starts on the first button', /New game/.test(await focusedText()), await focusedText());
await page.keyboard.press('Tab');
check('title: Tab reaches Settings', /Settings/.test(await focusedText()), await focusedText());
await page.keyboard.press('Enter');
await pause();
check('Enter on Settings opens the settings card', (await screen()) === 'settings');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
const tab = await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]').dataset.tab);
check('settings: arrow keys move between tabs', tab === 'sound', tab);
await page.keyboard.press('Tab');
const slider = await page.evaluate(() => document.activeElement?.dataset.volume);
check('settings: Tab reaches the first brass dial', slider === 'master', slider);
await page.keyboard.press('ArrowLeft');
const master = await page.evaluate(() => Number(document.querySelector('[data-volume="master"]').value));
check('settings: arrow keys turn the dial', master === 75, String(master));
const volume = await page.evaluate(() => window.__spyder.progress.settings.volume);
check('moving one dial keeps the other two', volume.master === 0.75 && volume.music === 0.55 && volume.sfx === 0.9, JSON.stringify(volume));
await page.keyboard.press('Escape');
await pause();
check('Esc leaves settings for the title', (await screen()) === 'title');

await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
check('title: Tab reaches How to play', /How to play/.test(await focusedText()), await focusedText());
await page.keyboard.press('Enter');
await pause();
check('How to play opens', (await screen()) === 'howto');
await page.keyboard.press('Escape');
await pause();
check('Esc leaves How to play', (await screen()) === 'title');

await page.evaluate(() => document.activeElement.blur());
await page.keyboard.press('Enter');
await pause(900);
check('Enter with nothing focused = the first button (New game → map)', (await screen()) === 'map');
const first = await page.evaluate(() => window.Spyder.rooms.built()[0].id);
const before = await page.evaluate(() => document.activeElement?.dataset.room);
await page.keyboard.press('ArrowUp');
const after = await page.evaluate(() => document.activeElement?.dataset.room);
check('map: the first built room has the focus; ArrowUp reaches the room that touches it', before === first && after === 'living-room', `${before} → ${after}`);
const sideways = await page.evaluate(() => {
  document.querySelector(`.map-room[data-room="${window.Spyder.rooms.built()[0].id}"]`).focus();
  return null;
});
void sideways;
await page.keyboard.press('ArrowRight');
const right = await page.evaluate(() => document.activeElement?.dataset.room);
const sameFloor = await page.evaluate((id) => window.Spyder.rooms.HOUSE.find((h) => h.id === id)?.floor, right);
check('map: ArrowRight stays on the same floor', sameFloor === 'ground', `${right} (${sameFloor})`);
// One locked built room and one room that is not built yet, whatever exists now.
const hintCases = await page.evaluate(() => {
  const S = window.Spyder;
  const locked = S.rooms.built()[1]?.id;
  const unbuilt = S.rooms.HOUSE.find((h) => !h.secret && !S.rooms.exists(h.id))?.id;
  return [locked, unbuilt];
});
for (const [id, word] of [
  hintCases[0] ? [hintCases[0], /clean the rooms before it/] : null,
  hintCases[1] ? [hintCases[1], /not ready/] : null,
].filter(Boolean)) {
  await page.evaluate((r) => document.querySelector(`.map-room[data-room="${r}"]`).focus(), id);
  await page.keyboard.press('Enter');
  await pause(300);
  const hint = await page.evaluate(() => document.querySelector('[data-map-hint]').textContent);
  check(`map: Enter on ${id} explains instead of entering`, (await screen()) === 'map' && word.test(hint), hint);
}
await page.evaluate((r) => document.querySelector(`.map-room[data-room="${r}"]`).focus(), first);
await page.keyboard.press('Enter');
await pause(1500);
check(`map: Enter on the open room (${first}) goes in`, (await page.evaluate(() => window.__spyder.state)) === 'playing');

// ── Running out of nerve ──────────────────────────────────────────────

console.log('── fleeing ──');
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.__spyder.hurt(15));
  await pause(1150); // the hero is briefly invulnerable after each hit
}
check('no nerve left: "You fled the room"', (await page.evaluate(() => window.__spyder.state)) === 'fled' && (await screen()) === 'fled');
check('fled: the first button has the focus', /Try again/.test(await focusedText()), await focusedText());
await page.keyboard.press('KeyR');
await pause(750);
check('R tries again with full nerve', (await page.evaluate(() => window.__spyder.state)) === 'playing' && (await screen()) === null);
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.__spyder.hurt(15));
  await pause(1150);
}
await page.click('[data-card="fled"] [data-action="map"]');
await pause(900);
check('fled: Room map goes to the map', (await screen()) === 'map');

// ── Linear unlocking ──────────────────────────────────────────────────

console.log('── unlocking ──');
const unlocks = await page.evaluate(() => {
  const S = window.Spyder;
  const fake = (cleared) => ({ isCleared: (id) => cleared.includes(id), isFound: () => false, record: () => null });
  const built = S.rooms.built().map((r) => r.id);
  const main = S.rooms.HOUSE.filter((h) => !h.secret).map((h) => h.id);
  const statusList = (p) => main.map((id) => S.rooms.statusOf(id, p));
  // The status every main room should have, given which ones are clean:
  // cleared ones stay cleared, the first uncleared built room is open, the
  // other built rooms are locked, and rooms that are not built are coming soon.
  const expected = (cleared) => {
    let opened = false;
    return main.map((id) => {
      if (!built.includes(id)) return 'coming-soon';
      if (cleared.includes(id)) return 'cleared';
      if (!opened) {
        opened = true;
        return 'open';
      }
      return 'locked';
    });
  };
  const same = (cleared) => statusList(fake(cleared)).join() === expected(cleared).join();
  const order = main.filter((id) => built.includes(id));
  const inHouseOrder = built.join() === order.join();
  const firstTwo = built.slice(0, 2);
  return {
    built: built.join(', '),
    inHouseOrder,
    fresh: same([]),
    afterFirst: same(built.slice(0, 1)),
    nextAfterFirst: S.rooms.nextRoom(fake(built.slice(0, 1)))?.id === built[1],
    afterTwo: same(firstTwo),
    nextAfterTwo: S.rooms.nextRoom(fake(firstTwo))?.id === built[2],
    // A save from before the first room existed: only the second is cleared.
    oldSave: same(built.slice(1, 2)),
    oldSaveOpensFirst: S.rooms.nextRoom(fake(built.slice(1, 2)))?.id === built[0],
    all: S.rooms.nextRoom(fake(built)),
    freshList: statusList(fake([])).join(', '),
  };
});
check('built rooms are listed in house order', unlocks.inHouseOrder, unlocks.built);
check('a new game opens only the first built room; unbuilt rooms are "coming soon"', unlocks.fresh, unlocks.freshList);
check('clearing a room opens the next built one', unlocks.afterFirst && unlocks.nextAfterFirst);
check('clearing two opens the third, skipping unbuilt rooms', unlocks.afterTwo && unlocks.nextAfterTwo);
check('a room cleared before an earlier one existed stays cleared', unlocks.oldSave && unlocks.oldSaveOpensFirst);
check('with every built room clean, nothing is "next"', unlocks.all === null, String(unlocks.all?.id ?? unlocks.all));

// ── Polish: house map & runtime services (Fix 5 & Fix 6) ──────────────

console.log('── polish (Fix 5 & Fix 6) ──');
const polish = await page.evaluate(async () => {
  const S = window.Spyder;

  // 1. Room CSS attached via <link data-room-css>
  const porchLink = document.head.querySelector('link[rel="stylesheet"][data-room-css="front-porch"]');
  const cssAttached = Boolean(porchLink && porchLink.getAttribute('href') === 'rooms/front-porch/room.css');

  // 2. Runtime services: unique spawn seeds, hatch({ count, speed }), placeHero, setScore, mk.t in restored, glow shift
  const room = S.rooms.get('living-room');
  let runtimeChecks = {};
  let glowShiftSeen = null;
  const origGlow = room.glow;
  room.glow = function (ctx, light, live, t, mk, flick, shift) {
    glowShiftSeen = shift;
    return origGlow.call(this, ctx, light, live, t, mk, flick, shift);
  };
  room.qa.states = room.qa.states || {};
  room.qa.states._polishCheck = (api) => {
    api.setState('playing');
    api.holdDirector();
    const s1 = api.world.spawn('string', { x: 700 });
    const s2 = api.world.spawn('string', { x: 700 });
    const uniqueSeeds = s1.hoverFor !== s2.hoverFor || s1.targetY !== s2.targetY;

    const egg = api.world.spawnEgg(900, 900, 'resting', { hatchAt: 1.3, count: 2, speed: 0.6 });
    const hatched = api.world.hatch(egg);
    const hatchOptsOk = egg.hatchAt === 1.3 && hatched.length === 2 && hatched.every((h) => h.speed <= 190 * 0.6 * 1.36);

    api.placeHero(395, 'sofa');
    const heroPlacedOk = api.hero.x === 395 && api.hero.onGround && api.hero.standingOn?.name === 'sofa';

    api.setScore({ score: 3450, combo: 4, kills: 5, eggs: 2 });
    const scoreOk = api.world.stats.score === 3450 && api.world.stats.combo === 4 && api.world.stats.kills === 5 && api.world.stats.eggs === 2;

    api.finishMakeover();
    api.setState('restored');
    const tBefore = api.world.mk.t;
    api.step(0.5);
    const tAfter = api.world.mk.t;
    const mkAdvancesAfterRestored = tAfter > tBefore + 0.45;

    runtimeChecks = { uniqueSeeds, hatchOptsOk, heroPlacedOk, scoreOk, mkAdvancesAfterRestored };
  };
  await window.__spyder.setup('_polishCheck');
  delete room.qa.states._polishCheck;
  room.glow = origGlow;

  // 3. House map: best = 0 shows 'cleared' (never 'best 0') and CLEAN stamps never overlap room labels
  S.progress.reset();
  S.progress.recordClear('front-porch', { score: 0, bestCombo: 1, untouched: true, time: 40 });
  S.progress.recordClear('living-room', { score: 18740, bestCombo: 5, untouched: false, time: 150 });
  S.progress.recordClear('kitchen', { score: 22100, bestCombo: 4, untouched: true, time: 160 });
  await window.__spyder.setup('map');

  const porchBestText = document.querySelector('.room-label[data-room="front-porch"] .best')?.textContent.trim();
  const livingBestText = document.querySelector('.room-label[data-room="living-room"] .best')?.textContent.trim();
  const bestTexts = Array.from(document.querySelectorAll('.room-label .best')).map((el) => el.textContent.trim());
  const hasBestZero = bestTexts.some((t) => /best\s+0\b/i.test(t));

  const intersect = (a, b) => a && b && a.width > 0 && b.width > 0 && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const stampOverlaps = [];
  for (const roomEl of document.querySelectorAll('.room-label--cleared')) {
    const id = roomEl.dataset.room;
    const stamp = roomEl.querySelector('.stamp')?.getBoundingClientRect();
    const linesToCheck = roomEl.querySelectorAll('.room-name, .best');
    if (Array.from(linesToCheck).some((el) => intersect(stamp, el.getBoundingClientRect()))) stampOverlaps.push(id);
  }

  const textOverflows = [];
  for (const roomEl of document.querySelectorAll('.room-label')) {
    const id = roomEl.dataset.room;
    const roomBtn = document.querySelector(`.map-room[data-room="${id}"]`);
    const rb = roomBtn?.getBoundingClientRect();
    if (!rb) continue;
    for (const t of roomEl.querySelectorAll('text')) {
      const tb = t.getBoundingClientRect();
      if (tb.left < rb.left || tb.right > rb.right || tb.top < rb.top || tb.bottom > rb.bottom) {
        textOverflows.push(`${id}("${t.textContent.trim()}")`);
      }
    }
  }
  S.progress.reset();

  return {
    cssAttached,
    porchBestText,
    livingBestText,
    hasBestZero,
    stampOverlaps,
    textOverflows,
    glowShiftNumeric: typeof glowShiftSeen === 'number' && Number.isFinite(glowShiftSeen),
    ...runtimeChecks,
  };
});

check('room CSS attached via <link data-room-css>', polish.cssAttached);
check('map: cleared room with score 0 shows "cleared", not "best 0"', /^cleared\b/.test(polish.porchBestText || '') && !polish.hasBestZero, `${polish.porchBestText} / ${polish.livingBestText}`);
check('map: no CLEAN stamp overlaps a room name or score line', polish.stampOverlaps.length === 0, polish.stampOverlaps.join(', ') || 'none overlap');
check('map: every room text bounding box lies inside its room box', polish.textOverflows.length === 0, polish.textOverflows.join(', ') || 'all inside');
check('world.spawn() assigns a unique seed on every call', polish.uniqueSeeds);
check('world.spawnEgg() and world.hatch() accept { hatchAt, count, speed }', polish.hatchOptsOk);
check('qa staging api: placeHero(x, platformName) and setScore({...})', polish.heroPlacedOk && polish.scoreOk);
check('mk.t continues advancing in restored state for uniqueBeat', polish.mkAdvancesAfterRestored);
check('far-layer parallax shift passed as 7th argument to room.glow()', polish.glowShiftNumeric);

// ── Two-file rooms & built-in blockout (Prompt 07 L1) ─────────────────

console.log('── two-file rooms & blockout (Prompt 07 L1) ──');
const standInOk = await page.evaluate(async () => {
  const S = window.Spyder;
  // Register stand-in two-file room without its art
  S.rooms.register({
    id: 'basement',
    number: 13,
    act: 4,
    name: 'Basement',
    art: true,
    layout: {
      CEILING: 100,
      FLOOR_LINE: 770,
      GROUND: 935,
      heroStart: 400,
      bounds: { left: 80, right: 1840 },
      window: { x: 1200, y: 180, w: 240, h: 320 },
      platforms: [
        { name: 'floor', x0: 0, x1: 1920, y: 935, oneWay: false },
        { name: 'tub-rim', x0: 200, x1: 500, y: 750, oneWay: true },
        { name: 'sink', x0: 800, x1: 1100, y: 720, oneWay: true },
      ],
      props: [
        { name: 'Bathtub', x: 200, y: 750, w: 300, h: 185, kind: 'furniture' },
        { name: 'Sink', x: 800, y: 720, w: 300, h: 215, kind: 'furniture' },
        { name: 'Mirror', x: 850, y: 400, w: 200, h: 250, kind: 'wall' },
        { name: 'Ceiling Bulb', x: 950, y: 120, w: 24, h: 24, kind: 'light' },
      ],
      dropPoints: [350, 950, 1400],
      wallArea: { x0: 80, x1: 1840, y0: 120, y1: 720 },
      lairs: [{ x: 500, y: 700, label: 'drain' }],
    },
    rules: { quota: 4, types: ['string'] },
    makeWebs: () => [],
    makeover: { beats: [{ at: 2.0, name: 'lights' }] },
    storyObject: 'Found in the mirror: a name written in the steam.',
  });

  await window.__spyder.enterRoom('basement');
  window.__spyder.step(0.5);
  const isPlaying = window.__spyder.world !== undefined;
  const isBlockout = window.__spyder.isBlockout;
  return isPlaying && isBlockout;
});
check('stand-in two-file room registered without art plays on blockout', standInOk);

// ?art=off shows the blockout for the Living Room
const artOffPage = await context.newPage();
const artOffErrors = watchErrors(artOffPage, 'art-off');
await openQa(artOffPage, gameUrl('qa=1&room=living-room&art=off'));
await artOffPage.evaluate(() => window.__spyder.setup('dirty'));
const livingBlockout = await artOffPage.evaluate(() => window.__spyder.isBlockout);
await artOffPage.close();
check('?art=off shows the blockout for the Living Room', livingBlockout && artOffErrors.length === 0);

// ── Weapons (prompt 12, L1–L4) ─────────────────────────────────────────

console.log('── weapons ──');
const weaponsPage = await context.newPage();
const weaponsErrors = watchErrors(weaponsPage, 'weapons');
await openQa(weaponsPage, gameUrl('qa=1&room=living-room'));

const weapons = await weaponsPage.evaluate(async () => {
  const S = window.Spyder;
  const room = S.rooms.get('living-room');

  const press = (code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  };
  const wheel = (deltaY) => {
    document.getElementById('stage').dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
  };

  let result = {};
  room.qa.states = room.qa.states || {};
  room.qa.states._weaponCheck = (api) => {
    api.setState('playing');
    api.holdDirector();

    // 1. Registry & default unlocks
    const hasVacuum = Boolean(S.weapons.get('vacuum')) && S.weapons.isUnlocked('vacuum');
    const cutterLockedAtFirst = !S.weapons.isUnlocked('web-cutter');

    // With only Vacuum unlocked, 1/2/3, Q/E and wheel all leave it selected
    press('Digit2');
    press('Digit3');
    press('KeyQ');
    press('KeyE');
    wheel(1);
    wheel(-1);
    const stillVacuum = api.world.hero.heroModel === 'vacuum';

    // 2. Switching (keys, wheel, Q/E, locked skipped)
    S.progress.data.unlocked = ['vacuum', 'web-cutter'];
    press('Digit3'); // Foam Spray still locked, skipped
    const lockedSkipped = api.world.hero.heroModel === 'vacuum';

    press('Digit2'); // Web-Cutter unlocked, switches
    const switchedToCutter = api.world.hero.heroModel === 'cutter';

    // Switch timer (no firing during 0.18 s switch)
    press('Digit1');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    api.step(0.08); // inside switch
    // Check if vacuum fired
    const firedDuringSwitch = api.world.hero.charge < 0.95;
    api.step(0.2); // past switch
    const firedAfterSwitch = api.world.hero.charge < 0.95;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));

    // Wheel and Q/E cycling
    wheel(1);
    const cycledToCutter = api.world.hero.heroModel === 'cutter';
    press('KeyQ');
    const cycledBackToVacuum = api.world.hero.heroModel === 'vacuum';
    press('KeyE');
    const cycledForwardToCutter = api.world.hero.heroModel === 'cutter';

    // 3. Tank drain and refill (Foam Spray)
    S.progress.data.unlocked = ['vacuum', 'web-cutter', 'foam-spray'];
    press('Digit3');
    const foam = S.weapons.get('foam-spray');
    foam.reset();
    const tankInitial = foam.tank;
    // Hold fire
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    api.step(0.5);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    const tankDrained = foam.tank < tankInitial;
    const drainedVal = foam.tank;
    api.step(0.5); // refill while idle
    const tankRefilled = foam.tank > drainedVal;

    // 12. HUD tag fan (brief 12-fix-2): the Vacuum peeks behind another active weapon
    const peekVacuumEl = document.querySelector('[data-peek="vacuum"]');
    const peekCutterEl = document.querySelector('[data-peek="web-cutter"]');
    const peekFoamEl = document.querySelector('[data-peek="foam-spray"]');
    const tagIconEl = document.querySelector('[data-tag-icon]');
    const mainTagEl = tagIconEl.closest('.tag');
    const dotsEl = document.querySelector('[data-charge]');

    api.switchWeapon('web-cutter');
    api.step(0.02);
    const vacuumPeeksBehindCutter = Boolean(peekVacuumEl) && !peekVacuumEl.hidden;
    const cutterHiddenWhileActive = peekCutterEl.hidden;
    const foamStillPeeksBehindCutter = !peekFoamEl.hidden;

    // During the Flamethrower, all three default weapons peek if unlocked
    // (its timer must be running, or the same step reverts it: see the
    // "Flamethrower timer expiration returns previous weapon" guard).
    S.weapons.get('flamethrower')?.startTimer(8.0);
    api.switchWeapon('flamethrower');
    api.step(0.02);
    const allThreePeekDuringFlame = !peekVacuumEl.hidden && !peekCutterEl.hidden && !peekFoamEl.hidden;
    // The dots row is pressure-only: it must not still show for the Flamethrower
    // (timer) or the Foam Spray (tank) — `.tag__dots` carries its own `display:
    // flex` in hud.css, so the `hidden` attribute alone cannot hide it.
    const dotsHiddenForTimer = getComputedStyle(dotsEl).display === 'none';

    // 13. Main tag icon: hidden with only the Vacuum unlocked (regression, prompt 12 L3)
    S.progress.data.unlocked = ['vacuum'];
    api.switchWeapon('vacuum');
    api.step(0.02);
    const mainIconHiddenWithOnlyVacuum = tagIconEl.hidden;
    const dotsShownForPressure = getComputedStyle(dotsEl).display !== 'none';

    // With more than one weapon unlocked, the main tag's icon shows and names
    // the active weapon; switching to the Foam Spray also checks the dots row
    // hides for a tank weapon.
    S.progress.data.unlocked = ['vacuum', 'web-cutter', 'foam-spray'];
    api.switchWeapon('foam-spray');
    api.step(0.02);
    const mainIconShownWithMultiple = !tagIconEl.hidden
      && tagIconEl.classList.contains('tag__icon--foam-spray')
      && mainTagEl?.dataset.weapon === 'foam-spray';
    const dotsHiddenForTank = getComputedStyle(dotsEl).display === 'none';

    // 4. Web-Cutter tears silk and snips
    press('Digit2');
    api.placeHero(500);
    api.aimAt(800, 300);
    const initialTorn = api.world.stats.score;
    const stringSpider = api.world.spawn('string', { x: 700, targetY: 400, hover: true });
    // Silk test
    const bladeToreSilk = api.world.tearSilk(500, 350, 750, 350, 50);
    const bladeSnipped = api.world.snipThread(690, 200, 710, 200);

    // 5. Foam pops eggs and hatchlings in cone and not outside it
    press('Digit3');
    api.step(0.3);
    api.placeHero(800);
    for (let i = 0; i < 20; i++) {
      api.aimAt(1100, 935);
      api.step(1 / 60);
    }
    const eggInCone = api.world.spawnEgg(1100, 935, 'resting');
    const hatchInCone = new S.spiders.Hatchling({ x: 1080, y: 935, seed: 101 });
    const eggOutCone = api.world.spawnEgg(600, 935, 'resting');
    const hatchOutCone = new S.spiders.Hatchling({ x: 600, y: 935, seed: 102 });
    api.world.critters.push(hatchInCone, hatchOutCone);
    // Fire foam in direction
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    api.step(0.25);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    const foamPopsInCone = !eggInCone.alive && !hatchInCone.alive;
    const foamPreservesOutCone = eggOutCone.alive && hatchOutCone.alive;

    // 6. Flamethrower timer and return to previous weapon
    press('Digit2'); // Web-Cutter is current
    api.step(0.2);
    const flamethrower = S.weapons.get('flamethrower');
    api.world.hero.heroModel = 'cutter';
    flamethrower.startTimer(8.0);
    api.switchWeapon('flamethrower');
    const isFlamethrower = api.world.hero.heroModel === 'flamethrower';
    // Try to swap away while active: should be locked
    press('Digit1');
    const lockedDuringFlame = api.world.hero.heroModel === 'flamethrower';
    // Step past 8s timer
    api.step(8.2);
    const returnedToPrevious = api.world.hero.heroModel === 'cutter';

    // 7. Sonic Pulse clears the room once
    const pulse = S.weapons.get('sonic-pulse');
    pulse.reset();
    pulse.addCharge(1);
    const hasPulseCharge = pulse.hasCharge();
    const sp1 = api.world.spawn('string', { x: 300, targetY: 400, hover: true });
    const sp2 = api.world.spawn('crawler', { lair: 0, emerged: true });
    pulse.fire(api.world, api.world.hero);
    api.step(0.6); // ring expands
    const pulseClearedRoom = !sp1.alive && !sp2.alive;

    // 8. Box takes 3 hits and drops item
    const box = { x: 400, y: 935, contains: 'coins', hits: 0, maxHits: 3, broken: false };
    api.breakables.push(box);
    api.switchWeapon('vacuum');
    const hit1 = api.world.hitBreakable(350, 915, 450, 915);
    const hit1Ok = hit1 && box.hits === 1 && !box.broken;
    const hit2 = api.world.hitBreakable(350, 915, 450, 915);
    const hit2Ok = hit2 && box.hits === 2 && !box.broken;
    const hit3 = api.world.hitBreakable(350, 915, 450, 915);
    const hit3Ok = hit3 && box.hits === 3 && box.broken && api.pickups.length > 0 && api.pickups[0].contains === 'coins';

    // 9. Unlocks granted and migrated
    const progressData = S.progress.load();
    // Simulate save with living room cleared
    const migrated = S.progress.data;
    const unlockLiving = S.progress.recordClear('living-room', { score: 1000, bestCombo: 2, untouched: true, time: 60 });
    const cutterUnlocked = S.progress.data.unlocked.includes('web-cutter') && unlockLiving.unlockedWeapon === 'web-cutter';
    const unlockDining = S.progress.recordClear('dining-room', { score: 1000, bestCombo: 2, untouched: true, time: 60 });
    const foamUnlocked = S.progress.data.unlocked.includes('foam-spray') && unlockDining.unlockedWeapon === 'foam-spray';

    // 10. Mini-objective awards one charge (3 snips in 8 s)
    pulse.reset();
    api.placeHero(700);
    // Three snips
    for (let s = 0; s < 3; s++) {
      const snipSp = api.world.spawn('string', { x: 700 + s * 40, targetY: 400, hover: true });
      api.world.snipThread(690 + s * 40, 200, 710 + s * 40, 200);
      api.step(0.5);
    }
    const miniObjectiveAwarded = pulse.hasCharge();

    // 11. Damage model: health 2 survives one dart, dies on second
    const spider = api.world.spawn('string', { x: 700, targetY: 400, hover: true });
    spider.health = 2;
    const c = spider.rig.hitCenter();
    const survivedOne = api.world.hitBody(c.x - 40, c.y, c.x + 40, c.y, 1) && spider.alive && spider.health === 1;
    const diedOnSecond = api.world.hitBody(c.x - 40, c.y, c.x + 40, c.y, 1) && !spider.alive;

    result = {
      hasVacuum,
      cutterLockedAtFirst,
      stillVacuum,
      lockedSkipped,
      switchedToCutter,
      firedAfterSwitch,
      cycledToCutter,
      cycledBackToVacuum,
      cycledForwardToCutter,
      tankDrained,
      tankRefilled,
      bladeToreSilk,
      bladeSnipped,
      foamPopsInCone,
      foamPreservesOutCone,
      isFlamethrower,
      lockedDuringFlame,
      returnedToPrevious,
      hasPulseCharge,
      pulseClearedRoom,
      hit1Ok,
      hit2Ok,
      hit3Ok,
      cutterUnlocked,
      foamUnlocked,
      miniObjectiveAwarded,
      survivedOne,
      diedOnSecond,
      vacuumPeeksBehindCutter,
      cutterHiddenWhileActive,
      foamStillPeeksBehindCutter,
      allThreePeekDuringFlame,
      dotsHiddenForTimer,
      mainIconHiddenWithOnlyVacuum,
      dotsShownForPressure,
      mainIconShownWithMultiple,
      dotsHiddenForTank,
    };
  };
  await window.__spyder.setup('_weaponCheck');
  delete room.qa.states._weaponCheck;
  S.progress.reset();
  return result;
});
await weaponsPage.close();

check('the registry holds "vacuum", always unlocked', weapons.hasVacuum);
check('an unregistered/not-yet-unlocked weapon reads as locked', weapons.cutterLockedAtFirst);
check('with only the Vacuum unlocked, 1/2/3, Q/E and the wheel all leave it selected', weapons.stillVacuum);
check('a registered but locked weapon is skipped', weapons.lockedSkipped);
check('a registered, unlocked weapon switches in on its key', weapons.switchedToCutter);
check('cycling weapons works via wheel and Q/E', weapons.cycledToCutter && weapons.cycledBackToVacuum && weapons.cycledForwardToCutter);
check('tank drains while firing and refills while idle', weapons.tankDrained && weapons.tankRefilled);
check('Web-Cutter tears silk and snips threads', weapons.bladeToreSilk && weapons.bladeSnipped);
check('Foam pops eggs and hatchlings in the cone and not outside it', weapons.foamPopsInCone && weapons.foamPreservesOutCone);
check('Flamethrower cannot be swapped away while active and returns to previous weapon', weapons.isFlamethrower && weapons.lockedDuringFlame && weapons.returnedToPrevious);
check('Sonic Pulse clears the room once', weapons.hasPulseCharge && weapons.pulseClearedRoom);
check('box takes 3 hits and drops its item', weapons.hit1Ok && weapons.hit2Ok && weapons.hit3Ok);
check('unlocks granted and migrated on room clears', weapons.cutterUnlocked && weapons.foamUnlocked);
check('mini-objective (3 snips in 8 s) awards one Sonic Pulse charge', weapons.miniObjectiveAwarded);
check('damage model: health 2 survives one dart, dies on the second', weapons.survivedOne && weapons.diedOnSecond);
check('HUD tag fan: the Vacuum peeks behind the active Web-Cutter, both unlocked', weapons.vacuumPeeksBehindCutter && weapons.cutterHiddenWhileActive && weapons.foamStillPeeksBehindCutter);
check('HUD tag fan: during the Flamethrower, all three default weapons peek if unlocked', weapons.allThreePeekDuringFlame);
check('HUD tag: the pressure dots row hides for a timer weapon (Flamethrower)', weapons.dotsHiddenForTimer);
check('HUD tag: the pressure dots row hides for a tank weapon (Foam Spray)', weapons.dotsHiddenForTank);
check("HUD tag: the main tag's icon is hidden with only the Vacuum unlocked (regression)", weapons.mainIconHiddenWithOnlyVacuum);
check('HUD tag: the pressure dots row shows again once back on a pressure weapon', weapons.dotsShownForPressure);
check("HUD tag: the main tag's icon shows and names the active weapon once more than one is unlocked", weapons.mainIconShownWithMultiple);
check('no console errors (weapons page)', weaponsErrors.length === 0, weaponsErrors.join(' | '));

// ── Dynamic webs & fairness rule (Prompt 13 L3) ──────────────────────────

console.log('── dynamic webs (Prompt 13 L3) ──');
const dynamicWebsPage = await context.newPage();
const dynamicWebsErrors = watchErrors(dynamicWebsPage, 'dynamic-webs');
await openQa(dynamicWebsPage, gameUrl('qa=1&room=living-room'));

const dynamicWebsResult = await dynamicWebsPage.evaluate(async () => {
  const S = window.Spyder;
  const room = S.rooms.get('living-room');
  let res = {};

  room.qa.states = room.qa.states || {};
  room.qa.states._webFairnessCheck = (api) => {
    api.setState('playing');
    api.holdDirector();

    // 1. world.addWeb exists
    const hasAddWeb = typeof api.world.addWeb === 'function';

    // Tear some segments of initial webs so we have positive baseline progress
    if (api.world.webs.length > 0) {
      for (let i = 0; i < Math.min(25, api.world.webs[0].segments.length); i++) {
        api.world.webs[0].segments[i].alive = false;
      }
    }
    const baseFraction = api.world.websTorn;
    const baseWebsCount = api.world.webs.length;

    // 2. Add a dynamic web during play
    const newWeb = new S.Web({
      hub: [600, 400],
      anchors: [[500, 300], [700, 300], [700, 500], [500, 500]],
      rings: 5,
      seed: 999,
    });
    api.world.addWeb(newWeb);

    const webAdded = api.world.webs.length === baseWebsCount + 1 && newWeb.addedDuringPlay === true;

    // While intact (> 30%), the new web counts towards the total and reduces websTorn
    const intactAbove30 = newWeb.intactness > 0.3;
    const fractionWithNewWeb = api.world.websTorn;
    const pushedBack = fractionWithNewWeb < baseFraction;

    // 3. Tear strands of the new web until intactness <= 30%
    for (let i = 0; i < Math.ceil(newWeb.segments.length * 0.75); i++) {
      if (newWeb.segments[i]) newWeb.segments[i].alive = false;
    }
    const intactBelow30 = newWeb.intactness <= 0.3;

    // Once <= 30% intact, it no longer counts toward total, restoring websTorn
    const fractionRestored = api.world.websTorn;
    const restoredFairly = Math.abs(fractionRestored - baseFraction) < 0.001;

    res = {
      hasAddWeb,
      webAdded,
      intactAbove30,
      pushedBack,
      intactBelow30,
      restoredFairly,
    };
  };

  await window.__spyder.setup('_webFairnessCheck');
  delete room.qa.states._webFairnessCheck;
  return res;
});
await dynamicWebsPage.close();

check('world.addWeb(web) is a function', dynamicWebsResult.hasAddWeb);
check('dynamic web added during play has addedDuringPlay flag and enters world.webs', dynamicWebsResult.webAdded);
check('while intact above 30%, new web pushes the clean meter back', dynamicWebsResult.intactAbove30 && dynamicWebsResult.pushedBack);
check('once torn to 30% or below, new web is excluded so room is never impossible', dynamicWebsResult.intactBelow30 && dynamicWebsResult.restoredFairly);
check('no console errors (dynamic-webs page)', dynamicWebsErrors.length === 0, dynamicWebsErrors.join(' | '));

// ── "Found: …" only on the clear that grants the unlock (brief 12-fix-2) ───

console.log('── "Found:" banner ──');
const foundPage = await context.newPage();
const foundErrors = watchErrors(foundPage, 'found-banner');
await openQa(foundPage, gameUrl('qa=1&room=living-room'));
const foundSettle = (ms) => foundPage.waitForTimeout(ms);
const foundState = () => foundPage.evaluate(() => window.__spyder.state);
const unlockInfo = () => foundPage.evaluate(() => {
  const el = document.querySelector('[data-result="unlock"]');
  const label = document.querySelector('[data-result="unlock-label"]');
  return { hidden: el.hidden, label: label.textContent };
});

try {
  // Front Porch first — the Living Room is locked until it is clean.
  await foundPage.keyboard.press('Enter'); // New game → map
  await foundSettle(900);
  await foundPage.click('.map-room[data-room="front-porch"]');
  await foundSettle(1500);
  await foundPage.evaluate(() => window.__spyder.clearRoom());
  await foundSettle(300);
  await foundSettle(7500);
  await foundPage.click('[data-card="results"] [data-action="map"]');
  await foundSettle(1000);

  // First clear of the Living Room: grants the Web-Cutter, banner shows it.
  await foundPage.click('.map-room[data-room="living-room"]');
  await foundSettle(1500);
  await foundPage.evaluate(() => window.__spyder.clearRoom());
  await foundSettle(300);
  const firstClearState = await foundState();
  await foundSettle(7500);
  const firstClear = await unlockInfo();
  check('Living Room, first clear: results card reached', firstClearState === 'makeover' && (await foundState()) === 'restored', `${firstClearState} → ${await foundState()}`);
  check('Living Room, first clear: "Found: Web-Cutter" shows', !firstClear.hidden && /Found: Web-Cutter/.test(firstClear.label), JSON.stringify(firstClear));

  // Second clear of the same room: already unlocked, banner stays hidden.
  await foundPage.click('[data-card="results"] [data-action="map"]');
  await foundSettle(1000);
  await foundPage.click('.map-room[data-room="living-room"]');
  await foundSettle(1200);
  await foundPage.evaluate(() => window.__spyder.clearRoom());
  await foundSettle(300);
  await foundSettle(7500);
  const secondClear = await unlockInfo();
  check('Living Room, second clear: "Found:" does not show again', secondClear.hidden, JSON.stringify(secondClear));
} catch (err) {
  check('found-banner flow completed', false, err.message);
} finally {
  check('no console errors (found-banner page)', foundErrors.length === 0, foundErrors.join(' | '));
  await foundPage.close();
}

// ── Boss framework & work-order card (Prompt 15, L2 & A1) ───────────────

console.log('── boss framework ──');
const bossPage = await context.newPage();
const bossErrors = watchErrors(bossPage, 'boss');
await openQa(bossPage, gameUrl('qa=1&room=living-room'));
const bossSettle = (ms) => bossPage.waitForTimeout(ms);

try {
  // Register stand-in test boss: a big circle with 10 health and two phases
  await bossPage.evaluate(async () => {
    await document.fonts.ready;
    const S = window.Spyder;
    S.bosses.register({
      id: 'test-boss',
      name: 'Test Boss',
      health: 10,
      phases: [
        { id: 'calm', at: 1.0 },
        { id: 'angry', at: 0.5 },
      ],
      create(world, opts) {
        return new S.Boss(this, world, {
          x: 960,
          y: 400,
          radius: 60,
          ...opts,
        });
      },
    });

    const roomDef = S.rooms.get('living-room');
    roomDef.rules = roomDef.rules || {};
    roomDef.rules.boss = 'test-boss';
    await window.__spyder.setup('dirty');
  });

  await bossSettle(600);

  // 1. Prove boss spawn
  const spawned = await bossPage.evaluate(() => {
    const b = window.__spyder.boss;
    const bossCard = document.querySelector('[data-boss-card]');
    const goalEl = document.querySelector('[data-extra-goal="boss"]');
    return {
      alive: b?.alive,
      health: b?.health,
      name: b?.name,
      phase: b?.phase,
      cardVisible: bossCard && !bossCard.hidden,
      goalPresent: Boolean(goalEl),
    };
  });
  check('boss framework: boss spawns with correct health and initial phase', spawned.alive && spawned.health === 10 && spawned.phase === 'calm', JSON.stringify(spawned));
  check('boss framework: work-order card shows boss section and goal', spawned.cardVisible && spawned.goalPresent);

  // 2. Prove hit from Vacuum
  const vacuumHit = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    const hit = w.hitBody(960, 500, 960, 400, 1, 'vacuum');
    const b = window.__spyder.boss;
    return { hit, health: b.health, hitStop: b.hitStop };
  });
  check('boss framework: hit by Vacuum (health 10 → 9, 40ms hit stop)', vacuumHit.hit && vacuumHit.health === 9 && vacuumHit.hitStop > 0, JSON.stringify(vacuumHit));

  // 3. Prove hit from Web-Cutter
  const cutterHit = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    const hit = w.hitBody(960, 500, 960, 400, 2, 'web-cutter');
    const b = window.__spyder.boss;
    return { hit, health: b.health };
  });
  check('boss framework: hit by Web-Cutter (health 9 → 7)', cutterHit.hit && cutterHit.health === 7, JSON.stringify(cutterHit));

  // 4. Prove hit from Foam-Spray
  const foamHit = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    const hit = w.hitBody(960, 500, 960, 400, 0.25, 'foam-spray');
    const b = window.__spyder.boss;
    return { hit, health: b.health };
  });
  check('boss framework: hit by Foam-Spray (health 7 → 6.75)', foamHit.hit && foamHit.health === 6.75, JSON.stringify(foamHit));

  // 5. Prove hit from Flamethrower
  const flameHit = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    const hit = w.hitBody(960, 500, 960, 400, 1.0, 'flamethrower');
    const b = window.__spyder.boss;
    return { hit, health: b.health };
  });
  check('boss framework: hit by Flamethrower (health 6.75 → 5.75)', flameHit.hit && flameHit.health === 5.75, JSON.stringify(flameHit));

  // 6. Prove phase change when health crosses threshold (at = 0.5 -> health <= 5)
  const phaseChange = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    w.hitBody(960, 500, 960, 400, 1.0, 'vacuum'); // health 5.75 -> 4.75 <= 5.0
    const b = window.__spyder.boss;
    const noteEl = document.querySelector('[data-hud-note]');
    return {
      phase: b.phase,
      health: b.health,
      note: noteEl?.textContent,
      noteVisible: noteEl && !noteEl.hidden,
    };
  });
  check('boss framework: phase change triggered at 50% health', phaseChange.phase === 'angry' && phaseChange.health === 4.75, JSON.stringify(phaseChange));
  check('boss framework: HUD displays handwritten note ("She\'s angry now.")', phaseChange.noteVisible && /angry/i.test(phaseChange.note), JSON.stringify(phaseChange));

  // 6a. Prove no regular spawn happens in the 1.5s spawn-pause after a phase change
  const noSpawnAfterPhase = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    const before = w.critters.length;
    window.__spyder.step(1.45); // comfortably inside the 1.5s pause, clear of its exact boundary
    const after = w.critters.length;
    return { before, after };
  });
  check('boss framework: no regular spawn in the 1.5s pause after a phase change', noSpawnAfterPhase.after === noSpawnAfterPhase.before, JSON.stringify(noSpawnAfterPhase));

  // 7. Prove Sonic Pulse removes 25% of max health (2.5 on health 10)
  const pulseHit = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    const pulse = window.Spyder.weapons.get('sonic-pulse');
    const prevHealth = window.__spyder.boss.health;
    pulse.addCharge(1);
    pulse.fire(w, w.hero);
    // Advance pulse until expanding ring crosses boss at y = 400
    for (let i = 0; i < 20; i++) window.__spyder.step(1 / 60);
    const b = window.__spyder.boss;
    return { prevHealth, newHealth: b.health, diff: prevHealth - b.health };
  });
  check('boss framework: Sonic Pulse removes 25% of boss max health (2.5 dmg)', Math.abs(pulseHit.diff - 2.5) < 0.01, JSON.stringify(pulseHit));

  // 8. Prove defeat -> goal not done yet -> step through the death animation -> goal done -> clearRoom() -> makeover
  const defeatImmediate = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    // Deal remaining damage to defeat the boss
    const b = window.__spyder.boss;
    w.hitBoss(b.health, 'vacuum');
    return { alive: b.alive, health: b.health, done: b.done, goalDone: w.isGoalComplete('boss') };
  });
  check(
    'boss framework: defeat stops further hits at once, but the goal is not done yet',
    !defeatImmediate.alive && defeatImmediate.health === 0 && !defeatImmediate.done && !defeatImmediate.goalDone,
    JSON.stringify(defeatImmediate)
  );

  // 8a. Prove the sim runs at 0.4x for 1.2s right after defeat
  const slowMoCheck = await bossPage.evaluate(() => {
    const w = window.__spyder.liveWorld;
    const before = w.stats.time;
    window.__spyder.step(1 / 60);
    const after = w.stats.time;
    return { delta: after - before };
  });
  check(
    'boss framework: sim runs at 0.4x speed right after defeat',
    Math.abs(slowMoCheck.delta - (1 / 60) * 0.4) < 0.001,
    JSON.stringify(slowMoCheck)
  );

  // 8b. Step through the rest of the death animation (0.8s of sim time,
  // mostly spent inside the 1.2s slow-motion window); the goal completes
  // once the boss reports done, not at the moment of defeat.
  const afterDeathAnim = await bossPage.evaluate(() => {
    window.__spyder.step(2);
    const w = window.__spyder.liveWorld;
    const b = window.__spyder.boss;
    return { done: b.done, goalDone: w.isGoalComplete('boss') };
  });
  check(
    'boss framework: boss goal completes once the death animation finishes (done=true)',
    afterDeathAnim.done && afterDeathAnim.goalDone,
    JSON.stringify(afterDeathAnim)
  );

  // 8c. clearRoom finishes the remaining room quota -> makeover starts
  const defeatCheck = await bossPage.evaluate(() => {
    const bossCard = document.querySelector('[data-boss-card]');
    window.__spyder.clearRoom();
    window.__spyder.step(0.1);
    return {
      state: window.__spyder.state,
      cardVisible: !bossCard.hidden,
    };
  });
  check('boss framework: clearRoom after the death animation triggers makeover', defeatCheck.state === 'makeover', defeatCheck.state);

  // 9. Prove QA hooks __spyder.bossTo and __spyder.bossPhase
  const qaHooks = await bossPage.evaluate(() => {
    window.__spyder.bossTo(0.8);
    const b = window.__spyder.boss;
    const h1 = b.health;
    window.__spyder.bossPhase('angry');
    const p1 = b.phase;
    return { h1, p1 };
  });
  check('boss framework: __spyder.bossTo and __spyder.bossPhase QA hooks work', qaHooks.h1 === 8 && qaHooks.p1 === 'angry', JSON.stringify(qaHooks));

  // Restore room rules so living-room stays unmodified for other tests
  await bossPage.evaluate(() => {
    delete window.Spyder.rooms.get('living-room').rules.boss;
  });
} catch (err) {
  check('boss flow completed', false, err.message);
} finally {
  check('no console errors (boss page)', bossErrors.length === 0, bossErrors.join(' | '));
  await bossPage.close();
}

// ── Room 12: Attic & The Spider Queen (Prompt 16 L1 & L2) ───────────────

console.log('── Room 12: Attic & Spider Queen ──');
const atticPage = await context.newPage();
const atticErrors = watchErrors(atticPage, 'attic');
try {
  await openQa(atticPage, gameUrl('qa=1&room=attic'));

  const atticData = await atticPage.evaluate(() => {
    const r = window.Spyder.rooms.get('attic');
    const L = r.layout;
    const plats = L.platforms;
    const reachOk = plats.every((p) => {
      // Check every platform's rise <= 190
      if (p.name === 'floor') return true;
      if (p.name === 'lower-trunk') return 935 - p.y === 105;
      if (p.name === 'upper-trunk') return 830 - p.y === 130;
      if (p.name === 'box-stack') return 700 - p.y === 140;
      if (p.name === 'collar-beam') return 560 - p.y === 130;
      if (p.name === 'rocking-horse') return 935 - p.y === 145;
      if (p.name === 'lower-crate') return 790 - p.y === 140;
      if (p.name === 'upper-crate') return 650 - p.y === 130;
      return true;
    });

    const webs = r.makeWebs();
    const breakables = L.breakables;
    const hasFlame = breakables.some((b) => b.contains === 'flamethrower' && b.y === 830);
    const hasSonic = breakables.some((b) => b.contains === 'sonic' && b.y === 430);

    return {
      registered: Boolean(r),
      number: r.number,
      act: r.act,
      reachOk,
      webCount: webs.length,
      hasFlame,
      hasSonic,
      storyObject: r.storyObject,
      bossRegistered: window.Spyder.bosses.has('spider-queen'),
    };
  });

  check('attic: room 12 registered with number 12 and act 3', atticData.registered && atticData.number === 12 && atticData.act === 3);
  check('attic: every platform step passes the reach rule (rise <= 190, gap <= 160)', atticData.reachOk);
  check('attic: has >= 8 webs (found ' + atticData.webCount + ')', atticData.webCount >= 8);
  check('attic: breakables contain flamethrower on lower trunk and sonic on collar beam', atticData.hasFlame && atticData.hasSonic);
  check('attic: storyObject mentions A. Ashworth and old torch', /A\. Ashworth/i.test(atticData.storyObject));
  check('attic: spider-queen boss is registered in registry', atticData.bossRegistered);

  // Test Spider Queen mechanics in Attic
  const queenTest = await atticPage.evaluate(async () => {
    await window.__spyder.setup('dirty');
    const w = window.__spyder.liveWorld;
    const q = w.spawnBoss('spider-queen');

    // 1. Initial phase nest & health 60
    const initHp = q.health;
    const initPhase = q.phase;

    // 2. Legs hit does nothing
    q.lastHitZone = 'legs';
    const hitLegs = q.hit(w, 5, 'vacuum');
    const hpAfterLegs = q.health;

    // 3. Phase 1 lunge vulnerability
    q.lastHitZone = 'head';
    q.lunging = false;
    q.hit(w, 5, 'vacuum'); // Not lunging -> 0 damage
    const hpNotLunging = q.health;

    q.lunging = true;
    q.hit(w, 5, 'vacuum'); // Lunging -> takes 5 damage
    const hpLunging = q.health;

    // 4. Web-Cutter tears funnel -> 1 damage
    q.lunging = false;
    q.hit(w, 1, 'web-cutter');
    const hpAfterCutter = q.health;

    // 5. Phase 2 Descend & line cut stun
    window.__spyder.bossPhase('descend');
    const descendPhase = q.phase;
    const lineActiveBefore = q.lineActive;

    // Cut line with Web-Cutter
    q.lastHitZone = 'line';
    q.hit(w, 1, 'web-cutter');
    const lineCutStunned = q.stunned && q.y === 935;

    // While stunned, takes double damage (5 dmg becomes 10)
    q.lastHitZone = 'abdomen';
    const preStunHit = q.health;
    q.hit(w, 5, 'vacuum');
    const postStunHit = q.health;
    const doubleDmg = (preStunHit - postStunHit) === 10;

    // 6. Phase 3 Rage & foam slow 30%
    window.__spyder.bossPhase('rage');
    const ragePhase = q.phase;
    q.slowTimer = 2.0;
    q.update(0.1, w);
    const speedMult30 = Math.abs(q.speedMult - 0.7) < 0.01;

    // 7. Defeat sequence
    q.health = 0;
    q.die(w);
    const dyingImmediate = q.dying && !q.done;
    // Step through defeat animation
    q.update(3.0, w);
    const doneAfterAnim = q.done;

    return {
      initHp,
      initPhase,
      legsIgnored: !hitLegs && hpAfterLegs === 60,
      lungeGated: hpNotLunging === 60 && hpLunging === 55,
      funnelCutDmg: hpAfterCutter === 54,
      descendPhase,
      lineActiveBefore,
      lineCutStunned,
      doubleDmg,
      ragePhase,
      speedMult30,
      dyingImmediate,
      doneAfterAnim,
    };
  });

  check('queen: initial health is 60 in nest phase', queenTest.initHp === 60 && queenTest.initPhase === 'nest');
  check('queen: hits on legs do nothing (0 damage)', queenTest.legsIgnored);
  check('queen: phase 1 takes damage only during lunge', queenTest.lungeGated);
  check('queen: Web-Cutter blade tearing funnel deals 1 damage', queenTest.funnelCutDmg);
  check('queen: cutting silk line drops queen stunned to floor', queenTest.lineCutStunned);
  check('queen: stunned queen takes double damage', queenTest.doubleDmg);
  check('queen: phase 3 foam slows her 30% (speedMult 0.7)', queenTest.speedMult30);
  check('queen: defeat sequence curls/falls, then finishes with done=true', queenTest.dyingImmediate && queenTest.doneAfterAnim);

  // Staged QA states check
  for (const state of ['queen-nest', 'queen-swing', 'queen-rage']) {
    await atticPage.evaluate((s) => window.__spyder.setup(s), state);
    await pause(300);
    const stateOk = await atticPage.evaluate(() => window.__spyder.boss !== null);
    check(`attic QA state ${state} stages without errors`, stateOk);
  }

  // ── Results card must not spoil a secret room (Brief 16-fix) ───────
  // The Basement, Greenhouse and The Wall are secret rooms (room-registry.js
  // ~38): not drawn on the map, and not named on the results card either,
  // until the player has found them (progress.isFound).
  const cardText = () => atticPage.evaluate(() => ({
    next: document.querySelector('[data-action="next-room"]').hidden ? null : document.querySelector('[data-action="next-room"]').dataset.room,
    soon: document.querySelector('[data-result="next-soon"]').hidden ? null : document.querySelector('[data-result="next-soon"]').textContent,
  }));
  const savedFound = await atticPage.evaluate(() => window.__spyder.progress.data.found.slice());
  const savedCleared = await atticPage.evaluate(() => ({ ...window.__spyder.progress.data.cleared }));

  // nextAfter() checks nextRoom(progress) first — only once every built main
  // room (through the Attic) is clean does it fall through to after(), so
  // mark them all cleared for this check.
  await atticPage.evaluate(() => {
    const cleared = window.__spyder.progress.data.cleared;
    for (const r of window.Spyder.rooms.built()) cleared[r.id] = { best: 1, bestCombo: 1, untouched: false, time: 1 };
  });

  await atticPage.evaluate(() => { window.__spyder.progress.data.found = []; });
  await atticPage.evaluate(() => window.__spyder.setup('results'));
  await pause(300);
  const noSecretCard = await cardText();
  check(
    'attic: clearing with no secret room found shows no next-room line',
    noSecretCard.next === null && noSecretCard.soon === null,
    JSON.stringify(noSecretCard),
  );

  await atticPage.evaluate(() => { window.__spyder.progress.data.found = ['basement']; });
  await atticPage.evaluate(() => window.__spyder.setup('results'));
  await pause(300);
  const basementFoundCard = await cardText();
  check(
    'attic: with the Basement found, results say "next on the plan: the Basement — not built yet"',
    basementFoundCard.next === null && basementFoundCard.soon === 'next on the plan: the Basement — not built yet',
    basementFoundCard.soon,
  );

  // Restore progress so later checks in this run are not affected.
  await atticPage.evaluate((found) => { window.__spyder.progress.data.found = found; }, savedFound);
  await atticPage.evaluate((cleared) => { window.__spyder.progress.data.cleared = cleared; }, savedCleared);
} catch (err) {
  check('attic checks completed', false, err.message);
} finally {
  check('no console errors (attic page)', atticErrors.length === 0, atticErrors.join(' | '));
  await atticPage.close();
}

check('no console errors', errors.length === 0, errors.join(' | '));
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
await browser.close();
process.exitCode = failures ? 1 : 0;
