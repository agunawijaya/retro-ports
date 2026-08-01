// =============================================================================
// state.js - Game state classes
// =============================================================================
//
// In the original Turbo Pascal codebase, the "state" was a handful of global
// variables plus a couple of `record` types (PartyMember, Supplies). For the
// JS rebuild we wrap them in proper ES6 classes - this is the single biggest
// stylistic departure from the 1990 source, and a good teaching example of
// how the same logic looks when expressed in modern OOP terms.
//
// The three classes:
//
//   PartyMember  - one of the five settlers. Tracks health and illness.
//   Supplies     - everything in the wagon: food, ammo, oxen, spare parts, cash.
//   GameState    - umbrella state: party, supplies, calendar, phase, flags.
//
// We deliberately keep all logic inside methods (no free functions for daily
// updates) so the data-flow is easy to follow when reading top-down.
// =============================================================================

import {
    HEALTH_MAX,
    HEALTH_BANDS,
    OCCUPATION,
    DIFFICULTY,
    PACE,
    RATION,
    PARTY_SIZE,
    DEFAULT_PARTY_NAMES,
    START_YEAR,
    DEPARTURE_MONTHS,
    MONTH_NAMES,
    DAYS_PER_MONTH,
    SEGMENT_BOUNDARIES_MILES,
} from './constants.js';


// =============================================================================
// PartyMember
// =============================================================================

export class PartyMember {
    /**
     * @param {string} name
     * @param {number} slot  0..4 - position in the party array
     */
    constructor(name, slot) {
        this.name = name;
        this.slot = slot;
        this.health = HEALTH_MAX;       // 0..100, dropping over time
        this.isAlive = true;

        // currentIllness is either null or a reference to an ILLNESS entry.
        // illnessDaysLeft counts down each day from the illness w2 value.
        this.currentIllness = null;
        this.illnessDaysLeft = 0;

        // Cause-of-death string is set when die() is called and is shown in
        // the gravestone screen.
        this.causeOfDeath = null;
    }

    /**
     * Apply per-day health attrition based on pace and rations.
     *
     * The original game's algorithm (CONFIRMED in spirit, exact math
     * HYPOTHESIS):
     *   - Steady + Filling = baseline (very slow drain)
     *   - Each pace step harder       = +1 drain/day
     *   - Each ration step skimpier   = +1 drain/day
     *   - Ongoing illness adds the illness w3 / 10 each day
     *
     * The 10x scale on w3 reflects that w3 in the binary is a fixed-point
     * value (about 32-109 across the table), but expressing it directly
     * would kill a settler in one day. Dividing by 10 produces realistic
     * decline curves while keeping the relative magnitudes between
     * illnesses (typhoid hits harder than exhaustion).
     */
    applyDailyHealthUpdate(pace, ration) {
        if (!this.isAlive) return;

        let drain = 0;

        // Pace contribution: rest = 0, steady = 0, strenuous = 1, grueling = 2
        // (REST has the same id index as TRAIL_GUIDE in some lookups, but
        // hoursPerDay = 0 means no mileage drain. The PACE id for rest is 3
        // in our constants, which is harmless here.)
        if (pace === PACE.STRENUOUS) drain += 1;
        if (pace === PACE.GRUELING)  drain += 2;
        if (pace === PACE.REST)      drain -= 1;   // resting heals slightly

        // Ration contribution
        if (ration === RATION.MEAGER)     drain += 1;
        if (ration === RATION.BARE_BONES) drain += 2;

        // Illness contribution
        if (this.currentIllness) {
            drain += Math.floor(this.currentIllness.w3 / 10);
        }

        this.health -= drain;

        if (this.health <= 0) {
            this.health = 0;
            this.die(this.currentIllness
                ? `died of ${this.currentIllness.name}`
                : 'died of exhaustion');
        } else if (this.health > HEALTH_MAX) {
            // Cap healing at max.
            this.health = HEALTH_MAX;
        }
    }

    /**
     * Begin an illness. Sets the recovery countdown to the illness w2.
     */
    applyIllness(illness) {
        this.currentIllness = illness;
        this.illnessDaysLeft = illness.w2;
    }

    /**
     * Tick the illness countdown. When it reaches zero the member
     * recovers (unless they have died of it in the meantime).
     */
    recoverDay() {
        if (!this.currentIllness) return;
        this.illnessDaysLeft -= 1;
        if (this.illnessDaysLeft <= 0) {
            this.currentIllness = null;
            this.illnessDaysLeft = 0;
        }
    }

    /**
     * Mark this member dead with the given cause text.
     */
    die(cause) {
        this.isAlive = false;
        this.health = 0;
        this.causeOfDeath = cause;
        this.currentIllness = null;
        this.illnessDaysLeft = 0;
    }

    /**
     * Player-facing description of current health. Used by the renderer's
     * status overlay and by the "check status" menu.
     */
    healthLabel() {
        if (!this.isAlive) return 'dead';
        for (const band of HEALTH_BANDS) {
            if (this.health >= band.min) return band.label;
        }
        return 'near death';
    }
}


// =============================================================================
// Supplies
// =============================================================================

export class Supplies {
    constructor(startingCash) {
        // Quantities at the start of a fresh game. The store visit (Matt's
        // General Store) is where the player turns starting cash into
        // food / oxen / ammo / spare parts.
        this.food = 0;             // pounds
        this.ammunition = 0;       // rounds (NOT boxes - 1 box = 50 rounds)
        this.clothingSets = 0;
        this.oxen = 0;             // yokes (each yoke = 2 oxen historically)
        this.spareWheels = 0;
        this.spareAxles = 0;
        this.spareTongues = 0;
        this.cash = startingCash;
    }

    /**
     * Consume food for the day. Each ration setting multiplies the per-day
     * pounds by the number of alive party members.
     *
     * Returns true if there was enough food; false if the party ran out
     * (in which case food is clamped to 0 and the caller should apply a
     * "no food" health penalty).
     */
    consumeDaily(aliveCount, rationSetting) {
        const need = aliveCount * rationSetting.poundsPerPersonPerDay;
        if (this.food >= need) {
            this.food -= need;
            return true;
        }
        this.food = 0;
        return false;
    }

    /**
     * Returns true if the player can afford `quantity` of an item at the
     * given unit price.
     */
    canAfford(unitPrice, quantity) {
        return this.cash >= unitPrice * quantity;
    }

    /**
     * Deduct cash and credit the appropriate field. The `itemKey` matches
     * the keys in STORE_PRICES (OXEN, FOOD, AMMO, ...).
     *
     * For AMMO the quantity is in BOXES (50 rounds each); we expand to
     * round count internally so the rest of the game sees raw rounds.
     */
    buy(itemKey, quantity, unitPrice) {
        const total = unitPrice * quantity;
        this.cash -= total;
        switch (itemKey) {
            case 'OXEN':     this.oxen         += quantity; break;
            case 'FOOD':     this.food         += quantity; break;
            case 'AMMO':     this.ammunition   += quantity * 50; break;
            case 'CLOTHING': this.clothingSets += quantity; break;
            case 'WHEEL':    this.spareWheels  += quantity; break;
            case 'AXLE':     this.spareAxles   += quantity; break;
            case 'TONGUE':   this.spareTongues += quantity; break;
            default:
                throw new Error(`Supplies.buy: unknown item ${itemKey}`);
        }
    }
}


// =============================================================================
// GameState
// =============================================================================

// Phase machine. The original game used a big switch on an integer; here
// we use strings because they read clearly in the console and survive
// minification.
export const PHASE = Object.freeze({
    TITLE:      'TITLE',
    SETUP:      'SETUP',
    STORE:      'STORE',
    TRAVELLING: 'TRAVELLING',
    LANDMARK:   'LANDMARK',
    HUNTING:    'HUNTING',
    RIVER:      'RIVER',
    GAMEOVER:   'GAMEOVER',
    WIN:        'WIN',
});


export class GameState {
    constructor() {
        // Setup choices - defaulted; real values come from the setup flow.
        this.occupation = OCCUPATION.FARMER;
        this.difficulty = DIFFICULTY.ADVENTURER;
        this.departureMonth = DEPARTURE_MONTHS[0];  // March

        // Live travel controls
        this.pace = PACE.STEADY;
        this.ration = RATION.FILLING;

        // Calendar - the trail almost always begins in March-July 1848.
        this.currentDay = 1;
        this.currentMonth = this.departureMonth.monthIndex;
        this.currentYear = START_YEAR;

        // Geography
        this.totalMiles = 0;
        this.currentLandmarkIndex = 0;

        // Party - 5 PartyMember instances
        this.party = DEFAULT_PARTY_NAMES.map((name, i) => new PartyMember(name, i));

        // Supplies
        this.supplies = new Supplies(this.occupation.startingCash);

        // Phase
        this.phase = PHASE.TITLE;

        // Weather string - set by event system per day
        this.weather = 'cool';

        // FIX 4 (map / modal screens): when set, the bootstrap-level
        // rAF animation loop in main.js skips its periodic repaint so
        // a modal canvas (map, supplies, landmark scene) is not
        // overdrawn. Cleared by the menu code once the player has
        // dismissed the modal.
        this.canvasLocked = false;

        // FIX 4 (daily-menu landmark vs scenery): true exactly for the
        // single daily-menu iteration that follows arriving at a new
        // landmark. While true the daily-menu backdrop shows the
        // landmark scene; once cleared (by advanceOneDay) it switches
        // back to the generic travel scenery.
        this.justArrivedAtLandmark = false;

        // Message log entries shown in the DOM panel.
        this.messages = [];

        // High score table - lazily initialised from localStorage in main.js.
        this.highScores = null;

        // Cached reference to the LANDMARKS array. We do not import here
        // because that would cause a circular dependency with trail.js;
        // main.js sets this after construction.
        this.landmarks = null;
    }

    /**
     * Apply the new setup choices and re-derive dependent state.
     * Called when the player completes the setup flow.
     */
    applySetup({ occupation, difficulty, departureMonth, partyNames }) {
        this.occupation = occupation;
        this.difficulty = difficulty;
        this.departureMonth = departureMonth;
        this.currentMonth = departureMonth.monthIndex;
        this.currentDay = 1;
        this.currentYear = START_YEAR;
        this.supplies = new Supplies(occupation.startingCash);

        // Replace party. Slot 0 is the player; slots 1..4 are companions.
        this.party = [];
        for (let i = 0; i < PARTY_SIZE; i++) {
            const nm = partyNames[i] || DEFAULT_PARTY_NAMES[i];
            this.party.push(new PartyMember(nm, i));
        }
    }

    /**
     * Push a message into the in-game log. The UI subscribes via render
     * and shows the most recent ones in #message-log.
     */
    addMessage(text) {
        this.messages.push({
            ts: this._formattedDate(),
            text,
        });
        // Cap log length - older entries fall off the front.
        if (this.messages.length > 200) {
            this.messages.shift();
        }
    }

    /**
     * Returns the count of alive party members. Recreates the binary
     * function originally at @0x13045, which was just a loop counting
     * !record.dead. The win condition checks this == 0.
     */
    countAlive() {
        return this.party.filter((p) => p.isAlive).length;
    }

    /**
     * Aggregate label for party health (best of, worst of, average).
     * The original game showed the worst member's label as the "party"
     * label, mirroring the way you intuit a group's wellness by its
     * weakest link.
     */
    partyHealthLabel() {
        const alive = this.party.filter((p) => p.isAlive);
        if (alive.length === 0) return 'all dead';
        // Lowest health drives the label.
        const worst = alive.reduce((a, b) => (a.health < b.health ? a : b));
        return worst.healthLabel();
    }

    /**
     * Mileage to the next landmark we have not yet reached.
     */
    milesToNextLandmark() {
        if (!this.landmarks) return null;
        const next = this.landmarks[this.currentLandmarkIndex + 1];
        if (!next) return 0;
        return Math.max(0, next.miles - this.totalMiles);
    }

    /**
     * Current trail segment id 0..3 - used by the event table to look up
     * thresholds. Boundaries: SEGMENT_BOUNDARIES_MILES from constants.
     */
    currentSegment() {
        for (let i = 0; i < SEGMENT_BOUNDARIES_MILES.length; i++) {
            if (this.totalMiles < SEGMENT_BOUNDARIES_MILES[i]) return i;
        }
        return SEGMENT_BOUNDARIES_MILES.length - 1;
    }

    /**
     * Advance the calendar by one day. Handles month-end and year-end
     * roll-over using DAYS_PER_MONTH.
     */
    advanceCalendar() {
        this.currentDay += 1;
        if (this.currentDay > DAYS_PER_MONTH[this.currentMonth]) {
            this.currentDay = 1;
            this.currentMonth += 1;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear += 1;
            }
        }
    }

    _formattedDate() {
        const m = MONTH_NAMES[this.currentMonth];
        return `${m} ${this.currentDay}, ${this.currentYear}`;
    }

    // -----------------------------------------------------------------
    // Persistence
    // -----------------------------------------------------------------
    //
    // We store the minimal data needed to reconstruct the run. We do NOT
    // serialise references back into OCCUPATION / DIFFICULTY etc - we
    // store their ids and look them back up on load.

    save() {
        const snapshot = {
            occupationId: this.occupation.id,
            difficultyId: this.difficulty.id,
            departureMonthId: this.departureMonth.id,
            paceId: this.pace.id,
            rationId: this.ration.id,
            currentDay: this.currentDay,
            currentMonth: this.currentMonth,
            currentYear: this.currentYear,
            totalMiles: this.totalMiles,
            currentLandmarkIndex: this.currentLandmarkIndex,
            party: this.party.map((p) => ({
                name: p.name, slot: p.slot, health: p.health, isAlive: p.isAlive,
                currentIllnessId: p.currentIllness ? p.currentIllness.id : null,
                illnessDaysLeft: p.illnessDaysLeft,
                causeOfDeath: p.causeOfDeath,
            })),
            supplies: { ...this.supplies },
            phase: this.phase,
            weather: this.weather,
        };
        try {
            localStorage.setItem('oregonTrailSave', JSON.stringify(snapshot));
            return true;
        } catch (err) {
            console.warn('Failed to save game:', err);
            return false;
        }
    }

    /**
     * Static factory: hydrate a GameState from localStorage, or return
     * null if no save exists. We import ILLNESS lazily here to avoid a
     * cyclic import with events.js.
     */
    static load(illnessTable) {
        const raw = localStorage.getItem('oregonTrailSave');
        if (!raw) return null;

        try {
            const data = JSON.parse(raw);
            const state = new GameState();

            // Look up the constants by id.
            state.occupation = Object.values(OCCUPATION).find((o) => o.id === data.occupationId);
            state.difficulty = Object.values(DIFFICULTY).find((d) => d.id === data.difficultyId);
            state.departureMonth = DEPARTURE_MONTHS.find((m) => m.id === data.departureMonthId);
            state.pace = Object.values(PACE).find((p) => p.id === data.paceId);
            state.ration = Object.values(RATION).find((r) => r.id === data.rationId);

            state.currentDay = data.currentDay;
            state.currentMonth = data.currentMonth;
            state.currentYear = data.currentYear;
            state.totalMiles = data.totalMiles;
            state.currentLandmarkIndex = data.currentLandmarkIndex;
            state.phase = data.phase;
            state.weather = data.weather;

            // Rebuild party
            state.party = data.party.map((p) => {
                const m = new PartyMember(p.name, p.slot);
                m.health = p.health;
                m.isAlive = p.isAlive;
                m.causeOfDeath = p.causeOfDeath;
                m.illnessDaysLeft = p.illnessDaysLeft;
                if (p.currentIllnessId !== null && illnessTable) {
                    m.currentIllness = illnessTable.find((ill) => ill.id === p.currentIllnessId) || null;
                }
                return m;
            });

            // Rebuild supplies (Object.assign rather than reconstruct from
            // cash so we keep all fields.)
            const s = new Supplies(0);
            Object.assign(s, data.supplies);
            state.supplies = s;

            return state;
        } catch (err) {
            console.warn('Failed to load game:', err);
            return null;
        }
    }
}
