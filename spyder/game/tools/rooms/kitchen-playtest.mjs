// Play the Kitchen from start to finish, through real mouse and keyboard
// input, and check what prompt 02 asks to confirm:
//
//   1. the first Jumper comes alone, with the slow (0.9 s) crouch
//   2. a Jumper shot in mid-air is "Swatted!" (+100 on top of its 180)
//   3. the makeover runs its unique beat: fridge shuts, tap runs brown then
//      clear, kettle whistles
//   4. the results card names the recipe card
//   5. the house map shows the Kitchen as CLEAN
//
//   cd game/tools && node rooms/kitchen-playtest.mjs [out-folder]
//
// Shots go to .scratch/kitchen-play/ (git-ignored).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gameUrl, launch, openQa, watchErrors } from '../common.mjs';
import { scratchDir } from '../review.mjs';

const outDir = resolve(process.argv[2] ?? scratchDir('kitchen-play'));
mkdirSync(outDir, { recursive: true });

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = watchErrors(page, 'kitchen');
await openQa(page, gameUrl('qa=1&room=kitchen'));

// Watch the room from inside: keep its world, log kills and hurts, and
// follow every Jumper through its states.
await page.evaluate(() => {
  const room = window.Spyder.rooms.get('kitchen');
  const onStart = room.onStart;
  room.onStart = function (world, info) {
    const result = onStart.call(this, world, info);
    window.__kw = world;
    const log = (window.__log = { kills: [], hurts: [], jumpers: [], beat: [] });
    let scoreBefore = 0;
    world.on('dart', () => {
      scoreBefore = world.stats.score;
    });
    world.on('kill', ({ critter, how }) => {
      log.kills.push({ kind: critter.kind, how, state: critter.state, t: +world.time.toFixed(2), gained: world.stats.score - scoreBefore, combo: world.stats.combo });
    });
    world.on('hurt', ({ nerve }) => log.hurts.push({ t: +world.time.toFixed(2), nerve, face: world.hero.expression }));
    return result;
  };
  const seen = new Map();
  const watch = () => {
    const w = window.__kw;
    if (w && window.__log) {
      for (const c of w.critters) {
        if (c.kind !== 'jumper') continue;
        let j = seen.get(c);
        if (!j) {
          const others = w.critters.filter((o) => o !== c && o.alive && window.Spyder.countsForQuota(o)).length;
          j = { n: seen.size + 1, first: c.first, crouchTime: c.crouchTime, lair: c.lair.label, appeared: +w.time.toFixed(2), othersAlive: others, states: [] };
          seen.set(c, j);
          window.__log.jumpers.push(j);
        }
        const last = j.states[j.states.length - 1];
        if (!last || last.s !== c.state) j.states.push({ s: c.state, t: +w.time.toFixed(2) });
      }
      if (w.mk.t >= 0) window.__log.beat.push({ t: +w.mk.t.toFixed(2), shut: +(w.mk.fridgeShut ?? 0).toFixed(2), tap: +(w.mk.tap ?? 0).toFixed(2), clear: +(w.mk.tapClear ?? 0).toFixed(2), steam: Boolean(w.mk.steamUntil) });
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
});

// Into the room through the real transition.
await page.evaluate(() => window.__spyder.enterRoom('kitchen'));
await page.waitForTimeout(1500);
const startState = await page.evaluate(() => window.__spyder.state);
console.log('entered the Kitchen, state:', startState);

// What the bot needs each tick.
const look = () =>
  page.evaluate(() => {
    const w = window.__kw;
    const h = w.hero;
    const head = h.headCenter();
    const critters = w.critters
      .filter((c) => c.alive)
      .map((c) => {
        const p = c.rig ? c.rig.hitCenter() : { x: c.x, y: c.y };
        return { kind: c.kind, state: c.state, x: p.x, y: p.y, vx: c.vx ?? 0, vy: c.vy ?? 0, age: c.age ?? 0, hidden: Boolean(c.rig && c.rig.hidden) };
      });
    const silk = [];
    const webs = [];
    w.webs.forEach((web, i) => {
      const alive = web.segments.filter((s) => s.alive);
      webs.push(Math.round((alive.length / web.total) * 100));
      if (!alive.length) return;
      const seg = alive[Math.floor(Math.random() * alive.length)];
      const { a, b } = web.segmentCurve(seg, w.time);
      silk.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, web: i, left: alive.length });
    });
    silk.sort((p, q) => q.left - p.left);
    let alive = 0;
    let total = 0;
    for (const web of w.webs) {
      alive += web.aliveCount;
      total += web.total;
    }
    return { state: w.state, hero: { x: h.x, y: h.y, head }, critters, silk, webs, kills: w.stats.kills, quota: w.rules.quota, score: w.stats.score, nerve: h.nerve, torn: 1 - alive / total, time: w.time };
  });
let lastReport = 0;

const keyFor = (dir) => (dir < 0 ? 'KeyA' : 'KeyD');
let mouseDown = false;
let walking = null;
let walkUntil = 0;
let fled = 0;
let silkTurn = 0;
let bestTorn = 0;
let tornAt = Date.now();
const t0 = Date.now();

while (Date.now() - t0 < Number(process.env.PLAY_SECONDS ?? 260) * 1000) {
  const s = await look();
  if (s.state === 'makeover' || s.state === 'restored') break;
  if (s.state === 'fled') {
    fled++;
    console.log('the hero fled; trying again');
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(800);
    continue;
  }
  const now = Date.now();
  if (now - lastReport > 15000) {
    lastReport = now;
    const kinds = {};
    for (const c of s.critters) kinds[`${c.kind}:${c.state}${c.hidden ? '(hidden)' : ''}`] = (kinds[`${c.kind}:${c.state}${c.hidden ? '(hidden)' : ''}`] || 0) + 1;
    console.log(`t ${s.time.toFixed(0)} s · spiders ${s.kills}/${s.quota} · silk torn ${(s.torn * 100).toFixed(0)}% (left per web ${s.webs.join('/')}%) · hero x ${s.hero.x.toFixed(0)} · nerve ${s.nerve} · out: ${JSON.stringify(kinds)}`);
  }
  if (s.torn > bestTorn + 0.002) {
    bestTorn = s.torn;
    tornAt = now;
  } else if (now - tornAt > 3000 && !walking) {
    walking = keyFor(Math.random() < 0.5 ? -1 : 1);
    if (s.hero.x < 300) walking = 'KeyD';
    if (s.hero.x > 1600) walking = 'KeyA';
    walkUntil = now + 500 + Math.random() * 700;
    tornAt = now;
    await page.keyboard.down(walking);
  }
  if (walking && now > walkUntil) {
    await page.keyboard.up(walking);
    walking = null;
  }

  const out = s.critters.filter((c) => !c.hidden && (c.kind !== 'jumper' || c.state === 'leap' || c.age > 9));
  const rank = (c) => (c.kind === 'jumper' ? 0 : c.kind === 'egg' ? 2 : c.kind === 'string' ? 3 : 4);
  out.sort((a, b) => rank(a) - rank(b) || Math.hypot(a.x - s.hero.x, a.y - s.hero.y) - Math.hypot(b.x - s.hero.x, b.y - s.hero.y));
  let target = out[0];
  let aim;
  if (target) {
    const d = Math.hypot(target.x - s.hero.head.x, target.y - s.hero.head.y);
    const lead = target.kind === 'jumper' && target.state === 'leap' ? d / 1700 + 0.06 : 0;
    aim = { x: target.x + target.vx * lead, y: target.y + target.vy * lead + (lead ? 0.5 * 2200 * lead * lead : 0) };
  } else if (s.silk.length) {
    target = s.silk[silkTurn++ % s.silk.length];
    aim = target;
  }

  const crouching = s.critters.find((c) => c.kind === 'jumper' && c.state === 'crouch' && Math.abs(c.x - s.hero.x) < 520);
  if (crouching && !walking) {
    walking = keyFor(s.hero.x < crouching.x ? -1 : 1);
    if (s.hero.x < 200) walking = 'KeyD';
    if (s.hero.x > 1720) walking = 'KeyA';
    walkUntil = now + 320;
    await page.keyboard.down(walking);
  } else if (!walking && !target) {
    walking = keyFor(s.hero.x > 960 ? -1 : 1);
    walkUntil = now + 400;
    await page.keyboard.down(walking);
  }

  if (aim) {
    await page.mouse.move(Math.round(aim.x), Math.round(aim.y));
    if (!mouseDown) {
      await page.mouse.down();
      mouseDown = true;
    }
  } else if (mouseDown) {
    await page.mouse.up();
    mouseDown = false;
  }
  await page.waitForTimeout(40);
}
if (mouseDown) await page.mouse.up();
if (walking) await page.keyboard.up(walking);

const played = (Date.now() - t0) / 1000;
const stateAtEnd = await page.evaluate(() => window.__spyder.state);
console.log(`played ${played.toFixed(0)} s, state: ${stateAtEnd}, fled ${fled} time(s)`);

const shots = [[3.9, 'beat-tap-brown'], [4.5, 'beat-tap-clear'], [5.05, 'beat-kettle']];
for (const [at, name] of shots) {
  await page.waitForFunction((t) => window.__kw.mk.t >= t || window.__spyder.state === 'restored', at, { timeout: 15000 });
  await page.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 85 });
}
await page.waitForFunction(() => window.__spyder.state === 'restored', null, { timeout: 15000 });
await page.waitForTimeout(900);
const found = await page.evaluate(() => document.querySelector('[data-result="found"]').textContent);
await page.screenshot({ path: join(outDir, 'results.jpg'), type: 'jpeg', quality: 85 });

await page.click('[data-card="results"] [data-action="map"]');
await page.waitForTimeout(1500);
const map = await page.evaluate(() => {
  const b = document.querySelector('.map-room[data-room="kitchen"]');
  return { screen: window.__spyder.screen, kitchen: b ? b.className : null, label: b ? b.getAttribute('aria-label') : null };
});
await page.screenshot({ path: join(outDir, 'map.jpg'), type: 'jpeg', quality: 85 });

const log = await page.evaluate(() => window.__log);
writeFileSync(join(outDir, 'log.json'), JSON.stringify(log, null, 1));

// ── Checks ──────────────────────────────────────────────────────────
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};
const first = log.jumpers[0];
check('a Jumper was sent', Boolean(first), `${log.jumpers.length} in all`);
if (first) {
  check('the first Jumper came alone', first.first && first.othersAlive === 0, `${first.othersAlive} other spiders out, from ${first.lair}`);
  check('its crouch is the slow one', first.crouchTime === 0.9, `${first.crouchTime} s`);
  const c = first.states.findIndex((x) => x.s === 'crouch');
  if (c >= 0 && first.states[c + 1]) {
    const held = first.states[c + 1].t - first.states[c].t;
    check('…and it really held it that long', Math.abs(held - 0.9) < 0.1, `${held.toFixed(2)} s, then ${first.states[c + 1].s}`);
  } else check('…and it crouched at least once', false, JSON.stringify(first.states));
  const later = log.jumpers.slice(1).find((j) => j.states.some((x) => x.s === 'crouch'));
  if (later) check('later Jumpers crouch for 0.45 s', later.crouchTime === 0.45, `${later.crouchTime} s`);
}
const swats = log.kills.filter((k) => k.kind === 'jumper' && k.state === 'tumble');
check('a Jumper was swatted mid-air', swats.length > 0, `${swats.length} swatted, ${log.kills.filter((k) => k.kind === 'jumper').length} Jumpers killed`);
if (swats[0]) check('…for 180 + 100, times the combo', swats[0].gained === 280 * swats[0].combo, `gained ${swats[0].gained} at ×${swats[0].combo}`);
const grounded = log.kills.find((k) => k.kind === 'jumper' && k.state !== 'tumble');
if (grounded) check('a Jumper shot on the ground earns no bonus', grounded.gained === 180 * grounded.combo, `gained ${grounded.gained} at ×${grounded.combo}`);
const at = (t) => log.beat.find((b) => b.t >= t) || {};
check('the fridge is open before the beat and shut after it', at(3.3).shut === 0 && at(3.8).shut >= 1, `${at(3.3).shut} → ${at(3.8).shut}`);
check('the tap runs brown, then clear, then stops', at(3.9).tap > 0.9 && at(3.9).clear === 0 && at(4.6).clear === 1 && at(5.15).tap === 0, `t 3.9 tap ${at(3.9).tap} clear ${at(3.9).clear}; 4.6 clear ${at(4.6).clear}; 5.15 tap ${at(5.15).tap}`);
check('the kettle whistled', Boolean(at(4.9).steam));
check('the results card names the recipe card', /recipe card/.test(found), found);
check('the map shows the Kitchen clean', map.screen === 'map' && /map-room--cleared/.test(map.kitchen || ''), map.kitchen);
console.log('hurts:', JSON.stringify(log.hurts));
check('no console errors', errors.length === 0, errors.join(' | '));
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
await browser.close();
process.exitCode = failures ? 1 : 0;
