# Brief: The Dam Busters — triage and toolkit-fix history

Sydney Development, 1984, published by Accolade. **For current state and the
order to work in, read [CLAUDE.md](CLAUDE.md).** This file preserves how the
work got where it is: the triage on 2026-08-02, the toolkit fixes on
2026-08-19, and the naming pass on 2026-08-20. All numbers below were
**measured, not recalled** at the time they were written.

## Triage (2026-08-02)

- MZ, but **0 relocations** and entry `0000:0000`
- Load image `0x200..0x10004` (65,028 bytes), 124 bytes trailing
- Single-segment: a `.COM` wearing an MZ header

**This is the same shape as Karateka**, and Karateka is the worked example:
an MZ with no relocations is a single-segment program, and comrec
reconstructs it by stripping the header, treating the image as a `.COM`,
and putting the header back on the way out. `build.ps1` here already does
that, copied from Karateka's.

The 124 trailing bytes past the declared load image are worth a look before
anything else — they are outside what DOS loads, so either the header
under-declares the image or something appended them. (Both, effectively:
mzinfo warns about the trailing data, and `build.ps1` puts it back after
comrec ignores it. Dropping it makes the rebuild miss by exactly that much.)

`build.ps1` reported **BYTE-IDENTICAL**, `D3657960…`, at **12.3% decoded** —
the first-day result. "12.3% is low. Same question as everywhere: where does
control go that the walk cannot follow?" That question drove the fixes on
2026-08-19.

## Where control went that the walk could not follow (2026-08-19)

Three limitations in comrec, all uncovered by this game, and every one made
the rebuild look correct while hiding real code as data. All three raised
the decode rate together to **26.7% at the same byte-identical hash** — the
important part is the second half of that sentence, because a walker that
reaches more addresses can only be trusted when the file still assembles
back to what it started as.

- **Wrap-around near calls.** Capstone sign-extends the target of a near
  branch whose signed offset would put it before the segment origin: `E8 C0
  E0` at IP 0x2F prints as `call 0xffffe0f2` for a target the CPU reaches
  at `(0x32 + 0xe0c0) & 0xffff = 0xe0f2`. The walker's `contains_addr` then
  refuses the target and the callee stays as data. Twenty call sites in
  this file take that shape, and every routine reached only through them
  was invisible.
- **Bare-`bx` dispatch tables.** `detect_jump_tables` required a `cs:`
  prefix because Karateka's compiler emits its switch tables that way (data
  through DS, tables through CS). A single-segment .COM has no distinction
  — DS is CS — so `jmp word [bx + 0xdf18]` reaches its table the same way,
  and this game has eleven of them. Every entry in each table pointed at a
  routine the walker had never reached.
- **Negative displacements in those dispatch tables.** Capstone writes
  `[bx - 0x20e8]` for what the 16-bit CPU sees as `[bx + 0xdf18]`. Masking
  to the segment offset makes it findable; leaving the sign there loses
  the one scenery dispatcher (`cs:0xdf18`, ten targets).

Fixes went into `../../DOS-Decompiler/tools/comrec.py`, committed as
`8907d76` (`comrec: follow near-branch wrap and bare-bx dispatch tables`).
The eleven `.COM` regression fixtures still pass byte-identically, and
Karateka still rebuilds byte-identically at `C8736BBA…` with all 218
routines and 338 globals resolving as before — so the changes recover code
without disturbing what already worked.

### Numbers on 2026-08-19

| | before | after |
|---|---|---|
| rebuild | `D3657960…` byte-identical | same |
| bytes decoded as instructions | 8,556 (13.2%) | 17,364 (26.7%) |
| instructions | 2,797 | 5,690 (262 pinned) |
| call targets discovered | 75 | 158 |
| bracketed constants | 245 | 433 |
| indirect jumps resolved | 0 | 13 resolutions from 11 unique tables |
| indirect jumps not resolved | — | 1 (a `jmp bx` whose value comes from `mov bx, word [si]`) |

Eleven dispatchers were resolved, and each says what the file organises
itself around:

| table | targets | what it selects |
|---|---|---|
| `cs:0x00b9` | 9 | called from the main loop by `[0x5db]` — the top-level game phase |
| `cs:0x08d2` | 8 | second-level, same structure, reached from a phase handler |
| `cs:0x1045` | 4 | selects by `[0x104]` — a small-arity choice |
| `cs:0x1610` | 19 | large fan-out from `[0x1718]` — the menu action table |
| `cs:0x4e82` | 10 | called from four sites at 0x4e82/0x4e92/0x4ea2/0x4eb2 — the same table read at four offsets |
| `cs:0x6f3e` | 3 | selects by `bx`, guarded `cmp bx, 6 / jae` — one of six phases |
| `cs:0x7e9e` | 3 | reached from `[bx + 0x7e9e]` |
| `cs:0xdf18` | 10 | the drawing-DSL opcode dispatcher, called through `[bx - 0x20e8]` |

## Naming pass (2026-08-20)

The walker fixes exposed 130 more call targets. The naming pass then walked
outward from the entry, in five sittings:

| after | routines | globals | call-target coverage | bracketed coverage |
|---|---|---|---|---|
| initial batch (entry + subsystems + phase 4) | 25 | 28 | 17 of 158 | 17 of 433 |
| all 8 phases | 74 | 36 | 28 of 158 | 25 of 433 |
| per_frame_step chain | 101 | 66 | 50 of 158 | 55 of 433 |
| drawing subsystem | 131 | 85 | 70 of 158 | 71 of 433 |
| 3D + rendering + bombrun | **168** | **127** | **104 of 158** | **111 of 433** |

Two things learnt during the pass, worth keeping:

- **A routine that touches four values in a row is not necessarily a slider
  bank.** The four handlers at `L_01895..L_018CF` were named
  `adjust_engine_slider_c_1..4` on inspection of their shape (`bx = 0..6`
  step 2, shared tail-call body). Reading `L_01898`'s body more carefully
  showed `or byte [bx + engine_states], 1` — a one-shot flag set, not an
  increment. They are the **fire-extinguisher** handlers. Names fixed,
  rebuild still byte-identical. `symbols.json` records the corrected
  reading.
- **A single Edit can drop 17 entries silently.** A malformed replacement
  that closed the routines section early let the JSON parser take the
  duplicate `globals` block that followed, dropping 17 subsystem routines.
  `annotate.py`'s "N of 158 call targets" number caught it because it went
  down instead of up. Reserialised the JSON with a Python script, restored
  the entries, verified byte-identity. **Watch the coverage numbers move
  in the direction the change should push them.**

## The rules, and they do not bend

**Nothing derived from the game may ever be committed.** Not the binary,
not a byte-identical reconstruction of it, not extracted sprites, not
memory dumps, not screenshots. `original/`, `recovered/` and `reference/`
are gitignored and game binaries are blocked repository-wide as a
backstop. Read what you staged before every commit that adds files; never
`git add -A`.

**Byte-identity is the floor, not the achievement.** Emitting the whole
file as `db` would also hash correctly and tell you nothing. The number
that matters is how much came back as instructions, and after that how
much has a name with evidence behind it.

**Measure, never recall.** `annotate.py` prints the coverage numbers on
every build. Read that output, not this document's memory of it.

**Every name carries its evidence.** A name with no `why` is a guess the
next reader will believe. This project has published three of those and
withdrawn them.

## Where to look

| | |
|---|---|
| current state, next steps | [CLAUDE.md](CLAUDE.md) |
| the conventions | [`../CLAUDE.md`](../CLAUDE.md) |
| a game taken all the way | [`../paratrooper/`](../paratrooper/) — six documents and a playable port |
| the fullest symbol file | [`../tapper/symbols.json`](../tapper/symbols.json) — 583 routines, 336 globals, 43 spans |
| the walker fixes | `../../DOS-Decompiler/tools/comrec.py` at commit `8907d76` |
| how to choose a hook | [`../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md`](../../DOS-Decompiler/knowledge/12-hooking-the-right-thing.md) |
| naming hand-written asm | [`../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md`](../../DOS-Decompiler/knowledge/13-naming-hand-written-assembly.md) |
| a port brief, for later | [`../karateka/PORT-BRIEF.md`](../karateka/PORT-BRIEF.md) |
