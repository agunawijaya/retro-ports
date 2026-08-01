"""
Pack frames_raw/*.png into a single greyscale sprites.png + sprites.json.

Greyscale: 4-tone palette {#000, #555, #AAA, #FFF}, alpha preserved.
Packing: shelf algorithm, sort by height desc.
Output:
  assets/sprites.png
  assets/sprites.json   { "frames": {name: [x,y,w,h]}, "anims": {"hero.walk": [name,...], ...} }
"""

import os
import json
import glob
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRAMES_DIR = os.path.join(ROOT, "assets", "frames_raw")
OUT_PNG = os.path.join(ROOT, "assets", "sprites.png")
OUT_JSON = os.path.join(ROOT, "assets", "sprites.json")

ATLAS_W = 512
PADDING = 1

# 4-tone greyscale palette
GREYS = [0, 0x55, 0xAA, 0xFF]


def quantize_grey(v):
    # map 0..255 luminance to nearest of {0, 85, 170, 255}
    if v < 43:
        return GREYS[0]
    if v < 128:
        return GREYS[1]
    if v < 213:
        return GREYS[2]
    return GREYS[3]


def to_greyscale(img):
    img = img.convert("RGBA")
    w, h = img.size
    src = img.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if a < 128:
                continue
            lum = int(0.299 * r + 0.587 * g + 0.114 * b)
            v = quantize_grey(lum)
            dst[x, y] = (v, v, v, 255)
    return out


def shelf_pack(items, atlas_w, padding):
    """items: list of (name, img). Returns (atlas_h, dict name->(x,y,w,h))."""
    items = sorted(items, key=lambda it: it[1].size[1], reverse=True)
    rects = {}
    x = 0
    y = 0
    shelf_h = 0
    for name, img in items:
        w, h = img.size
        if x + w + padding > atlas_w:
            x = 0
            y += shelf_h + padding
            shelf_h = 0
        rects[name] = (x, y, w, h, img)
        x += w + padding
        if h > shelf_h:
            shelf_h = h
    atlas_h = y + shelf_h
    return atlas_h, rects


def main():
    paths = sorted(glob.glob(os.path.join(FRAMES_DIR, "*.png")))
    items = []
    for p in paths:
        name = os.path.splitext(os.path.basename(p))[0]
        if name.startswith("_"):
            continue
        img = Image.open(p)
        items.append((name, to_greyscale(img)))
    print(f"Loaded {len(items)} frames")

    atlas_h, rects = shelf_pack(items, ATLAS_W, PADDING)
    atlas = Image.new("RGBA", (ATLAS_W, atlas_h), (0, 0, 0, 0))
    frames = {}
    for name, (x, y, w, h, img) in rects.items():
        atlas.paste(img, (x, y))
        frames[name] = [x, y, w, h]
    atlas.save(OUT_PNG)
    print(f"Atlas: {ATLAS_W}x{atlas_h} -> {OUT_PNG}")

    # Animation definitions (hand-picked frame sequences).
    # Frame names use the naming from slicing: char_band##_f##  or  char_xxx
    # The hero/enemy NES rows are (in order detected): stance, walk?, ?, ?,
    # run, victory, punch, kick, death. We sample subsets to get clean cycles.
    def has(name):
        return name in frames

    def pick(prefix, indices):
        return [f"{prefix}_f{i:02d}" for i in indices if has(f"{prefix}_f{i:02d}")]

    anims = {
        # Hero
        "hero.stance":  pick("hero_band00", [0]),
        "hero.walk":    pick("hero_band02", [0, 2, 4, 6]),
        "hero.run":     pick("hero_band09", [0, 2, 4, 6]),
        "hero.punch":   pick("hero_band12", [0, 2, 4, 6]),
        "hero.kick":    pick("hero_band14", [0, 2, 4]),
        "hero.fall":    pick("hero_band16", [0, 1, 2, 3, 4]),

        # Enemy guard
        "enemy.stance": pick("enemy_band00", [0]),
        "enemy.walk":   pick("enemy_band02", [0, 2, 4, 6]),
        "enemy.run":    pick("enemy_band09", [0, 2, 4, 6]),
        "enemy.punch":  pick("enemy_band10", [0, 2, 4, 6]),
        "enemy.kick":   pick("enemy_band12", [0, 2, 4]),
        "enemy.fall":   pick("enemy_band14", [0, 1, 2, 3, 4]),

        # Akuma — manually cropped
        "akuma.stance": [n for n in ["akuma_stance"] if has(n)],
        "akuma.punch":  [n for n in ["akuma_punch"]  if has(n)],
        "akuma.kick":   [n for n in ["akuma_kick"]   if has(n)],
        "akuma.fall":   [n for n in ["akuma_death"]  if has(n)],

        # Mariko
        "mariko.stand": [n for n in ["mariko_stand"] if has(n)],
    }

    # Drop any anim entries with no frames
    anims = {k: v for k, v in anims.items() if v}

    out = {"image": "sprites.png", "frames": frames, "anims": anims}
    with open(OUT_JSON, "w") as f:
        json.dump(out, f, indent=2)
    print(f"JSON: {OUT_JSON}")
    print(f"Animations: {len(anims)}")
    for k, v in anims.items():
        print(f"  {k:18s} {len(v)} frames")


if __name__ == "__main__":
    main()
