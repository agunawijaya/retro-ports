/**
 * @file Boot and the screen router (`ARCHITECTURE.md` §7.3).
 *
 * One renderer's worth of shared context (`canvas`, `hud`, `router`,
 * `sound`), one audio engine, one `requestAnimationFrame` loop. Every
 * screen module exports `enter(ctx, params)`, `update(dt, t)`, `exit()`,
 * and may export an `input` object of action handlers — the router only
 * ever dispatches input to the top-most screen (the top overlay, or the
 * base screen if none is open).
 *
 * `router.goto()` switches the *base* screen behind a veil fade (or a real
 * cross-fade) through the current mood's fog colour (`ART-DIRECTION.md`
 * §9, §13). `router.open()`/`close()` push/pop *overlay* screens on top of
 * the base without touching it — the base keeps updating and rendering
 * underneath, exactly as it would with no overlay open.
 */

import { createHud } from './ui/hud.js';
import { bindInput } from './ui/input.js';
import { sound } from './audio/sound.js';
import { moodState, MOODS } from './render/moods.js';
import { getSettings, onSettingsChange, reducedMotion } from './state/settings.js';
import * as title from './screens/title.js';
import * as courtyard from './screens/courtyard.js';
import * as elevator from './screens/elevator.js';
import * as floor from './screens/floor.js';
import * as room from './screens/room.js';
import * as results from './screens/results.js';
import * as pause from './screens/pause.js';
import * as records from './screens/records.js';
import * as settingsScreen from './screens/settings.js';
import * as notice from './screens/notice.js';
import * as ending from './screens/ending.js';
import * as gateChoice from './screens/gate-choice.js';
import * as dream from './screens/dream.js';
import * as garden from './screens/garden.js';
import * as gardenEditor from './screens/garden-editor.js';

/** name -> screen module. Every screen exports enter/update/exit the same way. */
const SCREENS = {
  title, courtyard, elevator, floor, room,
  results, pause, records, settings: settingsScreen, notice,
  ending,
  'gate-choice': gateChoice,
  dream,
  garden,
  'garden-editor': gardenEditor,
};

const params = new URLSearchParams(window.location.search);
const roomNumber = Number(params.get('room') ?? 1) || 1;
const seed = params.has('seed') ? Number(params.get('seed')) : undefined;
const mood = params.has('mood') ? Number(params.get('mood')) : undefined;
const qa = params.get('qa') === '1';

const canvas = document.getElementById('stage');
const hud = createHud();

// --- veil fade transition (a plain opacity div, like hud.js's own veils) ---

const veil = document.createElement('div');
veil.id = 'screen-veil';
Object.assign(veil.style, {
  position: 'fixed',
  inset: '0',
  zIndex: '9999',
  pointerEvents: 'none',
  opacity: '0',
  background: MOODS[0].fog,
});
document.body.appendChild(veil);

/** The current mood's fog colour, or the default mood's if no mood has rendered yet. */
function fogColor() {
  const live = moodState.live;
  if (live?.fog?.getHexString) return '#' + live.fog.getHexString();
  return MOODS[0].fog;
}

/** Animates the veil's opacity over `seconds` (`0` = cut instantly). */
function fadeVeil(opacity, seconds) {
  return new Promise((resolve) => {
    if (seconds <= 0) {
      veil.style.transition = 'none';
      veil.style.opacity = String(opacity);
      resolve();
      return;
    }
    veil.style.transition = `opacity ${seconds}s ease-in-out`;
    // Read layout once so the browser commits the pre-transition state
    // before the opacity change starts animating.
    void veil.offsetHeight;
    veil.style.opacity = String(opacity);
    setTimeout(resolve, seconds * 1000);
  });
}

// --- cross-fade transition: a frozen copy of the last frame, fading away ---

/**
 * Snapshots the WebGL canvas into a 2D overlay canvas with the same CSS
 * box as `#stage`. Inserted right after `#stage` in the DOM — with no
 * explicit z-index, paint order alone puts it above the (also z-index:auto)
 * stage canvas and below every HUD element appended later in `createHud()`,
 * which is exactly "above the stage, below the HUD" without having to pick
 * a z-index number that would out-rank the HUD's own stacking.
 */
function makeCrossfadeOverlay() {
  const over = document.createElement('canvas');
  over.width = canvas.width;
  over.height = canvas.height;
  Object.assign(over.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100dvh',
    pointerEvents: 'none',
    opacity: '1',
  });
  over.getContext('2d').drawImage(canvas, 0, 0, over.width, over.height);
  canvas.insertAdjacentElement('afterend', over);
  return over;
}

function fadeCrossfadeOut(over, seconds) {
  return new Promise((resolve) => {
    over.style.transition = `opacity ${seconds}s ease-in-out`;
    void over.offsetHeight;
    over.style.opacity = '0';
    setTimeout(resolve, seconds * 1000);
  });
}

// --- router state: one base screen, a stack of overlays --------------------

let base = null; // { name, module }
let overlays = []; // [{ name, module }]

function topEntry() {
  return overlays.length ? overlays[overlays.length - 1] : base;
}

function topModule() {
  return topEntry()?.module ?? null;
}

/** The name of the top-most screen (the top overlay, or the base if none is open). */
function top() {
  return topEntry()?.name ?? null;
}

/** The base screen's name. */
function baseName() {
  return base?.name ?? null;
}

/** Pushes an overlay on top of the base and enters it. The base is untouched. */
function open(name, overlayParams = {}) {
  const mod = SCREENS[name];
  if (!mod) throw new Error(`Unknown screen: ${name}`);
  overlays.push({ name, module: mod });
  mod.enter(ctx, overlayParams);
}

/** Pops the top-most overlay and exits it. A no-op if none is open. */
function close() {
  const popped = overlays.pop();
  if (!popped) return;
  popped.module.exit();
}

function closeAllOverlays() {
  while (overlays.length) overlays.pop().module.exit();
}

/** The actual work of one `goto()` call — see `goto()` for the serialisation around it. */
async function runGoto(name, gotoParams, opts) {
  const next = SCREENS[name];
  if (!next) throw new Error(`Unknown screen: ${name}`);
  const { instant = false, crossfade } = opts;

  // A goto always leaves overlays behind — close every one first.
  closeAllOverlays();

  const skipAnim = instant || reducedMotion();

  if (crossfade && !skipAnim) {
    const overlay = makeCrossfadeOverlay();
    base?.module?.exit?.();
    base = { name, module: next };
    next.enter(ctx, gotoParams);
    await fadeCrossfadeOut(overlay, crossfade);
    overlay.remove();
    return;
  }

  // Order fix: the leaving screen keeps updating/rendering while the veil
  // fades in (the main loop still calls `base.module.update` — `base` isn't
  // reassigned yet). Only once the veil is opaque do we exit/enter, and the
  // fade-out plays over the *new* screen.
  if (!skipAnim) {
    veil.style.background = fogColor();
    await fadeVeil(1, 0.6);
  }

  base?.module?.exit?.();
  base = { name, module: next };
  next.enter(ctx, gotoParams);

  if (!skipAnim) await fadeVeil(0, 0.6);
}

// Serialises goto() calls: one transition runs at a time, in call order.
let chain = Promise.resolve();

/**
 * Switches the base screen.
 * @param {keyof typeof SCREENS} name
 * @param {object} [gotoParams]
 * @param {{ instant?: boolean, crossfade?: number }} [opts] `instant` skips
 *   any transition entirely; `crossfade: s` cross-fades over `s` seconds
 *   instead of the default veil fade. Reduced motion forces `instant`-like
 *   behaviour regardless of what's asked for.
 */
function goto(name, gotoParams = {}, opts = {}) {
  const run = chain.then(() => runGoto(name, gotoParams, opts));
  // Keep the chain alive even if this step fails, so a later goto still runs.
  chain = run.catch(() => {});
  return run;
}

const router = { goto, open, close, top, baseName };
const ctx = { canvas, hud, router, sound };

// --- boot -------------------------------------------------------------------

/** What the tap on the start veil does — shared so `hening.start()` does exactly this too. */
function startGame() {
  room.start();
  hud.hideStart();
  canvas.focus();
}

if (qa && params.has('room')) {
  // ?qa=1&room=N: a direct shortcut straight into the room screen, skipping the title.
  goto('room', { room: roomNumber, seed, mood }, { instant: true });
  hud.showStart(startGame);
} else {
  goto('title', {}, { instant: true });
}

bindInput(canvas, {
  onDirection: (dir) => topModule()?.input?.onDirection?.(dir),
  onSkip: () => topModule()?.input?.onSkip?.(),
  onUndo: () => topModule()?.input?.onUndo?.(),
  onRestart: () => topModule()?.input?.onRestart?.(),
  onRotate: (delta) => topModule()?.input?.onRotate?.(delta),
  onConfirm: () => topModule()?.input?.onConfirm?.(),
  onBack: () => topModule()?.input?.onBack?.(),
  onPause: () => topModule()?.input?.onPause?.(),
  onDigit: (n) => topModule()?.input?.onDigit?.(n),
  onPointerMove: (x, y) => topModule()?.input?.onPointerMove?.(x, y),
  onPointerDown: (x, y) => topModule()?.input?.onPointerDown?.(x, y),
  onAnyKey: (code) => topModule()?.input?.onAnyKey?.(code),
  // M stays global, regardless of which screen is on top.
  onSound: () => hud.setSoundOn(sound.toggle()),
});

window.addEventListener('resize', () => {
  base?.module?.resize?.();
  for (const o of overlays) o.module.resize?.();
});

if (qa) {
  import('./dev/qa.js').then(({ install }) => install({ sound, startGame, router }));
}

function syncReducedMotion() {
  document.body.classList.toggle('reduced-motion', reducedMotion());
}
syncReducedMotion();

sound.setVolumes(getSettings().volume);
onSettingsChange((s) => {
  sound.setVolumes(s.volume);
  if (base?.name === 'room') hud.setVisible({ hint: s.hints });
  syncReducedMotion();
});

// Main loop. Delta clamped exactly as the reference clamps THREE.Clock's delta.
let lastTime = performance.now();
let elapsed = 0;
function frame(now) {
  // Asked for first: an exception in one screen's update costs that frame, not the game (05).
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 1 / 20);
  lastTime = now;
  elapsed += dt;
  if (base) base.module.update(dt, elapsed);
  for (const o of overlays) o.module.update(dt, elapsed);
}
requestAnimationFrame(frame);
