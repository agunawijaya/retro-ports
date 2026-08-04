// state.js -- game state, health as a badness Real, and the strain formula
// from docs/03.
//
// Party health in the DOS binary is a single 6-byte Real at DS:0x1886
// -- one number for the whole party, not one per member. Higher means
// worse. Members die individually via a casualty routine at 0x134D6
// that takes odds computed from that shared health value.
//
// We keep the number and the update rule; per-member state is kept
// only for name, alive-flag, and current illness (which is what the
// game does -- see docs/03 on the eleven-byte member records).

import { rng } from './rng.js';
import {
    OCCUPATION,
    PACE,
    RATION,
    ILLNESS,
    PARTY_SIZE,
    DEFAULT_PARTY_NAMES,
    START_YEAR,
    DEPARTURE_MONTHS,
    MONTH_NAMES,
    DAYS_PER_MONTH,
    HEALTH_START,
    HEALTH_STRAIN_THRESHOLD,
    HEALTH_BADNESS_INCREMENT,
    HEALTH_DECAY,
    CASUALTY_SEVERITY_DIVISOR,
    HEALTH_BANDS,
    HAZARD_DECAY,
    HAZARD_REFILL_HIGH,
    HAZARD_REFILL_LOW,
    HAZARD_REFILL_HIGH_P,
    HAZARD_NEAR_LANDMARK_DAYS,
} from './constants.js';


// -----------------------------------------------------------------------------
// PartyMember
// -----------------------------------------------------------------------------
//
// The binary's member record is `string[10]` -- name only. Health lives
// on the group. We keep an alive flag and an optional current illness
// per member so the log can name someone.

export class PartyMember {
    constructor(name, slot) {
        this.name = name;
        this.slot = slot;
        this.isAlive = true;
        this.currentIllness = null;      // reference into ILLNESS
        this.illnessDaysLeft = 0;
        this.causeOfDeath = null;
    }

    applyIllness(illness) {
        this.currentIllness = illness;
        // No W2 recovery table in the binary; illness lasts until the
        // casualty routine picks the member or a rest-recovery routine
        // clears the flag. We use a 3..8 day countdown as a stand-in.
        this.illnessDaysLeft = 3 + rng.nextInt(6);
    }

    recoverDay() {
        if (!this.currentIllness) return;
        this.illnessDaysLeft -= 1;
        if (this.illnessDaysLeft <= 0) {
            this.currentIllness = null;
            this.illnessDaysLeft = 0;
        }
    }

    die(cause) {
        this.isAlive = false;
        this.causeOfDeath = cause;
        this.currentIllness = null;
        this.illnessDaysLeft = 0;
    }
}


// -----------------------------------------------------------------------------
// Supplies
// -----------------------------------------------------------------------------

export class Supplies {
    constructor(startingCash) {
        this.food = 0;
        this.ammunition = 0;       // rounds, not boxes
        this.clothingSets = 0;
        this.oxen = 0;             // in oxen (2 per yoke)
        this.spareWheels = 0;
        this.spareAxles = 0;
        this.spareTongues = 0;
        this.cash = startingCash;
    }

    spareParts() {
        return this.spareWheels + this.spareAxles + this.spareTongues;
    }

    // Pounds per person per day is set from RATION.poundsPerPersonPerDay.
    consumeDaily(aliveCount, rationSetting) {
        const need = aliveCount * rationSetting.poundsPerPersonPerDay;
        if (this.food >= need) {
            this.food -= need;
            return true;
        }
        this.food = 0;
        return false;
    }

    canAfford(unitPrice, quantity) {
        return this.cash >= unitPrice * quantity;
    }

    buy(itemKey, quantity, unitPrice) {
        const total = unitPrice * quantity;
        this.cash -= total;
        switch (itemKey) {
            case 'OXEN':     this.oxen         += quantity * 2; break;
            case 'FOOD':     this.food         += quantity;     break;
            case 'AMMO':     this.ammunition   += quantity * 20; break;  // 20 rounds/box
            case 'CLOTHING': this.clothingSets += quantity; break;
            case 'WHEEL':    this.spareWheels  += quantity; break;
            case 'AXLE':     this.spareAxles   += quantity; break;
            case 'TONGUE':   this.spareTongues += quantity; break;
            default: throw new Error(`Supplies.buy: unknown item ${itemKey}`);
        }
    }
}


// -----------------------------------------------------------------------------
// PHASE
// -----------------------------------------------------------------------------

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


// -----------------------------------------------------------------------------
// GameState
// -----------------------------------------------------------------------------

export class GameState {
    constructor() {
        this.occupation = OCCUPATION.FARMER;
        this.departureMonth = DEPARTURE_MONTHS[0];  // March

        this.pace = PACE.STEADY;
        this.ration = RATION.FILLING;

        this.currentDay = 1;
        this.currentMonth = this.departureMonth.monthIndex;
        this.currentYear = START_YEAR;

        this.totalMiles = 0;
        this.currentLandmarkIndex = 0;

        this.party = DEFAULT_PARTY_NAMES.map((n, i) => new PartyMember(n, i));
        this.supplies = new Supplies(this.occupation.startingCash);

        this.phase = PHASE.TITLE;

        // Health as a badness Real -- lower is better.
        // Update: docs/03 0x14055, `if strain > 0.5 or food = 0
        //   then h := h + 0.2 else h := h x 0.5`.
        this.health = HEALTH_START;

        // Hazard level. Docs/03: `[0x1867] := 0.97 * [0x1867] + [0x19AE]`,
        // where the refill is only non-zero within 2 days of a landmark.
        this.hazard = 0;
        this.daysSinceLandmark = 0;

        // Weather string used for the status row.
        this.weather = 'fair';

        this.canvasLocked = false;
        this.justArrivedAtLandmark = false;
        // Set by the fork prompt in arriveAtLandmark to override the
        // default `.next` on the current landmark.
        this.nextIndexOverride = null;

        this.messages = [];
        this.highScores = null;
        this.landmarks = null;   // main.js sets this from LANDMARKS
    }

    applySetup({ occupation, departureMonth, partyNames }) {
        this.occupation = occupation;
        this.departureMonth = departureMonth;
        this.currentMonth = departureMonth.monthIndex;
        this.currentDay = 1;
        this.currentYear = START_YEAR;
        this.supplies = new Supplies(occupation.startingCash);

        this.party = [];
        for (let i = 0; i < PARTY_SIZE; i++) {
            const nm = partyNames[i] || DEFAULT_PARTY_NAMES[i];
            this.party.push(new PartyMember(nm, i));
        }

        this.health = HEALTH_START;
        this.hazard = 0;
        this.daysSinceLandmark = 0;
    }

    addMessage(text) {
        this.messages.push({ ts: this._formattedDate(), text });
        if (this.messages.length > 200) this.messages.shift();
    }

    countAlive() {
        return this.party.filter((p) => p.isAlive).length;
    }

    // ------------------------------------------------------------------
    // The strain-and-health update, from docs/03.
    // ------------------------------------------------------------------

    // strain = max(0, alive/oxen - (5 - 2*conditions))
    // "conditions" is the terrain state; we approximate it as 0 on the
    // plains (legs 0..4), 1 mid-trail, 2 in the mountains from Green
    // River onwards.
    computeStrain() {
        const alive = this.countAlive();
        if (alive === 0) return 0;
        const oxen = Math.max(1, this.supplies.oxen);   // 0 would divide by zero; caller will kill wagon separately
        const conditions = this.currentLandmarkIndex >= 9 ? 2
                          : this.currentLandmarkIndex >= 5 ? 1
                          : 0;
        const raw = (alive / oxen) - (5 - 2 * conditions);
        return Math.max(0, raw);
    }

    updateHealth(foodRanOut) {
        const strain = this.computeStrain();
        if (strain > HEALTH_STRAIN_THRESHOLD || foodRanOut) {
            this.health += HEALTH_BADNESS_INCREMENT;
        } else {
            this.health *= HEALTH_DECAY;
        }
    }

    // Casualty odds from docs/03:
    //     p = (health - 2.5) / (severity * 10)     for illness/accident
    //     p = (health - 3.0) / (severity * 10)     the second call-site variant
    // The routine loops n-1..1 (or 0 if n==1), so the leader (slot 0) is
    // spared. Only integer arithmetic prevents negative odds -- we clamp.
    rollCasualties(severity, includeLeader = false) {
        const n = this.party.length;
        const start = n - 1;
        const stop = (n > 1 && !includeLeader) ? 1 : 0;
        const denom = severity * CASUALTY_SEVERITY_DIVISOR;
        const p = Math.max(0, (this.health - 2.5) / denom);
        for (let i = start; i >= stop; i--) {
            const m = this.party[i];
            if (!m.isAlive) continue;
            if (rng.chance(p)) {
                const cause = m.currentIllness
                    ? `died of ${m.currentIllness.name}`
                    : 'died of exhaustion';
                m.die(cause);
                this.addMessage(`${m.name} ${cause}.`);
            }
        }
    }

    // Hazard evolves per day. Within HAZARD_NEAR_LANDMARK_DAYS of a
    // landmark the refill fires; further out it decays only.
    updateHazard() {
        let refill = 0;
        if (this.daysSinceLandmark < HAZARD_NEAR_LANDMARK_DAYS) {
            refill = rng.chance(HAZARD_REFILL_HIGH_P)
                ? HAZARD_REFILL_HIGH
                : HAZARD_REFILL_LOW;
        }
        this.hazard = HAZARD_DECAY * this.hazard + refill;
        this.daysSinceLandmark += 1;
    }

    // ------------------------------------------------------------------

    healthLabel() {
        for (const b of HEALTH_BANDS) {
            if (this.health <= b.max) return b.label;
        }
        return 'very poor';
    }

    scorePerSurvivor() {
        for (const b of HEALTH_BANDS) {
            if (this.health <= b.max) return b.scorePerSurvivor;
        }
        return 200;
    }

    milesToNextLandmark() {
        if (!this.landmarks) return null;
        const next = this.landmarks[this.currentLandmarkIndex + 1];
        if (!next) return 0;
        return Math.max(0, next.miles - this.totalMiles);
    }

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
        return `${MONTH_NAMES[this.currentMonth]} ${this.currentDay}, ${this.currentYear}`;
    }

    // ------------------------------------------------------------------
    // Save / load
    // ------------------------------------------------------------------

    save() {
        const snapshot = {
            occupationId: this.occupation.id,
            departureMonthId: this.departureMonth.id,
            paceId: this.pace.id,
            rationId: this.ration.id,
            currentDay: this.currentDay,
            currentMonth: this.currentMonth,
            currentYear: this.currentYear,
            totalMiles: this.totalMiles,
            currentLandmarkIndex: this.currentLandmarkIndex,
            health: this.health,
            hazard: this.hazard,
            daysSinceLandmark: this.daysSinceLandmark,
            weather: this.weather,
            phase: this.phase,
            party: this.party.map((p) => ({
                name: p.name, slot: p.slot, isAlive: p.isAlive,
                currentIllnessId: p.currentIllness ? p.currentIllness.id : null,
                illnessDaysLeft: p.illnessDaysLeft,
                causeOfDeath: p.causeOfDeath,
            })),
            supplies: { ...this.supplies },
        };
        try {
            localStorage.setItem('oregonTrailSave', JSON.stringify(snapshot));
            return true;
        } catch (err) {
            console.warn('Failed to save game:', err);
            return false;
        }
    }

    static load() {
        const raw = localStorage.getItem('oregonTrailSave');
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            const state = new GameState();
            state.occupation = Object.values(OCCUPATION).find((o) => o.id === data.occupationId);
            state.departureMonth = DEPARTURE_MONTHS.find((m) => m.id === data.departureMonthId);
            state.pace = Object.values(PACE).find((p) => p.id === data.paceId);
            state.ration = Object.values(RATION).find((r) => r.id === data.rationId);
            state.currentDay = data.currentDay;
            state.currentMonth = data.currentMonth;
            state.currentYear = data.currentYear;
            state.totalMiles = data.totalMiles;
            state.currentLandmarkIndex = data.currentLandmarkIndex;
            state.health = data.health || 0;
            state.hazard = data.hazard || 0;
            state.daysSinceLandmark = data.daysSinceLandmark || 0;
            state.weather = data.weather || 'fair';
            state.phase = data.phase;
            state.party = data.party.map((p) => {
                const m = new PartyMember(p.name, p.slot);
                m.isAlive = p.isAlive;
                m.causeOfDeath = p.causeOfDeath;
                m.illnessDaysLeft = p.illnessDaysLeft;
                if (p.currentIllnessId !== null) {
                    m.currentIllness = ILLNESS.find((ill) => ill.id === p.currentIllnessId) || null;
                }
                return m;
            });
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
