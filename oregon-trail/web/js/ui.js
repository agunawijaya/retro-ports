// ui.js -- DOM menus, prompts, log, status row.

import {
    TEXT,
    OCCUPATION,
    PACE,
    RATION,
    DEPARTURE_MONTHS,
    PARTY_SIZE,
    DEFAULT_PARTY_NAMES,
    MONTH_NAMES,
    STORE_PRICES,
} from './constants.js';
import { rng } from './rng.js';


export class UI {
    constructor(renderer, gameState) {
        this.renderer = renderer;
        this.gameState = gameState;

        this.inputArea = document.getElementById('input-area');
        this.messageLog = document.getElementById('message-log');
        this.statusRow = document.getElementById('status-row');
    }

    // ---------------------------------------------------------------------
    // Primitives
    // ---------------------------------------------------------------------

    _setInputArea(builder) {
        this.inputArea.innerHTML = '';
        builder(this.inputArea);
    }

    _menu(prompt, options, hint) {
        return new Promise((resolve) => {
            this._setInputArea((root) => {
                if (prompt) {
                    const p = document.createElement('p');
                    p.className = 'prompt';
                    p.textContent = prompt;
                    root.appendChild(p);
                }
                const ul = document.createElement('ul');
                ul.className = 'menu';
                const buttons = options.map((label, idx) => {
                    const li = document.createElement('li');
                    const btn = document.createElement('button');
                    btn.textContent = `${idx + 1}. ${label}`;
                    btn.addEventListener('click', () => onPick(idx));
                    li.appendChild(btn);
                    ul.appendChild(li);
                    return btn;
                });
                root.appendChild(ul);

                if (hint) {
                    const h = document.createElement('div');
                    h.className = 'hint';
                    h.textContent = hint;
                    root.appendChild(h);
                }
                if (buttons.length > 0) buttons[0].focus();

                const keyHandler = (ev) => {
                    if (ev.key >= '1' && ev.key <= '9') {
                        const idx = parseInt(ev.key, 10) - 1;
                        if (idx < options.length) {
                            ev.preventDefault();
                            onPick(idx);
                        }
                    }
                };
                document.addEventListener('keydown', keyHandler);
                function onPick(idx) {
                    document.removeEventListener('keydown', keyHandler);
                    resolve(idx);
                }
            });
        });
    }

    promptInput(question, defaultValue = '') {
        return new Promise((resolve) => {
            this._setInputArea((root) => {
                const p = document.createElement('p');
                p.className = 'prompt';
                p.textContent = question;
                root.appendChild(p);

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'text-input';
                input.value = defaultValue;
                input.maxLength = 20;
                root.appendChild(input);

                const btn = document.createElement('button');
                btn.textContent = 'OK';
                btn.style.marginLeft = '8px';
                btn.style.background = '#003300';
                btn.style.color = '#00ff00';
                btn.style.border = '1px solid #00aa00';
                btn.style.padding = '2px 8px';
                btn.style.cursor = 'pointer';
                root.appendChild(btn);

                const submit = () => {
                    const v = input.value.trim() || defaultValue;
                    resolve(v);
                };
                btn.addEventListener('click', submit);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') submit();
                });
                input.focus();
                input.select();
            });
        });
    }

    showMessage(text) {
        this.gameState.addMessage(text);
        this.renderMessageLog();
        return new Promise((resolve) => {
            this._setInputArea((root) => {
                const p = document.createElement('p');
                p.className = 'prompt';
                p.textContent = text;
                root.appendChild(p);

                const btn = document.createElement('button');
                btn.textContent = 'Continue';
                btn.style.marginTop = '6px';
                btn.style.background = '#003300';
                btn.style.color = '#00ff00';
                btn.style.border = '1px solid #00aa00';
                btn.style.padding = '2px 10px';
                btn.style.cursor = 'pointer';
                btn.addEventListener('click', () => {
                    document.removeEventListener('keydown', keyHandler);
                    resolve();
                });
                root.appendChild(btn);
                btn.focus();

                const keyHandler = (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        document.removeEventListener('keydown', keyHandler);
                        resolve();
                    }
                };
                document.addEventListener('keydown', keyHandler);
            });
        });
    }

    _displayLinesAndContinue(title, lines) {
        return new Promise((resolve) => {
            this._setInputArea((root) => {
                const h = document.createElement('p');
                h.className = 'prompt';
                h.textContent = title;
                root.appendChild(h);
                for (const ln of lines) {
                    const d = document.createElement('div');
                    d.textContent = ln;
                    root.appendChild(d);
                }
                const btn = document.createElement('button');
                btn.textContent = 'Continue';
                btn.style.marginTop = '8px';
                btn.style.background = '#003300';
                btn.style.color = '#00ff00';
                btn.style.border = '1px solid #00aa00';
                btn.style.padding = '2px 10px';
                btn.style.cursor = 'pointer';
                btn.addEventListener('click', resolve);
                root.appendChild(btn);
                btn.focus();
            });
        });
    }

    // ---------------------------------------------------------------------
    // Status row + log
    // ---------------------------------------------------------------------

    renderStatusRow() {
        if (!this.statusRow) return;
        const g = this.gameState;
        const dateStr = `${MONTH_NAMES[g.currentMonth]} ${g.currentDay}, ${g.currentYear}`;
        this.statusRow.innerHTML = `
            <span class="field">Date <b>${dateStr}</b></span>
            <span class="field">Miles <b>${g.totalMiles}</b></span>
            <span class="field">Weather <b>${g.weather}</b></span>
            <span class="field">Health <b>${g.healthLabel()}</b></span>
            <span class="field">Food <b>${g.supplies.food} lb</b></span>
            <span class="field">Cash <b>$${g.supplies.cash.toFixed(2)}</b></span>
        `;
    }

    renderMessageLog() {
        const msgs = this.gameState.messages.slice(-30);
        this.messageLog.innerHTML = msgs.map((m) => (
            `<div class="msg"><span class="ts">${m.ts}</span>${m.text}</div>`
        )).join('');
        this.messageLog.scrollTop = this.messageLog.scrollHeight;
    }

    // ---------------------------------------------------------------------
    // Screens
    // ---------------------------------------------------------------------

    async showMainMenu() {
        return await this._menu(TEXT.title, TEXT.mainMenu, 'Press 1-5 or click.');
    }

    async showSetupFlow() {
        // Occupation
        const occOptions = Object.values(OCCUPATION);
        const occIdx = await this._menu(
            TEXT.chooseOccupation,
            occOptions.map((o) => `${o.name} - starts with $${o.startingCash}`),
            'Farmers get the highest score bonus (x3); bankers the lowest (x1).',
        );
        const occupation = occOptions[occIdx];

        // Party names -- player first, then 4 companions.
        const partyNames = [
            await this.promptInput('Your name (the wagon leader)', DEFAULT_PARTY_NAMES[0]),
        ];
        for (let i = 1; i < PARTY_SIZE; i++) {
            partyNames.push(await this.promptInput(
                `Name of party member #${i + 1}`,
                DEFAULT_PARTY_NAMES[i],
            ));
        }

        // Departure month
        const monIdx = await this._menu(
            TEXT.chooseDeparture,
            DEPARTURE_MONTHS.map((m) => m.name),
            'Early = grass scarce. Late = winter in the mountains.',
        );
        const departureMonth = DEPARTURE_MONTHS[monIdx];

        return { occupation, departureMonth, partyNames };
    }

    async showDailyMenu() {
        // DOS gates option 8 on `cmp byte [0x199d], 0` at image 0x4109:
        //   at a landmark: '1-9' menu, "8. Talk to people", "9. Buy supplies"
        //   on the trail:  '1-8' menu, "8. Hunt for food"
        // We show 8 items always; position 7 (index 7) is the swap slot.
        // 'Buy supplies' is handled by the fort visit in arriveAtLandmark.
        const items = TEXT.dailyMenu.slice(0, 7);   // 0..6: Continue through Trade
        items.push(this.gameState.justArrivedAtLandmark
            ? 'Talk to people'
            : 'Hunt for food');
        return await this._menu(
            `Day ${this.gameState.currentDay} of ${MONTH_NAMES[this.gameState.currentMonth]} - what now?`,
            items,
        );
    }

    async showPaceMenu() {
        const options = Object.values(PACE);
        const idx = await this._menu(
            'Set the pace at which you want to travel:',
            options.map((p) => `${p.name} (${p.hoursPerDay}h/day)`),
        );
        return options[idx];
    }

    async showRationMenu() {
        const options = Object.values(RATION);
        const idx = await this._menu(
            'Set the food rations:',
            options.map((r) => `${r.name} (${r.poundsPerPersonPerDay} lb/person/day)`),
        );
        return options[idx];
    }

    async showLandmarkArrival(landmark) {
        await this.showMessage(`You have reached ${landmark.name}.`);
    }

    async showSuppliesScreen() {
        this.renderer.drawSuppliesGrid(this.gameState.supplies, STORE_PRICES);
        const s = this.gameState.supplies;
        const lines = [
            `Oxen: ${s.oxen}`,
            `Food: ${s.food} lb`,
            `Ammunition: ${s.ammunition} rounds`,
            `Clothing sets: ${s.clothingSets}`,
            `Spare wheels: ${s.spareWheels}`,
            `Spare axles: ${s.spareAxles}`,
            `Spare tongues: ${s.spareTongues}`,
            `Cash: $${s.cash.toFixed(2)}`,
        ];
        await this._displayLinesAndContinue('Your supplies', lines);
    }

    async showHighScores(scores) {
        const lines = scores.map((s, i) => {
            const rank = String(i + 1).padStart(2, ' ');
            const name = (s.name || '').padEnd(20, ' ');
            return `${rank}. ${name} ${String(s.score).padStart(6, ' ')}`;
        });
        await this._displayLinesAndContinue('Top 10 Oregon Trail Pioneers', lines);
    }

    async showLearn() {
        const lines = [
            'In 1848 thousands of settlers crossed 2000 miles of plains,',
            'rivers and mountains to reach the Willamette Valley in Oregon.',
            'They left from Independence, Missouri and travelled by ox-drawn',
            'wagons over five to six months, hunting for food, trading at',
            'forts, and crossing dangerous rivers along the way.',
        ];
        await this._displayLinesAndContinue('About the Oregon Trail', lines);
    }

    async showTalk() {
        const lines = [
            'A fellow traveller tells you about the trail ahead.',
            'A passing trapper warns of bad weather in the mountains.',
            'A pioneer family shares wisdom about river crossings.',
            'A trail guide says fresh game is plentiful nearby.',
            'A young settler tells a tall tale around the fire.',
        ];
        await this.showMessage(rng.pick(lines));
    }
}
