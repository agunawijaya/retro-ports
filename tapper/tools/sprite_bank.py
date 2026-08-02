"""Render the sprite banks that are not the 32x16 table.

sprite_sheet.py covers ptr_table_a. The other tables were measured after it,
and their strides say what geometry each holds:

    bar_sprite_table   32 entries, stride 0x84 = 6 bytes x 22 rows  -> 24x22
    popup_table_a/b     7 entries, stride 0x1C0 = 14 x 16 x 2 banks -> 56x32

The stride is the check, not a guess: 0x84 is exactly the mask displacement
blit_sprite_24x22 uses, and 0x1C0 is twice the 14x16 block draw_popup_frame
copies per bank. If the geometry were wrong the render would come out sheared,
which is visible immediately.

Entries alternate data and mask, so true pairs step by two -- the same shape
that sprite_sheet.py got wrong before it was looked at.

    python tools/sprite_bank.py [boot_instructions]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga  # noqa: E402
from trace import Machine, LOAD_SEG  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "screens")
MODE_BRANCH = 0x0732
TRANSPARENT = (44, 44, 60)

# name, pointer, bytes/row, rows, masked, entries per image
BANKS = [
    ("bar", 0x44A5, 6, 22, True, 2),
    ("popup", 0x44A7, 14, 32, False, 1),
]


def rows_of(mem, data, mask, bpr, rows, masked):
    out = []
    for y in range(rows):
        # Rows are stored bank-interleaved: all even scanlines first, then
        # all odd ones, each half rows/2 tall.
        bank, r = y & 1, y >> 1
        half = bpr * (rows // 2)
        d = data + bank * half + r * bpr
        k = mask + bank * half + r * bpr
        row = []
        for x in range(bpr):
            db = mem[d + x]
            mb = mem[k + x] if masked else 0
            for shift in (6, 4, 2, 0):
                dv, mv = (db >> shift) & 3, (mb >> shift) & 3
                # Mirror the blitter: `and mask` then `or data`, so mask == 3
                # keeps the background regardless of the data underneath.
                row.append(TRANSPARENT if (masked and mv == 3)
                           else cga.PAL1_HI[dv])
        out.append(row)
    return out


def main():
    boot = int(sys.argv[1]) if len(sys.argv) > 1 else 8_000_000
    m = Machine()
    m.load("TAPPER.COM")
    m.keys = [0x13] + [0x39] * 4000
    orig, done = m._on_exec, [False]

    def hook(cpu, seg, off):
        orig(cpu, seg, off)
        if seg == LOAD_SEG and off == MODE_BRANCH and not done[0]:
            cpu.w8(0, 1)
            done[0] = True

    m.cpu.on_exec = hook
    m.run(boot)
    seg = LOAD_SEG << 4

    from PIL import Image, ImageDraw
    for name, ptr, bpr, rows, masked, step in BANKS:
        table = m.cpu.rd16(LOAD_SEG, ptr)
        n = m.cpu.rd16(LOAD_SEG, table)

        def entry(i, table=table):
            return table + m.cpu.rd16(LOAD_SEG, table + i * 2)

        idx = list(range(1, n, step))
        w, h = bpr * 4, rows
        scale, pad, label_h, per_row = 3, 6, 11, 8
        cw, chh = w * scale + pad, h * scale + pad + label_h
        cols = min(len(idx), per_row)
        rn = (len(idx) + per_row - 1) // per_row
        sheet = Image.new("RGB", (cols * cw + pad, rn * chh + pad), (18, 18, 24))
        draw = ImageDraw.Draw(sheet)
        for k, i in enumerate(idx):
            d = entry(i)
            msk = entry(i + 1) if masked and i + 1 <= n else d
            img = Image.new("RGB", (w, h))
            img.putdata([px for row in
                         rows_of(m.mem, seg + d, seg + msk, bpr, rows, masked)
                         for px in row])
            x = pad + (k % per_row) * cw
            y = pad + (k // per_row) * chh
            sheet.paste(img.resize((w * scale, h * scale), Image.NEAREST),
                        (x, y + label_h))
            draw.text((x, y), str(i), fill=(170, 170, 190))
        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, f"sprites_{name}.png")
        sheet.save(path)
        print(f"{name:6} table={table:04X} entries={n} -> "
              f"{os.path.relpath(path, ROOT)} ({len(idx)} images, {w}x{h})")


if __name__ == "__main__":
    main()
