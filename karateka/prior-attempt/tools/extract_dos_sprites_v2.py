#!/usr/bin/env python3
"""extract_dos_sprites_v2.py

Mass-extract every character sprite from the original Karateka DOS port,
using the CORRECTED mask/color interpretation discovered 2026-05-31:

  KM = alpha mask  (binary: 0 = transparent, nonzero = opaque)
  KS = color data  (2-bit CGA palette index per pixel)

(The earlier `06-debug-findings.md` had the roles reversed, which is why
previous static-extraction attempts produced uninterpretable noise.)

Output: one PNG per sprite per pack, plus contact sheets, plus a master
index page. Saved under `remake_assets/dos_sprites/`.
"""

from __future__ import annotations
import os, sys, io, struct
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

CGA = [(0, 0, 0), (0x55, 0xff, 0xff), (0xff, 0x55, 0xff), (0xff, 0xff, 0xff)]
TRANS = (40, 40, 40)
PADDING_SENTINEL = 0x8080

# Pack metadata — best-guess character mapping per 08-original-files-inventory.md
PACKS = [
    ("KM0",  "KS0",  "Hero — movement/stance"),
    ("KM1",  "KS1",  "Guard tier 1 — movement"),
    ("KM2",  "KS2",  "Guard tier 2 — movement"),
    ("KM3",  "KS3",  "Guard tier 3 — movement"),
    ("KM4",  "KS4",  "Akuma / final guard — movement"),
    ("KMI0", "KSI0", "Hero — idle / reaction"),
    ("KMI1", "KSI1", "Guard tier 1 — idle / reaction"),
    ("KMI2", "KSI2", "Guard tier 2 — idle / reaction"),
    ("KMI3", "KSI3", "Guard tier 3 — idle / reaction"),
    ("KMI4", "KSI4", "Akuma — idle / reaction"),
    ("KMJ2", "KSJ2", "Guard tier 2 — jump / jeopardy"),
    ("KMJ4", "KSJ4", "Akuma — jump / jeopardy"),
    ("KMC",  "KSC",  "Common pool (eagle, princess, shared props)"),
    ("KMI",  "KSI",  "Aux (UI / status icons?) — only 4 sprites"),
]


# ----------------------------------------------------------------------------
# IND / DAT parsing
# ----------------------------------------------------------------------------
def parse_ind(path: str) -> list[tuple[int, int]]:
    """Return list of (sprite_id, offset) pairs from an .IND file."""
    with open(path, 'rb') as f:
        data = f.read()
    out = []
    for i in range(len(data) // 4):
        sid, off = struct.unpack_from('<HH', data, i * 4)
        if sid == PADDING_SENTINEL:
            break
        out.append((sid, off))
    return out


def rle_decode(stream: bytes, start: int, want: int) -> bytes:
    """Decode Karateka RLE: 0x7B <data> <count> repeats; else literal."""
    out = bytearray()
    p = start
    while len(out) < want and p < len(stream):
        b = stream[p]
        if b == 0x7B:
            if p + 2 >= len(stream):
                break
            d = stream[p + 1]
            c = stream[p + 2]
            out.extend([d] * c)
            p += 3
        else:
            out.append(b)
            p += 1
    return bytes(out[:want])


def bit_reverse(b: int) -> int:
    r = 0
    for i in range(8):
        if b & (1 << i):
            r |= (1 << (7 - i))
    return r


# ----------------------------------------------------------------------------
# Sprite decoder (corrected)
# ----------------------------------------------------------------------------
def decode_sprite(km_bytes: bytes | None, ks_bytes: bytes, w: int, h: int) -> Image.Image:
    """Render a sprite using the CORRECTED mask/color interpretation.

    km_bytes : alpha mask stream (or None = treat all pixels opaque)
    ks_bytes : color stream  (2bpp palette indices, bit-reversed for display)
    w, h     : width in bytes, height in rows
    """
    img = Image.new("RGB", (w * 4, h), TRANS)
    px = img.load()
    for row in range(h):
        for col in range(w):
            color = bit_reverse(ks_bytes[row * w + col])
            if km_bytes is not None:
                alpha = bit_reverse(km_bytes[row * w + col])
            else:
                alpha = 0xFF  # all opaque
            for sub in range(4):
                shift = 6 - sub * 2
                a = (alpha >> shift) & 3
                c = (color >> shift) & 3
                if a == 0:
                    px[col * 4 + sub, row] = TRANS
                else:
                    px[col * 4 + sub, row] = CGA[c]
    return img


def extract_pack(km_prefix: str, ks_prefix: str, description: str, out_dir: Path):
    """Extract every sprite in a paired pack. Returns list of (sid, png_filename)."""
    out_dir.mkdir(parents=True, exist_ok=True)

    km_dat_path = f"{km_prefix}.DAT"
    km_ind_path = f"{km_prefix}.IND"
    ks_dat_path = f"{ks_prefix}.DAT"
    ks_ind_path = f"{ks_prefix}.IND"

    have_km = os.path.exists(km_dat_path) and os.path.exists(km_ind_path)
    have_ks = os.path.exists(ks_dat_path) and os.path.exists(ks_ind_path)
    if not have_ks:
        print(f"  {ks_prefix}: missing .DAT/.IND, skipping pack")
        return []

    with open(ks_dat_path, 'rb') as f:
        ks = f.read()
    ks_ind = dict(parse_ind(ks_ind_path))

    if have_km:
        with open(km_dat_path, 'rb') as f:
            km = f.read()
        km_ind = dict(parse_ind(km_ind_path))
    else:
        km = b''
        km_ind = {}

    extracted = []
    # All sprite IDs from KS (the larger set)
    for sid in sorted(ks_ind.keys()):
        if sid == 0xFFFF:
            continue
        ks_off = ks_ind[sid]
        if ks_off + 3 > len(ks):
            continue
        w_s, h_s = ks[ks_off], ks[ks_off + 1]
        n = w_s * h_s
        if n == 0:
            continue
        ks_data = rle_decode(ks, ks_off + 3, n)

        # If KM has matching ID, decode paired (with alpha mask)
        km_data = None
        if sid in km_ind:
            km_off = km_ind[sid]
            if km_off + 3 <= len(km):
                w_k, h_k = km[km_off], km[km_off + 1]
                if (w_k, h_k) == (w_s, h_s):
                    km_data = rle_decode(km, km_off + 3, n)

        try:
            img = decode_sprite(km_data, ks_data, w_s, h_s)
        except Exception as e:
            print(f"    0x{sid:04x}: decode failed: {e}")
            continue

        zoom = 4
        big = img.resize((img.width * zoom, img.height * zoom), Image.NEAREST)
        tag = "paired" if km_data is not None else "ks_only"
        fname = f"id{sid:04x}_w{w_s}h{h_s}_{tag}.png"
        big.save(out_dir / fname)
        extracted.append((sid, fname, w_s, h_s, tag))

    print(f"  {km_prefix}/{ks_prefix}: extracted {len(extracted)} sprites ({description})")
    return extracted


# ----------------------------------------------------------------------------
# Contact sheet builder
# ----------------------------------------------------------------------------
def build_contact_sheet(out_dir: Path, sprites: list, title: str, save_to: Path):
    try:
        font = ImageFont.truetype("arial.ttf", 13)
        title_font = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
        title_font = font

    if not sprites:
        return
    imgs = [(fname, Image.open(out_dir / fname)) for _, fname, *_ in sprites]
    COLS = 5
    PAD = 14
    LABEL_H = 20
    TITLE_H = 50
    cell_w = max(i.width for _, i in imgs) + PAD
    cell_h = max(i.height for _, i in imgs) + PAD + LABEL_H
    rows = (len(imgs) + COLS - 1) // COLS
    sheet = Image.new('RGB', (cell_w * COLS, rows * cell_h + TITLE_H), (25, 25, 25))
    draw = ImageDraw.Draw(sheet)
    draw.text((14, 14), title, fill=(255, 230, 100), font=title_font)
    for i, (name, img) in enumerate(imgs):
        r, c = i // COLS, i % COLS
        x = c * cell_w + (cell_w - img.width) // 2
        y = TITLE_H + r * cell_h + (cell_h - LABEL_H - img.height) // 2
        sheet.paste(img, (x, y))
        # short label = sprite id + size
        label = name.replace('.png', '').replace('_paired', '').replace('_ks_only', '*')
        draw.text((c * cell_w + 6, TITLE_H + (r + 1) * cell_h - LABEL_H - 2), label,
                  fill=(220, 220, 220), font=font)
    sheet.save(save_to)


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    base = Path("remake_assets/dos_sprites")
    base.mkdir(parents=True, exist_ok=True)

    all_packs_summary = []
    for km_pfx, ks_pfx, desc in PACKS:
        pack_dir = base / f"{km_pfx}_{ks_pfx}"
        sprites = extract_pack(km_pfx, ks_pfx, desc, pack_dir)
        if sprites:
            sheet_path = pack_dir / "_contact_sheet.png"
            build_contact_sheet(pack_dir, sprites,
                                f"{km_pfx} / {ks_pfx} — {desc}  ({len(sprites)} sprites)",
                                sheet_path)
        all_packs_summary.append((km_pfx, ks_pfx, desc, len(sprites)))

    # Write a master index page (HTML for easy browsing)
    html = ['<html><head><meta charset="utf-8"><title>Karateka DOS sprite index</title>',
            '<style>body{background:#222;color:#eee;font:14px sans-serif;padding:20px}',
            'h1{color:#fc6}h2{color:#fc6;margin-top:36px}img{max-width:100%;border:1px solid #444}',
            'p{margin:4px 0}.pack{margin-bottom:36px}</style></head><body>',
            '<h1>Karateka DOS sprite extraction</h1>',
            '<p>Decoded using the CORRECTED interpretation: KM=alpha mask, KS=color data.</p>',
            '<p>Each sprite is shown at 4x zoom. Suffix <code>_paired</code> = decoded with matching KM mask; '
            '<code>_ks_only</code> = no KM counterpart, rendered fully opaque.</p>']
    for km_pfx, ks_pfx, desc, count in all_packs_summary:
        html.append(f'<div class="pack"><h2>{km_pfx} / {ks_pfx} — {desc}</h2>')
        html.append(f'<p>{count} sprites. <a href="{km_pfx}_{ks_pfx}/_contact_sheet.png">Contact sheet</a></p>')
        html.append(f'<img src="{km_pfx}_{ks_pfx}/_contact_sheet.png">')
        html.append('</div>')
    html.append('</body></html>')
    (base / 'index.html').write_text('\n'.join(html), encoding='utf-8')

    total = sum(c for _, _, _, c in all_packs_summary)
    print(f"\nExtracted {total} sprites across {len(all_packs_summary)} packs.")
    print(f"Output: {base}/  (open index.html to browse)")


if __name__ == '__main__':
    main()
