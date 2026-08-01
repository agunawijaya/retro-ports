# Oregon Trail RE — Phase 3: Full Game Logic Reconstruction
# Paste this entire prompt into Claude Code.
#
# PREREQUISITE: Install Ghidra before running this phase.
#   Download: https://ghidra-sre.org/ (single ZIP, no installer needed)
#   OR install radare2: https://github.com/radareorg/radare2/releases
#   OR install ndisasm: comes with NASM (https://www.nasm.us/pub/nasm/releasebuilds/)
#
# Phase 2 summary of what we KNOW:
#   - Entry point: 0:0x010A (TP init chain)
#   - Main game segment: 0x1042 (functions at :47BA, :4108, :29E2, :0DF4)
#   - File-open wrapper: 0x16835
#   - Illness name table: 0x24156 (6 x 11-byte records)
#   - Illness param table: 0x24198 (6 x 8-byte, 4 WORDs each)
#   - Landmark table: 0x23BD1-0x23F8C (18 records, ~37 bytes each)
#   - Joystick poll: 0x11580 (IN AL, 0x201)
#   - DIALOGS.REC string: 0x93ED
#   - HISCORES seed: hardcoded at 0x23BD1
#   - Custom RNG (NOT standard TP6 LCG)
#   - Pace: 8/12/16 hours/day
#   - Trail: 2000 miles total
#   - Score multipliers: Carpenter x2, Farmer x3, Banker x1
#   - 18 landmarks = 18 P0-P17.PCC images = 18 SONGS.TXT lines (confirmed)
#
# Files:
#   Input:  work\OREGON_UNPACKED.BIN (150,016 bytes)
#   Output: append to E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon_trail_reverse.md
# ============================================================

Continue Phase 3 of the Oregon Trail v2.1 reverse engineering project.
Phase 2 is complete. We have the unpacked binary at work\OREGON_UNPACKED.BIN (150,016 bytes).

Working directory: E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\
Output doc: E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon_trail_reverse.md
All new derived files go to: work\

Do NOT modify any original files. Do NOT modify OREGON.EXE.

---

## STEP 3.0 — Set up disassembler

### Check what is available:

```powershell
where.exe ghidra-analyzeHeadless 2>$null; echo "ghidra: $LASTEXITCODE"
where.exe r2 2>$null; echo "radare2: $LASTEXITCODE"
where.exe ndisasm 2>$null; echo "ndisasm: $LASTEXITCODE"
where.exe objdump 2>$null; echo "objdump: $LASTEXITCODE"
python -c "import capstone; print('capstone version:', capstone.version_bind())" 2>$null
```

Note: capstone uses `version_bind()` not `version_info`. If the above prints a version tuple,
capstone is ready — skip the pip install below.

### Option A — Capstone via Python (already installed on this machine)

Verify it works correctly:
```python
import capstone
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_16)
md.detail = True
# test: disassemble a known x86-16 sequence (NOP + RET)
test = b'\x90\xC3'
for insn in md.disasm(test, 0):
    print(f"  0x{insn.address:04X}: {insn.mnemonic} {insn.op_str}")
# Expected output:
#   0x0000: nop
#   0x0001: ret
print("capstone OK")
```

If the test above works, proceed directly to the disassembly scripts below.
If capstone is missing: `pip install capstone`

Then save and run this disassembly script:

```python
# work\disassemble.py
# Disassemble OREGON_UNPACKED.BIN using the Capstone engine (Python binding).
# Focuses on the known anchor regions from Phase 2.
# Compatible with capstone 4.x and 5.x.

import capstone, struct
# Compatibility shim
try:
    _ver = capstone.version_bind()
except AttributeError:
    _ver = getattr(capstone, '__version__', 'unknown')
print(f"capstone version: {_ver}")

IMAGE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())

md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_16)
md.detail = True

def disasm_region(offset, length, label):
    """Disassemble `length` bytes starting at `offset` and print with hex offsets."""
    print(f"\n{'='*60}")
    print(f"  {label}  (offset 0x{offset:05X} .. 0x{offset+length:05X})")
    print('='*60)
    chunk = bytes(raw[offset:offset+length])
    for insn in md.disasm(chunk, offset):
        # Show offset, hex bytes (up to 6), mnemonic, op_str
        hex_bytes = ' '.join(f'{b:02X}' for b in insn.bytes[:6])
        print(f"  0x{insn.address:05X}:  {hex_bytes:<20}  {insn.mnemonic:<8} {insn.op_str}")

# --- Anchor regions from Phase 2 ---

# 1. Entry point / TP init chain
disasm_region(0x010A, 80, "Entry point / TP unit init chain")

# 2. Main game entry (first far-call target from init chain)
# TP segment 0x1042 = file offset 0x1042*16 = 0x10420
disasm_region(0x10420 + 0x0DF4, 256, "Main game function @1042:0DF4")
disasm_region(0x10420 + 0x29E2, 256, "Main game function @1042:29E2")
disasm_region(0x10420 + 0x4108, 256, "Main game function @1042:4108")
disasm_region(0x10420 + 0x47BA, 256, "Main game function @1042:47BA")

# 3. Illness name table region
disasm_region(0x24156 - 32, 320, "Illness table region (names @0x24156, params @0x24198)")

# 4. Landmark table region
disasm_region(0x23BD1, 256, "Landmark/HISCORES seed region @0x23BD1")

# 5. File-open wrapper
disasm_region(0x16835, 128, "File-open wrapper @0x16835")

# 6. Joystick poll region
disasm_region(0x11580 - 16, 128, "Joystick poll region @0x11580")

# 7. Quit path
disasm_region(0x21B80 - 16, 48, "Quit path @0x21B80 (INT 21h AH=4C)")

# 8. Pace menu text region (strings confirmed at ~0x9E4A)
disasm_region(0x9E00, 200, "Pace menu region @~0x9E00")
```

Run with: `python work\disassemble.py > work\disasm_anchors.txt`

### Option B — ndisasm (if available)

```powershell
ndisasm -b 16 -o 0 work\OREGON_UNPACKED.BIN > work\disasm_full.txt
```
Then search: `Select-String "8088405|RNG|MUL BX|MUL CX" work\disasm_full.txt`

### Option C — Ghidra headless (if installed)

```powershell
$GHIDRA = "C:\ghidra_11.x\support\analyzeHeadless.bat"  # adjust version
& $GHIDRA work\ghidra_project OregonTrail `
    -import work\OREGON_UNPACKED.BIN `
    -processor x86:LE:16:Real Mode `
    -postScript ExportSymbolsToCSV.java work\ghidra_symbols.csv
```

---

## STEP 3.1 — Find the custom RNG

Phase 2 confirmed: the standard TP6 LCG constant 0x8088405 is NOT present.
Search the disassembly for non-standard RNG patterns.

### 3.1a — Search for all MUL/IMUL instructions near a shift

Using Python + Capstone output from Step 3.0:

```python
# work\find_rng.py
# Hunt for RNG candidates: look for multiply-then-shift or XOR-then-multiply patterns.
# Compatible with capstone 4.x and 5.x.

import capstone, re

try:
    capstone.version_bind()
except AttributeError:
    pass  # version shim not needed beyond import check

IMAGE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())

md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_16)
md.detail = True

# Collect all instructions with their offsets
insns = list(md.disasm(bytes(raw), 0))

# Look for: MUL or IMUL followed within 5 instructions by a shift (SHR/SAR/ROR)
# -- classic "extract high bits of LCG product" pattern
for i, insn in enumerate(insns):
    if insn.mnemonic in ('mul', 'imul'):
        window = insns[i:i+8]
        has_shift = any(w.mnemonic in ('shr', 'sar', 'ror', 'shl') for w in window)
        has_mod   = any(w.mnemonic in ('div', 'idiv') for w in window)
        if has_shift or has_mod:
            print(f"\n--- MUL+SHIFT candidate at 0x{insn.address:05X} ---")
            for w in window:
                print(f"  0x{w.address:05X}:  {w.mnemonic:<8} {w.op_str}")

# Also search for BIOS timer read (INT 1Ah -- clock ticks as seed)
for insn in insns:
    if insn.mnemonic == 'int' and '0x1a' in insn.op_str:
        print(f"\n--- BIOS INT 1Ah (timer) at 0x{insn.address:05X} ---")

# Search for RCR/RCL (rotate-through-carry) -- another RNG signal
rcr_list = [i for i in insns if i.mnemonic in ('rcr','rcl','ror','rol')]
print(f"\nTotal RCR/RCL/ROR/ROL instructions: {len(rcr_list)}")
for r in rcr_list[:20]:
    print(f"  0x{r.address:05X}:  {r.mnemonic:<8} {r.op_str}")
```

Run: `python work\find_rng.py > work\rng_candidates.txt`

### 3.1b — Search for the RNG seed variable

The RNG seed is almost certainly a global variable (in DS, TP's data segment).
Look for patterns where the same memory address is read AND written in the same short function:

```python
# work\find_seed.py
# Find functions where the same memory location is both read and written (seed update pattern).
# Compatible with capstone 4.x and 5.x.

import capstone, struct
from collections import defaultdict

try:
    capstone.version_bind()
except AttributeError:
    pass

IMAGE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())

md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_16)
md.detail = True
insns = list(md.disasm(bytes(raw), 0))

# Simple heuristic: find functions (sequences ending in RET/RETF) where
# the same [mem] address appears in both a MOV reg,[mem] and MOV [mem],reg
func_start = 0
reads  = defaultdict(list)
writes = defaultdict(list)

for i, insn in enumerate(insns):
    # New function heuristic: PUSH BP / MOV BP,SP
    if (insn.mnemonic == 'push' and 'bp' in insn.op_str and
        i+1 < len(insns) and insns[i+1].mnemonic == 'mov' and 
        'bp, sp' in insns[i+1].op_str):
        reads.clear(); writes.clear()
        func_start = insn.address

    # Track memory reads/writes (simplified: look for [disp16] patterns)
    ops = insn.op_str
    import re
    mem_refs = re.findall(r'\[(?:0x)?([0-9a-fA-F]{1,4})\]', ops)
    for addr in mem_refs:
        a = int(addr, 16)
        if insn.mnemonic.startswith('mov') and ops.startswith('['):
            writes[a].append(insn.address)
        else:
            reads[a].append(insn.address)

    # At RETF or RET: check for read-write overlap (seed pattern)
    if insn.mnemonic in ('ret', 'retf'):
        overlap = set(reads.keys()) & set(writes.keys())
        if overlap and len(reads) < 15:  # small function
            for addr in overlap:
                if reads[addr] and writes[addr]:
                    print(f"\nSeed candidate [0x{addr:04X}] in func @0x{func_start:05X}")
                    print(f"  Read  at: {[hex(x) for x in reads[addr]]}")
                    print(f"  Write at: {[hex(x) for x in writes[addr]]}")
        reads.clear(); writes.clear()
```

Run: `python work\find_seed.py > work\seed_candidates.txt`

---

## STEP 3.2 — Decode landmark table

From Phase 2: landmark table at 0x23BD1-0x23F8C.
Each of the 18 records is ~37 bytes (confirmed from name-to-name spacing).
The first record starts at 0x23BD1 (also where HISCORES hardcoded names begin — they may be interleaved or immediately adjacent).

```python
# work\decode_landmarks.py
# Parse the 18-landmark table and the interleaved HISCORES seed data.

import struct

IMAGE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())

LANDMARK_TABLE_START = 0x23BD1
LANDMARK_COUNT = 18
RECORD_SIZE = 37  # hypothesis from Phase 2 (verify by alignment)

print("=== Landmark table raw dump (18 x 37 bytes) ===\n")

for i in range(LANDMARK_COUNT):
    base = LANDMARK_TABLE_START + i * RECORD_SIZE
    record = raw[base:base + RECORD_SIZE]
    hex_str = ' '.join(f'{b:02X}' for b in record)
    
    # Try to find Pascal string at end of record
    # (last bytes should be len_byte + ASCII name)
    for j in range(len(record) - 1, -1, -1):
        slen = record[j]
        if 3 <= slen <= 30 and j + slen + 1 <= len(record):
            candidate = record[j+1:j+1+slen]
            if all(0x20 <= c <= 0x7E for c in candidate):
                name = candidate.decode('ascii')
                pre_bytes = ' '.join(f'{b:02X}' for b in record[:j])
                print(f"Landmark {i:2d}:  pre=[{pre_bytes}]  name_len={slen}  name='{name}'")
                break
    else:
        print(f"Landmark {i:2d}:  [{hex_str}]  -- no Pascal string found")

# Now try to decode the pre-name bytes as game data
print("\n=== Hypothesis: decode pre-name bytes as game fields ===")
print("Format attempt: uint16 miles_required, uint8 screen_x, uint8 screen_y, ...")
print()
for i in range(LANDMARK_COUNT):
    base = LANDMARK_TABLE_START + i * RECORD_SIZE
    record = raw[base:base + RECORD_SIZE]
    
    # Try to find the name first (same as above)
    name = f"landmark_{i}"
    for j in range(len(record) - 1, -1, -1):
        slen = record[j]
        if 3 <= slen <= 30 and j + slen + 1 <= len(record):
            candidate = record[j+1:j+1+slen]
            if all(0x20 <= c <= 0x7E for c in candidate):
                name = candidate.decode('ascii')
                pre = record[:j]
                # Attempt decode of first fields
                if len(pre) >= 4:
                    miles_req = struct.unpack_from('<H', pre, 0)[0]
                    field2    = struct.unpack_from('<H', pre, 2)[0]
                    print(f"  {name:<30}  miles_required={miles_req:4d}  field2={field2:5d}  pre_hex={pre.hex()}")
                break
```

Run: `python work\decode_landmarks.py > work\landmark_table.txt`

---

## STEP 3.3 — Decode illness parameter table

From Phase 2: illness params at 0x24198, 6 records x 4 WORDs (8 bytes each).
Phase 2 gave us the raw values; now interpret them.

```python
# work\decode_illness.py
# Decode the illness parameter table and hypothesize field meanings.

import struct

IMAGE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())

ILLNESS_NAMES = ['exhaustion', 'typhoid', 'cholera', 'measles', 'dysentery', 'a fever']
PARAM_TABLE   = 0x24198
RECORD_SIZE   = 8

print("=== Illness parameter table ===\n")
print(f"{'Illness':<14} {'W0':>5} {'W1':>5} {'W2':>5} {'W3':>5}")
print("-" * 45)

params = []
for i, name in enumerate(ILLNESS_NAMES):
    base = PARAM_TABLE + i * RECORD_SIZE
    w0, w1, w2, w3 = struct.unpack_from('<HHHH', raw, base)
    params.append((name, w0, w1, w2, w3))
    print(f"{name:<14} {w0:>5} {w1:>5} {w2:>5} {w3:>5}")

# Analysis: compare values across illnesses to infer field roles
print("\n=== Field analysis ===")
print("""
Known constraints to cross-reference:
  - Cholera and typhoid are historically the deadliest on the trail
  - Dysentery is the most common / famous ("You have died of dysentery")
  - Exhaustion should correlate with pace
  - Recovery days: cholera ~3-7 days, typhoid ~10-14 days, measles ~7-10 days
  - A fever is probably the mildest / catch-all illness
  
W0 values: 200, 109, 0, 67, 59, 0
W1 values: 0, 0, 49, 51, 0, 0  
W2 values: 48, 71, 60, 79, 45, 53  -- fairly uniform range 45-79
W3 values: 109, 49, 36, 41, 44, 32 -- smaller range 32-109

HYPOTHESIS:
  W2 = recovery_days (all non-zero, uniform range 45-79 -- possibly tenths of days?)
  W3 = health_loss_per_day (higher = deadlier; exhaustion 109 >> cholera 36?)
  W0 = base_probability_weight (0 = low probability trigger)
  W1 = weather_or_river_modifier (non-zero only for cholera and measles)
""")

# Look at surrounding bytes for additional context
print("\n=== Bytes before and after param table ===")
context_start = PARAM_TABLE - 32
context_end   = PARAM_TABLE + RECORD_SIZE * 6 + 32
chunk = raw[context_start:context_end]
for j in range(0, len(chunk), 16):
    hex_row = ' '.join(f'{b:02X}' for b in chunk[j:j+16])
    asc_row = ''.join(chr(b) if 0x20 <= b <= 0x7E else '.' for b in chunk[j:j+16])
    print(f"  0x{context_start+j:05X}:  {hex_row:<48}  {asc_row}")
```

Run: `python work\decode_illness.py > work\illness_analysis.txt`

---

## STEP 3.4 — Trace the event dispatch / main game loop

Using Capstone disassembly from Step 3.0, analyze the 4 main game functions.
For each function, identify:
1. What other functions does it call? (CALL / CALL FAR targets)
2. What memory addresses does it read/write? (global variable accesses)
3. Does it contain the main travel loop? (look for loop + date advance + milestone check)
4. Does it dispatch to event handlers? (look for CMP + JBE chains near the illness table range)

```python
# work\trace_main_functions.py
# Trace call graph for the 4 main game entry points identified in Phase 2.
# Compatible with capstone 4.x and 5.x.

import capstone, struct

try:
    capstone.version_bind()
except AttributeError:
    pass

IMAGE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())

md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_16)
md.detail = True

MAIN_SEGMENT = 0x1042
MAIN_SEGMENT_OFFSET = MAIN_SEGMENT * 16  # = 0x10420

FUNCTIONS = {
    "func_0DF4": MAIN_SEGMENT_OFFSET + 0x0DF4,
    "func_29E2": MAIN_SEGMENT_OFFSET + 0x29E2,
    "func_4108": MAIN_SEGMENT_OFFSET + 0x4108,
    "func_47BA": MAIN_SEGMENT_OFFSET + 0x47BA,
}

def trace_function(name, start_offset, max_bytes=1024):
    """Disassemble a function and extract: calls, memory refs, branch targets."""
    print(f"\n{'='*60}")
    print(f"  {name}  (file offset 0x{start_offset:05X})")
    print('='*60)
    
    calls = []
    mem_writes = []
    comparisons = []
    
    chunk = bytes(raw[start_offset:start_offset + max_bytes])
    for insn in md.disasm(chunk, start_offset):
        # Print instruction
        hex_bytes = ' '.join(f'{b:02X}' for b in insn.bytes[:6])
        print(f"  0x{insn.address:05X}:  {hex_bytes:<20}  {insn.mnemonic:<8} {insn.op_str}")
        
        # Collect calls
        if insn.mnemonic in ('call', 'callf'):
            calls.append((insn.address, insn.op_str))
        
        # Collect comparisons (for threshold / event dispatch)
        if insn.mnemonic == 'cmp':
            comparisons.append((insn.address, insn.op_str))
        
        # Stop at function return or far return
        if insn.mnemonic in ('ret', 'retf', 'retn'):
            break
    
    print(f"\n  -- CALLS ({len(calls)}) --")
    for addr, target in calls:
        print(f"    0x{addr:05X} -> {target}")
    
    print(f"\n  -- COMPARISONS ({len(comparisons)}) --")
    for addr, ops in comparisons:
        print(f"    0x{addr:05X}: cmp {ops}")

for name, offset in FUNCTIONS.items():
    trace_function(name, offset, max_bytes=512)
```

Run: `python work\trace_main_functions.py > work\main_function_traces.txt`

---

## STEP 3.5 — Decode DIALOGS.REC metadata block (11-byte header)

Phase 2 found the DIALOGS.REC open call but could not decode the 11-byte metadata.
Now trace from the file-open wrapper at 0x16835 to the actual record-parsing code.

```python
# work\decode_dialogs_meta.py
# Find all callers of the file-open wrapper (0x16835) and trace which one
# opens DIALOGS.REC, then decode the record-parsing logic nearby.
# Compatible with capstone 4.x and 5.x.

import capstone, struct

try:
    capstone.version_bind()
except AttributeError:
    pass

IMAGE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'
DIALOGS_FILENAME_OFFSET = 0x93ED  # confirmed from Phase 2

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())

md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_16)
md.detail = True

# Find all CALL FAR to the file-open wrapper (0x16835)
# In real-mode 16-bit, a far call encodes as: 9A <offset_lo> <offset_hi> <seg_lo> <seg_hi>
# But since we have a flat image, look for any CALL to ~0x16835

print("=== Searching for callers of file-open wrapper ===\n")
target_lo = 0x16835 & 0xFFFF
target_hi = (0x16835 >> 16) & 0xFFFF

insns = list(md.disasm(bytes(raw), 0))
for insn in insns:
    if insn.mnemonic in ('call', 'callf') and '16835' in insn.op_str:
        print(f"  0x{insn.address:05X}: {insn.mnemonic} {insn.op_str}")

# Also: search raw bytes for the DIALOGS.REC filename reference
# The filename is at 0x93ED; look for code that loads this address into DS:DX
dialogs_lo = DIALOGS_FILENAME_OFFSET & 0xFF
dialogs_hi = (DIALOGS_FILENAME_OFFSET >> 8) & 0xFF
pattern = bytes([dialogs_lo, dialogs_hi])
pos = 0
print(f"\n=== Searching for references to DIALOGS.REC filename (0x{DIALOGS_FILENAME_OFFSET:04X}) ===\n")
while True:
    pos = raw.find(pattern, pos)
    if pos == -1:
        break
    context = raw[pos-8:pos+8]
    print(f"  0x{pos:05X}: {context.hex(' ')}")
    pos += 2

# Show the region around 0x93ED to understand how the filename is used
print(f"\n=== Code near DIALOGS.REC filename string (0x93C0 - 0x9430) ===\n")
chunk = bytes(raw[0x93C0:0x9430])
for insn in md.disasm(chunk, 0x93C0):
    hex_bytes = ' '.join(f'{b:02X}' for b in insn.bytes[:6])
    print(f"  0x{insn.address:05X}:  {hex_bytes:<20}  {insn.mnemonic:<8} {insn.op_str}")
```

Run: `python work\decode_dialogs_meta.py > work\dialogs_meta_trace.txt`

---

## STEP 3.6 — Decode save game format (ZOP12.GAM)

Cross-reference the .GAM file content against the save/load code in the image.

```python
# work\decode_save.py
# Decode ZOP12.GAM by matching its bytes against a save-load routine.

import struct

IMAGE   = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'
SAVEFILE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\ZOP12.GAM'

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())
with open(SAVEFILE, 'rb') as f:
    save = bytearray(f.read())

print(f"Save file size: {len(save)} bytes")
print(f"Full hex dump:")
for i in range(0, len(save), 16):
    row = save[i:i+16]
    hex_str = ' '.join(f'{b:02X}' for b in row)
    asc_str = ''.join(chr(b) if 0x20 <= b <= 0x7E else '.' for b in row)
    print(f"  {i:04X}:  {hex_str:<48}  {asc_str}")

print("\n=== Known party member names (from Phase 2) ===")
print("  Chippere, Buttafuco, Tailgate, Guiltfuco")
print("  (4 members -- 5th slot may be empty or be 'ZOP12')")

print("\n=== Attempt structured decode ===")
# Find Pascal string names in the save
pos = 0
while pos < len(save):
    slen = save[pos]
    if 3 <= slen <= 15 and pos + slen + 1 <= len(save):
        candidate = save[pos+1:pos+1+slen]
        if all(0x20 <= c <= 0x7E for c in candidate):
            name = candidate.decode('ascii')
            print(f"  @{pos:3d} (0x{pos:02X}): Pascal string len={slen} '{name}'")
    pos += 1

print("\n=== Interpretation attempt (hypothesis-based) ===")
# Try to read known fields at plausible offsets
try:
    print(f"  Bytes 0-2 (header/magic):  {save[0]:02X} {save[1]:02X} {save[2]:02X}")
    
    # Search for miles value: should be <= 2000 (0x07D0)
    for i in range(0, 130, 2):
        val = struct.unpack_from('<H', save, i)[0]
        if 0 < val <= 2000:
            print(f"  @{i}: uint16 = {val} (could be miles_traveled?)")
    
    # Search for cash: typical starting cash by occupation
    # Banker=$1600, Carpenter=$800, Farmer=$400 (in cents or dollars)
    for i in range(0, 130, 2):
        val = struct.unpack_from('<H', save, i)[0]
        if val in (1600, 800, 400, 160, 80, 40, 16, 8, 4):
            print(f"  @{i}: uint16 = {val} (could be cash?)")

except Exception as e:
    print(f"  Error: {e}")
```

Run: `python work\decode_save.py > work\save_decode.txt`

---

## STEP 3.7 — Reconstruct score formula

From Phase 2: score formula confirmed to include occupation multipliers.
Find the score calculation code in the disassembly.

```python
# work\find_score.py
# Locate the score/endgame calculation routine.
# Strategy: search for the occupation multiplier constants (2 and 3).
# Compatible with capstone 4.x and 5.x.

import capstone, struct

try:
    capstone.version_bind()
except AttributeError:
    pass

IMAGE = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.BIN'

with open(IMAGE, 'rb') as f:
    raw = bytearray(f.read())

md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_16)
md.detail = True

# Look for: MOV AX, 2 or MOV AX, 3 followed by MUL
# (occupation multiplier: Carpenter x2, Farmer x3)
insns = list(md.disasm(bytes(raw), 0))

print("=== Score formula candidates (MOV AX,2/3 near MUL) ===\n")
for i, insn in enumerate(insns):
    if (insn.mnemonic == 'mov' and 
        insn.op_str in ('ax, 2', 'ax, 3', 'ax, 0x2', 'ax, 0x3')):
        window = insns[max(0,i-4):i+8]
        has_mul = any(w.mnemonic in ('mul', 'imul') for w in window)
        if has_mul:
            print(f"--- Candidate at 0x{insn.address:05X} ---")
            for w in window:
                hex_bytes = ' '.join(f'{b:02X}' for b in w.bytes[:6])
                print(f"  0x{w.address:05X}:  {hex_bytes:<20}  {w.mnemonic:<8} {w.op_str}")

# Also: search near "Congratulations" string (endgame text confirmed in Phase 2)
congrats_offset = raw.find(b'Congratul')
if congrats_offset != -1:
    print(f"\n=== Code around 'Congratulations' text (0x{congrats_offset:05X}) ===\n")
    chunk = bytes(raw[congrats_offset-128:congrats_offset+64])
    for insn in md.disasm(chunk, congrats_offset-128):
        hex_bytes = ' '.join(f'{b:02X}' for b in insn.bytes[:6])
        print(f"  0x{insn.address:05X}:  {hex_bytes:<20}  {insn.mnemonic:<8} {insn.op_str}")
```

Run: `python work\find_score.py > work\score_formula.txt`

---

## STEP 3.8 — Write Phase 3 findings to oregon_trail_reverse.md

After all analysis scripts complete, compile findings and APPEND to:
  E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon_trail_reverse.md

Write in chunks of 30 lines maximum. Never overwrite the existing file.
Use append mode only.

New sections to add (in this order):

```
---

## Phase 3 Findings

### P3.1 Disassembly setup
[Which tool was used, version, how unpacked BIN was loaded]

### P3.2 RNG algorithm
[Confirmed algorithm and constants, OR confirmed BIOS timer based]
[Pseudo-code of RNG function]

### P3.3 Landmark table decoded
[Full table: landmark name | required miles | other fields]
[Mermaid diagram of trail route with mile markers]

### P3.4 Illness parameter table interpreted
[Field meanings confirmed from code traces]
[Table: illness | prob_weight | modifier | recovery | health_loss]

### P3.5 Main game loop located
[Function address, call graph, pseudo-code of daily loop]

### P3.6 Event dispatch decoded
[Threshold values confirmed from disassembly]
[Full event table with probabilities]

### P3.7 DIALOGS.REC metadata decoded
[Confirmed field layout from code traces]

### P3.8 Save game format confirmed
[Final struct layout with confirmed field offsets]

### P3.9 Score formula
[Confirmed from disassembly or string evidence]

---

## 5. Game Logic Reconstructed (Phase 3 — FINAL)

### 5.1 Daily travel cycle (FINAL pseudo-code)
### 5.2 Event system (FINAL with actual thresholds)  
### 5.3 Health/resource degradation (FINAL with formula)
### 5.4 River crossing (FINAL)
### 5.5 Hunting mini-game (FINAL)
### 5.6 Win/loss + score (FINAL)

---

## 13. Trail Route Diagram (Mermaid)

```mermaid
graph LR
    A["Independence, MO\n(mile 0)"] --> B
    B["Kansas River\n(mile ~100)"] --> C
    C["Big Blue River\n(mile ~200)"] --> D
    D["Fort Kearney\n(mile ~300)"] --> E
    E["Chimney Rock\n(mile ~600)"] --> F
    F["Fort Laramie\n(mile ~650)"] --> G
    G["Independence Rock\n(mile ~830)"] --> H
    H["South Pass\n(mile ~950)"] --> I
    I["Fort Bridger\n(mile ~1060)"] --> J
    J["Green River\n(mile ~1100)"] --> K
    K["Soda Springs\n(mile ~1195)"] --> L
    L["Fort Hall\n(mile ~1250)"] --> M
    M["Snake River\n(mile ~1400)"] --> N
    N["Fort Boise\n(mile ~1450)"] --> O
    O["Blue Mountains\n(mile ~1550)"] --> P
    P["Fort Walla Walla\n(mile ~1650)"] --> Q
    Q["The Dalles\n(mile ~1720)"] --> R
    R["Willamette Valley\n(mile 2000)\nYOU WIN"]
```

Note: mile markers are approximate — CONFIRM from decoded landmark table in P3.3.
```

---

## IMPORTANT

- All Python scripts go in the work\ folder.
- All output .txt files go in the work\ folder.
- Append to oregon_trail_reverse.md only — never overwrite.
- Write the doc in chunks of 30 lines max.
- Tag: [CONFIRMED] = from disassembly. [HYPOTHESIS] = inferred. [UNCERTAIN] = unclear.
- If capstone is not available, try: pip install capstone --user
- If pip is blocked, use the ndisasm or objdump fallback paths described in Step 3.0.
- When all steps complete, report: "Phase 3 complete. oregon_trail_reverse.md is updated."
