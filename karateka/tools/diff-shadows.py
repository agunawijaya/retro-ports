#!/usr/bin/env python3
"""diff-shadows.py -- side-by-side + diff of two shadow buffers."""

import argparse
import sys
from pathlib import Path

CGA = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]


def to_img(shadow, scale=3):
    from PIL import Image
    img = Image.new("RGB", (320, 200))
    px = img.load()
    for row in range(200):
        base = row * 80
        for col in range(80):
            v = shadow[base + col]
            for k in range(4):
                px[col * 4 + k, row] = CGA[(v >> (6 - k * 2)) & 3]
    return img.resize((320 * scale, 200 * scale), Image.NEAREST)


def diff_img(a, b, scale=3):
    from PIL import Image
    img = Image.new("RGB", (320, 200))
    px = img.load()
    for row in range(200):
        base = row * 80
        for col in range(80):
            same = a[base + col] == b[base + col]
            colour = (30, 30, 34) if same else (255, 85, 255)
            for k in range(4):
                px[col * 4 + k, row] = colour
    return img.resize((320 * scale, 200 * scale), Image.NEAREST)


def triptych(a, b, out_path, labels=("game", "port", "diff")):
    from PIL import Image, ImageDraw
    scale = 3
    w, h = 320 * scale, 200 * scale
    pad = 12
    label_h = 24
    canvas = Image.new("RGB", (w * 3 + pad * 4, h + label_h + pad * 2),
                       (12, 12, 20))
    canvas.paste(to_img(a, scale),                       (pad,             label_h + pad))
    canvas.paste(to_img(b, scale),                       (pad*2 + w,       label_h + pad))
    canvas.paste(diff_img(a, b, scale),                  (pad*3 + w * 2,   label_h + pad))
    draw = ImageDraw.Draw(canvas)
    for i, l in enumerate(labels):
        draw.text((pad + i * (w + pad) + w // 2 - 20, 4), l, fill=(200, 200, 210))
    canvas.save(out_path)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--a", required=True, help="path to first shadow.bin")
    ap.add_argument("--b", required=True, help="path to second shadow.bin")
    ap.add_argument("--out", required=True)
    ap.add_argument("--labels", default="game,port,diff")
    args = ap.parse_args()

    a = Path(args.a).read_bytes()
    b = Path(args.b).read_bytes()
    if len(a) != 16000 or len(b) != 16000:
        print(f"expected 16000-byte shadow buffers; got {len(a)} and {len(b)}",
              file=sys.stderr)
        return 1

    same = sum(1 for x, y in zip(a, b) if x == y)
    total = 16000
    print(f"match: {same}/{total} bytes ({100 * same / total:.1f}%)")

    triptych(a, b, args.out, tuple(args.labels.split(",")))
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
