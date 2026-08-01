"""
Slice the labeled NES sprite sheets in remake_assets/nes/ into per-frame PNGs.
Outputs to karateka-web/assets/frames_raw/.
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
os.makedirs(OUT_DIR, exist_ok=True)


def detect_bg(img):
    px = list(img.getdata())
    return Counter(px).most_common(1)[0][0]


def color_distance(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def build_ink_mask(img, bg, tol=30):
    w, h = img.size
    px = img.load()
    mask = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 128:
                continue
            if color_distance(p[:3], bg[:3]) > tol:
                mask[y][x] = True
    return mask


def row_has_ink(mask, y):
    return any(mask[y])


def find_horizontal_bands(mask, min_gap=4):
    h = len(mask)
    bands = []
    start = None
    gap = 0
    for y in range(h):
        if row_has_ink(mask, y):
            if start is None:
                start = y
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap >= min_gap:
                    bands.append((start, y - gap + 1))
                    start = None
    if start is not None:
        bands.append((start, h))
    return bands


def find_vertical_bands(mask, y0, y1, min_gap=2):
    w = len(mask[0])
    bands = []
    start = None
    gap = 0
    for x in range(w):
        col_ink = any(mask[y][x] for y in range(y0, y1))
        if col_ink:
            if start is None:
                start = x
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap >= min_gap:
                    bands.append((start, x - gap + 1))
                    start = None
    if start is not None:
        bands.append((start, w))
    return bands


def erase_ground_line(mask, y0, y1, threshold=0.4):
    """Erase the lowest near-solid horizontal black line (the 'ground' under each row)."""
    w = len(mask[0])
    # Walk from bottom up, look for a row with > threshold filled
    for y in range(y1 - 1, max(y0, y1 - 6) - 1, -1):
        count = sum(1 for x in range(w) if mask[y][x])
        if count > w * threshold:
            for dy in range(-1, 2):
                yy = y + dy
                if y0 <= yy < y1:
                    for x in range(w):
                        mask[yy][x] = False
            return


def collect_color_variety(img, mask, x0, y0, x1, y1):
    """Return set of distinct RGB colors among ink pixels in box."""
    colors = set()
    px = img.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            if mask[y][x]:
                colors.add(px[x, y][:3])
    return colors


def tighten(mask, x0, y0, x1, y1):
    while y0 < y1 and not any(mask[y0][x] for x in range(x0, x1)):
        y0 += 1
    while y1 > y0 and not any(mask[y1 - 1][x] for x in range(x0, x1)):
        y1 -= 1
    while x0 < x1 and not any(mask[y][x0] for y in range(y0, y1)):
        x0 += 1
    while x1 > x0 and not any(mask[y][x1 - 1] for y in range(y0, y1)):
        x1 -= 1
    return x0, y0, x1, y1


def slice_sheet(path, name, drop_ground=True, min_frame_size=(4, 8)):
    img = Image.open(path).convert("RGBA")
    bg = detect_bg(img)
    mask = build_ink_mask(img, bg)

    bands = find_horizontal_bands(mask, min_gap=4)
    print(f"[{name}] bg={bg} bands={len(bands)}")

    frames = []
    for band_idx, (y0, y1) in enumerate(bands):
        if drop_ground:
            erase_ground_line(mask, y0, y1)

        vbands = find_vertical_bands(mask, y0, y1, min_gap=2)
        frame_idx = 0
        for vb_x0, vb_x1 in vbands:
            x0, by0, x1, by1 = tighten(mask, vb_x0, y0, vb_x1, y1)
            cw = x1 - x0
            ch = by1 - by0
            if cw < min_frame_size[0] or ch < min_frame_size[1]:
                continue
            colors = collect_color_variety(img, mask, x0, by0, x1, by1)
            # Filter text labels: pure-black-only blobs with very few colors
            if len(colors) <= 1:
                only = next(iter(colors)) if colors else (0, 0, 0)
                if max(only) < 30:  # near-black
                    continue
            # Build transparent crop using mask
            out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            src = img.load()
            dst = out.load()
            for fy in range(ch):
                for fx in range(cw):
                    if mask[by0 + fy][x0 + fx]:
                        dst[fx, fy] = src[x0 + fx, by0 + fy]
            fname = f"{name}_band{band_idx:02d}_f{frame_idx:02d}.png"
            out.save(os.path.join(OUT_DIR, fname))
            frames.append({
                "file": fname, "char": name, "band": band_idx, "frame": frame_idx,
                "x": x0, "y": by0, "w": cw, "h": ch,
            })
            frame_idx += 1
        print(f"  band {band_idx} y[{y0}-{y1}] -> {frame_idx} frames")
    return frames


def main():
    manifest = []
    sheets = [
        ("hero",    os.path.join(NES_DIR, "hero.png"),    True),
        ("enemy",   os.path.join(NES_DIR, "enemies.png"), True),
        ("akuma",   os.path.join(NES_DIR, "akuma.png"),   False),
        ("mariko",  os.path.join(NES_DIR, "mariko.png"),  False),
    ]
    for name, path, drop_ground in sheets:
        if not os.path.exists(path):
            print(f"MISSING: {path}")
            continue
        frames = slice_sheet(path, name, drop_ground=drop_ground)
        manifest.extend(frames)
    with open(os.path.join(OUT_DIR, "_manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nTotal frames: {len(manifest)}")
    print(f"Manifest: {os.path.join(OUT_DIR, '_manifest.json')}")


if __name__ == "__main__":
    main()
