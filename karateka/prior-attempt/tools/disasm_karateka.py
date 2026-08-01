#!/usr/bin/env python3
"""
disasm_karateka.py — static analysis of KARATEKA.EXE.

Goal: locate the sprite-blit routine and the file-loader, so we can
infer the real opcode set used by .DAT shape streams and the .BCG layout.

Approach:
  1. Parse the MZ header to find the code image and relocation table.
  2. Apply relocations so far/near pointers are sensible.
  3. Linear-disassemble each 1 KB chunk with Capstone in 16-bit x86 mode.
  4. Hunt for distinctive patterns:
       - `MOV AX, 0xB800`  / `MOV ES, AX`   → CGA framebuffer set up
       - `MOV AH, 0x3D` / `INT 0x21`        → DOS file open
       - `MOV AH, 0x3F` / `INT 0x21`        → DOS file read
       - `MOV AX, 0x0004` / `INT 0x10`      → set CGA mode
       - `INT 0x16`                          → keyboard
  5. For each hit, dump the surrounding 60 bytes of disassembly so a
     human can see the inner loop.
"""

from __future__ import annotations

import struct
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_16


EXE_PATH = Path(__file__).with_name("KARATEKA.EXE")


# ---------------------------------------------------------------------------
# MZ header
# ---------------------------------------------------------------------------

def parse_mz(blob: bytes) -> dict:
    if blob[:2] != b"MZ":
        raise SystemExit("not an MZ executable")
    (sig, last_page, pages, reloc, hdr_paras, min_alloc, max_alloc,
     ss, sp, csum, ip, cs, reloc_off, overlay) = struct.unpack_from(
        "<2sHHHHHHHHHHHHH", blob, 0)
    hdr_size = hdr_paras * 16
    img_size = pages * 512 - hdr_size
    if last_page:
        img_size -= (512 - last_page)
    return dict(
        hdr_size=hdr_size,
        img_size=img_size,
        cs=cs, ip=ip, ss=ss, sp=sp,
        reloc=reloc, reloc_off=reloc_off,
        min_alloc=min_alloc, max_alloc=max_alloc,
    )


def load_image(blob: bytes, mz: dict) -> bytes:
    return blob[mz["hdr_size"]:mz["hdr_size"] + mz["img_size"]]


# ---------------------------------------------------------------------------
# Pattern hunters
# ---------------------------------------------------------------------------

PATTERNS = [
    # (description, bytes-substring, mnemonic_context_check)
    ("MOV AX, 0xB800 — CGA framebuffer segment", b"\xB8\x00\xB8", None),
    ("MOV AX, 0x0004 — set CGA graphics mode",   b"\xB8\x04\x00", "int 0x10"),
    ("MOV AH, 0x3D — DOS open file",             b"\xB4\x3D",     "int 0x21"),
    ("MOV AH, 0x3F — DOS read file",             b"\xB4\x3F",     "int 0x21"),
    ("MOV AH, 0x42 — DOS lseek",                 b"\xB4\x42",     "int 0x21"),
    ("MOV AH, 0x09 — DOS print string",          b"\xB4\x09",     "int 0x21"),
    ("INT 0x16 — keyboard service",              b"\xCD\x16",     None),
    ("Direct write to ES:[DI] in a CGA loop",    b"\xAA",         None),  # STOSB
]


def find_matches(image: bytes, needle: bytes) -> list[int]:
    hits = []
    start = 0
    while True:
        i = image.find(needle, start)
        if i < 0:
            break
        hits.append(i)
        start = i + 1
    return hits


def disasm_window(md: Cs, image: bytes, center: int, before: int = 8,
                  after: int = 24) -> list[tuple[int, str, str]]:
    """Disassemble a window around `center`.  Try a few back-up start offsets
    to find one that produces sensible instructions just before center.
    """
    best: list[tuple[int, str, str]] = []
    best_score = -1
    for back in range(0, before + 1):
        start = max(0, center - back)
        out: list[tuple[int, str, str]] = []
        for ins in md.disasm(image[start:center + after + 16], start):
            if ins.address > center + after:
                break
            out.append((ins.address, ins.mnemonic, ins.op_str))
        # Score: prefer windows that actually align *at* center.
        score = sum(1 for (a, _, _) in out if a == center) * 10 + len(out)
        if score > best_score:
            best_score = score
            best = out
    return best


# ---------------------------------------------------------------------------
# Find the entry-to-blit call chain
# ---------------------------------------------------------------------------

def hunt_blit_loops(md: Cs, image: bytes) -> list[int]:
    """Find tight inner loops that:
       - target ES:[DI] (writes to CGA framebuffer when ES==B800h)
       - loop back via LOOP/JMP short
    Returns offsets where such a loop body starts.
    """
    # A typical CGA byte-poke inner loop in 8086 looks like:
    #   STOSW                (AB)        ; write AX to ES:[DI], DI+=2
    #   LOOP <short>         (E2 xx)     ; or DEC CX / JNZ
    # or rep stosw           (F3 AB)
    candidates: set[int] = set()
    for i, b in enumerate(image):
        if b == 0xAB and i + 1 < len(image) and image[i + 1] in (0xE2, 0xF3):
            candidates.add(max(0, i - 8))
        if b == 0xF3 and i + 1 < len(image) and image[i + 1] in (0xAA, 0xAB):
            candidates.add(i)
    return sorted(candidates)


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def main() -> int:
    blob = EXE_PATH.read_bytes()
    mz = parse_mz(blob)
    img = load_image(blob, mz)
    print(f"== KARATEKA.EXE ==")
    print(f"  file size : {len(blob)}")
    print(f"  header    : {mz['hdr_size']} bytes ({mz['hdr_size']//16} paragraphs)")
    print(f"  image     : {len(img)} bytes")
    print(f"  entry     : CS:IP = {mz['cs']:04X}:{mz['ip']:04X}")
    print(f"  stack     : SS:SP = {mz['ss']:04X}:{mz['sp']:04X}")
    print(f"  relocs    : {mz['reloc']}")
    print()

    md = Cs(CS_ARCH_X86, CS_MODE_16)
    md.detail = False

    # ----- Pattern matches ---------------------------------------------
    print("== Pattern hits ==")
    for desc, needle, ctx in PATTERNS:
        hits = find_matches(img, needle)
        if not hits:
            print(f"  [ ] {desc}: none")
            continue
        # Filter by context check (a following instruction within 8 bytes)
        kept = []
        for h in hits:
            if ctx is None:
                kept.append(h)
                continue
            # disasm a tiny window and see if `ctx` mnemonic appears within 8 inst
            seen = False
            for ins in md.disasm(img[h:h + 16], h):
                if ctx.split()[0] in ins.mnemonic and ctx.split()[1] in ins.op_str:
                    seen = True
                    break
            if seen:
                kept.append(h)
        print(f"  [{len(kept):>3}] {desc}  (raw hits {len(hits)})")
        for h in kept[:5]:
            print(f"        @ image+0x{h:04X}")
    print()

    # ----- Entry-point dump --------------------------------------------
    # The MZ load address: CS = 0x0000 means the image starts at the relocated
    # base; offset of entry within image = CS*16 + IP.
    entry_off = (mz["cs"] * 16 + mz["ip"]) & 0xFFFFF
    if entry_off < len(img):
        print(f"== Entry-point disassembly (image+0x{entry_off:04X}) ==")
        n = 0
        for ins in md.disasm(img[entry_off:entry_off + 64], entry_off):
            print(f"  {ins.address:08X}  {ins.bytes.hex():<14}  "
                  f"{ins.mnemonic:<8} {ins.op_str}")
            n += 1
            if n >= 20:
                break
        print()

    # ----- Around each pattern hit, show disassembly -------------------
    interesting = [
        ("CGA segment setup (B800h)", b"\xB8\x00\xB8"),
        ("Set video mode 4",          b"\xB8\x04\x00"),
        ("DOS open file",             b"\xB4\x3D"),
        ("DOS read file",             b"\xB4\x3F"),
    ]
    for desc, needle in interesting:
        hits = find_matches(img, needle)
        if not hits:
            continue
        print(f"== Disassembly around: {desc} ==")
        for h in hits[:2]:
            print(f"  -- at image+0x{h:04X} --")
            for (addr, mn, op) in disasm_window(md, img, h, before=4, after=20):
                marker = "->" if addr == h else "  "
                print(f"  {marker} {addr:08X}  {mn:<8} {op}")
            print()

    # ----- Blit-loop candidates ---------------------------------------
    blits = hunt_blit_loops(md, img)
    print(f"== Blit-loop candidates (rep stos / stos+loop): {len(blits)} ==")
    for h in blits[:6]:
        print(f"  -- @image+0x{h:04X} --")
        for (addr, mn, op) in disasm_window(md, img, h, before=2, after=10):
            print(f"     {addr:08X}  {mn:<8} {op}")
        print()

    # ----- Sprite-opcode candidates ------------------------------------
    # A sprite blitter that recognises opcode 0x7B will have a CMP <reg>, 0x7B
    # somewhere.  Look for the literal byte sequence:
    #   3C 7B   = CMP AL, 0x7B
    #   80 F8 7B = CMP AL, 0x7B (alt encoding)
    #   80 3E xx xx 7B = CMP byte ptr [mem], 0x7B
    print("== Opcode-0x7B comparisons (sprite-stream control candidates) ==")
    for needle, desc in [
        (b"\x3C\x7B",         "CMP AL, 0x7B"),
        (b"\x80\xF8\x7B",     "CMP AL, 0x7B (alt)"),
        (b"\x80\xFB\x7B",     "CMP BL, 0x7B"),
        (b"\x80\xF9\x7B",     "CMP CL, 0x7B"),
        (b"\x80\xFA\x7B",     "CMP DL, 0x7B"),
    ]:
        hits = find_matches(img, needle)
        print(f"  [{len(hits):>3}] {desc}")
        for h in hits[:6]:
            print(f"        @ image+0x{h:04X}")
            for (addr, mn, op) in disasm_window(md, img, h, before=8, after=20):
                marker = "->" if addr == h else "  "
                print(f"        {marker} {addr:08X}  {mn:<8} {op}")
            print()

    # ----- The big background-blit routine at 0x0D70 -------------------
    print("== Background-blit routine (BCG -> CGA, around image+0x0D70) ==")
    start = 0x0D60
    for ins in md.disasm(img[start:0x0DA0], start):
        print(f"  {ins.address:08X}  {ins.bytes.hex():<14}  {ins.mnemonic:<8} {ins.op_str}")
    print()

    # ----- The startup / disk-check region (image+0x100 .. 0x300) ------
    print("== Startup region (around the disk-check prompt) ==")
    start = 0x0100
    for ins in md.disasm(img[start:0x0300], start):
        print(f"  {ins.address:08X}  {ins.bytes.hex():<14}  {ins.mnemonic:<8} {ins.op_str}")
    print()

    # ----- Function 0x4C99 (called from startup, suspect = disk check) --
    print("== Function 0x4C99 (suspected disk-check entry) ==")
    start = 0x4C99
    n = 0
    for ins in md.disasm(img[start:start + 400], start):
        print(f"  {ins.address:08X}  {ins.bytes.hex():<14}  {ins.mnemonic:<8} {ins.op_str}")
        n += 1
        if n >= 80: break
    print()

    # ----- BIOS disk service (INT 13h) calls — the real disk check -----
    print("== INT 13h calls (BIOS floppy/disk service) ==")
    needle = b"\xCD\x13"
    pos = 0
    cnt = 0
    while True:
        i = img.find(needle, pos)
        if i < 0: break
        cnt += 1
        print(f"  -- @ image+0x{i:04X} --")
        for ins in md.disasm(img[max(0,i-20):i+10], max(0,i-20)):
            marker = "->" if ins.address == i else "  "
            print(f"  {marker} {ins.address:08X}  {ins.mnemonic:<8} {ins.op_str}")
        print()
        pos = i + 1
    print(f"  Total INT 13h sites: {cnt}")
    print()

    # ----- Full disk-check routine around image+0x16D3 -----------------
    print("== Full disk-check routine around the two INT 13h calls ==")
    start = 0x1680
    for ins in md.disasm(img[start:0x1740], start):
        print(f"  {ins.address:08X}  {ins.bytes.hex():<14}  {ins.mnemonic:<8} {ins.op_str}")
    print()

    # ----- Find callers of the disk-check function (~0x16B0) -----------
    print("== Callers of any address in 0x16B0..0x16D0 ==")
    for caller in range(len(img) - 3):
        if img[caller] != 0xE8: continue
        disp = img[caller+1] | (img[caller+2] << 8)
        if disp >= 0x8000: disp -= 0x10000
        target = (caller + 3 + disp) & 0xFFFF
        if 0x16A0 <= target <= 0x16D5:
            print(f"  image+0x{caller:04X}  CALL  -> image+0x{target:04X}")
    print()
    # The disk-check function entry should be at a clear "push bp" / "push
    # es" prologue.  Try disassembling from candidate offsets to find it.
    print("== Disassembly aligned at candidate disk-check entries ==")
    for cand in (0x16C2, 0x16C3, 0x16C4):
        print(f"  -- aligning at 0x{cand:04X} --")
        n = 0
        for ins in md.disasm(img[cand:cand + 60], cand):
            print(f"     {ins.address:08X}  {ins.bytes.hex():<10}  {ins.mnemonic:<8} {ins.op_str}")
            n += 1
            if n >= 6: break
        print()

    # ----- INT 25h / 26h (absolute disk read/write) — another check vector
    print("== INT 25h / 26h (DOS absolute disk r/w) ==")
    for needle, desc in [(b"\xCD\x25", "INT 25h read"), (b"\xCD\x26", "INT 26h write")]:
        pos = 0
        while True:
            i = img.find(needle, pos)
            if i < 0: break
            print(f"  {desc} @ image+0x{i:04X}")
            for ins in md.disasm(img[max(0,i-20):i+8], max(0,i-20)):
                marker = "->" if ins.address == i else "  "
                print(f"  {marker} {ins.address:08X}  {ins.mnemonic:<8} {ins.op_str}")
            print()
            pos = i + 1
    print()

    # ----- All references to message offset 0xB1 ------------------------
    print("== All occurrences of 'mov dx, 0xB1' (load disk-error msg ptr) ==")
    # Encoding for `mov dx, imm16` is `BA xx xx`
    needle = b"\xBA\xB1\x00"
    pos = 0
    while True:
        i = img.find(needle, pos)
        if i < 0: break
        print(f"  -- @ image+0x{i:04X} --")
        for ins in md.disasm(img[max(0,i-8):i+24], max(0,i-8)):
            marker = "->" if ins.address == i else "  "
            print(f"  {marker} {ins.address:08X}  {ins.mnemonic:<8} {ins.op_str}")
        print()
        pos = i + 1

    # ----- Per-shape blit routines we identified from frame-interp ----
    print("== Per-shape blit routines (callers of the RLE decoder) ==")
    for start in (0x0640,):
        print(f"  ---- @ image+0x{start:04X} ----")
        n = 0
        for ins in md.disasm(img[start:start + 700], start):
            print(f"  {ins.address:08X}  {ins.bytes.hex():<14}  {ins.mnemonic:<8} {ins.op_str}")
            n += 1
            if n >= 200:
                break
        print()

    # ----- Other background-blit candidates: 0xD89 and 0xDEF ----------
    print("== Alternate blit routines (0xD89 and 0xDEF — FUJI candidates) ==")
    for start in (0x0D89, 0x0DEF):
        print(f"  ---- @ image+0x{start:04X} ----")
        n = 0
        for ins in md.disasm(img[start:start+500], start):
            print(f"  {ins.address:08X}  {ins.bytes.hex():<14}  {ins.mnemonic:<8} {ins.op_str}")
            n += 1
            if n >= 150:
                break
        print()

    # ----- Full sprite blitter, both routines we found ------------------
    print("== Sprite-shape decoder routine (around image+0x0B6F) ==")
    start = 0x0B40
    for ins in md.disasm(img[start:0x0C50], start):
        print(f"  {ins.address:08X}  {ins.bytes.hex():<14}  {ins.mnemonic:<8} {ins.op_str}")
    print()

    # ----- Find every reference to the operand-storage variables -------
    # The 0x7B handler stored into [0x422E]/[0x422F] (routine A)
    # and       into [0x422C]/[0x422D] (routine B)
    # We want to find every other load/store of those addresses.
    print("== References to opcode-operand globals ==")
    targets = {0x422C: "0x422C (B-op-x?)",
               0x422D: "0x422D (B-op-y?)",
               0x422E: "0x422E (A-op-x?)",
               0x422F: "0x422F (A-op-y?)"}
    for addr_val, label in targets.items():
        lo = addr_val & 0xFF
        hi = (addr_val >> 8) & 0xFF
        needles = [
            bytes([0xA0, lo, hi]),              # MOV AL, [disp16]
            bytes([0xA1, lo, hi]),              # MOV AX, [disp16]
            bytes([0xA2, lo, hi]),              # MOV [disp16], AL
            bytes([0xA3, lo, hi]),              # MOV [disp16], AX
        ]
        all_hits: set[int] = set()
        for n in needles:
            for i in range(len(img) - len(n)):
                if img[i:i+len(n)] == n:
                    all_hits.add(i)
        print(f"  {label}: {len(all_hits)} refs")
        for h in sorted(all_hits)[:5]:
            for ins in md.disasm(img[h:h+6], h):
                print(f"     {h:08X}  {ins.mnemonic} {ins.op_str}")
                break
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
