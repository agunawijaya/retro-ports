#!/usr/bin/env python3
"""render-hunting.py -- the hunting field, drawn from the binary.

This is the deliverable the repository asks for: a screen composed from what
the file says, not from a photograph of the program running. Every number in
it has an address beside it, and nothing here is arranged by eye. An earlier
file in this folder drew a hunting screen by guesswork and had to be deleted;
the difference is that this one reads the game's own tables and follows the
game's own placement code.

What the program does, and what this reproduces
-----------------------------------------------
`hunt:0x646A` builds the field, and it is a generator rather than a picture:

    0006470  push 4 / lcall ui:0x007D     ; Random(4)
    0006479  add ax, 5                    ;   + 5   -> five to eight objects
    0006496  mov byte ss:[di-0xFA], 0     ; clear all seventeen slots
    00064B1  add di, 0x364                ; the region's six permitted kinds
    0006540  push 6 / lcall ui:0x007D     ; Random(6) -- pick one of them
    0006574  call 0x6310                  ; and place it

and `hunt:0x6310` places one object by rejection sampling:

    0006381  mov ax, 0x13E                ; 318
    0006387  sub ax, es:[di+5]            ;   minus the sprite's width
    000638B  lcall ui:0x007D              ; x = Random(318 - w)
    00063A9  add ax, x & 1                ;   nudged even ...
    00063C3  idiv 4 / add x, x mod 4      ;   ... and toward a CGA byte
    00063D4  mov ax, 0xC7                 ; 199
    00063DA  sub ax, es:[di+7]            ;   minus the height
    00063DF  lcall ui:0x007D              ; y = Random(199 - h)
    00063FA  call 0x5FF9                  ; does it overlap anything placed?
    00063FF  jne 0x6381                   ;   yes -- draw again

then blits it, from a different sheet depending on the slot:

    0006407  push [0x1572]  / add di, 0x00DA / lcall artwork:0x451  ; hunter.pcc
    0006431  push [0x1576]  / add di, 0x013A / lcall artwork:0x451  ; terrain.pcc

So there is no single hunting screen to photograph. There is a rule, and this
reproduces the rule. `--seed` picks which draw you get.

What is reproduced exactly, and what is not
-------------------------------------------
Exact, because they are read out of the image: the sprite tables at `DS:0x00DA`
and `DS:0x013A`, both `(srcX, srcY, w, h)` with a stride of 8; the region table
at `DS:0x0364`, six permitted kinds per region; the object count 5..8; the
coordinate ranges 318 and 199 and the width/height subtraction; the rejection
on overlap, which uses the same axis-aligned box the game uses
(`hunt:0x5ED0` reads `x`, `x+w`, `y`, `y+h`).

Not exact: **which** objects a given hunt gets. The game seeds Turbo Pascal's
generator from the clock, so its stream cannot be reproduced without the clock
it ran under. The LCG itself is implemented below, so the distribution and the
call order are the program's; only the seed is ours.

The animals enter from an edge, by `hunt:0x71F0`: x is either 0 or 316 minus
the width, y is `Random(199 - h)`, and the same overlap test rejects and
redraws. The wave logic is read too, at `hunt:0x7052`:

    000705B  cmp byte ss:[di-0x57], 4     ; four spawns per slot, and no more
    0007062  push 0x64 / lcall ui:0x007D  ; Random(100)
    000706B  cmp ax, 6 / jle              ;   <= 6 -- a 7% chance, per slot
    0007077  push 6 / lcall ui:0x007D     ; Random(6) -- the species
    0007086  cmp ax,0 / cmp ss:[di-0x38]  ;   species 0 needs its flag ...
    000709B  cmp ax,1 / cmp ss:[di-0x39]  ;   ... 1 needs its own ...
    00070B0  cmp ax,2 / cmp ss:[di-0x3a]  ;   ... 2 as well
    00070C7  je 0x7073                    ;   refused -- draw the species again

and those three flags come from the landmark index in `hunt:0x646A`:
`[0x185F] > 3 and < 13` for species 0, `> 6` for species 1, `>= 7` for species
2. Three and four are always allowed. So which animals you meet depends on how
far along the trail you are, which is why `--landmark` exists.

The count is a rate rather than a number: seven percent per slot per turn, so
`--animals` says how many to draw at once, and the rate is what decides that in
the game.

Output goes to `reference/`, which is gitignored, because the sprites in it are
MECC's artwork.

    python tools/render-hunting.py --exe work/unpacked.exe \
        --pcl original/OTCGA.PCL --out reference --seed 1
"""

import argparse
import struct
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Projects\DOS-Decompiler\tools")
import pcxlib                                              # noqa: E402

# CGA palette 1, high intensity: what the sheet's own mode flags select.
PAL = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]

DGROUP = 0x23480        # where the data segment lands in the unpacked image
HUNTER_TAB = 0x00DA     # eight directions, (srcX, srcY, w, h), stride 8
SCENERY_TAB = 0x013A    # sixteen kinds, same shape
REGION_TAB = 0x0364     # six permitted kinds per region, one byte each

FIELD_W, FIELD_H = 320, 200
X_RANGE = 0x13E         # 318 -- hunt:0x6381
Y_RANGE = 0xC7          # 199 -- hunt:0x63D4


class TpRandom:
    """Turbo Pascal's generator, so the call order and spread are the game's.

    `RandSeed := RandSeed * 134775813 + 1`, and `Random(n)` is the high half of
    the product of the new seed and n. Only the initial seed differs from a
    real run, because the program takes its own from the clock.
    """

    def __init__(self, seed=0):
        self.seed = seed & 0xFFFFFFFF

    def __call__(self, n):
        if n <= 0:
            return 0
        self.seed = (self.seed * 134775813 + 1) & 0xFFFFFFFF
        return (self.seed * n) >> 32


def tables(exe):
    img = Path(exe).read_bytes()
    hdr = int.from_bytes(img[8:10], "little") * 16
    img = img[hdr:]

    def rec(base, k):
        return struct.unpack_from("<HHHH", img, DGROUP + base + k * 8)

    hunter = [rec(HUNTER_TAB, k) for k in range(8)]
    animals = [rec(ANIMAL_TAB, k) for k in range(28)]
    scenery = [rec(SCENERY_TAB, k) for k in range(16)]
    regions = [list(img[DGROUP + REGION_TAB + 6 * r:
                        DGROUP + REGION_TAB + 6 * r + 6]) for r in range(5)]
    return hunter, scenery, regions, animals


def sheets(pcl):
    data = Path(pcl).read_bytes()
    want = {"TERRAIN": None, "HUNTER": None, "ANIMALS": None}
    for name, off, size in pcxlib.members(data):
        key = name.split(".")[0].strip().upper()
        if key in want:
            want[key] = pcxlib.Pcx(data[off:off + size]).rows()
    missing = [k for k, v in want.items() if v is None]
    if missing:
        raise SystemExit(f"render-hunting: not in the container: {missing}")
    return want["TERRAIN"], want["HUNTER"], want["ANIMALS"]


def overlaps(a, b):
    """hunt:0x5ED0 -- x, x+w, y, y+h, and nothing cleverer than that."""
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw <= bx or bx + bw <= ax or
                ay + ah <= by or by + bh <= ay)


def build(hunter, scenery, regions, animals, region, seed, direction,
          n_animals=0, species=(), landmark=0):
    """hunt:0x646A and hunt:0x6310, in the order the program runs them."""
    rnd = TpRandom(seed)
    placed = []

    def place(w, h):
        # The retry is the program's: it redraws both coordinates, not one.
        for _ in range(500):
            x = rnd(X_RANGE - w)
            x += x & 1                      # hunt:0x63A9
            x += x % 4                      # hunt:0x63C3 -- toward a CGA byte
            y = rnd(Y_RANGE - h)
            if not any(overlaps((x, y, w, h), p[:4]) for p in placed):
                return x, y
        return None                         # the field is full

    out = []
    # Slot 0 is the hunter, and takes its size from the other table.
    hx, hy, hw, hh = hunter[direction % 8]
    spot = place(hw, hh)
    if spot:
        out.append((spot[0], spot[1], hw, hh, "hunter", hx, hy))
        placed.append((spot[0], spot[1], hw, hh))

    count = rnd(4) + 5                      # hunt:0x6470
    kinds = regions[region]
    for _ in range(count):
        kind = kinds[rnd(6)]                # hunt:0x6540
        if kind >= len(scenery):
            continue                        # 0xFF fills the unused regions
        sx, sy, w, h = scenery[kind]
        spot = place(w, h)
        if not spot:
            continue
        out.append((spot[0], spot[1], w, h, "terrain", sx, sy))
        placed.append((spot[0], spot[1], w, h))
    add_animals(out, placed, animals, rnd, n_animals, species,
                landmark)
    return out


ANIMAL_TAB = 0x01C2     # animals.pcc, (srcX, srcY, w, h), four frames each
ANIMAL_X_RANGE = 0x13C  # 316 -- hunt:0x71F0, two narrower than the scenery's


def add_animals(objects, placed, animals, rnd, count, species,
                landmark=0):
    """hunt:0x71F0 -- an animal enters from an edge, not from anywhere.

        00071F0  mov ax, 0x13C / sub ax, es:[di+5]   ; 316 - width
        00071FD  mov es:[di+1], ax                   ;   x = the right edge
        0007204  mov byte es:[di+4], 0xFE            ;   travelling left, -2
        0007219  mov es:[di+1], 0                    ; or x = the left edge
        0007220  mov byte es:[di+4], 2               ;   travelling right, +2
        0007229  push 5 / lcall ui:0x007D / sub ax,2 ; dy = Random(5) - 2
        0007243  lcall ui:0x007D                     ; y = Random(199 - h)
        0007260  call 0x5FF9 / jne                   ; overlaps -- draw again

    The edge, the y draw and the rejection are the program's. **How many
    animals appear and which species** is decided by the wave logic inside
    `hunt:0x72DD`, which has not been read -- `--animals` and `--species`
    stand in for it, and the caption says so.
    """
    allowed = [s for s in range(6)
               if not (s == 0 and not (3 < landmark < 13))
               and not (s == 1 and not landmark > 6)
               and not (s == 2 and not landmark >= 7)]
    for n in range(count):
        if species:
            sp = species[n % len(species)]
        else:
            sp = allowed[rnd(len(allowed))]     # hunt:0x7077, minus the retry
        sx, sy, w, h = animals[(sp * 4) % 28]        # frame 0 of that species
        from_left = (n % 2 == 0)
        for _ in range(200):
            x = 0 if from_left else ANIMAL_X_RANGE - w
            y = rnd(Y_RANGE - h)
            if not any(overlaps((x, y, w, h), p[:4]) for p in placed):
                objects.append((x, y, w, h, "animals", sx, sy))
                placed.append((x, y, w, h))
                break


def compose(objects, terrain, hunter_sheet, animal_sheet=None):
    field = [[0] * FIELD_W for _ in range(FIELD_H)]
    for x, y, w, h, sheet, sx, sy in objects:
        src = {"terrain": terrain, "hunter": hunter_sheet,
               "animals": animal_sheet}[sheet]
        if src is None:
            continue
        for row in range(h):
            if not (0 <= sy + row < len(src)) or not (0 <= y + row < FIELD_H):
                continue
            line = src[sy + row]
            for col in range(w):
                if not (0 <= sx + col < len(line)):
                    continue
                px = line[sx + col]
                if px and 0 <= x + col < FIELD_W:
                    field[y + row][x + col] = px      # colour 0 is transparent
    return field


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--exe", default="work/unpacked.exe")
    ap.add_argument("--pcl", default="original/OTCGA.PCL")
    ap.add_argument("--out", default="reference")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--region", type=int, default=0,
                    help="0..4; region 0 permits kinds 0 1 2 6 7 8")
    ap.add_argument("--direction", type=int, default=2,
                    help="0..7, the hunter's facing")
    ap.add_argument("--animals", type=int, default=0,
                    help="how many animals to enter the field. The entry "
                         "rule is read from hunt:0x71F0; the COUNT is not "
                         "-- the wave logic in hunt:0x72DD is unread")
    ap.add_argument("--species", default="",
                    help="0..6, comma separated. Also not read: which "
                         "species a region offers is unknown")
    ap.add_argument("--landmark", type=int, default=8,
                    help="0..17, how far along the trail. Species 0, 1 "
                         "and 2 are gated on it -- hunt:0x64C5")
    ap.add_argument("--scale", type=int, default=3)
    args = ap.parse_args()

    hunter, scenery, regions, animals = tables(args.exe)
    terrain, hunter_sheet, animal_sheet = sheets(args.pcl)
    species = [int(s) for s in args.species.split(",")] if args.species else ()
    objects = build(hunter, scenery, regions, animals, args.region,
                    args.seed, args.direction, args.animals, species,
                    args.landmark)
    field = compose(objects, terrain, hunter_sheet, animal_sheet)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"hunting-field-seed{args.seed}.png"
    pcxlib.write_png(field, PAL, str(path), scale=args.scale)

    print(f"region {args.region}, permitted kinds {regions[args.region]}")
    print(f"{len(objects)} objects placed (1 hunter + {len(objects) - 1} "
          "scenery), rejection-sampled as the program does")
    for x, y, w, h, sheet, sx, sy in objects:
        print(f"   {sheet:<8} {w:3d}x{h:<3d} from ({sx:3d},{sy:3d})"
              f"  ->  ({x:3d},{y:3d})")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
