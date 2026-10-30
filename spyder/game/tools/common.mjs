// Shared helpers for the QA tools: find a browser, open a page in QA mode,
// and make a render reproducible.

import { chromium } from 'playwright-core';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export const gameRoot = resolve(here, '..');
export const spyderRoot = resolve(gameRoot, '..');

export const gameUrl = (query = 'qa=1&room=living-room') => `${pathToFileURL(join(gameRoot, 'index.html')).href}?${query}`;
export const referenceUrl = () => `${pathToFileURL(join(spyderRoot, 'reference', 'living-room.html')).href}?qa=1`;

// Use the Edge or Chrome already installed (no browser download needed).
export async function launch(args = []) {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, args });
    } catch {
      // try the next installed browser
    }
  }
  throw new Error('Neither Microsoft Edge nor Google Chrome could be started.');
}

// Collect everything that would show as red in the console.
export function watchErrors(page, label) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[${label}] ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      // A room registered with art: true but no art.js yet plays on the
      // blockout; the browser's "could not load art.js" is expected then.
      // Real errors raised inside an art.js are still reported.
      const url = m.location()?.url || '';
      const missing = /Failed to load resource|ERR_FILE_NOT_FOUND|net::ERR/i.test(m.text());
      if (missing && /art\.js/i.test(url + ' ' + m.text())) return;
      errors.push(`[${label}] console: ${m.text()}`);
    }
  });
  return errors;
}

export async function openQa(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.__spyder && window.__spyder.ready, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
}

/*
 * Make a frame reproducible: a seeded Math.random (grain offsets, blinks,
 * the sweep's dust) and a requestAnimationFrame that can be parked, so the
 * page does not draw over a staged frame with a fresh random grain.
 */
export const reproducible = () => {
  const realRaf = window.requestAnimationFrame.bind(window);
  window.__parkRaf = false;
  // A frame already queued when the loop is parked is dropped, not run late.
  window.requestAnimationFrame = (cb) => realRaf((t) => {
    if (!window.__parkRaf) cb(t);
  });
  let s = 1;
  window.__reseed = (seed) => {
    s = seed >>> 0 || 1;
  };
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Park the loop, reseed, stage the state: the same call sequence draws the same frame.
export async function stage(page, name, seed = 1234) {
  await page.evaluate(() => (window.__parkRaf = true));
  await page.waitForTimeout(120); // let the frame already in flight finish
  await page.evaluate(
    async ({ n, s }) => {
      window.__reseed(s);
      await window.__spyder.setup(n);
    },
    { n: name, s: seed }
  );
}
