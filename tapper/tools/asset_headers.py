"""Test whether each extracted asset begins with a sprite offset table.

The lookup routines tell us exactly what such a table looks like:

    select_sprite_ptr (CS:2E96)
        cmp word cs:[bx], ax      ; entry count lives at offset 0
        shl ax, 1 / mov si, ax    ; 1-based index * 2
        mov ax, cs:[bx+si]        ; so entries start at offset 2
        add ax, bx                ; entries are relative to the table base

So a table is: count word, then `count` 16-bit offsets relative to the table
base. If an asset opens with one, these must hold:

  * count is plausible and the table fits inside the asset
  * every offset lands inside the asset
  * offsets clear the table itself (they point at data, not at the header)

That is a self-validating test in the same spirit as the LSN contiguity check
that confirmed the asset directory: a wrong reading will not satisfy it.

Gaps between consecutive sorted offsets reveal sprite sizes, which we can match
against the blitter family (mask displacement = data size, so total sprite size
is twice that).
"""
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "out", "assets")

# data size -> geometry, from the blitter family (see src/tapper.asm)
SPRITE_SIZES = {
    0x10: "8x8",
    0x30: "12x16",
    0x40: "16x16",
    0x80: "32x16",
    0x84: "24x22",
    0xB0: "32x22",
}


def read_table(blob):
    """Parse a leading count+offsets table, or return None if implausible."""
    if len(blob) < 4:
        return None
    count = int.from_bytes(blob[0:2], "little")
    if not (1 <= count <= 2000):
        return None
    end = 2 + count * 2
    if end > len(blob):
        return None
    offs = [int.from_bytes(blob[2 + 2 * i:4 + 2 * i], "little")
            for i in range(count)]
    if any(o >= len(blob) or o < end for o in offs):
        return None
    return count, offs


def main():
    files = sorted(f for f in os.listdir(SRC) if f.endswith(".bin"))
    print(f"{'asset':<12} {'bytes':>7} {'count':>6} {'table end':>10} "
          f"{'first off':>10}  verdict")
    print("-" * 72)

    ok_assets = []
    for fn in files:
        blob = open(os.path.join(SRC, fn), "rb").read()
        name = fn.split("_")[0]
        t = read_table(blob)
        if t is None:
            head = " ".join(f"{b:02X}" for b in blob[:6])
            print(f"{name:<12} {len(blob):>7} {'-':>6} {'-':>10} {'-':>10}  "
                  f"no leading table (head {head})")
            continue
        count, offs = t
        print(f"{name:<12} {len(blob):>7} {count:>6} {2+count*2:>10} "
              f"{min(offs):>10}  table fits")
        ok_assets.append((name, blob, count, offs))

    if not ok_assets:
        print("\nNo asset starts with a table in this form.")
        return

    print(f"\n{len(ok_assets)}/{len(files)} assets start with a valid table\n")
    print("gap sizes between consecutive entries (= per-sprite storage):")
    print(f"{'asset':<12} {'entries':>8}  distinct gaps -> matching sprite")
    print("-" * 72)
    for name, blob, count, offs in ok_assets:
        s = sorted(set(offs))
        gaps = Counter(b - a for a, b in zip(s, s[1:]))
        parts = []
        for g, n in gaps.most_common(5):
            half = g // 2
            geo = SPRITE_SIZES.get(half)
            parts.append(f"{g}x{n}" + (f" [{geo}]" if geo else ""))
        print(f"{name:<12} {count:>8}  {'  '.join(parts)}")


if __name__ == "__main__":
    main()
