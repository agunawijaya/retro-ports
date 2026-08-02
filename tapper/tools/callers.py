"""Give unnamed routines context by looking at who calls them.

The easy structural giveaways -- `daa` for BCD scoring, a scancode table, RNG
consumers -- are used up. What is left is flow-reading with no shortcut, unless
the call graph supplies one: a routine reached only from apply_knockback and
move_entity_along_bar is entity code, whatever it turns out to do in detail.

Reads the generated source, which already carries `; xref:` comments, maps each
xref site to its enclosing routine, and reports unnamed routines whose callers
are all named. Those inherit the most context per unit of reading.
"""
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASM = os.path.join(ROOT, "src", "tapper.asm")

LABEL = re.compile(r"^(\w+):$")
XREF = re.compile(r"^; xref: (.+?)\s+\((\d+) sites?\)")
ADDR = re.compile(r";\s*([0-9A-F]{4})\s")
GENERIC = re.compile(r"^(sub|loc)_[0-9A-F]{4}$")


def parse():
    """Return (label address -> name, label name -> caller addresses)."""
    labels, xrefs = {}, {}
    pending_name = None
    pending_refs = None
    for line in open(ASM):
        line = line.rstrip()
        m = XREF.match(line)
        if m:
            refs = [int(t, 16) for t in re.findall(r"[0-9A-F]{4}", m.group(1))]
            pending_refs = refs
            continue
        m = LABEL.match(line)
        if m:
            pending_name = m.group(1)
            xrefs[pending_name] = pending_refs or []
            pending_refs = None
            continue
        if pending_name:
            a = ADDR.search(line)
            if a:
                labels[int(a.group(1), 16)] = pending_name
                pending_name = None
    return labels, xrefs


def main():
    labels, xrefs = parse()
    starts = sorted(labels)

    def owner(addr):
        lo, hi, best = 0, len(starts) - 1, None
        while lo <= hi:
            mid = (lo + hi) // 2
            if starts[mid] <= addr:
                best = starts[mid]
                lo = mid + 1
            else:
                hi = mid - 1
        return labels[best] if best is not None else None

    named_callers = defaultdict(set)
    for name, refs in xrefs.items():
        for r in refs:
            o = owner(r)
            if o and not GENERIC.match(o):
                named_callers[name].add(o)

    rows = []
    for name, refs in xrefs.items():
        if not GENERIC.match(name) or not refs:
            continue
        callers = {owner(r) for r in refs}
        callers.discard(None)
        known = {c for c in callers if not GENERIC.match(c)}
        if known:
            rows.append((len(known) / max(len(callers), 1), len(refs),
                         name, sorted(known), len(callers)))

    rows.sort(key=lambda r: (-r[0], -r[1]))
    print(f"{len(rows)} unnamed routines have at least one identified caller\n")
    print(f"{'routine':<12} {'sites':>6} {'ctx':>5}  called from")
    print("-" * 76)
    for frac, sites, name, known, total in rows[:28]:
        ctx = f"{len(known)}/{total}"
        print(f"{name:<12} {sites:>6} {ctx:>5}  {', '.join(known[:3])}"
              + (f", +{len(known)-3}" if len(known) > 3 else ""))


if __name__ == "__main__":
    main()
