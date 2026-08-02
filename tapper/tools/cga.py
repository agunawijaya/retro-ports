"""CGA framebuffer decoding helpers.

A CGA graphics page is 16384 bytes with the two scanline banks interleaved:
even rows live at 0x0000, odd rows at 0x2000, 80 bytes per row in both modes.
"""

# Palette 1 high intensity (cyan/magenta/white) -- Tapper's usual look.
PAL1_HI = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]
# Palette 0 high intensity (green/red/yellow).
PAL0_HI = [(0, 0, 0), (85, 255, 85), (255, 85, 85), (255, 255, 85)]
MONO = [(0, 0, 0), (255, 255, 255)]

BANK = 0x2000
ROW_BYTES = 80


def row_offset(y):
    """File offset of scanline y in an interleaved CGA page."""
    return (y & 1) * BANK + (y >> 1) * ROW_BYTES


def decode_2bpp(data, height=200, palette=PAL1_HI):
    """320x200 4-colour mode. Returns a list of RGB rows."""
    rows = []
    for y in range(height):
        base = row_offset(y)
        row = []
        for x in range(ROW_BYTES):
            b = data[base + x]
            for shift in (6, 4, 2, 0):
                row.append(palette[(b >> shift) & 3])
        rows.append(row)
    return rows


def decode_1bpp(data, height=200, palette=MONO):
    """640x200 2-colour mode. Returns a list of RGB rows."""
    rows = []
    for y in range(height):
        base = row_offset(y)
        row = []
        for x in range(ROW_BYTES):
            b = data[base + x]
            for shift in range(7, -1, -1):
                row.append(palette[(b >> shift) & 1])
        rows.append(row)
    return rows


def save_png(rows, path, scale=1):
    from PIL import Image

    h = len(rows)
    w = len(rows[0])
    img = Image.new("RGB", (w, h))
    img.putdata([px for row in rows for px in row])
    if scale != 1:
        img = img.resize((w * scale, h * scale), Image.NEAREST)
    img.save(path)
    return w, h
