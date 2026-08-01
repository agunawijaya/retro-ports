"""Parse Apple II DOS 3.3 .dsk disk images and extract files.

Disk layout (140 KB = 143,360 bytes):
    35 tracks × 16 sectors × 256 bytes
    Linear offset = (track * 16 + sector) * 256
    NB: .dsk files are usually in DOS 3.3 sector order — that's the order
    we use here.  (If a file is in ProDOS order ".po", a sector translation
    would be needed; we'll detect and handle that.)

DOS 3.3 layout (canonical):
    Track 17, Sector 0  = VTOC  (Volume Table Of Contents)
        offset 1-2:  track/sector of first catalog sector
        offset 27:   volume number
        offset 39:   track allocation order, etc.
    Track 17, Sector 1..15 = Catalog
        each catalog sector holds up to 7 file entries, 35 bytes each
        starting at offset 11
        entry:
            bytes 0-1:  first T/S list track/sector
            byte 2:     file type (bit7=locked, bits0-6 = T/I/A/B/S/R/a/b)
            bytes 3-32: filename (high-bit-set ASCII, padded with spaces)
            bytes 33-34: file size in sectors (little endian)
        A track==0 in entry[0] means deleted, FF means end of catalog.

    File T/S list sector:
        byte 1-2:   track/sector of NEXT T/S list (0,0 = end)
        bytes 12+:  pairs (track, sector) of data sectors

Files are typically:
    Type B (BINARY): bytes 0-1 = load address, 2-3 = length, 4..length+4 = data
    Type A (Applesoft): bytes 0-1 = length, 2..length+2 = tokenized BASIC
    Type T (TEXT): raw text, terminator 0x00
"""

import sys
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


SECTOR_SIZE = 256
SECTORS_PER_TRACK = 16
TRACKS = 35

FILE_TYPES = {
    0x00: 'T', 0x01: 'I', 0x02: 'A', 0x04: 'B',
    0x08: 'S', 0x10: 'R', 0x20: 'a', 0x40: 'b',
}


@dataclass
class CatEntry:
    ts_track: int
    ts_sector: int
    file_type: str
    locked: bool
    name: str
    size_sectors: int


def read_sector(data: bytes, track: int, sector: int) -> bytes:
    off = (track * SECTORS_PER_TRACK + sector) * SECTOR_SIZE
    return data[off:off + SECTOR_SIZE]


def parse_catalog(data: bytes) -> list[CatEntry]:
    """Walk the DOS 3.3 catalog starting at T17S0."""
    vtoc = read_sector(data, 17, 0)
    cat_track  = vtoc[1]
    cat_sector = vtoc[2]
    entries = []
    seen = set()
    while cat_track != 0 and (cat_track, cat_sector) not in seen:
        seen.add((cat_track, cat_sector))
        sec = read_sector(data, cat_track, cat_sector)
        # Up to 7 entries starting at offset 11, 35 bytes each
        for i in range(7):
            off = 11 + i * 35
            entry = sec[off:off + 35]
            ts_track  = entry[0]
            ts_sector = entry[1]
            if ts_track == 0xFF:
                continue              # deleted entry
            if ts_track == 0:
                continue              # never used
            ftype_byte = entry[2]
            locked = bool(ftype_byte & 0x80)
            ftype  = FILE_TYPES.get(ftype_byte & 0x7F, '?')
            name_bytes = entry[3:33]
            name = ''.join(
                chr(b & 0x7F) for b in name_bytes
            ).rstrip()
            size = entry[33] | (entry[34] << 8)
            entries.append(CatEntry(
                ts_track=ts_track, ts_sector=ts_sector,
                file_type=ftype, locked=locked,
                name=name, size_sectors=size,
            ))
        # Next catalog sector
        cat_track  = sec[1]
        cat_sector = sec[2]
    return entries


def read_file(data: bytes, entry: CatEntry) -> bytes:
    """Walk the file's T/S list and return raw concatenated sectors."""
    out = bytearray()
    t, s = entry.ts_track, entry.ts_sector
    seen = set()
    while t != 0 and (t, s) not in seen:
        seen.add((t, s))
        ts_sec = read_sector(data, t, s)
        # Track/Sector pairs starting at offset 12, 2 bytes each
        for i in range(122):
            pt = ts_sec[12 + i * 2]
            ps = ts_sec[12 + i * 2 + 1]
            if pt == 0:
                break       # no more data sectors
            out.extend(read_sector(data, pt, ps))
        t = ts_sec[1]
        s = ts_sec[2]
    return bytes(out)


def cmd_catalog(dsk_path: Path) -> list[tuple[CatEntry, bytes]]:
    data = dsk_path.read_bytes()
    if len(data) != 143360:
        print(f"  WARN: expected 143360 bytes, got {len(data)}")
    entries = parse_catalog(data)
    results = []
    print(f"\n== Catalog of {dsk_path.name} ==")
    print(f"  Volume disk has {len(entries)} file entries")
    print(f"  {'type':>4} {'lock':>4} {'sect':>4}  name")
    for e in entries:
        lock = "*" if e.locked else " "
        print(f"  {e.file_type:>4} {lock:>4} {e.size_sectors:>4}  {e.name}")
        try:
            body = read_file(data, e)
            results.append((e, body))
        except Exception as exc:
            print(f"       -- read failed: {exc}")
    return results


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    if cmd == "catalog":
        for path in sys.argv[2:]:
            cmd_catalog(Path(path))
    elif cmd == "extract":
        dsk = Path(sys.argv[2])
        out_dir = Path(sys.argv[3])
        out_dir.mkdir(parents=True, exist_ok=True)
        results = cmd_catalog(dsk)
        for e, body in results:
            safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in e.name)
            ext = {"T": ".txt", "A": ".bas.bin", "B": ".bin",
                   "I": ".int.bin", "S": ".s.bin"}.get(e.file_type, ".bin")
            out_file = out_dir / f"{safe}{ext}"
            out_file.write_bytes(body)
            print(f"  wrote {out_file.name}  ({len(body)} bytes)")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
