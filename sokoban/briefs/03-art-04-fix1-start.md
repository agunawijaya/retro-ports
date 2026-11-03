# Brief: start the 03 [ART] run and the 04 fix-1 run (qa-scout)

## Pembagian kerja

- **Haiku (you):** start the runs, apply the one fallback rule below, confirm they are alive, report. Nothing else.
- **Argon** (agy) or, if its quota is out, **Kimi**: the [ART] of `prompts/03-modes-garden.md`.
- **Kimi:** `prompts/04-themes-fix-1.md` (the Flash [LOGIC] of 04 failed review).
- **Opus:** waits, reviews, decides.

## Steps (PowerShell)

1. Check: no `agy` or `kimi` process running (`Get-Process agy,kimi -ErrorAction SilentlyContinue`), and none of these exist in `E:\Projects\retro-ports\sokoban\prompts\logs\`: `03-modes-garden.art.done`, `03-modes-garden.art.kimi.done`, `04-themes-fix-1.kimi.done`. If anything is there, stop and report it.
2. Start both:
   ```powershell
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-agy.ps1','-Prompt','03-modes-garden','-Scope','art'
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-kimi.ps1','-Prompt','04-themes-fix-1'
   ```
3. `Start-Sleep 120`, then check `prompts\logs\03-modes-garden.art.done`:
   - If it exists and contains `quota=1` (Argon's quota is out), start Kimi on the same work:
     ```powershell
     Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-kimi.ps1','-Prompt','03-modes-garden','-Scope','art'
     ```
     and after `Start-Sleep 60` confirm `prompts\logs\03-modes-garden.art.kimi.log` exists and grows.
   - If it exists with `quota=0`, read the last 20 lines of `03-modes-garden.art.log` and report them; do not start anything.
   - If it does not exist, Argon is working; do nothing more for 03.
4. Confirm `prompts\logs\04-themes-fix-1.kimi.log` exists and grows, and that no `04-themes-fix-1.kimi.done` appeared (if it did, report its content and the log's last 20 lines).
5. Report in at most eight lines: who is running the 03 [ART] (Argon or Kimi), the content of any `.done` file you saw, and the process counts.

Do not edit any file and do not wait for the runs to finish.
