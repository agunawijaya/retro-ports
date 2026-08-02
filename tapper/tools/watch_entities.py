"""Find the code that manipulates entities by watching writes, not by reading.

What is left unnamed is flow code with no structural giveaway -- no `daa`, no
scancode table, no RNG call. But it must touch entity memory to do anything, so
running the game and recording which instruction writes into the entity table
identifies it directly.

Reports each writing instruction, the entity field offset it targets, and the
routine it sits in, so unnamed routines can be ranked by how much entity work
they actually do.
"""
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trace import Machine, LOAD_SEG

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASM = os.path.join(ROOT, "src", "tapper.asm")

ENTITY_TABLE = 0x4583
ENTITY_SIZE = 0x10
# Two banks of 16 entities each were identified: 0x4583 and 0x4683.
WATCH_LO, WATCH_HI = 0x4583, 0x4783

LABEL = re.compile(r"^(\w+):$")
ADDR = re.compile(r";\s*([0-9A-F]{4})\s")
GENERIC = re.compile(r"^(sub|loc)_[0-9A-F]{4}$")

FIELD = {
    0x00: "sprite ptr", 0x04: "position", 0x06: "state bits",
    0x07: "?", 0x08: "pos lo", 0x0A: "frame", 0x0B: "sprite idx",
    0x0E: "velocity",
}


def load_labels():
    labels, pending = {}, None
    for line in open(ASM):
        line = line.rstrip()
        m = LABEL.match(line)
        if m:
            pending = m.group(1)
            continue
        if pending:
            a = ADDR.search(line)
            if a:
                labels[int(a.group(1), 16)] = pending
                pending = None
    return labels


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 12_000_000
    lo = int(sys.argv[2], 0) if len(sys.argv) > 2 else WATCH_LO
    hi = int(sys.argv[3], 0) if len(sys.argv) > 3 else WATCH_HI
    globals()["WATCH_LO"], globals()["WATCH_HI"] = lo, hi
    labels = load_labels()
    starts = sorted(labels)

    def owner(addr):
        lo, hi, best = 0, len(starts) - 1, None
        while lo <= hi:
            mid = (lo + hi) // 2
            if starts[mid] <= addr:
                best, lo = starts[mid], mid + 1
            else:
                hi = mid - 1
        return labels[best] if best is not None else "?"

    m = Machine()
    m.load("TAPPER.COM")
    writes = Counter()
    fields = defaultdict(Counter)
    orig = m._on_write

    def hook(cpu, seg, off, val, size):
        orig(cpu, seg, off, val, size)
        if seg == LOAD_SEG and WATCH_LO <= off < WATCH_HI:
            writes[cpu.cur_ip] += 1
            fields[cpu.cur_ip][(off - ENTITY_TABLE) % ENTITY_SIZE] += 1

    m.cpu.on_write = hook
    reason = m.run(limit)
    print(f"ran {m.cpu.icount:,} instructions ({reason})")
    print(f"{sum(writes.values()):,} writes into the entity table "
          f"from {len(writes)} instructions\n")

    by_routine = Counter()
    for ip, n in writes.items():
        by_routine[owner(ip)] += n

    print(f"{'routine':<26} {'writes':>9} {'sites':>6}  fields touched")
    print("-" * 76)
    sites = Counter()
    rfields = defaultdict(Counter)
    for ip, n in writes.items():
        r = owner(ip)
        sites[r] += 1
        for f, c in fields[ip].items():
            rfields[r][f] += c
    for r, n in by_routine.most_common(20):
        fl = ", ".join(f"+{f:02X} {FIELD.get(f, '?')}"
                       for f, _ in rfields[r].most_common(3))
        mark = " *" if GENERIC.match(r) else "  "
        print(f"{r:<26} {n:>9,} {sites[r]:>6}  {fl}{mark}")
    print("\n* = still unnamed")


if __name__ == "__main__":
    main()
