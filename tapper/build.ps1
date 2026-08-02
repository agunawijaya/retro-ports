# build.ps1 -- from a copy of the game you own, to named source, and back again.
#
#   1. comrec.py     original/TAPPER.COM -> recovered/tapper.asm
#   2. annotate.py   apply symbols.json (the toolkit's copy of the tool)
#   3. nasm          reassemble and compare against the file we started from
#
# This game arrived in this repository with its reconstruction committed --
# 528 KB of NASM source that assembles to a byte-identical copy of TAPPER.COM,
# the same SHA-256. That is the game in source form, so it is not kept here any
# more. It is regenerated, from your copy, in about ten seconds.
#
#   .\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
#
# If step 3 does not produce the original's SHA-256, the source is wrong and
# nothing else in this folder should be believed.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Toolkit,
    [Parameter(Mandatory = $true)][string]$Nasm,
    [string]$Original = "original\TAPPER.COM"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Original)) {
    throw "$Original is not here. This repository ships no game files; put your own copy in original\."
}
New-Item -ItemType Directory -Force recovered | Out-Null

Write-Host "1/3  reconstructing" -ForegroundColor Cyan
# --entries-from seeds the walk with every routine in symbols.json. A
# recursive walk reaches what something branches to; the INT 80h shim this
# release's crack added is installed by a loader that never runs here, so its
# bytes stayed data and its name landed nowhere. Seeding takes the file from
# 68.9% decoded to 74.5%, and byte-identity is still what decides.
python (Join-Path $Toolkit "tools\comrec.py") $Original `
    --out recovered\tapper.asm --map recovered\tapper.map `
    --entries-from symbols.json --nasm $Nasm
if ($LASTEXITCODE -ne 0) { throw "comrec.py failed" }

Write-Host "2/3  applying names" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\annotate.py") `
    --asm recovered\tapper.asm --out recovered\tapper-named.asm --symbols symbols.json
if ($LASTEXITCODE -ne 0) { throw "annotate.py failed" }

Write-Host "3/3  rebuilding from the named source" -ForegroundColor Cyan
& $Nasm -f bin -o recovered\rebuilt.com recovered\tapper-named.asm
if ($LASTEXITCODE -ne 0) { throw "nasm rejected the named source" }

$a = (Get-FileHash recovered\rebuilt.com -Algorithm SHA256).Hash
$b = (Get-FileHash $Original            -Algorithm SHA256).Hash
if ($a -eq $b) {
    Write-Host "`nBYTE-IDENTICAL  $a" -ForegroundColor Green
    Write-Host "recovered\tapper-named.asm rebuilds the game exactly."
} else {
    Write-Host "`nMISMATCH" -ForegroundColor Red
    Write-Host "  rebuilt  $a"
    Write-Host "  original $b"
    exit 1
}
