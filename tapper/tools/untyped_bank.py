"""Catalogue sprite_table_ptr, the one table that does not record its sizes.

Every other sprite table is a flat grid whose stride equals one sprite, so its
geometry can be measured. This one holds mixed sizes with irregular -- even
negative -- gaps, and nothing in it says how big any entry is. The size lives
at the call site: select_sprite_ptr hands back an address, and whichever
blitter the caller invokes next decides how that address is read.

So the size is recovered the only way it can be: watch. Hook
select_sprite_ptr to catch the index, then hook every blitter entry and
attribute the next one that runs to that index.

The test can fail in a way that shows: an index whose size is guessed wrong
renders sheared, and an index that never reaches a blitter is reported as
unresolved rather than assumed.

    python tools/untyped_bank.py [instructions]
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga  # noqa: E402
from trace import Machine, LOAD_SEG  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "screens")
MODE_BRANCH = 0x0732
SELECT_SPRITE_PTR = 0x2E96
SPRITE_TABLE_PTR = 0x44AB
TRANSPARENT = (44, 44, 60)

# blitter entry -> (name, bytes per row, total scanlines)
BLITTERS = {
    0x23C8: ("8x8", 2, 8),
    0x23DC: ("pickup", 4, 6),
    0x2AB0: ("12x16", 3, 16),
    0x2BE8: ("32x22", 8, 22),
    0x2CFF: ("32x16", 8, 16),
    0x2D1A: ("16x16", 4, 16),
    0x2D39: ("24x22", 6, 22),
    0x3136: ("16x12", 4, 12),
}


def render(mem, data, mask, bpr, rows):
    half = bpr * (rows // 2)
    px = []
    for y in range(rows):
        bank, r = y & 1, y >> 1
        o = bank * half + r * bpr
        for x in range(bpr):
            db, mb = mem[data + o + x], mem[mask + o + x]
            for s in (6, 4, 2, 0):
                dv, mv = (db >> s) & 3, (mb >> s) & 3
                px.append(TRANSPARENT if mv == 3 else cga.PAL1_HI[dv])
    return px


ASM = os.path.join(ROOT, "src", "tapper.asm")

# Routines that are themselves a blitter wrapper, so a call to them fixes the
# size just as a direct blitter call would.
WRAPPERS = {"draw_node_16x16": "16x16", "draw_sprite_32x16": "32x16"}
BLIT_NAMES = {f"blit_sprite_{n}": n for n in
              ("8x8", "12x16", "16x12", "16x16", "24x22", "32x16", "32x22")}
BLIT_NAMES["blit_pickup_sprite"] = "pickup"
BLIT_NAMES.update(WRAPPERS)


# The four fill_frame_ptrs loops at CS:083E, 0850, 0864 and 0878 defeat the
# scanner below: their `mov al` sits *before* the loop head and `inc al` walks
# the index inside the body, so no immediate appears next to the call. They are
# read here instead, from the listing:
#
#   0836  mov al, 0x10 / mov bx, 0x40bc / mov cx, 3   -> 0x10, 0x11, 0x12
#   084A  mov cx, 3    / mov bx, 0x40c6               -> 0x13, 0x14, 0x15  (AL
#                                                        carries on, no reload)
#   085C  mov al, 1    / mov bx, 0x40b0 / mov cx, 2   -> 1, 2
#   0876  mov al, 3    / mov bx, 0x40b6 / mov cx, 2   -> 3, 4
#
# All four fill the frame lists at 0x40B0..0x40C6, and render_frame walks those
# through frame_list_cursor at CS:1E96, dereferences one, and hands it to
# blit_sprite_8x8 at CS:1EA9. So every index they load is an 8x8 sprite.
FRAME_LIST_INDICES = [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 1, 2, 3, 4]

# The remaining call sites compute AL from a base plus a condition, so the
# index is a small set rather than one immediate. Each range below was read
# from the listing, and each size from the blitter the value reaches:
#
#   CS:1CB6  mov al, 5 / inc al if the facing bit is clear      -> 5, 6
#            stored at node +4, drawn at served_mug_draw CS:2376
#            with cx = 6 -> 6 rows a bank, 12 scanlines, 4 bytes wide
#
#   CS:22FE  mov al, 7 / inc al if [bx+6] <= 0 / add al, 2 if
#            cycle_countdown == 2                               -> 7, 8, 9, 10
#            drawn by the inline loop at CS:2313, mask [bp+0x30]
#            = 48 = 4 x 12, cx = 6 -- the same 16x12 shape
#
#   CS:19AF  mov al, 0x18 / inc al if bar_direction is set      -> 24, 25
#            followed directly by blit_sprite_16x16 at CS:19CB
#
# Index 5 also appears from an immediate at CS:3117 and resolves to 16x12
# there too, which is the one place these two methods overlap and agree.
COMPUTED_SITES = {
    "16x12": [5, 6, 7, 8, 9, 10],
    "16x16": [24, 25],
}

# Indices 12 and 23 have no call site at all -- no immediate, no computed
# range reaches them. Their size comes from the layout instead.
#
# Sorting the entries by address and measuring each one's extent shows every
# entry occupies exactly twice its sprite's data size, because data and mask
# sit together: 32 for 8x8, 96 for 16x12 and 12x16, 128 for 16x16, 352 for
# 32x22. That holds for 20 of the 23 entries whose size is already known.
#
# Both 12 and 23 measure 128, the same extent as their confirmed 16x16
# neighbours 22 and 24. The render is the check: a wrong size shears.
LAYOUT_DERIVED = {12: "16x16", 23: "16x16"}


def static_sizes():
    """Recover index -> size by reading the call sites instead of running them.

    A 400M-instruction trace resolved one index out of 25: the paths that use
    the rest are simply not reached. But most call sites load AL with an
    immediate a line or two before the call, and the blitter that follows is
    right there in the listing, so the pairing can be read off the source.

    Only immediates are taken. Sites that compute AL are skipped rather than
    guessed, and reported as such.
    """
    import re
    mov_al = re.compile(r"^\s+mov al, (0x[0-9a-f]+|\d+)\s")
    call = re.compile(r"^\s+call near (\w+)\s")
    lines = open(ASM).read().splitlines()
    out, computed = {}, 0
    for i, line in enumerate(lines):
        m = call.match(line)
        if not m or m.group(1) != "select_sprite_ptr":
            continue
        idx = None
        for j in range(i - 1, max(i - 7, 0), -1):
            mm = mov_al.match(lines[j])
            if mm:
                idx = int(mm.group(1), 0)
                break
            if call.match(lines[j]):
                break
        if idx is None:
            computed += 1
            continue
        for j in range(i + 1, min(i + 14, len(lines))):
            mc = call.match(lines[j])
            if mc and mc.group(1) in BLIT_NAMES:
                out.setdefault(idx & 0x7F, set()).add(BLIT_NAMES[mc.group(1)])
                break
            if mc and mc.group(1) == "select_sprite_ptr":
                break
    for i in FRAME_LIST_INDICES:
        out.setdefault(i, set()).add("8x8")
    for size, idxs in COMPUTED_SITES.items():
        for i in idxs:
            out.setdefault(i, set()).add(size)
    for i, size in LAYOUT_DERIVED.items():
        out.setdefault(i, set()).add(size)
    print(f"static: {len(out)} indices "
          f"({len(FRAME_LIST_INDICES)} from the frame-list loops, "
          f"{sum(len(v) for v in COMPUTED_SITES.values())} from computed "
          f"sites), {computed} call sites matched no immediate")
    return out


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 400_000_000
    m = Machine()
    m.load("TAPPER.COM")
    m.keys = [0x13] + [0x39] * 4000
    orig, done, pending = m._on_exec, [False], [None]
    sizes = defaultdict(set)

    def hook(cpu, seg, off):
        orig(cpu, seg, off)
        if seg != LOAD_SEG:
            return
        if off == MODE_BRANCH and not done[0]:
            cpu.w8(0, 1)
            done[0] = True
        elif off == SELECT_SPRITE_PTR:
            pending[0] = cpu.r8(0) & 0x7F
        elif off in BLITTERS and pending[0] is not None:
            sizes[pending[0]].add(BLITTERS[off][0])
            pending[0] = None

    m.cpu.on_exec = hook
    reason = m.run(limit)
    print(f"ran {m.cpu.icount:,} instructions ({reason})")

    table = m.cpu.rd16(LOAD_SEG, SPRITE_TABLE_PTR)
    n = m.cpu.rd16(LOAD_SEG, table)
    seg = LOAD_SEG << 4
    print(f"sprite_table_ptr at {table:04X}, {n} entries\n")

    print(f"runtime: {len(sizes)} indices reached a blitter")
    merged = static_sizes()
    for i, s in sizes.items():
        merged.setdefault(i, set()).update(s)

    # sprite_index_in_range does `cmp [bx], ax` / `jb`, so it rejects only
    # indices strictly greater than the count -- index n itself is served.
    # Entries run 1..n; index 0 would read the count word as a pointer.
    resolved = {i: s for i, s in merged.items() if len(s) == 1 and 1 <= i <= n}
    print("\nindex -> size:")
    for i in sorted(merged):
        why = "runtime" if i in sizes else "static "
        tag = "" if i in resolved else "   <- ambiguous or out of range"
        print(f"  {i:3d}  {why}  {', '.join(sorted(merged[i]))}{tag}")
    print(f"\n{len(resolved)}/{len(merged)} indices resolved to one size")

    geom = {v[0]: v[1:] for v in BLITTERS.values()}
    from PIL import Image, ImageDraw
    scale, pad, label_h, per_row = 3, 6, 12, 8
    cell_w = max(g[0] * 4 for g in geom.values()) * scale + pad
    cell_h = max(g[1] for g in geom.values()) * scale + pad + label_h
    items = sorted(resolved)
    cols = min(len(items), per_row)
    rn = (len(items) + per_row - 1) // per_row
    sheet = Image.new("RGB", (cols * cell_w + pad, rn * cell_h + pad),
                      (18, 18, 24))
    draw = ImageDraw.Draw(sheet)

    def entry(i):
        return table + m.cpu.rd16(LOAD_SEG, table + i * 2)

    for k, i in enumerate(items):
        name = next(iter(resolved[i]))
        bpr, rows = geom[name]
        img = Image.new("RGB", (bpr * 4, rows))
        img.putdata(render(m.mem, seg + entry(i), seg + entry(i) + bpr * rows,
                           bpr, rows))
        x = pad + (k % per_row) * cell_w
        y = pad + (k // per_row) * cell_h
        sheet.paste(img.resize((bpr * 4 * scale, rows * scale), Image.NEAREST),
                    (x, y + label_h))
        draw.text((x, y), f"{i} {name}", fill=(170, 170, 190))

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "sprites_untyped.png")
    sheet.save(path)
    print(f"wrote {os.path.relpath(path, ROOT)} ({len(items)} images)")


if __name__ == "__main__":
    main()
