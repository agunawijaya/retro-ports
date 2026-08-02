"""Structural probe of TAPPER.DAT using the geometry the game actually uses.

An earlier guess of 2560-byte records was wrong. The disassembly settles it:

  * TAPPER.COM hooks INT 80h to a handler at CS:0135 (installed at CS:064F).
  * That handler takes BIOS INT 13h AH=02h register conventions -- AL = sector
    count, CH = track, CL = sector, ES:BX = destination -- and converts them to
    a seek + read on TAPPER.DAT via  offset = ((CH - 5) * 9 + (CL - 1)) * 512.
  * So the file is a raw image of a 9-sector-per-track floppy, starting at
    track 5. The original game read the physical disk; the crack redirects it.

  92160 bytes / 512 = 180 sectors / 9 = 20 tracks, i.e. tracks 5..24.

The 2560-byte block that also appears in TAPPER.COM at file offset 0x3B80 is
simply the first 5 sectors of track 5 pre-baked into the executable.
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Tapper", "TAPPER.DAT")

SECTOR = 512
SECTORS_PER_TRACK = 9
FIRST_TRACK = 5


def offset_of(track, sector):
    """Byte offset of a CHS address, matching the handler's arithmetic."""
    return ((track - FIRST_TRACK) * SECTORS_PER_TRACK + (sector - 1)) * SECTOR


def entropy(buf):
    hist = [0] * 256
    for b in buf:
        hist[b] += 1
    e = 0.0
    for c in hist:
        if c:
            p = c / len(buf)
            e -= p * math.log2(p)
    return e


def classify(buf):
    """Rough content guess from byte statistics."""
    if len(set(buf)) == 1:
        return f"filler {buf[0]:02X}"
    text = sum(1 for b in buf if 32 <= b < 127)
    zeros = sum(1 for b in buf if b == 0)
    # 2bpp CGA solid-colour runs show up as these repeated bit-pair bytes.
    cga = sum(1 for b in buf if b in (0x00, 0x55, 0xAA, 0xFF))
    if text > len(buf) * 0.55:
        return "text"
    if cga > len(buf) * 0.30:
        return "graphics (flat runs)"
    return "graphics/mixed"


def strings(buf, minlen=4):
    out, cur, start = [], [], 0
    for i, b in enumerate(buf):
        if 32 <= b < 127:
            if not cur:
                start = i
            cur.append(chr(b))
        else:
            if len(cur) >= minlen:
                out.append((start, "".join(cur)))
            cur = []
    if len(cur) >= minlen:
        out.append((start, "".join(cur)))
    return out


def main():
    data = open(SRC, "rb").read()
    total = len(data) // SECTOR
    tracks = total // SECTORS_PER_TRACK
    print(f"{SRC}")
    print(f"  {len(data)} bytes = {total} sectors = {tracks} tracks "
          f"({FIRST_TRACK}..{FIRST_TRACK + tracks - 1}), "
          f"{SECTORS_PER_TRACK} sectors/track\n")

    print(f"{'track':>5} {'offset':>8} {'entropy':>8}  per-sector content")
    print("-" * 76)
    for t in range(FIRST_TRACK, FIRST_TRACK + tracks):
        base = offset_of(t, 1)
        blob = data[base:base + SECTOR * SECTORS_PER_TRACK]
        kinds = []
        for s in range(SECTORS_PER_TRACK):
            sec = blob[s * SECTOR:(s + 1) * SECTOR]
            k = classify(sec)
            kinds.append("T" if k == "text" else
                         "." if k.startswith("filler") else
                         "F" if "flat" in k else "G")
        print(f"{t:>5} {base:>8} {entropy(blob):>8.3f}  {''.join(kinds)}")
    print("\n  legend: T=text  F=graphics with flat runs  G=graphics/mixed  .=filler")

    print("\n--- strings on track 5 (the copy embedded in TAPPER.COM at 0x3B80) ---")
    for off, s in strings(data[:SECTOR * 5]):
        t, rem = divmod(off, SECTOR)
        print(f"  t5/s{t+1} +{rem:03X}  {s!r}")


if __name__ == "__main__":
    main()
