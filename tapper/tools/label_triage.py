"""List every still-generic label with the context needed to name it.

Naming the remaining labels is not one job but three, and they need different
effort:

  * a `loc_` inside a routine that already has a block comment -- the behaviour
    is understood, the label just needs a name that says which part it is
  * a `loc_` inside a routine with a name but no comment -- needs a read, but a
    short one, and the surrounding name constrains the answer
  * anything in a stretch with no named owner at all -- needs the routine read
    first; naming the label before that is exactly what PLAYBOOK 7.8 warns off

This sorts the work into those buckets so the cheap ones can be done in bulk
and the expensive ones are visible rather than guessed at.

One caveat the numbers cannot state themselves: "owner" here is only the last
named label before the address, which is not the same as the enclosing routine.
init_free_list is eight instructions long but appears to own labels 0x90 further
on, because the stretch after it has no name of its own. The span column is
there to make that visible -- a wide span means the real owner is missing, not
that the routine is huge.

    python tools/label_triage.py            # summary
    python tools/label_triage.py owner      # group by owning routine
"""
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASM = os.path.join(ROOT, "src", "tapper.asm")

LABEL = re.compile(r"^(\w+):$")
GENERIC = re.compile(r"^(sub|loc)_([0-9A-F]{4})$")
INSN = re.compile(r"^\s+(\S.*?)\s+;\s*([0-9A-F]{4})\s")
RULE = re.compile(r"^; -{60,}$")
XREF = re.compile(r"^; xref: (.*?)\s+\((\d+) site")


def load():
    """Return the label list in address order, with owner and size."""
    labels = []
    doc_pending = False
    xref_pending = None
    for line in open(ASM):
        line = line.rstrip()
        if RULE.match(line):
            doc_pending = not doc_pending or doc_pending
            continue
        m = XREF.match(line)
        if m:
            xref_pending = int(m.group(2))
            continue
        m = LABEL.match(line)
        if m:
            labels.append({"name": m.group(1), "addr": None,
                           "sites": xref_pending or 0, "insns": 0,
                           "doc": doc_pending})
            xref_pending, doc_pending = None, False
            continue
        m = INSN.match(line)
        if m and labels:
            if labels[-1]["addr"] is None:
                labels[-1]["addr"] = int(m.group(2), 16)
            labels[-1]["insns"] += 1
    return [l for l in labels if l["addr"] is not None]


def main():
    labels = load()
    # Walk forward so each generic label knows the last real name before it.
    owner, has_doc = None, False
    buckets = defaultdict(list)
    for l in labels:
        if not GENERIC.match(l["name"]):
            owner, has_doc = l["name"], l["doc"]
            continue
        if owner is None:
            bucket = "no owner"
        elif has_doc:
            bucket = "owner documented"
        else:
            bucket = "owner named only"
        l["owner"] = owner or "-"
        buckets[bucket].append(l)

    total = sum(len(v) for v in buckets.values())
    named = sum(1 for l in labels if not GENERIC.match(l["name"]))
    print(f"{len(labels)} labels: {named} named, {total} still generic\n")
    for bucket in ("owner documented", "owner named only", "no owner"):
        rows = buckets[bucket]
        insns = sum(r["insns"] for r in rows)
        print(f"  {bucket:<18} {len(rows):>4} labels, {insns:>5} instructions")

    if len(sys.argv) > 1 and sys.argv[1] == "owner":
        print("\ngeneric labels grouped by owning routine:")
        by_owner = defaultdict(list)
        for rows in buckets.values():
            for r in rows:
                by_owner[r["owner"]].append(r)
        print("  span is first..last generic label; a wide one means the")
        print("  enclosing routine has no name yet, not that it is large.\n")
        for own, rows in sorted(by_owner.items(), key=lambda kv: -len(kv[1])):
            lo, hi = rows[0]["addr"], rows[-1]["addr"]
            flag = "  <- unnamed stretch" if hi - lo > 0x80 else ""
            print(f"  {own:<26} {len(rows):>3}  {lo:04X}..{hi:04X}"
                  f" ({hi - lo:#05x}){flag}")


if __name__ == "__main__":
    main()
