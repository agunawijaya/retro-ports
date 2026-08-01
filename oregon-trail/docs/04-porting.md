# The Oregon Trail — porting it

*Document four of four. [01 — the game](01-the-game.md),
[02 — architecture](02-architecture.md), [03 — the code](03-the-code.md).*

**No port of this game exists in this repository.** There is a JavaScript one in
`prior-attempt/web/`, from a session that predates the toolkit, and it should be
treated the way everything else in that folder is treated — as a hypothesis.

This document is the decision that comes before a port, and for this game it is
a genuinely different decision from the other four, for one reason: **the hard
part is not the code.**

---

## The situation is upside down compared with every other game here

| | ParaTrooper / Zaxxon / Hard Hat Mack | **Oregon Trail** |
|---|---|---|
| the artwork | had to be reverse engineered from the binary | **already decoded, open format** |
| the code | reconstructed, byte-identical, 76–91% as instructions | **compiled Pascal; no reconstruction exists** |
| what a porter lacks | the pictures | **the rules** |

For Zaxxon a porter can read the wall-collision predicates and the score table
out of a document because somebody traced them. For this game nobody has. What
exists is 511 KB of correct artwork and an architecture map.

**So the porting problem here is a research problem, and it should be planned as
one.** The languages below are almost interchangeable; what decides the project
is how the rules get recovered.

## Getting the rules, which is the actual work

Four routes, and they are not exclusive.

**1. Read the Pascal.** 137,712 bytes across ten segments, compiled by a
high-level compiler, which is *much* easier to read than hand-written assembly:
stack frames are regular, the calling convention is fixed, strings are
length-prefixed and findable, and the unit boundaries are known.
[Document two](02-architecture.md#eleven-segments-one-per-unit) gives the
segment map to start from. This is the honest route and it is weeks of work.

**2. Test the prior attempt's reconstruction.** `prior-attempt/src/` has 17
Pascal units covering exactly the topics a port needs. It has never been
checked. **But it can be**: Turbo Pascal is abandonware and findable, and if
those units compile, the resulting binary can be compared against the original.
That is the strongest single move available and nobody has made it — see
[below](#the-one-experiment-worth-running-first).

**3. Read the data files.** `DIALOGS.REC` is 14,586 bytes of the game's text
and `SONGS.TXT` is the music as text. Neither has been examined. Text often
carries structure — the order of events, the names of illnesses, the landmarks
— and it is the cheapest evidence in the folder.

**4. Play it and measure.** DOSBox runs the game today. Prices, distances,
illness rates and river outcomes can be sampled from a running game without
reading a byte. Slow, but it produces numbers that nothing else here does, and
it is the only route that validates the others.

## The artwork is done, and here is what that means

58 images, both colour depths, decoded and rendered:

```
python <toolkit>/tools/pcxlib.py original/OTMCGA.PCL \
       --extract art/ --palette original/PAL.256
```

Two things follow for a port.

**You can read them at load time from the player's own copy.** No asset
pipeline, no conversion step, no artwork in your repository — the container
format is in `pcxlib.py` and the images are PCX. That is the arrangement this
repository prefers, because it ships no copyrighted pixels.

**And if you draw your own instead, you know exactly what to draw**: 29
subjects, their dimensions, and the 256-colour palette the game used. The
MCGA set is 320×200-era 8-bit; the CGA set is the same subjects at 2 bits, which
is a free demonstration of how the artist handled the constraint.

## The options

### 1. HTML / CSS / JavaScript on a `<canvas>`

**The obvious choice, and more obvious here than usual.** This is a turn-based
game with menus, text and static screens. There is no scrolling, no sprite
pipeline, no frame budget, and no timing to reproduce — the hardest thing in
Zaxxon's port and Hard Hat Mack's simply does not arise.

**For:** nothing to install; text and menus are what the web is for; `fetch` can
read the player's own `.PCL` and decode it in JavaScript in about fifty lines;
and a turn-based simulation is trivially testable headless.

**Against:** nothing serious. Use TypeScript if the rule set grows, and it will.

**Effort:** days for the shell, and then however long route 1 or 2 above takes.
That ratio is the whole point.

### 2. Python

**The right choice for the research phase**, whatever the final port is written
in. The toolkit is Python, `pcxlib.py` already decodes the artwork, and a
throwaway Python model of the trail is the fastest way to check a hypothesis
about food consumption against a DOSBox session.

**Against:** distribution, as always.

### 3. Turbo Pascal itself

Not a port — a *reconstruction*, and it is the interesting one. See below.

### 4. Do not port it

The game runs in DOSBox today, and there are faithful web re-releases. If the
goal is playing The Oregon Trail, that is the answer.

Port it to understand it, or to change it. The educational value of this
particular program is unusually high because the rules are a small, legible
simulation — resource allocation with weather and bad luck — and that is worth
having in a language people can read.

## The one experiment worth running first

Before any porting decision: **try to compile `prior-attempt/src/`.**

Turbo Pascal 5.5 was released as free abandonware by Borland and is findable.
The 17 units in that folder are a complete claimed reconstruction. Compiling
them gives, in increasing order of value:

1. **Does it build at all?** If not, the reconstruction is further from the
   original than it looks.
2. **How big is the result?** The original's code is 144,512 bytes with ~6,800
   of runtime. A reconstruction that produces 30 KB is not the same program, and
   the comparison costs nothing.
3. **Does the segment structure match?** `tpscan.py` will read the units out of
   the rebuilt binary exactly as it read them out of the original. Eleven
   segments against eleven, with comparable sizes, would be strong evidence.
   Three against eleven would be strong evidence the other way.

None of that is byte-identity, and it should not be presented as such. But it
converts a folder full of plausible Pascal into a measurement, which is what
this repository means by an oracle — and it is a day's work, not a month's.

If the toolkit's `comrun.py` gains MZ support — it was being added while this
was written — a second experiment opens up: run the original, force the free
heap below 35,000 bytes, and confirm the 512K message appears. That would be the
first behavioural check anything in this folder has ever had.

## Five things that will bite

1. **The rules are not written down anywhere you can trust.** This is the
   difference from every other game here. Budget for research, not for coding.
2. **`prior-attempt/` reads as authoritative and is not.** Its one tested claim
   had the right address and the wrong meaning.
3. **The artwork is copyrighted even after you decode it.** Read it from the
   player's copy at run time, or draw your own. Thirty images extracted from
   this game were staged for commit here once before a check caught them.
4. **There are two artwork sets, not one.** A port that only handles the MCGA
   container silently ignores half the shipped content.
5. **The text is in a file you have not read.** `DIALOGS.REC`, 14,586 bytes.
   Whatever the trail says to the player is in there, and no document in this
   folder describes its format.

## How to know your port is right

The same ladder as everywhere else in this repository, with the rungs this game
can actually reach:

- **Does it run?** The lowest bar, and it proves nothing.
- **Do the numbers match a DOSBox session?** Prices in the store, distances
  between landmarks, days elapsed. These are cheap to sample and falsifiable.
- **Does the reconstruction compile and match the original's shape?** The
  experiment above.
- **Byte-identity?** Not reachable, and it is worth saying why rather than
  leaving it implied: the original is compiler output, and reproducing it needs
  the same compiler, the same version, the same switches and the same library
  versions — of which the *version* alone is
  [not known](02-architecture.md#what-is-still-unknown). For a hand-written
  `.COM` this repository reaches byte-identity routinely. For compiled Pascal
  it is a much longer road, and pretending otherwise would be the worst kind of
  claim to make here.

---

*Back to [01](01-the-game.md), [02](02-architecture.md),
[03](03-the-code.md), or the [README](../README.md).*
