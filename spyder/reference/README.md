# Spyder — reference scene (Living Room)

The playable quality bar for the Spyder web port. Every room, character and screen built later must look like it belongs next to this one. The rules behind it are in `../ART-DIRECTION.md`.

## Run it

Open `living-room.html` in Chrome, Edge or Firefox. No server, no build step, no network (fonts are bundled).

| Key | Action |
|---|---|
| A / D, ← / → | Move |
| W / ↑ | Jump (onto the sofa or the dresser) |
| S / ↓ | Drop down from furniture |
| Mouse | Aim (keyboard players get gentle auto-aim) |
| Click / Space | Fire the vacuum blaster |
| Esc / P | Pause |
| M | Sound on/off |
| R | Play again (on the results card) |

Clear the room (16 spiders and 85 % of the silk) to see the makeover.

## Layout

```
reference/
├─ living-room.html     page shell, HUD markup, cards
├─ scene.js             frame pipeline, room loop, makeover, QA hooks
├─ css/hud.css          diegetic UI
├─ fonts/               Fraunces, Caveat, Special Elite (+ LICENSES.md)
├─ lib/                 shared systems, reuse these in every room
│  ├─ core.js           maths, seeded random, noise, colour helpers
│  ├─ palette.js        palette + dirty/clean moods
│  ├─ paint.js          painterly brushes (wobbly edges, paintShape, shadows, stains)
│  ├─ lighting.js       light map, cones, shafts, glow, flicker
│  ├─ particles.js      bursts (puff, goo, fibres, sparkles) + floating dust
│  ├─ webs.js           procedural, tearable cobwebs
│  ├─ spider-rig.js     the IK spider every spider type uses
│  ├─ spiders.js        String Spider, Wall Crawler, Hatchling, Egg Sac
│  ├─ hero.js           the Exterminator: movement, expressions, drawing
│  ├─ audio.js          procedural Web Audio
│  └─ hud.js            brass plate, work order, gauge, tag, cards
├─ rooms/living-room.js the template every room follows
├─ screens/             the six reference frames (1920 × 1080)
└─ tools/               shoot.mjs / shoot.py (QA screenshots), flowtest.py (makeover flow)
```

## QA mode

`living-room.html?qa=1` freezes time and exposes `window.__spyder`:

```js
__spyder.setup('action');   // 'title' | 'dirty' | 'action' | 'makeover' | 'clean' | 'results'
__spyder.step(0.5);         // advance the simulation by half a second
__spyder.clearRoom();       // complete the goals and let the normal rules react
__spyder.play();            // unfreeze
```

`cd tools && npm install && node shoot.mjs <out-folder>` renders all six states with your installed Edge or Chrome; compare them with `screens/`.
