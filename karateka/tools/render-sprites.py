#!/usr/bin/env python3
"""
render-sprites.py -- Draw Karateka's sprites out of its data files.

Nothing here is a screenshot and nothing is executed. The container format and
the record format were both established by running the game under
`comrun.py` and reading the routines that consume the data — see
docs/02-architecture.md — and this applies them.

    .IND     (uint16 id, uint16 offset) pairs, both ascending,
             terminated by 0xFFFF and the total length, padded with 0x80
    .DAT     the records back to back, then 128 bytes of 0x80
    record   width in bytes, height in scanlines, a flag, then the stream
    stream   0x7B v c  ->  v repeated c+1 times;  any other byte -> itself
    layout   column-major: byte k is column k // height, row k % height

    .BCG     a backdrop, and a different format entirely: a uint16 byte count,
             then a raw CGA bitmap at 80 bytes per scanline, row after row.
             No compression -- there is not one 0x7B in either file -- and no
             bank interleave, so the count divided by 80 is the height.
             FUJI.BCG is 2,800 bytes: 320 x 35, a horizon band.

The layout is the blitter's own. It walks *down* a column, one byte per
scanline (`add di, 0x50`), before stepping one column right — so reading the
bytes row-major produces a recognisable figure lying on its side, which is the
kind of wrong answer that looks like a discovery.

    python tools/render-sprites.py --pairs KS0:KM0 --out reference/sprites
    python tools/render-sprites.py --sheet KSC --out reference/sprites

Needs Pillow and dos-decompiler (for its CGA palette).
"""

import argparse
import os
import struct
import sys
from pathlib import Path

ESCAPE = 0x7B


def index(folder, stem):
    """Every record in a pair, as {id: (start, end)}, plus the data."""
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


def decode(stream, want=None):
    """Run-length decode. `want` stops early, the way the blitter does.

    The decoder in the game is called once per output byte and stops when the
    caller stops asking, so a record usually carries more than any one drawing
    consumes. Decoding to exhaustion is not wrong, it just answers a question
    nobody asked.
    """
    out, k = bytearray(), 0
    while k < len(stream) and (want is None or len(out) < want):
        b = stream[k]
        k += 1
        if b != ESCAPE:
            out.append(b)
            continue
        if k + 1 >= len(stream):
            break
        v, c = stream[k], stream[k + 1]
        k += 2
        out += bytes([v]) * (c + 1)       # the escape emits v, then c more
    return bytes(out)


def backdrop(path, pal, scale=3):
    """A .BCG: uint16 byte count, then a raw CGA bitmap, 80 bytes per row.

    Worth stating what was *not* needed, because the sprite format next door
    makes all three look likely: no run-length decoding, no column-major read,
    and no bank de-interleave. The count divided by 80 gives the height, and
    reading it straight produces Mount Fuji on the first attempt -- which is
    the check. A wrong row stride shears an image visibly; a wrong interleave
    splits it into two combs.
    """
    from PIL import Image
    d = Path(path).read_bytes()
    n = struct.unpack_from("<H", d, 0)[0]
    h = n // 80
    img = Image.new("RGB", (320, h), (0, 0, 0))
    p = img.load()
    for row in range(h):
        for bx in range(80):
            k = 2 + row * 80 + bx
            if k >= len(d):
                break
            for b in range(4):              # CGA mode 4: two bits per pixel
                p[bx * 4 + b, row] = pal[(d[k] >> (6 - b * 2)) & 3]
    return img.resize((320 * scale, h * scale), Image.NEAREST), h


def render(d, off, nxt, pal, scale=3):
    w, h = d[off], d[off + 1]
    if not (1 <= w <= 64 and 1 <= h <= 128):
        return None, w, h
    px = decode(d[off + 3:nxt - 1], w * h)
    from PIL import Image
    img = Image.new("RGB", (w * 4, h), (0, 0, 0))
    p = img.load()
    for k, byte in enumerate(px):
        col, row = k // h, k % h
        if col >= w or row >= h:
            break
        for b in range(4):                # CGA mode 4: two bits per pixel
            p[col * 4 + b, row] = pal[(byte >> (6 - b * 2)) & 3]
    return img.resize((w * 4 * scale, h * scale), Image.NEAREST), w, h


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="original",
                    help="folder holding the .IND/.DAT files")
    ap.add_argument("--toolkit", default=os.environ.get("DOS_DECOMPILER"),
                    help="a dos-decompiler checkout, for the CGA palette")
    ap.add_argument("--pairs", help="shape:mask, e.g. KS0:KM0")
    ap.add_argument("--sheet", help="one series, e.g. KSC")
    ap.add_argument("--backdrop", help="a .BCG, e.g. FUJI.BCG")
    ap.add_argument("--figures", help="one series, only its human-sized records")
    ap.add_argument("--out", default="reference/sprites")
    args = ap.parse_args()

    if not args.toolkit:
        ap.error("say where dos-decompiler is: --toolkit or $DOS_DECOMPILER")
    sys.path.insert(0, str(Path(args.toolkit) / "tools"))
    from PIL import Image
    import gfxdump
    pal = gfxdump.PALETTES["1"]

    folder = Path(args.game)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    if args.backdrop:
        img, h = backdrop(folder / args.backdrop, pal)
        path = out / (Path(args.backdrop).stem.lower() + ".png")
        img.save(path)
        print(f"{args.backdrop}: 320 x {h} -> {path}")
        return 0

    if args.figures:
        # A .DAT holds scenery as well as actors -- the palace gate is the
        # biggest record in three of these files. Height picks the people out:
        # a standing figure is 30 to 60 scanlines and no more than 14 bytes
        # wide, where a gate is 99 tall and a banner 63 bytes across.
        from PIL import ImageDraw
        idx, d = index(folder, args.figures)
        picks = [(t, o, n) for t, (o, n) in sorted(idx.items())
                 if 30 <= d[o + 1] <= 60 and 5 <= d[o] <= 14]
        if not picks:
            print(f"{args.figures}: no human-sized records")
            return 1
        ims = [(render(d, o, n, pal=pal, scale=4)[0], t) for t, o, n in picks]
        cols = min(8, len(ims))
        cw = max(i.width for i, _ in ims) + 14
        ch = max(i.height for i, _ in ims) + 22
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cw, rows * ch), (14, 14, 20))
        dr = ImageDraw.Draw(sheet)
        for k, (im, t) in enumerate(ims):
            x, y = (k % cols) * cw, (k // cols) * ch
            sheet.paste(im, (x + 4, y + 18))
            dr.text((x + 4, y + 4), f"#{t}", fill=(170, 170, 190))
        path = out / f"{args.figures}-figures.png"
        sheet.save(path)
        print(f"{args.figures}: {len(ims)} human-sized records -> {path}")
        return 0

    if args.pairs:
        a, b = args.pairs.split(":")
        ia, da = index(folder, a)
        ib, db = index(folder, b)
        shared = sorted(set(ia) & set(ib))
        print(f"{a} has {len(ia)} records, {b} has {len(ib)}, "
              f"{len(shared)} ids in both")
        panels = []
        for ident in shared:
            ra, wa, ha = render(da, *ia[ident], pal=pal)
            rb, wb, hb = render(db, *ib[ident], pal=pal)
            if ra is None or rb is None:
                continue
            same = "same size" if (wa, ha) == (wb, hb) else "DIFFERENT SIZE"
            print(f"  id {ident:>5}  {a} {wa}x{ha}  |  {b} {wb}x{hb}   {same}")
            pan = Image.new("RGB", (ra.width + rb.width + 24,
                                    max(ra.height, rb.height) + 8), (20, 20, 28))
            pan.paste(ra, (0, 4))
            pan.paste(rb, (ra.width + 24, 4))
            panels.append(pan)
        if panels:
            W = max(p.width for p in panels)
            H = sum(p.height + 10 for p in panels)
            sheet = Image.new("RGB", (W, H), (12, 12, 16))
            y = 0
            for p in panels:
                sheet.paste(p, (0, y))
                y += p.height + 10
            path = out / f"{a}-vs-{b}.png"
            sheet.save(path)
            print(f"\nwrote {path} -- {a} on the left, {b} on the right")
        return 0

    if args.sheet:
        idx, d = index(folder, args.sheet)
        imgs = []
        for ident in sorted(idx):
            img, w, h = render(d, *idx[ident], pal=pal, scale=2)
            if img is not None:
                imgs.append(img)
        if not imgs:
            print("nothing rendered")
            return 1
        cols = 8
        cw = max(i.width for i in imgs) + 6
        ch = max(i.height for i in imgs) + 6
        rows = (len(imgs) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cw, rows * ch), (12, 12, 16))
        for n, img in enumerate(imgs):
            sheet.paste(img, ((n % cols) * cw + 3, (n // cols) * ch + 3))
        path = out / f"{args.sheet}.png"
        sheet.save(path)
        print(f"{len(imgs)} records -> {path}")
        return 0

    ap.error("give --pairs, --sheet, --figures or --backdrop")


if __name__ == "__main__":
    sys.exit(main())
