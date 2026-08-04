#!/usr/bin/env python3
"""Extract sprites from PATROL.COM to PNG files in a temp dir.

Reads the DOS binary at ../original/PATROL.COM, walks the three atlas
pointer tables at DS:0x1210 / 0x1242 / 0x1268 (file 0x68E0 / 0x6912 /
0x6938), and for each sprite reads its (width_bytes, height_lines,
data...) record and decodes it as CGA mode 4 palette 1 pixels.

Output PNGs land in ../recovered/sprites/ which is gitignored -- these
are extracted from the game and legally the game itself.

Usage:   python extract_sprites.py

The point of this script is IDENTIFICATION -- open the PNGs, find the
buggy, note its atlas and slot, and hard-code that in the port. The
port itself decodes at runtime from the user's own PATROL.COM copy.
"""

from pathlib import Path
import struct
try:
    from PIL import Image
except ImportError:
    print("pip install Pillow"); raise SystemExit(1)

# CGA mode 4 palette 1, background 0 -- what enter_cga_graphics at
# file 0x573 chooses. 2 bpp: index 0 = black, 1 = cyan, 2 = magenta,
# 3 = white.
PALETTE = [(0,0,0), (85,255,255), (255,85,255), (255,255,255)]

# File layout (see ../symbols.json _data_spans):
DS_ORIGIN_FILE = 0x56D0   # where DS:0x0000 lands in the file

ATLAS_TABLES = {
    'A': (0x68E0, 25),   # DS:0x1210, 25 word entries
    'B': (0x6912, 19),   # DS:0x1242, 19 word entries
    'C': (0x6938, 176),  # DS:0x1268, 176 word entries (64 addressable via & 0x3F)
}

def decode_sprite(bytes_, ptr):
    """Given a DS-relative sprite pointer, return (w_px, h, [rgba rows])."""
    if ptr == 0: return None
    file_off = DS_ORIGIN_FILE + ptr
    if file_off + 2 > len(bytes_): return None
    w_bytes = bytes_[file_off]
    h_rows  = bytes_[file_off + 1]
    if w_bytes == 0 or h_rows == 0: return None
    if w_bytes > 20 or h_rows > 80: return None  # sanity clamp
    need = 2 + w_bytes * h_rows
    if file_off + need > len(bytes_): return None
    data = bytes_[file_off + 2 : file_off + 2 + w_bytes * h_rows]
    # Decode 2 bpp: each byte = 4 pixels (high nibble first)
    w_px = w_bytes * 4
    rgba = []
    for row in range(h_rows):
        line = []
        for bx in range(w_bytes):
            b = data[row * w_bytes + bx]
            for px in range(4):
                ix = (b >> ((3 - px) * 2)) & 3
                r, g, bl = PALETTE[ix]
                line.extend([r, g, bl, 255 if ix != 0 else 0])  # index 0 = transparent
        rgba.append(bytes(line))
    return w_px, h_rows, rgba

def main():
    here = Path(__file__).parent
    binfile = (here / '..' / 'original' / 'PATROL.COM').resolve()
    outdir  = (here / '..' / 'recovered' / 'sprites').resolve()
    if not binfile.exists():
        print(f'need {binfile} -- put your copy of PATROL.COM there'); return
    outdir.mkdir(parents=True, exist_ok=True)

    data = binfile.read_bytes()

    for atlas_name, (table_off, n_entries) in ATLAS_TABLES.items():
        print(f'\n== atlas {atlas_name}: {n_entries} entries at file 0x{table_off:04X} ==')
        for i in range(n_entries):
            entry_off = table_off + i * 2
            ptr = struct.unpack_from('<H', data, entry_off)[0]
            spr = decode_sprite(data, ptr)
            if spr is None:
                print(f'  {atlas_name}[{i:3d}] ptr=0x{ptr:04X} -- skipped')
                continue
            w, h, rows = spr
            img = Image.new('RGBA', (w, h))
            flat = b''.join(rows)
            img.frombytes(flat)
            # Upscale 4x for easier inspection
            img = img.resize((w * 4, h * 4), Image.NEAREST)
            name = outdir / f'{atlas_name}_{i:03d}_{w}x{h}.png'
            img.save(name)
            print(f'  {atlas_name}[{i:3d}] ptr=0x{ptr:04X} {w}x{h} -> {name.name}')

    print(f'\nwrote to {outdir}')
    print('open them and find the buggy. atlas_letter + slot number goes into game.js.')

if __name__ == '__main__':
    main()
