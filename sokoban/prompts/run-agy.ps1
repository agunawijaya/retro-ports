# Runs one build prompt with the Antigravity CLI (Gemini) in the Hening (sokoban) folder,
# detached from the caller, and leaves a log plus a done-marker behind.
#
#   powershell -File prompts\run-agy.ps1 -Prompt 03-modes -Model gemini-3.8-flash-high -Scope logic
#   powershell -File prompts\run-agy.ps1 -Prompt 03-modes -Scope art
#
# Model policy (prompts/CLAUDE-CODE.md): Flash takes every [LOGIC] (-Scope logic),
# Argon only [ART] (-Scope art), after the logic run.
#
# -Scope full   the whole prompt (kept for old prompts; not used by the policy).
# -Scope logic  only the sections marked [LOGIC]; every [ART] item becomes a
#               labelled blockout for the [ART] run to paint afterwards.
# -Scope art    only the sections marked [ART], painted over the logic run's
#               blockouts; the [LOGIC] code stays as it is.
#
# The .done file reads:  exit=<code> quota=<0|1> scope=<full|logic|art> model=<id> minutes=<n>
# quota=1 means the log shows a quota / rate-limit refusal: the run did not work.
param(
  [Parameter(Mandatory = $true)][string]$Prompt,
  [string]$Model = 'gemini-4-argon-high',
  [ValidateSet('full', 'logic', 'art')][string]$Scope = 'full'
)

$root = 'E:\Projects\retro-ports\sokoban'
$logs = Join-Path $root 'prompts\logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$tag  = if ($Scope -eq 'full') { $Prompt } else { "$Prompt.$Scope" }
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
          "there, write it in the summary instead. Run the checks the prompt lists, do the critique rounds it asks for, " +
          "make the review sheet with game/tools/review.mjs, and add an 'ART' section to the summary. Work in $root."
}

Set-Location $root
$started = Get-Date
"[$started] agy $Model scope=$Scope :: prompts/$Prompt.md" | Out-File $log -Encoding utf8

& agy -p $task --model $Model --dangerously-skip-permissions --print-timeout 0 *>> $log
$code = $LASTEXITCODE

# The log mixes UTF-8 (first line) and UTF-16 (agy's output appended by >>),
# so read it whole and drop the NUL bytes before searching.
$logText = (Get-Content $log -Raw) -replace "`0", ''
$quota = if ($logText -match 'quota reached|rate.?limit|RESOURCE_EXHAUSTED|code 429') { 1 } else { 0 }
$finished = Get-Date
"exit=$code quota=$quota scope=$Scope model=$Model started=$started finished=$finished minutes=$([math]::Round(($finished - $started).TotalMinutes, 1))" |
  Out-File $done -Encoding utf8
