"""Recursive-descent disassembler for TAPPER.COM (16-bit real mode, ORG 100h).

Linear sweep is unreliable here because the data area starts around 0x3BFA and
would decode as garbage. We start at the entry point and follow control flow,
so only bytes actually reached as code get disassembled.

Plain recursive descent stalls at ~67% because the game dispatches indirectly:

    1FC7  mov bx, 0x8fd        <- handler address as a literal
    1FD2  mov bx, 0x913
    1FE4  jmp bx               <- state-machine dispatch
    0CD3  call word ptr cs:[0x4499]   <- function pointer in a variable

So a second pass harvests 16-bit immediates that look like code addresses,
validates each by test-disassembling it, seeds the survivors as new entry
points, and repeats to a fixpoint.

Usage:
    python disasm.py                 # full trace, writes out/tapper.asm
    python disasm.py 0x1234 0x40     # raw dump of 0x40 bytes at CS:1234
"""
import os
import re
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_16

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Tapper", "TAPPER.COM")
OUT = os.path.join(ROOT, "out")
ORG = 0x100

# Interrupt handlers the crack installs; unreachable from the entry point
# because they are only ever entered via INT, so seed them explicitly.
EXTRA_ENTRIES = [0x135, 0x4680]

STOP = {"ret", "retf", "iret", "hlt"}
COND = {
    "je", "jne", "jz", "jnz", "jb", "jnb", "jc", "jnc", "ja", "jna", "jae",
    "jbe", "jl", "jle", "jg", "jge", "js", "jns", "jo", "jno", "jp", "jnp",
    "jcxz", "loop", "loope", "loopne",
}
IMM = re.compile(r"0x[0-9a-f]+")


def md():
    m = Cs(CS_ARCH_X86, CS_MODE_16)
    m.detail = False
    return m


def trace(image, entries):
    """Walk reachable code. Returns (instructions by address, call targets)."""
    m = md()
    seen, calls = {}, {}
    pending = list(entries)
    while pending:
        addr = pending.pop()
        while True:
            if addr in seen or not (ORG <= addr < ORG + len(image)):
                break
            insns = list(m.disasm(image[addr - ORG:addr - ORG + 16], addr))
            if not insns:
                break
            ins = insns[0]
            seen[addr] = ins
            mn, ops = ins.mnemonic, ins.op_str
            target = None
            if ops.startswith("0x"):
                try:
                    target = int(ops.split(",")[0], 16)
                except ValueError:
                    target = None
            if mn == "call" and target is not None:
                calls.setdefault(target, set()).add(addr)
                pending.append(target)
            elif mn in COND and target is not None:
                pending.append(target)
            elif mn == "jmp":
                if target is not None:
                    pending.append(target)
                break
            if mn in STOP:
                break
            addr += ins.size
    return seen, calls


def plausible_code(image, addr, min_insns=8):
    """Test-disassemble at addr; accept only a clean run of instructions.

    Rejects addresses that decode to junk, which is what happens when a
    harvested immediate was really a data pointer rather than a code label.
    """
    if not (ORG <= addr < ORG + len(image)):
        return False
    m = md()
    count = 0
    for ins in m.disasm(image[addr - ORG:addr - ORG + 64], addr):
        mn = ins.mnemonic
        if mn in ("(bad)", "hlt", "into", "salc", "lock"):
            return False
        count += 1
        if mn in STOP or mn == "jmp":
            return True
        if count >= min_insns:
            return True
    return False


JMP_TABLE = re.compile(r"^(?:jmp|call)\s+word ptr \[\w+ \+ (0x[0-9a-f]+)\]$")
JMP_MEM = re.compile(r"^(?:jmp|call)\s+word ptr (?:cs:)?\[(0x[0-9a-f]+)\]$")
JMP_REG = re.compile(r"^(?:jmp|call)\s+([abcd]x|[sd]i|bp)$")


def read_table(image, base, limit=256):
    """Read a jump table as consecutive words, stopping at the first bad entry.

    Tables here are not length-tagged, so the terminator is structural: we stop
    on a word that is outside the image or does not decode as code. That is what
    separates the real 6-entry table at 0x3990 from the code that follows it.
    """
    out = []
    for i in range(limit):
        o = base - ORG + 2 * i
        if o + 2 > len(image):
            break
        w = int.from_bytes(image[o:o + 2], "little")
        if not (ORG <= w < ORG + len(image)) or not plausible_code(image, w):
            break
        out.append(w)
    return out


def harvest(image, seen):
    """Seed new entry points, but only from genuine indirect dispatch sites.

    Harvesting every 16-bit immediate in range over-collects badly: data
    pointers such as `mov dx,0x102` (the "Tapper.Dat" string) decode as
    plausible code often enough to push coverage past 100% with overlapping
    instruction streams. So first find how the program actually dispatches,
    then seed only what feeds those sites.
    """
    tables, mem_slots, regs = set(), set(), set()
    for ins in seen.values():
        text = f"{ins.mnemonic} {ins.op_str}"
        m = JMP_TABLE.match(text)
        if m:
            tables.add(int(m.group(1), 16))
            continue
        m = JMP_MEM.match(text)
        if m:
            mem_slots.add(int(m.group(1), 16))
            continue
        m = JMP_REG.match(text)
        if m:
            regs.add(m.group(1))

    out = set()
    for base in tables:
        out.update(read_table(image, base))

    # `mov bx,0x8fd` ... `jmp bx`, and `mov word ptr [0x4499],imm` ... `call [0x4499]`
    for ins in seen.values():
        if ins.mnemonic != "mov":
            continue
        dst, _, src = ins.op_str.partition(", ")
        if not src.startswith("0x"):
            continue
        v = int(src, 16)
        if not (ORG < v < ORG + len(image)) or not plausible_code(image, v):
            continue
        if dst in regs:
            out.add(v)
        else:
            m = JMP_MEM.match(f"jmp {dst}")
            if m and int(m.group(1), 16) in mem_slots:
                out.add(v)
    return out


def main():
    image = open(SRC, "rb").read()

    if len(sys.argv) >= 3:
        start, length = int(sys.argv[1], 0), int(sys.argv[2], 0)
        for ins in md().disasm(image[start - ORG:start - ORG + length], start):
            print(f"{ins.address:04X}  {ins.bytes.hex().upper():<14} "
                  f"{ins.mnemonic} {ins.op_str}")
        return

    def measure(seen):
        """Byte coverage and overlap. Summing instruction sizes double-counts
        when two decodings disagree, which silently hides bad seed points."""
        hits = bytearray(len(image))
        for a, ins in seen.items():
            for k in range(ins.size):
                if hits[a - ORG + k] < 255:
                    hits[a - ORG + k] += 1
        covered = sum(1 for h in hits if h)
        overlap = sum(1 for h in hits if h > 1)
        return hits, covered, overlap

    entries = set([ORG] + EXTRA_ENTRIES)
    seen, calls = trace(image, entries)
    _, cov, ov = measure(seen)
    print(f"pass 1 (entry points only): {len(seen)} instructions, "
          f"{cov*100/len(image):.1f}% covered, {ov} overlapping bytes")

    for n in range(2, 12):
        new = harvest(image, seen) - entries
        if not new:
            break
        entries |= new
        seen, calls = trace(image, entries)
        _, cov, ov = measure(seen)
        print(f"pass {n}: +{len(new)} seeded entries -> {len(seen)} instructions, "
              f"{cov*100/len(image):.1f}% covered, {ov} overlapping bytes")

    hits, covered, overlap = measure(seen)
    print(f"\nfinal: {len(seen)} instructions, {len(calls)} call targets")
    print(f"  byte coverage : {covered}/{len(image)} ({covered*100/len(image):.1f}%)")
    print(f"  overlapping   : {overlap} bytes "
          f"({'clean' if overlap == 0 else 'BAD - some seed points are wrong'})")

    # Report contiguous gaps so we can tell leftover code from the data area.
    code = bytearray(1 if h else 0 for h in hits)
    gaps, run = [], None
    for i in range(len(image)):
        if not code[i]:
            run = i if run is None else run
        elif run is not None:
            gaps.append((run, i - run))
            run = None
    if run is not None:
        gaps.append((run, len(image) - run))
    print("\nlargest unreached regions (file offset -> CS addr, size):")
    for off, size in sorted(gaps, key=lambda g: -g[1])[:12]:
        print(f"  {off:05X} -> CS:{off+ORG:04X}  {size:5d} bytes")

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "tapper.asm")
    with open(path, "w") as f:
        for addr in sorted(seen):
            ins = seen[addr]
            if addr in calls:
                f.write(f"\n; ---- sub_{addr:04X}  "
                        f"(called from {len(calls[addr])} site(s)) ----\n")
            elif addr in entries and addr != ORG:
                f.write(f"\n; ---- loc_{addr:04X}  (indirect target) ----\n")
            f.write(f"{addr:04X}  {ins.bytes.hex().upper():<14} "
                    f"{ins.mnemonic} {ins.op_str}\n")
    print(f"\nwrote {path}")


if __name__ == "__main__":
    main()
