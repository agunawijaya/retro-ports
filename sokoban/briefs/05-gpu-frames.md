# Brief: GPU frame time per screen — `tools/gpu-frames.mjs` (engineer)

## Pembagian kerja

- **Sonnet (engineer, you):** this tool and its numbers. Another Sonnet instance is fixing the build and some copy at the same time: do not edit `src/`, `vite.config.js` or `package.json`. Create only `tools/gpu-frames.mjs`.
- **Opus:** asked for it (prompt 05 §4 wants frame time on the owner's laptop GPU; `tools/perf.mjs` runs on SwiftShader, so its frame times say nothing about a GPU).

Work in `E:\Projects\retro-ports\sokoban\game`. No git commits.

## What it does

Prompt 02 measured this once by hand (`game/NOTES.md` → *Perf (prompt 02)*): Intel UHD, D3D11 via ANGLE, 1440 × 900 at DPR 2, `update` + `render` + `gl.finish`, 600 frames after 120 warm-up, two passes, median. Make that a tool:

- Launch Playwright `msedge` headless **with the real GPU**: `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` (not the harness's SwiftShader flags). Print the WebGL renderer string (`WEBGL_debug_renderer_info`) first, so the report shows which GPU it ran on; if it is SwiftShader, say so and stop.
- Serve the game with `startDevServer()` from `tools/lib/harness.mjs`, open `?qa=1&seed=7`, viewport 1440 × 900, `deviceScaleFactor: 2`.
- Per scene, after setting it up with the QA hooks (`window.hening.screen(...)`, `skipIntro()`, `arrange()`, `theme(id)`, `progress({ solvedUpTo })`, `garden(json)`; see `tools/shoot-tower.mjs`, `tools/shoot-modes.mjs`, `tools/shoot-themes.mjs` for how each screen is reached), measure in the page: wrap `window.requestAnimationFrame` so each frame callback is timed from its start to after `gl.finish()` on the game's WebGL2 context (`document.querySelector('canvas').getContext('webgl2')` returns the existing one). Discard 120 frames, keep 600; two passes; report median, p95 and max per pass. Read `renderer.info`'s draw calls through `hening.renderStats()` if it exists.
- Scenes (prompt 05 §4): title with every floor lit (`progress({ solvedUpTo: 50 })`), courtyard, the ride (`screen('elevator', { from: 0, to: 2, then: 'floor' })`, measure during the ride), Lantai I and Lantai V, rooms 6 and 10 all lit in each of the five themes (`lentera`, `bintang`, `batu`, `candi`, `mata-air`), Mimpi in room 10 (`screen('dream', { room: 10 })`), the garden editor with a full 19 × 16 board, the ending.
- Write `review/prompts/05-polish/gpu-frames.md`: the GPU string, then one table (scene · median ms · p95 · max · draw calls · ≤ 8 ms median yes/no). Budget: `docs/ARCHITECTURE.md` §14 (≤ 8 ms CPU + GPU).

Run it once (it may take several minutes) and report back in at most 12 lines: the GPU string, the worst median and which scene, any scene over 8 ms.
