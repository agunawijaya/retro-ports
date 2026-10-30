# Room 11: Upstairs Bathroom — Notes & Decisions

## Architectural & Design Decisions

1. **Two-File Architecture (`room.js` & `art.js`):**
   - Implemented strictly following prompt 14 [LOGIC] vs [ART] division.
   - `room.js` encapsulates layout data, platforms, rules, hot tap & steam dynamics, mirror reflection hooks, laundry basket hatchling spills, laundry chute rattling, makeover beats, and QA staging.
   - `art.js` provides clear geometric blockouts in the palette with simple shapes at exact positions and dimensions, marked with `// ART: blockout - <item>` comments on each drawing function.

2. **Mirror Optics & Reflection Transform:**
   - The wall-wide mirror extends from x 760 to 1380 (y 330 to 700), with mirror glass area x 770 to 1370 (y 340 to 690).
   - In diegetic reality, looking into the mirror reflects the room behind the viewer. To show spiders entering behind/above the hero (such as on the skylight frame at x 480 or descending behind the hero at x 860) within the mirror bounds, the reflection pass transforms coordinates via a horizontal reflection and scaling matrix centered at mirror glass center (1070, 515) relative to room center (980, 480).
   - This cleanly positions the reflected skylight frame on the upper right of the mirror glass (x ≈ 1295, y ≈ 398) and the descending string spider behind the hero (x ≈ 1124, y ≈ 470).
   - For performance and accordance with `lib/room-runtime.js`, the room background reflection is cached once per state (`live.reflectedRoom`), while active critters and the hero are drawn in a darkened, cool-tinted reflection pass clipped to the glass.

3. **Steam Progression & Hot Tap Dynamics:**
   - Hot tap sits at (880, 730) on the left basin of the vanity, dripping and steaming when dirty.
   - Fog rises from the bottom of the glass: `live.steam` progresses 0 -> 1 over 20.0 s.
   - When a projectile (dart or foam blob) hits within 30 px of the hot tap, the tap squeaks and shuts off; the mirror clears in 4.0 s (`dt / 4.0`).
   - The tap turns itself back on 25.0 s later accompanied by a pipe knock audio tone.
   - In clean state or makeover, the tap is permanently shut off and mirror clears completely.

4. **Laundry Basket & Laundry Chute Hatch:**
   - The laundry basket (x 1720–1840, top y 840) acts as a lair: every 18–26 s in dirty mode, its lid tilts open and hatchlings spill out.
   - The laundry chute hatch (x 1720–1820, y 560–640) rattles every 14–22 s with a metallic bandpass rattle sound and subtle visual shake; nothing emerges (a thematic hint towards the basement).

5. **Platforms & Jump Reach Compliance:**
   - Verified jump reach budgets against the game standard (rise ≤ 190 px, gap ≤ 160 px):
     - Floor (935) -> Bath rim (780): rise 155 px (≤ 190).
     - Floor (935) -> Vanity (760): rise 175 px (≤ 190).
     - Bath rim (610) -> Vanity (770): horizontal gap 160 px (≤ 160).
     - Floor (935) -> Step stool (840): rise 95 px (≤ 190).
     - Vanity (1370) -> Step stool (1400): gap 30 px, y diff 80 px (≤ 160).
     - Vanity right end (1370, y 760) -> Linen cupboard shelf (1470, y 620): horizontal gap 100 px, vertical rise 140 px (≤ 160, ≤ 190).
     - Floor (935) -> Laundry basket lid (840): rise 95 px (≤ 190).
   - All jump reaches strictly conform to specifications.

6. **Slanted Ceiling Spider Drop Points:**
   - Slanted ceiling runs from (120, 300) to (900, 110), flat to 1920.
   - Drop points are placed along both the slope (x 260, 480, 700) and flat ceiling (x 960, 1180, 1400, 1620, 1800).
   - `syncStringSpiderAnchors()` computes the precise ceiling height along the slope so string spiders descending on the left hang realistically from the angled ceiling boards.

7. **Makeover Beats:**
   - 3.3 s: `skylight` beat unfolds shutters and casts morning sunbeam across the bath.
   - 3.9 s: `bulbs` beat lights up mirror vanity bulbs sequentially left to right.
   - 4.5 s: `cup` beat rights the fallen toothbrush cup revealing the four brushes and tape marked "A".

---

## Art (2026-10-30, Claude Code)

`art.js` was repainted over Flash's blockout. Flash's starting values for the logic (`createLive`: `steam`, `tapRunning`, the timers) are kept as they were.

### Decisions

- **The mirror's reflected room is the painted room itself.** The room's own back and furniture canvases are drawn through the same transform as the live pass: reversed, ×0.45, centred at (1070, 515). They are then softened with a paint-once blur, darkened and cooled. Built once per state.
  - Because it is the same picture, reversed and small, it reads as a reflection rather than a second room glued on.
- **The skylight lies in the slope.** It is a parallelogram just above the line where the roof meets the wall, not the `layout.window` rectangle. Its sky and its shutters are drawn in `drawProps`, and `drawSky` is empty.
  - The four shutters fold up toward their top hinge one by one at the `skylight` beat, the left one first.
- **Tiles to y 600, as the prompt says.** A salmon-pink field, a two-row pink-and-cream checker band under the black pencil border, and plaster above. The shower surround over the bath is tiled right up to the slope.
- **The curtain is drawn back to the bath's right end,** so the bath and the spiders on its rim stay visible.

### Critique rounds (5 biggest gaps per round)

**Round 1:**
1. The pinks read as grey-mauve. They are now bone warmed with ember, plus a touch of plum.
2. The mirror seen in the reflection was a heavy dark slab. Its painted glass is now a lighter cool gradient.
3. The pencil edges up the shower surround read as black poles. They are now 5 px and umber-black.
4. The black-and-white floor was too harsh. It is now warm dark grey and cream.
5. The bath mat could not be seen. It is now pink.

**Round 2:**
1. The floor tiles read as large checks. The step is now 30 px.
2. In the `mirror` state, the string spider's legs stretched to the top of the glass. That was a QA staging bug, fixed by `engineer` in `room.js`.
3. The steam is a fairly even veil. It is accepted: its wavering blob edge stops it reading as a rectangle.
4. The dirty reflection is dark. That is accepted: the room is dark.
5. The toothbrush cup is behind the hero in `clean`. That is accepted: the `results` card names it, and the cup is clear when the hero moves.

**Round 3:**
1. In `makeover`, the shutters fold and the shaft falls across the bath while the bulbs are still unlit, which is correct for t ≈ 3.9 s. No further gap was big enough to list.

### Traps

- **The mirror pass sets `c._inMirror`** while it draws each critter. The `mirror` QA state's string spider draws only when that flag is set.
- **The reflection is cached per state from `painted.dirty` and `painted.clean`.** If `paint()` changes, the cache is rebuilt the next time the room is opened, not live.
