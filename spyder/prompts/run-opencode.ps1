# Runs one task with OpenCode (DeepSeek) in the Spyder folder, detached from
# the caller, and leaves a log plus a done-marker behind. The twin of run-agy.ps1.
#
#   powershell -File prompts\run-opencode.ps1 -Prompt 17-story-system -Scope logic
#   powershell -File prompts\run-opencode.ps1 -Brief briefs\17-checks.md -Model opencode/deepseek-v4.1-flash-free
#
# -Prompt <NN-name>  a prompt in prompts/ ; -Scope logic (default) or full
# -Brief  <path>     a smaller written brief (from Claude Code) instead of a prompt
# -Model             deepseek/deepseek-v4-pro (default) | opencode/deepseek-v4.1-flash-free
# -NoteFile <path>   extra note appended to the task (what runs in parallel, files to avoid)
#
# The .done file reads:  exit=<code> quota=<0|1> scope=<...> model=<id> minutes=<n>
param(
  [string]$Prompt,
  [string]$Brief,
  [string]$Model = 'deepseek/deepseek-v4-pro',
  [ValidateSet('full', 'logic')][string]$Scope = 'logic',
  [string]$NoteFile
)

if (-not $Prompt -and -not $Brief) { throw 'Pass -Prompt or -Brief.' }

$root = 'E:\Projects\retro-ports\spyder'
$logs = Join-Path $root 'prompts\logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$short = if ($Model -match 'flash') { 'dsflash' } else { 'dspro' }
$name  = if ($Prompt) { $Prompt } else { [IO.Path]::GetFileNameWithoutExtension($Brief) }
$tag   = "$name.$short"
$log   = Join-Path $logs "$tag.log"
$done  = Join-Path $logs "$tag.done"
Remove-Item $done -ErrorAction SilentlyContinue

if ($Brief) {
  $task = "Read $Brief and carry it out completely. Work in $root. Follow CLAUDE.md's rules on images and git."
} elseif ($Scope -eq 'logic') {
  $task = "Read prompts/$Prompt.md. Do ONLY the sections marked [LOGIC]. For every [ART] item, build a clear blockout " +
          "instead of painting: simple shapes in the palette at the exact positions and sizes the prompt gives, each " +
          "drawing function marked with a comment '// ART: blockout - <item>'. Do not try to make the art look finished. " +
          "Run every check the prompt asks for. Write review/prompts/$Prompt/summary.md with a section 'Left for ART' " +
          "listing every blockout, and a line saying it was built by $Model via OpenCode. Do not make the review sheet. Work in $root."
} else {
  $task = "Read prompts/$Prompt.md and carry it out completely. Work in $root."
}
if ($NoteFile -and (Test-Path $NoteFile)) { $task += "`n`nNote from Claude Code:`n" + (Get-Content $NoteFile -Raw) }

Set-Location $root
$started = Get-Date
"[$started] opencode $Model scope=$Scope :: $name" | Out-File $log -Encoding utf8

# Pipe in nothing: with an open console stdin, `opencode run` sits waiting for input
# forever (seen in the 2026-10-30 smoke test).
$null | & opencode run -m $Model --auto --title "spyder $name" $task 2>&1 | Out-File $log -Append -Encoding utf8
$code = $LASTEXITCODE

# Narrow on purpose: the log also holds code the model wrote, where a bare "429" or "balance" is harmless.
$quotaPattern = 'rate.?limit(ed)?|\b429\b.*(too many|limit)|insufficient.?(balance|quota|credit)|quota.?(exceeded|exhausted)|RESOURCE_EXHAUSTED'
$quota = if (Select-String -Path $log -Pattern $quotaPattern -Quiet) { 1 } else { 0 }
$finished = Get-Date
"exit=$code quota=$quota scope=$Scope model=$Model started=$started finished=$finished minutes=$([math]::Round(($finished - $started).TotalMinutes, 1))" |
  Out-File $done -Encoding utf8
