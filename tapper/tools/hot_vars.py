"""Rank the data addresses that are still raw hex by how often code touches them.

The symbol audit checks variables that already have names. This is the inverse:
scan every memory operand left as raw hex and count references, so the most
heavily used unnamed variables surface first. Naming those buys the most
readability per routine read, instead of picking addresses at random.

Writers are counted separately from readers -- a location written from one place
and read from many is usually a mode or configuration flag, while one written
from many places is usually accumulating state.
"""
import os
import re
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASM = os.path.join(ROOT, "src", "tapper.asm")

CODE = re.compile(r"^\s+(\S.*?)\s+;\s*([0-9A-F]{4})\s")
LABEL = re.compile(r"^(\w+):$")
# Raw hex inside brackets, optionally with a segment override or index register.
# BP-relative operands are excluded on purpose: `[bp + 0x0b]` is a field inside
# an entity struct, not an absolute address, and counting those produced a
# ranking topped by struct offsets and the CGA bank constant 0x2000.
MEMREF = re.compile(r"\[(?:(?:cs|ds|es|ss):)?(?:[a-z]{2} \+ )*(0x[0-9a-f]+)\]")
BP_REL = re.compile(r"\[(?:(?:cs|ds|es|ss):)?bp\b")
MIN_ADDR = 0x100

WRITERS = {"mov", "add", "sub", "and", "or", "xor", "inc", "dec", "adc",
           "sbb", "shl", "shr", "sar", "rol", "ror", "rcl", "rcr", "neg", "not"}

# The reconstruction marks the data region; code below this is instructions.
DATA_START = 0x3BF0


def main():
    reads = defaultdict(list)
    writes = defaultdict(list)
    owner = None
    for line in open(ASM):
        line = line.rstrip()
        m = LABEL.match(line)
        if m:
            owner = m.group(1)
            continue
        m = CODE.match(line)
        if not m:
            continue
        text, at = m.group(1), m.group(2)
        mn = text.split()[0]
        dst = text.split(",")[0]
        if BP_REL.search(text):
            continue
        for hexs in MEMREF.findall(text):
            addr = int(hexs, 16)
            if addr < MIN_ADDR:
                continue
            is_write = mn in WRITERS and re.search(
                re.escape(hexs) + r"\]", dst) is not None
            (writes if is_write else reads)[addr].append((at, owner))

    allrefs = set(reads) | set(writes)
    rows = [(len(reads[a]) + len(writes[a]), len(writes[a]), len(reads[a]), a)
            for a in allrefs]
    rows.sort(reverse=True)

    print(f"{len(allrefs)} distinct unnamed data addresses referenced\n")
    print(f"{'address':>8} {'refs':>5} {'W':>3} {'R':>3}  region      "
          f"routines touching it")
    print("-" * 78)
    for total, w, r, a in rows[:25]:
        region = "data" if a >= DATA_START else "vars"
        who = {o for _, o in reads[a] + writes[a] if o}
        names = sorted(n for n in who
                       if not re.match(r"^(sub|loc)_[0-9A-F]{4}$", n))
        shown = ", ".join(names[:2]) if names else f"{len(who)} routines"
        print(f"{a:>8X} {total:>5} {w:>3} {r:>3}  {region:<11} {shown}")


if __name__ == "__main__":
    main()
