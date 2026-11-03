# Brief: start 04b step 2 — the [LOGIC] on Flash (qa-scout)

## Pembagian kerja

- **Haiku (you):** start the run, confirm it is alive, report. Nothing else.
- **Flash** (agy): the [LOGIC] of `prompts/04b-floating-stones.md` (see its *Pembagian kerja*, step 2), on top of `game/src/world/stone-layout.js` (step 1, done and accepted).
- **Opus:** waits, reviews, then builds the [ART].

## Steps (PowerShell)

1. Check: no `agy` process is running (`Get-Process agy -ErrorAction SilentlyContinue`), and `E:\Projects\retro-ports\sokoban\prompts\logs\04b-floating-stones.logic.done` does not exist. If either is not true, stop and report.
2. Start it, detached:
   ```powershell
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-agy.ps1','-Prompt','04b-floating-stones','-Model','gemini-3.8-flash-high','-Scope','logic'
   ```
3. `Start-Sleep 120`, then check: an agy process is running; `prompts\logs\04b-floating-stones.logic.log` exists; no `.logic.done` yet. If the `.done` appeared, report it and the log's last 20 lines (`quota=1` = Flash's quota is out).
4. Report in at most five lines.

Do not edit any file and do not wait for the run to finish.
