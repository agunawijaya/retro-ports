// =============================================================================
// store.js - Matt's General Store
// =============================================================================
//
// "Hello, I'm Matt. So you want to go to Oregon, eh?" - CONFIRMED dialog
// string from the EXE.
//
// The store is visited twice in a normal playthrough:
//   1. Right after setup, in Independence, at the full CONFIRMED prices.
//   2. Any time the player stops at a fort. Fort stores carry a price
//      multiplier (HYPOTHESIS - the value 1.5x is plausible based on the
//      hike noted in fan documentation but is not confirmed from binary).
//
// We model the store as a class so it can carry per-fort state (multiplier
// and inventory cap). The actual selection flow is driven by the UI's
// menu primitives.
// =============================================================================

import { STORE_PRICES, TEXT, TRAIL_LENGTH_MILES } from './constants.js';


/**
 * FIX 2b (store recommendations): suggest how many of each SKU the
 * party still needs based on:
 *   - days of food remaining vs. estimated trip length
 *   - ox count vs. a healthy 6-yoke team
 *   - ammo / clothing / spare parts vs. round targets
 * Returns { ITEM_KEY: suggestedQty }. Always >= 0.
 *
 * The numbers are heuristics, not CONFIRMED from the binary. Their job
 * is to nudge the player toward a survivable starting load-out.
 */
function getStoreRecommendations(gameState) {
    const alive = gameState.countAlive();
    const milesLeft = TRAIL_LENGTH_MILES - gameState.totalMiles;
    const daysLeft = Math.max(1, Math.ceil(milesLeft / 15));
    const s = gameState.supplies;
    return {
        FOOD:     Math.max(0, daysLeft * alive * 3 - s.food),
        OXEN:     Math.max(0, 6 - s.oxen),
        AMMO:     Math.max(0, 4 - Math.floor(s.ammunition / 50)),
        CLOTHING: Math.max(0, 4 - s.clothingSets),
        WHEEL:    Math.max(0, 2 - s.spareWheels),
        AXLE:     Math.max(0, 1 - s.spareAxles),
        TONGUE:   Math.max(0, 1 - s.spareTongues),
    };
}


export class Store {
    /**
     * @param {string} fortName              for the dialog header
     * @param {number} [priceMultiplier=1.0] 1.0 at Independence;
     *                                       higher at outposts.
     */
    constructor(fortName, priceMultiplier = 1.0) {
        this.fortName = fortName;
        this.priceMultiplier = priceMultiplier;
    }

    /**
     * Returns a price object with the multiplier applied. Other code
     * should always use these prices rather than STORE_PRICES directly so
     * the multiplier is honoured.
     */
    prices() {
        const out = {};
        for (const [k, v] of Object.entries(STORE_PRICES)) {
            out[k] = +(v * this.priceMultiplier).toFixed(2);
        }
        return out;
    }

    /**
     * Run the store visit. Loops until the player chooses "leave the
     * store". Each iteration:
     *   - Show supplies grid on canvas.
     *   - Show shopping menu in DOM.
     *   - On a buy choice, prompt for quantity, validate, apply purchase.
     *
     * @param {GameState} gameState
     * @param {UI} ui
     */
    async run(gameState, ui) {
        const itemKeys = ['OXEN', 'FOOD', 'AMMO', 'CLOTHING', 'WHEEL', 'AXLE', 'TONGUE'];
        const itemLabels = {
            OXEN:     'Oxen',
            FOOD:     'Food (lb)',
            AMMO:     'Ammunition (50-round box)',
            CLOTHING: 'Clothing sets',
            WHEEL:    'Spare wheel',
            AXLE:     'Spare axle',
            TONGUE:   'Spare tongue',
        };

        const prices = this.prices();

        ui.gameState.addMessage(`${TEXT.storeIntro} (at ${this.fortName})`);
        ui.renderMessageLog();

        // FIX 2 (store layout): the store now uses drawStoreScreen for a
        // dedicated layout with shopkeeper portrait + 3x3 item grid.
        // Lock the canvas while the store is open so the wagon
        // animation doesn't overdraw it.
        gameState.canvasLocked = true;

        try { while (true) {
            // FIX 2b: dedicated store layout + per-item recommendations.
            const recs = getStoreRecommendations(gameState);
            ui.renderer.drawStoreScreen(prices, gameState.supplies.cash, recs);

            // Build the menu options - include current price.
            const options = itemKeys.map((k) => {
                return `${itemLabels[k]} - $${prices[k]}`;
            });
            options.push('Leave the store');

            const idx = await ui._menu(
                `Matt's Store at ${this.fortName} - Cash on hand: $${gameState.supplies.cash.toFixed(2)}`,
                options,
            );

            if (idx === options.length - 1) break;        // Leave

            const itemKey = itemKeys[idx];
            const qtyText = await ui.promptInput(
                `How many ${itemLabels[itemKey]}? (price $${prices[itemKey]} each)`,
                '1',
            );
            const quantity = parseInt(qtyText, 10);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                await ui.showMessage('Invalid quantity.');
                continue;
            }

            if (!gameState.supplies.canAfford(prices[itemKey], quantity)) {
                await ui.showMessage(`You can't afford ${quantity} of those.`);
                continue;
            }

            gameState.supplies.buy(itemKey, quantity, prices[itemKey]);
            await ui.showMessage(
                `Bought ${quantity} ${itemLabels[itemKey]} for $${(prices[itemKey] * quantity).toFixed(2)}.`,
            );
        }
        } finally {
            // FIX 2: always release the canvas lock on the way out so
            // the next phase (e.g. travelling) can re-animate the wagon.
            gameState.canvasLocked = false;
        }
    }
}
