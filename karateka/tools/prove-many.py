#!/usr/bin/env python3
"""prove-many.py -- run the byte-exact check across ALL blits, not one.

Referees are cheap once written. Extend prove-exact.py to check every blit
call the game makes, aggregate the pass rate, and list the ones that fail so
the pattern is legible instead of just a percentage.

Only checks shift=0 blits (byte-aligned X) -- the shifted case adds the
rotate-and-split step which is a separate proof.
"""

import struct
import sys
from collections import Counter
from pathlib import Path


SHADOW_OFF = 0x6FD7
SHADOW_LEN = 16000
SPRITE_BASE = 0x443C


def decode_rle(stream, want):
    out, k = bytearray(), 0
    while k < len(stream) and len(out) < want:
        b = stream[k]
        k += 1
        if b != 0x7B:
            out.append(b)
            continue
        if k + 1 >= len(stream):
            break
        v, c = stream[k], stream[k + 1]
        k += 2
        out += bytes([v]) * (c + 1)
    return bytes(out)


def main():
    toolkit = Path(sys.argv[1] if len(sys.argv) > 1
                   else "E:/Projects/DOS-Decompiler")
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 300
    sys.path.insert(0, str(toolkit / "tools"))
    import comrun
    from unicorn.x86_const import (UC_X86_REG_SS, UC_X86_REG_SP, UC_X86_REG_DS)

    game = Path("original")
    image = (game / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(image, files=game)

    events = []
    stats = Counter()
    per_fig = {}

    def entry(_):
        if len(events) + stats["done"] >= limit:
            return
        ss = m.uc.reg_read(UC_X86_REG_SS)
        sp = m.uc.reg_read(UC_X86_REG_SP)
        ds = m.uc.reg_read(UC_X86_REG_DS)
        def rw(seg, off):
            return struct.unpack_from("<H", bytes(m.uc.mem_read(
                (seg << 4) + off, 2)))[0]
        fig = rw(ss, sp + 2) & 0xFF
        x = struct.unpack("<h", struct.pack("<H", rw(ss, sp + 4)))[0]
        y = rw(ss, sp + 6) & 0xFF
        if x % 4 != 0:
            stats["skipped_shift"] += 1
            return
        shape_off = rw(ds, 0x423C + fig * 2)
        mask_off = rw(ds, 0x873A + fig * 2)
        header = bytes(m.uc.mem_read((ds << 4) + SPRITE_BASE + shape_off, 3))
        w, h = header[0], header[1]
        if not (1 <= w <= 64 and 1 <= h <= 160):
            stats["bad_header"] += 1
            return
        body = bytes(m.uc.mem_read((ds << 4) + SPRITE_BASE + shape_off + 3,
                                    max(w * h * 2, 64)))
        px = decode_rle(body, w * h)
        # Snapshot shadow now so on_return can diff.
        before = bytes(m.uc.mem_read(0x10100 + SHADOW_OFF, SHADOW_LEN))
        events.append({"fig": fig, "x": x, "y": y, "w": w, "h": h,
                       "px": px, "before": before,
                       "has_mask": mask_off != 0})

    def on_return(_):
        if not events:
            return
        e = events.pop()
        after = bytes(m.uc.mem_read(0x10100 + SHADOW_OFF, SHADOW_LEN))
        top = e["y"] - e["h"]
        dst_col = e["x"] // 4
        # Two counts: strict (every byte must match) and lenient (a zero in
        # the shape is treated as transparent -- dest keeps its value).
        # The lenient count is the right one for structural blits: zero-shape
        # positions are places the blitter did nothing, so our "prediction"
        # for those positions is "unchanged from before".
        strict_ok = lenient_ok = total = written = 0
        for k in range(e["w"] * e["h"]):
            col, row = divmod(k, e["h"])
            r = top + row
            c = dst_col + col
            if not (0 <= r < 200 and 0 <= c < 80):
                continue
            total += 1
            shape = e["px"][k]
            got = after[r * 80 + c]
            was = e["before"][r * 80 + c]
            if got == shape:
                strict_ok += 1
                lenient_ok += 1
            else:
                # If the shape byte is zero and dest is unchanged, the
                # blitter treated it as transparent -- our decoder is right,
                # we just should not have compared this byte.
                if shape == 0 and got == was:
                    lenient_ok += 1
            if shape != 0:
                written += 1
        stats["done"] += 1
        stats["exact_lenient"] += 1 if lenient_ok == total else 0
        stats["exact_strict"] += 1 if strict_ok == total else 0
        per_fig.setdefault(e["fig"], []).append(
            (strict_ok, lenient_ok, total, e["has_mask"], written))

    m.watch[0x0640] = entry
    m.watch[0x083C] = entry
    m.watch[0x00A69] = on_return

    print(f"running, checking up to {limit} shift=0 blits ...")
    m.run(None, stop=None, budget=60_000_000)
    print(f"stopped at {m.steps:,} instructions")

    n = max(stats['done'], 1)
    print(f"\n{stats['done']} blits checked")
    print(f"  strict:  {stats['exact_strict']} match every byte "
          f"({100 * stats['exact_strict'] // n}%)")
    print(f"  lenient: {stats['exact_lenient']} match with zero-as-transparent "
          f"({100 * stats['exact_lenient'] // n}%)")
    print(f"skipped: {stats['skipped_shift']} non-zero shift, "
          f"{stats['bad_header']} bad headers")

    print("\nby figure (S=strict, L=lenient, M=has mask):")
    fmt = "  fig {:>3}  {:>3} calls  S={:>3}  L={:>3}  mask={}"
    for fig in sorted(per_fig):
        calls = per_fig[fig]
        s = sum(1 for sk, lk, t, _, _ in calls if sk == t)
        l = sum(1 for sk, lk, t, _, _ in calls if lk == t)
        has_mask = any(hm for _, _, _, hm, _ in calls)
        print(fmt.format(fig, len(calls), s, l, "yes" if has_mask else " no"))


if __name__ == "__main__":
    main()
