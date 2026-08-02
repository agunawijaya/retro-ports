# Sierra Championship Boxing (1983, DOS)

Evan and Nicky Robinson, published by Sierra On-Line.

**It rebuilds byte-identically** from a copy you own — checked on every run. **Nothing here has been read yet.** What exists is the triage and the
scaffolding: a `build.ps1` that reconstructs the game from a copy you own and
checks the result byte for byte, an empty `symbols.json`, and
[BRIEF.md](BRIEF.md) with what the triage found and where to start.

**A loader and an overlay set -- a class none of the six
reconstructed games belong to.** The `.COM` is a 2.5 KB stub that decodes
almost completely, and the program proper lives in `BOXING.OVR` with five
small overlays beside it.

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
