"""
Convert the three background PNGs in remake_assets/backgrounds to greyscale
4-tone, save into karateka-web/assets/.
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PROJECT_ROOT = os.path.dirname(ROOT)
BG_SRC = os.path.join(PROJECT_ROOT, "remake_assets", "backgrounds")
OUT_DIR = os.path.join(ROOT, "assets")

GREYS = [0, 0x55, 0xAA, 0xFF]


def quantize_grey(v):
    if v < 43:   return GREYS[0]
    if v < 128:  return GREYS[1]
    if v < 213:  return GREYS[2]
    return GREYS[3]


def to_greyscale_solid(img):
    """All pixels opaque (backgrounds are full scenes, no transparency)."""
    img = img.convert("RGB")
    w, h = img.size
    src = img.load()
    out = Image.new("RGB", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            lum = int(0.299 * r + 0.587 * g + 0.114 * b)
            v = quantize_grey(lum)
            dst[x, y] = (v, v, v)
    return out


mapping = [
    ("akuma_castle.png", "bg_outdoor.png"),
    ("fight_room.png",   "bg_indoor.png"),
    ("marikos_cell.png", "bg_princess.png"),
]

for src_name, dst_name in mapping:
    src_path = os.path.join(BG_SRC, src_name)
    dst_path = os.path.join(OUT_DIR, dst_name)
    img = Image.open(src_path)
    g = to_greyscale_solid(img)
    g.save(dst_path)
    print(f"  {src_name} ({img.size[0]}x{img.size[1]}) -> {dst_name}")
