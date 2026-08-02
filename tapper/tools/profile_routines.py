"""Rank routines by how much they actually execute during gameplay.

Chasing new game states to reach unexplored code is expensive. But the customer
sprites are already on screen in the Saloon level the emulator reaches, so the
entity update code is already running -- it just has not been identified. This
attributes every executed address to its enclosing label and ranks the result,
which surfaces the busiest unnamed routines: the game loop and the per-entity
update are necessarily near the top.

Reads out/executed.txt (written by trace.py) and the label list from the
reconstructed source.
"""
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASM = os.path.join(ROOT, "src", "tapper.asm")
EXEC = os.path.join(ROOT, "out", "executed.txt")

LABEL = re.compile(r"^(\w+):$")
ADDR_COMMENT = re.compile(r";\s*([0-9A-F]{4})\s")


def load_labels():
    """Map label address -> name, taken from the generated source."""
    labels = {}
    pending = None
    for line in open(ASM):
        m = LABEL.match(line.rstrip())
        if m:
            pending = m.group(1)
            continue
        if pending:
            a = ADDR_COMMENT.search(line)
            if a:
                labels[int(a.group(1), 16)] = pending
                pending = None
    return labels


def main():
    if not os.path.exists(EXEC):
        print("out/executed.txt missing -- run tools/trace.py first")
        return
    labels = load_labels()
    if not labels:
        print("no labels parsed from the source")
        return
    starts = sorted(labels)

    counts = Counter()
    addrs = Counter()
    total = 0
    for line in open(EXEC):
        parts = line.split()
        if len(parts) != 2:
            continue
        addr, n = int(parts[0], 16), int(parts[1])
        total += n
        # Attribute to the nearest preceding label.
        lo, hi = 0, len(starts) - 1
        best = None
        while lo <= hi:
            mid = (lo + hi) // 2
            if starts[mid] <= addr:
                best = starts[mid]
                lo = mid + 1
            else:
                hi = mid - 1
        if best is not None:
            counts[labels[best]] += n
            addrs[labels[best]] += 1

    print(f"{total:,} instruction executions across {len(counts)} routines\n")
    print(f"{'routine':<26} {'executions':>12} {'share':>7} {'addrs':>6}")
    print("-" * 56)
    for name, n in counts.most_common(30):
        named = not re.match(r"^(sub|loc)_[0-9A-F]{4}$", name)
        mark = "  " if named else " *"
        print(f"{name:<26} {n:>12,} {n*100/total:>6.1f}% {addrs[name]:>6}{mark}")
    print("\n* = still unnamed")


if __name__ == "__main__":
    main()
