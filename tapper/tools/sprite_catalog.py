"""Build a sprite catalogue by observation rather than inference.

Static analysis of the asset headers left the geometry ambiguous: entry spacing
of 128 fits a 16x16 sprite (64 data + 64 mask), but asset06's spacing of 132
fits nothing cleanly. So instead of guessing, we watch the running game.

Two probes are enough to tie everything together:

  * the INT 80h handler (CS:0135) receives track/sector, which maps back to a
    TAPPER.DAT offset and therefore to an asset, plus the ES:BX load address
  * each blitter entry receives BP, the sprite's address, and *which* blitter
    ran tells us the geometry exactly -- no inference needed

Combining them turns a raw address into "asset N, offset M, 32x16".
"""
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trace import Machine, LOAD_SEG, OUT
from emu8086 import BP, BX, CX, AX, ES, CS
import asset_table

# Blitter entry -> (geometry, data size). Mask displacement equals data size,
# so a sprite occupies twice that.
BLITTERS = {
    0x23C8: ("8x8", 0x10),
    0x2AB0: ("12x16", 0x30),
    0x2BE8: ("32x22", 0xB0),
    0x2CFF: ("32x16", 0x80),
    0x2D1A: ("16x16", 0x40),
    0x2D39: ("24x22", 0x84),
}
SHIM = 0x0135
SECTOR = 512
LSN_BASE = 27


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 12_000_000
    entries = asset_table.load_table()

    def asset_of(offset):
        for i, (lsn, nbytes) in enumerate(entries):
            if lsn < LSN_BASE:
                continue
            base = (lsn - LSN_BASE) * SECTOR
            if base <= offset < base + nbytes:
                return i, offset - base
        return None, None

    m = Machine()
    m.load("TAPPER.COM")

    loads = []                      # (dat_offset, load_addr, nbytes)
    sprites = defaultdict(Counter)  # geometry -> Counter(address)
    orig = m._on_exec

    def hook(cpu, seg, off):
        orig(cpu, seg, off)
        if seg != LOAD_SEG:
            return
        if off == SHIM:
            track, sector = cpu.r8(5), cpu.r8(1)      # CH, CL
            count = cpu.r8(0)                          # AL
            if track >= 5 and 1 <= sector <= 9:
                dat_off = ((track - 5) * 9 + sector - 1) * SECTOR
                loads.append((dat_off, cpu.regs[BX], count * SECTOR))
        elif off in BLITTERS:
            sprites[BLITTERS[off][0]][cpu.regs[BP]] += 1

    m.cpu.on_exec = hook
    reason = m.run(limit)
    print(f"ran {m.cpu.icount:,} instructions ({reason})\n")

    # ---- what got loaded where -------------------------------------------
    seen = {}
    for dat_off, addr, nbytes in loads:
        idx, rel = asset_of(dat_off)
        key = (idx, addr - rel if rel is not None else addr)
        seen.setdefault(key, [0, 0])
        seen[key][0] += 1
        seen[key][1] = max(seen[key][1], nbytes)

    print(f"{'asset':>6} {'load addr':>10} {'reads':>6}  DAT offset -> memory")
    print("-" * 62)
    asset_base = {}
    for (idx, base), (n, _) in sorted(seen.items(), key=lambda k: (k[0][0] or -1)):
        if idx is None:
            print(f"{'?':>6} {base:>10X} {n:>6}  (outside any asset)")
            continue
        asset_base[idx] = base
        lsn, nbytes = entries[idx]
        print(f"{idx:>6} {base:>10X} {n:>6}  "
              f"offset {(lsn-LSN_BASE)*SECTOR}..+{nbytes}")

    # Callers invoke each blitter twice, once per CGA bank, and BP is not reset
    # between the calls -- so the second call is seen at base + datasize/2.
    # Without folding those back, every sprite is counted twice.
    for geo, size in ((g, s) for g, s in BLITTERS.values()):
        c = sprites.get(geo)
        if not c:
            continue
        half = size // 2
        for addr in sorted(c):
            if addr - half in c:
                c[addr - half] += c.pop(addr)

    # ---- which sprites were drawn ----------------------------------------
    total = sum(sum(c.values()) for c in sprites.values())
    print(f"\n{total:,} sprite draws, {sum(len(c) for c in sprites.values())} "
          f"distinct addresses\n")
    print(f"{'geometry':>10} {'distinct':>9} {'draws':>9}  address range")
    print("-" * 62)
    for geo in sorted(sprites, key=lambda g: -sum(sprites[g].values())):
        c = sprites[geo]
        print(f"{geo:>10} {len(c):>9} {sum(c.values()):>9}  "
              f"{min(c):04X}..{max(c):04X}")

    # ---- attribute each sprite to an asset --------------------------------
    if not asset_base:
        print("\nNo asset load addresses captured; cannot attribute sprites.")
        return
    print("\nsprite -> asset attribution:")
    print(f"{'geometry':>10} {'address':>8} {'asset':>6} {'offset':>8} {'draws':>7}")
    print("-" * 62)
    rows = []
    for geo, c in sprites.items():
        for addr, n in c.items():
            best = None
            for idx, base in asset_base.items():
                if base <= addr:
                    nbytes = entries[idx][1]
                    if addr < base + nbytes and (best is None or base > best[1]):
                        best = (idx, base)
            if best:
                rows.append((geo, addr, best[0], addr - best[1], n))
    for r in sorted(rows, key=lambda r: -r[4])[:25]:
        print(f"{r[0]:>10} {r[1]:>8X} {r[2]:>6} {r[3]:>8} {r[4]:>7,}")
    print(f"\n{len(rows)}/{sum(len(c) for c in sprites.values())} sprite "
          f"addresses fall inside a captured asset")


if __name__ == "__main__":
    main()
