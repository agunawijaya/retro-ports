#!/usr/bin/env python3
"""Find printable strings in KARATEKA.EXE and their references."""

from pathlib import Path
import re
import struct

blob = Path(__file__).with_name("KARATEKA.EXE").read_bytes()
# Skip MZ header (512 bytes for KARATEKA.EXE)
header_sz = struct.unpack_from("<H", blob, 8)[0] * 16
img = blob[header_sz:]

print(f"image size = {len(img)} bytes")
print()

# Find ASCII strings 4+ chars long.
pat = re.compile(rb"[A-Za-z0-9._\\/:%\- ]{4,}")
for m in pat.finditer(img):
    s = m.group().decode("ascii", errors="replace")
    if any(c in s for c in (".BCG", ".DAT", ".IND", "FUJI", "CASTLE",
                            "KARATE", ".PAL", ".CGA", "ALL")):
        off = m.start()
        if off > 0xFFFF:
            ref_str = "(out of 16-bit range)"
        else:
            addr_bytes = struct.pack("<H", off)
            refs = []
            i = 0
            while True:
                j = img.find(addr_bytes, i)
                if j < 0: break
                refs.append(j)
                i = j + 1
            ref_str = " ".join(f"0x{r:04X}" for r in refs[:8]) if refs else "(no refs)"
        print(f"  image+0x{off:04X}: {s!r:<24} refs: {ref_str}")
