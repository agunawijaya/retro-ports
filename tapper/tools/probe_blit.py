"""Check the recovered sprite format against what the blitter actually reads.

The format derived from CS:2CFF looked sound but decoded to noise, so instead of
trusting the derivation we capture ground truth: log every (data, mask, dest)
word triple the blitter consumes, then rebuild the sprite from those. Whatever
the storage layout is, the values flowing through the blit are correct by
construction.
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga
from trace import Machine, LOAD_SEG, OUT
from emu8086 import BP, DI, SS, DS, ES

ROW_LOOP = 0x2D04          # mov ax,[di]  -- top of the per-word blit
BLIT_ENTRY = 0x2CE9        # BP holds the sprite base here


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 6_000_000
    m = Machine()
    m.load("TAPPER.COM")

    # blit_id -> list of (dest_off, data_word, mask_word)
    ops = defaultdict(list)
    state = {"id": None, "base": None}
    seen_bases = {}

    orig = m._on_exec

    def hook(cpu, seg, off):
        orig(cpu, seg, off)
        if seg != LOAD_SEG:
            return
        if off == BLIT_ENTRY:
            base = cpu.regs[BP]
            state["base"] = base
            state["id"] = (base, len(seen_bases.setdefault(base, [])))
            seen_bases[base].append(1)
        elif off == ROW_LOOP and state["id"] is not None:
            bp = cpu.regs[BP]
            data = cpu.rd16(cpu.segs[SS], bp)
            mask = cpu.rd16(cpu.segs[SS], (bp + 0x80) & 0xFFFF)
            ops[state["id"]].append((cpu.regs[DI], data, mask,
                                     bp - state["base"], cpu.segs[ES]))

    m.cpu.on_exec = hook
    reason = m.run(limit)
    print(f"ran {m.cpu.icount:,} instructions ({reason})")
    print(f"blit invocations captured: {len(ops)}")
    if not ops:
        print("blitter never reached")
        return

    # Look at one complete invocation in detail.
    key = max(ops, key=lambda k: len(ops[k]))
    seq = ops[key]
    base, _ = key
    print(f"\nlongest invocation: sprite base {base:04X}, {len(seq)} word writes")
    print(f"  ES during blit    : {seq[0][4]:04X}"
          f"  {'(video)' if seq[0][4] == 0xB800 else '(NOT video)'}")
    dests = [d for d, _, _, _, _ in seq]
    print(f"  dest offsets      : {min(dests):04X}..{max(dests):04X}")
    print(f"  bp offsets used   : {sorted(set(o for _, _, _, o, _ in seq))}")

    print("\n  first 12 word ops (dest, data, mask):")
    for d, data, mask, off, _ in seq[:12]:
        print(f"    di={d:04X}  bp+{off:3d}  data={data:04X}  mask={mask:04X}")

    nz_data = sum(1 for _, d, _, _, _ in seq if d)
    nz_mask = sum(1 for _, _, mk, _, _ in seq if mk != 0xFFFF)
    print(f"\n  non-zero data words : {nz_data}/{len(seq)}")
    print(f"  non-FFFF mask words : {nz_mask}/{len(seq)}")

    # Rebuild the sprite purely from captured values, keyed by destination.
    rows = {}
    for d, data, mask, _, _ in seq:
        bank = 1 if (d & 0x2000) else 0
        line = ((d & 0x1FFF) // 80) * 2 + bank
        col = (d & 0x1FFF) % 80
        rows.setdefault(line, {})[col] = (data, mask)
    print(f"  screen lines touched: {len(rows)} "
          f"({min(rows)}..{max(rows)})")

    ys = sorted(rows)
    cols = sorted({c for r in rows.values() for c in r})
    grid = []
    for y in ys:
        row = []
        for c in cols:
            data, mask = rows[y].get(c, (0, 0xFFFF))
            for word in (data,):
                for shift in (14, 12, 10, 8, 6, 4, 2, 0):
                    # words are little-endian in memory: low byte is the left pair
                    pass
            lo, hi = data & 0xFF, data >> 8
            mlo, mhi = mask & 0xFF, mask >> 8
            for bt, mb in ((lo, mlo), (hi, mhi)):
                for shift in (6, 4, 2, 0):
                    px = (bt >> shift) & 3
                    mk = (mb >> shift) & 3
                    row.append((40, 40, 48) if (mk == 3 and px == 0)
                               else cga.PAL1_HI[px])
        grid.append(row)
    out = os.path.join(OUT, "sprites")
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, f"captured_{base:04X}.png")
    cga.save_png(grid, path, scale=6)
    print(f"\nwrote reconstructed sprite -> {path}  ({len(cols)*8}x{len(ys)})")


if __name__ == "__main__":
    main()
