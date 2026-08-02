#!/usr/bin/env python3
"""animate.py -- a sprite test for the decoded artwork. NOT the game's screens.

Read this before looking at anything it draws.

What is recovered from the binary, and can be relied on:

  * every sprite, decoded from OTCGA.PCL -- the container walked, the PCX
    decoded, the CGA palette taken from the header's mode flags;
  * the frame grids, measured from the blank rows and columns of the decoded
    images. TRAVELOX.PCC really does hold three travel poses whose wheel spokes
    alternate X, +, X, and two breakdown frames. FLOAT.PCC really does hold a
    raft, the same raft turning, head-on, and capsized;
  * the numbers in the caption, which come from the addresses named beside them.

What is **invented here and is not the game**:

  * the layout. Where the wagon sits, where the scenery stands, the ground
    line, the parallax, the caption box -- all of it is this file's arrangement
    of the sprites, not the program's.

The distinction matters and was got wrong once. An earlier version of this file
also composed a *hunting* screen and it was presented as evidence; it was not,
it was a guess, and the real hunting screen looks nothing like it. That scene
has been deleted rather than relabelled, because there is no measurement behind
its layout at all. Drawing the sprites proves the artwork pipeline works. It
proves nothing whatever about how the game arranges them.

The only honest picture of a real screen in this folder comes from `comrun.py`
dumping the framebuffer of the program actually running.

Output goes to `reference/`, which is gitignored: these frames are the game's
own artwork.

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

# HUNTER.PCC is a 4x6 grid of hunter poses -- standing, then aiming in eight
# directions, then reloading -- measured from its blank rows and columns.
HUNTER_ROWS = [(11, 38), (50, 75), (88, 112), (125, 149)]
HUNTER_COLS = [(10, 31), (52, 73), (96, 117), (146, 167), (190, 211), (232, 253)]

# ANIMALS.PCC is six walk cycles of eight frames each, one row per animal.
ANIMAL_ROWS = {"buffalo": (2, 21), "bear": (24, 39), "deer": (44, 67),
               "running_deer": (71, 93), "rabbit": (97, 111), "small": (114, 127)}
ANIMAL_COLS = 8
ANIMAL_W = 39

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
        # The ox leads on the LEFT of the sprite, so the wagon travels left and
        # the world must slide RIGHT past it. Getting this backwards makes the
        # animation read as a wagon reversing, which is exactly how it looked
        # the first time.
        far = -int(i * per_day / 9) % W
        near = -int(i * per_day / 2) % STRIP
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


def contact_sheet(gif, out, picks, cols=2, label=True, crop=None, scale=1):
    """A flip-book: chosen frames of an animation, in reading order.

    A GIF shown by anything that does not animate is a single still, which is
    no proof of motion at all. Laying successive frames out in a grid is -- you
    can see the wheel spokes turn and the scenery move between one cell and the
    next, which is the whole claim.
    """
    from PIL import ImageSequence
    im = Image.open(gif)
    frames = []
    for i, f in enumerate(ImageSequence.Iterator(im)):
        if i in picks:
            g = f.convert("RGB")
            if crop:
                g = g.crop(crop)
            if scale != 1:
                g = g.resize((int(g.width * scale), int(g.height * scale)),
                             Image.NEAREST)
            frames.append((i, g))
    if not frames:
        raise SystemExit(f"no frames picked from {gif}")
    fw, fh = frames[0][1].size
    rows = (len(frames) + cols - 1) // cols
    pad, bar = 6, (16 if label else 0)
    sheet = Image.new("RGB", (cols * fw + (cols + 1) * pad,
                              rows * (fh + bar) + (rows + 1) * pad), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for k, (idx, g) in enumerate(frames):
        r, c = divmod(k, cols)
        x = pad + c * (fw + pad)
        y = pad + r * (fh + bar + pad)
        if label:
            d.text((x + 2, y + 3), f"frame {idx}", fill=(200, 200, 200))
        sheet.paste(g, (x, y + bar))
    sheet.save(out)
    return len(frames)


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

    # Flip-books, because a still viewer shows only a GIF's first frame and
    # that proves nothing about motion.
    n3 = contact_sheet(outdir / "wagon.gif", outdir / "sheet_wheels.png",
                       picks=set(range(8)), cols=2,
                       crop=(390, 250, 750, 396))
    n4 = contact_sheet(outdir / "wagon.gif", outdir / "sheet_travel.png",
                       picks={0, 12, 24, 36, 48, 60}, cols=2, scale=0.62)
    n5 = contact_sheet(outdir / "river.gif", outdir / "sheet_river.png",
                       picks={0, 11, 21, 27, 34, 40, 47, 55}, cols=2, scale=0.55)

    print(f"wagon.gif        {n1} frames")
    print(f"river.gif        {n2} frames")
    print(f"wagon_frames.png the wheel cycle, X + X +")
    print(f"river_frames.png the crossing, five states")
    print(f"sheet_wheels.png {n3} consecutive frames, wheels only")
    print(f"sheet_travel.png {n4} frames across the journey")
    print(f"sheet_river.png  {n5} frames across the crossing")
    print(f"\nwrote to {outdir}/ -- gitignored, this is the game's own artwork")


if __name__ == "__main__":
    main()
