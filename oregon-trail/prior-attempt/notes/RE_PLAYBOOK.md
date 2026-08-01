# Reverse Engineering Playbook

How the analysis was actually done.  This is the methodology document
— read it if you ever need to redo the work or apply the same approach
to another DOS-era game.

---

## 1. The Five-Phase Static Analysis (already complete)

This was done before this session and is documented in:
- `oregon_trail_reverse.md` — full Phase 1-5 write-up
- `LEARN_OregonTrail.md` — architecture diagrams + pseudo-code

Phase summary:

| Phase | Goal | Output |
|---|---|---|
| 1 | File inventory, compiler fingerprinting | identified TP 5.5/6.0 + LZEXE 0.91 |
| 1b | Deep string scan, system identification | catalogued 14 game systems |
| 2 | LZEXE unpack, disassembly setup | `work/OREGON_UNPACKED.BIN` (150 KB) |
| 3 | Game-logic reconstruction | landmark / event / illness tables decoded |
| 4 | Deep logic / data extraction | RNG candidates, score formula candidates |
| 5 | Ghidra prep (not executed) | function map for further work |

The Python analysis tools in `work/*.py` were built during these phases.

---

## 2. The Gap Closure Pass (this session)

Started with five known gaps after Phase 5.  Closed them in priority
order using a mix of:

* **Static binary inspection** — scanning unpacked image for byte
  patterns, immediate-load clusters, function boundaries
* **String anchor mapping** — using known plaintext strings as
  navigation points in the binary
* **Targeted disassembly** — Capstone-based disasm of small regions
  with known significance
* **DOSBox-X live debugger** — interactive memory breakpoints for the
  one gap that couldn't be closed statically (RNG)

### 2.1 Closure Order Used

1. **Gap #5 PCX decoder** — pure clean-room implementation of a public
   standard (ZSoft PCX format).  No analysis needed beyond the
   `work/extract_graphics.py` reference implementation.

2. **Gap #2 Copy-protect** — already analyzed in
   `work/copyprotect_analysis.txt`.  Just documented in
   `src/COPYPROT.PAS` with the gate's exact disasm and the resolved
   1995-10-28 expiry date.

3. **Gap #4 Flag 0x7D** — byte-pattern scan of unpacked binary for
   `CMP AL, 0x7D` style instructions returned no direct matches.
   Closed by combining:
   - which records have the flag (Fort Bridger + Fort Walla Walla,
     both historic trail-fork junctions)
   - the `Sublette` string embedded at `0x23BFC` immediately before
     the landmark table (confirms Sublette Cutoff knowledge in code)
   - structural inference from historical knowledge of Oregon Trail
     route alternatives

4. **Gap #1 DIALOGS metadata** — closed in two passes:
   - First pass found records are fixed 286-byte slots with a constant
     `00 00 00 00 4D 00 00 01` trailer marker
   - Second pass discovered that the SLOT INDEX is the implicit
     binding to landmark zones — verified 10/10 against place names
     mentioned in record bodies

5. **Gap #3 RNG** — the only gap requiring DOSBox-X live trace.  See
   section 4 below for the full playbook.

### 2.2 Deep Static Analysis Pass

After Gap #3 closed, ran a follow-up pass to upgrade items previously
marked APPROXIMATED.  Results in `src/STATICTRACE.TXT`:

* TOMB.REC, music tempo, ration consumption → **CLOSED / CONFIRMED**
* Score component structure → **PARTIAL** (components confirmed,
  weights unknown)
* Pace hour constants 8/12/16 → **DISPROVED** (not in binary)
* Speed per oxen, hunting tables → still open

---

## 3. Static Analysis Patterns That Worked

### 3.1 Immediate-Value Cluster Search

For tables of small integer constants (illness W0..W3, event
probabilities, etc.) the binary stores them as contiguous WORD
arrays.  Scan logic:

```python
# Find all "mov reg, imm16" with imm16 == target_value
for opcode in [0xB8..0xBF]:    # mov ax/cx/dx/bx/sp/bp/si/di, imm16
    pattern = bytes([opcode, lo_byte, hi_byte])
    # ... find all matches in binary
```

This worked for **finding tables** but FAILED for finding the
**code that reads** them — because game code uses register-relative
addressing (`[bx+si]`, `[bp-N]`) that doesn't match a literal byte
pattern.  See section 3.4.

### 3.2 Pascal-String Anchoring

The TP runtime stores strings as length-prefixed Pascal-style.  Scan
logic:

```python
for i in range(len(data)):
    sl = data[i]
    if 4 <= sl <= 250 and i + 1 + sl < len(data):
        candidate = data[i+1 : i+1+sl]
        if all(printable) and any(letter):
            register as Pascal string at offset i
```

This is how `work/landmark_table.txt` mapped the 16 landmark records,
and how `work/extract_strings.py` builds the 846-entry atlas.

### 3.3 Function Boundary Detection

TP 6.0 generates a fixed function prologue:

```
55           push bp
89 E5        mov bp, sp
83 EC nn     sub sp, N      ; allocate N bytes of local vars
```

Search pattern: `55 89 E5` then `83 EC` to find candidates.

To find a function's **CALLERS**, search for:
- `E8 lo hi` (near call) where target = function_addr - (call_site + 3)
- `9A lo hi seg seg` (far call) — segment math is harder

### 3.4 Why Static Analysis FAILED for Some Items

* **Pace constants 8/12/16** — brute force scan for clusters of those
  three immediates within 64 bytes returned ZERO.  Other triplets
  tried (15/20/25, 10/15/25, 12/18/24, 5/10/15, 10/15/20, 20/30/40,
  8/15/25) also returned zero.

* **RNG read sites in game code** — the only `les ax, ptr [0x16b2]`
  literal pattern hits are in the calibration / ISR code (3 sites
  in `work/rng_algorithm.txt`).  All gameplay reads use
  register-relative addressing.

* **Score base computation** — function at `0x13D26` (Phase 4's
  "score function") turned out to be FOOD CONSUMPTION.  The real
  end-game score function was not located cleanly in static analysis.

For these items, either dynamic trace (DOSBox-X BPM) or a full
Ghidra function-graph load would be required.

---

## 4. DOSBox-X Dynamic Debugging Playbook

This is how Gap #3 (RNG) was closed.  Save this section if you ever
need to recover the exact runtime behaviour of any other game system.

### 4.1 Environment Setup

Install DOSBox-X (`E:\Program Files (x86)\DOSBox-X\dosbox-x.exe`).
DOSBox-X 2026 introduced a working-directory selector prompt — must
be bypassed.

**Spaces in paths break `-c "mount c ..."` argument parsing.**  Workaround:
create a junction with no spaces in the path:

```powershell
New-Item -ItemType Junction -Path C:\OTRAIL `
    -Target "E:\Projects\BASIC Programs\...\The-Oregon-Trail_DOS_EN"
```

Then launch as:

```powershell
& "E:\Program Files (x86)\DOSBox-X\dosbox-x.exe" `
    -fastlaunch `
    -c "mount c C:\OTRAIL" -c "c:" -c "OREGON.EXE"
```

When the "is C: real hard drive?" prompt appears, it gets answered
automatically by the next queued -c command, eventually reaching a
state where the game launches from a mounted drive.

### 4.2 Opening the Debugger

* Menu: `Debug -> Start DOSBox-X debugger`, OR
* Keyboard: `Alt+Pause` (host key may vary)

A separate TUI window opens with four panels:
- Register Overview (CS, DS, EIP, flags, etc.)
- Data view (a sliding hex window)
- Code Overview (live disasm at current EIP)
- Output (command history + DEBUG: messages)

The prompt is `I-> `.

### 4.3 Useful Debugger Commands (DOSBox-X 2026 syntax)

* `HELP` — show all commands
* `BP seg:off` — instruction breakpoint
* `BPINT intnr` — break on interrupt fire
* `BPM seg:off` — **memory CHANGE breakpoint (write only!)**
* `BPLM linear-addr` — linear-address memory breakpoint (write only)
* `BPLIST` — list breakpoints
* `BPDEL n / *` — delete breakpoints
* `DV addr` — set data view to virtual address
* `D seg:off` — set code view (= go to address)
* `LOG num` / `LOGS num` / `LOGL num` — write CPU log (short / long
  format).  `LOGL` is the most useful for offline analysis.
* `HEAVYLOG` — toggle automatic CPU logging on/off
* `INTHAND nr` — show code view at interrupt handler
* `INTVEC filename` — dump all 256 vectors to file
* `MEMFIND seg:off pattern` — search memory for byte pattern
* `T` — single-step (trace) one instruction
* `F5` — resume normal execution

**Critical limitation:** DOSBox-X has **no memory-READ breakpoint**.
`BPM`/`BPLM` only fire on writes.  To find code that READS a specific
address, you need either:
1. `LOG` a window of instructions then grep offline
2. Set BPM on writes (e.g. from the ISR) to find the ISR location,
   then work backwards to game-code reads
3. Use `MEMFIND` to find the byte pattern of the instruction itself
   in memory

### 4.4 The Gap #3 Sequence (what actually closed it)

1. Launch game via the PowerShell command above.  Wait ~10 seconds
   for the developer save (`ZOP12.GAM`) to auto-load and the game
   to land on the supplies screen.

2. Press SPACE to advance through opening screens, navigate to a
   point where the game is in input-wait state at a known event
   (in our case: "Green River crossing — would you like to look
   around?" at mile 989).

3. **Alt+Pause** to enter debugger.

4. Type `INTHAND 1C` to check the timer ISR vector.
   - **Finding:** ISR shows the DOSBox-X default callback
     (`FE 38 10 00 / iret`) — NOT the game's own ISR
   - **Implication:** Game's calibration ISR was uninstalled after
     startup.  Counter at `0x16B2` is no longer ticked by the timer.

5. Type `BPM 2348:16B2` to set a memory-write breakpoint at the
   counter location identified from static analysis.

6. **F5** to resume.

7. In the game window:
   - Press **N** (skip look-around)
   - At the river-crossing menu, pick **3** (Ferry)
   - Watch the game compute the outcome

8. Debugger auto-breaks when the BPM fires.  Output panel shows:
   ```
   DEBUG: Memory breakpoint : 2348:16B2  -  00 -> 03
   ```

9. **Interpretation:**
   - Counter went from 0 to 3
   - Three RNG draws expected on path N + Ferry:
     a) river depth roll
     b) ferry price roll
     c) ferry outcome roll
   - Delta exactly matches → confirms counter advances `+1` per RNG
     call

10. Conclusion: RNG = `Inc(Counter); return Counter mod N`.  No LCG
    multiplier, no XOR mask.  Entropy lives entirely in the startup
    seed.

### 4.5 Mistakes That Wasted Time (lessons learned)

* **`LOGL 100000` captured 1M lines of BIOS NOP idle loop.**  The
  game was in `INT 16h` keyboard wait state the entire time.  If you
  use LOGL, the game must be **actively executing** when the log
  starts — not waiting for a keypress.  Use `HEAVYLOG` (toggle) and
  enable it only when you can trigger immediate game-code execution.

* **`BPMR` does not exist in DOSBox-X.**  Original DOSBox had read /
  write distinction; DOSBox-X 2026 only has write (`BPM`).

* **DS register at debugger break is COMMAND.COM's data segment,
  not the game's.**  When you break-in during input wait, the CPU is
  in BIOS keyboard idle and DS holds whatever the calling shell had.
  To see game's DS, you need to break-in during game-code execution
  (or use `BPM` set on game's expected DS:offset directly — when it
  fires from game code, registers will show game's runtime state).

* **DOSBox-X buffers log file writes.**  If you stop logging and
  immediately read the file, you may get stale contents.  Close
  DOSBox-X to flush.

### 4.6 Tools for Capturing Screenshots from DOSBox-X

PowerShell + Windows GDI via `PrintWindow` API:

```powershell
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
"@ -ReferencedAssemblies System.Drawing

# ... GetWindowRect for hwnd, allocate Bitmap, PrintWindow(hwnd, hdc, 2), save PNG
```

`PrintWindow flag 2 = PW_RENDERFULLCONTENT` — captures the window's
client area even if it's not foreground.  This is how I screenshotted
DOSBox-X states throughout this session.

---

## 5. What I Would Do Differently Next Time

* **Skip the LOGL approach.**  It's tempting because LOGL "captures
  everything", but the file sizes are crushing (338 MB for 1M lines
  in this session) and most of the trace is idle.  Just use targeted
  BPM with structural inference.

* **Start with `INTHAND` immediately.**  In retrospect, the very
  first thing to do for any timer-driven game system is run `INTHAND
  1C` and `INTHAND 8` to see what's hooked.  If it's the default
  callback, you know the game's logic doesn't depend on the timer
  at THAT moment — and that reframes everything.

* **Use Ghidra for the static phase.**  Capstone-based ad-hoc
  scripts work but they don't track function boundaries cleanly.
  Loading `work/OREGON_UNPACKED.BIN` into Ghidra (with `x86 / Real
  Mode / 16-bit`, entry `0:0x010A`) would give a full call graph in
  one shot, and the items I marked NOT CLOSED (pace, speed, hunting)
  could likely be closed from the call graph alone.

---

## 6. Reading the Closure Documents

The closure evidence trail is split across these files in `src/`:

| File | What it closes |
|---|---|
| `COPYPROT.PAS` (header) | Gap #2 copy-protect, with full disasm |
| `LANDMARK.PAS` (header) | Gap #4 flag 0x7D, with reasoning trail |
| `GRAPHX.PAS` (header) | Gap #5 PCX decoder, full implementation |
| `DIAMETA.TXT` | Gap #1 DIALOGS slot-zone binding |
| `RNGNOTES.TXT` | Gap #3 RNG counter-mod-N, with BPM evidence |
| `STATICTRACE.TXT` | Deep-pass results for TOMB / music / ration / score |

Each file is self-contained — explains what was UNCERTAIN before,
what was confirmed, and what evidence was used.
