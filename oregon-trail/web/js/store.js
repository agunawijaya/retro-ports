// store.js -- Matt's General Store. Prices from constants.js are CONFIRMED
// per docs/03; the fort multiplier is HYPOTHESIS.

import {
    STORE_PRICES,
    TEXT,
    OXEN_CAP,
    FOOD_CAP_LB,
    SPARE_PARTS_CAP_TOTAL,
} from './constants.js';


export class Store {
    constructor(fortName, priceMultiplier = 1.0) {
        this.fortName = fortName;
        this.priceMultiplier = priceMultiplier;
    }

    prices() {
        const out = {};
        for (const [k, v] of Object.entries(STORE_PRICES)) {
            out[k] = +(v * this.priceMultiplier).toFixed(2);
        }
        return out;
    }

    async run(gameState, ui) {
        const itemKeys = ['OXEN', 'FOOD', 'AMMO', 'CLOTHING', 'WHEEL', 'AXLE', 'TONGUE'];
        const itemLabels = {
            OXEN:     'Oxen (yoke = 2)',
            FOOD:     'Food (lb)',
            AMMO:     'Ammunition (box of 20)',
            CLOTHING: 'Clothing sets',
            WHEEL:    'Spare wheel',
            AXLE:     'Spare axle',
            TONGUE:   'Spare tongue',
        };
        const prices = this.prices();

        gameState.addMessage(`${TEXT.storeIntro} (at ${this.fortName})`);
        ui.renderMessageLog();
        gameState.canvasLocked = true;

        try { while (true) {
            ui.renderer.drawStoreScreen(prices, gameState.supplies.cash, {});

            const options = itemKeys.map((k) => `${itemLabels[k]} - $${prices[k]}`);
            options.push('Leave the store');

            const idx = await ui._menu(
                `Matt's Store at ${this.fortName} - Cash: $${gameState.supplies.cash.toFixed(2)}`,
                options,
            );
            if (idx === options.length - 1) break;

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

            // Caps from Matt's own dialogue -- CONFIRMED.
            if (itemKey === 'OXEN' && gameState.supplies.oxen + quantity * 2 > OXEN_CAP) {
                await ui.showMessage(`You may only take ${OXEN_CAP} oxen.`);
                continue;
            }
            if (itemKey === 'FOOD' && gameState.supplies.food + quantity > FOOD_CAP_LB) {
                await ui.showMessage(`Your wagon may only carry ${FOOD_CAP_LB} pounds of food.`);
                continue;
            }
            if ((itemKey === 'WHEEL' || itemKey === 'AXLE' || itemKey === 'TONGUE')
                && gameState.supplies.spareParts() + quantity > SPARE_PARTS_CAP_TOTAL) {
                await ui.showMessage(
                    `Your wagon may only carry ${SPARE_PARTS_CAP_TOTAL} spare parts.`,
                );
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
        } } finally {
            gameState.canvasLocked = false;
        }
    }
}
