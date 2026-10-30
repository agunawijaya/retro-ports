# Prompt 06 — fix 1: Dining Room painting and story object (2026-10-29)

*Done by Claude Code directly, for the same reason as 05-fix-1.*

- **Dirty frame:** moonlight now bounces off the floor and the tablecloth, and a little light reaches the cabinet. Table, chairs, portraits, plates and cabinet can all be told apart, while the room stays cold and dark.
- **Wall:** the clean wall is now a muted sage, mixed from `moss`, `taupe` and `linen`. The damask is embossed (a shadow pass and a lit pass) with acanthus leaves either side.
- **Wall details:** two oval family portraits in gilt frames (the left one crooked when dirty) and a cross-stitched "Bless this table" sampler. The upper wall is no longer an empty field.
- **Chairs:** carved backs with stiles, finials and an arched crest rail. Behind the table they are upholstered and buttoned; in front, they show a vase splat with a pierced heart. All have contact shadows.
- **Tablecloth:** soft draped folds, and a lace hem when clean.
- **Plates on the rail:** a rim, a transfer band and a highlight.
- **Story object:**
  - The place cards were drawn *behind* the furniture layer, so the tablecloth hid them. They now stand on the table and can be read: Arthur, Eleanor, Thomas, a red "A.", Beatrice, Julian.
  - The "A." card has a little light of its own, and its chair is the one pushed all the way in.
  - The cards now rise on their own beat (from 4.4 s); before, they appeared as soon as the dawn did.
  - The hero stands clear of them in the clean frame.
- **Candles:** soft three-layer flames. At t ≈ 3.9 s the left candles are lit and the right ones are not yet.
- **Per-frame blur removed:** plates, place cards and the chandelier's brass used to call `paintShape`, which blurs, on every frame. They are now painted once into cached sprites per state (ART-DIRECTION §6).
- **Runtime:** a new optional hook, `drawOnFurniture(ctx, live, t, mk)`, is drawn right after the furniture layer, for moving things that sit on furniture. The Living Room doesn't use it, and its canvas is unchanged.
- **Checks:** `checks.mjs` 37/37, `flowtest.mjs` 53/53, audit clean.
- **Frame time:** `action` mean 2.43 ms, p95 3.30 ms; `makeover` mean 1.25 ms, p95 2.20 ms.
- **Regression:** the Living Room matches the reference in every state except `action`, where one hatchling is a few pixels off, by at most 73 levels. That difference comes from 03-polish-fix-1, which changed how hatchlings scatter in `game/lib/spiders.js` but, as its prompt required, not in `reference/`. It is not from this fix.

**Claude Code review:** approved. The dirty frame is readable, the wall is muted, the furniture is painted, and the "A." place card can be read and is noticed.
