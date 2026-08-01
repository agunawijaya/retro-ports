# Working on Karateka

Context for an agent picking up work in this folder. The
[root CLAUDE.md](../CLAUDE.md) still applies — this only adds what is specific
to Karateka.

Read [docs/02-architecture.md](docs/02-architecture.md) first. It is the only
document written so far and it holds everything established.

## State of the work

**Just started. The reconstruction is done; almost nothing else is.**

| | |
|---|---|
| rebuild | byte-identical, rung 1b — the whole `.EXE`, header and all |
| code region | **85.0% recovered** |
| the ninety data files | container format settled, record format **not** |
| documents | 1 of 4 |
| port | none, and not in scope yet |

## Regenerating

```powershell
python <path-to>\dos-decompiler\tools\comrec.py `
       original\KARATEKA.EXE --out recovered\karateka.asm
```

**No flags.** `comrec.py` recognises the single-segment MZ, strips the header
and takes the entry from `CS:IP`.

| | |
|---|---|
| SHA-256 | `c8736bba30cd31d966756c812b673f56b753061354ffb67fca835c3ca2e9f2b2` |
| size | 87,990 bytes (512 header + 87,478 image) |
| instructions | 9,740 (918 pinned) |
| code region `0x0000..0x6C9D` | 27,805 bytes, **85.0% recovered** |
| whole file | 29.1% |

**Verifying it takes two steps, not one**, because the source covers the image
and the header is written out beside it:

```powershell
nasm -f bin -o image.bin recovered\karateka.asm
cmd /c copy /b recovered\karateka.mzheader + image.bin rebuilt.exe
```

`rebuilt.exe` must equal `original\KARATEKA.EXE`. **Comparing `image.bin`
against the `.EXE` is the mistake to avoid** — it is 512 bytes short and will
look like a failure that is not one.

## The three things that will trip you

**Addresses are file offsets minus 512.** The MZ header is stripped before the
walk, so image offset `0x2` is file offset `0x202`. The documents use image
offsets. Get this wrong and every lookup lands half a kilobyte early.

**Code and data have different bases.** The entry stub sets `DS = image +
0x6CA0` once and never touches segments again, so a bare `[0x0F]` in the code
means image offset `0x6CAF`. The code region ends at `0x6C9D`, which is the
same boundary found by walking rather than by reading the constant.

**`reference/KARATEKA_NOCHK.EXE` is a patched copy someone else made.** It is
not the shipped game. Decompiling it by accident produces a byte-identical
reconstruction of the patch, and nothing would say so. Everything established
so far is from `original/KARATEKA.EXE`.

## The data files

Twenty-eight `.IND`/`.DAT` pairs, plus loose ones. The container is settled and
verified against all twenty-eight at once:

```
.IND    (uint16 id, uint16 offset) pairs, both ascending
        terminated by 0xFFFF followed by the total length
        padded to a fixed size with 0x80
.DAT    the records back to back, then exactly 128 bytes of 0x80 padding
```

A record's length is the next record's offset minus its own.

**The record format is settled for the records the game draws**, and it was
settled by running the game rather than by inspection. The blitter at image
`0x00AE7` reads one byte per scanline and steps `add di, 0x50`, so:

```
byte 0   width, in bytes
byte 1   height, in scanlines
byte 2   a flag -- 0x01 everywhere seen
byte 3+  width x height raw bytes, column-major -- no compression
```

Four records checked against what the blitter consumed: 864, 192, 864, 12
bytes, all exact, each starting three bytes into its record.

**It holds for 70 of 666 records overall**, and the split is clean: every `KM*`
file has zero matches. **[inferred]** `KS` is the shape and `KM` the mask. The
next step is named — find the code that reads a `KM` buffer, the same way this
one was found.

**An earlier reading of this was wrong and is worth remembering.** `0x7B` as
*escape, value, count* decoded 282 of 284 records without running off the end.
That is the kind of number that ends an investigation. It failed the second
test — decoded length against `width x height` — 274 times out of 284, and
`0x7B` turned out to be an ordinary pixel value.

## A prediction that was made and failed

The README predicted this would be a mechanical 6502 translation like
[Hard Hat Mack](../hard-hat-mack/), since Karateka is Jordan Mechner's Apple II
game. It said so in a form that could fail, and it failed:

| | Hard Hat Mack | Karateka |
|---|---|---|
| `cmc` | 391, 99% straight after a compare | **0** |
| `cmp` / `sub` | 431 | 914 |

Hand-written 8088 assembly. Broderbund's conversion was a rewrite where
Electronic Arts' was a translation. **Leave the prediction in the README with
the result beside it** — a falsified prediction on the record is worth more than
a quiet deletion.

## What to do next

1. **The record format**, via `comrun.py` rather than by inspection.
2. **A container reader in the toolkit**, not in this folder — an index-and-heap
   pair is not Broderbund's invention and the next game may use one.
3. **The remaining three documents.** `01-the-game.md`, `03-the-code.md`,
   `04-porting.md`, following [Hard Hat Mack](../hard-hat-mack/docs/).
4. **The Apple II original** is in `reference/apple-ii/`, six disk images. Now
   that the DOS version is known *not* to be a translation, the comparison is
   more interesting rather than less: two independent implementations of one
   design.

## Before you commit

- `original/`, `recovered/` and `reference/` are all gitignored. The third one
  is the one people forget: extracted sprites and memory dumps are the game.
  Check `git status` — never `git add -A`.
- `prior-attempt/` is committed and is **unverified**; see its own README before
  believing anything in it.
- Every figure in the documents must match what the tools print now.
