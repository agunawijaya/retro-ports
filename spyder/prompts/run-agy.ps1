# Runs one build prompt with the Antigravity CLI (Gemini) in the Spyder folder,
# detached from the caller, and leaves a log plus a done-marker behind.
#
#   powershell -File prompts\run-agy.ps1 -Prompt 07-polish-2
#   powershell -File prompts\run-agy.ps1 -Prompt 08-downstairs-bathroom -Model gemini-3.8-flash-high -Scope logic
#   powershell -File prompts\run-agy.ps1 -Prompt 14-upstairs-bathroom -NoteFile prompts\notes\14-upstairs-bathroom.txt
#
# -Scope full   (default) the whole prompt.
# -Scope logic  only the sections marked [LOGIC]; every [ART] item becomes a
#               labelled blockout for Claude Code (Opus) to paint afterwards.
#
# The .done file reads:  exit=<code> quota=<0|1> scope=<full|logic> model=<id> minutes=<n>
# quota=1 means the log shows a quota / rate-limit refusal: the run did not work.
param(
  [Parameter(Mandatory = $true)][string]$Prompt,
  [string]$Model = 'gemini-4-argon-high',
  [ValidateSet('full', 'logic')][string]$Scope = 'full',
  # Optional: a file with a note from Claude Code appended to the task (e.g.
  # what else is running in parallel and which files to stay out of).
  [string]$NoteFile = ''
)

$root = 'E:\Projects\retro-ports\spyder'
$logs = Join-Path $root 'prompts\logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$tag  = if ($Scope -eq 'logic') { "$Prompt.logic" } else { $Prompt }
$log  = Join-Path $logs "$tag.log"
$done = Join-Path $logs "$tag.done"
Remove-Item $done -ErrorAction SilentlyContinue

$task = "Read prompts/$Prompt.md and carry it out completely. Work in $root."
if ($Scope -eq 'logic') {
  $task = "Read prompts/$Prompt.md. Do ONLY the sections marked [LOGIC]. For every [ART] item, build a clear blockout " +
          "instead of painting: simple shapes in the palette at the exact positions and sizes the prompt gives, each " +
          "drawing function marked with a comment '// ART: blockout - <item>'. Do not try to make the art look finished. " +
          "Run every check the prompt asks for. Write review/prompts/$Prompt/summary.md with a section 'Left for ART' " +
          "listing every blockout. Do not make the review sheet. Work in $root."
}

if ($NoteFile -and (Test-Path $NoteFile)) {
  $task += " Note from Claude Code: " + ((Get-Content $NoteFile -Raw) -replace '\s+', ' ').Trim()
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
