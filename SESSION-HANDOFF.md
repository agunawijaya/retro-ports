# Session handoff — 2026-08-02

Written for a Claude Code picking this up on another machine. It carries what
the repositories cannot: the decisions taken in conversation, the corrections
made, and what the user actually wants next.

**Everything factual here is checkable, and you should check it.** The counts
below were true when this was written; `build.ps1` prints its own and those are
the ones to believe.

---

## 1. Get set up

Two repositories, side by side, and the paths matter because `build.ps1` takes
the toolkit as a relative parameter:

```
<somewhere>\retro-ports\        this one — the games
<somewhere>\DOS-Decompiler\     the toolkit
```

```powershell
git -C retro-ports     pull
git -C DOS-Decompiler  pull
```

You need **Python 3**, **NASM**, and **Unicorn** (`pip install unicorn`) for
anything that runs a game under the emulator. Take NASM's path as a parameter;
there are no absolute paths in repository code and there must not be.

Check the toolkit is healthy before trusting anything it says:

```powershell
cd DOS-Decompiler
foreach ($t in "com","comrun","tplist","tpscan","unpack","pcxlib","placements") {
    python "tests\$t\regress.py" --nasm C:\path\to\nasm.exe
}
```

Seven suites. `libscan` skips without Open Watcom, which is not a failure.

## 2. The thing that will stop you in the first five minutes

**No game files are in the repository and none ever will be.** `original/`,
`recovered/` and `reference/` are gitignored, and game binaries are blocked
tree-wide as a backstop. Thirteen games have a `build.ps1`; on this machine
**only Karateka's binary is present**, because that is what the user said they
have here.

So either:

- **work on Karateka**, which is what the machine is equipped for and what the
  user has been steering toward; or
- copy the other games' `original\` folders across from the other laptop
  first. Nothing else will build without them, and `build.ps1` will tell you
  so plainly rather than doing something confusing.

## 3. Where the work stands

**Six games are reconstructed and read.** All rebuild byte-identically, which
`build.ps1` checks and refuses to report success without: Karateka, Hard Hat
Mack, ParaTrooper, Zaxxon, Tapper, and Frogger. For the first five, every call
target, every tail-call entry and every bracketed constant is named or
explicitly accounted for, every name carries its evidence, and `_data_spans`
partitions the whole image with no gap. Frogger is reconstructed and
deliberately **unnamed** — see §5.

**Seven more are triaged and waiting**, set up in this session: Alley Cat,
Jungle Hunt, Moon Patrol, The Dam Busters, Sierra Championship Boxing, Rampage,
The Ancient Art of War. Each has a `BRIEF.md` whose numbers were measured with
`mzinfo.py` and `comrec.py`, and each names the one thing to do first. All
seven rebuild byte-identically.

**Oregon Trail belongs to another agent.** It is being worked on in parallel,
in this same repository. Do not touch `oregon-trail/`, and do not stage it.

[`CLAUDE.md`](CLAUDE.md) is the index and the conventions. Read it before
anything else. **Read what the tools print, never a document's memory of it** —
eleven counts in these documents had gone stale inside a single session before
`docaudit.py` existed.

## 4. What the user wants next, in their own priority

They were asked directly and chose: **the ports**, not more decompilation.

The reasoning is in `CLAUDE.md`, but briefly: this repository exists to teach
programming to people who do not program yet, by taking apart old games **and
rebuilding them**. Six byte-identical reconstructions with one playable port
between them is the "impressive but not teachable" failure the charter warns
against.

**Karateka is first**, and [`karateka/PORT-BRIEF.md`](karateka/PORT-BRIEF.md)
is a complete brief written for exactly this handover. Read it before writing
anything. Its central instruction, which is the whole lesson of the previous
failed attempt: **build the referee before the port.**

[`paratrooper/web/`](paratrooper/web/) is the only finished port and is the
template. Three files, and **no image assets at all** — everything drawn from
the reading. If a port needs an asset ripped from the game, the decoding is not
finished; the undone work has just been moved into a binary.

After Karateka: Hard Hat Mack, because its static level render already produces
the three screens from the file alone, which is exactly the asset pipeline a
port needs.

## 5. Decisions taken in conversation that the files do not explain

**Frogger is deliberately unnamed.** The release is patched: a stub prints
`/Patch for Frogger, F10 or another key to play!` and far-jumps into the game
in a segment ten paragraphs on, so the body's addresses are its file offsets
and the stub's are file offset + 0x100. Two bases in one file. Every name
written before that is fixed would be in the wrong coordinate — a mistake this
project has paid for twice, whose only symptom is silence. Fix the segment
split first; the decode rate is the check.

**The seven new games were the user's own list**, picked from their personal
collection, and they authorised the folders being set up. An earlier game
(Frogger) was added without asking, which the user noticed and did not want
repeated. **If you need a file from outside `retro-ports` and
`DOS-Decompiler`, ask which one.** Do not go looking.

**Three releases in this collection arrive with somebody else's code attached.**
Tapper has a crack group's intro and 344 bytes of copy protection nothing can
reach; Frogger has the patch stub; Jungle Hunt's `hunt.com` is a PTL Club crack
*loader* and the game is in `hunt.ptl`. Preservation gets you the copy that
survived, not the copy that shipped. Expect more of this.

**`karateka/prior-attempt/web/` was deleted this session.** It was a browser
remake whose characters were a *NES* sprite atlas over shadow-buffer crops,
because the DOS sprite decoder never worked. Nothing on its screen came from
reading `KARATEKA.EXE`. Its notes and its eighteen extraction scripts were
kept; `prior-attempt/notes/10-investigation-progress.md` §12 is the most useful
document in the folder and should be read before any Karateka work.

## 6. Two corrections made this session, both worth internalising

**A conclusion from four data points is not a rule.** Two games were written up
as "the `.COM` route needs a file with no relocations". The code said
`nreloc > 8` — eight, a threshold set when Karateka's four was the only
example. Alley Cat has nine and missed by one. Both games rebuild
byte-identically with `--max-relocations` raised. **Read the code before
explaining its behaviour.**

**A number is not evidence unless it measures the thing you are claiming.**
When that route was refused, comrec fell back to reading The Ancient Art of War
flat and decoded 61% of the whole file. That was written up as proof that its
87 KB of trailing data is "mostly code, not artwork" — a measurement correcting
a guess. But the 61% came from reading at the wrong base over a region DOS
never loads. It measured nothing about the trailing data, and it was *more*
persuasive than the guess it replaced for having a number attached. What that
87 KB is remains open.

Both corrections are in the affected briefs, next to the claims they replaced.
That is the house style: a falsified prediction stays on the record with the
result beside it.

## 7. The rules that bite

- **Nothing derived from a game may ever be committed.** Not the binary, not a
  byte-identical reconstruction, not extracted sprites, not memory dumps, not
  screenshots. Read what you staged before every commit that adds files. Never
  `git add -A`.
- **Byte-identity is the floor.** Emitting the whole file as `db` would also
  hash correctly. Moon Patrol rebuilds exactly at 0.5% decoded and that proves
  only that the bytes were copied.
- **A rebuild that hashes does not prove the address base was right.** Frogger
  is the counter-example. Hash first, decode rate second, neither alone.
- **Ask "is it finished?" against the right denominator.** Six times in this
  project that question found a real gap and every time the previous count read
  100% against the wrong set. Put the denominator in the same sentence.
- **Every name carries its evidence.** A name with no `why` is a guess the next
  reader will believe. Three have been published and withdrawn.
- **Do not use heredocs to write scripts.** They eat backslash escapes and the
  check then passes while measuring nothing. Use the editor tool.
- **No absolute paths in repository code.**
- Tone: plain, no marketing, no exclamation marks.

## 8. If you want the fastest useful start

```powershell
cd karateka
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

It should print `BYTE-IDENTICAL C8736BBA…` and an audit: 165 of 165 call
targets, no unnamed tail-call entries, 334 of 370 bracketed constants with 36
recorded as displacements, 58 data spans covering 59,670 bytes with no gap.

If that number comes out, everything in `PORT-BRIEF.md` can be trusted, and
that file is where to go next.
