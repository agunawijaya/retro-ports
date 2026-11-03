# Split for prompt 01 — the room

The architect's prompt is `prompts/01-room.md`; this file only says who does what.
Rules: `sokoban/CLAUDE.md` → *Who decides who builds what*.

## Pembagian kerja

*Revised 2026-10-30 00:10 on the owner's instruction: do not wait for Flash, use
Sonnet. The Flash `logic` run that had started at 23:59 was stopped after 7
minutes; it had changed no source (only rebuilt `dist/` and re-ran the
importer).*

| Who | Takes |
|---|---|
| **Opus** | Every [ART] item of §1 (render, world, decor, Lentera theme, audio, HUD), ported from `reference/index.html` without redesign; the module interface contract (`briefs/01-room-contract.md`) that engineer's glue is written against; the regression rounds of §4 (judging every pair, deciding and making the fixes); review of engineer's code; the sheet, the summary, the verdict. Never delegated: these are visual decisions. |
| **engineer** (Sonnet) | [LOGIC], moved from Agy because its quota is out (owner's rule). Task A, now: `tools/rooms-check.mjs`, `tools/perf.mjs`, `tools/regress.mjs` (`briefs/01-tools.md`). Task B, after the contract: `screens/room.js`, `ui/input.js`, `dev/qa.js`, `main.js` (§2, §3). |
| **qa-scout** (Haiku) | Running `rooms-check`, `perf`, `regress`, `npm test`, `npm run build`, audit when Opus asks, and reporting the numbers verbatim. |
| **Agy** | Nothing in 01 (Argon out until about 2026-11-04; Flash shares its quota with other projects and failed twice tonight). First choice again from prompt 02 when its quota allows. |

Fix 2 is finished. Prompt 01 still must not touch `src/core/` (prompt rule) —
if the core needs a change, it goes into `game/NOTES.md` as a request.

## Where each [ART] item lives in `reference/index.html`

Line numbers as of 2026-10-29 (3,076 lines). `ART-DIRECTION.md` sections in brackets.

| [ART] item (prompt 01 §1) | Reference section | Lines |
|---|---|---|
| HUD, overlays, veils (`ui/`) [§12] | CSS `HUD`, `Overlays` | 52–91, 118–215 |
| Moods + 2.4 s cross-fade (`render/`) [§5] | 1. Moods; 8. Mood transitions | 216–262, 741–802 |
| Pastel shader, role uniforms (`render/`) [§4] | 4. The pastel material | 333–427 |
| Canvas textures (`render/`) | 5. Procedural textures | 428–474 |
| Sound engine (`audio/sound.js`) [§11, §7.6] | 6. Sound | 475–682 |
| Renderer, camera, framing, Q/E (`render/`) [§2, §3] | 7. Renderer, scene, camera | 683–740 |
| Clouds, stars, far monuments (`world/`) [§10] | 9. Atmosphere | 803–854 |
| Island builder (`render/`) [§6] | 10. Board | 855–997 |
| Lantern, pedestal, lit effects (`themes/lentera.js`) [§7.1] | 11. Goal pedestals and lanterns | 998–1118 |
| Wanderer, pose rig, every state (`world/`) [§8, §9] | 12. The wanderer | 1119–1472 |
| Ripples, motes, petals, puffs (`world/`) [§10] | 13. Effects | 1473–1600 |
| Ponds, koi, pads, fountain, basin (`world/decor/`) [§10b] | 13b. Water | 1601–1922 |
| Torii gate, bar, stepping stones [§10b.2] | 13c. The torii gate | 1923–2031 |
| The stranger [§10b] | 13d. The stranger | 2032–2182 |
| Crows [§10b] | 13e. Crows | 2183–2334 |
| Decor manager, perches [§10b] | 13f. Decor manager | 2335–2379 |
| Arrival / departure scripts (feeds `screens/room.js`, [LOGIC]) | 14, scripted walks | 2634–2726 |

Sections 2 (levels), 14 (state, rules), 15 (input), 16 (reference panel), 17
(main loop) and 18 (boot) belong to the [LOGIC] side or to `dev/qa.js`.
