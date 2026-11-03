/**
 * @file Tests for the room screen glue (`src/screens/room.js`).
 *
 * The render/world/themes/audio/hud modules are being built in parallel
 * (`briefs/01-room-contract.md`) and may not exist yet, so every contract
 * module is mocked here with a fake that records calls, matching the
 * shapes the contract promises. `core/level.js`, `core/game.js` and
 * `core/path.js` are real — this file tests the glue against the actual
 * rules, not a fake of them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';

// --- contract module fakes (Opus is building the real versions) -----------

vi.mock('../src/render/math.js', () => ({
  mulberry32: (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  lerp: (a, b, p) => a + (b - a) * p,
  smooth: (p) => p * p * (3 - 2 * p),
  easeInOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  damp: (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt)),
  clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  wrapAngle: (a) => a,
  dampAngle: (_cur, target) => target,
}));

vi.mock('../src/render/board.js', () => ({
  board: { rows: 0, cols: 0 },
  cellX: (c) => c,
  cellZ: (r) => r,
}));

// up, right, down, left — matches core/level.js's DIR_NAMES order of intent.
const SCREEN_DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

vi.mock('../src/render/camera.js', () => ({
  view: { zoom: 1, step: 0, azimuth: 0, targetAzimuth: 0, halfHeight: 1, target: { x: 0, y: 0, z: 0, set() {}, copy() {} } },
  fitCamera: vi.fn(),
  rotateView: vi.fn(),
  screenToGrid: (d) => [[-1, 0], [0, 1], [1, 0], [0, -1]][d],
}));

vi.mock('../src/render/moods.js', () => ({
  MOODS: [{}, {}, {}, {}],
  moodState: { index: 0, live: {} },
  setMood: vi.fn(),
  setMoodPosition: vi.fn(),
}));

vi.mock('../src/audio/sound.js', () => {
  const sound = { ctx: null, enabled: true, ready: true };
  sound.start = vi.fn(() => { sound.ctx = {}; });
  sound.toggle = vi.fn(() => true);
  sound.step = vi.fn();
  sound.scrape = vi.fn();
  sound.thump = vi.fn();
  sound.hmph = vi.fn();
  sound.rewind = vi.fn();
  sound.chime = vi.fn();
  sound.unchime = vi.fn();
  sound.finale = vi.fn();
  sound.drip = vi.fn();
  sound.creak = vi.fn();
  sound.flutter = vi.fn();
  return { sound };
});

vi.mock('../src/themes/index.js', () => ({
  getTheme: vi.fn(() => ({
    id: 'lentera',
    name: 'Lentera',
    counterLabel: 'lentera',
    solvedLine: 'Semua lentera menyala',
    createObject: vi.fn(),
    createTarget: vi.fn(),
    instrument: { play: vi.fn(), mute: vi.fn() },
    pushSound: vi.fn((s) => s.scrape()),
  })),
  registerTheme: vi.fn(),
  notesFor: vi.fn(() => [1, 2, 3, 4, 5]),
}));

vi.mock('../src/world/wanderer.js', () => ({
  LOOK_AFTER: 6,
  MEDITATE_AFTER: 24,
  ACTION_LENGTH: 1,
}));

vi.mock('../src/world/room-world.js', () => ({
  createRoomWorld: vi.fn(),
}));

vi.mock('../src/world/tower-world.js', () => ({
  disposeTowerWorld: vi.fn(),
}));

// state/settings.js is real (it works with no localStorage, returning
// defaults — see tests/settings.test.js) since nothing here needs to
// change it. state/progress.js keeps its real recordSolve/openRoom/
// isFloorLit/markFloorLit (so the "best of" and "all 10 rooms" rules are
// actually exercised) but fakes the in-memory singleton so each test
// starts from a clean slate instead of sharing one cached object forever.
vi.mock('../src/state/progress.js', async () => {
  const actual = await vi.importActual('../src/state/progress.js');
  let current = actual.defaultProgress();
  return {
    ...actual,
    getProgress: vi.fn(() => current),
    setProgress: vi.fn((p) => { current = p; return current; }),
    saveProgress: vi.fn(),
    __resetForTests: () => { current = actual.defaultProgress(); },
  };
});

// Rooms used by these tests, standing in for `rooms.generated.json`.
vi.mock('../src/data/rooms.js', () => ({
  rooms: [
    // 1: two adjacent objects — pushing the first is always blocked by the second.
    { number: 1, floor: 1, file: 'TEST', record: 0, objects: 2, rows: ['##########', '#@$$.... #', '##########'] },
    // 2: one push away from solved.
    { number: 2, floor: 1, file: 'TEST', record: 0, objects: 1, rows: ['#####', '#@$.#', '#####'] },
    // 3: plain corridor, no objects — for buffered walk/undo/restart.
    { number: 3, floor: 1, file: 'TEST', record: 0, objects: 0, rows: ['#######', '#@    #', '#######'] },
    // 4: a chain — push onto a target, then onto another, then off onto plain floor.
    { number: 4, floor: 1, file: 'TEST', record: 0, objects: 1, rows: ['#######', '#@$.. #', '#######'] },
  ],
  garden: [],
  solutions: { 2: { lurd: 'R', steps: 1, pushes: 1, weight: 1, ms: 1 } },
  isPractice: false,
}));

const { createRoomWorld } = await import('../src/world/room-world.js');
const { sound } = await import('../src/audio/sound.js');
const { MEDITATE_AFTER } = await import('../src/world/wanderer.js');
const progressState = await import('../src/state/progress.js');
const room = await import('../src/screens/room.js');

// --- test fakes for the world the contract promises -----------------------

function makeThemeObject() {
  return {
    // A real Vector3 (not a plain {x,y,z}) — restart()/undo()/solve()/replay()
    // all call `.group.position.set(...)` on it, same as the wanderer's root.
    group: { position: new THREE.Vector3(0, 0, 0) },
    body: {},
    isLit: false,
    setLit: vi.fn(function (on) { this.isLit = on; }),
    nudge: vi.fn(),
    update: vi.fn(),
  };
}

function makeThemeTarget() {
  return { group: { position: new THREE.Vector3(0, 0, 0) }, update: vi.fn() };
}

function makeGate() {
  return {
    r: 0, c: 0, dir: [1, 0], stones: 2,
    cell: vi.fn((k) => ({ r: -k, c: 1 })),
    inner: { r: 1, c: 1 },
    open: vi.fn(),
    close: vi.fn(),
    snap: vi.fn(),
  };
}

let currentGate = null;

function makeWanderer() {
  return {
    root: { position: new THREE.Vector3(0, 0, 0) },
    yaw: 0,
    shownYaw: 0,
    move: null,
    action: null,
    actionTime: 0,
    idle: 0,
    frozen: false,
    opacity: 1,
    fadeTo: 1,
    setOpacity: vi.fn(function (a) { this.opacity = a; }),
    faceDir: vi.fn(),
    cancelAction: vi.fn(function () { this.action = null; }),
    perform: vi.fn(function (name) { this.action = name; return 0; }),
    update: vi.fn(),
  };
}

function makeWorld({ level }) {
  return {
    scene: {},
    board: { rows: level.rows, cols: level.cols },
    wanderer: makeWanderer(),
    objects: level.objects.map(() => makeThemeObject()),
    targets: level.targets.map(() => makeThemeTarget()),
    decor: { gate: currentGate, stranger: { notice: vi.fn() }, ponds: [], basins: [], crows: [], perches: [] },
    fx: { ripple: vi.fn(), mote: vi.fn(), puff: vi.fn(), petalShower: vi.fn(), clearPetals: vi.fn() },
    glowHex: () => '#ffffff',
    setHover: vi.fn(),
    cellUnderPointer: vi.fn(() => null),
    update: vi.fn(),
    render: vi.fn(),
    resize: vi.fn(),
    where: vi.fn(() => ({ x: 0, y: 0 })),
    inspect: vi.fn(() => ({
      gate: { found: !!currentGate, stones: currentGate?.stones ?? 0 },
      stranger: { seated: false, onScreen: false },
      water: { ponds: 0, basins: 0, fountains: 0, koi: 0 },
      framing: { fits: true },
      render: { calls: 0, triangles: 0 },
    })),
    dispose: vi.fn(),
  };
}

const hud = {
  setPlace: vi.fn(),
  setCounters: vi.fn(),
  showStart: vi.fn(),
  hideStart: vi.fn(),
  showResults: vi.fn(),
  hideResults: vi.fn(),
  setVisible: vi.fn(),
  onTool: vi.fn(),
  setSoundOn: vi.fn(),
  dispose: vi.fn(),
};

const router = {
  goto: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  top: vi.fn(() => 'room'),
  baseName: vi.fn(() => 'room'),
};

const ctx = { canvas: {}, hud, router, sound };

let simTime = 0;
function advance(seconds) {
  const dt = 1 / 60;
  let t = 0;
  while (t < seconds - 1e-9) {
    const step = Math.min(dt, seconds - t);
    t += step;
    simTime += step;
    room.update(step, simTime);
  }
}

function world() {
  return createRoomWorld.mock.results[createRoomWorld.mock.results.length - 1].value;
}

const SCREEN = { up: 0, right: 1, down: 2, left: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  currentGate = null;
  sound.ctx = null;
  simTime = 0;
  createRoomWorld.mockImplementation(({ level }) => makeWorld({ level }));
  progressState.__resetForTests();
});

afterEach(() => {
  room.exit();
  vi.useRealTimers();
});

describe('room.js', () => {
  it('walks: steps, faces, plays the step sound, settles after the walk duration', () => {
    room.enter(ctx, { room: 3 });
    room.screenMove(SCREEN.right);
    expect(sound.step).toHaveBeenCalledOnce();
    const w = world().wanderer;
    expect(w.move).not.toBeNull();
    advance(0.25);
    expect(w.move).toBeNull();
    expect(hud.setCounters).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 1 }));
  });

  it('bumps into a wall: blocked-wall performs bump and thumps, nothing moves', () => {
    room.enter(ctx, { room: 3 });
    room.screenMove(SCREEN.up); // row 0 is a wall
    const w = world().wanderer;
    expect(w.perform).toHaveBeenCalledWith('bump');
    expect(sound.thump).toHaveBeenCalledWith(110, 0.05);
    expect(w.move).toBeNull();
  });

  it('pushes onto a target (chime), between targets (chime+unchime), then off onto floor (unchime)', () => {
    room.enter(ctx, { room: 4 });
    const w = world();

    // onto target 0
    room.screenMove(SCREEN.right);
    expect(sound.scrape).toHaveBeenCalledOnce(); // theme.pushSound
    advance(0.5);
    expect(w.objects[0].setLit).toHaveBeenLastCalledWith(true);
    expect(sound.chime).toHaveBeenLastCalledWith(1); // notes[0]

    // onto target 1 (leaves target 0)
    room.screenMove(SCREEN.right);
    advance(0.5);
    expect(sound.unchime).toHaveBeenLastCalledWith(1);
    expect(sound.chime).toHaveBeenLastCalledWith(2); // notes[1]

    // off target 1 onto plain floor
    room.screenMove(SCREEN.right);
    advance(0.5);
    expect(sound.unchime).toHaveBeenLastCalledWith(2);
    expect(w.fx.ripple).toHaveBeenCalled();
    expect(w.fx.mote).toHaveBeenCalled();
  });

  it('protests on the first blocked push, then shrugs if blocked again within 3.5s', () => {
    room.enter(ctx, { room: 1 });
    const w = world().wanderer;

    room.screenMove(SCREEN.right); // blocked: object 0 can't push into object 1
    expect(w.perform).toHaveBeenCalledWith('protest');
    expect(world().decor.stranger.notice).toHaveBeenCalledWith('protest');
    expect(sound.thump).toHaveBeenCalledTimes(2);
    expect(sound.hmph).toHaveBeenCalledWith(1.32);

    vi.advanceTimersByTime(1350);
    expect(world().fx.puff).toHaveBeenCalledOnce();

    advance(1); // still well under 3.5s
    room.screenMove(SCREEN.right); // blocked again
    expect(w.perform).toHaveBeenLastCalledWith('shrug');
  });

  it('buffers one move while a step is in flight and runs it when the step lands', () => {
    room.enter(ctx, { room: 3 });
    room.screenMove(SCREEN.right); // walking from c1 to c2
    room.screenMove(SCREEN.right); // buffered: should land, then run
    advance(0.25); // first step lands, buffered step starts
    advance(0.25); // second step lands
    const level = createRoomWorld.mock.calls[0][0].level;
    expect(level).toBeDefined();
    expect(hud.setCounters).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 2 }));
  });

  it('queues an undo requested mid-step and runs it once the step lands', () => {
    room.enter(ctx, { room: 3 });
    room.screenMove(SCREEN.right); // step in flight
    room.undo(); // queued, not lost
    advance(0.25); // step lands, queued undo now runs
    advance(0.25); // rewind completes
    expect(sound.rewind).toHaveBeenCalledOnce();
    expect(hud.setCounters).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 0 }));
  });

  it('restarts as one snap with a white ripple, and undo of a restart snaps back', () => {
    room.enter(ctx, { room: 3 });
    room.screenMove(SCREEN.right);
    advance(0.25); // player now at the walked-to cell

    room.restart();
    expect(hud.hideResults).toHaveBeenCalledOnce();
    expect(world().fx.ripple).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), '#ffffff', 3, 0.9);
    expect(hud.setCounters).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 0 }));

    room.undo(); // undoes the restart itself
    expect(sound.rewind).toHaveBeenCalledOnce();
    expect(hud.setCounters).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 1 }));
  });

  it('solves on the winning push: bow at 0.65s, results after the exit-less wait, progress recorded', () => {
    room.enter(ctx, { room: 2 }); // no gate: buildExitScript() returns null
    room.screenMove(SCREEN.right); // the one push that solves it
    advance(0.5); // push lands, win() fires

    // The progress store is updated before the departure even starts.
    expect(progressState.getProgress().solved['2'].bebas).toEqual({ steps: 1, pushes: 1 });
    expect(progressState.getProgress().open).toBe(3);
    expect(progressState.saveProgress).toHaveBeenCalled();

    const w = world().wanderer;
    vi.advanceTimersByTime(650);
    expect(w.perform).toHaveBeenCalledWith('bow');
    expect(sound.finale).toHaveBeenCalledOnce();
    expect(world().fx.petalShower).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(2300 - 650);
    expect(router.open).toHaveBeenCalledWith('results', {
      room: 2,
      steps: 1,
      pushes: 1,
      isRecord: false, // first-ever solve of this room: no previous record to beat
      newlyLitFloor: null, // floor 1 needs rooms 1-10 solved
      solvedLine: 'Semua lentera menyala',
    });
    expect(room.inspect().phase).toBe('results');
  });

  it('solving a room again with better stats sets isRecord', () => {
    // Pre-seed a worse record, as a previous session would have left it.
    progressState.recordSolve(progressState.getProgress(), 2, 'bebas', { steps: 9, pushes: 9 });

    room.enter(ctx, { room: 2 });
    room.screenMove(SCREEN.right); // one push, better than the pre-seeded 9/9
    advance(0.5);

    expect(router.open).not.toHaveBeenCalled(); // not yet — the exit-less wait hasn't elapsed
    vi.advanceTimersByTime(2300);
    expect(router.open).toHaveBeenCalledWith('results', expect.objectContaining({ isRecord: true }));
    expect(progressState.getProgress().solved['2'].bebas).toEqual({ steps: 1, pushes: 1 });
  });

  it('skips the arrival on any move key, landing on the start tile', () => {
    currentGate = makeGate();
    room.enter(ctx, { room: 1 });
    expect(room.inspect().phase).toBe('arriving');

    room.start(); // first gesture: starts audio and begins the scripted walk
    expect(sound.start).toHaveBeenCalledOnce();

    room.skip(); // any move key / Space skips straight to the start tile
    expect(currentGate.snap).toHaveBeenCalledWith(false);
    expect(room.inspect().phase).toBe('playing');
  });

  it('sets the HUD visible (hint from settings.hints) on enter', () => {
    room.enter(ctx, { room: 3 });
    expect(hud.setVisible).toHaveBeenCalledWith({ title: true, tools: true, counters: true, hint: true });
  });

  it('input.onBack / input.onPause open the pause overlay, except while results are showing', () => {
    room.enter(ctx, { room: 2 });

    room.input.onPause();
    expect(router.open).toHaveBeenCalledWith('pause', { room: 2 });
    router.open.mockClear();

    room.input.onBack();
    expect(router.open).toHaveBeenCalledWith('pause', { room: 2 });

    // Solve the room, reach results, then onPause/onBack must do nothing.
    router.open.mockClear();
    room.screenMove(SCREEN.right); // the one push that solves room 2
    advance(0.5);
    vi.advanceTimersByTime(2300);
    expect(room.inspect().phase).toBe('results');
    router.open.mockClear();
    room.input.onPause();
    room.input.onBack();
    expect(router.open).not.toHaveBeenCalled();
  });

  it('confirm() no longer advances rooms — the results overlay owns that', () => {
    room.enter(ctx, { room: 2 });
    room.screenMove(SCREEN.right);
    advance(0.5);
    vi.advanceTimersByTime(2300);
    expect(room.currentRoom()).toBe(2);
    room.confirm();
    expect(room.currentRoom()).toBe(2);
  });

  it('replay() restarts without the arrival and restores the wanderer to full opacity', () => {
    room.enter(ctx, { room: 2 });
    room.screenMove(SCREEN.right); // solve it
    advance(0.5);
    vi.advanceTimersByTime(2300);
    expect(room.inspect().phase).toBe('results');

    const w = world().wanderer;
    w.opacity = 0; // as if the departure had faded it out through the gate
    w.fadeTo = 0;
    room.replay();

    expect(room.inspect().phase).toBe('playing');
    expect(w.setOpacity).toHaveBeenCalledWith(1);
    expect(w.fadeTo).toBe(1);
    expect(hud.setCounters).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 0 }));
  });

  it('setPaused(true) makes every input handler a no-op and settles the wanderer; setPaused(false) undoes it', () => {
    room.enter(ctx, { room: 3 });
    const w = world().wanderer;
    hud.setCounters.mockClear(); // enter()'s own initial HUD update, not what this test is about

    room.setPaused(true);
    expect(w.idle).toBe(MEDITATE_AFTER + 1.2);

    room.screenMove(SCREEN.right);
    expect(w.move).toBeNull();
    expect(sound.step).not.toHaveBeenCalled();
    room.undo();
    room.restart();
    room.rotate(1);
    expect(hud.setCounters).not.toHaveBeenCalled();

    room.setPaused(false);
    expect(w.idle).toBe(0);
    room.screenMove(SCREEN.right);
    expect(sound.step).toHaveBeenCalledOnce();
  });

  it('currentRoom() returns the room currently loaded', () => {
    room.enter(ctx, { room: 4 });
    expect(room.currentRoom()).toBe(4);
  });
});
