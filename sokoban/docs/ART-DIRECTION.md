# Hening — Art Direction

> **Status:** v1.1 · 2026-10-26 (adds ponds, koi, torii gate, the stranger, crows) · read with `GAME-DESIGN.md` and `ARCHITECTURE.md` · owner: art direction (Claude)
> **Source of truth:** `reference/index.html`. When this document and the reference scene disagree, the reference scene wins and this document gets fixed.
> **Audience:** whoever builds the game (Gemini via Antigravity). Every value here is meant to be copied, not interpreted.

Hening is a zen remake of the 1984 warehouse puzzle. The rules stay classic. The look is a floating pastel world in the spirit of Monument Valley — **inspired by, never copied from**. No Ida, no totem, no crow-people, no named buildings or exact palettes from that game. (Ordinary crows that perch and fly are ours — §10b.4.)

---

## 0. How to use this document

1. Open `reference/index.html` in Chrome (it loads Three.js from jsDelivr, so it needs internet the first time).
2. Play it. Press `1`–`4` for the four moods, `Q`/`E` to rotate, `` ` `` to hide the reference panel.
3. Use the reference panel buttons to trigger every animation.
4. Build the game so a screenshot of the same room, mood and pose is indistinguishable from the reference.

The reference exposes `window.hening` for automated comparison:

| Call | Effect |
|---|---|
| `hening.start()` | Dismisses the title veil and starts audio |
| `hening.setMood(i)` | Snaps to mood `0..3` (Fajar, Siang, Senja, Malam) |
| `hening.level(i)` | Loads reference room `0..2` (Ruang 05, 06, 07) |
| `hening.closeUp(z)` | Zooms the camera `z`× onto the wanderer (`closeUp(1)` resets) |
| `hening.face(d)` | Turns the wanderer to screen direction `0..3` (up, right, down, left) |
| `hening.scrub(name, t, step)` | Freezes the wanderer at an exact moment (see §8.4). `scrub(null)` unfreezes |
| `hening.arrange(n)` | Teleports `n` lanterns onto pedestals to inspect lit states; no `n` = all, triggers the finale |
| `hening.rotate(±1)` | Rotates the view 90° |
| `hening.where()` | Screen position of the wanderer (for cropping screenshots) |
| `hening.skipIntro()` | Skips the walk in through the gate |
| `hening.focus(x, z, zoom)` | Frames any world point up close; `focus()` resets |
| `hening.decor` | The live decor: `ponds`, `basins`, `gate`, `stranger`, `crows`, `perches` |

The game itself must expose the same handle in development builds so screenshots can be compared one-to-one.

---

## 1. Pillars

| # | Pillar | What it means in practice |
|---|---|---|
| 1 | **Stillness** | Nothing flashes, shakes or shouts. Every transition eases. The loudest moment in the game is a temple bell. |
| 2 | **Readability first** | Iso beauty never costs puzzle clarity. Every walkable tile, every object, every target must be identifiable at a glance in every mood. |
| 3 | **Light is progress** | A solved target is a light source. A room's progress is visible as how much light it holds. A solved tower glows. |
| 4 | **A wanderer with feelings** | The character is tiny and faceless-ish, but every gesture reads: stepping, heaving, sighing, complaining, bowing. |
| 5 | **Zero raster** | No image files, no sprite sheets, no audio files. Geometry from primitives, textures generated on canvas at load, sound synthesised with Web Audio. |

---

## 2. Rendering stack

| Item | Value |
|---|---|
| Engine | Three.js **r170** (`three@0.170.0`), ES modules |
| Renderer | `WebGLRenderer({ antialias: true, alpha: true })`, `setClearColor(0x000000, 0)` |
| Pixel ratio | `min(devicePixelRatio, 2)` |
| Tone mapping | None. Output colour space sRGB (Three.js default) |
| Real-time lights | **None.** All shading is the pastel shader (§4) |
| Shadow maps | **None.** Contact shadows are soft discs (§10.1) |
| Post-processing | **None.** Glow is faked with additive sprites |
| Sky | CSS gradient on `<body>` behind a transparent canvas, plus a CSS sun/moon disc |
| Canvas CSS | `position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh` (do **not** rely on `inset: 0` — it breaks on high-DPI phones) |
| Static geometry | Merged per material role with `mergeGeometries` (one draw call per role) |
| Budget | 60 fps on a mid laptop, ≤ 150 draw calls in a room, ≤ 2 ms CPU per frame |

---

## 3. Camera

| Property | Value |
|---|---|
| Type | `OrthographicCamera`, near 0.1, far 400 |
| Elevation | **35.264°** (true isometric, `atan(1/√2)`) |
| Default azimuth | **45°** — camera sits at +X +Z looking at the origin |
| Distance | 60 units (irrelevant for ortho, only for clipping) |
| Rotation | `Q` / `E` turn the view by 90°. Azimuth eases with `damp(rate 5.5)` (≈ 0.6 s to settle) |
| Framing | Project the room's box (x ± (cols/2 + 0.6), z ± (rows/2 + 0.6), y 0..1) into view space; half-height = `max(maxY, maxX/aspect) × margin` |
| Margin | 1.30 desktop, 1.12 under 720 px wide |
| Target | Room centre at y = 0 |

### 3.1 Screen-relative controls

Arrow keys move **diagonally on screen**, along the grid:

| Key (view step 0) | Grid move | On screen |
|---|---|---|
| ↑ / W | row − 1 | up-right |
| → / D | col + 1 | down-right |
| ↓ / S | row + 1 | down-left |
| ← / A | col − 1 | up-left |

After the view is rotated `k` steps, screen direction `d` maps to `DIRS[(d − k) mod 4]`, where `DIRS = [up, right, down, left]` in grid terms. The arrow always points the same way on screen, whatever the rotation.

---

## 4. The pastel shader

All solid geometry uses one `ShaderMaterial`. It is what gives the flat, three-tone Monument Valley look. Copy it from the reference; the logic is:

1. **Face tint.** Weight each face direction by the surface normal:
   `top = max(n.y,0)`, `under = max(−n.y,0)`, `left = max(n·dirL,0)`, `right = max(n·dirR,0)`, plus the back sides (`−dirL` takes the right tint, `−dirR` the left tint).
   `tint = Σ(weight × tintColour) / Σweight`. Flat faces land on exactly one tint; round things (robe, hat, domes) blend smoothly.
2. `dirL` / `dirR` are the world directions currently facing screen-left and screen-right. They are recomputed whenever the camera azimuth changes, so lighting stays consistent after rotation:
   `toCam = (sin a, 0, cos a)`, `right = (cos a, 0, −sin a)`, `dirL = normalize(toCam − right)`, `dirR = normalize(toCam + right)`.
3. `colour = baseColour × tint`.
4. **Contact darkening.** On vertical faces above the floor: `× mix(0.84, 1.0, smoothstep(0, 0.26, worldY))`.
5. **Glow.** `colour = mix(colour, glow, glowAmt × 0.82) + glow × glowAmt × 0.22`.
6. **Mist.** `down = smoothstep(−0.05, −4.2, worldY)`; `far = smoothstep(10, 30, length(worldXZ))`; `colour = mix(colour, fog, max(down, far × 0.92))`.
7. End with `#include <colorspace_fragment>` so hex colours come out exactly as specified.

Architecture colours (`floorA`, `floorB`, `stone`, `wall`, `cap`, `goal`) are **shared uniform objects**, so a mood change is one write per role, not per mesh.

---

## 5. Moods (time of day)

Four moods, all pastel. Night is lavender, never black. Mood changes cross-fade over **2.4 s** with smoothstep easing — every colour below interpolates, including the CSS sky and sun.

### 5.1 Palette

| Token | Fajar (dawn) | Siang (day) | Senja (dusk) | Malam (night) | Used for |
|---|---|---|---|---|---|
| `skyTop` | `#b9c7e6` | `#9fd0e3` | `#8f80b9` | `#33396c` | CSS gradient 0 % |
| `skyBottom` | `#f7d9c4` | `#f3efe0` | `#f4ab90` | `#8a7db3` | CSS gradient 78 % |
| `sun` | `#fff1dc` | `#ffffff` | `#ffd7b0` | `#e8e6ff` | CSS radial disc |
| `fog` | `#f1d9cc` | `#e3efe9` | `#e8ac9d` | `#7b70a6` | Shader mist; must sit close to `skyBottom` |
| `cloud` | `#fdf1ea` | `#ffffff` | `#fbd2c2` | `#8d86b8` | Cloud sprite tint |
| `top` | `#fff7ef` | `#fffffa` | `#ffe5d4` | `#e2e0f4` | Upward faces |
| `left` | `#efcfc6` | `#dcebe5` | `#efb4a2` | `#b1abd3` | Faces toward screen-left |
| `right` | `#b5aecb` | `#a9c3cf` | `#8c83b2` | `#706a9f` | Faces toward screen-right |
| `under` | `#9c95b8` | `#90aab8` | `#71699a` | `#5a5487` | Downward faces |
| `floorA` | `#ebd3c0` | `#e9e0cc` | `#eabda9` | `#a4a0c6` | Floor checker, even |
| `floorB` | `#e4cab6` | `#e2d8c3` | `#e2b29f` | `#9c98be` | Floor checker, odd |
| `stone` | `#e6d3c3` | `#e8e2d4` | `#e3b7a8` | `#a29dc4` | Plinth tiers |
| `wall` | `#dcc2b6` | `#bcd8cf` | `#cc9eaa` | `#8f8ab8` | Wall bodies |
| `cap` | `#f7ebe0` | `#eef6f1` | `#f6dbcf` | `#c9c6e3` | Wall caps, finials, lips |
| `goal` | `#f3e6d8` | `#f5f0e6` | `#f6d9c9` | `#bab6d8` | Pedestal stone |
| `glow` | `#ffb470` | `#ffc35e` | `#ff9d55` | `#ffbb52` | Lit objects, pools, motes, hover |
| `shadow` | `#7d6f96` | `#5f7f8f` | `#5d4f80` | `#2e2a55` | Contact shadows |
| `ink` | `#4a4258` | `#3b4a52` | `#463a5c` | `#eeeaff` | UI text |
| `inkSoft` | `rgba(74,66,88,.62)` | `rgba(59,74,82,.6)` | `rgba(70,58,92,.62)` | `rgba(238,234,255,.66)` | Secondary UI text |
| `water` | `#a9cdd6` | `#93d1cf` | `#c3a3bf` | `#7873b0` | Pond and basin water; pond bottom = water × 0.72 |
| `veil` | `rgba(253,242,233,.78)` | `rgba(250,250,244,.8)` | `rgba(252,224,210,.78)` | `rgba(52,50,100,.66)` | Behind overlay text |

### 5.2 Sun, moon and stars

| | Fajar | Siang | Senja | Malam |
|---|---|---|---|---|
| Disc position (vw, vh) | 78 %, 56 % | 72 %, 16 % | 24 %, 66 % | 80 %, 18 % |
| Disc size | 34 vmin | 26 vmin | 46 vmin | 18 vmin |
| Stars opacity | 0 | 0 | 0.15 | 1 |

Stars: 260 points on a far shell, glow texture, size 2.2 px, twinkle ±0.25 px at 1.3 Hz.

### 5.3 Mood across a chapter

A chapter (one tower floor) holds 10 rooms. Time of day advances through the chapter, so the player feels a day pass:

| Room in chapter | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Mood position (0 = Fajar … 3 = Malam) | 0 | 0.33 | 0.67 | 1 | 1.33 | 1.67 | 2 | 2.33 | 2.67 | 3 |

Fractional positions blend the two neighbouring moods (e.g. 1.33 = 67 % Siang + 33 % Senja). Lobby and title use Fajar; the editor uses Siang.

---

## 6. Architecture kit

One tile = **1 unit**. The room is centred on the origin: `x = col − cols/2 + 0.5`, `z = row − rows/2 + 0.5`. The floor top is at **y = 0**.

| Piece | Geometry | Position | Role colour |
|---|---|---|---|
| Floor tile | Box 0.96 × 0.06 × 0.96 | y −0.03 (top at 0); the 0.04 gap shows the stone beneath as grout | `floorA` / `floorB` checker by `(r + c) % 2` |
| Wall body | Box 1 × 0.46 × 1 | y 0.17 | `wall` |
| Wall cap | Box 1.04 × 0.08 × 1.04 | y 0.44 (top at 0.48) | `cap` |
| Finial base | Cylinder r 0.14 → 0.16, h 0.12, 20 seg | y 0.54 | `cap` |
| Finial ball | Sphere r 0.12 | y 0.66 | `cap` |
| Plinth tier 1 | Unit columns, footprint (walls ∪ inside floor) | y −0.06 … −0.95 | `stone` |
| Plinth lip | Box 1.06 × 0.07 × 1.06 on edge cells of tier 1 | y −0.30 | `cap` |
| Plinth tier 2 | Footprint eroded once (cell kept only if all 4 neighbours are in) | y −0.95 … −2.2 | `stone` |
| Plinth tier 3 | Eroded again; if empty, a 3 × 3 core at the centre | y −2.2 … −5.5 | `stone` |

**Finials** go on wall cells that are outward corners (two neighbours, not opposite) or wall ends (zero or one neighbour).

**Walls stay low** (cap top 0.48). The wanderer (≈ 1.0 tall after scale) and objects (≈ 0.85) always stand above them, so nothing important is ever hidden. Do not raise walls for drama.

**Inside vs void.** Flood-fill from the start tile through non-wall cells; only those get floor tiles. Spaces outside the walls are void — no floor, just the plinth below.

**Outer vs inner walls.** A wall cell is *outer* if any of its 8 neighbours is void (or off the board); otherwise it is *inner*. Only outer walls are built as walls (body, cap, finials). Inner walls become water features (§10b.1). The rules do not change: an inner cell is still a wall to the game logic.

**The gate cell.** One outer wall cell becomes the torii gate (§10b.2). It gets a threshold stone instead of a wall body and cap, and no finial.

---

## 7. Themes (player preference)

Themes change only the **object**, the **target**, the **lit effect**, the **instrument** and the **push sound**. Rules, rooms, camera, architecture and moods are shared. The theme is chosen at the Kolam (pond) in the lobby and stored per player.

Common rules for every theme:

- The object fits a 0.62 × 0.62 footprint and stands 0.70–0.85 tall after its scale (Lentera uses `LANTERN_SCALE = 1.15`).
- Unlit, the object uses the pastel shader with no glow. Lit, its glow part ramps to `glowAmt 0.95` with `damp(rate 3.2)` (≈ 0.9 s), and drops back with `rate 6`.
- Lit objects get: an additive halo sprite (scale 1.25, opacity 0.48, flicker ±5 %), a floor light pool (2.4 × 2.4 additive disc, opacity 0.28), rising motes, and a one-off ring ripple (§10).
- An empty target pulses softly: ring `glowAmt = 0.35 + 0.15 × sin(1.6 t + col)`.
- Glow colour = mood `glow` mixed 50/50 with the theme accent below (Lentera uses the mood glow as is).

### 7.1 Lentera — stone lantern on a pedestal *(default, fully built in the reference)*

| Part | Geometry (before 1.15 scale) | y | Colour |
|---|---|---|---|
| Foot | Hex cylinder r 0.24 → 0.28, h 0.08 | 0.04 | `#ece2d6` |
| Post | Hex cylinder r 0.085 → 0.11, h 0.20 | 0.18 | `#cdbfb3` |
| Fire-box platform | Hex cylinder r 0.25 → 0.20, h 0.06 | 0.31 | `#ece2d6` |
| Fire-box pillars | 4 × box 0.05 × 0.20 × 0.05 on radius 0.14 at 45° | 0.44 | `#ece2d6` |
| Fire core (glows) | Box 0.17 × 0.16 × 0.17 | 0.44 | `#a99d94` → glow |
| Roof band | Hex cylinder r 0.31 → 0.33, h 0.03 | 0.545 | `#cdbfb3` |
| Roof | Hex cylinder r 0.05 → 0.34, h 0.16 | 0.62 | `#ece2d6` |
| Jewel | Sphere r 0.055 | 0.74 | `#ece2d6` |

**Pedestal (target):** hex cylinder r 0.36 → 0.38, h 0.05 (`goal`), a flat torus ring r 0.22 tube 0.022 at y 0.055, and a centre dot r 0.05. The ring and dot are the glowing parts.

**Push feel:** the lantern starts moving 12 % into the step and arrives at 92 % (smoothstep), then wobbles on a spring (stiffness 90, damping 9, kick −2.2 rad/s along the push).

### 7.2 Cahaya Bintang — fallen star crystal on an altar *(after the Gemini proposal)*

| | Spec |
|---|---|
| Object | Elongated octahedron crystal (`OctahedronGeometry(0.2)` scaled y 1.9), floating 0.12 above a small hex foot (r 0.2, h 0.06), slowly rotating 0.3 rad/s even when unlit. Unlit colour `#d9d4ea`, semi-matte |
| Target | Altar niche: a 0.7-wide U of three short pillars (h 0.32) around a recessed star-shaped inlay (5-point star, r 0.24, flat) |
| Lit effect | Crystal glows; a thin vertical beam (cylinder r 0.03, h 3, additive, opacity 0.25) rises from it and fades upward; nearby wall caps within 1 tile tint 15 % toward the glow |
| Theme accent | `#bfe3ff` (cool) |
| Instrument | Marimba — partials 1 : 3.93 : 9.2, amplitudes 1 : 0.25 : 0.06, decay 1.3 s, mallet click = 6 ms noise burst at 3 kHz |
| Push sound | Glassy ring: bandpass noise 2.4 kHz, Q 6, 0.25 s, very quiet |

### 7.3 Taman Batu — runic monolith in a sand garden *(merged with the Gemini proposal)*

| | Spec |
|---|---|
| Object | Rough monolith: box 0.42 × 0.72 × 0.32, top edges bevelled (scale a `DodecahedronGeometry` or chamfered box), one face carries a rune made of 3 thin inset boxes. Colour `#d8d0c6` |
| Target | Balance point: a flat ring of 8 small pebbles (sphere r 0.04) around a moss disc (cylinder r 0.26, h 0.02, `#b9cfa6`) |
| Floor variant | Inside floor tiles get raked lines: 5 parallel strips per tile, 0.008 tall, colour `floorB`, direction alternating per room |
| Lit effect | Rune glows; the raked lines within 1 tile smoothly curve into concentric rings around the stone (lerp the strip geometry over 1.2 s) |
| Theme accent | `#b8f0c8` (jade) |
| Instrument | Koto pluck — Karplus–Strong or sawtooth through a 2.2 kHz low-pass falling to 600 Hz over 0.4 s, decay 2 s, a 15-cent downward bend at the start |
| Push sound | Heavy stone on sand: brown noise, low-pass 500 Hz, 0.45 s, plus a sand hiss (high-pass 4 kHz, very quiet) |

### 7.4 Candi — stupa stone on a temple terrace

| | Spec |
|---|---|
| Object | Small stupa: square base 0.5 × 0.12 × 0.5, octagonal ring (r 0.24, h 0.08), bell dome (`LatheGeometry`, r 0.24, h 0.34), spire (cone r 0.05, h 0.18). Colour `#cfc8c6` (andesite, warmer in Fajar via the tints) |
| Target | Terrace socket: square stone 0.66 × 0.04 × 0.66 with an inset lotus outline (8 petals of thin torus arcs) |
| Lit effect | Dome glows from within through 8 small diamond windows (emissive boxes 0.04 on the dome); the socket's lotus lights first, the dome 0.3 s later |
| Theme accent | `#ffd08a` (gold) |
| Instrument | Bonang — partials 1 : 2.3 : 3.6, two copies detuned ±3 Hz for the gamelan shimmer, decay 2.4 s. **Uses slendro tuning** instead of the pentatonic table: ratios 1, 1.149, 1.320, 1.516, 1.741 over two octaves from D4 |
| Push sound | Stone on stone: bandpass 280 Hz, Q 2, 0.4 s, plus a 55 Hz thump |

### 7.5 Mata Air — channel plug and the sacred spring *(after the Gemini proposal)*

| | Spec |
|---|---|
| Object | Round stone plug: cylinder r 0.27, h 0.3, with a rounded top (sphere segment) and a carved band. Colour `#d6d9d2` |
| Target | Leak hole: a ring stone (torus r 0.24, tube 0.06) around a dark water disc (`#7fa6b6`, slightly below floor level at y −0.02) |
| Floor variant | Shallow water channels: void cells next to the inside floor show a water plane at y −0.25, colour mixed from `fog` and `#a8d8d6`, with slow procedural ripples (sine displacement in the vertex shader, amplitude 0.01) |
| Lit effect | **Progressive.** Each sealed hole raises the water plane by `0.2 / goalCount` and blooms one lotus (flat 8-petal shape, scale 0 → 1 easeOutBack 0.6 s) at a random void cell. When all are sealed, the water reaches y −0.05 and a small waterfall (additive vertical sheet) appears off one plinth edge |
| Theme accent | `#9fe3e0` (aqua) |
| Instrument | Handpan — partials 1 : 2 : 3, amplitudes 1 : 0.35 : 0.12, soft 15 ms attack, decay 3.5 s, plus a water drip (sine 1.2 kHz → 600 Hz in 60 ms) |
| Push sound | Wet stone: bandpass 450 Hz, Q 1.2, 0.35 s, plus a small splash (noise high-pass 3 kHz, 0.12 s) |

### 7.6 Sound of lighting (all themes)

Each target in a room is given a note in **reading order** (row by row, left to right), climbing the theme's scale. Lighting plays that target's note. Unlighting plays the same note muffled (sine through a 700 Hz low-pass, 0.5 s). Because the scale is pentatonic (or slendro), any lighting order makes music, and each room has its own melody.

Pentatonic table (Lentera, Cahaya Bintang, Taman Batu, Mata Air): D4 293.66, E4 329.63, F♯4 369.99, A4 440.00, B4 493.88, D5 587.33, E5 659.25, F♯5 739.99, A5 880.00, B5 987.77 Hz. Wraps after 10.

---

## 8. The wanderer

### 8.1 Build

Modelled at 1 unit = 1 tile, then drawn at **`WANDERER_SCALE = 1.4`**. Faces +Z in local space.

| Part | Geometry | Position | Colour |
|---|---|---|---|
| Robe | `LatheGeometry`, 28 seg, profile (r, y): (0, .02) (.19, .02) (.20, .06) (.185, .16) (.155, .30) (.125, .43) (.10, .53) (.075, .60) (.045, .635) (0, .645) | origin | `#f5efe6` |
| Sash (front marker) | Box 0.06 × 0.42 × 0.02, tilted x −0.13 | (0, .31, .152) | `#e48f7f` |
| Scarf tail (back) | Box 0.07 × 0.20 × 0.02 hanging from a pivot | pivot (0, .60, −.08) | `#e48f7f` |
| Head | Sphere r 0.112 | head pivot y 0.73 | `#f2e2d2` |
| Eyes | 2 × sphere r 0.014, scale (1, 1.35, 0.6) | (±0.038, 0, 0.104) on head | `#5b4c5e` |
| Caping hat | Cone r 0.19, h 0.09, 32 seg, tipped back x −0.16 | (0, .098, −.014) on head | `#e3ae6f` |
| Hat knob | Sphere r 0.02 | (0, .148, −.022) on head | `#e3ae6f` |
| Arms | Shoulder pivot at (±0.118, 0.54, 0); sleeve cylinder r 0.034 → 0.044, h 0.22 centred 0.11 below; hand sphere r 0.035 at −0.24 | | sleeve `#ebe3d8`, hand `#f2e2d2` |
| Feet | Sphere r 0.045, scale (1, 0.55, 1.5) | (±0.075, 0.025, 0.03) | `#8c7f8f` |
| Contact shadow | Disc 0.75 (§10.1) | y 0.006 | mood `shadow` |

The **two eye dots** are the minimum face needed for the look-around and the complaint to read. Do not add a mouth, nose or expression.

### 8.2 Rig and pose model

The rig is driven by **15 numbers**. Every behaviour produces a target pose; the rig eases towards it with `damp(current, target, rate, dt)` where `damp = lerp(a, b, 1 − e^(−rate·dt))`. Rate is **22 while travelling** and **11 otherwise**. This is why states blend without keyframes — keep it that way.

| Pose key | Drives | Sign convention |
|---|---|---|
| `lean` | body `rotation.x` | + leans forward |
| `bob`, `hop` | body `position.y` | + up |
| `sit` | body y −0.16 × sit, robe wider 12 %, feet hidden | 0 stand … 1 seated |
| `squash` | body scale y = 1 + s, xz = 1 − s/2 | + taller |
| `yawOffset` | added to facing yaw | + turns left |
| `headYaw`, `headPitch`, `headRoll` | head rotation | pitch − looks up |
| `armLPitch`, `armRPitch` | arm `rotation.x` | − swings forward/up (−π/2 = straight ahead, −2.85 = overhead) |
| `armLRoll`, `armRRoll` | arm `rotation.z`, mirrored | + opens outward; `ARM_REST_ROLL = 0.2` is always added so the arms never sink into the robe |
| `stepL`, `stepR` | foot lift (×0.05) and forward slide (×0.1) | + forward |

Facing: `yaw = atan2(dCol, dRow)` of the last move; the shown yaw eases with `dampAngle(rate 12)`. "Face the camera" means `yawOffset = wrap(cameraAzimuth − yaw)`.

The scarf is a damped spring driven by bob, hop and lean (stiffness 60, damping 8), clamped to −0.4…0.6 rad.

### 8.3 States and timings

**Tile travel (seconds per tile):** walk **0.24**, run **0.15** (tap-to-move paths longer than 2 tiles), push **0.42**, undo-rewind **0.20**. Position eases with `easeInOutSine`; pushes with `smoothstep`.

| State | Trigger | Pose (p = progress 0..1 across the tile, s = ±1 alternating per step) |
|---|---|---|
| **Melangkah** (walk) | arrow key / short tap path | lean 0.07, bob 0.028·sin(πp), leading foot steps sin(πp), trailing −0.3·sin(πp), arms swing ∓0.42·sin(πp), roll 0.08, head pitch 0.05 |
| **Berlari** (run) | tap path > 2 tiles | lean 0.20, bob 0.05, steps 1.2 / −0.5, arms ∓0.9·sin − 0.2, roll 0.14, head pitch 0.08 |
| **Mendorong** (push) | moving into a free lantern | two heaves per tile: h = sin(2πp); lean 0.30 + 0.04·|h|, both arms locked at −1.38, roll −0.12, small alternating steps 0.7, squash −0.03, head pitch −0.06 |
| **Berdiri** (idle) | no input | breathing squash ±0.013 at 1.7 rad/s, arms roll 0.06 ± 0.02 |
| **Celingak-celinguk** (look around) | idle ≥ **6 s** | 6.4 s cycle: ease to left (0.7 s), hold to 1.8 s, sweep to right (1.0 s), hold to 3.9 s, back to centre (0.7 s), rest. Head yaw ±1.05, body yawOffset ±0.32, head roll ±0.05 |
| **Meditasi** | idle ≥ **24 s** | sit eases to 1 over 1.2 s, hands to lap (arm pitch −0.62, roll −0.32), head pitch 0.22, slower deeper breath (±0.022 at 1.0 rad/s). Motes rise around them every 0.22 s. Any input stands them up |
| **Gagal dorong** (protest) | pushing a lantern that cannot move, first time in 3.5 s | **2.7 s** timeline below |
| **Angkat bahu** (shrug) | blocked again within 3.5 s | **1.1 s**: 0.3 s strain (lean 0.26, arms −1.35), then arms open (pitch −0.3, roll 0.62) with a head tilt 0.22, peaking at 0.7 s |
| **Bump** | walking into a wall | **0.45 s** nudge: lean 0.12, head pitch 0.1, tiny head shake, squash −0.03 |
| **Membungkuk** (bow) | room solved, 0.65 s after the last light | **2.2 s**: turn to camera (0.45 s), hands together (from 0.3 s: pitch −1.15, roll −0.42), bow lean 0.48 + head 0.3 between 0.75–1.5 s, rise by 2.1 s |
| **Mundur** (undo) | Z / Backspace | rewind travel 0.20 s, lean −0.08, arms roll 0.25, white ripple at the tile left behind |

**Protest timeline (the signature moment):**

| t (s) | Beat | Pose |
|---|---|---|
| 0.00 – 0.90 | Strain — three heaves against the stone | lean 0.24 + 0.12·(heave at 7.2 rad/s) + 1 cm jitter at 46 rad/s; arms −1.42; feet digging (0.35 / −0.2) |
| 0.90 – 1.30 | Give up, turn to the player | yawOffset eases to face camera; lean −0.02; arms drop |
| 1.30 – 2.15 | **Complain** — both hands up | arms −2.85 (overhead), roll 0.12; head pitch −0.18 (looking at the player); small hop 7 cm in the first 0.32 s; head shakes ±0.16 at 13 rad/s from 1.5 s; a three-puff "steam" above the head at 1.35 s; "hmph" sound at 1.32 s |
| 2.15 – 2.70 | Sigh, turn back | head pitch 0.16 easing out, squash −0.04, yawOffset back to 0 |

Any input cancels a performance immediately. **The player is never kept waiting for an animation.**

### 8.4 Scrub checkpoints

These frozen frames are the acceptance test for the character. Compare at `closeUp(5)`, `face(1)`, mood Fajar:

| Call | Must show |
|---|---|
| `scrub('walk', 0.5, 0)` | Mid-stride, one foot forward, opposite arm forward |
| `scrub('run', 0.5, 1)` | Strong lean, wide arm swing |
| `scrub('push', 0.25, 0)` | Leaning into the push, both arms straight ahead |
| `scrub('protest', 0.5)` | Straining forward |
| `scrub('protest', 1.2)` | Turned toward the player, arms down |
| `scrub('protest', 1.75)` | Facing the player, **both hands overhead**, eyes visible |
| `scrub('shrug', 0.7)` | Arms open, head tilted |
| `scrub('look', 1.2)` / `scrub('look', 3.3)` | Head turned clearly left / right |
| `scrub('meditate', 3)` | Seated low, hands in lap, head bowed |
| `scrub('bow', 1.3)` | Facing the player, deep bow, hat toward the camera |

---

## 9. Motion rules

| Rule | Value |
|---|---|
| Default easing | `easeInOutSine` for travel, `smoothstep` for anything that settles, `damp` for anything continuous |
| Overshoot | Only for things appearing (lotus, editor tiles): `easeOutBack` with c = 1.6. Never for camera or UI |
| Input buffering | One move may be queued while a step is in flight. Undo during a step is queued and runs as soon as the step lands. |
| Camera | Never shakes. Never zooms during play. Rotation is the only camera move the player triggers |
| UI transitions | Opacity and colour only, 0.4–1.6 s. No sliding panels in play, no bounce |
| Reduced motion (`prefers-reduced-motion`, game only — not in the reference) | Camera rotation snaps, petals and motes off, protest shortened to the 1.3–2.15 s beat |

---

## 10. Effects

All effect textures are generated on a canvas at load (`softDisc`: radial gradient white → 45 % at 0.45 → transparent).

| # | Effect | Spec |
|---|---|---|
| 10.1 | Contact shadow | Horizontal disc (wanderer 0.75, lantern 0.9), soft-disc texture, colour = mood `shadow`, opacity 0.32, y 0.006, `depthWrite false`. Shrinks with hop, widens 25 % when seated |
| 10.2 | Halo | Additive sprite at the glowing part, scale 1.25 (+0.9 flash on lighting, decays 1.4/s), opacity 0.48 × flicker. Flicker = 1 + 0.03·sin(7.3 t) + 0.02·sin(13.1 t), phase per object |
| 10.3 | Light pool | Additive floor disc 2.4 × 2.4 at y 0.012, opacity 0.28 × lit |
| 10.4 | Motes | Shared pool of 140 points, size 7 px, additive, mood glow. Rise 0.18–0.40 u/s with a 0.05 sideways sway, live 2–3.6 s. One spawns every 0.22 s from a random lit object; 10 at once when an object lights; 6 per object at the finale |
| 10.5 | Ripple | Flat ring (inner 0.42, outer 0.47), scales 1 → 1 + size over its life, opacity 0.55 → 0. Lighting: size 2.2, 1.1 s, glow colour. Tap target: 0.8, 0.5 s, white. Undo: 1.2, 0.5 s, white. Restart: 3, 0.9 s |
| 10.6 | Steam puff | 3 white soft sprites above the head, staggered 0.09 s, rise 0.5–0.7 u/s, scale 0.12 → 0.40, opacity sin-shaped over 0.8 s |
| 10.7 | Petals | 160 instanced 6-sided discs r 0.075 (scaled y 0.62), `#f6b8c4`, falling 0.5–0.95 u/s with sine drift and tumble, looping from y 4–10 down to −1.5. Finale only |
| 10.8 | Clouds | 16 sprites, canvas-generated (9 overlapping soft blobs each), 6–13 wide, aspect 0.42. Two-thirds sit below the island (y −2.4 … −5.4), one-third at the horizon (y −0.8 … −2). Orbit the island very slowly. Tinted with mood `cloud` |
| 10.9 | Hover tile | 0.92 square at y 0.008, mood glow, opacity 0.22 ± 0.05 pulsing at 3 rad/s. Shown only on walkable tiles |

**Do not add** far background towers or structures behind the island: in an isometric view anything far behind lands at the top edge of the screen and looks cropped. Depth comes from clouds and mist only.

---

## 10b. Life in the room

Four things make a room feel inhabited. All of them are decoration: none of them changes the rules, blocks input, or can be pushed.

### 10b.1 Water — ponds, basins and fountains

Inner walls are grouped into 4-connected components. Each component becomes one feature by size:

| Component size | Feature |
|---|---|
| 1–2 cells | **Tsukubai** (stone basin) |
| 3–5 cells | **Koi pond** |
| ≥ 6 cells, or containing a 2 × 2 block | **Koi pond with a fountain** |

**Koi pond**

| Part | Spec |
|---|---|
| Bottom | Box 1 × 0.1 × 1 per cell, top at y −0.10, colour `water × 0.72` |
| Rim | On every cell edge not shared with the same pond: box 1.04 long × 0.12 thick, from y −0.06 up to **0.22**, offset 0.46 from the cell centre, role `cap`. Low enough to see over, clear enough to read as a boundary |
| Surface | Plane at **y 0.10**, water shader, opacity 0.58, `depthWrite false`, renderOrder 2 |
| Water shader | Base mood `water`; slow depth variation `0.94 + 0.08 × (0.5 + 0.5·sin(2.1x + 1.7z + 0.2t))`; glints where `sin(11x + 0.9t)·sin(9z − 0.7t) + 0.45·sin(17(x − z) + 1.5t)` exceeds 1.02 (smoothstep to 1.3), mixed toward the `top` tint by up to 0.5 |
| Lily pads | `min(3, size − 2)` per pond: circle r 0.08–0.13 with a 0.4 rad notch, `#a9c99b`, at y 0.106, turning 0.03 rad/s. The first carries a bloom (sphere r 0.035, squashed 0.7, `#f5c2cf`) |
| Koi count | `clamp(floor(size / 2) + 1, 2, 5)` |

**Koi**

| | Spec |
|---|---|
| Body | Sphere scaled (0.045, 0.026, 0.12) in the base colour, with a patch (0.036, 0.02, 0.05) on the back. Whole fish scaled **1.3** |
| Tail | Flattened 4-sided cone r 0.05, h 0.09, wagging ±0.55 rad at `6 + speed × 14` rad/s |
| Palettes (base / patch) | `#f5873f / #fbf5ec`, `#fbf5ec / #ec6240`, `#f3a52f / #fbf5ec`, `#fbf5ec / #3d3743`, `#ee6e4a / #f3a52f` |
| Swimming | Depth y 0.065. Speed 0.18–0.32 u/s. Steers toward a random point in the pond (`dampAngle` rate 1.4); picks a new one within 0.12 of it, or whenever the next step would leave the water (0.34 from any edge that has no water beyond it, 0.3 from a fountain) |
| Surface kiss | Every 4–11 s: a white ripple (base 0.22, size 1.2, 1.0 s) just ahead of the fish |

**Fountain** — at the shared corner of the first 2 × 2 block, else the middle cell.

| | Spec |
|---|---|
| Stone | Base cylinder r 0.20 → 0.24, h 0.24 at y 0; column r 0.055 → 0.075, h 0.2 at y 0.22; bowl r 0.16 → 0.09, h 0.06 at y 0.35; ball r 0.04 at y 0.40. Role `cap` |
| Jet | 110 pooled points, 130 spawned per second from y 0.43; up 0.95–1.25 u/s, outward 0.2–0.42 u/s, gravity −3.4; die at the surface. Size 6 px, white, opacity 0.95, soft-disc texture |
| Splash | A ripple every 0.35 s at radius 0.28–0.38 (base 0.14, size 1.4, 0.7 s) |

**Tsukubai**

| | Spec |
|---|---|
| Plinth | Box 0.98 × 0.16 × 0.98 per cell, top at y 0.12, moss `#c7cfb6` |
| Basin | Cylinder r 0.21 → 0.24, h 0.17 at y 0.205, `#ddd3c7`; water disc r 0.16 at y 0.292, opacity 0.9 |
| Bamboo | Post r 0.022, h 0.34 at (−0.32, 0.29, −0.1); spout r 0.018, l 0.3, tilted z −1.25 at (−0.2, 0.43, −0.1); `#b9c98f` |
| Drip | One drop every 1.8 s: appears at 55 %, falls from the spout tip in the last 25 %, then a ripple (base 0.12, size 1.6, 0.9 s) and a drip sound |
| Second cell | Two rocks (dodecahedra r 0.15 and 0.09, squashed to 0.7 / 0.6) |

### 10b.2 The torii gate — arriving and leaving

**Placement.** Breadth-first distances are measured from the start tile through the inside floor. For every outer wall cell with an inside neighbour on one side and void on the opposite side, count how many void cells continue outward (up to 3 = the stepping stones). Score = `distance × 10 − stones × 3 − (2 if it faces the default camera)`. The lowest score wins.

**Build** (local +z points outward):

| Part | Spec | Colour |
|---|---|---|
| Threshold | Box 1 × 0.06 × 1, top at y 0 | role `cap` |
| Pillar feet | Cylinder r 0.10 → 0.11, h 0.09, at x ±0.4 | `#4d4552` |
| Pillars | Cylinder r 0.052 → 0.06, h 1.06, centred y 0.53, at x ±0.4 | vermilion `#e88f78` |
| Nuki | Box 1.0 × 0.05 × 0.08 at y 0.82 | vermilion |
| Gakuzuka | Box 0.06 × 0.14 × 0.06 at y 0.92 | vermilion |
| Shimaki | Box 1.16 × 0.05 × 0.12 at y 1.015 | vermilion |
| Kasagi | Box 1.12 × 0.07 × 0.15 at y 1.07, plus two end pieces 0.16 long at x ±0.62, y 1.09, turned up 0.28 rad | `#4d4552` |
| Bar | Hinged at (−0.4, 0.36): beam 0.78 × 0.055 × 0.055 `#e6d3b8`, vermilion end cap, dark hinge drum. Closed = 0 rad, open = **1.05 rad** (raised like a crossing boom), eased with `damp(rate 4.2)` | |
| Stepping stones | Up to 3, at 1, 2, 3 tiles outward, 9-sided, radius 0.30 → 0.18, alternately ±0.05 off-centre, bobbing ±0.02 at 0.9 rad/s | role `cap` |

**Arrival (every new room):**
1. The wanderer appears on the farthest stone, invisible, facing the gate; fades in (opacity `damp` rate 3.2).
2. 0.8 s pause, then strolls stone by stone toward the gate (**0.36 s per tile**).
3. The bar lifts (wooden creak), 0.6 s pause.
4. Through the gate cell, onto the inside tile, then along the shortest free path to the start tile.
5. The bar drops (creak, then a soft knock at 150 Hz as it lands). Play begins.

Any move key, Space or a tap during the arrival skips straight to step 5. Restarting a room (R) skips the arrival entirely.

**Departure (after the bow):** 2.95 s after the last light, the bar lifts, the wanderer walks the shortest free path to the gate, through it and onto the first stone; the bar drops behind them; they cross the remaining stones, fading out on the last; 0.7 s later the "Semua lentera menyala" overlay appears. If no free path to the gate exists, the overlay appears at 2.3 s as before.

### 10b.3 The stranger — a figure in black on the edge

**Seat.** Any outer wall cell in a straight run (wall on both sides along one axis) with void on one side, at least 3 tiles from the gate. Seats facing the default camera (+x or +z outward) are preferred so the stranger is visible; pick at random among the best three. Position: cap top (y 0.48), 0.28 from the cell centre toward the void. Faces outward.

| Part | Spec | Colour |
|---|---|---|
| Torso | Lathe (seated): (0, 0) (.16, 0) (.165, .05) (.15, .17) (.12, .29) (.09, .37) (.05, .41) (0, .42), set back 0.05 | `#2c2834` |
| Face | Sphere r 0.095 at head pivot (0, 0.5, −0.04) | `#1f1c25` |
| Hood | Sphere r 0.122, open 1.7 rad at the front, down to 0.82 π, double-sided; a soft point (cone r 0.06, h 0.13) falling back at (0, .075, −.115), tilted −1.15 | `#2c2834` |
| Eyes | Two spheres r 0.013, scale (1, 1.3, 0.6), at (±0.033, 0.006, 0.088) | `#f4ede2`, glow 0.7 |
| Arms | Leaning back on the hands: shoulders (±0.1, 0.35, −0.04), pitch 0.32, roll 0.32 | robe, hands `#1f1c25` |
| Legs | Thigh (r 0.04, l 0.24) lying forward on the stone; shin (r 0.038, l 0.22) hanging over the edge from the knee at z 0.24; boot 0.06 × 0.04 × 0.1 | robe, boots `#46404e` |
| Scale | Same as the wanderer (1.4) | |

The colours read as black against pastel without being `#000` (§14).

**Behaviour**

| What | How |
|---|---|
| Legs | Lazy kicking: knees `0.3·sin(1.6 t)` and `0.3·sin(1.6 t + 2.3)` |
| Breathing | Body scale y `1 + 0.01·sin(1.3 t)` |
| Looking about | Every 1.8–4.4 s a new glance: head yaw within ±1.25, pitch −0.22 … 0.18. 30 % of glances are at the wanderer instead, held 2–3.5 s |
| Following the wanderer | Yaw toward the wanderer, clamped ±1.9 rad; the torso takes 32 % of it (max ±0.55), the head the rest. Head eases at rate 5, torso at 3 — deliberate, not snappy |
| When the wanderer protests | Looks at them for 3.2 s and chuckles: a 0.9 s shoulder bounce `|sin(22 t)| × 0.012` |
| When a room is solved | Looks at the wanderer for 5 s and nods (head pitch `max(0, sin(4 t)) × 0.3` for 1.6 s) |

The stranger never speaks, never moves from the seat, and has no name in the UI. Keep them a mystery.

### 10b.4 Crows

Ordinary crows — **not** crow-people. One or two per room (50 / 50).

| Part | Spec | Colour |
|---|---|---|
| Body | Sphere scaled (0.072, 0.068, 0.13) at y 0.11 | `#3c3745` |
| Head | Sphere r 0.054 at (0, 0.165, 0.1); beak cone r 0.017, l 0.07 forward | ink, beak `#5d5565` |
| Eyes | Spheres r 0.009 at (±0.034, 0.016, 0.036) | `#f1e7d8` |
| Tail | Box 0.075 × 0.012 × 0.12 at (0, 0.12, −0.16), tilted −0.25 | ink |
| Wings | From shoulders at (±0.055, 0.14, 0): inner panel 0.18 × 0.012 × 0.1 and tip 0.1 × 0.01 × 0.07 | ink |
| Legs | Cylinders r 0.007, l 0.09 | beak colour |
| Scale | **1.3** | |

**Perches:** finial tops (y 0.78), both upturned ends of the torii kasagi, one point on each pond rim (y 0.23), and every fifth outer wall cap (y 0.48). A perch holds one crow. A crow only picks perches more than 2.6 tiles from the wanderer.

| State | Behaviour |
|---|---|
| Away | Hidden. After 1.5–5 s (staggered 3.5 s between crows) arrives from a point 16 units out and 4–6 up |
| Flying | Quadratic Bézier from start to perch, control point at the midpoint lifted `1.2 + 0.18 × distance`. Duration `clamp(distance / 3, 1.4, 4.5)` s. Wings flap `0.95·sin(24 t) + 0.15` while climbing (first 30 %) and landing (last 28 %), glide at `0.18 + 0.1·sin(5 t)` between. Body pitches with the climb (±0.5). Legs show for the last 15 %. A wing-flutter sound on take-off |
| Perched | Wings swept back along the flanks (y 1.45 rad, slight droop, shortened to 72 %). Quick bird head-turns (new target ±1.1 rad about once a second, eased at rate 28), an occasional peck (0.3 s, head down 0.9 rad), an occasional hop (0.25 s, 5 cm, turning up to ±0.7 rad) |
| Leaving | When the wanderer comes within **1.6 tiles**, or after 9–23 s: 60 % fly to another free perch, 40 % fly away and return later (4–12 s) |

---

## 11. Audio direction

Everything is synthesised. The mix is quiet — this is a game to play at night with headphones.

| Layer | Recipe | Level |
|---|---|---|
| Hall reverb | Convolver with a generated stereo noise impulse, 3.4 s, decay exponent 2.6. Wet 0.34, dry 0.8 | — |
| Drone | Sines at 73.42 and 73.9 Hz (slow beating), triangle 110 Hz, sine 146.83 Hz → low-pass 420 Hz swept ±160 Hz by a 0.06 Hz LFO. Fades in over 6 s | 0.05 |
| Wind | Brown noise → band-pass 520 Hz, Q 0.6, gain wobbling 0.018 ± 0.012 at 0.09 Hz | 0.018 |
| Footstep | Noise burst, low-pass 1.1–1.4 kHz (random), 70 ms | 0.07 |
| Push | Band-passed brown noise 360 Hz, Q 1.8, 0.38 s, plus a 64 Hz thump at 0.3 s | 0.16 |
| Wall bump | Sine 110 → 66 Hz, 0.22 s | 0.05 |
| Protest | Two thumps (70 Hz) at 0.15 and 0.5 s, then "hmph": two triangle chirps 430 → 300 Hz and 340 → 240 Hz, 0.14 s each, 0.16 s apart, low-passed at 1.4 kHz | 0.06 |
| Undo | High-passed noise whoosh 2.2 kHz, 0.18 s | 0.03 |
| Gate bar | Creak: brown noise band-passed 520 Hz, Q 6, 0.45 s, half speed. Landing knock: sine 150 → 90 Hz | 0.05 / 0.06 |
| Basin drip | Sine 1.3 kHz → 620 Hz in 60 ms, 0.12 s | 0.035 |
| Crow take-off | Noise band-passed 1.7 kHz, Q 0.7, amplitude-modulated at 17 Hz, 0.7 s decay | 0.025 |
| Lighting | Theme instrument at the target's note (§7.6). Lentera: wind-chime partials 1 : 2.0 : 2.76 : 4.07 : 5.4, amplitudes 1 : .32 : .22 : .10 : .05, 6 ms attack, decay 3.2 s / √ratio, ±0.1 % random detune per partial | 0.16 |
| Finale | Temple bell on D3 (146.83 Hz): partials 0.5 : 1 : 2.42 : 3.9 : 5.4, decay up to 6.5 s; then every lit note rolled upward 90 ms apart, starting 0.35 s in | 0.14 / 0.10 |

Audio starts on the first gesture (the "ketuk untuk mulai" veil). `M` toggles sound with a 0.2 s fade.

---

## 12. Typography and UI

### 12.1 Type

| Use | Font | Weight / style | Size | Tracking |
|---|---|---|---|---|
| Title "Hening" (start veil) | Cormorant Garamond | 300 italic | clamp(72px, 13vw, 156px) | 0.01em |
| Wordmark (HUD) | Cormorant Garamond | 300 italic | 34 px (26 px mobile) | 0.02em |
| Overlay headline ("Semua lentera menyala") | Cormorant Garamond | 300 italic | clamp(40px, 6vw, 72px) | 0 |
| Numbers (counters, timers) | Cormorant Garamond | 400, lining tabular figures | 22 px (18 px mobile) | 0 |
| Labels, place line, hints | Jost | 400, UPPERCASE | 11–12 px | 0.18–0.42em |

Fallbacks: `"Iowan Old Style", Georgia, serif` and `"Avenir Next", "Segoe UI", system-ui, sans-serif`. The game ships the two Google fonts locally (WOFF2 in the repo) so it works offline.

All player-facing copy is **Indonesian**, lower-case where the reference uses it. No exclamation marks, no emoji.

### 12.2 HUD layout

| Element | Desktop | Mobile (< 720 px) |
|---|---|---|
| Wordmark + place ("LANTAI I · RUANG 06") | top-left, 32 / 28 px | top-left, 18 px |
| Tool buttons (undo, restart, rotate, mood\*, sound) | top-right row, 42 px circles, 10 px gap | bottom centre above counters, 44 px circles |
| Counters (langkah · dorongan · lentera) | bottom centre, 30 px from bottom | same, 22 px + safe area |
| Hint line | bottom centre, 74 px | hidden |
| Dupa timer (Timer mode) | bottom-right, see §13.7 | top-right |

\*The mood button exists only in the reference. In the game, mood follows §5.3.

**Glass buttons:** background `rgba(255,255,255,.34)`, 1 px border `rgba(255,255,255,.55)`, `backdrop-filter: blur(8px)`, icon stroke 1.4 px, round caps, 18 px icons drawn as inline SVG. Hover lifts 2 px. Ink follows the mood.

**Overlay text** always sits on the mood `veil`: `radial-gradient(ellipse 46% 30% at 50% 50%, veil, transparent)`. Never put text straight on the board.

---

## 13. Screens beyond the room

Every screen is built from the same kit, shader, moods and wanderer. No screen is a flat 2D menu.

### 13.1 Title

- Mood Fajar. Camera at `zoom 0.45` showing the whole **Menara Hening** — the stack of floating stones (§13.2) — from the courtyard stone to the capstone, lost in cloud. Rims of floors already solved glow.
- The wanderer sits in meditation on the courtyard stone, in front of the gate. Far above, on the capstone's edge, the figure in black sits small against the sky.
- "Hening" in the title style over the sky, "ketuk untuk mulai" breathing (opacity 0.45 ↔ 1, 3.6 s).
- On the first gesture: audio starts, the veil fades over 1.4 s, the wanderer stands (sit 1 → 0), and the camera eases down and in to the courtyard over 2.4 s.

### 13.2 Menara Hening — the floating stones (Batu Bertumpuk)

*Decision 2026-11-03 (owner + architect), replacing the square tower of v1.1: the tower read as a building. It is now a cairn of river stones balanced in the sky, except that nothing touches.*

Seven stones, bottom to top, all on one vertical axis (the **axis**), with open sky between them. No walls, arches, pillars, bands or dome anywhere.

| Stone | Outer radius | Opening | Top surface at y | Holds |
|---|---|---|---|---|
| Courtyard stone (Halaman) | 5.0 | recess r 1.2, 0.15 deep, where the platform rests | 0 | the five places (§13.3) |
| Lantai I | 4.4 | r 1.45 | 2.4 | rooms 1–10 |
| Lantai II | 4.0 | r 1.45 | 4.8 | rooms 11–20 |
| Lantai III | 3.6 | r 1.45 | 7.2 | rooms 21–30 |
| Lantai IV | 3.2 | r 1.45 | 9.6 | rooms 31–40 |
| Lantai V | 2.8 | r 1.3 (offset 0.3, see *Balance*) | 12.0 | rooms 41–50 |
| Capstone | 1.4 | none | 14.4 | the last light and the stranger (§13.12) |

**Profile** (one `LatheGeometry` per stone, 40 radial segments, flat-shaded so the pastel shader's three tones fall softly across the facets, like the lantern's hex faces):

- **Top:** flat and walkable from the opening's lip to `R − 0.25`. Role `floor`, no checker; instead four thin raked rings (strips 0.006 tall, `floorB`) at even radii between the lip and the rim, the zen-garden version of the room's tiles.
- **Rim:** a rounded, worn edge, a quarter-ellipse 0.45 out and 0.5 down, so the stone seen from the side is a lens, not a disc. Role `cap`.
- **Underside:** a soft dome rising from the rim's bottom (y −1.0 at `R − 0.4`) to the opening (y −0.6 at the inner edge), roles `stone` then `plinth`, with the plinth's fade to the mood `fog` toward the middle of the underside — every stone fades into the cloud below it, the way a room's plinth does.
- **Opening:** a vertical wall with a 0.06 rounded lip, role `cap`. The courtyard stone has a shallow recess instead of a hole; below it, the room's three plinth tiers continue into cloud exactly as now.
- **Capstone:** the same profile without an opening, thickness 0.7.

**Balance.** Each floor stone sits 0.42 off the axis, the offset direction turning 36° per floor (Lantai I at 0°, II at 36°…). The offset is measured from the axis, never added up, so every opening still clears the platform (1.45 − 0.42 = 1.03 > 0.8) and the platform rises straight. Lantai V, the smallest stone, uses opening 1.3 and offset 0.3 (clearance 1.0) so its niches are not crowded. *(0.22 / r 1.2 in the first build; raised 2026-11-03 so the lean is visible.)* Seen from the courtyard, the stack leans a little this way and that, and sky shows through the openings. The capstone sits **beside** the axis, its centre 2.3 from it toward 180° (screen-back at the default camera), so the platform can rise next to it (§13.12).

**Breathing.** Each stone bobs ±0.025 over 8 s and tilts ±0.4°, phase 0.7 s × floor; the capstone half as much. Off with reduced motion. The wanderer and everything on a stone move with it.

**Rim of light.** A floor with all ten rooms solved gets a thin glowing ring along its rim (torus, tube 0.03, just under the rim's widest point, glow role at `glowAmt 0.6` in the mood glow). From the courtyard and the title it reads as a lit ring floating in the stack; five rings = the tower complete.

**Life.** Crows perch on niche back stones, rim finials and the capstone (§10b.4). Clouds pass between the stones, never through the openings.

### 13.3 Lobby — the courtyard (Halaman)

The courtyard stone's top (§13.2) on a 9 × 9 walk grid centred on the axis. Walkable: cells whose centre lies within 4.2 of the axis, except the opening (the centre cell and its four neighbours, where the platform rests). The grid is not drawn; the hover tile is the room's. The wanderer walks; there is no menu.

Cells are `(r, c)`, rows back to front, columns left to right at the default camera; the activation tile is the cell in front of each place.

| Place | Where | Build | Does |
|---|---|---|---|
| **Gerbang Menara** | the opening's front lip; activation (6, 4) | the torii of the rooms (§10b.2) at 1.2 × its room size, its passage leading onto the platform | Mode choice, then the platform rides up |
| **Batu Catatan** | (2, 1) | upright stele (box 0.5 × 1.0 × 0.16) with engraved lines (thin inset boxes), one more line per lit floor | Records |
| **Paviliun Taman** | (1, 6)–(2, 7) | small open pavilion: 4 posts, hex roof like the lantern's but 2.2 wide | Taman Sendiri |
| **Kolam** | (6, 6)–(7, 7) | pond: 2 × 2 water plane at y −0.05 in a stone rim, one lotus, two koi | Preferences |
| **Jalan Setapak** | off the west rim at (5, 0) | five stepping stones descending into the cloud, each floating free, smaller as they go | Leave (to the title) |

- Walking onto a place's activation tile shows its name in a small serif caption above it (fade 0.3 s). Enter (or a second tap) uses it. `1`–`5` walk there automatically.
- The figure in black is **not** in the courtyard: he sits on the capstone, visible far above. One or two crows use the courtyard's perches (the stele, the torii, the pavilion roof).
- Idle in the courtyard for 20 s starts the dream (§13.9).

### 13.4 Elevator — platform batu

- The round stone platform (cylinder r 0.8, h 0.15, `cap` top, `stone` side) rests in the courtyard stone's recess and rises **along the axis, through the openings**.
- 3.2 s per floor, `easeInOutSine`. The camera rises with it, keeping the platform at screen centre; the stones pass around it like rings.
- **The stones settle.** As the platform passes through a stone, that stone acknowledges it: it turns 4° about the axis and dips 3 cm, then returns over 1.6 s with a soft overshoot, and a quiet stone knock sounds (bandpass noise 180 Hz, Q 3, 0.2 s, plus a 70 Hz thump at a third of the level). This replaces v1.1's rotating arch bands and sliding stairs. **Purely visual** — nothing here affects play.
- Arrival: the platform stops level with the floor's top with a 2 cm overshoot (spring), a low bell (D3, quiet). Going down is the same ride reversed. Any key skips to the arrival.

### 13.5 Floor = chapter selection

- The camera orbits the axis in steps of 36° (`←`/`→`), 0.6 s per step, so one room **niche** faces the player at a time. The floor stone's lean and breathing stay; the orbit is around the axis, not the stone's centre.
- The ten niches stand on the rim at 36° intervals, starting at the default camera's front. Each niche, from the rim inward:

| Part | Where (from the stone's outer radius `R`) | Build |
|---|---|---|
| Target | `R − 0.45` | the theme's target, as in rooms |
| Theme object | `R − 0.9` | the theme's object, as in rooms |
| Back stone | `R − 1.3` | a curved slab, 14° of arc, thickness 0.16, height 0.3 with a rounded top, role `cap`; it catches the object's glow when lit, and leaves the rim open so sky and the next stone show between niches |

- Between niches, low cap stones on the rim with a finial every 36° (offset 18° from the niches), like a room's wall caps.
- The wanderer walks along the rim to stand on the current niche's target.

| Niche state | Look |
|---|---|
| Locked | A low upright slab (`wall`, rounded top, h 0.5) stands where the object would be; no object, no target ring |
| Open, unsolved | Slab gone, object unlit, the target ring pulsing softly |
| Solved | Object lit (halo, pool, motes) — the stone gets brighter as rooms are solved |
| Current | Lit hover tile on the target; place line "LANTAI II · RUANG 14"; the caption with the best moves and pushes if solved |

- Rooms open in order. A solved floor lights its **rim of light** (§13.2).
- The mood of a floor stone = the mood of its next unsolved room (§5.3); a fully solved floor shows Malam with every niche lit.

### 13.6 Room

Exactly the reference scene. Entering a room: the niche's object rises, the screen cross-fades (0.8 s) to the room, and the wanderer arrives over the stepping stones and through the torii gate (§10b.2).

### 13.7 Dupa — the incense timer (Timer mode)

- A vertical incense stick in the HUD: 2 px line, 120 px tall, colour `ink` at 60 %.
- The burning tip is a 6 px glow dot (mood glow) with a soft halo; a thin smoke curl (SVG path, 1 px, `inkSoft`) rises from it, its curve drifting slowly (8 s loop).
- The stick shortens linearly with time. At 25 / 50 / 75 % a 6 px ash flake drops off and fades.
- Under the stick: remaining time in Cormorant numerals, 18 px ("12:40").
- Last 60 s: the ember pulses at 1 Hz. **No red, no shaking, no ticking.**
- Time out: the ember goes dark, the smoke rises and thins over 2 s, a soft bell; overlay "dupa telah padam" on the veil, with "ulangi" / "kembali ke menara".
- In "Tanpa Batas" mode the stick is not shown.

### 13.8 Pause

- Canvas gets `filter: saturate(0.6) brightness(1.04)` over 0.6 s.
- The wanderer sits (meditation pose blends in).
- Centre overlay on the veil: "jeda" headline, then "lanjutkan · ulangi ruang · kembali ke menara · suara" as Jost uppercase items, 2.4 s breathing on the selected item.

### 13.9 Mimpi — demo tour

- Plays a stored solution of a room while the player watches.
- A **dream wanderer** performs it: same rig, every material at opacity 0.45 and colour mixed 50 % toward `#d8d4ff`, rendered with `depthWrite false`, leaving a trail of motes (1 per step).
- A soft vignette (CSS radial gradient to the mood veil at the edges) and the caption "mimpi" in Jost uppercase, top centre.
- Any input ends the dream (fade 0.8 s) and returns to where the player was.

### 13.10 Editor — Taman Sendiri

- Mood Siang. Same iso camera, plus a 1 px grid of lines on the floor plane (`ink` at 12 %).
- A palette of glass buttons on the left: lantai, dinding, objek, target, awal (start), hapus. Selected = filled white.
- Placing a piece pops it in (scale 0 → 1, `easeOutBack`, 0.25 s) with a soft wooden tick. Removing shrinks it (0.15 s).
- The plinth regenerates live as the footprint changes (debounced 200 ms).
- "Coba" plays the room from the editor; returning restores the editor exactly.

### 13.11 Room solved

As in the reference: last light, 0.65 s pause, bow + finale sound + petals, the stranger nods, the wanderer leaves through the gate (§10b.2), then the overlay: "Semua lentera menyala" (theme-specific wording: "Semua kristal bercahaya", "Taman telah seimbang", "Semua stupa bersinar", "Mata air telah pulih"), stats line, "Enter · ruang berikutnya".

### 13.12 Ending — the capstone

- After room 50, **naik**: the platform rises past Lantai V along the axis and stops level with the capstone's top, beside it (the capstone sits 2.3 off the axis, §13.2; the gap is 0.1).
- The wanderer steps across onto the capstone. The current theme's object stands alone at its centre, unlit; as the wanderer passes it, it lights (the full lit effect and the theme's root note an octave down).
- The wanderer walks to the capstone's edge and sits beside the figure in black, legs over the edge (§10b.3). The figure turns its head toward the wanderer.
- The camera pulls slowly back (6 s) until the whole stack is in frame: five rims of light, every niche lit, the capstone's one light at the top. Hold 6 s.
- Slow fade to the Fajar sky, the word "Hening", then the courtyard. Skippable at any point.

---

## 14. Never

- Never use image files, sprite sheets, icon fonts or sampled audio.
- Never use black (`#000`) or pure grey anywhere, including shadows. Shadows are mood-tinted.
- Never outline geometry. Never use a Three.js built-in light or `MeshStandardMaterial` for the world.
- Never put UI text directly over the board without the veil.
- Never shake the camera, flash the screen, or use red as a warning colour.
- Never block input to finish an animation.
- Never raise walls above the cap height in §6.
- Never place structures far behind the island (§10).
- Never copy characters, buildings, palettes or level layouts from Monument Valley. In particular: no crow-people — our crows are birds.
- Never let decoration (koi, crows, the stranger, the gate) block, delay or change a move.

---

## 15. Acceptance checklist

A build passes art review when all of these hold, judged by screenshots at 1440 × 900 and 390 × 844 (DPR 2). Every screenshot lives in `review/` only (`ARCHITECTURE.md` §13); the reference frames to compare against are in `review/reference/`:

- [ ] Ruang 06 in each of the four moods matches the reference within visible tolerance (palette, framing, tile proportions, plinth fade).
- [ ] Rotating the view (`E` ×4) keeps lighting consistent: screen-left faces always take the `left` tint.
- [ ] Every checkpoint in §8.4 matches the reference pose.
- [ ] The protest plays fully when blocked once, a shrug when blocked again within 3.5 s, and any key cancels either instantly.
- [ ] A lantern lights with halo, pool, ripple, motes and its own note; moving it off dims it with the muffled note.
- [ ] The finale: bow, bell, rolled chord, petals, veiled overlay.
- [ ] Phone layout: canvas fills the screen, tools sit at the bottom, nothing overlaps.
- [ ] No console errors. 60 fps on a mid laptop in Ruang 06 with all lanterns lit.
- [ ] Zero raster assets in the build output (fonts excepted).
- [ ] Inner walls render as basins, ponds or ponds with a fountain by the size rule in §10b.1; koi stay inside the water.
- [ ] Every new room starts with the walk in through the torii; any key skips it; R restarts without it.
- [ ] After a solve, the wanderer bows, walks out through the gate and fades on the last stone before the overlay.
- [ ] The stranger sits on a visible ledge, legs over the edge, glances about, watches the wanderer when they protest and nods at the end.
- [ ] One or two crows arrive, perch, look about, and leave when the wanderer comes within 1.6 tiles.
