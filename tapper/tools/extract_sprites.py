"""Extract Tapper's sprites using the format recovered from the live blitter.

The blitter at CS:2CE0 (inner loop CS:2CFF) resolves the format exactly:

    2CFF  mov cx, 8          ; 8 rows per CGA bank
    2D02  mov dl, 4          ; 4 words = 8 bytes = 32 pixels per row
    2D04  mov ax, [di]       ; read screen
    2D06  and ax, [bp+0x80]  ; AND with the mask, 128 bytes after the data
    2D0A  or  ax, [bp]       ; OR in the data
    2D0D  stosw
    2D14  add di, 0x48       ; +72, plus the 8 stosw advanced = 80 = one scanline

The caller runs that twice with `xor di, 0x2000` between, once per CGA bank, so
a sprite is 32x16 pixels: 128 bytes of data (bank-interleaved) followed by 128
bytes of mask. Blending is `screen = (screen AND mask) OR data`, i.e. mask bits
are 1 where the sprite is transparent.

Rather than guessing where sprites live, we run the game and record the base
address the blitter is actually handed, then read those out of live memory.
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga
from trace import Machine, LOAD_SEG, OUT

SPRITE_W_BYTES = 8          # 32 pixels at 2 bits per pixel
SPRITE_ROWS = 16            # 8 per bank, two banks
DATA_SIZE = SPRITE_W_BYTES * SPRITE_ROWS      # 128
MASK_OFFSET = 0x80


def decode_sprite(blob, palette=cga.PAL1_HI, show_mask=False):
    """Decode 256 bytes into rows of RGBA-ish tuples (None = transparent)."""
    rows = [None] * SPRITE_ROWS
    for i in range(SPRITE_ROWS):
        # Rows 0..7 are the even screen lines, 8..15 the odd ones.
        screen_y = (i - 8) * 2 + 1 if i >= 8 else i * 2
        row = []
        for b in range(SPRITE_W_BYTES):
            off = i * SPRITE_W_BYTES + b
            data = blob[off]
            mask = blob[off + MASK_OFFSET]
            for shift in (6, 4, 2, 0):
                d = (data >> shift) & 3
                mk = (mask >> shift) & 3
                if show_mask:
                    row.append(palette[mk])
                elif mk == 3 and d == 0:
                    row.append(None)          # fully transparent pixel
                else:
                    row.append(palette[d])
        rows[screen_y] = row
    return rows


def to_png(rows, path, scale=4, bg=(24, 24, 32)):
    grid = [[px if px is not None else bg for px in r] for r in rows]
    cga.save_png(grid, path, scale=scale)


def sheet(sprites, path, cols=8, scale=3, bg=(24, 24, 32)):
    """Tile decoded sprites into a contact sheet with 1px gutters."""
    cell_w, cell_h = 32, SPRITE_ROWS
    rows_n = (len(sprites) + cols - 1) // cols
    W = cols * (cell_w + 1) + 1
    H = rows_n * (cell_h + 1) + 1
    grid = [[(60, 60, 70)] * W for _ in range(H)]
    for i, spr in enumerate(sprites):
        cx, cy = i % cols, i // cols
        x0 = cx * (cell_w + 1) + 1
        y0 = cy * (cell_h + 1) + 1
        for y in range(cell_h):
            for x in range(cell_w):
                px = spr[y][x] if spr[y] else None
                grid[y0 + y][x0 + x] = px if px is not None else bg
    cga.save_png(grid, path, scale=scale)


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 8_000_000
    m = Machine()
    m.load("TAPPER.COM")
    reason = m.run(limit)
    print(f"ran {m.cpu.icount:,} instructions ({reason})")
    print(f"distinct sprite base addresses seen: {len(m.sprite_ptrs)}")
    if not m.sprite_ptrs:
        print("blitter never reached -- run longer or fix the key script")
        return

    base = LOAD_SEG << 4
    out = os.path.join(OUT, "sprites")
    os.makedirs(out, exist_ok=True)

    ptrs = sorted(m.sprite_ptrs)
    lo, hi = ptrs[0], ptrs[-1]
    print(f"address range: {lo:04X}..{hi:04X}  "
          f"(spacing suggests {'a packed table' if hi - lo > 256 else 'one block'})")

    decoded, kept = [], []
    for p in ptrs:
        blob = bytes(m.mem[base + p:base + p + DATA_SIZE + 128])
        if len(blob) < DATA_SIZE + 128:
            continue
        decoded.append(decode_sprite(blob))
        kept.append(p)

    sheet(decoded, os.path.join(out, "sheet_all.png"))
    print(f"wrote sheet of {len(decoded)} sprites -> {out}\\sheet_all.png")

    for p, spr in list(zip(kept, decoded))[:16]:
        to_png(spr, os.path.join(out, f"spr_{p:04X}.png"))

    print("\nmost frequently drawn sprites:")
    for p, n in m.sprite_ptrs.most_common(12):
        print(f"  {p:04X}  drawn {n:,}x")

    # Sprite bases that fall inside the overlay buffer at 0x3C80 come straight
    # from TAPPER.DAT sectors; ones below that live in the executable itself.
    from_dat = [p for p in ptrs if p >= 0x3C80]
    print(f"\n{len(from_dat)}/{len(ptrs)} sprite bases sit at or above the "
          f"0x3C80 overlay buffer (i.e. loaded from TAPPER.DAT)")


if __name__ == "__main__":
    main()
