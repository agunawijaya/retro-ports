/* Karateka -- Move Viewer.
 *
 * Not the game yet. This is a viewer that reads the game's fighting-move
 * libraries (ALLPAL, ALLGAL, ALLVAL) frame by frame and renders each frame
 * onto the shadow buffer using the same decoder + blitter as the port will.
 * Every pixel on screen is decoded at runtime from your own copy of the
 * game's data -- CGA byte layouts, RLE, column-major sprite bytes, mask +
 * shape combine, sub-byte X shift, all of it.
 *
 * The point of doing this before the game: a viewer that shows one move
 * correctly is proof that the sprite pipeline works end to end. A "playable
 * game" that shows garbled sprites is not.
 *
 * How the move scripts work (see docs/05-the-fighting.md):
 *
 *   set_pos,<dx> <dy> [name]     the actor's frame position; the third
 *                                token names the block on its first frame
 *   inc_x,<n>                    how far the fighter travels this frame
 *   set_tune,<n>                 a sound, 0 for silence
 *   set_fig,<id> <x> <y>         a sprite piece, placed at actor + offset
 *   set_fig,<id> <x> <y>         a second piece -- every fighting frame has
 *                                exactly two
 *   end_animation                closes the move
 *
 * fig.x is a PIXEL offset from the actor's screen X. Body at fig.x=0 and
 * head at fig.x=17 means the head is 17 pixels right of the body's left
 * edge -- on the shoulders of a ~56-pixel-wide body. (Treating fig.x as
 * bytes was the first-load bug that put heads 68 pixels off the body.)
 * fig.y is a scanline; the sprite fills rows (fig.y - h) .. (fig.y - 1)
 * because Y is exclusive-end -- verified in tools/prove-blit.py against
 * three different figures at three heights.
 */

'use strict';

const W = 320, H = 200;
const CGA = [
  [0, 0, 0], [85, 255, 255], [255, 85, 255], [255, 255, 255],
];
const DATA_DIR = '../original/';
const TICK_MS = 1000 / 8;                // 8 Hz -- the game's animation rate

// ---------------------------------------------------------------- fetch

async function fetchBytes(name) {
  const r = await fetch(DATA_DIR + name);
  if (!r.ok) throw new Error(`could not fetch ${name}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function fetchText(name) {
  const r = await fetch(DATA_DIR + name);
  if (!r.ok) throw new Error(`could not fetch ${name}: ${r.status}`);
  return await r.text();
}

// ---------------------------------------------------------------- RLE

function rleDecode(stream, from, want) {
  const out = new Uint8Array(want);
  let k = from, o = 0;
  while (k < stream.length && o < want) {
    const b = stream[k++];
    if (b !== 0x7B) { out[o++] = b; continue; }
    if (k + 1 >= stream.length) break;
    const v = stream[k++], c = stream[k++];
    for (let j = 0; j <= c && o < want; j++) out[o++] = v;
  }
  return out;
}

// ---------------------------------------------------------------- .IND/.DAT

function parseIndex(indData, datLength) {
  const entries = [];
  let k = 0, terminator = null;
  while (k + 4 <= indData.length) {
    const id = indData[k] | (indData[k + 1] << 8);
    const off = indData[k + 2] | (indData[k + 3] << 8);
    if (id === 0xFFFF) { terminator = off; break; }
    entries.push({ id, off });
    k += 4;
  }
  const total = terminator ?? datLength;
  const withEnd = entries.map((e, j) => ({
    id: e.id, off: e.off,
    end: j + 1 < entries.length ? entries[j + 1].off : total,
  }));
  const byId = new Map();
  for (const r of withEnd) byId.set(r.id, r);
  return { ordered: withEnd, byId };
}

function decodeSprite(datData, off, end) {
  const w = datData[off], h = datData[off + 1];
  if (!(w >= 1 && w <= 64 && h >= 1 && h <= 160)) return null;
  return { w, h, columnMajor: rleDecode(datData, off + 3, w * h) };
}

// ---------------------------------------------------------------- .BCG

function parseBackdrop(data) {
  const n = data[0] | (data[1] << 8);
  return { width: 320, height: n / 80, bytes: data.slice(2, 2 + n) };
}

// ---------------------------------------------------------------- moves

function parseMoves(text) {
  const moves = [];
  let cur = { name: null, frames: [] };
  let frame = null;
  const flushFrame = () => {
    if (frame) cur.frames.push(frame);
    frame = null;
  };
  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const [verb, argsRaw = ''] = line.split(/,/, 2);
    const parts = argsRaw.trim().split(/\s+/);
    if (verb === 'set_pos') {
      flushFrame();
      frame = { pos: [parseInt(parts[0], 10), parseInt(parts[1], 10)],
                figs: [], inc_x: 0, tune: 0 };
      if (parts.length >= 3 && /^[a-z]+\d+$/.test(parts[2])) {
        cur.name = parts[2];
      }
    } else if (verb === 'inc_x' && frame) {
      frame.inc_x = parseInt(parts[0], 10) || 0;
    } else if (verb === 'set_tune' && frame) {
      frame.tune = parseInt(parts[0], 10) || 0;
    } else if (verb === 'set_fig' && frame) {
      frame.figs.push({
        id: parseInt(parts[0], 10),
        x: parseInt(parts[1], 10),
        y: parseInt(parts[2], 10),
      });
    } else if (verb === 'end_animation') {
      flushFrame();
      moves.push(cur);
      cur = { name: null, frames: [] };
    }
  }
  flushFrame();
  if (cur.frames.length) moves.push(cur);
  // Keep index positions stable so move index 8 stays "forward step" per
  // docs/05-the-fighting.md, but replace empty moves (blocks whose only
  // content is a set_tune with no set_pos) with a one-frame idle. Without
  // this the chooser can land on an empty block and the tick blows up
  // reading .inc_x from an undefined frame.
  const idleFrame = { pos: [0, 0], figs: [], inc_x: 0, tune: 0 };
  for (const m of moves) {
    if (m.frames.length === 0) m.frames.push({ ...idleFrame });
  }
  return moves;
}

// ---------------------------------------------------------------- scenes

/* BAL/CAL parser. Same verb family as the fighting libraries (set_fig etc.)
 * but no set_pos/inc_x -- each set_fig is an absolute placement into a
 * wide level canvas (X can reach 2152 in BAL01, which is the scrolling
 * map's width). init_sal marks the transition from static backdrop pieces
 * to figures the game will animate/replace at runtime; for the port we
 * keep both together and let the level state overwrite what it needs to.
 * end_animation closes a scene; a file can hold several. */
function parseScenes(text) {
  const scenes = [];
  let cur = { name: null, figs: [] };
  const flush = () => {
    if (cur.figs.length) scenes.push(cur);
    cur = { name: null, figs: [] };
  };
  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const [verb, argsRaw = ''] = line.split(/,/, 2);
    const parts = argsRaw.trim().split(/\s+/);
    if (verb === 'set_fig') {
      cur.figs.push({
        id: parseInt(parts[0], 10),
        x:  parseInt(parts[1], 10),
        y:  parseInt(parts[2], 10),
      });
      if (parts.length >= 4 && cur.name === null) cur.name = parts[3];
    } else if (verb === 'end_animation') {
      flush();
    }
    // set_tune, init_sal, chg_fig, do_scr, set_wipe, set_nowipe: ignored
    // (chg_fig belongs to CAL cutscene playback; not needed for the
    // static level rendering we do here).
  }
  flush();
  return scenes;
}

// ---------------------------------------------------------------- shadow

class ShadowBuffer {
  constructor() { this.bytes = new Uint8Array(80 * 200); }
  clear(v = 0) { this.bytes.fill(v); }

  blitBackdrop(bcg, y = 0) {
    for (let row = 0; row < bcg.height; row++) {
      const src = row * 80, dst = (y + row) * 80;
      if (dst < 0 || dst + 80 > this.bytes.length) continue;
      this.bytes.set(bcg.bytes.subarray(src, src + 80), dst);
    }
  }

  /* Sky-fill / plateau-fill: the game does not draw these from any file --
   * they are cleared regions before BAL figs go on top. Measured against a
   * clean shadow snapshot right after BAL00's seven blits complete, hooked
   * at draw_sprite:
   *   Y=0..107     0x55  (sky, four cyan pixels per byte)
   *   Y=154..183   alternating even=0x99, odd=0x66  (dithered plateau)
   * With FUJI.BCG on top plus the post-BCG cleanup in `overlayHorizon`,
   * this composes byte-identically with the game -- 16000/16000 match. */
  fillSceneLayers() {
    for (let row = 0; row < 108; row++)
      for (let col = 0; col < 80; col++) this.bytes[row * 80 + col] = 0x55;
    for (let row = 154; row < 184; row++) {
      const v = (row & 1) === 0 ? 0x99 : 0x66;
      for (let col = 0; col < 80; col++) this.bytes[row * 80 + col] = v;
    }
  }

  /* Post-FUJI cleanup. FUJI.BCG at Y=80 covers rows 80..114, but the game
   * then overwrites four of those rows with solid bands to draw the horizon
   * line and its shadow:
   *   Y=106         0xFF  (white horizon rail)
   *   Y=107..109    0x00  (black band under the rail)
   *   Y=114         0x00  (base of horizon; FUJI's row 34 is cyan, would
   *                        otherwise leak through)
   * Only applied when the backdrop is FUJI.BCG; CASTLE.BCG has no such
   * overlays and covers the whole screen anyway. */
  overlayHorizon() {
    for (let col = 0; col < 80; col++) this.bytes[106 * 80 + col] = 0xFF;
    for (const row of [107, 108, 109, 114]) {
      for (let col = 0; col < 80; col++) this.bytes[row * 80 + col] = 0x00;
    }
  }

  /* dest = (dest & ~mask) | (shape & mask). Zero mask is transparent.
   * Without a mask, non-zero shape bytes overwrite (a zero is transparent).
   * Sub-byte X shift splits each byte across two dest bytes. Y is exclusive-
   * end: sprite fills rows (y - h) .. (y - 1). All verified in
   * tools/prove-blit.py and tools/prove-exact.py. */
  blitSprite(shape, mask, x, y) {
    if (!shape) return;
    const { w, h, columnMajor: shp } = shape;
    const msk = mask ? mask.columnMajor : null;
    const top = y - h;
    const dstCol = x >> 2;
    const shiftBits = (x & 3) << 1;
    const invShift = 8 - shiftBits;
    const shifted = shiftBits !== 0;

    for (let col = 0; col < w; col++) {
      const cbase = col * h;
      const dc = dstCol + col;
      for (let row = 0; row < h; row++) {
        const k = cbase + row;
        if (k >= shp.length) break;
        const shapeB = shp[k];
        // No mask -> opaque write. Structural sprites (fig 200/206 ground,
        // fig 202 gate) carry no mask pack and the game writes their shape
        // bytes -- including 0x00 -- straight through. Treating 0 as
        // transparent (the previous behaviour) let the plateau show through
        // where the ground pieces were drawing black. One of seven fixes
        // that took BAL00 from 34 % to 100 % byte match against the game's
        // own composed shadow -- see docs/06-web-code.md.
        const maskB = msk ? (k < msk.length ? msk[k] : 0) : 0xFF;
        if (maskB === 0) continue;
        const dr = top + row;
        if (dr < 0 || dr >= 200) continue;

        if (!shifted) {
          if (dc < 0 || dc >= 80) continue;
          const at = dr * 80 + dc;
          this.bytes[at] = (this.bytes[at] & ~maskB) | (shapeB & maskB);
        } else {
          const sh_h = shapeB >> shiftBits;
          const mk_h = maskB >> shiftBits;
          const sh_l = (shapeB << invShift) & 0xFF;
          const mk_l = (maskB << invShift) & 0xFF;
          if (dc >= 0 && dc < 80 && mk_h !== 0) {
            const at = dr * 80 + dc;
            this.bytes[at] = (this.bytes[at] & ~mk_h) | (sh_h & mk_h);
          }
          if (dc + 1 >= 0 && dc + 1 < 80 && mk_l !== 0) {
            const at = dr * 80 + dc + 1;
            this.bytes[at] = (this.bytes[at] & ~mk_l) | (sh_l & mk_l);
          }
        }
      }
    }
  }

  fillRect(byteX, y, byteW, h, v) {
    for (let r = y; r < y + h; r++) {
      if (r < 0 || r >= 200) continue;
      for (let c = byteX; c < byteX + byteW; c++) {
        if (c < 0 || c >= 80) continue;
        this.bytes[r * 80 + c] = v;
      }
    }
  }

  toImageData(imageData) {
    const p = imageData.data;
    let o = 0;
    for (let row = 0; row < 200; row++) {
      const base = row * 80;
      for (let col = 0; col < 80; col++) {
        const v = this.bytes[base + col];
        for (let k = 0; k < 4; k++) {
          const rgb = CGA[(v >> (6 - k * 2)) & 3];
          p[o++] = rgb[0]; p[o++] = rgb[1]; p[o++] = rgb[2]; p[o++] = 255;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- assets

const assets = {
  packs: {},
  backdrops: {},
  moves: {},
  scenes: {},        // { 'BAL00': [ { name, figs: [{id,x,y},...] }, ... ] }
  status: 'loading',
};

async function loadPack(stem) {
  const [ind, dat] = await Promise.all([
    fetchBytes(stem + '.IND'), fetchBytes(stem + '.DAT'),
  ]);
  const { ordered, byId } = parseIndex(ind, dat.length);
  assets.packs[stem] = { ordered, byId, dat };
}

async function loadAssets(setStatus) {
  const backdrops = ['FUJI.BCG', 'CASTLE.BCG'];
  const packs = [
    'KSC', 'KMC',
    'KS0', 'KM0', 'KS1', 'KM1', 'KS2', 'KM2', 'KS3', 'KM3',
    'KS4', 'KM4',
    'KSI0', 'KMI0',
  ];
  const libs = ['ALLPAL', 'ALLGAL', 'ALLVAL'];
  // Scene scripts: BAL/CAL are the level layouts. The letter suffix (A..F)
  // is a segment inside a level; we load the base file per level for now.
  const scenes = ['BAL00', 'BAL01', 'BAL02', 'BAL03',
                  'CAL00', 'CAL01', 'CAL02', 'CAL03', 'CAL04'];
  for (const b of backdrops) {
    setStatus(`loading ${b} ...`);
    try { assets.backdrops[b] = parseBackdrop(await fetchBytes(b)); }
    catch (e) { console.warn(e); }
  }
  for (const p of packs) {
    setStatus(`loading ${p} ...`);
    try { await loadPack(p); } catch (e) { console.warn(e); }
  }
  for (const l of libs) {
    setStatus(`loading ${l} ...`);
    try { assets.moves[l] = parseMoves(await fetchText(l)); }
    catch (e) { console.warn(e); }
  }
  for (const s of scenes) {
    setStatus(`loading ${s} ...`);
    try { assets.scenes[s] = parseScenes(await fetchText(s)); }
    catch (e) { console.warn(e); }
  }
  assets.status = 'ready';
  setStatus('ready.');
}

/* Fig-ID -> sprite. Move scripts carry a byte 1..255; the IND file stores it
 * under (0x100 | byte). Verified: KSC's 60 IDs are 257..356 + 451,452 and
 * ALLPAL references 55 of them with `0x100 | fig`. Two ALLPAL figs (74, 75)
 * live in the KS0 guard pack -- which is why the lookup falls through a list
 * of packs rather than being pinned to one.
 *
 * The list is scene-dependent because fig IDs collide across packs: fig 1
 * lives in KSC (hero torso) AND in KS0 (guard torso). The game solves this
 * by loading only one guard's pack at a time; we replicate that by making
 * the pack list a property of the current scene, resolved shape-first-hit. */
function lookup(packStems, indId) {
  for (const stem of packStems) {
    const p = assets.packs[stem];
    if (!p) continue;
    const r = p.byId.get(indId);
    if (r) return decodeSprite(p.dat, r.off, r.end);
  }
  return null;
}

function shape(figByte, packs) { return lookup(packs, 0x100 | figByte); }
function mask(figByte, packs)  { return lookup(packs, 0x100 | figByte); }

// ---------------------------------------------------------------- viewer

const viewer = {
  library: 'ALLPAL',
  shapePacks: ['KSC', 'KS0'],
  maskPacks:  ['KMC', 'KM0'],
  backdrop: 'FUJI.BCG',
  scene:      'BAL00',
  sceneShapePacks: ['KS0', 'KSC'],   // structural figs 200..208 live in KS*
  sceneMaskPacks:  ['KM0', 'KMC'],
  cameraX:    0,                     // scrolls the wide level (BAL01 is 2160w)
  moveIndex: 0,
  frameIndex: 0,
  playing: true,
  actorX: 140,           // pixel X of the actor's own origin on screen
  lastTick: 0,
};

/* Which packs a given scene expects. Each level ships its scenery in the
 * matching KS-star and KM-star pair; KSC is a fallback for shared pieces. */
const SCENE_PACKS = {
  BAL00: { shape: ['KS0', 'KSC'], mask: ['KM0', 'KMC'] },
  BAL01: { shape: ['KS1', 'KSC'], mask: ['KM1', 'KMC'] },
  BAL02: { shape: ['KS2', 'KSC'], mask: ['KM2', 'KMC'] },
  BAL03: { shape: ['KS3', 'KSC'], mask: ['KM3', 'KMC'] },
  CAL00: { shape: ['KSC', 'KS0'], mask: ['KMC', 'KM0'] },
  CAL01: { shape: ['KSC', 'KS0'], mask: ['KMC', 'KM0'] },
  CAL02: { shape: ['KSC', 'KS0'], mask: ['KMC', 'KM0'] },
  CAL03: { shape: ['KSC', 'KS0'], mask: ['KMC', 'KM0'] },
  CAL04: { shape: ['KSC', 'KSI0'], mask: ['KMC', 'KMI0'] },
};

function pickScene(name) {
  viewer.scene = name;
  const preset = SCENE_PACKS[name] || SCENE_PACKS.BAL00;
  viewer.sceneShapePacks = preset.shape;
  viewer.sceneMaskPacks  = preset.mask;
  viewer.cameraX = 0;
  refreshUI();
}

/* Which packs a given library expects. Guard-first for ALLGAL/ALLVAL because
 * fig 1 = "torso" resolves in every pack -- and if we hit KSC first while
 * showing a guard move, the hero's silhouette comes out instead. */
const LIB_PACKS = {
  ALLPAL: { shape: ['KSC', 'KS0'],       mask: ['KMC', 'KM0']       },
  ALLGAL: { shape: ['KS2', 'KS3', 'KSC'], mask: ['KM2', 'KM3', 'KMC'] },
  ALLVAL: { shape: ['KS3', 'KS2', 'KSC'], mask: ['KM3', 'KM2', 'KMC'] },
};

function pickLibrary(name) {
  viewer.library = name;
  const preset = LIB_PACKS[name] || LIB_PACKS.ALLPAL;
  viewer.shapePacks = preset.shape;
  viewer.maskPacks  = preset.mask;
  viewer.moveIndex = 0;
  viewer.frameIndex = 0;
  refreshUI();
}

function pickMove(index) {
  viewer.moveIndex = index;
  viewer.frameIndex = 0;
  refreshUI();
}

function refreshUI() {
  const moveSel = document.getElementById('move');
  if (!moveSel) return;
  const moves = assets.moves[viewer.library] || [];
  moveSel.innerHTML = '';
  moves.forEach((m, k) => {
    const opt = document.createElement('option');
    opt.value = String(k);
    opt.textContent = `${String(k).padStart(2, '0')}: ${m.name || '(unnamed)'}`
                    + `  ${m.frames.length}f`;
    if (k === viewer.moveIndex) opt.selected = true;
    moveSel.appendChild(opt);
  });
  const info = document.getElementById('info');
  if (info) {
    if (game.mode === 'game' && game.player && game.guard) {
      const p = game.player, g = game.guard;
      info.textContent =
        `[game]  player: x=${p.x} hp=${p.hp}/${MAX_HP} pose=${p.pose} `
        + `move=${p.moveIndex}f${p.frameIndex}   `
        + `guard: x=${g.x} hp=${g.hp}/${MAX_HP} pose=${g.pose} `
        + `move=${g.moveIndex}f${g.frameIndex}  dist=${Math.abs(g.x - p.x)}`
        + (game.message ? '   ' + game.message : '');
    } else {
      const m = moves[viewer.moveIndex];
      const f = m && m.frames[viewer.frameIndex];
      info.textContent = m
        ? `[view] ${viewer.library}[${viewer.moveIndex}] "${m.name || ''}"  `
        + `frame ${viewer.frameIndex + 1}/${m.frames.length}  `
        + `inc_x=${f ? f.inc_x : '-'}  figs=${f ? f.figs.length : 0}  `
        + `packs=${viewer.shapePacks.join('+')}`
        : '(no moves loaded)';
    }
  }
}

// ---------------------------------------------------------------- game

/* Move indices, verified in docs/05-the-fighting.md against ALLPAL/ALLGAL.
 * Every library assigns the same *meaning* to a given index and supplies its
 * own frames -- so "guard punches" and "hero punches" are the same number
 * played out of a different file. */
/* Move-index semantics come from docs/05-the-fighting.md: block 0 idle,
 * 1..6 strikes (hi/mid/lo punch, hi/mid/lo kick), 7/8 back/forward step,
 * 12/13 long retreat/advance, block-15 the run. "In the file, pal14 is
 * skipped, so pal15 lands at array index 14."
 *
 * But dx signs differ between libraries because each library is drawn from
 * its actor's own point of view: ALLPAL has hero walking right (+dx), ALLGAL
 * has guard walking left (-dx) for the *same semantic* "step forward". The
 * game runs the move as-is; direction is baked into the sprite pack. So the
 * port does NOT multiply by facing -- it picks a per-fighter move-index for
 * "toward opponent" and lets dx stand as the file wrote it. */
const HERO_MOVES = {
  IDLE: 0,
  STRIKES: [1, 2, 3, 4, 5, 6],
  TOWARD: 8, AWAY: 7, TOWARD_FAR: 13, AWAY_FAR: 12, RUN_TOWARD: 14,
};
/* Guard's "toward player" is negative dx (guard is on the right, hero on
 * the left). gal07 has dx=-20 so it is the guard's approach; gal08 (+20)
 * is retreat. gal12 (-40) is fast approach, gal14 (-96) is the run. */
const GUARD_MOVES = {
  IDLE: 0,
  STRIKES: [1, 2, 3, 4, 5, 6],
  TOWARD: 7, AWAY: 8, TOWARD_FAR: 12, AWAY_FAR: 13, RUN_TOWARD: 14,
};

const MAX_HP = 26;   // cap from CLAUDE.md; each fighter starts at 13
const START_HP = 13;

function makeFighter(opts) {
  return {
    x: opts.x,
    facing: opts.facing,          // +1 = faces right, -1 = faces left
    library: opts.library,        // 'ALLPAL' / 'ALLGAL' / 'ALLVAL'
    shapePacks: opts.shapePacks,
    maskPacks:  opts.maskPacks,
    moves: opts.moves,            // HERO_MOVES or GUARD_MOVES
    moveIndex: opts.moves.IDLE,
    frameIndex: 0,
    hp: START_HP,
    lastHitAt: -999,              // tick number
    pose: 0,                      // set_pos's first byte -- 05-the-fighting.md
    striking: false,              // this frame is a striking frame
  };
}

const game = {
  mode: 'viewer',                 // 'viewer' or 'game'
  tick: 0,
  paused: false,
  keys: new Set(),                // held keys (lowercase key strings)
  hitFlash: 0,                    // frames left of a hit-flash on the guard
  player: null,
  guard:  null,
  message: '',                    // one-line game state (win/lose)
  seed: 0,
};

/* Reproducible RNG for the AI, so `resetGame(seed)` reproduces a fight. */
function rand01() {
  game.seed = (game.seed * 1103515245 + 12345) & 0x7fffffff;
  return game.seed / 0x7fffffff;
}
function randInt(n) { return Math.floor(rand01() * n); }

function resetGame(seed) {
  game.seed = (seed ?? Date.now()) & 0x7fffffff;
  game.tick = 0;
  game.message = '';
  game.hitFlash = 0;
  game.player = makeFighter({
    x: 60, facing: +1, library: 'ALLPAL', moves: HERO_MOVES,
    shapePacks: ['KSC', 'KS0'], maskPacks: ['KMC', 'KM0'],
  });
  game.guard = makeFighter({
    x: 260, facing: -1, library: 'ALLGAL', moves: GUARD_MOVES,
    shapePacks: ['KS2', 'KS3', 'KSC'], maskPacks: ['KM2', 'KM3', 'KMC'],
  });
  refreshUI();
}
window.resetGame = resetGame;

/* Pick the player's next move from held keys. Idle if nothing pressed. */
function playerAction() {
  const k = game.keys;
  const m = HERO_MOVES;
  if (k.has('a')) return m.STRIKES[0];
  if (k.has('s')) return m.STRIKES[1];
  if (k.has('d')) return m.STRIKES[2];
  if (k.has('z')) return m.STRIKES[3];
  if (k.has('x')) return m.STRIKES[4];
  if (k.has('c')) return m.STRIKES[5];
  if (k.has('shift') && (k.has('arrowright') || k.has('arrowleft')))
    return k.has('arrowright') ? m.RUN_TOWARD : m.AWAY_FAR;
  if (k.has('arrowright')) return m.TOWARD;
  if (k.has('arrowleft'))  return m.AWAY;
  return m.IDLE;
}

/* Guard AI, coarser than the game's own 0x2605 but the same shape: pose,
 * distance and a small random tilt in. Close in when far, strike when near,
 * step back after being hit. See docs/05-the-fighting.md `The guard's AI`. */
function guardAction(guard, distance) {
  const m = guard.moves;
  if (game.tick - guard.lastHitAt < 3) return m.AWAY;
  if (distance > 100) return m.TOWARD_FAR;
  if (distance > 60)  return m.TOWARD;
  if (distance < 44)  return m.STRIKES[randInt(m.STRIKES.length)];
  return (rand01() < 0.5) ? m.TOWARD : m.IDLE;
}

/* Advance one animation frame. When a move exhausts its frames, ask the
 * chooser for the next -- exactly the shape of the game's own fight loop. */
function stepFighter(f, chooser) {
  const moves = assets.moves[f.library] || [];
  let move = moves[f.moveIndex];
  if (!move || f.frameIndex >= move.frames.length) {
    let next = chooser();
    if (typeof next !== 'number' || next < 0 || next >= moves.length) next = MOVE.IDLE;
    f.moveIndex = next;
    f.frameIndex = 0;
    move = moves[next];
    if (!move) return;
  }
  const frame = move.frames[f.frameIndex];
  if (!frame) { f.moveIndex = f.moves.IDLE; f.frameIndex = 0; return; }
  // dx is world-frame per-library: ALLPAL runs hero-right (+), ALLGAL runs
  // guard-left (-). No facing multiply -- direction is baked into the file.
  f.x += frame.inc_x;
  f.pose = frame.pos ? frame.pos[0] : 0;
  // Strike-frame approximation: the middle frame of any strike move. The
  // real flag lives in set_pos's second byte (docs/05-the-fighting.md),
  // which we do not fully model yet.
  f.striking = f.moves.STRIKES.includes(f.moveIndex)
            && f.frameIndex === Math.floor(move.frames.length / 2);
  f.frameIndex++;
}

/* Hit test. The game's own test is a distance-band lookup on the target's
 * stance (0x43AA). The port keeps the shape but simplifies: reach is set by
 * the attack (kicks longer than punches), then the defender's pose can
 * shorten it if crouched -- which is what pal05/pal06's recovery frames do
 * in the original, and is why "hitReach depending on defender" is right
 * even in this simplified form. */
function hitReach(attacker, defender) {
  const strikes = attacker.moves.STRIKES;
  const isKick = strikes.indexOf(attacker.moveIndex) >= 3;   // 4/5/6 are kicks
  let reach = isKick ? 56 : 44;
  // Crouched / recovery poses are lower and pull back -- harder to hit.
  if (defender.pose >= 5 && defender.pose <= 10) reach -= 4;
  return reach;
}

function tryHit(attacker, defender) {
  if (!attacker.striking) return false;
  const dist = Math.abs(defender.x - attacker.x);
  return dist <= hitReach(attacker, defender);
}

function tickGame() {
  const p = game.player, g = game.guard;
  if (!p || !g) return;
  if (p.hp <= 0 || g.hp <= 0) return;   // freeze on game-over

  // Keep the fighters from walking through each other. If a step would
  // cross, the game itself blocks it (0xC3D5 vs 0x10E), and we do the same:
  // don't advance a move that would end past the opponent.
  const prevPX = p.x, prevGX = g.x;

  const dist = Math.abs(g.x - p.x);
  stepFighter(p, () => playerAction());
  stepFighter(g, () => guardAction(g, dist));

  // Face each other.
  p.facing = (g.x >= p.x) ? +1 : -1;
  g.facing = (p.x >= g.x) ? +1 : -1;

  // Undo any crossover.
  if ((g.x - p.x) * (prevGX - prevPX) < 0) { p.x = prevPX; g.x = prevGX; }

  // Clamp to camera-viewport for now (0..300 in world).
  p.x = Math.max(20, Math.min(300, p.x));
  g.x = Math.max(20, Math.min(300, g.x));

  // Hit resolution: attacker striking + within reach -> defender loses 1
  // and takes a small knockback. Regeneration owed at +3 per hit, applied
  // one point at a time between rounds -- simplified here to a slow refill.
  if (tryHit(p, g))  { g.hp = Math.max(0, g.hp - 1); g.lastHitAt = game.tick; game.hitFlash = 4; }
  if (tryHit(g, p))  { p.hp = Math.max(0, p.hp - 1); p.lastHitAt = game.tick; }

  // Slow regen when nobody is striking, capped at 26.
  if (game.tick % 12 === 0) {
    if (!p.striking && p.hp < MAX_HP) p.hp++;
    if (!g.striking && g.hp < MAX_HP) g.hp++;
  }

  if (p.hp <= 0) game.message = 'you lose. press R to restart.';
  else if (g.hp <= 0) game.message = 'guard down. press R to restart.';
  else game.message = '';

  if (game.hitFlash > 0) game.hitFlash--;
  game.tick++;
}

/* Draw a fighter at its own screen position. fig.x from the move script is
 * a pixel offset in the actor's own frame; for a right-facing actor we add
 * it, for a left-facing one we mirror across the actor's x. The game's
 * own left-facing sprites live in the ALLGAL library, so we do NOT flip
 * the sprite -- only the origin. */
function drawFighter(shadow, f) {
  const moves = assets.moves[f.library] || [];
  const move = moves[f.moveIndex];
  if (!move) return;
  const frame = move.frames[Math.min(f.frameIndex, move.frames.length - 1)];
  if (!frame) return;
  for (const fig of frame.figs) {
    const px = f.x + fig.x;   // library is picked per actor; no mirroring
    shadow.blitSprite(
      shape(fig.id, f.shapePacks),
      mask (fig.id, f.maskPacks),
      px, fig.y);
  }
}

/* Simple HP bar at the top -- two rows of pixels per fighter.
 * Byte 0xFF = 4 white pixels; 0x00 = 4 black; we colour it a mix. */
function drawHpBar(shadow, x, hp, facing) {
  const y = 4;
  const fullBytes = Math.max(0, Math.min(MAX_HP, hp));
  const startX = Math.floor(x / 4);
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < MAX_HP; k++) {
      const col = facing > 0 ? startX + k : startX - k;
      if (col < 0 || col >= 80) continue;
      shadow.bytes[(y + r) * 80 + col] = k < fullBytes ? 0xFF : 0x55;
    }
  }
}

function renderGame(shadow) {
  shadow.clear();
  shadow.fillSceneLayers();
  const bcg = assets.backdrops[viewer.backdrop];
  if (bcg) shadow.blitBackdrop(bcg, backdropY(viewer.backdrop));
  if (viewer.backdrop === 'FUJI.BCG') shadow.overlayHorizon();
  renderScene(shadow) || shadow.fillRect(0, 190, 80, 1, 0xFF);

  drawFighter(shadow, game.player);
  if (game.hitFlash === 0 || (game.hitFlash & 1) === 0) drawFighter(shadow, game.guard);
  drawHpBar(shadow, 4,   game.player.hp, +1);
  drawHpBar(shadow, 316, game.guard.hp,  -1);
}

// ---------------------------------------------------------------- viewer render

function renderScene(shadow) {
  const scenes = assets.scenes[viewer.scene];
  if (!scenes || !scenes.length) return false;
  const scene = scenes[0];
  for (const fig of scene.figs) {
    const px = fig.x - viewer.cameraX;
    // Cheap off-screen cull: a sprite is at most 64 bytes wide = 256 px.
    if (px < -256 || px > 320) continue;
    shadow.blitSprite(
      shape(fig.id, viewer.sceneShapePacks),
      mask (fig.id, viewer.sceneMaskPacks),
      px, fig.y);
  }
  return true;
}

/* Y offset for the .BCG file. FUJI.BCG is 35 rows tall and belongs at the
 * horizon (Y=80), not at Y=0 -- Y=80 puts the mountain base at the top of
 * the plateau. CASTLE.BCG is 191 rows tall and covers most of the screen,
 * placed at Y=0. Measured with tools/find-mountain-style scoring: 195 of
 * 206 distinctive FUJI bytes match at Y=80, zero at Y=0. */
function backdropY(name) {
  return name === 'FUJI.BCG' ? 80 : 0;
}

function render(shadow) {
  shadow.clear();
  shadow.fillSceneLayers();
  const bcg = assets.backdrops[viewer.backdrop];
  if (bcg) shadow.blitBackdrop(bcg, backdropY(viewer.backdrop));
  if (viewer.backdrop === 'FUJI.BCG') shadow.overlayHorizon();
  // BAL/CAL scene layer. Falls back to a magenta plateau if the scene has
  // not loaded (which was the placeholder before scene composition worked).
  if (!renderScene(shadow)) {
    shadow.fillRect(0, 190, 80, 1, 0xFF);
  }

  const moves = assets.moves[viewer.library] || [];
  const m = moves[viewer.moveIndex];
  if (!m) return;
  const f = m.frames[viewer.frameIndex];
  if (!f) return;

  // Draw each figure in the frame.
  //
  // fig.x is a PIXEL offset from the actor's screen X, NOT a byte offset.
  // In an ALLPAL frame like `set_fig,1 0 165` / `set_fig,47 17 131`, the
  // body is at offset 0 and the head at offset 17 -- 17 pixels right of
  // the body's left edge. A body sprite is ~56 pixels wide, so 17 puts
  // the head inside the body's horizontal span, on the shoulders. Trying
  // 17 as bytes gave a 68-pixel offset, which put the head clean off the
  // body -- that was the "body and head are separate" bug the viewer
  // showed after first load.
  //
  // fig.y is a scanline; the sprite fills rows fig.y - h .. fig.y - 1
  // (Y is exclusive-end, verified in tools/prove-blit.py).
  for (const fig of f.figs) {
    const pixelX = viewer.actorX + fig.x;
    shadow.blitSprite(
      shape(fig.id, viewer.shapePacks),
      mask (fig.id, viewer.maskPacks),
      pixelX, fig.y);
  }
}

// ---------------------------------------------------------------- self-test

function runSelfTest() {
  const out = [];
  const check = (name, ok, detail) => {
    out.push(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
  };
  const rle = rleDecode(new Uint8Array([0x7B, 0x55, 0x03]), 0, 4);
  check('RLE emits v then c more', rle.length === 4 && rle.every(b => b === 0x55));
  const f = assets.backdrops['FUJI.BCG'];
  check('FUJI.BCG is 320x35', f && f.height === 35, f ? `${f.height}` : 'not loaded');
  const pal = assets.moves['ALLPAL'];
  check('ALLPAL has 51 moves', pal && pal.length === 51, pal ? `${pal.length}` : 'null');
  const gal = assets.moves['ALLGAL'];
  check('ALLGAL has 50 moves', gal && gal.length === 50, gal ? `${gal.length}` : 'null');
  const ksc = assets.packs['KSC'];
  check('KSC has >= 20 records', ksc && ksc.ordered.length >= 20,
        ksc ? `${ksc.ordered.length}` : 'null');
  // Fig 1 = IND id 0x101 = the hero's default standing torso, present in KSC.
  const s = shape(1, ['KSC']);
  check('shape(1) resolves via KSC 0x101',
        s && s.w >= 4 && s.h >= 4, s ? `${s.w}x${s.h}` : 'null');
  // Fig 74 is in KS0, not KSC -- the cross-pack search must find it.
  const s74 = shape(74, ['KSC', 'KS0']);
  check('shape(74) falls through to KS0',
        s74 && s74.w >= 1, s74 ? `${s74.w}x${s74.h}` : 'null');
  const box = document.getElementById('status');
  if (box) box.textContent = out.join('\n');
  return out;
}
window.selfTest = runSelfTest;

// ---------------------------------------------------------------- input

/* Two modes share the keyboard. Mode-switch keys (G, V) are always live;
 * everything else routes to whichever mode is active. In game mode we track
 * held keys (down+up) so a walk key is polled every tick, not only on press. */
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  game.keys.add(k);
  if (k === 'g') { game.mode = 'game'; if (!game.player) resetGame(); refreshUI(); return; }
  if (k === 'v') { game.mode = 'viewer'; refreshUI(); return; }
  if (k === 'r' && game.mode === 'game') { resetGame(); return; }

  if (game.mode === 'game') {
    if (k === 'p') { game.paused = !game.paused; }
    if (['arrowright','arrowleft','arrowup','arrowdown',' '].includes(k)) e.preventDefault();
    return;
  }

  // ---- viewer-mode keys (previous behavior) ----
  if (k === 'arrowright') { viewer.moveIndex = Math.min(
    (assets.moves[viewer.library] || []).length - 1, viewer.moveIndex + 1);
    viewer.frameIndex = 0; refreshUI(); e.preventDefault(); }
  if (k === 'arrowleft') { viewer.moveIndex = Math.max(0, viewer.moveIndex - 1);
    viewer.frameIndex = 0; refreshUI(); e.preventDefault(); }
  if (k === 'arrowdown') { viewer.actorX = Math.max(40, viewer.actorX - 8); }
  if (k === 'arrowup')   { viewer.actorX = Math.min(280, viewer.actorX + 8); }
  if (k === '[') { viewer.cameraX = Math.max(0, viewer.cameraX - 16); }
  if (k === ']') { viewer.cameraX = Math.min(2400, viewer.cameraX + 16); }
  if (k === ' ') { viewer.playing = !viewer.playing; e.preventDefault(); }
  if (k === '.') {
    const m = (assets.moves[viewer.library] || [])[viewer.moveIndex];
    if (m) viewer.frameIndex = (viewer.frameIndex + 1) % m.frames.length;
    refreshUI();
  }
  if (k === ',') {
    const m = (assets.moves[viewer.library] || [])[viewer.moveIndex];
    if (m) viewer.frameIndex = (viewer.frameIndex - 1 + m.frames.length) % m.frames.length;
    refreshUI();
  }
  if (k === 'b') {
    viewer.backdrop = viewer.backdrop === 'FUJI.BCG' ? 'CASTLE.BCG' : 'FUJI.BCG';
  }
  if (k === 'l') {
    const libs = ['ALLPAL', 'ALLGAL', 'ALLVAL'];
    const cur = libs.indexOf(viewer.library);
    pickLibrary(libs[(cur + 1) % libs.length]);
  }
  if (k === 't') runSelfTest();
});

addEventListener('keyup', (e) => { game.keys.delete(e.key.toLowerCase()); });

// ---------------------------------------------------------------- main

async function main() {
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const raw = document.createElement('canvas');
  raw.width = W; raw.height = H;
  const rawCtx = raw.getContext('2d');
  const imageData = rawCtx.createImageData(W, H);
  const shadow = new ShadowBuffer();

  const statusBox = document.getElementById('status');
  const setStatus = (s) => { if (statusBox) statusBox.textContent = s; };

  try {
    await loadAssets(setStatus);
    runSelfTest();
  } catch (e) {
    setStatus(`asset error: ${e.message}`);
    return;
  }

  // Wire the move dropdown.
  const moveSel = document.getElementById('move');
  if (moveSel) {
    moveSel.addEventListener('change', () => pickMove(parseInt(moveSel.value, 10)));
  }
  const libBtns = document.querySelectorAll('[data-lib]');
  libBtns.forEach(b => b.addEventListener('click', () => pickLibrary(b.dataset.lib)));
  const bdBtns = document.querySelectorAll('[data-backdrop]');
  bdBtns.forEach(b => b.addEventListener('click', () => {
    viewer.backdrop = b.dataset.backdrop; refreshUI();
  }));
  const scBtns = document.querySelectorAll('[data-scene]');
  scBtns.forEach(b => b.addEventListener('click', () => pickScene(b.dataset.scene)));
  const modeBtns = document.querySelectorAll('[data-mode]');
  modeBtns.forEach(b => b.addEventListener('click', () => {
    game.mode = b.dataset.mode;
    if (game.mode === 'game' && !game.player) resetGame();
    refreshUI();
  }));

  refreshUI();

  const loop = (now) => {
    if (game.mode === 'game') {
      if (!game.paused && now - viewer.lastTick >= TICK_MS) {
        viewer.lastTick = now;
        tickGame();
        refreshUI();
      }
      renderGame(shadow);
    } else {
      if (viewer.playing && now - viewer.lastTick >= TICK_MS) {
        viewer.lastTick = now;
        const moves = assets.moves[viewer.library] || [];
        const m = moves[viewer.moveIndex];
        if (m && m.frames.length) {
          viewer.frameIndex = (viewer.frameIndex + 1) % m.frames.length;
          refreshUI();
        }
      }
      render(shadow);
    }
    shadow.toImageData(imageData);
    rawCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(raw, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
