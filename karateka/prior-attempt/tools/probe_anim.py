"""Probe the unknown animation-script files to find composition lists.

From disasm @ image+0xBD5:
    each entry is 4 bytes: shape_id_byte, dx_lo, dx_hi, count_byte
    terminator: shape_id_byte == 0xFF

We hex-dump each candidate file, scan for 0xFF terminators at offset%4==0,
and count "valid-looking" lists (lists whose entry shape IDs match known
sprite IDs from the K* packs).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from extract_karateka import parse_ind

here = Path(__file__).parent

# Collect every valid sprite ID across all .IND files.
known_ids = set()
for ind in here.glob("*.IND"):
    for e in parse_ind(ind.read_bytes()):
        known_ids.add(e.sprite_id)
        # Also accept just the low byte, since the in-memory list stored byte not word
        known_ids.add(e.sprite_id & 0xFF)
print(f"Loaded {len(known_ids)} known sprite IDs across all packs")
print()

# Files to probe
candidates = sorted(set(here.glob("ALL*")) | set(here.glob("BAL*")) | set(here.glob("CAL*")))
print(f"{'file':<14} {'size':>6}  first 48 bytes (hex)")
for f in candidates:
    if f.suffix.upper() == ".BAK": continue
    b = f.read_bytes()
    head = " ".join(f"{x:02X}" for x in b[:48])
    print(f"  {f.name:<12} {len(b):>6}  {head}")
print()

# For each file: try to walk it as a sequence of 4-byte entries terminated by 0xFF.
# Print summary of lists found.
def probe_lists(data: bytes) -> list[list[tuple[int,int,int,int]]]:
    lists = []
    i = 0
    cur = []
    while i < len(data):
        b0 = data[i]
        if b0 == 0xFF:
            if cur:
                lists.append(cur)
                cur = []
            i += 1  # consume just the 0xFF
            continue
        if i + 3 >= len(data):
            break
        shape_id = b0
        dx       = data[i + 1] | (data[i + 2] << 8)
        count    = data[i + 3]
        cur.append((shape_id, dx, count, i))
        i += 4
    if cur:
        lists.append(cur)
    return lists

print("=== File-by-file: lists found (assuming 4-byte entries + 0xFF terminator) ===")
for f in candidates:
    if f.suffix.upper() == ".BAK": continue
    if f.stat().st_size > 12000: continue   # skip palette
    data = f.read_bytes()
    lists = probe_lists(data)
    if not lists:
        print(f"  {f.name:<12} no valid lists")
        continue
    # Score: how many entries reference KNOWN sprite IDs?
    total_entries = sum(len(L) for L in lists)
    valid_entries = sum(1 for L in lists for (sid, *_) in L if sid in known_ids)
    pct = 100 * valid_entries / total_entries if total_entries else 0
    lengths = [len(L) for L in lists]
    print(f"  {f.name:<12}  {len(lists):>3} lists  entries={total_entries:>4}  "
          f"valid={valid_entries:>4} ({pct:>5.1f}%)  "
          f"min/med/max len = {min(lengths)}/{sorted(lengths)[len(lengths)//2]}/{max(lengths)}")

print()
print("=== Top candidate: highest-validity file gets a detailed dump ===")
# For the file with the highest validity, show its first list in detail.
best = None
best_pct = -1
for f in candidates:
    if f.suffix.upper() == ".BAK": continue
    if f.stat().st_size > 12000: continue
    data = f.read_bytes()
    lists = probe_lists(data)
    if not lists: continue
    total = sum(len(L) for L in lists)
    valid = sum(1 for L in lists for (sid, *_) in L if sid in known_ids)
    if total == 0: continue
    pct = valid / total
    if pct > best_pct:
        best_pct = pct
        best = (f, lists)

if best:
    f, lists = best
    print(f"\nBest file: {f.name}  ({best_pct*100:.1f}% valid entries)")
    print(f"Total lists in file: {len(lists)}")
    print(f"\nFirst 4 lists in detail:")
    for li, L in enumerate(lists[:4]):
        print(f"\n  List #{li} ({len(L)} entries):")
        for entry_idx, (sid, dx, count, off) in enumerate(L):
            dx_signed = dx if dx < 0x8000 else dx - 0x10000
            flag_top = "F" if dx & 0x8000 else "."
            flag_mid = "F" if dx & 0x4000 else "."
            valid_marker = "+" if sid in known_ids else "?"
            print(f"    [{entry_idx:2}] @off=0x{off:04X}  sid=0x{sid:02X}{valid_marker} "
                  f"dx={dx:04X} ({dx_signed:>5})  count={count:>3}  flags={flag_top}{flag_mid}")
