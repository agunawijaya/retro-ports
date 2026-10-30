# Prompt 03 — Polish (2026-10-29)

- **Egg sacs & hatchlings (`lib/spiders.js`, `lib/room-runtime.js`, `reference/`):** Redrew `EggSac` as a wobbly teardrop with radial shading, crossing silk strands, 16 internal eggs, progressive bulge/top tear, 2 s torn-husk fade on hatch, and 4 staggered hatchlings scattering individually.
- **Makeover sweep (`lib/room-runtime.js`, `reference/scene.js`):** Replaced strip-blending with complementary 280 px `smoothstep` gradient masks on offscreen canvases (`destination-in` + `lighter`) and a 520 px soft sweep swell so clean props never show ahead of the wave.
- **Kitchen & Jumper (`rooms/kitchen/room.js`, `lib/spider-types/jumper.js`):** Removed the upper wall fridge cone to eliminate the cold band right of the fridge; added Jumper trajectory telegraph dots, full 8-leg airborne splay, 3 trailing motion ghosts, and surface shadow.
- **House map & runtime services (`lib/house-map.js`, `lib/room-registry.js`, `lib/spider-rig.js`):** Replaced `best 0` with `cleared`, added corner collision test for `CLEAN` stamps (`placeStamp`), implemented all 8 runtime requests (`css: true`, unique spawn seeds, `hatch({ count, speed })`, `placeHero`, `setScore`, `mk.t` in `restored`, `glow` shift, `legReach`/`legFemur`), and removed room workarounds.
- **Checks:** `regress.mjs` canvas-identical to synced `reference/`; `flowtest.mjs` 53/53 passed; `checks.mjs` 36/36 passed; `perf.mjs` mean 3.11 ms (`action`) and 2.64 ms (`makeover`).
- **Verdict:** approved (with 4 sheet follow-ups resolved in `03-polish-fix-1`).
