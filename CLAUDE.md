# Working in this repository

Context for any coding agent picking up work here, so the user does not have to
explain it again.

## Where this stands, and what to do next

*Last measured 2026-08-02. If you change anything, re-measure and edit this —
the counts below drift the moment a tool improves, and eleven of them had gone
stale within a single session before `tools/docaudit.py` existed.*

Five games are reconstructed and read. All five rebuild **byte-identically**,
which `build.ps1` checks and refuses to report success without.

| | routines | globals | rebuild |
|---|---|---|---|
| [karateka](karateka/) | 218 | 338 | `C8736BBA…` |
| [hard-hat-mack](hard-hat-mack/) | 273 | 605 | `FD70BAB8…` |
| [paratrooper](paratrooper/) | 31 | 134 | `D709DDEC…` |
| [zaxxon](zaxxon/) | 134 | 105 | `A9214CCE…` |
| [tapper](tapper/) | 583 | 336 | `EC85DB55…` |

For every one of them: every call target, every tail-call entry and every
bracketed constant in the listing is named or explicitly accounted for, and
every name carries the evidence for itself. `annotate.py` checks all of that on
each build and prints it — **read that output, not the symbol file's own prose
about itself.**

All five also have every byte inside a named span -- `_data_spans`, a
contiguous partition of the image with a reason against each extent. That is
the second denominator, and it is the one that catches a symbol file which
names every reference and has still never looked at half the file.
`annotate.py` refuses a gap or an overlap, and writes each span's reason into
the listing as a heading, splitting a `db` run where it has to.

### What is still open

One thing, and it is a measurement rather than a gap.
Hard Hat Mack's static level render reproduces 172 of the 193 placements the
program actually makes. Recall 98% / 87% / 81% by level, precision
94% / 96% / 86%. The 21 that remain are one on Level 1, thirteen on Level 2 and
seven on Level 3, and they fall into two shapes. A ladder on Level 2 — shape 68
at rows 79, 111, 143, 175 and shape 25 at rows 103, 135, 167, all in column 0 —
comes out as a single placement, so the loop is being run once. And a row of
rivets on Level 3 — columns 16, 18, 20 at row 168, each drawn twice as an erase
and a draw — comes out transposed, as a column at 22 with the *rows* stepping
instead. Both are the extractor choosing the wrong register as the loop index.
`hard-hat-mack/tools/verify-screens.py` runs the game under the toolkit's
`comrun.py` and lists every one by value.

None of those is a limit of the method. The single thing that genuinely is —
which arm of a conditional runs — accounts for three placements on Level 1.

### How to check any of this rather than believe it

    cd <game>
    .\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm <path>\nasm.exe
    python ..\..\DOS-Decompiler\tools\docaudit.py .

The first proves the reconstruction and prints what the naming does not cover.
The second finds every number in every document so a stale one is a line
number instead of a surprise.

### A warning that cost five sessions

Ask "is this finished?" against the *right denominator*. Each of these read
100% while something real was missing: 120 of 120 prologues (56 call targets
had none); 312 of 312 referenced addresses (the bytes between them were 40%
unaccounted); 165 of 165 call targets (39 tail-call entries); "39/39 placement
calls explained" (it counted calls that produced *a* placement, not the right
one). A percentage needs its denominator in the same sentence, and the
denominator has to be the thing you actually care about.

## What this repository is for

**Teaching programming to people who do not program yet, by taking apart old
games and rebuilding them.**

That sentence decides almost everything else. It is not an archive, not a
preservation project, and not a showcase. If a choice makes the work more
impressive but less teachable, choose teachable.

Concretely, it means:

- **Explain from the beginning.** The reader may not know what a register is,
  what a game loop does, or why a canvas has two sizes. Explain it the first
  time it appears, in the place it appears.
- **Explain the reasoning, not just the mechanism.** "This is an axis-aligned
  bounding box test" teaches nothing. "A rectangle is cheaper than the real
  outline *and plays better, because players read a near miss as the game
  cheating*" teaches something.
- **End each idea with what transfers.** Almost everything in these games is a
  pattern that reappears elsewhere. Say so, and say where.
- **Length is fine. Padding is not.** The user has asked for thorough
  explanation. That means more paragraphs, not more adjectives.

## The standard shape of a game

```
<game>/
├── CLAUDE.md      context for an agent working in THIS folder
├── README.md      what it is, how to play the port, how to rebuild it
├── docs/
│   ├── 01-the-game.md          history, gameplay, tips, reception
│   ├── 02-architecture.md      how the ORIGINAL program was built
│   ├── 03-the-code.md          the original's routines, annotated
│   ├── 04-porting.md           choosing a target language, trade-offs
│   ├── 05-web-architecture.md  how the PORT is built
│   └── 06-web-code.md          the port's code, walked through
├── web/           the playable port
├── original/      the game as it shipped        — GITIGNORED
└── reference/     anything derived from it      — GITIGNORED
└── recovered/     the reconstructed source      — GITIGNORED
```

Follow it for new games. Cross-link the documents in a header line at the top of
each: *"Document three of six. See … "*.

### Every game carries its own CLAUDE.md

This file is the repository's conventions. A game's own `CLAUDE.md` is the
working reference for that game, and it exists so **an agent can be dropped into
one folder and be productive without the conversation that produced it.**

It should hold, and nothing else:

| | |
|---|---|
| **state of the work** | what is finished, what is measured, what is not |
| **how to regenerate** | the exact command, and the numbers it should print |
| **the traps** | the two or three things that will cost a day if not known — address bases, storage orders, anything the file says that the program then changes |
| **where things are** | a table of offsets worth having in front of you |
| **what is genuinely open** | and what would settle it |

Two rules about it:

- **The numbers must be what the tools print today, not what they printed when
  the documents were written.** The toolkit improves and figures move: after
  ParaTrooper's documents were published its code region went from 87.7% to
  90.9% and its pinned instructions from 236 to 178, and Hard Hat Mack's from
  649 to 320. A game's `CLAUDE.md` is where that drift gets caught, because it
  is the file you read before touching anything.
- **Record predictions that failed, and leave them where they were made.**
  Karateka's README predicted a 6502 translation and was wrong; the prediction
  stays with the result beside it. A falsified prediction on the record is worth
  more than a quiet deletion, because the next person would have made the same
  one.

**Do not create a shared/ or common/ folder** until two games genuinely need the
same thing. Structure invented before it is needed is nearly always the wrong
structure.

## The copyright rule — never break this

Two folders are gitignored in every game, and the reason is worth remembering
because the second one is easy to miss:

- **`original/`** — the game as it shipped. Obviously not ours.
- **`recovered/`** — a reconstruction that assembles or compiles to a
  **byte-identical copy**. Legally this is the same as shipping the binary, just
  in source form.

`.gitignore` also blocks `*.com` and `*.exe` anywhere in the tree as a backstop.

Before any commit that adds files, check that nothing from those folders is
staged. If a user asks to include them, say why it is a problem and offer a
private repository instead — do not just comply, and do not just refuse.

Excerpts of recovered source **inside documentation** are fine and expected:
short routines quoted for commentary, with explanation around them. A whole file
is not.

## Using DOS-Decompiler

The reverse engineering toolkit lives in a **separate repository**:
<https://github.com/agunawijaya/DOS-Decompiler>, cloned locally at
`C:\Projects\DOS-Decompiler`.

Read `AGENTS.md` in that repository before using it — it is the canonical
method and it explains what the tools can and cannot establish.

Typical sequence for a new game:

```powershell
# 0. what is in this folder? Which file is actually the game?
python C:\Projects\DOS-Decompiler\tools\survey.py <game-folder>

# 0a. is that executable in scope? Report the verdict before promising anything.
python C:\Projects\DOS-Decompiler\tools\triage.py <game>.EXE

# 0b. if packed, unpack first
python C:\Projects\DOS-Decompiler\tools\unpack.py <game>.EXE -o unpacked.exe

# --- .COM files take a separate, stronger route ---
python C:\Projects\DOS-Decompiler\tools\comrec.py <game>.COM --out recovered\<game>.asm
nasm -f bin -o recovered\rebuilt.com recovered\<game>.asm     # then compare SHA-256

# --- MZ executables go through the full pipeline ---
. C:\Projects\DOS-Decompiler\env.ps1
C:\Projects\DOS-Decompiler\tools\pipeline.ps1 -Exe <game>.EXE -OutDir out
```

`comrec.py` prints `BYTE-IDENTICAL` or says why not. **Verify it independently**
— reassemble and compare hashes yourself rather than taking the tool's word.

Two things to report accurately every time:

- **A `.COM` route produces assembly, not C.** Check prologue density first
  (`triage.py` reports it). A program with no stack frames was written in
  assembly and has no C to recover.
- **Quote the code-region figure, not the whole-file one.** These games are
  mostly artwork and tables.

## Standards of evidence

The user cares about this more than about polish. It is the difference between
documentation that is useful and documentation that is confident.

- **Verify, do not assume.** Run the command, read the bytes, check the hash. If
  you have not checked something, do not write it as fact.
- **Mark inference.** Use **[inferred]** inline for anything reasoned rather
  than observed, and say what evidence is missing.
- **Keep a list of what is unknown.** Every game's document 02 ends with one.
  Gaps stated plainly are worth more than gaps papered over.
- **The binary outranks the internet.** Secondary sources disagree with each
  other and with the code — ParaTrooper's point values are documented three
  different ways online and none matched the program. Say so when it happens.
- **Report failures.** If a metric got worse, write that down. Negative results
  are kept deliberately.

## Diagrams

**Use Mermaid**, in fenced ```mermaid blocks, so GitHub renders them inline.

- **Explain every diagram.** A line before it saying what it shows, and a line
  after saying what to notice. A diagram nobody can read is decoration.
- Prefer `flowchart` — it is the most reliably rendered. `stateDiagram-v2` is
  fine for genuine state machines.
- Quote every label containing punctuation, `<`, `>` or HTML: `A["like this"]`.
- Check them before committing. There is no renderer available locally, so
  verify structurally: balanced brackets and quotes, matched `subgraph`/`end`,
  no edge pointing at an undeclared node.

## Verifying the port

Each port should be runnable with no build step — open `index.html`.

- Expose a `selfTest()` on `window` that runs in the browser console. It should
  check whatever has broken before.
- **Make the simulation seedable.** `resetGame(seed)` for a reproducible game,
  no argument for a clock seed. A bug you cannot replay is a bug you cannot fix
  — this was learned the hard way on ParaTrooper.
- **Keep logic separate from rendering** so tests can run headless, thousands of
  ticks in milliseconds.
- Check the browser console for errors. A page that loads is not a page that
  works: one syntax error kills an entire classic script while the page still
  renders normally.

Note for agents driving a browser: `requestAnimationFrame` may be suspended in
an automated tab, so the game will not run in real time. Drive `update()`
directly in a loop and call `render()` to inspect frames. **Say clearly that the
feel was not play-tested** if it was not.

## Before committing

- Nothing from `original/` or `recovered/` staged.
- Every internal Markdown link and anchor resolves — including anchors, which
  break silently when a heading is renumbered.
- Every Mermaid block is structurally sound.
- Figures in the documents match what the tools currently print. They drift
  whenever a tool improves.

## Tone

Write plainly. No marketing, no exclamation marks, no "amazing" or "powerful".
The material is interesting on its own; saying so out loud makes it less
convincing, not more.

Be honest about what is unremarkable. ParaTrooper writes directly to video
memory — every fast game did, and the documents say so explicitly, precisely so
that the genuinely unusual things stand out.
