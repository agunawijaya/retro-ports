# Prompt 01 — the interface between the room's look and its glue

Opus builds the look (the modules below); engineer builds the glue
(`screens/room.js`, `ui/input.js`, `dev/qa.js`, `main.js`) against exactly
this. **Names and signatures follow `reference/index.html`** wherever the
reference has them; reading the reference's sections 14–18 shows how each is
used. Coordinates: `x = cellX(c)`, `z = cellZ(r)`; floor top at `y = 0`.
A level is `core/level.js`'s: `{ rows, cols, wall, inside, start, targets, objects }`
(targets in reading order, each with `index`).

If the glue needs something not listed here, it asks; nothing is invented on
either side.

## Pembagian kerja

- **Opus:** implements every module in this file.
- **engineer:** implements the glue against it (`briefs/01-room-glue.md`).
- **qa-scout / Agy:** nothing here.

## `render/math.js` (reference §3)

`clamp`, `lerp`, `smooth`, `easeInOutSine`, `damp(current, target, rate, dt)`,
`wrapAngle`, `dampAngle`, `mulberry32(seed) → () => [0, 1)`.

## `render/board.js`

| Export | |
|---|---|
| `board` | `{ rows, cols }` of the room on screen (set by `createRoomWorld`) |
| `cellX(c)`, `cellZ(r)` | world x / z of a cell centre |

## `render/camera.js` (reference §7, §15)

| Export | |
|---|---|
| `view` | `{ zoom, step, azimuth, targetAzimuth, halfHeight, target: THREE.Vector3 }` |
| `fitCamera()` | re-frames the room for the window size and `view` |
| `rotateView(delta)` | ±1: turns the view 90° (the camera eases there inside `world.update`) |
| `screenToGrid(screenDir)` | 0..3 (up, right, down, left on screen) → `[dr, dc]`, accounting for `view.step` |

## `render/moods.js` (reference §1, §8)

| Export | |
|---|---|
| `MOODS` | the four moods |
| `moodState` | `{ index, live }`; `live.glow`, `live.shadow` … are `THREE.Color` |
| `setMood(i, instant = false)` | mood `0..3` (2.4 s cross-fade unless `instant`) |
| `setMoodPosition(pos, instant = false)` | fractional `0..3` per `ART-DIRECTION.md` §5.3 (1.33 = 67 % Siang + 33 % Senja) |

## `audio/sound.js` (reference §6)

`sound` — the reference's `Sound` instance, same methods: `start()`, `ctx`,
`enabled`, `ready`, `toggle() → on`, `step()`, `scrape()`, `thump(freq, level, when)`,
`hmph(when)`, `rewind()`, `chime(freq, when = 0, level = 0.16)`,
`unchime(freq)`, `finale(freqs)`, `drip()`, `creak()`, `flutter()`. Plus
`setTheme(theme)`: `chime` / `unchime` then play the theme's instrument.

## `themes/index.js` (ARCHITECTURE §7.2)

`getTheme(id = 'lentera')`, `registerTheme(def)`, `notesFor(theme) → number[]`
(the theme's scale; Lentera: the pentatonic table, wrapping after 10). A theme:
`{ id, name, counterLabel, solvedLine, createObject(), createTarget(),
instrument, pushSound(sound) }`. Lentera: `counterLabel: 'lentera'`,
`solvedLine: 'Semua lentera menyala'`, `pushSound(sound)` = `sound.scrape()`.

- **ThemeObject** (the reference's `Lantern`): `{ group, body, isLit,
  setLit(on), nudge(dx, dz, amount), update(dt, t, glow) }`. Moving it =
  writing `group.position.x / z`, as the reference does.
- **ThemeTarget** (the reference's pedestal): `{ group, update(dt, t, glow, covered) }`.

## `world/wanderer.js` (reference §12)

`Wanderer` — the reference's class, same fields and methods: `root`, `yaw`,
`shownYaw`, `move`, `action`, `actionTime`, `idle`, `frozen`, `opacity`,
`fadeTo`, `setOpacity(a)`, `faceDir(dr, dc)`, `perform(name) → seconds`,
`cancelAction()`, `update(dt, { cameraYaw })`. Constants `LOOK_AFTER`,
`MEDITATE_AFTER`, `ACTION_LENGTH`. The wanderer only **reads**
`move.kind / p / stepIndex` (gaits: `walk`, `run`, `push`, `rewind`); the glue
owns everything else in `move`, exactly as the reference's sections 14 and 17.

## `world/room-world.js` — one room's world

`createRoomWorld({ canvas, level, theme, rand })` → `world`. `rand` is the
room's seeded generator; every decor choice uses it. Building a new room =
`world.dispose()` then a new `createRoomWorld`.

| Member | |
|---|---|
| `scene`, `board` | |
| `wanderer` | a `Wanderer` in the scene, standing on `level.start`, opacity 1 |
| `objects` | `ThemeObject[]`, same order as `level.objects`, standing on their cells, lit if on a target |
| `targets` | `ThemeTarget[]`, same order as `level.targets` |
| `decor` | `{ gate, stranger, ponds, basins, crows, perches }`, as the reference's `decor`. `gate` (or `null`): `{ r, c, dir, stones, cell(k), inner, open(), close(), snap(open) }`. `stranger` (or `null`): `notice('protest' | 'won')` |
| `fx` | `ripple(x, z, color, size, life, y?, base?)`, `mote(x, y, z)`, `puff(pos: Vector3)`, `petalShower(spread)`, `clearPetals()` |
| `glowHex()` | the mood glow as `'#rrggbb'` (the lighting ripple's colour) |
| `setHover(cell \| null)` | shows the hover tile on a walkable cell, or hides it |
| `cellUnderPointer(clientX, clientY)` | `{ r, c } \| null`; objects are hit first, as in the reference |
| `update(dt, t, { covered })` | everything visual per frame, in the reference's order: camera turn, mood, `wanderer.update`, the opacity fade towards `fadeTo`, decor, objects, targets (`covered[i]`: is target *i* holding an object), shadows, ambient motes, hover pulse, fx, atmosphere. **Not** the scripts or the tile travel: those are the glue's |
| `render()` | draws the frame |
| `resize()` | after a window resize |
| `where()` | `{ x, y }` screen pixels of the wanderer (reference `hening.where`) |
| `inspect()` | `{ gate: { found, stones }, stranger: { seated, onScreen }, water: { ponds, basins, fountains, koi }, framing: { fits }, render: { calls, triangles } }` |
| `dispose()` | removes and frees everything of this room |

## `ui/hud.js` (reference HUD and overlays; ART-DIRECTION §12)

`createHud()` mounts its own DOM and CSS (bundled fonts) and returns:
`setPlace(text)`, `setCounters({ steps, pushes, lit, total, label })`,
`showStart(onStart)` / `hideStart()` (the "ketuk untuk mulai" veil),
`showResults({ line, stats, next })` / `hideResults()` (the temporary results
veil), `onTool(name, fn)` for `'undo' | 'restart' | 'rotate' | 'sound'`,
`setSoundOn(on)`, `dispose()`. The HUD follows the mood's ink by itself.
