#!/usr/bin/env python3
"""render-princess.py -- Two honest, separate proofs.

Correcting an earlier mistake. CASTLE.BCG is the game's TITLE SCREEN --
the palace with the moon that the game shows before you play -- not the
castle interior. The princess-in-cell scene is composed from figures on
top of a different background (not one of the two .BCG files), so we
cannot compose it here without also implementing the scene-script (BAL/CAL)
composer.

What this tool DOES prove:

    title-screen.png    -- CASTLE.BCG rendered straight, no compositing.
                           This is the picture the game paints when it
                           starts up.

    princess-sheet.png  -- every human-sized figure in KSI0/KMI0 (the
                           princess sprite pack), each cropped tight and
                           laid out in a grid. KMI0 supplies the alpha
                           mask; KSI0 supplies the colour. Both pass
                           through the same decoder + blitter as every
                           other sprite in this port.

So: title screen is proof the .BCG reader is right. The sprite sheet is
proof the princess pack decodes with mask + colour. What is NOT proved
here is the in-game composition of the princess scene, which needs the
BAL/CAL scene-script composer (see docs/06-web-code.md, "scene
composition" in the still-open list).
"""

import argparse
import struct
import sys
from pathlib import Path


CGA = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]


def rle_decode(stream, want):
    out, k = bytearray(), 0
    while k < len(stream) and len(out) < want:
        b = stream[k]
        k += 1
        if b != 0x7B:
            out.append(b)
            continue
        if k + 1 >= len(stream):
            break
        v, c = stream[k], stream[k + 1]
        k += 2
        out += bytes([v]) * (c + 1)
    return bytes(out)


def parse_index(ind_data, dat_length):
    out = []
    k = 0
    terminator = None
    while k + 4 <= len(ind_data):
        id_ = ind_data[k] | (ind_data[k + 1] << 8)
        off = ind_data[k + 2] | (ind_data[k + 3] << 8)
        if id_ == 0xFFFF:
            terminator = off
            break
        out.append((id_, off))
        k += 4
    total = terminator if terminator is not None else dat_length
    ends = [out[j + 1][1] if j + 1 < len(out) else total for j in range(len(out))]
    return [{"id": i, "off": o, "end": e} for (i, o), e in zip(out, ends)]


def decode_sprite(dat, off, end):
    w, h = dat[off], dat[off + 1]
    if not (1 <= w <= 64 and 1 <= h <= 160):
        return None
    return (w, h, rle_decode(dat[off + 3:end - 1], w * h))


def render_sprite_rgb(shape, mask, background=(20, 20, 30)):
    """Render one sprite to a tight PIL RGB image. Transparent where mask
    is 0 (or where shape is 0 if no mask), otherwise the CGA palette lookup
    of the shape byte, one pixel per pixel-pair-of-two-bits."""
    from PIL import Image
    w, h, shp = shape
    _, _, msk = mask if mask else (None, None, None)
    img = Image.new("RGB", (w * 4, h), background)
    p = img.load()
    for col in range(w):
        cbase = col * h
        for row in range(h):
            k = cbase + row
            if k >= len(shp):
                break
            shape_b = shp[k]
            mask_b = (msk[k] if (msk is not None and k < len(msk))
                      else (0 if shape_b == 0 else 0xFF))
            if mask_b == 0:
                continue
            for pix in range(4):
                pix_mask = (mask_b >> (6 - pix * 2)) & 3
                if pix_mask == 0:
                    continue
                idx = (shape_b >> (6 - pix * 2)) & 3
                p[col * 4 + pix, row] = CGA[idx]
    return img


def load_backdrop_bytes(path):
    d = Path(path).read_bytes()
    n = d[0] | (d[1] << 8)
    return d[2:2 + n], n // 80


def main():
    ap = argparse.ArgumentParser(description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="original")
    ap.add_argument("--out", default="reference/proof")
    args = ap.parse_args()

    from PIL import Image, ImageDraw

    game = Path(args.game)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # 1. Title screen -- CASTLE.BCG rendered straight, no compositing.
    castle_bytes, castle_h = load_backdrop_bytes(game / "CASTLE.BCG")
    print(f"CASTLE.BCG: 320 x {castle_h}, rendering as title screen")
    img = Image.new("RGB", (320, castle_h))
    p = img.load()
    for row in range(castle_h):
        for c in range(80):
            k = row * 80 + c
            if k >= len(castle_bytes):
                continue
            v = castle_bytes[k]
            for pix in range(4):
                p[c * 4 + pix, row] = CGA[(v >> (6 - pix * 2)) & 3]
    scaled = img.resize((320 * 3, castle_h * 3), Image.NEAREST)
    scaled.save(out / "title-screen.png")
    print(f"  wrote {out / 'title-screen.png'}")

    # 2. Princess sprite sheet -- every human-sized figure in KSI0/KMI0.
    ind = (game / "KSI0.IND").read_bytes()
    dat = (game / "KSI0.DAT").read_bytes()
    mind = (game / "KMI0.IND").read_bytes()
    mdat = (game / "KMI0.DAT").read_bytes()
    ksi = parse_index(ind, len(dat))
    kmi = {r["id"]: r for r in parse_index(mind, len(mdat))}
    print(f"KSI0: {len(ksi)} records; KMI0: {len(kmi)} records")

    picks = []
    for r in ksi:
        s = decode_sprite(dat, r["off"], r["end"])
        if s is None:
            continue
        w, h, _ = s
        if not (5 <= w <= 14 and 24 <= h <= 60):
            continue
        mr = kmi.get(r["id"])
        m = decode_sprite(mdat, mr["off"], mr["end"]) if mr else None
        picks.append((r["id"], s, m))
    print(f"  human-sized figures: {len(picks)}")

    if not picks:
        print("  no princess figures found")
        return 1

    # Lay out the sheet: 4 per row, scaled x3, with a label above each.
    tiles = [(fid, render_sprite_rgb(s, m)) for fid, s, m in picks]
    per_row = 4
    scale = 3
    cell_w = max(t[1].width for t in tiles) * scale + 20
    cell_h = max(t[1].height for t in tiles) * scale + 30
    rows = (len(tiles) + per_row - 1) // per_row
    sheet = Image.new("RGB", (per_row * cell_w, rows * cell_h),
                      (10, 10, 16))
    dr = ImageDraw.Draw(sheet)
    for k, (fid, tile) in enumerate(tiles):
        x = (k % per_row) * cell_w + 10
        y = (k // per_row) * cell_h + 20
        scaled_tile = tile.resize((tile.width * scale, tile.height * scale),
                                   Image.NEAREST)
        sheet.paste(scaled_tile, (x, y))
        dr.text((x, y - 14), f"KSI0[{fid}]  {tile.width}x{tile.height}",
                fill=(170, 170, 190))
    sheet.save(out / "princess-sheet.png")
    print(f"  wrote {out / 'princess-sheet.png'}  ({len(tiles)} figures)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
