# The Dam Busters (1984, DOS)

Sydney Development, published by Accolade.

**It rebuilds byte-identically** from a copy you own — checked on every run. **Nothing here has been read yet.** What exists is the triage and the
scaffolding: a `build.ps1` that reconstructs the game from a copy you own and
checks the result byte for byte, an empty `symbols.json`, and
[BRIEF.md](BRIEF.md) with what the triage found and where to start.

**This is the same shape as Karateka**, and Karateka is the
worked example: an MZ with no relocations is a single-segment program, and
comrec reconstructs it by stripping the header, treating the image as a `.COM`,
and putting the header back on the way out. `build.ps1` here already does
that, copied from Karateka's.

## Rebuilding it

You need a copy of the game, NASM, and Python.

```powershell
mkdir original
copy <your copy>\* original\
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

## What this repository does not contain

No game files. `original/`, `recovered/` and `reference/` are gitignored,
because a byte-identical reconstruction is the game in another form and a
sprite pulled out of it is still the game. What is kept is the reading: names,
evidence, documentation, and the tools that re-derive the rest from a copy you
already own.
