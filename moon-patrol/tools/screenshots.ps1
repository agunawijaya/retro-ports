# screenshots.ps1 -- capture title and gameplay screenshots of the web port.
#
# The port is at ../web/, and screenshots land in ../screenshots/ so
# they stay inside the project tree rather than in a temp directory.
# Both files are the port's own artwork -- nothing from PATROL.COM is
# used at run time -- so they are safe to commit alongside the code.
#
#   .\screenshots.ps1 -Chrome "C:\Program Files\Google\Chrome\Application\chrome.exe"
#
# Requires Python 3 for the local http.server; no other tooling.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Chrome,
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Chrome)) {
    throw "$Chrome does not exist. Pass -Chrome pointing at chrome.exe or msedge.exe."
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# Serve the *game* directory (parent of web/) so that game.js's
# `fetch('../original/PATROL.COM')` resolves cleanly. The port lives
# at http://localhost:PORT/web/ under that layout.
$serveDir = (Resolve-Path (Join-Path $here "..")).Path
$out = Join-Path $here "..\screenshots"
New-Item -ItemType Directory -Force $out | Out-Null
$out = (Resolve-Path $out).Path

$outTitle    = Join-Path $out "title.png"
$outGameplay = Join-Path $out "gameplay.png"

function Take-Screenshot {
    param([string]$Url, [string]$OutPath, [int]$BudgetMs)
    if (Test-Path $OutPath) { Remove-Item $OutPath }
    # Use Start-Process with an explicit argument list so PowerShell
    # does not reinterpret commas, ampersands or backslashes in the
    # Chrome flags. `--screenshot=<path>` needs an absolute path.
    $args = @(
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=700,900",
        "--virtual-time-budget=$BudgetMs",
        "--screenshot=$OutPath",
        $Url
    )
    $p = Start-Process -FilePath $Chrome -ArgumentList $args -Wait -PassThru -NoNewWindow
    if (-not (Test-Path $OutPath) -or (Get-Item $OutPath).Length -lt 5000) {
        throw "screenshot missing or truncated at $OutPath (chrome exit $($p.ExitCode))"
    }
}

Write-Host "starting http.server on port $Port serving $serveDir" -ForegroundColor Cyan
$server = Start-Process -FilePath python -ArgumentList @(
    "-m", "http.server", "$Port", "--directory", $serveDir
) -PassThru -WindowStyle Hidden

$portUrl = "http://localhost:$Port/web/"

try {
    # Wait for the server to accept a connection before firing Chrome.
    $ready = $false
    for ($i = 0; $i -lt 25; $i++) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri $portUrl `
                -TimeoutSec 1 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $ready) { throw "server did not respond at $portUrl after 5 s" }

    Write-Host "capturing title screen" -ForegroundColor Cyan
    Take-Screenshot -Url $portUrl -OutPath $outTitle -BudgetMs 3500

    Write-Host "capturing gameplay screen" -ForegroundColor Cyan
    Take-Screenshot -Url "$portUrl`?start&demo&seed=42" -OutPath $outGameplay -BudgetMs 3500

    Write-Host "`nsaved:" -ForegroundColor Green
    Write-Host ("  {0}    {1} bytes" -f $outTitle, (Get-Item $outTitle).Length)
    Write-Host ("  {0}    {1} bytes" -f $outGameplay, (Get-Item $outGameplay).Length)
}
finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
}
