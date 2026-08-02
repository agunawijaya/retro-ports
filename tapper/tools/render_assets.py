"""Render the 14 extracted assets so we can see what each one holds.

Two views per asset:
  * full-width raster at 80 bytes/row (320 px), which is how the full-screen
    backdrops are stored -- asset 2 renders the "Tapper" logo this way;
  * a 32x16 sprite-bank grid, using the geometry the blitter revealed
    (128 bytes data, mask 128 bytes later, 256 bytes per sprite).

Whichever view looks structured tells us what kind of asset it is.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "out", "assets")
OUT = os.path.join(ROOT, "out", "assets_png")

SPRITE_BYTES = 256
SPRITE_W = 8            # bytes per row = 32 px
SPRITE_ROWS = 16


def raster(blob, stride=80, palette=cga.PAL1_HI):
    rows = []
    for base in range(0, len(blob) - stride + 1, stride):
        row = []
        for x in range(stride):
            b = blob[base + x]
            for shift in (6, 4, 2, 0):
                row.append(palette[(b >> shift) & 3])
        rows.append(row)
    return rows


def sprite_grid(blob, cols=16, scale_bg=(30, 30, 38)):
    """Lay out consecutive 256-byte sprites, drawing data over a flat backdrop."""
    n = len(blob) // SPRITE_BYTES
    if n == 0:
        return None
    rows_n = (n + cols - 1) // cols
    W = cols * (32 + 1) + 1
    H = rows_n * (SPRITE_ROWS + 1) + 1
    grid = [[(70, 70, 80)] * W for _ in range(H)]
    for s in range(n):
        blob_s = blob[s * SPRITE_BYTES:(s + 1) * SPRITE_BYTES]
        cx, cy = s % cols, s // cols
        x0, y0 = cx * 33 + 1, cy * (SPRITE_ROWS + 1) + 1
        for i in range(SPRITE_ROWS):
            # rows 0..7 are even screen lines, 8..15 the odd ones
            y = (i - 8) * 2 + 1 if i >= 8 else i * 2
            for b in range(SPRITE_W):
                data = blob_s[i * SPRITE_W + b]
                mask = blob_s[i * SPRITE_W + b + 0x80]
                for k, shift in enumerate((6, 4, 2, 0)):
                    d = (data >> shift) & 3
                    mk = (mask >> shift) & 3
                    px = scale_bg if (mk == 3 and d == 0) else cga.PAL1_HI[d]
                    grid[y0 + y][x0 + b * 4 + k] = px
    return grid


def main():
    os.makedirs(OUT, exist_ok=True)
    files = sorted(f for f in os.listdir(SRC) if f.endswith(".bin"))
    print(f"{'asset':<34} {'bytes':>7} {'/256':>7}  views")
    print("-" * 66)
    for fn in files:
        blob = open(os.path.join(SRC, fn), "rb").read()
        stem = fn[:-4]
        views = []
        cga.save_png(raster(blob), os.path.join(OUT, f"{stem}_raster.png"), scale=2)
        views.append("raster")
        g = sprite_grid(blob)
        if g:
            cga.save_png(g, os.path.join(OUT, f"{stem}_sprites.png"), scale=3)
            views.append(f"sprites({len(blob)//SPRITE_BYTES})")
        print(f"{stem:<34} {len(blob):>7} {len(blob)/256:>7.1f}  {', '.join(views)}")
    print(f"\nwrote PNGs -> {OUT}")


if __name__ == "__main__":
    main()
