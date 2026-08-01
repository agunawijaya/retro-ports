"""Scan an Apple II .dsk for HGR-like 8KB regions and render them as PNG.

Apple II HGR (high-resolution graphics) format:
    280 x 192 pixels, 1 bit per pixel + 1 palette bit per byte
    Frame buffer = 8192 bytes ($2000-$3FFF or $4000-$5FFF)
    192 scanlines × 40 bytes/line = 7680 used + 512 unused/padding

    Scanline layout is INTERLEAVED — line N's byte offset is:
        offset(N) = (N // 64) * 40 + ((N // 8) % 8) * 0x80 + (N % 8) * 0x400
    (This is the standard Woz-machine HGR triple-interleave.)

    Each visible byte encodes 7 pixels:
        bit 7 = palette select (0 = purple/green, 1 = blue/orange)
        bits 0-6 = pixel bits, LSB = leftmost pixel
    NTSC color artifacting gives 4 colours per palette pair:
        palette 0:  green / purple, alternating odd/even columns
        palette 1:  orange / blue, alternating odd/even columns
        plus black (00 pair) and white (11 pair)

Since Karateka's disk is copy-protected (non-standard DOS layout), we
can't parse it as a filesystem.  But HGR image data has very recognisable
features:
  - blocks of ~7680-8192 bytes that, when interpreted with the
    interleave table, produce coherent images
  - lots of byte values < 128 (purple palette) or >= 128 (blue palette),
    mixed but not random

This script slides an 8KB window across the disk, decodes each candidate
as an HGR page, scores it on "non-randomness", and saves the most
promising ones.
"""

import sys
from pathlib import Path
from PIL import Image

HGR_WIDTH = 280
HGR_HEIGHT = 192
HGR_BYTES = 8192

# Apple II HGR colour table (the standard 6 colours).  Index = (palette_bit, pair_value):
#   pair 00 = black, pair 11 = white, regardless of palette
#   pair 01 = green (palette 0)  or  orange (palette 1)   on EVEN columns
#   pair 10 = purple (palette 0) or  blue   (palette 1)   on EVEN columns
# (On odd columns the 01/10 colours swap, because of NTSC chroma alignment.)
COLOURS = {
    "black":  (0, 0, 0),
    "white":  (255, 255, 255),
    "green":  ( 32, 192,  64),
    "purple": (192,  64, 192),
    "orange": (224, 128,  32),
    "blue":   ( 32,  64, 224),
}


def hgr_line_offset(y: int) -> int:
    """Compute the byte offset within an HGR page for scanline y."""
    # Apple II HGR triple-interleave:
    #   offset = (y % 8) * 0x400 + ((y // 8) % 8) * 0x80 + (y // 64) * 0x28
    return (y % 8) * 0x400 + ((y // 8) % 8) * 0x80 + (y // 64) * 0x28


def decode_hgr_page(page: bytes) -> Image.Image:
    """Decode an 8 KB HGR page to a 280×192 RGB image."""
    img = Image.new("RGB", (HGR_WIDTH, HGR_HEIGHT), (0, 0, 0))
    px = img.load()
    for y in range(HGR_HEIGHT):
        row_off = hgr_line_offset(y)
        # Build a 280-pixel-wide list of bits with palette per group of 7
        for col in range(40):
            b = page[row_off + col]
            palette_bit = (b >> 7) & 1
            bits = [(b >> i) & 1 for i in range(7)]    # bit 0 = leftmost pixel
            x_base = col * 7
            for bi in range(7):
                x = x_base + bi
                if x >= HGR_WIDTH: break
                bit = bits[bi]
                # Pair this bit with its neighbour for colour artifacting.
                # Even column index: this bit is the "left" of a pair; look right.
                # Odd column: look left.
                if (x & 1) == 0 and (x + 1) < HGR_WIDTH:
                    # Get neighbour bit
                    nb_col = (x + 1) // 7
                    nb_bi  = (x + 1) % 7
                    if nb_col < 40:
                        nb_byte = page[row_off + nb_col]
                        nb_bit  = (nb_byte >> nb_bi) & 1
                    else:
                        nb_bit = 0
                    pair = bit | (nb_bit << 1)
                else:
                    # Odd column: pair with the previous
                    pb_col = (x - 1) // 7
                    pb_bi  = (x - 1) % 7
                    pb_byte = page[row_off + pb_col]
                    pb_bit  = (pb_byte >> pb_bi) & 1
                    pair = pb_bit | (bit << 1)

                if pair == 0:
                    col_rgb = COLOURS["black"]
                elif pair == 3:
                    col_rgb = COLOURS["white"]
                elif pair == 1:    # bit on, neighbour off
                    if (x & 1) == 0:
                        col_rgb = COLOURS["orange" if palette_bit else "green"]
                    else:
                        col_rgb = COLOURS["blue" if palette_bit else "purple"]
                else:               # pair == 2: bit off, neighbour on
                    if (x & 1) == 0:
                        col_rgb = COLOURS["blue" if palette_bit else "purple"]
                    else:
                        col_rgb = COLOURS["orange" if palette_bit else "green"]
                px[x, y] = col_rgb
    return img


def score_page(page: bytes) -> float:
    """Heuristic 'looks like an image' score for a candidate 8KB page.

    Real HGR images have:
      - moderate byte diversity (not all 0s, not all FFs, not totally random)
      - lots of correlated neighbour bytes (smooth image areas)
      - low fraction of high-entropy bytes
    """
    if len(page) < HGR_BYTES:
        return 0.0
    # Fraction of common bytes
    zeros  = sum(1 for b in page if b == 0)
    ffs    = sum(1 for b in page if b == 0xFF)
    if zeros + ffs > 0.7 * len(page):
        return 0.0
    # Neighbour correlation: how often two consecutive bytes share at least 5 bits
    correlated = 0
    for i in range(len(page) - 1):
        diff = bin(page[i] ^ page[i + 1]).count("1")
        if diff <= 3:
            correlated += 1
    return correlated / (len(page) - 1)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        print("usage: hgr_scan.py <disk.dsk> <out_dir> [--all]")
        return
    dsk_path = Path(sys.argv[1])
    out_dir  = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    data = dsk_path.read_bytes()
    print(f"Scanning {dsk_path.name} ({len(data)} bytes) for HGR pages...")

    # Slide a window in 256-byte increments (sector aligned)
    candidates = []
    step = 256
    for start in range(0, len(data) - HGR_BYTES + 1, step):
        page = data[start:start + HGR_BYTES]
        s = score_page(page)
        if s > 0.55:
            candidates.append((s, start))

    # Sort by score descending
    candidates.sort(reverse=True)
    print(f"Found {len(candidates)} candidate HGR pages.")

    # De-duplicate: keep one per ~8KB region
    keep = []
    for s, off in candidates:
        if all(abs(off - prev_off) >= HGR_BYTES // 2 for _, prev_off in keep):
            keep.append((s, off))
        if len(keep) >= 20:
            break

    print(f"Saving top {len(keep)} non-overlapping candidates:")
    for i, (s, off) in enumerate(keep):
        page = data[off:off + HGR_BYTES]
        img = decode_hgr_page(page)
        img_big = img.resize((img.width * 2, img.height * 2), Image.NEAREST)
        track  = off // (16 * 256)
        sector = (off % (16 * 256)) // 256
        out_path = out_dir / f"hgr_t{track:02d}s{sector:02d}_score{int(s*100):03d}.png"
        img_big.save(out_path)
        print(f"  {out_path.name}  (offset 0x{off:05X}, track {track}, sector {sector}, score {s:.2f})")

    print(f"\nDone. Open the PNGs in {out_dir} to inspect.")


if __name__ == "__main__":
    main()
