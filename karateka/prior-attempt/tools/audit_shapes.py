"""Audit shape resolution across all scripts and packs."""
import re
import sys
from pathlib import Path
from collections import Counter, defaultdict

sys.path.insert(0, str(Path(__file__).parent))
from extract_karateka import parse_ind

HERE = Path(__file__).parent

# 1. Collect every (shape_id, x, y) reference from every script
script_pat = re.compile(r"(set_fig|chg_fig|init_fig)\s*,\s*([\d\s]+)")
shape_uses = []  # list of (script_name, op, shape_id, args)
shape_count = Counter()
for f in sorted(HERE.glob("CAL*")) + sorted(HERE.glob("BAL*")) + sorted(HERE.glob("ALL*")):
    if f.suffix.upper() == ".BAK": continue
    try:
        text = f.read_text(errors="replace")
    except: continue
    for m in script_pat.finditer(text):
        op = m.group(1)
        nums = [int(t) for t in m.group(2).split() if t.isdigit()]
        if not nums: continue
        if op == "chg_fig":
            # chg_fig: actor_idx shape_id x y
            if len(nums) >= 2:
                shape_uses.append((f.name, op, nums[1], nums[2:]))
                shape_count[nums[1]] += 1
        else:
            # set_fig: shape_id x y
            shape_uses.append((f.name, op, nums[0], nums[1:]))
            shape_count[nums[0]] += 1

print(f"Total shape references: {len(shape_uses)}")
print(f"Unique shape IDs used:  {len(shape_count)}")
print()

# 2. Build a global low-byte -> [(pack, full_id)] index
packs_by_lowbyte = defaultdict(list)
all_full_ids = set()
for ind in sorted(HERE.glob("*.IND")):
    for e in parse_ind(ind.read_bytes()):
        if e.sprite_id == 0xFFFF: continue
        all_full_ids.add((ind.stem, e.sprite_id))
        packs_by_lowbyte[e.sprite_id & 0xFF].append((ind.stem, e.sprite_id))

# 3. For each unique shape_id in scripts, show whether/where it resolves
print(f"{'shape':>5} {'uses':>5}  {'low':>4}  resolves to (pack:full_id)")
unresolved = []
for shape_id, uses in shape_count.most_common():
    low = shape_id & 0xFF
    matches = packs_by_lowbyte.get(low, [])
    if matches:
        # show all matches
        match_str = ", ".join(f"{p}:0x{fid:04X}" for p, fid in matches[:5])
        if len(matches) > 5:
            match_str += f" (+{len(matches)-5} more)"
        print(f"  {shape_id:>3} {uses:>5}  0x{low:02X}  {match_str}")
    else:
        unresolved.append(shape_id)
        print(f"  {shape_id:>3} {uses:>5}  0x{low:02X}  -- NOT FOUND in any pack --")

print(f"\nUnresolved shapes ({len(unresolved)}): {sorted(unresolved)}")

# 4. For UNRESOLVED shapes, look in EXE static data
# We'll just dump those bytes and see if there's anything sprite-like.
print()
print("=== Checking EXE static data for unresolved shape IDs ===")
exe = (HERE / "KARATEKA.EXE").read_bytes()
import struct
hdr_paras = struct.unpack_from("<H", exe, 8)[0]
img_start = hdr_paras * 16
img = exe[img_start:]
print(f"EXE image size: {len(img)} bytes")

# The disasm showed sprite-pack-pointer tables at DS:0x423C and DS:0x423C - 0x78C6
# = 0x423C and 0xC976 (signed wrap-around).
# These contain 16-bit pointers indexed by sprite_id*2.
# That means the EXE has TWO tables of 2*N word entries somewhere.
# Look for areas in the .EXE that look like ascending word tables.

# Simpler: just check if any UNRESOLVED shape has a sprite header pattern
# (w in 1..30, h in 1..50, anchor==1) at offset (shape * 4) within a hypothesized table.
# Without more info, list the unresolved shapes for the user.
