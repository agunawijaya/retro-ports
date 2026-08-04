#!/usr/bin/env python3
"""compare-backdrop.py -- First referee check: is FUJI.BCG in the shadow buffer?

FUJI.BCG is:

    uint16 count               # 2800 = 35 rows x 80 bytes
    then 2800 raw CGA bytes    # no compression, no bank interleave

The game draws the backdrop first, then draws sprites over it, so a full
byte-identical match is unlikely -- what matters is that the backdrop appears
at row 0 of the shadow buffer, and the bytes that differ are the ones sprites
drew on top.

Run tools/referee.py first to produce reference/referee/shadow.bin.
"""

import struct
import sys
from pathlib import Path


def load_bcg(path):
    d = Path(path).read_bytes()
    n, = struct.unpack_from("<H", d, 0)
    h = n // 80
    return d[2:2 + n], h


def main():
    game = Path("original")
    shadow = Path("reference/referee/shadow.bin").read_bytes()
    bcg, h = load_bcg(game / "FUJI.BCG")
    print(f"FUJI.BCG: {len(bcg)} bytes, 320 x {h}")

    diffs_per_row = []
    for r in range(h):
        a = bcg[r * 80:(r + 1) * 80]
        b = shadow[r * 80:(r + 1) * 80]
        diffs_per_row.append(sum(1 for x, y in zip(a, b) if x != y))

    identical_rows = sum(1 for d in diffs_per_row if d == 0)
    total_diff = sum(diffs_per_row)
    print(f"origin at row 0: {identical_rows} of {h} rows identical, "
          f"{total_diff} of {len(bcg)} bytes differ overall")

    if total_diff == 0:
        print("MATCH: FUJI.BCG == shadow rows 0..34 byte-identical")
        return 0

    print("\nrows with differences:")
    for r, d in enumerate(diffs_per_row):
        if d:
            print(f"  row {r:>2}: {d:>2} bytes differ")

    # If a row differs, where in the row? Sprites are typically drawn as
    # column runs (walking down a column), so a consecutive span of
    # different bytes says a sprite is there.
    print("\nrunning the diff at the first differing row:")
    for r, d in enumerate(diffs_per_row):
        if d:
            a = bcg[r * 80:(r + 1) * 80]
            b = shadow[r * 80:(r + 1) * 80]
            marks = "".join("X" if x != y else "." for x, y in zip(a, b))
            print(f"  row {r:>2}: [{marks}]")
            if r > 5:
                break
    return 0


if __name__ == "__main__":
    sys.exit(main())
