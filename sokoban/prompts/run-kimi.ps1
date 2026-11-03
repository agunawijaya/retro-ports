# Runs one build prompt with the Kimi Code CLI in the Hening (sokoban) folder,
# detached from the caller, and leaves a log plus a done-marker behind.
# The twin of run-agy.ps1, for when the owner puts Kimi on a prompt.
#
#   powershell -File prompts\run-kimi.ps1 -Prompt 04-themes -Scope art
#   powershell -File prompts\run-kimi.ps1 -Prompt 03-modes-garden -Scope logic
#
# -Scope full / logic / art means exactly what it means in run-agy.ps1.
# The done marker is prompts/logs/<NN-name>[.<scope>].kimi.done so it never
# collides with an agy run of the same prompt, and reads:
#   exit=<code> quota=<0|1> scope=<full|logic|art> model=<id> minutes=<n>
# quota=1 means the log shows a quota / rate-limit refusal: the run did not work.
param(
  [Parameter(Mandatory = $true)][string]$Prompt,
  [string]$Model = 'kimi-code/k3',
  [ValidateSet('full', 'logic', 'art')][string]$Scope = 'full'
)

$root = 'E:\Projects\retro-ports\sokoban'
$logs = Join-Path $root 'prompts\logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$tag  = if ($Scope -eq 'full') { "$Prompt.kimi" } else { "$Prompt.$Scope.kimi" }
$log  = Join-Path $logs "$tag.log"
$done = Join-Path $logs "$tag.done"
Remove-Item $done -ErrorAction SilentlyContinue

$task = "Read prompts/$Prompt.md and carry it out completely. Work in $root."
if ($Scope -eq 'logic') {
  $task = "Read prompts/$Prompt.md. Do ONLY the sections marked [LOGIC]. For every [ART] item, build a clear blockout " +
          "instead of the finished look: simple shapes in the palette at the exact positions and sizes the prompt and " +
          "docs/ART-DIRECTION.md give, each function marked with a comment '// ART: blockout - <item>'. Do not try to " +
          "make the art look finished. Run every check the prompt asks for. Write review/prompts/$Prompt/summary.md " +
          "with a section 'Left for ART' listing every blockout. Do not make the review sheet. Work in $root."
}
if ($Scope -eq 'art') {
  $task = "Read prompts/$Prompt.md and review/prompts/$Prompt/summary.md (its 'Left for ART' section). Do ONLY the " +
          "sections marked [ART]: replace every '// ART: blockout' with the finished look, aimed at reference/index.html " +
          "and docs/ART-DIRECTION.md. Do not change the [LOGIC] code, its tests or its checks; if the art needs a change " +
          "there, write it in the summary instead. Render the frames and LOOK at them yourself (you can read images) " +
          "for every critique round the prompt asks for. Run the checks the prompt lists, make the review sheet with " +
          "game/tools/review.mjs, and add an 'ART' section to the summary. Work in $root."
}

Set-Location $root
$started = Get-Date
"[$started] kimi $Model scope=$Scope :: prompts/$Prompt.md" | Out-File $log -Encoding utf8

# Prompt mode runs unattended (it may write files and run commands without asking).
& kimi -p $task -m $Model *>> $log
$code = $LASTEXITCODE

$logText = (Get-Content $log -Raw) -replace "`0", ''
$quota = if ($logText -match 'quota|rate.?limit|code 429|\b429\b|insufficient balance|exceeded your') { 1 } else { 0 }
$finished = Get-Date
"exit=$code quota=$quota scope=$Scope model=$Model started=$started finished=$finished minutes=$([math]::Round(($finished - $started).TotalMinutes, 1))" |
  Out-File $done -Encoding utf8
