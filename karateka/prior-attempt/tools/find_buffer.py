#!/usr/bin/env python3
"""Find every instruction that references the buffer at DS:0x337.

The slow-reveal blit at image+0x0DEF reads 16000 bytes from DS:0x337.
The decompressor must WRITE to that same buffer.
"""

import struct
from pathlib import Path
from capstone import Cs, CS_ARCH_X86, CS_MODE_16

blob = Path(__file__).with_name("KARATEKA.EXE").read_bytes()
hdr_sz = struct.unpack_from("<H", blob, 8)[0] * 16
img = blob[hdr_sz:]

# Find every occurrence of bytes 0x37 0x03 (= 0x0337 little-endian).
# Then disassemble around each to see whether it's actually a reference.
needle = b"\x37\x03"
hits = []
i = 0
while True:
    j = img.find(needle, i)
    if j < 0: break
    hits.append(j)
    i = j + 1

print(f"Found {len(hits)} occurrences of bytes 37 03 in image.")
print()
md = Cs(CS_ARCH_X86, CS_MODE_16)
md.detail = False

# Print the disassembled instructions where the immediate field IS 0x337.
print("== Instructions actually referencing DS:0x337 ==")
seen = set()
for h in hits:
    for back in range(0, 5):
        start = max(0, h - back)
        for ins in md.disasm(img[start:start + 8], start):
            if "0x337" in ins.op_str and ins.address not in seen:
                seen.add(ins.address)
                ctx = []
                for ctx_ins in md.disasm(img[max(0,ins.address-10):ins.address+30], max(0,ins.address-10)):
                    ctx.append(ctx_ins)
                print(f"  -- @ image+0x{ins.address:04X} --")
                for ci in ctx:
                    marker = "->" if ci.address == ins.address else "  "
                    print(f"  {marker} {ci.address:08X}  {ci.mnemonic:<8} {ci.op_str}")
                print()
                break
        else:
            continue
        break
