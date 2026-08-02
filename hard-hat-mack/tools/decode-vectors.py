#!/usr/bin/env python3
"""decode-vectors.py -- the turtle-graphics interpreter at 0x1A7E, and its programs.

Most of Hard Hat Mack's art is sprites: a width byte, a height byte and the
rows, drawn by place_sprite. The moving scenery is not. The conveyor belt, the
pendulum chains and the welding sparks are *programs*, run by a nine-opcode
interpreter that walks a pen one pixel at a time:

    0        plot where you stand
    1 2 3 4  step east / south / west / north, then plot
    5 6 7 8  step the same four ways without plotting
    0x0F     stop

That is the Applesoft shape-table mechanism, which is what you would expect
from a program translated off the Apple II -- see the toolkit's
knowledge/14-translated-binaries.md.

Each pixel goes through plot_pixel, which XORs one two-bit mask from the
four-byte table at 0x02C4, so drawing a program twice erases it.

    python tools/decode-vectors.py
    python tools/decode-vectors.py --png vectors.png
"""
import argparse
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent

# east, south, west, north; the second four move without plotting
STEP = {0: (0, 0, True), 1: (1, 0, True), 2: (0, 1, True),
        3: (-1, 0, True), 4: (0, -1, True), 5: (1, 0, False),
        6: (0, 1, False), 7: (-1, 0, False), 8: (0, -1, False)}
END = 0x0F

CONVEYOR_TABLE = 0x3A3C     # five programs
PENDULUM_TABLE = 0x5AF6     # two
SPARK = 0x7126              # girder_fall and draw_spark both point here


def walk(rom, addr, limit=4096):
    """Run a program. Returns the plotted pixels and how many opcodes ran."""
    x = y = n = 0
    pts = [(0, 0)]
    p = addr - 0x100
    while n < limit and 0 <= p < len(rom):
        op = rom[p]
        if op == END or op not in STEP:
            break
        dx, dy, plot = STEP[op]
        x += dx
        y += dy
        if plot:
            pts.append((x, y))
        p += 1
        n += 1
    return pts, n


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rom", default=str(HERE / "original" / "HHM.COM"))
    ap.add_argument("--png")
    a = ap.parse_args()
    if not Path(a.rom).exists():
        raise SystemExit(f"{a.rom} is not here. This repository ships no game "
                         f"files; put your own copy in original/.")
    rom = Path(a.rom).read_bytes()

    def w(addr):
        return struct.unpack_from("<H", rom, addr - 0x100)[0]

    progs = [("spark", SPARK)]
    progs += [(f"conveyor {i}", w(CONVEYOR_TABLE + 2 * i)) for i in range(5)]
    progs += [(f"pendulum {i}", w(PENDULUM_TABLE + 2 * i)) for i in range(2)]

    drawn = []
    for name, addr in progs:
        pts, n = walk(rom, addr)
        if n == 0:
            print(f"  {name:<12} 0x{addr:04X}  empty")
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        print(f"  {name:<12} 0x{addr:04X}  {n:>3} opcodes, {len(pts):>3} pixels, "
              f"{max(xs)-min(xs)+1} x {max(ys)-min(ys)+1}")
        drawn.append((name, pts, min(xs), min(ys),
                      max(xs) - min(xs) + 1, max(ys) - min(ys) + 1))

    if not a.png:
        print("\n  (pass --png FILE to draw them)")
        return
    from PIL import Image, ImageDraw
    s, cw = 6, max(d[4] for d in drawn) * 6 + 28
    ch = max(d[5] for d in drawn) * 6 + 30
    sheet = Image.new("RGB", (len(drawn) * cw, ch), (26, 26, 34))
    d = ImageDraw.Draw(sheet)
    for i, (name, pts, mx, my, _, _) in enumerate(drawn):
        d.text((i * cw + 6, 3), name, fill=(255, 226, 120))
        for x, y in pts:
            px, py = i * cw + 14 + (x - mx) * s, 22 + (y - my) * s
            d.rectangle([px, py, px + s - 1, py + s - 1], fill=(0, 226, 226))
    sheet.save(a.png)
    print(f"\n  wrote {a.png}  {sheet.width}x{sheet.height}")


main()
