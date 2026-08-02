"""Render the bartender's sprite frames, straight out of the sprite tables.

This only works in display mode 0, and finding that out settled two open
questions at once.

The player is two stacked 32x16 records whose sprite pointers come from
lookup_ptr_pair (CS:2E1E), which bounds-checks the index against the table's
count word and, when the index is too large, *silently leaves the old pointer in
place*. Under the game as shipped that is exactly what happens: the player asks
for sprite index 13, ptr_table_a holds 7 entries, and CS:2E35 rejects it 208
times in a 3M-instruction run. The bartender therefore never changes pose, and
the bytes at the stale pointer do not decode as a sprite either.

The reason is the display mode. CS:0776 branches on the screen script base, so
the two modes build the sprite tables by different routes:

    mode 1 (as shipped)   ptr_table_a =  7 entries, stride 0x1C0
    mode 0 (forced)       ptr_table_a = 66 entries, stride 0x80

0x80 is what blit_sprite_32x16 assumes: it reads data at [bp] and mask at
[bp+0x80], so with a 0x80 stride the mask of sprite i is simply entry i+1 --
which is also why lookup_ptr_pair fills the record's word 0 and word 2 from
consecutive entries. The 0x1C0 table cannot satisfy that, which is why rendering
mode 1's pointers produces noise.

So this forces AL non-zero at the display-mode branch, lets the game build the
mode 0 tables, and then reads the sprites out by index.

    python tools/render_player.py [first] [count]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga  # noqa: E402
from trace import Machine, LOAD_SEG  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "screens")

MODE_BRANCH = 0x0732          # cmp al, 0 -- the display-mode choice
PTR_TABLE_A = 0x44A1
CELL_W, CELL_H = 32, 16
TRANSPARENT = (44, 44, 60)


def build_tables(limit=2_500_000):
    """Run far enough for the mode 0 sprite tables to exist."""
    m = Machine()
    m.load("TAPPER.COM")
    orig, done = m._on_exec, [False]

    def hook(cpu, seg, off):
        orig(cpu, seg, off)
        if seg == LOAD_SEG and off == MODE_BRANCH and not done[0]:
            cpu.w8(0, 1)
            done[0] = True

    m.cpu.on_exec = hook
    m.run(limit)
    if not done[0]:
        raise SystemExit("the display-mode branch was never reached")
    return m


def sprite_rows(mem, data, mask):
    """32x16, 8 bytes per row, even rows first then odd -- see the blitter."""
    rows = []
    for y in range(CELL_H):
        bank, r = y & 1, y >> 1
        d = data + bank * 0x40 + r * 8
        k = mask + bank * 0x40 + r * 8
        row = []
        for x in range(8):
            db, mb = mem[d + x], mem[k + x]
            for shift in (6, 4, 2, 0):
                dv, mv = (db >> shift) & 3, (mb >> shift) & 3
                row.append(TRANSPARENT if (mv == 3 and dv == 0)
                           else cga.PAL1_HI[dv])
        rows.append(row)
    return rows


def main():
    # Entry 19 is where the bartender's own frames start and stay aligned for
    # six poses; before it the pairing is offset by half a figure and after it
    # the table moves on to other actors. Found by rendering and looking, not
    # derived -- the table has no header saying who owns which entry.
    first = int(sys.argv[1]) if len(sys.argv) > 1 else 19
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 6
    m = build_tables()
    seg = LOAD_SEG << 4
    table = m.cpu.rd16(LOAD_SEG, PTR_TABLE_A)
    n = m.cpu.rd16(LOAD_SEG, table)
    print(f"ptr_table_a at {table:04X}, {n} entries")
    if n < 13:
        raise SystemExit("still the small table -- mode 0 did not take effect")

    def entry(i):
        return table + m.cpu.rd16(LOAD_SEG, table + i * 2)

    # Entries alternate data, mask, data, mask -- lookup_ptr_pair takes them in
    # pairs. The player takes index 1 for its top half and index 3 for its
    # bottom, so one pose spans four entries: top data/mask then bottom
    # data/mask. Stepping by four therefore walks whole bartenders.
    poses = []
    i = first
    while i + 3 <= n and len(poses) < count:
        poses.append((i, entry(i), entry(i + 1), entry(i + 2), entry(i + 3)))
        i += 4

    from PIL import Image
    scale, pad, per_row = 4, 8, 8
    cols = min(len(poses), per_row)
    rows_n = (len(poses) + per_row - 1) // per_row
    cw = CELL_W * scale + pad
    ch = CELL_H * 2 * scale + pad
    sheet = Image.new("RGB", (cols * cw + pad, rows_n * ch + pad), (18, 18, 24))
    for k, (i, td, tm, bd, bm) in enumerate(poses):
        img = Image.new("RGB", (CELL_W, CELL_H * 2))
        top = sprite_rows(m.mem, seg + td, seg + tm)
        bottom = sprite_rows(m.mem, seg + bd, seg + bm)
        img.putdata([px for row in top + bottom for px in row])
        img = img.resize((CELL_W * scale, CELL_H * 2 * scale), Image.NEAREST)
        sheet.paste(img, (pad + (k % per_row) * cw, pad + (k // per_row) * ch))
        print(f"  pose {k+1:2d}  entries {i}..{i+3}  top {td:04X} bottom {bd:04X}")

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "bartender.png")
    sheet.save(path)
    print(f"\nwrote {os.path.relpath(path, ROOT)}  ({len(poses)} poses, "
          f"top half above bottom half)")


if __name__ == "__main__":
    main()
