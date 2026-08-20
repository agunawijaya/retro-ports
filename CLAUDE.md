# Working in this repository

Context for any coding agent picking up work here, so the user does not have to
explain it again.

## Where this stands, and what to do next

*Last measured 2026-08-20 (dam-busters + comrec walker fixes; other games
2026-08-02). If you change anything, re-measure and edit this — the counts
below drift the moment a tool improves, and eleven of them had gone stale
within a single session before `tools/docaudit.py` existed.*

Six games are reconstructed. All six rebuild **byte-identically**, which
`build.ps1` checks and refuses to report success without.

| | routines | globals | rebuild |
|---|---|---|---|
| [karateka](karateka/) | 218 | 338 | `C8736BBA…` |
| [hard-hat-mack](hard-hat-mack/) | 273 | 605 | `FD70BAB8…` |
| [paratrooper](paratrooper/) | 31 | 134 | `D709DDEC…` |
| [zaxxon](zaxxon/) | 134 | 105 | `A9214CCE…` |
| [tapper](tapper/) | 583 | 336 | `EC85DB55…` |
| [frogger](frogger/) | 0 | 0 | `D6437F96…` |

**Frogger arrived on 2026-08-02 and nothing in it is named yet.** That is
deliberate: the release is patched, the patch runs the game in a segment ten
paragraphs on, and every name written before that is fixed would be in the
wrong coordinate — the mistake this project has already paid for twice, whose
only symptom is silence. Its `CLAUDE.md` has the evidence and the order.

### One reading in progress

**Dam Busters is through the naming ladder.** 241 routines and 295 globals,
`annotate.py` reports **158 of 158 call targets**, all 6 tail-call entries,
265 of 433 bracketed constants (+15 more as displacements) — still
byte-identical at `D3657960…`. `_data_spans` **now covers the whole image,
112 spans partitioning 65,028 bytes with no gap or overlap.**
[dam-busters/CLAUDE.md](dam-busters/CLAUDE.md) has the state and what is
still open.

Getting there needed three walker fixes in comrec, which took the decode
rate from 12.3% to 26.7% at the same hash before any naming happened. The
narrative is in [dam-busters/BRIEF.md](dam-busters/BRIEF.md); the code went
into `DOS-Decompiler` as `8907d76` (`comrec: follow near-branch wrap and
bare-bx dispatch tables`). Karateka and the 11 `.COM` regression fixtures
still pass unchanged.

### Six more, triaged and waiting

Set up on 2026-08-02 with the binary in place, a `build.ps1`, an empty
`symbols.json`, and a `BRIEF.md` whose numbers were **measured, not guessed**.
Each brief names the one thing to do first.

| | rebuilds | decoded | the thing to know |
|---|---|---|---|
| [championship-boxing](championship-boxing/) | `4A64A595…` | **93.7%** | a 2.5 KB loader plus `BOXING.OVR` and five overlays — a class none of the six belong to |
| [rampage](rampage/) | `8925744E…` | 34.7% | entry twenty bytes from the end of the image |
| [jungle-hunt](jungle-hunt/) | `ECF3BD75…` | 8.8% | `hunt.com` is a PTL Club **crack loader**; the game is `hunt.ptl` |
| [moon-patrol](moon-patrol/) | `FF12627C…` | **0.5%** | control leaves the entry almost at once and the walk cannot follow |
| [alley-cat](alley-cat/) | `4979C886…` | 41.4% | 9 relocations — one over a threshold set for Karateka |
| [ancient-art-of-war](ancient-art-of-war/) | `B26326CE…` | 73.2% | 67 relocations; a 12 KB load image with 87 KB behind it |

All six rebuild. The last two only after a correction worth keeping.

They were first written up here as *"comrec takes the `.COM` route only when
there are no relocations"*. That was an inference from four games, and the code
says something else: the limit was `nreloc > 8`, chosen when Karateka's four
was the only example. **Alley Cat missed it by one relocation.** Raising the
limit, both rebuild byte-identically and decode 41% and 73%.

`comrec.py` now takes `--max-relocations N`, raised per game in its own
`build.ps1` rather than widened for everyone — because the guard protects
against something real. **A byte-identical rebuild does not prove the address
base was right.** Frogger rebuilds exactly while reading half its code from the
wrong segment, and the only symptom is a decode rate that stays low for no
visible reason. Hash first, decode rate second, and neither alone is enough.

Dam Busters added three more walker fixes on 2026-08-19: near-branch
targets that Capstone sign-extends when they wrap the segment, dispatch
tables that use bare `[bx + disp]` instead of `[cs:bx + disp]`, and
negative displacements in those tables. Same class of correction as
`nreloc > 8` — a guard tuned to one game's shape, missed on another. The
first is a hard bug (any single-segment program with a call that wraps);
the second and third fire whenever a `.COM` uses `bx`-relative tables.
Details in [dam-busters/BRIEF.md](dam-busters/BRIEF.md#where-control-went-that-the-walk-could-not-follow-2026-08-19).

For the other five: every call target, every tail-call entry and every
bracketed constant in the listing is named or explicitly accounted for, and
every name carries the evidence for itself. `annotate.py` checks all of that on
each build and prints it — **read that output, not the symbol file's own prose
about itself.**

Those five also have every byte inside a named span -- `_data_spans`, a
contiguous partition of the image with a reason against each extent. That is
the second denominator, and it is the one that catches a symbol file which
names every reference and has still never looked at half the file.
`annotate.py` refuses a gap or an overlap, and writes each span's reason into
the listing as a heading, splitting a `db` run where it has to.

### What is still open

Nothing that reading the file can settle.

Hard Hat Mack's static level render — the last thing on this list for several
sessions — reproduces **186 of the 193** placements the program makes, and
invents **three**. Recall 98% / 95% / 97% by level, precision 98% / 99% / 97%.

The seven that remain are all one thing: `spawn_lunchbox` chooses its shape
with `random() & 3`, and the table it chooses from holds four *different*
entries — 15, 68, 16, 67 — so there is no shape in the file to read. Three of
the seven are its own placements and four are `draw_rivets`, which writes no
selector and draws whatever that pick left behind.

"Which arm of a conditional runs" used to be on this list and is not any more.
The extractor evaluates a branch it can decide: the flag comes from the 6502
translation's own idiom — `mov al, X / inc al / dec al` sets Z from AL, which
is what `LDA` did — and from `cmp reg, imm`. Only forward jumps are followed,
because a back edge is a loop and loops are handled by unrolling the call site.
`draw_pits` and `draw_rivet_row` draw one entry per slot when that slot's state
byte is non-zero; the byte is zero, so the program skips them and now so does
the reading. Six invented placements, gone.

The referee prints a second number as well. It runs the build, keeps the state
it left behind, and asks the reading again *with the run-time values supplied*
— so the gap between the two lines is exactly what being static costs. Right
now there is no gap, which says something worth knowing: the seven are not
missing because the reading lacks data. They are missing because the value is
a random number, and having watched the program pick one tells you nothing
about the next one.

That is the boundary of static extraction, and it is now the *only* thing left
— established per placement rather than asserted about the method. Getting
there took ten bugs, and the one that mattered was in the referee rather than
in the extractor: it had listed the wrong placements by coordinate for three
sessions, and coordinates describe the picture, which is never where the bug
is. Naming the routine that made each one — the return address is a word down
`SS:SP` at the hook — turned it into a work list the same afternoon.

The ten, in the order they were found:

- **A counted loop that runs up.** `mov bl, 1` … `inc byte [V]` … `cmp bl, 5`
  read as the down-loop shape every other loop uses, so `draw_toolboxes` drew
  two at the wrong rows instead of three at the right ones.
- **A zero immediate in decimal.** NASM prints `mov word [sel], 0`, not
  `0x0000`, and the store pattern wanted the `0x` form. `draw_beams` sets its
  shape that way and no other.
- **A selector that outlives its routine.** `draw_rivets` writes none, so it
  needs the last one written; carried in walk order now.
- **A loop kept entirely in memory.** `draw_conveyor` counts down in one
  variable and steps across in another and never puts either in a register
  except to index a table, so there was no loop to see and one of four
  conveyor segments got drawn.
- **…and a `place_pair` erase that is in that loop without touching the
  index.** Unrolling on "does it use BX" gave four draws and one erase.
- **Callee state that is game state.** Writes were isolated wholesale to stop
  two calls to `draw_crate` reading each other's columns — but a column is
  scratch and `hoist_y` is not. The rule is by address now: the drawer
  parameter block stays isolated, everything else comes back.
- **AL never reached the index registers.** `shl al, 1`, `mov bl, al`, `inc bl`
  were all unrecognised, so BL kept whatever the *caller* had left in it.
- **A stored value that still depended on a register that then moved.** A store
  keeps the expression rather than the number, so one call site in a loop can
  be evaluated once per iteration. `spawn_lunchbox` stores its column, does
  `inc bl`, and stores its row — the same expression twice — so both resolved
  with the later BL and the lunchbox came out at (39, 39), its row twice, on
  every screen. Collapsing a stored value at the moment its register changes
  is safe for the loop case, because the drawer is called inside the body and
  its site has already been emitted before the counter steps.

Every one of the ten still produced *a* placement, which is why none of them
ever failed and why the coverage number never moved. The last two did not move
it either — `spawn_lunchbox`'s shape is unreadable whatever its position — but
the reading now puts it at (12, 39), (24, 39) and (20, 188), which is where the
program puts it, instead of at (14, 44) on all three. **A number that does not
change is not the same as a change that did not happen.** See
[knowledge/12](../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md).

- **A selector written with a value nobody could decide.** "Written, and
  undecided" was treated as "not written", which fell back to the last shape
  anyone had resolved. `spawn_lunchbox` stores `shapes[random() & 3]` there, so
  the address does hold a value — it is just not one the file contains — and
  `draw_rivets`, which writes no selector at all, inherited a definite wrong
  shape rather than an admitted unknown. Four more invented placements, gone.

Two candidate fixes were measured and thrown away: clearing the loop counter
when the index is loaded from a variable (`draw_pillar_cell` then unrolled 26
false placements, 186 → 182), and rejecting placements off the 320×200 screen
(the column is in units of each drawer's own scale, so a flat bound threw away
four of Mack's own; scaled, it caught nothing). Neither is in the tree.

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
