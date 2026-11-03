# Hening

Hening is a calm, pastel remake of the 1984 warehouse puzzle *Soko-Ban*: a wanderer climbs a tower of floating stones and lights a lantern in every room. Fifty rooms, five floors, two moods of play, and a quiet ending above the clouds.

This copy is for the owner's personal use. The room layouts come from the owner's own copy of the original game and are never redistributed.

## Run it

Requires Node 20 or newer.

```bash
cd game
npm install
npm run dev
```

Vite prints the local address; open it in a browser. `?qa=1` enables the test hooks used by the checks in `tools/`, and `?qa=1&room=N` jumps straight into room *N*.

## Test it

```bash
npm test
```

Vitest covers the pure rules (`src/core/`): level parsing and validation, every move kind, undo/restart, LURD replay, tap-to-walk paths, the solver, and the room importer. The browser checks are separate: `node tools/flow.mjs`, `node tools/themes-check.mjs` and `node tools/rooms-check.mjs`. `tools/playthrough.mjs` plays the whole game from room 1 to the ending and writes `review/prompts/05-polish/playthrough.md`.

## Build it

```bash
npm run build
```

If `src/data/*.generated.json` are not present yet, run `npm run rooms` first (it needs `original/sokoban/`); the build then inlines the generated files. This writes `dist/hening.html`, opening it with a double-click; it needs no server and no network. It is the only file the build writes: the two typefaces and the solver worker are inlined, so the file can be copied anywhere on its own. On Windows, `..\mulai-hening.bat` builds and opens it in one step (`mulai-hening.bat cepat` opens the last build without building).

## Where the rooms come from

The fifty tower rooms are the owner's 1984 originals. `original/sokoban/` holds the two-room 612-byte files (`TABL012`, `TABL034`, …, `TAB4950`); `npm run rooms` runs `tools/import-rooms.mjs` to decode them into `src/data/rooms.generated.json`, then `tools/solve.mjs` to solve and verify each room into `src/data/solutions.generated.json`. If `original/sokoban/` is absent, the importer writes nothing and the game falls back to one small practice room, so it still starts.

`solutions.manual.json` holds owner-supplied solutions for rooms the offline solver could not finish. Every stored solution is replayed with `replayLurd` on our own room before it is used.

## What is git-ignored, and why

From `ARCHITECTURE.md` §12:

- `src/data/*.generated.json` — the imported room layouts and their solutions. They contain the original game's fifty rooms, which are for the owner's personal use and must not be redistributed.
- `src/data/solutions.manual.json` — the owner-supplied solutions, kept under the same personal-use rule and the source's own terms.
- `review/` — generated review frames, sheets and summaries; they show the original rooms.
- `dist/` — the built game, which inlines those same rooms; it is an artifact, rebuilt with `npm run build`.
- `.scratch/` and `node_modules/` — throwaway renders and installed packages.

Nothing is committed or pushed unless the owner asks.

## Controls

| Action | Keys |
|---|---|
| Walk / push | Arrow keys or W A S D |
| Walk to a tile | tap or click a reachable tile |
| Undo | Z or Backspace |
| Restart the room | R |
| Rotate the view | Q / E |
| Pause | Esc or P |
| Sound | M |
| Confirm / skip | Enter or Space / any move key |

In the courtyard, keys 1–5 walk to Gerbang Menara, Paviliun Taman, Batu Catatan, Kolam and Jalan Setapak. In a room, the four round buttons are undo, restart, rotate and sound.
