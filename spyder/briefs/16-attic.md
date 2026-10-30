# Brief 16 — the Attic and the Spider Queen

The prompt is `prompts/16-attic.md` (the architect's). This brief says only who does what, and how it runs. The specification is the prompt itself, `DESIGN.md` §3.3 and §6, `ART-DIRECTION.md` (§7 for the Queen, §17 row 12), and `review/prompts/15-boss-system/summary.md` for the boss framework.

## How it runs

- **Alone.** 17 and 18 wait until 16 is approved.
- Agy is given `prompts/notes/16-attic.txt`: the framework facts from 15 that the Queen depends on (she owns her death and sets `done`; `phase.note`; the QA hooks), and the headless HUD-capture trap.
- **Logic fallback is Agy Flash, not DeepSeek.** `CLAUDE.md` makes DeepSeek v4 Pro the first logic runner, but its trial starts at prompt 17. The boss room is not the place to try a new runner.

## Pembagian kerja

### Agy (Gemini) — the bulk of the work

- **First, Argon** (`-Scope full`): the whole prompt.
- **If `quota=1`, Flash** (`-Scope logic`): all of [LOGIC]:
  - L1, the layout and platforms;
  - L2, `lib/bosses/spider-queen.js`: the three phases, the hit zones, the line-cut stun, the leap, the defeat, the rules, breakables, beats, story object, the eight QA states and the webs;
  - a plain, scaled Queen rig and room blockouts, each marked `// ART: blockout`, that already read the state the art needs (phase, lunge, mandibles, tear at 66 %, broken leg tip at 33 %, line, nest collapse, torch position);
  - the checks.

### Opus (Claude Code) — decisions, art and review

- **If Agy ran on Flash, all of A1 and A2:**
  - **A1:** the roof and rafters, the boarded round window and its blades of moonlight, the silk funnel nest, the bulb, the trunks and the rocking horse, dirty → clean, and the torch.
  - **A2:** the Queen's look on the rig: the crown pattern, the sheen, the eyes, the bristled legs, the mandibles, the shadow up the roof, and the marks of each phase.
- Painted in the scratchpad until the `.done` file appears, then installed. One pass aimed at the reference, without extra rounds.
- Every gameplay judgement about how the fight plays, the verdict, and the report in Indonesian.

### qa-scout (haiku) — running and checking

- Agy's `.done` file, log tail, and "Left for ART".
- After the art, one at a time: `checks`, `flowtest`, `regress`, `perf` (`queen-rage` and `makeover`, plus `--makeover-spike --room=attic`), console errors, `audit`. The machine must be idle first (see the traps in `CLAUDE.md`).
- The hero shots and the six-cell sheet.

### engineer (sonnet) — only small fixes found in review

- Broken QA staging, wiring the state the art needs, a guard in `game/lib/`.
- Never the room or the Queen as a whole while Agy can run it.

## Run log

- **2026-10-30 12:45.** Argon refused: `quota=1` after 7 s.
- **12:45–13:20.** Flash `-Scope logic`: exit 0, 34 min, summary written, every check passing by its own account. It built L1, L2, the Queen on a plain scaled rig, and blockouts. `qa-scout` confirmed no errors, no hung task, `.scratch/` empty.
- **Opus review, gameplay:** Flash made the results card name the Basement after the Attic. That is a secret room, so the decision was reversed. **`engineer`** implemented the reversal (`briefs/16-fix-secret-next-room.md`): `after(id, progress)`, plus two checks. Totals: checks 106, flowtest 107, regress identical.
- **`engineer`, glue:** `live.world = world` in `onStart`, so the art can see the Queen. The beat `window` was renamed `boards`, because its key collided with the shared dawn `mk.window`.
- **Opus painted A1 and A2.** The sweep would reveal the clean layer before the window, bulb and sheets beats, so everything that changes after it is drawn live from sprites. Four critique rounds, each on renders:
  - **1:** moonlight read as one lampshade cone (the stock shaft/beam widen quads); the nest was frosted glass; insulation looked like polka dots; bristles looked like saw teeth.
  - **2:** the line was lost against the nest; her legs vanished in the dark.
  - **3:** the swing state had no legs at all — `world.gameTime` does not exist, so the hang pose went to NaN; the nest lunge was not staged; the telegraph's spread legs were missing.
  - **4:** a NaN from `spread` read during the base constructor; the shadow sat outside the bulb's pool.
- **Measured, not a bug:** a synchronous loop of 300 `step()` calls showed 1–2 s frames in the Attic *and* in the approved Kitchen. That is the GPU queue filling without a yield. Yielding to rAF each frame, the Attic costs mean 1.8–2.3 ms, p95 ≤ 3.8 ms in every Queen state. Lazy sprites cost 4 ms once; static paint 44 ms per variant at load.
- **Phase notes** rewritten in A.'s voice, listed for the architect: "She's coming down.", "She's angry now."
- **`qa-scout`:**
  - Shots and checks: seven hero shots, the sheet, checks 119 pass, regress identical, audit clean.
  - Frame time: `queen-rage` mean 4.26 / p95 6.20 ms, worst makeover frame 13.8 ms.
  - `flowtest` failed on "attic: runs in real time" twice; with the engineer's earlier run, three in a row.
- **Opus traced the flowtest failure** to load-time GPU work. The Attic's static paint ran blurred inner shadows and rims over huge shapes, and the GPU paid for them on the room's first frames, past the test's settle time. Blur was taken off the large flat shapes. After that, flowtest passed twice in a row (attic t 3.2 s, 3.3 s). Hero shots and the sheet were retaken on the final art.
- **Verdict:** approved.

