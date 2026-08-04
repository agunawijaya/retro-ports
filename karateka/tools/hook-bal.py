#!/usr/bin/env python3
"""hook-bal.py -- record every draw_sprite call in the first BAL scene.

Runs KARATEKA.EXE and hooks the two sprite entry points (image 0x083C and
image 0x0640), recording fig / x / y / ksc-offset / kmc-offset for every
call. Stops after N calls or when the budget runs out.

The point: prove what the game passes to draw_sprite for BAL00's own six
figures -- especially fig 202 (the palace gate), whose x=326 in the script
does not resolve to a visible gate under a naive left-edge interpretation.
"""

import argparse
import struct
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--toolkit", required=True)
    ap.add_argument("--game", default="original")
    ap.add_argument("--budget", type=int, default=30_000_000)
    ap.add_argument("--first", type=int, default=80)
    ap.add_argument("--snap-after", type=int, default=0,
                    help="dump shadow.bin right after the Nth blit call")
    ap.add_argument("--snap-out", default="reference/compare/scene-after.bin")
    ap.add_argument("--keys", default="",
                    help="comma-separated keys fed to INT 16h; use 0x0D for "
                         "enter, 0x20 for space, 0x4D for arrow-right")
    ap.add_argument("--snap-on-file", default="",
                    help="dump shadow when this filename is opened (e.g. "
                         "'BAL01') -- captures right BEFORE the fresh scene "
                         "starts drawing")
    args = ap.parse_args()

    sys.path.insert(0, str(Path(args.toolkit) / "tools"))
    import comrun
    from unicorn.x86_const import UC_X86_REG_SS, UC_X86_REG_SP, UC_X86_REG_DS

    keys = []
    for k in (args.keys.split(",") if args.keys else []):
        if not k: continue
        keys.append(int(k, 0) if k.lower().startswith("0x") else ord(k[0]))
    exe = (Path(args.game) / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(exe, keys=keys, files=Path(args.game))

    blits = []
    def rw(seg, off):
        return struct.unpack_from("<H", bytes(m.uc.mem_read((seg << 4) + off, 2)))[0]

    snap_done = [False]
    def entry(_):
        ss = m.uc.reg_read(UC_X86_REG_SS)
        sp = m.uc.reg_read(UC_X86_REG_SP)
        ds = m.uc.reg_read(UC_X86_REG_DS)
        fig = rw(ss, sp + 2) & 0xFF
        x = struct.unpack("<h", struct.pack("<H", rw(ss, sp + 4)))[0]
        y = rw(ss, sp + 6) & 0xFF
        ksc = rw(ds, 0x423C + fig * 2)
        kmc = rw(ds, 0x873A + fig * 2)
        blits.append({"fig": fig, "x": x, "y": y, "ksc": ksc, "kmc": kmc,
                      "step": m.steps})
        # After the Nth blit runs (which draws its sprite before returning),
        # peek at the shadow buffer AFTER the return so the sprite is in it.
        # Simpler: hook the RET path. Even simpler: capture RIGHT before
        # the (N+1)-th call, which is functionally "after the Nth completed".
        if args.snap_after and len(blits) == args.snap_after + 1 and not snap_done[0]:
            snap = bytes(m.uc.mem_read(0x10100 + 0x6FD7, 16000))
            Path(args.snap_out).parent.mkdir(parents=True, exist_ok=True)
            Path(args.snap_out).write_bytes(snap)
            snap_done[0] = True
            print(f"snapped shadow @ blit #{args.snap_after}, step={m.steps:,} -> {args.snap_out}")

    m.watch[0x0640] = entry
    m.watch[0x083C] = entry

    why = m.run(None, stop=None, budget=args.budget)
    print(f"stopped: {why} @ {m.steps:,} steps, {len(blits)} blits captured")
    print(f"files: {', '.join(dict.fromkeys(m.file_reads))}")
    print()
    print(f"first {args.first} blits:")
    for i, b in enumerate(blits[:args.first]):
        print(f"  [{i:3}] step={b['step']:>10,}  "
              f"fig={b['fig']:3}  x={b['x']:5}  y={b['y']:3}  "
              f"ksc=0x{b['ksc']:04x}  kmc=0x{b['kmc']:04x}")


if __name__ == "__main__":
    main()
