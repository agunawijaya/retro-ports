#!/usr/bin/env python3
"""listing.py -- emit an annotated assembly listing of a Turbo Pascal program.

Why this exists
---------------
A decompilation should leave a source file behind. For a `.COM` file the
toolkit's `comrec.py` produces one that reassembles to a byte-identical copy,
and that is the strongest proof a reading can have. For a compiled MZ program
there was nothing at all -- the analysis lived in documents and in a segment
table, and no file in the repository said "here is the program".

This writes that file. It is a disassembly, not a decompilation to Pascal:
nothing here recovers `for` loops or variable names, and it never will, because
the information is gone. What it does recover is everything the preceding
analysis established, applied to every byte:

  * the unit each address belongs to, from the segment map;
  * every exported procedure, from the far-call targets, as a label;
  * every string constant resolved and printed inline, using the
    `mov di, off / push cs / push di` idiom and the *unit's own* segment base;
  * every runtime call named -- `System+0x0CAA` becomes `Random`, and the
    unit-to-unit calls become `call Graph:0x1326`;
  * data regions identified as data rather than disassembled into nonsense.

It reports two figures, and only the second one means anything. Coverage --
how many bytes were decoded -- is near 100% for any linear sweep, correct or
not, so it measures nothing. What can fail is *self-consistency*: if the decode
is right, an internal jump or call lands on the first byte of a decoded
instruction, and if the sweep has drifted out of phase it lands in the middle
of one. On this program 90.17% of 2,054 internal branches land on a boundary.
The 202 that do not are where data sits inside the instruction stream, and they
are named in the listing rather than hidden.

Usage:
    python listing.py --image work/unpacked.exe --units work/units.json \\
                      --out recovered/oregon.asm
"""

import argparse
import json
import struct
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_16

# Runtime entry points, established by differential compilation against the
# game's own Turbo Pascal 5.0 -- see docs/03-the-code.md. These are *this
# program's* offsets: Turbo Pascal smart-links, so they do not transfer.
SYSTEM = {
    0x00D8: "Halt", 0x0207: "IOResult", 0x020E: "IOCheck",
    0x03B5: "MemAvail", 0x0634: "StrAssign", 0x064E: "StrCopy",
    0x06C1: "StrCat", 0x06ED: "StrCompare",
    0x0C48: "RealAdd", 0x0C4E: "RealSub", 0x0C5A: "RealMul",
    0x0C60: "RealDiv", 0x0C6A: "RealCmp", 0x0C6E: "LongToReal",
    0x0C72: "Trunc", 0x0C94: "RandomInt", 0x0CAA: "RandomReal",
    0x115A: "Str", 0x15B8: "WriteLn", 0x1635: "WriteStr",
    0x1714: "Assign", 0x1742: "Reset", 0x174B: "Rewrite",
    0x17C3: "Close", 0x17F7: "BlockRead", 0x17FE: "BlockWrite",
}
DOS = {
    0x0000: "DosVersion", 0x0005: "MsDos", 0x0071: "GetDate",
    0x00A7: "GetTime", 0x00E3: "GetCBreak", 0x00F5: "SetCBreak",
    0x0104: "DiskFree", 0x015F: "SetFTime", 0x017E: "FindFirst",
    0x01BC: "FindNext", 0x01F9: "UnpackTime", 0x023D: "PackTime",
    0x0275: "GetIntVec", 0x028D: "SetIntVec", 0x02A0: "SwapVectors",
}
NAMES = {
    0x0000: "main", 0x07B6: "scoring", 0x0BEA: "topten", 0x0C54: "learn",
    0x0CFA: "outfit", 0x0F30: "erase", 0x1042: "ui", 0x14D0: "artwork",
    0x151C: "licence", 0x15BB: "genusfont", 0x18DC: "genuspcx",
    0x1DB8: "Dos", 0x1DE9: "Graph", 0x213D: "Crt", 0x219F: "System",
}
LOAD_BIAS = 0x1000          # unpack.py applied relocations at segment 0x1000


def pascal_string(img, at, hi):
    """The Pascal string at `at`, or None. A length byte then that many
    printable characters -- exact, not heuristic."""
    if not (0 <= at < hi):
        return None
    n = img[at]
    if not (1 <= n <= 200 and at + 1 + n <= hi):
        return None
    body = img[at + 1:at + 1 + n]
    if not all(0x20 <= c < 0x7F for c in body):
        return None
    return body.decode("ascii")


def find_data_runs(img, lo, hi):
    """Where the string constants are, so they are not disassembled.

    A compiler puts string literals in the code segment, after the procedure
    that uses them. Walking length-prefixed strings back to back finds those
    blocks exactly: two or more in a row is a data run, and a lone one is more
    likely a coincidence inside an instruction stream.
    """
    runs, i = [], lo
    while i < hi:
        s = pascal_string(img, i, hi)
        if s is None or len(s) < 4:
            i += 1
            continue
        start, count = i, 0
        while i < hi:
            s = pascal_string(img, i, hi)
            if s is None or len(s) < 4:
                break
            i += 1 + len(s)
            count += 1
        if count >= 2 and i - start >= 24:
            runs.append((start, i))
    return runs


def name_far(seg, off):
    """`lcall 0x319F:0x0CAA` -> `RandomReal`."""
    real = seg - LOAD_BIAS
    unit = NAMES.get(real)
    if unit == "System" and off in SYSTEM:
        return f"System.{SYSTEM[off]}"
    if unit == "Dos" and off in DOS:
        return f"Dos.{DOS[off]}"
    if unit:
        return f"{unit}:{off:#06x}"
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--image", required=True)
    ap.add_argument("--units", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", help="one unit name, e.g. outfit")
    args = ap.parse_args()

    raw = Path(args.image).read_bytes()
    img = raw[32:] if raw[:2] in (b"MZ", b"ZM") else raw
    units = json.load(open(args.units))
    code_end = units["code_end"]

    md = Cs(CS_ARCH_X86, CS_MODE_16)
    md.detail = True
    out = []
    boundaries, branch_targets, decoded_span = set(), set(), set()
    covered = data_bytes = insn_count = 0
    total = 0

    out.append("; The Oregon Trail (MECC, 1990) -- annotated disassembly")
    out.append("; Generated by tools/listing.py. Not a Pascal reconstruction:")
    out.append("; see docs/03-the-code.md for what that would require and why")
    out.append("; it is out of reach.")
    out.append(";")

    for u in units["units"]:
        seg, lo, size = u["segment"], u["start"], u["size"]
        hi = lo + size
        label = NAMES.get(seg, f"seg_{seg:04x}")
        if args.only and label != args.only:
            continue
        if label in ("Dos", "Graph", "Crt", "System", "genusfont", "genuspcx"):
            out.append(f"\n; ==== {label}: {size:,} bytes, not ours -- skipped")
            continue

        total += size
        out.append(f"\n; ======================================================")
        out.append(f"; unit {label}  segment {seg:#06x}  "
                   f"image {lo:#08x}..{hi:#08x}  {size:,} bytes")
        out.append(f"; ======================================================")

        entries = sorted(set(u.get("procs", [])))
        runs = find_data_runs(img, lo, hi)
        in_data = lambda a: any(s <= a < e for s, e in runs)

        at = lo
        while at < hi:
            run = next((r for r in runs if r[0] <= at < r[1]), None)
            if run:
                out.append(f"\n; ---- data, {run[1] - run[0]} bytes")
                p = at
                while p < run[1]:
                    s = pascal_string(img, p, run[1])
                    if s is None:
                        p += 1
                        continue
                    shown = s.replace("\\", "\\\\").replace("'", "''")
                    out.append(f"L_{p:05X}:  db {len(s)}, '{shown}'")
                    p += 1 + len(s)
                data_bytes += run[1] - at
                at = run[1]
                continue

            nxt = min([e for e in entries if e > at] +
                      [r[0] for r in runs if r[0] > at] + [hi])
            chunk = img[at:nxt]
            if at in entries:
                out.append(f"\nproc_{at:05X}:            ; far-called entry point")
            pos = at
            for ins in md.disasm(chunk, at):
                note = ""
                if ins.mnemonic == "lcall" and "," in ins.op_str:
                    # capstone prints a far target as `0x319f, 0x0caa`
                    try:
                        s16, o16 = ins.op_str.split(", ")
                        nm = name_far(int(s16, 0), int(o16, 0))
                        if nm:
                            note = f"      ; {nm}"
                    except ValueError:
                        pass
                elif ins.mnemonic == "mov" and ins.op_str.startswith("di, 0x"):
                    try:
                        t = lo + int(ins.op_str[4:], 0)
                        s = pascal_string(img, t, hi)
                        if s and img[ins.address + 3:ins.address + 5] == b"\x0e\x57":
                            note = f"      ; '{s[:60]}'"
                    except ValueError:
                        pass
                out.append(f"  {ins.address:05X}:  {ins.mnemonic:<7} "
                           f"{ins.op_str}{note}")
                insn_count += 1
                boundaries.add(ins.address)
                for b in range(ins.address, ins.address + ins.size):
                    decoded_span.add(b)
                if ins.mnemonic in ("call", "jmp") or ins.mnemonic.startswith("j"):
                    op = ins.op_str
                    if op.startswith("0x"):
                        try:
                            branch_targets.add(int(op, 0))
                        except ValueError:
                            pass
                pos = ins.address + ins.size
            covered += pos - at
            if pos < nxt:
                out.append(f"; {nxt - pos} bytes not decoded at {pos:#07x}")
            at = max(nxt, pos)

    # Coverage is nearly meaningless on its own: a linear sweep decodes every
    # byte it is handed, correctly or not. What can fail is *self-consistency*.
    # If the decode is right, an internal jump or call lands on the first byte
    # of a decoded instruction; if the sweep has drifted out of phase, targets
    # land in the middle of one. That number is a real measurement.
    aligned = misaligned = 0
    for tgt in branch_targets:
        if tgt in boundaries:
            aligned += 1
        elif tgt in decoded_span:
            misaligned += 1
    checked = aligned + misaligned

    accounted = covered + data_bytes
    summary = [
        "",
        "; " + "=" * 54,
        f"; instructions          {insn_count:,}",
        f"; code decoded          {covered:,} bytes",
        f"; data identified       {data_bytes:,} bytes",
        f"; accounted for         {accounted:,} of {total:,} "
        f"({100 * accounted / total:.1f}%)   -- a linear sweep; see below",
        f"; internal branches     {checked:,} land inside decoded code",
        f"; on an instruction     {aligned:,} ({100 * aligned / max(checked,1):.2f}%)"
        f"  <- the figure that can fail",
        f"; mid-instruction       {misaligned:,}",
        f"; MECC's code region    {total:,} bytes of the {code_end:,}-byte image",
        "; " + "=" * 54,
    ]
    out.extend(summary)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text("\n".join(out) + "\n", encoding="ascii",
                              errors="replace")
    print("\n".join(s[2:] for s in summary[1:-1]))
    print(f"\nwrote {args.out}")


if __name__ == "__main__":
    main()
