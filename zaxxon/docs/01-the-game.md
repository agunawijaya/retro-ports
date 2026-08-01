# Zaxxon — the game

*Document one of three. Next: [02 — architecture](02-architecture.md), then
[03 — the code](03-the-code.md). Start at the [game's README](../README.md).*

---

## What it is

Zaxxon is a shooting game. You fly a small fighter through a fortress made of
walls, gun towers and fuel drums, and the whole thing is drawn as though you
were looking down at it from one corner, at an angle. That angled view is the
entire point of the game, and it is why people still talk about it forty years
later.

Sega released it in arcades in **1982**. It is generally credited as the first
arcade game to use an **isometric** view — a way of drawing three dimensions on
a flat screen that keeps everything the same size no matter how far away it is.
It was also one of the first arcade games advertised on American television.

The version taken apart here is the **IBM PC version, 1984**, a single file of
20,736 bytes called `ZAXXON.COM`. The title screen in the file says:

```
Z A X X O N
c 1984 Sega Enterprises Inc.
```

Secondary sources credit Datasoft with the home-computer conversions and Sega
with the publication; the binary itself only names Sega, and that is what this
repository quotes.

## What isometric means, and why it made the game hard

Draw a cube on paper. If you draw the front face as a square and then draw the
top and one side going off at an angle, you have drawn an isometric cube. There
is no vanishing point and no perspective: a line ten squares away is exactly as
long as a line right in front of you.

For a game in 1982 this is an enormous practical advantage. Real perspective
means scaling every sprite by its distance, and scaling a bitmap costs
multiplication and division that an 8-bit or early 16-bit machine cannot afford
sixty times a second. In an isometric world, **an object at the back and the
same object at the front are the same picture** — you just draw it somewhere
else. All the depth comes from *where* things are drawn, never from how big
they are.

The cost lands on the player instead. Because nothing changes size, your only
clue to how high you are flying is:

- the **shadow** your ship casts on the floor below it, and
- an **altitude indicator** drawn up the left-hand side of the screen.

That is a real difficulty, and it is the thing everybody remembers about
Zaxxon: judging height. Flying into a wall you thought you were above is the
standard way to lose your first three lives.

## How it plays

You fly left to right — or rather, the fortress slides past you diagonally,
towards the bottom-left of the screen, while your ship stays roughly where you
put it.

- **Move** in four directions. Up and down move your ship *and* change its
  altitude; the ship's picture banks as you turn.
- **Fire.** One button. Your shots travel forward at your current height.
- **Fuel** drains constantly. Shooting a fuel drum refills part of the gauge at
  the bottom of the screen. Running out is fatal, so the drums are not optional
  scenery — they are the clock.

A run alternates between two kinds of section:

1. **The fortress.** Walls with gaps in them, gun emplacements, radar dishes,
   fuel drums, and turrets that shoot at your altitude. Some walls have a low
   gap you must dive through and some have a high one; picking the wrong one is
   what the shadow is for.
2. **Open space.** Between fortresses the floor drops away entirely and you
   fight enemy fighters over a black background. With no floor there is no
   shadow, so height stops mattering — which is exactly why the section exists.

At the end of a full circuit there is a boss: an armoured robot that fires
missiles, with one weak point.

### Things worth knowing before you play

- **Watch the shadow, not the ship.** When the shadow touches the base of a
  wall, you are at the height of that wall's base.
- **The altitude bar on the left is absolute, not relative.** It tells you your
  height above the floor, not your height above the next obstacle.
- **Fuel drums are worth points and fuel.** Skipping one to dodge a wall is
  usually the wrong trade.
- **In the open sections, climb.** With no floor to hit, altitude is free, and
  enemy fighters approach on fixed paths that are easier to read from above.
- **The gun turrets fire at your current altitude.** Changing height as you
  approach one is often enough on its own.

## What was remarkable about it in 1982, and in 1984

Three things, in decreasing order of how obvious they are.

**The view.** Nobody had shipped an arcade game that looked like this. The
technique was not new — architectural drawings had used it for centuries — but
using it for a game that must be redrawn sixty times a second was. Q*bert,
Congo Bongo, Marble Madness and eventually Populous and SimCity all sit
downstream of it.

**Height as a game mechanic.** Before Zaxxon, a shooting game was played on a
plane. Adding a third axis that you cannot see directly, and then making the
player infer it from a shadow, is a design idea rather than a technical one,
and it is the harder of the two to have.

**Making it fit.** That is the part this repository cares about, and it is
where the 1984 PC version becomes interesting on its own terms. The arcade
machine had dedicated hardware for scrolling and sprites. The IBM PC had a CGA
card with 16 KB of video memory, no sprite hardware, no scrolling hardware, no
blitter, and a processor doing everything by hand. The whole game — code,
artwork, level data, sound — is **20,736 bytes**, which is smaller than a
single modern icon file.

How that was done is [document two](02-architecture.md). The short version:
the backgrounds are built from 94 eight-by-eight tiles, stored run-length
compressed and expanded once per section; the objects are 34 sprites drawn
through masks; and the entire play field is composed off-screen in ordinary
memory and copied to the display in one pass, so the picture never tears.

## Where this particular file came from

The first 128 bytes of `ZAXXON.COM` are not code. They are this, in plain
text:

```
Zaxxon is brought to you by :

   --- The Duplicators ---
```

followed by byte `0x1A`, which is what DOS used to mark the end of a text file.
Type the program's name at a DOS prompt with `TYPE` in front of it and that
message is what you see — and nothing after it, because `0x1A` stops the
listing. The very first instruction in the file is a jump over the whole
banner.

That is a **crack intro**: a copy-protection removal group signing its work in
a way that shows up when the file is listed but never when it is run. It is
part of the history of the file rather than of the game, and it is worth
mentioning here for two reasons. It means this copy is not byte-for-byte what
Sega shipped. And it is directly responsible for the first real problem in
[document two](02-architecture.md): the jump over the banner hid the program's
real entry sequence from the disassembler well enough that the first attempt
recovered nine instructions out of twenty thousand bytes.

---

*Next: [02 — architecture](02-architecture.md), which takes the program apart:
where it puts itself in memory, how the isometric world is stored, and how a
frame is drawn.*

Sources for the historical claims, which the binary cannot supply:
[Wikipedia](https://en.wikipedia.org/wiki/Zaxxon),
[MobyGames](https://www.mobygames.com/game/411/zaxxon/),
[Internet Archive](https://archive.org/details/msdos_Zaxxon_1984).
Everything about the file itself was measured from the file.
