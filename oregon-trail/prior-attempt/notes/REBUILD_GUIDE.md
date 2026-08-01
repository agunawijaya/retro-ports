# Turbo Pascal Rebuild — Architecture Guide

The reconstructed source lives in `.\src\`.  It targets Turbo Pascal
6.0 and mirrors the documented architecture of the original 1990
binary.

---

## 1. Unit Layout

```
OREGON.PAS         main program: title, menu, new-game wizard
TRAVEL.PAS         daily loop, victory / death / winter endings
UI.PAS             text menus, status panel, prompts

GAMETYPE.PAS       shared types and constants
GAMESTAT.PAS       global TGameState + party / food helpers
RNG.PAS            timer-seeded counter RNG

LANDMARK.PAS       18-landmark table (incl. miles-required, flag bits)
EVENTS.PAS         20-row event probability table + dispatcher
ILLNESS.PAS        6-illness param table + sickness daily tick

STORE.PAS          Matt's General Store + fort resupply
RIVER.PAS          ford / caulk / ferry / hire-guide
HUNTING.PAS        real-time hunt minigame

GRAPHX.PAS         BGI + Genus pcxLib wrapper + PCX RLE decoder + 8x8 font
MUSIC.PAS          SONGS.TXT PLAY-string parser
DIALOGS.PAS        NPC record reader with zone-aware selection
SAVELOAD.PAS       *.GAM / HISCORES.REC / TOMB.REC

COPYPROT.PAS       documentation-only: the date-bomb gate (not invoked)
```

Plus build artefacts:
```
README.TXT         in-rebuild notes (what's confirmed vs approximated)
SCREENS.TXT       screen-to-code navigation guide
MAKEFILE           Borland MAKE rules
build.bat          one-shot build script for DOSBox
```

And closure documentation:
```
STATICTRACE.TXT    deep static analysis pass results
RNGNOTES.TXT       RNG algorithm closure (static + DOSBox-X live trace)
DIAMETA.TXT        DIALOGS.REC structure closure
COPYPROT.PAS       copy-protect gate documented inline
```

---

## 2. How to Build

In a DOSBox session with TP 6.0 installed and `tpc.exe` on the PATH:

```
cd \src
build.bat
```

Or use Borland MAKE:

```
make
```

The compilation order respects the `uses` graph: `GameType` first,
then `Rng`, then `GameStat`, then domain units, then `Travel`, then
`Oregon`.

> The rebuild source has **not been actually compiled and tested**.
> It is written to TP 6.0 syntax but may need small fixes where
> TP's strict type checking diverges from my assumptions.

---

## 3. Runtime Asset Dependencies

The rebuild reads the **original asset files at runtime** rather than
embedding them.  This is intentional: the original files contain
copyrighted creative content (NPC dialog, song notation, graphics).
Compile the rebuild and place these original files alongside it:

```
CGA.BGI / VGA256.BGI      Borland Graphics Interface drivers
OTCGA.PCL / OTMCGA.PCL    pcxLib archives (29 PCX images each)
PAL.256                   shared 256-color VGA palette
BIT8X8.GFT                8x8 bitmap font
DIALOGS.REC               NPC advice database
SONGS.TXT                 18 songs in GW-BASIC PLAY syntax
HISCORES.REC              top-10 leaderboard
TOMB.REC                  tombstone records from prior plays
JOYCAL.REC                joystick calibration (optional)
```

Without these files, the game will fail at startup with various
errors.

---

## 4. Architectural Highlights

### 4.1 Counter-Based RNG (`RNG.PAS`)

Confirmed via DOSBox-X live trace on 2026-06-10:

* 32-bit counter at runtime address `0x2348:0x16B2`
* Seeded at startup by a `~5.5 s` timer-driven calibration that captures
  player-input timing entropy
* Each `GetRand(N)` call: `Inc(Counter); return Counter mod N`
* The startup ISR is **uninstalled** after seeding — the counter no
  longer ticks from the timer during gameplay

No LCG multiplier, no XOR mask.  All the "randomness" lives in the
seed; per-call is deterministic.

### 4.2 Daily Loop (`TRAVEL.PAS`)

```pascal
procedure DailyTravelLoop;
begin
  player_action := ShowDailyMenu;
  case player_action of ... end;          { menu dispatch }

  miles_today := HoursForPace * SpeedFactor;
  Inc(State.MilesTraveled, miles_today);

  if not ConsumeFood then ProcessIllness; { hunger event }

  ev := RollEvent;
  if ev <> EvNone then ProcessEvent(ev);

  UpdateSickness;                          { illness daily drain }

  lm := FindLandmarkForMiles(State.MilesTraveled);
  if lm > State.NextLandmark then
    ArriveAtLandmark(lm);                  { fort / river / fork }

  AdvanceDate(1);

  if State.MilesTraveled >= 2000 then Result := erVictory;
  if CountAlivePty = 0          then Result := erAllDead;
  if pastNovember(...)          then Result := erWinter;
end;
```

### 4.3 Confirmed Numerical Tables

These come directly from the binary and are bit-faithful:

* **Illness W0..W3** (spawn weight, alt weight, duration, daily drain)
  — `ILLNESS.PAS` matches `0x24198` table exactly.

* **Event probability rows** (illness/weather/damage/positive
  thresholds) — `EVENTS.PAS` matches `0x241C8` table exactly.

* **Landmark sequence + miles** — 18 landmarks in order, miles-remaining
  field matches the `Field 3 (offset -4)` column from
  `work/landmark_table.txt`.

* **Starting cash** — Banker $1600, Carpenter $800, Farmer $400
  (per disasm in `work/score_formula.txt`).

* **Store base prices** — $40 ox, $10 wheel/axle/tongue, $0.20/lb food.

* **Ration consumption** `(3 - ration_idx) * alive` per day — confirmed
  by disasm of function at `0x13D26` (see `STATICTRACE.TXT` section C).

* **Score multiplier** `(3 - occ_idx) * alive` — same pattern, but
  applied to a different state variable for end-of-game scoring.

### 4.4 Approximated Items

Not extracted from the binary; reasonable defaults used:

* **Pace hours per day** — 8/12/16 (likely wrong; binary scan
  disproved this triplet but didn't find the actual values)

* **Speed per oxen count** — step function (>=6 oxen -> 3, >=4 -> 2,
  >=2 -> 1)

* **Hunting animal weights / spawn chances** — sensible defaults

* **Score component weights** — structure confirmed (per-resource
  contributions exist), exact weights unknown

* **River outcome thresholds** — 70% ford-deep failure, 30% caulk-tip;
  from LEARN doc, not separately confirmed

### 4.5 Consequences of the Unclosed Gaps

Direct, honest assessment of what each unclosed item costs.

#### Score base weights -- LOW impact

What's unknown: per-resource weights in
`final_score = base_award + food*w1 + cash*w2 + ... + clothing*w5`,
then multiplied by `(3 - occ_idx) * alive_count`.

What's known: structure (component-wise sum), occupation multiplier,
structure of the output template strings.

Consequences:
* Rebuild final scores will DIFFER NUMERICALLY from the original.  A
  run that scores 7650 in the original may score 4200 or 12000 in the
  rebuild depending on whose weights drift.
* `HISCORES.REC` from the rebuild is NOT COMPARABLE with the original.
* **Ordering preserved**: a better run still scores higher than a
  worse one.
* No effect on gameplay decisions, win/loss, or game flow.

Who this hurts: competitive / leaderboard players who want to compare
scores against the original community.  No one else.

#### Hunting animal tables -- MEDIUM impact

What's unknown: exact per-animal spawn weights and meat values.

What's in rebuild: rabbit=2, squirrel=1, deer=50, buffalo=800, bear=350
lbs of meat, with plausible spawn chances.

Consequences:
* Hunt yields more or less meat than the original per session.
* If original is more generous: rebuild hunting becomes OP -- food
  rarely critical, game too easy.
* If original is more stingy: hunting under-powered -- food crises
  more frequent, game too hard.
* Strategies like "rely heavily on hunting" may be viable in the
  rebuild but not the original, or vice versa.

No effect on: when you can hunt, input mechanics, animal categories,
the hunt menu structure -- all faithful to the architecture.

Who this hurts: players who want strategic decisions to mirror the
original's intended balance.

#### Pace formula -- HIGH impact

What's unknown: exact `pace_hours x ox_speed -> daily_miles`
conversion.

What's in rebuild: 8/12/16 hours (Steady/Strenuous/Grueling) times a
step function speed factor based on ox count.

Consequences (this is the worst one):
* Trail-wide TIME BUDGET differs from original.  Game is 2000 miles
  total.  If miles-per-day is off by 20%:
  - Original: 100 days to Willamette, 8 days winter buffer
  - Rebuild: 120 days, you die of winter with identical decisions
  - OR rebuild is 20% faster and the game becomes trivial
* Pace drives EVERY downstream system:
  - winter deadline pressure
  - illness frequency (Grueling triggers exhaustion more often)
  - food consumption (more days = more lbs eaten)
  - river ferry economy (more days = more crossings to budget)
  - strategy choice (push hard vs. play safe shifts entirely)

Net effect: the rebuild may FEEL LIKE A DIFFERENT GAME from the
original despite being structurally identical.  This is the gap that
most damages "play the rebuild as Oregon Trail" use case.

#### Summary table

| Gap                | Gameplay | RE/study | Feel-of-original |
|--------------------|---------|---------|-----------------|
| Score weights      | None    | None    | Low (numbers only) |
| Hunting tables     | Medium  | None    | Medium           |
| **Pace formula**   | **High**| None    | **High**         |

#### What this means for different use cases

* **Studying the architecture / screen-to-code mapping** (your stated
  goal): NONE of these gaps matter.  Layout, dispatch logic, system
  architecture are all captured independently of numerical tuning.

* **Playing the rebuild as Oregon Trail**: structurally identical
  (events, decisions, illness model, deaths -- same), but numerically
  off.  Tuning may need trial-and-error fitting to match the
  original's difficulty curve.

* **Bit-perfect re-creation**: not achievable from current evidence.
  Would require either further dynamic-trace work (with limits we
  hit in 4 DOSBox-X sessions) or full Ghidra interactive analysis
  with TP6-aware decompiler config.

#### Tunable constants in the rebuild

If gameplay feels off when you play:

* `TRAVEL.PAS` `HoursForPace` function -- adjust pace hours
* `TRAVEL.PAS` `SpeedFactor` function -- adjust ox-count speed tiers
* `HUNTING.PAS` `AnimalMeat[]` and `AnimalChance[]` arrays
* `TRAVEL.PAS` `BaseResources` function -- score component weights

A few playthroughs of trial-and-error will converge on values that
feel right, even without bit-perfect ground truth.

---

## 5. Cross-Reference: Original Screen Text Positions

Each `.PAS` unit header lists the file offsets in `OREGON_UNPACKED.BIN`
where the corresponding screen text lives.  For example, `STORE.PAS`
has:

```
Original screen-text positions in OREGON_UNPACKED.BIN:
  STORE_GREETING          @ 0x0DB7D  (Matt intro)
  STORE_GREETING          @ 0x0DB46  (sales pitch)
  STORE_ITEMS / banner    @ 0x0E793
  STORE_LIMIT_OXEN        @ 0x09583, 0x0DECB
  STORE_LIMIT_FOOD        @ 0x0959E
```

To see what those offsets actually contain in your binary:

```
python work/show_screen.py STORE_GREETING
```

This is the **only way the original verbatim prose appears** in
this project — read out of your binary at query time, never embedded.

Full screen list: see `src/SCREENS.TXT` or run `python work/show_screen.py`
with no args.

---

## 6. Save File Format

The shipped developer save `ZOP12.GAM` is 144 bytes.  Layout
reconstructed from `work/save_decode.txt`:

```
offset  field
------  ---------------------------------------------------
0..2    header: 0xC0 0x01 partysize
3..98   5 party members:
          1 byte name_len
          N bytes name
          1 byte health
          1 byte illness
          1 byte alive_flag (0x01 alive, 0xFF dead)
100..   supplies struct  (cash, food, bullets, oxen, ...)
120     uint16 miles_traveled
122     uint32 date (day, month, year)
126     occupation
127     difficulty
128     pace
129     ration
130     next_landmark
```

`SAVELOAD.PAS` writes a compatible format; not bit-perfect with the
original, but round-trippable within the rebuild.

---

## 7. Things You'll Want To Know Six Months From Now

* **The rebuild is for STUDY, not redistribution.**  It depends on
  shipped assets that are MECC's copyrighted property.  Compiling
  and running for personal study is the use case.

* **Don't try to "improve" by re-embedding the original prose.**
  The whole architecture is designed so prose stays in MECC's
  binary, accessed via the show_screen tool when you want to read it.

* **Gap #3 was the hard one.**  If you ever need to redo the RNG
  analysis, the methodology is in `RE_PLAYBOOK.md` section 4 — the
  key insight is that the timer-installed ISR is RESTORED after
  startup, and the BPM-write breakpoint at `2348:16B2` shows the
  game-code writing the counter at every RNG call.

* **Phase 4's score-function attribution at `0x13D26` was wrong.**
  That function is the FOOD CONSUMPTION function, not score.  See
  `STATICTRACE.TXT` section C for the corrected analysis.

* **The `0x4D` byte found in both `DIALOGS.REC` and `TOMB.REC`** is
  likely a MECC authoring-tool slot-in-use marker.  No per-record
  meaning; can be ignored.
