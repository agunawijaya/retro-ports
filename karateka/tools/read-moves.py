#!/usr/bin/env python3
"""read-moves.py -- Take Karateka's move libraries apart.

The fighting is not in the executable. It is in five text files shipped beside
it, written in the fourteen-command language whose interpreter lives at image
0x1364..0x1660 and whose vocabulary the binary names at DS:0x0176.

    ALLPAL   the player's moves          51 blocks
    ALLGAL   a second fighter's moves    50 blocks
    ALLVAL   a third fighter's moves     47 blocks
    ALLBAL   a level's scenery           1 block
    ALLCAL   the cutscenes               2 blocks

A block is a move: frames separated by nothing but their own commands, ending
at `end_animation`. A frame is

    set_pos,<dx> <dy> [name]     where the figure goes, and on the first frame
                                 of some blocks a third token naming the block
    inc_x,<n>                    how far the fighter travels this frame
    set_tune,<n>                 a sound, 0 for silence
    set_fig,<id> <x> <y>         a sprite, placed absolutely
    set_fig,<id> <x> <y>         and a second one -- every fighting frame has
                                 exactly two

The cutscene files use a different half of the vocabulary -- `chg_fig`,
`do_scr`, `wait`, `set_wipe` -- which is the tell that scripting a fight and
scripting a scene are two dialects of one language.

    python tools/read-moves.py                 -- summarise every library
    python tools/read-moves.py --block pal07   -- print one move
"""

import argparse
import re
from collections import Counter
from pathlib import Path

LIBRARIES = ("ALLPAL", "ALLGAL", "ALLVAL", "ALLBAL", "ALLCAL")


def parse(path):
    """Split a library into blocks of (verb, arguments) pairs.

    `end_animation` closes a block. Nothing opens one, so the first block
    begins at the top of the file and every other one begins after a close --
    which is why a corrupt library would silently merge two moves rather than
    fail, and why the block *count* is worth checking against the game.
    """
    text = Path(path).read_text(encoding="latin-1").replace("\r", "")
    blocks, cur = [], []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        verb, _, args = line.partition(",")
        cur.append((verb, args.strip()))
        if verb == "end_animation":
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)
    return blocks


def describe(block):
    """Name, frame count, travel and sprite range for one move."""
    name = None
    frames = travel = 0
    figs = []
    for verb, args in block:
        parts = args.split()
        if verb == "set_pos":
            frames += 1
            if len(parts) >= 3 and re.fullmatch(r"[a-z]+\d+", parts[2]):
                name = parts[2]
        elif verb == "inc_x" and parts:
            try:
                travel += int(parts[0])
            except ValueError:
                pass
        elif verb in ("set_fig", "chg_fig") and parts:
            try:
                figs.append(int(parts[1] if verb == "chg_fig" else parts[0]))
            except (ValueError, IndexError):
                pass
    return name, frames, travel, figs


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="original")
    ap.add_argument("--block", help="print one block by name, e.g. pal07")
    ap.add_argument("--library", help="only this one, e.g. ALLPAL")
    args = ap.parse_args()
    folder = Path(args.game)

    if args.block:
        for lib in LIBRARIES:
            p = folder / lib
            if not p.exists():
                continue
            for b in parse(p):
                if describe(b)[0] == args.block:
                    print(f"{args.block}, from {lib}:\n")
                    for verb, a in b:
                        print(f"    {verb:<14} {a}")
                    return 0
        print(f"no block called {args.block}")
        return 1

    for lib in (args.library,) if args.library else LIBRARIES:
        p = folder / lib
        if not p.exists():
            print(f"{lib}: absent")
            continue
        blocks = parse(p)
        named = [describe(b) for b in blocks]
        verbs = Counter(v for b in blocks for v, _ in b)
        moving = [n for n in named if n[2]]
        print(f"\n=== {lib}: {len(blocks)} blocks, {sum(n[1] for n in named)} "
              f"frames ===")
        print("    verbs: " + ", ".join(f"{v}({c})" for v, c in
                                        verbs.most_common()))
        if moving:
            print(f"    {len(moving)} of them travel; furthest "
                  f"{max(n[2] for n in moving)} px")
        rows = [n for n in named if n[1]]
        for name, frames, travel, figs in rows[:60]:
            lo = min(figs) if figs else 0
            hi = max(figs) if figs else 0
            print(f"    {name or '(unnamed)':<10} {frames:>3} frames  "
                  f"travel {travel:>4}  sprites {lo}..{hi}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
