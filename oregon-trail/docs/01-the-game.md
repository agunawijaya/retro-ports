# The Oregon Trail — the game

*Document one of four. Next: [02 — architecture](02-architecture.md),
[03 — the code](03-the-code.md), [04 — porting](04-porting.md). Start at the
[game's README](../README.md).*

---

## What it is

You are a wagon party leaving Independence, Missouri, in the spring of 1848,
trying to reach the Willamette Valley in Oregon — about two thousand miles —
before winter, your oxen, or dysentery stop you. You buy supplies from a store,
choose how fast to travel and how much to eat, ford or float rivers, hunt for
food, and read a great many messages telling you that somebody has died.

It is an educational game, written by teachers, and it is probably the most
widely played piece of educational software ever made.

## Where it came from

The history matters here more than it usually does, because the program in this
folder is the fourth or fifth thing to carry the name.

**1971 — a teletype in a classroom.** Don Rawitsch, a student teacher at
Carleton College, was teaching an eighth-grade history class. He recruited two
fellow student teachers, Bill Heinemann and Paul Dillenberger, to help build a
game about the westward migration. It ran on a time-shared mainframe, printed
on paper, and was shown to the class on 3 December 1971. Then it was deleted.

**1975 — MECC.** The Minnesota Educational Computing Consortium hired Rawitsch
in 1974; he retyped the game from a printout he had kept, and it went onto
MECC's statewide timesharing system. That is how a classroom exercise became
software that every school in a state could run.

**1985 — the Apple II.** The version most people picture: graphics, a store, a
hunting minigame, tombstones. This is the one that made it famous.

**1990 — MS-DOS.** This folder. It is a port of the 1985 design to the IBM PC,
and it is the version that ran in school computer labs through the 1990s.

The file here is MECC's release 2.1, dated 1990, and its own `file_id.diz`
says so.

## How it plays

**Outfit the wagon.** You pick a profession — banker, carpenter or farmer —
which sets your starting money and your final score multiplier, and then spend
it at Matt's General Store in Independence: oxen, food, clothing, ammunition,
spare wagon parts. Everything you do not buy, you will want.

**Travel.** You set a pace and a food ration, and the trail advances a day at a
time. Each day costs food and wears the wagon. Landmarks arrive — Fort Kearney,
Chimney Rock, Independence Rock, Fort Hall — and at most of them you can rest,
trade or talk to people.

**Cross rivers.** Ford it, caulk the wagon and float, take a ferry, or wait. The
choice is a gamble against the river's depth and the current, and it is where a
great many parties drown.

**Hunt.** A separate screen with a hunter and animals crossing it. You can carry
back only so much meat however much you shoot, which is the point the game is
making.

**Survive.** Dysentery, typhoid, cholera, measles, exhaustion, broken limbs,
snakebite. Members of your party fall ill and sometimes die, and you type their
epitaph on a tombstone that the game remembers.

### Things worth knowing before you play

- **Buy more oxen than you think.** They are the difference between arriving and
  not, and a dead ox is far more expensive than a spare one.
- **A grueling pace and meagre rations will kill your party**, not save time.
  The game models exhaustion and illness against both.
- **Ford only shallow rivers.** The depth is shown; below about two and a half
  feet is usually survivable, and above it is a coin toss you will lose.
- **You cannot carry all the meat you shoot.** Hunting more than you need wastes
  ammunition and time, which is deliberate.
- **Rest costs days but buys health.** Arriving in November with a healthy party
  scores better than arriving in September with a dying one.

## What was notable about it

**It taught by simulation rather than by quiz.** The game never asks a question
with a right answer. It gives you a resource-allocation problem with weather,
illness and bad luck in it, and lets consequences accumulate. That was an
unusual thing for educational software in 1971 and it is still not common.

**It made the constraints the lesson.** Wagon capacity, the price of oxen, the
distance between forts — these are the content. You learn the shape of the
journey by being unable to afford it.

**And it reached everybody.** Because MECC distributed to schools rather than to
shops, a generation encountered it not as a game they chose but as a thing that
was simply on the computer at school. That is why "you have died of dysentery"
is a joke a very large number of people share.

## What is interesting about *this* version, technically

That is [document two](02-architecture.md), but the headline is worth stating
here because it makes this program different from every other game in this
repository.

**It is written in Turbo Pascal.** ParaTrooper, Zaxxon and Karateka are
hand-written assembly; Hard Hat Mack is 6502 mechanically translated to 8088.
This is a *compiled high-level language program*, from 1990, and it looks like
one: 201 KB unpacked, split into eleven code segments, one per source unit,
calling a runtime library that takes nearly half of all the calls in the
program.

**And its artwork needs no reverse engineering at all.** 511 KB of it sits in
two files beside the executable, in ZSoft PCX — an open format five years older
than the game — inside a container sold by a third party. Every previous game
here hid its sprite format inside the binary and made us guess the width from a
pointer table's stride. This one just has files.

That contrast is the most useful thing this game has to teach, and
[document two](02-architecture.md#what-changed-between-1983-and-1990) says why.

---

*Next: [02 — architecture](02-architecture.md).*

Sources for the history, which the binary cannot supply:
[Wikipedia — The Oregon Trail (1971)](https://en.wikipedia.org/wiki/The_Oregon_Trail_(1971_video_game)),
[Wikipedia — The Oregon Trail (1985)](https://en.wikipedia.org/wiki/The_Oregon_Trail_(1985_video_game)),
[MNopedia](https://www.mnhs.org/mnopedia/search/index/thing/oregon-trail-computer-game),
[Carleton College](https://www.carleton.edu/news/stories/carl-creators-of-oregon-trail-celebrate-50th-anniversary/).
Everything about the file itself was measured from the file.
