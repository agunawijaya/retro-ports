"""Check -- and with --fix, update -- the numbers quoted in the documentation.

Documentation rots silently. Over many sessions each one updated whichever file
it was working in, while status tables elsewhere kept quoting old figures --
README claimed 26 named routines when there were 64. The build stayed green the
whole time, so nothing ever forced the discrepancy into view.

Unlike code coverage, doc accuracy has no automatic signal, so this makes the
audit repeatable: compute the metrics from the source, then verify each current
value actually appears in the docs that quote it.

Reporting alone still left the repair manual -- hand-editing the same table rows
every session, which is exactly the step most likely to be forgotten or done
inconsistently. `--fix` rewrites those rows in place instead, matching each row
by its label so only the number changes.

    python check_docs.py          # report only, exit 1 if stale
    python check_docs.py --fix    # rewrite the status tables
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASM = os.path.join(ROOT, "src", "tapper.asm")
DOCS = ["README.md", "FINDINGS.md"]

LABEL = re.compile(r"^\w+:$")
GENERIC = re.compile(r"^(sub|loc)_[0-9A-F]{4}:$")
EQU = re.compile(r"^\w+\s+equ ")
XREF = re.compile(r"^; xref:")
RULE = re.compile(r"^; -{60,}$")
INSN = re.compile(r"^\s+\S.*;\s[0-9A-F]{4}\s+[0-9A-F]+$")


def metrics():
    lines = open(ASM).read().splitlines()
    labels = [l for l in lines if LABEL.match(l)]
    return {
        "source lines": len(lines),
        "labels": len(labels),
        "named routines": sum(1 for l in labels if not GENERIC.match(l)),
        "named variables": sum(1 for l in lines if EQU.match(l)),
        "xref blocks": sum(1 for l in lines if XREF.match(l)),
        "doc blocks": sum(1 for l in lines if RULE.match(l)) // 2,
        "instructions": sum(1 for l in lines if INSN.match(l)),
    }


# Table rows that quote a metric, matched by their label so only the number is
# rewritten. Each pattern must capture the prefix in group 1 and the number in
# group 2.
ROWS = [
    ("source lines", r"(\| Baris source \| )(\d+)( \|)"),
    ("source lines", r"(`src/tapper\.asm`, )(\d+)( baris)"),
    ("instructions", r"(\| Instruksi(?: nyata)? \| )(\d+)( \|)"),
    ("named routines", r"(\| Rutin bernama \| )(\d+)( \|)"),
    ("named routines", r"(\| Rutin bernama \| )(\d+)(, dengan )"),
    ("doc blocks", r"(\| Blok komentar rutin \| )(\d+)( \|)"),
    ("doc blocks", r"(, dengan )(\d+)( blok komentar \|)"),
    ("named variables", r"(\| Variabel bernama \| )(\d+)( \|)"),
    ("labels", r"(\| Label simbolik \| )(\d+)( \|)"),
    ("labels", r"(\| Label simbolik \| )(\d+)(, dengan )"),
]


def fix(m):
    """Rewrite the metric rows in the docs. Returns the number of edits."""
    edits = 0
    for d in DOCS:
        p = os.path.join(ROOT, d)
        if not os.path.exists(p):
            continue
        text = original = open(p, encoding="utf-8").read()
        for key, pattern in ROWS:
            want = str(m[key])

            def sub(mo, want=want):
                return mo.group(1) + want + mo.group(3)

            text, n = re.subn(pattern, sub, text)
            edits += n
        if text != original:
            open(p, "w", encoding="utf-8").write(text)
            print(f"  updated {d}")
    return edits


def main():
    m = metrics()
    if "--fix" in sys.argv:
        print("rewriting documentation metrics")
        print("-" * 46)
        n = fix(m)
        print(f"  {n} row(s) checked/rewritten\n")
    print("current build metrics")
    print("-" * 46)
    for k, v in m.items():
        print(f"  {k:<18} {v:>7}")

    text = {}
    for d in DOCS:
        p = os.path.join(ROOT, d)
        text[d] = open(p, encoding="utf-8").read() if os.path.exists(p) else ""

    print("\nvalues quoted in the docs")
    print("-" * 46)
    stale = 0
    for k, v in m.items():
        where = [d for d in DOCS if re.search(rf"\b{v}\b", text[d])]
        if where:
            print(f"  {k:<18} {v:>7}  found in {', '.join(where)}")
        else:
            # Not every metric has to be quoted; only report the ones the
            # status tables normally carry.
            if k in ("named routines", "named variables", "instructions",
                     "source lines"):
                print(f"  {k:<18} {v:>7}  NOT FOUND -- status table may be stale")
                stale += 1
            else:
                print(f"  {k:<18} {v:>7}  not quoted")

    print()
    if stale:
        print(f"{stale} metric(s) missing from the docs; re-check the status "
              f"tables in {', '.join(DOCS)}")
        return 1
    print("docs quote the current figures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
