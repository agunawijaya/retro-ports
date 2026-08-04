#!/usr/bin/env python3
"""prove-exact.py -- byte-exact match, not just bounding-box.

prove-blit.py proved the DIMENSIONS and POSITION of every sprite draw match
what our decoder says. This one asks the stricter question: are the byte
VALUES right?

For the first test we pick the simplest case: fig 208, a 1x12 structural
fence-post drawn without a mask and at byte-aligned X (shift = 0). If our
decoded bytes equal the shadow bytes at exactly those positions, we have
byte-for-byte proof for one sprite.
"""

import struct
import sys
from pathlib import Path


SHADOW_OFF = 0x6FD7
SHADOW_LEN = 16000
SPRITE_BASE = 0x443C


def decode_rle(stream, want):
    out, k = bytearray(), 0
    while k < len(stream) and len(out) < want:
        b = stream[k]
        k += 1
        if b != 0x7B:
            out.append(b)
            continue
        if k + 1 >= len(stream):
            break
        v, c = stream[k], stream[k + 1]
        k += 2
        out += bytes([v]) * (c + 1)
    return bytes(out)


def main():
    toolkit = Path(sys.argv[1] if len(sys.argv) > 1
                   else "E:/Projects/DOS-Decompiler")
    sys.path.insert(0, str(toolkit / "tools"))
    import comrun
    from unicorn.x86_const import (UC_X86_REG_SS, UC_X86_REG_SP, UC_X86_REG_DS)

    game = Path("original")
    image = (game / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(image, files=game)

    proven = []

    def entry(_):
        ss = m.uc.reg_read(UC_X86_REG_SS)
        sp = m.uc.reg_read(UC_X86_REG_SP)
        ds = m.uc.reg_read(UC_X86_REG_DS)
        def rw(seg, off):
            return struct.unpack_from("<H", bytes(m.uc.mem_read(
                (seg << 4) + off, 2)))[0]
        fig = rw(ss, sp + 2) & 0xFF
        x = struct.unpack("<h", struct.pack("<H", rw(ss, sp + 4)))[0]
        y = rw(ss, sp + 6) & 0xFF
        # Pick fig 201 shift=0 -- the fence, 24 bytes wide, actual content.
        if fig != 201 or x % 4 != 0:
            return
        shape_off = rw(ds, 0x423C + fig * 2)
        header = bytes(m.uc.mem_read((ds << 4) + SPRITE_BASE + shape_off, 3))
        w, h = header[0], header[1]
        body = bytes(m.uc.mem_read((ds << 4) + SPRITE_BASE + shape_off + 3,
                                    w * h + 32))
        px = decode_rle(body, w * h)
        before = bytes(m.uc.mem_read(0x10100 + SHADOW_OFF, SHADOW_LEN))
        # Register an exit hook to compare after.
        def on_return(_):
            after = bytes(m.uc.mem_read(0x10100 + SHADOW_OFF, SHADOW_LEN))
            # For a structural sprite (no mask), the blitter writes shape
            # bytes directly. Column-major: byte k -> (row=k%h, col=k//h).
            # Byte-aligned (shift=0), 1-wide: byte k -> row=k, col=x//4.
            dst_col = x // 4
            top = y - h
            print(f"\nfig {fig} at x={x} y={y} shift=0 sprite {w}x{h} "
                  f"({len(px)} bytes decoded)")
            print(f"  destination: rows {top}..{y-1}, cols {dst_col}..{dst_col+w-1}")
            # Column-major: byte k in stream goes to (col=k//h, row=k%h).
            matches = total = nonzero = 0
            first_bad = None
            for k in range(w * h):
                col, row = divmod(k, h)
                sprite_val = px[k]
                shadow_val = after[(top + row) * 80 + dst_col + col]
                total += 1
                if sprite_val != 0:
                    nonzero += 1
                if shadow_val == sprite_val:
                    matches += 1
                elif first_bad is None:
                    first_bad = (row, col, sprite_val, shadow_val)
            print(f"  {matches}/{total} bytes exact "
                  f"({nonzero} non-zero sprite bytes)")
            if first_bad:
                r, c, s, sh = first_bad
                print(f"  first mismatch: row {top+r}, col {dst_col+c}, "
                      f"shape={s:02X} shadow={sh:02X}")
            proven.append((matches, total))
            m.watch.pop(0x00A69, None)
            m.stopped = "proven"
            m.uc.emu_stop()
        m.watch[0x00A69] = on_return

    m.watch[0x083C] = entry
    m.watch[0x0640] = entry

    print("running the game, waiting for fig 208 at byte-aligned X ...")
    m.run(None, stop=None, budget=30_000_000)
    if not proven:
        print("no fig 208 shift=0 blit reached in budget")
        return 1
    ok, h = proven[0]
    print(f"\nRESULT: {ok}/{h} bytes match byte-exact")
    return 0 if ok == h else 1


if __name__ == "__main__":
    sys.exit(main())
