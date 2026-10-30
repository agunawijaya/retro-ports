# Spyder — Web Port Design Document

**Project:** `E:/Projects/retro-ports/spyder`  
**Date:** 2026-10-26  
**Status:** Design approved; visual direction locked 2026-10-26 (see `ART-DIRECTION.md` and the playable reference in `reference/`)

This document is the single reference for the modern web port of *Spyder* (1983, Mirror Images Software). It is not a faithful 1:1 emulation of the DOS original; it is a **reimagining** aimed at Gen Z / Gen Alpha players, with an atmospheric old-house setting, modern visuals, and satisfying arcade-mystery gameplay.

---

## 1. Vision

A player enters a long-abandoned family house. Every room is a level. The house is not haunted in a loud horror sense; it is **liminal, dusty, and silently overrun by spiders and webs**. The goal is to clear each room of spiders, egg sacs, and webs, uncovering the house's story through environmental details and hidden collectibles.

**Core feeling:**
- Visually satisfying (cleaning progression, particle effects, dynamic light).
- Slightly creepy but not horror.
- Addictive arcade loop with modern polish.
- Mystery unfolds through objects, not text walls.

---

## 2. Visual Direction

> **The binding visual spec is `ART-DIRECTION.md`.** It turns this section into measurable rules and points to the playable reference scene (`reference/living-room.html`). Where the two differ, `ART-DIRECTION.md` wins.

### 2.0 Decisions locked on 2026-10-26

| Topic | Decision |
|---|---|
| Spiders | Stylized-creepy: exaggerated proportions, very alive IK legs, glinting eyes |
| Overall style | Painterly illustration (dark storybook), never flat vector |
| Mood | Cozy-creepy: warm lamps, cold moonlight, floating dust |
| Room makeover | Full 3–5 s transformation when a room is cleared |
| Movement | Left–right on the floor plus climbing onto furniture |
| Camera | One screen per room with subtle parallax |
| Hero | Expressive chibi, head about 1/3 of the body |
| UI | Diegetic vintage: brass plate, work-order card, gauge, luggage tag |

### 2.1 Anti-Retro

- No pixel-art upscaling of the original 1-bit sprites.
- No CRT scanlines, CGA palette, or chiptune nostalgia.
- The aesthetic is **modern 2D illustration** with smooth animation.

### 2.2 Art Style

- **Backgrounds:** Hand-crafted SVG room illustrations (parallax layers).
- **Characters & spiders:** Canvas-drawn vector shapes with organic animation.
- **Webs:** Procedurally generated on Canvas, swaying gently.
- **Lighting:** God rays through dirty windows, dust particles, flickering lamps, dynamic shadows.
- **Palette:** Muted warm tones — dusty browns, creams, greys, with amber/orange accents from old lamps. Avoid neon.

### 2.3 Tech Stack

| Layer | Tech | Reason |
|---|---|---|
| UI | HTML + CSS, diegetic vintage objects (brass, paper, ink); bundled fonts Fraunces, Special Elite, Caveat | Fast, accessible, easy to style |
| Background rooms | Canvas, painted procedurally once into cached `dirty` and `clean` layers (changed from SVG: needed for the painterly brush texture, lighting and the makeover crossfade) | Painterly look, fast at runtime |
| Game world | HTML5 Canvas | Particle effects, spiders, webs, lighting |
| Game logic | Vanilla JavaScript | Lightweight, no framework lock-in |
| Audio | Web Audio API | Procedural/ambient sound, low file size |

---

## 3. Story & Narrative

### 3.1 Premise

You have inherited a house from a relative you barely knew. The will includes a strange note: *"Clean it first. Then you will understand."* The house has been empty for 15 years. Furniture is still in place, photos still hang on walls, but everything is covered in dust and webs. As you clean deeper, the spiders become stranger, and you find evidence that someone else tried — and failed — to clear the house before you.

### 3.2 Story Delivery

- **Comic-panel cutscenes** between acts (3–4 panels, SVG-animated).
- **Environmental storytelling:** found photos, letters, objects in rooms.
- **One collectible per room** that reveals a fragment of the family history.
- **Minimal text.** Most story is told through visuals and audio mood.

### 3.3 Acts

| Act | Rooms | Story Beat |
|---|---|---|
| Act 1 | 1–5 | "Just a dirty old house." |
| Act 2 | 6–9 | Spiders act unnatural; traces of a previous attempt to clean. |
| Act 3 | 10–12 | A hidden room reveals the house's secret. |
| Finale | Secret rooms | Resolution depends on collectibles found. |

### 3.4 Endings

- **Speed Ending:** Clear all rooms quickly. Standard ending.
- **Completionist Ending:** Collect every hidden item. Reveals full family mystery.
- **Alternate Ending:** Spare certain egg sacs. Unlocks a different final scene.

---

## 4. Characters

Player chooses a character in **Settings** before starting. Each character has a small mechanical bias but remains balanced.

| Character | Visual | Passive Ability | Best For |
|---|---|---|---|
| **The Exterminator** | Orange jumpsuit, mask, professional gear | +20% damage, faster weapon cooldown | Action-focused players |
| **The Curious Kid** | Hoodie, flashlight, sneakers | +15% move speed, reveals hidden collectibles | Explorers |
| **The Heir** | Vintage cardigan, tied hair | +25% coins/XP per clean room | Grinders / upgraders |
| **The Ghost Hunter** | Black coat, EMF reader | Highlights hidden egg sacs and nests | Strategic players |

Each character also changes the tone of short internal reactions during cutscenes.

---

## 5. Rooms (Levels)

### 5.1 Main Rooms (12)

1. **Front Porch** — tutorial level, introduces movement and shooting.
2. **Living Room** — sofa, broken chandelier, dusty windows.
3. **Family Room** — old tube TV, bookshelves, cold fireplace.
4. **Kitchen** — wooden cabinets, rusty pans, dining table.
5. **Dining Room** — long table, cabinet, torn curtains.
6. **Downstairs Bathroom** — fogged mirror, stained tub, cracked tiles.
7. **Upstairs Hallway** — narrow, many doorways, tense spawn points.
8. **Master Bedroom** — old bed, wardrobe, faded photos.
9. **Kid's Bedroom** — toys, posters, bunk bed, slightly surreal tone.
10. **Study / Library** — many collectibles, slower pace, puzzle-like layout.
11. **Upstairs Bathroom** — mirrors, tight corners.
12. **Attic** — final main level, heavy web density, mini-boss.

### 5.2 Secret Rooms (3)

13. **Basement** — unlocked after finding the cellar key. Dark, claustrophobic.
14. **Greenhouse** — glass walls covered in webs, vertical gameplay.
15. **The Wall** — final boss room: a giant wall of nests.

### 5.3 Room Tone Variations

- **Cozy-creepy:** Living Room, Master Bedroom.
- **Tense:** Hallway, Bathrooms.
- **Action-heavy:** Kitchen, Attic, Greenhouse.
- **Mystery:** Study, Kid's Bedroom.
- **Surreal:** Greenhouse, The Wall.

---

## 6. Enemies

### 6.1 Spiders

| Type | Behaviour | First Appearance |
|---|---|---|
| **String Spider** | Descends from a web thread, then climbs back up. | Front Porch |
| **Wall Crawler** | Moves along walls and ceiling. | Living Room |
| **Jumper** | Hops short distances toward the player. | Kitchen |
| **Egg Carrier** | Carries an egg sac; drops it when killed. | Hallway |
| **Tiny Spider** | Hatches from eggs, fast but weak. | Any room with eggs |
| **Web Weaver** | Creates new web patches over time. | Study |
| **Shadow Spider** | Harder to see, moves in dim areas. | Basement |
| **Spider Queen** | Mini-boss; spawns tiny spiders, takes many hits. | Attic / The Wall |

### 6.2 Hazards

- **Egg Sacs:** Hatch into tiny spiders if not destroyed quickly.
- **Web Patches:** Slow player movement if walked through.
- **Falling Debris:** triggered in later rooms.

---

## 7. Weapons

### 7.1 Default Weapons (swappable in settings / pause)

| Weapon | Mechanic | Best Against |
|---|---|---|
| **Vacuum Blaster** | Straight fast projectile, all-rounder. | Most spiders |
| **Web-Cutter** | Curving upward shot. | String Spiders on threads |
| **Foam Spray** | Short-range cone, area damage. | Egg sacs and clusters |

### 7.2 Bonus Weapons (temporary pickups)

| Weapon | How to Get | Effect |
|---|---|---|
| **Flamethrower** | Break certain furniture / mini-boss drop | High damage, dramatic visuals, limited duration |
| **Sonic Pulse** | Complete a mini-objective / secret room | Clears all spiders on screen once |

### 7.3 Weapon Sources

- Found inside destructible furniture (wardrobes, boxes).
- Reward for mini-objectives (e.g., "destroy 5 nests without missing").
- Dropped by mini-bosses.

---

## 8. Gameplay Systems

### 8.1 Core Loop

1. Enter room.
2. Clear all spiders and egg sacs.
3. Destroy enough webs to reach "Clean" threshold.
4. Exit to next room / cutscene.

**Movement (decided 2026-10-26):** the hero runs left–right on the floor and can jump onto furniture (sofa, dresser, table…) and drop back down, for different shooting angles. Each room has at least two climbable platforms at different heights.

**Extra verbs proven in the reference scene:** snip the silk above a dangling spider (it drops, bonus points); stomp hatchlings by landing on them; egg sacs dropped on the hero's head are the classic 1983 threat.

### 8.2 Scoring

- Kill spider: base points.
- Destroy nest: large bonus.
- Destroy egg before hatch: bonus.
- Combo: consecutive hits without missing increase a score multiplier (max x5).
- Time bonus: faster clear = more points.
- No-damage bonus: clear room untouched.

### 8.3 Progression

- Coins/XP earned per room.
- Unlockable visual upgrades: weapon skins, character outfits, room themes.
- Permanent upgrades (optional): faster reload, bigger magazine, longer combo window.

### 8.4 Gamification

- **Achievements:** "First Blood", "Web Destroyer", "Egg Dodger", "Perfect Room", "Combo Master", "Completionist".
- **Daily Challenge:** one seeded room per day, leaderboard-style local comparison.
- **Room Makeover:** after clearing, room visibly improves (dust removed, lights fixed). Satisfying before/after.
- **Collectible Lore:** one hidden item per room unlocks comic panels and story.

---

## 9. UI / Screens

### 9.1 Title Screen

- Animated logo "SPYDER" with subtle web/glitch effect.
- Background: slow pan across the house exterior at dusk.
- Menu: Play, Settings, High Scores, How to Play, Credits.

### 9.2 Settings

- Character selection (4 choices).
- Difficulty: Easy / Normal / Hard / Custom (1–10).
- Sound: music, SFX, master volume.
- Visual: CRT toggle OFF by default, glow intensity, screen shake, particles.
- Controls: keyboard / touch / auto-fire.

### 9.3 In-Game HUD

All HUD elements are diegetic objects (brass score plate with a hanging combo tag, pinned work-order card for clean progress, brass "Nerve" pressure gauge for health, luggage tag for the weapon, brass pause button). See `ART-DIRECTION.md` §11.

- Score (top center).
- Combo multiplier (grows near score).
- Health / shield (bottom left).
- Current weapon + ammo/energy (bottom right).
- Room clean progress bar (top right).
- Pause button (top left).

### 9.4 Cutscenes

- Comic-panel style, 3–4 panels per act transition.
- Click/tap to advance.
- No voiceover; ambient sound + subtle music.

---

## 10. Audio Direction

- **Music:** Ambient, slow, slightly uneasy. Piano + strings + soft synth pads. Intensifies during action.
- **SFX:**
  - Vacuum/web shot: satisfying compressed-air pop.
  - Spider hit: crunchy wet pop.
  - Web tear: fabric-rip sound.
  - Egg hatch: sticky crackle.
  - Footsteps: soft on dust, muted.
- **ASMR-adjacent:** subtle dust fall, creaking wood, distant wind.

---

## 11. Technical Milestones

1. **Prototype:** Living Room with one character, Vacuum Blaster, String Spider, and Wall Crawler.
2. **Vertical Slice:** 3 rooms, 2 characters, 2 weapons, scoring, and one cutscene.
3. **Full Game:** All 15 rooms, 4 characters, full story, high-score table, settings.
4. **Polish:** Particle overhaul, audio pass, mobile optimization, achievements.

---

## 12. Open Questions

- Should there be a global map showing room connections?
- Should players freely choose room order, or is it strictly linear?
- How much permanent progression vs. pure arcade score-chasing?
- Should we include a "speedrun mode" separate from story mode?

---

## 13. References & Inspirations

- Original *Spyder* (1983) — enemy types and arcade DNA.
- Liminal space / dark-cozy aesthetic popular on short-form video platforms.
- Satisfying cleaning games (e.g., PowerWash Simulator) for progression feel.
- Modern web games using Canvas + SVG for rich 2D visuals.
