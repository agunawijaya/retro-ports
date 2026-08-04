#!/usr/bin/env python3
"""referee.py -- Compare what our decoder draws against what the game draws.

The point, restated. render-sprites.py produces pictures from the .DAT files
alone; nothing runs. That is the deliverable. This is the referee -- it drives
KARATEKA.EXE under comrun.py to a chosen scene, reads the shadow buffer at
DS:0x0337 (16,000 bytes, 200 rows of 80, CGA mode 4 palette 1), and gives us
back two things we can put next to our decoder's output:

    * a PNG rendered from the buffer, so a mismatch is visible
    * the raw bytes, so a mismatch is *locatable*

A visual match with no byte comparison is what the previous port shipped, and
it shipped a different game. This file exists so we cannot do that again.

Notes on coordinates, because getting these wrong is the ordinary way this
kind of thing fails:

    DS after start-up = image + 0x6CA0             (per karateka/CLAUDE.md)
    shadow buffer at DS:0x0337
        -> image offset 0x6CA0 + 0x0337 = 0x6FD7

    comrun.py's Machine.read(off, n) reads at image offset `off`. So
    m.read(0x6FD7, 16000) is the shadow buffer.

Usage:

    python tools/referee.py --toolkit E:\\Projects\\DOS-Decompiler \\
        --out reference/referee                    # run, dump, render

    python tools/referee.py --toolkit ... --budget 60000000 \\
        --at 0x2400=RET                            # exit before entering fight

The comrun invocation is the honest cost of the check. It runs the game.
"""

import argparse
import struct
import sys
from pathlib import Path


SHADOW_OFF = 0x6FD7        # DS:0x0337 as image offset (DS = image + 0x6CA0)
SHADOW_LEN = 16000         # 200 rows of 80 bytes


def dump_shadow(m):
    """Read the shadow buffer out of the machine after a run."""
    return bytes(m.read(SHADOW_OFF, SHADOW_LEN))


def shadow_to_png(shadow, path, palette, scale=3):
    """Decode the linear CGA plane at DS:0x0337 to a PNG.

    Not the same layout as VRAM. VRAM at B800:0000 is interlaced -- even
    scanlines at 0x0000, odd at 0x2000 -- because that is how the CGA chip
    reads it. The shadow buffer is `row * 80 + col`, straight through, because
    the drawing routines want a flat plane to walk down (`add di, 80` steps
    one scanline). Miss the difference and every image looks like two combs.
    """
    from PIL import Image
    img = Image.new("RGB", (320, 200))
    px = img.load()
    for row in range(200):
        base = row * 80
        for b in range(80):
            v = shadow[base + b]
            for k in range(4):
                px[b * 4 + k, row] = palette[(v >> (6 - k * 2)) & 3]
    img.resize((320 * scale, 200 * scale), Image.NEAREST).save(path)


def parse_at(spec, m, args_at_keys=None):
    """--at ADDR=RET  poke a `ret` at that image offset so the routine returns
    immediately. Useful to stop before a scene we do not want.  Otherwise
    behaves like comrun's --at ADDR=KEY.
    """
    if not spec:
        return
    for item in spec.split(","):
        if not item.strip():
            continue
        a, _, v = item.partition("=")
        addr = int(a, 16)
        if v.upper() == "RET":
            # Overwrite the first byte with 0xC3 (near ret). Enough to keep
            # the routine from doing anything.
            from unicorn import UC_PROT_ALL
            m.uc.mem_write(0x10100 + addr, b"\xC3")
        else:
            val = int(v, 0) if v.lower().startswith("0x") else ord(v[0])
            m.at_keys.setdefault(addr, []).append(val)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="original",
                    help="folder holding KARATEKA.EXE and the data files")
    ap.add_argument("--toolkit", required=True,
                    help="a DOS-Decompiler checkout, for comrun.py and the "
                         "CGA palette")
    ap.add_argument("--budget", type=int, default=30_000_000,
                    help="instructions before we give up and dump what is "
                         "there. 30M gets to the intro; 60M reaches the "
                         "first fight")
    ap.add_argument("--stop-at", default=None,
                    help="image offset to stop at (hex, e.g. 0x3d7f)")
    ap.add_argument("--at", default="",
                    help="ADDR=RET to poke a `ret` (skip a routine), or "
                         "ADDR=KEY to hand a key over on arrival. Comma "
                         "separated.")
    ap.add_argument("--keys", default="",
                    help="keystrokes fed to INT 16h, comma separated")
    ap.add_argument("--out", default="reference/referee",
                    help="where to write the dump and the PNGs")
    ap.add_argument("--palette", default="1")
    args = ap.parse_args()

    sys.path.insert(0, str(Path(args.toolkit) / "tools"))
    import comrun
    import gfxdump

    palette = gfxdump.PALETTES[args.palette]
    game = Path(args.game)
    exe = game / "KARATEKA.EXE"
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    keys = []
    for k in (args.keys.split(",") if args.keys else []):
        if not k:
            continue
        keys.append(int(k, 0) if k.lower().startswith("0x") else ord(k[0]))

    image = exe.read_bytes()
    m = comrun.Machine(image, keys=keys, files=game)
    if args.stop_at:
        m.stop_off = int(args.stop_at, 16)
        m.stop_after = 1
    parse_at(args.at, m)

    print(f"running KARATEKA.EXE ({len(image):,} bytes), budget "
          f"{args.budget:,} instructions ...")
    why = m.run(None, stop=None, budget=args.budget)
    print(f"stopped at {m.steps:,} instructions: {why}")
    print(f"  files opened: {', '.join(dict.fromkeys(m.file_reads))}")

    shadow = dump_shadow(m)
    dump_path = out / "shadow.bin"
    dump_path.write_bytes(shadow)
    print(f"  wrote {dump_path} ({len(shadow):,} bytes)")

    shadow_png = out / "shadow.png"
    shadow_to_png(shadow, shadow_png, palette)
    print(f"  wrote {shadow_png}")

    vram_png = out / "vram.png"
    comrun.to_png(m.framebuffer(), vram_png, args.palette)
    print(f"  wrote {vram_png}")

    non_zero = sum(1 for b in shadow if b)
    print(f"  shadow non-zero: {non_zero}/{len(shadow)} bytes "
          f"({100 * non_zero / len(shadow):.1f}%)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
