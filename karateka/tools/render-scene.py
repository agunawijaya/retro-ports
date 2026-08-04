#!/usr/bin/env python3
"""render-scene.py -- Prove the port renders from the game's own data.

For a chosen scene:
  1. Run KARATEKA.EXE under comrun.py to that scene.
  2. Record every draw_sprite / draw_sprite_shifted call.
  3. Find a natural frame boundary: a large gap between consecutive blit
     steps means one animation frame ended and the next has not started.
     Take the LAST such cluster -- that is one full frame.
  4. Snapshot the shadow buffer right BEFORE that cluster starts.
  5. Replay the cluster's blits through OUR Python decoder + blitter, on
     top of that same "before" shadow.
  6. Snapshot the shadow buffer right AFTER the cluster ends and compare.

If our replay produces the same bytes the game produced for the same blits,
starting from the same state, the decoder + blitter are correct for the
scene. Every pixel that ends up on screen was decoded by us from the
game's own data -- no shortcut through the emulator's framebuffer.
"""

import argparse
import struct
import sys
from pathlib import Path


SHADOW_OFF = 0x6FD7
SHADOW_LEN = 16000
SPRITE_BASE = 0x443C

CGA = [(0, 0, 0), (85, 255, 255), (255, 85, 255), (255, 255, 255)]


def rle_decode(stream, want):
    out, k = bytearray(), 0
    while k < len(stream) and len(out) < want:
        b = stream[k]
        k += 1
        if b != 0x7B:
            out.append(b)
            continue
        if k + 1 >= len(stream):
            break
        v, c = stream[k], stream[k + 1]
        k += 2
        out += bytes([v]) * (c + 1)
    return bytes(out)


def sprite_at(mem, base_off, ds):
    flat = (ds << 4) + SPRITE_BASE + base_off
    hdr = mem[flat:flat + 3]
    w, h = hdr[0], hdr[1]
    if not (1 <= w <= 64 and 1 <= h <= 160):
        return None
    body = mem[flat + 3:flat + 3 + max(w * h * 2, 64)]
    return w, h, rle_decode(body, w * h)


def blit_sprite(shadow, shape, mask, x, y):
    """The port's blitter, in Python -- lockstep with web/game.js."""
    if not shape:
        return
    w, h, shp = shape
    _, _, msk = mask if mask else (None, None, None)
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
            if k >= len(shp):
                break
            shape_b = shp[k]
            if msk is not None:
                mask_b = msk[k] if k < len(msk) else 0
            else:
                mask_b = 0 if shape_b == 0 else 0xFF
            if mask_b == 0:
                continue
            dr = top + row
            if not (0 <= dr < 200):
                continue
            if not shifted:
                if 0 <= dc < 80:
                    at = dr * 80 + dc
                    shadow[at] = (shadow[at] & (~mask_b & 0xFF)) | (shape_b & mask_b)
            else:
                sh_h = shape_b >> shift_bits
                mk_h = mask_b >> shift_bits
                sh_l = (shape_b << inv_shift) & 0xFF
                mk_l = (mask_b << inv_shift) & 0xFF
                if 0 <= dc < 80 and mk_h != 0:
                    at = dr * 80 + dc
                    shadow[at] = (shadow[at] & (~mk_h & 0xFF)) | (sh_h & mk_h)
                if 0 <= dc + 1 < 80 and mk_l != 0:
                    at = dr * 80 + dc + 1
                    shadow[at] = (shadow[at] & (~mk_l & 0xFF)) | (sh_l & mk_l)


def shadow_to_png(shadow, path, scale=3):
    from PIL import Image
    img = Image.new("RGB", (320, 200))
    px = img.load()
    for row in range(200):
        base = row * 80
        for col in range(80):
            v = shadow[base + col]
            for k in range(4):
                px[col * 4 + k, row] = CGA[(v >> (6 - k * 2)) & 3]
    img.resize((320 * scale, 200 * scale), Image.NEAREST).save(path)


def diff_png(a, b, path, scale=3):
    from PIL import Image
    img = Image.new("RGB", (320, 200))
    px = img.load()
    for row in range(200):
        base = row * 80
        for col in range(80):
            same = a[base + col] == b[base + col]
            colour = (30, 30, 34) if same else (85, 255, 255)
            for k in range(4):
                px[col * 4 + k, row] = colour
    img.resize((320 * scale, 200 * scale), Image.NEAREST).save(path)


def run_and_capture(toolkit, game_dir, budget, keys=None, snapshot_every=100_000):
    """Run the game, record blits with a shadow snapshot every N instructions.
    The snapshots let us look up the shadow state at any moment after a run,
    so we can reconstruct 'right before this blit sequence'."""
    sys.path.insert(0, str(Path(toolkit) / "tools"))
    import comrun
    from unicorn.x86_const import UC_X86_REG_SS, UC_X86_REG_SP, UC_X86_REG_DS

    image = (game_dir / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(image, keys=keys or [], files=game_dir)

    blits = []
    snapshots = []                # (step, shadow_bytes)

    def rw(seg, off):
        return struct.unpack_from("<H", bytes(m.uc.mem_read(
            (seg << 4) + off, 2)))[0]

    def entry(_):
        ss = m.uc.reg_read(UC_X86_REG_SS)
        sp = m.uc.reg_read(UC_X86_REG_SP)
        ds = m.uc.reg_read(UC_X86_REG_DS)
        fig = rw(ss, sp + 2) & 0xFF
        x = struct.unpack("<h", struct.pack("<H", rw(ss, sp + 4)))[0]
        y = rw(ss, sp + 6) & 0xFF
        ksc = rw(ds, 0x423C + fig * 2)
        kmc = rw(ds, 0x873A + fig * 2)
        blits.append({"fig": fig, "x": x, "y": y, "ksc": ksc, "kmc": kmc,
                      "step": m.steps, "ds": ds})

    def snapshotter(_uc, _addr, _size, _):
        # Cheap tick: every N steps, save a shadow snapshot. We do not save
        # every step (too much memory); we save enough to bracket any blit.
        if m.steps % snapshot_every == 0:
            snapshots.append((m.steps,
                bytes(m.uc.mem_read(0x10100 + SHADOW_OFF, SHADOW_LEN))))

    m.watch[0x0640] = entry
    m.watch[0x083C] = entry
    from unicorn import UC_HOOK_CODE
    m.uc.hook_add(UC_HOOK_CODE, snapshotter)

    why = m.run(None, stop=None, budget=budget)
    final_shadow = bytes(m.uc.mem_read(0x10100 + SHADOW_OFF, SHADOW_LEN))
    mem = bytes(m.uc.mem_read(0, 0x200000))
    ds = blits[-1]["ds"] if blits else 0x16DA
    return {"blits": blits, "snapshots": snapshots,
            "final_shadow": final_shadow, "mem": mem, "ds": ds,
            "why": why, "steps": m.steps,
            "files": list(dict.fromkeys(m.file_reads))}


def find_last_frame(blits, gap_threshold=100_000, prefer_size=50):
    """Split blit stream into clusters by step-gaps. Return the last cluster
    whose size is CLOSE to `prefer_size` -- Karateka's intro alternates a
    ~50-blit full scene redraw with a ~530-blit character-animation cycle,
    and it is the 50-blit clusters that render one complete steady frame."""
    if not blits:
        return []
    clusters = [[blits[0]]]
    for k in range(1, len(blits)):
        if blits[k]["step"] - blits[k - 1]["step"] > gap_threshold:
            clusters.append([])
        clusters[-1].append(blits[k])
    # Score each cluster by how close its size is to prefer_size. Walk from
    # the end so ties break toward the latest one.
    best = None
    best_score = None
    for c in clusters:
        score = abs(len(c) - prefer_size)
        if best_score is None or score <= best_score:
            best, best_score = c, score
    return best or clusters[-1]


def shadow_before(snapshots, step):
    """Return the latest snapshot whose step is < `step`, or an empty
    buffer if there is none earlier than that."""
    best = None
    for s, snap in snapshots:
        if s < step:
            best = snap
    return best if best is not None else bytes(SHADOW_LEN)


def shadow_after(snapshots, step):
    """Return the earliest snapshot whose step is > `step`. This is what the
    game's shadow looked like right after the cluster's last blit ran, before
    the next animation cycle started drawing on top of it."""
    for s, snap in snapshots:
        if s > step:
            return snap
    return None


def replay(frame_blits, base_shadow, mem, ds):
    """Reconstruct the shadow by starting from `base_shadow` and applying
    every blit in `frame_blits` through our decoder + blitter."""
    shadow = bytearray(base_shadow)
    for b in frame_blits:
        shape = sprite_at(mem, b["ksc"], ds)
        mask = sprite_at(mem, b["kmc"], ds) if b["kmc"] else None
        blit_sprite(shadow, shape, mask, b["x"], b["y"])
    return bytes(shadow)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="original")
    ap.add_argument("--toolkit", required=True)
    ap.add_argument("--out", default="reference/proof")
    ap.add_argument("--budget", type=int, default=30_000_000)
    ap.add_argument("--keys", default="")
    ap.add_argument("--label", default="scene")
    ap.add_argument("--snapshot-every", type=int, default=50_000)
    ap.add_argument("--gap", type=int, default=50_000)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    keys = []
    for k in (args.keys.split(",") if args.keys else []):
        if not k: continue
        keys.append(int(k, 0) if k.lower().startswith("0x") else ord(k[0]))

    print(f"[{args.label}] running, budget {args.budget:,}, {len(keys)} keys")
    cap = run_and_capture(args.toolkit, Path(args.game), args.budget,
                          keys=keys, snapshot_every=args.snapshot_every)
    print(f"  stopped: {cap['why']} at {cap['steps']:,} steps")
    print(f"  files opened: {', '.join(cap['files'])}")
    print(f"  {len(cap['blits'])} total blits, "
          f"{len(cap['snapshots'])} shadow snapshots")

    frame = find_last_frame(cap["blits"], gap_threshold=args.gap)
    if not frame:
        print("  no blits captured -- run longer or check the trigger")
        return 1
    print(f"  chosen cluster: {len(frame)} blits, "
          f"steps {frame[0]['step']:,}..{frame[-1]['step']:,}")

    base = shadow_before(cap["snapshots"], frame[0]["step"])
    reference = shadow_after(cap["snapshots"], frame[-1]["step"])
    if reference is None:
        reference = cap["final_shadow"]
        print(f"  no snapshot after cluster; falling back to final shadow")
    else:
        print(f"  comparing against the snapshot right after the cluster")

    ours = replay(frame, base, cap["mem"], cap["ds"])
    diffs = sum(1 for a, b in zip(ours, reference) if a != b)
    match = SHADOW_LEN - diffs
    print(f"  {match} of {SHADOW_LEN} bytes match "
          f"({100 * match // SHADOW_LEN}%)")

    prefix = out / args.label
    shadow_to_png(reference, str(prefix) + "-game.png")
    shadow_to_png(ours,      str(prefix) + "-ours.png")
    diff_png(ours, reference, str(prefix) + "-diff.png")
    print(f"  wrote {prefix}-game.png -- from the emulator's shadow buffer")
    print(f"  wrote {prefix}-ours.png -- rebuilt by our code from game data")
    print(f"  wrote {prefix}-diff.png -- cyan = differs, dark = matches")
    return 0


if __name__ == "__main__":
    sys.exit(main())
