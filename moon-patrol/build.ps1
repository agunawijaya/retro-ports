# build.ps1 -- from a copy of the game you own, to named source, and back again.
#
#   1. comrec.py     original/PATROL.COM -> recovered/moon-patrol.asm
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
    [string]$Original = "original\PATROL.COM"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Original)) {
    throw "$Original is not here. This repository ships no game files; put your own copy in original\."
}
New-Item -ItemType Directory -Force recovered | Out-Null

# Two address bases: the entry stub at file 0 runs at 0x100, then does a
# far jmp through [0x140] to (CS+0x20):0000 -- file offset 0x100 in the
# new segment addressed from 0. The pointer is written at run time
# (mov [0x142], cs+0x20 / mov [0x140], 0), so comrec cannot see the target
# by static walking of the stub; seed it explicitly. Every near jump and
# bracketed constant from file 0x100 onward is in the new base.
Write-Host "1/3  reconstructing" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\comrec.py") $Original `
    --out recovered\moon-patrol.asm --map recovered\moon-patrol.map --nasm $Nasm `
    --segment 0x100:0 --entry 0x100
if ($LASTEXITCODE -ne 0) { throw "comrec.py failed" }

Write-Host "2/3  applying names" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\annotate.py") `
    --asm recovered\moon-patrol.asm --out recovered\moon-patrol-named.asm --symbols symbols.json
if ($LASTEXITCODE -ne 0) { throw "annotate.py failed" }

Write-Host "3/3  rebuilding from the named source" -ForegroundColor Cyan
& $Nasm -f bin -o recovered\rebuilt.bin recovered\moon-patrol-named.asm
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

