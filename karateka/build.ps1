# build.ps1 -- from a copy of the game you own, to named source, and back again.
#
# Three steps, and the third is the one that matters:
#
#   1. comrec.py     original/KARATEKA.EXE -> recovered/karateka.asm
#   2. annotate.py   apply symbols.json    -> recovered/karateka-named.asm
#                    (the toolkit's copy -- the tool is general, the names are not)
#   3. nasm          reassemble and compare against the file we started from
#
# If step 3 does not produce the original's SHA-256, the source is wrong and
# nothing else in this folder should be believed. That is the whole reason the
# check is here rather than in a document.
#
#   .\build.ps1 -Toolkit ..\..\dos-decompiler -Nasm C:\path\to\nasm.exe
#
# Nothing this produces may be committed. `recovered/` is gitignored because a
# byte-identical reconstruction is the game, whether or not it has names on it.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Toolkit,
    [Parameter(Mandatory = $true)][string]$Nasm,
    [string]$Original = "original\KARATEKA.EXE"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Original)) {
    throw "$Original is not here. This repository ships no game files; put your own copy in original\."
}
if (-not (Test-Path $Nasm)) { throw "nasm not found at $Nasm" }

New-Item -ItemType Directory -Force recovered | Out-Null

Write-Host "1/3  reconstructing" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\comrec.py") $Original `
    --out recovered\karateka.asm --map recovered\karateka.map --nasm $Nasm
if ($LASTEXITCODE -ne 0) { throw "comrec.py failed" }

Write-Host "2/3  applying names" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\annotate.py") `
    --asm recovered\karateka.asm --out recovered\karateka-named.asm `
    --symbols symbols.json
if ($LASTEXITCODE -ne 0) { throw "annotate.py failed" }

Write-Host "3/3  rebuilding from the named source" -ForegroundColor Cyan
& $Nasm -f bin -o recovered\image.bin recovered\karateka-named.asm
if ($LASTEXITCODE -ne 0) { throw "nasm rejected the named source" }

# The header is written out beside the source: the listing covers the load
# image, and an MZ is the header plus that. Comparing image.bin against the
# .EXE is the mistake to avoid -- it is 512 bytes short and looks like a
# failure that is not one.
#
# [System.IO.File] resolves a relative path against the .NET process working
# directory, which PowerShell's Set-Location does not touch. Run this script
# from anywhere but the game folder and it reads the header from wherever the
# shell was started. Resolve the paths first.
$here = (Get-Location).ProviderPath
$bytes = [System.IO.File]::ReadAllBytes((Join-Path $here "recovered\karateka.mzheader")) +
         [System.IO.File]::ReadAllBytes((Join-Path $here "recovered\image.bin"))
[System.IO.File]::WriteAllBytes((Join-Path $here "recovered\rebuilt.exe"), $bytes)

$a = (Get-FileHash recovered\rebuilt.exe -Algorithm SHA256).Hash
$b = (Get-FileHash $Original          -Algorithm SHA256).Hash

if ($a -eq $b) {
    Write-Host "`nBYTE-IDENTICAL  $a" -ForegroundColor Green
    Write-Host "recovered\karateka-named.asm rebuilds the game exactly."
} else {
    Write-Host "`nMISMATCH" -ForegroundColor Red
    Write-Host "  rebuilt  $a"
    Write-Host "  original $b"
    exit 1
}
