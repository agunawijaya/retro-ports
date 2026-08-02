#!/usr/bin/env python3
"""animate.py -- put the decoded artwork and the recovered rules together.

This is the end-to-end check on the whole decompilation, and it is the only one
that exercises every part at once. To draw a wagon whose wheels turn it needs:

  * the container format read (`pcxlib.py` walking OTCGA.PCL);
  * the PCX decoded, at the right bit depth;
  * the CGA palette resolved from the header's mode flags rather than from its
    colour map -- the bug the running game caught;
  * the sprite strip cut into frames, which is a fact about the file nobody
    documented and which had to be measured;
  * and the travel rules, so the wagon moves at the speed the game says it
    moves rather than at whatever looks nice.

That last point is what makes it evidence rather than decoration. The distance
per frame is `legRate x (pace + 2) / 2` from image 0x0003C5, so the three paces
really do come out as 1 : 1.5 : 2, and the food counter really does fall by
`people x (3 - rations)` a day, from image 0x013D34.

Output goes to `reference/`, which is **gitignored**: these frames are the
game's own artwork, and a GIF is still the game. The tool is ours and is
committed; what it draws is not.

    python animate.py --pcl original/OTCGA.PCL --out reference
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, r"C:\Projects\dos-decompiler\tools")
import pcxlib                                              # noqa: E402

# CGA palette 1, high intensity -- what the header's mode flags select and what
# the game actually displays.
PAL = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]

# Frame cells inside TRAVELOX.PCC, measured from the empty rows and columns.
# The top band holds three travel frames, the bottom two breakdown frames.
TRAVEL_CELLS = [(0, 1, 80, 32), (87, 1, 168, 32), (176, 1, 256, 32)]
BROKEN_CELLS = [(1, 37, 77, 70), (88, 37, 170, 70)]

# Horizontal bands inside SCENERY.PCC, from its blank rows. Band 2 is a
# mountain range the full width of the screen, which is what makes it usable
# as a scrolling backdrop; the rest are forts and landmarks.
SCENERY_BANDS = {"haze": (0, 1, 320, 20), "mountains": (0, 22, 320, 46),
                 "forts": (0, 51, 320, 74)}

# Scenery objects inside TERRAIN.PCC, by connected component. The nine 17x15
# blocks at x=144..198 are a numeric-keypad diagram -- the game's movement
# help -- and are deliberately not scenery.
TERRAIN_OBJECTS = [
    (0, 0, 35, 42), (46, 1, 80, 44), (99, 8, 136, 43),
    (0, 48, 36, 88), (49, 48, 78, 89), (93, 47, 127, 88),
    (210, 4, 254, 18), (213, 28, 237, 48), (252, 26, 282, 52),
    (269, 9, 311, 19), (296, 27, 320, 49),
    (192, 56, 228, 71), (236, 56, 266, 71), (274, 54, 319, 68),
]

# Sub-images inside FLOAT.PCC, found by connected components.
FLOAT_BOXES = {
    "raft":      (7, 5, 86, 58),
    "turning":   (93, 4, 162, 46),
    "headon":    (169, 4, 220, 42),
    "capsized":  (10, 71, 71, 101),
    "diagram":   (80, 65, 136, 99),
    "far_a":     (146, 61, 179, 85),
    "far_b":     (182, 83, 217, 108),
}

# The recovered rules, image addresses in the comments.
LEG_RATE = 18            # NOT recovered -- a placeholder for the per-leg byte
PARTY = 5


def miles_per_day(pace):            # image 0x0003C5
    return LEG_RATE * (pace + 2) / 2.0


def food_per_day(rations):          # image 0x013D34
    return PARTY * (3 - rations)


def load(pcl, want):
    """Every member of the container as a grid of palette indices."""
    data = Path(pcl).read_bytes()
    out = {}
    for name, off, size in pcxlib.members(data):
        key = name.split(".")[0].strip()
        if key in want:
            out[key] = pcxlib.Pcx(data[off:off + size]).rows()
    return out


def cut(rows, box, transparent=None):
    """A sub-image as RGB plus a mask, so it can be composited."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    im = Image.new("RGB", (w, h))
    mask = Image.new("L", (w, h), 255)
    px, mk = [], []
    for y in range(y0, y1):
        for x in range(x0, x1):
            v = rows[y][x]
            px.append(PAL[v])
            mk.append(0 if (transparent is not None and v == transparent) else 255)
    im.putdata(px)
    mask.putdata(mk)
    return im, mask


def hud(img, lines, colour=(255, 255, 255)):
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        d.text((4, 4 + i * 9), line, fill=colour)
    return img


def wagon_gif(art, out, pace=1, rations=1, scale=3, steps=72):
    """The travel screen: wheels turning, the trail going by, counters falling.

    The wheel spokes alternate X and + between frames -- that is in the game's
    artwork, not added here -- so cycling 1,2,3,2 turns the wheel through four
    positions.

    Two layers scroll at different speeds because that is how the game gets
    depth out of a 320x200 screen with no hardware to help: the mountains creep
    and the trees rush past. And both scroll by the distance the *rules* say the
    wagon covers, so choosing a different pace really does change the speed of
    the picture.
    """
    mts, _ = cut(art["SCENERY"], SCENERY_BANDS["mountains"])
    objs = [cut(art["TERRAIN"], b, transparent=0) for b in TERRAIN_OBJECTS]
    frames_src = [cut(art["TRAVELOX"], c, transparent=0) for c in TRAVEL_CELLS]
    order = [0, 1, 2, 1]

    per_day = miles_per_day(pace)
    eat = food_per_day(rations)
    miles, food, day = 0.0, 200 * PARTY, 0

    W, H = 320, 132
    GROUND = H - 16
    # Where the scenery stands, spread along a strip twice the screen wide so
    # it can wrap without a visible seam.
    STRIP = W * 2
    placed = [(i * 47 % STRIP, objs[i % len(objs)]) for i in range(14)]

    out_frames = []
    for i in range(steps):
        far = int(i * per_day / 9) % W
        near = int(i * per_day / 2) % STRIP
        canvas = Image.new("RGB", (W, H), (0, 0, 0))
        canvas.paste(mts, (-far, 22))
        canvas.paste(mts, (W - far, 22))
        d = ImageDraw.Draw(canvas)
        d.line([(0, GROUND), (W, GROUND)], fill=PAL[1])

        for base, (spr, mask) in placed:
            x = (base - near) % STRIP
            if x > W:
                x -= STRIP
            if -spr.width < x < W:
                canvas.paste(spr, (x, GROUND - spr.height + 2), mask)

        wag, mask = frames_src[order[i % len(order)]]
        canvas.paste(wag, (W // 2 - wag.width // 2, GROUND - wag.height + 4), mask)

        if i % 4 == 0:
            day += 1
            miles += per_day
            food = max(0, food - eat)
        hud(canvas, [f"Day {day}   {int(miles)} miles   food {int(food)} lb",
                     f"{['steady','strenuous','grueling'][pace]} pace, "
                     f"{['filling','meager','bare bones'][rations]} rations"
                     f"   ({per_day:.0f} mi/day, {eat:.0f} lb/day)"])
        out_frames.append(canvas.resize((W * scale, H * scale), Image.NEAREST))

    out_frames[0].save(out, save_all=True, append_images=out_frames[1:],
                       duration=110, loop=0, optimize=False)
    return len(out_frames)


def river_gif(art, out, scale=3, steps=60):
    """The crossing: a raft drifts out, is caught, and is lost.

    The four states are the game's own -- a raft in full view, the same raft
    turning, head-on, and capsized -- and the captions are the strings the
    program prints, quoted from image 0x00AA21 onward.
    """
    rows = art["FLOAT"]
    boxes = FLOAT_BOXES
    far, _m1 = cut(rows, boxes["far_a"], transparent=1)
    raft, m_raft = cut(rows, boxes["raft"], transparent=1)
    turn, m_turn = cut(rows, boxes["turning"], transparent=1)
    head, m_head = cut(rows, boxes["headon"], transparent=1)
    caps, m_caps = cut(rows, boxes["capsized"], transparent=1)

    W, H = 260, 130
    river = Image.new("RGB", (W, H), PAL[1])
    d = ImageDraw.Draw(river)
    # Banks top and bottom, and a dashed current between them. Solid lines look
    # like ruled paper; CGA games dithered, and two pixels on, six off reads as
    # moving water at this scale.
    d.rectangle([0, 0, W, 9], fill=PAL[3])
    d.rectangle([0, H - 11, W, H], fill=PAL[3])
    for y in range(14, H - 12, 7):
        for x in range((y * 5) % 8, W, 8):
            d.point((x, y), fill=PAL[3])
            d.point((x + 1, y), fill=PAL[3])

    script = ([("drift", raft, m_raft, "Crossing the river...")] * 22 +
              [("hit", turn, m_turn, "The raft has hit a rock.")] * 12 +
              [("down", head, m_head, "The raft has missed the landing.")] * 12 +
              [("lost", caps, m_caps,
                "The raft is destroyed; everything has been lost.")] * 14)

    out_frames = []
    for i, (kind, spr, mask, text) in enumerate(script[:steps]):
        canvas = river.copy()
        x = 8 + int(i * (W - 100) / max(len(script) - 1, 1))
        y = 34 + (3 if i % 4 < 2 else 0)        # a gentle bob
        if kind == "lost":
            y += 10
        canvas.paste(spr, (x, y), mask)
        hud(canvas, [text], colour=(0, 0, 0))
        out_frames.append(canvas.resize((W * scale, H * scale), Image.NEAREST))

    out_frames[0].save(out, save_all=True, append_images=out_frames[1:],
                       duration=130, loop=0, optimize=False)
    return len(out_frames)


def strip(frames, path, scale=3):
    """A filmstrip, because a GIF's first frame is all a still viewer shows."""
    w = sum(f.width for f in frames) + 4 * (len(frames) - 1)
    sheet = Image.new("RGB", (w, frames[0].height), (30, 30, 30))
    x = 0
    for f in frames:
        sheet.paste(f, (x, 0))
        x += f.width + 4
    sheet.save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pcl", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)

    want = {"TRAVELOX", "TERRAIN", "FLOAT", "SCENERY"}
    art = load(args.pcl, want)
    missing = want - set(art)
    if missing:
        raise SystemExit(f"container is missing {sorted(missing)}")

    n1 = wagon_gif(art, outdir / "wagon.gif")
    n2 = river_gif(art, outdir / "river.gif")

    # Filmstrips of the wheel cycle and the crossing, for viewers that show
    # only a GIF's first frame.
    wheels = [cut(art["TRAVELOX"], c, transparent=0)[0] for c in TRAVEL_CELLS]
    wheels = [w.resize((w.width * 3, w.height * 3), Image.NEAREST)
              for w in [wheels[0], wheels[1], wheels[2], wheels[1]]]
    strip(wheels, outdir / "wagon_frames.png")

    order = ["far_a", "raft", "turning", "headon", "capsized"]
    rf = [cut(art["FLOAT"], FLOAT_BOXES[k], transparent=1)[0] for k in order]
    top = max(f.height for f in rf)
    padded = []
    for f in rf:
        c = Image.new("RGB", (f.width, top), PAL[1])
        c.paste(f, (0, top - f.height))
        padded.append(c.resize((f.width * 3, top * 3), Image.NEAREST))
    strip(padded, outdir / "river_frames.png")

    print(f"wagon.gif        {n1} frames")
    print(f"river.gif        {n2} frames")
    print(f"wagon_frames.png the wheel cycle, X + X +")
    print(f"river_frames.png the crossing, five states")
    print(f"\nwrote to {outdir}/ -- gitignored, this is the game's own artwork")


if __name__ == "__main__":
    main()
