# Brief: build the Karateka port

You are picking this up on a machine that has not seen this project before.
Read this file to the end before writing anything. It is written to save you
the two months somebody else already spent.

There was an earlier attempt. It failed, it knew why, and it wrote that down
honestly. Its port has been deleted; its notes have not. **The single most
useful thing you can do first is read
`prior-attempt/notes/10-investigation-progress.md`, section 12** — it is a map
of the minefield, paid for.

---

## 1. What this is, and the one rule that cannot bend

`retro-ports` teaches programming to people who do not program yet, by taking
apart old games and rebuilding them. The reconstruction is the means; the port
and the documents are the deliverable.

**Nothing derived from the game may ever be committed.** Not the binary, not a
byte-identical reconstruction of it, not extracted sprites, not memory dumps,
not screenshots. `original/`, `recovered/` and `reference/` are gitignored, and
`*.exe`, `*.com`, `*.png`-adjacent binaries are blocked repository-wide as a
backstop. A sprite sheet pulled out of a copyrighted game is still that game,
and a PNG does not feel like a binary, which is exactly why people forget.

Before any commit that adds files, read what you staged. Never `git add -A`.

## 2. What already exists, and is proven

`KARATEKA.EXE` (87,990 bytes) is reconstructed. From your own copy:

```powershell
cd karateka
.\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe
```

Three steps — reconstruct, apply names, **reassemble and compare** — and it
refuses to report success on anything short of an identical SHA-256
(`C8736BBA…`). It prints its own audit; **read that output, never this file's
memory of it.** Today it says: 218 routines and 338 globals named with the
evidence for each, all 165 call targets, no unnamed tail-call entries, 334 of
370 bracketed constants with the other 36 recorded as displacements, and 58
data spans covering all 59,670 bytes of the data segment with no gap.

Put your copy in `karateka\original\KARATEKA.EXE`. The repository ships none.

### Coordinates — get this right on day one

- **Routine keys** in `symbols.json` are image offsets.
- **Global keys** are offsets from DS, which the entry stub sets to
  image + `0x6CA0`.
- Add `0x200` to an image offset for a file offset.

A key in the wrong coordinate substitutes nowhere and **nothing complains**.
That silence has cost this project two sessions. `annotate.py` now reports it;
believe the report.

## 3. Why the previous port failed, precisely

Its own words: *"There is no PNG in this project of a complete character
generated from recipe + sprite data alone."* Every clean character image it
produced was **cropped from a runtime shadow-buffer dump**, not built from the
game's data. So when it came to ship a port, it used a sprite atlas ripped from
the **NES** version — a different game, different artists — greyscaled over
backgrounds cropped from those same dumps.

Nothing on its screen came from reading `KARATEKA.EXE`. That is not a partial
port; it is a different thing wearing the name. It has been removed.

It listed three blockers. **Two are now answered, at the same addresses it
named**, because the reconstruction happened after it stopped:

| what blocked it | where it is now |
|---|---|
| sub-byte X rotation — `mov cl, [0x4227]; ror ax, cl`, "colours come out striped" | `0x4227` = `shift_in_byte`, *"how far into a byte the column starts; the ror count"*. Routine `draw_sprite_shifted` at image `0x0640`, *"sets the same stream globals plus the shift"* |
| shadow-buffer read-modify-write — knew the formula, not the buffer | `0x0337` = `screen_buffer`, *"16,000 bytes, 200 rows of 80 — an off-screen CGA frame the blitter draws into"*. `blit_frame` at `0x00D68` copies it to `0xB800` |
| figure 102 — a slot filled at run time, absent from the `.DAT` files | still open, and **not readable from the file**. See §5: hook it |

The rest of the blitter, already named:

```
0x083C   draw_sprite            takes an id, sets both stream pointers from two tables
0x0640   draw_sprite_shifted    the same, plus the shift
0x0B95   next_pixel_byte        the run-length reader both streams go through
0x00A1E  draw_sprite_body       the draw proper
0x00B1E  blit_column_body       walks the mask table
0x00BC9  draw_layers            dispatches by layer, min to max
0x00C52  compose_scene          the whole picture
0x00D68  blit_frame             screen_buffer -> 0xB800
0x1027   load_sprite_set        indexes the ks*/km* name table

0x421E   shape_stream        0x4220  mask_stream       0x4227  shift_in_byte
0x422E   mask_run_count      0x422F  mask_run_value    0x4234  edge_masks
0x443D   sprite_shift_table  0x443E  sprite_shift_count  0x443F  sprite_mask_index
0x0337   screen_buffer
```

And the fight, for later:

```
0x1B27   init_fight             the walls, the health, the starting pose
0x22BC   fight_frame            one frame for both fighters
0x022E1  fight_step             both cursors, both positions, the phase
0x2324   fight_step_player      advance or restart the player's move
0x246B   fight_step_guard       the same for the guard
```

## 4. What "done" looks like

[`../paratrooper/web/`](../paratrooper/web/) is the only finished port here and
is your template. Look at it before you design anything. It is **three files**:
`game.js`, `index.html`, `style.css`. It loads **no images at all** — no atlas,
no PNG, no `drawImage`. Everything on screen is drawn from the reading.

That is the standard. If your port needs an asset file ripped from the game,
you have not finished decoding; you have moved the undone work into a binary.

`../paratrooper/docs/01`–`06` is the document set that goes with it. Karateka
has `01`–`05`; `06-web-code.md` is missing and is yours to write.

## 5. Build the referee first. Before one line of the port.

This is the whole point of the brief. The previous session traced the algorithm
end to end and still could not draw a character, because **it had no way to be
told it was wrong**. It compared its work to its own expectations and gave up
by cropping the answer out of a memory dump.

You have `DOS-Decompiler/tools/comrun.py`: the game running under Unicorn, with
hooks. So:

1. Render one sprite from the `.DAT` data with your decoder.
2. Run the game under `comrun.py` to the frame that draws it.
3. Read `screen_buffer` (DS `0x0337`, 200 rows × 80 bytes) out of the machine.
4. **Compare pixel for pixel.** Match means the decoder is proven. Mismatch
   tells you which pixels, which is what makes it fixable.

`DOS-Decompiler/knowledge/12-hooking-the-right-thing.md` is how to choose the
hook, and why the obvious one is usually the useless one. Read it. In the same
week this brief was written, that method found ten bugs in a sister tool in one
session — every one of which had been producing plausible output for months.

For figure 102: hook the slot, load a scene, record what gets copied in and by
which routine. That is the same method, applied to the one thing the file
genuinely does not contain.

## 6. Working rules you will otherwise learn the hard way

- **Measure, never recall.** Six times in this project the question "is it
  finished?" found a real gap, and every time the previous count read 100%
  against the wrong denominator. Put the denominator in the same sentence as
  the percentage.
- **A percentage that is easy to reach is measuring the wrong thing.** "Every
  call explained" once meant every call produced *a* placement, not the right
  one.
- **Every name carries its evidence.** A name with no `why` behind it is a
  guess the next reader will believe. This project has published three of those
  and had to withdraw them.
- **Do not use heredocs to write scripts.** They eat backslash escapes, and the
  check then passes while measuring nothing. Write files with the editor tool.
- **No absolute paths in repository code.** Toolchains differ between machines;
  take them as parameters.
- Run `python ..\..\DOS-Decompiler\tools\docaudit.py .` after changing any
  document — it finds every number in every `.md` and prints it beside what the
  symbol files say now.

## 7. The order

1. Read `prior-attempt/notes/10-investigation-progress.md` §12, then §2 and §11.
2. Get `build.ps1` to report BYTE-IDENTICAL on your machine.
3. Build the referee in §5. Nothing else until a decoded sprite matches
   `screen_buffer` exactly.
4. Decode: sprites, then a static scene, then an animation.
5. Then, and only then, the port — ParaTrooper's shape.
6. `docs/06-web-code.md`, and update `docs/04` and `05` to match what you built.
7. Delete `prior-attempt/` when nothing in it is needed any more, and say so in
   the commit.

Good luck. The hard part is not the graphics format — that is already traced.
The hard part is refusing to accept output you cannot check.
