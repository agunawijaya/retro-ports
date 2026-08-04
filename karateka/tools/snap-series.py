#!/usr/bin/env python3
"""snap-series.py -- record shadow buffer at a schedule of step counts.

Karateka's attract loop is a self-playing demo: title, story cutscene,
gameplay against a guard, back to title. Sampling the shadow at many
points along the demo gives us a set of reference screens the port can be
compared against.

Writes shadow-XXXXXXXX.bin (step count) and shadow-XXXXXXXX.png for every
sample, plus a manifest listing which files were opened at that moment
(so we can guess which scene the game was in).
"""

import argparse
import struct
import sys
from pathlib import Path


CGA = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]


def to_png(shadow, path, scale=2):
    from PIL import Image
    img = Image.new("RGB", (320, 200))
    px = img.load()
    for row in range(200):
        base = row * 80
        for col in range(80):
            v = shadow[base + col]
            for k in range(4):
                px[col * 4 + k, row] = CGA[(v >> (6 - k * 2)) & 3]
    img.resize((320 * scale, 200 * scale), Image.NEAREST).save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--toolkit", required=True)
    ap.add_argument("--game", default="original")
    ap.add_argument("--budget", type=int, default=120_000_000)
    ap.add_argument("--interval", type=int, default=2_000_000,
                    help="dump a snapshot every N instructions")
    ap.add_argument("--out", default="reference/demo")
    args = ap.parse_args()

    sys.path.insert(0, str(Path(args.toolkit) / "tools"))
    import comrun
    from unicorn import UC_HOOK_CODE

    exe = (Path(args.game) / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(exe, keys=[], files=Path(args.game))

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    snaps = []
    last_snap = [0]

    def tick(_uc, _addr, _size, _):
        if m.steps - last_snap[0] >= args.interval:
            last_snap[0] = m.steps
            snap = bytes(m.uc.mem_read(0x10100 + 0x6FD7, 16000))
            files = list(dict.fromkeys(m.file_reads))
            snaps.append((m.steps, snap, files))

    m.uc.hook_add(UC_HOOK_CODE, tick)

    why = m.run(None, stop=None, budget=args.budget)
    print(f"stopped: {why} @ {m.steps:,} steps, {len(snaps)} snapshots")

    manifest_lines = []
    for i, (step, snap, files) in enumerate(snaps):
        tag = f"{i:02d}-step{step:010d}"
        bin_path = out / f"{tag}.bin"
        png_path = out / f"{tag}.png"
        bin_path.write_bytes(snap)
        to_png(snap, png_path)
        non_zero = sum(1 for b in snap if b)
        # Which BAL/CAL files are open?
        scenes = [f for f in files if f.startswith(("BAL", "CAL"))]
        manifest_lines.append(
            f"{tag}  step={step:>12,}  non-zero={non_zero:>5}  scenes={','.join(scenes) or '-'}")
        print(f"  {tag}: {non_zero} non-zero bytes, scenes: {scenes}")

    (out / "manifest.txt").write_text("\n".join(manifest_lines))
    print(f"wrote manifest to {out}/manifest.txt")


if __name__ == "__main__":
    main()
