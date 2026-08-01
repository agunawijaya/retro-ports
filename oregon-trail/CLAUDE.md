# Working on The Oregon Trail

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to Oregon Trail.

**If you are starting this game, read [PROMPT.md](PROMPT.md) first.** It is the
brief: what the objective is and what would enrich the toolkit. This file is the
shorter working reference you come back to.

**The objective is the toolkit, not the game.** What this program produced for
`dos-decompiler` matters more than what it produced about wagons.

## State of the work

| | |
|---|---|
| the files | **verified as shipped** — all 19 match the distribution archive byte for byte |
| unpacking | **done** — LZEXE 0.91, 81,896 → 201,184 bytes |
| entry point | **done, authoritative** — `0x10A`, from LZEXE's own header, not guessed |
| compiler | **Turbo Pascal 5.0** — matched against Borland's own `TURBO.TPL` |
| `prior-attempt/src/` | **tested: it is not the original source** — needs TP 6.0/7.0 syntax |
| module structure | **done** — 11 segments, all named, third-party split measured |
| artwork | **done** — 58 of 58 images decoded and rendered |
| data files | **done** — `DIALOGS.REC` is 51 records of 286 bytes, exactly |
| the trail | **done** — 17 landmarks, distances and map coordinates, at `0x23D32` |
| the prior attempt's protection claim | **tested: address right, meaning wrong** |
| game logic as code | **not read** — the routines in `0x00000` and `0x007B6` |
| documents | [four](docs/), written from the above |

Four things went back into the toolkit: `unpack.py` now reads LZEXE's stated
entry point, `tpscan.py` is new, `pcxlib.py` is new, and
`knowledge/00-scope.md` and `02-compiler-fingerprints.md` carry the results.

## Regenerating

```powershell
python <toolkit>\tools\unpack.py original\OREGON.EXE -o work\unpacked.exe
python <toolkit>\tools\tpscan.py work\unpacked.exe --json work\units.json
python <toolkit>\tools\pcxlib.py original\OTMCGA.PCL --extract reference\art\mcga --palette original\PAL.256
python <toolkit>\tools\pcxlib.py original\OTCGA.PCL  --extract reference\art\cga
```

What those should print — if any of it moves, the documents are stale:

```
format                : LZEXE 0.91
original entry point  : offset 0x10A  [packer header (authoritative)]
  (the behavioural heuristic would have said 0x10F -- +5 bytes)
unpacked image        : 201,184 bytes

compiler    : Turbo Pascal  [System unit init at 0x219f0]
DGROUP      : 0x3348  -> data starts at 0x23480
code / data : 144,512 bytes of code, 56,672 bytes of data and stack
units       : 11 code segments carrying 3,080 far calls
runtime     : segment 0x219f -- 6,800 bytes, 1,500 far calls (48% of all calls)

29 decoded, 0 failed        (once per container)
```

`original/The-Oregon-Trail_DOS_EN.zip` is the distribution and every loose file
matches it byte for byte — checked, because this repository has been handed a
patched binary before. `OREGON.EXE` is
`4D53ABB5C55661B0E38CE6F1DBAE82B2875F381BB7D81D04B0CF6B98D52AEFED`.

## Four things that will cost you a day

**Segment words in `work/unpacked.exe` are biased by `0x1000`.** `unpack.py`
dumps memory *after* the decompressor has applied relocations, and it loads at
segment `0x1000`. A far call reading `lcall 0x319F:…` means image-relative
segment `0x219F`. Subtract `0x1000` from every segment word you read. The prior
attempt's notes quote image-relative values, which is why its bytes look one
segment different from anything you disassemble here.

**The image starts 32 bytes into the file.** `unpacked.exe` carries a synthetic
32-byte MZ header. Every address in the documents is an *image* offset.

**`0x14BF3` is a memory check, not copy protection.** See below.

**The version is 5.0, and no string in the file says so.** The runtime error
format is identical across 4.0 to 6.0; the *code* is what separates them.
`tpscan.py --tpl <5.0>/TURBO.TPL --tpl <5.5>/TURBO.TPL` reproduces it. Both
libraries are on the Internet Archive and `fatextract.py` opens the floppy
images; put them wherever you like and pass the paths.

## Where things are

Image offsets.

| | |
|---|---|
| `0x0010A` | the entry point |
| `0x0010A`–`0x00128` | six far calls: Turbo Pascal's chain of unit initialisers |
| `0x00128` | the program's own `begin` block |
| `0x00000`–`0x07B60` | the program's own code — far-called by nobody |
| `0x14BF3` | the memory check |
| `0x14992` | `This product is licensed to:` |
| `0x1582C` | the network licence refusal text |
| `0x1DBF4` | the program's only `INT 21h AH=2Ah` (DOS get date) |
| `0x219F0` | Borland's System unit; its init sets DGROUP, PrefixSeg and the heap |
| `0x21BFD` | `Runtime error `, ` at `, `.` |
| `0x21DA5` | `MemAvail` — walks the free list, returns a 32-bit byte count |
| `0x23480` | DGROUP: code ends, data begins |
| `0x23D32` | the trail table — 17 records: miles, map X, map Y, name |
| `0x24156` | the six illnesses: exhaustion, typhoid, cholera, measles, dysentery, a fever |
| `0x0C0A7` | the health scale: `good\fair\poor\very poor` |
| `0x0E793` | Matt's General Store and its five departments |

### The eleven segments, named

| segment | bytes | whose | what |
|---|---|---|---|
| `0x00000` | 31,584 | MECC | the program, the menu, the trail |
| `0x007B6` | 35,008 | MECC | scoring, the ending, the top ten |
| `0x01042` | 18,656 | MECC | UI, files, saved games, tombstones |
| `0x014D0` | 1,216 | MECC | the artwork loader |
| `0x0151C` | 2,544 | MECC | the licence check |
| `0x015BB` | 12,816 | Genus **[inferred]** | text and fonts |
| `0x018DC` | 19,904 | Genus | the PCX / graphics library |
| `0x01DB8` | 784 | Borland | `Dos` — 18 `INT 21h` and nothing else |
| `0x01DE9` | 13,632 | Borland | `Graph` — names itself in a BGI error string |
| `0x0213D` | 1,568 | Borland **[inferred]** | `Crt` |
| `0x0219F` | 6,800 | Borland | `System` — 48% of all far calls |

**MECC 89,008 (61.6%) · Borland 22,784 (15.8%) · Genus 32,720 (22.6%).** So
38.4% of this program was written by someone other than the people who made the
game; the brief's comparison point, Sopwith, is 9%.

`tpscan.py --strings 2` reproduces the naming in one pass.

### Data files

`OTMCGA.PCL` and `OTCGA.PCL` are pcxLib containers, 29 images each — the same
29 subjects at two colour depths. `PAL.256` is a 9×6 PCX whose image is
irrelevant and whose 256-colour palette is the point.

`DIALOGS.REC` is 51 records of 286 bytes: `string[29]` speaker, `string[255]`
advice. 14,586 ÷ 286 = 51 exactly, which is what makes that a fact rather than
a guess.

## The prior attempt, and the claim that was tested

`prior-attempt/` holds a 17-unit Turbo Pascal reconstruction, six documents and
a JavaScript port, from a session that predates the toolkit. Its README explains
why it is quarantined; the short version is that **nothing in it has been
through an oracle.**

Its most precise claim was:

> The copy protection is a date check at `0x14BF3`, calling Borland's
> `GetDate` and comparing against `0x88B8` = 35,000 days since 1899-12-30 — so
> the game locks itself after 1995.

**The address is exactly right and the meaning is wrong.** There is a far call
at `0x14BF3` into the runtime segment, and `cmp word [bp-4], 0x88B8` at
`0x14C06` — the only occurrence of that comparison in the image. But the
routine called subtracts two far pointers with paragraph normalisation and
walks the free list: it is `MemAvail`. The constant is 35,000 **bytes**, and
the branch beneath it points at a string that settles it:

```
Your computer must have at least 512K memory to run Oregon Trail.
```

35,000 days after 1899-12-30 really is late 1995, which is exactly why the
wrong answer was persuasive. Two readings of one constant; only the string
separates them.

**There is a real protection and it is a network licence check**, not a date:

```
This product is licensed for use by a single computer at a time.
It is currently being used by someone else.
The network version of this program may be licensed from MECC.
```

MECC's school-lab licensing. Located, not traced.

## The capability you now have that earlier sessions did not

**Turbo Pascal 5.0 — the compiler this game was built with — runs here**, under
DOSBox-X:

```powershell
& $env:DOSBOX -silent -nolog -c "mount c <workdir>" -c "c:" -c "TPC X.PAS" -c "exit"
```

`TPC.EXE` and `TURBO.TPL` come out of the 5.0 floppy images on the Internet
Archive via `fatextract.py`. That makes **differential compilation** possible:
write ten lines of Pascal that do the thing you are trying to identify, compile
it with the same compiler, and compare the code against the game's. It is the
route to the game logic, and it is the reason the compiler is worth keeping
around rather than deleting after the version check.

**A recorded negative result, so nobody repeats it.** Searching for code that
references the `Matt's General Store` banner by its offset — as an immediate,
anywhere in the image — finds nothing. TP 5.0 is not addressing string
constants that way here. Differential compilation is how to find out what it
does instead.

## What is genuinely open

1. **The game's logic as code** — the illness model, the store's prices, the
   odds on a river crossing, how pace and rations combine. Located: 66,592
   bytes in segments `0x00000` and `0x007B6`. `prior-attempt/src/` has a unit
   per topic, and it is now known **not** to be the original source, so treat
   it as a description rather than a recovery.
3. **The licence check's code.** Segment `0x0151C`, 2,544 bytes, all strings
   recovered, code not followed. The most self-contained thing left and
   probably an afternoon's work.
4. **An oracle.** `comrun.py` ran `.COM` files only, so nothing here could run
   this program and compare against it — which is why the artwork was checked
   by size-field agreement and by looking, rather than against a running frame.
   **MZ loading is being added to `comrun.py` by concurrent work in the
   toolkit** and was not yet working when this was written. Check `git log`
   there; if it landed, the first thing to test is the memory check at
   `0x14BF3` — force the free heap below 35,000 bytes and the 512K string
   should appear.

## Before you commit

- `original/`, `recovered/`, `reference/` and `work/` are gitignored.
  `reference/` is the one people forget: **thirty of the JavaScript port's
  images turned out to be the game's own artwork converted from
  `OTMCGA.PCL`**, and they were staged until a check caught them. Check
  `git status` — never `git add -A`.
- Nothing in `work/` is worth committing; a 105 MB DOSBox trace and a 6.7 MB
  Ghidra project were deleted from this folder once already.
- **Someone else works in `dos-decompiler`.** Read its `git log` before
  starting and commit only your own files.
- Every figure in every document must match what the tools print today.
