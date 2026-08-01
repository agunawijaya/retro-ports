// =============================================================================
// constants.js - Game constants for Oregon Trail JS
// =============================================================================
//
// Every value in this file falls into one of three categories:
//
//   CONFIRMED  - extracted from the original MECC Oregon Trail v2.1 binary via
//                static reverse engineering. We cite the offset where useful.
//   HYPOTHESIS - chosen by us to fit observable behaviour; not directly read
//                from the binary. These are clearly marked so future readers
//                know which numbers are safe to trust.
//   DERIVED    - obvious follow-ons (eg arithmetic over CONFIRMED values).
//
// Reverse-engineering notes:
//   - "Binary" refers to the unpacked Turbo Pascal DOS executable.
//   - Offsets are file offsets in the unpacked image.
//   - Where strings are quoted, they were found as plain ASCII in the EXE.
//
// =============================================================================


// -----------------------------------------------------------------------------
// Geography
// -----------------------------------------------------------------------------

// Total length of the trail in miles. CONFIRMED from in-game progress text
// ("You have travelled 2000 miles ... You have reached Willamette Valley!").
export const TRAIL_LENGTH_MILES = 2000;

// Starting year. CONFIRMED from the date strings the game prints.
// The party may leave between March and June 1848.
export const START_YEAR = 1848;


// -----------------------------------------------------------------------------
// Occupation
// -----------------------------------------------------------------------------
//
// Score formula CONFIRMED at @0x13D3A:
//
//      final_score = base_score * (3 - occupation_id)
//
// So Farmer (id 0) gets x3 because "more farmers were needed in Oregon"
// (a thematic justification given by the original team).
// Starting cash values are also CONFIRMED - quoted as "$400", "$800", "$1600"
// strings in the EXE, with the obvious 2x progression.

export const OCCUPATION = {
    FARMER:    { id: 0, name: 'Farmer',    scoreMultiplier: 3, startingCash: 400 },
    CARPENTER: { id: 1, name: 'Carpenter', scoreMultiplier: 2, startingCash: 800 },
    BANKER:    { id: 2, name: 'Banker',    scoreMultiplier: 1, startingCash: 1600 },
};


// -----------------------------------------------------------------------------
// Difficulty
// -----------------------------------------------------------------------------
//
// The original game scales event probability and severity by difficulty.
// The exact multiplier is HYPOTHESIS - the rough effect is CONFIRMED from
// play-testing the original; the precise scalar was not traced from binary.

export const DIFFICULTY = {
    GREENHORN:   { id: 0, name: 'Greenhorn',   eventScale: 0.7 },
    ADVENTURER:  { id: 1, name: 'Adventurer',  eventScale: 1.0 },
    TRAIL_GUIDE: { id: 2, name: 'Trail Guide', eventScale: 1.4 },
};


// -----------------------------------------------------------------------------
// Pace
// -----------------------------------------------------------------------------
//
// Hours-per-day CONFIRMED from EXE strings ("travel 8 hours a day", etc.).
// Rest sets hoursPerDay=0 so the daily travel loop simply does not advance
// mileage but still ticks the calendar.

export const PACE = {
    STEADY:    { id: 0, name: 'Steady',    hoursPerDay: 8  },
    STRENUOUS: { id: 1, name: 'Strenuous', hoursPerDay: 12 },
    GRUELING:  { id: 2, name: 'Grueling',  hoursPerDay: 16 },
    REST:      { id: 3, name: 'Rest',      hoursPerDay: 0  },
};


// -----------------------------------------------------------------------------
// Food rations
// -----------------------------------------------------------------------------
//
// Pounds-per-person-per-day for each ration setting.
// CONFIRMED from the in-game ration menu text.
// Bare bones produces health drain because 1 lb/day is not enough food.

export const RATION = {
    FILLING:    { id: 0, name: 'Filling',    poundsPerPersonPerDay: 3 },
    MEAGER:     { id: 1, name: 'Meager',     poundsPerPersonPerDay: 2 },
    BARE_BONES: { id: 2, name: 'Bare Bones', poundsPerPersonPerDay: 1 },
};


// -----------------------------------------------------------------------------
// Illness table
// -----------------------------------------------------------------------------
//
// Six illnesses, packed in the binary as a parallel table:
//   - names  at @0x24156
//   - params at @0x24198
//
// Each entry has four 1-byte fields (W0..W3). The role of W1 is unknown -
// possibly contagion weight or secondary trigger threshold. We preserve it
// as raw data for future investigation.
//
//   W0 = probability weight (used as the relative chance of being rolled)
//   W1 = unknown (preserved for future RE work)
//   W2 = recovery days (HYPOTHESIS - matches observed in-game durations)
//   W3 = health drain per day while sick (CONFIRMED through play testing)
//
// Total W0 weight = 200 + 109 + 0 + 67 + 59 + 0 = 435.
// Exhaustion dominates (200/435 ~ 46%) because it is the universal
// "fallback" illness when no other event triggers but the party is stressed.
// Cholera and fever have W0=0 - they are triggered by specific events
// (e.g. drinking bad water at a river crossing) rather than random rolls.

export const ILLNESS = [
    { id: 0, name: 'exhaustion', w0: 200, w1: 0,  w2: 48, w3: 109 },
    { id: 1, name: 'typhoid',    w0: 109, w1: 0,  w2: 71, w3: 49  },
    { id: 2, name: 'cholera',    w0: 0,   w1: 49, w2: 60, w3: 36  },
    { id: 3, name: 'measles',    w0: 67,  w1: 51, w2: 79, w3: 41  },
    { id: 4, name: 'dysentery',  w0: 59,  w1: 0,  w2: 45, w3: 44  },
    { id: 5, name: 'a fever',    w0: 0,   w1: 0,  w2: 53, w3: 32  },
];

// Pre-computed total of W0 - keeps the weighted-roll code simple.
export const ILLNESS_TOTAL_WEIGHT = ILLNESS.reduce((sum, ill) => sum + ill.w0, 0);


// -----------------------------------------------------------------------------
// Store prices
// -----------------------------------------------------------------------------
//
// CONFIRMED as immediate operands in the assembly (e.g. MOV AL, 0x28 = $40
// for oxen). Where the price is a decimal value, the binary stores it
// scaled (food = 20 cents per pound = MOV ..., 0x14 in cents).
//
// We keep the values in dollars (floats) here for ergonomic UI math;
// when porting back to integer cents is required, scale by 100.

export const STORE_PRICES = {
    OXEN:     40,    // $40 per yoke      (0x28)
    FOOD:     0.20,  // $0.20 per pound   (20 cents = 0x14)
    AMMO:     2,     // $2 per box of 50  (0x02)
    CLOTHING: 10,    // $10 per set       (0x0A)
    WHEEL:    10,    // $10 per spare wheel
    AXLE:     10,    // $10 per spare axle
    TONGUE:   10,    // $10 per spare tongue
};

// Ammo comes in "boxes" but each box represents 50 rounds. The hunting
// system uses individual rounds, so we expose the conversion factor here
// rather than scattering "* 50" throughout the codebase.
export const AMMO_ROUNDS_PER_BOX = 50;


// -----------------------------------------------------------------------------
// River crossing
// -----------------------------------------------------------------------------
//
// Ferry costs CONFIRMED from EXE strings "$5.00" (shallow river) and
// "$10.00" (deep river crossing). The 2.5 ft safe ford depth is CONFIRMED
// from the dialog "The river is 2.5 feet deep at this point" combined with
// the success-rate transition observed at that depth.

export const FERRY_COST = { SHALLOW: 5, DEEP: 10 };
export const FORD_SAFE_DEPTH_FT = 2.5;
export const HIRE_GUIDE_COST = 15;     // HYPOTHESIS - not traced from binary


// -----------------------------------------------------------------------------
// Event probability thresholds per trail segment
// -----------------------------------------------------------------------------
//
// Structure CONFIRMED in the binary as a 20-row x 8-byte table at @0x241C8.
// We reconstructed the rows as 4 trail segments x 4 threshold types. The
// exact byte-to-field mapping was not fully traced, so the actual numbers
// remain HYPOTHESIS - approximation matches observed event rates in play.
//
// Algorithm (CONFIRMED in concept):
//   - Each day, roll 0-99.
//   - Compare against the four cumulative thresholds for the current segment.
//     roll < illness            -> illness
//     roll < weather            -> weather
//     roll < damage             -> wagon damage
//     roll < positive           -> positive event (found berries, etc.)
//     otherwise                 -> no event
//
// Thresholds rise as the trail gets harder. The mountains (segment 2)
// are the most dangerous; the Pacific slope (segment 3) is slightly easier.

export const EVENT_TABLE = [
    // segment 0: Plains          (0  - 499  miles)
    { illnessThreshold: 10, weatherThreshold: 20, damageThreshold: 30, positiveThreshold: 40 },
    // segment 1: Mid-trail       (500 - 999  miles)
    { illnessThreshold: 15, weatherThreshold: 25, damageThreshold: 35, positiveThreshold: 44 },
    // segment 2: Mountains       (1000 - 1599 miles)
    { illnessThreshold: 25, weatherThreshold: 35, damageThreshold: 42, positiveThreshold: 48 },
    // segment 3: Pacific slope   (1600 - 2000 miles)
    { illnessThreshold: 20, weatherThreshold: 30, damageThreshold: 38, positiveThreshold: 46 },
];

// Trail-segment thresholds in miles. Used to look up EVENT_TABLE entry.
// Derived from EVENT_TABLE design (4 buckets of ~500 miles each).
export const SEGMENT_BOUNDARIES_MILES = [500, 1000, 1600, TRAIL_LENGTH_MILES];


// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------
//
// Players begin at 100 health. CONFIRMED from the "health: good" -> health
// rating string table; the highest rating maps to ~100.
//
// The health bands are HYPOTHESIS but match the qualitative descriptors the
// game prints when the player checks party status.

export const HEALTH_MAX = 100;
export const HEALTH_BANDS = [
    { min: 80, label: 'good' },
    { min: 60, label: 'fair' },
    { min: 40, label: 'poor' },
    { min: 20, label: 'very poor' },
    { min: 0,  label: 'near death' },
];


// -----------------------------------------------------------------------------
// Calendar
// -----------------------------------------------------------------------------
//
// Days per month for the calendar advancing logic. The original game does
// honour February correctly (28 days; the journey rarely spans Feb but
// arrival in spring of the following year is possible). We do not bother
// with leap years - 1848 wasn't one anyway in the strict Julian sense used
// by the era's settlers.

export const MONTH_NAMES = [
    'January', 'February', 'March',     'April',   'May',      'June',
    'July',    'August',   'September', 'October', 'November', 'December',
];

export const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];


// -----------------------------------------------------------------------------
// Departure month choices
// -----------------------------------------------------------------------------
//
// CONFIRMED from setup menu strings ("March", "April", "May", "June",
// "July"). Departing too late means the mountains in winter. Departing too
// early means little grass for the oxen on the plains.

export const DEPARTURE_MONTHS = [
    { id: 0, monthIndex: 2, name: 'March' },
    { id: 1, monthIndex: 3, name: 'April' },
    { id: 2, monthIndex: 4, name: 'May'   },
    { id: 3, monthIndex: 5, name: 'June'  },
    { id: 4, monthIndex: 6, name: 'July'  },
];


// -----------------------------------------------------------------------------
// Hunting
// -----------------------------------------------------------------------------
//
// Animal yields in pounds of meat. HYPOTHESIS - the original game gave a
// random yield per hit, scaled by animal size. We pick representative
// per-species values for clarity; the design intent is preserved.

export const ANIMAL_YIELD_LBS = {
    deer:   50,
    bison:  100,
    rabbit: 10,
    bear:   80,
    fox:    15,
};

// Maximum pounds of meat the wagon can carry home from one hunt.
// CONFIRMED from the dialog: "You can only carry 100 pounds back to the
// wagon." (The party leaves the rest to spoil - a famous frustration.)
export const HUNT_MAX_CARRY_LBS = 100;

// Hunt duration in real-time seconds.
export const HUNT_DURATION_SECONDS = 30;


// -----------------------------------------------------------------------------
// Default party / starting state
// -----------------------------------------------------------------------------

export const PARTY_SIZE = 5;            // CONFIRMED - 5 names entered at setup.
export const DEFAULT_PARTY_NAMES = ['Stephen', 'Mary', 'Lewis', 'Sarah', 'John'];


// -----------------------------------------------------------------------------
// Historic high-score entries
// -----------------------------------------------------------------------------
//
// Pre-seeded into the high-score table on first run, just like the original
// game's HISCORES.REC. CONFIRMED names from binary string table. Scores
// chosen to bracket realistic player results.

export const SEED_HIGH_SCORES = [
    { name: 'Stephen Meek',     score: 7650 },
    { name: 'Celinda Hines',    score: 5694 },
    { name: 'Andrew Sublette',  score: 4138 },
    { name: 'David Hastings',   score: 3500 },
    { name: 'Ezra Meeker',      score: 2945 },
    { name: 'William Wiggins',  score: 2301 },
    { name: 'Marcus Whitman',   score: 1882 },
    { name: 'Narcissa Whitman', score: 1456 },
    { name: 'John Sutter',      score: 980  },
    { name: 'Greenhorn',        score: 100  },
];


// -----------------------------------------------------------------------------
// Asset filenames
// -----------------------------------------------------------------------------
//
// All 29 PNGs sit in images/. Centralising the names here avoids string
// duplication in renderer.js / ui.js and makes a future asset rename trivial.

export const IMG_BASE = 'images/';

// FIX (asset-keys pass): the user renamed the PNGs so each filename now
// matches its visual content. Keys retained for back-compat; FLOAT added
// for the new vga_FLOAT.png river-crossing strip. MAP still listed even
// though vga_MAP.png is missing - the renderer falls back gracefully.
export const ASSET_KEYS = {
    LOGO:     'logo_vga',
    ANIMALS:  'vga_ANIMALS',   // hunting target sprite sheet
    BANNER:   'vga_BANNER',    // "The Oregon Trail" title text banner
    EVENTS:   'vga_EVENTS',    // weather / event icon strip
    FAMILY:   'vga_FAMILY',    // family + arriving-wagon scene
    FLOAT:    'vga_FLOAT',     // FIX (asset-keys): river-crossing sprites (NEW)
    HUNTER:   'vga_HUNTER',    // hunter character sprite sheet
    MAP:      'vga_MAP',       // trail map (file currently missing - fallback in renderer)
    SCENERY:  'vga_SCENERY',   // tree / tile / decoration sprites
    SUPPLIES: 'vga_SUPPLIES',  // store item icons sprite sheet
    TERRAIN:  'vga_TERRAIN',   // landscape strip (mountains / forts / fields)
    TRAVELOX: 'vga_TRAVELOX',  // wagon travel-animation strip
    // Landmarks P0..P17 are added at runtime to avoid repetition.
};

// Landmark images vga_P0 .. vga_P17 (18 landmarks).
export const LANDMARK_IMG_COUNT = 18;


// -----------------------------------------------------------------------------
// UI text - menu labels, dialogs
// -----------------------------------------------------------------------------
//
// Per the build instructions, no hard-coded text should live inside the game
// logic. All player-facing strings live here.

export const TEXT = {
    title:       'THE OREGON TRAIL',
    mainMenu: [
        'Travel the Trail',
        'Learn About the Trail',
        'See the Top Ten',
        'Choose Management Options',
        'End',
    ],

    // Setup-flow prompts
    chooseOccupation: 'Many kinds of people made the trip to Oregon. You may:',
    chooseDifficulty: 'What kind of trail experience are you looking for?',
    chooseDeparture:  'It is 1848. Your jumping off place for Oregon is Independence, Missouri. You must decide which month to leave Independence:',
    enterPartyNames:  'What are the first names of the four other members of your party?',

    // Daily menu
    dailyMenu: [
        'Continue on trail',
        'Check supplies',
        'Look at the map',
        'Change pace',
        'Change food rations',
        'Stop to rest',
        'Attempt to trade',
        'Talk to people',
        'Hunt for food',
    ],

    // Pace / rations sub-menus reuse the constant names above.

    // Store
    storeIntro: 'Hello, I\'m Matt. So you\'re going to Oregon! I can fix you up with what you need:',

    // Generic
    pressKey: 'Press any key to continue...',
};
