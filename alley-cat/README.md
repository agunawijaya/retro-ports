# Alley Cat (1984, DOS)

Bill Williams for Synapse Software, published by Datasoft.

**It does not rebuild yet.** comrec's `.COM` route through an MZ needs a file with no relocations, and this one has them. See [BRIEF.md](BRIEF.md); that is the work. **Nothing here has been read yet.** What exists is the triage and the
scaffolding: a `build.ps1` that reconstructs the game from a copy you own and
checks the result byte for byte, an empty `symbols.json`, and
[BRIEF.md](BRIEF.md) with what the triage found and where to start.

Nine relocations across 54 KB means the program is laid out in
several segments but barely uses them -- most addressing is within one. The
entry sits two thirds of the way into the image at 0x7430, so the code before
it is either reached from there or is data.

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
