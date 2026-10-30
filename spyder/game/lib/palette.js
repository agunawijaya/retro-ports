/*
 * Spyder — the palette.
 *
 * Rule of thumb that holds the whole look together: surfaces are muted and
 * dusty, and saturation only ever comes from light. If a new room needs a
 * colour that is not here, mix it from these rather than inventing a fresh hex.
 */
(function () {
  'use strict';

  const Spyder = window.Spyder;

  Spyder.palette = {
    // Surfaces: the "dust" family
    soot: '#16120F', // deepest shadow, never pure black
    umber: '#2B2420', // base of every dark surface
    walnut: '#3E3128', // furniture wood in shadow
    oak: '#6B5240', // furniture wood in light
    taupe: '#5A524A', // warm grey, plaster and fabric
    linen: '#C9B8A0', // dusty cream, paper and highlights
    bone: '#E8DCC6', // brightest surface tone allowed

    // Fabric accents (used sparingly, always desaturated)
    moss: '#4F5A42', // sofa velvet
    plum: '#4A3640', // curtains
    rust: '#7A4A33', // rug, old leather

    // Light: the only saturated colours in the game
    amber: '#F2A54A', // lamp light
    ember: '#E07A3C', // lamp core, flame
    moon: '#7FA3C7', // night window light
    dawn: '#FFC98A', // morning light after the makeover
    sky: '#9EC3E0', // clean-room daylight sky

    // Creatures and gameplay
    spiderBody: '#1E1A1C',
    spiderSheen: '#6E5F72', // rim highlight on chitin
    spiderMark: '#B9A27A', // pale chevrons on the abdomen
    spiderEye: '#FF6A3D', // glint, reads instantly as "alive"
    eggSac: '#D9CDB2',
    goo: '#8C8A4B', // hit splatter, muted olive not neon green
    silk: '#E9E4D8',

    // Hero (The Exterminator)
    jumpsuit: '#F07F2E',
    jumpsuitShade: '#B4521F',
    skin: '#F1C6A0',
    skinShade: '#C98F6E',
    gear: '#46505A',
    brass: '#C49A55',
  };

  // Light recipes per room state. The lighting system reads these, the
  // makeover blends from `dirty` to `clean`.
  Spyder.moods = {
    dirty: {
      ambient: '#584D5E', // what an unlit surface multiplies with
      grade: '#2B2234', // colour pushed into the shadows at the end
      gradeAlpha: 0.16,
      saturation: 0.82,
      windowSkyTop: '#141B2C',
      windowSkyBottom: '#2B3A55',
      rayColor: '#7FA3C7',
    },
    clean: {
      ambient: '#B9AA9C',
      grade: '#FFB870',
      gradeAlpha: 0.08,
      saturation: 1.0,
      windowSkyTop: '#8DB6DA',
      windowSkyBottom: '#FFD7A8',
      rayColor: '#FFC98A',
    },
  };
})();
