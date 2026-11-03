# Brief: start prompt 05's two runs (qa-scout)

## Pembagian kerja

- **Haiku (you):** start both runs, confirm they are alive, report. Nothing else.
- **Flash** (agy): the [LOGIC] of `prompts/05-polish.md` (its *Pembagian kerja*).
- **DeepSeek Flash** (OpenCode): `prompts/05-copy-playthrough.md`.
- **Opus:** works on §1 meanwhile; waits, reviews.

## Steps (PowerShell)

1. Check: no `agy` process (`Get-Process agy -ErrorAction SilentlyContinue`); `E:\Projects\retro-ports\sokoban\prompts\logs\05-polish.logic.done` and `05-copy-playthrough.opencode.done` absent. If not, stop and report. (An `opencode` process may already be running from another project; that is fine.)
2. Start both:
   ```powershell
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-agy.ps1','-Prompt','05-polish','-Model','gemini-3.8-flash-high','-Scope','logic'
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-opencode.ps1','-Prompt','05-copy-playthrough'
   ```
3. `Start-Sleep 120`, then check: an agy process runs; `prompts\logs\05-polish.logic.log` and `05-copy-playthrough.opencode.log` exist and have grown; no `.done` yet. If a `.done` appeared, report it and the last 20 lines of its log (`quota=1` = out of quota or credit).
4. Report in at most six lines.

Do not edit any file and do not wait for the runs to finish.
