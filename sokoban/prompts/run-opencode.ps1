# Runs one prompt with OpenCode (DeepSeek by default) in the Hening (sokoban)
# folder, detached from the caller, and leaves a log plus a done-marker behind.
# The twin of run-agy.ps1 / run-kimi.ps1, for when the owner puts DeepSeek on a prompt.
#
#   powershell -File prompts\run-opencode.ps1 -Prompt 04b-stone-layout
#   powershell -File prompts\run-opencode.ps1 -Prompt 04b-stone-layout -Model deepseek/deepseek-v4-pro
#
# The whole prompt is the task (no scope split: give OpenCode self-contained [LOGIC] prompts).
# `--standalone` runs a private server: the shared background service dropped its client
# twice on 2026-10-30. OpenCode kills any single shell command after 600 s.
# The done marker prompts/logs/<NN-name>.opencode.done reads:
#   exit=<code> quota=<0|1> model=<id> minutes=<n>
param(
  [Parameter(Mandatory = $true)][string]$Prompt,
  [string]$Model = 'deepseek/deepseek-flash'
)

$root = 'E:\Projects\retro-ports\sokoban'
$logs = Join-Path $root 'prompts\logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$log  = Join-Path $logs "$Prompt.opencode.log"
$done = Join-Path $logs "$Prompt.opencode.done"
Remove-Item $done -ErrorAction SilentlyContinue

$task = "Read prompts/$Prompt.md and carry it out completely. Work in $root. Do not stop to ask questions; when something is unclear, decide, and write the decision in the summary the prompt asks for."

Set-Location $root
$started = Get-Date
"[$started] opencode $Model :: prompts/$Prompt.md" | Out-File $log -Encoding utf8

& opencode run --standalone --auto -m $Model $task *>> $log
$code = $LASTEXITCODE

$logText = (Get-Content $log -Raw) -replace "`0", ''
$quota = if ($logText -match 'insufficient balance|quota|rate.?limit|\b402\b|\b429\b|payment required') { 1 } else { 0 }
$finished = Get-Date
"exit=$code quota=$quota model=$Model started=$started finished=$finished minutes=$([math]::Round(($finished - $started).TotalMinutes, 1))" |
  Out-File $done -Encoding utf8
