# Rampage (1988, DOS)

Bally Midway's 1986 arcade original, DOS conversion by Activision.

**It rebuilds byte-identically** from a copy you own — checked on every run. **Nothing here has been read yet.** What exists is the triage and the
scaffolding: a `build.ps1` that reconstructs the game from a copy you own and
checks the result byte for byte, an empty `symbols.json`, and
[BRIEF.md](BRIEF.md) with what the triage found and where to start.

No relocations, so single-segment -- but the entry is at file
offset 0xE400, **twenty bytes from the end of a 58 KB image**. A program does
not begin at its own end unless the thing at the end is a stub that moves or
unpacks the rest and jumps into it.

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
