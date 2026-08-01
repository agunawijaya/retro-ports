# Tools Reference

The `work/` folder is full of Python scripts and analysis outputs.
This document catalogues them so you can find the right tool quickly.

---

## 1. Quick-Start: The Three Tools You'll Use Most

### show_screen.py — view verbatim screen text by label

```
python work/show_screen.py                          # list 31 labels
python work/show_screen.py STORE_GREETING           # dump one screen
python work/show_screen.py STORE                    # prefix match all STORE_*
python work/show_screen.py 0x0DB7D                  # raw offset (256 bytes)
python work/show_screen.py STORE_GREETING --raw     # show '\' literal
python work/show_screen.py STORE_GREETING --hex     # add hex dump
```

Default render: backslash `\` is interpreted as line break (the
original's convention), control bytes shown as `<XX>`.

### extract_strings.py — rebuild the string atlas

```
python work/extract_strings.py
```

Scans `work/OREGON_UNPACKED.BIN` for printable ASCII runs and Pascal
strings (length >= 4), writes:
- `work/strings_atlas.txt` — every string with file offset
- `work/screens_atlas.txt` — strings grouped by likely game system

Re-run after editing classification anchor patterns.

### build_navmap.py — rebuild the screen navigation map

```
python work/build_navmap.py
```

Reads `strings_atlas.txt`, applies regex patterns to identify
distinctive screen openers, writes:
- `work/screens_navigation.txt` — 31 labeled screens to offset map

This is the source-of-truth `show_screen.py` reads from.  Add anchor
patterns in `build_navmap.py` to label more screens.

---

## 2. Phase 1-5 Analysis Tools

Built during the original reverse-engineering phases.  Mostly
single-purpose; included here for reference.

| Script | Output | Purpose |
|---|---|---|
| `unlzexe.py` | `OREGON_UNPACKED.BIN` | LZEXE 0.91 unpacker |
| `disassemble.py` | `disasm_anchors.txt` | Anchored Capstone disasm |
| `inspect_assets.py` | varies | File-by-file inventory |
| `extract_graphics.py` | `images/*.png` | PCX archive extractor + decoder |
| `find_map.py` / `fix_map.py` / `reextract_map*.py` | map images | Map PCX recovery |
| `find_rng.py` / `find_rng_reads.py` | `rng_algorithm.txt` / `rng_candidates.txt` | RNG candidate analysis |
| `find_score.py` | `score_formula.txt` | Score-function candidates |
| `find_store_prices.py` | `store_prices.txt` | Store price extraction |
| `decode_landmarks.py` | `landmark_table.txt` | 16-landmark table decode |
| `decode_illness.py` | `illness_analysis.txt` | 6-illness W0..W3 table |
| `decode_event_table.py` | `event_table_analysis.txt` | 20-row event table |
| `decode_save.py` | `save_decode.txt` | ZOP12.GAM structure |
| `decode_base_score.py` | `base_score_analysis.txt` | Score base candidate |
| `crack_copyprotect.py` | `copyprotect_analysis.txt` | Date-bomb gate analysis |
| `find_landmark8.py` | `landmark8_investigation.txt` | Where 0x7D flag lives |
| `analyze_animals.py` / `analyze_supplies.py` / `analyze_terrain.py` / `analyze_vga_supplies*.py` | various | Per-image-category extractors |
| `check_map*.py` / `crop_supply_items.py` / `diagnose_pcx.py` / `get_supply_coords.py` / `resize_map_proper.py` | various | Graphics post-processing |
| `trace_main_functions.py` | `main_function_traces.txt` | Function-by-function trace |
| `append_phase*.py` | merges to `oregon_trail_reverse.md` | Doc assembly |

Outputs live alongside scripts in `work/`.

---

## 3. Analysis Outputs

Text files in `work/` that document specific findings:

| File | Contents |
|---|---|
| `disasm_anchors.txt` | Disasm of key anchor regions (entry, main fns, tables) |
| `main_function_traces.txt` | Function-level trace with calls and cmps |
| `rng_algorithm.txt` | RNG counter access pattern (7 sites) |
| `rng_candidates.txt` | Earlier RNG hypothesis dump |
| `landmark_table.txt` | 16 landmarks with field layout |
| `landmark8_investigation.txt` | The 0x7D flag investigation |
| `illness_analysis.txt` | W0..W3 quad per illness |
| `event_table_analysis.txt` | 20 event-table rows |
| `store_prices.txt` | Per-item price extraction |
| `score_formula.txt` | Score multiplier + candidates |
| `base_score_analysis.txt` | Base-resource computation candidates |
| `save_decode.txt` | 144-byte save struct |
| `copyprotect_analysis.txt` | Date-bomb gate disasm |
| `strings_atlas.txt` | 846 strings with offsets (extract_strings.py) |
| `screens_atlas.txt` | Strings grouped by game system |
| `screens_navigation.txt` | 31 labeled screens to offsets |

---

## 4. Other Artefacts in `work/`

* `OREGON_UNPACKED.BIN` — the LZEXE-unpacked image, 150 KB.  All
  analysis is done against this file, not `OREGON.EXE`.

* `ghidra_scripts/` — Ghidra integration scripts (prepared but not
  loaded into Ghidra during this session).

* `cga_output/` — extracted CGA-palette versions of images for
  comparison with the VGA archive.

* `capture_smoke/` — DOSBox-X smoke-test screenshots from the Gap #3
  workflow.

* `dosbox_smoke.conf` — DOSBox-X config file used during smoke
  testing.  Has banner-off settings and the autoexec attempts.

* `launch_debug.ps1` — PowerShell launcher for DOSBox-X with the
  game ready.

---

## 5. DOSBox-X Workflow Reference

### One-time setup

Create a no-spaces junction so DOSBox-X mount commands work:

```powershell
New-Item -ItemType Junction -Path C:\OTRAIL `
    -Target "E:\Projects\BASIC Programs\Collections\Oregon Trail\The-Oregon-Trail_DOS_EN"
```

### Launch game

```powershell
& "E:\Program Files (x86)\DOSBox-X\dosbox-x.exe" `
    -fastlaunch `
    -c "mount c C:\OTRAIL" -c "c:" -c "OREGON.EXE"
```

Wait ~10 seconds.  The game auto-loads ZOP12.GAM (a developer save
mid-game).

### Enter the debugger

`Alt+Pause` (or menu `Debug -> Start DOSBox-X debugger`).

### Set up a memory-write breakpoint on the RNG counter

```
BPM 2348:16B2
F5
```

Then trigger an event in the game window (river crossing, daily
"continue", etc.).  Debugger auto-breaks on each counter write,
showing the value transition (e.g. `00 -> 03`).

### Capture a screenshot of the debugger

Use the PowerShell `PrintWindow` capture script in `RE_PLAYBOOK.md`
section 4.6.  Saves the debugger TUI to a PNG even when not foreground.

### Cleanup after a session

```powershell
Get-Process dosbox-x | Stop-Process -Force
Remove-Item C:\OTRAIL\LOGCPU.txt    # if log was written
cmd /c rmdir C:\OTRAIL              # remove the junction (files safe)
```

The junction is a symlink — removing it leaves the source files
untouched at their original `E:\Projects\...` path.

---

## 6. Building the Rebuild

The Pascal rebuild in `src/` ships with two build scripts:

* `src/build.bat` — sequential compile via `tpc` for each unit
* `src/MAKEFILE` — Borland MAKE rules with proper dependency graph

Both target TP 6.0.  Run inside a DOSBox session with TP installed and
`tpc.exe` on the path.

---

## 7. When to Update Each Tool

| Change | Action |
|---|---|
| Want to label more game screens | Add anchor patterns in `build_navmap.py`, re-run |
| Need more strings (shorter length) | Lower `MIN_LEN` in `extract_strings.py`, re-run |
| New game system to study | Add a `classify()` rule in `extract_strings.py`, re-run |
| Need different DOSBox-X config | Edit `dosbox_smoke.conf` |
| Adding new Pascal unit | Add to `src/MAKEFILE` and `src/build.bat` dependency graph |

---

## 8. File Sizes (for sanity-checking re-runs)

| File | Expected size |
|---|---|
| `OREGON.EXE` | 81,896 bytes |
| `OREGON_UNPACKED.BIN` | 150,016 bytes |
| `strings_atlas.txt` | ~75 KB (846 entries) |
| `screens_atlas.txt` | ~85 KB (grouped) |
| `screens_navigation.txt` | ~6 KB (31 labels) |

If you re-run a tool and get wildly different sizes, something
upstream changed.
