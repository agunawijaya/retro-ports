# Brief: start 04b step 1 — the stone layout on DeepSeek (qa-scout)

## Pembagian kerja

- **Haiku (you):** start the run, confirm it is alive, report. Nothing else.
- **DeepSeek Flash** (OpenCode): `prompts/04b-stone-layout.md`.
- **Opus:** waits, reviews, starts step 2.

## Steps (PowerShell)

1. Check: no `opencode` run for this prompt is going (`prompts\logs\04b-stone-layout.opencode.log` absent or its `.done` present), and `E:\Projects\retro-ports\sokoban\game\src\world\stone-layout.js` does not exist. If it exists, stop and report.
2. Start it, detached:
   ```powershell
   Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','E:\Projects\retro-ports\sokoban\prompts\run-opencode.ps1','-Prompt','04b-stone-layout'
   ```
3. `Start-Sleep 90`, then check: `prompts\logs\04b-stone-layout.opencode.log` exists and has grown past its first line; no `04b-stone-layout.opencode.done` yet. If the `.done` appeared, report its content and the log's last 20 lines (a `quota=1` means DeepSeek has no credit).
4. Report in at most five lines.

Do not edit any file and do not wait for the run to finish.
