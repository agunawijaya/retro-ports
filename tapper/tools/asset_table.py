"""Dump and extract Tapper's asset directory at CS:05B1.

The loader at CS:0502 indexes it with the asset number in AL:

    0507  mov ah, 0
    0509  shl ax, 1 / shl ax, 1     ; index * 4
    050D  add ax, 0x5b1             ; table base
    0510  mov si, ax
    0512  mov ax, [si + 2]          ; byte count
    051F  mov ax, [si]              ; logical sector number

Each entry is 4 bytes: word 0 = LSN, word 2 = byte count. Note the table base is
odd, so entries are not word-aligned -- fine on 8086.

Composing the loader's LSN -> CHS mapping with the INT 80h handler's CHS ->
offset mapping collapses to an identity:

    track  = LSN/9 + 2,  sector = LSN%9 + 1                  (CS:0521-0528)
    offset = ((track-5)*9 + sector-1) * 512                  (CS:0139-014B)
           = (LSN - 27) * 512

Entry 0 has LSN 0, which maps below track 5 and therefore outside TAPPER.DAT: it
refers to the game code, which lived on tracks 0-4 of the original floppy and is
now TAPPER.COM itself. Entries 1..14 are the real data assets.

The strongest check that this reading is right: for every asset, LSN plus its
rounded-up sector count equals the next asset's LSN. The assets tile the file
contiguously with no gaps.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COM = os.path.join(ROOT, "Tapper", "TAPPER.COM")
DAT = os.path.join(ROOT, "Tapper", "TAPPER.DAT")
OUT = os.path.join(ROOT, "out", "assets")
ORG = 0x100
TABLE = 0x5B1
SECTOR = 512
LSN_BASE = 27
N_ENTRIES = 15


def load_table():
    img = open(COM, "rb").read()

    def word(a):
        o = a - ORG
        return int.from_bytes(img[o:o + 2], "little")

    return [(word(TABLE + i * 4), word(TABLE + i * 4 + 2))
            for i in range(N_ENTRIES)]


def main():
    entries = load_table()
    dat = open(DAT, "rb").read()
    n_sectors = len(dat) // SECTOR

    print(f"asset directory at CS:{TABLE:04X}, {N_ENTRIES} entries of 4 bytes")
    print(f"TAPPER.DAT = {len(dat)} bytes = {n_sectors} sectors "
          f"(LSN {LSN_BASE}..{LSN_BASE + n_sectors - 1})\n")
    print(f"{'idx':>3} {'LSN':>5} {'bytes':>7} {'secs':>5} {'offset':>8} "
          f"{'end':>8} {'trk/sec':>9}  contiguity")
    print("-" * 74)

    for i, (lsn, nbytes) in enumerate(entries):
        secs = (nbytes + SECTOR - 1) // SECTOR
        if lsn < LSN_BASE:
            print(f"{i:>3} {lsn:>5} {nbytes:>7} {secs:>5} {'-':>8} {'-':>8} "
                  f"{'-':>9}  not in DAT (game code, floppy tracks 0-4)")
            continue
        off = (lsn - LSN_BASE) * SECTOR
        track, sec = lsn // 9 + 2, lsn % 9 + 1
        nxt = entries[i + 1][0] if i + 1 < len(entries) else None
        if nxt is None:
            note = "last"
        elif lsn + secs == nxt:
            note = f"+{secs} -> {nxt}  ok"
        else:
            note = f"+{secs} -> {lsn+secs}, next is {nxt}  GAP/OVERLAP"
        print(f"{i:>3} {lsn:>5} {nbytes:>7} {secs:>5} {off:>8} "
              f"{off+nbytes:>8} {track:>5}/{sec:<3}  {note}")

    # Region accounting.
    real = [(i, l, n) for i, (l, n) in enumerate(entries) if l >= LSN_BASE]
    first_lsn = min(l for _, l, _ in real)
    last = max(l + (n + SECTOR - 1) // SECTOR for _, l, n in real)
    print(f"\nassets span LSN {first_lsn}..{last-1}")
    print(f"  LSN {LSN_BASE}..{first_lsn-1} "
          f"(offset 0..{(first_lsn-LSN_BASE)*SECTOR-1}) is the text/string block "
          f"pre-baked into TAPPER.COM at CS:3C80")
    tail = LSN_BASE + n_sectors - last
    print(f"  LSN {last}..{LSN_BASE+n_sectors-1} ({tail} sectors) is trailing "
          f"filler at the end of the file")

    os.makedirs(OUT, exist_ok=True)
    for i, lsn, nbytes in real:
        off = (lsn - LSN_BASE) * SECTOR
        blob = dat[off:off + nbytes]
        path = os.path.join(OUT, f"asset{i:02d}_lsn{lsn:03d}_{nbytes}b.bin")
        with open(path, "wb") as f:
            f.write(blob)
    print(f"\nextracted {len(real)} assets -> {OUT}")


if __name__ == "__main__":
    main()
