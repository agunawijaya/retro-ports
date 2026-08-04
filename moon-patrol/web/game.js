/* Moon Patrol -- a browser rewrite informed by two sources:
 *   1. The DOS decompilation in ../symbols.json (screen model, palette,
 *      HUD, address bases, split-screen shape).
 *   2. The Computer Archeology arcade reverse-engineering (score table,
 *      enemy roster, sound-effect mapping, frame rate) at
 *      https://computerarcheology.com/Arcade/MoonPatrol/ (mirrored in
 *      E:\Projects\Arcade Games\Moon Patrol as HTML). The arcade is
 *      Z80/6803; the DOS conversion is 6502-translated-to-8086. The two
 *      programs share game design but not code.
 *
 * The three-group rule (see ../docs/05-web-architecture.md#provenance):
 *
 *   [DOS]     -- routine in ../symbols.json names it
 *   [arcade]  -- Computer Archeology names it for the arcade ROM
 *   [inferred]/[invented] -- neither does; documented as such
 *
 * Faithful [DOS]:
 *   - 320x200 canvas, CGA palette 1 (cyan/magenta/white on black)
 *     from enter_cga_graphics at file 0x573
 *   - Split status bar at top, scrolling field below
 *     from program_crtc_split at file 0x85D
 *   - Two-course toggle (Beginner / Champion), F1 start / F2 options,
 *     option-menu keys K/J/1/2/B/C/S
 *     from menu strings and scancode_dispatch at file 0x64B
 *   - Keyboard: bit 7 = key ready, bits 6..0 = scancode at [0x100]
 *     from the int 9 ISR at file 0x405
 *   - 8-digit BCD score
 *     from add_bcd_score at file 0x2249
 *   - Buggy horizontal bound of 142 pixels in the field
 *     from check_bounds_5C_A3_8E at file 0x3975
 *   - Terrain scrolls in a 141-cell circular buffer
 *     from advance_scroll at file 0x20DB and render_horizon_stripe at 0x5172
 *   - Sound gate: [0x216] enable byte; PC-speaker one-bit primitive
 *     from speaker_toggle at file 0x4F8B
 *
 * Faithful [arcade]:
 *   - Frame rate 56.74 Hz (VBLANK) -- Moon_Patrol_Hardware_Info
 *   - Score-adjust table with 10 tiers (0/20/50/80/100/200/300/500/800/1000)
 *     at Z80 address 2A0C -- Moon_Patrol.txt
 *   - Rock/alien-ship shot = 100 pts (index 4), crater jumped = 50 pts
 *     (index 2) -- Moon_Patrol.txt table comment
 *   - Sound-effect roster: 12 missile-from-car, 14 car-jump,
 *     17 UFO-flying, 10 passing-one-point, 1F car-explosion
 *     -- Moon_Patrol_Sound.txt jump table at F400
 *   - Enemy roster: rocks, boulders, tank (share ObjDraw_00),
 *     hover-craft (UFO), ground mine (31-frame animation), space plant,
 *     bubble alien shot, ground-hitting alien shots -- Moon_Patrol.txt
 *     ObjectDraws table at 08F5
 *   - Attract mode: E046 bit 7 = "demo mode, don't register score"
 *     -- RAM.txt
 *   - Champion vs Beginner colours differ: buggy pink vs red, status
 *     window blue vs pink -- Moon_Patrol.txt (colour flag at E0F9)
 *
 * Invented/inferred:
 *   - Jump physics, gravity, exact scroll speed, fire cooldown, spawn
 *     intervals -- no routine names them in either source
 *   - Which sprite ID is which shape (DOS atlas format not decoded;
 *     arcade sprite art copyrighted and not shipped)
 *   - Wave sequence -- DOS script opcodes at DS:0xC46/0xC93 not
 *     decoded, arcade sequencer tables not in extracts
 *   - Frames per checkpoint (arcade uses a scroll-based advance we
 *     do not have the sequencer for)
 *   - The three DOS sound-effect data streams' mapping to arcade
 *     names is still open in ../docs/02
 */

'use strict';

// =============================================================== constants

// The internal canvas resolution. The DOS binary runs in CGA mode 4, which
// is 320x200 pixels at 2 bpp -- enter_cga_graphics at file 0x573 chooses it
// with int 10h AX=4.
const W = 320, H = 200;

// CGA palette 1, background 0. enter_cga_graphics at file 0x573 calls
// int 10h AH=0Bh BH=1 BL=1 (palette 1) and AH=0Bh BH=0 BL=0 (background 0).
// These are the four colours the whole DOS program uses on screen.
const PAL = {
  black:   '#000000',
  cyan:    '#55ffff',
  magenta: '#ff55ff',
  white:   '#ffffff',
};

// HUD split. program_crtc_split at file 0x85D writes to CRTC register 3
// (h-sync) and to the MA-lookup pair driven by crtc_scroll_offset at
// [0x8817], so the top rows form a fixed status area and the rest scrolls.
// The exact pixel height is not named in the reading; measured off the
// referee-run screenshot at reference/clean-final.png as ~30 rows out of
// 200. [inferred] -- picked from the picture, not from a routine.
const HUD_H = 30;
const FIELD_TOP = HUD_H;

// Bottom banner ("F1: START GAME  F2: OPTION SCREEN") visible in
// reference/screen-boot.png and reference/clean-final.png. Height picked to
// fit the 5-row font. [inferred] from the referee frames.
const BANNER_H = 8;
const FIELD_BOTTOM = H - BANNER_H;

// Buggy horizontal bound. check_bounds_5C_A3_8E at file 0x3975 checks
// (buggy_col - left_edge) <= 0x8E, i.e. 142 pixels. That is the width of
// the visible field the buggy is allowed to occupy horizontally. The exact
// x offset of the left edge is not stated in the reading, so the port
// centres the buggy zone in the 320-wide field. [inferred] centering.
const BUGGY_FIELD_W = 142;
const BUGGY_FIELD_X0 = (W - BUGGY_FIELD_W) >> 1;   // = 89
const BUGGY_FIELD_X1 = BUGGY_FIELD_X0 + BUGGY_FIELD_W;

// Buggy velocity states. check_var13_set_10_FC / _04 / _00 at file
// 0xE2B / 0xE4B / 0xE6B write these three values into buggy_vx at [0x10]
// depending on the state byte at [0x13]. 0xFC as signed byte = -4.
// Assignment left=-4, right=+4, idle=0 is [inferred] and flagged as open
// in docs/02-architecture.md#what-is-genuinely-open.
const BUGGY_VX_LEFT  = -4;
const BUGGY_VX_RIGHT = +4;
const BUGGY_VX_IDLE  = 0;

// Terrain scroll wraps at 141 cells. advance_scroll at file 0x20DB
// increments terrain_write_ptr at [0x43] and wraps at 0x8D = 141. Also
// matches the width render_horizon_stripe at 0x5172 walks with cl=0x8D.
const TERRAIN_CELLS = 0x8D;

// The BCD score is 8 digits at DS:[0x7A..0x81]. add_bcd_score at
// file 0x2249 does `add al, [0x7A]; daa; mov [0x7A], al`.
const SCORE_DIGITS = 8;

// -------- Invented from here down. See docs/04-porting.md#the-four-traps.
//
// Every value below is a design decision the reading does not settle.
// They are grouped so a later referee-run trace can replace them with
// measured values.

// Frame pacing. The arcade board runs its VBLANK ISR at 56.74 Hz
// (Moon_Patrol_Hardware_Info.txt; also confirmed by "isrCVal changes
// every 1.1 seconds" being the upper 2 bits of an 8-bit ISR counter,
// so 64 IRQs = 1.128 s = 56.74 Hz). The DOS conversion's timing is
// not named in ../symbols.json; the arcade rate is the closest known.
// [arcade]
const TICK_HZ = 56.74;
const TICK_MS = 1000 / TICK_HZ;

// Terrain surface Y at world X. The magenta ground has a per-column
// height driven by two sines summed to give a natural lunar contour.
// `worldX = screenX + game.scrollX` -- so a fixed screen position gets
// a new terrain sample as the scroll advances. This function is the
// single source of truth for where the ground is; drawGameField and
// buggy wheel physics both call it, so wheels visibly rest on the
// same pixels the terrain draws.
//
// The output is the Y of the highest terrain pixel at that column
// (smaller Y = higher up on screen).
const GROUND_BASE = 161;   // Y where terrain sits at its lowest point
function terrainHeight(worldX) {
  const bump = 2 + ((Math.sin(worldX * 0.31) + Math.sin(worldX * 0.11)) * 1.5) | 0;
  return GROUND_BASE - Math.max(0, bump);
}

// Buggy sprite geometry. Matches atlas A[24] (36x9): a dish/canopy on
// top of two 5-pixel-wide wheels at sprite columns 7..11 and 17..21.
// The port draws the body (rows 0..6) and the wheels (rows 7..8) as
// SEPARATE drawImage calls so each wheel bounces on its own terrain
// sample -- the iconic Moon Patrol effect. Fallback primitives use
// the same wheel-column layout so the physics is identical either way.
const SPRITE_BUGGY_W = 36;
const SPRITE_BUGGY_H = 9;
const SPRITE_BUGGY_BODY_H  = 7;   // rows 0..6 = chassis, dish, canopy
const SPRITE_BUGGY_WHEEL_W = 5;
const SPRITE_BUGGY_WHEEL_H = 2;
const SPRITE_BUGGY_BACK_WHEEL_X  = 7;
const SPRITE_BUGGY_FRONT_WHEEL_X = 17;

// Wheel centre X in port coordinates -- used by buggyWheelY() to
// sample the terrain and by the primitive fallback.
const BUGGY_BACK_WHEEL_DX  = SPRITE_BUGGY_BACK_WHEEL_X  + (SPRITE_BUGGY_WHEEL_W >> 1);   // 9
const BUGGY_FRONT_WHEEL_DX = SPRITE_BUGGY_FRONT_WHEEL_X + (SPRITE_BUGGY_WHEEL_W >> 1);   // 19

// Return the current Y of a wheel's top pixel, given the buggy's
// screen X. The wheel sits on the terrain scrolling under it; a
// non-zero buggyLift (jump) raises it further.
function buggyWheelY(dx) {
  const worldX = game.buggyX + dx + game.scrollX;
  return terrainHeight(worldX) - 2 - game.buggyLift;
}

// The chassis rides between the two wheels, roughly 4 px above the
// nearer wheel-top. Used for shot spawn origin and collision AABB.
function buggyChassisY() {
  const b = buggyWheelY(BUGGY_BACK_WHEEL_DX);
  const f = buggyWheelY(BUGGY_FRONT_WHEEL_DX);
  return Math.min(b, f) - 4;
}

// BUGGY_Y_GROUND is the *nominal* Y for the chassis' bottom edge at flat
// ground. Wheels are 2 px tall, chassis body sits 4 px above the wheels.
// Actual runtime buggy Y is derived from terrainHeight() at each wheel
// -- the wheels bounce independently and the chassis rides between them.
const BUGGY_Y_GROUND = GROUND_BASE - 2;   // 159 -- wheel-top at ground level

// Enemy sprites sit on the ground with their base at GROUND_BASE and
// draw upward. Their bottom pixels blend into the magenta ground; the
// tops read as rocks / tanks / mines / plants standing on the surface.
const ENEMY_BASE_Y = GROUND_BASE;   // 161

// Mountains Y-line. From reference/clean-final.png the white zigzag sits
// at y=113 in source coordinates.
const MOUNTAINS_Y = 113;

// Jump kinematics. No routine names a jump velocity or a gravity.
const JUMP_VY  = -3.2;
const GRAVITY  = 0.24;
const JUMP_HOLD_FRAMES = 8;   // how long an early SPACE release stops thrust

// Scroll speed (pixels per frame). The buggy holds its column and the
// world moves past. 141 terrain cells and a 60 Hz tick would let the
// player cross the field in ~2 seconds at 1 pixel/tick; picked slightly
// faster than that to feel like the arcade.
const WORLD_SCROLL = 1.2;
const MOUNTAIN_SCROLL = 0.35;  // parallax layer

// Hazard sizes. [invented] -- neither source names them, so drawn to
// match the general silhouettes visible in reference/clean-final.png
// and the sprite tiles at Sprite_Tiles.txt (they exist but the port
// does not ship them).
const CRATER_MIN_W = 12;
const CRATER_MAX_W = 22;
// Maximum depression depth below GROUND_BASE for a crater's centre
// column. Deep enough that the wheels fall in, shallow enough to
// look like a lunar depression not a bottomless pit.
const CRATER_DEPTH = 8;
const ROCK_W = 10;
const ROCK_H = 8;
const UFO_W = 14;
const UFO_H = 6;
const BOMB_W = 3;
const BOMB_H = 5;
const TANK_W = 14;
const TANK_H = 8;
const MINE_W = 8;
const MINE_H = 6;
const PLANT_W = 10;
const PLANT_H = 12;
const SHOT_LEN = 8;

// Per-phase wave densities. The arcade drives spawn timing from the
// "text command" list at E600 (Moon_Patrol.txt, RAM.txt), which is a
// script we do not have. What we do know is that spawning is
// data-driven, not random-driven, and that the arcade cycles through
// courses with rising difficulty. So the port ships a scripted
// deterministic pattern: eight difficulty phases indexed by
// checkpointIx, each giving the base interval (in ticks) between
// spawns of that class. Zero means "not seen at this phase".
//
// Values chosen so at phase 0 the player has time to react, and at
// phase 7 the field is dense. [scripted -- arcade-inspired, not the
// arcade's own bytes]
const WAVE_PHASES = [
  // rock, crater, ufo, tank, mine, plant
  { rock: 100, crater: 150, ufo:   0, tank:   0, mine:   0, plant:   0 },  // A-B  phase 0
  { rock:  92, crater: 140, ufo: 260, tank:   0, mine:   0, plant:   0 },  // C-D  phase 1
  { rock:  86, crater: 130, ufo: 240, tank: 340, mine:   0, plant:   0 },  // E-F  phase 2
  { rock:  80, crater: 120, ufo: 220, tank: 300, mine: 260, plant:   0 },  // G-I  phase 3
  { rock:  74, crater: 115, ufo: 200, tank: 280, mine: 240, plant: 420 },  // J-L  phase 4
  { rock:  68, crater: 110, ufo: 190, tank: 260, mine: 220, plant: 380 },  // M-O  phase 5
  { rock:  62, crater: 100, ufo: 180, tank: 240, mine: 200, plant: 340 },  // P-S  phase 6
  { rock:  56, crater:  95, ufo: 170, tank: 220, mine: 180, plant: 300 },  // T-Z  phase 7
];

// Boundary between phases -- a checkpoint index N belongs to phase
// PHASE_BOUNDARIES.findIndex(b => N < b), clamped.
const PHASE_BOUNDARIES = [2, 4, 6, 9, 12, 15, 19, 26];

function wavePhase(ckpt) {
  for (let i = 0; i < PHASE_BOUNDARIES.length; i++) {
    if (ckpt < PHASE_BOUNDARIES[i]) return WAVE_PHASES[i];
  }
  return WAVE_PHASES[WAVE_PHASES.length - 1];
}

// Cooldowns. [invented]
const FIRE_COOLDOWN = 8;
const TANK_FIRE_COOLDOWN = 90;

// Point values, from the arcade score-add table at Z80 address 2A0C
// (Moon_Patrol.txt). The table's 10 entries are the ONLY score
// deltas the game grants; individual enemies index into it.
//
//   idx 0 = 0        idx 1 = 20        idx 2 = 50
//   idx 3 = 80       idx 4 = 100       idx 5 = 200
//   idx 6 = 300      idx 7 = 500       idx 8 = 800    idx 9 = 1000
//
// Comment lines in the disassembly identify two entries directly:
// "index 2 = 50, successfully jumping a crater" and "index 4 = 100,
// shooting a rock, shooting an alien ship". Other entries are used
// for tanks / bombs / checkpoint bonuses -- the exact mapping per
// enemy is [inferred] because Moon_Patrol.txt does not label each
// TxtCmd_01 call site with its score index. [arcade]
const ARCADE_SCORE = [0, 20, 50, 80, 100, 200, 300, 500, 800, 1000];

// Rock size classes. Arcade "shot a rock" reads (IX+$07) & 0x0F as
// the score-index (Moon_Patrol.txt 176F: `LD A,(HL); AND $0F`), so
// rocks store their own score-tier byte. The port ships three sizes:
const SCORE_ROCK_SMALL  = ARCADE_SCORE[1];  // 20
const SCORE_ROCK_MED    = ARCADE_SCORE[4];  // 100 -- Moon_Patrol.txt labelled
const SCORE_ROCK_LARGE  = ARCADE_SCORE[6];  // 300
const SCORE_ROCK        = SCORE_ROCK_MED;   // default medium

const SCORE_UFO         = ARCADE_SCORE[6];  // 300 -- [inferred; arcade advertisements list UFO at 300]
const SCORE_BOMB        = ARCADE_SCORE[4];  // 100 -- [inferred; shares the "alien shot" family]
const SCORE_TANK        = ARCADE_SCORE[5];  // 200 -- [inferred]
const SCORE_MINE        = ARCADE_SCORE[4];  // 100 -- [inferred]
const SCORE_PLANT       = ARCADE_SCORE[3];  // 80  -- [inferred; a hazard scattered like rocks]
const SCORE_CRATER_JUMP = ARCADE_SCORE[2];  // 50  -- Moon_Patrol.txt
// The arcade does NOT award a direct score for passing a checkpoint:
// at Z80 1520..1528 the passing-point event plays sound $10 then
// queues TxtCmd_01 (Adjust Score) with A=0, which looks up index 0
// = 0 points. The player-visible bonus arrives only at the *final*
// goal via the "GOOD BONUS POINTS" branch at 2876. So the port
// grants no score per checkpoint, and only awards a bonus at Z.
const SCORE_CHECKPOINT  = 0;                // Moon_Patrol.txt 1525..1528
const SCORE_GOAL_BONUS  = ARCADE_SCORE[9];  // 1000 -- [inferred; the goal bonus tier]

// Checkpoint letters. The arcade point counter (curPoint at E50E)
// increments through 0..0x33 (0..51) and rolls over; after position
// 0x1B = 27 (past Z) the letters use an alternate colour (RAM.txt).
// The DOS attract-mode referee frame at reference/clean-final.png
// shows E, J, O, T, Z along the course bar -- five markers spaced
// evenly across A..Z.
const CHECKPOINT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Frames per checkpoint. The arcade advances the point counter via
// a scroll-position test in the wave sequencer we do not have.
// Chosen to give roughly the arcade pace (~15-20 s per checkpoint).
// [invented]
const FRAMES_PER_CHECKPOINT = Math.round(TICK_HZ * 18);

// Attract-mode timer. The arcade menu_loop (DOS at file 0x5C0) prints
// the demo copy every 500 timer ticks; the arcade equivalent is E046
// bit 7 = "demo mode, don't register score". After this many idle
// title ticks the port drops into a scripted demo.
const ATTRACT_IDLE_FRAMES = Math.round(TICK_HZ * 10);
const ATTRACT_DEMO_FRAMES = Math.round(TICK_HZ * 12);

// =============================================================== utilities

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// Random. There is no named LCG in symbols.json for Moon Patrol -- see
// docs/04-porting.md#1-there-is-no-named-rng. Use Math.random for now.
// A resetGame(seed) call can override the source below by writing to
// `rand` before spawning anything.
let rand = Math.random;
function rndF()          { return rand(); }
function rndInt(n)       { return Math.floor(rand() * n); }
function rndRange(a, b)  { return a + rand() * (b - a); }

// A tiny seedable PRNG for reproducibility, used when resetGame(seed) is
// called from the console. mulberry32 -- not the DOS binary's generator
// (there isn't a named one), just something deterministic.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =============================================================== audio

/* Web Audio square-wave synth. The DOS binary drives the PC speaker
 * with a one-bit XOR through port 0x61 (speaker_toggle at file 0x4F8B),
 * gated by sound_enable at [0x216].
 *
 * The arcade's sound jump table at Z80 F400 (Moon_Patrol_Sound.txt)
 * gives each effect a number:
 *
 *   01  car shooting rocks (DAC explosion sample)
 *   02  missiles hitting ground (DAC)
 *   10  passing one point (checkpoint bonus)
 *   11  UFO explosion
 *   12  missile from car (fire)
 *   13  coin insert
 *   14  car jump
 *   16  space plant (continuous)
 *   17  UFO flying (continuous)
 *   18  background music
 *   1C  opening music (title tune)
 *   1D  reaching goal
 *   1F  car explosion
 *
 * The DOS binary carries its own three sound-effect data streams at
 * DS:0xB75/0xBBC/0xDA7 (sound_effect_B75/BBC/DA7); which of those is
 * which arcade effect is open in ../docs/02. The five effects below
 * play synthesised approximations of the arcade sounds -- the exact
 * frequencies are invented but the effect names map to arcade IDs.
 * [arcade names, invented frequencies] */
const Audio_ = {
  ctx: null, master: null, enabled: true,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
  },

  beep(freq, ms, type = 'square', vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol * 0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + ms / 1000 + 0.02);
  },

  sweep(from, to, ms, vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + ms / 1000);
    g.gain.setValueAtTime(vol * 0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + ms / 1000 + 0.02);
  },

  // Effect names track the arcade sound roster. Frequencies invented.
  shot()          { this.beep(880,  40, 'square',   0.5); },  // arcade 12
  jump()          { this.beep(520, 100, 'triangle', 0.6); },  // arcade 14
  rockExplosion() { this.sweep(720, 120, 180, 0.6); },        // arcade 01
  ufoExplosion()  { this.sweep(560,  80, 250, 0.7); },        // arcade 11
  carExplosion()  { this.sweep(360,  60, 380, 0.9); },        // arcade 1F
  ufoFlying()     { this.beep(240, 220, 'sawtooth', 0.4); },  // arcade 17
  passingPoint()  { this.beep(660, 60); setTimeout(() => this.beep(880, 100), 65); },  // arcade 10
  coin()          { this.beep(1200, 40); setTimeout(() => this.beep(1600, 80), 45); }, // arcade 13
  reachingGoal()  {                                                                   // arcade 1D
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.beep(f, 90, 'square', 0.55), i * 100));
  },

  /* Continuous voice, one per entity. Arcade command 16 "Space plant"
   * runs on AY0 channel A for as long as any plant is alive
   * (Moon_Patrol_Sound.txt: "Channel A handles the 'continuous' sound
   * effects: the flying saucers swirling above or the space plant").
   * Multiple plants alive at once should share the voice on the
   * arcade; here we cap at 3 concurrent voices, one per plant. */
  continuousVoices: new Map(),

  startContinuous(id, freq, type = 'sawtooth', vol = 0.15) {
    if (!this.enabled || !this.ctx) return;
    if (this.continuousVoices.has(id)) return;
    if (this.continuousVoices.size >= 3) return;  // cap
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    // Slow frequency wobble for the "swirling" effect the arcade doc
    // describes.
    lfo.frequency.setValueAtTime(2.5, t);
    lfoGain.gain.setValueAtTime(freq * 0.06, t);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    osc.connect(g); g.connect(this.master);
    osc.start(t); lfo.start(t);
    this.continuousVoices.set(id, { osc, g, lfo });
  },

  stopContinuous(id) {
    if (!this.ctx) return;
    const v = this.continuousVoices.get(id);
    if (!v) return;
    const t = this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.linearRampToValueAtTime(0, t + 0.05);
    v.osc.stop(t + 0.06);
    v.lfo.stop(t + 0.06);
    this.continuousVoices.delete(id);
  },

  stopAllContinuous() {
    for (const id of Array.from(this.continuousVoices.keys())) {
      this.stopContinuous(id);
    }
  },
};

// =============================================================== input

/* peek_key / wait_key_up / clear_key at file 0x562/0x568/0x56D read a
 * single byte at DS:0x100 where the int 9 ISR writes (bit 7 = ready,
 * bits 6..0 = scancode). That is one-press semantics for menu keys.
 * Game keys (left / right / jump / shoot) are treated as held here -- see
 * docs/04-porting.md#2-the-keyboard-buffer-semantics-differ-from-int-16h. */
const Keys = Object.create(null);
const Pressed = Object.create(null);  // consumed once per tick

addEventListener('keydown', e => {
  const swallow = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                   'F1', 'F2', 'Enter', 'Tab', 'Digit1', 'Digit2',
                   'KeyZ', 'KeyX', 'KeyW', 'KeyA', 'KeyD',
                   'KeyB', 'KeyC', 'KeyS', 'KeyP', 'KeyM'];
  if (swallow.includes(e.code)) e.preventDefault();
  if (!Keys[e.code]) Pressed[e.code] = true;
  Keys[e.code] = true;
  Audio_.init();
  if (Audio_.ctx && Audio_.ctx.state === 'suspended') Audio_.ctx.resume();
});
addEventListener('keyup', e => { Keys[e.code] = false; });
addEventListener('blur',  () => { for (const k in Keys) Keys[k] = false; });

// Clicking on the canvas also counts as "any key" on the title, so
// the player can start with a click even if their browser is stealing
// F1. In-game the click is a no-op.
const _canvasEl = document.getElementById('screen');
if (_canvasEl) {
  _canvasEl.addEventListener('click', () => {
    Audio_.init();
    if (Audio_.ctx && Audio_.ctx.state === 'suspended') Audio_.ctx.resume();
    Pressed['Space'] = true;
  });
}

function takePress(code) {
  if (Pressed[code]) { Pressed[code] = false; return true; }
  return false;
}

function pressedAny(codes) {
  for (const c of codes) if (takePress(c)) return true;
  return false;
}

// Live keyboard read (edge for jump, level for movement, edge for fire)
function liveInput() {
  return {
    left:      Keys['ArrowLeft']  || Keys['KeyA'],
    right:     Keys['ArrowRight'] || Keys['KeyD'],
    jump:      Keys['Space'] || Keys['KeyW'] || Keys['ArrowUp'],
    jumpPress: pressedAny(['Space', 'KeyW', 'ArrowUp']),
    fireFwd:   takePress('KeyZ'),
    fireUp:    takePress('KeyX'),
  };
}

// Attract-mode demo. Deterministically drives the buggy: it moves
// forward slightly, occasionally jumps (to clear craters/mines), and
// fires periodically. The DOS attract mode runs from a real wave
// script we do not have; this is a plausible substitute that
// exercises every visual element of the port.
function generateDemoScript() {
  return { seed: Date.now() & 0xFFFF };
}

function demoInputAt(tick) {
  // Rhythmic input pattern -- no RNG so the demo is reproducible.
  const jumpPhase = tick % 90;
  const firePhase = tick % 25;
  const rightPhase = tick % 200;
  return {
    left:      false,
    right:     rightPhase < 40,
    jump:      jumpPhase < 6,
    jumpPress: jumpPhase === 0,
    fireFwd:   firePhase === 0,
    fireUp:    (tick % 50) === 0,
  };
}

// =============================================================== assets

/* Load PATROL.COM at run time and decode a handful of sprites so the
 * port can render arcade-accurate art rather than hand-drawn primitives.
 * Following Karateka's pattern (../karateka/web/game.js): fetch from
 * ../original/, decode with our own JS reader, hold each result as
 * an ImageBitmap for fast drawImage.
 *
 * If the fetch fails (no PATROL.COM in original/, or the page is
 * served from file://), the port falls back to primitive shapes so
 * the game still plays -- that fallback is what shipped before the
 * extraction landed.
 *
 * Sprite format (from blit_sprite_or at file 0x53F9):
 *   byte 0     width in bytes  (each byte = 4 CGA mode-4 pixels at 2bpp)
 *   byte 1     height in scanlines
 *   byte 2..N  width * height CGA-packed pixels, row-major, high nibble first
 *
 * Identified sprite IDs (see ../recovered/sprites/*.png -- extracted
 * with ../tools/extract_sprites.py, then confirmed by ASCII-dumping
 * each candidate and matching the shape):
 *
 *   atlas A[24] 36x9   moon buggy  -- dish/canopy above two wheels
 *   atlas A[13] 36x9   UFO / hover craft -- top dome + disc
 *   atlas A[16] 52x14  tank -- turret + tank tracks
 *   atlas A[1]  56x15  title illustration (buggy + driver figure)
 *
 * Other enemies stay on the primitive path for now.
 */

const DATA_DIR = '../original/';
const DS_ORIGIN_FILE = 0x56D0;
const CGA_PAL_RGBA = [
  [0, 0, 0, 0],           // 0 -- transparent (background 0)
  [85, 255, 255, 255],    // 1 -- cyan
  [255, 85, 255, 255],    // 2 -- magenta
  [255, 255, 255, 255],   // 3 -- white
];

const assets = {
  loaded: false, loading: false,
  buggy: null, tank: null, ufo: null, title: null,
  mountains: null, plant: null, rock: null,
};

function readPtr(bytes, off) { return bytes[off] | (bytes[off + 1] << 8); }

async function decodeSprite(bytes, dsPtr) {
  const off = DS_ORIGIN_FILE + dsPtr;
  if (off + 2 > bytes.length) return null;
  const wBytes = bytes[off];
  const hRows  = bytes[off + 1];
  if (wBytes === 0 || hRows === 0 || wBytes > 20 || hRows > 80) return null;
  if (off + 2 + wBytes * hRows > bytes.length) return null;
  const wPx = wBytes * 4;
  const rgba = new Uint8ClampedArray(wPx * hRows * 4);
  let o = 0;
  for (let row = 0; row < hRows; row++) {
    for (let bx = 0; bx < wBytes; bx++) {
      const b = bytes[off + 2 + row * wBytes + bx];
      for (let px = 0; px < 4; px++) {
        const ix = (b >> ((3 - px) * 2)) & 3;
        const c = CGA_PAL_RGBA[ix];
        rgba[o++] = c[0]; rgba[o++] = c[1]; rgba[o++] = c[2]; rgba[o++] = c[3];
      }
    }
  }
  return await createImageBitmap(new ImageData(rgba, wPx, hRows));
}

async function loadDosAssets() {
  if (assets.loaded || assets.loading) return;
  assets.loading = true;
  try {
    const r = await fetch(DATA_DIR + 'PATROL.COM');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const bytes = new Uint8Array(await r.arrayBuffer());
    // Atlas A pointer table at file 0x68E0 (DS:0x1210), 25 word entries.
    const atlasA = 0x68E0;
    assets.buggy     = await decodeSprite(bytes, readPtr(bytes, atlasA + 24 * 2));
    assets.ufo       = await decodeSprite(bytes, readPtr(bytes, atlasA + 13 * 2));
    assets.tank      = await decodeSprite(bytes, readPtr(bytes, atlasA + 16 * 2));
    assets.title     = await decodeSprite(bytes, readPtr(bytes, atlasA + 1  * 2));
    // A[19] is a 44x8 mountain-parallax tile: magenta silhouette on
    // the left descending, then rising on the right -- meant to
    // repeat to form a mountain range.
    assets.mountains = await decodeSprite(bytes, readPtr(bytes, atlasA + 19 * 2));
    // A[14] is a 28x12 leafy plant / bush silhouette (arcade space
    // plant, one of the ObjDraw_02/03/0C/0D leaf variants baked into
    // a single sprite for the DOS conversion).
    assets.plant     = await decodeSprite(bytes, readPtr(bytes, atlasA + 14 * 2));
    // A[0] is a 24x10 round wheel / rock -- a compact circular shape
    // suitable for the "large" rock class.
    assets.rock      = await decodeSprite(bytes, readPtr(bytes, atlasA + 0  * 2));
    assets.loaded = true;
    console.log('DOS sprites: buggy', assets.buggy && assets.buggy.width + 'x' + assets.buggy.height,
                'ufo', assets.ufo && assets.ufo.width + 'x' + assets.ufo.height,
                'tank', assets.tank && assets.tank.width + 'x' + assets.tank.height);
  } catch (e) {
    console.warn('DOS sprite load failed, using primitives:', e.message);
  } finally {
    assets.loading = false;
  }
}

// Kick off loading immediately. It runs concurrently with the initial
// title-screen render; sprites appear as soon as they decode.
loadDosAssets();

// =============================================================== state

const State = { TITLE: 0, OPTIONS: 1, PLAYING: 2, DYING: 3, OVER: 4 };

// Mirror the DOS binary's game-state cells that we implement in v1.
// The comments name the DS-relative address for each so a later reader
// can cross-reference symbols.json.
const game = {
  state: State.TITLE,

  // Score: 8 BCD digits at DS:[0x7A..0x81]. We hold it as a plain int
  // and format for display; add_bcd_score's DAA behaviour is equivalent
  // for the numeric outcome.
  score: 0,
  hiScore: 1550,   // matches the referee attract-mode default from
                   // reference/clean-final.png (HIGH 001550). [inferred]

  // Course toggle. init_script_pointers at file 0x3D89 uses two script
  // tables at DS:0xC46 and DS:0xC93; the menu keys B / C pick which
  // sequence runs. We keep the flag; the actual sequences are invented.
  course: 'B',            // 'B' beginner, 'C' champion
  soundOn: true,          // menu key S toggles [0x216]

  // Checkpoint progress. FRAMES_PER_CHECKPOINT is invented; the DOS
  // binary's per-checkpoint measure is not named.
  checkpointIx: 0,        // 0..25 for A..Z
  checkpointFrames: 0,

  // Buggy state. Mirrors the DS zero-page cells named in symbols.json:
  //   buggy_x_current [0x99], buggy_y_current [0x9A]
  //   buggy_vx        [0x10]  (0xFC/-4 left, +4 right, 0 idle)
  //   buggy_alive     [0x48]
  //
  // Independent-wheel-suspension model: the buggy holds a fixed X on
  // the field. Each wheel's Y is a fresh sample of terrainHeight() at
  // its own world X (screen X + scrollX). The chassis rides between
  // the two wheels -- when one wheel goes up a bump, the body tilts.
  // A single `buggyLift` value raises both wheels + chassis together
  // during a jump; back on the ground it's zero and wheels track
  // terrain. This is the iconic Moon Patrol behaviour the arcade
  // was known for.
  buggyX: 0,
  buggyLift: 0,           // pixels above ground during a jump
  buggyVY: 0,             // vertical velocity (drives buggyLift)
  buggyVX: 0,
  onGround: true, jumpHeld: 0,
  buggyAlive: true, lives: 3, deathTimer: 0, respawnImmune: 0,

  // Terrain scroll. terrain_write_ptr [0x43] wraps at 0x8D (TERRAIN_CELLS).
  // We keep a float scroll offset and derive per-frame movement from it.
  scrollX: 0,
  mountainX: 0,

  // Entities. The DOS binary keeps four-slot per-class arrays iterated
  // by `mov cl, 3`; here they are JS arrays without the slot-count cap.
  // Enemy set from Moon_Patrol.txt ObjectDraws at 08F5.
  rocks: [],       // arcade "Rocks, boulders" (ObjDraw_00)
  craters: [],     // black gap in the terrain -- fall in with wheels down
  ufos: [],        // arcade "Hover craft" (ObjDraw_01, boost 13)
  bombs: [],       // UFO-dropped shots hitting ground (ObjDraw_0A/0F)
  tanks: [],       // shares ObjDraw_00 with rocks in the arcade
  mines: [],       // arcade "Ground mine" (ObjDraw_14)
  plants: [],      // arcade "Space plant" (ObjDraw_02/03/0C/0D + _11)
  shotsFwd: [],    // arcade player forward shot (Object 2, ObjDraw_0E)
  shotsUp: [],     // arcade air shots (Objects 3..6, ObjDraw_0D)
  parts: [],       // debris / sparks

  // Cooldowns.
  fireCd: 0,
  spawnRock: 60, spawnCrater: 90, spawnUfo: 200,
  spawnTank: 240, spawnMine: 180, spawnPlant: 320,
  nextPlantId: 0,

  // Menu / attract mode. E046 bit 7 in the arcade means "demo mode --
  // don't register score" (RAM.txt). The port uses a boolean.
  attractTimer: 0,
  demoMode: false,     // true while the attract-mode demo is playing
  demoInputs: null,    // scripted input frames while demoMode is on
  tick: 0,

  // For P key.
  paused: false,

  // Mute (M key).
  muted: false,
};

/* Reset to the start of a fresh game.
 *
 * If `seed` is passed, use a deterministic PRNG so the run can be
 * replayed. The DOS binary itself has no named RNG (see
 * docs/04-porting.md#1-there-is-no-named-rng), so this is a
 * port-side choice rather than a translation of anything. */
function resetGame(seed) {
  if (seed !== undefined) rand = mulberry32(seed | 0);
  else rand = Math.random;

  game.score = 0;
  game.checkpointIx = 0;
  game.checkpointFrames = 0;
  game.lives = 3;
  game.tick = 0;

  game.buggyX = BUGGY_FIELD_X0 + 20;
  game.buggyLift = 0;
  game.buggyVX = 0; game.buggyVY = 0;
  game.onGround = true; game.jumpHeld = 0;
  game.buggyAlive = true;
  game.deathTimer = 0; game.respawnImmune = 90;

  game.scrollX = 0; game.mountainX = 0;
  game.rocks.length = 0;
  game.craters.length = 0;
  game.ufos.length = 0;
  game.bombs.length = 0;
  game.tanks.length = 0;
  game.mines.length = 0;
  game.plants.length = 0;
  Audio_.stopAllContinuous();
  game.shotsFwd.length = 0;
  game.shotsUp.length = 0;
  game.parts.length = 0;

  game.fireCd = 0;
  game.spawnRock = 60; game.spawnCrater = 90; game.spawnUfo = 200;
  game.spawnTank = 240; game.spawnMine = 180; game.spawnPlant = 320;
  game.nextPlantId = 0;
  game.demoMode = false;
  game.demoInputs = null;
}

// =============================================================== step

function stepTitle() {
  // Any keydown resets the idle timer -- so a player who is thinking
  // won't be interrupted by the demo.
  for (const k in Keys) { if (Keys[k]) { game.attractTimer = 0; break; } }

  // Attract mode: after ATTRACT_IDLE_FRAMES of no input, drop into a
  // scripted demo that plays for ATTRACT_DEMO_FRAMES, then back to
  // title. Any key press aborts the demo and starts a real game.
  // Matches the arcade E046-bit-7 "demo mode, don't register score"
  // behaviour (RAM.txt).
  if (game.attractTimer >= ATTRACT_IDLE_FRAMES) {
    resetGame();
    game.state = State.PLAYING;
    game.demoMode = true;
    game.demoInputs = generateDemoScript();
    game.attractTimer = 0;
    return;
  }
  // F1 opens Help in most browsers even with preventDefault, so the
  // title accepts ANY key press to start the game -- the F1 label is
  // documented for arcade authenticity but not required. F2 (or Tab
  // or Digit2) opens options; every other key starts.
  if (pressedAny(['F2', 'Digit2', 'Tab'])) {
    for (const k in Pressed) delete Pressed[k];   // drop other queued presses
    game.state = State.OPTIONS;
    return;
  }
  // Any other pressed key kicks off a game. Iterate the Pressed set
  // so this works even if a weird key was hit.
  for (const code in Pressed) {
    if (Pressed[code]) {
      for (const k in Pressed) delete Pressed[k];
      game.demoMode = false;
      resetGame();
      game.state = State.PLAYING;
      return;
    }
  }
  game.attractTimer++;
}

function stepOptions() {
  // Menu strings from docs/01: [K]/[J], [1]/[2], [B]/[C], [S].
  // The DOS scancode_dispatch at file 0x64B walks a (scancode, action)
  // table at DS:0x88A9 to do this; here the keys are handled directly.
  if (takePress('KeyK')) { /* keyboard mode -- already default in a browser */ }
  if (takePress('KeyJ')) { /* joystick -- not supported in v1 */ }
  // [1] and [2] menu keys are documented in the DOS binary at
  // DS:0x81E0+ (`ONE PLAYER OPTION` / `TWO PLAYER OPTION` strings),
  // but the port ships single-player only -- see
  // ../docs/04-porting.md#recommendation. The keys are still swallowed
  // so pressing them from the option screen is a no-op rather than a
  // browser default.
  if (takePress('Digit1')) { /* single-player only */ }
  if (takePress('Digit2')) { /* two-player not shipped */ }
  if (takePress('KeyB'))   game.course = 'B';
  if (takePress('KeyC'))   game.course = 'C';
  if (takePress('KeyS'))   game.soundOn = !game.soundOn;
  if (pressedAny(['F1', 'Space', 'Enter', 'Digit1'])) {
    resetGame(); game.state = State.PLAYING;
  }
  if (takePress('Escape')) game.state = State.TITLE;
}

function stepPlaying() {
  // Any real keypress during demo mode aborts and starts a real game.
  if (game.demoMode) {
    if (pressedAny(['F1', 'Space', 'KeyZ', 'KeyX', 'KeyW',
                    'ArrowLeft', 'ArrowRight', 'ArrowUp'])) {
      resetGame();
      game.demoMode = false;
      return;
    }
    if (game.tick >= ATTRACT_DEMO_FRAMES) {
      game.state = State.TITLE;
      game.demoMode = false;
      game.attractTimer = 0;
      return;
    }
  } else {
    if (takePress('KeyP')) game.paused = !game.paused;
    if (game.paused) return;
    if (takePress('KeyM')) game.muted = !game.muted;
  }

  game.tick++;

  // ---- read inputs: real keys, or the demo script if in attract mode
  const inp = game.demoMode ? demoInputAt(game.tick) : liveInput();

  // ---- input to buggy velocity (mirrors check_var13 trio semantics)
  game.buggyVX = inp.left  ? BUGGY_VX_LEFT
              : inp.right ? BUGGY_VX_RIGHT
              : BUGGY_VX_IDLE;

  // ---- jump (invented; no routine names jump physics)
  const jumpDown = inp.jump;
  const jumpPress = inp.jumpPress;
  if (game.onGround && jumpPress) {
    game.buggyVY = JUMP_VY;
    game.onGround = false;
    game.jumpHeld = JUMP_HOLD_FRAMES;
    if (!game.muted) Audio_.jump();
  }
  if (game.jumpHeld > 0 && jumpDown) {
    game.buggyVY -= 0.08;  // small held-jump boost
    game.jumpHeld--;
  } else {
    game.jumpHeld = 0;
  }

  // ---- fire
  const fireFwd = inp.fireFwd;
  const fireUp  = inp.fireUp;
  if (fireFwd && game.fireCd <= 0) {
    // Forward shot exits the right side of the buggy AT GROUND LEVEL,
    // not at chassis height. If it fired at chassis height it would
    // fly over any rock/mine when the buggy is bouncing on a hump.
    // The arcade fires at a fixed vertical band above the ground so
    // ground hazards can always be hit; we do the same here.
    // -3 lifts the streak just clear of the ground surface line.
    game.shotsFwd.push({ x: game.buggyX + 25, y: GROUND_BASE - 3, vx: 4 });
    game.fireCd = FIRE_COOLDOWN;
    if (!game.muted) Audio_.shot();
  }
  if (fireUp && game.fireCd <= 0) {
    // Up shot exits the top of the buggy (dish/cannon area at sprite col 4).
    game.shotsUp.push({ x: game.buggyX + 5, y: buggyChassisY() - 6, vy: -4 });
    game.fireCd = FIRE_COOLDOWN;
    if (!game.muted) Audio_.shot();
  }
  if (game.fireCd > 0) game.fireCd--;

  // ---- physics
  //
  // Wheel physics: while airborne, buggyLift rises against gravity.
  // Wheel-terrain contact is handled at draw time -- the wheels
  // always visually rest on terrainHeight() at their own X, plus
  // buggyLift when jumping.
  if (game.buggyAlive) {
    game.buggyX = clamp(game.buggyX + game.buggyVX,
                        BUGGY_FIELD_X0, BUGGY_FIELD_X1 - SPRITE_BUGGY_W);
    if (!game.onGround) {
      game.buggyLift -= game.buggyVY;   // buggyVY negative -> lift rises
      game.buggyVY += GRAVITY;
      if (game.buggyLift <= 0) {
        game.buggyLift = 0;
        game.buggyVY = 0;
        game.onGround = true;
      }
    }
    if (game.respawnImmune > 0) game.respawnImmune--;
  } else {
    game.deathTimer++;
    if (game.deathTimer > 90) {
      if (game.lives > 0) {
        game.lives--;
        game.buggyAlive = true;
        game.buggyX = BUGGY_FIELD_X0 + 20;
        game.buggyLift = 0;
        game.buggyVY = 0;
        game.onGround = true;
        game.respawnImmune = 120;
        game.deathTimer = 0;
      } else if (game.demoMode) {
        // Demo run ended by death -- back to title, not GAME OVER.
        game.state = State.TITLE;
        game.demoMode = false;
        game.attractTimer = 0;
        return;
      } else {
        game.state = State.OVER;
        game.attractTimer = 0;
      }
    }
  }

  // ---- scroll
  const speed = game.course === 'C' ? WORLD_SCROLL * 1.35 : WORLD_SCROLL;
  game.scrollX += speed;
  game.mountainX += MOUNTAIN_SCROLL;

  // ---- checkpoint progression
  game.checkpointFrames++;
  if (game.checkpointFrames >= FRAMES_PER_CHECKPOINT) {
    game.checkpointFrames = 0;
    if (game.checkpointIx < CHECKPOINT_LETTERS.length - 1) {
      game.checkpointIx++;
      // Arcade grants no direct score per checkpoint (SCORE_CHECKPOINT
      // is 0); the goal bonus at Z awards SCORE_GOAL_BONUS. Sound
      // effects match the arcade: "passing one point" per checkpoint,
      // "reaching goal" at Z.
      if (game.checkpointIx === CHECKPOINT_LETTERS.length - 1) {
        addScore(SCORE_GOAL_BONUS);
        if (!game.muted) Audio_.reachingGoal();
      } else {
        if (!game.muted) Audio_.passingPoint();
      }
    }
  }

  // ---- spawn
  spawnStep(speed);
  entityStep(speed);
  collisions();

  // ---- particles
  for (let i = game.parts.length - 1; i >= 0; i--) {
    const p = game.parts[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.12;
    if (--p.life <= 0) game.parts.splice(i, 1);
  }
}

function stepOver() {
  game.attractTimer++;
  if (game.attractTimer > 180 && (takePress('Space') || takePress('F1'))) {
    game.state = State.TITLE;
    game.attractTimer = 0;
  }
}

// --------------------------------------------------------------- spawn

function spawnStep(speed) {
  const phase = wavePhase(game.checkpointIx);
  // Champion course tightens intervals to 82% -- one of the ways the
  // arcade's champColors flag makes the champion mode harder without
  // changing the shape of the wave sequencer.
  const scale = game.course === 'C' ? 0.82 : 1.0;
  // Small deterministic wobble so consecutive intervals differ by a
  // few ticks -- otherwise a fixed period looks robotic. Uses tick
  // parity, not rand(), so the sequence is fully reproducible.
  const wobble = (v) => v + ((game.tick >> 3) & 7) - 4;

  if (phase.rock && --game.spawnRock <= 0) {
    // Rock size classes come from arcade "shot a rock" which reads
    // (IX+$07) & 0x0F as the score-index (Moon_Patrol.txt 176F..1778):
    // 0..13 are all valid. We ship three sizes -- small, medium,
    // large -- indexed into ARCADE_SCORE tiers 1/4/6 (20/100/300 pts).
    const roll = ((game.tick >> 2) + game.spawnRock) & 7;
    const size = roll < 4 ? 'medium' : roll < 6 ? 'small' : 'large';
    game.rocks.push({
      x: W + 20, y: ENEMY_BASE_Y, size, alive: true,
    });
    game.spawnRock = Math.round(wobble(phase.rock) * scale);
  }
  if (phase.crater && --game.spawnCrater <= 0) {
    const w = CRATER_MIN_W + ((game.tick >> 4) & 10);
    game.craters.push({ x: W + 20, w, jumped: false, alive: true });
    game.spawnCrater = Math.round(wobble(phase.crater) * scale);
  }
  if (phase.ufo && --game.spawnUfo <= 0) {
    const y = FIELD_TOP + 15 + ((game.tick >> 2) & 15);
    game.ufos.push({ x: W + 20, y, vx: -1.5,
                     dropCd: 40 + ((game.tick >> 4) & 63), alive: true });
    game.spawnUfo = Math.round(wobble(phase.ufo) * scale);
    if (!game.muted) Audio_.ufoFlying();
  }
  if (phase.tank && --game.spawnTank <= 0) {
    game.tanks.push({
      x: W + 20, y: ENEMY_BASE_Y,
      vxExtra: 0.6,
      fireCd: TANK_FIRE_COOLDOWN + ((game.tick >> 3) & 31),
      alive: true,
    });
    game.spawnTank = Math.round(wobble(phase.tank) * scale);
  }
  if (phase.mine && --game.spawnMine <= 0) {
    game.mines.push({
      x: W + 20, y: ENEMY_BASE_Y,
      anim: 0, alive: true,
    });
    game.spawnMine = Math.round(wobble(phase.mine) * scale);
  }
  if (phase.plant && --game.spawnPlant <= 0) {
    const id = 'plant-' + (game.nextPlantId++);
    game.plants.push({
      id, x: W + 20, y: ENEMY_BASE_Y,
      anim: 0, alive: true,
    });
    if (!game.muted) Audio_.startContinuous(id, 180, 'sawtooth', 0.10);
    game.spawnPlant = Math.round(wobble(phase.plant) * scale);
  }
}

function entityStep(speed) {
  // Rocks scroll left with the world.
  for (const r of game.rocks) r.x -= speed;
  for (let i = game.rocks.length - 1; i >= 0; i--) {
    if (game.rocks[i].x < -20 || !game.rocks[i].alive) game.rocks.splice(i, 1);
  }

  // Craters scroll left with the world. Reward jumping over one: when
  // the buggy is airborne AND its center has just passed a crater's
  // trailing edge, award SCORE_CRATER_JUMP (arcade score-table index 2,
  // "Successfully jumping a crater").
  const buggyCenter = game.buggyX + 14;   // sprite midpoint (36/2 - dish offset)
  for (const c of game.craters) {
    const rightEdgePrev = c.x + c.w;
    c.x -= speed;
    const rightEdgeNow = c.x + c.w;
    if (!c.jumped && c.alive && !game.onGround &&
        rightEdgePrev >= buggyCenter && rightEdgeNow < buggyCenter) {
      c.jumped = true;
      addScore(SCORE_CRATER_JUMP);
    }
  }
  for (let i = game.craters.length - 1; i >= 0; i--) {
    if (game.craters[i].x + game.craters[i].w < -4 || !game.craters[i].alive)
      game.craters.splice(i, 1);
  }

  // Tanks come at the buggy from the right, faster than world scroll.
  // They fire tank-shots that fall in a straight line at the buggy.
  for (const t of game.tanks) {
    if (!t.alive) continue;
    t.x -= speed + t.vxExtra;
    t.fireCd--;
    if (t.fireCd <= 0 && t.x < W - 8 && t.x > 4) {
      // Tank shot: aims for the buggy's ground line, moves left at
      // 1.5x world scroll, no gravity -- flat trajectory.
      game.bombs.push({
        x: t.x + 2, y: t.y - 4,
        vy: 0, vx: -(speed + 1.4),
        alive: true, fromTank: true,
      });
      t.fireCd = TANK_FIRE_COOLDOWN + ((game.tick >> 2) & 31);
    }
  }
  for (let i = game.tanks.length - 1; i >= 0; i--) {
    if (game.tanks[i].x < -20 || !game.tanks[i].alive) game.tanks.splice(i, 1);
  }

  // Mines scroll like ground obstacles, but they animate through 31
  // frames the way the arcade ObjDraw_14 does.
  for (const m of game.mines) {
    m.x -= speed;
    m.anim = (m.anim + 1) & 0x1F;
  }
  for (let i = game.mines.length - 1; i >= 0; i--) {
    if (game.mines[i].x < -MINE_W || !game.mines[i].alive) game.mines.splice(i, 1);
  }

  // Space plants scroll with the world; the four-leaf animation cycles
  // at half the ISR rate to look leafy rather than jittery. When a
  // plant leaves the field or is killed, stop its continuous voice.
  for (const p of game.plants) {
    p.x -= speed;
    p.anim = (p.anim + 1) & 0x0F;
  }
  for (let i = game.plants.length - 1; i >= 0; i--) {
    const p = game.plants[i];
    if (p.x < -PLANT_W || !p.alive) {
      Audio_.stopContinuous(p.id);
      game.plants.splice(i, 1);
    }
  }

  // UFOs.
  for (const u of game.ufos) {
    u.x += u.vx;
    u.dropCd--;
    if (u.dropCd <= 0 && u.alive && u.x > BUGGY_FIELD_X0 - 20 && u.x < BUGGY_FIELD_X1 + 20) {
      game.bombs.push({ x: u.x + 6, y: u.y + UFO_H, vy: 1.4, alive: true });
      u.dropCd = 80 + ((game.tick >> 3) & 63);
    }
  }
  for (let i = game.ufos.length - 1; i >= 0; i--) {
    if (game.ufos[i].x < -20 || !game.ufos[i].alive) game.ufos.splice(i, 1);
  }

  // Bombs and tank shots. Tank shots have horizontal velocity and no
  // gravity; UFO bombs fall straight down with vy > 0. A shared array
  // to keep the code simple; the `fromTank` flag distinguishes them.
  for (const b of game.bombs) {
    b.y += b.vy;
    if (b.vx) b.x += b.vx;
  }
  for (let i = game.bombs.length - 1; i >= 0; i--) {
    const b = game.bombs[i];
    const grounded = b.y > ENEMY_BASE_Y;
    const offLeft  = b.x < -4;
    if (!b.alive || grounded || offLeft) {
      // A UFO bomb that lands makes a small crater at the impact site.
      // Tank shots that hit the ground just spark. (Arcade ObjDraw_09
      // is "ground explosion" which draws sparks; ObjDraw_08 is
      // "crater explosion" for the bomb-becomes-crater case.)
      if (b.alive && grounded && !b.fromTank) {
        game.craters.push({ x: b.x - 5, w: 8, jumped: false, alive: true });
        spark(b.x, GROUND_BASE, 4, PAL.magenta);
      } else if (b.alive && grounded && b.fromTank) {
        spark(b.x, GROUND_BASE, 3, PAL.white);
      }
      game.bombs.splice(i, 1);
    }
  }

  // Shots.
  for (const s of game.shotsFwd) s.x += s.vx;
  for (const s of game.shotsUp)  s.y += s.vy;
  for (let i = game.shotsFwd.length - 1; i >= 0; i--) {
    // Remove if off-screen, or if `dead` was flagged by a collision.
    // Using a flag instead of s.x = -100 avoids the wrap-around bug
    // where a "killed" shot at negative x kept advancing back into
    // view because the cleanup only checked x > W + 10.
    const sf = game.shotsFwd[i];
    if (sf.x > W + 10 || sf.dead) game.shotsFwd.splice(i, 1);
  }
  for (let i = game.shotsUp.length - 1; i >= 0; i--) {
    const su = game.shotsUp[i];
    if (su.y < FIELD_TOP || su.dead) game.shotsUp.splice(i, 1);
  }
}

function collisions() {
  if (!game.buggyAlive) return;

  // Buggy collision box covers the visible sprite content (roughly
  // x + 3 .. x + 25 in the 36-wide sprite, since the far right is
  // transparent padding). Top uses chassis Y - 7 (dish is above
  // chassis top). Bottom uses the deeper wheel so a wheel bouncing
  // just high enough over a small hazard still counts as clearing it.
  const cy = buggyChassisY();
  const wheelBackY  = buggyWheelY(BUGGY_BACK_WHEEL_DX)  + 2;
  const wheelFrontY = buggyWheelY(BUGGY_FRONT_WHEEL_DX) + 2;
  const bx0 = game.buggyX + 3, by0 = cy - 7;
  const bx1 = game.buggyX + 25, by1 = Math.max(wheelBackY, wheelFrontY);

  // Forward shot hits rocks
  for (const s of game.shotsFwd) {
    for (const r of game.rocks) {
      if (!r.alive) continue;
      const dims = rockDims(r);
      if (s.x >= r.x && s.x <= r.x + dims.w &&
          s.y >= r.y - dims.h && s.y <= r.y + 2) {
        r.alive = false; s.dead = true;
        addScore(dims.score);
        spark(r.x + dims.w / 2, r.y - dims.h / 2, 6, PAL.white);
        if (!game.muted) Audio_.rockExplosion();
      }
    }
  }

  // Forward shot also hits tanks and mines (both ground-level targets)
  for (const s of game.shotsFwd) {
    for (const t of game.tanks) {
      if (!t.alive) continue;
      if (s.x >= t.x && s.x <= t.x + TANK_W &&
          s.y >= t.y - TANK_H && s.y <= t.y + 2) {
        t.alive = false; s.dead = true;
        addScore(SCORE_TANK);
        spark(t.x + 7, t.y - 4, 10, PAL.white);
        if (!game.muted) Audio_.rockExplosion();
      }
    }
    for (const m of game.mines) {
      if (!m.alive) continue;
      if (s.x >= m.x && s.x <= m.x + MINE_W &&
          s.y >= m.y - MINE_H && s.y <= m.y + 2) {
        m.alive = false; s.dead = true;
        addScore(SCORE_MINE);
        spark(m.x + 4, m.y - 3, 8, PAL.magenta);
        if (!game.muted) Audio_.rockExplosion();
      }
    }
    // Space plants -- taller than rocks; the shot has to be at the
    // plant's leaf height, not just above the ground.
    for (const p of game.plants) {
      if (!p.alive) continue;
      if (s.x >= p.x && s.x <= p.x + PLANT_W &&
          s.y >= p.y - PLANT_H && s.y <= p.y + 2) {
        p.alive = false; s.dead = true;
        addScore(SCORE_PLANT);
        spark(p.x + 5, p.y - 6, 8, PAL.cyan);
        if (!game.muted) Audio_.rockExplosion();
      }
    }
  }

  // Upward shot hits UFOs and bombs
  for (const s of game.shotsUp) {
    for (const u of game.ufos) {
      if (!u.alive) continue;
      if (s.x >= u.x && s.x <= u.x + UFO_W &&
          s.y >= u.y && s.y <= u.y + UFO_H) {
        u.alive = false; s.dead = true;
        addScore(SCORE_UFO);
        spark(u.x + 6, u.y + 3, 10, PAL.cyan);
        if (!game.muted) Audio_.ufoExplosion();
      }
    }
    for (const b of game.bombs) {
      if (!b.alive) continue;
      if (s.x >= b.x - 2 && s.x <= b.x + BOMB_W + 2 &&
          s.y >= b.y - 2 && s.y <= b.y + BOMB_H + 2) {
        b.alive = false; s.dead = true;
        addScore(SCORE_BOMB);
        spark(b.x, b.y, 6, PAL.magenta);
        if (!game.muted) Audio_.rockExplosion();
      }
    }
  }

  if (game.respawnImmune > 0) return;

  // Buggy hits rocks
  for (const r of game.rocks) {
    if (!r.alive) continue;
    const dims = rockDims(r);
    if (bx1 >= r.x && bx0 <= r.x + dims.w &&
        by1 >= r.y - dims.h && by0 <= r.y + 2) {
      killBuggy();
      return;
    }
  }

  // Buggy hits bombs falling on it (or tank shots flying at it)
  for (const b of game.bombs) {
    if (!b.alive) continue;
    if (bx1 >= b.x - 1 && bx0 <= b.x + BOMB_W + 1 &&
        by1 >= b.y - 1 && by0 <= b.y + BOMB_H + 1) {
      killBuggy();
      return;
    }
  }

  // Buggy hits a tank -- tank is on the ground, so only lethal if
  // the buggy is not jumping over it.
  if (game.onGround) {
    for (const t of game.tanks) {
      if (!t.alive) continue;
      if (bx1 >= t.x && bx0 <= t.x + TANK_W &&
          by1 >= t.y - TANK_H && by0 <= t.y + 2) {
        killBuggy();
        return;
      }
    }
  }

  // Buggy hits a mine -- ground-level, only lethal if not jumping.
  // Arcade behaviour: mines are jumpable AND shootable.
  if (game.onGround) {
    for (const m of game.mines) {
      if (!m.alive) continue;
      if (bx1 >= m.x && bx0 <= m.x + MINE_W &&
          by1 >= m.y - MINE_H && by0 <= m.y + 2) {
        killBuggy();
        return;
      }
    }
  }

  // Buggy hits a space plant. Plants are tall, so a jump does not
  // clear them -- the only counter is the forward gun. Contact is
  // lethal at either the ground OR mid-air.
  for (const p of game.plants) {
    if (!p.alive) continue;
    if (bx1 >= p.x && bx0 <= p.x + PLANT_W &&
        by1 >= p.y - PLANT_H && by0 <= p.y + 2) {
      killBuggy();
      return;
    }
  }

  // Buggy falls into crater (only counts if not jumping)
  if (game.onGround) {
    for (const c of game.craters) {
      if (!c.alive) continue;
      // Wheels span sprite columns 7..11 (back) and 17..21 (front).
      const wx0 = game.buggyX + SPRITE_BUGGY_BACK_WHEEL_X;
      const wx1 = game.buggyX + SPRITE_BUGGY_FRONT_WHEEL_X + SPRITE_BUGGY_WHEEL_W;
      if (wx1 >= c.x && wx0 <= c.x + c.w) {
        killBuggy();
        return;
      }
    }
  }
}

function killBuggy() {
  game.buggyAlive = false;
  game.deathTimer = 0;
  spark(game.buggyX + 14, buggyChassisY(), 20, PAL.white);
  if (!game.muted) Audio_.carExplosion();
}

function addScore(n) {
  game.score += n;
  if (game.score > game.hiScore) game.hiScore = game.score;
}

function spark(x, y, n, hue) {
  for (let i = 0; i < n; i++) {
    game.parts.push({
      x, y,
      vx: rndRange(-1.5, 1.5),
      vy: rndRange(-2.5, -0.5),
      life: 12 + rndInt(12),
      hue,
    });
  }
}

// =============================================================== render

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function draw() {
  ctx.fillStyle = PAL.black;
  ctx.fillRect(0, 0, W, H);

  // Title has no HUD in the DOS binary -- see reference/screen-boot.png.
  // HUD is only present once a round is running.
  const inGame = game.state === State.PLAYING ||
                 game.state === State.DYING   ||
                 game.state === State.OVER;

  if (inGame) {
    drawGameField();
    drawHUD();
  } else if (game.state === State.TITLE) {
    drawTitleScreen();
  }

  drawBottomBanner();

  if (game.state === State.OPTIONS) drawOptionsOverlay();
  if (game.state === State.OVER)    drawGameOverOverlay();
  if (game.paused)                  drawPauseOverlay();
}

// -- HUD ---------------------------------------------------------

function drawHUD() {
  // Two panels with black interior, magenta borders on Beginner and
  // cyan borders on Champion -- matching arcade "champColors" flag
  // at E0F9 (Moon_Patrol.txt RAM) which swaps status-window colour.
  const border = game.course === 'C' ? PAL.cyan : PAL.magenta;
  ctx.fillStyle = border;
  ctx.fillRect(0, 0, W, HUD_H);
  // Left panel interior
  ctx.fillStyle = PAL.black;
  ctx.fillRect(4, 2, 130, HUD_H - 4);
  // Right panel interior
  ctx.fillRect(148, 2, 148, HUD_H - 4);

  // Left panel: HIGH ######, current player score.
  // Arcade HUD has "1UP"/"2UP" rows for two-player alternating play
  // (Moon_Patrol.txt: Player 1 score at 8084, Player 2 at 80A4),
  // but the port is single-player, so the third row is left blank
  // to preserve the panel's vertical proportions.
  const scoreStr = String(game.score).padStart(SCORE_DIGITS - 2, '0');
  const hiStr    = String(game.hiScore).padStart(SCORE_DIGITS - 2, '0');
  drawText(6, 3, 'HIGH ' + hiStr, PAL.white);
  drawText(6, 10, '     ' + scoreStr, PAL.white);

  // Demo-mode marker: arcade menu_loop shows an animated banner
  // during attract mode. Port just prints "DEMO" in the score row.
  if (game.demoMode) drawText(60, 10, 'DEMO', PAL.cyan);

  // Right panel: POINT / TIME xxx on left column, buggy icon + count on right
  drawText(150, 3,  'POINT',   PAL.white);
  drawText(150, 10, 'TIME 000', PAL.white);

  // Course bar with checkpoint letters
  drawCheckpointBar(150, 20, 140, 6);

  // Buggy icon and life count in top right
  drawMiniBuggy(W - 22, 3);
  drawText(W - 8, 10, String(game.lives), PAL.white);
}

function drawCheckpointBar(x, y, w, h) {
  // Dashed line along the width
  ctx.fillStyle = PAL.white;
  for (let i = 0; i < w; i += 4) {
    ctx.fillRect(x + i, y + 2, 2, 1);
  }
  // Letters E J O T Z, matching the referee frame at
  // reference/clean-final.png. Positions 4/9/14/19/25 -- the last is
  // Z (index 25) rather than Y (24) so the alphabet's end sits on the
  // bar's right edge.
  const total = CHECKPOINT_LETTERS.length;
  const marks = [4, 9, 14, 19, total - 1];
  for (const i of marks) {
    const px = x + Math.floor((i / (total - 1)) * (w - 4));
    drawText(px, y - 4, CHECKPOINT_LETTERS[i], PAL.white);
  }
  // Current progress arrow
  const p = (game.checkpointIx + game.checkpointFrames / FRAMES_PER_CHECKPOINT) /
            (total - 1);
  const ax = x + Math.floor(clamp(p, 0, 1) * (w - 4));
  ctx.fillStyle = PAL.white;
  ctx.fillRect(ax, y, 1, 3);
  ctx.fillRect(ax - 1, y + 1, 1, 1);
  ctx.fillRect(ax - 2, y + 2, 1, 1);
}

// -- game field ---------------------------------------------------

function drawGameField() {
  // Sky is black (already cleared).

  // Parallax mountains -- zigzag pattern in white, matching
  // reference/clean-final.png middle band.
  drawMountains(MOUNTAINS_Y, 8, 30);

  // Ground surface -- magenta strip below the buggy, with a jagged top
  // edge from terrainHeight(). Same function the buggy wheels sample,
  // so wheels visibly rest on the pixels the ground draws.
  //
  // Craters are DEPRESSIONS in the ground, not full holes:
  // reference/game-35000000.png shows the crater as a bowl-shape
  // where the ground dips down in a smooth curve, magenta continues
  // below. So per crater column, the terrain top is pushed downward
  // by the crater depth curve, but the magenta ground still fills
  // from that lowered top down to FIELD_BOTTOM. The visible "hole"
  // is only the sky area above the bowl-top.
  ctx.fillStyle = PAL.magenta;
  for (let x = 0; x < W; x++) {
    let top = terrainHeight(x + game.scrollX);
    // Test crater overlap
    for (const c of game.craters) {
      if (!c.alive) continue;
      if (x >= c.x && x < c.x + c.w) {
        // Semi-circular dip: at the centre column, deepest; at the
        // edges, level with the surrounding ground.
        const dx = x - c.x, mid = c.w / 2;
        const t = (dx - mid) / mid;   // -1..+1
        const depth = Math.sqrt(Math.max(0, 1 - t * t)) * CRATER_DEPTH | 0;
        top = GROUND_BASE + depth;
        break;
      }
    }
    if (top < FIELD_BOTTOM) ctx.fillRect(x, top, 1, FIELD_BOTTOM - top);
  }

  // Entities in draw order: ground obstacles first, then air, then
  // shots, then buggy on top of everything.
  for (const m of game.mines)   drawMine(m);
  for (const p of game.plants)  drawPlant(p);
  for (const r of game.rocks)   drawRock(r);
  for (const t of game.tanks)   drawTank(t);
  for (const u of game.ufos)    drawUfo(u);
  for (const b of game.bombs)   drawBomb(b);
  for (const s of game.shotsFwd) drawShot(s.x, s.y, PAL.white, 6, 0);
  for (const s of game.shotsUp)  drawShot(s.x, s.y, PAL.white, 0, 6);
  for (const p of game.parts)    drawPart(p);

  if (game.buggyAlive) drawBuggy(game.buggyX);
}

function drawMountains(topY, amp, wavelen) {
  // Arcade mountains are a single-pixel white zigzag line, not a
  // filled shape. Peaks vary a little in height so the range looks
  // natural. Reference: reference/game-35000000.png (referee frame
  // captured from the DOS binary running).
  //
  // The A[19] sprite I initially used as "mountains" was actually
  // some other rocky/debris pattern -- it's kept as `assets.rock`
  // and not drawn as terrain.
  ctx.fillStyle = PAL.white;
  const scroll = game.mountainX;
  for (let x = 0; x < W; x++) {
    const wx = x + scroll;
    // Two-sine profile so peaks aren't identical -- amplitude modulated
    // by a slower sine to give run-of-mountain variation.
    const ampMod = amp * (0.7 + 0.3 * Math.sin(wx * 0.05));
    const t = ((wx % wavelen) + wavelen) % wavelen;
    const rising = t < wavelen / 2;
    const h = rising ? (t / (wavelen / 2)) * ampMod
                     : ((wavelen - t) / (wavelen / 2)) * ampMod;
    ctx.fillRect(x, topY - h | 0, 1, 1);
  }
}

// (Craters are now rendered as depressions in the terrain-column
// loop above -- drawCraters() removed.)

// -- sprite draw ---------------------------------------------------

function drawBuggy(x) {
  // Independent wheel suspension -- the iconic Moon Patrol trick.
  // Each wheel samples terrainHeight() at its own world X. When the
  // extracted sprite is available (atlas A[24] from PATROL.COM), the
  // port draws the chassis body and the two wheels as SEPARATE
  // drawImage calls so each wheel's Y is fresh from the terrain, and
  // the body rides above the higher of the two. The primitive
  // fallback uses the same layout so behaviour is identical when the
  // binary is not present.
  if (game.respawnImmune > 0 && ((game.tick >> 2) & 1)) return;

  const bwTop = buggyWheelY(BUGGY_BACK_WHEEL_DX);   // wheel-top Y
  const fwTop = buggyWheelY(BUGGY_FRONT_WHEEL_DX);
  // Wheel sprite is drawn with its TOP at these Ys. The body rests
  // 1 px above the higher wheel-top.
  const bodyBottomY = Math.min(bwTop, fwTop) - 1;

  if (assets.buggy) {
    // Arcade-accurate art. The sprite is 36x9 with wheels at rows 7-8
    // occupying columns 7..11 and 17..21. To make each wheel bounce
    // independently, the body (top 7 rows) is drawn at min(bwTop, fwTop)
    // - 8, and each wheel patch is redrawn at its own Y below that.
    // The overwrite is safe because the region under each wheel in
    // the body's source rectangle is already transparent -- rows 0-6
    // do not contain wheel pixels.
    const bodyTopY = Math.min(bwTop, fwTop) - 8;
    // Whole sprite drawn once for the body area
    ctx.drawImage(assets.buggy, x, bodyTopY);
    // Then redraw the wheel patches at independent Ys, clearing the
    // stale wheel positions the whole-sprite draw painted at bodyTopY+7/8.
    // Since the sprite's wheel region uses non-transparent pixels, we
    // need to clear those columns first -- but Canvas has no per-pixel
    // clear that's alpha-aware. Simplest: paint black rectangles over
    // the stale wheel positions, then redraw wheels at correct Y.
    ctx.fillStyle = PAL.black;
    ctx.fillRect(x + SPRITE_BUGGY_BACK_WHEEL_X,  bodyTopY + SPRITE_BUGGY_BODY_H,
                 SPRITE_BUGGY_WHEEL_W, SPRITE_BUGGY_WHEEL_H);
    ctx.fillRect(x + SPRITE_BUGGY_FRONT_WHEEL_X, bodyTopY + SPRITE_BUGGY_BODY_H,
                 SPRITE_BUGGY_WHEEL_W, SPRITE_BUGGY_WHEEL_H);
    ctx.drawImage(assets.buggy,
      SPRITE_BUGGY_BACK_WHEEL_X, SPRITE_BUGGY_BODY_H,
      SPRITE_BUGGY_WHEEL_W, SPRITE_BUGGY_WHEEL_H,
      x + SPRITE_BUGGY_BACK_WHEEL_X, bwTop,
      SPRITE_BUGGY_WHEEL_W, SPRITE_BUGGY_WHEEL_H);
    ctx.drawImage(assets.buggy,
      SPRITE_BUGGY_FRONT_WHEEL_X, SPRITE_BUGGY_BODY_H,
      SPRITE_BUGGY_WHEEL_W, SPRITE_BUGGY_WHEEL_H,
      x + SPRITE_BUGGY_FRONT_WHEEL_X, fwTop,
      SPRITE_BUGGY_WHEEL_W, SPRITE_BUGGY_WHEEL_H);
    return;
  }

  // -------- Primitive fallback (no PATROL.COM available) --------
  //
  // A boxy substitute that still has the tilted chassis + independent
  // wheels so gameplay feels the same either way. Champion course
  // swaps cyan <-> magenta (arcade champColors flag at E0F9).
  const body   = game.course === 'C' ? PAL.magenta : PAL.cyan;
  const driver = game.course === 'C' ? PAL.cyan    : PAL.magenta;

  // Chassis body: per-column top edge interpolated between the two
  // wheel positions so the body visibly tilts.
  ctx.fillStyle = body;
  for (let dx = 3; dx < 25; dx++) {
    const t = (dx - BUGGY_BACK_WHEEL_DX) /
              (BUGGY_FRONT_WHEEL_DX - BUGGY_BACK_WHEEL_DX);
    const tClamped = Math.max(0, Math.min(1, t));
    const localBottom = Math.round(bwTop * (1 - tClamped) + fwTop * tClamped) - 1;
    ctx.fillRect(x + dx, localBottom - 4, 1, 4);
  }
  const roofY = Math.round((bwTop + fwTop) / 2) - 7;
  ctx.fillRect(x + 8, roofY, 12, 2);

  // Wheels
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x + SPRITE_BUGGY_BACK_WHEEL_X,  bwTop, SPRITE_BUGGY_WHEEL_W, SPRITE_BUGGY_WHEEL_H);
  ctx.fillRect(x + SPRITE_BUGGY_FRONT_WHEEL_X, fwTop, SPRITE_BUGGY_WHEEL_W, SPRITE_BUGGY_WHEEL_H);
  ctx.fillStyle = body;
  ctx.fillRect(x + SPRITE_BUGGY_BACK_WHEEL_X + 2,  bwTop + 1, 1, 1);
  ctx.fillRect(x + SPRITE_BUGGY_FRONT_WHEEL_X + 2, fwTop + 1, 1, 1);

  // Driver + cannon
  const midY = Math.round((bwTop + fwTop) / 2);
  ctx.fillStyle = driver;
  ctx.fillRect(x + 12, midY - 9, 2, 2);
  ctx.fillStyle = body;
  ctx.fillRect(x + 6, midY - 9, 1, 3);
}

function drawMiniBuggy(x, y) {
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(x, y + 2, 10, 3);
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x + 1, y + 5, 2, 1);
  ctx.fillRect(x + 7, y + 5, 2, 1);
}

// Rock size dimensions and score. Small = 6x5, medium = 10x8,
// large = 14x11. Scores are ARCADE_SCORE tiers 1/4/6 = 20/100/300.
function rockDims(r) {
  switch (r.size) {
    case 'small':  return { w: 6,  h: 5,  score: SCORE_ROCK_SMALL };
    case 'large':  return { w: 14, h: 11, score: SCORE_ROCK_LARGE };
    default:       return { w: 10, h: 8,  score: SCORE_ROCK_MED };
  }
}

function drawRock(r) {
  // Large rock uses the arcade A[0] sprite (24x10 wheel/rock shape).
  // Small and medium stay on the primitive path so they visually
  // differ in size and colour.
  if (r.size === 'large' && assets.rock) {
    ctx.drawImage(assets.rock, r.x - 4, r.y - 9);
    return;
  }
  const { w, h } = rockDims(r);
  ctx.fillStyle = PAL.magenta;
  ctx.fillRect(r.x + 1, r.y - h + 3, w - 2, h - 3);
  ctx.fillRect(r.x + 2, r.y - h + 1, w - 4, 2);
  ctx.fillStyle = PAL.white;
  ctx.fillRect(r.x + 3, r.y - h + 2, 1, 1);
  if (w >= 10) ctx.fillRect(r.x + w - 4, r.y - h + 4, 1, 1);
  if (w >= 14) ctx.fillRect(r.x + w / 2, r.y - h + 3, 1, 1);
}

function drawUfo(u) {
  // Extracted arcade UFO at atlas A[13] (36x9) if available.
  if (assets.ufo) {
    ctx.drawImage(assets.ufo, u.x - 6, u.y - 2);
    return;
  }
  // Primitive fallback.
  ctx.fillStyle = PAL.magenta;
  ctx.fillRect(u.x + 2, u.y + 1, UFO_W - 4, 3);
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(u.x, u.y + 2, UFO_W, 1);
  ctx.fillRect(u.x + 4, u.y, UFO_W - 8, 2);
  ctx.fillStyle = PAL.white;
  ctx.fillRect(u.x + UFO_W / 2 - 1, u.y + 1, 2, 1);
}

function drawBomb(b) {
  // Tank shots are drawn as a horizontal streak; UFO bombs as a
  // vertical droplet. Both white.
  ctx.fillStyle = PAL.white;
  if (b.fromTank) ctx.fillRect(b.x - 1, b.y, BOMB_W + 2, 1);
  else            ctx.fillRect(b.x, b.y, BOMB_W, BOMB_H);
}

function drawTank(t) {
  // Extracted arcade tank at atlas A[16] (52x14) if available.
  // Sprite bottom sits at the ground surface (t.y is ENEMY_BASE_Y).
  if (assets.tank) {
    ctx.drawImage(assets.tank, t.x - 2, t.y - 13);
    return;
  }
  // Primitive fallback: hull + turret + tread in CGA palette.
  ctx.fillStyle = PAL.magenta;
  ctx.fillRect(t.x + 1, t.y - 3, TANK_W - 2, 3);
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(t.x + 4, t.y - 6, 4, 3);
  ctx.fillRect(t.x - 1, t.y - 5, 3, 1);
  ctx.fillStyle = PAL.white;
  ctx.fillRect(t.x, t.y, TANK_W, 1);
}

function drawMine(m) {
  // Arcade ObjDraw_14 animates through 32 frames (Z80 0925..0932):
  //
  //   INC (IX+$0A)       ; frame counter
  //   LD  A,(IX+$0A)
  //   AND $1F            ; keep bottom 5 bits (0..31)
  //   CP  $0B            ; frames 0..10 use one variant
  //   JR  C,ObjDraw_00   ; ... same drawing as rocks
  //   INC E              ; frames 11..31 use the next colour set
  //   JR  ObjDraw_00
  //
  // So the animation is: frames 0..10 dim colour, 11..31 bright with
  // an antenna pulse. The port matches the shape (dim/bright split at
  // 11) but draws a stylised mine rather than sharing the rock code
  // path -- our rocks look nothing like the arcade's tiles either.
  const phase = m.anim & 0x1F;
  const bright = phase >= 0x0B;
  const antenna = (phase & 3) === 0;

  // Body
  ctx.fillStyle = bright ? PAL.cyan : PAL.magenta;
  ctx.fillRect(m.x + 1, m.y - 3, MINE_W - 2, 3);
  // Dome
  ctx.fillStyle = bright ? PAL.white : PAL.cyan;
  ctx.fillRect(m.x + 2, m.y - 5, MINE_W - 4, 2);
  // Antenna and spike
  if (antenna) {
    ctx.fillStyle = PAL.white;
    ctx.fillRect(m.x + MINE_W / 2 - 1, m.y - 7, 2, 2);
  } else {
    ctx.fillStyle = bright ? PAL.white : PAL.magenta;
    ctx.fillRect(m.x + MINE_W / 2, m.y - 6, 1, 1);
  }
  // Prongs on the bright half
  if (bright) {
    ctx.fillStyle = PAL.white;
    ctx.fillRect(m.x, m.y - 2, 1, 2);
    ctx.fillRect(m.x + MINE_W - 1, m.y - 2, 1, 2);
  }
}

function drawPlant(p) {
  // Extracted arcade space plant (atlas A[14], 28x12) if available.
  // Positioned so the base sits on the ground surface.
  if (assets.plant) {
    ctx.drawImage(assets.plant, p.x - 8, p.y - 11);
    return;
  }
  // Primitive fallback: stem + flapping leaves.
  const sway = (p.anim >> 2) & 1;
  const stemX = p.x + PLANT_W / 2;
  // Base pot
  ctx.fillStyle = PAL.magenta;
  ctx.fillRect(p.x + 2, p.y - 2, PLANT_W - 4, 2);
  // Stem
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(stemX, p.y - PLANT_H + 1, 1, PLANT_H - 3);
  // Two pairs of leaves. Lower pair spreads more.
  const lowY = p.y - 4;
  const highY = p.y - 8;
  ctx.fillRect(stemX - 3 - sway, lowY, 3, 1);
  ctx.fillRect(stemX + 1 + sway, lowY, 3, 1);
  ctx.fillRect(stemX - 2 + sway, highY, 2, 1);
  ctx.fillRect(stemX + 1 - sway, highY, 2, 1);
  // Bud at top
  ctx.fillStyle = PAL.white;
  ctx.fillRect(stemX, p.y - PLANT_H, 1, 1);
}

function drawShot(x, y, colour, dx, dy) {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, dx || 1, dy || 1);
  if (dx) ctx.fillRect(x + dx, y, 1, 1);
  if (dy) ctx.fillRect(x, y + dy, 1, 1);
}

function drawPart(p) {
  ctx.fillStyle = p.hue;
  ctx.fillRect(p.x | 0, p.y | 0, 1, 1);
}

// -- bottom banner + overlays ------------------------------------

function drawBottomBanner() {
  // "F1: START GAME  F2: OPTION SCREEN"
  if (game.state === State.TITLE || game.state === State.OPTIONS ||
      game.state === State.OVER) {
    ctx.fillStyle = PAL.magenta;
    ctx.fillRect(0, FIELD_BOTTOM, W, BANNER_H);
    drawText(4, FIELD_BOTTOM + 1, 'F1: START GAME  F2: OPTION SCREEN', PAL.white);
  }
}

function drawTitleScreen() {
  // Full-screen title, redrawn in the CGA palette to have the general
  // shape of reference/screen-boot.png: stylised wordmark near the top,
  // copyright below, an illustration occupying the lower half.
  // The DOS binary ships an ornate stylised bitmap at DS:[0x2F84] via
  // draw_bitmap_stream at file 0x54B2, which the port cannot reproduce
  // without decoding the sprite atlas record format.
  const cx = W / 2;

  // --- starfield: deterministic dots in the sky
  ctx.fillStyle = PAL.white;
  for (let i = 0; i < 30; i++) {
    // Prime multipliers to spread the dots
    const sx = (i * 47 + 13) % W;
    const sy = 4 + ((i * 29 + 7) % 60);
    if (sy < 10 || sy > 55) continue;  // avoid the wordmark area
    ctx.fillRect(sx, sy, 1, 1);
  }

  // --- wordmark: "MOON PATROL" in a magenta band, sized to the text.
  //     Measure the text width at scale 3, then build the box around it
  //     with 6 px padding each side (so the L doesn't overflow).
  const wordScale = 3;
  const wordText = 'MOON PATROL';
  const wordW = measureTextScaled(wordText, wordScale);
  const boxPad = 6;
  const boxW = wordW + boxPad * 2;
  const boxX = Math.floor(cx - boxW / 2);
  const wordX = Math.floor(cx - wordW / 2);
  ctx.fillStyle = PAL.magenta;
  ctx.fillRect(boxX - 2, 16, boxW + 4, 22);
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(boxX, 18, boxW, 18);
  drawTextScaled(wordX, 22, wordText, PAL.magenta, wordScale);

  drawText(cx - 66, 45, '(C) 1982 WILLIAMS  (C) 1983 ATARI', PAL.white);
  drawText(cx - 34, 53, 'ALL RIGHTS RESERVED', PAL.white);

  // --- distant mountains, two ranges for depth
  drawMountains(95, 6, 24);
  drawMountains(110, 9, 34);

  // --- lunar ground with a jagged top edge (same terrainHeight()
  //     used at gameplay, so the title's ground matches the field).
  ctx.fillStyle = PAL.magenta;
  for (let x = 0; x < W; x++) {
    const top = terrainHeight(x);
    ctx.fillRect(x, top, 1, FIELD_BOTTOM - top);
  }

  // --- scattered rocks / craters on the ground
  drawTitleRock(28, BUGGY_Y_GROUND + 5, 'small');
  drawTitleRock(65, BUGGY_Y_GROUND + 5, 'medium');
  drawTitleRock(240, BUGGY_Y_GROUND + 5, 'small');
  drawTitleRock(285, BUGGY_Y_GROUND + 5, 'medium');
  // A crater notch
  ctx.fillStyle = PAL.black;
  for (let dx = 0; dx < 18; dx++) {
    const t = (dx - 9) / 9;
    const depth = Math.sqrt(1 - t * t) * 7 + 2;
    ctx.fillRect(180 + dx, groundTop, 1, depth);
  }

  // --- flying UFO in the upper field
  const uAnim = 5;   // static reference frame
  drawTitleUfo(230, 72);

  // --- big centred buggy silhouette (2x the gameplay size for
  //     dramatic effect)
  drawTitleBuggy(cx - 18, BUGGY_Y_GROUND);
}

function drawTitleRock(x, y, size) {
  drawRock({ x, y, size, alive: true });
}

function drawTitleUfo(x, y) {
  drawUfo({ x, y, alive: true });
  // Add a highlight streak below
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x + 2, y + UFO_H + 1, UFO_W - 4, 1);
}

function drawTitleBuggy(x, y) {
  // 2x scale of the gameplay buggy, still drawn from primitives.
  // Body
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(x + 2, y - 8, 28, 8);
  ctx.fillRect(x + 6, y - 12, 20, 4);
  ctx.fillRect(x + 10, y - 14, 12, 2);
  // Windscreen highlight
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x + 12, y - 12, 6, 2);
  // Wheels (4 pixels tall)
  ctx.fillStyle = PAL.white;
  ctx.fillRect(x + 4, y, 6, 4);
  ctx.fillRect(x + 22, y, 6, 4);
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(x + 5, y + 1, 4, 2);
  ctx.fillRect(x + 23, y + 1, 4, 2);
  // Driver
  ctx.fillStyle = PAL.magenta;
  ctx.fillRect(x + 12, y - 18, 4, 4);
  ctx.fillRect(x + 13, y - 20, 2, 2);
  // Cannon
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(x + 10, y - 18, 2, 4);
}

// Compute the pixel width of a string when drawTextScaled would render it.
function measureTextScaled(str, scale) {
  let total = 0;
  for (const ch of str) {
    const glyph = FONT[ch] || FONT[' '];
    const wide = glyph.some(b => b > 15);
    total += ((wide ? 5 : 4) + 1) * scale;
  }
  return total - scale;   // trailing gap after last char is not part of width
}

// Draw a text string scaled up by an integer factor (nearest neighbour).
function drawTextScaled(x, y, str, colour, scale) {
  ctx.fillStyle = colour;
  let cx = x;
  for (const ch of str) {
    const glyph = FONT[ch] || FONT[' '];
    const wide = glyph.some(b => b > 15);
    const w = wide ? 5 : 4;
    for (let r = 0; r < 5; r++) {
      const row = glyph[r];
      for (let c = 0; c < w; c++) {
        if (row & (1 << (w - 1 - c))) {
          ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
        }
      }
    }
    cx += (w + 1) * scale;
  }
}

function drawOptionsOverlay() {
  ctx.fillStyle = PAL.black;
  ctx.fillRect(20, HUD_H + 4, W - 40, 80);
  ctx.strokeStyle = PAL.magenta;
  ctx.strokeRect(20, HUD_H + 4, W - 40, 80);

  let y = HUD_H + 10;
  const px = 30;
  drawText(px + 60, y, 'GAME OPTIONS', PAL.white); y += 10;
  drawText(px, y, '[B] BEGINNER    ' + (game.course === 'B' ? '*' : ''), PAL.white); y += 8;
  drawText(px, y, '[C] CHAMPION    ' + (game.course === 'C' ? '*' : ''), PAL.white); y += 8;
  drawText(px, y, '[S] SOUND ' + (game.soundOn ? 'ON' : 'OFF'), PAL.white); y += 10;
  drawText(px, y, 'ESC: BACK   F1: START GAME', PAL.magenta);
}

function drawGameOverOverlay() {
  drawText(W / 2 - 30, H / 2 - 10, 'GAME OVER', PAL.white);
  drawText(W / 2 - 55, H / 2 + 2, 'PRESS SPACE OR F1 FOR TITLE', PAL.magenta);
}

function drawPauseOverlay() {
  drawText(W / 2 - 20, H / 2, 'PAUSED', PAL.white);
}

// -- small font ---------------------------------------------------

// 4x5 uppercase pixel font, enough for the HUD strings that the DOS
// binary prints via print_string at file 0x88D. Each glyph is a
// 5-byte array; bit N of byte R = pixel at (N, R).
const FONT = {
  ' ': [0,0,0,0,0], '!': [4,4,4,0,4],
  '.': [0,0,0,0,4], ',': [0,0,0,4,8], ':': [0,4,0,4,0], '-': [0,0,14,0,0],
  '(': [2,4,4,4,2], ')': [8,4,4,4,8], '*': [10,4,14,4,10], '/': [1,2,4,8,0],
  '0': [6,9,9,9,6], '1': [4,12,4,4,14], '2': [14,1,6,8,15],
  '3': [14,1,6,1,14], '4': [9,9,15,1,1], '5': [15,8,14,1,14],
  '6': [6,8,14,9,6], '7': [15,1,2,4,8], '8': [6,9,6,9,6],
  '9': [6,9,7,1,14],
  'A': [6,9,15,9,9], 'B': [14,9,14,9,14], 'C': [7,8,8,8,7],
  'D': [14,9,9,9,14], 'E': [15,8,14,8,15], 'F': [15,8,14,8,8],
  'G': [7,8,11,9,7], 'H': [9,9,15,9,9], 'I': [14,4,4,4,14],
  'J': [1,1,1,9,6], 'K': [9,10,12,10,9], 'L': [8,8,8,8,15],
  'M': [17,27,21,17,17], 'N': [9,13,15,11,9],
  'O': [6,9,9,9,6], 'P': [14,9,14,8,8], 'Q': [6,9,9,10,5],
  'R': [14,9,14,10,9], 'S': [7,8,6,1,14], 'T': [14,4,4,4,4],
  'U': [9,9,9,9,6], 'V': [9,9,9,6,6], 'W': [17,17,21,21,10],
  'X': [9,9,6,9,9], 'Y': [9,9,6,4,4], 'Z': [15,1,6,8,15],
  '@': [6,9,11,10,7],
};

function drawText(x, y, str, colour) {
  ctx.fillStyle = colour;
  let cx = x;
  for (const ch of str) {
    const glyph = FONT[ch] || FONT['?'] || FONT[' '];
    // Width is 3 for narrow chars, 5 for M/N/W/X/Y (which use bit 4 of a
    // 5-bit byte). Detect by any row exceeding 15.
    const wide = glyph.some(b => b > 15);
    const w = wide ? 5 : 4;
    for (let r = 0; r < 5; r++) {
      const row = glyph[r];
      for (let c = 0; c < w; c++) {
        if (row & (1 << (w - 1 - c))) ctx.fillRect(cx + c, y + r, 1, 1);
      }
    }
    cx += w + 1;
  }
}

// =============================================================== main loop

let lastTick = performance.now();
let acc = 0;

function loop(now) {
  const dt = now - lastTick;
  lastTick = now;
  acc += dt;
  // Fixed timestep; skip ticks if the tab was hidden.
  let ticks = 0;
  while (acc >= TICK_MS && ticks < 8) {
    step();
    acc -= TICK_MS;
    ticks++;
  }
  if (ticks >= 8) acc = 0;
  draw();
  requestAnimationFrame(loop);
}

function step() {
  switch (game.state) {
    case State.TITLE:   stepTitle();   break;
    case State.OPTIONS: stepOptions(); break;
    case State.PLAYING: stepPlaying(); break;
    case State.OVER:    stepOver();    break;
  }
}

requestAnimationFrame(now => { lastTick = now; loop(now); });

// URL params for the headless-browser screenshot check. Not shipped
// features; harmless if left in.
//   ?start      -- jump straight to PLAYING
//   ?seed=N     -- reproducible run
//   ?demo       -- pre-populate one of each entity so a screenshot
//                  taken before RAF ticks captures them
if (location.search.includes('start')) {
  const seedMatch = location.search.match(/seed=(\d+)/);
  resetGame(seedMatch ? parseInt(seedMatch[1], 10) : 1);
  game.state = State.PLAYING;
}
if (location.search.includes('demo')) {
  // Non-zero scroll offset so the terrain shows some bump variety and
  // the buggy's independent wheel suspension is visible in the frame.
  game.scrollX = 47;
  // Disable demo-mode autoplay so the buggy stays put at its spawn X
  // for reproducible screenshots.
  game.demoMode = false;
  game.rocks.push({ x: 220, y: ENEMY_BASE_Y, size: 'medium', alive: true });
  game.rocks.push({ x: 100, y: ENEMY_BASE_Y, size: 'small', alive: true });
  game.rocks.push({ x: 280, y: ENEMY_BASE_Y, size: 'large', alive: true });
  game.craters.push({ x: 260, w: 16, jumped: false, alive: true });
  game.ufos.push({ x: 180, y: FIELD_TOP + 20, vx: -1.5, dropCd: 40, alive: true });
  game.bombs.push({ x: 200, y: FIELD_TOP + 60, vy: 1.4, alive: true });
  game.tanks.push({ x: 240, y: ENEMY_BASE_Y, vxExtra: 0.6,
                    fireCd: 40, alive: true });
  game.mines.push({ x: 155, y: ENEMY_BASE_Y, anim: 5, alive: true });
  game.plants.push({ id: 'plant-demo', x: 195, y: ENEMY_BASE_Y, anim: 3, alive: true });
  game.shotsFwd.push({ x: 140, y: BUGGY_Y_GROUND - 3, vx: 4 });
  game.shotsUp.push({ x: 130, y: BUGGY_Y_GROUND - 30, vy: -4 });
  game.score = 3140;
  game.checkpointIx = 3;
  game.checkpointFrames = FRAMES_PER_CHECKPOINT * 0.4;
}

// =============================================================== selfTest

/* Four cheap checks that run in the browser console. Keep them working:
 * a syntax error somewhere unrelated silently kills the whole classic
 * script, which is one of the traps docs/04 warns about. */
window.selfTest = function selfTest() {
  const fail = [];
  const check = (name, cond) => { if (!cond) fail.push(name); };

  // 1. Palette has exactly the four CGA-palette-1 colours.
  check('palette 4 entries', Object.keys(PAL).length === 4);
  check('palette contains cyan',    PAL.cyan    === '#55ffff');
  check('palette contains magenta', PAL.magenta === '#ff55ff');

  // 2. Buggy field is 142 pixels wide (from check_bounds_5C_A3_8E).
  check('buggy field 142', BUGGY_FIELD_X1 - BUGGY_FIELD_X0 === 142);

  // 3. Terrain wraps at 141 cells (from advance_scroll).
  check('terrain wrap 141', TERRAIN_CELLS === 0x8D);

  // 4. Seeded PRNG is reproducible.
  const r = mulberry32(1);
  const seq = [r(), r(), r()].map(x => Math.floor(x * 1000)).join(',');
  const r2 = mulberry32(1);
  const seq2 = [r2(), r2(), r2()].map(x => Math.floor(x * 1000)).join(',');
  check('PRNG deterministic', seq === seq2);

  // 5. resetGame with a seed rewires `rand`.
  resetGame(42);
  const a = rand();
  resetGame(42);
  const b = rand();
  check('resetGame(seed) reproducible', Math.abs(a - b) < 1e-9);

  // 6. Simulation runs 300 ticks from a fresh reset without throwing.
  try {
    resetGame(1);
    game.state = State.PLAYING;
    for (let i = 0; i < 300; i++) step();
  } catch (e) {
    fail.push('300-tick simulation threw: ' + e.message);
  }

  if (fail.length === 0) {
    console.log('%cselfTest ok', 'color:#5f5');
    return true;
  }
  console.error('selfTest FAILED:', fail);
  return false;
};

// Expose reset for the console.
window.resetGame = resetGame;
window.game = game;
