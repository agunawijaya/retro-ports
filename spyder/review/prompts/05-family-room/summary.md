# Prompt 05 — Room 3: the Family Room (2026-10-29)

- **Room 3 built (`game/rooms/family-room/room.js`):** Intimate 1980s family room with 48 px beveled wood panelling, brick chimney breast, hearth slab, corduroy recliner with dust sheet, built-in bookshelf with VHS tapes and games, and a console TV with rabbit-ear antenna.
- **Lighting & Ambiance:** CRT static noise with 2× surges every 3–6 s revealing wall crawlers in corners; 9 soft-edged striped moonlight shafts through crooked venetian blinds with illuminated dust motes; breathing ember glow; and makeover-activated picture light and table lamp.
- **Unique makeover beat:** At t = 3.3 s embers flare and fire catches across logs over 1.2 s (layered flame tongues, rising sparks, burning fireplace web), and at t = 4.6 s CRT static vertically rolls into the story object: a 5-frame looping sepia home movie of a waving child on a beach.
- **Platforms & Reaches:** All 6 platforms (Floor y 935, Armchair y 790, Mantel y 600, TV stand y 780, TV top y 600, Bookshelf top y 430) verified reachable within jump limits (max rise 190 px, max gap 140 px).
- **Key decisions:** Carved TV bezel screen aperture using `destination-out` in `paintFurniture` to let dynamic `drawProps` CRT static/movie render beneath frame; offset makeover hero to x = 980 to keep hearth in full view; retained sticky note warning on TV as cleaner trace.
- **Runtime requests:** Request for built-in aperture punch-out helper in `room-runtime` for live animated prop displays behind furniture; request for configurable makeover capture timestamp `setup('makeover', { t })`.
- **Console errors & stability:** Zero page or console errors across all test passes and QA setups.
- **Performance:** `action` mean 1.91 ms (p95 2.50 ms); `makeover` mean 2.19 ms (p95 2.60 ms) — well within the ≤ 8 ms frame budget.
- **Flow & checks:** `flowtest.mjs` passed 53/53, verifying full house sequence (`front-porch` → `living-room` → `family-room` → `kitchen` → `dining-room`), results card story object, and map state persistence.
- **Audit:** `node review.mjs audit` passed with 0 stray images.
- **Gallery & sheet:** Rebuilt review gallery with `node review.mjs gallery` and generated 6-cell contact sheet (`sheet.jpg`).

**Claude Code review:** fix needed — complete and playable, but the painting is below the reference: flat wall and floor (no visible parquet), a flat orange rug, flames drawn as hard yellow triangles, and a dirty frame too dark to read; the striped moonlight does not reach the floor. The results card wraps "Play again" when "Next room" shows (a shell bug). Built with Gemini 3.8 Flash High, because the Argon quota was used up. See prompts/05-family-room-fix-1.md.
