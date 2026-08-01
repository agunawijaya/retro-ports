"""Generate a Mt Fuji outdoor background in the same CGA-like palette as the
DOS Karateka backgrounds (black sky, white moon/snow, cyan-blue mountain).
The result is then greyscaled into bg_fuji.png — used for the OUTDOOR scene
during gameplay. The castle image (bg_outdoor.png) is reserved for the title
screen.
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets")

W, H = 280, 192
GROUND_Y = H - 22   # match karateka.js GROUND_Y

SKY    = (0, 0, 0)
MOON   = (255, 255, 255)
HILL   = (0, 124, 255)     # same blue as akuma_castle.png
SNOW   = (255, 255, 255)

GREYS = [0, 0x55, 0xAA, 0xFF]
def quantize_grey(v):
    if v < 43:  return GREYS[0]
    if v < 128: return GREYS[1]
    if v < 213: return GREYS[2]
    return GREYS[3]

def main():
    im = Image.new("RGB", (W, H), SKY)
    d  = ImageDraw.Draw(im)

    # Matches the layout in screenshots/just_landed.png:
    #   - Sky fills the upper half (cyan in source, mapped to mid-grey).
    #   - A horizon/fence line just above GROUND_Y separates sky from land.
    #   - Mt Fuji is SMALL and DISTANT — a snow-capped peak in upper-middle,
    #     not a dominant silhouette. Width ~46px, visible height ~30px above
    #     horizon (just the upper tip pokes above the fence line).
    #   - No moon — that belongs to the castle/title screen, not the gameplay
    #     outdoor scene.

    HORIZON_Y = GROUND_Y - 4
    FENCE_Y   = HORIZON_Y - 18

    # Distant Fuji — small, centered slightly right of canvas center
    fx     = 150
    peakY  = FENCE_Y - 30
    leftX  = fx - 28
    rightX = fx + 28
    d.polygon([(leftX, FENCE_Y), (fx, peakY), (rightX, FENCE_Y)], fill=HILL)

    # Snowcap — covers most of the visible upper peak (distance makes the
    # snowline look thick relative to the visible mountain).
    cap_pts = [
        (fx,         peakY),
        (fx - 4,     peakY + 8),
        (fx - 10,    peakY + 14),
        (fx - 6,     peakY + 18),
        (fx,         peakY + 14),
        (fx + 6,     peakY + 18),
        (fx + 10,    peakY + 14),
        (fx + 4,     peakY + 8),
    ]
    d.polygon(cap_pts, fill=SNOW)

    # Horizon fence line — the dark band in the screenshot above the ground.
    # In the original it's a thin black fence with posts; here a single line
    # reads cleanly after greyscale.
    d.line([(0, FENCE_Y), (W, FENCE_Y)], fill=HILL, width=1)

    # Save the colored CGA-style original
    im.save(os.path.join(OUT, "bg_fuji_color.png"))

    # Greyscale + quantize to 4 tones, matching greyscale_bgs.py
    g = Image.new("RGB", (W, H))
    src = im.load(); dst = g.load()
    for y in range(H):
        for x in range(W):
            r, gC, b = src[x, y]
            lum = int(0.299 * r + 0.587 * gC + 0.114 * b)
            v = quantize_grey(lum)
            dst[x, y] = (v, v, v)
    g.save(os.path.join(OUT, "bg_fuji.png"))
    print("wrote bg_fuji.png + bg_fuji_color.png")


if __name__ == "__main__":
    main()
