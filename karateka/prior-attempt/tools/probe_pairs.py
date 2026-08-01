#!/usr/bin/env python3
"""Probe every pair of .IND files for sprite-ID overlap.

If two .DAT files are the two halves (mask/pixel) of the same sprites,
they should share most/all sprite IDs.  This script computes |A ∩ B| / |A|
for every ordered pair and lists the top matches.
"""

import sys
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_karateka import parse_ind

game = Path(__file__).parent
inds = sorted(game.glob("*.IND"))

packs = {}
for ind in inds:
    entries = parse_ind(ind.read_bytes())
    # Drop the 0xFFFF "blank" sentinel that every pack ends with.
    real = {e.sprite_id for e in entries if e.sprite_id != 0xFFFF}
    packs[ind.stem] = real

print(f"== {len(packs)} packs scanned ==\n")
print(f"{'pack':<8} {'count':>5}  {'sample IDs (first 6)'}")
for name, ids in sorted(packs.items()):
    sample = sorted(ids)[:6]
    print(f"  {name:<6} {len(ids):>5}  {' '.join(f'{i:04X}' for i in sample)}")

print("\n== Top pair overlaps (Jaccard) ==")
overlaps = []
for a, b in combinations(packs, 2):
    A, B = packs[a], packs[b]
    inter = A & B
    union = A | B
    if not union:
        continue
    jaccard = len(inter) / len(union)
    overlaps.append((jaccard, a, b, len(inter), len(A), len(B)))
overlaps.sort(reverse=True)
print(f"  {'pack A':<6}  {'pack B':<6}  {'A&B':>6}  {'|A|':>4}  {'|B|':>4}  {'Jaccard':>8}")
for j, a, b, ic, la, lb in overlaps[:30]:
    print(f"  {a:<6}  {b:<6}  {ic:>6}  {la:>4}  {lb:>4}  {j:>8.3f}")
