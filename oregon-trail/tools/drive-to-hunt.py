#!/usr/bin/env python3
"""Build the keystroke sequence that drives The Oregon Trail to hunting.

Fifteen attempts went into this, and the sequence itself is the least
interesting part of the answer -- what matters is why an obvious one does not
work, so each step below carries the reason it is shaped the way it is.

Run it for the command line, then run that:

    python tools/drive-to-hunt.py
    python <toolkit>/tools/comrun.py original/OREGON.EXE --files original \
        --budget 3000000000 --poll-patience 200 --keys <what this prints> \
        --png hunt.png --exec-map hunt.txt

Check the execution map, not the picture: 0x4093, 0x4104, 0x4109, 0x77F8,
0x628A and 0x72DD must all appear. A screenshot can be a half-drawn frame; the
map cannot be misread.
"""
import argparse

# INT 16h AX values: scancode in the high byte, ASCII in the low one. comrun
# takes them literally, so what is written here is what the BIOS would report.
CR = 0x1C0D
SPACE = 0x3920
DIGIT = {"0": 0x0B30, "1": 0x0231, "2": 0x0332, "3": 0x0433, "4": 0x0534,
         "5": 0x0635, "6": 0x0736, "7": 0x0837, "8": 0x0938, "9": 0x0A39}
LETTER = {"A": 0x1E41, "N": 0x314E, "Y": 0x1579}


def digits(text):
    """A multi-digit answer is one keystroke per character, then Enter."""
    return [DIGIT[c] for c in text] + [CR]


def sequence(rounds=8):
    k = []

    # --- getting a party onto the trail -------------------------------------
    # Every one of these prompts is a field: type, then Enter. A bare Enter
    # re-prompts rather than accepting a default, which is why the title screen
    # swallowed sixteen of them once and never moved.
    k += [DIGIT["1"], CR]                 # 1. Travel the trail
    k += [LETTER["N"], CR]                # continue a saved game? no
    k += [DIGIT["1"], CR]                 # be a banker from Boston -- $1,600
    k += [LETTER["A"], CR] * 5            # five names; the game insists on all
    k += [LETTER["Y"], CR]                # are these names correct?
    k += [DIGIT["1"], CR] * 3             # leave in March, and two continues

    # --- Matt's General Store ----------------------------------------------
    # TWO greeting pages. Dismissing one leaves every purchase below shifted by
    # an item, and the store then reports Oxen $0.00 while charging for
    # clothing -- which reads like a broken quantity field and is not.
    k += [SPACE, SPACE]
    # The item menu accepts '1'-'5' in a field ONE character wide, and still
    # wants an Enter. Sending the item and the quantity as bare digits makes
    # the second digit land in the quantity field: '1','3' asks for 13 yoke,
    # and Matt answers "You may only take 20 oxen."
    k += [DIGIT["1"], CR] + digits("3")    # oxen, 3 yoke      -- his advice
    k += [DIGIT["2"], CR] + digits("900")  # food, 900 lb      -- or they starve
    k += [DIGIT["3"], CR] + digits("5")    # clothing, 5 sets
    k += [DIGIT["4"], CR] + digits("5")    # ammunition, 5 boxes = 100 bullets
    k += [SPACE, SPACE, SPACE]             # SPACE leaves the store, then depart

    # --- the trail ----------------------------------------------------------
    # Hunting is option 8 only away from a landmark: the menu is '1-9' with
    # "8. Talk to people" at a settlement and '1-8' with "8. Hunt for food" on
    # the trail, decided by `cmp byte [0x199d], 0` at 0x4109. So ask repeatedly
    # while travelling rather than trying to predict which leg lands clear of
    # one. Seven rounds was enough; eight is asked for so the last one has
    # keys left to walk and fire with.
    for _ in range(rounds):
        k += [LETTER["N"], CR]            # "would you like to look around?"
        k += [DIGIT["1"], CR]             # 1. Continue on trail
        k += [SPACE]                      # whatever the leg ran into
        k += [DIGIT["8"], CR]             # 8. Hunt for food
        k += [SPACE]                      # past the instructions screen
    return k


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rounds", type=int, default=8,
                    help="how many travel-then-ask-to-hunt rounds (default 8)")
    args = ap.parse_args()
    keys = sequence(args.rounds)
    print(",".join(f"{k:#06x}" for k in keys))
    print(f"\n{len(keys)} keystrokes."
          "  Remember --poll-patience 200, or the flush loops eat them.")


if __name__ == "__main__":
    main()
