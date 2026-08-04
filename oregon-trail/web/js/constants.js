// constants.js -- verified numbers from the binary, with an address beside
// every CONFIRMED entry.
//
// Three tags in this file:
//   CONFIRMED -- read from the unpacked image, address quoted
//   INFERRED  -- read from the image but with a step of interpretation
//   HYPOTHESIS-- our own, marked so it can be tuned safely
//
// Addresses are file offsets in the unpacked image, per docs/03-the-code.md.
// A `DS:` address is a data-segment offset; add 0x23480 to reach the file.


// -----------------------------------------------------------------------------
// Geography
// -----------------------------------------------------------------------------

// Sum of per-leg mile bytes (+0x1F) read from the 37-byte leg records
// at DS:0x896 in the unpacked image. tools/model.pas said 2040 as an
// approximation; the actual arithmetic sum is 2083. See trail.js for
// the per-leg breakdown and the two "fork" bytes at +0x20.
export const TRAIL_LENGTH_MILES = 2083;

// CONFIRMED via emulator run: the journey starts 1 March 1848
// (docs/03 "the first numbers out of the simulation").
export const START_YEAR = 1848;


// -----------------------------------------------------------------------------
// Occupation
// -----------------------------------------------------------------------------
//
// The multipliers come from the game's own explanation screen at 0x00C166:
// "double points ... as a carpenter, and triple points ... as a farmer."
// Banker gets no sentence and no multiplier -- that is x1.
// Starting cash CONFIRMED via emulator: banker = $1600. The others follow
// from the 400/800/1600 progression the setup screen quotes.

export const OCCUPATION = {
    FARMER:    { id: 0, name: 'Farmer',    scoreMultiplier: 3, startingCash: 400 },
    CARPENTER: { id: 1, name: 'Carpenter', scoreMultiplier: 2, startingCash: 800 },
    BANKER:    { id: 2, name: 'Banker',    scoreMultiplier: 1, startingCash: 1600 },
};


// -----------------------------------------------------------------------------
// Pace and rations
// -----------------------------------------------------------------------------
//
// Pace bytes CONFIRMED at DS:0x185D. The word table at DS:0x0C92 gives
// "steady", "strenuous", "grueling", printed from the shopkeeper's pace
// screen at 0x09DE0. The hours-per-day are on that screen.
//
// The travel formula that pace feeds into is at 0x003C5:
//     miles/day = rate x (pace + 2) / 2      -- ratio 1 : 1.5 : 2

export const PACE = {
    STEADY:    { id: 0, name: 'Steady',    hoursPerDay:  8 },
    STRENUOUS: { id: 1, name: 'Strenuous', hoursPerDay: 12 },
    GRUELING:  { id: 2, name: 'Grueling',  hoursPerDay: 16 },
    REST:      { id: 3, name: 'Rest',      hoursPerDay:  0 },  // not one of the byte values; the game handles a rest day by not advancing
};

// Rations byte CONFIRMED at DS:0x185E; word table at DS:0x0CB4:
// "filling", "meager", "bare bones". Pounds per person per day CONFIRMED
// at 0x0013D3A:  eaten = people x (3 - rations)  ->  3, 2, 1 lb.
export const RATION = {
    FILLING:    { id: 0, name: 'Filling',    poundsPerPersonPerDay: 3 },
    MEAGER:     { id: 1, name: 'Meager',     poundsPerPersonPerDay: 2 },
    BARE_BONES: { id: 2, name: 'Bare Bones', poundsPerPersonPerDay: 1 },
};


// -----------------------------------------------------------------------------
// Trail leg rates
// -----------------------------------------------------------------------------
//
// CONFIRMED via docs/03: legRate is a byte at +0x1C of each 37-byte record
// in the leg table at DS:0x08B2 (file 0x23D32). The rate is 20 on the
// plains (legs 0..4, Independence through Chimney Rock) and 12 from Fort
// Laramie west (legs 5..17). "The second half is not longer; it is slower."

export const LEG_RATE_PLAINS   = 20;   // legs 0..4
export const LEG_RATE_MOUNTAIN = 12;   // legs 5..17
export const LEG_RATE_TRANSITION_INDEX = 5;  // first leg with the low rate


// -----------------------------------------------------------------------------
// Illnesses
// -----------------------------------------------------------------------------
//
// The six illness names CONFIRMED at DS:0x0CD6 (file 0x23F56). The array
// is declared `array[3..8] of string[10]`, which is how the code at
// 0x013C6E adds a base of 0x0CB5 rather than 0x0CD6 -- see docs/03.
//
// Which illness the party gets is a flat `Random(6) + 3` at 0x013BC0.
// No weighting. So the "w0..w3" fields the prior port carried were
// HYPOTHESIS; the real model has none. We keep only the name and the id.

export const ILLNESS = [
    { id: 0, name: 'exhaustion' },
    { id: 1, name: 'typhoid'    },
    { id: 2, name: 'cholera'    },
    { id: 3, name: 'measles'    },
    { id: 4, name: 'dysentery'  },
    { id: 5, name: 'a fever'    },
];


// -----------------------------------------------------------------------------
// Store prices
// -----------------------------------------------------------------------------
//
// CONFIRMED from Matt's dialogue at 0x0DE5C -- the shopkeeper states every
// price. Only food is also a Real literal in the code (0.2 at 0x0E210);
// the rest are integer arithmetic.

export const STORE_PRICES = {
    OXEN:     40,       // $40 per yoke (2 oxen)          -- max 20 oxen
    FOOD:     0.20,     // $0.20 per pound                -- max 2000 lb
    AMMO:     2,        // $2 per box of 20 rounds        -- CONFIRMED
    CLOTHING: 10,       // $10 per set
    WHEEL:    10,       // $10 each                        \
    AXLE:     10,       // $10 each                         > max 3 spare parts total
    TONGUE:   10,       // $10 each                        /
};

// CONFIRMED via docs/03: box of ammunition is 20 rounds ("boxes of 20
// bullets"). The prior port used 50; that was wrong.
export const AMMO_ROUNDS_PER_BOX = 20;

// CONFIRMED via docs/03: the food cap is 2000 lb, from `cmp word [bp-2],
// 0x07D0` at 0x0E1FD, and the dialog "Your wagon may only carry 2000
// pounds of food."
export const FOOD_CAP_LB = 2000;

// CONFIRMED: max 20 oxen ("You may only take 20 oxen.")
export const OXEN_CAP = 20;

// CONFIRMED: 3 spare parts total ("Your wagon may only carry 3 wagon
// wheels/axles/tongues.")
export const SPARE_PARTS_CAP_TOTAL = 3;


// -----------------------------------------------------------------------------
// River crossing
// -----------------------------------------------------------------------------
//
// Ferry $5.00 flat -- CONFIRMED at image 0x04DCE (Real literal
// 83 00 00 00 00 20). Ford-safe depth 2.5 ft CONFIRMED at 0x045CE.
// The Shoshoni guide's cost is `Random(2)+2` sets of clothing (image
// 0x050E4-0x050ED); there is no fixed dollar price for a guide.
export const FERRY_COST = 5;
export const FORD_SAFE_DEPTH_FT = 2.5;


// -----------------------------------------------------------------------------
// Health
// -----------------------------------------------------------------------------
//
// CONFIRMED: health is a 6-byte Real at DS:0x1886, and it is a BADNESS
// score -- higher means worse. Not the 0..100 the prior port carried.
// The update at 0x14055:
//     if todayStrain > 0.5 or foodRan out then health := health + 0.2
//     else                                     health := health x 0.5
// so a healthy party has health near zero, and a suffering party has
// health approaching a couple of units. The casualty routine at 0x134D6
// takes odds = (health - 2.5) / (severity * 10) or (health - 3.0) / y.
//
// The strain that gates the two branches is at 0x13F63:
//     strain = max(0, alive/oxen - (5 - 2 * conditions))
//
// Health "bands" in the prior port (good/fair/poor/very poor at 80/60/40/20)
// were HYPOTHESIS. The game shows band words from a string table at
// DS:0x0C7B ("good", "fair", "poor", "very poor") but WHICH band the
// current health value falls into was not traced. We approximate: the
// lower health (the number) the healthier the party. Thresholds are ours.

// tools/model.pas Journey: `Health := 1.0`. The DOS initial value is
// not spelled out in docs/03, but model.pas -- which is explicitly
// annotated with the addresses it does and does not know -- carries
// this as the recovered starting value.
export const HEALTH_START = 1.0;
export const HEALTH_STRAIN_THRESHOLD = 0.5;   // the > 0.5 branch at 0x14075
export const HEALTH_BADNESS_INCREMENT = 0.2;  // Real literal at 0x1409E
export const HEALTH_DECAY = 0.5;              // Real literal at 0x14060
export const CASUALTY_SEVERITY_DIVISOR = 10;  // "severity * 10" at 0x484F

// Words CONFIRMED at DS:0x0C7B ("good\fair\poor\very poor"), values
// beside them at DS:0x0C94 ("500\400\300\200"). Thresholds INFERRED.
export const HEALTH_BANDS = [
    { max: 0.3, label: 'good',      scorePerSurvivor: 500 },
    { max: 0.8, label: 'fair',      scorePerSurvivor: 400 },
    { max: 1.5, label: 'poor',      scorePerSurvivor: 300 },
    { max: Infinity, label: 'very poor', scorePerSurvivor: 200 },
];


// -----------------------------------------------------------------------------
// Events -- the hazard level and its Bernoulli slots
// -----------------------------------------------------------------------------
//
// CONFIRMED via PROMPT-PORT.md and dispatcher at 0x2BD7: the events
// system is fifteen independent Bernoulli trials per day, walked in
// order until one handler sets [0x188D]. The odds table is at DS:0x188E
// (file 0x24D0E) but every entry is zero in the file -- the odds are
// recomputed daily from the party's state.
//
// Behind the trials is a hazard level that decays and is refilled while
// the party is within two days of a landmark:
//
//     [0x1867] = 0.97 x [0x1867] + [0x19AE]
//     [0x19AE] = 8.0 x (0.20 or 0.80, the larger with p = 0.30)
//                only while [0x19A4] < 2
//
// So the majority of days are quiet, with two-day bursts of trouble
// around each landmark. Some slots are genuine odds (0.05 rough trail,
// 0.15 wild fruit); others are switches written as 1.0 or 0.0.

export const HAZARD_DECAY = 0.97;         // 0x1867 line
export const HAZARD_REFILL_HIGH = 6.4;    // 8.0 x 0.80
export const HAZARD_REFILL_LOW  = 1.6;    // 8.0 x 0.20
export const HAZARD_REFILL_HIGH_P = 0.30; // "the larger with p = 0.30"
export const HAZARD_NEAR_LANDMARK_DAYS = 2;

// The fifteen slots, in dispatch order. Each has:
//   name  -- for the log
//   kind  -- 'illness', 'weather', 'damage', 'positive'
//   p     -- probability, either a fixed number or a function of gameState
//   apply -- effect on gameState
//
// The specific p values named in PROMPT-PORT.md are the ones we can
// pin: 0.05 rough trail, 0.15 wild fruit. Others are HYPOTHESIS scaled
// by the hazard.
//
// The names and effects are patterned on the game's own event
// vocabulary (broken wheel, snakebite, wild fruit, thief, ...) as
// listed in fan-recorded playthroughs; the p values that are not
// pinned CONFIRMED are marked HYPOTHESIS beside them.

export const EVENT_SLOTS = [
    // 0. rough trail -- CONFIRMED p = 0.05 (docs/03 "0.05 for a rough trail")
    { name: 'rough trail', kind: 'damage', p: 0.05,
      apply: (s) => { s.supplies.food = Math.max(0, s.supplies.food - 5); } },

    // 1. wild fruit -- CONFIRMED p = 0.15 (docs/03 "0.15 for wild fruit")
    { name: 'wild fruit', kind: 'positive', p: 0.15,
      apply: (s) => { s.supplies.food += 10; } },

    // 2. broken wagon wheel -- HYPOTHESIS p
    { name: 'wagon wheel broke', kind: 'damage', p: 0.03,
      apply: (s) => {
          if (s.supplies.spareWheels > 0) s.supplies.spareWheels--;
          else s.hazardLoss = (s.hazardLoss || 0) + 1;
      } },

    // 3. broken axle -- HYPOTHESIS p
    { name: 'wagon axle broke', kind: 'damage', p: 0.02,
      apply: (s) => {
          if (s.supplies.spareAxles > 0) s.supplies.spareAxles--;
          else s.hazardLoss = (s.hazardLoss || 0) + 1;
      } },

    // 4. broken tongue -- HYPOTHESIS p
    { name: 'wagon tongue broke', kind: 'damage', p: 0.02,
      apply: (s) => {
          if (s.supplies.spareTongues > 0) s.supplies.spareTongues--;
          else s.hazardLoss = (s.hazardLoss || 0) + 1;
      } },

    // 5. ox injury / death -- HYPOTHESIS p
    { name: 'ox injured', kind: 'damage', p: 0.02,
      apply: (s) => { if (s.supplies.oxen > 0) s.supplies.oxen--; } },

    // 6. thief -- HYPOTHESIS p
    { name: 'a thief comes in the night', kind: 'damage', p: 0.02,
      apply: (s) => {
          s.supplies.food       = Math.max(0, s.supplies.food - 20);
          s.supplies.ammunition = Math.max(0, s.supplies.ammunition - 10);
      } },

    // 7. severe weather -- HYPOTHESIS p, hazard-scaled
    { name: 'severe weather', kind: 'weather', p: 0.06,
      apply: (s) => {
          s.weather = 'stormy';
          s.hazardWeather = true;
      } },

    // 8. found abandoned wagon -- HYPOTHESIS p
    { name: 'found abandoned wagon', kind: 'positive', p: 0.02,
      apply: (s) => {
          s.supplies.spareWheels++;
          s.supplies.food += 15;
      } },

    // 9. friendly natives share food -- HYPOTHESIS p
    { name: 'friendly Indians share food', kind: 'positive', p: 0.02,
      apply: (s) => { s.supplies.food += 25; } },

    // 10. wild game roams past -- HYPOTHESIS p
    { name: 'wild game passes by', kind: 'positive', p: 0.03,
      apply: (s) => { s.supplies.food += 20; } },

    // 11. lose the trail -- HYPOTHESIS p
    { name: 'lost the trail', kind: 'damage', p: 0.03,
      apply: (s) => { s.milesPenaltyToday = (s.milesPenaltyToday || 0) + 10; } },

    // 12. bad water -- HYPOTHESIS p (would set cholera flag in the game;
    // here we hand the party a coin-flip illness through the illness path)
    { name: 'bad water', kind: 'illness', p: 0.02, illnessId: 2  /* cholera */ },

    // 13. snakebite -- HYPOTHESIS p, HYPOTHESIS effect
    { name: 'snakebite', kind: 'illness', p: 0.015, illnessId: null /* random */ },

    // 14. general fatigue / illness roll -- HYPOTHESIS p
    { name: 'illness', kind: 'illness', p: 0.04, illnessId: null /* random */ },
];


// -----------------------------------------------------------------------------
// Calendar
// -----------------------------------------------------------------------------

export const MONTH_NAMES = [
    'January', 'February', 'March',     'April',   'May',      'June',
    'July',    'August',   'September', 'October', 'November', 'December',
];

export const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// CONFIRMED from setup menu strings.
export const DEPARTURE_MONTHS = [
    { id: 0, monthIndex: 2, name: 'March' },
    { id: 1, monthIndex: 3, name: 'April' },
    { id: 2, monthIndex: 4, name: 'May'   },
    { id: 3, monthIndex: 5, name: 'June'  },
    { id: 4, monthIndex: 6, name: 'July'  },
];


// -----------------------------------------------------------------------------
// Party
// -----------------------------------------------------------------------------
//
// CONFIRMED via emulator run: five names entered at setup, per
// docs/03. Slot 0 is the player and the casualty routine at 0x134D6
// walks from n-1 down to 1 (or 0 when n=1) -- so the leader has a
// different (unread) death path.

export const PARTY_SIZE = 5;
export const DEFAULT_PARTY_NAMES = ['Stephen', 'Mary', 'Lewis', 'Sarah', 'John'];


// -----------------------------------------------------------------------------
// Scoring
// -----------------------------------------------------------------------------
//
// CONFIRMED via game's own explanation screen at 0x00C166, quoted in
// docs/03: seven items and seven values, side by side.

export const SCORE_WEIGHTS = {
    wagon:      50,   // "wagon"                         (arrival bonus)
    ox:          4,   // per ox
    sparePart:   2,   // per spare (wheel/axle/tongue)
    clothing:    2,   // per set
    bulletsPer: 50,   // 1 point per 50 bullets          -- 0x08128
    foodPer:    25,   // 1 point per 25 pounds of food   -- 0x08160
    dollarsPer:  5,   // 1 point per $5                  -- 0x08181
};

// CONFIRMED from HEALTH_BANDS above.
// Occupation multipliers CONFIRMED from OCCUPATION above.


// -----------------------------------------------------------------------------
// Hunting
// -----------------------------------------------------------------------------
//
// CONFIRMED from docs/03: hunting draws through BGI on a 320x200 field;
// input is keypad digits (aim), Enter (walk toggle), Space (fire),
// Escape (stop). Ammunition is checked at 0x77FF -- no bullets, no hunting.
//
// Scenery table stride and slots CONFIRMED via render-hunting.py:
//   DS:0x00DA -- 8 hunter directions, (srcX, srcY, w, h) stride 8
//   DS:0x013A -- 16 scenery kinds
//   DS:0x0364 -- 5 regions x 6 permitted kinds each
//   DS:0x01C2 -- animals, groups of 4 frames each, 7 species
//
// Placement:  Random(4) + 5 scenery objects, rejection sampled onto a
// 318 x 199 field with a "nudge x even and toward a byte" rule.
// Animals enter from an edge at a 7% chance per slot per turn, max 4
// spawns per slot.
//
// Meat yield: `meat := raw div 2 if raw >= 3` at 0x078EB.

export const HUNT_MAX_CARRY_LBS = 100;   // CONFIRMED: "You can only carry
                                          // 100 pounds back to the wagon."

export const HUNT_FIELD_W = 320;
export const HUNT_FIELD_H = 200;
export const HUNT_SPAWN_RATE_PER_SLOT_PER_TURN = 0.07;    // "7 percent"
export const HUNT_MAX_SPAWNS_PER_SLOT = 4;
export const HUNT_SCENERY_MIN = 5;
export const HUNT_SCENERY_MAX = 8;

// Species availability by landmark index -- docs/03 and
// render-hunting.py (6 species in the extracted sheet). Species 0..2
// are landmark-gated; 3..5 are always available.
//   species 0 (bison male)   -- 3 < landmark < 13
//   species 1 (bison female) -- landmark > 6
//   species 2 (deer male)    -- landmark >= 7
//   species 3 (deer female)  -- always
//   species 4 (rabbit)       -- always
//   species 5 (squirrel)     -- always
export const HUNT_SPECIES_GATES = [
    (lm) => lm > 3 && lm < 13,   // 0
    (lm) => lm > 6,              // 1
    (lm) => lm >= 7,             // 2
    () => true,                  // 3
    () => true,                  // 4
    () => true,                  // 5
];


// -----------------------------------------------------------------------------
// Historic high-score entries -- CONFIRMED names from binary string table
// -----------------------------------------------------------------------------

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
// The 30 PNGs live in reference/art/mcga (gitignored, extracted from
// OTMCGA.PCL). See PROMPT-PORT.md for how to populate them.

export const IMG_BASE = '../reference/art/mcga/';

export const ASSET_KEYS = {
    LOGO:     'logo_vga',
    ANIMALS:  'vga_ANIMALS',
    BANNER:   'vga_BANNER',
    EVENTS:   'vga_EVENTS',
    FAMILY:   'vga_FAMILY',
    FLOAT:    'vga_FLOAT',
    HUNTER:   'vga_HUNTER',
    MAP:      'vga_MAP',
    SCENERY:  'vga_SCENERY',
    SUPPLIES: 'vga_SUPPLIES',
    TERRAIN:  'vga_TERRAIN',
    TRAVELOX: 'vga_TRAVELOX',
};

// vga_P0..vga_P17 -- 18 landmark PNGs. See trail.js for the 17-entry
// landmark list; P0 is Independence (the starting point), P1..P17 are
// the seventeen destinations.
export const LANDMARK_IMG_COUNT = 18;


// -----------------------------------------------------------------------------
// UI text
// -----------------------------------------------------------------------------

export const TEXT = {
    title:       'THE OREGON TRAIL',
    mainMenu: [
        'Travel the Trail',
        'Learn About the Trail',
        'See the Top Ten',
        'Choose Management Options',
        'End',
    ],

    chooseOccupation: 'Many kinds of people made the trip to Oregon. You may:',
    chooseDeparture:  'It is 1848. Your jumping-off place is Independence, Missouri. Which month will you leave?',
    enterPartyNames:  'What are the first names of the four other members of your party?',

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

    storeIntro:
        "Hello, I'm Matt. So you're going to Oregon! " +
        "I can fix you up with what you need.",

    pressKey: 'Press any key to continue...',
};
