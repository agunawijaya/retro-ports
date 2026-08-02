#!/usr/bin/env python3
"""verify-screens.py -- check the static render against the program's own output.

`render-screens.py` draws the three screens from the file alone, and its
coverage number counts calls that produced *a* placement, not calls that
produced the *right* one. It once read 100% while a fourteen-girder floor came
out as a diagonal staircase.

This is the referee. It runs the game under the toolkit's `comrun.py`, hooks
the routines that put anything on screen, and records what each was actually
given:

    place_sprite   0x0217   one shape at (place_col x 7, place_row)
    place_pair     0x0268   two: the cell being erased, then the new one
    place_pair_x7  0x02B1   the same at the seven-pixel column scale
    fill_line      0x01C8   a run of pixels, no sprite

Then it asks the static extractor for the same list and reports the difference
by value. A pixel diff says a screen is 93% right; this says which calls are
wrong, and that is what makes them fixable.

**On units.** A `place_pair` call is two placements, not one -- it erases the
previous cell and draws the new one, from two separate variable triples, and
the extractor emits both. Counting the call as one placement made the reading
look like it had invented twenty sprites per screen that it had not. When two
measurements disagree, suspect the measurements first.

    python tools/verify-screens.py --toolkit ../../DOS-Decompiler \\
        --nasm C:/path/to/nasm.exe

Needs Unicorn (for comrun) and NASM (for the static side).
"""
import argparse
import json
import os
import struct
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent

BUILDERS = [("Level 1", 0x14D8), ("Level 2", 0x1763), ("Level 3", 0x1627)]
MAIN = 0x0A81                    # where start-up hands over; the state is ready
PLACE_SPRITE, PLACE_PAIR, PLACE_PAIR7, FILL_LINE = 0x0217, 0x0268, 0x02B1, 0x01C8

# The two triples place_pair reads, in the order it reads them: the cell it is
# about to erase, then the cell it is about to draw.
PAIR_TRIPLES = [(0x6D9D, 0x6D9E, 0x6D99), (0x6D9B, 0x6D9C, 0x6D97)]
SPRITE_TRIPLE = (0x6D9B, 0x6D9C, 0x6D97)
FILL_BLOCK = (0x15A0, 0x15A1, 0x15A2, 0x15A3, 0x15B1)
FILLERS = {FILL_LINE: FILL_BLOCK}


def entry(sel):
    """shape_lookup's slot: the two bytes of the selector added together."""
    return (sel & 0xFF) + (sel >> 8)


def observe(comrun, image, builder):
    """Every placement the program makes while it builds one screen."""
    from unicorn import UC_HOOK_CODE
    m = comrun.Machine(image)
    m.stop_off, m.stop_after = MAIN, 1
    m.run()

    seen, where = [], {}
    watched = {PLACE_SPRITE: "sprite", PLACE_PAIR: "pair",
               PLACE_PAIR7: "pair7", FILL_LINE: "fill"}
    flat = {comrun.BASE + comrun.LOAD + a: k for a, k in watched.items()}

    def rd(addr, n=1):
        off = comrun.BASE + comrun.LOAD + addr - 0x100
        b = m.uc.mem_read(off, n)
        return b[0] if n == 1 else struct.unpack("<H", b)[0]

    def caller():
        """Who called the drawer, from the return address on the stack.

        "Twenty-one placements are missing" is not actionable; "these six
        come from draw_pit_row" is. The call site is one word down SS:SP at
        the drawer's first instruction, before anything has been pushed.
        """
        from unicorn.x86_const import UC_X86_REG_SS, UC_X86_REG_SP
        ss = m.uc.reg_read(UC_X86_REG_SS)
        sp = m.uc.reg_read(UC_X86_REG_SP)
        w = m.uc.mem_read((ss << 4) + sp, 2)
        return struct.unpack("<H", w)[0] - 0x100

    def hook(uc, addr, size, _):
        kind = flat.get(addr)
        if kind is None:
            return
        site = caller()
        if kind == "fill":
            seen.append(("fill",) + tuple(rd(a) for a in FILL_BLOCK))
            where[seen[-1]] = site
            return
        triples = PAIR_TRIPLES if kind in ("pair", "pair7") else [SPRITE_TRIPLE]
        for col, row, sel in triples:
            seen.append(("place", rd(col), rd(row), entry(rd(sel, 2))))
            where.setdefault(seen[-1], site)

    h = m.uc.hook_add(UC_HOOK_CODE, hook)
    m.call(builder)
    m.uc.hook_del(h)

    # The state the build left behind. Some of what a drawer reads is not in
    # the file at all: `randomise_holes` runs *inside* the builder and decides
    # which pits and rivets exist, and `spawn_lunchbox` picks one of four
    # shapes from a random number. A static reading cannot know those, and the
    # honest question is not whether it guesses them but whether it is right
    # about everything else -- so hand them to it and ask again.
    #
    # The drawer parameter block is left out. Those are scratch, rewritten
    # before every call, and seeding them would let a routine that writes no
    # selector inherit the last shape of the whole screen.
    lo, hi = 0x0100, 0x0100 + len(image)
    raw = m.uc.mem_read(comrun.BASE + comrun.LOAD, len(image))
    skip = set(PAIR_TRIPLES[0]) | set(PAIR_TRIPLES[1]) | set(FILL_BLOCK)
    skip |= {SPRITE_TRIPLE[2] + 1, PAIR_TRIPLES[0][2] + 1}
    after = {a: raw[a - lo] for a in range(lo, hi)
             if a not in skip and raw[a - lo] != image[a - lo]}
    return seen, where, after


def predicted(placements, rec, drawers, builder, seed=None):
    ex = placements.Extractor(rec, drawers, fillers=FILLERS)
    out = []
    for sel, col, row, scale in ex.walk(
            builder, inherited={"bytes": dict(seed)} if seed else None):
        # Which routine drew it says nothing about the picture, and two of the
        # three use the same column scale anyway -- so the kind is not part of
        # the comparison. Position and shape are.
        out.append(("place", col, row, entry(sel)))
    for r in ex.runs:
        out.append(("fill", r.col0, r.col1, r.row0, r.row1,
                    1 if r.step == 2 else 0))
    return out, ex.coverage()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--com", default=str(HERE / "original" / "HHM.COM"))
    ap.add_argument("--toolkit", default=os.environ.get("DOS_DECOMPILER",
                                                        "../../DOS-Decompiler"))
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

    total_hit = total_real = total_pred = 0
    syms = json.loads((HERE / "symbols.json").read_text(encoding="utf-8"))
    starts = sorted((int(k, 16), v[0]) for k, v in syms["routines"].items())

    def owner(off):
        lo = None
        for s, n in starts:
            if s <= off:
                lo = n
            else:
                break
        return lo or f"0x{off:05X}"

    seeded_hit = seeded_real = seeded_pred = 0
    for name, builder in BUILDERS:
        real, where, after = observe(comrun, image, builder)
        pred, (got, reached, _) = predicted(placements, rec, drawers, builder)

        # ...and the same reading again, given the values the file does not
        # contain. Two numbers, and the difference between them is exactly
        # what "static" costs.
        sp, _ = predicted(placements, rec, drawers, builder, seed=after)
        csr, csp = Counter(real), Counter(sp)
        seeded_hit += sum((csr & csp).values())
        seeded_real += sum(csr.values())
        seeded_pred += sum(csp.values())

        # Multisets: a screen is a bag of placements, and the order the program
        # makes them in is its business, not the reading's.
        cr, cp = Counter(real), Counter(pred)
        hit = sum((cr & cp).values())
        missed, extra = cr - cp, cp - cr
        total_hit += hit
        total_real += sum(cr.values())
        total_pred += sum(cp.values())
        print(f"\n{name}")
        print(f"  the program makes {sum(cr.values()):>4} placements")
        print(f"  the reading finds {sum(cp.values()):>4}, of which {hit} match")
        print(f"    recall    {hit*100//max(1,sum(cr.values())):>3}%"
              f"   precision {hit*100//max(1,sum(cp.values())):>3}%")
        if missed:
            by = Counter()
            for k, n in missed.items():
                by[owner(where[k])] += n
            print(f"  missed ({sum(missed.values())}), by the routine that "
                  f"made them:")
            for who, n in by.most_common():
                print(f"     x{n}  {who}")
            for k, n in list(missed.items())[:a.show]:
                print(f"          {k}  <- {owner(where[k])}")
        if extra:
            print(f"  invented ({sum(extra.values())}):")
            for k, n in list(extra.items())[:a.show]:
                print(f"     x{n}  {k}")
    print(f"\noverall: {total_hit} of {total_real} placements reproduced from "
          f"the file alone -- recall {total_hit*100//max(1,total_real)}%, "
          f"precision {total_hit*100//max(1,total_pred)}%")
    print(f"         {seeded_hit} of {seeded_real} given the run-time values "
          f"as well -- recall {seeded_hit*100//max(1,seeded_real)}%, "
          f"precision {seeded_hit*100//max(1,seeded_pred)}%")
    print("         (the second line is the reading's own accuracy; the gap "
          "between them\n          is what the file does not contain)")


main()
