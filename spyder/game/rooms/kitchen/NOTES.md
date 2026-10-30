# Room 4: the Kitchen, and the Jumper

*Prompt 02 (`prompts/02-kitchen.md`), built 2026-10-28. Stopped at the hero-frame checkpoint, waiting for the owner's review.*

A 1960s family kitchen left mid-life: the kettle on the stove, the calendar on an October page with the 17th circled, the fridge door not quite shut and its cold light lying across the linoleum. It introduces the **Jumper**, a spider that lives on the counter, the table and the floor, crouches, and leaps at where the hero is about to be.

## Files

| Path | What it is |
|---|---|
| `room.js` | The room: layout, painting, webs, live props, lights, rules, makeover, QA staging, hooks |
| `../../tools/rooms/kitchen-playtest.mjs` | Plays the room start to finish through real mouse and keys, and checks what the prompt asks to confirm |
| `../../../review/current/kitchen/` | The six hero frames, 1920 × 1080 JPEG: `dirty.jpg`, `action.jpg`, `jumper.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg`. |
| `../../lib/spider-types/jumper.js` | The Jumper: a subclass of `SpiderRig` for its look, the brain, and its registration |

Two lines were added to `game/index.html`: `lib/spider-types/jumper.js` after `hatchling.js`, and `rooms/kitchen/room.js` after the Living Room. Nothing else outside this folder changed.

## Run it

```
cd game/tools
node shoot.mjs --hero --room=kitchen
node rooms/kitchen-playtest.mjs        about 45 s of play, then the makeover
node regress.mjs                                            the Living Room still matches the reference
```

`?qa=1&room=kitchen` stages `dirty`, `action`, `jumper`, `makeover`, `clean` and `results`. `jumper` is the kitchen's own state: one Jumper frozen at the top of a leap above the table, the hero below aiming at it. The `action` state is the shared one; the room adds a crouching Jumper on the table to it from `onStart`.

## The Jumper

Same rig, new brain (ART-DIRECTION §7). `jumper.js` subclasses `SpiderRig` inside its own file. `spider-rig.js` is untouched, and so are the String Spider and the Wall Crawler.

**Its look differs in silhouette only.** Scale 0.9. Pairs 3 and 4 reach 1.15× further and have femurs 1.4× thicker. Three pale transverse bands replace the chevrons and the false eyes. The rig keeps its leg table private, so `jumper.js` copies it (`BASE_REACH`, `REST_ANGLE`) to multiply it.

**It is seen standing on a surface, not flat on the wall.** Every other spider is drawn in dorsal view, the way you see one on a wall. A spider on a counter is seen from above at an angle. So the Jumper's leg plane is squashed vertically: 0.32 on a ledge, 0.5 on the floor, which reads deeper. Its feet sit on the surface line, its knees rise above the body, and its body is squashed 0.62. In the air the leg plane is 0.62, so the legs fan out forward and back. A full top-down view in the air read as a spider sitting on the wall (rounds 1–2). Hit tests, eye glints and the hero's gaze use the projected body centre.

**States**, as in the prompt's diagram:

| State | What happens |
|---|---|
| emerge | out of its hiding place (below) |
| prowl | walks its surface with the rig's planted-feet gait, turns through "facing the camera", stops dead and twitches now and then |
| crouch | when the hero is within 520 px horizontally and between 330 above and 280 below: body drops and flattens 15 %, legs pull in to 80 %, front pair rises and waves, eyes flare, a dust puff, a rising hiss, a tremble at the end. 0.45 s; **0.9 s for the room's first Jumper** |
| leap | ballistic, gravity 2200, flight 0.55–0.8 s by distance, aimed at the hero's position **0.3 s ahead**; afterimages along the arc it actually flew |
| land | on the first platform its feet pass down through; dust and a thud; within 50 px of the hero: `hurtHero(12)`, then the disgusted face |
| recover | 1.2 s still, turning to keep the hero in view, then prowl |
| tumble / dying | shot in the air: **"Swatted!" +100** on its 180, and it tumbles out of the air; shot on the ground: it hops, curls and splats |

**Hiding places** (`layout.jumperLairs`; a room without any gets one walking in from each side of the floor):
- *Under the fridge*: it comes out of the dark gap toward the camera, fading in.
- *Behind the stove*: it walks out from behind the backguard, clipped at its edge.
- *Out of the sink drain*: it climbs up behind the sink's front rim, front legs hooked over it.

Darts pass a Jumper by while its body is still behind cover.

**The first Jumper comes alone.** `canSpawn` makes the director wait until no other spider that counts for the quota is out. Hatchlings and eggs don't count; otherwise a hatchling left alive would hold the room forever. Then the room's `direct` hook keeps the director quiet for the first Jumper's first 7 seconds, so it prowls, crouches and leaps alone.

## Decisions that differ from the prompt, and why

1. **The calendar hangs at y 324–464, not 180–320.** At 180–320 it would sit under the work-order card (HUD safe zone x 1510–1880, y 20–300). Its x is as specified.
2. **One extra platform: a drawer left pulled out (x 436–586, y 816).** The counter is at y 700, 235 px above the floor, and the hero's jump peaks at 208 px. The stool, at 260 px from the counter's end, is not a way up either. The drawer is a step halfway, and closing it is one more dirty → clean difference. It is checked with real key presses: floor → drawer → counter, then S twice back to the floor.
3. **Tiles only as the backsplash.** The table says "Backsplash y 440–690". Round 1 tiled the whole wall and it read as a bathroom. Behind the fridge and the table the wall is now wallpaper down to a chair rail at 560, with beadboard below.
4. **Two buckets.** The prompt asks for an out-of-focus mop bucket in the foreground (bottom right) and an overturned bucket near the fridge (the previous cleaner's trace). Both are there: a galvanised pail with a wringer close to the camera, and a knocked-over bucket with a dried mop in front of the fridge.
5. **The moonlight falls down to the left.** The moon stands at the upper right of the window, so its shaft falls over the sink onto the drawers and the hero's spot. At dawn the shaft swings to the right, with the low sun. Leaning right, as in the Living Room, left the stove side of the room unlit.
6. **A wall telephone** on the right wall, which was empty in both states (round 3). Dirty, its receiver hangs off the hook on the coiled cord; clean, it is back on the cradle.
7. **Props whose outline changes are live sprites**: the chairs, the herbs, the fruit and the mop bucket. See the first runtime request below.
8. **The recipe card and the calendar are drawn live**, from small canvases cached per font state. The room's cached layers are painted the moment it loads, possibly before the fonts have arrived, and would keep the fallback font for good.
9. **The fridge stands on the back layer, painted closed.** The crack of light is drawn live, so the door can swing shut on its own beat at 3.4 s. By then the sweep has already replaced the painted layer.
10. **The fridge badge has a chrome flourish, no maker's name.**
11. **The Jumper's hurt comes with the disgusted face 0.72 s later.** `Hero.feel` ranks *hurt* above *disgusted*, so calling both at once only ever shows *hurt*. The disgust follows when the hurt face has run out.
12. **A Jumper at the end of a ledge, with the hero out of reach, hops down to the floor**, with the same crouch first. Otherwise one on the counter could wait at the end forever while the hero stays at the far end of the room.
13. **Where Jumpers come out:** about one leap (560 px) from the hero, on the hero's own level if possible, and not the same place twice running. A first play-test sent all seven out of the sink drain while the hero stood by the fridge.
14. **The pendant swings from darts, and from spiders.** A dart within 44 px of the shade stops there (`dart` listener returns true), kicks the swing and makes the filament stutter. Any spider body brushing the cord or the shade pushes it too. One drop point (x 1478) is close enough that string spiders brush it on the way down. A table shadow drawn live on the floor swings with the lamp.
15. **The unique beat is timed to finish before the results card** (5.2 s): fridge shuts 3.4 s (thunk at 3.6), tap brown 3.75 s, clear 4.05 s, off 4.95 s (1.2 s of water), kettle whistles 4.75 s. After the results card the runtime keeps calling the unique beat with `mk.t` frozen at the card's time, so the steam runs on game time instead. Sounds play only when the makeover actually passes a cue, so jumping straight to "clean" in QA is silent.
16. **The QA hero stands at x 716**, in front of the sink in the moonlight, so the fridge, the stool and the table stay in view. At 1236 the hero hid the stool.

## QA rounds (ART-DIRECTION §15)

Each round rendered all six states into temporary scratch folders and compared them side by side with `reference/screens/`. These are the five biggest gaps per round and what was done.

### Round 1
1. **The room was grey and cold where the reference is warm umber.** Every surface had been aged toward taupe, so tiles, floor, cabinets and fridge all went the same grey. → Warmer base tones; dust is now taupe mixed with oak.
2. **Glazed tiles across the whole width read as a flat bathroom grid,** with dark grout outlining every tile. → Backsplash only, with a green bullnose edge; wallpaper and beadboard elsewhere; lighter grout.
3. **The fridge light was too weak and too grey to read as a cold wedge.** → Stronger cone and floor shaft, a pool at the fridge's foot, a wider crack.
4. **The Jumper:** frozen mid-leap it read as a spider on the wall, and crouched on the counter it was a dark smudge in the room's darkest part. → A trail along its arc, a stronger shadow on the surface below, brighter bands, front legs lifted higher; the staged Jumper moved into the light.
5. **The makeover showed both states of the furniture at once:** a fallen chair and a tucked-in one, an overturned and an upright bucket, fresh apples on the dirty side. → Those props became live sprites, faded with the sweep (runtime request 1).

Also: the kettle read as a face (redrawn as a domed kettle with a bakelite handle), the laundry outside was too small, the recipe card's last line ran off the card, and the hero hid the stool.

### Round 2
1. **The fridge light was still white, a second moon.** → The wedge and cone are moon blue; only the crack itself stays near white.
2. **The left third was murky:** wall cabinets, pans, stove. → The moon shaft falls down-left over the sink and drawers; the wall cabinets get a cold rim on the side facing the window.
3. **The airborne Jumper still read as wall-bound,** and its trail was invisible. → A three-quarter leg plane in the air (0.62), a longer and brighter trail.
4. **The staged dart killed the action Jumper before the frame was taken** (a "+360" on the counter). → Staged on the table under the pendant, clear of the dart's path.
5. **The checkerboard dominated the dirty frame,** edge to edge at one value. → Cream squares aged harder, a heavier dust film, the floor falling into shadow toward the camera and at the sides.

### Round 3
1. **The fridge wedge measured (93, 87, 91) on the floor:** neutral grey, because the warm floor and the night grade cancel the moon's tint. → A cool multiply tint over the wedge (three nested quads, no blur) under the screened beam. It now measures (70, 73, 83), against (101, 88, 61) on the pendant-lit wall.
2. **The Jumper's trail, in silk colour, read as threads hanging in the air.** → Afterimages of its body along the arc and two dust-coloured streaks.
3. **The airborne Jumper sat exactly on the chair rail** and looked perched. → The top of the arc moved up into the pendant's light.
4. **The chair tucked behind the table read as a bottle.** → Drawn from the front: a backrest pad on two chrome uprights.
5. **The right wall was empty in both states, and the magnet covered "Apple cake".** → The wall telephone; the magnet moved to the card's corner.

### Round 4, with what the play-test showed
1. **The tap's water was a sliver that ran into the right-hand handle.** → Spout moved clear of the handles, thicker stream, a glow along the clear water.
2. **The kettle's steam was invisible against the morning tiles.** → A steam plume drawn after the light: puffs born at the spout between whistle and stop, rising and curling for 1.5 s.
3. **The backguard clock sat behind the kettle's spout.** → Moved to the backguard's left end.
4. **The receiver hanging off the hook read as a hanging utensil.** → Bigger earpiece and mouthpiece, a darker cord, hanging at an angle. Still not perfect: from across the room it can pass for a wall tool.
5. **Wall cabinets and copper pans were near-black while dirty.** → Wall cabinets aged a little less; the pans catch a cold rim of moonlight.

### Round 5 (final polish, then the hero frames)
1. **The warmth was confined to the top-right corner of the dirty frame.** → Pendant light, cone and floor pool a little stronger.
2. **The clean oxblood squares were louder than anything in the reference.** → Mixed 22 % toward umber.
3. **The calendar and the recipe card used hand-picked hexes, two of them saturated reds.** → Palette mixes throughout (rust, ember, leaf, sky, bone, linen; the ink and the pencil are mixed from gear and plum).
4. **The fallen chair's end reached into the weapon tag's safe zone.** → Moved 34 px left.
5. **The pencil arrow from "A. coming!" pointed at the 22.** → It points at the 17.

Accepted, not fixed: the dirty kitchen is cooler overall than the reference's Living Room. Its cold fridge light against the warm pendant is the room's identity (the prompt's acceptance asks for exactly that contrast).

## Play-through (`playtest.mjs`): all 14 checks pass

The player is a bot. It aims the mouse at the most urgent thing, leading a Jumper in flight, holds the button, steps away from a crouching Jumper, and shoots silk when the room is quiet. It leaves grounded Jumpers alone for 9 s, so every one gets to crouch and leap. Last run (about 40 s of play):

- **First Jumper alone, slow crouch:** it came out of the sink drain with no other spider out, crouched for 0.90 s, then leapt. Later Jumpers crouched for 0.45 s. All three hiding places were used.
- **Mid-air swat:** 6 of 7 Jumpers swatted. Each gained (180 + 100) × combo, e.g. 560 at ×2; one shot on the ground gained 180 × combo (360 at ×2).
- **Makeover:** fridge open until 3.3 s and shut by 3.8 s; the tap ran brown at 3.9 s, clear by 4.6 s, off at 5.15 s; the kettle whistled. Temporary screenshots were verified in scratch.
- **Results:** "On the fridge: a recipe card, in a hand you almost know."
- **Map:** the Kitchen inked with its CLEAN stamp and "best … · untouched".
- No console errors.

Separate checks (scratch scripts, not kept):
- **A Jumper landing on a hero who stands still:** the first Jumper prowled, crouched 0.9 s, leapt 0.65 s and landed at x 893 on a hero at 900. Nerve went 100 → 88, and the face went hurt, then disgusted.
- **A real dart at the pendant:** swing speed went from 0.04 to 0.75 rad/s, the filament stuttered, and the lamp swung to −0.23 rad 1.2 s later, its light cone with it.
- **Frame time,** the kitchen's `action` state played live, headless Edge on ANGLE / Intel UHD (D3D11): mean 2.85 ms, median 2.4, p95 4.4. The Living Room measured the same minute with `perf.mjs`: 2.06 / 2.0 / 2.9. Budget: 8 ms. No blur filter runs per frame: every `filter` in `room.js` is in paint-once code (layers, sprites, the text caches, the glass grime).
- **`regress.mjs`:** the Living Room canvas is identical to the reference in every state (2–7 pixels at 1 level, the browser's own noise).

Three runs of the bot did not end well, and the reasons are worth knowing:
1. The first bot shot every Jumper before it could crouch, so nothing was tested. It now leaves them until they leap.
2. Two runs stalled at 80 % silk with every spider down. The bot kept aiming at one strand per web from where it stood. It now picks a random strand and walks elsewhere after 3 s without progress. In the next run the silk left longest was the **top-right corner web** (46 % left at 31 s), most of which hangs under the work-order card, as the Living Room's does. A player sees only its lower part. That is my best explanation for the stall, not a proven one: the stalled runs did not log silk per web.

## Requests for the runtime

1. **Cross-fading a transparent layer.** `drawBlended` paints the dirty layer over the clean one. That is right for the opaque back layer, but in the furniture and front layers the clean props show through wherever the dirty layer is empty. The reference has the same flaw: in `reference/screens/makeover.jpg` the dresser right of the sweep already has its fresh flowers and the standing photo. A masked blend (draw the dirty part into a scratch canvas, `destination-out` the swept side, composite) would fix it for every room. The kitchen works around it with live sprites.
2. **The unique beat after the results card** is called every frame with `mk.t` frozen at the card's time (about 5.2 s). A beat cannot run past 5.2 s on `mk.t`. Either keep advancing `mk.t` in `restored`, or document that late beats must use `fx.time`.
3. **Fonts before painting.** If `load()` awaited `document.fonts.ready` before painting a room, rooms could put handwriting into their cached layers.
4. **"The room's first X".** A per-room count of spawns by kind (e.g. `world.spawnedOf('jumper')`) would replace the WeakMap keyed on `world.stats` in `jumper.js`.
5. **Rig options.** Per-leg reach and femur multipliers and a markings style as constructor options would let `jumper.js` drop its copy of the rig's leg table.
6. **QA staging** cannot set the score plate or the combo from a room's own state (`stagingApi` has no HUD). That is why the kitchen adds its action Jumper through `onStart` instead of a custom `action` state.
7. **QA pitfall:** `__spyder.setup()` freezes time and `enterRoom()` does not unfreeze it; call `play()` after it.
8. **`flowtest.mjs` assumes the Living Room is the first open room.** Since the Front Porch exists it fails from "the next room has the focus" onward. That comes from the porch being registered, not from the kitchen.

## Not verified

- **Not played by a person.** The play-through is a bot that reads the page's own objects and aims perfectly, so 6 of 7 swatted shows the swat works, not that it is fair. The Jumper's numbers (0.45 s crouch, 50 px landing radius, 520 px reach) are the prompt's and have not been tuned by hand.
- **Not listened to.** Hiss, leap whoosh, thud, the enamel "tonk", the fridge thunk, the tap's sputter and run, and the kettle's two gliding notes all run without errors in headless Edge with a started audio context. None was heard.
- **Landing damage** was seen only in the staged check; the bot always dodged or swatted first.
- **The ledge hop** (decision 12) is in the code, but no run recorded whether it fired.
- **Spiders pushing the pendant** is code only; only the dart push was observed.
- **Timing** was measured headless on an integrated GPU, with other work on the machine (about 50 fps for every page that minute, the map included), not on a real device.
- **Firefox and Safari, Easy and Hard, reduced motion:** not tried.
- **The unique-beat screenshots** are taken in real time, so their moments are approximate.

## Hero frames (`review/current/kitchen/`, 1920 × 1080)

`dirty.jpg`, `action.jpg`, `jumper.jpg`, `makeover.jpg`, `clean.jpg`, `results.jpg`.
