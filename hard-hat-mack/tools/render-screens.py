#!/usr/bin/env python3
"""
render-screens.py -- Draw Hard Hat Mack's three level screens from the binary,
without ever running it.

Nothing here is a screenshot. Every sprite, every column and every row is read
out of HHM.COM: the sprite bitmaps from the artwork region, the positions from
the code that builds each level, recovered by walking the build routine's call
tree with `placements.py`. The program is never executed, and there is no
emulator involved.

Two numbers are printed per level, and the second is the one that matters:

    sprites drawn         how much ended up on the canvas
    calls explained       of the placement calls reached in the call tree,
                          how many produced a placement at all

The second can read 100% while a floor is in the wrong place -- it counts
calls that produced *a* position, not calls that produced the *right* one. It
found the missing sprites; looking at the picture found the misplaced ones.
Use both.

    python tools/render-screens.py --com original/HHM.COM \\
        --toolkit ../../dos-decompiler --out recovered/screens-game.png

Needs Pillow, NASM, and dos-decompiler.
"""

import argparse
import os
import struct
import sys
from pathlib import Path

# Where each level's build routine starts, as offsets into the loaded image.
# Found by following the switch on the level variable at [0x594F]; see
# docs/02-architecture.md.
BUILDERS = [("Level 1", 0x14D8), ("Level 2", 0x1763), ("Level 3", 0x1627)]

SPRITE_TABLE = 0x6D10       # pointers to the sprite bitmaps
FONT_TABLE = 0x716F         # pointers to the character glyphs
HUD = [0x1DEE, 0x1E19, 0x1E35]      # the score line and the two edge markers

# The logo and the title banner. They are drawn over the playfield by a
# separate overlay, and leaving them out is what turns a title screen into a
# game screen.
CREDITS = {93, 94}

W, H, SCALE = 320, 200, 3


def text_records(data, head):
    """Walk one chained list of text records: (column, row, characters).

    The format is read off the routine at file 0x1D86, which takes the address
    of a list and loops:

        col = [p]; row = [p+1]; p += 2      -- into the same two variables the
        ...draw characters...                  sprite drawer uses
        if [p] == 0: return                 -- 0x00 ends the whole list
        if [p] == 1: p += 1; repeat         -- 0x01 starts another record

    A reader who stops at the first terminator gets one character and a
    plausible-looking screen. That is what happened here: the right edge showed
    a stray "L" and "M", which are the first letters of "LEVEL 0" and "MACK 2"
    written one character per record down the screen.
    """
    out, p = [], head
    while p + 2 < len(data):
        col, row = data[p], data[p + 1]
        p += 2
        text = b""
        while p < len(data) and data[p] not in (0, 1):
            text += bytes([data[p]])
            p += 1
        out.append((col, row, text))
        if p >= len(data) or data[p] == 0:
            break
        p += 1                          # 0x01: another record follows
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--com", default="original/HHM.COM")
    ap.add_argument("--toolkit", default=os.environ.get("DOS_DECOMPILER"),
                    help="path to a dos-decompiler checkout "
                         "(or set DOS_DECOMPILER)")
    ap.add_argument("--nasm", default=os.environ.get("NASM", "nasm"))
    ap.add_argument("--out", default="recovered/screens-game.png")
    args = ap.parse_args()

    if not args.toolkit:
        ap.error("say where dos-decompiler is: --toolkit or $DOS_DECOMPILER")
    sys.path.insert(0, str(Path(args.toolkit) / "tools"))
    from PIL import Image, ImageDraw          # noqa: E402
    import gfxdump                            # noqa: E402
    import placements                         # noqa: E402

    data = Path(args.com).read_bytes()
    pal = gfxdump.PALETTES["1"]
    rec = placements.load(args.com, args.nasm)
    drawers = placements.find_drawers(rec)
    print(f"{len(drawers)} placement routines found in the binary")

    def blob(table, i, bottom_first=True):
        """One sprite or glyph, as an image with a transparent background."""
        ptr = struct.unpack_from("<H", data, table + i * 2)[0]
        off = ptr - 0x100
        if not (0 < off < len(data) - 2):
            return None
        w, h = data[off], data[off + 1]
        if not (1 <= w <= 48 and 1 <= h <= 80):
            return None
        rows = gfxdump.unpack(data[off + 2:off + 2 + w * h], w)
        if bottom_first:
            # Sprites are stored lowest row first: the blitter steps *down* the
            # scanline table while reading the bitmap forwards. The font is the
            # other way round -- a different routine with its own convention.
            rows = rows[::-1]
        img = Image.new("RGBA", (w * 4, h), (0, 0, 0, 0))
        px = img.load()
        for y, row in enumerate(rows):
            for x, v in enumerate(row):
                if v:
                    px[x, y] = pal[v] + (255,)
        return img

    panels = []
    for name, builder in BUILDERS:
        ex = placements.Extractor(rec, drawers)
        places = ex.walk(builder)
        got, reached, _ = ex.coverage()

        canvas = Image.new("RGB", (W, H), (0, 0, 0))
        drawn, seen = 0, set()
        for sel, col, row, scale in places:
            if sel in CREDITS or (sel, col, row) in seen:
                continue
            seen.add((sel, col, row))
            img = blob(SPRITE_TABLE, sel)
            if img is None:
                continue
            # A row is a scanline counted from the top, and the sprite's
            # *bottom* edge sits on it. The horizontal scale comes from the
            # drawing routine: 7 pixels per character cell, or 1 for the
            # routine that works in byte columns.
            canvas.paste(img, (col * scale, row - img.height + 1), img)
            drawn += 1

        for head in HUD:
            for col, row, text in text_records(data, head):
                for k, ch in enumerate(text):
                    # The glyph index is the character with the top two bits
                    # dropped, which is how the game stores upper-case text.
                    g = blob(FONT_TABLE, ch & 0x3F, bottom_first=False)
                    if g is not None:
                        canvas.paste(g, ((col + k) * 7,
                                         row + 8 - g.height + 1), g)

        big = canvas.resize((W * SCALE, H * SCALE), Image.NEAREST)
        panel = Image.new("RGB", (big.width, big.height + 44), (10, 10, 14))
        panel.paste(big, (0, 44))
        d = ImageDraw.Draw(panel)
        d.text((10, 8), f"Hard Hat Mack — {name}", fill=(255, 233, 168))
        d.text((10, 26), f"{drawn} sprites, every position read from the "
                         f"binary. {got}/{reached} placement calls explained. "
                         f"Never executed.", fill=(150, 155, 180))
        panels.append(panel)
        print(f"{name}: {drawn} sprites drawn, {got}/{reached} calls explained")

    out = Image.new("RGB", (panels[0].width, sum(p.height + 8 for p in panels)),
                    (8, 8, 12))
    y = 0
    for p in panels:
        out.paste(p, (0, y))
        y += p.height + 8
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    out.save(args.out)
    print("wrote", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
