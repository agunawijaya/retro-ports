// rng.js -- Turbo Pascal 5.0's Random, ported.
//
// The DOS game seeds its LCG from the clock, so its exact stream cannot be
// reproduced without the tick count it ran under. Using its recurrence
// preserves the distribution and the call order, so a run driven by this
// generator visits the same set of decisions the real game visits.
//
// The recurrence is `seed := seed * 134775813 + 1`, and Random(n) is the
// high half of (new_seed * n) as a 32-bit unsigned. random01() returns
// the seed shifted into [0, 1). See tools/render-hunting.py for the
// reference implementation.

const A = 134775813;

export class Rng {
    constructor(seed) {
        this.setSeed(seed);
    }

    setSeed(seed) {
        // Coerce to unsigned 32-bit. If no seed given, pull one from the
        // clock -- same trick TP does.
        if (seed === undefined || seed === null) {
            seed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
        }
        this.seed = seed >>> 0;
    }

    // Random(n) : Integer -- returns 0..n-1.
    nextInt(n) {
        if (n <= 0) return 0;
        // JS numbers lose precision above 2^53, and A * seed can hit 2^62.
        // Do the multiply via BigInt to keep every bit, then mask to 32.
        this.seed = Number((BigInt(this.seed) * BigInt(A) + 1n) & 0xFFFFFFFFn);
        // Random(n) = (seed * n) >> 32.
        return Number((BigInt(this.seed) * BigInt(n)) >> 32n);
    }

    // Random : Real -- 0 <= r < 1.
    random01() {
        this.seed = Number((BigInt(this.seed) * BigInt(A) + 1n) & 0xFFFFFFFFn);
        return this.seed / 0x100000000;
    }

    // Random(n) as a 0..1 draw compared against p, folded into a single
    // call because that is what the game emits for `if Random < p`.
    chance(p) {
        return this.random01() < p;
    }

    // Uniform pick from an array. Handy at call sites that would otherwise
    // repeat `arr[rng.nextInt(arr.length)]`.
    pick(arr) {
        if (!arr.length) return undefined;
        return arr[this.nextInt(arr.length)];
    }
}

// One process-wide RNG. main.js reseeds it via resetGame(seed).
export const rng = new Rng();
