#!/usr/bin/env python3
"""
render-artwork.py -- Draw Zaxxon's artwork out of ZAXXON.COM without running it.

Nothing here is a screenshot. Every sprite, every tile, every wall section and
every object position is read out of the file, using formats taken from the
drawing routines themselves. The program is never executed.

Four pictures come out:

    sprites.png     the 34 objects the game can draw, in the format each
                    object's own drawing routine says it is stored in
    tiles.png       the 94 eight-by-eight tiles the backgrounds are built from
    sections.png    the seven compressed fortress sections, decompressed
    screen.png      a play-field frame composed from those three, with the
                    enemies placed by one of the game's own wave scripts

The fourth is the one that can be wrong in an interesting way, and the first
three are what make it checkable: if a sprite came out as noise you would see
it on the sheet rather than wonder about the screen.

    python tools/render-artwork.py --com original/ZAXXON.COM --out recovered

Needs Pillow. Nothing else -- no toolkit, no assembler, no emulator.
"""

import argparse
import struct
from pathlib import Path

# CGA mode 4, palette 1: the game sets it with INT 10h AH=0Bh, BX=0x0101 at
# file 0x0154. Colour 0 is the background, set to black by the call before it.
PALETTE = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]

# --- addresses, all read out of the code ------------------------------------
# A program address plus 0x100 is a file offset: the real code starts at file
# 0x100 with an address base of 0, because the entry stub far-returns there.
SPRITE_TABLE = 0x2613       # 34 x (graphics pointer, drawing routine)
SPRITE_COUNT = 34
TILE_TABLE = 0x1FDD         # word pointers to 8x8 tiles
TILE_COUNT = 94
WAVE_TABLE = 0x1518         # 8 wave scripts: (sprite type, lane) pairs
LANE_TABLE = 0x150E         # 5 entry positions, as (x, y) byte pairs
ALT_TABLE = 0x14FE          # per-type starting altitude, indexed from type 4
SECTION_TABLE = 0x3AAF      # four of the compressed sections
# Seven fortress sections and the boss, which is the same format: the routine
# at file 0x1B03 sets it up with `mov bx, 0x3d80 / call 0x0B8D`, so the robot
# is a compressed 192x144 picture like any wall. Each address here is either
# named by an instruction or is where the previous stream stopped.
SECTIONS = [0x399B, 0x3A07, 0x3A5F, 0x3AB7, 0x3BA3, 0x3C50, 0x3D22, 0x3D80]

# Each drawing routine fixes the shape of the sprites that select it. Read off
# the routines at file 0x0CF0 .. 0x0DE3: the row count is its loop counter, the
# width is its inner counter in words, and the mask offset is the displacement
# it adds to SI for the AND operand. `and` means no data at all -- the sprite
# is a hole punched in the picture, which is how the plane's shadow is drawn.
#
#   routine  rows  bytes/row  mask at  what it does
FORMATS = {
    0x0BF0: (24, 6, 0x90, "mask"),
    0x0C0F: (16, 4, None, "or"),
    0x0C2B: (16, 6, None, "or"),
    0x0C4E: (16, 4, 0x40, "mask"),
    0x0C77: (16, 6, 0x60, "mask"),
    0x0C99: (8, 2, None, "or"),
    0x0CAD: (8, 2, 0x08, "mask"),
    0x0CC7: (16, 6, None, "and"),
}

# Where each drawing routine puts the sprite relative to the object's own
# position: the `add di, N` it performs before its first row. 80 bytes is one
# scanline of the off-screen buffer.
PRE_OFFSET = {0x0BF0: 0, 0x0C0F: 0x140, 0x0C2B: 0x141, 0x0C4E: 0x141,
              0x0C77: 0x140, 0x0C99: 0x282, 0x0CAD: 0x282, 0x0CC7: 0x1E0}

# The off-screen buffer, from the code that reads and writes it.
STRIDE = 0x50               # bytes per row
ORIGIN = 0x18A              # buffer offset of object position (0, 0)
VISIBLE = 0x910             # first byte the flush at file 0x05BA copies
VIS_ROWS, VIS_BYTES = 176, 68
SCREEN_COL = 10             # ... to this byte column of the CGA framebuffer


def load(path):
    return Path(path).read_bytes()


class Rom:
    def __init__(self, data):
        self.d = data

    def f(self, addr):
        """A program address as a file offset."""
        return addr + 0x100

    def byte(self, addr):
        return self.d[self.f(addr)]

    def word(self, addr):
        return struct.unpack_from("<H", self.d, self.f(addr))[0]

    def bytes_at(self, addr, n):
        o = self.f(addr)
        return self.d[o:o + n]


def pixels(row_bytes):
    """CGA two-bits-per-pixel, most significant pair leftmost."""
    out = []
    for b in row_bytes:
        for k in range(4):
            out.append((b >> (6 - k * 2)) & 3)
    return out


def sprite_pixels(rom, gfx, fmt):
    """A sprite as (rows of colour index, rows of 'is this pixel drawn')."""
    rows, width, maskoff, mode = fmt
    colour, solid = [], []
    for r in range(rows):
        data = pixels(rom.bytes_at(gfx + r * width, width))
        if maskoff is None:
            keep = [True] * len(data)
            if mode == "and":
                # An AND-only sprite is a stencil: where its bits are zero the
                # picture is cleared. That is the plane's shadow.
                keep = [v != 3 for v in data]
                data = [0] * len(data)
        else:
            mask = pixels(rom.bytes_at(gfx + maskoff + r * width, width))
            keep = [m != 3 for m in mask]
        colour.append(data)
        solid.append(keep)
    return colour, solid


def sprite_table(rom):
    out = []
    for i in range(SPRITE_COUNT):
        gfx = rom.word(SPRITE_TABLE + i * 4)
        drw = rom.word(SPRITE_TABLE + i * 4 + 2)
        out.append((i, gfx, drw, FORMATS.get(drw)))
    return out


def tile_rows(rom, index):
    """One 8x8 tile: eight rows of two bytes, behind a word pointer."""
    ptr = rom.word(TILE_TABLE + index * 2)
    return [rom.bytes_at(ptr + r * 2, 2) for r in range(8)]


def decompress(rom, stream):
    """One fortress section: 18 rows of 24 tiles, into 48 bytes by 144 rows.

    The decompressor is at file 0x0B8D. Four byte values are commands and
    everything below them is a tile index:

        0xFC  end of the picture
        0xFD  count, tile -- that tile that many times
        0xFE  count       -- leave that many tiles untouched
        0xFF              -- leave the rest of the row untouched

    Written out this way it looks like any run-length encoder, and it is; what
    makes it cheap is that the unit is a tile rather than a byte, so one
    command covers 64 pixels.
    """
    buf = bytearray(18 * 0x180)
    p = rom.f(stream)
    for row in range(18):
        di, left = row * 0x180, 24
        while left > 0:
            cmd = rom.d[p]
            if cmd < 0xFC:
                p += 1
                run, idx = 1, cmd
            elif cmd == 0xFD:
                run, idx = rom.d[p + 1], rom.d[p + 2]
                p += 3
            elif cmd == 0xFE:
                di += 2 * rom.d[p + 1]
                left -= rom.d[p + 1]
                p += 2
                continue
            elif cmd == 0xFF:
                p += 1
                break
            else:
                return buf, p + 1
            for _ in range(run):
                for r, rb in enumerate(tile_rows(rom, idx)):
                    buf[di + r * 0x30: di + r * 0x30 + 2] = rb
                di += 2
                left -= 1
    return buf, p


# --- drawing ----------------------------------------------------------------

def new_buffer():
    """The game's off-screen buffer, one byte per four pixels."""
    return bytearray(0x18A + 0x64 * 0xA0 + 0x100)


def blit_section(buf, section, x, y, w=0x30, h=0x3C):
    """What file 0x0EB0 does: a clipped rectangle of the 48-byte-wide section.

    Worth following exactly, because the clipping is the interesting part. The
    play field is byte columns 6..0x4A and half-rows 0x0C..0x64, and those four
    numbers are all that stands between the wall and the score line. A section
    that is partly off the top is not skipped: the *source* pointer moves down
    instead, by 0x60 -- two of its 48-byte rows -- for every half-row of
    overlap, and the destination stays at the top of the field.
    """
    if y >= 0x64 or y + h <= 0x0C or x >= 0x4A or x + w <= 6:
        return False
    di, si = ORIGIN, 0
    if y < 0:
        rows = h + y
        si += -0x60 * y
    else:
        di += 0xA0 * y
        rows = min(h, 0x64 - y)
    if x < 0:
        width = w + x
        si += -x
    else:
        di += x
        width = min(w, 0x4A - x)
    for r in range(rows * 2):
        for c in range(width):
            o, s = di + r * STRIDE + c, si + r * 0x30 + c
            if 0 <= o < len(buf) and 0 <= s < len(section):
                buf[o] = section[s]
    return True


def blit_sprite(buf, colour, solid, pre, x, y):
    """What the routines at file 0x0CF0.. do: OR the data through the mask."""
    for r, (crow, srow) in enumerate(zip(colour, solid)):
        base = ORIGIN + y * 0xA0 + x + pre + r * STRIDE
        for i in range(len(crow)):
            off = base + i // 4
            if not 0 <= off < len(buf):
                continue
            shift = 6 - (i % 4) * 2
            if not srow[i]:
                continue
            buf[off] = (buf[off] & ~(3 << shift)) | (crow[i] << shift)


def to_image(buf, scale=3):
    from PIL import Image
    img = Image.new("RGB", (320, 200), (0, 0, 0))
    px = img.load()
    for row in range(VIS_ROWS):
        for b in range(VIS_BYTES):
            v = buf[VISIBLE + row * STRIDE + b]
            for k in range(4):
                px[(SCREEN_COL + b) * 4 + k, row] = PALETTE[(v >> (6 - k * 2)) & 3]
    return img.resize((320 * scale, 200 * scale), Image.NEAREST)


# --- the four pictures ------------------------------------------------------

def draw_sprites(rom, path):
    from PIL import Image, ImageDraw
    cell, scale = 116, 3
    cols = 9
    rows = (SPRITE_COUNT + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * cell), (14, 14, 20))
    d = ImageDraw.Draw(sheet)
    for i, gfx, drw, fmt in sprite_table(rom):
        cx, cy = (i % cols) * cell + 4, (i // cols) * cell + 18
        if fmt is None:
            d.text((cx, cy - 13), f"{i}: unknown {drw:#06x}", fill=(230, 90, 90))
            continue
        colour, solid = sprite_pixels(rom, gfx, fmt)
        h, w = len(colour), len(colour[0])
        im = Image.new("RGB", (w, h), (34, 34, 44))
        px = im.load()
        for y in range(h):
            for x in range(w):
                if solid[y][x]:
                    px[x, y] = PALETTE[colour[y][x]]
        im = im.resize((w * scale, h * scale), Image.NEAREST)
        sheet.paste(im, (cx, cy))
        d.text((cx, cy - 13), f"{i}  {gfx:#06x}  {fmt[3]}", fill=(150, 158, 190))
    sheet.save(path)
    return SPRITE_COUNT


def draw_tiles(rom, path):
    from PIL import Image, ImageDraw
    scale, cols, cell = 4, 16, 8 * 4 + 10
    rows = (TILE_COUNT + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 8)), (14, 14, 20))
    d = ImageDraw.Draw(sheet)
    px = sheet.load()
    for i in range(TILE_COUNT):
        cx, cy = (i % cols) * cell + 3, (i // cols) * (cell + 8) + 12
        for r, rb in enumerate(tile_rows(rom, i)):
            for x, v in enumerate(pixels(rb)):
                for sy in range(scale):
                    for sx in range(scale):
                        px[cx + x * scale + sx, cy + r * scale + sy] = PALETTE[v]
        d.text((cx, cy - 11), f"{i:02X}", fill=(150, 158, 190))
    sheet.save(path)
    return TILE_COUNT


def draw_sections(rom, path):
    from PIL import Image, ImageDraw
    scale = 2
    panels = []
    for addr in SECTIONS:
        buf, end = decompress(rom, addr)
        im = Image.new("RGB", (192, 144), (0, 0, 0))
        px = im.load()
        for r in range(144):
            for b in range(48):
                v = buf[r * 0x30 + b]
                for k in range(4):
                    px[b * 4 + k, r] = PALETTE[(v >> (6 - k * 2)) & 3]
        panels.append((addr, end - rom.f(addr),
                       im.resize((192 * scale, 144 * scale), Image.NEAREST)))
    w = panels[0][2].width + 8
    out = Image.new("RGB", (w * len(panels), panels[0][2].height + 22),
                    (12, 12, 18))
    d = ImageDraw.Draw(out)
    for i, (addr, size, im) in enumerate(panels):
        out.paste(im, (i * w + 4, 18))
        d.text((i * w + 4, 4), f"{addr:#06x}  {size} bytes -> 27,648 pixels",
               fill=(190, 198, 226))
    out.save(path)
    return len(panels)


def draw_screen(rom, path, wave=0, section=0x3AB7, approach=52,
                plane_x=0x14, plane_y=0x30):
    """A play-field frame: a wall section, a wave of enemies, and the plane.

    None of the positions are invented, and it is worth saying where each one
    comes from, because a picture is the easiest thing in this repository to
    make look right and be wrong.

    * The wall enters at byte column 0x4A -- just past the right edge -- 36
      half-rows above the field, 48 bytes wide and 60 half-rows tall. That is
      the eight-byte record at cs:0x0AEA, copied to [0x70] by the code at file
      0x0C28. Each frame the routine at file 0x08FC does `dec [0x70]` and
      `inc [0x72]`: one byte left and one half-row down, which in this
      projection is straight towards the player. `wall` is how far along that
      approach to draw it.

    * `wave` selects one of the eight enemy scripts at cs:0x1518. Each is a
      list of (sprite type, lane) pairs; the lane indexes the five entry
      positions at cs:0x150E, all of which are byte column 0x4A at five
      different heights; the starting altitude comes from the table at
      cs:0x14FE, which is indexed from type 4 rather than 0 because types 0..3
      are the player's own plane and never spawn.

    * Every object then drifts by the velocity at cs:0x0FF5 for its direction
      byte, which for a freshly spawned object is direction 0: (-1, +1), one
      byte column left and one half-row down per frame -- the same approach the
      wall makes. So a wave is drawn by ageing each entry a few frames more
      than the one before it, which is what spreads it along the diagonal.

    The frame is composed rather than captured: the game feeds a wave in over
    time as object slots come free, so it would not show all of one at once.
    Every position in it is one the game would produce.
    """
    from PIL import Image, ImageDraw
    buf = new_buffer()

    sect, _ = decompress(rom, section)
    drawn_wall = blit_section(buf, sect, 0x4A - approach, -0x24 + approach)

    table = sprite_table(rom)

    def put(kind, x, y):
        _, gfx, drw, fmt = table[kind]
        if fmt is None:
            return False
        colour, solid = sprite_pixels(rom, gfx, fmt)
        blit_sprite(buf, colour, solid, PRE_OFFSET.get(drw, 0), x, y)
        return True

    placed = attempted = 0
    stream = rom.f(rom.word(WAVE_TABLE + wave * 2))
    step = 0
    while rom.d[stream] != 0xFF and step < 24:
        kind, lane = rom.d[stream], rom.d[stream + 1]
        stream += 2
        x = rom.byte(LANE_TABLE + lane * 2)
        y = rom.byte(LANE_TABLE + lane * 2 + 1)
        age = 8 + step * 5              # frames of drift, oldest first
        x, y = x - age, y + age
        step += 1
        if not (6 <= x < 0x4A and 0x0C <= y < 0x64):
            continue                    # the game would have retired it
        attempted += 1
        if put(kind, x, y):
            placed += 1

    # The plane, and its shadow on the floor below it. Sprite 16 is the only
    # AND-only sprite in the file, which is what makes it the shadow: it clears
    # the picture rather than adding to it.
    put(16, plane_x, plane_y + 0x14)
    put(0, plane_x, plane_y)

    img = to_image(buf)
    panel = Image.new("RGB", (img.width, img.height + 46), (10, 10, 14))
    panel.paste(img, (0, 46))
    d = ImageDraw.Draw(panel)
    d.text((10, 8), "Zaxxon - a play field composed from the file alone",
           fill=(255, 233, 168))
    d.text((10, 26), f"wave script {wave} at cs:{rom.word(WAVE_TABLE + wave * 2):#06x}: "
                     f"{placed}/{attempted} objects placed; wall section "
                     f"{section:#06x} {'drawn' if drawn_wall else 'clipped away'}. "
                     f"Never executed.", fill=(150, 155, 180))
    panel.save(path)
    return placed, attempted


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--com", default="original/ZAXXON.COM")
    ap.add_argument("--out", default="recovered")
    ap.add_argument("--wave", type=int, default=0)
    args = ap.parse_args()

    rom = Rom(load(args.com))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    n = draw_sprites(rom, out / "sprites.png")
    print(f"sprites.png   {n} sprites, 8 storage formats")
    n = draw_tiles(rom, out / "tiles.png")
    print(f"tiles.png     {n} tiles of 8x8")
    n = draw_sections(rom, out / "sections.png")
    print(f"sections.png  {n} compressed fortress sections")
    placed, attempted = draw_screen(rom, out / "screen.png", wave=args.wave)
    print(f"screen.png    {placed}/{attempted} objects placed from wave "
          f"script {args.wave}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
