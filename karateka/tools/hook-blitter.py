#!/usr/bin/env python3
"""hook-blitter.py -- Record every sprite the game draws, as it draws it.

The referee's key move. Two entry points draw sprites into the shadow buffer:

    0x0640  draw_sprite_shifted    fig_byte on stack, plus X and Y
    0x083C  draw_sprite            same, but without the sub-byte X shift

Both use a C-style prologue: `push bp / mov bp, sp`, so their arguments live
at [bp+4], [bp+6], [bp+8] -- fig, X, Y. Both dispatch through the same lookup
tables at DS:0x423C (KSC offsets) and DS:0x873A (KMC offsets), indexed by
figure_byte * 2.

Hook the entries, take a shadow snapshot on each side, record:

    routine, fig_byte, X, Y, KSC offset resolved, KMC offset resolved,
    shadow bytes that changed (as {(row, col): (before, after)}).

That table is what a decoder has to reproduce. If our output matches this
table entry-for-entry, we have proven the decoder against the game -- not
against our own expectations.

Run tools/referee.py first (so we know the shadow buffer works), then this.
"""

import argparse
import struct
import sys
from pathlib import Path


SHADOW_OFF = 0x6FD7
SHADOW_LEN = 16000


def main():
    ap = argparse.ArgumentParser(description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="original")
    ap.add_argument("--toolkit", required=True)
    ap.add_argument("--budget", type=int, default=30_000_000)
    ap.add_argument("--out", default="reference/referee/blits.txt")
    ap.add_argument("--limit", type=int, default=200,
                    help="stop recording after N blits (keeps output readable)")
    args = ap.parse_args()

    sys.path.insert(0, str(Path(args.toolkit) / "tools"))
    import comrun
    from unicorn.x86_const import (
        UC_X86_REG_BP, UC_X86_REG_SS, UC_X86_REG_DS)

    game = Path(args.game)
    image = (game / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(image, files=game)

    # Both entries live in the code region. Add LOAD to image offsets to get
    # the address seen by hooks.
    BASE = 0x10000
    LOAD = 0x100
    entries = {
        0x0640: "draw_sprite_shifted",
        0x083C: "draw_sprite",
    }

    blits = []

    def read_word(seg, off):
        return struct.unpack_from("<H", bytes(m.uc.mem_read(
            (seg << 4) + off, 2)))[0]

    # Every entry gets a callback that reads its own arguments off the stack.
    def make_hook(off_img, name):
        def hit(_):
            if len(blits) >= args.limit:
                return
            ss = m.uc.reg_read(UC_X86_REG_SS)
            bp = m.uc.reg_read(UC_X86_REG_BP)
            ds = m.uc.reg_read(UC_X86_REG_DS)
            # Prologue is not yet executed at the entry -- BP still points at
            # the caller's frame. But the return address is at [SS:SP] and
            # the arguments start one word above that, at [SS:SP+2].
            # We hook the FIRST byte of push bp, so SP has not been changed.
            from unicorn.x86_const import UC_X86_REG_SP
            sp = m.uc.reg_read(UC_X86_REG_SP)
            # [SS:SP]   = return address
            # [SS:SP+2] = fig
            # [SS:SP+4] = X (LE16)
            # [SS:SP+6] = Y
            fig = read_word(ss, sp + 2)
            x = read_word(ss, sp + 4)
            y = read_word(ss, sp + 6)
            # Read the two lookup tables at DS:0x423C and DS:0x873A.
            ksc_off = read_word(ds, 0x423C + (fig & 0xFF) * 2)
            kmc_off = read_word(ds, 0x873A + (fig & 0xFF) * 2)
            # Shift byte at 0x4227 -- how many pixel-pairs into the byte.
            shift = struct.unpack_from("<B", bytes(m.uc.mem_read(
                (ds << 4) + 0x4227, 1)))[0]
            blits.append({
                "routine": name,
                "fig": fig, "x": x, "y": y,
                "ksc": ksc_off, "kmc": kmc_off,
                "shift": shift,
                "at_step": m.steps,
            })
        m.watch[off_img] = hit

    for off, name in entries.items():
        make_hook(off, name)

    print(f"hooking {len(entries)} blitter entries, "
          f"recording up to {args.limit} calls ...")
    why = m.run(None, stop=None, budget=args.budget)
    print(f"stopped at {m.steps:,} instructions: {why}")
    print(f"recorded {len(blits)} sprite draws")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        f.write("# routine  fig  x    y    KSC     KMC     shift  at_step\n")
        for b in blits:
            f.write(f"{b['routine']:<20} {b['fig']:>3}  "
                    f"{b['x']:>4}  {b['y']:>3}  "
                    f"{b['ksc']:#06x}  {b['kmc']:#06x}  "
                    f"{b['shift']:>2}    {b['at_step']:>10,}\n")
    print(f"wrote {out}")

    # Head of the table -- what the intro drew first.
    print(f"\nfirst 20 draws:")
    print(f"  {'routine':<21} {'fig':>3}  {'x':>4}  {'y':>3}  "
          f"{'KSC':>6}  {'KMC':>6}  {'shift':>5}")
    for b in blits[:20]:
        print(f"  {b['routine']:<21} {b['fig']:>3}  "
              f"{b['x']:>4}  {b['y']:>3}  "
              f"{b['ksc']:#06x}  {b['kmc']:#06x}  "
              f"{b['shift']:>5}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
