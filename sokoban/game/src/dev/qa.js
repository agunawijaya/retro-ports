/**
 * @file `window.hening` — the QA handle, enabled by `?qa=1`.
 *
 * A superset of the reference's `window.hening` (reference section 18) plus
 * the additions `ARCHITECTURE.md` §10 lists: `room(n)`, `level(0..2)`,
 * `theme(id)`, `freezeTime(on)`, `solve()`, `inspect()`, `frameStats(ms)`,
 * and `screen()` / `progress()`. Prompt 02 §10 adds `current()`,
 * `screenInfo()`, `renderStats()` and `settings()`, for `tools/flow.mjs` and
 * `tools/perf.mjs` to poll the tower screens the same way. Everything else
 * forwards straight to the room screen's exported functions — this file does
 * not re-implement any rule or animation itself.
 */

import * as room from '../screens/room.js';
import * as courtyard from '../screens/courtyard.js';
import * as floorScreen from '../screens/floor.js';
import * as elevator from '../screens/elevator.js';
import * as gardenScreen from '../screens/garden.js';
import * as gardenEditor from '../screens/garden-editor.js';
import * as progressState from '../state/progress.js';
import * as gardenState from '../state/garden.js';
import { setSessionMode } from '../state/mode.js';
import { getSettings } from '../state/settings.js';
import { getRenderer } from '../render/renderer.js';

/** Base screens that export their own `inspect()` (prompt 02 §10's `screenInfo()`). */
const SCREEN_INSPECTORS = { courtyard, floor: floorScreen, elevator, garden: gardenScreen, 'garden-editor': gardenEditor };

/** Overlay screens, and the base screen each one needs active underneath it. */
const OVERLAY_BASE = {
  results: 'room',
  pause: 'room',
  records: 'courtyard',
  settings: 'courtyard',
  notice: 'courtyard',
  'gate-choice': 'courtyard',
};

const BASE_NAMES = new Set(['title', 'courtyard', 'elevator', 'floor', 'room', 'ending', 'dream', 'garden', 'garden-editor']);

/** `screen('results')` with no stats of its own gets these, for test determinism. */
const PLACEHOLDER_RESULTS = { steps: 128, pushes: 41, isRecord: false, solvedLine: 'Semua lentera menyala' };

/**
 * @param {{ sound: object, startGame: () => void, router: { goto: Function, open: Function, close: Function, top: Function, baseName: Function } }} controller
 *   The pieces `main.js` owns that qa.js does not: the shared audio engine,
 *   the exact function the start-veil tap runs (`hening.start()` must do
 *   the same thing — `room.start()`, hide the veil, focus the canvas — not
 *   a duplicate of it), and the router.
 */
export function install(controller = {}) {
  const hening = {
    start: () => controller.startGame?.(),
    setMood: (i) => room.setMood(i, true),
    rotate: (delta) => room.rotate(delta),
    closeUp: (z) => room.closeUp(z),
    focus: (x, z, zoom) => room.focus(x, z, zoom),
    face: (d) => room.face(d),
    scrub: (name, t, step) => room.scrub(name, t, step),
    arrange: (n) => room.arrange(n),
    skipIntro: () => room.skipIntro(),
    where: () => room.where(),
    undo: () => room.undo(),
    play: (name) => room.play(name),
    solve: () => room.solve(),
    freezeTime: (on) => room.freezeTime(on),
    theme: (id) => room.setTheme(id),

    mode: (m) => {
      setSessionMode(m);
      room.setRoomMode(m);
    },
    dupaLeft: (ms) => room.setDupaLeft(ms),
    garden: (json) => {
      if (json) gardenState.setGarden(json);
      return JSON.parse(JSON.stringify(gardenState.getGarden()));
    },
    idle: () => courtyard.startDream(),
    helper: () => room.triggerHelper(),

    // Open a room directly, or reference-compatible level(0..2) -> rooms 5-7.
    room: (n, opts) => room.room(n, opts),
    level: (i) => room.room(5 + i, { intro: false }),

    /**
     * Arrives at a screen directly, for test scripts. Base screens go
     * through the router's `goto(name, params, { instant: true })`.
     * Overlay screens first bring up the base they need (instantly) if it
     * isn't already active, then `open(name, params)`. Never animated —
     * instant, for test determinism.
     * @param {string} name
     * @param {object} [params]
     */
    screen: async (name, params = {}) => {
      const router = controller.router;
      if (!router) return;
      if (BASE_NAMES.has(name)) {
        await router.goto(name, params, { instant: true });
        return;
      }
      const neededBase = OVERLAY_BASE[name];
      if (neededBase && router.baseName() !== neededBase) {
        // goto() closes every overlay when it runs, so wait for it before opening.
        await router.goto(neededBase, neededBase === 'room' ? { room: params.room ?? 1 } : {}, { instant: true });
      }
      let overlayParams = params;
      if (name === 'results' && !('steps' in params)) {
        overlayParams = { room: params.room ?? 1, ...PLACEHOLDER_RESULTS, ...params };
      }
      router.open(name, overlayParams);
    },

    /**
     * With `{ solvedUpTo }`: fakes a mid-game save — rooms 1..solvedUpTo
     * solved in `bebas` mode with varied, deterministic placeholder records
     * (the solver is not run), `open` set to solvedUpTo + 1, and every
     * fully-covered floor lit. Saved via `state/progress.js`'s in-memory
     * store, so the running game sees it immediately. Does not navigate
     * anywhere itself.
     *
     * With no argument: returns a copy of the current in-memory progress.
     * @param {{ solvedUpTo: number }} [json]
     */
    progress: (json) => {
      if (!json) return JSON.parse(JSON.stringify(progressState.getProgress()));
      const { solvedUpTo } = json;
      const p = progressState.defaultProgress();
      for (let n = 1; n <= solvedUpTo; n++) {
        const pushes = 18 + ((n * 7) % 23);
        const steps = pushes * 3 + ((n * 13) % 40);
        progressState.recordSolve(p, n, 'bebas', { steps, pushes });
      }
      progressState.openRoom(p, solvedUpTo);
      for (let floorNum = 1; floorNum <= 5; floorNum++) {
        if (progressState.isFloorLit(p, floorNum)) progressState.markFloorLit(p, floorNum);
      }
      progressState.setProgress(p);
      return undefined;
    },

    /** The router's own names, for test scripts polling a state change. */
    current: () => ({ base: controller.router?.baseName() ?? null, top: controller.router?.top() ?? null }),

    /**
     * The current base screen's own `inspect()`, for the base screens that
     * have one (`courtyard`, `floor`, `elevator`) — `null` for every other
     * base, including `room` (which keeps its own `hening.inspect()`).
     */
    screenInfo: () => {
      const name = controller.router?.baseName();
      const mod = name ? SCREEN_INSPECTORS[name] : null;
      return mod?.inspect ? mod.inspect() : null;
    },

    /** The one shared renderer's per-frame draw-call and triangle counts. */
    renderStats: () => {
      const shared = getRenderer();
      if (!shared) return null;
      const r = shared.renderer.info.render;
      return { calls: r.calls, triangles: r.triangles };
    },

    /** Three.js memory counts (geometries, textures, programs). */
    memoryInfo: () => {
      const shared = getRenderer();
      if (!shared) return null;
      const info = shared.renderer.info;
      return {
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs ? info.programs.length : 0,
      };
    },

    /** A copy of the current settings (theme, volume, reduced motion, hints). */
    settings: () => JSON.parse(JSON.stringify(getSettings())),

    get decor() {
      return room.getDecor();
    },
    get state() {
      return room.getState();
    },

    inspect: () => room.inspect(),

    /**
     * Measures frame pacing for `ms` milliseconds using `requestAnimationFrame`.
     * @param {number} ms
     * @returns {Promise<{ frames: number, avgMs: number, p95Ms: number }>}
     */
    frameStats(ms) {
      return new Promise((resolve) => {
        const samples = [];
        let last = performance.now();
        const start = last;
        function tick(now) {
          samples.push(now - last);
          last = now;
          if (now - start < ms) {
            requestAnimationFrame(tick);
            return;
          }
          const frames = samples.length;
          const avgMs = samples.reduce((a, b) => a + b, 0) / Math.max(1, frames);
          const sorted = [...samples].sort((a, b) => a - b);
          const p95Ms = sorted[Math.floor(sorted.length * 0.95)] ?? avgMs;
          resolve({ frames, avgMs, p95Ms });
        }
        requestAnimationFrame(tick);
      });
    },
  };

  window.hening = hening;
  return hening;
}
