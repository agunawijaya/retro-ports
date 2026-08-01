"""
Hand-cropped poses for akuma and mariko (the NES sheets have no Y gap, so
the auto-slicer collapses them).

For the happy-path remake we just need:
  - akuma:  one fighting-stance pose
  - mariko: one standing pose
"""

import os
import json
from collections import Counter
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PROJECT_ROOT = os.path.dirname(ROOT)
NES_DIR = os.path.join(PROJECT_ROOT, "remake_assets", "nes")
OUT_DIR = os.path.join(ROOT, "assets", "frames_raw")


def detect_bg(img):
    return Counter(img.getdata()).most_common(1)[0][0]


def color_distance(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def crop_and_mask(src_path, box, out_name, tol=30):
    """Crop region, make bg transparent, autocrop to content."""
    img = Image.open(src_path).convert("RGBA")
    bg = detect_bg(img)
    sub = img.crop(box).convert("RGBA")
    w, h = sub.size
    src = sub.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            p = src[x, y]
            if color_distance(p[:3], bg[:3]) > tol:
                dst[x, y] = p
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
                found = True
    if not found:
        print(f"  WARNING: no content in {out_name}")
        return None
    tight = out.crop((min_x, min_y, max_x + 1, max_y + 1))
    path = os.path.join(OUT_DIR, out_name)
    tight.save(path)
    return {"file": out_name, "w": tight.size[0], "h": tight.size[1]}


def main():
    new_frames = []

    # Akuma sheet is 241x214. Looking at it visually, it's a ~5x6 grid of
    # poses at roughly 40x35 per cell. Top-left cell = standing/stance.
    # Pick a couple of useful poses for the boss fight.
    akuma_path = os.path.join(NES_DIR, "akuma.png")
    # (x0, y0, x1, y1) regions
    akuma_crops = [
        ("akuma_stance.png",  (5,    5,  25,  40)),
        ("akuma_walk.png",    (45,   5,  65,  40)),
        ("akuma_punch.png",   (5,   80,  35, 115)),
        ("akuma_kick.png",    (5,  120,  40, 160)),
        ("akuma_death.png",   (5,  175,  50, 214)),
    ]
    for name, box in akuma_crops:
        info = crop_and_mask(akuma_path, box, name)
        if info:
            info["char"] = "akuma"
            new_frames.append(info)
            print(f"  akuma -> {name} ({info['w']}x{info['h']})")

    # Mariko sheet is 70x47. ~4 figures across.
    mariko_path = os.path.join(NES_DIR, "mariko.png")
    mariko_crops = [
        ("mariko_stand.png",  (3,   0,  20, 47)),
        ("mariko_wait.png",   (20,  0,  37, 47)),
        ("mariko_arms.png",   (37,  0,  54, 47)),
    ]
    for name, box in mariko_crops:
        info = crop_and_mask(mariko_path, box, name)
        if info:
            info["char"] = "mariko"
            new_frames.append(info)
            print(f"  mariko -> {name} ({info['w']}x{info['h']})")

    # Append to manifest
    manifest_path = os.path.join(OUT_DIR, "_manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            existing = json.load(f)
    else:
        existing = []
    # remove old single-blob akuma/mariko entries
    existing = [e for e in existing if e.get("char") not in ("akuma", "mariko")]
    existing.extend(new_frames)
    with open(manifest_path, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"\nManifest updated. Total: {len(existing)} entries.")


if __name__ == "__main__":
    main()
