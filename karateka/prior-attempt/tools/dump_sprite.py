"""Lay out a sprite as ASCII art so we can see exactly what bytes give what pixels.

The decoder pipeline:
  1. rle-expand from offset+3 with max_output = w*h
  2. re-order column-major (RTL, TTB) into row-major
  3. bit-reverse each byte
  4. MSB-first 2bpp = pixel 0 in bits 7-6

Output: text grid of characters per pixel:
  ' ' = transparent (color 0)
  '#' = white (color 3)
  'c' = cyan (color 1)
  'm' = magenta (color 2)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from extract_karateka import load_pack, rle_decompress, _BITREV_TABLE

GLYPH = [' ', 'c', 'm', '#']

def dump_sprite(pack_path, sprite_id):
    pack = load_pack(pack_path)
    e = next(en for en in pack.index if en.sprite_id == sprite_id)
    w = pack.dat[e.offset]
    h = pack.dat[e.offset + 1]
    a = pack.dat[e.offset + 2]
    need = w * h
    stream, used = rle_decompress(pack.dat, start=e.offset + 3, max_output=need)
    if len(stream) < need: stream += bytes(need - len(stream))

    # column-major RTL -> row-major
    rows = [bytearray(w) for _ in range(h)]
    for i, b in enumerate(stream):
        col = w - 1 - (i // h)
        row = i % h
        rows[row][col] = _BITREV_TABLE[b]

    print(f"== {Path(pack_path).name} sprite 0x{sprite_id:04X} ==")
    print(f"   header: w={w} bytes ({w*4} px), h={h}, anchor={a}")
    print(f"   raw RLE bytes used: {used} (of {e.length} between IND offsets)")
    print()
    print("   ASCII pixel layout (4 px per byte, '#'=white, 'm'=magenta, 'c'=cyan, ' '=transparent):")
    print("   " + ("=" * (w * 4 + 4)))
    for ri, row in enumerate(rows):
        chars = []
        for b in row:
            for sub in range(4):
                shift = (3 - sub) * 2
                ci = (b >> shift) & 0b11
                chars.append(GLYPH[ci])
        print(f"   {ri:2}| {''.join(chars)} |")
    print("   " + ("=" * (w * 4 + 4)))

if __name__ == "__main__":
    here = Path(__file__).parent
    # Hero walking frames
    for sid in (0x014A, 0x014B):
        dump_sprite(here / "KM0", sid)
        print()
        dump_sprite(here / "KS0", sid)
        print("\n" + "-"*80 + "\n")
