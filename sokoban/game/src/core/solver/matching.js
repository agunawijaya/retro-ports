/**
 * @file Hungarian algorithm (Kuhn-Munkres) for minimum weight bipartite matching.
 * Used for heuristic calculation: finding the minimum push distance assignment
 * between objects and targets.
 */

/**
 * Computes the minimum weight bipartite matching for an N x M cost matrix.
 * Assumes N <= M and all costs are non-negative.
 *
 * @param {number[][]} costMatrix Matrix of costs where costMatrix[i][j] is the cost of assigning object i to target j.
 * @returns {number} Minimum total matching cost
 */
export function minWeightBipartiteMatching(costMatrix) {
  const n = costMatrix.length;
  if (n === 0) return 0;
  const m = costMatrix[0].length;
  if (m === 0) return 0;

  // u: potentials for rows (1-indexed), v: potentials for cols (1-indexed)
  // p: matching for cols (p[j] = row matched to col j)
  // way: tracks the path for augmenting
  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1);
  const way = new Int32Array(m + 1);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(Infinity);
    const used = new Uint8Array(m + 1);

    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j++) {
        if (!used[j]) {
          const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  return -v[0];
}
