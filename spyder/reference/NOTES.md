# Reference scene — QA notes

How the reference frames were reached. This is the loop every room has to go through (ART-DIRECTION.md §15); these notes show what a round looks like.

## Round 1 — first full render

| # | Finding | Fix |
|---|---|---|
| 1 | Hero's face hidden behind the blaster when aiming up; hose crossing the face | Pivot moves forward with upward aim, head drawn over the blaster when aiming steeply, hose routed round the hip; hero scaled ×1.25 |
| 2 | Curtains rendered as black slabs | Bug: an `rgba()` string was fed into `shade()`. Added hex-returning helpers (`mixHex`, `shadeHex`) and repainted the curtains with visible folds and a lit inner edge |
| 3 | Chandelier collided with the portrait | Chandelier raised and narrowed, portrait lowered |
| 4 | Lamp cones had hard stage-light edges on the wall | Softer stacked cones, a floor pool, weaker upward spill |
| 5 | Throw blanket floated in mid-air | Redrawn as a drape over the arm with a fringed hem |
| 6 | Spiders too small to feel creepy | String ×1.0, crawler ×1.15, thicker femurs, bigger abdomen |
| 7 | Start card key list cramped, results stamp over the title | Ruled 4-column key strip; stamp moved off the card corner |

## Round 2

| # | Finding | Fix |
|---|---|---|
| 1 | Score plate covered the chandelier | Plate made single-line and moved up |
| 2 | "Vacuum Blaster" wrapped on the tag | Wider tag, no wrap |
| 3 | Makeover sweep too subtle to read as a moment | The wave carries its own light, brighter leading edge, more dust and sparkles |
| 4 | Peeling wallpaper read as a dark hanging object | Smaller, paler, moved out of the centre |

## Round 3 — performance

| # | Finding | Fix |
|---|---|---|
| 1 | Per-frame blur filters (webs, spider shadows, light cones, beams) | Replaced with stacked shapes; blur kept only for cached layers |
| 2 | One stroke call per silk strand | Webs batched into `Path2D` (3 per web), glints in 4 brightness buckets |
| 3 | Window grime blurred every frame | Painted once and cached |

Result: ≈ 3× faster on the CPU path, ≈ 9 ms/frame with GPU canvas in headless testing. Play test: spawns, tearing, scoring, pause/resume and the makeover → results flow all pass with no console errors.
