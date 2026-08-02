"""Decode TAPPER.PIC (16384 bytes = one CGA page) to PNG.

The game prompts for RGB vs composite display, so it is a CGA title screen.
We emit both the 4-colour and the 2-colour interpretation to see which fits.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Tapper", "TAPPER.PIC")
OUT = os.path.join(ROOT, "out")


def main():
    os.makedirs(OUT, exist_ok=True)
    data = open(SRC, "rb").read()
    print(f"{SRC}: {len(data)} bytes")

    variants = [
        ("pic_320x200_pal1.png", cga.decode_2bpp(data, palette=cga.PAL1_HI)),
        ("pic_320x200_pal0.png", cga.decode_2bpp(data, palette=cga.PAL0_HI)),
        ("pic_640x200_mono.png", cga.decode_1bpp(data)),
    ]
    for name, rows in variants:
        w, h = cga.save_png(rows, os.path.join(OUT, name), scale=2)
        print(f"  wrote {name}  ({w}x{h} logical)")

    # The 384 bytes at the tail of each bank are not displayed; report them so we
    # know whether the game hid anything there.
    for bank, base in (("even", 0x0000), ("odd", 0x2000)):
        tail = data[base + 8000: base + 8192]
        used = sum(1 for b in tail if b not in (0x00, 0xFF))
        print(f"  {bank} bank padding: {len(tail)} bytes, {used} non-trivial")


if __name__ == "__main__":
    main()
