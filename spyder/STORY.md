# Spyder — Story bible

**Status:** written by the architect, 2026-10-30. Binding for every cutscene, lore item, results-card line and ending. Agents implement it; they do not change the story. Tone: cozy-creepy, bittersweet, all ages. No deaths on screen, no gore, nobody is a villain.

## The secret in one paragraph

The Ashworths lived here: **Arthur**, **Eleanor**, their son **Thomas**, and Arthur's sister **Agatha — "A."** — who lived with them and was Thomas's favourite person. In the spring of 1976, when Thomas was eight, Arthur's work took the family abroad. Agatha stayed to keep the house. That autumn a storm broke the round attic window, and the spiders came in. She fought them for years, alone, room by room, and lost a little more each year. The family meant to come back and never did; letters thinned; Thomas grew up and forgot the house. When Agatha died she left the house to "the Helper" — the name Thomas gave himself as a boy, in a drawing of an orange figure with a vacuum hose who would one day come back and make the house safe. **The player is Thomas, grown up.** He does not remember. The house does.

"Clean it first. Then you will understand." — the house returns his memory one room at a time.

## People

| Who | Seen as | Facts that may appear |
|---|---|---|
| Agatha Ashworth, "A." | Handwriting (blue-black ink), the letter, tutorial notes, the place card, the taped toothbrush, the torch | Arthur's younger sister; kind, stubborn, funny; taught Thomas to whistle; never married; stayed |
| Arthur Ashworth | Wedding photo, place card, study | Engineer; married Eleanor in 1968 |
| Eleanor Ashworth | Wedding photo, diary, place card | Kept the diary; played the radio waltz |
| Thomas Ashworth | Height marks, drawing, mirror writing, the bedroom | Born April 1968; measured every birthday to eight; "the Helper" is his invention |
| The hero | The Exterminator (and later the other characters) | Is Thomas — revealed only in the endings. Nothing before the finale may say so outright; it may hint. |
| Beatrice, Julian | Place cards only | Agatha's friends who came to Sunday dinners |

## What each room gives back (story objects already built, plus one lore item each)

Every room already has its **story object** (results card). Prompt 17 adds one **hidden lore item** per room: a small thing to find, collected into a scrapbook. Together they tell Agatha's side.

| # | Room | Story object (built) | Hidden lore item (new) — what it says |
|---|---|---|---|
| 1 | Front Porch | Name plate "ASHWORTH" | A postcard from abroad, 1977: "Tell Tommy we'll be back for Christmas. — E." |
| 2 | Living Room | Family photo stands up | A child's tin whistle in the sofa cushions; a label in A.'s hand: "Ours. Practise!" |
| 3 | Family Room | Home movie | A cassette: "Tommy, 7 — singing" |
| 4 | Kitchen | Recipe card: apple cake for A. | A shopping list in A.'s hand, 1981: "spider spray ×6, new torch bulbs, apples" |
| 5 | Dining Room | Place card "A." | A Christmas cracker crown, never worn, in a drawer: "Christmas 1977 — kept for when they're home" |
| 6 | Downstairs Bathroom | "Thomas was here" in the mirror | A sticking plaster tin with a drawn spider and a cross through it |
| 7 | Upstairs Hallway | Height marks stop at eight | A key on a ribbon: "Tommy's room — keep it as it is" |
| 8 | Master Bedroom | Wedding photo 1968 | A thin letter, 1984: "We can't come this year either. I'm so sorry, Aggie." |
| 9 | Kid's Bedroom | Drawing with "the Helper" | A second drawing, older-looking, in an adult hand copying the child's: "So I don't forget him." |
| 10 | Study | Eleanor's diary line | A will, folded small: "To the Helper." |
| 11 | Upstairs Bathroom | Toothbrush taped "A." | A hairbrush with grey hair, and a note: "Getting slower. They're getting bolder." |
| 12 | Attic | Torch: "A. Ashworth" | A hand-drawn map of the house with every room crossed out but one: Tommy's |

## Acts and cutscenes

Four comic-panel cutscenes (3–4 panels each, painterly, the game's palette, no voice). Text is A.'s handwriting or short typewritten captions; at most 12 words per panel.

| When | Panels |
|---|---|
| **Prologue** (before room 1) | 1) A lawyer's desk, an envelope addressed "To the Helper". 2) The hero's hands opening it: a key, a letter. 3) The letter: "Clean it first. Then you will understand. — A." 4) The house at dusk from the gate; a light flickers in the attic window. |
| **After Act 1** (room 5 cleared) | 1) The clean dining table at night, one place card glowing faintly. 2) Close-up: the "A." card. 3) The hero's face, puzzled, reflected in a window. 4) Upstairs, a door at the end of the hallway — a thin warm line of light under it. Caption: "Someone is still keeping a light on." |
| **After Act 2** (room 9 cleared) | 1) The hero holding the crayon drawing. 2) The orange figure in the drawing. 3) The hero looks down at his own orange sleeve. 4) A sound from above; dust falls from the attic hatch. Caption: "The Helper." |
| **After Act 3** (attic cleared) | 1) The torch in the hero's hand, "A. Ashworth". 2) Morning light through the round window. 3) The map: every room crossed out but one. 4) Black. A whistle, two notes, the ones Agatha taught. |

## Endings (built with the secret rooms)

| Ending | Condition | What happens |
|---|---|---|
| **The house is clean** (speed) | Clear the 12 rooms | The hero locks the front door at dawn, the key on its ribbon. On the porch step, a postcard to himself: "Welcome home, Tommy." He does not understand it yet. |
| **The Helper remembers** (completionist) | All 12 lore items + the three secret rooms | The final scrapbook page: the boy's drawing beside the hero's photo in his orange suit. He whistles the two notes. Every light in the house comes on. Caption: "Thank you for staying, Aggie." |
| **Let them live** (alternate) | Spare the marked egg sacs in the Greenhouse (secret room) instead of popping them | The hero carries the sacs to the garden in a biscuit tin. In spring, webs shine in the hedge, and none in the house. Agatha's last note: "They only wanted somewhere warm. So did I." |

## Writing rules for agents

- Use only what is in this file. If a line is needed that is not here, write it in A.'s voice — short, warm, a little dry — and list it in the prompt's summary for the architect to approve.
- Never say the hero is Thomas before an ending.
- Dates stay consistent: wedding 1968, Thomas born 1968, family leaves spring 1976, storm autumn 1976, house empty after Agatha's death, fifteen years before the game.
