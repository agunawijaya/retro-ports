# Working on ParaTrooper

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to ParaTrooper, so that facts already established are not re-derived.

Read [docs/02-architecture.md](docs/02-architecture.md) before changing anything
that touches the binary, and [docs/05-web-architecture.md](docs/05-web-architecture.md)
before changing the port. This file is the working reference; the documents are
the explanation.

## State of the work

**Finished, and it is the only game here that is.** The rebuild is
byte-identical, the data formats are decoded, and there is a playable browser
port with its own two documents.

Six documents, the full set: the game, the architecture, the code, the porting
decision, the port's architecture, the port's code.

Treat this folder as the reference implementation. When another game asks "what
should the finished state look like", the answer is here.

## Source you can rebuild

`recovered/paratrooper.asm` is correct and is not source. `symbols.json` holds the
reading — 5 routines and 11 globals, each with the evidence for
its name — and the toolkit's `annotate.py` applies it.

```powershell
.uild.ps1 -Toolkit ..\..\dos-decompiler -Nasm C:\path	o
asm.exe
```

Three steps: reconstruct, name, **rebuild and compare**. Names go in as
`%define`s and label renames only, so NASM emits the bytes it emitted before
they existed, and the script refuses to report success on anything short of the
original's SHA-256.

**This game is not compiled C** — zero `push bp` prologues — so routines are
enumerated by *call target*, not by prologue, and `probelib.py` finds nothing
in it. There is no C runtime here to identify.

Nothing the build produces may be committed: `recovered/` is gitignored,
because a byte-identical reconstruction is the game whether or not it has names
on it.

## Regenerating

```powershell
python <path-to>\dos-decompiler\tools\comrec.py `
       original\ParaTrooper.1982.com --out recovered\paratrooper.asm
```

**No flags.** The two-base layout is found from the entry stub. If you find
yourself reaching for `--segment` or `--entry`, something has regressed in the
toolkit.

| | |
|---|---|
| SHA-256 | `D709DDEC…09342` |
| size | 16,400 bytes |
| instructions | 2,017 (178 pinned) |
| segments | `0x0000+` at base `0x0100`, `0x2B40+` at base `0x0000` |
| code region `0x2B40..0x4010` | 5,328 bytes, **90.9% recovered** |
| whole file | 31.8% |

**These numbers have moved since the documents were written**, because the
toolkit improved underneath them: the code region was 87.7% and 236 instructions
were pinned. If you touch this game, check the documents against what the tools
print now — the root CLAUDE.md requires figures to match, and these are the
oldest figures in the repository.

## The two things that will trip you

**The file has two address bases.** A `retf` in the entry stub is a computed far
jump: everything from file `0x2B40` is addressed from `0`, everything before it
from `0x100`. Two thirds of the file is data before the code even starts.

**Read the second number, not the first.** 31.8% of the file came back as code,
and that describes the *game* — most of ParaTrooper is lookup tables, sprites, a
digit font and text. 90.9% of the code region describes the *recovery*. Quoting
the first number as if it measured the work is the mistake this repository
corrected in its own documents.

## What the port is, and what it is not

`web/` is HTML, CSS and plain JavaScript — no build step, no dependencies, open
`index.html`. It is a **rewrite informed by the decompilation**, not a
translation of it.

Deliberate departures from the original are listed in
[docs/05-web-architecture.md](docs/05-web-architecture.md) and must stay listed.
A port that quietly fixes something is worth less than one that says what it
fixed.

`window.selfTest()` runs four checks in the browser console. Keep it working.

## Two traps the port already fell into

**The low bits of a power-of-two LCG are a counter, not random.** `rnd() % 4`
returned 2, 3, 0, 1 forever — every wave was jets, and four of eight seeds hung
the game. Scale into the range, never take a modulus:

```js
function rndInt(n) { return Math.floor((rnd() / 65536) * n); }
```

**One stray `const` inside a function killed the whole script.** A redeclaration
is a `SyntaxError`, and a classic script with a syntax error does not run at all
while the page still loads normally. If the port goes blank, open the console
before you debug anything else.

## Before you commit

- `original/` and `recovered/` are gitignored, and `recovered/paratrooper.asm`
  assembles to the game. Check `git status` — never `git add -A`.
- Every figure in the six documents must match what the tools print now.
- Every Markdown link and anchor must resolve; there is no renderer here, so
  check Mermaid blocks structurally — balanced brackets and quotes, matched
  `subgraph`/`end`, no edge to an undeclared node.
