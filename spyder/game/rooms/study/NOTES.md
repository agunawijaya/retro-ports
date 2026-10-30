# Room 10: Study / Library — Development Notes

## Architectural & Design Decisions

1. **Two-File Room Structure:**
   - Followed `game/rooms/master-bedroom/` and `game/rooms/upstairs-hallway/` conventions: `room.js` contains all [LOGIC] (platforms, rules, ladder physics, lore pages, makeover beats, QA staging), while `art.js` provides blockouts for all [ART] items attached via `S.rooms.attachArt('study', ...)`.

2. **Stage Layout & Platforms:**
   - Bounds: `left: 100`, `right: 1840`.
   - Floor at `GROUND = 935`, `FLOOR_LINE = 770`, `CEILING = 100`.
   - Gallery walkway: x 120–1500, floor platform at y 560 (`oneWay: true`).
   - Desk platform: x 765–1155, y 770 (`oneWay: true`).
   - Armchair seat platform: x 1570–1770, y 800 (`oneWay: true`).
   - Jump budget verification:
     - Floor (935) to Desk (770): rise 165 px (≤ 190 px limit).
     - Floor (935) to Armchair (800): rise 135 px (≤ 190 px limit).
     - Floor (935) to Gallery (560): rise 375 px (exceeds jump limit; requires ladder).
     - Floor to Ladder Rung 1 (810): rise 125 px.
     - Ladder Rung 1 (810) to Rung 2 (685): rise 125 px.
     - Ladder Rung 2 (685) to Rung 3 (560): rise 125 px.
     - Ladder Rung 3 (560) to Gallery (560): rise 0 px.

3. **Rolling Ladder Physics:**
   - Rail at y 230, extending from x 160 to x 1460.
   - Ladder width: 70 px; allowed ladder X range: 160 to 1390 (ladder right edge stops at 1460).
   - Hero walking into ladder foot while standing on the floor pushes the ladder at 60% hero speed (`0.6 * hero.vx`).
   - Ladder rungs (y 810, 685, 560) move dynamically with `ladder.x`, updating their platform collision bounds every frame.
   - Pushing the ladder produces audio rumble feedback.

4. **Lore Pages Puzzle & Extra Goal:**
   - 3 diary pages hidden behind webs:
     - Page 1: on gallery (x 380, y 530), covered by web between gallery bookcases.
     - Page 2: behind globe (x 1310, y 750), covered by globe web.
     - Page 3: behind leaded window high web (x 1690, y 320), covered by window web.
   - When covering web falls below 30% intactness (`web.intactness < 0.3`), the page drops with fluttering physics and settles on the platform below.
   - Hero collects page on contact (+100 points, "Page N of 3").
   - Updates `extraGoals: [{ id: 'pages', label: 'Diary pages N/3' }]`. At 3/3 pages, calls `world.completeGoal('pages')`.

5. **Web Weaver Implementation (`lib/spider-types/web-weaver.js`):**
   - Body: `SpiderRig` at scale 1.0 with `legReach: [1.3, 1, 1, 1]` on the front pair.
   - First Weaver intro: spawns alone on the gallery rail after the first kill (`canSpawn` checks `kills >= 1 && no other quota spiders`), spinning slowly (5.0 s).
   - Subsequent Weavers spin over 3.5 s, up to 3 webs per Weaver.
   - Catches darts: intercepts `'dart'` events in flight; tears segment and absorbs dart unless using Web-Cutter.
   - Interruption: shooting the half-made web or the spider awards +80 "Unravelled!" bonus.

6. **Blockout Art Policy:**
   - Implemented simple geometric shapes in palette tones for all 12 [ART] items.
   - Each drawing routine tagged with `// ART: blockout - <item>`.
   - Finished painting left for Claude Code (Opus).

---

## Art (2026-10-30, Claude Code)

`art.js` was repainted over Flash's blockout. The Web Weaver's look is in `lib/spider-types/web-weaver.js` (`draw`, `drawWeaverBody`). Its behaviour is untouched.

### Decisions

- **The bookcases are the back wall.** Both tiers are in the back layer, so wall critters, webs and the hidden pages sit over them.
  - The gallery (its slab, brass balusters and handrail), the ladder rail, the desk, the globe stand and the armchair are furniture.
- **The ladder is drawn in `drawOnFurniture`,** so it stands in front of the gallery and the desk as it rolls past them. It is one cached sprite per state, moved to `live.ladderX`.
- **The five fallen books are drawn live (`FALLEN`).** They lie on the floor until the `books` beat, then slide back one after another. The case painter keeps their gaps empty in both states, so they have somewhere to go.
- **The diary stands on a small reading stand,** angled toward us, so the story line can be read: "Thomas says the Helper will come back one day and make the house safe." — E.
- **The moonlight through the leaded window** is a pool on the floor with the lead lattice cut out of it as shadow. It is painted once (moon and dawn) and added to the light map, as the Master Bedroom's lace is.
- **Hidden diary pages show a pale corner behind their webs,** at 55 %, so the puzzle can be seen.
- **The door** is a gap at the right end of the lower tier (x 1390–1500), ajar on a dark landing.

### Critique rounds (5 biggest gaps per round)

**Round 1:**
1. Brass clocks and busts repeated along every shelf. Now 1.2 % of slots.
2. The lit globe read as a grey ball. The sea is now moon-and-dawn, the continents moss.
3. The stacks laid flat were too frequent. They dropped from 10 % to 7 %.
4. The dirty room is dark. That is accepted: the green lamp and the moon diamonds are the light.
5. In the `weaver` QA state, the Weaver is not spinning; logic, sent to `engineer`.

**Round 2:**
1. In `action`, a red tint covers the whole frame (staging, checked by `engineer`).
2. The Weaver's bands read only up close. That is accepted: its silhouette (long front legs, slim abdomen) is what tells it apart.
3. No further gap was big enough to list.

**Round 3:**
1. `makeover` at t ≈ 3.9 s: the lamp is warm, the globe lighting, and the books still on the floor (`books` is at 4.6 s). It is correct as it stands.

### Traps

- **`FALLEN` positions are tied to shelf heights** (lower tier: 676, 761, 846). Move a shelf and the books slide back into the wrong place.
- **The case painter is seeded** (13010 upper, 13020 lower). The same books land in the same places on every load; change the seed and the gaps for `FALLEN` still hold.
