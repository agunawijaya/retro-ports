"""Render TAPPER.DAT records as raw 2bpp CGA bitmaps.

Two views are produced:
  * one PNG per record at 80 bytes/row (320 px wide, 32 rows) -- the stride the
    correlation sweep favours for the graphics-looking records;
  * a stitched sheet of records 23..29, which are 7 consecutive stride-80
    records and together cover more than a full 200-line screen.
Data is treated as linear here (no CGA bank interleave) because these are file
records, not a video page.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Tapper", "TAPPER.DAT")
OUT = os.path.join(ROOT, "out", "dat")
RECORD = 2560


def linear_2bpp(buf, stride, palette=cga.PAL1_HI):
    """Decode buf as consecutive rows of `stride` bytes, 4 pixels per byte."""
    rows = []
    for base in range(0, len(buf) - stride + 1, stride):
        row = []
        for x in range(stride):
            b = buf[base + x]
            for shift in (6, 4, 2, 0):
                row.append(palette[(b >> shift) & 3])
        rows.append(row)
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    data = open(SRC, "rb").read()
    n = len(data) // RECORD

    for i in range(n):
        r = data[i * RECORD:(i + 1) * RECORD]
        rows = linear_2bpp(r, 80)
        cga.save_png(rows, os.path.join(OUT, f"rec{i:02d}_w320.png"), scale=2)
    print(f"wrote {n} per-record PNGs to {OUT}")

    sheet_ranges = [("23_29", range(23, 30)), ("02_04", range(2, 5)),
                    ("14_22", range(14, 23)), ("30_34", range(30, 35))]
    for name, rng in sheet_ranges:
        blob = b"".join(data[i * RECORD:(i + 1) * RECORD] for i in rng)
        rows = linear_2bpp(blob, 80)
        w, h = cga.save_png(rows, os.path.join(OUT, f"sheet_{name}_w320.png"), scale=2)
        print(f"  sheet_{name}_w320.png  {w}x{h}")


if __name__ == "__main__":
    main()
