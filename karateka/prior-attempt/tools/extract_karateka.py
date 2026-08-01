#!/usr/bin/env python3
"""
extract_karateka.py — exploratory extractor for Karateka (DOS port) asset files.

The DOS port stores sprites in matched pairs:
    K?*.IND  — fixed-size lookup table, padded with 0x0080 sentinels
    K?*.DAT  — pool of opcode-coded "shapes" (Mechner-style shape table)

Backgrounds:
    *.BCG    — CGA interlaced framebuffers (192 lines, 80 bytes/line interlaced)

USAGE
-----
    python extract_karateka.py info  <prefix>            # parse one IND
    python extract_karateka.py dump  <prefix> <outdir>   # dump each sprite as .bin
    python extract_karateka.py stats <prefix>            # byte-frequency analysis of DAT
    python extract_karateka.py bcg   <file.bcg> <out.png>
    python extract_karateka.py raw   <prefix> <outdir>   # best-effort PNG of each sprite
    python extract_karateka.py all   <gamedir> <outdir>  # run everything

A "prefix" is a path without the .IND/.DAT extension, e.g.
    python extract_karateka.py info "E:/Projects/DOS Games/Karateka/karateka/KM0"

This script is exploratory: the exact shape-table opcode meanings still need
verification against a DOSBox-X disassembly trace. Use `raw` to produce
visual candidates and `stats` to spot the control bytes.
"""

from __future__ import annotations

import os
import sys
import struct
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image


# ---- CGA palette (mode 4, palette 1, high intensity) -----------------------
# This is the most common Karateka in-game palette: black, cyan, magenta, white.
CGA_PALETTE = [
    (0x00, 0x00, 0x00),   # 0 — black
    (0x55, 0xFF, 0xFF),   # 1 — bright cyan
    (0xFF, 0x55, 0xFF),   # 2 — bright magenta
    (0xFF, 0xFF, 0xFF),   # 3 — bright white
]


# ============================================================================
# .IND parser
# ============================================================================

# A real KM0.IND entry looks like:  4A 01 00 00      = (id=0x014A, off=0x0000)
# Padding tail bytes are 0x80 repeated, decoding as (id=0x8080, off=0x8080).
# A final real entry can have id=0xFFFF, which appears to be a "null/blank"
# shape rather than a terminator; we keep it.
PADDING_WORD = 0x8080


@dataclass
class IndexEntry:
    slot: int        # row in the IND table
    sprite_id: int   # 16-bit ID the engine uses to reference this shape
    offset: int      # byte offset into the matching .DAT
    length: int = 0  # filled in later, after we know where the next shape starts


def parse_ind(ind_bytes: bytes) -> list[IndexEntry]:
    """Parse a Karateka .IND lookup table.

    Each row is 4 bytes:  (sprite_id_LE, offset_LE).
    The tail of the table is filled with 0x80 bytes; we stop reading at
    the first row whose sprite_id is the padding word 0x8080.
    """
    if len(ind_bytes) % 4 != 0:
        raise ValueError(f"IND length {len(ind_bytes)} is not a multiple of 4")

    entries: list[IndexEntry] = []
    n = len(ind_bytes) // 4
    for i in range(n):
        sid, off = struct.unpack_from("<HH", ind_bytes, i * 4)
        if sid == PADDING_WORD:
            break
        entries.append(IndexEntry(slot=i, sprite_id=sid, offset=off))
    return entries


def annotate_lengths(entries: list[IndexEntry], dat_size: int) -> None:
    """Best-effort: estimate each shape's byte length.

    Karateka shape streams can *overlap* (shared suffixes), so "length" is
    really "bytes from this offset to the next-greater offset in the file,
    or to EOF". That over-estimates for shapes whose stream ends before the
    next shape begins, but it's a useful upper bound for dumping.
    """
    sorted_offsets = sorted({e.offset for e in entries})
    sorted_offsets.append(dat_size)
    next_after = {}
    for a, b in zip(sorted_offsets, sorted_offsets[1:]):
        next_after[a] = b
    for e in entries:
        e.length = next_after[e.offset] - e.offset


# ============================================================================
# .BCG (background image) decoder
# ============================================================================
# A full CGA mode-4 screen is 16384 bytes: two banks (even/odd scanlines)
# of 8192 bytes each, each bank being 100 lines × 80 bytes (= 8000) + 192
# bytes of padding.
# Karateka's CASTLE.BCG is 15360 bytes = 2 banks × 96 lines × 80 bytes.
# That is a 320×192 play-area background (no bottom 8 scanlines / HUD area).

def _decode_cga_pixels(buf: bytes, x_off: int, y_off: int, width_bytes: int,
                       height_lines: int, img_px) -> None:
    """Blit `height_lines` × `width_bytes` bytes of CGA 2-bpp pixels into img."""
    for y in range(height_lines):
        for xb in range(width_bytes):
            byte = buf[y * width_bytes + xb]
            for sub in range(4):
                ci = (byte >> ((3 - sub) * 2)) & 0b11
                img_px[x_off + xb * 4 + sub, y_off + y] = CGA_PALETTE[ci]


def decode_bcg(bcg_bytes: bytes, layout: str = "auto") -> Image.Image:
    """Decode a Karateka .BCG (background) to an RGB PIL image.

    Three layouts are tried.  Pass layout='interlace'/'linear'/'stacked' to
    force one; 'auto' picks the size-appropriate one.

    interlace : two banks, bank0=even scanlines, bank1=odd scanlines.
                Standard CGA mode-4 framebuffer (B800:0000).
    linear    : one continuous bank of width_bytes-wide rows, no interlace.
    stacked   : two banks; bank0 = top half, bank1 = bottom half.
    """
    size = len(bcg_bytes)
    width_bytes = 80

    # Choose default dimensions
    if size == 16384:
        height = 200
    elif size == 15360:
        height = 192     # 192 × 80 bytes
    elif size % width_bytes == 0:
        height = size // width_bytes
    else:
        # FUJI.BCG (2816 bytes) is small / probably narrower — try square-ish.
        # 2816 / 32 = 88 lines, 32 bytes/line = 128 px wide.
        for cand_w in (40, 32, 20, 16, 8):
            if size % cand_w == 0:
                width_bytes = cand_w
                height = size // cand_w
                break
        else:
            width_bytes = 1
            height = size

    width = width_bytes * 4
    img = Image.new("RGB", (width, height), (255, 0, 0))
    px = img.load()

    if layout == "auto":
        # Karateka BCGs are linear (verified on CASTLE.BCG); the interlace
        # layout produces correct *content* but with striping artifacts,
        # which means the file is line-sequential, not bank-interlaced.
        layout = "linear"

    if layout == "linear":
        _decode_cga_pixels(bcg_bytes, 0, 0, width_bytes, height, px)

    elif layout == "stacked":
        half = size // 2
        lph = half // width_bytes
        _decode_cga_pixels(bcg_bytes[:half], 0, 0, width_bytes, lph, px)
        _decode_cga_pixels(bcg_bytes[half:], 0, lph, width_bytes, lph, px)

    else:  # interlace (CGA mode-4 standard)
        half = size // 2
        bank0 = bcg_bytes[:half]
        bank1 = bcg_bytes[half:half * 2]
        lph = half // width_bytes
        for y in range(lph * 2):
            bank = bank0 if (y % 2 == 0) else bank1
            line_in_bank = y // 2
            for xb in range(width_bytes):
                byte = bank[line_in_bank * width_bytes + xb]
                for sub in range(4):
                    ci = (byte >> ((3 - sub) * 2)) & 0b11
                    px[xb * 4 + sub, y] = CGA_PALETTE[ci]

    return img


# ============================================================================
# Confirmed RLE decompressor — opcode 0x7B
# ============================================================================
# Discovered by disassembling KARATEKA.EXE at image+0x0B5E .. 0x0BC8.
# Each stream uses one escape byte:
#     0x7B <data> <count>   ->  emit `data` byte `count` times
#     <any other byte b>    ->  emit b once
# Two such streams are decoded in lockstep by the blitter (image + mask),
# producing transparent CGA sprites.

RLE_ESCAPE = 0x7B

# Sprite source bytes go through a per-byte bit-reversal in the blitter
# (image+0x06F0..0x06FB: 8 iterations of `shr al,1; rcl ah,1`).  To see
# the same pixels CGA displays, we bit-reverse each decoded sprite byte
# before laying it out MSB-first.  Backgrounds (BCG) do NOT pass through
# that blitter, so their bytes are used directly.
_BITREV_TABLE = bytes(int(f"{b:08b}"[::-1], 2) for b in range(256))


def rle_decompress(buf: bytes, start: int = 0,
                   max_output: int | None = None) -> tuple[bytes, int]:
    """Decompress a Karateka RLE stream.

    Returns (decoded_bytes, bytes_consumed_from_source).
    Stops when `max_output` bytes are emitted, or the source is exhausted.
    """
    out = bytearray()
    i = start
    n = len(buf)
    while i < n:
        b = buf[i]; i += 1
        if b == RLE_ESCAPE:
            if i + 1 >= n:
                break
            data = buf[i]; count = buf[i + 1]; i += 2
            out.extend([data] * count)
        else:
            out.append(b)
        if max_output is not None and len(out) >= max_output:
            break
    return bytes(out), i - start


# ============================================================================
# Shape (sprite) raw rendering — multiple exploratory decoders
# ============================================================================

def render_raw_bytes_as_bitmap(buf: bytes, width_bytes: int = 4,
                               scale: int = 4) -> Image.Image:
    """Treat the buffer as a flat CGA-2bpp bitmap, no header, no opcodes.

    Useful for *seeing* what's in the bytes; will rarely produce the real
    sprite, but reveals structural patterns (rows, repeating control bytes).
    """
    if width_bytes <= 0:
        width_bytes = 4
    height = max(1, len(buf) // width_bytes)
    width = width_bytes * 4
    img = Image.new("RGB", (width, height), (40, 40, 40))
    px = img.load()
    for y in range(height):
        for xb in range(width_bytes):
            idx = y * width_bytes + xb
            if idx >= len(buf):
                break
            b = buf[idx]
            for sub in range(4):
                ci = (b >> ((3 - sub) * 2)) & 0b11   # MSB-first: pixel 0 = bits 7-6
                px[xb * 4 + sub, y] = CGA_PALETTE[ci]
    return img.resize((width * scale, height * scale), Image.NEAREST)


def decode_shape(full_dat: bytes, shape_offset: int) -> tuple[int, int, bytes]:
    """Decode one shape from a pack DAT, returning bytes in display order.

    Header is 3 raw bytes (width_bytes, height, anchor) at `shape_offset`.
    The RLE stream that follows is in column-major, right-to-left,
    top-to-bottom order — that's how the blitter at image+0x078A writes
    them (one column at a time from di+0x4F backwards).

    Additionally every byte is BIT-REVERSED at write time (the 8-iteration
    shr/rcl loop at image+0x079E). We undo that here so the result can be
    rendered with normal MSB-first 2bpp CGA decoding.

    Returns (width_bytes, height, pixel_bytes_in_row_major_order).
    """
    if shape_offset + 3 > len(full_dat):
        return 0, 0, b""
    w = full_dat[shape_offset]
    h = full_dat[shape_offset + 1]
    need = w * h
    if need == 0:
        return w, h, b""
    stream, _ = rle_decompress(full_dat, start=shape_offset + 3,
                               max_output=need)
    if len(stream) < need:
        stream = stream + bytes(need - len(stream))

    # Re-order from column-major RTL,TTB to row-major LTR,TTB,
    # bit-reversing each byte so it represents the CGA-displayed pixels.
    out = bytearray(need)
    for i, b in enumerate(stream):
        col_from_right = i // h           # 0 = rightmost column
        row             = i % h
        col             = w - 1 - col_from_right
        out[row * w + col] = _BITREV_TABLE[b]
    return w, h, bytes(out)


CHECKER_LIGHT = (96, 96, 96)
CHECKER_DARK  = (64, 64, 64)


def _checker_bg(width: int, height: int, cell: int = 4) -> Image.Image:
    """A simple checker-pattern image so transparent pixels are visible."""
    img = Image.new("RGB", (width, height), CHECKER_LIGHT)
    px = img.load()
    for y in range(height):
        for x in range(width):
            if ((x // cell) + (y // cell)) & 1:
                px[x, y] = CHECKER_DARK
    return img


def render_rle_decoded(buf: bytes, scale: int = 8,
                       width_bytes: int | None = None,
                       use_header: bool = True,
                       full_dat: bytes | None = None,
                       shape_offset: int = 0,
                       transparent_zero: bool = True) -> Image.Image:
    """Render one decompressed shape.

    With the unified decoder (column-major→row-major + per-byte bit-reverse),
    the resulting bytes are exactly what CGA hardware would display, in MSB-
    first 2-bpp pixel order.  For a mask file (KM<x>), each byte's pixel
    bits ARE the displayed colour value for an opaque pixel; colour 0
    (binary 00) represents transparency.

    Output is upscaled `scale`× and rendered against a checkerboard so
    transparent pixels are visible against the actual sprite colours.
    """
    if use_header and full_dat is not None:
        wb, h, decoded = decode_shape(full_dat, shape_offset)
        if wb == 0 or h == 0:
            return Image.new("RGB", (4, 4), (200, 0, 0))
    elif use_header and len(buf) >= 3:
        wb, h, decoded = decode_shape(buf, 0)
        if wb == 0 or h == 0:
            return Image.new("RGB", (4, 4), (200, 0, 0))
    else:
        decoded, _ = rle_decompress(buf)
        wb = width_bytes if width_bytes is not None else 4
        h = max(1, (len(decoded) + wb - 1) // wb)
    if width_bytes is not None:
        wb = width_bytes

    width = wb * 4
    img = _checker_bg(width, h, cell=2)
    px = img.load()
    for y in range(h):
        for xb in range(wb):
            idx = y * wb + xb
            if idx >= len(decoded):
                break
            b = decoded[idx]
            for sub in range(4):
                ci = (b >> ((3 - sub) * 2)) & 0b11   # MSB-first: pixel 0 = bits 7-6
                if ci == 0 and transparent_zero:
                    continue                         # leave the checker showing
                px[xb * 4 + sub, y] = CGA_PALETTE[ci]
    return img.resize((width * scale, h * scale), Image.NEAREST)


def render_image_plus_mask(mask_full: bytes, mask_off: int,
                           pixel_full: bytes, pixel_off: int,
                           scale: int = 4) -> Image.Image:
    """Render a composite sprite using the confirmed Karateka blit semantics.

    Discovered at image+0x0709:
        shadow_byte = (shadow_byte & ~pixel_byte) | mask_byte

    where both source bytes are bit-reversed first.  Per-pixel meaning:
        * mask byte  = "color bits to set"     (carries the color value)
        * pixel byte = "color bits to clear"   (~mask for opaque pixels)
        * (mask|pixel)==0 for a pixel ⇒ transparent.

    Pair convention: KM<x> = mask file, KS<x> = pixel file
    (since KM is smaller / more RLE-compressible — typical of mask data).
    Pixel ordering in shape bytes is LSB-first (matches the bit-reversal
    the engine applies at write time).
    """
    wm, hm, mask  = decode_shape(mask_full,  mask_off)
    wp, hp, pixel = decode_shape(pixel_full, pixel_off)
    if wm == 0 or hm == 0 or wm != wp or hm != hp:
        return Image.new("RGB", (32, 32), (180, 0, 0))
    scale = 8
    width = wm * 4
    img = _checker_bg(width, hm, cell=2)
    px = img.load()
    for y in range(hm):
        for xb in range(wm):
            idx = y * wm + xb
            p = pixel[idx]
            m = mask[idx]
            for sub in range(4):
                shift = (3 - sub) * 2     # MSB-first: pixel 0 = bits 7-6
                mask_bits  = (m >> shift) & 0b11
                pixel_bits = (p >> shift) & 0b11
                if (mask_bits | pixel_bits) == 0:
                    continue              # let checker show through
                px[xb * 4 + sub, y] = CGA_PALETTE[mask_bits]
    return img.resize((width * scale, hm * scale), Image.NEAREST)


def render_opcode_attempt(buf: bytes, scale: int = 4) -> Image.Image:
    """Exploratory decoder based on what we *do* see in the data.

    Observation: in KM0.DAT the byte 0x7B (= 123) appears as a recurring
    marker, often followed by 0x00 then a small value. A plausible reading
    of that triple is "row terminator: advance Y, set X back to 0". The
    bytes between such markers look like pixel runs.

    This decoder treats the stream as:
        loop:
          read b
          if b == 0x7B:                              # row break opcode
              read NN1, NN2  -> advance Y by some count, optionally indent
              continue
          else:
              emit b as one packed-pixel byte (4 px)

    It is a *guess* — useful for visual inspection, not authoritative.
    """
    rows: list[list[int]] = [[]]
    i = 0
    max_w = 0
    while i < len(buf):
        b = buf[i]
        if b == 0x7B and i + 2 < len(buf):
            # row break — start a new row
            # second byte often 0x00 (filler), third byte often a small count
            rows.append([])
            i += 3
            continue
        rows[-1].append(b)
        max_w = max(max_w, len(rows[-1]))
        i += 1

    height = max(1, len([r for r in rows if r]))
    width_bytes = max(1, max_w)
    width = width_bytes * 4
    img = Image.new("RGB", (width, height), (40, 40, 40))
    px = img.load()
    y = 0
    for row in rows:
        if not row:
            continue
        for xb, byte in enumerate(row):
            for sub in range(4):
                ci = (byte >> ((3 - sub) * 2)) & 0b11
                px[xb * 4 + sub, y] = CGA_PALETTE[ci]
        y += 1
    return img.resize((width * scale, height * scale), Image.NEAREST)


# ============================================================================
# Pair loader
# ============================================================================

@dataclass
class SpritePack:
    prefix: Path
    index: list[IndexEntry]
    dat: bytes


def load_pack(prefix: str | os.PathLike) -> SpritePack:
    prefix = Path(prefix)
    ind_path = prefix.with_suffix(".IND")
    dat_path = prefix.with_suffix(".DAT")
    if not ind_path.exists():
        # Try lowercase variants
        for cand in (prefix.with_suffix(".ind"), prefix.with_name(prefix.name + ".IND")):
            if cand.exists():
                ind_path = cand
                break
    if not dat_path.exists():
        for cand in (prefix.with_suffix(".dat"), prefix.with_name(prefix.name + ".DAT")):
            if cand.exists():
                dat_path = cand
                break
    ind = ind_path.read_bytes()
    dat = dat_path.read_bytes()
    entries = parse_ind(ind)
    annotate_lengths(entries, len(dat))
    return SpritePack(prefix=prefix, index=entries, dat=dat)


# ============================================================================
# Commands
# ============================================================================

def cmd_info(prefix: str) -> None:
    pack = load_pack(prefix)
    print(f"# Index of {Path(prefix).name}")
    print(f"  IND entries (after dropping sentinels): {len(pack.index)}")
    print(f"  DAT size: {len(pack.dat)} bytes")
    print(f"  {'slot':>4}  {'sprite_id':>9}  {'offset':>7}  {'length(approx)':>14}")
    for e in pack.index:
        print(f"  {e.slot:>4}  0x{e.sprite_id:04X} ({e.sprite_id:>3})  {e.offset:>7}  {e.length:>14}")


def cmd_dump(prefix: str, outdir: str) -> None:
    pack = load_pack(prefix)
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    for e in pack.index:
        blob = pack.dat[e.offset:e.offset + e.length]
        fname = out / f"{Path(prefix).name}_id{e.sprite_id:04X}_off{e.offset:04X}.bin"
        fname.write_bytes(blob)
    print(f"Wrote {len(pack.index)} blobs to {out}")


def cmd_stats(prefix: str) -> None:
    pack = load_pack(prefix)
    c = Counter(pack.dat)
    total = sum(c.values())
    print(f"# Byte-frequency analysis of {Path(prefix).name}.DAT ({total} bytes)")
    print(f"  {'byte':>5}  {'count':>6}  {'%':>6}")
    for b, n in c.most_common(16):
        print(f"   0x{b:02X}  {n:>6}  {100*n/total:>5.1f}%")
    print()
    # Highlight likely control byte: highest-frequency byte that isn't a
    # boring 0x00 / 0xFF (which are common as pixel fill / empty).
    for b, n in c.most_common():
        if b not in (0x00, 0xFF, 0x55, 0xAA):  # ignore solid pixel patterns
            print(f"  Likely control opcode candidate: 0x{b:02X} "
                  f"({n} occurrences = {100*n/total:.1f}%)")
            break


def cmd_bcg(bcg_path: str, out_png: str) -> None:
    """Render a Karateka .BCG file.

    Karateka's engine double-buffers: graphics are composed in a 16 KB
    shadow buffer at DS:0x337 (200 rows × 80 bytes, row-major, normal CGA
    byte format).  BCG files are loaded into that buffer; the slow-
    reveal routine at image+0x0DEF then animates the buffer onto the
    real CGA framebuffer.

    CASTLE.BCG (15,360 B = 192 × 80) fills almost the whole shadow buffer.
    FUJI.BCG  ( 2,816 B = ~35 × 80) fills only the top rows; the rest of
    the buffer was zeroed by call 0xB4E and stays black.
    """
    data = Path(bcg_path).read_bytes()
    base = Path(out_png)
    sz = len(data)
    width_bytes = 80
    full_h = 200

    # Build a 200-line "shadow buffer" image: prefix-zero, blit data, render.
    # Try the data placed at offsets 0, 2, 16 (possible prefix lengths).
    buf = bytearray(width_bytes * full_h)
    buf[:min(sz, len(buf))] = data[:min(sz, len(buf))]
    img = Image.new("RGB", (width_bytes * 4, full_h), (255, 0, 0))
    px = img.load()
    for y in range(full_h):
        for xb in range(width_bytes):
            b = buf[y * width_bytes + xb]
            for sub in range(4):
                # MSB-first matches CGA hardware (and produces clean
                # FUJI / CASTLE renders).  No bit-reverse — BCGs are
                # loaded directly into the shadow buffer without going
                # through the sprite blitter.
                ci = (b >> ((3 - sub) * 2)) & 0b11
                px[xb * 4 + sub, y] = CGA_PALETTE[ci]
    scaled = img.resize((img.width * 3, img.height * 3), Image.NEAREST)
    scaled.save(base)
    print(f"Wrote {base.name} ({sz} byte source -> 320x200 MSB-first CGA)")


def cmd_raw(prefix: str, outdir: str) -> None:
    pack = load_pack(prefix)
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    rows_html: list[str] = []
    for e in pack.index:
        blob = pack.dat[e.offset:e.offset + e.length]
        hdr_w = blob[0] if len(blob) >= 1 else 0
        hdr_h = blob[1] if len(blob) >= 2 else 0
        hdr_a = blob[2] if len(blob) >= 3 else 0
        img = render_rle_decoded(blob, scale=8, use_header=True,
                                 full_dat=pack.dat, shape_offset=e.offset)
        name = f"{Path(prefix).name}_id{e.sprite_id:04X}"
        img.save(out / f"{name}.png")
        rows_html.append(
            f"<tr><td>0x{e.sprite_id:04X}</td><td>off={e.offset}</td>"
            f"<td>{hdr_w}x{hdr_h} ({hdr_w*4}x{hdr_h} px)</td>"
            f"<td><img src='{name}.png'></td></tr>"
        )
    html = (
        "<!doctype html><meta charset=utf-8>"
        f"<title>{Path(prefix).name} contact sheet</title>"
        "<style>body{font:13px sans-serif;background:#222;color:#eee}"
        "td{padding:6px;border-bottom:1px solid #444;vertical-align:top}"
        "img{image-rendering:pixelated;background:#000}</style>"
        f"<h1>{Path(prefix).name} — decoded sprites</h1>"
        "<p>Decoder pipeline: 3-byte header <code>(w, h, anchor)</code> → "
        "RLE expand (<code>0x7B &lt;data&gt; &lt;count&gt;</code>, "
        "shape tails can be shared) → re-order column-major RTL into "
        "row-major LTR → bit-reverse each byte → render MSB-first 2-bpp CGA. "
        "Checker pattern shows through transparent (colour-0) pixels.</p>"
        "<table><tr><th>ID</th><th>offset</th><th>size</th><th>sprite (×8)</th></tr>"
        + "".join(rows_html) +
        "</table>"
    )
    (out / "index.html").write_text(html, encoding="utf-8")
    print(f"Wrote {3*len(pack.index)} PNGs + index.html to {out}")


def cmd_pair(prefix_a: str, prefix_b: str, outdir: str) -> None:
    """Render image+mask composite from a paired pack, e.g. KM0 + KMI0."""
    pack_a = load_pack(prefix_a)
    pack_b = load_pack(prefix_b)
    by_id_b = {e.sprite_id: e for e in pack_b.index}
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    name_a = Path(prefix_a).name
    name_b = Path(prefix_b).name
    rows: list[str] = []
    matched = 0
    for ea in pack_a.index:
        eb = by_id_b.get(ea.sprite_id)
        if eb is None:
            continue
        matched += 1
        # Two orderings — pick the visually-sensible one as ground truth.
        img_a_as_mask = render_image_plus_mask(pack_a.dat, ea.offset,
                                               pack_b.dat, eb.offset, scale=4)
        img_b_as_mask = render_image_plus_mask(pack_b.dat, eb.offset,
                                               pack_a.dat, ea.offset, scale=4)
        out_a = f"id{ea.sprite_id:04X}_{name_a}_as_mask.png"
        out_b = f"id{ea.sprite_id:04X}_{name_b}_as_mask.png"
        img_a_as_mask.save(out / out_a)
        img_b_as_mask.save(out / out_b)
        rows.append(
            f"<tr><td>0x{ea.sprite_id:04X}</td>"
            f"<td>{name_a}={ea.length}B<br>{name_b}={eb.length}B</td>"
            f"<td><img src='{out_a}'><br>{name_a}=mask, {name_b}=pixel</td>"
            f"<td><img src='{out_b}'><br>{name_b}=mask, {name_a}=pixel</td>"
            "</tr>"
        )
    html = (
        "<!doctype html><meta charset=utf-8>"
        f"<title>{name_a} + {name_b}</title>"
        "<style>body{font:12px sans-serif;background:#222;color:#eee}"
        "td{padding:4px;border-bottom:1px solid #444;vertical-align:top}"
        "img{image-rendering:pixelated}</style>"
        f"<h1>{name_a} + {name_b} composite sprites</h1>"
        "<p>Confirmed blit semantics (from image+0x0709): "
        "<code>new = (shadow &amp; ~pixel) | mask</code>. "
        "The MASK byte carries the color value; pixel byte gates background "
        "bits to clear. Magenta tint = transparent pixel.</p>"
        "<table><tr><th>ID</th><th>sizes</th>"
        "<th>variant 1</th><th>variant 2</th></tr>"
        + "".join(rows) +
        "</table>"
    )
    (out / "index.html").write_text(html, encoding="utf-8")
    print(f"Matched {matched} sprite IDs across {name_a} and {name_b}; "
          f"wrote {2*matched} PNGs + index.html to {out}")


def cmd_all(gamedir: str, outdir: str) -> None:
    gd = Path(gamedir)
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)

    # 1. All sprite pairs
    ind_files = sorted(gd.glob("*.IND"))
    sprite_dirs: list[Path] = []
    for ind in ind_files:
        dat = ind.with_suffix(".DAT")
        if not dat.exists():
            continue
        prefix = str(ind.with_suffix(""))
        sub = out / "sprites" / ind.stem
        sub.mkdir(parents=True, exist_ok=True)
        print(f"-- {ind.stem} --")
        try:
            cmd_info(prefix)
            cmd_dump(prefix, sub / "blobs")
            cmd_raw(prefix, sub / "renders")
            sprite_dirs.append(sub)
        except Exception as exc:
            print(f"   FAILED: {exc}")

    # 2. All backgrounds
    bg_out = out / "backgrounds"
    bg_out.mkdir(parents=True, exist_ok=True)
    for bcg in sorted(gd.glob("*.BCG")):
        try:
            cmd_bcg(str(bcg), str(bg_out / (bcg.stem + ".png")))
        except Exception as exc:
            print(f"   {bcg.name} FAILED: {exc}")

    # 3. Top-level index
    lines = ["<!doctype html><meta charset=utf-8><title>Karateka assets</title>",
             "<style>body{font:14px sans-serif;background:#222;color:#eee}"
             "a{color:#7df}h2{border-bottom:1px solid #444}</style>",
             "<h1>Karateka extracted assets</h1>"]
    lines.append("<h2>Backgrounds</h2><div>")
    for bg in sorted(bg_out.glob("*.png")):
        lines.append(f"<figure><img style='image-rendering:pixelated' src='backgrounds/{bg.name}'>"
                     f"<figcaption>{bg.name}</figcaption></figure>")
    lines.append("</div><h2>Sprite packs</h2><ul>")
    for sd in sprite_dirs:
        lines.append(f"<li><a href='sprites/{sd.name}/renders/index.html'>{sd.name}</a></li>")
    lines.append("</ul>")
    (out / "index.html").write_text("\n".join(lines), encoding="utf-8")
    print(f"\nDone. Open: {out / 'index.html'}")


# ============================================================================
# Entry point
# ============================================================================

def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 1
    cmd, *rest = argv[1:]
    try:
        if cmd == "info"  and len(rest) == 1: cmd_info(rest[0])
        elif cmd == "dump" and len(rest) == 2: cmd_dump(*rest)
        elif cmd == "stats" and len(rest) == 1: cmd_stats(rest[0])
        elif cmd == "bcg"  and len(rest) == 2: cmd_bcg(*rest)
        elif cmd == "raw"  and len(rest) == 2: cmd_raw(*rest)
        elif cmd == "pair" and len(rest) == 3: cmd_pair(*rest)
        elif cmd == "all"  and len(rest) == 2: cmd_all(*rest)
        else:
            print(__doc__)
            return 1
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
