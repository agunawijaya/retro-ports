"""Build a clean Karateka sprite atlas from the NES sprite sheets in
remake_assets/nes/. Output: karateka-web/assets/atlas.png + atlas.json.

The script slices each sheet by:
  1. finding non-empty horizontal row-bands (alpha>0 or non-bg pixels)
  2. inside each band, finding vertical sprite columns (gap >= GAP)
The last frame of each band is the text label and is skipped.
Selected frames are then packed left-to-right into a single atlas.
"""
import json
import os
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
NES = ROOT / 'remake_assets' / 'nes'
OUT_DIR = ROOT / 'karateka-web' / 'assets'

GAP_DEFAULT = 4
GAP_AKUMA = 2


def find_bands(mask: np.ndarray):
    row_has = mask.any(axis=1)
    bands, in_b, s = [], False, 0
    for y, h in enumerate(row_has):
        if h and not in_b:
            in_b, s = True, y
        elif not h and in_b:
            in_b = False
            bands.append((s, y))
    if in_b:
        bands.append((s, len(row_has)))
    return bands


def split_band(mask: np.ndarray, y0: int, y1: int, gap_thresh: int):
    sub = mask[y0:y1 + 1, :]
    col_has = sub.any(axis=0)
    frames, in_f, start, gap = [], False, 0, 0
    for x, c in enumerate(col_has):
        if c:
            if not in_f:
                in_f, start = True, x
            gap = 0
        else:
            if in_f:
                gap += 1
                if gap >= gap_thresh:
                    frames.append((start, x - gap + 1))
                    in_f, gap = False, 0
    if in_f:
        frames.append((start, len(col_has)))
    return frames


def load_with_alpha(path: Path, bg_from_topleft: bool):
    im = Image.open(path).convert('RGBA')
    arr = np.array(im)
    if bg_from_topleft:
        bg = arr[0, 0, :3]
        bg_mask = (arr[:, :, :3] == bg).all(axis=2)
        arr[bg_mask, 3] = 0
        im = Image.fromarray(arr, 'RGBA')
    return im


def slice_sheet(path: Path, gap: int, bg_from_topleft: bool):
    im = load_with_alpha(path, bg_from_topleft)
    arr = np.array(im)
    mask = arr[:, :, 3] > 0
    bands = find_bands(mask)
    out = []  # list[ list[ (x0,y0,x1,y1) ] ] per band
    for y0, y1 in bands:
        frames = split_band(mask, y0, y1, gap)
        out.append([(x0, y0, x1, y1 + 1) for (x0, x1) in frames])
    return im, out


# --- pick which frames from which band become which animations -----------------

# For NES hero & enemies the band order is:
#   0 stance + reverence
#   1 walking
#   2 reverence
#   3 running
#   4 victory
#   5 punching
#   6 kicking
#   7 death          (hero only)
#
# Each band ends with a text label sprite — skip the last frame.

# Band 0 holds idle (front-facing, frames 0-2) PLUS the real side-on FIGHTING
# STANCE (frames 3-4) — these are the bent-knee, fists-up poses the original
# Karateka shows when the hero locks into combat mode. NES walking band is
# front-facing and useless side-on, so movement reuses the running cycle.
#
# IMPORTANT: in the NES sheets, the RUNNING band (3) is drawn facing LEFT,
# while the STANCE / PUNCH / KICK / DEATH bands (0, 5, 6, 7) face RIGHT.
# The atlas convention is sprites-face-right (runtime flips when facing<0),
# so picks from band 3 must mirror; picks from bands 0/5/6/7 must NOT.
# Verified against the original DOS Karateka "just landed" screenshot, where
# the hero stands facing right toward Akuma's castle.
#
# Pick tuple: (band_idx, frame_idxs, flip=False)
HERO_PICKS = {
    'idle':   (3, [1],                       True),     # band 3 → mirror to face right
    'stance': (0, [3, 4]),                              # band 0 already faces right
    'walk':   (3, [1, 2, 3, 4, 5, 6, 7, 8],  True),
    'run':    (3, [1, 2, 3, 4, 5, 6, 7, 8],  True),
    'punch':  (5, [1, 2, 3, 4, 5, 6, 7, 8]),
    'kick':   (6, [1, 2, 3, 4]),
    'fall':   (7, [0, 1, 2, 3, 4]),
}

ENEMY_PICKS = {
    'idle':   (3, [1],                       True),
    'stance': (0, [3, 4]),
    'walk':   (3, [1, 2, 3, 4, 5, 6, 7, 8],  True),
    'run':    (3, [1, 2, 3, 4, 5, 6, 7, 8],  True),
    'punch':  (4, [1, 2, 3, 4]),                        # enemies have no separate victory band
    'kick':   (5, [1, 2, 3, 4]),
    'fall':   (5, [4, 4, 4]),
}

# NES akuma layout (gap=2):
#   band 0: stance (3) — front-facing
#   band 1: walking (11) — front-facing
#   band 2: punching (5) — side-on
#   band 3: ? (3)         — looks like running, side-on
#   band 4: kicking (5)   — side-on
AKUMA_PICKS = {
    'stance': (3, [0], True),                      # band 3 faces LEFT → mirror
    'walk':   (3, [0, 1, 2], True),                # band 3 faces LEFT → mirror
    'punch':  (2, [0, 1, 2, 3]),                   # band 2 already faces RIGHT
    'kick':   (4, [0, 1, 2, 3]),                   # band 4 already faces RIGHT
    'fall':   (4, [4]),
}


def crop_princess():
    """Extract Mariko from the NES sprite sheet — clean 14-px-wide side-view
    pose. The NES Mariko sprites all face LEFT in the source; our atlas
    convention is sprites-face-right, so mirror to match.
    """
    im, bands = slice_sheet(NES / 'mariko.png', GAP_AKUMA, True)
    if not bands or not bands[0]:
        return None
    x0, y0, x1, y1 = bands[0][0]
    crop = im.crop((x0, y0, x1, y1))
    return crop.transpose(Image.FLIP_LEFT_RIGHT)


def build():
    hero_im, hero_bands = slice_sheet(NES / 'hero.png', GAP_DEFAULT, False)
    enemy_im, enemy_bands = slice_sheet(NES / 'enemies.png', GAP_DEFAULT, False)
    akuma_im, akuma_bands = slice_sheet(NES / 'akuma.png', GAP_AKUMA, True)

    sources = [
        ('hero', hero_im, hero_bands, HERO_PICKS),
        ('enemy', enemy_im, enemy_bands, ENEMY_PICKS),
        ('akuma', akuma_im, akuma_bands, AKUMA_PICKS),
    ]

    # Crops: list of (name, PIL.Image)
    crops = []
    anims = {}
    for actor, im, bands, picks in sources:
        for anim, pick in picks.items():
            band_idx, frame_idxs = pick[0], pick[1]
            flip = pick[2] if len(pick) > 2 else False
            band = bands[band_idx]
            anim_key = f'{actor}.{anim}'
            anims[anim_key] = []
            for fi in frame_idxs:
                if fi >= len(band):
                    continue
                x0, y0, x1, y1 = band[fi]
                crop = im.crop((x0, y0, x1, y1))
                if flip:
                    crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
                name = f'{actor}_{anim}_{fi}'
                crops.append((name, crop))
                anims[anim_key].append(name)

    # Princess (Mariko) — one standing pose from the DOS shadow-buffer crop.
    princess = crop_princess()
    if princess is not None:
        crops.append(('mariko_stand', princess))
        anims['mariko.stance'] = ['mariko_stand']

    # Pack crops left-to-right in rows up to MAX_W pixels wide.
    MAX_W = 512
    PAD = 1
    row_h = 0
    rows = []  # list[list[(name, im, x_offset)]]
    cur_row = []
    cur_x = 0
    for name, im in crops:
        w, h = im.size
        if cur_x + w + PAD > MAX_W and cur_row:
            rows.append(cur_row)
            cur_row, cur_x = [], 0
        cur_row.append((name, im, cur_x))
        cur_x += w + PAD
    if cur_row:
        rows.append(cur_row)

    # Compute final size
    atlas_w = MAX_W
    row_heights = [max(im.size[1] for _, im, _ in row) for row in rows]
    atlas_h = sum(row_heights) + PAD * len(rows)

    atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))
    frames = {}
    y_cur = 0
    for ri, row in enumerate(rows):
        for name, im, xo in row:
            atlas.paste(im, (xo, y_cur), im)
            w, h = im.size
            frames[name] = [xo, y_cur, w, h]
        y_cur += row_heights[ri] + PAD

    # Trim trailing empty rows
    arr = np.array(atlas)
    mask = arr[:, :, 3] > 0
    if mask.any():
        ys = np.where(mask.any(axis=1))[0]
        atlas = atlas.crop((0, 0, atlas_w, int(ys.max()) + 1))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT_DIR / 'atlas.png')

    # Anchor: foot center. y = bottom of sprite; x = horizontal mid.
    # Each animation entry expanded with anchor; here we just record frame rect
    # plus the anchor offsets per frame so the renderer can place by foot.
    anchors = {}
    for name, (x, y, w, h) in frames.items():
        # foot anchor at center bottom
        anchors[name] = [w // 2, h - 1]

    with open(OUT_DIR / 'atlas.json', 'w', encoding='utf-8') as f:
        json.dump({
            'image': 'atlas.png',
            'frames': frames,
            'anchors': anchors,
            'anims': anims,
        }, f, indent=2)

    print(f'atlas.png  {atlas.size}  frames={len(frames)}')
    for k, v in anims.items():
        print(f'  {k:18s} {len(v)} frames')


if __name__ == '__main__':
    build()
