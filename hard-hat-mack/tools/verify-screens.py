#!/usr/bin/env python3
"""verify-screens.py -- check the static render against the program's own output.

`render-screens.py` draws the three screens from the file alone, and its
coverage number counts calls that produced *a* placement, not calls that
produced the *right* one. It once read 100% while a fourteen-girder floor came
out as a diagonal staircase.

This is the referee. It runs the game under the toolkit's `comrun.py`, hooks
the four routines that put anything on screen, and records what each call was
actually given:

    place_sprite   0x0217   one shape at (place_col x 7, place_row)
    place_pair     0x0268   erase the old cell, draw the new
    place_pair_x7  0x02B1   the same at the seven-pixel column scale
    fill_line      0x01C8   a run of pixels, no sprite

Then it asks the static extractor for the same list and reports the difference
by value: which placements the reading missed, and which it invented. A pixel
diff says a screen is 92% right; this says which three calls are wrong.

    python tools/verify-screens.py --toolkit ../../dos-decompiler \\
        --nasm C:/path/to/nasm.exe

Needs Unicorn (for comrun) and NASM (for the static side).
"""
import argparse
import os
import struct
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent

BUILDERS = [("Level 1", 0x14D8), ("Level 2", 0x1763), ("Level 3", 0x1627)]
MAIN = 0x0A81                    # where start-up hands over; the state is ready
PLACE_SPRITE, PLACE_PAIR, PLACE_PAIR7, FILL_LINE = 0x0217, 0x0268, 0x02B1, 0x01C8
PLACE_COL, PLACE_ROW, SHAPE_SEL = 0x6D9B, 0x6D9C, 0x6D97
FILL_BLOCK = (0x15A0, 0x15A1, 0x15A2, 0x15A3, 0x15B1)
FILLERS = {FILL_LINE: FILL_BLOCK}


def entry(sel):
    """shape_lookup's index: 2 * ((sel & 0xFF) + (sel >> 8)), halved to a slot."""
    return (sel & 0xFF) + (sel >> 8)


def observe(comrun, image, builder):
    """Every drawing call the program makes while it builds one screen."""
    from unicorn import UC_HOOK_CODE
    m = comrun.Machine(image)
    m.stop_off, m.stop_after = MAIN, 1
    m.run()

    seen = []
    watched = {PLACE_SPRITE: "sprite", PLACE_PAIR: "pair",
               PLACE_PAIR7: "pair7", FILL_LINE: "fill"}
    flat = {comrun.BASE + comrun.LOAD + a: k for a, k in watched.items()}

    def rd(addr, n=1):
        off = comrun.BASE + comrun.LOAD + addr - 0x100
        b = m.uc.mem_read(off, n)
        return b[0] if n == 1 else struct.unpack("<H", b)[0]

    def hook(uc, addr, size, _):
        kind = flat.get(addr)
        if kind is None:
            return
        if kind == "fill":
            seen.append(("fill",) + tuple(rd(a) for a in FILL_BLOCK))
        else:
            seen.append((kind, rd(PLACE_COL), rd(PLACE_ROW),
                         entry(rd(SHAPE_SEL, 2))))

    h = m.uc.hook_add(UC_HOOK_CODE, hook)
    m.call(builder)
    m.uc.hook_del(h)
    return seen


def predicted(placements, rec, drawers, builder):
    ex = placements.Extractor(rec, drawers, fillers=FILLERS)
    out = []
    for sel, col, row, scale in ex.walk(builder):
        out.append(("sprite" if scale == 7 else "pair", col, row, entry(sel)))
    for r in ex.runs:
        out.append(("fill", r.col0, r.col1, r.row0, r.row1,
                    1 if r.step == 2 else 0))
    return out, ex.coverage()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--com", default=str(HERE / "original" / "HHM.COM"))
    ap.add_argument("--toolkit", default=os.environ.get("DOS_DECOMPILER",
                                                        "../../dos-decompiler"))
    ap.add_argument("--nasm", default=os.environ.get("NASM", "nasm"))
    ap.add_argument("--show", type=int, default=6,
                    help="how many differing placements to print per screen")
    a = ap.parse_args()
    if not Path(a.com).exists():
        raise SystemExit(f"{a.com} is not here. This repository ships no game "
                         f"files; put your own copy in original/.")
    sys.path.insert(0, str(Path(a.toolkit) / "tools"))
    import comrun
    import placements

    image = Path(a.com).read_bytes()
    rec = placements.load(a.com, a.nasm)
    drawers = placements.find_drawers(rec)

    total_hit = total_real = 0
    for name, builder in BUILDERS:
        real = observe(comrun, image, builder)
        pred, (got, reached, _) = predicted(placements, rec, drawers, builder)

        # Compare as multisets: a screen is a bag of drawing calls, and the
        # order they happen in is the program's business, not the reading's.
        cr, cp = Counter(real), Counter(pred)
        hit = sum((cr & cp).values())
        missed, extra = cr - cp, cp - cr
        total_hit += hit
        total_real += sum(cr.values())
        print(f"\n{name}")
        print(f"  the program makes {sum(cr.values()):>4} drawing calls "
              f"({len(cr)} distinct)")
        print(f"  the reading finds {sum(cp.values()):>4}, of which "
              f"{hit} match  --  {hit*100//max(1,sum(cr.values()))}%")
        print(f"  static coverage metric says {got}/{reached}")
        if missed:
            print(f"  missed ({sum(missed.values())}):")
            for k, n in list(missed.items())[:a.show]:
                print(f"     x{n}  {k}")
        if extra:
            print(f"  invented ({sum(extra.values())}):")
            for k, n in list(extra.items())[:a.show]:
                print(f"     x{n}  {k}")
    print(f"\noverall: {total_hit} of {total_real} drawing calls reproduced "
          f"from the file alone -- {total_hit*100//max(1,total_real)}%")


main()
