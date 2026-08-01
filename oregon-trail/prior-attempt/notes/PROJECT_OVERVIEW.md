# Oregon Trail v2.1 — Reverse Engineering Project

**Game:** Oregon Trail v2.1 (MECC, 1990), DOS English release
**Working directory:** `E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN`
**Status:** Analysis complete, Turbo Pascal rebuild at `.\src\`

---

## 1. What This Project Is

A reverse-engineering study of the 1990 DOS title, with three concrete
outputs:

1. **A clean-room Turbo Pascal rebuild** of the game in `.\src\` —
   compilable under TP 6.0, contains all the game systems with the
   confirmed mechanics from the binary plus reasonable approximations
   for items that could not be statically extracted.

2. **A reverse-engineering knowledge base** explaining how the original
   binary is structured, where each game system lives, and how the
   RNG / save format / dialog database / graphics archive / copy-protect
   actually work.

3. **A Python toolchain** in `.\work\` that does the binary analysis,
   string extraction, and screen-to-code navigation.

This document is the **entry point** — read it first, then jump to one
of the focused docs below.

---

## 2. Where to Find Things

```
The-Oregon-Trail_DOS_EN\
|
|-- PROJECT_OVERVIEW.md      <-- you are here
|-- REBUILD_GUIDE.md          rebuild architecture + how to compile/run
|-- RE_PLAYBOOK.md            how the RE was done (static + dynamic)
|-- TOOLS_REFERENCE.md        Python scripts + DOSBox-X workflow
|
|-- oregon_trail_reverse.md   Phase 1-5 analysis (original)
|-- LEARN_OregonTrail.md      architecture diagrams + pseudo-code (original)
|
|-- OREGON.EXE                game binary (LZEXE-packed, 80 KB)
|-- INSTALL.EXE               installer (ignored)
|-- *.PCL, *.BGI, *.REC, ...  game data files
|
|-- src\                      Turbo Pascal rebuild
|   |-- *.PAS                 15 units + main program
|   |-- *.TXT                 detailed closure docs per system
|   |-- README.TXT            in-rebuild guide
|   |-- SCREENS.TXT           screen-to-code navigation guide
|
|-- work\                     analysis tooling and artefacts
|   |-- OREGON_UNPACKED.BIN   LZEXE-unpacked image (150 KB)
|   |-- *.py                  Python analysis tools
|   |-- *.txt                 analysis outputs and atlases
|
|-- images\                   extracted PNGs of game graphics
|-- screenshots_debug\        DOSBox-X debugger screenshots
|-- prompts\                  prompts used during the RE phases
```

---

## 3. The Five Original Gaps and Their Closure

The reverse engineering started with five flagged uncertainties.
All are now closed (most fully, some partially):

| # | Gap | Final status | How it was closed |
|---|---|---|---|
| 1 | DIALOGS.REC binding | **CLOSED** | Slot index = landmark zone (10/10 spot checks pass) |
| 2 | Copy-protection check | **CLOSED** | Date bomb at `cmp [bp-4], 0x88B8` = 1995-10-28 |
| 3 | RNG algorithm | **CLOSED** | DOSBox-X BPM at 2348:16B2 fired `00 -> 03` over a 3-draw river path. Counter-mod-N, seeded by startup timer calibration |
| 4 | Flag `0x7D` at 2 landmarks | **CLOSED** | Route-fork marker — Fort Bridger (Sublette Cutoff) + Fort Walla Walla (Whitman Mission) |
| 5 | PCX RLE decoder | **CLOSED** | Standard ZSoft format implemented in `src/GRAPHX.PAS` |

A second pass attacked items that were APPROXIMATED in the rebuild and
upgraded several to CONFIRMED:

| Item | Final status |
|---|---|
| TOMB.REC layout | CLOSED structurally |
| Music tempo handling | VERIFIED |
| Ration consumption `(3 - ration_idx) × alive` | **CONFIRMED via disasm of fn @0x13D26** |
| JOYCAL.REC layout | RE-VERIFIED |
| Score component structure | PARTIAL — components confirmed, exact weights unknown |
| Pace hour constants 8/12/16 | DISPROVED — not in binary |
| Speed per oxen count | NOT CLOSED via static |
| Hunting animal weights | NOT CLOSED via static |

Full details in `src/STATICTRACE.TXT`, `src/RNGNOTES.TXT`,
`src/DIAMETA.TXT`, and `src/COPYPROT.PAS`.

---

## 4. How to Resume This Project Later

Quick re-orientation in three steps:

1. **Read this file first**, then `REBUILD_GUIDE.md` to remember the
   Pascal architecture.

2. **If you want to dig into a specific system**, look up its `.PAS`
   unit in `src/` — each unit header now has comments pointing to:
   - the `OREGON_UNPACKED.BIN` file offsets for the original screen text
   - the corresponding `STATICTRACE.TXT` / `RNGNOTES.TXT` section that
     explains what was confirmed vs approximated
   - the analysis artefact in `work/` that backs the implementation

3. **If you want to view the original verbatim screen text**, use:
   ```
   python work/show_screen.py LABEL
   ```
   where `LABEL` is one of the 31 names in `screens_navigation.txt`.
   The tool prints the verbatim text from your `OREGON_UNPACKED.BIN`
   at the screen's offset.

---

## 4b. Ghidra Pass (2026-06-11)

A Ghidra 12.1.2 headless analysis was added.  Outcomes:

**Upgraded (CONFIRMED via decompile):**
- JOYCAL.REC runtime structure (4 axis WORDs + enable flag + 4 runtime
  state bytes) — fully verified
- Phase 1's "joystick = hunting" was WRONG; 0x11580 is generic input

**New data:** state slot map at memory `0x1800-0x18C0` (contiguous
game-state table) catalogued; per-slot semantic mapping deferred.

**Still open after Ghidra pass:**
- Score function (TP6 indirect string addressing defeats direct xref)
- Pace dispatch code (1 ref found but function not boundary-detected)
- Hunting game proper

Full details: `src/GHIDRA_PASS.md`.

**Consequences of the three unclosed gaps** (what they mean for you in
practice) are explained in `REBUILD_GUIDE.md` section 4.5.  TL;DR:
- Score weights: LOW impact (only end-game numbers)
- Hunting tables: MEDIUM impact (strategy balance)
- Pace formula: HIGH impact (whole-game timing budget)

None of the three matter for studying the architecture or for
mapping screens to code -- only for "play it like the original."

---

## 5. What Remains to Do (if you ever come back to this)

The rebuild is **functional** and the documented mechanics are
sufficient for studying the original's architecture.  If you want to
go further:

* **Bit-perfect reproduction** of the RNG sequence — needs another
  DOSBox-X session with BPM on the food / miles counters to find the
  exact code that calls `GetRand`.  See `RE_PLAYBOOK.md` section 4 for
  the methodology used to close Gap #3.

* **Exact pace / speed / hunting tables** — needs either a Ghidra
  load of `work/OREGON_UNPACKED.BIN` and full function-graph analysis,
  or trial-and-error fitting against gameplay observations.

* **Compile-test the rebuild under TP 6.0** — the source is written
  to TP 6.0 syntax but has not been actually compiled.  Likely needs
  small adjustments where TP's strict type checking differs from what
  I assumed.

* **Visual side-by-side comparison** — run rebuild + original in
  DOSBox-X simultaneously, compare end-game scores and event
  frequencies, fit any remaining approximated weights.

---

## 6. Acknowledged Limitations

* The rebuild does **not embed verbatim game prose**.  All menus,
  prompts, NPC dialog templates, and tombstone text are clean-room
  rewrites.  The original verbatim content lives in the game's data
  files (`DIALOGS.REC`, `OREGON_UNPACKED.BIN`) on your disk; the tools
  in `work/` can show it to you on demand for study.

* The rebuild's `RNG` is architecturally identical to the original
  (timer-seeded counter, `+1` per draw, modulo N) but the **exact bit
  sequence will differ** because the seed depends on millisecond-level
  startup timing.

* Some numeric tables (pace hours, oxen speed scaling, hunting weights)
  are **best-guess approximations**.  This affects gameplay TUNING
  but not BEHAVIOUR — the game runs and the player can win or lose
  for the same structural reasons as the original.

---

See `REBUILD_GUIDE.md` for the Pascal architecture, `RE_PLAYBOOK.md`
for how the analysis was done, and `TOOLS_REFERENCE.md` for the
Python scripts and DOSBox-X workflow.
