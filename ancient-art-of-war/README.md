# The Ancient Art of War (1984, DOS) — CGA

Dave and Barry Murry (Evryware), published by Broderbund.

**It does not rebuild yet.** comrec's `.COM` route through an MZ needs a file with no relocations, and this one has them. See [BRIEF.md](BRIEF.md); that is the work. **Nothing here has been read yet.** What exists is the triage and the
scaffolding: a `build.ps1` that reconstructs the game from a copy you own and
checks the result byte for byte, an empty `symbols.json`, and
[BRIEF.md](BRIEF.md) with what the triage found and where to start.

**The declared load image is 12 KB and the file is 100 KB.**
DOS loads only what the header declares, so seven eighths of this file is not
code that runs at start-up. It is read later, by the 12 KB that does.

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
