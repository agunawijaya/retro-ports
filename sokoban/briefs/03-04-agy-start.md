# Brief: start the Flash [LOGIC] runs of 03 and 04 (qa-scout)

## Pembagian kerja

- **Haiku (you):** start both runs, confirm they are alive, report. Nothing else.
- **Flash** (via agy): builds the [LOGIC] of `prompts/03-modes-garden.md` and `prompts/04-themes.md`.
- **Opus:** waits for the done markers, reviews, does the rest.

## Steps

1. Check that neither run exists yet: `prompts/logs/03-modes-garden.logic.done` and `prompts/logs/04-themes.logic.done` must be absent, and `Get-Process agy -ErrorAction SilentlyContinue` must show no agy process. If either is not true, stop and report what you found.
2. Start both, detached (PowerShell):
   ```powershell
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-agy.ps1','-Prompt','03-modes-garden','-Model','gemini-3.8-flash-high','-Scope','logic'
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-agy.ps1','-Prompt','04-themes','-Model','gemini-3.8-flash-high','-Scope','logic'
   ```
3. About 90 seconds later, check once: two agy processes are running; `prompts/logs/03-modes-garden.logic.log` and `prompts/logs/04-themes.logic.log` exist; no `.logic.done` file has appeared. If a `.done` file did appear, read it and the last 20 lines of its log.
4. Report in five lines or fewer: started yes/no for each, agy process count, and any `.done` content (a `quota=1` there means Flash's quota is out).

Do not wait for the runs to finish, do not edit any file, do not make decisions.
