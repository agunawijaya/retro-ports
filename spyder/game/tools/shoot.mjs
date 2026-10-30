// Render the game's QA states at 1920 × 1080, using the Edge or Chrome
// already installed on this machine.
//
//   cd game/tools
//   npm install                       (once: installs playwright-core only)
//   node shoot.mjs --hero             shell + every registered room into review/current/
//   node shoot.mjs --hero --room=<id> one room (or 'shell') into review/current/<id>/
//   node shoot.mjs [out-folder] [states] [--room=living-room]
//
// Scratch shots default to .scratch/shoot/ as JPEG.

import { mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { gameUrl, launch, openQa, watchErrors } from './common.mjs';
import { saveHero, scratchDir } from './review.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [key, value] = a.slice(2).split('=');
      return [key, value ?? true];
    })
);
const plain = args.filter((a) => !a.startsWith('--'));
const roomArg = typeof flags.room === 'string' ? flags.room : null;

const SHELL_STATES = ['title', 'map', 'settings', 'howto'];
const ROOM_STATES = ['dirty', 'action', 'makeover', 'clean', 'results'];

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = watchErrors(page, roomArg || 'shoot');

if (flags.hero) {
  await openQa(page, gameUrl('qa=1&room=living-room'));
  const registered = await page.evaluate(() =>
    window.Spyder.rooms.built().map((r) => ({
      id: r.id,
      extras: Object.keys(r.qa?.states || {}).filter((k) => !k.startsWith('_')),
    }))
  );

  if (!roomArg || roomArg === 'shell') {
    for (const state of SHELL_STATES) {
      await page.evaluate((n) => window.__spyder.setup(n), state);
      await page.waitForTimeout(state.startsWith('map') ? 900 : 750);
      const file = await saveHero(page, 'shell', state);
      console.log('saved', file);
    }
  }

  const roomsToShoot =
    roomArg === 'shell'
      ? []
      : roomArg
        ? registered.filter((r) => r.id === roomArg)
        : registered;

  if (roomArg && roomArg !== 'shell' && roomsToShoot.length === 0) {
    throw new Error(`Unknown or unbuilt room "${roomArg}".`);
  }

  for (const r of roomsToShoot) {
    await openQa(page, gameUrl(`qa=1&room=${r.id}`));
    await page.addStyleTag({ content: '#hud{transition:none!important}' });
    const states = [...ROOM_STATES, ...r.extras.filter((s) => !ROOM_STATES.includes(s))];
    for (const state of states) {
      await page.evaluate((n) => window.__spyder.setup(n), state);
      await page.waitForTimeout(750);
      await page.screenshot({ clip: { x: 0, y: 0, width: 10, height: 10 } });
      const file = await saveHero(page, r.id, state);
      console.log('saved', file);
    }
  }
} else {
  const room = roomArg || 'living-room';
  const outDir = resolve(plain[0] ?? scratchDir('shoot'));
  mkdirSync(outDir, { recursive: true });
  const states = (plain[1] ?? 'title,map,map-cleared,settings,howto,dirty,action,makeover,clean,results,pause,fled').split(',');

  await openQa(page, gameUrl(`qa=1&room=${room}`));
  for (const state of states) {
    await page.evaluate((n) => window.__spyder.setup(n), state);
    await page.waitForTimeout(state.startsWith('map') ? 900 : 750);
    const hasExt = Boolean(extname(state));
    const file = join(outDir, hasExt ? state : `${state}.jpg`);
    const isPng = file.toLowerCase().endsWith('.png');
    await page.screenshot(isPng ? { path: file } : { path: file, type: 'jpeg', quality: 90 });
    console.log('saved', file);
  }
}

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exitCode = errors.length ? 1 : 0;
