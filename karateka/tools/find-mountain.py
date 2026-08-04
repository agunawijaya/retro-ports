#!/usr/bin/env python3
"""find-mountain.py -- Which sprite drew Mt. Fuji over the FUJI.BCG sky?

The pattern of bytes that differ between the shadow buffer and FUJI.BCG at
rows 1..34 is Mt. Fuji itself: a narrow triangle spreading downward, roughly
2..24 bytes wide across 34 rows. That is a sprite the game drew over the sky.
We know its shape because we can subtract the backdrop from the shadow.

If our decoder is right, exactly one record in the K[MS]* packs will emit that
shape at those column positions with byte-identical values. Find it.

Requires reference/referee/shadow.bin (from tools/referee.py).
"""

import struct
import sys
from pathlib import Path


def load_bcg(path):
    d = Path(path).read_bytes()
    n, = struct.unpack_from("<H", d, 0)
    return d[2:2 + n], n // 80


def index(folder, stem):
    """Same reader as render-sprites.py, kept here to avoid an import cycle."""
    i = (folder / (stem + ".IND")).read_bytes()
    d = (folder / (stem + ".DAT")).read_bytes()
    out, k = [], 0
    while k + 4 <= len(i):
        a, b = struct.unpack_from("<HH", i, k)
        if a == 0xFFFF:
            end = b
            break
        out.append((a, b))
        k += 4
    else:
        end = len(d)
    return ({ident: (off, (out[j + 1][1] if j + 1 < len(out) else end))
             for j, (ident, off) in enumerate(out)}, d)


def decode(stream, want):
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


def render_bytes(data, off, nxt):
    """Return the (w, h, decoded stream) for one record. Column-major."""
    w, h = data[off], data[off + 1]
    if not (1 <= w <= 64 and 1 <= h <= 128):
        return None
    px = decode(data[off + 3:nxt - 1], w * h)
    return w, h, px


def to_rowmajor(px, w, h):
    """The record is stored column-major (walks down a column); the shadow
    buffer is row-major. Convert."""
    out = bytearray(w * h)
    for k, b in enumerate(px):
        col, row = k // h, k % h
        if col < w and row < h:
            out[row * w + col] = b
    return bytes(out)


def diff_mask(shadow, bcg):
    """Where the shadow disagrees with the backdrop -- that is the sprite."""
    return [(k, shadow[k]) for k in range(len(bcg)) if shadow[k] != bcg[k]]


def try_place(shadow, sprite_rm, w, h, col, row):
    """Does this sprite at (col, row) reproduce the shadow bytes? Return
    (matched_nonbg, total, first_mismatch)."""
    matched = 0
    total = 0
    first = None
    for r in range(h):
        for c in range(w):
            v = sprite_rm[r * w + c]
            if v == 0:            # transparent -- do not compare
                continue
            total += 1
            sr, sc = row + r, col + c
            if sr >= 200 or sc >= 80:
                continue
            got = shadow[sr * 80 + sc]
            if got == v:
                matched += 1
            elif first is None:
                first = (r, c, v, got)
    return matched, total, first


def main():
    game = Path("original")
    shadow = Path("reference/referee/shadow.bin").read_bytes()
    bcg, h_bcg = load_bcg(game / "FUJI.BCG")

    # The mask: shadow rows 0..34 differ from FUJI.BCG in a triangular pattern.
    # Report the bounding box.
    diff_rows = [set() for _ in range(h_bcg)]
    for r in range(h_bcg):
        for c in range(80):
            k = r * 80 + c
            if shadow[k] != bcg[k]:
                diff_rows[r].add(c)
    top = next(r for r in range(h_bcg) if diff_rows[r])
    bot = max(r for r in range(h_bcg) if diff_rows[r])
    left = min(min(row) for row in diff_rows if row)
    right = max(max(row) for row in diff_rows if row)
    print(f"differing region: rows {top}..{bot}, cols {left}..{right}")
    print(f"  ~= {right - left + 1} bytes wide, {bot - top + 1} rows tall")

    # A sprite matching this must be around this size. Scan all packs for
    # candidates whose (w, h) covers the bounding box.
    packs = ["KS0", "KS1", "KS2", "KS3", "KS4", "KSC", "KSI",
             "KM0", "KM1", "KM2", "KM3", "KM4", "KMC", "KMI"]
    candidates = []
    for stem in packs:
        try:
            idx, data = index(game, stem)
        except FileNotFoundError:
            continue
        for ident, (off, nxt) in idx.items():
            r = render_bytes(data, off, nxt)
            if r is None:
                continue
            w, h, _ = r
            # A sprite that CAN cover the diff has w x h at least
            # (right-left+1) x (bot-top+1)
            if w >= (right - left + 1) and h >= (bot - top + 1) \
                    and w <= (right - left + 1) + 4 \
                    and h <= (bot - top + 1) + 4:
                candidates.append((stem, ident, w, h, off, nxt))
    print(f"\n{len(candidates)} records within +/- 4 of the diff bounding box:")
    for stem, ident, w, h, _, _ in candidates[:30]:
        print(f"  {stem}[{ident:>4}]  {w}x{h}")

    # Try to place each candidate at (left, top) and see whose non-zero bytes
    # match the shadow at that location.
    print("\nplacing each at (col=left, row=top) and counting matches:")
    print("  (only non-zero sprite bytes are compared; zero is transparent)")
    results = []
    for stem, ident, w, h, off, nxt in candidates:
        r = render_bytes(data if False else index(game, stem)[1], off, nxt)
        if r is None:
            continue
        _, _, px = r
        rm = to_rowmajor(px, w, h)
        matched, total, first = try_place(shadow, rm, w, h, left, top)
        if total > 0:
            score = matched / total
            results.append((score, matched, total, stem, ident, w, h))
    results.sort(reverse=True)
    print(f"  top matches (of {len(results)}):")
    for score, matched, total, stem, ident, w, h in results[:15]:
        print(f"    {score*100:5.1f}%  {matched:>4}/{total:<4}  "
              f"{stem}[{ident}]  {w}x{h}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
