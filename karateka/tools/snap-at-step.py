#!/usr/bin/env python3
"""snap-at-step.py -- record shadow snapshots every N instructions.

Then, after the run, pick the snapshot closest to a target step (e.g. right
after a specific blit call completed). This is how we catch the moment
between two draw_sprite entries -- the hook can only fire on entry, so
between blit N and blit N+1 we cannot hook, but we CAN sample the shadow
often enough that one sample lands there.
"""

import argparse
import struct
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--toolkit", required=True)
    ap.add_argument("--game", default="original")
    ap.add_argument("--budget", type=int, default=5_000_000)
    ap.add_argument("--every", type=int, default=1000,
                    help="save a shadow snapshot every N instructions")
    ap.add_argument("--target-step", type=int, required=True,
                    help="write the snapshot whose step >= this to --out")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    sys.path.insert(0, str(Path(args.toolkit) / "tools"))
    import comrun
    from unicorn import UC_HOOK_CODE

    exe = (Path(args.game) / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(exe, keys=[], files=Path(args.game))

    best = [None]  # (step, bytes)

    def tick(_uc, _addr, _size, _):
        if m.steps % args.every == 0:
            if m.steps >= args.target_step and best[0] is None:
                snap = bytes(m.uc.mem_read(0x10100 + 0x6FD7, 16000))
                best[0] = (m.steps, snap)
                # Stop the run right away -- we have what we came for.
                m.uc.emu_stop()

    m.uc.hook_add(UC_HOOK_CODE, tick)

    why = m.run(None, stop=None, budget=args.budget)
    print(f"stopped: {why} @ {m.steps:,} steps")
    if best[0] is None:
        print(f"target step {args.target_step:,} not reached")
        return 1
    step, snap = best[0]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_bytes(snap)
    print(f"snapped at step {step:,} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
