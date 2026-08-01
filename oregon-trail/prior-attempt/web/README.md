# The Oregon Trail &mdash; JS Rebuild (Study Project)

A self-contained rebuild of the 1990 MECC edition of **The Oregon Trail
v2.1** in HTML + vanilla JavaScript.

> This is a **study project**, not a commercial port. The goal is to make
> the game's mechanics legible to a future reader. Every file is annotated
> with `CONFIRMED` (read from the original binary) vs `HYPOTHESIS` (our
> best reconstruction) so you can see exactly which numbers come from
> reverse engineering and which come from us.

## How to run

The project is fully self-contained inside this folder &mdash; there are no
external paths or build steps.

### Option A &mdash; with a local HTTP server (recommended)

ES modules require a real HTTP origin. Any static server works:

```pwsh
# from this folder
python -m http.server 8080
```

Then open <http://localhost:8080/> in your browser.

### Option B &mdash; double-click `index.html`

Modern Chromium browsers permit ES modules to load from the `file://`
scheme when every asset is in the same directory tree, which is the case
here. If you see CORS errors in the console, use Option A instead.

## File layout

```
oregon-trail-js/
|-- images/          29 PNG assets recovered by reverse engineering
|-- index.html       single page; loads js/main.js as an ES module
|-- css/style.css    retro DOS terminal styling
|-- js/
|   |-- main.js      entry point; runs the top-level phase machine
|   |-- constants.js every game number lives here (CONFIRMED vs HYPOTHESIS)
|   |-- assets.js    AssetLoader + spritesheet coordinates
|   |-- state.js     GameState / PartyMember / Supplies classes
|   |-- trail.js     LANDMARKS table + daily-mileage math
|   |-- events.js    EventSystem - daily roll, illness, weather, damage
|   |-- store.js     Matt's General Store (Independence + every fort)
|   |-- river.js     ford / caulk / ferry / hire-guide crossings
|   |-- hunting.js   real-time hunting mini-game (mouse + click)
|   |-- scoring.js   final score and localStorage high-score table
|   |-- renderer.js  every canvas drawing primitive
|   `-- ui.js        DOM-side menus, prompts, message log
`-- README.md
```

## Reverse-engineering notes

Throughout the source you will see comments referencing binary offsets:

* `@0x13D3A` &mdash; final-score formula `score = base * (3 - occupation_id)`
* `@0x23D86` &mdash; 16-record landmark table (37 bytes each)
* `@0x241C8` &mdash; 20x8-byte event-threshold table
* `@0x24156` / `@0x24198` &mdash; illness names and parameter rows

Each tag points back to a location in the unpacked DOS executable that
served as the source of truth for that constant.

## CONFIRMED vs HYPOTHESIS

Quick guide to what you should and should not change:

* **`CONFIRMED`** values are baked into the original game. Changing them
  in `constants.js` changes the game's identity (e.g. shrinking the
  trail from 2000 miles changes pacing).
* **`HYPOTHESIS`** values are our reconstructions. These are the safe
  tuning knobs: weather event severity, daily-mileage jitter, hunting
  yields, fort price multiplier, etc.

Anything not tagged either way is a derived helper.

## Browser compatibility

Tested on a current Chromium / Firefox. Requires ES modules and Canvas
2D, both universal in modern browsers. No build step, no bundler.

## Acknowledgements

Original game design by R. Philip Bouchard, Don Rawitsch, Bill Heinemann,
and Paul Dillenberger (MECC, 1971-1990). This rebuild exists purely for
study and is not endorsed by The Learning Company / HMH.
