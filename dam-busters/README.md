# The Dam Busters (1984, DOS)

Sydney Development, published by Accolade. A flight sim of Operation
Chastise — the RAF 617 Squadron raid on the Ruhr dams — with a
region-select map, a three-view cockpit (pilot, bomb-aimer, rear-gunner),
and per-engine controls for the Lancaster's four Merlin engines.

**It rebuilds byte-identically** from a copy you own — checked on every
run. **241 routines and 277 globals** are named in `symbols.json`, each
with the evidence for its name. Coverage:

- **All 158 call targets named (100%)**
- **All 6 tail-call entries named**
- 247 of 433 bracketed constants named + 13 recorded as displacements
- The reading covers the entry stub, the frame loop, all 9 game phases,
  the timer/music/keyboard/video subsystems, the CGA blitter, the drawing
  DSL, the 3D projection, the 20-slot object pool with all 10 object-type
  renderers, the three mission-start paths, the intelligence-report
  randomisers, and the two failure paths.

**`_data_spans` covers 50% of the image contiguously** — 68 spans
partitioning `0x07EFC..0x0FE04` (32,520 bytes: the results text bank,
the sprite banks, the song table, the LFSR state, and the CGA row table).
Extending the partition backwards to `0x0` is the next phase. See
[CLAUDE.md](CLAUDE.md) for the current state,
[docs/01-the-game.md](docs/01-the-game.md) for what the game is, and
[BRIEF.md](BRIEF.md) for the triage and toolkit-fix history.

## Rebuilding it

You need a copy of the game, NASM, and Python.

```powershell
mkdir original
copy <your copy>\* original\
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Expected output: `BYTE-IDENTICAL D3657960A00AAC6548C47EE35A8AC008EF0BB254F94AE2A335B04431F26C380D`.

## What this repository does not contain

No game files. `original/`, `recovered/` and the extracted release folder
are gitignored, because a byte-identical reconstruction is the game in
another form and a sprite pulled out of it is still the game. What is
kept is the reading: names, evidence, documentation, and the tools that
re-derive the rest from a copy you already own.
