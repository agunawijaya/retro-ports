"""Render selected sprites at 16x scale with both PNG and ASCII output so the
user can see they're decoded correctly even at unfamiliar poses.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from extract_karateka import (
    load_pack, rle_decompress, _BITREV_TABLE, CGA_PALETTE, _checker_bg
)
from PIL import Image, ImageDraw, ImageFont

GLYPH = [' ', 'c', 'm', '#']

def decode_full(pack_dat, off):
    w = pack_dat[off]; h = pack_dat[off + 1]
    need = w * h
    stream, _ = rle_decompress(pack_dat, start=off + 3, max_output=need)
    if len(stream) < need: stream += bytes(need - len(stream))
    out = bytearray(need)
    for i, b in enumerate(stream):
        col = w - 1 - (i // h)
        row = i % h
        out[row * w + col] = _BITREV_TABLE[b]
    return w, h, bytes(out)

def render_pair_big(pack_m, pack_p, sprite_id, scale=16):
    em = next(e for e in pack_m.index if e.sprite_id == sprite_id)
    ep = next(e for e in pack_p.index if e.sprite_id == sprite_id)
    wm, hm, mask  = decode_full(pack_m.dat, em.offset)
    _,  _,  pixel = decode_full(pack_p.dat, ep.offset)
    width = wm * 4
    img = _checker_bg(width, hm, cell=2)
    px = img.load()
    for y in range(hm):
        for xb in range(wm):
            m = mask[y*wm + xb]; p = pixel[y*wm + xb]
            for sub in range(4):
                shift = (3 - sub) * 2
                mb = (m >> shift) & 3; pb = (p >> shift) & 3
                if (mb | pb) == 0: continue
                px[xb*4 + sub, y] = CGA_PALETTE[mb]
    return img.resize((width * scale, hm * scale), Image.NEAREST), mask, pixel, wm, hm

def render_set(label, pack_m_path, pack_p_path, sprite_ids, out_path):
    pack_m = load_pack(pack_m_path)
    pack_p = load_pack(pack_p_path)
    # We'll horizontally lay out all sprites in one row
    cells = []
    for sid in sprite_ids:
        try:
            img, _, _, w, h = render_pair_big(pack_m, pack_p, sid, scale=16)
            cells.append((sid, img, w, h))
        except StopIteration:
            print(f"  {pack_m_path.name} has no sprite 0x{sid:04X}")
    if not cells: return
    pad = 24
    total_w = sum(img.width for _, img, _, _ in cells) + pad * (len(cells) + 1)
    max_h = max(img.height for _, img, _, _ in cells) + 60   # room for labels
    sheet = Image.new("RGB", (total_w, max_h), (24, 24, 24))
    x = pad
    draw = ImageDraw.Draw(sheet)
    for sid, img, w, h in cells:
        sheet.paste(img, (x, 30))
        draw.text((x, 6), f"0x{sid:04X}  {w*4}x{h}px", fill=(220, 220, 220))
        x += img.width + pad
    sheet.save(out_path)
    print(f"  Wrote {out_path.name}")

if __name__ == "__main__":
    here = Path(__file__).parent
    out_dir = here / "extracted"

    # KM0 + KS0: hero animation frames (walking, kicking, etc.)
    render_set(
        "Hero (KM0+KS0)",
        here / "KM0", here / "KS0",
        [0x014A, 0x014B, 0x0166, 0x016B, 0x0170],
        out_dir / "BIG_hero_KM0_KS0.png",
    )
    # KMI0 + KSI0: idle / inverse frames (likely the standing pose)
    render_set(
        "Hero idle (KMI0+KSI0)",
        here / "KMI0", here / "KSI0",
        [0x0133, 0x0134, 0x0135, 0x0136, 0x0137],
        out_dir / "BIG_hero_KMI0_KSI0.png",
    )
    # KMC + KSC: cutscene characters (princess, akuma, etc.)
    render_set(
        "Cutscene (KMC+KSC)",
        here / "KMC", here / "KSC",
        [0x0101, 0x0102, 0x010A, 0x0119, 0x011A, 0x0125, 0x0150],
        out_dir / "BIG_cutscene_KMC_KSC.png",
    )
