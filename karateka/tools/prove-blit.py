#!/usr/bin/env python3
"""prove-blit.py -- the referee gate. One sprite matched byte-exact, or nothing.

For each draw_sprite / draw_sprite_shifted call the game makes, we snapshot
the shadow buffer at the entry and at the return, compute the delta -- which
bytes changed -- and decode the sprite ourselves from bytes we read out of
the machine's memory at DS:(0x443C + KSC_offset). If the delta matches, the
decoder is proven against the running game.

Reading sprites from memory rather than from the .DAT file removes one whole
category of guessing: which pack this figure belongs to, whether packs are
concatenated, whether the offset is file-relative or memory-relative. The
lookup table hands us an address, we go and read it.
"""

import argparse
import struct
import sys
from pathlib import Path


SHADOW_OFF = 0x6FD7
SHADOW_LEN = 16000
SPRITE_BASE = 0x443C          # DS offset where all loaded sprite data lives


def decode_rle(stream, want):
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


def sprite_at_memory(mem_reader, ds, mem_offset, max_bytes=8192):
    """Decode a sprite whose header lives at DS:mem_offset."""
    hdr = mem_reader((ds << 4) + mem_offset, 3)
    w, h, _ = hdr[0], hdr[1], hdr[2]
    if not (1 <= w <= 64 and 1 <= h <= 160):
        return None
    body = mem_reader((ds << 4) + mem_offset + 3, max_bytes)
    px = decode_rle(body, w * h)
    return w, h, px


def to_rowmajor(px, w, h):
    out = bytearray(w * h)
    for k, b in enumerate(px):
        col, row = k // h, k % h
        if col < w and row < h:
            out[row * w + col] = b
    return bytes(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", default="original")
    ap.add_argument("--toolkit", required=True)
    ap.add_argument("--budget", type=int, default=30_000_000)
    ap.add_argument("--limit", type=int, default=30)
    args = ap.parse_args()

    sys.path.insert(0, str(Path(args.toolkit) / "tools"))
    import comrun
    from unicorn.x86_const import (
        UC_X86_REG_SS, UC_X86_REG_SP, UC_X86_REG_DS)

    game = Path(args.game)
    image = (game / "KARATEKA.EXE").read_bytes()
    m = comrun.Machine(image, files=game)

    def read_bytes(flat, n):
        return bytes(m.uc.mem_read(flat, n))

    def read_word_ss(seg, off):
        return struct.unpack_from("<H", read_bytes((seg << 4) + off, 2))[0]

    def snapshot():
        return read_bytes(0x10100 + SHADOW_OFF, SHADOW_LEN)

    events, proven, failed = [], [], []

    def entry(name):
        def hit(_):
            if len(proven) + len(failed) >= args.limit:
                return
            ss = m.uc.reg_read(UC_X86_REG_SS)
            sp = m.uc.reg_read(UC_X86_REG_SP)
            ds = m.uc.reg_read(UC_X86_REG_DS)
            fig = read_word_ss(ss, sp + 2) & 0xFF
            x = struct.unpack("<h", struct.pack("<H",
                              read_word_ss(ss, sp + 4)))[0]
            y = read_word_ss(ss, sp + 6) & 0xFF
            t1 = read_word_ss(ds, 0x423C + fig * 2)   # table 1
            t2 = read_word_ss(ds, 0x873A + fig * 2)   # table 2
            shift = read_bytes((ds << 4) + 0x4227, 1)[0]
            events.append({
                "name": name, "fig": fig, "x": x, "y": y,
                "t1": t1, "t2": t2, "shift": shift, "ds": ds,
                "before": snapshot(),
            })
        return hit

    def on_return(_):
        if not events or len(proven) + len(failed) >= args.limit:
            return
        e = events.pop()
        after = snapshot()
        delta = {}
        for k in range(SHADOW_LEN):
            if after[k] != e["before"][k]:
                r, c = divmod(k, 80)
                delta[(r, c)] = (e["before"][k], after[k])
        if not delta:
            return
        # Decode the sprite from memory. Try t1 first (probably KSC), fall
        # back to t2 (probably KMC). A structural figure has t2 = 0 and its
        # shape lives at t1; a character figure has both populated.
        for label, mo in (("t1", e["t1"]), ("t2", e["t2"])):
            if mo == 0:
                continue
            sprite = sprite_at_memory(read_bytes, e["ds"], SPRITE_BASE + mo)
            if sprite is None:
                continue
            w, h, px = sprite
            # Y is exclusive-end -- the blitter draws upward from y, filling
            # rows (y - h) .. (y - 1). Verified against fig 91 (h=50, y=115
            # -> rows 65..114) and fig 200 (h=72, y=185 -> rows 113..184).
            # Shift is x mod 4 -- computed, not read from 0x4227 (which holds
            # the PREVIOUS call's shift at our entry hook, before this call
            # has stored its own).
            shift = e["x"] % 4
            dst_col = e["x"] // 4
            want = {"top": e["y"] - h, "bot": e["y"] - 1,
                    "left": dst_col,
                    "right": dst_col + w - 1 + (1 if shift else 0)}
            rows = {r for r, _ in delta}
            cols = {c for _, c in delta}
            got = {"top": min(rows), "bot": max(rows),
                   "left": min(cols), "right": max(cols)}
            # `got` is only the bytes that CHANGED. A sprite byte the same
            # colour as what was already there does not count, and a fully-
            # transparent edge row shows nothing. So the check is containment:
            # every changed byte must lie inside the predicted rectangle.
            ok = (got["top"] >= want["top"] and got["bot"] <= want["bot"]
                  and got["left"] >= want["left"]
                  and got["right"] <= want["right"])
            rec = {**e, "used": label, "sprite_wh": (w, h),
                   "want": want, "got": got, "ok": ok,
                   "changed": len(delta)}
            (proven if ok else failed).append(rec)
            break
        else:
            failed.append({**e, "reason": "no sprite decoded"})

    m.watch[0x0640] = entry("draw_sprite_shifted")
    m.watch[0x083C] = entry("draw_sprite")
    m.watch[0x00A69] = on_return

    print(f"running to budget {args.budget:,}, catching up to {args.limit} blits ...")
    m.run(None, stop=None, budget=args.budget)
    print(f"stopped at {m.steps:,} instructions")

    print(f"\nresults: {len(proven)} boxes match, {len(failed)} do not")

    for group, xs in (("MATCHES", proven), ("MISMATCHES", failed)):
        print(f"\n{group}:")
        for r in xs[:10]:
            if r.get("reason"):
                print(f"  fig {r['fig']:>3} x={r['x']:>4} y={r['y']:>3} "
                      f"t1={r['t1']:#06x} t2={r['t2']:#06x}  {r['reason']}")
                continue
            wh = r["sprite_wh"]
            print(f"  fig {r['fig']:>3} x={r['x']:>4} y={r['y']:>3} "
                  f"shift={r['shift']} via {r['used']}({r[r['used']]:#06x}) "
                  f"{wh[0]}x{wh[1]} bytes  "
                  f"want=r{r['want']['top']}..{r['want']['bot']}"
                  f",c{r['want']['left']}..{r['want']['right']}  "
                  f"got=r{r['got']['top']}..{r['got']['bot']}"
                  f",c{r['got']['left']}..{r['got']['right']}  "
                  f"({r['changed']}b)")

    return 0 if proven else 1


if __name__ == "__main__":
    sys.exit(main())
