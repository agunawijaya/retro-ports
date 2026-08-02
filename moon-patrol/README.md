# Moon Patrol (1983, DOS)

Irem's 1982 arcade original, DOS conversion.

**It rebuilds byte-identically** from a copy you own — checked on every run. **Nothing here has been read yet.** What exists is the triage and the
scaffolding: a `build.ps1` that reconstructs the game from a copy you own and
checks the result byte for byte, an empty `symbols.json`, and
[BRIEF.md](BRIEF.md) with what the triage found and where to start.

**0.5% is the whole story.** The other five games in this
collection decode between 45% and 90%. A recursive walk that reaches 279 bytes
of a 58 KB file has lost the thread almost immediately -- the entry does a
little and then transfers control somewhere the walk cannot follow.

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
