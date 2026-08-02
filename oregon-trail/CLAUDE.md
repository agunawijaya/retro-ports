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
| artwork | **done and verified against the running game** — LOGO.004 matches the drawn frame 17,600/17,600 pixels |
| data files | **done** — `DIALOGS.REC` is 51 records of 286 bytes, exactly |
| the trail | **done** — 17 landmarks, distances and map coordinates, at `0x23D32` |
| the prior attempt's protection claim | **tested: address right, meaning wrong** |
| the real protection | **traced in full** — and it does not refuse; see below |
| the memory check | **traced, and shown unreachable** — DOS refuses to load the program before the heap can fall that low |
| runtime call offsets | **established by differential compilation**, not guessed |
| game logic as code | **chance model, store and settings done** — 29 `Random` sites, the casualty routine, every store price, the pace hours; what is *not* read is the arithmetic joining pace and rations to the odds |
| byte-identical rebuild | **not reachable, and the reason is measured** — 22.6% of the code is a Genus library that is not archived |
| documents | [four](docs/), written from the above |

Five things went back into the toolkit: `unpack.py` now reads LZEXE's stated
entry point, `tpscan.py` is new, `pcxlib.py` is new, `comrun.py` now fills in
the interrupt vector table and answers what a Pascal runtime asks of DOS, and
`knowledge/00-scope.md` and `02-compiler-fingerprints.md` carry the results.

The `comrun.py` one is the most transferable, because the bug it fixed was
invisible. Turbo Pascal's `MsDos` and `Intr` reach DOS by far-calling through
the vector table rather than by executing `int`, so an emulator with a zeroed
table sends the program to `0000:0000` without raising anything anyone could
see. That cost this folder three wrong explanations before it was found.

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

## Driving the game under emulation

`comrun.py` now runs this program properly, and that is the cheapest way to get
a number the code will not give up. This sequence reaches **Matt's General
Store** — past the title, no saved game, banker, five names, accept, leave in
March:

```powershell
python <toolkit>	ools\comrun.py original\OREGON.EXE --files original `
  --budget 90000000 --png store.png `
  --keys 0x1C0D,1,0x1C0D,N,0x1C0D,1,0x1C0D,1,0x1C0D,0x1C0D,A,B,C,0x1C0D,`
D,E,F,0x1C0D,G,H,I,0x1C0D,J,K,L,0x1C0D,M,N,O,0x1C0D,0x1C0D,1,0x1C0D,`
0x1C0D,Y,0x1C0D,1,0x1C0D,0x1C0D,0x1C0D,0x1C0D,0x1C0D
```

`0x1C0D` is Enter as scancode:ASCII; bare letters are characters. Add three more
keys to enter a department and the prices appear. It takes a few minutes.

Confirmed this way and not by reading: the journey starts **1 March 1848**, a
banker begins with **$1,600**, and the party is **five** people.

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
| `0x24112` | pace and ration words: steady, strenuous, grueling, filling, meager, bare bones |
| `0x24156` | the six illnesses: exhaustion, typhoid, cholera, measles, dysentery, a fever |
| `0x0DE5C` | the store script — every price, in the shopkeeper's dialogue |
| `0x09DE0` | the pace screen: 8, 12 and 16 hours a day |
| `0x0A2BE` | the rations screen |
| `0x0C0A7` | the health scale: `good\fair\poor\very poor` |
| `0x0E793` | Matt's General Store and its five departments |
| `0x134D6` | the casualty routine — takes the odds as a `Real`, five callers |

Data-segment offsets (add `0x23480` for an image offset):

| | |
|---|---|
| `DS:0x17FE` | the party — 11-byte records, a `string[10]` name each; member 0 is the player |
| `DS:0x183F` | food in pounds — scored at one point per 25 |
| `DS:0x1842` | bullets — one point per 50 **[inferred]** |
| `DS:0x1847` | cash, a 6-byte `Real` — one point per $5 **[inferred]** |
| `DS:0x16B2` | the timer tick counter, a 32-bit `LongInt` |
| `DS:0x1020` | the network licence timeout, in minutes: 30 |

### Turbo Pascal 5.0 runtime calls, established by body-matching

Offsets shift between programs, so these are **this program's** and were found
by compiling probes and matching 24-byte routine bodies, not by a table.

| | |
|---|---|
| `System+0x00D8` | `Halt` |
| `System+0x0207` | `IOResult` |
| `System+0x020E` | the automatic `{$I+}` check after every I/O statement |
| `System+0x0C48` `0x0C4E` `0x0C5A` `0x0C60` | `Real` add, subtract, multiply, divide |
| `System+0x0C6A` | `Real` compare |
| `System+0x0C6E` | `LongInt` → `Real` |
| `System+0x0C72` | `Trunc` |
| `System+0x0C94` | `Random(n)` |
| `System+0x0CAA` | `Random : Real` |
| `System+0x03B5` | `MemAvail` |
| `System+0x1714` `0x1742` `0x174B` `0x17C3` `0x17F7` `0x17FE` | `Assign`, `Reset`, `Rewrite`, `Close`, `Read`, `Write` |

### The eleven segments, named

| segment | bytes | whose | what |
|---|---|---|---|
| `0x00000` | 31,584 | MECC | the program, the menu, the trail |
| `0x007B6` | 35,008 | MECC | scoring, the ending, the top ten |
| `0x01042` | 18,656 | MECC | UI, files, saved games, tombstones |
| `0x014D0` | 1,216 | MECC | the artwork loader |
| `0x0151C` | 2,544 | MECC | the licence check |
| `0x015BB` | 12,816 | not Borland; Genus **[inferred]** | text and fonts |
| `0x018DC` | 19,904 | not Borland; Genus | the PCX / graphics library |
| `0x01DB8` | 784 | Borland | `Dos` — 98% covered by `TURBO.TPL` |
| `0x01DE9` | 13,632 | Borland | `Graph` — 74% by `GRAPH.TPU`, one 6,636-byte run |
| `0x0213D` | 1,568 | Borland | `Crt` — 71% covered by `TURBO.TPL` |
| `0x0219F` | 6,800 | Borland | `System` — 87%, and 48% of all far calls |

Every one of those percentages comes from `tpscan.py`'s `tpl_match` against
Borland's own libraries. The separation is clean: four segments above 71%,
everything else at or below 0.1%.

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

MECC's school-lab licensing, and it is now
[traced in full](docs/03-the-code.md#the-protection-traced). Four things to know
before touching it again:

- It reads **`PRODUCT.PF`**, 350 bytes, shipped with the game. Delete that file
  and the program halts with *"This disk appears to be damaged"*.
- **It does not refuse on a local disk.** The network branch is skipped unless
  `INT 21h AX=4409h` says the drive is remote. An earlier session recorded the
  opposite; that was the emulator having no file system.
- The network licence is a **lease on the file's modification timestamp**,
  30 minutes, released on exit by restoring the old stamp. No server.
- `0000:0132` in the call is not a pointer, it is **306** — MECC's catalogue
  number for this title.

The record layout is confirmed behaviourally: seven edits to `PRODUCT.PF`, seven
matching predictions, including the demo counter being decremented and written
back.

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

It has since done exactly that, twice. It named every runtime call in the
licence check, and it produced the more useful of the two results —
**a table of runtime-call offsets is not portable between two programs built by
the same compiler**, because Turbo Pascal smart-links and a routine you do not
call is not in the file. Only the prefix up to the first omitted routine is
stable. `Halt` at `System+0x00D8`, `IOResult` at `System+0x0207` and the
automatic I/O check at `System+0x020E` held in every probe and in the game;
nothing higher did.

**A recorded negative result, so nobody repeats it — and it has now been
searched for twice.** The first search looked for the `Matt's General Store`
banner's offset as an immediate anywhere in the image and found nothing. The
second knew what to look for: TP 5.0 addresses a string constant as
`BF <off16> / 0E 57` — `mov di, offset` then `push cs / push di` — which
`strefs.py` in the scratchpad matches, and which finds **266** string references
elsewhere in the program.

It still finds nothing for the store, and the check has since been redone with
the offsets corrected — the banner's length byte is at `0x0E793`, not `0x0E79F`,
so the first attempt searched for the wrong number. With the right one
(`0x6C33`) the answer is the same, and the same for five other strings in the
block: **no reference, and no offset table either.**

The screen is definitely drawn — there is a photograph of it in
[document three](docs/03-the-code.md#when-reading-fails-play-it) — so something
addresses those strings. A base register loaded once and walked forward is the
obvious guess, since they are contiguous, but the first address is not in the
program as a literal either. **How the store's text is addressed is genuinely
unknown**, and it is the most concrete unsolved thing in the folder.

**The store is fully priced**, and it was never hidden — the game states every
price in the shopkeeper's dialogue, which walks straight out of the file from
`0x0DE5C`:

| | | |
|---|---|---|
| oxen | $40 a yoke, 2 oxen per yoke | max 20 oxen |
| food | 20 cents a pound | max 2,000 pounds |
| clothing | $10.00 a set | — |
| ammunition | $2.00 a box of 20 bullets | — |
| spare parts | wheel, axle, tongue, $10 each | max 3 |

The ferry, elsewhere, is $5.00. Only food's price is *also* a `Real` constant in
the code (`0.2` at `0x0E210`); the other four are integer arithmetic, which is
why searching for a price table finds nothing — there is no table, there are
five routines. Oxen and food were confirmed against the running game.

**Redirection does not work on this program.** `OREGON.EXE > OUT.TXT` produces
an empty file every time, because `uses Crt` replaces the driver behind `Output`
with one that writes into video memory, so DOS never sees the text. To read what
it printed, run a second program afterwards that dumps `$B800:0000`; twenty
lines of Pascal, and it recovered every message quoted in the documents.

## What is genuinely open

1. **The game's logic as code** — the illness model, the store's prices, the
   odds on a river crossing, how pace and rations combine. Located: 66,592
   bytes in segments `0x00000` and `0x007B6`. `prior-attempt/src/` has a unit
   per topic, and it is now known **not** to be the original source, so treat
   it as a description rather than a recovery.
2. **The ten `SetIntVec` calls.** The program hooks ten interrupt vectors and
   restores them with `SwapVectors`. That is where the keyboard, the timer and
   the joystick will be, and none of it has been looked at.
3. **What the second `GetDate`/`GetTime` pair is for.** One pair belongs to the
   licence lease; the other does not.
4. **Nothing, on the artwork.** `comrun.py` now runs this program to its
   title screen, and `LOGO.004` decodes to exactly what the game draws — all
   17,600 pixels. Later screens have not been compared; the way to do it is
   `--keys` to get past the title and `--png` again.

**Do not repeat these.** The memory check at `0x14BF3` cannot be provoked — the
ladder is in [document three](docs/03-the-code.md#and-the-check-can-never-fire),
and the failure levels are 243K (DOS refuses to load) against a heap that is
already above 35,000 bytes at the minimum block. And the licence check does not
refuse on a local disk, so there is nothing there to explain.

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
