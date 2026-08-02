"""Dump the game's own rendered frame straight out of video memory.

Every sprite catalogue so far shows pieces in isolation, which is enough to
check geometry but not enough to say what a piece *is*: sprites_bar.png is
clean and unidentifiable at the same time. A sprite means something only in
place.

So instead of assembling a picture, this takes the one the game assembled.
It runs far enough for play to be underway, then decodes draw_target_segment
-- 0x4000 bytes, both CGA banks -- exactly as the hardware would scan it.

Falsifiable in the plainest way: if the emulation, the bank interleave or the
palette were wrong, the result would not look like Tapper.

    python tools/frame_dump.py [instructions] [out_name]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga  # noqa: E402
from trace import Machine, LOAD_SEG  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "screens")
MODE_BRANCH = 0x0732
DRAW_TARGET = 0x4493


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 120_000_000
    name = sys.argv[2] if len(sys.argv) > 2 else "frame"

    m = Machine()
    m.load("TAPPER.COM")
    m.keys = [0x13] + [0x39] * 4000
    orig, done = m._on_exec, [False]

    def hook(cpu, seg, off):
        orig(cpu, seg, off)
        if seg == LOAD_SEG and off == MODE_BRANCH and not done[0]:
            cpu.w8(0, 1)                     # force display mode 0
            done[0] = True

    m.cpu.on_exec = hook
    reason = m.run(limit)
    print(f"ran {m.cpu.icount:,} instructions ({reason})")

    seg = m.cpu.rd16(LOAD_SEG, DRAW_TARGET)
    base = seg << 4
    print(f"draw_target_segment = {seg:04X}")

    data = bytes(m.mem[base:base + 0x4000])
    ink = sum(1 for b in data if b)
    print(f"non-zero bytes: {ink:,} / {len(data):,}")
    if ink == 0:
        raise SystemExit("frame is blank -- nothing was drawn")

    rows = cga.decode_2bpp(data)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.png")
    cga.save_png(rows, path, scale=2)
    print(f"wrote {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
