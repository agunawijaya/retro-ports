/**
 * @file Unit tests for Dupa timer behavior:
 * - clock starts when arrival ends
 * - burns through update
 * - stops in pause
 * - restart refreshes stick
 * - undo does not refund
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

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
  sound.bell = vi.fn();
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
  noteFor: vi.fn(() => 1),
}));

vi.mock('../src/world/wanderer.js', () => ({
  LOOK_AFTER: 6,
  MEDITATE_AFTER: 24,
  ACTION_LENGTH: 1,
}));

vi.mock('../src/world/tower-world.js', () => ({
  disposeTowerWorld: vi.fn(),
}));

function makeThemeObject() {
  return {
    group: { position: new THREE.Vector3(0, 0, 0) },
    body: {},
    isLit: false,
    setLit: vi.fn(function (on) { this.isLit = on; }),
    nudge: vi.fn(),
    update: vi.fn(),
  };
}

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

let currentGate = null;
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

function makeWorld({ level }) {
  return {
    scene: {},
    board: { rows: level.rows, cols: level.cols },
    wanderer: makeWanderer(),
    objects: level.objects.map(() => makeThemeObject()),
    targets: level.targets.map(() => ({ group: { position: new THREE.Vector3(0, 0, 0) }, update: vi.fn() })),
    decor: { gate: currentGate, stranger: { notice: vi.fn() } },
    fx: { ripple: vi.fn(), mote: vi.fn(), puff: vi.fn(), petalShower: vi.fn(), clearPetals: vi.fn() },
    glowHex: () => '#ffffff',
    setHover: vi.fn(),
    cellUnderPointer: vi.fn(() => null),
    update: vi.fn(),
    render: vi.fn(),
    resize: vi.fn(),
    where: vi.fn(() => ({ x: 0, y: 0 })),
    inspect: vi.fn(() => ({})),
    dispose: vi.fn(),
  };
}

vi.mock('../src/world/room-world.js', () => ({
  createRoomWorld: vi.fn((opts) => makeWorld(opts)),
}));

vi.mock('../src/data/rooms.js', () => ({
  rooms: [
    { number: 1, floor: 1, file: 'TEST', record: 0, objects: 1, rows: ['#######', '#@  $.#', '#######'] },
  ],
  garden: [],
  solutions: { 1: { lurd: 'R', steps: 1, pushes: 1, weight: 1, ms: 1 } },
  isPractice: false,
}));

const { sound } = await import('../src/audio/sound.js');
const room = await import('../src/screens/room.js');

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
  setDupaTime: vi.fn(),
  setDupaVisible: vi.fn(),
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

describe('Dupa Clock (room.js)', () => {
  beforeEach(() => {
    currentGate = makeGate();
    room.enter(ctx, { room: 1, mode: 'dupa', intro: true });
  });

  it('clock starts only after arrival ends', () => {
    const totalMs = 20 * 60 * 1000;
    expect(room.inspect().phase).toBe('arriving');
    expect(room.inspect().dupaLeft).toBe(totalMs);

    // During arrival, clock does not tick down
    room.update(1.0, 1.0);
    expect(room.inspect().dupaLeft).toBe(totalMs);

    // Skip intro -> arrival ends -> phase playing
    room.skipIntro();
    expect(room.inspect().phase).toBe('playing');

    // Now clock ticks down
    room.update(2.5, 3.5);
    expect(room.inspect().dupaLeft).toBe(totalMs - 2500);
  });

  it('stops in pause', () => {
    room.skipIntro();
    room.update(5.0, 5.0);
    const beforePause = room.inspect().dupaLeft;

    room.setPaused(true);
    room.update(10.0, 15.0);
    expect(room.inspect().dupaLeft).toBe(beforePause);

    room.setPaused(false);
    room.update(2.0, 17.0);
    expect(room.inspect().dupaLeft).toBe(beforePause - 2000);
  });

  it('restart refreshes the stick to full duration', () => {
    room.skipIntro();
    room.update(15.0, 15.0);
    expect(room.inspect().dupaLeft).toBeLessThan(20 * 60 * 1000);

    room.restart();
    expect(room.inspect().dupaLeft).toBe(20 * 60 * 1000);
  });

  it('undo does not refund any time', () => {
    room.skipIntro();
    // Wanderer walks right (index 1)
    room.screenMove(1);
    room.update(1.0, 1.0);
    const timeBeforeUndo = room.inspect().dupaLeft;

    room.undo();
    room.update(0.5, 1.5);
    // Time continued to tick down, no refund
    expect(room.inspect().dupaLeft).toBe(timeBeforeUndo - 500);
  });
});
