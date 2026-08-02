# The Oregon Trail — port it. Your task.

Take over a port that was started, failed, and has now been diagnosed. The
diagnosis is done; your job is the work that follows from it.

This is a **second** brief for this game. [PROMPT.md](PROMPT.md) was the
decompilation, and it is finished — the behaviour is recovered, the tables are
verified, and [docs/03-the-code.md](docs/03-the-code.md) has an address beside
every claim. What is not done is the thing all of that was for.

Read, in this order, before touching anything:

| | |
|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | the repository's conventions |
| [`CLAUDE.md`](CLAUDE.md) | the working reference for this game |
| [`docs/03-the-code.md`](docs/03-the-code.md) | what the binary actually does |
| [`prior-attempt/README.md`](prior-attempt/README.md) | why the earlier work is quarantined |

## What is not in the clone, and why

`original/`, `recovered/`, `reference/` and `work/` are gitignored on purpose:
they are the game, or they are derived from it. So a fresh clone has all the
documentation, all the tools and the whole prior port's source — and no game,
and no artwork.

Before anything can run:

```powershell
# 1. your own copy of the game goes here -- 19 files.
#    Their SHA-256 are published in docs/03-the-code.md, so you can check it is
#    the same build these documents were written against.
oregon-trail\original\

# 2. unpack it -- the shipped executable is LZEXE 0.91
python <toolkit>\tools\unpack.py original\OREGON.EXE -o work\unpacked.exe

# 3. put the artwork back
python <toolkit>\tools\pcxlib.py original\OTCGA.PCL --extract reference\art\cga
```

**The port will not render until step 3 has been done.** Its images live in
`reference/`, which is not committed. A blank screen here means the assets are
missing, not that the port is broken — that mistake is easy and costs an hour.

## The decision that has already been made

**Continue the existing port; do not start from zero.**

The reasoning: the architecture is sound. `events.js`, `trail.js`, `state.js`,
`store.js` and `river.js` import only `constants.js`, so the logic is already
separated from the rendering — which is the expensive part to rebuild and the
thing this repository asks for anyway. What failed was not the structure.

It failed because there was no way to check whether any number was right. There
now is: a toolkit that runs the binary, a set of verified tables, and a renderer
that draws the hunting field from the file.

| | |
|---|---|
| **keep** | the module boundaries, the logic/render split, and the `CONFIRMED`-vs-`HYPOTHESIS` discipline in `constants.js` |
| **replace** | `constants.js` — the data, from the verified tables in `docs/03`<br>`events.js` — the **model** is wrong, not just the numbers<br>`hunting.js` — the input model and the field generator |
| **add** | a seeded PRNG, `resetGame(seed)`, and `selfTest()` on `window` |
| **move** | the result to `web/`, leaving `prior-attempt/web/` untouched as the record of what was tried |

## Do this first, because it can still change the plan

Audit `prior-attempt/web/js/assets.js` against `OTCGA.PCL`.

If its spritesheet coordinates were **measured** from the extracted artwork, the
render layer survives and the plan above stands. If they were **invented**, the
render layer has to go too, and starting from zero becomes the more honest
option.

This has not been checked. Check it before writing anything else, and say which
it is.

## Defects already established, with their evidence

**The landmarks are two short.** The port reads *"18 landmarks at `0x23D86`"*
and marks it `CONFIRMED`. `0x23D86` is *inside* the table, at `Fort Kearney` —
the third entry. The table starts at `0x23D32` with *"the Kansas River
crossing"* and holds **17**. The port is missing its first two landmarks,
including a river the game certainly reaches.

**The events are built on the wrong table, and on the wrong idea.** The port
uses *"a 20-row × 8-byte table at `0x241C8`"*. That is not the event table —
it sits 0x30 bytes after the illness parameters the port itself cites at
`0x24198`. The real one is **fifteen six-byte `Real`s at `DS:0x188E`** (file
`0x24D0E`), and **every one of them is zero in the file**: the odds are
recomputed daily from the party's state.

The dispatcher at `0x2BD7` is fifteen independent Bernoulli trials, walked in
order until a handler sets `[0x188D]`. Some entries are genuine odds — 0.05 for
a rough trail, 0.15 for wild fruit — and some are switches written as exactly
`1.0` or `0.0`. Behind them is a hazard level:

```
[0x1867] = 0.97 × [0x1867] + [0x19AE]
[0x19AE] = 8.0 × (0.20 or 0.80, the larger with p = 0.30)
           and only while [0x19A4] < 2, i.e. within two days of a landmark
```

Reading fixed thresholds out of the wrong address, for a system that has no
fixed thresholds anywhere, is why the events felt wrong and why nobody could
point at which number to change.

**The hunting input is a different game.** The port uses mouse and click. The
original uses keypad digits to aim, `Enter` to start and stop walking, `Space`
to fire and `Escape` to stop — and converts a joystick into exactly those keys
before anything else sees them, which is why the instructions screen can
describe itself entirely in keystrokes.

Its field is a generator, not a picture: `Random(4) + 5` scenery objects placed
by rejection sampling, from a per-region list; animals that walk in from an
edge, gated by how far west you are. [`tools/render-hunting.py`](tools/render-hunting.py)
implements all of it already and is the reference to port from — it is our own
code and it is committed.

**The illnesses are right.** `0x24156` is correct: six of them, and the names
match.

## What you can rely on

| | |
|---|---|
| [`docs/03-the-code.md`](docs/03-the-code.md) | the recovered behaviour, with an address beside every claim |
| [`tools/model.pas`](tools/model.pas) | the simulation model as runnable Turbo Pascal — miles, food, health, the illness die, the casualty routine |
| [`tools/render-hunting.py`](tools/render-hunting.py) | the hunting field drawn from the file, animals included |
| [`tools/drive-to-hunt.py`](tools/drive-to-hunt.py) | drives the real game to hunting under emulation, in 19 keystrokes |

Anything marked **[inferred]** in the documents is a hypothesis. Anything else
has been measured.

## The rules that are not negotiable

- **Never commit anything from `original/`, `recovered/`, `reference/` or
  `work/`.** Check `git status` before every commit; never `git add -A`.
- **The static render is the deliverable and the emulator is the referee.** A
  screen computed from the file is the claim; `comrun.py` only checks it.
  Reversing those two cost most of a session —
  `DOS-Decompiler/knowledge/12-hooking-the-right-thing.md` has the case, and it
  is worth reading before you reach for a screenshot.
- **Make the simulation seedable.** `resetGame(seed)` for a reproducible game,
  no argument for a clock seed. The prior port has fourteen bare
  `Math.random()` calls across six modules and no PRNG, and that alone made
  every complaint about it undiagnosable. Turbo Pascal's own generator is
  implemented in `tools/render-hunting.py` if you want the same stream shape.
- **Expose `selfTest()` on `window`**, and keep the logic headless so thousands
  of ticks run in milliseconds.
- No build step: open `index.html`.
- Mark inference `[inferred]` inline. Correct wrong claims in place, leaving the
  wrong one on the record with the result beside it. Record negative results —
  this repository keeps them deliberately.

## Your first deliverable

The `assets.js` audit, and a one-page report: which of the port's `CONFIRMED`
tags survive contact with the binary, which do not, and your recommendation on
whether the render layer can be kept.

**Do not start rewriting until that is written down.** The prior attempt's
seven `CLAUDE_CODE_FIX_*.md` files — 118 KB of them — are what happens when the
fixing starts before the measuring does.
