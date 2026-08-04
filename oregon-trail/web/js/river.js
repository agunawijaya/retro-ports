// river.js -- rivers unit (segment 0x042D), read from oregon.asm.
//
// Every literal here has an image address beside it. Read the .asm and
// this file side by side; each block corresponds to one procedure in
// the DOS binary. See the caller trace below the constants.

import { rng } from './rng.js';


// --- Real literals decoded from the .asm ------------------------------
const FORD_SAFE_DEPTH        = 2.5;    // 0x045CE  82 00 00 00 00 20
const CAULK_SAFE_DEPTH       = 2.5;    // 0x049F4  same literal
const CAULK_MIN_DEPTH        = 1.5;    // 0x04971  81 00 00 00 00 40
const FORD_MUD_P_NUM         = 0.4;    // 0x0460B  7F CD CC CC CC 4C
const FORD_OVERTURN_P_NUM    = 0.16;   // 0x0469A  7E 71 3D 0A D7 23
const OVERTURN_LOSS_FACTOR   = 0.3;    // 0x046DD  7F 99 9A 99 99 19
const FERRY_MIN_DEPTH        = 2.5;    // 0x04CC3
const FERRY_COST_DOLLARS     = 5;      // 0x04DCE  83 00 00 00 00 20
const FERRY_LOOSE_5_10       = 0.05;   // 0x04EDC  7C CD CC CC CC 4C
const FERRY_LOOSE_OVER_10    = 0.10;   // 0x04F09  7D CD CC CC CC 4C
const FERRY_SHALLOW_TIP      = 5.0;    // 0x04ECD  83 00 00 00 00 20 (== $5 too)
const FERRY_DEEP_TIP         = 10.0;   // 0x04EFA  84 00 00 00 00 20

// Severity dispatch, from the two callers of proc_04587 (the ford
// handler) at 0x05302 and 0x05E3B:
//   auto-branch (game decides): severity 5    -> mild odds
//   player choice from menu:    severity 1    -> the odds you signed up for
const SEVERITY_PLAYER = 1;
const SEVERITY_AUTO   = 5;   // reserved for future auto-cross paths


export class RiverCrossing {
    constructor(riverName, fordType, baseDepthFt = 4) {
        this.riverName = riverName;
        this.fordType = fordType;        // 0/1/2/other -- from LANDMARKS[].fordType
        this.baseDepthFt = baseDepthFt;
    }

    // Depth: baseDepthFt +/- 30%, floored at 0.5. The distribution used
    // by proc_042D0 depends on per-river data at [DS:0x0038 + i*10 +
    // 0x32] which we have not fully unpacked; this jitter is the
    // stand-in and shows up as a Real in the game too.
    getDepth() {
        const jitter = (rng.random01() * 0.6) - 0.3;
        return Math.max(0.5, +(this.baseDepthFt * (1 + jitter)).toFixed(1));
    }

    // --- the dispatcher (proc_05B4C in the unit) ---------------------
    // The DOS menu has FIVE options (image 0x05E22..0x05EA5):
    //   1  ford         -> proc_04587 with severity=1
    //   2  caulk-float  -> proc_04956 with severity=1
    //   3  ferry OR Shoshoni guide (per-river flag)
    //   4  wait for conditions (if 3 was available); else info
    //   5  info
    async run(gameState, ui) {
        let depth = this.getDepth();
        const widthFt = 300 + rng.nextInt(600);

        gameState.addMessage(
            `${this.riverName}: ${widthFt} feet across, ${depth} feet deep.`,
        );
        ui.renderMessageLog();
        ui.renderer.drawRiverCrossing({ name: this.riverName, widthFt, depth });

        // Whether ferry / guide is offered depends on flags the DOS
        // caller sets from a per-river record we have not fully traced.
        // Approximation: ferry at every river; Shoshoni at legs beyond
        // Fort Bridger (where the game's own text puts them).
        const hasFerry = true;
        const hasGuide = true;

        while (true) {
            const options = ['Attempt to ford the river',
                             'Caulk the wagon and float across'];
            if (hasFerry && hasGuide)      options.push('Take the ferry across', 'Get help from a Shoshoni guide');
            else if (hasFerry)             options.push('Take the ferry across');
            else if (hasGuide)             options.push('Get help from a Shoshoni guide');
            options.push('Wait to see if conditions improve');
            options.push('Get more information');

            const idx = await ui._menu(
                `${this.riverName} - ${widthFt} ft wide, ${depth} ft deep. What will you do?`,
                options,
            );
            const label = options[idx];
            let done = false;
            if (label.startsWith('Attempt to ford')) {
                done = await this.ford(depth, gameState, ui, SEVERITY_PLAYER);
            } else if (label.startsWith('Caulk')) {
                done = await this.caulk(depth, gameState, ui, SEVERITY_PLAYER);
            } else if (label.startsWith('Take the ferry')) {
                const r = await this.ferry(depth, gameState, ui);
                if (r.depthChanged) depth = r.depth;
                done = r.done;
            } else if (label.startsWith('Get help from a Shoshoni')) {
                const r = await this.shoshoniGuide(depth, gameState, ui);
                done = r.done;
            } else if (label.startsWith('Wait')) {
                gameState.currentDay += 1;
                depth = this.getDepth();
                await ui.showMessage(
                    `You camp near the river for a day. The river is now ${depth} feet deep.`,
                );
            } else {
                await this.showInfo(ui);
            }
            if (done) return;
        }
    }

    // --- ford (proc_04587, image 0x0458E) ----------------------------
    async ford(depth, gameState, ui, severity) {
        if (depth > FORD_SAFE_DEPTH) {
            await this._heavyLoss(gameState, ui,
                'The river is too deep to ford.  You lose:');
            return true;
        }
        // Dispatch on ford type from DS:[i*10+0x38]:
        //   0 -> safe crossing (0x045EF jump to 0x048C7)
        //   1 -> mud check, p = 0.4 / severity (0x045F7)
        //   2 -> overturn check, p = 0.16 / severity (0x0466C)
        //   other -> "supplies got wet" heavy loss (0x04788)
        const t = this.fordType;
        if (t === 0) {
            await ui.showMessage('You made the crossing successfully.');
            return true;
        }
        if (t === 1) {
            const p = Math.min(1, FORD_MUD_P_NUM / severity);
            if (rng.chance(p)) {
                gameState.currentDay += 1;
                await ui.showMessage('You become stuck in the mud.  Lose 1 day.');
            } else {
                await ui.showMessage(
                    'It was a muddy crossing, but you did not get stuck.',
                );
            }
            return true;
        }
        if (t === 2) {
            const p = Math.min(1, FORD_OVERTURN_P_NUM / severity);
            if (rng.chance(p)) {
                await this._overturn(gameState, ui);
            } else {
                await ui.showMessage(
                    'It was a rough crossing, but you did not overturn.',
                );
            }
            return true;
        }
        // Default: heavy loss path (0x04788). Applies at Green River,
        // Snake River (fordType 8 and 26 respectively -- not 0/1/2).
        gameState.currentDay += 1;
        await this._heavyLoss(gameState, ui, 'Your supplies got wet.  Lose 1 day.');
        return true;
    }

    // "The wagon tipped over" (0x046C0). Loss = Random x 0.3 (0x046DD).
    async _overturn(gameState, ui) {
        const factor = rng.random01() * OVERTURN_LOSS_FACTOR;
        const lostFood = Math.floor(gameState.supplies.food * factor);
        const lostAmmo = Math.floor(gameState.supplies.ammunition * factor);
        gameState.supplies.food -= lostFood;
        gameState.supplies.ammunition -= lostAmmo;
        await ui.showMessage(
            `The wagon tipped over.  You lose ${lostFood} lb food, ${lostAmmo} rounds.`,
        );
    }

    // --- caulk and float (proc_04956) --------------------------------
    async caulk(depth, gameState, ui, severity) {
        if (depth < CAULK_MIN_DEPTH) {
            await ui.showMessage('The river is too shallow to float across.');
            return false;
        }
        if (depth <= CAULK_SAFE_DEPTH) {
            await ui.showMessage('You had no trouble floating the wagon across.');
            return true;
        }
        // Deep-float tip check at 0x04A00-0x04AD5.
        const numerator = severity * 20;
        const denom = Math.max(1, (depth - CAULK_SAFE_DEPTH + 0.4) * 15);
        const p = Math.min(0.9, numerator / denom);
        if (rng.chance(p)) {
            await this._overturn(gameState, ui);
            gameState.addMessage('The wagon tipped over while floating.');
        } else {
            await ui.showMessage('You had no trouble floating the wagon across.');
        }
        return true;
    }

    // --- ferry (proc_04CA8) ------------------------------------------
    async ferry(depth, gameState, ui) {
        if (depth < FERRY_MIN_DEPTH) {
            await ui.showMessage(
                'The ferry is not operating today because the river is too shallow.',
            );
            return { done: false, depthChanged: false, depth };
        }
        const waitDays = rng.nextInt(5) + 2;    // 2..6 (0x04CFF + 0x04D04)
        const accept = await ui._menu(
            `The ferry operator says that he will charge you $${FERRY_COST_DOLLARS}.00 ` +
            `and that you will have to wait ${waitDays} days. Are you willing to do this?`,
            ['Yes', 'No'],
        );
        if (accept !== 0) return { done: false, depthChanged: false, depth };
        if (gameState.supplies.cash < FERRY_COST_DOLLARS) {
            await ui.showMessage('You do not have enough money to pay for the ferry.');
            return { done: false, depthChanged: false, depth };
        }
        gameState.supplies.cash -= FERRY_COST_DOLLARS;
        gameState.currentDay += waitDays;
        const newDepth = this.getDepth();   // proc_042D0 re-invoked at 0x04EAC
        await ui.showMessage(
            `You wait ${waitDays} days. The river is now ${newDepth} feet deep.`,
        );
        // Outcome roll (0x04EDA..0x04F26): threshold from depth band.
        let p = 0;
        if (newDepth > FERRY_DEEP_TIP)         p = FERRY_LOOSE_OVER_10;
        else if (newDepth > FERRY_SHALLOW_TIP) p = FERRY_LOOSE_5_10;
        if (rng.chance(p)) {
            await ui.showMessage('The ferry broke loose from moorings.  You lose:');
            await this._heavyLoss(gameState, ui, null);
        } else {
            await ui.showMessage('The ferry got your party and wagon safely across.');
        }
        return { done: true, depthChanged: true, depth: newDepth };
    }

    // --- Shoshoni guide (proc_050DD) ---------------------------------
    // Cost: Random(2) + 2 = 2..4 sets of clothing (0x050E4-0x050ED).
    // Success: guide always gets you across. Ford OR float depending
    // on depth (0x0523D-0x05242: depth < 2.5 -> ford, else float).
    // Severity for the auto-branch is 5 (from caller pattern at 0x05302).
    async shoshoniGuide(depth, gameState, ui) {
        const asked = rng.nextInt(2) + 2;   // 2..4
        if (gameState.supplies.clothingSets < asked) {
            await ui.showMessage(
                `A Shoshoni guide offers help in exchange for ${asked} sets of clothing. ` +
                `You don't have ${asked} sets of clothing.`,
            );
            return { done: false };
        }
        const accept = await ui._menu(
            `A Shoshoni guide says that he will take your wagon across the river in ` +
            `exchange for ${asked} sets of clothing.\nWill you accept this offer?`,
            ['Yes', 'No'],
        );
        if (accept !== 0) return { done: false };
        gameState.supplies.clothingSets -= asked;
        const mode = depth < FORD_SAFE_DEPTH ? 'ford the river.' : 'float your wagon across.';
        await ui.showMessage(`The Shoshoni guide will help you ${mode}`);
        // Run the crossing at severity=5 (much safer).
        if (depth < FORD_SAFE_DEPTH) {
            await this.ford(depth, gameState, ui, SEVERITY_AUTO);
        } else {
            await this.caulk(depth, gameState, ui, SEVERITY_AUTO);
        }
        return { done: true };
    }

    // --- info (proc_05510) ------------------------------------------
    async showInfo(ui) {
        await ui.showMessage(
            'To ford a river means to pull your wagon across a shallow part of ' +
            'the river, with the oxen still attached.\n\n' +
            'To caulk the wagon means to seal it so that no water can get in. ' +
            'The wagon can then be floated across like a boat.\n\n' +
            'To use a ferry means to put your wagon on top of a flat boat that ' +
            'belongs to someone else. The owner of the ferry will take your ' +
            'wagon across the river.',
        );
    }

    // Heavy-loss path (0x04788..0x048C7 and 0x04F47+). The DOS message
    // formats losses as "severity*10 / depth" of each supply category.
    async _heavyLoss(gameState, ui, headline) {
        const factor = 0.3 + rng.random01() * 0.3;
        const lostFood = Math.floor(gameState.supplies.food * factor);
        const lostAmmo = Math.floor(gameState.supplies.ammunition * factor);
        gameState.supplies.food -= lostFood;
        gameState.supplies.ammunition -= lostAmmo;
        if (gameState.supplies.oxen > 0) gameState.supplies.oxen -= 1;
        if (headline) await ui.showMessage(headline);
        await ui.showMessage(
            `Lost ${lostFood} lb food, ${lostAmmo} rounds, and 1 ox.`,
        );
        gameState.rollCasualties(5);   // river disasters call casualty at severity 5
    }
}
