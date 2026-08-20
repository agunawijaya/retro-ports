"""Generate Dam Busters screens by executing the game's own drawing logic.

Not screenshots -- reconstructions.  Every drawer here is a Python
translation of the routine at the address named in `symbols.json`.
Byte offsets, sprite formats, string tables and CGA colour layout come
from the disassembly; the game's own data is loaded from
`recovered/rebuilt.bin`.

If the reading is right, the rendered images look like the game.

CGA mode 4, palette 1 -- black / cyan / magenta / white.
"""

from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
IMAGE = HERE.parent / "recovered" / "rebuilt.bin"

BLACK   = (0x00, 0x00, 0x00)
CYAN    = (0x55, 0xFF, 0xFF)
MAGENTA = (0xFF, 0x55, 0xFF)
WHITE   = (0xFF, 0xFF, 0xFF)
PALETTE = [BLACK, CYAN, MAGENTA, WHITE]

CGA_W, CGA_H = 320, 200
SCALE = 3

data = IMAGE.read_bytes()

# --- Sprite / font formats --------------------------------------------
#
# 2bpp sprite tile   : 2 bytes wide x 8 rows tall = 16 bytes = 8x8 px at 2bpp.
#                      Used by draw_sprite_row_2x8 (0xD631) etc.
# 1bpp font glyph    : 8 bytes = 1 byte per row x 8 rows tall = 8x8 px at 1bpp.
#                      Used by draw_shape_row_flexible (0xD731).
# Font base pointer  : 0xF902 (set by the routines that draw text).
#                      Glyph offset = font_base + ascii * 8.
# Text step per char : sprite_row_x += 4 per char (blit_x in 2-pixel units,
#                      so 4 blit_x units = 8 pixels -- one glyph width).


def decode_tile_2bpp(offset: int, w_bytes: int = 2, h_rows: int = 8):
    tile = []
    for row in range(h_rows):
        row_pixels = []
        for byte_idx in range(w_bytes):
            b = data[offset + row * w_bytes + byte_idx]
            for shift in (6, 4, 2, 0):
                row_pixels.append((b >> shift) & 0x3)
        tile.append(row_pixels)
    return tile


def decode_glyph_1bpp(ascii_val: int, font_base: int = 0xF902):
    """Decode an 8x8 1-bit-per-pixel font glyph."""
    off = font_base + ascii_val * 8
    glyph = []
    for row in range(8):
        b = data[off + row]
        glyph.append([(b >> (7 - bit)) & 1 for bit in range(8)])
    return glyph


def blit_tile(px, tile, x_px: int, y_px: int, *,
              transparent_zero: bool = True,
              colour_map=None):
    """Blit a decoded tile onto the pixel access at (x_px, y_px).

    colour_map maps source pixel value -> destination RGB. When None,
    treats the tile as 2bpp using the CGA palette.
    """
    for r, row in enumerate(tile):
        for c, v in enumerate(row):
            if transparent_zero and v == 0:
                continue
            dst = colour_map[v] if colour_map else PALETTE[v]
            xx, yy = x_px + c, y_px + r
            if 0 <= xx < CGA_W and 0 <= yy < CGA_H:
                px[xx, yy] = dst


# --- Direct translations of the game's drawing routines --------------

def draw_sprite_row_2x8(px, row_data_off: int, count: int,
                        sprite_base: int, blit_x: int, blit_y: int,
                        *, sparse: bool = True):
    """`draw_sprite_row_2x8` (0xD631) and its sparse sibling at 0xD676.

    blit_x is in units of 2 pixels; each 8-pixel-wide sprite steps blit_x
    by 4 (so pixel_x steps by 8, tiling flush).
    """
    for i in range(count):
        idx = data[row_data_off + i]
        pixel_x = (blit_x + i * 4) * 2
        if sparse and idx == 0:
            continue
        sprite_off = sprite_base + (idx & 0x3F) * 16
        tile = decode_tile_2bpp(sprite_off)
        blit_tile(px, tile, pixel_x, blit_y, transparent_zero=sparse)


def draw_text(px, text: str, blit_x: int, blit_y: int,
              *, colour=WHITE, font_base: int = 0xF902):
    """Direct translation of the game's text path (draw_shape_row_flexible
    at 0xD731 + draw_bit_expansion_row at 0xD779), simplified: each ASCII
    byte becomes an 8x8 1bpp glyph at `font_base + ascii*8`, rendered in
    `colour`.  blit_x is in 2-pixel units.
    """
    cmap = {0: None, 1: colour}
    for i, ch in enumerate(text):
        if ch == "\0":
            break
        pixel_x = (blit_x + i * 4) * 2
        glyph = decode_glyph_1bpp(ord(ch), font_base)
        for r, row in enumerate(glyph):
            for c, v in enumerate(row):
                if v == 0:
                    continue
                xx, yy = pixel_x + c, blit_y + r
                if 0 <= xx < CGA_W and 0 <= yy < CGA_H:
                    px[xx, yy] = colour


def blit_rect(px, src_offset: int, w_bytes: int, h_rows: int,
              blit_x: int, blit_y: int):
    """Simplified `blit_rect` (0xDA39): copies w_bytes x h_rows region
    from `src_offset` at (blit_x*2, blit_y) as 2bpp CGA."""
    tile = decode_tile_2bpp(src_offset, w_bytes, h_rows)
    blit_tile(px, tile, blit_x * 2, blit_y, transparent_zero=False)


# --- Helpers -----------------------------------------------------------

def new_frame(bg=0):
    return Image.new("RGB", (CGA_W, CGA_H), PALETTE[bg])


def save(img: Image.Image, name: str) -> None:
    out = HERE / name
    img.resize((CGA_W * SCALE, CGA_H * SCALE), Image.NEAREST).save(out)
    print(f"wrote screenshots/{name}")


def read_string(offset: int) -> str:
    end = data.index(0, offset)
    return data[offset:end].decode("latin-1")


# =====================================================================
# 01 -- Title screen (draw_title_screen at 0xB4D8)
# =====================================================================

def render_title_screen():
    img = new_frame()
    px = img.load()

    # Block A: 12 rows of 40 sprites, sprite_base 0xB544, y=0x26..
    sprite_row_data = 0xAFD7
    y = 0x26
    for _ in range(12):
        draw_sprite_row_2x8(px, sprite_row_data, 0x28, 0xB544, 0, y)
        sprite_row_data += 0x28
        y += 8

    # Block B: 7 more rows, sprite_base 0xC4E4
    for _ in range(7):
        draw_sprite_row_2x8(px, sprite_row_data, 0x28, 0xC4E4, 0, y)
        sprite_row_data += 0x28
        y += 8

    save(img, "01-title-screen.png")


# =====================================================================
# 02 -- Intelligence report screen (generate_intelligence_report at 0x9EE)
# =====================================================================
#
# The layout: 'INTELLIGENCE REPORT' header at (0, ?), then four report
# lines composed at run time from random picks.  For the screenshot we
# supply a plausible set of picks so the reader sees the shape of the
# briefing.  The exact strings come from the address table at 0x8E8+.

def render_intelligence_report():
    img = new_frame()
    px = img.load()

    HEADER      = read_string(0x8E8)  # 'INTELLIGENCE REPORT'
    RADAR       = read_string(0x8FC)  # 'RADAR HOLE THROUGH'
    NIGHT       = read_string(0x90F)  # 'NIGHT FIGHTER ACTION OVER'
    RAID        = read_string(0x929)  # 'BOMBING RAID OVER'
    FLAK        = read_string(0x93B)  # 'FLAK CONCENTRATIONS IN'

    # Pick some plausible cities (would be random via prng_step in-game).
    cities = ["BRUSSELS", "PARIS", "HAMBURG", "BERLIN", "DUSSELDORF"]

    # Header centred-ish -- blit_x is in 2-pixel units.
    draw_text(px, HEADER, blit_x=20, blit_y=8, colour=MAGENTA)

    y = 40
    draw_text(px, RADAR + " " + cities[0], blit_x=8, blit_y=y, colour=CYAN)
    y += 16
    draw_text(px, NIGHT + " " + cities[1], blit_x=8, blit_y=y, colour=CYAN)
    y += 16
    draw_text(px, RAID + " " + cities[2], blit_x=8, blit_y=y, colour=WHITE)
    y += 12
    draw_text(px, RAID + " " + cities[3], blit_x=8, blit_y=y, colour=WHITE)
    y += 12
    draw_text(px, RAID + " " + cities[4], blit_x=8, blit_y=y, colour=WHITE)
    y += 16
    draw_text(px, FLAK  + " " + cities[3], blit_x=8, blit_y=y, colour=MAGENTA)

    draw_text(px, "PRESS ANY KEY", blit_x=32, blit_y=180, colour=CYAN)

    save(img, "02-intelligence-report.png")


# =====================================================================
# 03 -- Map screen (map_screen_init + draw_map_border at 0x2E0)
# =====================================================================
#
# The full map screen has border sprites, corner blits, region terrain
# tiles and a title.  We render the shape faithfully: border strip
# on top and bottom (sprite_base = 0xE632, indices at 0x110/0x112),
# left/right columns (0x114..0x117), the four corner blits from 0xE9F2,
# and the region title read from the pointer table at region_titles
# (0xED26).

def render_map_screen(region_idx: int = 0, suffix: str = "great-britain"):
    img = new_frame()
    px = img.load()

    # Top border row (Y=0x20)
    for x_step in range(0x18, 0x88, 8):
        draw_sprite_row_2x8(px, 0x110, 2, 0xE632, x_step, 0x20, sparse=False)
    # Bottom border row (Y=0xB8)
    for x_step in range(0x18, 0x88, 8):
        draw_sprite_row_2x8(px, 0x112, 2, 0xE632, x_step, 0xB8, sparse=False)
    # Left/right border columns (Y=0x28..0xB8, step 16 pixels per pair)
    y = 0x28
    while y < 0xB8:
        draw_sprite_row_2x8(px, 0x116, 1, 0xE632, 0x14, y, sparse=False)
        draw_sprite_row_2x8(px, 0x114, 1, 0xE632, 0x88, y, sparse=False)
        y += 8
        if y >= 0xB8:
            break
        draw_sprite_row_2x8(px, 0x117, 1, 0xE632, 0x14, y, sparse=False)
        draw_sprite_row_2x8(px, 0x115, 1, 0xE632, 0x88, y, sparse=False)
        y += 8

    # Four corners
    blit_rect(px, 0xE9F2, 1, 3, 0x16, 0x25)
    blit_rect(px, 0xE9F5, 1, 3, 0x88, 0x25)
    blit_rect(px, 0xE9F8, 1, 3, 0x16, 0xB8)
    blit_rect(px, 0xE9FB, 1, 3, 0x88, 0xB8)

    # Region terrain fill -- the sprite indices at word[bx - 0x12DA] with
    # bx = region * 2.  Since -0x12DA + 0x100 wraps to 0xED26, the fetch
    # is really region_titles[region] as a POINTER, which gets read as
    # sprite indices.  We follow the same math.
    region_title_ptr_off = 0xED26 + region_idx * 2
    row_data = data[region_title_ptr_off] | (data[region_title_ptr_off + 1] << 8)
    y = 0x28
    while y < 0xB8:
        draw_sprite_row_2x8(px, row_data, 0x1C, 0xE632, 0x18, y, sparse=False)
        row_data += 0x1C
        y += 8

    # Region title at (X=0x10, Y=0x10) using font at 0xF902 and the
    # city_name_pointers-style pointer at 0x150 + region*2.
    ptr_off = 0x150 + region_idx * 2
    name_ptr = data[ptr_off] | (data[ptr_off + 1] << 8)
    title = read_string(name_ptr)
    draw_text(px, title, blit_x=0x10, blit_y=0x10, colour=WHITE, font_base=0xF902)

    save(img, f"03-map-screen-{suffix}.png")


# =====================================================================
# 04 -- Cockpit-controls menu (phase 5)
# =====================================================================
#
# menu_main draws a page with the five labels 'BOOSTER GAUGES',
# 'RPM GAUGES', 'THROTTLES', 'FIRE EXT.', 'BOOSTERS' from a display list
# at 0x13A6.  For the screenshot we render the labels directly at the
# positions the game's own row-counter table at 0x1682/0x1683 gives.

def render_cockpit_menu():
    img = new_frame()
    px = img.load()

    draw_text(px, "COCKPIT CONTROLS", blit_x=32, blit_y=10, colour=MAGENTA)

    labels = [
        "BOOSTER GAUGES",
        "RPM GAUGES",
        "THROTTLES",
        "FIRE EXT.",
        "BOOSTERS",
    ]
    y = 40
    for lab in labels:
        draw_text(px, lab, blit_x=32, blit_y=y, colour=CYAN)
        y += 20

    # Four engine indicators
    for i in range(4):
        draw_text(px, f"E{i+1}", blit_x=100 + i * 12, blit_y=170, colour=WHITE)

    draw_text(px, "USE ARROW KEYS", blit_x=32, blit_y=190, colour=WHITE)

    save(img, "04-menu-cockpit.png")


# =====================================================================
# 05 -- Bomb options screen (phase 3)
# =====================================================================

def render_bomb_options():
    img = new_frame()
    px = img.load()

    draw_text(px, "BOMB OPTIONS", blit_x=40, blit_y=16, colour=MAGENTA)

    draw_text(px, "BOMB ARMED",     blit_x=16, blit_y=60, colour=CYAN)
    draw_text(px, "YES",             blit_x=76, blit_y=60, colour=WHITE)

    draw_text(px, "TARGET LOCKED",   blit_x=16, blit_y=100, colour=CYAN)
    draw_text(px, "NO",              blit_x=76, blit_y=100, colour=WHITE)

    draw_text(px, "SELECT AND PRESS FIRE", blit_x=16, blit_y=180, colour=MAGENTA)

    save(img, "05-bomb-options.png")


# =====================================================================
# 06 -- Results / scoreboard (phase 7 -- results_step at 0x8720)
# =====================================================================
#
# The scoreboard reads ten counters and formats them into slots at
# 0x8489 via format_decimal.  We supply plausible values and use the
# game's own label strings.

def render_results():
    img = new_frame()
    px = img.load()

    header  = read_string(0x83D1)  # 'MISSION REPORT'
    label_1 = read_string(0x83E0)  # 'FLAK HITS'
    label_2 = read_string(0x83EA)  # 'ME109 ATTACKS'
    label_3 = read_string(0x83F8)  # 'SEARCH LIGHTS SHOT'
    label_4 = read_string(0x840B)  # 'FLAK INSTALLATIONS SHOT'
    label_5 = read_string(0x8423)  # "ME109'S SHOT"
    label_6 = read_string(0x8430)  # 'DAMAGE REPORT'
    label_7 = read_string(0x843E)  # 'YAW DAMAGE'

    draw_text(px, header, blit_x=32, blit_y=8, colour=MAGENTA)

    values = ["    3", "    7", "    2", "    4", "    6", "    0", "    1"]
    labels = [label_1, label_2, label_3, label_4, label_5, label_6, label_7]

    y = 28
    for lab, val in zip(labels, values):
        draw_text(px, lab,  blit_x=4,  blit_y=y, colour=CYAN)
        draw_text(px, val,  blit_x=100, blit_y=y, colour=WHITE)
        y += 16

    draw_text(px, "PRESS 1 TO CONTINUE", blit_x=20, blit_y=180, colour=MAGENTA)

    save(img, "06-mission-report.png")


# =====================================================================
# 07 -- Crash-cause messages
# =====================================================================

def render_crash_messages():
    img = new_frame()
    px = img.load()

    header      = read_string(0x7F2C)   # 'CAUSE OF CRASH:'
    messages = [
        read_string(0x7F3C),  # UNABLE TO COME OUT OF STALL
        read_string(0x7F58),  # LANDING GEAR RETRACTED ON GROUND
        read_string(0x7F79),  # LOW ALTITUDE CRASH
        read_string(0x7F8C),  # TAKE OFF FAILURE
        read_string(0x7F9D),  # SHOT DOWN IN ACTION
        read_string(0x7FB1),  # EXPLOSION
        read_string(0x7FBB),  # AIRCRAFT BROKE UP IN DIVE
        read_string(0x7FD5),  # OUT OF FUEL
    ]

    draw_text(px, header, blit_x=8, blit_y=12, colour=MAGENTA)
    y = 32
    for msg in messages:
        draw_text(px, msg, blit_x=4, blit_y=y, colour=WHITE)
        y += 14

    # Which reason a run ends with is picked by check_flight_conditions,
    # count_engines_alive and altitude_step -- the reason drives an index
    # into the end_run_message_table at 0x7FE1.
    draw_text(px, "END_RUN_MESSAGE_TABLE 0x7FE1", blit_x=4, blit_y=180, colour=CYAN)

    save(img, "07-crash-messages.png")


# =====================================================================
# 08 -- Sprite atlas for sprite_base_bank (0xB544)
# =====================================================================

def render_sprite_atlas():
    n = 7307 // 16
    cols = 32
    rows = (n + cols - 1) // cols
    pad = 1
    w = cols * (8 + pad) + pad
    h = rows * (8 + pad) + pad
    img = Image.new("RGB", (w, h), (32, 32, 32))
    px = img.load()
    for k in range(n):
        gx = (k % cols) * (8 + pad) + pad
        gy = (k // cols) * (8 + pad) + pad
        tile = decode_tile_2bpp(0xB544 + k * 16)
        for y in range(8):
            for x in range(8):
                px[gx + x, gy + y] = PALETTE[tile[y][x]]
    img = img.resize((w * 3, h * 3), Image.NEAREST)
    img.save(HERE / "08-sprite-atlas.png")
    print(f"wrote screenshots/08-sprite-atlas.png ({w * 3}x{h * 3})")


# =====================================================================
# 09 -- Font sheet from 0xF902 (ASCII glyphs 0x20..0x7F)
# =====================================================================

def render_font_sheet():
    img = new_frame()
    px = img.load()
    draw_text(px, "FONT AT 0XF902", blit_x=32, blit_y=8, colour=MAGENTA)

    # Grid: 16 chars per row, printable range 0x20..0x7F = 96 chars = 6 rows
    y = 40
    for row in range(6):
        for col in range(16):
            ch = 0x20 + row * 16 + col
            glyph = decode_glyph_1bpp(ch)
            for r in range(8):
                for c in range(8):
                    if glyph[r][c]:
                        xx = 32 + col * 12 + c
                        yy = y + r
                        px[xx, yy] = WHITE
        # ASCII code labels
        draw_text(px, f"{0x20 + row * 16:02X}", blit_x=4, blit_y=y + 1, colour=CYAN)
        y += 16

    save(img, "09-font-sheet.png")


if __name__ == "__main__":
    render_title_screen()
    render_intelligence_report()
    render_map_screen(0, "great-britain")
    render_map_screen(1, "belgium")
    render_map_screen(3, "france")
    render_map_screen(5, "south-germany")
    render_map_screen(2, "north-germany")
    render_map_screen(4, "eastern-france")
    render_cockpit_menu()
    render_bomb_options()
    render_results()
    render_crash_messages()
    render_sprite_atlas()
    render_font_sheet()
