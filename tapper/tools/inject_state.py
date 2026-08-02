"""Force game state under emulation to reach code passive tracing never does.

Raising the instruction limit stopped buying coverage: 12M -> 40M instructions
added 56 code addresses (2.4%) and no new subsystem, because the emulator plays
badly and playing longer is still playing badly. Four asset indices and four
`call word ptr [bx+si]` sites stayed dark.

The way past that is not a competent Tapper bot -- that is a project of its own
-- but writing the progress variables directly. That only became possible once
they had names and settled addresses: page_index picks the screen, and
abort_sequence_flag is the flag nothing in the binary ever sets.

    python tools/inject_state.py baseline
    python tools/inject_state.py page:12
    python tools/inject_state.py abort

IMPORTANT: anything seen only here is reachable *under forced state*. That is a
weaker claim than "the game does this", and results must say so -- a poke can
produce behaviour the real game never reaches.
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trace import Machine, LOAD_SEG, KEY_SCRIPT, Halt  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")

# Addresses this experiment cares about, all CS-relative.
LOAD_ASSET = 0x0503          # AL = asset index
ROUND_ENTRY = 0x0C25         # call load_page_screen, just after page_index is set
ROUND_CHECK = 0x1F69         # the round-complete check that reads the dead flag
BONUS_AWARD = 0x1F8A         # what the dead branch jumps to
MODE_BRANCH = 0x0732         # cmp al, 0 -- the display-mode choice
PAGE_INDEX = 0x44D1
ABORT_FLAG = 0x4487
SCREEN_AUX_PTR = 0x4497

# 8086 byte-register encoding, for pokes that target a register instead of
# memory. Changing the input to a branch and letting the program configure
# itself is a smaller lie than writing its output variables by hand.
REG8 = {"al": 0, "cl": 1, "dl": 2, "bl": 3, "ah": 4, "ch": 5, "dh": 6, "bh": 7}

WATCH = {
    0x0C19: "page wrap",
    0x0D7A: "round counter advance",
    0x1F8A: "bar-cleared bonus",
    0x1DA9: "pickup popup armed",
    0x31A3: "joystick calibration",
    0x2A85: "bonus abort check",
    0x1107: "popup tick",
}


class Injector(Machine):
    def __init__(self, plan):
        super().__init__()
        # The stock key script runs out after ~150 presses, and a run that
        # outlives it wedges in read_key forever -- 3.7M iterations of the wait
        # loop at CS:2F71 with nothing else executing. Repeating the script
        # keeps a notional player at the keyboard for the whole run.
        self.keys = list(KEY_SCRIPT) * 30
        self.plan = plan            # list of (address, nth_hit, offset, value, size)
        self.hits = Counter()
        self.assets = []            # asset indices in request order
        self.pokes_done = []
        self.watch_hits = Counter()

    def _on_exec(self, cpu, seg, off):
        super()._on_exec(cpu, seg, off)
        if seg != LOAD_SEG:
            return
        if off == LOAD_ASSET:
            self.assets.append(cpu.r8(0))
        if off in WATCH:
            self.watch_hits[off] += 1
        if not self.plan:
            return
        self.hits[off] += 1
        for entry in list(self.plan):
            addr, nth, dst, val, size = entry
            if off != addr or self.hits[off] != nth:
                continue
            if isinstance(dst, str):                # register
                cpu.w8(REG8[dst], val)
                where = dst.upper()
            elif size == 2:
                cpu.wr16(LOAD_SEG, dst, val)
                where = f"CS:{dst:04X}"
            else:
                cpu.wr8(LOAD_SEG, dst, val)
                where = f"CS:{dst:04X}"
            self.pokes_done.append((cpu.icount, addr, where, val))
            self.plan.remove(entry)


def build_plan(spec):
    """Turn a command-line spec into a poke plan and a human description.

    Specs combine with '+', so `mode0+page:12` installs the mode 0 tables and
    then forces the page -- which is the combination that reaches the mode 0
    aux table, the one holding the asset indices passive tracing never saw.
    """
    if "+" in spec:
        plans, descs = [], []
        for part in spec.split("+"):
            p, d = build_plan(part)
            plans.extend(p)
            descs.append(d)
        return plans, "; ".join(descs)
    if spec == "baseline":
        return [], "no pokes -- control run"
    if spec.startswith("page:"):
        page = int(spec.split(":", 1)[1])
        # CS:0C25 is reached exactly once per page advance, and the emulator
        # only ever advances the page once -- the later round setups all come
        # through restart_round_after_death, which skips it. So the only
        # opportunity is the first arrival, right after CS:0C21 stored the
        # real index and before load_page_screen reads it back at CS:0C35.
        return ([(ROUND_ENTRY, 1, PAGE_INDEX, page, 2)],
                f"force page_index = {page} at the 1st round entry")
    if spec == "aux0":
        # Swap only the screen-id -> asset table to mode 0's, keeping the rest
        # of the mode 1 flow that actually reaches gameplay. Mode 1's table
        # sends ids 3..6 past the end of the 15-entry directory, so the punk
        # and space screens cannot load without this.
        return ([(ROUND_ENTRY, 1, SCREEN_AUX_PTR, 0x3C21, 2)],
                "point screen_aux_ptr at screen_aux_mode0")
    if spec == "mode0":
        # CS:0732 is `cmp al, 0`, the display-mode choice, and the emulator
        # always arrives with AL == 0 -- the branch that installs
        # screen_aux_mode1. Forcing AL non-zero makes select_display_mode
        # itself install the mode0 tables, so nothing is written by hand: the
        # only change is the input to a branch the routine already has.
        return ([(MODE_BRANCH, 1, "al", 1, 1)],
                "force AL != 0 at the display-mode branch -> mode 0 tables")
    if spec == "abort":
        return ([(ROUND_CHECK, 200, ABORT_FLAG, 1, 1)],
                "set abort_sequence_flag = 1 at the 200th round check")
    raise SystemExit(f"unknown experiment: {spec}")


def main():
    spec = sys.argv[1] if len(sys.argv) > 1 else "baseline"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 8_000_000
    plan, desc = build_plan(spec)

    m = Injector(plan)
    m.load("TAPPER.COM")
    print(f"experiment : {spec}")
    print(f"poke plan  : {desc}")
    print(f"limit      : {limit:,} instructions\n")

    reason = m.run(limit)
    print(f"stopped: {reason}")
    print(f"instructions: {m.cpu.icount:,}")

    if m.pokes_done:
        for ic, addr, where, val in m.pokes_done:
            print(f"poked {where} = {val} at CS:{addr:04X}, icount {ic:,}")
    elif plan:
        print("POKE NEVER FIRED -- the trigger address was not reached enough times")

    order, seen = [], set()
    for a in m.assets:
        if a not in seen:
            seen.add(a)
            order.append(a)
    counts = Counter(m.assets)
    print(f"\nasset requests: {len(m.assets)} total, {len(seen)} distinct")
    print("  first-seen order: " + ", ".join(str(a) for a in order))
    print("  counts: " + ", ".join(f"{a}x{counts[a]}" for a in sorted(counts)))

    print("\nwatched addresses:")
    for addr, name in sorted(WATCH.items()):
        n = m.watch_hits.get(addr, 0)
        mark = "  " if n else " <- never"
        print(f"  CS:{addr:04X} {name:<26} {n:>7}{mark}")

    # Without these, a run that wedges in read_key looks exactly like a run
    # that simply had nothing more to do.
    print(f"\nkeys delivered: {len(m.keys_sent)} of {len(m.keys_sent) + len(m.keys)}"
          f"   injection windows: {dict(m.diag)}")
    print(f"distinct code addresses: {len(m.exec_count)}")
    if m.indirect:
        print("resolved indirect dispatch:")
        for (kind, site), targets in sorted(m.indirect.items(),
                                            key=lambda k: k[0][1]):
            tl = ", ".join(f"{t:04X}({n}x)" for t, n in targets.most_common(6))
            print(f"  {kind:5} at CS:{site:04X} -> {tl}")

    os.makedirs(OUT, exist_ok=True)
    tag = spec.replace(":", "_")
    path = os.path.join(OUT, f"inject_{tag}.txt")
    with open(path, "w") as f:
        for addr in sorted(m.exec_count):
            f.write(f"{addr:04X} {m.exec_count[addr]}\n")
    print(f"\nwrote {path}")
    shot = os.path.join(OUT, f"inject_{tag}.png")
    m.screenshot(shot)
    print(f"wrote {shot}")


if __name__ == "__main__":
    main()
