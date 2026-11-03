# Brief: start the Flash [ART] runs of 03 and 04 (qa-scout)

## Pembagian kerja

- **Haiku (you):** start both runs, confirm they are alive, report. Nothing else.
- **Flash** (via agy): the [ART] of `prompts/03-modes-garden.md` and of `prompts/04-themes.md` (owner's decision, 2026-11-02: Argon and Kimi are out of quota).
- **Opus:** waits, reviews, decides.

## Steps (PowerShell)

1. Check: no `agy` or `kimi` process running (`Get-Process agy,kimi -ErrorAction SilentlyContinue`), and `E:\Projects\retro-ports\sokoban\prompts\logs\04-themes.art.done` does not exist. (`03-modes-garden.art.done` exists from Argon's quota failure; `run-agy.ps1` deletes it when it starts, that is expected.) If an agy or kimi process is running, stop and report it.
2. Start both:
   ```powershell
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-agy.ps1','-Prompt','03-modes-garden','-Model','gemini-3.8-flash-high','-Scope','art'
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-agy.ps1','-Prompt','04-themes','-Model','gemini-3.8-flash-high','-Scope','art'
   ```
3. `Start-Sleep 120`, then check: two agy processes running; `prompts\logs\03-modes-garden.art.log` and `prompts\logs\04-themes.art.log` exist; no `03-modes-garden.art.done` or `04-themes.art.done` has appeared. If one did, read it and the last 20 lines of its log.
4. Report in at most six lines.

Do not edit any file and do not wait for the runs to finish.
