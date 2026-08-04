// scoring.js -- final score, from the game's own explanation screen at
// 0x00C166 (docs/03).
//
//   wagon 50, ox 4, spare part 2, clothing 2,
//   1 point per 50 bullets, per 25 lb of food, per $5,
//   person = 500 / 400 / 300 / 200 by health band,
//   x1 banker, x2 carpenter, x3 farmer.

import {
    SEED_HIGH_SCORES,
    SCORE_WEIGHTS,
} from './constants.js';


export function calculateFinalScore(state) {
    const s = state.supplies;
    const survivors = state.countAlive();
    const perSurvivor = state.scorePerSurvivor();

    const breakdown = {
        wagon:      SCORE_WEIGHTS.wagon,
        oxen:       s.oxen        * SCORE_WEIGHTS.ox,
        spareParts: s.spareParts() * SCORE_WEIGHTS.sparePart,
        clothing:   s.clothingSets * SCORE_WEIGHTS.clothing,
        bullets:    Math.floor(s.ammunition / SCORE_WEIGHTS.bulletsPer),
        food:       Math.floor(s.food       / SCORE_WEIGHTS.foodPer),
        cash:       Math.floor(s.cash       / SCORE_WEIGHTS.dollarsPer),
        survivors:  survivors * perSurvivor,
    };

    const base = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const multiplier = state.occupation.scoreMultiplier;
    const total = base * multiplier;

    return { base, multiplier, total, breakdown, healthLabel: state.healthLabel() };
}


const HISCORE_KEY = 'oregonTrailHighScores';
const MAX_SLOTS = 10;

export function loadHighScores() {
    let raw;
    try { raw = localStorage.getItem(HISCORE_KEY); } catch (_) { raw = null; }
    let scores;
    if (raw) { try { scores = JSON.parse(raw); } catch (_) { scores = null; } }
    if (!Array.isArray(scores) || scores.length === 0) scores = [...SEED_HIGH_SCORES];
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, MAX_SLOTS);
}

export function checkHighScore(score, name) {
    const table = loadHighScores();
    const insertAt = table.findIndex((row) => score > row.score);
    if (insertAt === -1 && table.length >= MAX_SLOTS) return -1;

    const entry = { name, score };
    if (insertAt === -1) table.push(entry);
    else table.splice(insertAt, 0, entry);
    const trimmed = table.slice(0, MAX_SLOTS);

    try { localStorage.setItem(HISCORE_KEY, JSON.stringify(trimmed)); }
    catch (err) { console.warn('Failed to save high scores:', err); }

    return (insertAt === -1 ? table.length : insertAt + 1);
}
