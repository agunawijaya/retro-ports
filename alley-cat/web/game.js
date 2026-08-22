'use strict';
(() => {
  // -------------------------------------------------------------------------
  // Boilerplate
  // -------------------------------------------------------------------------
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;   // 960
  const H = canvas.height;  // 600

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Mulberry32 — a small, fast, deterministic PRNG. Same seed, same texture.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bake a texture into an offscreen canvas the first time; reuse thereafter.
  const bakedCache = new Map();
  function baked(key, w, h, drawFn) {
    if (bakedCache.has(key)) return bakedCache.get(key);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    drawFn(c.getContext('2d'), w, h);
    bakedCache.set(key, c);
    return c;
  }

  // -------------------------------------------------------------------------
  // TITLE SCENE — a moonlit alley, five trash cans, a cat on the fence
  // -------------------------------------------------------------------------

  function drawTitle(t) {
    drawNightSky();
    drawStars();
    drawMoon(t);
    drawSkyline();
    // Fence FIRST — its planks extend all the way to y=600. If we drew the
    // ground before this, the fence would repaint over the pavement and
    // hide it. Ground drawn after covers only the pavement area (y ≥ gy).
    drawFence();
    drawFenceGraffiti();
    drawGround();
    // Bones thrown in previous pop cycles have landed on the pavement and
    // stay there; new ones accumulate each cycle.
    drawLandedBones(t);
    drawCanCastShadows();
    drawTrashCans(t);
    // Bone currently in flight (this cycle) is drawn after cans so it arcs
    // over them, then lands and joins the pile above via drawLandedBones.
    drawFlyingBoneIfActive(t);
    drawCatOnFence(t);
    drawFireflies(t);
    drawTitleType(t);
    drawTitleFooter();
    drawVignette();
  }

  function drawNightSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    g.addColorStop(0.00, '#0f0620');
    g.addColorStop(0.35, '#2c0e46');
    g.addColorStop(0.65, '#6a1e64');
    g.addColorStop(1.00, '#c65a94');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.72);
  }

  function drawStars() {
    const rand = rng(1337);
    ctx.save();
    for (let i = 0; i < 90; i++) {
      const x = rand() * W;
      const y = rand() * H * 0.55;
      const s = rand();
      const size = s < 0.85 ? 1 : (s < 0.97 ? 1.6 : 2.4);
      const alpha = 0.25 + rand() * 0.7;
      ctx.fillStyle = `rgba(255,240,220,${alpha})`;
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  function drawMoon(t) {
    const cx = W * 0.82, cy = H * 0.20, r = 46;
    // outer halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 4.5);
    halo.addColorStop(0, 'rgba(255,235,180,0.35)');
    halo.addColorStop(0.4, 'rgba(255,210,150,0.12)');
    halo.addColorStop(1, 'rgba(255,210,150,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, r * 4.5, 0, TAU); ctx.fill();

    // moon body
    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.2, cx, cy, r);
    body.addColorStop(0, '#fff7d8');
    body.addColorStop(0.6, '#f8dfa4');
    body.addColorStop(1, '#c99a5d');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();

    // craters
    const rand = rng(77);
    ctx.fillStyle = 'rgba(120,80,40,0.20)';
    for (let i = 0; i < 8; i++) {
      const ang = rand() * TAU;
      const rr = rand() * (r * 0.75);
      const sz = 3 + rand() * 6;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, sz, 0, TAU);
      ctx.fill();
    }
  }

  function drawSkyline() {
    // Far city silhouette — very faint, sits behind the fence
    ctx.save();
    ctx.fillStyle = 'rgba(20,10,30,0.55)';
    const baseY = H * 0.62;
    const rand = rng(42);
    let x = -10;
    while (x < W + 10) {
      const w = 25 + rand() * 55;
      const h = 30 + rand() * 90;
      ctx.fillRect(x, baseY - h, w, h);
      // roof detail: chimney or antenna
      if (rand() < 0.35) {
        const cw = 6 + rand() * 8;
        const ch = 10 + rand() * 18;
        ctx.fillRect(x + w * 0.55, baseY - h - ch, cw, ch);
      }
      // window row on some
      if (rand() < 0.6) {
        ctx.fillStyle = 'rgba(255,200,100,0.25)';
        for (let wy = baseY - h + 12; wy < baseY - 6; wy += 12) {
          for (let wx = x + 4; wx < x + w - 4; wx += 8) {
            if (rand() < 0.4) ctx.fillRect(wx, wy, 3, 4);
          }
        }
        ctx.fillStyle = 'rgba(20,10,30,0.55)';
      }
      x += w + 2;
    }
    ctx.restore();
  }

  // Ground y-coordinate — used by drawGround, drawCanCastShadows, drawTrashCans.
  // Set close to where the cans stand so the fence looks like it's right
  // behind them, not receding across a huge pavement.
  const GROUND_Y = H * 0.85;

  function drawGround() {
    const gy = GROUND_Y;

    // Concrete/asphalt pavement — a warm mid-grey that reads clearly as
    // ground SURFACE, distinctly brighter than either the fence above or the
    // shadowed foreground below. This is the fix the user asked for: the
    // pavement was too dark before, blending into the fence base so the cans
    // looked like they floated.
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0.00, '#6a4a58');   // brightest right at the horizon
    g.addColorStop(0.15, '#7a5868');   // peak brightness a hair below
    g.addColorStop(0.55, '#5a3f4c');
    g.addColorStop(1.00, '#251820');   // deep shadow at the very foreground
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, W, H - gy);

    // Definite horizon line — where the fence meets the ground. A hard dark
    // strip immediately below the last plank so the boards look bedded in
    // dirt rather than levitating.
    ctx.fillStyle = '#0e0509';
    ctx.fillRect(0, gy - 2, W, 4);
    // A brighter dirt/moonlit-edge just below the horizon
    ctx.fillStyle = 'rgba(255,200,220,0.22)';
    ctx.fillRect(0, gy + 2, W, 1);

    // (No fanning perspective lines — they were making the pavement read as
    // a plaza receding into the distance. Depth is now conveyed only by the
    // pebbles growing larger toward the foreground.)

    // Pavement texture — larger cobbles in the foreground, fine grit everywhere.
    const tex = baked('pavement2', W, H - gy, (c, w, h) => {
      const rand = rng(913);
      // fine grit everywhere
      for (let i = 0; i < 1100; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const a = 0.08 + rand() * 0.18;
        c.fillStyle = `rgba(255,220,240,${a})`;
        c.fillRect(x, y, 1, 1);
      }
      // Cobble pebbles — perspective-scaled toward foreground
      for (let i = 0; i < 340; i++) {
        const yFrac = rand();
        const x = rand() * w;
        const y = yFrac * h;
        const scale = 0.6 + yFrac * yFrac * 3.2;
        const sz = (1 + rand() * 2) * scale;
        const tone = 90 + rand() * 90;
        c.fillStyle = `rgba(${tone},${tone * 0.7},${tone * 0.85},${0.55 + rand() * 0.35})`;
        c.beginPath();
        c.ellipse(x, y, sz, sz * 0.7, rand() * TAU, 0, TAU);
        c.fill();
        // top highlight
        c.fillStyle = 'rgba(255,230,230,0.55)';
        c.fillRect(x - sz * 0.4, y - sz * 0.55, Math.max(1, sz * 0.35), 1);
        // pebble shadow down-left (moon comes from upper right)
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.beginPath();
        c.ellipse(x - sz * 0.35, y + sz * 0.55, sz * 0.9, sz * 0.4, 0, 0, TAU);
        c.fill();
      }
      // A couple of damp puddles that reflect the sky
      for (let i = 0; i < 4; i++) {
        const x = (0.15 + rand() * 0.7) * w;
        const y = (0.25 + rand() * 0.6) * h;
        const pw = 40 + rand() * 80;
        const ph = 6 + rand() * 6;
        const pg = c.createRadialGradient(x, y, 2, x, y, pw);
        pg.addColorStop(0, 'rgba(220,190,230,0.32)');
        pg.addColorStop(1, 'rgba(220,190,230,0)');
        c.fillStyle = pg;
        c.beginPath(); c.ellipse(x, y, pw, ph, 0, 0, TAU); c.fill();
      }
      // A few scattered ground props: crumpled paper, small twigs
      for (let i = 0; i < 6; i++) {
        const x = rand() * w;
        const y = h * (0.4 + rand() * 0.5);
        c.fillStyle = 'rgba(220,200,170,0.55)';
        c.beginPath();
        c.ellipse(x, y, 5 + rand() * 4, 2 + rand() * 2, rand() * TAU, 0, TAU);
        c.fill();
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.beginPath();
        c.ellipse(x - 2, y + 1, 5 + rand() * 4, 2, rand() * TAU, 0, TAU);
        c.fill();
      }
    });
    ctx.drawImage(tex, 0, gy);

    // Warm moonlight bounce right at the horizon (subtle uplight on the ground)
    const bounce = ctx.createLinearGradient(0, gy, 0, gy + 70);
    bounce.addColorStop(0, 'rgba(255,200,220,0.20)');
    bounce.addColorStop(1, 'rgba(255,200,220,0)');
    ctx.fillStyle = bounce;
    ctx.fillRect(0, gy, W, 70);

    // Foreground vignette
    const vg = ctx.createLinearGradient(0, H - 100, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, H - 100, W, 100);
  }

  // Called AFTER drawGround but BEFORE the cans themselves — a long directional
  // cast shadow lying on the pavement for each can. Moon is upper-right, so
  // shadows fall down and to the LEFT.
  function drawCanCastShadows() {
    ctx.save();
    for (const c of CANS) {
      const w = 84 * c.s;
      const bodyBot = c.y + 130 * c.s * 0.55;
      const cx = c.x - 22;               // shadow offset (down-left of can)
      const cy = bodyBot + 6;
      const sw = w * 0.75;
      const sh = 12;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, sw);
      g.addColorStop(0, 'rgba(0,0,0,0.70)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, sw, sh, -0.15, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Fence: vertical planks running from y=280 to y=600, each ~30px wide,
  // baked once because it doesn't move.
  function drawFence() {
    const top = 280, bot = 600, plankW = 30;
    const tex = baked('fence', W, bot - top, (c, w, h) => {
      // dark gap between planks
      c.fillStyle = '#0a0510';
      c.fillRect(0, 0, w, h);

      const rand = rng(2024);
      let x = 0;
      let idx = 0;
      while (x < w) {
        const pw = plankW + Math.floor(rand() * 4) - 2;
        drawPlank(c, x, 0, pw, h, rand, idx++);
        x += pw + 2; // 2px gap
      }

      // shadow near the bottom to sit the fence into the ground
      const shade = c.createLinearGradient(0, h - 40, 0, h);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.65)');
      c.fillStyle = shade;
      c.fillRect(0, h - 40, w, 40);
    });
    ctx.drawImage(tex, 0, top);
  }

  function drawPlank(c, x, y, w, h, rand, idx) {
    // Base wood tone alternates slightly across planks
    const alt = idx % 3;
    const base = alt === 0 ? '#5a3a24' : alt === 1 ? '#6c4930' : '#4d301c';
    const lite = alt === 0 ? '#8a5c3a' : alt === 1 ? '#9b6c48' : '#7a4d30';
    const dark = '#301a10';

    // Slight lean per plank (very subtle)
    const lean = (rand() - 0.5) * 2;

    c.save();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w + lean, y + h);
    c.lineTo(x + lean, y + h);
    c.closePath();
    c.clip();

    // vertical gradient (moonlight on top, dark at bottom)
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, lite);
    g.addColorStop(0.3, base);
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.fillRect(x, y, w + 4, h);

    // horizontal grain streaks
    for (let i = 0; i < 40; i++) {
      const gy = y + rand() * h;
      const a = 0.05 + rand() * 0.18;
      c.fillStyle = `rgba(30,15,5,${a})`;
      c.fillRect(x, gy, w, 1 + Math.floor(rand() * 2));
    }
    // knots
    if (rand() < 0.35) {
      const kx = x + w * 0.5 + (rand() - 0.5) * (w * 0.4);
      const ky = y + h * (0.15 + rand() * 0.7);
      const kr = 2 + rand() * 3;
      const kg = c.createRadialGradient(kx, ky, 0, kx, ky, kr * 2);
      kg.addColorStop(0, '#1a0a04');
      kg.addColorStop(1, 'rgba(26,10,4,0)');
      c.fillStyle = kg;
      c.beginPath(); c.arc(kx, ky, kr * 2, 0, TAU); c.fill();
    }

    // dog-eared top (some planks have a rounded / chipped top edge)
    const topShape = rand();
    c.fillStyle = 'rgba(0,0,0,0.55)';
    if (topShape < 0.4) {
      // rounded top — clip corners
      c.clearRect(x - 1, y, 3, 3);
      c.clearRect(x + w - 2, y, 3, 3);
      c.fillRect(x, y, 1, 4);
      c.fillRect(x + w - 1, y, 1, 4);
    }

    // moonlit rim on the left edge
    c.fillStyle = 'rgba(255,220,255,0.10)';
    c.fillRect(x, y, 1, h);

    // subtle vertical highlight center
    if (rand() < 0.5) {
      c.fillStyle = 'rgba(255,220,180,0.05)';
      c.fillRect(x + w * 0.35, y, 2, h);
    }

    c.restore();
  }

  // Hand-scrawled marker/pen graffiti on the fence — the original had cat
  // lonely-hearts notes written on the boards.
  //
  // Rendered character-by-character with per-glyph position/rotation/size
  // jitter so no two letters sit on the same baseline or angle, which is what
  // makes handwriting look like handwriting.
  function drawFenceGraffiti() {
    // Kept above y≈380 so the cat popping out of the cans (y≈390 upward)
    // doesn't collide with the writing.
    scrawlText('Love them mousies!', 260, 335, 26, '#ff5aad',  0.03, 42);
    scrawlText('Hi! 555-0000',        60, 340, 20, '#66eaff', -0.06, 17);
    scrawlText('9-CAT-KING',         720, 360, 20, '#ffd744',  0.04, 21);
    scrawlText('meow',               720, 320, 22, '#c07bff',  0.09, 12);
  }

  function scrawlText(text, x, y, size, color, rot, seed) {
    const rand = rng(seed * 137 + text.length * 31);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // Handwriting font stack — Segoe Print/Script on Windows, Bradley Hand on
    // macOS, Comic Sans as an ugly-but-always-there fallback.
    const family =
      '"Segoe Print", "Bradley Hand ITC", "Bradley Hand", "Segoe Script", ' +
      '"Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive';
    ctx.font = `italic 700 ${size}px ${family}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // Draw each character with its own baseline drift, slight tilt, and mild
    // size variation. Kerning is done manually so the jittered widths accumulate.
    let cursorX = 0;
    for (const ch of text) {
      if (ch === ' ') { cursorX += size * 0.35; continue; }

      const jx = (rand() - 0.5) * 1.6;
      const jy = (rand() - 0.5) * 4.5;
      const jrot = (rand() - 0.5) * 0.22;
      const jscale = 0.94 + rand() * 0.14;

      ctx.save();
      ctx.translate(cursorX + jx, jy);
      ctx.rotate(jrot);
      ctx.scale(jscale, jscale);

      // Ink shadow (offset a touch, low alpha — grip on the wood)
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(ch, 1, 2);
      // Main marker stroke
      ctx.fillStyle = color;
      ctx.fillText(ch, 0, 0);
      // Occasional double-stroke — pen going over the letter twice
      if (rand() < 0.3) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.translate(0.6, -0.4);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // Advance cursor by the character width with a small extra jitter
      const w = ctx.measureText(ch).width * jscale;
      cursorX += w * (0.88 + rand() * 0.14);
    }

    // Occasional wet-ink drip beneath one or two letters
    const dripCount = Math.floor(rand() * 2);
    for (let i = 0; i < dripCount; i++) {
      const dx = 4 + rand() * (cursorX - 8);
      const dLen = 4 + rand() * 10;
      const dw = 1.1 + rand() * 0.7;
      ctx.fillStyle = color;
      ctx.fillRect(dx - dw / 2, 3, dw, dLen);
      ctx.beginPath();
      ctx.arc(dx, 3 + dLen, dw * 0.9, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  // Trash cans — shared data so the pop-out animation can drive one of them.
  const CANS = [
    { x: 100, y: 470, s: 1.05, dent: 0.6, ajar:  0,     mouse: false },
    { x: 205, y: 478, s: 1.00, dent: 0.3, ajar: -0.14,  mouse: true  },
    { x: 355, y: 482, s: 0.95, dent: 0.2, ajar:  0,     mouse: false },
    { x: 615, y: 480, s: 1.02, dent: 0.7, ajar:  0,     mouse: false },
    { x: 830, y: 468, s: 1.08, dent: 0.4, ajar:  0.11,  mouse: false },
  ];

  function throwDirection(can) { return can.x > W / 2 ? -1 : +1; }

  // Per-can drawing order when the pop-out animation is active:
  //
  //   1. whole cat (head + neck + torso + legs, extending downward)
  //   2. can body — opaque rounded rectangle, hides everything of the cat
  //      that falls inside the can shape (so lower body vanishes naturally
  //      without any manual clipping)
  //   3. paws hooked over the front rim (drawn on top of the body)
  //   4. lid, tilted upward as if pushed by the cat's head from below
  //
  // The old "shoulders floating above rim" bug was because I was drawing the
  // cat AFTER the body — with no lower body ever painted, the head looked
  // disembodied. Now the whole cat exists, we just let the can hide most of it.
  function drawTrashCans(t) {
    const anim = getPopoutState(t);
    for (let i = 0; i < CANS.length; i++) {
      const c = CANS[i];
      const isAnim = (i === anim.canIdx && anim.lidLift > 0);

      // 1. Cat BEHIND the can (drawn first so the can body covers its bottom)
      if (isAnim && anim.headHeight > 0) {
        drawFullCatInCan(c.x, c.y, c.s, anim.headHeight, anim.throwCock, throwDirection(c));
      }

      // 2. Can body — covers everything of the cat that falls within its footprint
      drawTrashCanBody(c.x, c.y, c.s, c.dent);

      if (isAnim) {
        // 3. Paws visible ON TOP of the front rim (drawn after body)
        if (anim.headHeight > 6) {
          drawPawsOnRim(c.x, c.y, c.s);
        }
        // 4. Lid — hinges on one side, flips UPWARD as openness increases
        const dir = throwDirection(c);
        const openness = anim.lidLift / 22;
        drawTrashCanLid(c.x, c.y, c.s, openness, -dir, false);
      } else {
        drawTrashCanLid(c.x, c.y, c.s, Math.abs(c.ajar) * 0.35,
                        c.ajar >= 0 ? +1 : -1, c.mouse);
      }
    }
    // Flying bone is drawn separately in drawFlyingBoneIfActive (called after
    // the cans in drawTitle) so it stays on top during its arc.
  }

  // ---- Pop-out cat animation ----
  //
  // Timeline (single cycle, per can):
  //   0.0 – 0.4 s : lid lifts up
  //   0.4 – 1.0 s : cat head rises out of can
  //   1.0 – 1.3 s : cat "throws" — head cocks back briefly
  //   1.3 – 3.2 s : fish bone flies in a parabola
  //   3.2 – 3.8 s : cat head retracts
  //   3.8 – 4.2 s : lid closes
  //   4.2 – 7.0 s : idle before next can is chosen
  //
  // Deterministic — same t gives same visual state.
  const POP_CYCLE = 7.0;
  const POP_ORDER = [2, 0, 3, 1, 4, 2, 4, 0, 3];

  function getPopoutState(t) {
    const cycle = Math.floor(t / POP_CYCLE);
    const inCycle = t - cycle * POP_CYCLE;
    const canIdx = POP_ORDER[cycle % POP_ORDER.length];

    let lidLift = 0, headHeight = 0, throwCock = 0, boneT = -1;

    if (inCycle < 0.4)      lidLift = 22 * (inCycle / 0.4);
    else if (inCycle < 3.8) lidLift = 22;
    else if (inCycle < 4.2) lidLift = 22 * (1 - (inCycle - 3.8) / 0.4);

    // Peak head height is 15 px above the rim — enough for the ears + head to
    // clear the rim, not so much that a long neck stretches into view.
    if (inCycle >= 0.4 && inCycle < 3.8) {
      if (inCycle < 1.0) headHeight = 15 * ((inCycle - 0.4) / 0.6);
      else if (inCycle < 3.2) headHeight = 15;
      else headHeight = 15 * (1 - (inCycle - 3.2) / 0.6);
    }

    if (inCycle >= 1.0 && inCycle < 1.3) {
      throwCock = Math.sin(((inCycle - 1.0) / 0.3) * Math.PI);
    }

    if (inCycle >= 1.3 && inCycle < 3.2) {
      boneT = (inCycle - 1.3) / (3.2 - 1.3); // 0..1
    }

    return { canIdx, lidLift, headHeight, throwCock, boneT, inCycle };
  }

  function drawFishBone(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // A cartoon fish skeleton: skull, spine, ribs, tail fin.
    ctx.strokeStyle = '#f4ecd0';
    ctx.fillStyle = '#f4ecd0';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';

    // spine
    ctx.beginPath();
    ctx.moveTo(-10, 0); ctx.lineTo(9, 0);
    ctx.stroke();

    // ribs
    for (let i = -8; i <= 7; i += 3) {
      ctx.beginPath();
      ctx.moveTo(i, -3);
      ctx.lineTo(i, 3);
      ctx.stroke();
    }

    // skull (right end)
    ctx.beginPath();
    ctx.arc(11, 0, 3.2, 0, TAU);
    ctx.stroke();
    // eye socket
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.beginPath(); ctx.arc(12, -0.8, 0.9, 0, TAU); ctx.fill();

    // tail fin (left end)
    ctx.fillStyle = '#f4ecd0';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-16, -4);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-16, 4);
    ctx.closePath();
    ctx.fill();

    // subtle drop shadow so it reads against sky and fence alike
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-10, 1); ctx.lineTo(9, 1);
    ctx.stroke();

    ctx.restore();
  }

  // ---- Trash can body (no lid) ----
  function drawTrashCanBody(cx, cy, s, dent) {
    const w = 84 * s, h = 130 * s;
    const bodyTop = cy - h * 0.4;
    const bodyBot = cy + h * 0.55;

    // Tight contact patch right at the base of the can (the directional
    // cast shadow is drawn separately in drawCanCastShadows).
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.ellipse(cx, bodyBot + 2, w * 0.42, 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Body cylinder — vertical gradient with side highlight/shadow
    const bodyGrad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    bodyGrad.addColorStop(0.00, '#2a2b34');
    bodyGrad.addColorStop(0.18, '#5f6272');
    bodyGrad.addColorStop(0.42, '#a8adbb');
    bodyGrad.addColorStop(0.62, '#8a8f9d');
    bodyGrad.addColorStop(0.85, '#3d4049');
    bodyGrad.addColorStop(1.00, '#1e2028');

    // rounded rectangle body
    ctx.save();
    roundedRect(ctx, cx - w / 2, bodyTop, w, bodyBot - bodyTop, w * 0.14);
    ctx.clip();
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(cx - w / 2, bodyTop, w, bodyBot - bodyTop);

    // hoop bands — recessed lines
    const bandYs = [
      bodyTop + (bodyBot - bodyTop) * 0.22,
      bodyTop + (bodyBot - bodyTop) * 0.52,
      bodyTop + (bodyBot - bodyTop) * 0.82,
    ];
    for (const by of bandYs) {
      // dark line
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(cx - w / 2, by, w, 3);
      // highlight beneath
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(cx - w / 2, by + 3, w, 1);
      // small ridge above (metallic band)
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(cx - w / 2, by - 1, w, 1);
    }

    // dents (subtle dark blobs)
    const rand = rng(Math.floor(cx * 7));
    for (let i = 0; i < 3; i++) {
      const dx = cx + (rand() - 0.5) * w * 0.6;
      const dy = bodyTop + rand() * (bodyBot - bodyTop);
      const dr = 6 + rand() * 10;
      const dg = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
      dg.addColorStop(0, `rgba(0,0,0,${0.35 * dent})`);
      dg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(dx, dy, dr, 0, TAU); ctx.fill();
    }

    // small rust patch
    if (rand() < 0.9) {
      const rx = cx + (rand() - 0.5) * w * 0.4;
      const ry = bodyTop + (bodyBot - bodyTop) * (0.4 + rand() * 0.4);
      const rr = 4 + rand() * 6;
      const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
      rg.addColorStop(0, 'rgba(140,60,20,0.55)');
      rg.addColorStop(1, 'rgba(140,60,20,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.fill();
    }

    // bottom stipple shadow (touching ground)
    const floorShade = ctx.createLinearGradient(0, bodyBot - 30, 0, bodyBot);
    floorShade.addColorStop(0, 'rgba(0,0,0,0)');
    floorShade.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = floorShade;
    ctx.fillRect(cx - w / 2, bodyBot - 30, w, 30);

    ctx.restore();
  }

  // A whole cat drawn as one continuous silhouette, positioned so the head
  // sits `headHeight` pixels above the can's rim. The body/legs extend
  // downward past the rim and will be hidden when the can body is drawn on
  // top of this — no manual clipping needed.
  //
  //   headHeight : 0..30 (rise progress)
  //   cock       : 0..1 (head-back tilt during the throw)
  //   throwDir   : -1 or +1 (face direction)
  function drawFullCatInCan(cx, cy, s, headHeight, cock, throwDir) {
    const rimY = cy - 130 * s * 0.4;      // top of can body (bodyTop)
    const headY = rimY - headHeight;      // head center rises with headHeight

    const dark = '#0a0510';
    const inner = '#3a2028';

    ctx.save();
    ctx.translate(cx, headY);

    // ---- Whole body below the head, extending downward ----
    // All of this is inside the can visually; the can body will cover most
    // of it. Draw at any y >= 8 (below the head circle) — the can rectangle
    // starts at rimY (which is our translated y = headHeight).
    ctx.fillStyle = dark;

    // Neck — thick trapezoid going down from head base
    ctx.beginPath();
    ctx.moveTo(-7, 7);
    ctx.lineTo(7, 7);
    ctx.lineTo(9, 22);
    ctx.lineTo(-9, 22);
    ctx.closePath();
    ctx.fill();

    // Upper torso — big rounded oval
    ctx.beginPath();
    ctx.ellipse(0, 34, 13, 14, 0, 0, TAU);
    ctx.fill();

    // Lower torso / belly
    ctx.beginPath();
    ctx.ellipse(0, 54, 14, 16, 0, 0, TAU);
    ctx.fill();

    // Haunches wider
    ctx.beginPath();
    ctx.ellipse(0, 74, 15, 12, 0, 0, TAU);
    ctx.fill();

    // Front legs pointing down (still visible if headHeight small; hidden
    // once inside can)
    ctx.fillRect(-6, 40, 3.5, 30);
    ctx.fillRect( 2.5, 40, 3.5, 30);

    // Back legs
    ctx.fillRect(-10, 70, 3.5, 24);
    ctx.fillRect(  6.5, 70, 3.5, 24);

    // ---- Head (drawn AFTER body so its outline sits cleanly on top) ----
    ctx.save();
    ctx.rotate(-cock * 0.45 * throwDir);
    ctx.scale(throwDir, 1);

    // Head circle
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.moveTo(-9, -6); ctx.lineTo(-6, -16); ctx.lineTo(-2, -8); ctx.closePath();
    ctx.moveTo( 2, -8); ctx.lineTo( 6, -16); ctx.lineTo( 9, -6); ctx.closePath();
    ctx.fill();
    // Inner ear tint
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(-7, -8); ctx.lineTo(-5, -14); ctx.lineTo(-4, -8); ctx.closePath();
    ctx.moveTo( 4, -8); ctx.lineTo( 5, -14); ctx.lineTo( 7, -8); ctx.closePath();
    ctx.fill();

    // Muzzle
    ctx.fillStyle = '#26202a';
    ctx.beginPath();
    ctx.ellipse(0, 4, 5, 3.5, 0, 0, TAU);
    ctx.fill();
    // Pink nose
    ctx.fillStyle = '#ff9ac0';
    ctx.beginPath();
    ctx.moveTo(-1.4, 3); ctx.lineTo(1.4, 3); ctx.lineTo(0, 5); ctx.closePath();
    ctx.fill();

    // Yellow glowing eyes
    for (const ex of [-4, 4]) {
      const g = ctx.createRadialGradient(ex, -1, 0, ex, -1, 5);
      g.addColorStop(0, 'rgba(255,220,120,0.95)');
      g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ex, -1, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff5b8';
      ctx.beginPath(); ctx.arc(ex, -1, 1.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(ex - 0.5, -3.5, 1, 4);
    }

    // Whiskers only on the leading side
    ctx.strokeStyle = 'rgba(230,220,220,0.7)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(5, 4); ctx.lineTo(15, 3);
    ctx.moveTo(5, 5); ctx.lineTo(15, 6);
    ctx.moveTo(5, 6); ctx.lineTo(15, 9);
    ctx.stroke();

    ctx.restore();  // end head transform
    ctx.restore();  // end whole-cat transform
  }

  // Two paws hooked over the FRONT rim of the can, drawn AFTER the can body
  // so they visibly grip the metal edge.
  function drawPawsOnRim(cx, cy, s) {
    const w = 84 * s;
    const rimY = cy - 130 * s * 0.4;
    const pawY = rimY + 4;
    ctx.save();
    ctx.fillStyle = '#0a0510';
    for (const px of [cx - w * 0.28, cx + w * 0.28]) {
      // Wrist bump curving OVER the rim
      ctx.beginPath();
      ctx.moveTo(px - 4.5, pawY);
      ctx.quadraticCurveTo(px - 4.5, pawY - 8, px, pawY - 6);
      ctx.quadraticCurveTo(px + 4.5, pawY - 8, px + 4.5, pawY);
      ctx.lineTo(px + 4.5, pawY + 3);
      ctx.lineTo(px - 4.5, pawY + 3);
      ctx.closePath();
      ctx.fill();
      // Toe pads
      ctx.fillStyle = '#050308';
      for (let toe = -1; toe <= 1; toe++) {
        ctx.beginPath();
        ctx.arc(px + toe * 1.8, pawY - 4, 1.1, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#0a0510';
    }
    ctx.restore();
  }

  // The lid, drawn as its own layer so it sits on top of the cat-in-can.
  //
  //   openness = 0 (closed) .. 1 (fully flipped up)
  //   hingeDir = +1 : hinge on the LEFT rim  → lid flips UP on the RIGHT
  //   hingeDir = -1 : hinge on the RIGHT rim → lid flips UP on the LEFT
  //
  // Canvas rotation: positive angle = clockwise as seen by the viewer.
  //   * hinging on the left (hingeDir=+1), we want the right edge to swing
  //     UP (from 3 o'clock relative to hinge → 12 o'clock). That is a CCW
  //     rotation → NEGATIVE angle.
  //   * hinging on the right (hingeDir=-1), we want the left edge to swing
  //     UP (from 9 o'clock → 12 o'clock). That is a CW rotation →
  //     POSITIVE angle.
  //
  //   → angle = -hingeDir * openness * maxAngle gives the correct sign
  //   (was correct in intent; the previous bug was that the lid drawing
  //   itself used the WRONG y — it sat inside the can, not on top — so
  //   even a correct rotation LOOKED like it dipped downward. Both are now
  //   fixed: lid rests at restLidY = bodyTop - 6 (just ABOVE the rim),
  //   and rotates upward from there.)
  function drawTrashCanLid(cx, cy, s, openness, hingeDir, mouse) {
    const w = 84 * s;
    const bodyTop = cy - 130 * s * 0.4;
    // Lid sits ON TOP of the can rim, not inside it. restLidY is the CENTER
    // of the lid disc, one lid-height above the rim.
    const restLidY = bodyTop - 6;
    const lidRadius = w * 0.48;

    const hingeX = cx + hingeDir * lidRadius;
    const hingeY = restLidY + 2;   // slight rim contact
    const maxAngle = 0.75;         // ~43°: strong tilt without going absurd
    // Canvas rotation: positive = CW as viewed on screen.
    //   hinge on LEFT (hingeDir=-1): want right edge to go UP → CCW → NEG angle
    //   hinge on RIGHT (hingeDir=+1): want left edge to go UP → CW → POS angle
    //   → angle sign matches hingeDir.
    const angle = hingeDir * openness * maxAngle;

    ctx.save();
    ctx.translate(hingeX, hingeY);
    ctx.rotate(angle);
    ctx.translate(-hingeX, -hingeY);

    drawLidShape(cx, restLidY, w, mouse && openness < 0.05);

    ctx.restore();
  }

  // The actual metal disc + handle. Called from drawTrashCanLid after transform.
  function drawLidShape(cx, cy, w, showMouseTail) {
    ctx.save();
    ctx.translate(cx, cy);

    // If a mouse is peeking (only in the static-ajar case), draw a small tail
    // hanging out from underneath.
    if (showMouseTail) {
      ctx.fillStyle = '#0a0508';
      ctx.beginPath();
      ctx.ellipse(0, 4, w * 0.44, 6, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#f2c6d8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-w * 0.05, 0);
      ctx.quadraticCurveTo(w * 0.05, -6, w * 0.15, 2);
      ctx.stroke();
    }

    // Underside of the lid (visible when tilted). Slightly darker than top.
    ctx.fillStyle = '#1a1a20';
    ctx.beginPath();
    ctx.ellipse(0, 4, w * 0.48, 5, 0, 0, TAU);
    ctx.fill();

    // Lid top — a shallow dome
    const lidGrad = ctx.createLinearGradient(-w / 2, -8, w / 2, 6);
    lidGrad.addColorStop(0.00, '#2a2b34');
    lidGrad.addColorStop(0.25, '#7a7e8c');
    lidGrad.addColorStop(0.55, '#c8ccd8');
    lidGrad.addColorStop(0.75, '#8a8f9d');
    lidGrad.addColorStop(1.00, '#2a2b34');
    ctx.fillStyle = lidGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.48, 12, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Highlight streak
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.10, -6, w * 0.20, 2, 0, 0, TAU);
    ctx.fill();

    // Handle — a small metal arch
    ctx.strokeStyle = '#1a1a20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -6, 10, Math.PI, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -7, 10, Math.PI * 1.05, TAU * 0.5 - 0.2);
    ctx.stroke();

    ctx.restore();
  }

  // Where the flying bone starts and ends and how it arcs — driven by getPopoutState.
  // Where the bone thrown in cycle `c` lands on the pavement. Deterministic —
  // called by both the flying-bone (as its trajectory target) and the
  // landed-bones renderer (to lay each past bone down at the same spot on
  // every frame).
  function computeBoneTargetForCycle(c) {
    const canIdx = POP_ORDER[c % POP_ORDER.length];
    const can = CANS[canIdx];
    const dir = throwDirection(can);
    const rand = rng(c * 137 + canIdx * 19 + 5);
    // Landing distance from the can, in throw direction
    const distance = 90 + rand() * 220;
    // Landing y on the pavement — spread across most of the visible ground
    const py = GROUND_Y + 40 + rand() * 100;
    // Final resting rotation
    const rot = (rand() - 0.5) * TAU;
    return { x: can.x + dir * distance, y: py, rot };
  }

  // Bone in flight during the current pop cycle.
  function drawFlyingBoneIfActive(t) {
    const anim = getPopoutState(t);
    if (anim.boneT < 0 || anim.boneT >= 1) return;
    const cycle = Math.floor(t / POP_CYCLE);
    const target = computeBoneTargetForCycle(cycle);
    const can = CANS[anim.canIdx];
    const dir = throwDirection(can);
    const rimY = can.y - 130 * can.s * 0.4;

    const sx = can.x + dir * 12;
    const sy = rimY - 15 + 4;                  // out of the cat's mouth
    const ex = target.x;
    const ey = target.y;
    const arc = 140;

    const bt = anim.boneT;
    const bx = lerp(sx, ex, bt);
    const by = lerp(sy, ey, bt) - Math.sin(bt * Math.PI) * arc;
    // Rotates freely mid-air, coming to rest at the target rotation at bt=1
    const rot = lerp(bt * TAU * 2 * dir, target.rot, bt * bt);

    drawFishBone(bx, by, rot);
  }

  // Every bone from a completed cycle, laid on the pavement. The current
  // cycle contributes its bone the moment the throw finishes (inCycle >= 3.2).
  // Fully deterministic — the same t gives the same pile.
  function drawLandedBones(t) {
    const currentCycle = Math.floor(t / POP_CYCLE);
    const inCycle = t - currentCycle * POP_CYCLE;
    const upTo = currentCycle + (inCycle >= 3.2 ? 1 : 0);
    for (let c = 0; c < upTo; c++) {
      const b = computeBoneTargetForCycle(c);
      drawFishBone(b.x, b.y, b.rot);
    }
  }

  function roundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  // ------------------------------------------------------------------
  // Fence cat behavior state machine
  //
  // The cat has three behaviors:
  //   walk : moves along the fence top with a proper 4-leg gait
  //   sit  : haunches down, tail wrapped, blinks occasionally
  //   lick : sits and grooms a raised front paw
  //
  // States switch at random intervals (deterministic PRNG per session),
  // and reaching either end of the fence forces a sit.
  // ------------------------------------------------------------------
  const CAT = {
    x: 140,                        // start comfortably inside the fence
    facing: 1,
    state: 'walk',
    stateStartT: 0,
    stateHold: 6,
    lastT: 0,
    rng: rng(7331),
    // tail inertia — the tail drifts a beat behind the body
    tailPhase: 0,
  };
  const CAT_Y = 285;               // fence-top y coordinate
  const CAT_X_LEFT = 60;
  const CAT_X_RIGHT = 900;
  const CAT_WALK_SPEED = 34;       // px/sec — deliberate slow walk

  function catEnter(t, name, hold) {
    CAT.state = name;
    CAT.stateStartT = t;
    CAT.stateHold = hold;
  }

  function updateCat(t) {
    const dt = Math.min(0.1, t - CAT.lastT);
    CAT.lastT = t;
    const stateT = t - CAT.stateStartT;

    if (CAT.state === 'walk') {
      CAT.x += CAT.facing * CAT_WALK_SPEED * dt;
      if (CAT.x >= CAT_X_RIGHT) {
        CAT.x = CAT_X_RIGHT;
        CAT.facing = -1;
        catEnter(t, 'sit', 2.5 + CAT.rng() * 2.5);
        return;
      }
      if (CAT.x <= CAT_X_LEFT) {
        CAT.x = CAT_X_LEFT;
        CAT.facing = 1;
        catEnter(t, 'sit', 2.5 + CAT.rng() * 2.5);
        return;
      }
    }

    if (stateT >= CAT.stateHold) {
      if (CAT.state === 'walk') {
        // Pick an idle pose; lick is a bit rarer than a plain sit
        const r = CAT.rng();
        if (r < 0.55) catEnter(t, 'sit',  2 + CAT.rng() * 3);
        else          catEnter(t, 'lick', 3 + CAT.rng() * 2);
      } else {
        // From an idle pose: either walk on, or switch to the other idle
        const r = CAT.rng();
        if (r < 0.8) catEnter(t, 'walk', 5 + CAT.rng() * 7);
        else         catEnter(t, CAT.state === 'sit' ? 'lick' : 'sit',
                              2 + CAT.rng() * 2);
      }
    }
  }

  function drawCatOnFence(t) {
    updateCat(t);
    const stateT = t - CAT.stateStartT;

    // Moonlight halo travels with the cat
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(CAT.x, CAT_Y - 14, 4, CAT.x, CAT_Y - 14, 70);
    halo.addColorStop(0, 'rgba(255,235,200,0.12)');
    halo.addColorStop(1, 'rgba(255,235,200,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(CAT.x, CAT_Y - 14, 70, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(CAT.x, CAT_Y);
    ctx.scale(CAT.facing, 1);
    ctx.fillStyle = '#0a0510';

    if      (CAT.state === 'walk') drawWalkingCat(t, stateT);
    else if (CAT.state === 'sit')  drawSittingCat(t, stateT);
    else if (CAT.state === 'lick') drawLickingCat(t, stateT);

    ctx.restore();
  }

  // A leg's position for a given phase [0..1). Stance is 60% of the cycle
  // (foot planted, moving backward relative to body); swing is 40%
  // (foot in the air, moving forward with a lift arc).
  function catLegPos(phase, stride, lift) {
    phase = ((phase % 1) + 1) % 1;
    if (phase < 0.6) {
      const u = phase / 0.6;
      return { x: stride * (0.5 - u), y: 0 };
    } else {
      const u = (phase - 0.6) / 0.4;
      // ease-out on lift-off, ease-in on placement
      return { x: stride * (-0.5 + u), y: -Math.sin(u * Math.PI) * lift };
    }
  }

  function drawWalkingCat(t, stateT) {
    const strideHz = 1.55;                           // 1.55 strides per second
    const cyc = (stateT * strideHz) % 1;
    const stride = 11;
    const lift = 5;

    // Lateral-sequence walk: LF, LB, RF, RB (quarter-cycle apart)
    const legs = {
      lf: catLegPos(cyc + 0.00, stride, lift),
      lb: catLegPos(cyc + 0.50, stride, lift),
      rf: catLegPos(cyc + 0.25, stride, lift),
      rb: catLegPos(cyc + 0.75, stride, lift),
    };

    // Body sags slightly on each foot-plant (double bounce per cycle)
    const bob = Math.abs(Math.sin(cyc * TAU)) * 0.8;
    const bodyY = -bob;
    // Shoulders and hips rock in opposite phase (subtle horizontal weight shift)
    const rockShoulder = Math.sin(cyc * TAU) * 0.6;
    const rockHip = -rockShoulder;

    // Tail inertia — tail phase lags body motion
    CAT.tailPhase += (Math.sin(t * 1.6) * 3 - CAT.tailPhase) * 0.06;
    const tailY = CAT.tailPhase;

    ctx.save();

    // Tail (draw first so body overlaps its base)
    ctx.strokeStyle = '#0a0510';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, bodyY - 8);
    ctx.quadraticCurveTo(-28, bodyY - 22, -24 + tailY * 0.5, bodyY - 30);
    ctx.quadraticCurveTo(-18 + tailY, bodyY - 34, -8 + tailY * 1.2, bodyY - 30);
    ctx.stroke();

    // Back legs first (so front legs and body overlap them)
    drawLeg(-13 + rockHip, bodyY - 2, legs.lb, false);
    drawLeg( -8 + rockHip, bodyY - 2, legs.rb, true);   // right-back a bit forward and inset

    // Body — a horizontal loaf
    ctx.fillStyle = '#0a0510';
    ctx.beginPath();
    ctx.ellipse(0 + rockShoulder * 0.4, bodyY - 10, 20, 8, 0, 0, TAU);
    ctx.fill();

    // Front legs
    drawLeg(10 + rockShoulder, bodyY - 2, legs.lf, false);
    drawLeg(14 + rockShoulder, bodyY - 2, legs.rf, true);

    // Head bobs subtly with the stride (head goes DOWN when a front foot plants)
    const headBob = Math.max(0, Math.sin(cyc * TAU * 2 + Math.PI * 0.5)) * 1;
    const headY = bodyY - 21 - headBob;
    const headX = 18 + rockShoulder * 0.3;
    drawCatHeadProfile(headX, headY);

    ctx.restore();
  }

  // Draws a leg from body attachment (bx, by) to foot at (bx + off.x, footY - off.y).
  function drawLeg(bx, by, off, farLeg) {
    const footY = 0 + off.y;         // 0 is the fence top line in local coords
    const shade = farLeg ? '#1a1018' : '#0a0510';
    ctx.fillStyle = shade;
    // Thin leg from body to foot (angled if foot has shifted)
    ctx.beginPath();
    ctx.moveTo(bx - 1.2, by);
    ctx.lineTo(bx + 1.2, by);
    ctx.lineTo(bx + off.x + 1, footY);
    ctx.lineTo(bx + off.x - 1, footY);
    ctx.closePath();
    ctx.fill();
    // Paw dot
    ctx.beginPath();
    ctx.ellipse(bx + off.x, footY, 2, 1.3, 0, 0, TAU);
    ctx.fill();
  }

  function drawCatHeadProfile(hx, hy) {
    ctx.fillStyle = '#0a0510';
    ctx.beginPath();
    ctx.arc(hx, hy, 8.5, 0, TAU);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy - 6);
    ctx.lineTo(hx - 3, hy - 15);
    ctx.lineTo(hx + 1, hy - 6);
    ctx.closePath();
    ctx.moveTo(hx + 2, hy - 6);
    ctx.lineTo(hx + 5, hy - 15);
    ctx.lineTo(hx + 8, hy - 6);
    ctx.closePath();
    ctx.fill();
    // Whiskers on leading side
    ctx.strokeStyle = 'rgba(230,220,220,0.65)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(hx + 7, hy - 1); ctx.lineTo(hx + 18, hy - 2);
    ctx.moveTo(hx + 7, hy + 1); ctx.lineTo(hx + 18, hy + 1);
    ctx.moveTo(hx + 7, hy + 2); ctx.lineTo(hx + 18, hy + 4);
    ctx.stroke();
    // Amber eye
    const g = ctx.createRadialGradient(hx + 4, hy - 2, 0, hx + 4, hy - 2, 5);
    g.addColorStop(0, 'rgba(255,220,120,0.9)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(hx + 4, hy - 2, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(hx + 4, hy - 2, 1.4, 0, TAU); ctx.fill();
  }

  function drawSittingCat(t, stateT) {
    // Small breathing rise + fall
    const breath = Math.sin(t * 1.6) * 0.6;
    // Tail sways slowly in a wider arc
    const tail = Math.sin(t * 0.9) * 5;
    // Random blink every couple of seconds
    const blinkCycle = (stateT + 0.7) % 2.4;
    const blinking = blinkCycle > 2.25;

    ctx.save();
    ctx.fillStyle = '#0a0510';

    // Tail curled around from behind
    ctx.strokeStyle = '#0a0510';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(-28, 2, -28, -14);
    ctx.quadraticCurveTo(-24, -22 + tail * 0.4, -14 + tail, -22 + tail * 0.2);
    ctx.stroke();

    // Haunches — vertical oval
    ctx.beginPath();
    ctx.ellipse(-4, -12 - breath, 13, 16 + breath, 0, 0, TAU);
    ctx.fill();

    // Chest rising to the head
    ctx.beginPath();
    ctx.ellipse(6, -22 - breath, 8, 12, 0, 0, TAU);
    ctx.fill();

    // Two front legs planted straight down onto the fence
    ctx.fillRect(3, -12, 3, 12);
    ctx.fillRect(9, -12, 3, 12);
    ctx.beginPath(); ctx.ellipse(4.5, 1, 3, 1.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10.5, 1, 3, 1.5, 0, 0, TAU); ctx.fill();

    // Head sits atop the chest
    const hx = 10, hy = -33 - breath;
    ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill();
    // Ears (upright)
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx - 3, hy - 17); ctx.lineTo(hx + 1, hy - 6); ctx.closePath();
    ctx.moveTo(hx + 2, hy - 6); ctx.lineTo(hx + 5, hy - 17); ctx.lineTo(hx + 8, hy - 6); ctx.closePath();
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = 'rgba(230,220,220,0.65)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(hx + 7, hy - 1); ctx.lineTo(hx + 20, hy - 3);
    ctx.moveTo(hx + 7, hy + 1); ctx.lineTo(hx + 20, hy + 1);
    ctx.moveTo(hx + 7, hy + 3); ctx.lineTo(hx + 20, hy + 6);
    ctx.stroke();

    // Eye — blinks
    if (blinking) {
      ctx.strokeStyle = '#0a0510';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + 2, hy - 2); ctx.lineTo(hx + 6, hy - 2);
      ctx.stroke();
    } else {
      const g = ctx.createRadialGradient(hx + 4, hy - 2, 0, hx + 4, hy - 2, 5);
      g.addColorStop(0, 'rgba(255,220,120,0.9)');
      g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx + 4, hy - 2, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(hx + 4, hy - 2, 1.4, 0, TAU); ctx.fill();
    }

    ctx.restore();
  }

  function drawLickingCat(t, stateT) {
    // Grooming motion — small oscillation of the raised paw + head
    const lick = Math.sin(t * 4.5);
    const tail = Math.sin(t * 0.7) * 3;

    ctx.save();
    ctx.fillStyle = '#0a0510';

    // Tail curled behind
    ctx.strokeStyle = '#0a0510';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(-28, 2, -28, -14);
    ctx.quadraticCurveTo(-24, -22, -12 + tail, -22);
    ctx.stroke();

    // Haunches
    ctx.beginPath();
    ctx.ellipse(-4, -12, 13, 16, 0, 0, TAU);
    ctx.fill();

    // Chest — tilted forward as head goes down toward the raised paw
    ctx.save();
    ctx.translate(6, -22);
    ctx.rotate(0.25);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 12, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Planted front leg (only one — the other is raised)
    ctx.fillRect(9, -12, 3, 12);
    ctx.beginPath(); ctx.ellipse(10.5, 1, 3, 1.5, 0, 0, TAU); ctx.fill();

    // Raised paw — bent at the "elbow", coming up toward the mouth
    const pawX = 4 + lick * 0.4;
    const pawY = -28 + lick * 0.6;
    ctx.strokeStyle = '#0a0510';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, -16);
    ctx.quadraticCurveTo(3, -22, pawX, pawY);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(pawX, pawY, 3, 2.5, 0, 0, TAU); ctx.fill();

    // Head tilted down toward the paw
    const hx = 11, hy = -30;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(0.45);
    // Head
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(-6, -6); ctx.lineTo(-3, -17); ctx.lineTo(1, -6); ctx.closePath();
    ctx.moveTo(2, -6);  ctx.lineTo(5, -17);  ctx.lineTo(8, -6);  ctx.closePath();
    ctx.fill();
    // Closed eye (small arc — grooming with eye shut)
    ctx.strokeStyle = '#0a0510';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, -2);
    ctx.quadraticCurveTo(4, 0, 7, -2);
    ctx.stroke();
    // Pink tongue tip poking out
    ctx.fillStyle = '#ff6a9a';
    ctx.beginPath();
    ctx.moveTo(6, 3);
    ctx.lineTo(9 + lick * 0.4, 6);
    ctx.lineTo(5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // A handful of drifting fireflies for atmosphere.
  function drawFireflies(t) {
    const rand = rng(500);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const bx = 100 + rand() * (W - 200);
      const by = 300 + rand() * 250;
      const speed = 0.3 + rand() * 0.9;
      const phase = rand() * TAU;
      const x = bx + Math.sin(t * speed + phase) * 30;
      const y = by + Math.cos(t * speed * 0.7 + phase) * 18;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + phase);
      const r = 3 + pulse * 3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, `rgba(255,240,140,${0.7 * pulse + 0.2})`);
      g.addColorStop(1, 'rgba(255,240,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,220,${0.9 * pulse + 0.1})`;
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawTitleType(t) {
    // Small tagline at top
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,230,240,0.75)';
    ctx.font = '500 13px "Inter", system-ui, sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText('DATASOFT · SYNAPSE SOFTWARE · 1984', W / 2, 52);
    ctx.restore();

    // Main "Alley Cat" cursive, centered, with black outline + gold fill.
    const cx = W / 2 - 40, cy = 160;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 900 118px "Snell Roundhand", "Apple Chancery", "Brush Script MT", "Lucida Handwriting", cursive';

    // drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText('Alley Cat', cx, cy);
    ctx.restore();

    // heavy stroke outline
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = '#1a0a10';
    ctx.lineWidth = 10;
    ctx.strokeText('Alley Cat', cx, cy);

    // gold fill
    const grad = ctx.createLinearGradient(0, cy - 60, 0, cy + 60);
    grad.addColorStop(0.00, '#fff2c0');
    grad.addColorStop(0.35, '#ffd766');
    grad.addColorStop(0.60, '#b88938');
    grad.addColorStop(1.00, '#7a5220');
    ctx.fillStyle = grad;
    ctx.fillText('Alley Cat', cx, cy);

    // TM
    ctx.font = 'italic 700 26px "Georgia", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = '#1a0a10'; ctx.lineWidth = 4;
    ctx.strokeText('TM', cx + 210, cy - 46);
    ctx.fillStyle = '#fff2c0';
    ctx.fillText('TM', cx + 210, cy - 46);

    ctx.restore();

    // "By Bill Williams" script beneath
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'italic 400 30px "Snell Roundhand", "Apple Chancery", "Brush Script MT", cursive';
    ctx.fillStyle = '#f8e8c0';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillText('by Bill Williams', W / 2, 240);
    ctx.restore();
  }

  function drawTitleFooter() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(240,220,230,0.85)';
    ctx.font = '400 14px "Georgia", serif';
    ctx.fillText('© Copyright SynSoft™ 1984 · reimagined 2026', W / 2, H - 20);
    ctx.restore();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // -------------------------------------------------------------------------
  // PHASE 0 SCENE — the courtyard/living room with the fireplace
  // -------------------------------------------------------------------------

  function drawPhase0(t) {
    drawRoomWall();
    drawWallDecor();
    drawFloor();
    drawBaseboard();
    drawFireplace(t);
    // Left seating group. Chairs and table nearly at the same depth so they
    // read as one tight conversation area.
    drawAreaRug(195, 550, 170, 30);
    drawWingChair(120, 525, 0.85, +0.45);
    drawWingChair(275, 525, 0.83, -0.45);
    drawCoffeeTable(198, 528);
    // Right of the fireplace: small draped table + floor lamp
    drawSideTable(680, 515);
    drawFloorLamp(850, 580, t);
    drawFireGlowSpill(t);
    drawDustMotes(t);
    drawCatByFire(t);
    drawSceneVignette();
  }

  function drawRoomWall() {
    // Warm, well-lit cream wall — brighter than before per feedback that the
    // room felt too dim. Ceiling still slightly darker so the top of the room
    // reads as being in shadow relative to the fireplace-lit lower half.
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    g.addColorStop(0.00, '#8f6866');
    g.addColorStop(0.20, '#a97e78');
    g.addColorStop(0.45, '#c99a91');
    g.addColorStop(0.80, '#e5b8a6');
    g.addColorStop(1.00, '#f5cebb');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // subtle wallpaper vertical stripes
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#3a1e28';
    for (let x = 0; x < W; x += 22) {
      ctx.fillRect(x, 0, 1, H * 0.72);
    }
    ctx.restore();

    // damask flourishes (faint diamond dots)
    ctx.save();
    ctx.fillStyle = 'rgba(60,30,40,0.15)';
    for (let y = 40; y < H * 0.72; y += 44) {
      const offset = (Math.floor(y / 44) % 2) * 22;
      for (let x = offset; x < W; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x + 3, y);
        ctx.lineTo(x, y + 3);
        ctx.lineTo(x - 3, y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // Picture rail — a thin horizontal molding near the top
    ctx.fillStyle = 'rgba(40,20,25,0.55)';
    ctx.fillRect(0, 90, W, 4);
    ctx.fillStyle = 'rgba(255,220,200,0.20)';
    ctx.fillRect(0, 94, W, 2);
  }

  function drawWallDecor() {
    // A small picture frame on the left wall
    drawFrame(90, 160, 90, 110, 'landscape');
    // A tall narrow mirror or wall-lamp on the right
    drawFrame(760, 180, 60, 130, 'mirror');
  }

  function drawFrame(x, y, w, h, kind) {
    // Frame border
    ctx.save();
    ctx.fillStyle = '#241214';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = '#5a3d20';
    ctx.fillRect(x, y, w, h);

    if (kind === 'landscape') {
      // Tiny painting — a moonlit field with hills
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#1a0a30');
      g.addColorStop(0.5, '#3a1e50');
      g.addColorStop(1, '#0a0518');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // hills
      ctx.fillStyle = '#0a0518';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.7);
      ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.55, x + w * 0.55, y + h * 0.65);
      ctx.quadraticCurveTo(x + w * 0.8, y + h * 0.75, x + w, y + h * 0.6);
      ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
      ctx.fill();
      // tiny moon
      ctx.fillStyle = '#f8e0a0';
      ctx.beginPath(); ctx.arc(x + w * 0.72, y + h * 0.28, 5, 0, TAU); ctx.fill();
    } else {
      // Mirror — reflective vertical gradient
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#5a4030');
      g.addColorStop(0.5, '#7a5e46');
      g.addColorStop(1, '#3a2a20');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,230,200,0.20)';
      ctx.fillRect(x + 4, y + 6, 4, h - 12);
    }
    ctx.restore();
  }

  function drawFloor() {
    // Wood-plank floor — brighter than the previous near-black rendering so
    // the room reads as lit rather than shadowy.
    const floorTop = H * 0.68;
    const g = ctx.createLinearGradient(0, floorTop, 0, H);
    g.addColorStop(0, '#6a4232');
    g.addColorStop(0.5, '#88583e');
    g.addColorStop(1, '#5a3a2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, floorTop, W, H - floorTop);

    // Bake plank grain once
    const tex = baked('floor', W, H - floorTop, (c, w, h) => {
      const rand = rng(1010);
      const plankH = 22;
      for (let y = 0; y < h; y += plankH) {
        // horizontal plank grain
        for (let i = 0; i < 30; i++) {
          const gy = y + rand() * plankH;
          const a = 0.05 + rand() * 0.15;
          c.fillStyle = `rgba(20,10,5,${a})`;
          c.fillRect(0, gy, w, 1);
        }
        // seam line
        c.fillStyle = 'rgba(10,5,3,0.75)';
        c.fillRect(0, y + plankH - 1, w, 1);
        // occasional knot
        if (rand() < 0.6) {
          const kx = rand() * w;
          const ky = y + plankH * 0.5;
          const kr = 2 + rand() * 3;
          const kg = c.createRadialGradient(kx, ky, 0, kx, ky, kr * 3);
          kg.addColorStop(0, 'rgba(15,7,3,0.8)');
          kg.addColorStop(1, 'rgba(15,7,3,0)');
          c.fillStyle = kg;
          c.beginPath(); c.arc(kx, ky, kr * 3, 0, TAU); c.fill();
        }
        // vertical joint (breaks up the plank into segments)
        const nSegs = 2 + Math.floor(rand() * 3);
        for (let s = 1; s < nSegs; s++) {
          const sx = (w / nSegs) * s + (rand() - 0.5) * 40;
          c.fillStyle = 'rgba(10,5,3,0.6)';
          c.fillRect(sx, y, 1, plankH);
        }
      }
    });
    ctx.drawImage(tex, 0, floorTop);

    // Foreground shading (darker near camera bottom)
    const shade = ctx.createLinearGradient(0, H - 80, 0, H);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, H - 80, W, 80);
  }

  function drawBaseboard() {
    const y = H * 0.68;
    ctx.fillStyle = '#2a140f';
    ctx.fillRect(0, y - 10, W, 10);
    ctx.fillStyle = 'rgba(255,220,200,0.15)';
    ctx.fillRect(0, y - 10, W, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, y, W, 2);
  }

  // Fireplace: brick surround, wooden mantle, dark opening, animated fire.
  function drawFireplace(t) {
    const fx = 380, fy = 200, fw = 200, fh = 220;
    // Wooden mantle above the brick
    ctx.save();
    ctx.fillStyle = '#3a1e14';
    ctx.fillRect(fx - 30, fy - 22, fw + 60, 22);
    const mg = ctx.createLinearGradient(0, fy - 22, 0, fy);
    mg.addColorStop(0, '#6a3a24');
    mg.addColorStop(1, '#3a1e14');
    ctx.fillStyle = mg;
    ctx.fillRect(fx - 26, fy - 20, fw + 52, 20);
    // Mantle top bevel
    ctx.fillStyle = 'rgba(255,220,180,0.25)';
    ctx.fillRect(fx - 30, fy - 22, fw + 60, 2);
    ctx.restore();

    // Brick surround — bake once for stability
    const brick = baked('brick', fw, fh, (c, w, h) => {
      c.fillStyle = '#5a2a1a';
      c.fillRect(0, 0, w, h);
      const rand = rng(555);
      const bh = 14, bw = 34;
      for (let y = 0; y < h; y += bh) {
        const rowShift = (Math.floor(y / bh) % 2) * (bw / 2);
        for (let x = -bw; x < w + bw; x += bw) {
          const bx = x + rowShift;
          // brick tone variation
          const shade = 0.7 + rand() * 0.6;
          const r = Math.floor(140 * shade);
          const gr = Math.floor(70 * shade);
          const b = Math.floor(50 * shade);
          c.fillStyle = `rgb(${r},${gr},${b})`;
          c.fillRect(bx, y, bw - 2, bh - 2);
          // subtle brick shading
          const tg = c.createLinearGradient(bx, y, bx, y + bh);
          tg.addColorStop(0, 'rgba(255,220,180,0.10)');
          tg.addColorStop(1, 'rgba(0,0,0,0.20)');
          c.fillStyle = tg;
          c.fillRect(bx, y, bw - 2, bh - 2);
          // little pits
          if (rand() < 0.4) {
            c.fillStyle = 'rgba(0,0,0,0.3)';
            c.fillRect(bx + rand() * (bw - 4), y + rand() * (bh - 4), 2, 1);
          }
        }
      }
      // mortar grid darker
      c.fillStyle = 'rgba(30,15,10,0.6)';
      for (let y = 0; y < h; y += bh) c.fillRect(0, y + bh - 2, w, 2);
    });
    ctx.drawImage(brick, fx, fy);

    // Fireplace opening — a black arch/rectangle cut into the brick
    const ox = fx + 40, oy = fy + 40, ow = fw - 80, oh = fh - 70;
    // Deep black shadow
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(ox, oy + oh);
    ctx.lineTo(ox, oy + 30);
    ctx.quadraticCurveTo(ox, oy, ox + 30, oy);
    ctx.lineTo(ox + ow - 30, oy);
    ctx.quadraticCurveTo(ox + ow, oy, ox + ow, oy + 30);
    ctx.lineTo(ox + ow, oy + oh);
    ctx.closePath();
    ctx.fill();

    // Inner soot gradient
    const sootG = ctx.createRadialGradient(ox + ow / 2, oy + oh - 20, 20, ox + ow / 2, oy + oh - 20, ow);
    sootG.addColorStop(0, 'rgba(80,30,10,0.7)');
    sootG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sootG;
    ctx.beginPath();
    ctx.rect(ox, oy, ow, oh);
    ctx.fill();

    // Grate — a couple of dark horizontal iron bars along the bottom of the opening
    ctx.fillStyle = '#111';
    ctx.fillRect(ox + 8, oy + oh - 22, ow - 16, 4);
    ctx.fillRect(ox + 8, oy + oh - 12, ow - 16, 4);
    for (let bx = ox + 12; bx < ox + ow - 12; bx += 14) {
      ctx.fillRect(bx, oy + oh - 26, 2, 18);
    }

    // Logs — two crossed dark logs at the bottom
    ctx.save();
    ctx.translate(ox + ow / 2, oy + oh - 16);
    // back log
    ctx.fillStyle = '#3a1810';
    ctx.beginPath();
    ctx.ellipse(-14, -8, 44, 8, -0.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7a3820'; ctx.lineWidth = 1;
    ctx.stroke();
    // rings on log end
    ctx.fillStyle = '#5a2818';
    ctx.beginPath(); ctx.ellipse(-58, -8, 6, 8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a0a04'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(-58, -8, 3, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(-58, -8, 5, 0, TAU); ctx.stroke();
    ctx.restore();

    // The fire itself — animated flames
    drawFire(ox + ow / 2, oy + oh - 22, ow - 30, oh - 40, t);

    // Warm inner glow from the opening
    const glow = ctx.createRadialGradient(ox + ow / 2, oy + oh - 40, 8, ox + ow / 2, oy + oh - 40, 140);
    glow.addColorStop(0, 'rgba(255,180,60,0.55)');
    glow.addColorStop(0.4, 'rgba(255,120,40,0.20)');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(ox + ow / 2, oy + oh - 40, 140, 0, TAU); ctx.fill();
    ctx.restore();

    // Mantle decoration — a small clock in the middle
    drawMantleClock(fx + fw / 2, fy - 22 - 20);
    // A candle on either side — wax base sits ON the mantle (fy - 22 is the
    // mantle top; wax is 22 px tall, so cy = mantle_top - 20 puts wax
    // bottom 2 px into the mantle so the candle looks planted, not floating).
    drawCandle(fx - 10,     fy - 42, t, 0.7);
    drawCandle(fx + fw + 10, fy - 42, t, 0.5);
  }

  // Layered flame — several vertical gradients with per-frame flicker,
  // composited additively so they read as glowing gas rather than blobs.
  function drawFire(cx, baseY, w, h, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const flicker = 0.9 + Math.sin(t * 9) * 0.05 + Math.sin(t * 21.7) * 0.03;
    const layers = [
      { w: w * 0.90, h: h * 0.85, y: 0,   color: 'rgba(255,80,20,0.65)',  wob: 6,  speed: 3.0, offs: 0 },
      { w: w * 0.70, h: h * 0.75, y: -8,  color: 'rgba(255,150,40,0.75)', wob: 4,  speed: 4.2, offs: 1 },
      { w: w * 0.55, h: h * 0.65, y: -16, color: 'rgba(255,215,90,0.85)', wob: 3,  speed: 5.6, offs: 2 },
      { w: w * 0.35, h: h * 0.55, y: -22, color: 'rgba(255,240,180,0.95)', wob: 2,  speed: 7.0, offs: 3 },
    ];

    for (const l of layers) {
      const wobble = Math.sin(t * l.speed + l.offs) * l.wob;
      const fx = cx + wobble;
      const fy = baseY + l.y * flicker;
      const flameH = l.h * flicker;
      const flameW = l.w;

      const g = ctx.createRadialGradient(fx, fy - flameH * 0.4, 4, fx, fy - flameH * 0.4, flameH);
      g.addColorStop(0, l.color);
      g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g;

      // teardrop flame path
      ctx.beginPath();
      ctx.moveTo(fx - flameW / 2, fy);
      ctx.quadraticCurveTo(fx - flameW * 0.6, fy - flameH * 0.5, fx + wobble * 0.5, fy - flameH);
      ctx.quadraticCurveTo(fx + flameW * 0.6, fy - flameH * 0.5, fx + flameW / 2, fy);
      ctx.closePath();
      ctx.fill();
    }

    // sparks
    const rand = rng(Math.floor(t * 4));
    for (let i = 0; i < 6; i++) {
      const sx = cx + (rand() - 0.5) * w * 0.6;
      const sy = baseY - rand() * h * 0.9;
      const sr = 1 + rand() * 1.5;
      ctx.fillStyle = `rgba(255,${180 + rand() * 60 | 0},80,${0.7 * rand() + 0.3})`;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    }

    ctx.restore();
  }

  function drawMantleClock(cx, cy) {
    // Small brass mantle clock silhouette
    ctx.save();
    ctx.fillStyle = '#2a1a10';
    roundedRect(ctx, cx - 20, cy - 20, 40, 34, 6);
    ctx.fill();
    // face
    ctx.fillStyle = '#e8d090';
    ctx.beginPath(); ctx.arc(cx, cy - 6, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 1;
    ctx.stroke();
    // hands
    ctx.strokeStyle = '#1a0a05';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 6, cy - 10);
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 2, cy - 14);
    ctx.stroke();
    ctx.restore();
  }

  function drawCandle(cx, cy, t, phase) {
    // wax
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(cx - 3, cy, 6, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx + 2, cy, 1, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx - 3, cy, 1, 22);
    // wick
    ctx.fillStyle = '#1a0a05';
    ctx.fillRect(cx - 0.5, cy - 3, 1, 4);
    // flame
    const flick = 0.9 + Math.sin(t * (7 + phase) + phase) * 0.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy - 6, 0, cx, cy - 6, 8);
    g.addColorStop(0, 'rgba(255,240,180,0.95)');
    g.addColorStop(0.5, 'rgba(255,140,40,0.6)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 5 * flick, 3, 6 * flick, 0, 0, TAU);
    ctx.fill();
    // halo
    const halo = ctx.createRadialGradient(cx, cy - 6, 0, cx, cy - 6, 32);
    halo.addColorStop(0, 'rgba(255,180,80,0.35)');
    halo.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy - 6, 32, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Warm light bleeding onto the floor and walls near the fireplace.
  function drawFireGlowSpill(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.88 + Math.sin(t * 5.3) * 0.06 + Math.sin(t * 9.7) * 0.04;
    // Big warm floor pool
    const g = ctx.createRadialGradient(W / 2, H * 0.75, 20, W / 2, H * 0.75, 380 * flick);
    g.addColorStop(0, `rgba(255,160,60,${0.32 * flick})`);
    g.addColorStop(0.5, `rgba(255,110,40,${0.12 * flick})`);
    g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(150, 380, 660, 220);

    // Extra pool right below the fireplace on the floor
    const g2 = ctx.createRadialGradient(W / 2, H * 0.72, 5, W / 2, H * 0.72, 180 * flick);
    g2.addColorStop(0, `rgba(255,200,100,${0.35 * flick})`);
    g2.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.72 + 6, 200, 40, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // A wing chair drawn in 3/4 view.
  //   cx, cy = point where the feet meet the floor
  //   facing = -1 (facing left) .. +1 (facing right); 0 = frontal
  function drawWingChair(cx, cy, s, facing) {
    const w = 92 * s;
    const h = 145 * s;
    const shift = facing * 7;      // horizontal offset from rotation

    const dark  = '#3a2418';
    const mid   = '#6a4028';
    const light = '#a06a3c';

    ctx.save();
    ctx.translate(cx, cy);

    // contact shadow on the floor
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 4, w * 0.5, 7, 0, 0, TAU);
    ctx.fill();

    // ---- Legs (4 visible) ----
    ctx.fillStyle = '#1a0a05';
    const legT = 3.5, legH = 22;
    // near-viewer (front) pair — bigger, no perspective shift
    ctx.fillRect(-w * 0.34, -legH, legT, legH);
    ctx.fillRect( w * 0.34, -legH, legT, legH);
    // far pair — inset by shift for depth
    ctx.fillRect(-w * 0.30 + shift, -legH - 3, legT - 0.5, legH - 4);
    ctx.fillRect( w * 0.30 + shift, -legH - 3, legT - 0.5, legH - 4);

    // ---- Seat base (skirt) — a parallelogram showing the side ----
    const seatFrontY = -legH;
    const seatT      = 14;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42,          seatFrontY);
    ctx.lineTo( w * 0.42,          seatFrontY);
    ctx.lineTo( w * 0.42 + shift,  seatFrontY - seatT);
    ctx.lineTo(-w * 0.42 + shift,  seatFrontY - seatT);
    ctx.closePath();
    ctx.fill();
    // little seam at the top of the skirt
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-w * 0.42, seatFrontY - 2, w * 0.84, 2);

    // ---- Seat cushion (top plane visible from slight-above angle) ----
    const cushBotY = seatFrontY - seatT;
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42 + shift,       cushBotY);
    ctx.lineTo( w * 0.42 + shift,       cushBotY);
    ctx.lineTo( w * 0.36 + shift * 1.6, cushBotY - 8);
    ctx.lineTo(-w * 0.36 + shift * 1.6, cushBotY - 8);
    ctx.closePath();
    ctx.fill();
    // Top highlight on cushion
    ctx.fillStyle = 'rgba(255,220,180,0.28)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.38 + shift,       cushBotY - 1);
    ctx.lineTo( w * 0.38 + shift,       cushBotY - 1);
    ctx.lineTo( w * 0.32 + shift * 1.6, cushBotY - 6);
    ctx.lineTo(-w * 0.32 + shift * 1.6, cushBotY - 6);
    ctx.closePath();
    ctx.fill();
    // Cushion seam down center
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shift * 1.2, cushBotY);
    ctx.lineTo(shift * 1.6, cushBotY - 7);
    ctx.stroke();

    // ---- Chair back (wing) — tall rounded shape rising behind the cushion ----
    const backBotY = cushBotY - 4;
    const backTopY = -h * 0.95;
    const backW    = w * 0.40;
    const bx       = shift * 1.6;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-backW + bx,             backBotY);
    ctx.lineTo(-backW + bx * 1.15,      backTopY + 22);
    ctx.quadraticCurveTo(-backW * 0.8 + bx * 1.25, backTopY,
                          bx * 1.35,               backTopY - 2);
    ctx.quadraticCurveTo( backW * 0.8 + bx * 1.25, backTopY,
                          backW + bx * 1.15,      backTopY + 22);
    ctx.lineTo( backW + bx,             backBotY);
    ctx.closePath();
    ctx.fill();

    // Vertical seam down back
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx * 1.25, backTopY + 12);
    ctx.lineTo(bx * 1.15, backBotY - 4);
    ctx.stroke();
    // Highlight edge on the side that catches viewer light
    const hlSign = facing >= 0 ? -1 : 1;
    ctx.fillStyle = 'rgba(255,220,180,0.20)';
    ctx.fillRect(hlSign * backW * 0.78 + bx, backTopY + 26, 4, (backBotY - backTopY) - 34);
    // "Wing" ear cap at the top corner facing viewer
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.ellipse(hlSign * backW * 0.85 + bx, backTopY + 34, 6, 22, 0, 0, TAU);
    ctx.fill();

    // ---- Near armrest (bulky, front) ----
    const armSide = -Math.sign(facing || 0.001);
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.ellipse(armSide * w * 0.42, cushBotY - 2, 9, 22, 0, 0, TAU);
    ctx.fill();
    // Armrest top highlight
    ctx.fillStyle = 'rgba(255,220,180,0.25)';
    ctx.beginPath();
    ctx.ellipse(armSide * w * 0.42 - armSide * 2, cushBotY - 12, 2.5, 10, 0, 0, TAU);
    ctx.fill();

    // ---- Far armrest (thinner, peeks behind the back) ----
    const farSide = -armSide;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(farSide * w * 0.42 + bx, cushBotY - 2, 5, 15, 0, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  // A simple rounded area rug behind the seating group.
  function drawAreaRug(cx, cy, w, h) {
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w);
    g.addColorStop(0, 'rgba(120,40,50,0.55)');
    g.addColorStop(0.6, 'rgba(90,25,40,0.35)');
    g.addColorStop(1, 'rgba(60,20,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, 0, 0, TAU);
    ctx.fill();
    // Faint pattern rings
    ctx.strokeStyle = 'rgba(200,140,100,0.20)';
    ctx.lineWidth = 1;
    for (let r = 0.4; r < 1.0; r += 0.2) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * r, h * r, 0, 0, TAU);
      ctx.stroke();
    }
    // Fringe stipple along the perimeter
    const rand = rng(cx * 3 + cy);
    ctx.fillStyle = 'rgba(180,120,90,0.35)';
    for (let i = 0; i < 60; i++) {
      const a = rand() * TAU;
      ctx.fillRect(cx + Math.cos(a) * w + (rand() - 0.5) * 2,
                   cy + Math.sin(a) * h + (rand() - 0.5) * 2, 1, 1);
    }
    ctx.restore();
  }

  function drawCoffeeTable(cx, cy) {
    // Oval wooden top with a metal or wooden pedestal
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 65, 70, 6, 0, 0, TAU); ctx.fill();

    // pedestal
    ctx.fillStyle = '#2a140a';
    ctx.fillRect(cx - 6, cy + 5, 12, 55);
    ctx.fillStyle = 'rgba(255,220,180,0.15)';
    ctx.fillRect(cx - 6, cy + 5, 2, 55);

    // base foot
    ctx.fillStyle = '#3a1e10';
    ctx.beginPath(); ctx.ellipse(cx, cy + 62, 24, 5, 0, 0, TAU); ctx.fill();

    // top oval
    const topGrad = ctx.createLinearGradient(cx - 70, cy - 8, cx + 70, cy + 8);
    topGrad.addColorStop(0, '#3a1e10');
    topGrad.addColorStop(0.5, '#7a4a2a');
    topGrad.addColorStop(1, '#3a1e10');
    ctx.fillStyle = topGrad;
    ctx.beginPath(); ctx.ellipse(cx, cy, 72, 12, 0, 0, TAU); ctx.fill();
    // top rim highlight
    ctx.strokeStyle = 'rgba(255,220,180,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy - 1, 72, 12, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // A small book/mug on it
    ctx.fillStyle = '#e8dcc0';
    roundedRect(ctx, cx - 30, cy - 10, 24, 6, 1);
    ctx.fill();
    ctx.fillStyle = '#7a5030';
    ctx.fillRect(cx - 30, cy - 10, 24, 2);
    // mug
    ctx.fillStyle = '#c9b090';
    roundedRect(ctx, cx + 10, cy - 10, 12, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#c9b090'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx + 24, cy - 5, 3, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // steam
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 16, cy - 12);
    ctx.quadraticCurveTo(cx + 20, cy - 20, cx + 16, cy - 28);
    ctx.stroke();

    ctx.restore();
  }

  function drawSideTable(cx, cy) {
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 65, 40, 5, 0, 0, TAU); ctx.fill();

    // Skirt cloth reaching to floor — decorative
    const cloth = ctx.createLinearGradient(cx - 40, cy, cx + 40, cy + 60);
    cloth.addColorStop(0, '#5a1e2a');
    cloth.addColorStop(0.5, '#8a2e3e');
    cloth.addColorStop(1, '#4a1420');
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy);
    ctx.quadraticCurveTo(cx - 44, cy + 30, cx - 38, cy + 60);
    ctx.lineTo(cx + 38, cy + 60);
    ctx.quadraticCurveTo(cx + 44, cy + 30, cx + 40, cy);
    ctx.closePath();
    ctx.fill();
    // fringe
    ctx.fillStyle = '#2a0a10';
    for (let x = cx - 36; x < cx + 36; x += 6) {
      ctx.fillRect(x, cy + 58, 3, 4);
    }

    // top
    const topGrad = ctx.createLinearGradient(cx - 44, cy, cx + 44, cy);
    topGrad.addColorStop(0, '#3a0e18');
    topGrad.addColorStop(0.5, '#8a2e3e');
    topGrad.addColorStop(1, '#3a0e18');
    ctx.fillStyle = topGrad;
    ctx.beginPath(); ctx.ellipse(cx, cy, 42, 6, 0, 0, TAU); ctx.fill();

    // A ceramic vase — larger than before so the flowers have somewhere to sit.
    ctx.fillStyle = '#4a5a8a';
    roundedRect(ctx, cx - 10, cy - 30, 20, 26, 4);
    ctx.fill();
    // side highlight (glaze reflection)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx - 8, cy - 27, 2, 20);
    // darker seam on the right (curvature shadow)
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(cx + 7, cy - 27, 2, 20);
    // rim
    ctx.fillStyle = '#2f3f70';
    ctx.fillRect(cx - 10, cy - 30, 20, 2);
    // rim highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx - 8, cy - 30, 12, 1);

    // Three stems curving out of the vase
    ctx.strokeStyle = '#2f5a2a';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy - 30); ctx.quadraticCurveTo(cx - 8, cy - 46, cx - 12, cy - 60);
    ctx.moveTo(cx + 1, cy - 30); ctx.quadraticCurveTo(cx + 2, cy - 52, cx + 1, cy - 70);
    ctx.moveTo(cx + 3, cy - 30); ctx.quadraticCurveTo(cx + 10, cy - 44, cx + 14, cy - 56);
    ctx.stroke();

    // Two leaves
    ctx.fillStyle = '#3a6a2a';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 42, 4, 2, -0.6, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy - 40, 4, 2, 0.6, 0, TAU);
    ctx.fill();

    // Three bigger flowers with real petals
    drawFlower(cx + 1,  cy - 72, 8, '#ff5a9a', '#ffcc44');
    drawFlower(cx - 12, cy - 62, 7, '#c070ff', '#ffcc44');
    drawFlower(cx + 14, cy - 58, 7, '#ffa060', '#ffcc44');

    ctx.restore();
  }

  // Five-petal flower with a bright center.
  function drawFlower(cx, cy, size, petalColor, centerColor) {
    ctx.save();
    ctx.translate(cx, cy);
    // Back petals (darker shade for depth)
    const darker = shadeColor(petalColor, -0.25);
    ctx.fillStyle = darker;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * TAU + Math.PI / 5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * size * 0.35, Math.sin(angle) * size * 0.35,
                  size * 0.55, size * 0.32, angle, 0, TAU);
      ctx.fill();
    }
    // Front petals
    ctx.fillStyle = petalColor;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * size * 0.45, Math.sin(angle) * size * 0.45,
                  size * 0.55, size * 0.35, angle, 0, TAU);
      ctx.fill();
    }
    // Yellow center with a tiny dark speck
    ctx.fillStyle = centerColor;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.35, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,60,0,0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.14, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Darkens or lightens a #rrggbb color by pct (-1..+1).
  function shadeColor(hex, pct) {
    const h = hex.replace('#', '');
    let r = parseInt(h.substring(0, 2), 16);
    let g = parseInt(h.substring(2, 4), 16);
    let b = parseInt(h.substring(4, 6), 16);
    const f = 1 + pct;
    r = Math.max(0, Math.min(255, r * f));
    g = Math.max(0, Math.min(255, g * f));
    b = Math.max(0, Math.min(255, b * f));
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  function drawFloorLamp(cx, floorY, t) {
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(cx, floorY + 4, 22, 4, 0, 0, TAU); ctx.fill();

    // base — flared metal disc
    const baseGrad = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, 20);
    baseGrad.addColorStop(0, '#b88938');
    baseGrad.addColorStop(1, '#3a2010');
    ctx.fillStyle = baseGrad;
    ctx.beginPath(); ctx.ellipse(cx, floorY, 20, 5, 0, 0, TAU); ctx.fill();

    // pole
    const poleGrad = ctx.createLinearGradient(cx - 3, 0, cx + 3, 0);
    poleGrad.addColorStop(0, '#3a2010');
    poleGrad.addColorStop(0.5, '#b88938');
    poleGrad.addColorStop(1, '#3a2010');
    ctx.fillStyle = poleGrad;
    ctx.fillRect(cx - 2, floorY - 240, 4, 240);

    // small ring decoration on the pole
    ctx.fillStyle = '#c9a050';
    ctx.fillRect(cx - 5, floorY - 120, 10, 3);
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(cx - 5, floorY - 118, 10, 1);

    // Lamp shade — a trapezoidal cream shade
    const sx = cx, sy = floorY - 265;
    const topW = 22, botW = 50, shadeH = 45;
    // shade back (silhouette)
    ctx.fillStyle = '#7a5028';
    ctx.beginPath();
    ctx.moveTo(sx - topW, sy);
    ctx.lineTo(sx + topW, sy);
    ctx.lineTo(sx + botW, sy + shadeH);
    ctx.lineTo(sx - botW, sy + shadeH);
    ctx.closePath();
    ctx.fill();
    // shade front — warm glow through fabric
    const shadeGrad = ctx.createLinearGradient(sx, sy, sx, sy + shadeH);
    shadeGrad.addColorStop(0, '#f2c078');
    shadeGrad.addColorStop(0.5, '#ffcc82');
    shadeGrad.addColorStop(1, '#e8a058');
    ctx.fillStyle = shadeGrad;
    ctx.beginPath();
    ctx.moveTo(sx - topW + 2, sy + 2);
    ctx.lineTo(sx + topW - 2, sy + 2);
    ctx.lineTo(sx + botW - 3, sy + shadeH - 2);
    ctx.lineTo(sx - botW + 3, sy + shadeH - 2);
    ctx.closePath();
    ctx.fill();

    // brass ring at bottom of shade
    ctx.fillStyle = '#b88938';
    ctx.fillRect(sx - botW + 3, sy + shadeH - 4, (botW - 3) * 2, 4);
    ctx.fillStyle = 'rgba(255,240,180,0.4)';
    ctx.fillRect(sx - botW + 3, sy + shadeH - 4, (botW - 3) * 2, 1);

    ctx.restore();

    // Lamp glow — pooled warm light on nearby wall and floor
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.95 + Math.sin(t * 1.3) * 0.03;
    // shade halo
    const halo = ctx.createRadialGradient(cx, floorY - 240, 5, cx, floorY - 240, 220 * pulse);
    halo.addColorStop(0, `rgba(255,190,110,${0.45 * pulse})`);
    halo.addColorStop(0.4, `rgba(255,160,80,${0.15 * pulse})`);
    halo.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, floorY - 240, 220 * pulse, 0, TAU); ctx.fill();

    // floor pool
    const pool = ctx.createRadialGradient(cx, floorY - 5, 5, cx, floorY - 5, 180 * pulse);
    pool.addColorStop(0, `rgba(255,190,110,${0.35 * pulse})`);
    pool.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(cx, floorY - 5, 180 * pulse, 40 * pulse, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawDustMotes(t) {
    // Motes near the lamp — floating slowly upward
    const rand = rng(88);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const bx = 730 + rand() * 180;
      const by = 320 + rand() * 200;
      const speed = 0.3 + rand() * 0.8;
      const phase = rand() * TAU;
      const drift = Math.sin(t * speed + phase) * 20;
      const rise = ((t * 15 * speed + phase * 20) % 240);
      const y = by - rise;
      const alpha = 0.4 * (1 - rise / 240);
      ctx.fillStyle = `rgba(255,220,160,${alpha})`;
      ctx.beginPath(); ctx.arc(bx + drift, y, 1.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawCatByFire(t) {
    // Cat curled up on the rug in front of the fireplace, tail twitching.
    const cx = 555, cy = 500;
    const twitch = Math.sin(t * 2.3) * 3;
    const breath = 1 + Math.sin(t * 1.8) * 0.02;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breath, breath);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 22, 40, 6, 0, 0, TAU); ctx.fill();

    // body — curled
    const bodyGrad = ctx.createRadialGradient(-6, 0, 4, 0, 6, 40);
    bodyGrad.addColorStop(0, '#3a2418');
    bodyGrad.addColorStop(1, '#150a06');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 6, 34, 18, 0, 0, TAU);
    ctx.fill();

    // orange tabby stripes on the back (warm firelight tint)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 6, 34, 18, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(200,80,20,0.35)';
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(i * 8 - 2, -12, 3, 24);
    }
    ctx.restore();

    // head
    ctx.fillStyle = '#2a1810';
    ctx.beginPath();
    ctx.arc(-26, -2, 12, 0, TAU);
    ctx.fill();
    // ears
    ctx.beginPath();
    ctx.moveTo(-34, -8); ctx.lineTo(-32, -18); ctx.lineTo(-26, -10); ctx.closePath();
    ctx.moveTo(-24, -12); ctx.lineTo(-20, -20); ctx.lineTo(-18, -10); ctx.closePath();
    ctx.fill();
    // firelight rim on head
    ctx.fillStyle = 'rgba(255,140,60,0.35)';
    ctx.beginPath();
    ctx.arc(-24, -2, 12, -0.4, 1.2);
    ctx.fill();

    // closed eyes
    ctx.strokeStyle = '#0a0500';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-32, -3); ctx.lineTo(-28, -3);
    ctx.moveTo(-24, -3); ctx.lineTo(-20, -3);
    ctx.stroke();

    // nose
    ctx.fillStyle = '#a04060';
    ctx.beginPath(); ctx.arc(-30, 2, 1.4, 0, TAU); ctx.fill();

    // whiskers
    ctx.strokeStyle = 'rgba(240,220,200,0.6)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-32, 3); ctx.lineTo(-44, 2);
    ctx.moveTo(-32, 4); ctx.lineTo(-44, 5);
    ctx.moveTo(-32, 5); ctx.lineTo(-44, 8);
    ctx.stroke();

    // tail curling around
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(28, 6);
    ctx.quadraticCurveTo(46, 4, 44 + twitch, -12);
    ctx.stroke();
    // tail tip firelight rim
    ctx.strokeStyle = 'rgba(255,140,60,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  function drawSceneVignette() {
    // Milder vignette than before — was making the room feel gloomy.
    const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.45, W / 2, H * 0.5, H * 0.9);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // =========================================================================
  // Shared components used across multiple phases
  // =========================================================================

  // Compact wall-mounted fireplace — brick surround with a dark opening and
  // a small live fire. Used by phases 3–6 which each have a smaller mantle.
  function drawSmallFireplace(x, y, w, h, t) {
    // Brick surround (baked)
    const brick = baked(`smallbrick-${w}x${h}`, w, h, (c, W_, H_) => {
      c.fillStyle = '#5a2a1a';
      c.fillRect(0, 0, W_, H_);
      const rand = rng(w * 13 + h);
      const bh = 10, bw = 24;
      for (let by = 0; by < H_; by += bh) {
        const shift = (Math.floor(by / bh) % 2) * (bw / 2);
        for (let bx = -bw; bx < W_ + bw; bx += bw) {
          const shade = 0.7 + rand() * 0.6;
          const r = (120 * shade) | 0, g = (55 * shade) | 0, b = (40 * shade) | 0;
          c.fillStyle = `rgb(${r},${g},${b})`;
          c.fillRect(bx + shift, by, bw - 2, bh - 2);
        }
      }
      c.fillStyle = 'rgba(20,10,5,0.6)';
      for (let by = 0; by < H_; by += bh) c.fillRect(0, by + bh - 2, W_, 2);
    });
    ctx.drawImage(brick, x, y);

    // Dark opening
    const ox = x + w * 0.18, oy = y + h * 0.22;
    const ow = w * 0.64, oh = h * 0.56;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(ox, oy + oh);
    ctx.lineTo(ox, oy + 14);
    ctx.quadraticCurveTo(ox, oy, ox + 14, oy);
    ctx.lineTo(ox + ow - 14, oy);
    ctx.quadraticCurveTo(ox + ow, oy, ox + ow, oy + 14);
    ctx.lineTo(ox + ow, oy + oh);
    ctx.closePath();
    ctx.fill();

    // Small flame inside
    drawFire(ox + ow / 2, oy + oh - 8, ow * 0.7, oh * 0.6, t);

    // Warm glow spilling out
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(ox + ow / 2, oy + oh / 2, 4,
                                           ox + ow / 2, oy + oh / 2, w * 1.1);
    glow.addColorStop(0, 'rgba(255,180,60,0.35)');
    glow.addColorStop(0.4, 'rgba(255,120,40,0.15)');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 40, y - 40, w + 80, h + 80);
    ctx.restore();
  }

  // A framed photograph of Felicia, drawn in a specific full-body pose.
  //   pose: 'sit' | 'lay' | 'stretch' | 'play' | 'curl' | 'hunt'
  //   frame: 'gold' | 'silver' | 'wood'
  function drawCatPhoto(cx, cy, w, h, pose, frame) {
    const x = cx - w / 2, y = cy - h / 2;

    // Outer frame border — style varies
    const framePalettes = {
      gold:   { outer: '#241214', mid: '#c89838', inner: '#8a5a2a' },
      silver: { outer: '#181820', mid: '#c8ccd8', inner: '#7a7e8c' },
      wood:   { outer: '#1a0a05', mid: '#8a5432', inner: '#5a3418' },
    };
    const p = framePalettes[frame] || framePalettes.wood;
    ctx.fillStyle = p.outer;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = p.mid;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = p.inner;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

    // Backdrop (soft studio gradient)
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#c0808c');
    g.addColorStop(1, '#5a2838');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // Floor line (a horizon-like plane the cat sits on)
    ctx.fillStyle = 'rgba(60,20,30,0.55)';
    ctx.fillRect(x, y + h * 0.78, w, h * 0.22);

    // Draw Felicia at the appropriate anchor for this pose. The anchor is
    // the point where her feet meet the floor of the photo.
    const feetX = x + w / 2;
    const feetY = y + h * 0.86;
    const scale = Math.min(w, h) / 100;
    drawFeliciaPose(feetX, feetY, scale, pose);
  }

  // A whole-body Felicia rendered in one of several poses. Cream fur with
  // pink bow, black eyes, positioned so the FEET rest at (cx, cy).
  function drawFeliciaPose(cx, cy, s, pose) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);

    const fur   = '#f4ecd8';
    const shade = '#c8bca0';
    const dark  = '#0a0510';
    const nose  = '#ff8fa0';
    const bow   = '#ff5aad';
    const eyeG  = '#4aa050';

    switch (pose) {
      case 'sit':      poseSit();      break;
      case 'lay':      poseLay();      break;
      case 'stretch':  poseStretch();  break;
      case 'play':     posePlay();     break;
      case 'curl':     poseCurl();     break;
      case 'hunt':     poseHunt();     break;
      default:         poseSit();
    }

    ctx.restore();

    // ---------- pose functions (all in local coords: 0,0 is feet-center) ----

    function poseSit() {
      // Tail curled around from behind
      ctx.strokeStyle = fur; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.quadraticCurveTo(-32, 4, -30, -14);
      ctx.quadraticCurveTo(-24, -26, -8, -18);
      ctx.stroke();
      // Haunches
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(-4, -18, 18, 22, 0, 0, TAU); ctx.fill();
      // Chest
      ctx.beginPath(); ctx.ellipse(6, -34, 12, 18, 0, 0, TAU); ctx.fill();
      // Front legs
      ctx.fillRect(2, -16, 5, 14);
      ctx.fillRect(9, -16, 5, 14);
      // Head
      catHead(10, -50);
    }

    function poseLay() {
      // Lying on side, tail sweeping back
      ctx.strokeStyle = fur; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(20, -10);
      ctx.quadraticCurveTo(38, -6, 42, -20);
      ctx.stroke();
      // Body
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, -8, 28, 12, 0, 0, TAU); ctx.fill();
      // Legs sticking out
      ctx.fillRect(-16, -4, 6, 6);
      ctx.fillRect(-6, -4, 6, 6);
      ctx.fillRect(4, -4, 6, 6);
      ctx.fillRect(14, -4, 6, 6);
      // Head
      catHead(-26, -14);
    }

    function poseStretch() {
      // Yoga stretch — front low, rump high
      ctx.strokeStyle = fur; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(20, -30);
      ctx.quadraticCurveTo(36, -46, 40, -30);
      ctx.stroke();
      // Body arched
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.moveTo(-24, -6);
      ctx.quadraticCurveTo(-10, -46, 10, -40);
      ctx.quadraticCurveTo(28, -34, 24, -8);
      ctx.lineTo(-22, -8);
      ctx.closePath();
      ctx.fill();
      // Back legs (raised rump)
      ctx.fillRect(14, -14, 5, 14);
      ctx.fillRect(22, -14, 5, 14);
      // Front legs (stretched forward)
      ctx.fillRect(-24, -8, 5, 10);
      ctx.fillRect(-16, -8, 5, 10);
      // Front paws extended
      ctx.beginPath(); ctx.ellipse(-22, 0, 5, 2, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-14, 0, 5, 2, 0, 0, TAU); ctx.fill();
      // Head low
      catHead(-30, -12);
    }

    function posePlay() {
      // Sitting on haunches with one front paw raised (playing/waving)
      ctx.strokeStyle = fur; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.quadraticCurveTo(-32, -4, -28, -22);
      ctx.stroke();
      // Haunches
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(-4, -18, 18, 22, 0, 0, TAU); ctx.fill();
      // Chest tilted
      ctx.beginPath(); ctx.ellipse(6, -34, 12, 18, 0, 0, TAU); ctx.fill();
      // Standing front leg
      ctx.fillRect(9, -16, 5, 14);
      // Raised paw
      ctx.strokeStyle = fur; ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(4, -32);
      ctx.quadraticCurveTo(-4, -46, 6, -56);
      ctx.stroke();
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(6, -56, 5, 3, 0, 0, TAU); ctx.fill();
      // Head tilted upward looking at raised paw
      catHead(14, -50, 0.15);
    }

    function poseCurl() {
      // Curled sleeping ball
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, -12, 26, 16, 0, 0, TAU); ctx.fill();
      // Underside shadow
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.ellipse(0, -8, 26, 8, 0, 0, Math.PI);
      ctx.fill();
      // Tail wrapping around
      ctx.strokeStyle = fur; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(22, -8);
      ctx.quadraticCurveTo(32, -14, 22, -22);
      ctx.stroke();
      // Head tucked
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.arc(-18, -14, 10, 0, TAU); ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.moveTo(-24, -18); ctx.lineTo(-22, -28); ctx.lineTo(-16, -20); ctx.closePath();
      ctx.moveTo(-14, -20); ctx.lineTo(-12, -28); ctx.lineTo(-10, -20); ctx.closePath();
      ctx.fill();
      // Bow on ear
      ctx.fillStyle = bow;
      ctx.beginPath(); ctx.arc(-12, -28, 3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-8, -28, 3, 0, TAU); ctx.fill();
      // Closed eyes
      ctx.strokeStyle = dark; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-22, -12); ctx.lineTo(-18, -12);
      ctx.moveTo(-14, -12); ctx.lineTo(-10, -12);
      ctx.stroke();
    }

    function poseHunt() {
      // Crouched hunter, tail up
      ctx.strokeStyle = fur; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -8);
      ctx.quadraticCurveTo(-30, -18, -32, -34);
      ctx.stroke();
      // Body crouched, elongated
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, -10, 24, 8, 0, 0, TAU); ctx.fill();
      // Legs low
      ctx.fillRect(-14, -6, 4, 6);
      ctx.fillRect(-6, -6, 4, 6);
      ctx.fillRect(6, -6, 4, 6);
      ctx.fillRect(14, -6, 4, 6);
      // Head forward
      catHead(22, -14);
    }

    // Cat head with bow + eyes + nose + whiskers. hx,hy = head center.
    function catHead(hx, hy, tilt) {
      ctx.save();
      ctx.translate(hx, hy);
      if (tilt) ctx.rotate(tilt);
      ctx.fillStyle = fur;
      // Head
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.moveTo(-9, -6); ctx.lineTo(-6, -16); ctx.lineTo(-2, -8); ctx.closePath();
      ctx.moveTo( 2, -8); ctx.lineTo( 6, -16); ctx.lineTo( 9, -6); ctx.closePath();
      ctx.fill();
      // Inner ear pink
      ctx.fillStyle = '#f0a0b8';
      ctx.beginPath();
      ctx.moveTo(-7, -8); ctx.lineTo(-5, -13); ctx.lineTo(-4, -8); ctx.closePath();
      ctx.moveTo( 4, -8); ctx.lineTo( 5, -13); ctx.lineTo( 7, -8); ctx.closePath();
      ctx.fill();
      // Bow on right ear (Felicia's signature)
      ctx.fillStyle = bow;
      ctx.beginPath(); ctx.arc(3, -16, 3.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(9, -16, 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c02870';
      ctx.beginPath(); ctx.arc(6, -16, 1.5, 0, TAU); ctx.fill();
      // Eyes
      ctx.fillStyle = eyeG;
      ctx.beginPath(); ctx.arc(-4, -2, 2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc( 4, -2, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = dark;
      ctx.fillRect(-4.3, -3.5, 0.6, 2.8);
      ctx.fillRect( 3.7, -3.5, 0.6, 2.8);
      // Nose
      ctx.fillStyle = nose;
      ctx.beginPath();
      ctx.moveTo(-1.5, 3); ctx.lineTo(1.5, 3); ctx.lineTo(0, 5); ctx.closePath();
      ctx.fill();
      // Whiskers
      ctx.strokeStyle = 'rgba(80,60,60,0.6)'; ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-6, 3); ctx.lineTo(-14, 2);
      ctx.moveTo(-6, 4); ctx.lineTo(-14, 5);
      ctx.moveTo( 6, 3); ctx.lineTo(14, 2);
      ctx.moveTo( 6, 4); ctx.lineTo(14, 5);
      ctx.stroke();
      ctx.restore();
    }
  }

  // =========================================================================
  // PHASE 2 — the pond / aquarium
  // =========================================================================

  function drawPhase2(t) {
    // Water — teal at surface, deep navy below
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.00, '#5ec8dc');
    g.addColorStop(0.30, '#3a90b0');
    g.addColorStop(0.70, '#1a5478');
    g.addColorStop(1.00, '#08243c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawSunbeams(t);
    drawPondSurface(t);
    drawFishSchool(t);
    drawBubbles(t);
    drawPondBottom(t);
    drawSceneVignette();
  }

  // Rippling water surface — a thin bright layer at the top with a wavy edge.
  function drawPondSurface(t) {
    ctx.save();
    // Sky peeking above (thin strip)
    const sky = ctx.createLinearGradient(0, 0, 0, 18);
    sky.addColorStop(0, '#e8a0c8');
    sky.addColorStop(1, '#c4708a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 18);

    // Wavy water line — animated
    ctx.fillStyle = '#4ac0d0';
    ctx.beginPath();
    ctx.moveTo(0, 22);
    for (let x = 0; x <= W; x += 8) {
      const y = 20 + Math.sin(x * 0.05 + t * 1.5) * 4
                    + Math.sin(x * 0.11 + t * 2.2) * 2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 60); ctx.lineTo(0, 60); ctx.closePath();
    ctx.fill();

    // Highlight strip on the crest
    ctx.strokeStyle = 'rgba(240,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = 20 + Math.sin(x * 0.05 + t * 1.5) * 4
                    + Math.sin(x * 0.11 + t * 2.2) * 2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Long angled beams of sunlight through the water
  function drawSunbeams(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const baseX = 100 + i * 150 + Math.sin(t * 0.4 + i) * 30;
      const g = ctx.createLinearGradient(baseX, 0, baseX + 80, H);
      g.addColorStop(0, 'rgba(255,255,220,0.20)');
      g.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(baseX - 20, 0);
      ctx.lineTo(baseX + 20, 0);
      ctx.lineTo(baseX + 100, H);
      ctx.lineTo(baseX + 60, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // A school of small fish silhouettes crossing the frame. Direction of
  // movement matches direction the fish is FACING (drawFish flips by `dir`).
  function drawFishSchool(t) {
    const rand = rng(88);
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const speed = 25 + rand() * 40;
      const dir = rand() < 0.5 ? 1 : -1;
      const y = 80 + rand() * (H - 200);
      const size = 0.6 + rand() * 0.6;
      const wag = Math.sin(t * 6 + i) * 0.3;

      // Time always advances positively; direction only controls whether the
      // fish walks the screen L→R or R→L. This is the fix for the previous
      // bug where dir=-1 fed a negative offset into modulo and the fish
      // ended up frozen off-screen or moving the wrong way.
      const span = W + 100;
      const offset = rand() * span;
      const wrapped = (t * speed + offset) % span;
      const x = dir > 0 ? -50 + wrapped : W + 50 - wrapped;
      const variant = (i * 3 + Math.floor(rand() * 7)) % FISH_PALETTES.length;

      drawFish(x, y, size, dir, wag, variant);
    }
    ctx.restore();
  }

  // Ornamental (aquarium) fish with per-variant color palette, stripes,
  // dorsal and pelvic fins, belly highlight.
  const FISH_PALETTES = [
    { body: '#ff8030', accent: '#ffffff', fin: '#c04010' }, // clownfish
    { body: '#ffd028', accent: '#5a4010', fin: '#c89818' }, // yellow tang
    { body: '#4098c8', accent: '#f0f8ff', fin: '#204880' }, // blue tetra
    { body: '#e070c0', accent: '#ffcce0', fin: '#7a2060' }, // pink guppy
    { body: '#48c090', accent: '#e0ffe8', fin: '#207050' }, // green molly
    { body: '#d8d8d8', accent: '#404050', fin: '#8a8a94' }, // silver minnow
    { body: '#e8402a', accent: '#3a0a06', fin: '#a01a10' }, // red betta
  ];

  function drawFish(x, y, s, dir, wag, variant) {
    const p = FISH_PALETTES[variant % FISH_PALETTES.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, s);

    // Tail fin (behind body)
    ctx.fillStyle = p.fin;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-18 + wag * 2, -6);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-18 + wag * 2,  6);
    ctx.closePath();
    ctx.fill();
    // Tail rays
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-10, 0); ctx.lineTo(-17 + wag * 2, -4);
    ctx.moveTo(-10, 0); ctx.lineTo(-17 + wag * 2,  4);
    ctx.stroke();

    // Body
    ctx.fillStyle = p.body;
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, TAU); ctx.fill();
    // Belly highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 3, 10, 2.5, 0, 0, TAU); ctx.fill();
    // Top shading
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(0, -2, 11, 2, 0, 0, TAU); ctx.fill();

    // Vertical stripes (2 stripes across body)
    ctx.fillStyle = p.accent;
    ctx.fillRect(-4, -5, 1.6, 10);
    ctx.fillRect(2,  -5, 1.6, 10);

    // Dorsal fin (top)
    ctx.fillStyle = p.fin;
    ctx.beginPath();
    ctx.moveTo(-4, -5);
    ctx.lineTo(0, -11);
    ctx.lineTo(5, -5);
    ctx.closePath();
    ctx.fill();

    // Pelvic fin (bottom near belly, small)
    ctx.beginPath();
    ctx.ellipse(1, 5, 3, 1.4, 0.5, 0, TAU);
    ctx.fill();

    // Eye — white sclera + colored iris + dark pupil
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(7, -1, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = p.fin;
    ctx.beginPath(); ctx.arc(7, -1, 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(7, -1, 0.6, 0, TAU); ctx.fill();
    // Small mouth line
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(11, 1); ctx.lineTo(13, 2);
    ctx.stroke();

    ctx.restore();
  }

  // Rising bubbles
  function drawBubbles(t) {
    const rand = rng(42);
    ctx.save();
    for (let i = 0; i < 24; i++) {
      const bx = rand() * W;
      const speed = 20 + rand() * 60;
      const phase = rand() * 100;
      const y = H - ((t * speed + phase) % (H + 40));
      const wob = Math.sin(t * 2 + i) * 8;
      const r = 2 + rand() * 4;
      // bubble body
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.beginPath(); ctx.arc(bx + wob, y, r, 0, TAU); ctx.fill();
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.arc(bx + wob - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU); ctx.fill();
      // outline
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(bx + wob, y, r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // Pond floor — dark sandy bed with pebbles and swaying weeds
  function drawPondBottom(t) {
    const gy = H - 60;
    ctx.save();
    // sand
    const sand = ctx.createLinearGradient(0, gy, 0, H);
    sand.addColorStop(0, '#3a2a20');
    sand.addColorStop(1, '#150a06');
    ctx.fillStyle = sand;
    ctx.fillRect(0, gy, W, H - gy);
    // pebbles
    const rand = rng(700);
    for (let i = 0; i < 40; i++) {
      const x = rand() * W;
      const y = gy + 10 + rand() * 40;
      const r = 3 + rand() * 5;
      const shade = 60 + rand() * 40;
      ctx.fillStyle = `rgba(${shade},${shade*0.9},${shade*0.7},0.85)`;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(x - r * 0.4, y - r * 0.55, r * 0.4, 1);
    }
    // swaying pond weeds
    ctx.strokeStyle = 'rgba(40,80,50,0.85)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const bx = 30 + i * 82 + (rand() - 0.5) * 40;
      const sway = Math.sin(t * 1.2 + i * 0.6) * 12;
      ctx.beginPath();
      ctx.moveTo(bx, H - 5);
      ctx.quadraticCurveTo(bx + sway * 0.3, H - 40, bx + sway, H - 80);
      ctx.stroke();
      // leaf
      ctx.fillStyle = 'rgba(60,120,70,0.7)';
      ctx.beginPath();
      ctx.ellipse(bx + sway * 0.6, H - 55, 3, 6, sway * 0.03, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  // PHASE 3 — library / bookshelf
  // =========================================================================

  function drawPhase3(t) {
    drawRoomWall();
    drawFloor();
    drawBaseboard();
    // Small fireplace on the upper-left wall
    drawSmallFireplace(140, 220, 200, 150, t);
    // Two chairs facing forward (frontal to viewer)
    drawWingChair(90,  530, 0.80, 0);
    drawWingChair(240, 530, 0.80, 0);
    // Floor lamps flanking the chairs
    drawFloorLamp(25,  585, t);
    drawFloorLamp(360, 585, t);
    // Big bookshelf on the right side of the room
    drawBookshelf(460, 90, 460, 490);
    drawSceneVignette();
  }

  // A tall wooden bookshelf packed with books, three pots of flowers on top.
  function drawBookshelf(x, y, w, h) {
    ctx.save();

    // Frame / carcass
    ctx.fillStyle = '#3a1e10';
    ctx.fillRect(x - 6, y - 4, w + 12, h + 12);
    const wood = ctx.createLinearGradient(x, y, x, y + h);
    wood.addColorStop(0, '#6a3e26');
    wood.addColorStop(0.5, '#8a5432');
    wood.addColorStop(1, '#5a331e');
    ctx.fillStyle = wood;
    ctx.fillRect(x, y, w, h);
    // Highlight on top edge
    ctx.fillStyle = 'rgba(255,220,180,0.30)';
    ctx.fillRect(x, y, w, 2);

    // Shelves (horizontal planks) — 8 rows
    const shelfCount = 8;
    const rowH = h / shelfCount;
    const bookGap = 10;

    const rand = rng(717);

    // Nice book palette — deep spines with gold ends
    const spineColors = [
      '#8a2a1a', '#3a4a80', '#2a6040', '#7a5a20', '#5a2050',
      '#a04030', '#3a3a3a', '#8a5030', '#204a3a', '#6a3050',
    ];

    for (let s = 0; s < shelfCount; s++) {
      const shelfTop = y + s * rowH;
      const shelfBot = shelfTop + rowH;
      const innerTop = shelfTop + 4;
      const innerBot = shelfBot - 4;
      // Shelf back — a bit shadowed
      const back = ctx.createLinearGradient(x, shelfTop, x, shelfBot);
      back.addColorStop(0, '#2a1408');
      back.addColorStop(0.4, '#3a1c0e');
      back.addColorStop(1, '#251006');
      ctx.fillStyle = back;
      ctx.fillRect(x + 4, innerTop, w - 8, innerBot - innerTop);

      // Books lined along the shelf
      let bx = x + 8;
      while (bx < x + w - 20) {
        const bw = 10 + rand() * 14;
        const bh = (innerBot - innerTop) - (2 + rand() * 6);
        const bcol = spineColors[(rand() * spineColors.length) | 0];
        const slant = rand() < 0.08 ? (rand() - 0.5) * 0.4 : 0;
        const fallen = rand() < 0.05;

        if (fallen) {
          // Stack of books lying on their side (2-3)
          const stackH = 5 + rand() * 4;
          for (let k = 0; k < 3; k++) {
            const sc = spineColors[(rand() * spineColors.length) | 0];
            ctx.fillStyle = sc;
            ctx.fillRect(bx, innerBot - (k + 1) * stackH, 22, stackH - 1);
            ctx.fillStyle = 'rgba(255,220,150,0.5)';
            ctx.fillRect(bx, innerBot - (k + 1) * stackH, 22, 1);
          }
          bx += 24;
        } else {
          ctx.save();
          ctx.translate(bx + bw / 2, innerBot);
          ctx.rotate(slant);
          // Spine
          ctx.fillStyle = bcol;
          ctx.fillRect(-bw / 2, -bh, bw, bh);
          // Shadow on right edge
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(bw / 2 - 2, -bh, 2, bh);
          // Highlight on left
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fillRect(-bw / 2, -bh, 1, bh);
          // Gold title band (some books)
          if (rand() < 0.7) {
            ctx.fillStyle = '#d8b060';
            ctx.fillRect(-bw / 2 + 1, -bh + 6 + rand() * (bh - 20), bw - 2, 2);
          }
          // Small text mark
          if (rand() < 0.4) {
            ctx.fillStyle = 'rgba(255,220,180,0.5)';
            ctx.fillRect(-bw / 2 + 2, -bh + 12, bw - 4, 1);
          }
          ctx.restore();
          bx += bw + 1;
        }
      }
      // Shelf plank (bottom edge of this row — the wood surface books sit on)
      ctx.fillStyle = '#3a1c0e';
      ctx.fillRect(x + 4, shelfBot - 3, w - 8, 3);
      ctx.fillStyle = 'rgba(255,220,180,0.20)';
      ctx.fillRect(x + 4, shelfBot - 3, w - 8, 1);
    }

    // Three flower pots on TOP of the bookshelf
    for (let i = 0; i < 3; i++) {
      const px = x + w * (0.20 + i * 0.30);
      drawShelfPot(px, y - 4);
    }

    ctx.restore();
  }

  function drawShelfPot(cx, cy) {
    // Terracotta pot
    ctx.save();
    // pot
    ctx.fillStyle = '#8a4a2a';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 12);
    ctx.lineTo(cx + 10, cy - 12);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.fill();
    // rim
    ctx.fillStyle = '#6a3018';
    ctx.fillRect(cx - 11, cy - 14, 22, 3);
    // highlight
    ctx.fillStyle = 'rgba(255,200,150,0.30)';
    ctx.fillRect(cx - 10, cy - 12, 3, 12);
    // Leafy plant
    ctx.fillStyle = '#3a6a2a';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.5 + (i - 2) * 0.4;
      const rr = 6 + (i === 2 ? 4 : 0);
      const lx = cx + Math.cos(a) * rr * 0.4;
      const ly = cy - 14 + Math.sin(a) * rr * 0.4;
      ctx.beginPath();
      ctx.ellipse(lx, ly - 4, 3, 8, a + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
    // Little flower
    drawFlower(cx, cy - 22, 5, '#ff5a9a', '#ffcc44');
    ctx.restore();
  }

  // =========================================================================
  // PHASE 4 — swiss cheese wall (with mouse holes)
  // =========================================================================

  function drawPhase4(t) {
    drawRoomWall();
    drawFloor();
    drawBaseboard();
    // Massive cheese block filling the left half + more
    drawCheeseBlock(30, 100, 570, 470, t);
    // Small fireplace on the right
    drawSmallFireplace(660, 220, 200, 150, t);
    // A single wing chair and side table on the right
    drawWingChair(670, 530, 0.80, +0.3);
    drawSideTable(830, 515);
    drawSceneVignette();
  }

  // A huge wedge of swiss cheese with round mouse holes. Some holes glow
  // faintly (with a tiny pair of eyes peeking) at random positions each cycle.
  function drawCheeseBlock(x, y, w, h, t) {
    ctx.save();

    // Shadow beneath
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 8, w * 0.45, 10, 0, 0, TAU);
    ctx.fill();

    // Body of the cheese — creamy yellow with darker rind
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#f8dc5a');
    g.addColorStop(0.5, '#e8c840');
    g.addColorStop(1, '#b88820');
    ctx.fillStyle = g;

    // Wedge shape — sloped top (like a big block cut on angle)
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + w - 60, y + 30);
    ctx.lineTo(x + w, y + 90);
    ctx.lineTo(x + w - 30, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + 40);
    ctx.closePath();
    ctx.fill();

    // Darker rind on top-facing edge
    ctx.fillStyle = '#c89830';
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + w - 60, y + 30);
    ctx.lineTo(x + w - 60, y + 38);
    ctx.lineTo(x + 20, y + 8);
    ctx.closePath();
    ctx.fill();

    // Highlight streak
    ctx.fillStyle = 'rgba(255,255,220,0.4)';
    ctx.beginPath();
    ctx.moveTo(x + 40, y + 20);
    ctx.lineTo(x + w - 100, y + 45);
    ctx.lineTo(x + w - 100, y + 50);
    ctx.lineTo(x + 40, y + 25);
    ctx.closePath();
    ctx.fill();

    // Holes — mixture of sizes, with clip so nothing overflows the cheese
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + w - 60, y + 30);
    ctx.lineTo(x + w, y + 90);
    ctx.lineTo(x + w - 30, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + 40);
    ctx.closePath();
    ctx.clip();

    const holes = [
      { x: 0.20, y: 0.15, r: 22 },
      { x: 0.42, y: 0.10, r: 28 },
      { x: 0.62, y: 0.20, r: 24 },
      { x: 0.15, y: 0.35, r: 32 },
      { x: 0.35, y: 0.40, r: 20 },
      { x: 0.55, y: 0.45, r: 26 },
      { x: 0.78, y: 0.35, r: 22 },
      { x: 0.25, y: 0.62, r: 28 },
      { x: 0.48, y: 0.60, r: 24 },
      { x: 0.68, y: 0.62, r: 22 },
      { x: 0.85, y: 0.55, r: 20 },
      { x: 0.20, y: 0.82, r: 26 },
      { x: 0.42, y: 0.82, r: 22 },
      { x: 0.65, y: 0.85, r: 24 },
    ];

    for (let i = 0; i < holes.length; i++) {
      const h_ = holes[i];
      const hx = x + h_.x * w;
      const hy = y + h_.y * h;
      const hr = h_.r;
      // Dark inside
      const hg = ctx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.3, 1,
                                           hx, hy, hr);
      hg.addColorStop(0, '#2a1a08');
      hg.addColorStop(0.7, '#0a0500');
      hg.addColorStop(1, '#3a2410');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();

      // Inner rim highlight (light from top-left)
      ctx.strokeStyle = 'rgba(255,230,150,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, hr - 1, Math.PI * 1.05, Math.PI * 1.85);
      ctx.stroke();

      // Some holes have mice peeking (deterministic per index + slow t cycle)
      const peekCycle = Math.floor(t / 3);
      const showEyes = ((i + peekCycle * 3) % 5) === 0;
      if (showEyes) {
        const blink = ((t * 3) % 6) < 5.7;
        if (blink) {
          ctx.fillStyle = '#ffe08a';
          ctx.beginPath(); ctx.arc(hx - 3, hy + 2, 1.5, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(hx + 3, hy + 2, 1.5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#000';
          ctx.fillRect(hx - 3.4, hy + 1.3, 0.8, 1.4);
          ctx.fillRect(hx + 2.6, hy + 1.3, 0.8, 1.4);
        }
      }
    }
    ctx.restore();

    // Outline / silhouette edge
    ctx.strokeStyle = 'rgba(120,80,20,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + w - 60, y + 30);
    ctx.lineTo(x + w, y + 90);
    ctx.lineTo(x + w - 30, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + 40);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }
  // =========================================================================
  // PHASE 5 — birdcage room (Felicia's portrait, bird on center table)
  // =========================================================================

  function drawPhase5(t) {
    drawRoomWall();
    drawFloor();
    drawBaseboard();
    // Gallery of Felicia photos on the left side of the wall — three
    // different full-body poses, mixed frame styles.
    drawCatPhoto(160, 240,  80, 96, 'sit',     'gold');
    drawCatPhoto(260, 240,  80, 96, 'stretch', 'wood');
    drawCatPhoto(360, 240,  80, 96, 'lay',     'silver');
    // Small fireplace on the right wall
    drawSmallFireplace(690, 210, 200, 150, t);
    // Floor lamp far left
    drawFloorLamp(60, 580, t);
    // Left chair
    drawWingChair(200, 530, 0.82, +0.3);
    // Center table with birdcage on top
    drawCenterTable(480, 505);
    drawBirdcage(480, 500, t);
    // Two chairs on the right
    drawWingChair(640, 530, 0.80, -0.15);
    drawWingChair(790, 530, 0.80, -0.30);
    drawSceneVignette();
  }

  // A dining-style table for the birdcage to sit on.
  function drawCenterTable(cx, cy) {
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 70, 80, 8, 0, 0, TAU); ctx.fill();

    // Table top — oval
    const g = ctx.createLinearGradient(cx - 90, cy, cx + 90, cy);
    g.addColorStop(0, '#3a1e10');
    g.addColorStop(0.5, '#8a5432');
    g.addColorStop(1, '#3a1e10');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, 90, 14, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,180,0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy - 1, 90, 14, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // 4 legs (2 visible in front, 2 partially in back)
    ctx.fillStyle = '#3a1e10';
    ctx.fillRect(cx - 78, cy + 6, 5, 60);
    ctx.fillRect(cx + 73, cy + 6, 5, 60);
    ctx.fillStyle = '#2a1408';
    ctx.fillRect(cx - 40, cy + 6, 4, 55);
    ctx.fillRect(cx + 36, cy + 6, 4, 55);

    // Table skirt between top and legs
    ctx.fillStyle = '#2a1408';
    ctx.fillRect(cx - 78, cy + 5, 156, 6);
    ctx.restore();
  }

  // The birdcage — a domed cage with vertical bars, a small bird on a perch,
  // sitting on the table.
  function drawBirdcage(cx, cy, t) {
    ctx.save();

    // Base plate (a small dark disc)
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 4, 34, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,180,0.30)';
    ctx.fillRect(cx - 32, cy - 6, 64, 1);

    const bottom = cy - 8;
    const top = cy - 74;
    const domeTop = cy - 92;

    // Back arc of the cage (behind bird)
    ctx.strokeStyle = 'rgba(80,60,50,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, bottom, 34, Math.PI, TAU);   // back rim faint
    ctx.stroke();

    // Vertical bars — 9 bars spanning the cylinder body
    const barCount = 9;
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < barCount; i++) {
      const a = -Math.PI / 2 + (i - (barCount - 1) / 2) * (Math.PI / (barCount - 1));
      const bx = cx + Math.cos(a) * 32;
      ctx.beginPath();
      ctx.moveTo(bx, bottom);
      ctx.lineTo(bx, top);
      ctx.stroke();
    }

    // Horizontal ring at the top of the cylinder
    ctx.beginPath();
    ctx.ellipse(cx, top, 32, 5, 0, 0, TAU);
    ctx.stroke();
    // Horizontal ring at the bottom
    ctx.beginPath();
    ctx.ellipse(cx, bottom, 32, 6, 0, 0, TAU);
    ctx.stroke();

    // Dome — curved bars meeting at the top
    for (let i = 0; i < barCount; i++) {
      const a = -Math.PI / 2 + (i - (barCount - 1) / 2) * (Math.PI / (barCount - 1));
      const bx = cx + Math.cos(a) * 32;
      ctx.beginPath();
      ctx.moveTo(bx, top);
      ctx.quadraticCurveTo(cx, top - 10, cx, domeTop);
      ctx.stroke();
    }

    // Ring hook at the top
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, domeTop - 4, 4, 0, TAU);
    ctx.stroke();

    // Perch inside
    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, bottom - 20);
    ctx.lineTo(cx + 18, bottom - 20);
    ctx.stroke();

    // The bird — a small yellow songbird facing left with tiny hop
    const hop = Math.abs(Math.sin(t * 3)) * 2;
    const birdX = cx - 4, birdY = bottom - 22 - hop;
    // body
    ctx.fillStyle = '#f8d854';
    ctx.beginPath(); ctx.ellipse(birdX, birdY, 10, 8, 0, 0, TAU); ctx.fill();
    // wing accent
    ctx.fillStyle = '#c8a020';
    ctx.beginPath(); ctx.ellipse(birdX + 2, birdY + 2, 6, 4, 0.3, 0, TAU); ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(birdX + 8, birdY);
    ctx.lineTo(birdX + 14, birdY - 2);
    ctx.lineTo(birdX + 14, birdY + 3);
    ctx.closePath();
    ctx.fill();
    // head
    ctx.fillStyle = '#f8d854';
    ctx.beginPath(); ctx.arc(birdX - 8, birdY - 4, 6, 0, TAU); ctx.fill();
    // beak
    ctx.fillStyle = '#e0a820';
    ctx.beginPath();
    ctx.moveTo(birdX - 13, birdY - 4);
    ctx.lineTo(birdX - 17, birdY - 3);
    ctx.lineTo(birdX - 13, birdY - 2);
    ctx.closePath();
    ctx.fill();
    // eye
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(birdX - 10, birdY - 5, 0.9, 0, TAU); ctx.fill();
    // legs
    ctx.strokeStyle = '#c88820';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(birdX - 2, birdY + 8); ctx.lineTo(birdX - 2, bottom - 20);
    ctx.moveTo(birdX + 2, birdY + 8); ctx.lineTo(birdX + 2, bottom - 20);
    ctx.stroke();

    // Tiny "music notes" floating up (bird chirping)
    ctx.fillStyle = 'rgba(120,60,80,0.75)';
    const noteFloat = (t * 30) % 60;
    ctx.font = '14px "Georgia", serif';
    ctx.fillText('♪', cx + 30 + Math.sin(noteFloat * 0.3) * 4, bottom - 20 - noteFloat);
    ctx.fillText('♫', cx + 40 + Math.sin((noteFloat + 20) * 0.3) * 4, bottom - 10 - ((noteFloat + 30) % 60));

    ctx.restore();
  }
  // =========================================================================
  // PHASE 6 — kittens playing on the floor with milk bowls
  // =========================================================================

  function drawPhase6(t) {
    drawRoomWall();
    drawFloor();
    drawBaseboard();
    // Small fireplace top-left
    drawSmallFireplace(140, 200, 200, 150, t);
    // A different gallery of Felicia photos on the right wall.
    drawCatPhoto(600, 220,  76, 90, 'play',   'wood');
    drawCatPhoto(690, 220,  76, 90, 'curl',   'gold');
    drawCatPhoto(780, 220,  76, 90, 'hunt',   'silver');
    // Floor lamp on the right
    drawFloorLamp(860, 585, t);
    // Two chairs behind (higher on screen)
    drawWingChair(310, 480, 0.75, 0);
    drawWingChair(600, 480, 0.75, 0);
    // Kittens + bowls scattered across the floor
    drawKittensAndBowls(t);
    drawSceneVignette();
  }

  function drawKittensAndBowls(t) {
    // A layout of milk bowls and kittens across the wooden floor. Positions
    // are deterministic (rng seeded) so the composition is stable.
    const bowls = [
      { x:  90, y: 555 }, { x: 170, y: 540 }, { x: 240, y: 578 },
      { x: 350, y: 560 }, { x: 460, y: 545 }, { x: 540, y: 578 },
      { x: 640, y: 550 }, { x: 720, y: 575 }, { x: 800, y: 545 },
    ];
    for (const b of bowls) drawMilkBowl(b.x, b.y, 1.0);

    const kittens = [
      { x: 130, y: 555, s: 0.9, pose: 'curl',  face: 1  },
      { x: 210, y: 570, s: 0.9, pose: 'lay',   face: -1 },
      { x: 300, y: 555, s: 0.9, pose: 'stand', face: 1  },
      { x: 400, y: 573, s: 0.9, pose: 'lay',   face: 1  },
      { x: 500, y: 555, s: 0.9, pose: 'curl',  face: -1 },
      { x: 590, y: 570, s: 0.9, pose: 'stand', face: -1 },
      { x: 680, y: 560, s: 0.9, pose: 'lay',   face: 1  },
      { x: 760, y: 552, s: 0.9, pose: 'curl',  face: -1 },
    ];
    for (const k of kittens) drawKitten(k.x, k.y, k.s, k.pose, k.face, t);
  }

  // A small white kitten in one of three poses.
  function drawKitten(cx, cy, s, pose, face, t) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(face * s, s);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 8, 18, 3, 0, 0, TAU); ctx.fill();

    const fur   = '#f4ecd8';
    const shade = '#d0c4a8';
    const dark  = '#0a0510';

    if (pose === 'curl') {
      // Curled up sleeping
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, 2, 16, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.ellipse(0, 2, 16, 10, 0, 0, Math.PI);
      ctx.fill();
      // head tucked
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.arc(-10, -2, 7, 0, TAU); ctx.fill();
      // ears
      ctx.beginPath();
      ctx.moveTo(-14, -5); ctx.lineTo(-12, -12); ctx.lineTo(-8, -6); ctx.closePath();
      ctx.moveTo(-6, -6); ctx.lineTo(-4, -12); ctx.lineTo(-2, -6); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffb0c0';
      ctx.beginPath();
      ctx.moveTo(-13, -6); ctx.lineTo(-12, -10); ctx.lineTo(-10, -6); ctx.closePath();
      ctx.moveTo(-5, -6); ctx.lineTo(-4, -10); ctx.lineTo(-3, -6); ctx.closePath();
      ctx.fill();
      // closed eyes
      ctx.strokeStyle = dark; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-12, -1); ctx.lineTo(-9, -1);
      ctx.stroke();
      // tail wrapping
      ctx.strokeStyle = fur; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(14, 4);
      ctx.quadraticCurveTo(20, 0, 16, -6);
      ctx.stroke();
    } else if (pose === 'lay') {
      // Laying on side, playful (tail up)
      const tailWag = Math.sin(t * 4 + cx * 0.05) * 3;
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, 2, 18, 8, 0, 0, TAU); ctx.fill();
      // head
      ctx.beginPath(); ctx.arc(14, -1, 7, 0, TAU); ctx.fill();
      // ears
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.moveTo(10, -5); ctx.lineTo(12, -12); ctx.lineTo(15, -5); ctx.closePath();
      ctx.moveTo(15, -5); ctx.lineTo(18, -12); ctx.lineTo(20, -5); ctx.closePath();
      ctx.fill();
      // eyes
      ctx.fillStyle = dark;
      ctx.fillRect(13, -2, 1.2, 1.5);
      ctx.fillRect(16, -2, 1.2, 1.5);
      // nose
      ctx.fillStyle = '#ffa0b8';
      ctx.beginPath();
      ctx.moveTo(15, 0); ctx.lineTo(17, 0); ctx.lineTo(16, 2); ctx.closePath();
      ctx.fill();
      // 4 legs sticking out
      ctx.fillStyle = fur;
      ctx.fillRect(-8, 6, 4, 6);
      ctx.fillRect(-2, 6, 4, 6);
      ctx.fillRect(4, 6, 4, 6);
      // tail up in air with wag
      ctx.strokeStyle = fur; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, 2);
      ctx.quadraticCurveTo(-22, -6, -18 + tailWag, -12);
      ctx.stroke();
    } else if (pose === 'stand') {
      // Standing / walking pose
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, -3, 16, 7, 0, 0, TAU); ctx.fill();
      // head
      ctx.beginPath(); ctx.arc(13, -10, 7, 0, TAU); ctx.fill();
      // ears
      ctx.beginPath();
      ctx.moveTo(9, -14); ctx.lineTo(11, -20); ctx.lineTo(14, -14); ctx.closePath();
      ctx.moveTo(14, -14); ctx.lineTo(17, -20); ctx.lineTo(19, -14); ctx.closePath();
      ctx.fill();
      // eyes
      ctx.fillStyle = dark;
      ctx.fillRect(12, -11, 1.2, 1.5);
      ctx.fillRect(15, -11, 1.2, 1.5);
      // legs
      ctx.fillStyle = fur;
      const step = Math.sin(t * 4 + cx * 0.03);
      ctx.fillRect(-12, 4, 3, 6 + step * 1);
      ctx.fillRect(-6, 4, 3, 6 - step * 1);
      ctx.fillRect(6, 4, 3, 6 + step * 1);
      ctx.fillRect(12, 4, 3, 6 - step * 1);
      // tail up
      ctx.strokeStyle = fur; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, -3);
      ctx.quadraticCurveTo(-22, -12, -18, -20);
      ctx.stroke();
    }

    ctx.restore();
  }

  // A shallow round bowl of milk
  function drawMilkBowl(cx, cy, s) {
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 6, 20 * s, 3 * s, 0, 0, TAU); ctx.fill();
    // bowl
    const b = ctx.createLinearGradient(cx, cy - 5, cx, cy + 8);
    b.addColorStop(0, '#5a90a0');
    b.addColorStop(1, '#2a5060');
    ctx.fillStyle = b;
    ctx.beginPath(); ctx.ellipse(cx, cy + 2, 20 * s, 6 * s, 0, 0, TAU); ctx.fill();
    // milk inside
    ctx.fillStyle = '#f0f0e8';
    ctx.beginPath(); ctx.ellipse(cx, cy, 17 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
    // rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, 17 * s, 4.5 * s, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // subtle milk reflection
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(cx - 8 * s, cy - 1, 6 * s, 1);
    ctx.restore();
  }
  // =========================================================================
  // PHASE 7 — cupids & hearts (the romantic finale, "you saved Felicia")
  // =========================================================================

  function drawPhase7(t) {
    // Soft rose/sky gradient background
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#84d4e4');
    g.addColorStop(0.6, '#6ac0e0');
    g.addColorStop(1, '#4a90c0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Cupids only on the top, left, and right (top row faces inward).
    drawCupidBorder(t);
    // Interior hearts field (pink safe, black broken) with a gift resting
    // on one random pink slot, and a small cat walking along the bottom
    // safe row.
    drawHeartsField(t);
    // Sparkles + confetti animated
    drawConfetti(t);
    // Slight vignette to focus attention
    drawSceneVignette();
  }

  function drawCupidBorder(t) {
    const cupidSize = 56;
    const spacing = 90;
    const midX = W / 2;
    // Top-row cupids aim their arrows 45° DOWNWARD (toward the platform below).
    const downArrow = Math.PI / 4;

    // Top row — left half faces RIGHT (toward center), right half faces LEFT.
    // Arrows angled 45° down so they shoot into the heart platform.
    for (let x = 40; x < W - 20; x += spacing) {
      const face = x < midX ? 1 : -1;
      drawCupid(x, 32, cupidSize, face, t, downArrow);
    }

    // Left column — all face RIGHT (into the scene). Arrow horizontal.
    for (let y = 110; y < H - 40; y += spacing) {
      drawCupid(30, y, cupidSize, 1, t, 0);
    }

    // Right column — all face LEFT (into the scene). Arrow horizontal.
    for (let y = 110; y < H - 40; y += spacing) {
      drawCupid(W - 30, y, cupidSize, -1, t, 0);
    }

    // No bottom row — the bottom edge is a solid pink-heart safe row instead.
  }

  function drawCupid(cx, cy, size, face, t, arrowAngle) {
    if (arrowAngle == null) arrowAngle = 0;
    const bob = Math.sin(t * 2 + cx * 0.05 + cy * 0.03) * 2;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(face * size / 60, size / 60);

    // Wing (behind body)
    ctx.fillStyle = 'rgba(255,240,250,0.9)';
    ctx.beginPath();
    ctx.ellipse(-4, -8, 12, 8, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,180,200,0.6)';
    ctx.beginPath();
    ctx.ellipse(-8, -12, 4, 8, -0.6, 0, TAU);
    ctx.fill();

    // Body (round chubby cupid)
    ctx.fillStyle = '#f88ab8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 12, 0, 0, TAU);
    ctx.fill();
    // Body shading
    ctx.fillStyle = 'rgba(200,60,120,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 2, 8, 10, 0, 0, TAU);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f8a0c8';
    ctx.beginPath(); ctx.arc(2, -12, 7, 0, TAU); ctx.fill();
    // Hair curl
    ctx.fillStyle = '#c04080';
    ctx.beginPath(); ctx.arc(0, -18, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -18, 2.5, 0, TAU); ctx.fill();

    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(4, -12, 0.9, 0, TAU); ctx.fill();

    // Arm + bow + arrow group — pivoted at the shoulder so we can aim the
    // arrow. arrowAngle = 0 → horizontal, +π/4 → 45° down.
    ctx.save();
    ctx.translate(4, -3);
    ctx.rotate(arrowAngle);
    ctx.translate(-4, 3);

    // Arms holding the bow (front arm)
    ctx.fillStyle = '#f88ab8';
    ctx.fillRect(4, -4, 10, 3);
    // Bow (curved with string)
    ctx.strokeStyle = '#3a1810';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, -8);
    ctx.quadraticCurveTo(20, -2, 14, 4);
    ctx.stroke();
    // Bowstring
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(14, -8);
    ctx.lineTo(14, 4);
    ctx.stroke();
    // Arrow
    ctx.strokeStyle = '#3a1810';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(14, -2); ctx.lineTo(28, -2);
    ctx.stroke();
    // Arrow head
    ctx.fillStyle = '#f04870';
    ctx.beginPath();
    ctx.moveTo(28, -2); ctx.lineTo(24, -5); ctx.lineTo(24, 1); ctx.closePath();
    ctx.fill();
    // Arrow fletching
    ctx.fillStyle = '#ffb0d0';
    ctx.fillRect(11, -3.5, 2, 3);

    ctx.restore(); // end arm/bow group

    // Legs
    ctx.fillStyle = '#f88ab8';
    ctx.fillRect(-4, 10, 3, 5);
    ctx.fillRect(1, 10, 3, 5);

    ctx.restore();
  }

  // Phase 7 layout is expensive to build (grid + gift placement) and never
  // changes, so build once and cache.
  let PHASE7_LAYOUT = null;
  function getPhase7Layout() {
    if (PHASE7_LAYOUT) return PHASE7_LAYOUT;
    const rows = 14, cols = 24;
    const startY = 88, endY = H - 90;
    const xStart = 55, xEnd = W - 55;
    const rowGap = (endY - startY) / (rows - 1);
    const colGap = (xEnd - xStart) / (cols - 1);
    const size = 14;

    // Layout grid — 'pink' (safe) or 'broken' (falls through)
    const rand = rng(4444);
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        if (r === rows - 1) row.push('pink');                   // bottom safe
        else                row.push(rand() < 0.7 ? 'pink' : 'broken');
      }
      grid.push(row);
    }
    // Guarantee the cat's starting cell is pink
    const startC = Math.floor(cols / 2);
    grid[rows - 1][startC] = 'pink';

    // Choose a pink cell for the gift
    let giftR = 5, giftC = 12;
    const gRand = rng(9191);
    for (let tries = 0; tries < 60; tries++) {
      const r = 2 + Math.floor(gRand() * (rows - 4));
      const c = 3 + Math.floor(gRand() * (cols - 6));
      if (grid[r][c] === 'pink') { giftR = r; giftC = c; break; }
    }

    PHASE7_LAYOUT = { rows, cols, startY, endY, xStart, xEnd,
                       rowGap, colGap, size, grid, giftR, giftC,
                       startC };
    return PHASE7_LAYOUT;
  }

  // Convert grid (r, c) to canvas pixel position for the CENTER of that heart.
  function heartCellX(L, r, c) {
    return L.xStart + c * L.colGap + (r % 2) * (L.colGap / 2);
  }
  function heartCellY(L, r) { return L.startY + r * L.rowGap; }

  function drawHeartsField(t) {
    const L = getPhase7Layout();
    const { rows, cols, startY, xStart, rowGap, colGap, size, grid,
             giftR, giftC } = L;

    // Draw every heart. The gift cell is skipped and drawn separately on top.
    for (let r = 0; r < rows; r++) {
      const rowOffset = (r % 2) * (colGap / 2);
      for (let c = 0; c < cols; c++) {
        if (r === giftR && c === giftC) continue;
        const x = xStart + c * colGap + rowOffset;
        const y = startY + r * rowGap;
        const bob = Math.sin(t * 1.0 + c * 0.28 + r * 0.4) * 0.8;
        if (grid[r][c] === 'pink') {
          drawHeart(x, y + bob, size, '#ff5aad');
        } else {
          drawBrokenHeart(x, y + bob, size);
        }
      }
    }

    // Gift bertengger di atas satu heart pink
    const gx = heartCellX(L, giftR, giftC);
    const gy = heartCellY(L, giftR);
    drawLoveGift(gx, gy - 4, t);

    // Hero cat — walks, jumps, and falls through broken hearts
    updateHero(t, L);
    drawHero(t, L);
  }

  // ---------------- Hero cat AI ----------------
  // The cat wanders the heart grid — walks left/right, jumps up (straight
  // or diagonally), hops down, and falls through if it lands on a broken
  // heart. It never wraps around screen edges. Bottom row is guaranteed
  // safe so a fall always lands somewhere it can stand.
  //
  // Implementation note: the entire move sequence is *precomputed* once
  // from a fixed seed. Each entry has its start time and duration, so
  // `getHeroStateAt(t)` can find the current move by linear scan. This
  // avoids the "state stuck because rAF didn't fire enough" problem that
  // an incremental-update state machine would have under headless capture
  // (Chrome's --virtual-time-budget doesn't reliably run rAF at 60fps).
  let HERO_SEQ = null;

  function buildHeroSequence(L) {
    const rand = rng(31337);
    const seq = [];
    let r = L.rows - 1, c = L.startC, dir = 1;
    let cursorT = 0.6; // first move at 0.6 s
    const restMin = 0.28, restRange = 0.5;

    // We generate up to ~180 s of animation. That's plenty for demo purposes.
    for (let n = 0; n < 260; n++) {
      // Pick a move — 8 possible directions (walks, jumps, hops).
      const cands = [];
      if (c > 0)          cands.push({ dr:  0, dc: -1, type: 'walk' });
      if (c < L.cols - 1) cands.push({ dr:  0, dc: +1, type: 'walk' });
      if (r > 0) {
        cands.push({ dr: -1, dc:  0, type: 'jump' });
        if (c > 0)          cands.push({ dr: -1, dc: -1, type: 'jump' });
        if (c < L.cols - 1) cands.push({ dr: -1, dc: +1, type: 'jump' });
      }
      if (r < L.rows - 1) {
        cands.push({ dr: +1, dc:  0, type: 'jump' });
        if (c > 0)          cands.push({ dr: +1, dc: -1, type: 'jump' });
        if (c < L.cols - 1) cands.push({ dr: +1, dc: +1, type: 'jump' });
      }
      if (cands.length === 0) break;
      const m = cands[Math.floor(rand() * cands.length)];
      const fromR = r, fromC = c;
      const toR = r + m.dr, toC = c + m.dc;
      const moveDir = m.dc !== 0 ? (m.dc > 0 ? 1 : -1) : dir;
      const dur = m.type === 'walk' ? 0.30 : 0.45;
      seq.push({ fromR, fromC, toR, toC, type: m.type, dir: moveDir,
                  startT: cursorT, dur });
      cursorT += dur;
      dir = moveDir;
      r = toR; c = toC;

      // If we landed on a broken heart, chain a FALL move.
      if (L.grid[r][c] === 'broken') {
        let fr = r + 1;
        while (fr < L.rows && L.grid[fr][c] === 'broken') fr++;
        if (fr >= L.rows) fr = L.rows - 1;
        const fallDur = 0.15 + 0.10 * (fr - r);
        seq.push({ fromR: r, fromC: c, toR: fr, toC: c, type: 'fall',
                    dir, startT: cursorT, dur: fallDur });
        cursorT += fallDur;
        r = fr;
      }

      // Idle rest between moves
      cursorT += restMin + rand() * restRange;
    }
    return seq;
  }

  // Returns the visual state of the cat at time `t`:
  //   { x, y, dir, state, animP } — everything drawHeroCat needs.
  function getHeroStateAt(t, L) {
    if (!HERO_SEQ) HERO_SEQ = buildHeroSequence(L);
    const seq = HERO_SEQ;

    // Initial pose (before the first move)
    const startX = heartCellX(L, L.rows - 1, L.startC);
    const startY = heartCellY(L, L.rows - 1);
    if (seq.length === 0 || t < seq[0].startT) {
      return { x: startX, y: startY, dir: 1, state: 'idle', animP: 0 };
    }

    // Linear scan — the cat has few enough moves that this stays cheap.
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i];
      const endT = s.startT + s.dur;
      if (t < s.startT) {
        // Between moves: idle at the previous move's endpoint.
        const prev = seq[i - 1];
        return {
          x: heartCellX(L, prev.toR, prev.toC),
          y: heartCellY(L, prev.toR),
          dir: prev.dir, state: 'idle', animP: 0,
        };
      }
      if (t < endT) {
        // Mid-move: interpolate position.
        const p = (t - s.startT) / s.dur;
        const x0 = heartCellX(L, s.fromR, s.fromC);
        const y0 = heartCellY(L, s.fromR);
        const x1 = heartCellX(L, s.toR, s.toC);
        const y1 = heartCellY(L, s.toR);
        let x = lerp(x0, x1, p), y;
        if (s.type === 'jump') {
          const heightPx = 22 + (s.fromR > s.toR ? 8 : 0);
          y = lerp(y0, y1, p) - Math.sin(p * Math.PI) * heightPx;
        } else if (s.type === 'fall') {
          y = y0 + (y1 - y0) * (p * p);
        } else {
          y = lerp(y0, y1, p);
        }
        return { x, y, dir: s.dir, state: s.type, animP: p };
      }
    }
    // Past the end of the sequence — idle at the last endpoint
    const last = seq[seq.length - 1];
    return {
      x: heartCellX(L, last.toR, last.toC),
      y: heartCellY(L, last.toR),
      dir: last.dir, state: 'idle', animP: 0,
    };
  }

  function drawHero(t, L) {
    const s = getHeroStateAt(t, L);
    drawHeroCat(s.x, s.y - L.size * 0.7, s.dir, s.state, t, s.animP);
  }

  // (updateHero kept as a no-op for API compatibility — the state is now
  // computed inside drawHero via getHeroStateAt.)
  function updateHero() {}

  function drawHeroCat(cx, feetY, dir, state, t, animP) {
    ctx.save();
    ctx.translate(cx, feetY);
    ctx.scale(dir, 1);
    ctx.fillStyle = '#0a0510';

    if (state === 'jump') {
      // ---- LEAPING pose — clearly airborne, not a standing sprite. ----
      //
      // Body is elongated, tilts along the arc (nose up while rising, nose
      // down while landing), front paws reach forward toward the target
      // platform, back legs push off, tail streams straight behind.
      const p = (animP == null) ? 0.5 : animP;
      const tilt = (p - 0.5) * 0.7;   // -0.35 rising → +0.35 landing
      ctx.rotate(tilt);

      // Body — elongated horizontal cigar
      ctx.beginPath();
      ctx.ellipse(0, -10, 17, 5, 0, 0, TAU);
      ctx.fill();

      // Head extended forward
      ctx.beginPath(); ctx.arc(15, -13, 6, 0, TAU); ctx.fill();

      // Ears swept back (like a real jumping cat)
      ctx.beginPath();
      ctx.moveTo(11, -16); ctx.lineTo(9, -21);  ctx.lineTo(14, -17); ctx.closePath();
      ctx.moveTo(15, -17); ctx.lineTo(14, -22); ctx.lineTo(18, -18); ctx.closePath();
      ctx.fill();

      // Front paws — reaching forward toward the next platform
      ctx.strokeStyle = '#0a0510';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, -9);  ctx.lineTo(19, -4);
      ctx.moveTo(10, -9); ctx.lineTo(21, -6);
      ctx.stroke();
      // paw tips
      ctx.fillStyle = '#0a0510';
      ctx.beginPath(); ctx.arc(19, -4, 1.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(21, -6, 1.6, 0, TAU); ctx.fill();

      // Back legs — stretched behind, pushing off from take-off
      ctx.strokeStyle = '#0a0510';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, -8);  ctx.lineTo(-15, -4);
      ctx.moveTo(-8, -10); ctx.lineTo(-16, -8);
      ctx.stroke();

      // Tail streaming straight back like an arrow
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-14, -10);
      ctx.lineTo(-24, -13);
      ctx.stroke();

      // Motion streaks trailing behind the tail — sells the speed
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-24, -6);  ctx.lineTo(-32, -6);
      ctx.moveTo(-24, -14); ctx.lineTo(-32, -14);
      ctx.moveTo(-25, -10); ctx.lineTo(-33, -10);
      ctx.stroke();
    } else if (state === 'fall') {
      // Falling — startled cat, legs splayed, tail up
      ctx.beginPath(); ctx.ellipse(0, -10, 13, 5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -14, 6, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(7, -18);  ctx.lineTo(9, -22);  ctx.lineTo(12, -18); ctx.closePath();
      ctx.moveTo(13, -18); ctx.lineTo(15, -22); ctx.lineTo(18, -18); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0a0510'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -8); ctx.lineTo(-10, -2);
      ctx.moveTo(-2, -6); ctx.lineTo(-6,   0);
      ctx.moveTo( 5, -6); ctx.lineTo( 9,   0);
      ctx.moveTo( 8, -8); ctx.lineTo(12,  -2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.quadraticCurveTo(-20, -14, -14, -22);
      ctx.stroke();
    } else {
      // Standing / walking
      const walkT = t * 6;
      const step = Math.sin(walkT);
      ctx.beginPath(); ctx.ellipse(0, -8, 12, 5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(10, -14, 6, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, -17);  ctx.lineTo(8, -22);  ctx.lineTo(11, -17); ctx.closePath();
      ctx.moveTo(12, -17); ctx.lineTo(14, -22); ctx.lineTo(17, -17); ctx.closePath();
      ctx.fill();
      ctx.fillRect(-8, -3, 2, 5 + step);
      ctx.fillRect(-4, -3, 2, 5 - step);
      ctx.fillRect( 4, -3, 2, 5 - step);
      ctx.fillRect( 8, -3, 2, 5 + step);
      ctx.strokeStyle = '#0a0510'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.quadraticCurveTo(-16, -12, -12, -20);
      ctx.stroke();
    }

    // Glowing amber eye
    const g = ctx.createRadialGradient(13, -14, 0, 13, -14, 3);
    g.addColorStop(0, 'rgba(255,220,120,0.95)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(13, -14, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(13, -14, 1, 0, TAU); ctx.fill();

    ctx.restore();
  }

  // A broken (black) heart — two halves separated by a jagged crack.
  function drawBrokenHeart(cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#181018';

    // Left half of the heart
    ctx.beginPath();
    ctx.moveTo(-size * 0.05, size * 0.7);
    ctx.lineTo(-size * 0.05, size * 0.35);
    ctx.bezierCurveTo(-size * 1.1, -size * 0.35,
                       -size * 0.55, -size * 0.9,
                       -size * 0.15, -size * 0.15);
    ctx.lineTo(-size * 0.10, size * 0.35);
    ctx.closePath();
    ctx.fill();

    // Right half of the heart — slightly offset so the crack shows through
    ctx.beginPath();
    ctx.moveTo(size * 0.10, size * 0.35);
    ctx.lineTo(size * 0.15, -size * 0.15);
    ctx.bezierCurveTo(size * 0.55, -size * 0.9,
                       size * 1.1, -size * 0.35,
                       size * 0.05, size * 0.35);
    ctx.lineTo(size * 0.05, size * 0.7);
    ctx.closePath();
    ctx.fill();

    // Zigzag crack down the middle in dark red so it reads as "broken"
    ctx.strokeStyle = '#8a1030';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0,  -size * 0.20);
    ctx.lineTo(-1.5, -size * 0.05);
    ctx.lineTo( 1.5,  size * 0.05);
    ctx.lineTo(-1,    size * 0.20);
    ctx.lineTo( 1,    size * 0.35);
    ctx.stroke();

    ctx.restore();
  }

  function drawHeartPathCat(t, floorY) {
    // Slow deliberate walk from left to right along the safe pink base row
    const speed = 22;
    const span = W + 60;
    const wrapped = (t * speed) % span;
    const cx = -30 + wrapped;
    const cy = (floorY != null ? floorY : H * 0.5 + 10);
    const walkT = t * 4;
    const bob = Math.abs(Math.sin(walkT)) * 1.5;

    ctx.save();
    ctx.translate(cx, cy - bob);

    // Body
    ctx.fillStyle = '#0a0510';
    ctx.beginPath(); ctx.ellipse(0, -8, 18, 7, 0, 0, TAU); ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(16, -18, 8, 0, TAU); ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(11, -22); ctx.lineTo(13, -30); ctx.lineTo(17, -22); ctx.closePath();
    ctx.moveTo(18, -22); ctx.lineTo(21, -30); ctx.lineTo(24, -22); ctx.closePath();
    ctx.fill();
    // Legs (walking)
    const step = Math.sin(walkT);
    ctx.fillRect(-12, -2, 2.5, 6 + step * 2);
    ctx.fillRect(-6,  -2, 2.5, 6 - step * 2);
    ctx.fillRect( 8,  -2, 2.5, 6 - step * 2);
    ctx.fillRect(12,  -2, 2.5, 6 + step * 2);
    // Tail arched up
    ctx.strokeStyle = '#0a0510'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.quadraticCurveTo(-24, -22, -18, -28);
    ctx.stroke();
    // Glowing amber eye
    const eg = ctx.createRadialGradient(20, -20, 0, 20, -20, 4);
    eg.addColorStop(0, 'rgba(255,220,120,0.95)');
    eg.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(20, -20, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(20, -20, 1.2, 0, TAU); ctx.fill();

    ctx.restore();
  }

  function drawHeart(cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.bezierCurveTo(-size * 1.1, -size * 0.35, -size * 0.55, -size * 0.9, 0, -size * 0.2);
    ctx.bezierCurveTo(size * 0.55, -size * 0.9, size * 1.1, -size * 0.35, 0, size * 0.35);
    // Downward tail
    ctx.lineTo(0, size * 0.7);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.35, -size * 0.35, size * 0.18, size * 0.12, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Dark curled heart-note (the CGA original shows these as black flourishes)
  function drawBlackHeart(cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#1a0a10';
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.bezierCurveTo(-size * 1.1, -size * 0.35, -size * 0.55, -size * 0.9, 0, -size * 0.2);
    ctx.bezierCurveTo(size * 0.55, -size * 0.9, size * 1.1, -size * 0.35, 0, size * 0.35);
    ctx.lineTo(0, size * 0.7);
    ctx.closePath();
    ctx.fill();
    // Tiny stem/note curl
    ctx.strokeStyle = '#1a0a10';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.7);
    ctx.quadraticCurveTo(size * 0.3, size * 1.1, size * 0.6, size * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  // A small gift box with a bow at the bottom center
  function drawLoveGift(cx, cy, t) {
    const wob = Math.sin(t * 2) * 1.5;
    ctx.save();
    ctx.translate(cx, cy + wob);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 24, 30, 4, 0, 0, TAU); ctx.fill();

    // Box body
    ctx.fillStyle = '#f8e8f0';
    ctx.fillRect(-28, -8, 56, 28);
    // Box lid
    ctx.fillStyle = '#f0d8e4';
    ctx.fillRect(-32, -14, 64, 10);
    // Ribbon vertical
    ctx.fillStyle = '#ff4a90';
    ctx.fillRect(-4, -14, 8, 34);
    // Ribbon horizontal (on lid)
    ctx.fillRect(-32, -12, 64, 6);
    // Bow
    ctx.beginPath();
    ctx.ellipse(-8, -14, 8, 5, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -14, 8, 5, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c02870';
    ctx.beginPath(); ctx.arc(0, -14, 3, 0, TAU); ctx.fill();

    // Highlight on the box
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(-26, -6, 3, 24);

    // Floating heart above the box
    const heartFloat = Math.sin(t * 3) * 3;
    drawHeart(0, -30 + heartFloat, 10, '#ff3a90');

    ctx.restore();
  }

  function drawConfetti(t) {
    ctx.save();
    const rand = rng(2222);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const x = rand() * W;
      const speed = 20 + rand() * 40;
      const phase = rand() * 100;
      const y = ((t * speed + phase * 10) % (H + 20));
      const swing = Math.sin(t * 2 + i) * 15;
      const colors = ['#ff90c0', '#ffe08a', '#a0f8ff', '#ffb8e8', '#c0ff90'];
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x + swing, y, 3, 5);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Scene selection + main loop
  // -------------------------------------------------------------------------
  // Scene dispatch table — one draw function per tab.
  const SCENES = {
    title:  drawTitle,
    phase0: drawPhase0,
    phase2: drawPhase2,
    phase3: drawPhase3,
    phase4: drawPhase4,
    phase5: drawPhase5,
    phase6: drawPhase6,
    phase7: drawPhase7,
  };

  let scene = 'title';
  const params = new URLSearchParams(location.search);
  const initial = params.get('scene');
  if (initial && SCENES[initial]) scene = initial;
  // Optional ?t=SECONDS URL param jumps the animation clock forward on load.
  // Useful for headless screenshot tools, where requestAnimationFrame may not
  // fire enough times to advance our time-driven simulations naturally.
  const startOffsetT = parseFloat(params.get('t') || '0') || 0;
  const startMs = performance.now() - startOffsetT * 1000;

  function loop(nowMs) {
    const t = (nowMs - startMs) / 1000;
    ctx.clearRect(0, 0, W, H);
    (SCENES[scene] || drawTitle)(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Reflect the initial-scene param in the tab UI
  document.querySelectorAll('.tab').forEach(b => {
    const active = b.dataset.scene === scene;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      scene = btn.dataset.scene;
      document.querySelectorAll('.tab').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    });
  });

  // A tiny self-test hook so the file has an inspection surface from the
  // console — same convention the other ports use.
  window.selfTest = function () {
    const checks = [];
    checks.push(['canvas present', !!canvas]);
    checks.push(['context 2d', !!ctx]);
    checks.push(['title draws without error', (() => {
      try { drawTitle(0); return true; } catch (e) { console.error(e); return false; }
    })()]);
    checks.push(['phase0 draws without error', (() => {
      try { drawPhase0(0); return true; } catch (e) { console.error(e); return false; }
    })()]);
    for (const [name, ok] of checks) console.log((ok ? '✓' : '✗') + ' ' + name);
    return checks.every(([, ok]) => ok);
  };
})();
