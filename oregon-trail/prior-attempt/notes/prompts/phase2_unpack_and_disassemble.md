# Oregon Trail RE — Phase 2: Unpack + Disassembly
# Paste this entire prompt into Claude Code.
#
# CRITICAL FINDING FROM PHASE 1:
#   OREGON.EXE is LZEXE 0.91-packed (Fabrice Bellard, 1989).
#   Static disassembly of OREGON.EXE as-is shows ONLY the ~2KB unpacker stub.
#   We MUST produce an unpacked copy first. The original file is NEVER touched.
#
# All work goes into a new subfolder: work\
# Output doc: oregon_trail_reverse.md (append to existing)
# ============================================================

Phase 1 is complete. Key findings carried forward:
- OREGON.EXE: LZEXE 0.91 packed, Turbo Pascal 5.5/6.0, Borland BGI, Genus pcxLib
- DIALOGS.REC: NPC dialog database, ~157 variable-length Pascal-string records
- ZOP12.GAM: developer test save game (NOT a price table)
- HISCORES.REC: 10 x 18-byte records, pre-seeded with real historical names
- MAP.PCX: absent from disk, must be inside OTMCGA.PCL archive

Working directory: E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\
Output doc: E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon_trail_reverse.md
All derived files go to: E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\

Do NOT modify any original files. The work\ folder is for derived/generated files only.

---

## STEP 2.0 — Create work directory

```
mkdir "E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work"
```

---

## STEP 2.1 — Unpack OREGON.EXE

The LZEXE 0.91 signature was confirmed at offset 0x1C ("LZ91").
We need the unpacked binary before any meaningful disassembly.

### Option A — Use UNLZEXE (preferred if available)

Check if UNLZEXE is on PATH or in the game folder:
```
where unlzexe
unlzexe --version
```

If found, run:
```
cd "E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN"
unlzexe OREGON.EXE work\OREGON_UNPACKED.EXE
```

### Option B — Use UNP (alternative DOS unpacker)

```
where unp
unp "E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\OREGON.EXE" "E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.EXE"
```

### Option C — Python LZEXE unpacker script

If neither tool is available, write this Python script to work\unpack_lzexe.py and run it.
LZEXE 0.91 uses a well-known LZ77+Huffman scheme; a Python implementation is straightforward.

```python
# work\unpack_lzexe.py
# Minimal LZEXE 0.91 unpacker for Oregon Trail RE project.
# Based on the public LZEXE 0.91 specification.
# Input:  OREGON.EXE (packed)
# Output: OREGON_UNPACKED.EXE (raw DOS MZ image, ready for Ghidra)

import struct, sys, os

def unpack_lzexe(src_path, dst_path):
    with open(src_path, 'rb') as f:
        data = bytearray(f.read())

    # Verify MZ signature
    assert data[0:2] == b'MZ', "Not a DOS executable"

    # Read MZ header fields
    e_cblp   = struct.unpack_from('<H', data, 0x02)[0]   # bytes on last page
    e_cp     = struct.unpack_from('<H', data, 0x04)[0]   # pages in file
    e_cparhdr= struct.unpack_from('<H', data, 0x08)[0]   # header size in paragraphs
    e_cs     = struct.unpack_from('<H', data, 0x16)[0]   # initial CS
    e_ip     = struct.unpack_from('<H', data, 0x14)[0]   # initial IP
    e_ss     = struct.unpack_from('<H', data, 0x0E)[0]   # initial SS
    e_sp     = struct.unpack_from('<H', data, 0x10)[0]   # initial SP

    # Check for LZEXE 0.91 magic at offset 0x1C
    if data[0x1C:0x20] != b'LZ91':
        print("WARNING: LZ91 magic not found at 0x1C. File may not be LZEXE 0.91.")
        print(f"  Bytes at 0x1C: {data[0x1C:0x20].hex()}")

    # The compressed image starts after the MZ header
    header_size = e_cparhdr * 16
    file_size   = (e_cp - 1) * 512 + (e_cblp if e_cblp else 512)

    print(f"MZ header size : {header_size} bytes")
    print(f"File size (hdr): {file_size} bytes")
    print(f"Actual file    : {len(data)} bytes")
    print(f"Initial CS:IP  : {e_cs:04X}:{e_ip:04X}")
    print(f"LZ magic       : {data[0x1C:0x20]}")

    # NOTE: Full LZEXE 0.91 decompression requires implementing the bit-stream decoder.
    # This stub identifies the structure. For full decompression use DOSBox-X method below.
    print()
    print("LZEXE 0.91 decompression requires DOSBox-X or a complete unpacker.")
    print("See STEP 2.1 Option D below.")

if __name__ == '__main__':
    src = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\OREGON.EXE'
    dst = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\OREGON_UNPACKED.EXE'
    unpack_lzexe(src, dst)
```

Run with: `python work\unpack_lzexe.py`

### Option D — DOSBox-X debugger method (most reliable, always works)

If Options A/B/C are not available or fail, use DOSBox-X:

1. Install DOSBox-X if not present: https://dosbox-x.com/
2. Mount the game directory and launch with debugger:
   ```
   dosbox-x -conf dosbox-x.conf -debug
   ```
3. Inside DOSBox-X: mount c and run OREGON.EXE — it will unpack itself into memory.
4. At the DOSBox debugger, after the unpack stub runs but before the game starts,
   dump the entire CS segment to a file:
   ```
   MEMDUMP CS:0 [size] work\OREGON_DUMP.BIN
   ```
5. That dump IS the unpacked code. Use Ghidra to load as raw x86 16-bit binary.

Report which option worked and the resulting file size of OREGON_UNPACKED.EXE.
Expected unpacked size: roughly 120-180 KB (LZEXE typically achieves 40-50% compression).

---

## STEP 2.2 — Verify the unpacked image

After unpacking, confirm it is a valid DOS executable:

```python
# Quick sanity check
with open(r'work\OREGON_UNPACKED.EXE', 'rb') as f:
    hdr = f.read(64)
print(f"Signature : {hdr[0:2]}")               # should be b'MZ'
print(f"First 32 bytes hex: {hdr[:32].hex(' ')}")
# Should NOT start with 4D5A...LZ91 — that was the packed version
# Should show a normal MZ header with real relocation count > 0
```

Then do a string dump of the UNPACKED binary to confirm game strings are now visible:

```python
import re
with open(r'work\OREGON_UNPACKED.EXE', 'rb') as f:
    raw = f.read()

# Extract printable ASCII runs of 6+ characters
strings = re.findall(rb'[\x20-\x7E]{6,}', raw)
strings_decoded = [s.decode('ascii', errors='ignore') for s in strings]

# Spot-check: these should now be visible in the unpacked binary
targets = ['Banker', 'Carpenter', 'Farmer', 'Steady', 'Strenuous',
           'dysentery', 'typhoid', 'Kearny', 'Laramie', 'Oregon City',
           'oxen', 'ammunition', 'clothing', 'Here lies']

print(f"\nTotal strings: {len(strings_decoded)}")
print("\nSpot-check for expected game strings:")
for t in targets:
    found = [s for s in strings_decoded if t.lower() in s.lower()]
    status = 'FOUND' if found else 'NOT FOUND'
    sample = found[0][:60] if found else ''
    print(f"  [{status}] '{t}' -> {sample}")

# Save full string dump
with open(r'work\oregon_unpacked_strings.txt', 'w', encoding='utf-8') as f:
    for s in strings_decoded:
        f.write(s + '\n')
print("\nFull strings saved to work\oregon_unpacked_strings.txt")
```

---

## STEP 2.3 — Ghidra disassembly setup

If Ghidra is available (check with `where ghidra` or look in Program Files):

1. Create a new Ghidra project: File > New Project > Non-Shared Project
   Name: OregonTrail_RE
   Location: E:\Projects\BASIC Programs\Collections\Oregon Trail\work\ghidra_project\

2. Import OREGON_UNPACKED.EXE:
   File > Import File
   Language: x86 / Real Mode / 16-bit / little-endian
   Loader: MS-DOS EXE

3. Run auto-analysis: Analysis > Auto Analyze (accept all defaults)

4. After analysis, export the function list:
   Window > Symbol Table > export as CSV to work\function_list.csv

5. Report:
   - How many functions were identified?
   - What are the 10 largest functions by size?
   - Are there any functions named by Ghidra's auto-analysis (e.g. from debug symbols)?

### If Ghidra is NOT available:

Use objdump (from MinGW/Cygwin/WSL if present):
```
objdump -d -M intel --no-show-raw-insn work\OREGON_UNPACKED.EXE > work\disasm.txt
```

Or ndisasm (from NASM):
```
ndisasm -b 16 work\OREGON_UNPACKED.EXE > work\disasm.txt
```

Check for these tools:
```
where objdump
where ndisasm
where nasm
```

---

## STEP 2.4 — Find key anchor points in the disassembly

Once we have a disassembly (from any tool above), search for these patterns.
If using Ghidra, use the Search > Memory function. If using text disasm, use grep or PowerShell.

### Anchor A — Turbo Pascal startup signature

Turbo Pascal 5.5/6.0 programs begin with a recognizable startup sequence.
Search for the byte pattern: `FA 33 C0 8E D0` (CLI; XOR AX,AX; MOV SS,AX)
or: `FB 8B 16` (STI; MOV DX,[...])
This locates the TP runtime entry point. Everything before the first Pascal `Begin` call is runtime boilerplate.

### Anchor B — Random number generator

Turbo Pascal 5.5's built-in Random uses a multiplicative LCG:
  seed = seed * 0x8088405 + 1   (32-bit multiply)

Search for the constant 0x8088405 (hex: 05 84 08 80) or decimal 134775813.
This will pinpoint the RNG routine, which is called by every event roll.

Alternative: search for `F7 E1` (MUL CX) or `F7 E3` (MUL BX) near a loop with a modulo.

### Anchor C — Main game loop / travel engine

Look for a function that:
- Is called in a tight loop (the daily travel cycle)
- Calls multiple other functions in sequence
- Has a comparison against a large constant (total_miles >= 2040 for Oregon City)

Search for: `3D F8 07` (CMP AX, 0x07F8 = 2040 decimal) or nearby round numbers (1800, 2000, 2100).

### Anchor D — Health update / resource consumption

Look for repeated subtraction patterns:
- SUB word ptr [food_var], something   (food consumption)
- Multiple CMP [var], 0 followed by JLE (boundary check: "if food <= 0")
- A loop iterating 5 times (for 5 party members)

### Anchor E — Event table dispatch

Turbo Pascal programs often use a jump table for case statements.
Pattern: `MOV BX, [event_roll]` → scale → `JMP WORD PTR [BX+table_base]`
Or a chain of CMP/JBE pairs (each threshold check = one event type).

### Anchor F — DIALOGS.REC file read

Search for the string "DIALOGS.REC" in the unpacked binary.
The code near this string is the file-open routine for NPC dialog.
Trace the call chain from there to find how dialog records are indexed.

### Anchor G — BGI graphics init

Search for "CGA.BGI" or "VGA256.BGI" strings in the unpacked binary.
Borland's InitGraph call will be nearby. This anchors the graphics subsystem entry point.

---

## STEP 2.5 — Decode the DIALOGS.REC 11-byte metadata block

From Phase 1, each dialog record has an 11-byte metadata block between the speaker name and the dialog body.
First record metadata (hex): E6 79 B6 79 00 00 00 00 01 01 00

Now that we have the unpacked EXE, search for how this metadata is READ and USED:
1. Find "DIALOGS.REC" string in the unpacked binary
2. Trace the file-read code to find the record-parsing function
3. Identify which fields of the 11-byte block are used in conditional checks
   (e.g., does byte[8] = 0x01 mean "only show near water crossings"?)

The 11-byte breakdown hypothesis to test:
```
Offset  Size  Hypothesis
  0      2    Event location ID (0x79E6 = ?)
  2      2    Second location ID or precondition (0x79B6 = ?)
  4      2    Stat threshold? (0x0000 = always show)
  6      2    Unknown flags
  8      1    Event type category (01 = NPC advice?)
  9      1    Trigger frequency or probability weight
 10      1    NUL terminator or padding
```

---

## STEP 2.6 — Decode ZOP12.GAM save game format

The 144-byte developer save contains party names: Chippere, Buttafuco, Tailgate, Guiltfuco.
Now cross-reference with the save-file loading code in the unpacked EXE.

Search in disassembly for:
- File open with ".GAM" extension
- Read of exactly 144 bytes (or a struct that totals 144)
- The layout of the save struct

Likely structure (hypothesis to test against actual code):
```
struct SaveGame {               // target: 144 bytes
    char  save_name[9];        // DOS 8.3 name used as filename base
    uint8_t party_size;        // 1-5
    Party  members[5];         // variable: name + health + status
    uint16_t total_miles;
    uint16_t food;
    uint16_t ammunition;
    uint8_t  clothing;
    uint8_t  oxen;
    uint8_t  wheels;
    uint8_t  axles;
    uint8_t  tongues;
    uint16_t cash;             // in cents?
    uint8_t  month;
    uint8_t  day;
    uint8_t  difficulty;
    uint8_t  occupation;
    uint8_t  pace;
    uint8_t  rations;
};
```

---

## OUTPUT: Append Phase 2 findings to oregon_trail_reverse.md

Append the following sections to the EXISTING file at:
  E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon_trail_reverse.md

Write in chunks of 30 lines or fewer. Append (do NOT overwrite).

New sections to add:

```
---

## Phase 2 Findings

### P2.1 Unpacking result
[Which method worked, resulting file size, confirmed MZ validity]

### P2.2 String dump verification
[Which target strings were found / not found in unpacked binary]
[Total string count before vs after unpacking]

### P2.3 Disassembly tool used
[Ghidra / objdump / ndisasm — version, settings, output location]

### P2.4 Anchor points located

#### A — TP startup signature
[Address found, brief code excerpt]

#### B — Random number generator
[Address found, LCG constant confirmed/not found, alternative RNG pattern]
[Pseudo-code of RNG routine once located]

#### C — Main game loop
[Address found, function size, callee list]
[Pseudo-code skeleton of daily travel loop]

#### D — Health / resource update
[Address found, subtraction pattern, loop count]

#### E — Event table dispatch
[Address found, number of event branches, threshold values]

#### F — DIALOGS.REC reader
[Address found, call chain, record-parsing logic]

#### G — BGI init
[Address found, graphics mode detected at runtime]

### P2.5 DIALOGS.REC metadata block decoded
[Confirmed field layout with evidence from disassembly]
[Updated record format specification]

### P2.6 ZOP12.GAM save format decoded
[Confirmed struct layout]
[Decoded full ZOP12.GAM content as named fields]

---

## 5. Game Logic Reconstructed (Phase 2 — updated)

### 5.1 Daily travel cycle

[Replace placeholder with actual pseudo-code based on disassembly findings]

### 5.2 Random event system

[Replace placeholder with actual event table thresholds from code]

### 5.3 Health and resource degradation

[Formula with actual constants from disassembly]

### 5.4 River crossing decision tree

[Probability model based on code]

### 5.5 Hunting mini-game

[Input loop mechanics from code]

### 5.6 Win/loss conditions and score formula

[Exact checks and score calculation]
```

---

## IMPORTANT

- Append to oregon_trail_reverse.md — do NOT overwrite Phase 1 content.
- Write chunks of 30 lines max to avoid Desktop Commander timeouts.
- Verify with read_file after each write chunk.
- Tag every finding: [CONFIRMED] = seen in disassembly. [HYPOTHESIS] = inferred. [UNCERTAIN] = unclear.
- If Ghidra is not available, say so clearly and proceed with objdump or ndisasm.
- When all steps are done, report: "Phase 2 complete. Ready for Phase 3 (full game logic reconstruction)."
