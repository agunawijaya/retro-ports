/**
 * @file Shared helpers for the three QA tools (rooms-check.mjs, perf.mjs, regress.mjs):
 * starting a throwaway Vite dev server for the game, launching the same browser
 * `review.mjs` uses, and reading `window.hening` defensively so a game that does
 * not implement part of the QA contract yet is reported, not crashed on.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root of the `game/` package (parent of `tools/`). */
export const GAME_DIR = path.resolve(__dirname, '..', '..');

/**
 * Starts a Vite dev server rooted at `game/` on a free port, so the tools can
 * load `index.html` from source with no build step.
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function startDevServer() {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: GAME_DIR,
    logLevel: 'error',
    server: { port: 0, strictPort: false },
  });
  await server.listen();
  const urls = server.resolvedUrls;
  const url = (urls && urls.local && urls.local[0]) || `http://localhost:${server.config.server.port}/`;
  return {
    url,
    async close() {
      await server.close();
    },
  };
}

/**
 * Resolves the base URL a tool should load pages from: `--url` wins (it may be
 * a `file://` path, e.g. the reference or a built `dist/hening.html`), otherwise
 * a throwaway dev server is started for `game/`.
 * @param {string|undefined} urlArg value of a parsed `--url` flag
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function resolveTarget(urlArg) {
  if (urlArg) {
    return { url: urlArg, close: async () => {} };
  }
  return startDevServer();
}

/**
 * Launches the same headless Edge/Chrome the rest of this project's QA tools
 * use, with SwiftShader so WebGL works with no GPU.
 * @returns {Promise<import('playwright-core').Browser>}
 */
export async function launchBrowser() {
  return chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
}

/**
 * Attaches console/page-error collection to a page. Call before navigating.
 * @param {import('playwright-core').Page} page
 * @returns {string[]} array that fills with error strings as they occur
 */
export function collectConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));
  return errors;
}

/**
 * Seeds `Math.random` with a fixed mulberry32 generator before any page script
 * runs, the same technique `shoot-reference.mjs` uses, so frames are
 * reproducible across runs and across the reference/game pair.
 * @param {import('playwright-core').Page} page
 * @param {number} seed
 */
export async function seedRandom(page, seed) {
  await page.addInitScript((s) => {
    function mulberry32(a) {
      return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    Math.random = mulberry32(s);
  }, seed);
}

/**
 * Calls a `window.hening` method defensively: resolves `{ ok, value, reason }`
 * instead of throwing, so a missing hook (the game not implementing a QA call
 * yet) is reported as data rather than crashing the tool.
 * @param {import('playwright-core').Page} page
 * @param {string} body JS body to run inside `page.evaluate`, in scope of
 *   `window`; wrapped in `(async () => { ... })()`. Use `window.hening` inside it.
 * @returns {Promise<{ ok: boolean, value: any, reason: string|null }>}
 */
export async function tryHening(page, body) {
  try {
    const value = await page.evaluate(`(async () => { ${body} })()`);
    return { ok: true, value, reason: null };
  } catch (err) {
    return { ok: false, value: undefined, reason: String(err && err.message ? err.message : err) };
  }
}

/**
 * Checks whether `window.hening` exists at all on the page (vs. a specific
 * call being missing), used to tell "game not booted yet" apart from
 * "this one QA hook isn't implemented".
 * @param {import('playwright-core').Page} page
 * @returns {Promise<boolean>}
 */
export async function heningPresent(page) {
  try {
    return await page.evaluate(() => typeof window.hening === 'object' && window.hening !== null);
  } catch {
    return false;
  }
}

/**
 * Waits for `window.hening` to appear. `dev/qa.js` is loaded by a dynamic
 * import, so it is not necessarily present the instant `page.goto`/`reload`
 * resolves - on a first navigation the import's own network fetch tends to
 * keep `waitUntil: 'networkidle'` open long enough to cover it, but after a
 * reload (cached module, no network wait) the QA hook can still be attaching
 * after `load`/`networkidle` fire. Resolves `true` once it appears, or
 * `false` after `timeout` ms (never throws, so a target that never
 * implements the hook is reported, not crashed on).
 * @param {import('playwright-core').Page} page
 * @param {number} [timeout]
 * @returns {Promise<boolean>}
 */
export async function waitForHening(page, timeout = 5000) {
  try {
    await page.waitForFunction(() => typeof window.hening === 'object' && window.hening !== null, null, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds a page URL with query parameters appended, working for both
 * `http://` dev-server URLs and `file://` URLs (e.g. the reference), the
 * latter simply ignoring params it does not read.
 * @param {string} base
 * @param {Record<string, string|number>} params
 * @returns {string}
 */
export function withParams(base, params) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  if (!qs) return base;
  return base.includes('?') ? `${base}&${qs}` : `${base}?${qs}`;
}

/**
 * Parses a `--rooms 1,6,50` style comma-separated list of integers.
 * @param {string} value
 * @returns {number[]}
 */
export function parseRoomList(value) {
  return value
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

/**
 * Tiny CLI flag reader: `--name value` and `--name` (boolean) forms.
 * @param {string[]} argv
 * @returns {Record<string, string|boolean>}
 */
export function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    }
  }
  return flags;
}
