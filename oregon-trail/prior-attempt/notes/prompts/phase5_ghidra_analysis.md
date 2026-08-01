# Oregon Trail RE — Phase 5: Ghidra Deep Analysis
# Paste seluruh file ini ke Claude Code.
#
# PREREQUISITE:
#   Ghidra harus sudah terinstall. Download: https://ghidra-sre.org/
#   Atau: winget install Ghidra
#
# TUJUAN PHASE 5:
#   Menjawab semua pertanyaan yang belum terjawab dari Phase 1-4:
#   - Exact RNG algorithm
#   - Full score formula
#   - Game flow: fungsi apa dipanggil di event apa
#   - Gambar apa yang di-load di screen apa
#   - Animasi logic yang exact
#   - Copy-protection threshold meaning
#
# FILES:
#   Input:  work\OREGON_UNPACKED.BIN (150,016 bytes) — sudah ada dari Phase 2
#   Output: Append ke oregon_trail_reverse.md
#   Ghidra project: work\ghidra_project\
#
# Working directory: E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\

# =============================================================================
# STEP 5.0 — Setup Ghidra project
# =============================================================================
# Cek Ghidra tersedia:
#
#   where.exe ghidra 2>$null
#   where.exe ghidraRun 2>$null
#   Get-ChildItem "C:\Program Files\Ghidra*" -ErrorAction SilentlyContinue
#   Get-ChildItem "C:\ghidra*" -ErrorAction SilentlyContinue
#
# Jika Ghidra ditemukan, import file:
#   1. Buka Ghidra GUI
#   2. File → New Project → Non-Shared → nama: OregonTrail_Phase5
#      Location: E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\ghidra_project\
#   3. File → Import File → pilih work\OREGON_UNPACKED.BIN
#      Language: x86 / Real Mode / 16-bit / little-endian
#      Loader: Raw Binary (bukan MS-DOS EXE karena ini flat binary)
#      Base address: 0x0000 (flat image, offset langsung)
#   4. Analysis → Auto Analyze → centang semua, klik Analyze
#      Tunggu sampai selesai (bisa 1-5 menit)
#
# Jika Ghidra TIDAK ditemukan, jalankan dulu:
#   winget install Ghidra
#   atau download dari https://ghidra-sre.org/ dan extract ke C:\ghidra\
#
# CATATAN PENTING tentang entry point:
#   Entry point OREGON_UNPACKED.BIN ada di offset 0x010A (confirmed Phase 2)
#   Di Ghidra: Window → Script Manager → cari "SetEntryPoint"
#   Atau manual: klik di 0x010A → klik kanan → Function → Create Function

# =============================================================================
# STEP 5.1 — Label semua confirmed anchor points dari Phase 2-4
# =============================================================================
# Setelah Ghidra selesai auto-analyze, label semua anchor points yang
# sudah kita ketahui. Di Ghidra: klik di address → tekan L untuk rename.
#
# Jalankan script Python ini di Ghidra Script Manager (File → Script Manager
# → Green Play button) untuk label semua sekaligus:
#
# Simpan sebagai: work\ghidra_scripts\label_anchors.py
# Lalu jalankan dari Ghidra Script Manager

import os

SCRIPT_CONTENT = '''
# label_anchors.py — Ghidra script untuk label semua confirmed anchors
# Jalankan dari: Ghidra → Window → Script Manager → Run Script

from ghidra.program.model.symbol import SourceType

def label(addr_int, name, comment=None):
    addr = currentProgram.getAddressFactory().getAddress(hex(addr_int))
    if addr is None:
        print(f"Could not resolve address 0x{addr_int:05X}")
        return
    # Create label
    currentProgram.getSymbolTable().createLabel(addr, name, SourceType.USER_DEFINED)
    # Add comment if provided
    if comment:
        currentProgram.getListing().setComment(
            addr,
            ghidra.program.model.listing.CodeUnit.PLATE_COMMENT,
            comment
        )
    print(f"Labeled 0x{addr_int:05X} as {name}")

# === Confirmed from Phase 2-4 ===

# Entry points
label(0x010A, "TP_UNIT_INIT_CHAIN",
      "Turbo Pascal unit initializer chain. 6 CALL FAR instructions.")
label(0x012F, "MAIN_PROGRAM_PROLOGUE",
      "Main program entry after TP runtime init.")

# Main game segment (segment 0x1042, file offset = 0x1042 * 16 = 0x10420)
label(0x10420 + 0x0DF4, "func_THUNK_DISPATCHER",
      "1-argument thunk/dispatcher. Confirmed Phase 2.")
label(0x10420 + 0x29E2, "func_BANNER_DRAW",
      "Draws title banner. Confirmed Phase 2.")
label(0x10420 + 0x4108, "func_SPLASH_TIMER",
      "Splash screen wait + installs INT 1Ch hook. Confirmed Phase 2.")
label(0x10420 + 0x47BA, "func_GAME_INIT",
      "Game initializer + copy-protection check. Confirmed Phase 2.")

# Score formula
label(0x13045, "func_COUNT_ALIVE_PARTY",
      "Counts alive party members. Loop i in [0..4], check [0x1853+i] != 0xFF. Confirmed Phase 3.")
label(0x13D3A, "SCORE_FORMULA",
      "Score = base * (3 - occupation_id). Farmer=0(x3), Carpenter=1(x2), Banker=2(x1). Confirmed Phase 3.")

# Copy protection
label(0x14BFE, "COPY_PROTECT_CHECK",
      "CMP [bp-4], 0x88B8 (35000). If fails: show PROGRAM IS NOT AVAILABLE. Confirmed Phase 3.")

# File I/O
label(0x16835, "func_FILE_OPEN_WRAPPER",
      "Generic file-open wrapper. INT 21h AH=3Dh. Confirmed Phase 2.")
label(0x93ED,  "STR_DIALOGS_REC",
      "String literal: DIALOGS.REC filename. Confirmed Phase 2.")

# Data tables
label(0x23BD1, "HISCORES_SEED_DATA",
      "10 hardcoded historical names for HISCORES.REC first-run seeding. Confirmed Phase 3.")
label(0x23D86, "LANDMARK_TABLE",
      "16 landmark records x 37 bytes each. Fields: flag, map_X_LE16, map_Y_LE16, name_len, name. Confirmed Phase 3.")
label(0x24156, "ILLNESS_NAME_TABLE",
      "6 illness names x 11 bytes. Order: exhaustion, typhoid, cholera, measles, dysentery, a fever. Confirmed Phase 2.")
label(0x24198, "ILLNESS_PARAM_TABLE",
      "6 illness records x 8 bytes (4x WORD). W3=health_drain_per_day confirmed. Confirmed Phase 2.")
label(0x241C8, "EVENT_PROBABILITY_TABLE",
      "20 rows x 8 bytes. 4 trail segments x event thresholds. Structure confirmed Phase 4.")

# Hardware
label(0x11580, "JOYSTICK_PORT_READ",
      "IN AL, 0x201 — joystick port read. Confirmed Phase 2.")
label(0x21B80, "DOS_EXIT",
      "INT 21h AH=4Ch — program exit. Confirmed Phase 3.")

# BGI
label(0x24787, "STR_BGI_DRIVER_NAME",
      "BGI driver name string (CGA.BGI or VGA256.BGI). Confirmed Phase 3.")

# Game state variables
label(0x185E,  "VAR_OCCUPATION_INDEX",
      "Player occupation: 0=Farmer, 1=Carpenter, 2=Banker. Confirmed Phase 3.")
label(0x1853,  "PARTY_MEMBER_ARRAY",
      "Array[0..4] of party member records. 0xFF = dead sentinel. Confirmed Phase 3.")

print("\\nAll anchors labeled successfully!")
print("Now use cross-references (XREF) from these anchors to trace game flow.")
'''

# Simpan script
script_dir = r'E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN\work\ghidra_scripts'
os.makedirs(script_dir, exist_ok=True)
with open(os.path.join(script_dir, 'label_anchors.py'), 'w') as f:
    f.write(SCRIPT_CONTENT)
print(f"Script saved to: {script_dir}\\label_anchors.py")
print("Run this from Ghidra: Window → Script Manager → navigate to file → Run")

# =============================================================================
# STEP 5.2 — Trace RNG: cari semua caller dari counter di 0x16B2
# =============================================================================
# Setelah anchors di-label, gunakan Ghidra untuk cari RNG yang sesungguhnya.
#
# Strategy: search semua references ke area memori 0x16B2-0x16B5
# Di Ghidra: Search → Memory → search untuk byte pattern atau address reference
#
# Ghidra script untuk find RNG:

RNG_SCRIPT = '''
# find_rng.py — Ghidra script: cari fungsi RNG yang sesungguhnya
from ghidra.program.model.symbol import RefType

print("=== Searching for RNG function ===")
print()

# Method 1: Cari semua MUL/IMUL instructions
listing = currentProgram.getListing()
instructions = listing.getInstructions(True)

mul_addrs = []
for insn in instructions:
    mnem = insn.getMnemonicString().upper()
    if mnem in ('MUL', 'IMUL'):
        mul_addrs.append(insn.getAddress())

print(f"Total MUL/IMUL instructions: {len(mul_addrs)}")

# Cari MUL yang diikuti SHR/SAR dalam 8 instruksi (LCG pattern)
print("\\nMUL followed by SHR/SAR/DIV (LCG/modulo pattern):")
for addr in mul_addrs:
    insn = listing.getInstructionAt(addr)
    found_shift = False
    next_insn = insn.getNext()
    for _ in range(8):
        if next_insn is None: break
        nm = next_insn.getMnemonicString().upper()
        if nm in ('SHR', 'SAR', 'DIV', 'IDIV', 'ROR', 'ROL'):
            found_shift = True
            break
        next_insn = next_insn.getNext()
    if found_shift:
        print(f"  0x{addr}: MUL + shift/div nearby")

# Method 2: Cari INT 1Ah (BIOS timer read) — alternatif RNG source
print("\\nINT 1Ah calls (BIOS timer):")
for insn in listing.getInstructions(True):
    if insn.getMnemonicString().upper() == 'INT':
        ops = insn.toString()
        if '1a' in ops.lower() or '0x1a' in ops.lower():
            print(f"  0x{insn.getAddress()}")

# Method 3: Cari fungsi kecil (< 50 bytes) yang baca dan tulis variabel sama
# (seed update pattern)
print("\\nSmall functions with read+write same memory (seed candidates):")
fm = currentProgram.getFunctionManager()
for func in fm.getFunctions(True):
    size = func.getBody().getNumAddresses()
    if 10 < size < 100:
        # Check references
        name = func.getName()
        entry = func.getEntryPoint()
        print(f"  func @ 0x{entry}: size={size} name={name}")

print("\\nDone. Review output to identify RNG function.")
'''

with open(os.path.join(script_dir, 'find_rng.py'), 'w') as f:
    f.write(RNG_SCRIPT)
print(f"RNG script saved: {script_dir}\\find_rng.py")

# =============================================================================
# STEP 5.3 — Trace game flow: screen → function → asset loaded
# =============================================================================

FLOW_SCRIPT = '''
# trace_game_flow.py — Ghidra script: trace fungsi per game state
# Cari string references untuk setiap asset filename
# Lalu trace callers untuk tahu kapan setiap asset di-load

from ghidra.program.model.symbol import RefType
import re

print("=== Game Flow Analysis: Asset Loading ===")
print()

# Asset filenames yang kita cari
ASSET_NAMES = [
    b"DIALOGS.REC",
    b"HISCORES.REC",
    b"TOMB.REC",
    b"SONGS.TXT",
    b"JOYCAL.REC",
    b"PRODUCT.PF",
    b"MAP",
    b"BANNER",
    b"FAMILY",
    b"HUNTER",
    b"ANIMALS",
    b"TRAVELOX",
    b"SUPPLIES",
    b"EVENTS",
    b"SCENERY",
    b"TERRAIN",
    b"FLOAT",
]

memory = currentProgram.getMemory()
listing = currentProgram.getListing()
addrFactory = currentProgram.getAddressFactory()

def find_string(needle_bytes):
    """Find all occurrences of a byte string in program memory."""
    results = []
    # Search through all memory blocks
    for block in memory.getBlocks():
        start = block.getStart()
        end   = block.getEnd()
        try:
            # Read block data
            size = int(str(end)) - int(str(start)) + 1
            data = bytearray(size)
            block.getBytes(start, data)
            # Search
            pos = 0
            while True:
                idx = bytes(data).find(needle_bytes, pos)
                if idx == -1: break
                found_addr = addrFactory.getAddress(
                    hex(int(str(start)) + idx))
                results.append(found_addr)
                pos = idx + 1
        except:
            pass
    return results

for asset in ASSET_NAMES:
    addrs = find_string(asset)
    if addrs:
        print(f"\\n'{asset.decode()}' found at: {[str(a) for a in addrs]}")
        # Find references to each location
        for addr in addrs:
            refs = list(currentProgram.getReferenceManager().getReferencesTo(addr))
            if refs:
                print(f"  Referenced from:")
                for ref in refs[:5]:
                    from_addr = ref.getFromAddress()
                    func = listing.getFunctionContaining(from_addr)
                    func_name = func.getName() if func else "unknown"
                    print(f"    0x{from_addr} in func: {func_name}")
    else:
        print(f"'{asset.decode()}': not found as string")

print("\\n=== Done ===")
'''

with open(os.path.join(script_dir, 'trace_game_flow.py'), 'w') as f:
    f.write(FLOW_SCRIPT)
print(f"Flow trace script saved: {script_dir}\\trace_game_flow.py")

# =============================================================================
# STEP 5.4 — Decode copy-protection threshold 0x88B8 = 35000
# =============================================================================

CP_SCRIPT = '''
# decode_copyprotect.py — Trace the call that produces value compared to 0x88B8
# Find what syscall or computation precedes the CMP at 0x14BFE

from ghidra.program.model.symbol import RefType

CP_ADDR = 0x14BFE
print(f"=== Copy-protection at 0x{CP_ADDR:05X} ===")
print()

listing = currentProgram.getListing()
addrFactory = currentProgram.getAddressFactory()

addr = addrFactory.getAddress(hex(CP_ADDR))
insn = listing.getInstructionAt(addr)

if insn:
    print(f"Instruction: {insn}")
    print()

    # Look back 20 instructions
    print("Context (20 instructions before CMP):")
    prev = insn
    context = []
    for _ in range(20):
        prev = prev.getPrevious()
        if prev is None: break
        context.insert(0, prev)

    for i in context:
        print(f"  0x{i.getAddress()}: {i}")

    # Look for INT calls (GetDate = INT 21h AH=2Ah, or BIOS timer)
    print("\\nINT calls in surrounding 50 instructions:")
    cur = insn
    for _ in range(50):
        cur = cur.getPrevious()
        if cur is None: break
        if cur.getMnemonicString().upper() == 'INT':
            print(f"  0x{cur.getAddress()}: {cur}")
            # What was in AH before this INT?
            prev2 = cur.getPrevious()
            for _ in range(5):
                if prev2 is None: break
                print(f"    preceding: 0x{prev2.getAddress()}: {prev2}")
                prev2 = prev2.getPrevious()

    print("""
Analysis hint:
  0x88B8 = 35000 decimal
  If this is a date: days since some epoch?
    Since 1980-01-01: day 35000 = 2075-11-26 (future, too far)
    Since 1900-01-01: day 35000 = 1995-10-30 (game was 1990, so this fails in 1990!)
    Most likely: NOT a date check.
  
  Alternative: this could be a file size check, memory size check, or
  a computed value from PRODUCT.PF registration data.
  Trace the call chain to see what computation produces the value in [bp-4].
""")
'''

with open(os.path.join(script_dir, 'decode_copyprotect.py'), 'w') as f:
    f.write(CP_SCRIPT)
print(f"Copy-protect script saved: {script_dir}\\decode_copyprotect.py")

# =============================================================================
# STEP 5.5 — Full score formula: trace all variables read before 0x13D3A
# =============================================================================

SCORE_SCRIPT = '''
# trace_score_formula.py — Find all inputs to the score calculation
# We know: final_score = base * (3 - occupation_idx) @ 0x13D3A
# We need: what is "base"? Trace all memory reads before score multiply.

listing = currentProgram.getListing()
addrFactory = currentProgram.getAddressFactory()

SCORE_ADDR = 0x13D3A
print(f"=== Score formula trace from 0x{SCORE_ADDR:05X} ===")

addr = addrFactory.getAddress(hex(SCORE_ADDR))
func = listing.getFunctionContaining(addr)
if func:
    print(f"Score is in function: {func.getName()} @ {func.getEntryPoint()}")
    print(f"Function size: {func.getBody().getNumAddresses()} bytes")
    print()

    # Disassemble entire function
    print("Full function disassembly:")
    insn = listing.getInstructionAt(func.getEntryPoint())
    while insn and func.getBody().contains(insn.getAddress()):
        print(f"  {insn.getAddress()}: {insn}")
        insn = insn.getNext()

    print()
    print("Memory reads in this function (potential score components):")
    insn = listing.getInstructionAt(func.getEntryPoint())
    while insn and func.getBody().contains(insn.getAddress()):
        s = str(insn)
        import re
        # Find [0xXXXX] memory references
        refs = re.findall(r"\\[(?:0x)?([0-9a-fA-F]{2,4})\\]", s)
        for r in refs:
            print(f"  0x{insn.getAddress()}: accesses [0x{r}] — possible score variable")
        insn = insn.getNext()
'''

with open(os.path.join(script_dir, 'trace_score_formula.py'), 'w') as f:
    f.write(SCORE_SCRIPT)
print(f"Score script saved: {script_dir}\\trace_score_formula.py")

# =============================================================================
# STEP 5.6 — Export all findings dan update oregon_trail_reverse.md
# =============================================================================
print("""
=== GHIDRA ANALYSIS INSTRUCTIONS ===

1. Open Ghidra, create project, import OREGON_UNPACKED.BIN
   (x86 Real Mode 16-bit, Raw Binary, base address 0x0000)

2. Run auto-analysis: Analysis → Auto Analyze → check all → Analyze

3. Run scripts IN THIS ORDER from Window → Script Manager:
   a. work\\ghidra_scripts\\label_anchors.py  (label known anchors)
   b. work\\ghidra_scripts\\find_rng.py       (find RNG function)
   c. work\\ghidra_scripts\\trace_game_flow.py (trace asset loading)
   d. work\\ghidra_scripts\\decode_copyprotect.py (decode 0x88B8)
   e. work\\ghidra_scripts\\trace_score_formula.py (full score formula)

4. For each script, copy output to:
   E:\\Projects\\BASIC Programs\\Collections\\Oregon Trail\\oregon_trail_reverse.md
   (append to Phase 5 section)

5. For manual investigation in Ghidra:
   - Press G to Go To Address
   - Press X on any label to see all cross-references
   - Press F to define a function at cursor
   - Press L to rename a label
   - Press ; to add a comment
   - Press Ctrl+Shift+F to search for instruction patterns

KEY ADDRESSES TO INVESTIGATE MANUALLY:
   0x010A  — TP init chain (starting point)
   0x13045 — count alive party members
   0x13D3A — score formula
   0x14BFE — copy protection
   0x16835 — file open wrapper
   0x24156 — illness names
   0x24198 — illness params
   0x241C8 — event table

WHAT TO DOCUMENT:
   For each function found:
   - Entry address
   - What it does
   - What memory variables it reads/writes
   - What it calls
   - Cross-references (who calls it and when)
""")
