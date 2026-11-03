/**
 * @file Web Worker wrapping the Sokoban solver for in-browser solution searching.
 */

import { parseLevel } from '../level.js';
import { solve } from './solver.js';

self.onmessage = function (event) {
  const data = event.data || {};
  const { rows, budget = 20000, weight = 1, maxNodes = 6000000 } = data;

  if (!rows || !Array.isArray(rows)) {
    self.postMessage({ failed: true, reason: 'invalid_rows' });
    return;
  }

  try {
    const level = parseLevel(rows);

    const result = solve(level, {
      weight,
      maxNodes,
      maxTimeMs: budget,
      onProgress(tick) {
        self.postMessage({
          type: 'progress',
          ...tick,
        });
      },
    });

    if (result.solved) {
      self.postMessage({
        lurd: result.lurd,
        steps: result.steps,
        pushes: result.pushes,
        weight: result.weight,
        nodes: result.nodes,
        ms: result.ms,
      });
    } else {
      self.postMessage({
        failed: true,
        reason: result.reason,
        nodes: result.nodes,
        ms: result.ms,
      });
    }
  } catch (err) {
    self.postMessage({
      failed: true,
      error: err.message,
    });
  }
};
