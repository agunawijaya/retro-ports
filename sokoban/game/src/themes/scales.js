/**
 * @file Musical scales for themes (ART-DIRECTION §7.4, §7.6).
 *
 * All themes use D major pentatonic except Candi, which uses Javanese slendro tuning.
 */

export const D4 = 293.66;

// D major pentatonic: no pair can clash, so any lighting order sounds right.
export const PENTATONIC = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0, 987.77];

// Slendro ratios from ART-DIRECTION §7.4 over two octaves from D4
export const SLENDRO_RATIOS = [1, 1.149, 1.320, 1.516, 1.741];

export const SLENDRO = [
  ...SLENDRO_RATIOS.map((r) => Number((D4 * r).toFixed(2))),
  ...SLENDRO_RATIOS.map((r) => Number((D4 * 2 * r).toFixed(2))),
];
