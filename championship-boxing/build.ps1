# build.ps1 -- from a copy of the game you own, to named source, and back again.
#
#   1. comrec.py     original/BOXING.COM -> recovered/championship-boxing.asm
#   2. annotate.py   apply symbols.json (the toolkit's copy of the tool)
#   3. nasm          reassemble and compare against the file we started from
#
#   .\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
#
# Nothing this produces may be committed: recovered/ is gitignored because a
# byte-identical reconstruction is the game, named or not.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Toolkit,
    [Parameter(Mandatory = $true)][string]$Nasm,
    [string]$Original = "original\BOXING.COM"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Original)) {
    throw "$Original is not here. This repository ships no game files; put your own copy in original\."
}
New-Item -ItemType Directory -Force recovered | Out-Null

Write-Host "1/3  reconstructing" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\comrec.py") $Original `
    --out recovered\championship-boxing.asm --map recovered\championship-boxing.map --nasm $Nasm
if ($LASTEXITCODE -ne 0) { throw "comrec.py failed" }

Write-Host "2/3  applying names" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\annotate.py") `
    --asm recovered\championship-boxing.asm --out recovered\championship-boxing-named.asm --symbols symbols.json
if ($LASTEXITCODE -ne 0) { throw "annotate.py failed" }

Write-Host "3/3  rebuilding from the named source" -ForegroundColor Cyan
& $Nasm -f bin -o recovered\rebuilt.bin recovered\championship-boxing-named.asm
if ($LASTEXITCODE -ne 0) { throw "nasm rejected the named source" }

$a = (Get-FileHash recovered\rebuilt.bin -Algorithm SHA256).Hash
$b = (Get-FileHash $Original              -Algorithm SHA256).Hash
if ($a -eq $b) {
    Write-Host "`nBYTE-IDENTICAL  $a" -ForegroundColor Green
} else {
    Write-Host "`nMISMATCH" -ForegroundColor Red
    Write-Host "  rebuilt  $a"
    Write-Host "  original $b"
    exit 1
}

