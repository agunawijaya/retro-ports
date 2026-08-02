# build.ps1 -- from a copy of the game you own, to named source, and back again.
#
#   1. comrec.py     original/HHM.COM -> recovered/hhm.asm
#   2. annotate.py   apply symbols.json (the toolkit's copy of the tool)
#   3. nasm          reassemble and compare against the file we started from
#
# A .COM needs no header step: the listing is the whole file, so step 3 compares
# nasm's output with the original directly. That is the one way this differs
# from Karateka's build, where an MZ header is put back on first.
#
#   .\build.ps1 -Toolkit ..\..\dos-decompiler -Nasm C:\path\to\nasm.exe
#
# Nothing this produces may be committed: recovered/ is gitignored because a
# byte-identical reconstruction is the game, named or not.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Toolkit,
    [Parameter(Mandatory = $true)][string]$Nasm,
    [string]$Original = "original\HHM.COM"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Original)) {
    throw "$Original is not here. This repository ships no game files; put your own copy in original\."
}
New-Item -ItemType Directory -Force recovered | Out-Null

Write-Host "1/3  reconstructing" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\comrec.py") $Original `
    --out recovered\hhm.asm --map recovered\hhm.map --nasm $Nasm
if ($LASTEXITCODE -ne 0) { throw "comrec.py failed" }

Write-Host "2/3  applying names" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\annotate.py") `
    --asm recovered\hhm.asm --out recovered\hhm-named.asm --symbols symbols.json
if ($LASTEXITCODE -ne 0) { throw "annotate.py failed" }

Write-Host "3/3  rebuilding from the named source" -ForegroundColor Cyan
& $Nasm -f bin -o recovered\rebuilt.com recovered\hhm-named.asm
if ($LASTEXITCODE -ne 0) { throw "nasm rejected the named source" }

$a = (Get-FileHash recovered\rebuilt.com -Algorithm SHA256).Hash
$b = (Get-FileHash $Original             -Algorithm SHA256).Hash
if ($a -eq $b) {
    Write-Host "`nBYTE-IDENTICAL  $a" -ForegroundColor Green
    Write-Host "recovered\hhm-named.asm rebuilds the game exactly."
} else {
    Write-Host "`nMISMATCH" -ForegroundColor Red
    Write-Host "  rebuilt  $a"
    Write-Host "  original $b"
    exit 1
}
