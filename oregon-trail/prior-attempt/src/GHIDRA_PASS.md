# Ghidra Headless Pass — Findings and Limitations

Date: 2026-06-11
Tool: Ghidra 12.1.2 with PyGhidra (pip-installed)
Project: `work/ghidra_project/OregonTrail`

This pass loaded the unpacked binary into Ghidra and ran auto-analysis,
then used scripts to decompile target functions and gather call-graph
info.  Outcome: several confirmations, two new gaps closed, but TP6's
indirect string-addressing meant three target functions could NOT be
located cleanly by xref alone.

---

## 1. Setup

```
pip install pyghidra
python work/run_ghidra_dump.py    # opens project, decompiles targets
```

The project was first created with:
```
analyzeHeadless.bat work/ghidra_project OregonTrail \
    -import work/OREGON_UNPACKED.BIN \
    -processor "x86:LE:16:Real Mode" \
    -overwrite -analysisTimeoutPerFile 600
```

Auto-analysis took 8 seconds and produced **543 functions**.

Ghidra mapped the binary into a single flat memory block
`0000:0000 - 2000:49ff` (length 150016).  Real-mode segmented addresses
appear as `seg:offset` in the listing (e.g. function at file offset
0x11537 is named `FUN_1000_1537` and addressed as `1000:1537`).

---

## 2. Confirmed Findings (NEW)

### 2.1 JOYCAL.REC runtime variables — fully verified

Decompiled the joystick mapping function at `FUN_1000_19c0` (file offset
0x119C0).  Code reads from these state addresses:

| Address | Role | Matches JOYCAL.REC |
|---|---|---|
| `[0x16B6]` | axis-X min  | byte 0..1 |
| `[0x16B8]` | axis-X max  | byte 2..3 |
| `[0x16BA]` | axis-Y min  | byte 4..5 |
| `[0x16BC]` | axis-Y max  | byte 6..7 |
| `[0x16BE]` | enabled flag | byte 8 |
| `[0x16BF]` | button 1 state | (runtime, not in REC) |
| `[0x16C0]` | button 2 state | (runtime) |
| `[0x16C2]` | last X direction | (runtime) |
| `[0x16C4]` | last Y direction | (runtime) |

This **confirms** Phase 1's JOYCAL.REC structure (4 WORDs + 1 byte) and
extends it with the live runtime state variables.

### 2.2 Joystick subsystem is NOT the hunting game

Phase 1 attributed file offset `0x11580` to "hunting".  Ghidra
decompile shows this is actually the **joystick port reader**:

```c
void FUN_1000_1537(...) {
    out(0x201, 0);                      // strobe joystick port
    while (...) {
        bVar1 = in(0x201);              // sample 200 times
        abStack_cc[local_ce] = bVar1;
    }
    // ... convert to button + axis values
}
```

The only callers of this function are:
- `FUN_1000_19c0` — joystick value mapping (uses calibration)
- `FUN_1000_1632` — calibration loop (100 iterations)

So this is the **joystick input layer**, not hunting-specific.  The
actual hunting mini-game is elsewhere and was not located in this pass.

### 2.3 Game state address map (0x1800-0x18C0 region)

Capstone scan for `MOV [m16], AX` writes in the supplies/state area
yields these WORD slot addresses:

```
0x1837   state slot
0x1839   state slot
0x183F   food (lbs) -- CONFIRMED in Gap analysis
0x1842   state slot
0x1847   state slot
0x184D   state slot (written by food-consumption caller @ 0x14166)
0x185F   state slot
0x1861   state slot
0x1867   state slot
0x1880   state slot
0x1882   state slot
0x1886   state slot (read by food-consumption caller @ 0x14145)
0x18A0   state slot

Also confirmed earlier:
0x185E   ration index (byte, from disasm @ 0x13D34)
0x1853   party_member[0] alive flag byte (and +i for index 1..4)
```

This forms a contiguous **game state table**.  Mapping each slot to a
semantic field would require either further decompile passes or
runtime BPM trace per slot — outside this pass's scope.

### 2.4 543 functions catalogued

Ghidra auto-detected 543 functions, mostly named `FUN_seg_offset`.
Naming convention:
- `FUN_1000_xxxx` → file offset 0x1xxxx (game code segment)
- `FUN_2000_xxxx` → file offset 0x2xxxx (TP runtime + late game code)
- A few outliers at lower addresses (entry-point stub area)

This catalog lives in `work/ghidra_dump2.txt` and can be re-extracted
by re-running the dump scripts.

---

## 3. Gaps That DID NOT Close

### 3.1 Score function

Searched for direct references (`MOV reg, 0x7CA6`, `PUSH 0x7CA6`):
**ZERO hits**.

This means TP6 references the score-output strings via indirection —
likely a string-table lookup or far-pointer pair built at runtime,
where the linear address 0x7CA6 never appears as a literal immediate.

To close this, would need either:
- Ghidra symbol-based search after manually creating data labels
  for the string blocks at 0x7CA6
- DOSBox-X BPM-write on a candidate score state variable, triggered
  by reaching Oregon and observing the score-compute call chain

### 3.2 Pace menu code & daily-miles function

Found **1 site** referencing pace text at `0x9E00` via
`MOV SI, 0x9E00` at file `0x23DEE`.  But auto-analysis did not create
a function around 0x23DEE — the area is likely in the TP6 runtime
segment that the auto-analyzer skipped.

To close: force-disasm from `0x23D60` and identify the function
boundary, then trace its inputs.  Requires opening the Ghidra project
read-write (the headless run was read-only).

### 3.3 Hunting game

Searched for references to the "Press SPACE BAR" prompt (`0x089D0`):
**ZERO direct hits**.  Same indirection problem as score.

The hunting game is therefore in a function that:
- Reads joystick state via `FUN_1000_19c0` (or keyboard)
- Reads the hunting prompt indirectly
- Updates ammo + meat counters

Not located in this pass.

---

## 4. Why Three Targets Failed

TP6 generates code for `Write('X')` / `Writeln('X')` as something like:

```
push ds                        ; segment of string
mov  si, imm16                 ; offset of string
push si
lcall TP_RUNTIME : WRITE_STRING
```

But many TP6 builds use a more elaborate string-table mechanism where:
- All program strings live in a packed constant pool
- A string-id WORD is pushed and an INDIRECT lookup happens in the
  runtime
- The linear address of the string never appears in the call site
  as a literal

This makes byte-pattern xref search fail.  The proper fix is to
identify the string-table base in the data segment and walk it as a
data structure — work that requires interactive Ghidra exploration
rather than headless batch.

---

## 5. Tasks the Ghidra Pass Eliminated

Even though three targets didn't close, the pass eliminated wasted
work in these directions:

* **Joystick == hunting** assumption is BUSTED.  Don't search for
  animal weights near 0x11580.

* **Phase 4's "score function at 0x13D26"** is DEFINITIVELY food
  consumption (we saw it called from a "compute consumption, decrement
  food" pattern in the decompile).  Already documented in
  STATICTRACE.TXT section C; Ghidra confirms.

* The game state region at **0x1800-0x18C0** is a contiguous structured
  table — future RE should map slots semantically rather than treating
  them as scattered globals.

---

## 6. Reproducing This Pass

```bash
# One-time setup
pip install pyghidra

# Build project (only first time)
cd work
"E:\Applications\ghidra\support\analyzeHeadless.bat" \
    ghidra_project OregonTrail \
    -import OREGON_UNPACKED.BIN \
    -processor "x86:LE:16:Real Mode" \
    -overwrite

# Run dump scripts
"E:\miniconda3\python.exe" run_ghidra_dump.py     # decompile targets
"E:\miniconda3\python.exe" run_ghidra_dump2.py    # text-search all
"E:\miniconda3\python.exe" run_ghidra_dump3.py    # segment diagnostic
"E:\miniconda3\python.exe" final_disasm_pass.py   # Capstone fallback
```

Outputs:
- `work/ghidra_dump.txt` — target function decompiles
- `work/ghidra_dump2.txt` — text-search hits
- `work/ghidra_dump3.txt` — segment info diagnostic
- `work/final_disasm.txt` — Capstone direct disasm of references

---

## 7. Next Steps to Close the Three Failed Targets

If you ever return to close these:

**Score** — Open Ghidra interactively, navigate to the data block at
0x7CA6, define it as a Pascal string, then use Ghidra's "Find
References to Address" feature.  This should find the indirect
references that headless missed.

**Pace** — Force code disasm at 0x23DEE, walk backward to find
function entry (likely just before in the same segment), then
decompile.  The function reads the pace menu choice and dispatches.
Trace its callers to find the daily-loop's pace use.

**Hunting** — Look for functions that CALL `FUN_1000_19c0` from outside
the calibration path.  Filter callers of joystick read for those that
ALSO read ammo counter (0x1839 candidate) or write meat (0x1842
candidate).
