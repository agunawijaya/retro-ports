// =============================================================================
// main.js - Entry point and game loop
// =============================================================================
//
// Responsibilities:
//   - Load assets.
//   - Construct GameState, Renderer, UI, EventSystem, Store, RiverCrossing.
//   - Drive the high-level phase machine:
//
//       TITLE -> SETUP -> STORE -> TRAVELLING <-> LANDMARK
//                                  TRAVELLING <-> HUNTING
//                                  TRAVELLING <-> RIVER
//                  -> WIN / GAMEOVER -> TITLE
//
// Almost every UI step is awaited, so the flow reads top-down even though
// it spans many menus and screens.
// =============================================================================

import {
    ASSET_KEYS,
    TEXT,
    ILLNESS,
    PACE,
    RATION,
    TRAIL_LENGTH_MILES,
    HUNT_DURATION_SECONDS,
} from './constants.js';
import { AssetLoader } from './assets.js';
import { Renderer } from './renderer.js';
import { GameState, PHASE } from './state.js';
import {
    LANDMARKS,
    calculateMilesPerDay,
    hasArrivedAtNextLandmark,
} from './trail.js';
import { EventSystem } from './events.js';
import { UI } from './ui.js';
import { Store } from './store.js';
import { RiverCrossing } from './river.js';
import { HuntingGame } from './hunting.js';
import {
    calculateFinalScore,
    loadHighScores,
    checkHighScore,
} from './scoring.js';


// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

async function bootstrap() {
    const canvas = document.getElementById('game-canvas');
    const assets = new AssetLoader();
    const renderer = new Renderer(canvas, assets);

    // Initial "Loading..." splash on the canvas before assets are ready.
    renderer.clearScreen('#000000');
    renderer.drawTextPanel(['Loading assets...'], 80, 90, 160, 24);

    await assets.loadAll((done, total) => {
        renderer.clearScreen('#000000');
        renderer.drawTextPanel(
            [`Loading assets... ${done}/${total}`],
            80, 90, 160, 24,
        );
    });

    // Set up state and helpers.
    const gameState = new GameState();
    gameState.landmarks = LANDMARKS;

    const ui = new UI(renderer, gameState);
    const events = new EventSystem();

    // FIX 1+6 (animation): one requestAnimationFrame loop drives the
    // wagon walk on the TITLE and TRAVELLING screens. Frame index lives
    // here rather than inside the renderer so the same value can be
    // sampled by both screens without each screen owning its own timer.
    let wagonFrame = 0;
    let lastWagonTick = 0;
    const FRAME_MS = 300;
    function animationTick(ts) {
        if (ts - lastWagonTick > FRAME_MS) {
            wagonFrame = (wagonFrame + 1) % 3;
            lastWagonTick = ts;
            // FIX 4: canvasLocked is set while a modal screen (map,
            // supplies, landmark) is up, so we don't overdraw it.
            if (!gameState.canvasLocked) {
                if (gameState.phase === PHASE.TITLE) {
                    renderer.drawMainMenu(wagonFrame);
                } else if (gameState.phase === PHASE.TRAVELLING) {
                    renderer.drawTravelScreen(gameState, wagonFrame);
                }
            }
        }
        requestAnimationFrame(animationTick);
    }
    requestAnimationFrame(animationTick);

    // Kick off the main loop. This function never returns under normal
    // play - it loops back to the title screen at the end of a run.
    runGame(canvas, renderer, assets, gameState, ui, events).catch((err) => {
        console.error('Game loop crashed:', err);
    });
}


// -----------------------------------------------------------------------------
// Top-level game loop
// -----------------------------------------------------------------------------

async function runGame(canvas, renderer, assets, gameState, ui, events) {
    while (true) {
        gameState.phase = PHASE.TITLE;
        // FIX (image-mapping): drawScene(LOGO) stretched the MECC publisher
        // logo to fill the canvas. drawMainMenu() now composes the real
        // "The Oregon Trail" banner (in vga_TERRAIN), a wagon silhouette,
        // and the MECC logo small at the bottom - i.e. an actual title
        // screen rather than just a publisher splash.
        renderer.drawMainMenu();

        // Make sure the status row hides itself when on the title screen
        // (otherwise a previous run's row would linger).
        if (ui.statusRow) ui.statusRow.style.display = 'none';

        ui.renderMessageLog();

        const choice = await ui.showMainMenu();
        // TEXT.mainMenu: 0 Travel, 1 Learn, 2 Top Ten, 3 Management, 4 End

        if (choice === 0) {
            await playOneRun(canvas, renderer, assets, gameState, ui, events);
        } else if (choice === 1) {
            await ui.showLearn();
        } else if (choice === 2) {
            await ui.showHighScores(loadHighScores());
        } else if (choice === 3) {
            await managementMenu(gameState, ui);
        } else {
            // End - clear the canvas and stop.
            renderer.clearScreen();
            renderer.drawTextPanel(['Thanks for travelling.'], 90, 90, 140, 24);
            return;
        }
    }
}


// -----------------------------------------------------------------------------
// Management menu (volume / pace defaults / etc.)
// -----------------------------------------------------------------------------
//
// A token submenu - the original game lived here for input devices and
// sound. We provide pace and ration defaults as a token "options" surface
// so the menu is not dead end.

async function managementMenu(gameState, ui) {
    while (true) {
        const idx = await ui._menu(
            'Management options',
            [
                `Default pace: ${gameState.pace.name}`,
                `Default rations: ${gameState.ration.name}`,
                'Reset high scores',
                'Back',
            ],
        );
        if (idx === 0) gameState.pace = await ui.showPaceMenu();
        else if (idx === 1) gameState.ration = await ui.showRationMenu();
        else if (idx === 2) {
            try { localStorage.removeItem('oregonTrailHighScores'); } catch (_) {}
            await ui.showMessage('High score table cleared.');
        }
        else return;
    }
}


// -----------------------------------------------------------------------------
// One full run: setup -> store -> travel -> ending
// -----------------------------------------------------------------------------

async function playOneRun(canvas, renderer, assets, gameState, ui, events) {
    // FIX 2 (welcome -> FAMILY): after the asset rename, vga_FAMILY is
    // the actual family-with-wagon scene (320x126), so the welcome
    // screen finally uses the right asset via drawWelcomeScreen().
    gameState.canvasLocked = true;
    renderer.drawWelcomeScreen();
    await ui.showMessage('Welcome - prepare your party for the Trail.');

    // ---- Setup ----
    // FIX 3 (party setup background): show the FAMILY backdrop with a
    // dark band at the bottom while the player works through the
    // setup-flow prompts in the DOM panel below.
    renderer.drawPartySetupScreen();
    const setup = await ui.showSetupFlow();
    gameState.applySetup(setup);
    gameState.phase = PHASE.SETUP;
    gameState.canvasLocked = false;

    // ---- Initial store ----
    gameState.phase = PHASE.STORE;
    const initialStore = new Store('Independence, Missouri', 1.0);
    await initialStore.run(gameState, ui);

    // Make sure they bought at least 1 ox - otherwise the wagon cannot move.
    if (gameState.supplies.oxen <= 0) {
        await ui.showMessage(
            'You need at least one yoke of oxen to start travelling. Auto-buying 2 yokes.',
        );
        gameState.supplies.buy('OXEN', 2, 40);
    }

    // ---- Travel ----
    gameState.phase = PHASE.TRAVELLING;
    if (ui.statusRow) ui.statusRow.style.display = '';
    ui.renderStatusRow();
    ui.renderMessageLog();

    // FIX: Tampilkan vga_P0 (Independence, Missouri) dan tahan di sana.
    // Player harus memilih apa yang ingin dilakukan sebelum mulai jalan.
    // Ini mensimulasikan "You are at Independence, Missouri" dari game asli.
    gameState.currentLandmarkIndex  = 0;
    gameState.justArrivedAtLandmark = true;
    renderer.drawScene('vga_P0');

    // Menu pilihan di Independence — sebelum mulai trail
    const independenceChoice = await ui._menu(
        'Independence, Missouri — You are ready to begin your journey.',
        [
            'Talk to people on the street',
            'Look at the map',
            'Set off on the trail!',
        ],
    );

    if (independenceChoice === 0) {
        await ui.showTalk();
    } else if (independenceChoice === 1) {
        gameState.canvasLocked = true;
        renderer.drawMap(gameState);
        await ui.showMessage(`The trail is ${TRAIL_LENGTH_MILES} miles long.`);
        gameState.canvasLocked = false;
        renderer.drawScene('vga_P0');
    }
    // Choice 2 atau setelah talk/map: langsung mulai trail
    gameState.justArrivedAtLandmark = false;

    await travelLoop(canvas, renderer, assets, gameState, ui, events);

    // ---- Ending ----
    if (gameState.phase === PHASE.WIN) {
        await showWinScreen(renderer, ui, gameState);
    } else {
        await showLossScreen(renderer, ui, gameState);
    }
}


// -----------------------------------------------------------------------------
// The travel loop
// -----------------------------------------------------------------------------
//
// One iteration corresponds to "one in-game day plus its menu interaction".
//
// Sequence:
//   1. Player picks a daily action (continue, check supplies, etc.).
//   2. If they continued, we run a day:
//        - advance miles (calculateMilesPerDay)
//        - roll an event and apply it
//        - tick food and party health
//        - advance the calendar
//   3. After each day check for arrival at the next landmark or victory.
//
// The loop terminates when the entire party dies (GAMEOVER) or the wagon
// reaches the Willamette Valley (WIN).

async function travelLoop(canvas, renderer, assets, gameState, ui, events) {
    // FIX 6 (daily-menu backdrop): the daily menu now shows the current
    // landmark scene with a dark overlay band. We paint it once before
    // each menu prompt and set canvasLocked=true so the bootstrap rAF
    // tick doesn't overdraw it with the animated travel screen.

    while (gameState.phase === PHASE.TRAVELLING) {
        gameState.canvasLocked = true;
        renderer.drawDailyMenu(gameState);
        ui.renderStatusRow();

        const choice = await ui.showDailyMenu();
        // dailyMenu order:
        //   0 Continue, 1 Check supplies, 2 Look at map, 3 Change pace,
        //   4 Change rations, 5 Stop to rest, 6 Attempt to trade,
        //   7 Talk to people, 8 Hunt for food.

        switch (choice) {
            case 0: {                   // Continue on trail
                // FIX 7: play the wagon-traversal animation first so the
                // player sees the day happen. canvasLocked is already
                // true (set at the top of the while loop). The
                // animation paints its own backdrop each frame, so the
                // landmark scene from drawDailyMenu is replaced for the
                // duration of the animation.
                await renderer.animateTravel(gameState);
                await advanceOneDay(gameState, ui, events);
                break;
            }

            case 1:                     // Check supplies
                // FIX 4: lock canvas while the supplies grid is up so
                // the wagon animation does not paint over it.
                gameState.canvasLocked = true;
                await ui.showSuppliesScreen();
                gameState.canvasLocked = false;
                break;

            case 2:                     // Look at the map
                // FIX 4: same canvas-lock pattern for the map screen.
                gameState.canvasLocked = true;
                renderer.drawMap(gameState);
                await ui.showMessage(
                    `You have travelled ${gameState.totalMiles} of ${TRAIL_LENGTH_MILES} miles.`,
                );
                gameState.canvasLocked = false;
                break;

            case 3:                     // Change pace
                gameState.pace = await ui.showPaceMenu();
                await ui.showMessage(`Pace set to ${gameState.pace.name}.`);
                break;

            case 4:                     // Change rations
                gameState.ration = await ui.showRationMenu();
                await ui.showMessage(`Rations set to ${gameState.ration.name}.`);
                break;

            case 5:                     // Stop to rest (1 day)
                gameState.pace = PACE.REST;
                await advanceOneDay(gameState, ui, events);
                gameState.pace = PACE.STEADY;
                break;

            case 6:                     // Attempt to trade
                await attemptTrade(gameState, ui);
                break;

            case 7:                     // Talk to people
                await ui.showTalk();
                break;

            case 8:                     // Hunt for food
                await runHunt(canvas, renderer, gameState, ui);
                break;
        }

        // After every menu choice check for arrival / death / win.
        if (gameState.countAlive() === 0) {
            gameState.phase = PHASE.GAMEOVER;
            return;
        }

        if (hasArrivedAtNextLandmark(gameState)) {
            await arriveAtLandmark(gameState, renderer, ui);
            // If the landmark we just hit was the final one, we are done.
            if (gameState.currentLandmarkIndex >= LANDMARKS.length - 1) {
                gameState.phase = PHASE.WIN;
                return;
            }
        }
    }
}


// -----------------------------------------------------------------------------
// advanceOneDay - the per-day mechanics
// -----------------------------------------------------------------------------

async function advanceOneDay(gameState, ui, events) {
    // FIX 4: clear the landmark-arrival flag at the start of each new
    // travel day so the daily-menu backdrop returns to generic scenery
    // until the next arrival.
    gameState.justArrivedAtLandmark = false;

    // 1. Add miles. REST contributes 0.
    const milesToday = calculateMilesPerDay(gameState);
    gameState.totalMiles += milesToday;
    if (milesToday > 0) {
        gameState.addMessage(`Travelled ${milesToday} miles.`);
    } else if (gameState.pace === PACE.REST) {
        gameState.addMessage('Rested for the day.');
    }

    // 2. Roll and apply an event.
    const event = events.rollDailyEvent(gameState);
    events.applyEvent(event, gameState);

    // 3. Consume food.
    events.tickFood(gameState);

    // 4. Health tick (illnesses, pace, ration).
    events.tickPartyHealth(gameState);

    // 5. Advance calendar.
    gameState.advanceCalendar();

    ui.renderMessageLog();
    ui.renderStatusRow();
}


// -----------------------------------------------------------------------------
// arriveAtLandmark
// -----------------------------------------------------------------------------
//
// The wagon reached a landmark. We:
//   1. Update currentLandmarkIndex.
//   2. Snap totalMiles to the landmark's mile so we do not over-shoot.
//   3. Show the landmark's PNG.
//   4. If it is a river, run the crossing.
//      If it is a fort, offer to visit the store.
//      Otherwise just announce arrival.

async function arriveAtLandmark(gameState, renderer, ui) {
    gameState.currentLandmarkIndex += 1;
    const lm = LANDMARKS[gameState.currentLandmarkIndex];
    gameState.totalMiles = lm.miles;       // snap so reports are exact

    // FIX 4: mark the arrival so the next daily-menu backdrop paints
    // the landmark scene rather than the generic travel scenery.
    gameState.justArrivedAtLandmark = true;

    renderer.drawScene(lm.image);
    await ui.showLandmarkArrival(lm);

    if (lm.isRiver) {
        gameState.phase = PHASE.RIVER;
        const river = new RiverCrossing(lm.name, 3 + Math.random() * 3);
        await river.run(gameState, ui);
        gameState.phase = PHASE.TRAVELLING;
    } else if (lm.isFort) {
        const visit = await ui._menu(
            `${lm.name} - Do you want to visit the store?`,
            ['Yes, visit the store', 'No, continue'],
        );
        if (visit === 0) {
            gameState.phase = PHASE.STORE;
            // Forts charge ~50% more than Independence.
            const store = new Store(lm.name, 1.5);
            await store.run(gameState, ui);
            gameState.phase = PHASE.TRAVELLING;
        }
    }
}


// -----------------------------------------------------------------------------
// Trading (a simple swap with strangers on the trail)
// -----------------------------------------------------------------------------
//
// CONFIRMED in design: the original game offered occasional barter chances.
// We surface a small menu of plausible trades that consume one resource
// and produce another. All HYPOTHESIS in pricing.

async function attemptTrade(gameState, ui) {
    const offers = [
        { ask: { item: 'food', qty: 20 }, give: { item: 'ammunition', qty: 30 },
          text: 'A trapper offers 30 rounds of ammo for 20 lb of food.' },
        { ask: { item: 'ammunition', qty: 25 }, give: { item: 'food', qty: 25 },
          text: 'A pioneer offers 25 lb of food for 25 rounds of ammo.' },
        { ask: { item: 'cash', qty: 20 }, give: { item: 'oxen', qty: 1 },
          text: 'A drover offers a fresh ox for $20.' },
    ];
    const pick = offers[Math.floor(Math.random() * offers.length)];
    const idx = await ui._menu(pick.text, ['Accept', 'Decline']);
    if (idx !== 0) {
        await ui.showMessage('You declined the trade.');
        return;
    }

    // Validate we have the asking-side resource.
    const s = gameState.supplies;
    if (pick.ask.item === 'food'        && s.food < pick.ask.qty) {
        return ui.showMessage('You do not have enough food to trade.');
    }
    if (pick.ask.item === 'ammunition'  && s.ammunition < pick.ask.qty) {
        return ui.showMessage('You do not have enough ammo to trade.');
    }
    if (pick.ask.item === 'cash'        && s.cash < pick.ask.qty) {
        return ui.showMessage('You do not have enough cash to trade.');
    }

    // Apply.
    s[pick.ask.item]  -= pick.ask.qty;
    s[pick.give.item] += pick.give.qty;
    await ui.showMessage('Trade complete!');
}


// -----------------------------------------------------------------------------
// runHunt
// -----------------------------------------------------------------------------

async function runHunt(canvas, renderer, gameState, ui) {
    if (gameState.supplies.ammunition <= 0) {
        return ui.showMessage('You have no ammunition.');
    }
    gameState.phase = PHASE.HUNTING;
    await ui.showMessage('Use the mouse to aim. Click to fire. (30 seconds)');
    const hunt = new HuntingGame(canvas, renderer, gameState);
    const result = await hunt.start();
    gameState.phase = PHASE.TRAVELLING;

    const summary = result.meat > 0
        ? `You brought back ${result.meat} lb of meat (${result.hits} hits / ${result.shotsFired} shots).`
        : `You returned empty-handed (${result.shotsFired} shots, ${result.hits} hits).`;
    gameState.addMessage(summary);
    await ui.showMessage(summary);
}


// -----------------------------------------------------------------------------
// Win / Loss screens
// -----------------------------------------------------------------------------

async function showWinScreen(renderer, ui, gameState) {
    renderer.drawScene('vga_P17');
    await ui.showMessage(
        'You have reached the Willamette Valley! Congratulations.',
    );

    const score = calculateFinalScore(gameState);
    const lines = [
        `Survivors: ${gameState.countAlive()} of ${gameState.party.length}`,
        `Cash:      ${score.breakdown.cash}`,
        `Food:      ${score.breakdown.food}`,
        `Ammo:      ${score.breakdown.ammo}`,
        `Oxen:      ${score.breakdown.oxen}`,
        `Clothing:  ${score.breakdown.clothing}`,
        `Parts:     ${score.breakdown.spareParts}`,
        `Survivors: ${score.breakdown.survivors}`,
        '-----------------',
        `Base:       ${score.base}`,
        `Multiplier: x${score.multiplier} (${gameState.occupation.name})`,
        `TOTAL:      ${score.total}`,
    ];
    await ui._displayLinesAndContinue('Final Score', lines);

    const name = await ui.promptInput('Enter your name for the high-score table:', gameState.party[0].name);
    const rank = checkHighScore(score.total, name);
    if (rank > 0) {
        await ui.showMessage(`You placed #${rank} in the top ten!`);
    } else {
        await ui.showMessage('You did not make the top ten. Better luck next time.');
    }
}


async function showLossScreen(renderer, ui, gameState) {
    // FIX (image-mapping): vga_EVENTS is a strip of supply-item icons,
    // not a sad fullscreen scene. Use a landmark P0 image (Independence)
    // letterboxed under a dark overlay so the "your party perished"
    // headline still reads.
    renderer.drawSceneLetterbox('vga_P0', '#000000');
    // Darken the image so the failure text reads clearly.
    renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    renderer.ctx.fillRect(0, 0, renderer.width, renderer.height);

    const lines = [];
    for (const p of gameState.party) {
        if (!p.isAlive) lines.push(`${p.name}: ${p.causeOfDeath}`);
    }
    if (lines.length === 0) lines.push('The trail has been lost.');
    lines.push('');
    lines.push(`Made it ${gameState.totalMiles} of ${TRAIL_LENGTH_MILES} miles.`);

    await ui._displayLinesAndContinue('Your wagon train has perished.', lines);
}


// -----------------------------------------------------------------------------
// Kick everything off when the DOM is ready.
// -----------------------------------------------------------------------------

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
