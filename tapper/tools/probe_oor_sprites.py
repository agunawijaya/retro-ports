"""Render the sprite indices the game asks for but its table cannot serve.

Runtime tracing caught player_top and player_bottom requesting indices 78, 80
and 126 while ptr_table_a holds only 66 entries. sprite_index_in_range
(CS:2E64) drops those silently, so nothing is drawn and nothing complains.

Two explanations fit: a defect, or a path meant for a display mode whose table
is larger. They predict different pictures. Reading past the pointer array
lands inside the sprite *data*, so a defect should render as noise; a real
entry would render as a coherent figure.

This renders the in-range tail and the three out-of-range indices side by side
so the difference is visible rather than argued.

    python tools/probe_oor_sprites.py [boot_instructions]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trace import Machine, LOAD_SEG  # noqa: E402
from sprite_sheet import sprite_rows, CELL_W, CELL_H  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "screens")
PTR_TABLE_A = 0x44A1
MODE_BRANCH = 0x0732
WANTED = [59, 61, 63, 65, 78, 80, 126]


def main():
    boot = int(sys.argv[1]) if len(sys.argv) > 1 else 8_000_000
    m = Machine()
    m.load("TAPPER.COM")
    m.keys = [0x13] + [0x39] * 4000
    orig, done = m._on_exec, [False]

    def hook(cpu, seg, off):
        orig(cpu, seg, off)
        if seg == LOAD_SEG and off == MODE_BRANCH and not done[0]:
            cpu.w8(0, 1)                    # force display mode 0
            done[0] = True

    m.cpu.on_exec = hook
    m.run(boot)

    seg = LOAD_SEG << 4
    table = m.cpu.rd16(LOAD_SEG, PTR_TABLE_A)
    n = m.cpu.rd16(LOAD_SEG, table)
    print(f"ptr_table_a at {table:04X}, {n} entries")
    print(f"in-range indices are 1..{n}\n")

    def entry(i):
        return table + m.cpu.rd16(LOAD_SEG, table + i * 2)

    from PIL import Image, ImageDraw
    scale, pad, label_h = 3, 6, 12
    cw, ch = CELL_W * scale + pad, CELL_H * scale + pad + label_h
    sheet = Image.new("RGB", (len(WANTED) * cw + pad, ch + pad), (18, 18, 24))
    draw = ImageDraw.Draw(sheet)

    for k, i in enumerate(WANTED):
        d, msk = entry(i), entry(i + 1)
        state = "ok" if i <= n else "OUT"
        print(f"  index {i:3d}  {state:3}  data={d:04X} mask={msk:04X}")
        img = Image.new("RGB", (CELL_W, CELL_H))
        img.putdata([px for row in sprite_rows(m.mem, seg + d, seg + msk)
                     for px in row])
        x = pad + k * cw
        sheet.paste(img.resize((CELL_W * scale, CELL_H * scale), Image.NEAREST),
                    (x, pad + label_h))
        draw.text((x, pad), f"{i} {state}",
                  fill=(230, 120, 120) if state == "OUT" else (170, 170, 190))

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "sprites_out_of_range.png")
    sheet.save(path)
    print(f"\nwrote {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
