#!/usr/bin/env python3
"""Build the keystroke sequence that drives The Oregon Trail to hunting.

Fifteen attempts went into this, and the sequence itself is the least
interesting part of the answer -- what matters is why an obvious one does not
work, so each step below carries the reason it is shaped the way it is.

Run it for the command line, then run that:

    python tools/drive-to-hunt.py --saved --play
    python <toolkit>/tools/comrun.py original/OREGON.EXE --files original \
        --budget 60000000 --poll-patience 200 --timer-isr 1c \
        --keys <what this prints> --stop-at 0x6aa3 --stop-after 40 \
        --png hunt.png --exec-map hunt.txt

Three flags matter and none is optional:

  * `--saved` uses `ZOP12.GAM`, which ships with the game. Nineteen keystrokes
    and 30 million instructions instead of 111 and 1.5 billion.
  * `--poll-patience 200`, or the `while KeyPressed do ReadKey` flush at the
    head of every screen swallows the queue.
  * `--timer-isr 1c`, or the mini-game waits for ever on a counter its own
    handler increments and the hunter never takes a step.

Check the execution map, not the picture: 0x4093, 0x4104, 0x4109, 0x77F8,
0x628A, 0x72DD and — if you passed `--play` — 0x6AA3 must all appear. A
screenshot can be a half-drawn frame; the map cannot be misread.

And for the field itself, prefer `tools/render-hunting.py`: it draws the same
screen from the file, which is the deliverable this folder asks for. What is
below is the referee.
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


def from_saved_game():
    """The short way in, and it was in the box the whole time.

    `ZOP12.GAM` ships with the game -- 144 bytes, in `original/` beside the
    executable -- and answering `Y` to *"Would you like to continue a saved
    game?"* lands the party at South Pass on 13 May 1848 with supplies. No
    profession, no five names, no month, no store, no Independence.

    South Pass is a landmark, so its menu is `1-9` with *8. Talk to people*;
    one leg of trail is enough for `[0x199D]` to clear and option 8 to become
    *Hunt for food*. The trail also divides there -- *"1. head for Green River
    crossing"* -- which is the prompt that ate the key on four earlier
    attempts and is answered explicitly below.

    Nineteen keystrokes and **29,904,635 instructions** to reach `0x77F8`,
    against roughly 1.5 billion by the front door. Fifty times cheaper, and
    the difference between a probe you can iterate on and one you cannot.
    """
    k = [DIGIT["1"], CR]                  # 1. Travel the trail
    k += [LETTER["Y"], CR]                # continue a saved game?  yes
    k += [DIGIT["1"], CR]                 # which saved game
    k += [SPACE, SPACE, CR]               # the arrival screens
    k += [DIGIT["1"], CR]                 # 1. Continue on trail
    k += [DIGIT["1"], CR]                 # "The trail divides here"
    k += [SPACE]                          # whatever the leg ran into
    k += [DIGIT["1"], CR]                 # 1. Continue on trail, again
    k += [SPACE]
    k += [DIGIT["8"], CR]                 # 8. Hunt for food -- now on offer
    return k


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


# Reaching hunting is not the same as playing it. The first run that got there
# drew the instructions and left again without the hunter taking a step --
# 0x6AA3, the movement step, never executed -- because the keys that followed
# were the next round's N, 1 and 8, none of which the field wants. What it wants
# is what the instructions screen says: a keypad digit to point, Enter to start
# walking, Space to fire.
ESC = 0x011B


def play():
    k = [SPACE]                           # dismiss the instructions
    k += [DIGIT["6"]]                     # point the rifle east
    k += [CR]                             # Enter: start walking
    k += [SPACE] * 6                      # Space: fire, six times
    k += [DIGIT["2"], DIGIT["4"], DIGIT["8"]]   # and turn, to move the sprite
    k += [SPACE] * 4
    k += [ESC]                            # Escape: stop hunting
    return k


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rounds", type=int, default=8,
                    help="how many travel-then-ask-to-hunt rounds (default 8)")
    ap.add_argument("--saved", action="store_true",
                    help="use ZOP12.GAM instead of playing from the title "
                         "screen: 19 keystrokes and 30 million instructions "
                         "rather than 111 and 1.5 billion")
    ap.add_argument("--play", action="store_true",
                    help="append keys that play the field rather than only "
                         "reaching it: point, walk, fire, then Escape")
    args = ap.parse_args()
    keys = (from_saved_game() if args.saved
            else sequence(args.rounds))
    keys += play() if args.play else []
    print(",".join(f"{k:#06x}" for k in keys))
    print(f"\n{len(keys)} keystrokes."
          "  Remember --poll-patience 200, or the flush loops eat them.")


if __name__ == "__main__":
    main()
