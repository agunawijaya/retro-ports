# Prompt 03 — Fix 1 (2026-10-29)

- **Jumper leap readability (`lib/spider-types/jumper.js`, `rooms/kitchen/room.js`):** Redrew the 3 trailing motion ghosts in dark spider body/sheen tones (`alpha 0.35, 0.22, 0.12`), enlarged and darkened the tabletop radial shadow ellipse (`alpha 0.42–0.58`), and extended the 11 chalk telegraph dots (`flightTimeToLand()`) ahead to the landing point.
- **Map score line wrapping (`lib/house-map.js`, `tools/checks.mjs`):** Wrapped `best <score> · untouched` onto two lines in narrow rooms like the 250 px Kitchen so text stays inside the room walls and clear of the `CLEAN` stamp; added a bounding-box check for every `<text>` element on the map.
- **Hatchling 4-way scatter (`lib/room-runtime.js`, `lib/spiders.js`):** Added `fanPresets` so the 4 floor hatchlings fan out along distinct diagonal pitches (`±0.52..0.62`) and vertical floor lanes (`±35..37 px`) without clumping; retimed strip panel 3 to `t = 0.5 s`.
- **Front Porch makeover HUD capture:** Confirmed the dimmed HUD in `03-polish.jpg` cell 5 was a capture-timing artefact (`#hud` 0.5 s opacity transition when staging `makeover` first) and re-shot after the transition settled.
- **Checks:** `checks.mjs` 37/37 passed; `flowtest.mjs` 53/53 passed (34 normal storage, 19 blocked storage); 0 console/page errors.
- **Verdict:** approved.
