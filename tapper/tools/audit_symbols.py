"""Audit every named variable for readers and writers, by symbol not by address.

This exists because of a real mistake. entity_tick_reload was declared "not a
difficulty control" after a grep for `[cs:0x4520]` found only two writers, both
in init. The third writer was there all along, but the line already read
`mov byte [cs:entity_tick_reload], al` -- once a variable is named, searching
for its numeric address silently misses every site that got symbolised.

So the audit has to run over the generated source, matching symbol names, and
list writers for each. Any variable whose write sites do not match what the
documentation claims is a conclusion that needs revisiting.
"""
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASM = os.path.join(ROOT, "src", "tapper.asm")

EQU = re.compile(r"^(\w+)\s+equ\s+(0x[0-9A-F]+)$")
CODE = re.compile(r"^\s+(\S.*?)\s+;\s*([0-9A-F]{4})\s")
LABEL = re.compile(r"^(\w+):$")

# Mnemonics whose first operand is written.
WRITERS = {"mov", "add", "sub", "and", "or", "xor", "inc", "dec", "adc",
           "sbb", "shl", "shr", "sar", "rol", "ror", "rcl", "rcr", "neg",
           "not", "stosb", "stosw", "xchg"}


def main():
    symbols, lines = {}, []
    for line in open(ASM):
        line = line.rstrip()
        m = EQU.match(line)
        if m:
            symbols[m.group(1)] = int(m.group(2), 16)
            continue
        lines.append(line)

    reads = defaultdict(list)
    writes = defaultdict(list)
    owner = None
    for line in lines:
        m = LABEL.match(line)
        if m:
            owner = m.group(1)
            continue
        m = CODE.match(line)
        if not m:
            continue
        text, addr = m.group(1), m.group(2)
        mn = text.split()[0]
        for name in symbols:
            if not re.search(rf"\b{name}\b", text):
                continue
            # A symbol appearing in brackets inside the first operand of a
            # writing mnemonic is a store. Testing that the bracket *starts*
            # with the name would miss indexed forms like
            # `mov [di + bar_limit_table], ax` -- the exact blind spot this
            # audit exists to catch, so it must not have its own version of it.
            dst = text.split(",")[0]
            is_write = bool(mn in WRITERS
                            and re.search(rf"\[[^\]]*\b{name}\b", dst))
            (writes if is_write else reads)[name].append((addr, owner, text))

    print(f"{len(symbols)} named variables\n")
    print(f"{'variable':<24} {'W':>3} {'R':>3}  write sites")
    print("-" * 78)
    for name in sorted(symbols, key=lambda n: -len(writes[n])):
        w, r = writes[name], reads[name]
        if not w and not r:
            continue
        sites = ", ".join(a for a, _, _ in w[:6])
        more = f" +{len(w)-6}" if len(w) > 6 else ""
        print(f"{name:<24} {len(w):>3} {len(r):>3}  {sites}{more}")

    orphans = [n for n in symbols if not writes[n] and not reads[n]]
    if orphans:
        print(f"\nnamed but never referenced symbolically ({len(orphans)}): "
              + ", ".join(sorted(orphans)))


if __name__ == "__main__":
    main()
