// events.js -- fifteen Bernoulli slots dispatched daily, per PROMPT-PORT.md
// and dispatcher at 0x2BD7.
//
// Every day: walk EVENT_SLOTS in order, each is an independent Bernoulli
// trial. The first slot whose trial fires becomes "today's event" and
// the rest are skipped (that is what setting [0x188D] does in the game).
//
// The probability of most slots is scaled by the hazard level -- see
// state.js updateHazard(). The two slots whose p is CONFIRMED (0.05
// rough trail, 0.15 wild fruit) are treated as their own baseline
// times a hazard factor for damage-kind slots and a flat number for
// the positive slot.

import {
    EVENT_SLOTS,
    ILLNESS,
} from './constants.js';
import { rng } from './rng.js';

// rng imported above; also needed inside _rollIllnessCasualties (same file).


// Damage-flavoured slots scale up with the hazard level; positive slots
// are steady. The scale is HYPOTHESIS -- the exact function was not
// traced. The hazard variable grows in the DOS code with a decay of
// 0.97 and refills bounded above by 8; a soft cap here keeps daily
// event odds sane during long bad stretches.
function hazardScale(kind, hazard) {
    if (kind === 'positive') return 1;
    const capped = Math.min(Math.max(0, hazard), 5);
    return 1 + capped * 0.5;   // hazard 5 -> 3.5x, hazard 0 -> 1x
}


export class EventSystem {
    // rollOnce runs one full daily dispatch and returns the fired event
    // (or null if none fired). Order matters -- the first hit wins.
    rollOnce(gameState) {
        for (const slot of EVENT_SLOTS) {
            const p = slot.p * hazardScale(slot.kind, gameState.hazard);
            if (rng.chance(p)) return slot;
        }
        return null;
    }

    apply(slot, gameState) {
        if (!slot) return null;

        if (slot.kind === 'illness') {
            // Pick a healthy alive member. Leader (slot 0) can still
            // fall ill in the game.
            const candidates = gameState.party.filter((p) => p.isAlive && !p.currentIllness);
            if (candidates.length === 0) return null;
            const victim = candidates[rng.nextInt(candidates.length)];
            // Random(6) at 0x013BC0 -- flat six-way die.
            const illness = slot.illnessId != null
                ? ILLNESS[slot.illnessId]
                : ILLNESS[rng.nextInt(6)];
            victim.applyIllness(illness);
            const msg = `${victim.name} has ${illness.name}.`;
            gameState.addMessage(msg);
            return { name: slot.name, message: msg, illness };
        }

        // Non-illness slots apply their own effect closure and log the
        // slot name.
        if (typeof slot.apply === 'function') slot.apply(gameState);
        const msg = capitalise(slot.name) + '.';
        gameState.addMessage(msg);
        return { name: slot.name, message: msg };
    }

    // Called by main.js per travel day, after mileage has been added.
    daily(gameState) {
        gameState.updateHazard();
        const fired = this.rollOnce(gameState);
        return this.apply(fired, gameState);
    }

    // Food consumption -- separate from event roll so save/load and self-
    // test can call it independently.
    tickFood(gameState) {
        const alive = gameState.countAlive();
        if (alive === 0) return { ok: true, ranOut: false };
        const ok = gameState.supplies.consumeDaily(alive, gameState.ration);
        if (!ok) gameState.addMessage('You have run out of food!');
        return { ok, ranOut: !ok };
    }

    // Health step -- per tools/model.pas OneDay (lines 273-283):
    //   for i := PartySize downto 2 do
    //     if Party[i].Alive and (Random < p) then die
    // where p = (health - 2.5) / (severity * 10) at severity 1.
    // At healthy state p is negative -> nobody dies. Once health climbs
    // above 2.5, deaths become possible. Model.pas skips party member 1
    // (the leader) -- so does gameState.rollCasualties.
    tickHealth(gameState, foodRanOut) {
        gameState.updateHealth(foodRanOut);
        for (const p of gameState.party) {
            if (!p.isAlive) continue;
            const wasSick = !!p.currentIllness;
            p.recoverDay();
            if (wasSick && !p.currentIllness) {
                gameState.addMessage(`${p.name} has recovered.`);
            }
        }
        gameState.rollCasualties(1);
    }
}


function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
