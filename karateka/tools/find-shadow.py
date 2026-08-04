#!/usr/bin/env python3
"""find-shadow.py -- Where is the shadow buffer, really?

The referee assumes DS:0x0337 lives at image offset 0x6FD7 (per the doc's
DS = image + 0x6CA0 rule). If that is wrong -- and a wrong offset silently
substitutes nothing -- the byte comparisons never match. So instead of
believing the offset, ask the machine directly: run KARATEKA, then scan its
address space for a large window whose contents equal FUJI.BCG.

If nothing matches, the .BCG never landed anywhere. If it matches at 0x6FD7
we know the doc is right. If it matches somewhere else, that is the shadow.
"""

import struct
import sys
from pathlib import Path


def main():
    toolkit = Path(sys.argv[1] if len(sys.argv) > 1 else "E:/Projects/DOS-Decompiler")
    sys.path.insert(0, str(toolkit / "tools"))
    import comrun

    game = Path("original")
    image = (game / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(image, files=game)
    print("running to 30M ...")
    why = m.run(None, stop=None, budget=30_000_000)
    print(f"stopped: {why}, {m.steps:,} instructions")

    fuji = (game / "FUJI.BCG").read_bytes()
    # The BCG data itself (skip the 2-byte count).
    payload = fuji[2:]
    # First 80 bytes = the top scanline. In-memory it will be that same 80
    # bytes -- the game copies the file into the shadow buffer wholesale.
    top_row = payload[:80]

    print(f"\nlooking for FUJI.BCG's first row ({len(top_row)} bytes) "
          "in the machine's memory ...")
    # Scan the 2 MB address space in 4 KB windows for the top row.
    mem = bytes(m.uc.mem_read(0, 0x200000))
    hits = []
    k = 0
    while True:
        i = mem.find(top_row, k)
        if i < 0:
            break
        hits.append(i)
        k = i + 1
    print(f"top row appears at {len(hits)} flat addresses:")
    for a in hits[:15]:
        # If in the program area (BASE..BASE+MEMSZ), convert to image offset.
        img_off = a - 0x10100
        as_img = f"image {img_off:#07x}" if img_off >= 0 else "(pre-image)"
        # As DS:XXX assuming DS=0x16DA (image + 0x6CA0)
        as_ds = f"DS:0x{a - 0x16DA0:04X}" if 0x16DA0 <= a < 0x16DA0 + 0x10000 else ""
        print(f"  flat {a:#08x}  {as_img}  {as_ds}")

    # Now check the FULL FUJI.BCG payload at each hit -- does the whole thing
    # match?
    print("\nfull payload comparison at each hit:")
    for a in hits[:10]:
        segment = mem[a:a + len(payload)]
        if segment == payload:
            print(f"  flat {a:#08x}: FULL MATCH ({len(payload)} bytes)")
        else:
            diffs = sum(1 for x, y in zip(segment, payload) if x != y)
            print(f"  flat {a:#08x}: {diffs}/{len(payload)} bytes differ")

    return 0


if __name__ == "__main__":
    sys.exit(main())
