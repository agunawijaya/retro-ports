#!/usr/bin/env python3
"""port-replica.py -- run the port's scene renderer in Python for comparison.

The web port's ShadowBuffer + blitSprite + parseScenes are a byte-level
translation of what web/game.js does. This script performs the *same* work in
Python so its output can be compared, byte-for-byte, against what referee.py
captured from KARATEKA.EXE under the emulator.

The port has no cutscene playback: it draws BAL/CAL scenes as static
backdrops. So the fair comparison is scene vs scene, backdrop layer only --
if the referee snapshot shows an animated character on top, that character
will be a diff, and that is the honest answer to "does the scene match".
"""

import argparse
from pathlib import Path

CGA = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]

# --- decoder + blitter, ported straight from web/game.js ------------------

def rle_decode(stream, start, want):
    out = bytearray()
    k = start
    while k < len(stream) and len(out) < want:
        b = stream[k]; k += 1
        if b != 0x7B:
            out.append(b); continue
        if k + 1 >= len(stream): break
        v, c = stream[k], stream[k+1]; k += 2
        out += bytes([v]) * (c + 1)
    return bytes(out)


def parse_index(ind, dat_len):
    entries = []
    k = 0
    total = dat_len
    while k + 4 <= len(ind):
        rid = ind[k] | (ind[k+1] << 8)
        off = ind[k+2] | (ind[k+3] << 8)
        if rid == 0xFFFF:
            total = off
            break
        entries.append((rid, off))
        k += 4
    by_id = {}
    for i, (rid, off) in enumerate(entries):
        end = entries[i+1][1] if i + 1 < len(entries) else total
        by_id[rid] = (off, end)
    return by_id


def decode_sprite(dat, off, end):
    w, h = dat[off], dat[off+1]
    if not (1 <= w <= 64 and 1 <= h <= 160):
        return None
    body = dat[off + 3 : off + 3 + (end - off - 3)]
    return w, h, rle_decode(body, 0, w * h)


def parse_scenes(text):
    scenes = []
    cur = {"name": None, "figs": []}
    for line in text.replace("\r", "").split("\n"):
        line = line.strip()
        if not line: continue
        verb, _, args = line.partition(",")
        parts = args.strip().split()
        if verb == "set_fig":
            cur["figs"].append({
                "id": int(parts[0]),
                "x":  int(parts[1]),
                "y":  int(parts[2]),
            })
            if len(parts) >= 4 and cur["name"] is None:
                cur["name"] = parts[3]
        elif verb == "end_animation":
            if cur["figs"]:
                scenes.append(cur)
                cur = {"name": None, "figs": []}
    if cur["figs"]:
        scenes.append(cur)
    return scenes


def parse_backdrop(data):
    n = data[0] | (data[1] << 8)
    return {"width": 320, "height": n // 80, "bytes": data[2:2+n]}


class ShadowBuffer:
    def __init__(self): self.bytes = bytearray(80 * 200)
    def clear(self, v=0): self.bytes = bytearray([v] * (80 * 200))

    def blit_backdrop(self, bcg, y=0):
        for row in range(bcg["height"]):
            src = row * 80
            dst = (y + row) * 80
            if dst < 0 or dst + 80 > len(self.bytes): continue
            self.bytes[dst:dst+80] = bcg["bytes"][src:src+80]

    def blit_sprite(self, shape, mask, x, y):
        if not shape: return
        w, h, shp = shape
        msk = mask[2] if mask else None
        top = y - h
        dst_col = x >> 2
        shift_bits = (x & 3) << 1
        inv_shift = 8 - shift_bits
        shifted = shift_bits != 0
        for col in range(w):
            cbase = col * h
            dc = dst_col + col
            for row in range(h):
                k = cbase + row
                if k >= len(shp): break
                shape_b = shp[k]
                if msk is not None:
                    mask_b = msk[k] if k < len(msk) else 0
                else:
                    # No mask means opaque -- verified against the game's
                    # own render of fig 200/206 at y=180, where shape bytes
                    # of 0x00 write black over the plateau. Treating 0 as
                    # transparent (the previous behaviour) left plateau
                    # showing through and cost ~6 bytes per ground row.
                    mask_b = 0xFF
                if mask_b == 0: continue
                dr = top + row
                if not (0 <= dr < 200): continue
                if not shifted:
                    if 0 <= dc < 80:
                        at = dr * 80 + dc
                        self.bytes[at] = (self.bytes[at] & (~mask_b & 0xFF)) | (shape_b & mask_b)
                else:
                    sh_h = shape_b >> shift_bits
                    mk_h = mask_b >> shift_bits
                    sh_l = (shape_b << inv_shift) & 0xFF
                    mk_l = (mask_b << inv_shift) & 0xFF
                    if 0 <= dc < 80 and mk_h != 0:
                        at = dr * 80 + dc
                        self.bytes[at] = (self.bytes[at] & (~mk_h & 0xFF)) | (sh_h & mk_h)
                    if 0 <= dc + 1 < 80 and mk_l != 0:
                        at = dr * 80 + dc + 1
                        self.bytes[at] = (self.bytes[at] & (~mk_l & 0xFF)) | (sh_l & mk_l)


def to_png(shadow, path, scale=3):
    from PIL import Image
    img = Image.new("RGB", (320, 200))
    px = img.load()
    for row in range(200):
        base = row * 80
        for col in range(80):
            v = shadow.bytes[base + col]
            for k in range(4):
                px[col * 4 + k, row] = CGA[(v >> (6 - k * 2)) & 3]
    img.resize((320 * scale, 200 * scale), Image.NEAREST).save(path)


# --- scene rendering, mirroring web/game.js ------------------------------

# Same pack-list mapping as web/game.js SCENE_PACKS.
SCENE_PACKS = {
    "BAL00": ("KS0", "KM0"),
    "BAL01": ("KS1", "KM1"),
    "BAL02": ("KS2", "KM2"),
    "BAL03": ("KS3", "KM3"),
}


def load_packs(game_dir, stems):
    packs = {}
    for stem in stems:
        ind_path = game_dir / (stem + ".IND")
        dat_path = game_dir / (stem + ".DAT")
        if not ind_path.exists() or not dat_path.exists(): continue
        ind = ind_path.read_bytes()
        dat = dat_path.read_bytes()
        packs[stem] = {"byId": parse_index(ind, len(dat)), "dat": dat}
    return packs


def lookup(packs, stems, ind_id):
    for stem in stems:
        p = packs.get(stem)
        if not p: continue
        rec = p["byId"].get(ind_id)
        if rec:
            return decode_sprite(p["dat"], rec[0], rec[1])
    return None


def render_scene(game_dir, scene_name, backdrop_name, out_path, extras=None):
    """extras: optional list of dicts {id, x, y} drawn on top of the scene
    with the same pack list, simulating a character over the backdrop."""
    packs = load_packs(game_dir, ["KSC", "KMC",
                                   "KS0", "KM0", "KS1", "KM1",
                                   "KS2", "KM2", "KS3", "KM3",
                                   "KS4", "KM4", "KSI0", "KMI0"])
    scenes = parse_scenes((game_dir / scene_name).read_text())
    if not scenes:
        print(f"  no scenes in {scene_name}")
        return None

    scene = scenes[0]
    shape_stems, mask_stems = SCENE_PACKS.get(scene_name, ("KSC", "KMC"))
    shape_list = [shape_stems, "KSC"]
    mask_list  = [mask_stems,  "KMC"]

    bcg = parse_backdrop((game_dir / backdrop_name).read_bytes())
    # Scene layout measured against the game's own pre-BAL00 shadow (the
    # snap right before draw_sprite fires for fig 200). The order is
    # sky-fill -> plateau-fill -> BCG -> post-BCG cleanup -> BAL figs:
    #   Y=0..107        0x55 (four cyan pixels per byte)
    #   Y=154..181      alternating even=0x99, odd=0x66 dither
    #   FUJI.BCG        drawn at Y=80 (horizon offset)
    #   Y=106           overwritten to 0xFF (white horizon rail)
    #   Y=107..109      overwritten to 0x00 (fence shadow)
    #   Y=114           overwritten to 0x00 (base of horizon; FUJI's last row
    #                   is cyan and would otherwise leak through)
    # CASTLE.BCG is near-full-screen and goes at Y=0 with no overlays.
    is_fuji = backdrop_name == "FUJI.BCG"
    bcg_y = 80 if is_fuji else 0
    shadow = ShadowBuffer()
    shadow.clear()
    for row in range(0, 108):
        for col in range(80): shadow.bytes[row*80 + col] = 0x55
    for row in range(154, 184):
        v = 0x99 if row % 2 == 0 else 0x66
        for col in range(80): shadow.bytes[row*80 + col] = v
    shadow.blit_backdrop(bcg, y=bcg_y)
    if is_fuji:
        for col in range(80): shadow.bytes[106*80 + col] = 0xFF
        for row in (107, 108, 109, 114):
            for col in range(80): shadow.bytes[row*80 + col] = 0x00
    for fig in scene["figs"]:
        px = fig["x"]                              # camera at 0
        if px < -256 or px > 320: continue
        sh = lookup(packs, shape_list, 0x100 | fig["id"])
        mk = lookup(packs, mask_list,  0x100 | fig["id"])
        shadow.blit_sprite(sh, mk, px, fig["y"])

    for fig in (extras or []):
        sh = lookup(packs, shape_list, 0x100 | fig["id"])
        mk = lookup(packs, mask_list,  0x100 | fig["id"])
        shadow.blit_sprite(sh, mk, fig["x"], fig["y"])

    to_png(shadow, out_path)
    return bytes(shadow.bytes)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="original")
    ap.add_argument("--scene", required=True, help="BAL00 / BAL01 / ...")
    ap.add_argument("--backdrop", default="FUJI.BCG")
    ap.add_argument("--out", required=True)
    ap.add_argument("--dump-bin", default=None,
                    help="also write the raw 16000-byte shadow buffer here")
    ap.add_argument("--extra", action="append", default=[],
                    help="extra fig placement 'ID,X,Y' (character overlay), "
                         "can be given multiple times")
    args = ap.parse_args()

    extras = []
    for e in args.extra:
        parts = e.split(",")
        extras.append({"id": int(parts[0]), "x": int(parts[1]), "y": int(parts[2])})

    game_dir = Path(args.game)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    shadow_bytes = render_scene(game_dir, args.scene, args.backdrop, out, extras=extras)
    if args.dump_bin and shadow_bytes:
        Path(args.dump_bin).parent.mkdir(parents=True, exist_ok=True)
        Path(args.dump_bin).write_bytes(shadow_bytes)
        print(f"wrote {args.dump_bin}")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
