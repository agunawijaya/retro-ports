"""What can be said about each routine and each address without guessing.

A name with no evidence behind it is a guess the next reader will believe, so
this prints the facts a name can be written from: the interrupts and ports a
routine touches, the constants it stores and where, who calls it, what it
calls, and for an address, who writes it and who reads it.

    python tools/profile.py --routines --batch 0
    python tools/profile.py --globals  --batch 0
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
ASM = HERE / "recovered" / "frogger.asm"


def body():
    """Every line, under the label that last opened, with pinned `db` lines
    decoded from the comment comrec leaves on them."""
    out, cur = defaultdict(list), None
    for line in ASM.read_text(encoding="latin-1").splitlines():
        m = re.match(r"^L_([0-9A-F]{5}):", line)
        if m:
            cur = int(m.group(1), 16)
            continue
        if cur is None:
            continue
        s = re.sub(r"\s{2,};.*$", "", line).strip()
        if s and not s.startswith("db "):
            out[cur].append(s)
        p = re.match(r"db .*?;\s*(.*)$", line.strip())
        if p and not p.group(1).startswith("0x"):
            out[cur].extend(x.strip() for x in p.group(1).split(" | "))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--routines", action="store_true")
    ap.add_argument("--globals", action="store_true")
    ap.add_argument("--batch", type=int, default=0)
    ap.add_argument("--size", type=int, default=24)
    a = ap.parse_args()

    text = ASM.read_text(encoding="latin-1")
    d = json.loads((HERE / "symbols.json").read_text(encoding="utf-8"))
    named = {int(k, 16): v[0] for k, v in d["routines"].items()}
    gnamed = {int(k, 16): v[0] for k, v in d["globals"].items()}
    b = body()
    starts = sorted(b)

    def owner(off):
        lo = None
        for s in starts:
            if s <= off:
                lo = s
            else:
                break
        return named.get(lo, f"0x{lo:05X}" if lo is not None else "?")

    calls = defaultdict(list)
    here = None
    for line in text.splitlines():
        m = re.match(r"^L_([0-9A-F]{5}):", line)
        if m:
            here = int(m.group(1), 16)
            continue
        for c in re.finditer(r"\bcall\s+(?:strict near )?L_([0-9A-F]{5})", line):
            calls[int(c.group(1), 16)].append(here)

    if a.routines:
        todo = [t for t in sorted(calls) if t not in named]
        todo = todo[a.batch * a.size:(a.batch + 1) * a.size]
        print(f"{len(calls)} call targets, {len(named)} named\n")
        for t in todo:
            ins = b.get(t, [])
            ints = sorted({x for s in ins
                           for x in re.findall(r"int 0x[0-9a-f]+", s)})
            ports = sorted({s for s in ins if re.match(r"^(in|out) ", s)})
            regs = sorted({s for s in ins
                           if re.match(r"^mov (ah|al|ax), 0x", s)})[:6]
            stores = sorted({m.group(1) for s in ins
                             for m in [re.match(r"mov (?:byte |word )?"
                                                r"\[(0x[0-9a-f]+)\]", s)] if m})
            outer = sorted({owner(c) for c in calls[t] if c is not None})
            callees = sorted({owner(int(m.group(1), 16)) for s in ins
                              for m in [re.match(r"call (?:strict near )?"
                                                 r"L_([0-9A-F]{5})", s)] if m})
            print(f"0x{t:05X}  {len(ins)} insn, {len(calls[t])} callers")
            if ints:
                print("   int    " + ", ".join(ints))
            if ports:
                print("   port   " + ", ".join(ports)[:110])
            if regs:
                print("   sets   " + ", ".join(regs)[:110])
            if stores:
                print("   writes " + ", ".join(
                    gnamed.get(int(x, 16), x) for x in stores)[:130])
            if callees:
                print("   calls  " + ", ".join(callees)[:130])
            if outer:
                print("   from   " + ", ".join(outer)[:130])
            print()

    if a.globals:
        refs = defaultdict(lambda: {"w": set(), "r": set(), "k": set()})
        here = None
        for line in text.splitlines():
            m = re.match(r"^L_([0-9A-F]{5}):", line)
            if m:
                here = int(m.group(1), 16)
                continue
            s = re.sub(r"\s{2,};.*$", "", line).strip()
            for m in re.finditer(r"\[(?:[a-z]{2}:)?(?:[a-z]{2}\s*\+\s*)?"
                                 r"(0x[0-9a-f]+)\]", s):
                addr = int(m.group(1), 16)
                e = refs[addr]
                e["k"].add("word" if " word [" in s else "byte")
                (e["w"] if s.split(",")[0].strip().endswith(m.group(0))
                 and s.startswith("mov") else e["r"]).add(owner(here))
        todo = [x for x in sorted(refs) if x not in gnamed]
        todo = todo[a.batch * a.size:(a.batch + 1) * a.size]
        print(f"{len(refs)} addresses referenced, {len(gnamed)} named\n")
        img = (HERE / "original" / "FROGGER.COM").read_bytes()
        for addr in todo:
            e = refs[addr]
            off = addr - 0x100
            raw = img[off:off + 6].hex(" ") if 0 <= off < len(img) - 6 else "--"
            print(f"0x{addr:05X} [{'/'.join(sorted(e['k']))}] {raw}")
            if e["w"]:
                print("   w: " + ", ".join(sorted(e["w"]))[:110])
            if e["r"]:
                print("   r: " + ", ".join(sorted(e["r"]))[:110])


main()
