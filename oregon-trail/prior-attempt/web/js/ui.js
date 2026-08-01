// =============================================================================
// ui.js - Menu system, text display, dialog boxes
// =============================================================================
//
// This class encapsulates every DOM-side interaction the game needs:
//
//   - showMainMenu()           title-screen menu
//   - showSetupFlow()          occupation -> difficulty -> names -> month
//   - showDailyMenu()          the choice each travel day
//   - showPaceMenu / Ration    smaller follow-up menus
//   - showLandmarkArrival      "You have reached ..."
//   - showSuppliesScreen()     supplies + cash, drawn into canvas + DOM list
//   - showMessage()            ephemeral notification
//   - promptInput()            text input (party names, custom quantities)
//   - renderStatusRow()        date / miles / weather / health header
//   - renderMessageLog()       refresh #message-log from gameState.messages
//
// Every menu method returns a Promise that resolves to the player's
// selection. main.js awaits these so the game loop reads sequentially.
// =============================================================================

import {
    TEXT,
    OCCUPATION,
    DIFFICULTY,
    PACE,
    RATION,
    DEPARTURE_MONTHS,
    PARTY_SIZE,
    DEFAULT_PARTY_NAMES,
    HEALTH_BANDS,
    MONTH_NAMES,
    STORE_PRICES,
} from './constants.js';


export class UI {
    constructor(renderer, gameState) {
        this.renderer = renderer;
        this.gameState = gameState;

        this.inputArea = document.getElementById('input-area');
        this.messageLog = document.getElementById('message-log');

        // Status row is created on demand and lives in #ui-panel above the
        // message log when the player is travelling.
        this.statusRow = null;
    }

    // ---------------------------------------------------------------------
    // Primitives
    // ---------------------------------------------------------------------

    /**
     * Wipe and rebuild the input area with arbitrary content. Most other
     * methods funnel through this so we keep DOM churn predictable.
     */
    _setInputArea(builder) {
        this.inputArea.innerHTML = '';
        builder(this.inputArea);
    }

    /**
     * Generic numbered menu. Returns a Promise that resolves to the index
     * the player chose. Supports keyboard (1..9) and mouse.
     *
     * @param {string} prompt
     * @param {string[]} options
     * @param {string} [hint]
     */
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

                // Focus first button so Enter / arrow keys work.
                if (buttons.length > 0) buttons[0].focus();

                // Keyboard shortcut: 1..9 picks the option.
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

    /**
     * Prompt for a single text input. Resolves to the trimmed string.
     */
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

    /**
     * Brief notification - shows in the message log and also flashed at
     * the bottom of the input area for a moment.
     *
     * Resolves after the player presses the "OK" button (or any key) so
     * narrative beats can be paced.
     */
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
                btn.addEventListener('click', resolve);
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

    // ---------------------------------------------------------------------
    // Status row + message log
    // ---------------------------------------------------------------------

    /**
     * Render the status header (date / miles / weather / health).
     */
    renderStatusRow() {
        if (!this.statusRow) {
            const row = document.createElement('div');
            row.className = 'status-row';
            row.id = 'status-row';
            // Insert above the message log.
            const panel = document.getElementById('ui-panel');
            panel.insertBefore(row, this.messageLog);
            this.statusRow = row;
        }
        const g = this.gameState;
        const dateStr = `${MONTH_NAMES[g.currentMonth]} ${g.currentDay}, ${g.currentYear}`;
        this.statusRow.innerHTML = `
            <span class="field">Date <b>${dateStr}</b></span>
            <span class="field">Miles <b>${g.totalMiles}</b></span>
            <span class="field">Weather <b>${g.weather}</b></span>
            <span class="field">Health <b>${g.partyHealthLabel()}</b></span>
            <span class="field">Food <b>${g.supplies.food} lb</b></span>
            <span class="field">Cash <b>$${g.supplies.cash.toFixed(2)}</b></span>
        `;
    }

    /**
     * Refresh the scrolling message log with the latest entries from
     * gameState.messages. We render only the last ~30 to keep the DOM
     * small; older messages are still in the state array.
     */
    renderMessageLog() {
        const msgs = this.gameState.messages.slice(-30);
        this.messageLog.innerHTML = msgs.map((m) => {
            return `<div class="msg"><span class="ts">${m.ts}</span>${m.text}</div>`;
        }).join('');
        // Auto-scroll to bottom.
        this.messageLog.scrollTop = this.messageLog.scrollHeight;
    }

    // ---------------------------------------------------------------------
    // Title / main menu
    // ---------------------------------------------------------------------

    async showMainMenu() {
        return await this._menu(TEXT.title, TEXT.mainMenu, 'Press 1-5 or click.');
    }

    // ---------------------------------------------------------------------
    // Setup flow
    // ---------------------------------------------------------------------

    /**
     * Sequence the four setup choices. Returns a setup object suitable
     * for GameState.applySetup().
     */
    async showSetupFlow() {
        // Step 1: occupation
        const occOptions = Object.values(OCCUPATION);
        const occIdx = await this._menu(
            TEXT.chooseOccupation,
            occOptions.map((o) => `${o.name} - starts with $${o.startingCash}`),
            'Farmers get the highest score bonus.',
        );
        const occupation = occOptions[occIdx];

        // Step 2: difficulty
        const diffOptions = Object.values(DIFFICULTY);
        const diffIdx = await this._menu(
            TEXT.chooseDifficulty,
            diffOptions.map((d) => d.name),
            'Greenhorn = easier; Trail Guide = hardest.',
        );
        const difficulty = diffOptions[diffIdx];

        // Step 3: party names
        const partyNames = [
            await this.promptInput(`Your name (the wagon leader)`, DEFAULT_PARTY_NAMES[0]),
        ];
        for (let i = 1; i < PARTY_SIZE; i++) {
            partyNames.push(await this.promptInput(
                `Name of party member #${i + 1}`,
                DEFAULT_PARTY_NAMES[i],
            ));
        }

        // Step 4: departure month
        const monIdx = await this._menu(
            TEXT.chooseDeparture,
            DEPARTURE_MONTHS.map((m) => m.name),
            'Early = grass scarce. Late = winter in the mountains.',
        );
        const departureMonth = DEPARTURE_MONTHS[monIdx];

        return { occupation, difficulty, departureMonth, partyNames };
    }

    // ---------------------------------------------------------------------
    // Daily / pace / ration menus
    // ---------------------------------------------------------------------

    async showDailyMenu() {
        return await this._menu(
            `Day ${this.gameState.currentDay} of ${MONTH_NAMES[this.gameState.currentMonth]} - what now?`,
            TEXT.dailyMenu,
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

    // ---------------------------------------------------------------------
    // Landmark arrival
    // ---------------------------------------------------------------------

    async showLandmarkArrival(landmark) {
        // The canvas already drew the landmark scene; we only need a
        // confirmation prompt in the DOM.
        await this.showMessage(`You have reached ${landmark.name}.`);
    }

    // ---------------------------------------------------------------------
    // Supplies screen
    // ---------------------------------------------------------------------

    async showSuppliesScreen() {
        // Canvas-side: pretty grid of icons.
        this.renderer.drawSuppliesGrid(this.gameState.supplies, STORE_PRICES);

        // DOM-side: a text breakdown + Continue button.
        const s = this.gameState.supplies;
        const lines = [
            `Oxen: ${s.oxen} yokes`,
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

    /**
     * Common helper: show a labelled list of lines and a Continue button.
     */
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

    /**
     * Render the high-score table on the title screen ("See the Top Ten").
     */
    async showHighScores(scores) {
        const lines = scores.map((s, i) => {
            const rank = String(i + 1).padStart(2, ' ');
            const name = s.name.padEnd(20, ' ');
            return `${rank}. ${name} ${String(s.score).padStart(6, ' ')}`;
        });
        await this._displayLinesAndContinue('Top 10 Oregon Trail Pioneers', lines);
    }

    /**
     * Brief one-paragraph explanation for "Learn About the Trail".
     */
    async showLearn() {
        const lines = [
            'In 1848 thousands of settlers crossed 2000 miles of plains,',
            'rivers and mountains to reach the Willamette Valley in Oregon.',
            'They left from Independence, Missouri and travelled by ox-drawn',
            'wagons over five to six months, hunting for food, trading at',
            'forts, and crossing dangerous rivers along the way.',
            '',
            'This study project rebuilds the 1990 MECC edition of the game.',
        ];
        await this._displayLinesAndContinue('About the Oregon Trail', lines);
    }

    /**
     * "Talk to people" - a random morale-boost dialog.
     */
    async showTalk() {
        const lines = [
            'A fellow traveller tells you about the trail ahead.',
            'A passing trapper warns of bad weather in the mountains.',
            'A pioneer family shares wisdom about river crossings.',
            'A trail guide says fresh game is plentiful nearby.',
            'A young settler tells a tall tale around the fire.',
        ];
        const pick = lines[Math.floor(Math.random() * lines.length)];
        await this.showMessage(pick);
    }
}
