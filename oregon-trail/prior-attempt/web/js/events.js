// =============================================================================
// events.js - Daily event rolls and illness handling
// =============================================================================
//
// The daily event system is the heart of Oregon Trail's drama. Each travel
// day the game performs:
//
//   1. Roll one event (illness, weather, wagon damage, positive, or none).
//   2. Apply the event's mechanical effect (subtract food, change weather,
//      pick a member to fall sick, etc.).
//   3. Update each party member's health based on pace, ration, and any
//      ongoing illness.
//   4. Recover illness countdowns.
//
// We keep all of that here so the daily loop in main.js is a short series
// of calls into well-named methods. The actual roll mechanism uses
// Math.random() seeded from Date.now(); the original game used the timer
// interrupt (INT 1Ch @ 18.2 Hz) as its entropy source, but the player-
// visible distribution is what matters - both are uniform.
// =============================================================================

import {
    EVENT_TABLE,
    ILLNESS,
    ILLNESS_TOTAL_WEIGHT,
} from './constants.js';


// -----------------------------------------------------------------------------
// Weather strings - rotated through to make the daily report feel alive.
// -----------------------------------------------------------------------------

const WEATHER_OPTIONS = [
    'cool',
    'warm',
    'hot',
    'cold',
    'very cold',
    'rainy',
    'very rainy',
    'snowy',
];


// -----------------------------------------------------------------------------
// Positive event templates - each returns a small in-game gift.
// -----------------------------------------------------------------------------

const POSITIVE_EVENTS = [
    { text: 'You found some wild berries! (+15 lb food)',  effect: (s) => { s.supplies.food += 15; } },
    { text: 'You found wild fruit. (+10 lb food)',         effect: (s) => { s.supplies.food += 10; } },
    { text: 'A friendly trader gave you ammunition. (+25)', effect: (s) => { s.supplies.ammunition += 25; } },
    { text: 'You found abandoned supplies. (+$10)',        effect: (s) => { s.supplies.cash += 10; } },
    { text: 'Helpful Indians showed you a shortcut.',      effect: (s) => { s.totalMiles += 15; } },
];


// -----------------------------------------------------------------------------
// Damage event templates - each consumes a spare part or money.
// -----------------------------------------------------------------------------

const DAMAGE_EVENTS = [
    {
        text: 'A wagon wheel broke!',
        effect: (s) => {
            if (s.supplies.spareWheels > 0) s.supplies.spareWheels -= 1;
            else s.supplies.food = Math.max(0, s.supplies.food - 20);
        },
    },
    {
        text: 'A wagon axle broke!',
        effect: (s) => {
            if (s.supplies.spareAxles > 0) s.supplies.spareAxles -= 1;
            else s.supplies.food = Math.max(0, s.supplies.food - 25);
        },
    },
    {
        text: 'A wagon tongue broke!',
        effect: (s) => {
            if (s.supplies.spareTongues > 0) s.supplies.spareTongues -= 1;
            else s.supplies.food = Math.max(0, s.supplies.food - 25);
        },
    },
    {
        text: 'An ox died.',
        effect: (s) => { if (s.supplies.oxen > 0) s.supplies.oxen -= 1; },
    },
    {
        text: 'Bandits attacked - you lost supplies.',
        effect: (s) => {
            s.supplies.food = Math.max(0, s.supplies.food - 30);
            s.supplies.ammunition = Math.max(0, s.supplies.ammunition - 20);
        },
    },
];


// -----------------------------------------------------------------------------
// Weather event templates - mostly cosmetic, but extreme weather drains
// health on all members.
// -----------------------------------------------------------------------------

const WEATHER_EVENTS = [
    { text: 'A heavy thunderstorm slowed your progress.', weather: 'rainy',
      healthDelta: -1 },
    { text: 'Heavy fog forced you to rest.',              weather: 'rainy',
      healthDelta:  0 },
    { text: 'A blizzard struck the wagon train!',         weather: 'snowy',
      healthDelta: -5 },
    { text: 'It is very hot today.',                      weather: 'hot',
      healthDelta: -1 },
    { text: 'A cold front swept in.',                     weather: 'cold',
      healthDelta: -2 },
];


// =============================================================================
// EventSystem
// =============================================================================

export class EventSystem {
    /**
     * @param {() => number} rng  optional injectable RNG (returns 0..1).
     *                            Defaults to Math.random; tests can pass
     *                            a deterministic generator.
     */
    constructor(rng = Math.random) {
        this.rng = rng;
    }

    // -----------------------------------------------------------------
    // The daily roll
    // -----------------------------------------------------------------

    /**
     * Returns an event descriptor:
     *   { type: 'illness' | 'weather' | 'damage' | 'positive' | 'none',
     *     detail: object | string }
     *
     * The detail format is type-specific (see applyEvent below).
     *
     * Difficulty scales the roll: at Trail Guide (1.4x) events are MORE
     * common because the raw roll is multiplied; at Greenhorn (0.7x)
     * events are rarer.
     */
    rollDailyEvent(gameState) {
        const segment = gameState.currentSegment();
        const row = EVENT_TABLE[segment];

        // Roll 0..99, then divide by difficulty scale so a harder
        // difficulty effectively shifts the roll lower (more likely to
        // beat thresholds).
        const rawRoll = this.rng() * 100;
        const roll = rawRoll / gameState.difficulty.eventScale;

        if (roll < row.illnessThreshold) {
            return { type: 'illness', detail: this.chooseIllness() };
        }
        if (roll < row.weatherThreshold) {
            const idx = Math.floor(this.rng() * WEATHER_EVENTS.length);
            return { type: 'weather', detail: WEATHER_EVENTS[idx] };
        }
        if (roll < row.damageThreshold) {
            const idx = Math.floor(this.rng() * DAMAGE_EVENTS.length);
            return { type: 'damage', detail: DAMAGE_EVENTS[idx] };
        }
        if (roll < row.positiveThreshold) {
            const idx = Math.floor(this.rng() * POSITIVE_EVENTS.length);
            return { type: 'positive', detail: POSITIVE_EVENTS[idx] };
        }

        // Otherwise: nothing happened today. We still cycle weather though.
        return { type: 'none', detail: null };
    }

    /**
     * Weighted pick from ILLNESS using W0 as weight. Total weight is
     * pre-summed in ILLNESS_TOTAL_WEIGHT. Skips entries with W0 = 0
     * (those are reserved for explicit triggers like river crossings).
     */
    chooseIllness() {
        const r = this.rng() * ILLNESS_TOTAL_WEIGHT;
        let cum = 0;
        for (const ill of ILLNESS) {
            cum += ill.w0;
            if (r < cum) return ill;
        }
        // Fallback - never expected to fire, but safer than returning
        // undefined.
        return ILLNESS[0];
    }

    // -----------------------------------------------------------------
    // Applying events
    // -----------------------------------------------------------------

    /**
     * Apply the event's effects to gameState and push a message into the
     * log. Returns the message string for callers that want it.
     */
    applyEvent(event, gameState) {
        let message = '';

        switch (event.type) {
            case 'illness': {
                // Pick a random alive party member to fall sick.
                const alive = gameState.party.filter((p) => p.isAlive && !p.currentIllness);
                if (alive.length === 0) break;
                const victim = alive[Math.floor(this.rng() * alive.length)];
                victim.applyIllness(event.detail);
                message = `${victim.name} has ${event.detail.name}.`;
                break;
            }

            case 'weather': {
                gameState.weather = event.detail.weather;
                const delta = event.detail.healthDelta;
                if (delta !== 0) {
                    for (const p of gameState.party) {
                        if (p.isAlive) {
                            p.health = Math.max(0, p.health + delta);
                            if (p.health <= 0) p.die('died from harsh weather');
                        }
                    }
                }
                message = event.detail.text;
                break;
            }

            case 'damage': {
                event.detail.effect(gameState);
                message = event.detail.text;
                break;
            }

            case 'positive': {
                event.detail.effect(gameState);
                message = event.detail.text;
                break;
            }

            case 'none':
            default: {
                // Light cosmetic weather shift so the status panel changes.
                if (this.rng() < 0.2) {
                    gameState.weather = WEATHER_OPTIONS[
                        Math.floor(this.rng() * WEATHER_OPTIONS.length)
                    ];
                }
                break;
            }
        }

        if (message) gameState.addMessage(message);
        return message;
    }

    // -----------------------------------------------------------------
    // Per-day housekeeping (called by main.js after applyEvent)
    // -----------------------------------------------------------------

    /**
     * For every alive sick member, decrement illness countdown and
     * announce recovery. Then apply pace/ration health attrition. Then
     * announce deaths that happened during this update.
     */
    tickPartyHealth(gameState) {
        for (const p of gameState.party) {
            if (!p.isAlive) continue;

            const wasSick = !!p.currentIllness;
            p.recoverDay();
            if (wasSick && !p.currentIllness) {
                gameState.addMessage(`${p.name} has recovered.`);
            }

            p.applyDailyHealthUpdate(gameState.pace, gameState.ration);

            if (!p.isAlive) {
                gameState.addMessage(`${p.name} has ${p.causeOfDeath}.`);
            }
        }
    }

    /**
     * Consume daily food. If the party runs out, every alive member loses
     * 5 HP (the famous starvation penalty).
     */
    tickFood(gameState) {
        const alive = gameState.countAlive();
        if (alive === 0) return;
        const ok = gameState.supplies.consumeDaily(alive, gameState.ration);
        if (!ok) {
            gameState.addMessage('You have run out of food!');
            for (const p of gameState.party) {
                if (p.isAlive) {
                    p.health = Math.max(0, p.health - 5);
                    if (p.health <= 0) p.die('died of starvation');
                }
            }
        }
    }
}
