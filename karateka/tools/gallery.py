#!/usr/bin/env python3
"""gallery.py -- lay out multiple screens side by side into one image.

Each row is one screen. Columns are labelled panels (game / port / diff, or
port-only). Titles above each panel.
"""

import argparse
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


def gallery(rows, out_path, scale=2):
    """rows = [ { 'title': str, 'panels': [(label, bytes-or-None), ...] } ]"""
    from PIL import Image, ImageDraw
    w, h = 320 * scale, 200 * scale
    pad = 10
    label_h = 20
    title_h = 26
    n_panels = max(len(r["panels"]) for r in rows)
    row_h = title_h + label_h + h + pad
    canvas_w = pad + n_panels * (w + pad)
    canvas_h = pad + len(rows) * row_h
    canvas = Image.new("RGB", (canvas_w, canvas_h), (12, 12, 20))
    draw = ImageDraw.Draw(canvas)

    for ri, r in enumerate(rows):
        y0 = pad + ri * row_h
        draw.text((pad + 4, y0), r["title"], fill=(210, 210, 220))
        for ci, (label, data) in enumerate(r["panels"]):
            x0 = pad + ci * (w + pad)
            draw.text((x0 + 4, y0 + title_h), label, fill=(160, 160, 175))
            if data is not None:
                canvas.paste(to_img(data, scale),
                             (x0, y0 + title_h + label_h))
            else:
                # a "not captured" placeholder
                ph = Image.new("RGB", (w, h), (30, 30, 40))
                pd = ImageDraw.Draw(ph)
                pd.text((w // 2 - 40, h // 2 - 6),
                        "not captured", fill=(120, 120, 130))
                canvas.paste(ph, (x0, y0 + title_h + label_h))

    canvas.save(out_path)


def load(p):
    return Path(p).read_bytes() if Path(p).exists() else None


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    base = Path("reference/compare")

    rows = []

    # BAL00 -- has game reference
    g = load(base / "bal00-clean.bin")
    p = load(base / "port-bal00.bin")
    same = sum(1 for a, b in zip(g, p) if a == b) if g and p else 0
    rows.append({
        "title": f"BAL00 (level 0)  --  {same}/16000 bytes match "
                 f"({100 * same // 16000}%)",
        "panels": [
            ("game (emulator shadow, 6 blits in)", g),
            ("port (web/game.js pipeline in Python)", p),
            ("diff  (pink = differs)", None if not (g and p) else
             bytes([0 if a == b else 1 for a, b in zip(g, p)])),
        ],
    })

    # For BAL01..BAL03: port only
    for name, note in [
        ("BAL01", "level 1 (Fuji + gate on left)"),
        ("BAL02", "level 2 (palace exterior, night)"),
        ("BAL03", "level 3 (staircase into palace)"),
    ]:
        p = load(base / f"port-{name}.bin")
        rows.append({
            "title": f"{name} -- {note}",
            "panels": [
                ("game (attract loop doesn't reach here)", None),
                ("port", p),
                ("", None),
            ],
        })

    # Replace the naive diff bytes with a proper diff image
    from PIL import Image
    w, h = 320 * 2, 200 * 2
    # Rebuild the first row's third panel with a real diff
    gb = load(base / "bal00-clean.bin")
    pb = load(base / "port-bal00.bin")

    # Custom rendering: replace default panel drawer since we need diff_img,
    # not to_img, for the third panel. Simplest: hand-render the first row
    # ourselves and stitch.
    from PIL import Image as PImg, ImageDraw

    scale = 1
    W = 320 * scale
    H = 200 * scale
    pad = 10
    label_h = 20
    title_h = 26
    row_h = title_h + label_h + H + pad
    n_panels = 3
    canvas_w = pad + n_panels * (W + pad)
    canvas_h = pad + len(rows) * row_h
    canvas = PImg.new("RGB", (canvas_w, canvas_h), (12, 12, 20))
    draw = ImageDraw.Draw(canvas)

    def paste_panel(row_i, col_i, image):
        y0 = pad + row_i * row_h + title_h + label_h
        x0 = pad + col_i * (W + pad)
        canvas.paste(image, (x0, y0))

    def paste_label(row_i, col_i, text, colour=(160, 160, 175)):
        y0 = pad + row_i * row_h + title_h
        x0 = pad + col_i * (W + pad)
        draw.text((x0 + 4, y0), text, fill=colour)

    def paste_title(row_i, text):
        y0 = pad + row_i * row_h
        draw.text((pad + 4, y0), text, fill=(210, 210, 220))

    # Row 0: BAL00 game / port / diff
    paste_title(0, rows[0]["title"])
    paste_label(0, 0, "game (emulator shadow, 6 blits in)")
    paste_label(0, 1, "port (web/game.js pipeline in Python)")
    paste_label(0, 2, "diff  (pink = byte differs)")
    if gb and pb:
        paste_panel(0, 0, to_img(gb, scale))
        paste_panel(0, 1, to_img(pb, scale))
        paste_panel(0, 2, diff_img(gb, pb, scale))

    # Rows 1..3: BAL01/02/03 (port only)
    def placeholder(w, h, text):
        ph = PImg.new("RGB", (w, h), (30, 30, 40))
        pd = ImageDraw.Draw(ph)
        pd.text((w // 2 - 100, h // 2 - 6), text, fill=(120, 120, 130))
        return ph

    for i, name in enumerate(["BAL01", "BAL02", "BAL03"], start=1):
        paste_title(i, rows[i]["title"])
        paste_label(i, 0, "game reference", colour=(160, 100, 100))
        paste_label(i, 1, "port")
        paste_label(i, 2, "")
        paste_panel(i, 0, placeholder(W, H,
                    "not captured (game stays in attract loop)"))
        pb = load(base / f"port-{name}.bin")
        if pb:
            paste_panel(i, 1, to_img(pb, scale))

    # Row 4: BAL00 + Mariko (character overlay)
    gm = load(base / "bal00-plus-mariko.bin")
    pm = load(base / "port-bal00-mariko.bin")
    if gm and pm:
        # Grow the canvas one more row before writing.
        same = sum(1 for a, b in zip(gm, pm) if a == b)
        extra_row = PImg.new("RGB", (canvas_w, row_h), (12, 12, 20))
        edraw = ImageDraw.Draw(extra_row)
        edraw.text((pad + 4, 0),
                   f"BAL00 + Mariko (fig 163 at 70,167)  --  {same}/16000 "
                   f"bytes match ({100 * same // 16000}%)",
                   fill=(210, 210, 220))
        edraw.text((pad + 4, title_h), "game (shadow mid-cycle, char drawn)",
                   fill=(160, 160, 175))
        edraw.text((pad + W + pad + 4, title_h),
                   "port (BAL00 + fig 163 overlay)", fill=(160, 160, 175))
        edraw.text((pad + 2*(W + pad) + 4, title_h),
                   "diff  (character matches; fence off-cycle)",
                   fill=(160, 160, 175))
        extra_row.paste(to_img(gm, scale),
                        (pad, title_h + label_h))
        extra_row.paste(to_img(pm, scale),
                        (pad + W + pad, title_h + label_h))
        extra_row.paste(diff_img(gm, pm, scale),
                        (pad + 2 * (W + pad), title_h + label_h))
        # Stitch onto a new taller canvas.
        stitched = PImg.new("RGB",
                             (canvas_w, canvas_h + row_h), (12, 12, 20))
        stitched.paste(canvas, (0, 0))
        stitched.paste(extra_row, (0, canvas_h))
        stitched.save(args.out)
    else:
        canvas.save(args.out)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
