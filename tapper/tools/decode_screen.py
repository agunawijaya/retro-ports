"""Unpack a screen asset straight from TAPPER.DAT, using only the format read
out of the reconstructed source.

The screen assets are RLE-compressed, which is why a naive raster dump of them
is noise. The unpacker is at CS:2DB5 and the format is entirely legible there:

    si = 0x4012                     ; the stream starts 0x12 bytes into the load
    al = [0x4001]                   ; high byte of screen_config
    test al, 8                      ; bit 3 clear -> not compressed
      clear: mov cx, 0x2000 / repne movsw     ; 16 KB copied verbatim
      set:   token loop, one word at a time
               0x0000  end
               0xFFFF  di = 0x2000  ; switch to the odd-scanline CGA bank
               n       (bit 15 clear) copy n literal bytes
               n|0x8000 read one more word, fill (n & 0x7FFF) bytes with AL

Nothing here is guessed and nothing runs: the directory gives the sectors, the
INT 80h shim gives the file offset, and the loop above gives the encoding. If
the reconstruction were wrong about any of them the picture would not come out.

    python tools/decode_screen.py            # every screen asset
    python tools/decode_screen.py 9 13       # just these
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, "Tapper")
OUT = os.path.join(ROOT, "screens")

ASSET_TABLE = 0x05B1     # 15 entries, 4 bytes: word LSN, word byte count
FIRST_LSN = 27           # the INT 80h shim maps LSN -> (LSN - 27) * 512
SECTOR = 512
ORG = 0x100

# Which page uses which screen id, and what mode 0 maps that id to. Both tables
# are in the binary; this is only their intersection, written out.
THEMES = [
    ("saloon",  1, 1, "Saloon Western"),
    ("sports",  3, 2, "Bar olahraga"),
    ("punk",    7, 3, "Bar punk rock"),
    ("space",  12, 4, "Bar luar angkasa"),
]


def load(name):
    return open(os.path.join(GAME, name), "rb").read()


def asset_entry(com, index):
    a = ASSET_TABLE + index * 4 - ORG
    lsn = com[a] | (com[a + 1] << 8)
    length = com[a + 2] | (com[a + 3] << 8)
    return lsn, length


def read_asset(com, dat, index):
    lsn, length = asset_entry(com, index)
    off = (lsn - FIRST_LSN) * SECTOR
    if off < 0 or off + length > len(dat):
        raise ValueError(f"asset {index}: LSN {lsn} is outside the image")
    return dat[off:off + length]


def unpack(blob):
    """Reproduce CS:2DB5 exactly. Returns a 16 KB CGA page."""
    page = bytearray(0x4000)
    if len(blob) < 0x13:
        raise ValueError("asset too short to hold a header")
    if not (blob[1] & 8):                       # [0x4001] bit 3
        return bytearray(blob[:0x4000].ljust(0x4000, b"\0"))
    si, di = 0x12, 0
    while True:
        if si + 1 >= len(blob):
            break
        tok = blob[si] | (blob[si + 1] << 8)
        si += 2
        if tok == 0x0000:
            break
        if tok == 0xFFFF:
            di = 0x2000
            continue
        if tok & 0x8000:
            n = tok - 0x8000
            fill = blob[si]
            si += 2                             # lodsw consumes a whole word
            for _ in range(n):
                if di >= len(page):
                    break
                page[di] = fill
                di += 1
        else:
            for _ in range(tok):
                if si >= len(blob) or di >= len(page):
                    break
                page[di] = blob[si]
                si += 1
                di += 1
    return page


def main():
    com, dat = load("TAPPER.COM"), load("TAPPER.DAT")
    wanted = [int(a) for a in sys.argv[1:]]
    os.makedirs(OUT, exist_ok=True)

    jobs = [(t, aid) for t in THEMES for aid in [None]]
    if wanted:
        jobs = [((f"asset{a:02d}", None, None, f"aset {a}"), a) for a in wanted]
    else:
        # mode 0's table: screen id -> asset index.
        aux0 = {i: com[0x3C21 + i - ORG] for i in range(7)}
        jobs = [(t, aux0[t[2]]) for t in THEMES]

    for (slug, page, sid, label), asset in jobs:
        blob = read_asset(com, dat, asset)
        lsn, length = asset_entry(com, asset)
        page_data = unpack(blob)
        rows = cga.decode_2bpp(page_data, palette=cga.PAL1_HI)
        path = os.path.join(OUT, f"{slug}.png")
        w, h = cga.save_png(rows, path, scale=2)
        packed = "RLE" if (blob[1] & 8) else "verbatim"
        print(f"  {label:<18} halaman {str(page):>2}  id {sid}  "
              f"aset {asset:2d}  LSN {lsn:3d}  {length:5d} B {packed:8} -> "
              f"{os.path.relpath(path, ROOT)} ({w}x{h})")


if __name__ == "__main__":
    main()
