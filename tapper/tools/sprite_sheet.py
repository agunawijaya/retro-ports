"""Render the whole 32x16 sprite table and say who owns each entry.

render_player.py found the bartender's frames by rendering a window and looking
at it, which settled the picture but not the ownership: nothing in the table
says which entries belong to which actor. This derives that instead of eyeing
it.

Every sprite pointer is installed by lookup_ptr_pair (CS:2E1E) or
set_entity_sprite (CS:2E53), and both take the record in BP and the index in AL.
Hooking their entry therefore records exactly which record asked for which
index, and the records are already named -- player_top and player_bottom, their
previous-position twins, and the sixteen entity slots at entity_table.

Display mode 0 is forced because mode 1 builds a 7-entry table with a 0x1C0
stride that the 32x16 blitter cannot use; see FINDINGS.md.

    python tools/sprite_sheet.py [instructions]
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga  # noqa: E402
from trace import Machine, LOAD_SEG  # noqa: E402
from emu8086 import BP  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "screens")

MODE_BRANCH = 0x0732
LOOKUP_PAIR, SET_ENTITY_SPRITE = 0x2E1E, 0x2E53
PTR_TABLE_A = 0x44A1
ENTITY_TABLE = 0x4583
CELL_W, CELL_H = 32, 16
TRANSPARENT = (44, 44, 60)

NAMED_RECORDS = {
    0x4683: "player_top",
    0x4693: "player_bottom",
    0x46A3: "player_prev_top",
    0x46B3: "player_prev_bottom",
}


def record_name(rec):
    if rec in NAMED_RECORDS:
        return NAMED_RECORDS[rec]
    if ENTITY_TABLE <= rec < ENTITY_TABLE + 16 * 16:
        slot = (rec - ENTITY_TABLE) // 16
        return f"entity bar {slot // 4} slot {slot % 4}"
    return f"record {rec:04X}"


def sprite_rows(mem, data, mask):
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
                # The blitter does `and ax, mask` then `or ax, data`, so a
                # mask pair of 11 keeps the background whatever the data
                # says. Testing dv == 0 as well is an extra condition the
                # hardware never applies; it agrees on clean sprites and
                # leaves speckle on the ones where it does not.
                row.append(TRANSPARENT if mv == 3 else cga.PAL1_HI[dv])
        rows.append(row)
    return rows


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 60_000_000
    m = Machine()
    m.load("TAPPER.COM")
    m.keys = [0x13] + [0x39] * 4000        # R once, then Space forever
    orig, done = m._on_exec, [False]
    owners = defaultdict(set)              # index -> {record name}

    def hook(cpu, seg, off):
        orig(cpu, seg, off)
        if seg != LOAD_SEG:
            return
        if off == MODE_BRANCH and not done[0]:
            cpu.w8(0, 1)
            done[0] = True
        elif off in (LOOKUP_PAIR, SET_ENTITY_SPRITE):
            owners[cpu.r8(0) & 0x7F].add(record_name(cpu.regs[BP]))

    m.cpu.on_exec = hook
    reason = m.run(limit)
    print(f"ran {m.cpu.icount:,} instructions ({reason})")

    seg = LOAD_SEG << 4
    table = m.cpu.rd16(LOAD_SEG, PTR_TABLE_A)
    n = m.cpu.rd16(LOAD_SEG, table)
    print(f"ptr_table_a at {table:04X}, {n} entries\n")
    if n < 13:
        raise SystemExit("small table -- mode 0 did not take effect")

    print("index ownership, observed at runtime:")
    if not owners:
        print("  nothing asked for a sprite in this run")
    for idx in sorted(owners):
        print(f"  {idx:3d}  {', '.join(sorted(owners[idx]))}")

    def entry(i):
        return table + m.cpu.rd16(LOAD_SEG, table + i * 2)

    from PIL import Image, ImageDraw
    scale, pad, per_row, label_h = 3, 6, 11, 10
    # Entries are (data, mask) couples: lookup_ptr_pair takes an index and
    # uses entry(i) for the pixels and entry(i+1) for the mask. Walking every
    # i therefore renders each real sprite once and each *shifted* pairing
    # once, and the shifted ones come out opaque because a data block used as
    # a mask has no transparent bits. Stepping by two keeps only true pairs.
    #
    # The runtime ownership data agrees: of the in-range indices actually
    # requested -- 1, 3, 11, 13, 17, 19, 21, 23, 31, 33, 59, 61 -- every one
    # is odd.
    pairs = [(i, entry(i), entry(i + 1)) for i in range(1, n, 2)]
    cols = min(len(pairs), per_row)
    rows_n = (len(pairs) + per_row - 1) // per_row
    cw = CELL_W * scale + pad
    ch = CELL_H * scale + pad + label_h
    sheet = Image.new("RGB", (cols * cw + pad, rows_n * ch + pad), (18, 18, 24))
    draw = ImageDraw.Draw(sheet)
    for k, (i, d, msk) in enumerate(pairs):
        x = pad + (k % per_row) * cw
        y = pad + (k // per_row) * ch
        img = Image.new("RGB", (CELL_W, CELL_H))
        img.putdata([px for row in sprite_rows(m.mem, seg + d, seg + msk)
                     for px in row])
        sheet.paste(img.resize((CELL_W * scale, CELL_H * scale), Image.NEAREST),
                    (x, y + label_h))
        mark = "*" if i in owners else " "
        draw.text((x, y), f"{i}{mark}", fill=(170, 170, 190))

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "sprites.png")
    sheet.save(path)
    print(f"\nwrote {os.path.relpath(path, ROOT)}  ({len(pairs)} entries, "
          f"* marks an index some record actually asked for)")


if __name__ == "__main__":
    main()
