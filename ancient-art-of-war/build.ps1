# build.ps1 -- from a copy of the game you own, to named source, and back again.
#
#   1. comrec.py     original/WAR.EXE -> recovered/ancient-art-of-war.asm
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
    [string]$Original = "original\WAR.EXE"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Original)) {
    throw "$Original is not here. This repository ships no game files; put your own copy in original\."
}
New-Item -ItemType Directory -Force recovered | Out-Null

Write-Host "1/3  reconstructing" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\comrec.py") $Original `
    --out recovered\ancient-art-of-war.asm --map recovered\ancient-art-of-war.map --nasm $Nasm
if ($LASTEXITCODE -ne 0) { throw "comrec.py failed" }

Write-Host "2/3  applying names" -ForegroundColor Cyan
python (Join-Path $Toolkit "tools\annotate.py") `
    --asm recovered\ancient-art-of-war.asm --out recovered\ancient-art-of-war-named.asm --symbols symbols.json
if ($LASTEXITCODE -ne 0) { throw "annotate.py failed" }

Write-Host "3/3  rebuilding from the named source" -ForegroundColor Cyan
& $Nasm -f bin -o recovered\rebuilt.bin recovered\ancient-art-of-war-named.asm
if ($LASTEXITCODE -ne 0) { throw "nasm rejected the named source" }

# An MZ with no relocations is a single-segment program: comrec strips the
# header, reconstructs the image as if it were a .COM, and writes the header
# out beside the source. The rebuild is the two concatenated -- comparing
# image.bin against the .EXE is the mistake to avoid, because it is 512 bytes
# short and looks like a failure that is not one.
#
# [System.IO.File] resolves relative paths against the .NET process directory,
# not against Set-Location, so resolve them here first.
$here = (Get-Location).ProviderPath
$hdr = Join-Path $here "recovered\ancient-art-of-war.mzheader"
if (-not (Test-Path $hdr)) {
    throw "comrec.py did not write an MZ header. If this file has relocations, the .COM route does not apply and that is the finding -- see BRIEF.md."
}
$head  = [System.IO.File]::ReadAllBytes($hdr)
$image = [System.IO.File]::ReadAllBytes((Join-Path $here "recovered\rebuilt.bin"))

# An MZ is not always header + image. comrec reconstructs what DOS maps into
# memory; anything the file holds past that is not loaded and not reconstructed,
# but it is still part of the file. The Dam Busters keeps 124 bytes there and
# The Ancient Art of War keeps 87,072 -- seven eighths of itself. mzinfo warns
# about it, and dropping it makes the rebuild miss by exactly that much.
$whole = [System.IO.File]::ReadAllBytes((Join-Path $here $Original))
$after = $head.Length + $image.Length
$tail  = if ($whole.Length -gt $after) { $whole[$after..($whole.Length - 1)] } else { @() }
if ($tail.Length) {
    Write-Host "      + $($tail.Length) bytes of trailing data, not part of the load image"
}
[System.IO.File]::WriteAllBytes((Join-Path $here "recovered\rebuilt.exe"),
                                $head + $image + $tail)

$a = (Get-FileHash recovered\rebuilt.exe -Algorithm SHA256).Hash
$b = (Get-FileHash $Original              -Algorithm SHA256).Hash
if ($a -eq $b) {
    Write-Host "`nBYTE-IDENTICAL  $a" -ForegroundColor Green
} else {
    Write-Host "`nMISMATCH" -ForegroundColor Red
    Write-Host "  rebuilt  $a"
    Write-Host "  original $b"
    exit 1
}

