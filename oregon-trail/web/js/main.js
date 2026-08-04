// main.js -- bootstrap and the top-level phase machine.
//
// Exposes on window:
//   resetGame(seed)  -- reseed the RNG and drop back to the title
//   selfTest(days)   -- headless simulation of `days` travel days
//   game             -- the live state, for poking at from the console
//
// PROMPT-PORT.md required a seeded RNG plus a self-test hook -- the prior
// attempt had neither, which is why every complaint about it was
// undiagnosable ("fourteen bare Math.random() calls, no PRNG").

import {
    TEXT, PACE, TRAIL_LENGTH_MILES, HUNT_MAX_CARRY_LBS,
} from './constants.js';
import { AssetLoader } from './assets.js';
import { Renderer } from './renderer.js';
import { GameState, PHASE } from './state.js';
import {
    LANDMARKS, calculateMilesPerDay, hasArrivedAtNextLandmark, hasFork,
} from './trail.js';
import { EventSystem } from './events.js';
import { UI } from './ui.js';
import { Store } from './store.js';
import { RiverCrossing } from './river.js';
import { HuntingGame } from './hunting.js';
import { calculateFinalScore, loadHighScores, checkHighScore } from './scoring.js';
import { rng } from './rng.js';


// The single game / renderer / ui triple, kept module-scoped so
// resetGame() can drop the current run and start a new one.
let g = {
    gameState: null,
    renderer: null,
    ui: null,
    events: null,
    canvas: null,
    assets: null,
    resetRequested: false,
};


// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

async function bootstrap() {
    g.canvas = document.getElementById('game-canvas');
    g.assets = new AssetLoader();
    g.renderer = new Renderer(g.canvas, g.assets);

    g.renderer.clearScreen('#000000');
    g.renderer.drawTextPanel(['Loading assets...'], 80, 90, 160, 24);

    await g.assets.loadAll((done, total) => {
        g.renderer.clearScreen('#000000');
        g.renderer.drawTextPanel(
            [`Loading assets... ${done}/${total}`],
            80, 90, 160, 24,
        );
    });

    resetGame();  // set up first GameState + UI + events

    // Wagon-animation tick -- kept short and cheap.
    let wagonFrame = 0;
    let lastTick = 0;
    const FRAME_MS = 300;
    function tick(ts) {
        if (ts - lastTick > FRAME_MS) {
            wagonFrame = (wagonFrame + 1) % 3;
            lastTick = ts;
            if (!g.gameState.canvasLocked) {
                if (g.gameState.phase === PHASE.TITLE) {
                    g.renderer.drawMainMenu(wagonFrame);
                } else if (g.gameState.phase === PHASE.TRAVELLING) {
                    g.renderer.drawTravelScreen(g.gameState, wagonFrame);
                }
            }
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    runGame().catch((err) => {
        console.error('Game loop crashed:', err);
    });
}


// -----------------------------------------------------------------------------
// Reset and self-test hooks -- both on window
// -----------------------------------------------------------------------------

function resetGame(seed) {
    rng.setSeed(seed);
    g.gameState = new GameState();
    g.gameState.landmarks = LANDMARKS;
    g.ui = new UI(g.renderer, g.gameState);
    g.events = new EventSystem();
    g.resetRequested = true;
    if (window && window.game !== undefined) window.game = g.gameState;
}


// Headless: run `days` travel days with the current settings (or a
// fresh game with the given seed). Returns a summary.
function selfTest({ days = 200, seed = 1, pace = PACE.STEADY, occupationId = 0 } = {}) {
    rng.setSeed(seed);
    const state = new GameState();
    state.landmarks = LANDMARKS;
    // A plausible starter kit -- not the real store's; the point is
    // to exercise the simulation, not the outfitting flow.
    state.supplies.oxen = 6;
    state.supplies.food = 800;
    state.supplies.ammunition = 200;
    state.supplies.clothingSets = 4;
    state.supplies.spareWheels = 1;
    state.supplies.cash = 300;
    state.pace = pace;
    // (occupation stays the constructor default; scoring uses it at end)
    const events = new EventSystem();
    const trace = [];
    for (let d = 0; d < days && state.countAlive() > 0; d++) {
        const miles = calculateMilesPerDay(state);
        state.totalMiles += miles;
        const fired = events.daily(state);
        const food = events.tickFood(state);
        events.tickHealth(state, food.ranOut);
        state.advanceCalendar();
        if (hasArrivedAtNextLandmark(state)) {
            // headless self-test always takes the default (next) fork
            const here = LANDMARKS[state.currentLandmarkIndex];
            state.currentLandmarkIndex = here.next;
            state.daysSinceLandmark = 0;
        }
        trace.push({
            day: d + 1,
            miles: state.totalMiles,
            landmark: state.currentLandmarkIndex,
            hazard: +state.hazard.toFixed(3),
            health: +state.health.toFixed(3),
            alive: state.countAlive(),
            event: fired ? fired.name : null,
        });
        if (state.currentLandmarkIndex >= LANDMARKS.length - 1) break;
    }
    const score = calculateFinalScore(state);
    return { finalDay: trace.length, ...score, trace };
}


// -----------------------------------------------------------------------------
// Top-level phase machine
// -----------------------------------------------------------------------------

async function runGame() {
    while (true) {
        g.gameState.phase = PHASE.TITLE;
        g.renderer.drawMainMenu();
        if (g.ui.statusRow) g.ui.statusRow.style.display = 'none';
        g.ui.renderMessageLog();

        const choice = await g.ui.showMainMenu();
        if (choice === 0)       await playOneRun();
        else if (choice === 1)  await g.ui.showLearn();
        else if (choice === 2)  await g.ui.showHighScores(loadHighScores());
        else if (choice === 3)  await managementMenu();
        else {
            g.renderer.clearScreen();
            g.renderer.drawTextPanel(['Thanks for travelling.'], 90, 90, 140, 24);
            return;
        }
    }
}


async function managementMenu() {
    while (true) {
        const idx = await g.ui._menu('Management options', [
            `Default pace: ${g.gameState.pace.name}`,
            `Default rations: ${g.gameState.ration.name}`,
            'Reset high scores',
            'Back',
        ]);
        if (idx === 0)      g.gameState.pace   = await g.ui.showPaceMenu();
        else if (idx === 1) g.gameState.ration = await g.ui.showRationMenu();
        else if (idx === 2) {
            try { localStorage.removeItem('oregonTrailHighScores'); } catch (_) {}
            await g.ui.showMessage('High score table cleared.');
        }
        else return;
    }
}


async function playOneRun() {
    g.gameState.canvasLocked = true;
    g.renderer.drawWelcomeScreen();

    // Ask about resuming a saved game, matching the DOS prompt at
    // image 0x02128 ("Would you like to continue a saved game?").
    // Only offered when localStorage has a save.
    let saved = null;
    try {
        if (localStorage.getItem('oregonTrailSave')) {
            saved = GameState.load();
        }
    } catch (_) { /* localStorage denied -- ignore */ }

    if (saved) {
        const cont = await g.ui._menu(
            'Would you like to continue a saved game?',
            ['Yes, continue', 'No, start a new run'],
        );
        if (cont === 0) {
            g.gameState = saved;
            g.gameState.landmarks = LANDMARKS;
            g.ui.gameState = g.gameState;
            g.gameState.canvasLocked = false;
            g.gameState.phase = PHASE.TRAVELLING;
            if (g.ui.statusRow) g.ui.statusRow.style.display = '';
            g.ui.renderStatusRow();
            g.ui.renderMessageLog();
            await travelLoop();
            if (g.gameState.phase === PHASE.WIN) await showWinScreen();
            else                                 await showLossScreen();
            return;
        }
    }

    await g.ui.showMessage('Welcome - prepare your party for the Trail.');

    g.renderer.drawPartySetupScreen();
    const setup = await g.ui.showSetupFlow();
    g.gameState.applySetup(setup);
    g.gameState.phase = PHASE.SETUP;
    g.gameState.canvasLocked = false;

    g.gameState.phase = PHASE.STORE;
    const initialStore = new Store('Independence, Missouri', 1.0);
    await initialStore.run(g.gameState, g.ui);

    if (g.gameState.supplies.oxen <= 0) {
        await g.ui.showMessage(
            'You need at least one yoke of oxen to start travelling. Auto-buying 2 yokes.',
        );
        g.gameState.supplies.buy('OXEN', 2, 40);
    }

    g.gameState.phase = PHASE.TRAVELLING;
    if (g.ui.statusRow) g.ui.statusRow.style.display = '';
    g.ui.renderStatusRow();
    g.ui.renderMessageLog();

    g.gameState.currentLandmarkIndex = 0;
    g.gameState.justArrivedAtLandmark = true;
    g.renderer.drawScene('vga_P0');

    const startChoice = await g.ui._menu(
        'Independence, Missouri - you are ready to begin your journey.',
        ['Talk to people on the street', 'Look at the map', 'Set off on the trail!'],
    );
    if (startChoice === 0) await g.ui.showTalk();
    else if (startChoice === 1) {
        g.gameState.canvasLocked = true;
        g.renderer.drawMap(g.gameState);
        await g.ui.showMessage(`The trail is ${TRAIL_LENGTH_MILES} miles long.`);
        g.gameState.canvasLocked = false;
        g.renderer.drawScene('vga_P0');
    }
    g.gameState.justArrivedAtLandmark = false;

    await travelLoop();

    if (g.gameState.phase === PHASE.WIN) await showWinScreen();
    else                                 await showLossScreen();
}


async function travelLoop() {
    while (g.gameState.phase === PHASE.TRAVELLING) {
        g.gameState.canvasLocked = true;
        g.renderer.drawDailyMenu(g.gameState);
        g.ui.renderStatusRow();

        const choice = await g.ui.showDailyMenu();
        switch (choice) {
            case 0: {
                await g.renderer.animateTravel(g.gameState);
                await advanceOneDay();
                break;
            }
            case 1:
                g.gameState.canvasLocked = true;
                await g.ui.showSuppliesScreen();
                g.gameState.canvasLocked = false;
                break;
            case 2:
                g.gameState.canvasLocked = true;
                g.renderer.drawMap(g.gameState);
                await g.ui.showMessage(
                    `You have travelled ${g.gameState.totalMiles} of ${TRAIL_LENGTH_MILES} miles.`,
                );
                g.gameState.canvasLocked = false;
                break;
            case 3:
                g.gameState.pace = await g.ui.showPaceMenu();
                await g.ui.showMessage(`Pace set to ${g.gameState.pace.name}.`);
                break;
            case 4:
                g.gameState.ration = await g.ui.showRationMenu();
                await g.ui.showMessage(`Rations set to ${g.gameState.ration.name}.`);
                break;
            case 5: {
                const prev = g.gameState.pace;
                g.gameState.pace = PACE.REST;
                await advanceOneDay();
                g.gameState.pace = prev;
                break;
            }
            case 6:
                await g.ui.showMessage('No traders on this stretch of trail.');
                break;
            case 7:
                // The eighth menu slot flips between "Talk to people" (at a
                // landmark) and "Hunt for food" (on the trail), per DOS
                // gate at image 0x4109.
                if (g.gameState.justArrivedAtLandmark) await g.ui.showTalk();
                else                                    await runHunt();
                break;
        }

        if (g.gameState.countAlive() === 0) {
            g.gameState.phase = PHASE.GAMEOVER;
            return;
        }
        if (hasArrivedAtNextLandmark(g.gameState)) {
            await arriveAtLandmark();
            if (g.gameState.currentLandmarkIndex >= LANDMARKS.length - 1) {
                g.gameState.phase = PHASE.WIN;
                return;
            }
        }
    }
}


async function advanceOneDay() {
    g.gameState.justArrivedAtLandmark = false;

    const miles = calculateMilesPerDay(g.gameState);
    g.gameState.totalMiles += miles;
    if (miles > 0)  g.gameState.addMessage(`Travelled ${miles} miles.`);
    else if (g.gameState.pace === PACE.REST)
                    g.gameState.addMessage('Rested for the day.');

    g.events.daily(g.gameState);
    const food = g.events.tickFood(g.gameState);
    g.events.tickHealth(g.gameState, food.ranOut);
    g.gameState.advanceCalendar();

    g.ui.renderMessageLog();
    g.ui.renderStatusRow();
}


async function arriveAtLandmark() {
    // Move to the landmark we just crossed the mile-marker of. This
    // uses the current fork choice (set by prior fork prompt).
    const prev = LANDMARKS[g.gameState.currentLandmarkIndex];
    const nextIdx = (g.gameState.nextIndexOverride != null)
        ? g.gameState.nextIndexOverride
        : prev.next;
    g.gameState.currentLandmarkIndex = nextIdx;
    g.gameState.nextIndexOverride = null;

    const lm = LANDMARKS[g.gameState.currentLandmarkIndex];
    g.gameState.totalMiles = lm.miles;
    g.gameState.daysSinceLandmark = 0;
    g.gameState.justArrivedAtLandmark = true;

    g.renderer.drawScene(lm.image);
    await g.ui.showLandmarkArrival(lm);

    // Fork prompt: from proc_02FD4 in oregon.asm. Only shown when the
    // current landmark has [+0x1E] != 0 -- our `.alt` field.
    if (hasFork(g.gameState)) {
        const altLm = LANDMARKS[lm.alt];
        const nextLm = LANDMARKS[lm.next];
        const forkIdx = await g.ui._menu(
            `The trail divides here. You may:`,
            [
                `Head for ${nextLm.name}`,
                `Head for ${altLm.name}`,
                `See the map`,
            ],
        );
        if (forkIdx === 2) {
            g.gameState.canvasLocked = true;
            g.renderer.drawMap(g.gameState);
            await g.ui.showMessage('The trail is shown on the map.');
            g.gameState.canvasLocked = false;
            g.renderer.drawScene(lm.image);
            // Ask again after showing the map.
            const again = await g.ui._menu(
                `The trail divides here. You may:`,
                [`Head for ${nextLm.name}`, `Head for ${altLm.name}`],
            );
            g.gameState.nextIndexOverride = (again === 0) ? lm.next : lm.alt;
        } else {
            g.gameState.nextIndexOverride = (forkIdx === 0) ? lm.next : lm.alt;
        }
    }

    if (lm.isRiver) {
        g.gameState.phase = PHASE.RIVER;
        const river = new RiverCrossing(lm.name, lm.fordType, 2 + rng.random01() * 4);
        await river.run(g.gameState, g.ui);
        g.gameState.phase = PHASE.TRAVELLING;
    } else if (lm.isFort) {
        const visit = await g.ui._menu(
            `${lm.name} - Do you want to visit the store?`,
            ['Yes, visit the store', 'No, continue'],
        );
        if (visit === 0) {
            g.gameState.phase = PHASE.STORE;
            // Forts charge ~50% more -- HYPOTHESIS.
            const store = new Store(lm.name, 1.5);
            await store.run(g.gameState, g.ui);
            g.gameState.phase = PHASE.TRAVELLING;
        }
    }
}


async function runHunt() {
    if (g.gameState.supplies.ammunition <= 0) {
        return g.ui.showMessage('You have no ammunition.');
    }
    if (g.gameState.currentLandmarkIndex === 0) {
        // Docs/03: hunting is only offered *away* from a landmark; at
        // the start we allow it after departure.
    }
    g.gameState.phase = PHASE.HUNTING;
    await g.ui.showMessage(
        'Keypad 1-9 = aim, Enter = walk/stop, Space = fire, Esc = stop.',
    );
    const hunt = new HuntingGame(g.canvas, g.renderer, g.gameState);
    const result = await hunt.start();
    g.gameState.phase = PHASE.TRAVELLING;

    const cap = HUNT_MAX_CARRY_LBS;
    const carried = Math.min(result.meat, cap);
    const summary = carried > 0
        ? `You brought back ${carried} lb of meat` +
          (result.meat > cap ? ` (${result.meat - cap} lb left behind).` : '.')
        : `Empty-handed (${result.shotsFired} shots, ${result.hits} hits).`;
    g.gameState.addMessage(summary);
    await g.ui.showMessage(summary);
}


async function showWinScreen() {
    g.renderer.drawScene('vga_P17');
    await g.ui.showMessage(
        'You have reached the Willamette Valley! Congratulations.',
    );
    const score = calculateFinalScore(g.gameState);
    const lines = [
        `Survivors:  ${g.gameState.countAlive()} of ${g.gameState.party.length}`,
        `Health:     ${score.healthLabel}`,
        '',
        `Wagon:      ${score.breakdown.wagon}`,
        `Oxen:       ${score.breakdown.oxen}`,
        `Spare parts:${score.breakdown.spareParts}`,
        `Clothing:   ${score.breakdown.clothing}`,
        `Bullets:    ${score.breakdown.bullets}`,
        `Food:       ${score.breakdown.food}`,
        `Cash:       ${score.breakdown.cash}`,
        `Survivors:  ${score.breakdown.survivors}`,
        '-----------------',
        `Base:       ${score.base}`,
        `Multiplier: x${score.multiplier} (${g.gameState.occupation.name})`,
        `TOTAL:      ${score.total}`,
    ];
    await g.ui._displayLinesAndContinue('Final Score', lines);

    const name = await g.ui.promptInput(
        'Enter your name for the high-score table:',
        g.gameState.party[0].name,
    );
    const rank = checkHighScore(score.total, name);
    if (rank > 0) await g.ui.showMessage(`You placed #${rank} in the top ten!`);
    else           await g.ui.showMessage('You did not make the top ten.');
}


async function showLossScreen() {
    g.renderer.drawSceneLetterbox('vga_P0', '#000000');
    g.renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    g.renderer.ctx.fillRect(0, 0, g.renderer.width, g.renderer.height);

    const lines = [];
    for (const p of g.gameState.party) {
        if (!p.isAlive) lines.push(`${p.name}: ${p.causeOfDeath}`);
    }
    if (lines.length === 0) lines.push('The trail has been lost.');
    lines.push('');
    lines.push(`Made it ${g.gameState.totalMiles} of ${TRAIL_LENGTH_MILES} miles.`);

    await g.ui._displayLinesAndContinue('Your wagon train has perished.', lines);
}


// -----------------------------------------------------------------------------
// Expose the console hooks and start.
// -----------------------------------------------------------------------------

window.resetGame = resetGame;
window.selfTest = selfTest;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
