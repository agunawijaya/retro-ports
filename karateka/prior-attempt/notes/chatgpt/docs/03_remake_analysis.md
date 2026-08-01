# Phase 3 - Clean-Room Remake Analysis

## Clean-Room Boundary

Do not copy or redistribute the original executable, resource files, graphics, story text, music, or sound data. A remake should use newly created art/audio and independently written code. The original binary analysis can inform mechanics at the level of behavior: frame pacing, animation-state concepts, input mapping, scene scripting, hit windows, and rendering architecture.

## Core Loop Design

Use a fixed timestep loop. The original appears BIOS-tick paced (`int 1Ah` around `0x18BF..0x190A`), but a remake should use a stable modern tick such as 60 Hz with gameplay authored at a lower animation rate if desired.

```c
while (running) {
    input.sample();
    accumulator += clock.delta();

    while (accumulator >= FIXED_DT) {
        scene.update(FIXED_DT, input);
        accumulator -= FIXED_DT;
    }

    renderer.draw(scene, accumulator / FIXED_DT);
}
```

## Entity Model

Recommended entities:

- `Fighter`: player, enemy warriors, boss.
- `SceneObject`: gates, doors, background props, trap-like objects if used.
- `ScriptController`: runs scene commands.
- `Camera`: follows horizontal progression.
- `SoundCue`: one-shot or looping audio event.

Suggested fighter fields:

```c
struct Fighter {
    Vec2 position;
    Direction facing;
    int health;
    FighterMode mode;      // standing, running, fighting, hurt, defeated
    Action action;         // idle, walk, punch_high, kick_low, block, bow, etc.
    AnimationPlayer anim;
    HitboxSet hitboxes;
    HurtboxSet hurtboxes;
    AIController *ai;
};
```

## Animation State Machine

The original uses command/script names such as `set_fig`, `chg_fig`, `set_pos`, `inc_x`, `wait`, `loop`, and `end_animation` at load offset `0x6E16`. In a remake, represent this cleanly as declarative animation clips:

```json
{
  "name": "high_punch",
  "frames": [
    { "sprite": "fighter_punch_0", "duration": 3, "hit": false },
    { "sprite": "fighter_punch_1", "duration": 2, "hit": true, "dx": 2 },
    { "sprite": "fighter_idle", "duration": 3, "hit": false }
  ],
  "next": "idle"
}
```

Do not copy original frame data. Recreate the timing and feel with new drawings and new authored metadata.

## Combat State Machine

Use discrete action windows:

- `Idle`: can move, bow, enter fighting stance.
- `Move`: walking/running, no attack hitbox.
- `AttackStartup`: no hit yet.
- `AttackActive`: hitbox can damage.
- `AttackRecovery`: cannot immediately attack again.
- `Block`: reduces/prevents damage if facing attacker.
- `Hurt`: temporary control lock.
- `Defeated`: plays fall/death animation.

Resolution:

1. Check active attack hitboxes against opponent hurtboxes.
2. Require facing/distance constraints.
3. Apply damage once per attack action.
4. Trigger hurt/defeat animation and sound cue.

## Collision Model

Keep collision simple and inspectable:

- One body rectangle per fighter for spacing.
- Per-frame attack hitboxes.
- Per-frame hurtboxes or one stance-based hurtbox.
- Scene bounds for left/right progression.
- Optional trigger rectangles for doors, boss zone, story/cutscene starts.

Use authored rectangles rather than pixel-perfect collision. This matches the likely table-driven original behavior without copying data tables.

## Level Representation

Use scene files that reference new assets:

```json
{
  "id": "castle_gate",
  "background": "new_castle_gate.png",
  "playerStart": [40, 132],
  "enemies": [
    { "type": "guard", "x": 190, "ai": "basic_duelist" }
  ],
  "exits": [
    { "x": 300, "to": "courtyard" }
  ]
}
```

The original external `.IND/.DAT/.BCG` layout should not be reused. A remake can use JSON, PNG/WebP, WAV/OGG, and a documented asset pipeline.

## Input Abstraction

Map original-style controls to modern actions:

- Move left/right.
- Enter/leave fighting stance.
- High/mid/low attack.
- Block/duck.
- Confirm/pause.

Keep physical keys configurable. Support keyboard and gamepad through the same action API:

```c
struct InputState {
    bool left, right, up, down;
    bool attackHigh, attackMid, attackLow;
    bool block, confirm, pause;
};
```

## Rendering Abstraction

The DOS version appears to draw into buffers and then present to CGA-style video memory. For a remake:

- Use logical resolution, for example 320x200 or 384x216.
- Draw backgrounds, actors, foreground overlays, UI.
- Scale to window with nearest-neighbor if preserving pixel-art style.
- Keep renderer separate from game logic.

## Timing Model

Author gameplay in frames or seconds, but run simulation with fixed timestep. For old-game feel:

- Simulation: 60 Hz.
- Animation clip durations: integer frame counts.
- Optional low-rate animation stepping: advance animation every 2-4 simulation ticks.
- Input buffering: 2-4 frames for attacks and stance changes.

## Suggested Remake Stack

### A. JavaScript + HTML5 Canvas

Pros:

- Easiest to share and run in a browser.
- No install for players.
- Canvas is enough for 2D sprite animation.
- Good beginner feedback loop with browser dev tools.

Cons:

- Asset loading and timing need careful organization.
- Large projects benefit from TypeScript sooner than plain JavaScript.

### B. Python + Pygame

Pros:

- Very beginner-friendly syntax.
- Good for learning loops, sprites, collision, and state machines.
- Fast iteration locally.

Cons:

- Packaging/distribution is less frictionless than the web.
- Performance is fine for this project but weaker than JS Canvas/WebGL or SDL2 for large effects.

### C. C With SDL2

Pros:

- Closest mental model to low-level DOS programming.
- Excellent performance and control.
- Teaches memory, timing, input, audio, and rendering explicitly.

Cons:

- More setup and more ways for beginners to get stuck.
- Asset management, build systems, and debugging take more effort.

## Recommendation

For a beginner learning game development, use **Python + Pygame** first if the goal is understanding game loops and mechanics quickly. It is the most direct path from the pseudocode to an interactive prototype.

Use **JavaScript + HTML5 Canvas** if easy sharing in a browser matters more than Python simplicity. Use **C + SDL2** later, after the mechanics are understood, as a second implementation to learn low-level architecture.

## Clean-Room Implementation Plan

1. Create new placeholder rectangles or original student-made sprites.
2. Implement fixed timestep, input abstraction, and a single fighter state machine.
3. Add one enemy with simple distance-based AI.
4. Add authored attack hitboxes and hurtboxes.
5. Add scene transitions and new background art.
6. Add newly composed sound effects/music.
7. Compare behavior against observations, not original data.

## What To Confirm Next

- Runtime logging under DOSBox-X has confirmed the early resource load path and video mode 4. The next debugger step still requires an interactive/scriptable debugger channel for breakpoints at `0x4149`, `0x18F8`, `0x0BC9`, and `0x3BAE`.
- Trace writes to candidate fighter globals around `[0x160..0x172]`.
- Identify the exact loop head after the call from `0x5953` to `0x0255`.
- Confirm which resource groups map to player, enemies, intro, and boss scenes.
