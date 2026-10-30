# Brief 16-fix — the results card must not name a secret room

For `engineer`. **Stay out of `game/rooms/attic/art.js` and `game/lib/bosses/spider-queen.js`** — Opus is painting them now.

## The problem

Flash (prompt 16) changed `after(id)` in `game/lib/room-registry.js` (~line 160) to:

```js
return HOUSE.slice(i + 1).find((h) => !h.secret) || HOUSE[i + 1] || null;
```

so that after the Attic, the last main room, the results card says "next on the plan: the Basement — not built yet" (`game/lib/screens.js` ~129). But the Basement, the Greenhouse and The Wall are **secret rooms**: `DESIGN.md` §5.2 has the Basement unlocked by finding the cellar key, and the registry's own comment (~37) says secret rooms are not drawn on the map until something unlocks them. Naming one on the results card gives the secret away. This is a design decision already taken (by Opus); implement it, do not re-decide it.

## What to do

1. `after(id)` returns the next room in house order that is **not secret, or secret and already found** (`progress.isFound(id)`, the same check `statusOf` uses ~139). If there is none, it returns `null` and the results card names no next room (check `screens.js` behaves sensibly with `null`: no "next on the plan" line, no "Next room" button pointing nowhere).
2. Flash also moved a check in `game/tools/checks.mjs` that tested the "not built yet" line from the Attic to the Basement. Make that check meaningful again without spoiling anything:
   - one check: clearing the Attic with no secret room found shows **no** next-room line;
   - one check: with the Basement marked found (`progress`), clearing the Attic shows "next on the plan: the Basement — not built yet".
   - Restore progress afterwards, so the later checks are not affected.
3. Run, one at a time, from `game/tools`: `node checks.mjs`, `node flowtest.mjs`, `node regress.mjs` (no positional argument). Make sure no other heavy job is running first (CPU idle), because flowtest's real-time checks fail under load.

No git commits. Images only in `.scratch/`. Report under 250 words: the diff of `after()`, the two checks, and the totals verbatim.
