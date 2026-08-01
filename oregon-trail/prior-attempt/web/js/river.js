// =============================================================================
// river.js - River crossing logic
// =============================================================================
//
// Five rivers along the trail (CONFIRMED from LANDMARKS where isRiver=true):
//   - Kansas River, Big Blue River, Green River, Snake River, plus the
//     Columbia at The Dalles (handled specially as the "final raft").
//
// At each crossing the player picks one of four options. Strings such as
// "2.5 feet" and "$5.00" / "$10.00" / "ferry not operating" are CONFIRMED
// from EXE strings. Failure probabilities are HYPOTHESIS - tuned to feel
// fair while making deep water genuinely dangerous.
//
// Crossing options:
//
//   1. Ford       - drive the wagon through. Safe if depth <= 2.5 ft.
//                   Otherwise heavy odds of supply loss / drowning.
//   2. Caulk wagon (float across). 70% success; 30% wagon flips and food/
//                   ammo are halved.
//   3. Ferry      - costs $5 (shallow) or $10 (deep). Always works if you
//                   have the money. If the river is too shallow the ferry
//                   is "not operating today".
//   4. Hire Indian guide - costs $15. Always succeeds (CONFIRMED in
//                   gameplay; cost HYPOTHESIS).
// =============================================================================

import {
    FERRY_COST,
    FORD_SAFE_DEPTH_FT,
    HIRE_GUIDE_COST,
} from './constants.js';


export class RiverCrossing {
    /**
     * @param {string} riverName
     * @param {number} baseDepthFt  the rough typical depth of this river.
     */
    constructor(riverName, baseDepthFt = 4) {
        this.riverName = riverName;
        this.baseDepthFt = baseDepthFt;
    }

    /**
     * Sample today's depth from baseDepthFt +/- 30% jitter.
     */
    getDepth() {
        const jitter = (Math.random() * 0.6) - 0.3;   // -0.3 .. +0.3
        return Math.max(0.5, +(this.baseDepthFt * (1 + jitter)).toFixed(1));
    }

    /**
     * Run the crossing dialogue. Returns when the player has successfully
     * (or unsuccessfully) crossed - the river is then considered behind
     * them either way.
     */
    async run(gameState, ui) {
        const depth = this.getDepth();
        const widthFt = 300 + Math.floor(Math.random() * 600);

        gameState.addMessage(
            `${this.riverName}: ${widthFt} feet across, ${depth} feet deep.`,
        );
        ui.renderMessageLog();

        // FIX (asset-keys pass): draw the new vga_FLOAT river-crossing
        // scene on the canvas while the player decides. The previous
        // landmark scene (vga_Pn) is left on the canvas otherwise.
        ui.renderer.drawRiverCrossing({
            name: this.riverName, widthFt, depth,
        });

        while (true) {
            const options = [
                'Attempt to ford the river',
                'Caulk the wagon and float across',
                `Take a ferry across ($${depth >= 4 ? FERRY_COST.DEEP : FERRY_COST.SHALLOW})`,
                `Hire an Indian guide ($${HIRE_GUIDE_COST})`,
            ];

            const idx = await ui._menu(
                `${this.riverName} - ${widthFt} ft wide, ${depth} ft deep. What do you do?`,
                options,
            );

            let crossed = false;
            switch (idx) {
                case 0: crossed = await this.ford(depth, gameState, ui); break;
                case 1: crossed = await this.caulk(gameState, ui); break;
                case 2: crossed = await this.ferry(depth, gameState, ui); break;
                case 3: crossed = await this.hireGuide(gameState, ui); break;
            }
            if (crossed) return;
            // Otherwise the player must pick again (e.g. failed ford).
        }
    }

    // ---------------------------------------------------------------------
    // Methods of crossing
    // ---------------------------------------------------------------------

    async ford(depth, gameState, ui) {
        if (depth <= FORD_SAFE_DEPTH_FT) {
            await ui.showMessage('You forded the river safely.');
            return true;
        }
        // Risk: 70% catastrophic loss when too deep.
        if (Math.random() < 0.7) {
            await this._floodLoss(gameState, ui);
        }
        await ui.showMessage('You struggled across the river.');
        return true;
    }

    async caulk(gameState, ui) {
        if (Math.random() < 0.7) {
            await ui.showMessage('You caulked the wagon and floated across.');
            return true;
        }
        // Wagon tipped: lose half of food and ammo.
        const lostFood = Math.floor(gameState.supplies.food / 2);
        const lostAmmo = Math.floor(gameState.supplies.ammunition / 2);
        gameState.supplies.food -= lostFood;
        gameState.supplies.ammunition -= lostAmmo;
        await ui.showMessage(
            `The wagon tipped over! You lost ${lostFood} lb food and ${lostAmmo} rounds.`,
        );
        return true;
    }

    async ferry(depth, gameState, ui) {
        // The ferry is described as not operating in very shallow water -
        // there is no need for it when the river is fordable.
        if (depth < 1.5) {
            await ui.showMessage('The ferry is not operating today (river too low).');
            return false;
        }
        const cost = depth >= 4 ? FERRY_COST.DEEP : FERRY_COST.SHALLOW;
        if (gameState.supplies.cash < cost) {
            await ui.showMessage(`You cannot afford the $${cost} ferry.`);
            return false;
        }
        gameState.supplies.cash -= cost;
        await ui.showMessage(`You paid $${cost} for the ferry and crossed safely.`);
        return true;
    }

    async hireGuide(gameState, ui) {
        if (gameState.supplies.cash < HIRE_GUIDE_COST) {
            await ui.showMessage(`You cannot afford the $${HIRE_GUIDE_COST} guide.`);
            return false;
        }
        gameState.supplies.cash -= HIRE_GUIDE_COST;
        await ui.showMessage(
            `You hired an Indian guide for $${HIRE_GUIDE_COST}. They led you across safely.`,
        );
        return true;
    }

    // ---------------------------------------------------------------------
    // Flooding consequences
    // ---------------------------------------------------------------------

    async _floodLoss(gameState, ui) {
        // Lose 30% food, 30% ammo, 1 ox, possibly 1 random member drowns.
        const lostFood = Math.floor(gameState.supplies.food * 0.3);
        const lostAmmo = Math.floor(gameState.supplies.ammunition * 0.3);
        gameState.supplies.food -= lostFood;
        gameState.supplies.ammunition -= lostAmmo;
        if (gameState.supplies.oxen > 0) gameState.supplies.oxen -= 1;

        let msg = `The wagon was swept partway down the river! `
                + `Lost ${lostFood} lb food, ${lostAmmo} rounds, and 1 ox.`;

        if (Math.random() < 0.25) {
            const alive = gameState.party.filter((p) => p.isAlive);
            if (alive.length > 0) {
                const victim = alive[Math.floor(Math.random() * alive.length)];
                victim.die('drowned crossing the river');
                msg += ` ${victim.name} drowned.`;
            }
        }
        await ui.showMessage(msg);
    }
}
