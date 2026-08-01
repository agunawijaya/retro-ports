// =============================================================================
// scoring.js - Final score and high-score table
// =============================================================================
//
// Score formula CONFIRMED at @0x13D3A in the original binary:
//
//      final_score = base_score * (3 - occupation_id)
//
// where occupation_id is 0 (Farmer), 1 (Carpenter) or 2 (Banker).
// Farmers earn the highest multiplier because (per the design intent
// quoted in the game's intro) "more farmers were needed in Oregon".
//
// The composition of base_score is HYPOTHESIS - the full formula was not
// successfully traced. We reconstruct a plausible breakdown that matches
// the player-visible "End of trail" screen of the original.
// =============================================================================

import {
    SEED_HIGH_SCORES,
    STORE_PRICES,
} from './constants.js';


// -----------------------------------------------------------------------------
// calculateFinalScore
// -----------------------------------------------------------------------------

/**
 * Compute the player's score at journey end.
 *
 * Components (all HYPOTHESIS in their per-item weights):
 *   - $ remaining cash:                  1.0  point per dollar
 *   - food remaining (lb):               STORE_PRICES.FOOD points per lb
 *   - ammo remaining (rounds):           STORE_PRICES.AMMO / 50 per round
 *   - oxen:                              STORE_PRICES.OXEN per yoke
 *   - clothing sets:                     STORE_PRICES.CLOTHING per set
 *   - spare parts (any of three):        STORE_PRICES.WHEEL per unit
 *   - surviving party members:           500 each
 *
 * Sum is multiplied by (3 - occupation_id) per the CONFIRMED formula.
 *
 * @param {GameState} state
 * @returns {{base:number, multiplier:number, total:number, breakdown:object}}
 */
export function calculateFinalScore(state) {
    const s = state.supplies;
    const survivors = state.countAlive();

    const breakdown = {
        cash:        Math.round(s.cash),
        food:        Math.round(s.food * STORE_PRICES.FOOD),
        ammo:        Math.round(s.ammunition * (STORE_PRICES.AMMO / 50)),
        oxen:        s.oxen * STORE_PRICES.OXEN,
        clothing:    s.clothingSets * STORE_PRICES.CLOTHING,
        spareParts:  (s.spareWheels + s.spareAxles + s.spareTongues) * STORE_PRICES.WHEEL,
        survivors:   survivors * 500,
    };

    const base = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const multiplier = state.occupation.scoreMultiplier;
    const total = base * multiplier;

    return { base, multiplier, total, breakdown };
}


// -----------------------------------------------------------------------------
// High-score table (localStorage-backed)
// -----------------------------------------------------------------------------
//
// Stored as JSON under key 'oregonTrailHighScores'. On first run we seed
// it with SEED_HIGH_SCORES so the table is never empty.

const HISCORE_KEY = 'oregonTrailHighScores';
const MAX_SLOTS = 10;


/**
 * Returns the current high-score array, seeding it if empty.
 * Result is always sorted descending by score and trimmed to 10 slots.
 */
export function loadHighScores() {
    let raw;
    try { raw = localStorage.getItem(HISCORE_KEY); } catch (_) { raw = null; }

    let scores;
    if (raw) {
        try { scores = JSON.parse(raw); } catch (_) { scores = null; }
    }
    if (!Array.isArray(scores) || scores.length === 0) {
        scores = [...SEED_HIGH_SCORES];
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, MAX_SLOTS);
}


/**
 * If `score` qualifies for the top 10, splice it in and persist. Returns
 * the rank (1-indexed) of the new entry, or -1 if it did not qualify.
 */
export function checkHighScore(score, name) {
    const table = loadHighScores();
    const insertAt = table.findIndex((row) => score > row.score);
    if (insertAt === -1 && table.length >= MAX_SLOTS) return -1;

    const entry = { name, score };
    if (insertAt === -1) {
        table.push(entry);
    } else {
        table.splice(insertAt, 0, entry);
    }
    const trimmed = table.slice(0, MAX_SLOTS);

    try {
        localStorage.setItem(HISCORE_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.warn('Failed to save high scores:', err);
    }

    return (insertAt === -1 ? table.length : insertAt + 1);
}
