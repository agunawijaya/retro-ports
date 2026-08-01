==============================================================================
  THE OREGON TRAIL -- Turbo Pascal Reconstruction
  source tree:  .\src
==============================================================================

WHAT THIS IS
------------
A clean-room reconstruction of MECC's Oregon Trail v2.1 (1990 DOS release)
in Turbo Pascal, built from the reverse-engineering notes in:

  ..\oregon_trail_reverse.md       (Phase 1-5 analysis)
  ..\LEARN_OregonTrail.md          (architecture + pseudo-code)
  ..\work\*.txt                    (data-table extractions)

The original game was compiled with Turbo Pascal 5.5 or 6.0, packed with
LZEXE 0.91, and shipped a single OREGON.EXE plus data files.  This rebuild
mirrors the documented architecture: a single program with units for game
state, RNG, events, illness, landmarks, river crossing, hunting, the store,
graphics, music, NPC dialog, save/load, and the daily travel loop.

WHAT IS REPRODUCED
------------------
* The numerical mechanics confirmed by binary analysis:
    - illness W0..W3 quad (exhaustion 200/0/48/109 etc.)
    - 20-row event probability table at 0x241C8
    - 16 landmark names + ordering (historical place names)
    - score formula  base * (3 - occupation_index) * alive_count
    - starting cash  $400 / $800 / $1600
    - base store prices  $40 ox, $10 wheel, etc.
    - save-file 144-byte struct dump shape
* The runtime architecture: timer-driven custom RNG, daily loop,
  BGI graphics wrapper, Genus pcxLib TOC walker, PLAY-string music
  parser.

WHAT IS NOT REPRODUCED
----------------------
* DIALOGS.REC contents.  The NPC text is shipped data and stays in the
  original file -- the rebuild's DIALOGS unit reads it from disk at
  runtime.
* Verbatim in-game prose, menu wording, or tombstone epitaphs.  The
  rebuild uses its own short prompts.
* Exact graphics / songs.  These are loaded from the original asset
  files (OTMCGA.PCL, SONGS.TXT, BIT8X8.GFT) at runtime.

FILE INDEX
----------
  OREGON.PAS    main program: title, menu, new-game wizard
  TRAVEL.PAS    daily loop, victory / death / winter endings
  UI.PAS        text menus, status panel, prompts
  GAMETYPE.PAS  shared types and constants
  GAMESTAT.PAS  global TGameState plus party / food helpers
  RNG.PAS       custom timer-driven RNG
  LANDMARK.PAS  16-landmark table (incl. miles-required)
  EVENTS.PAS    20-row event probability table + dispatcher
  ILLNESS.PAS   6-illness param table + sickness daily tick
  STORE.PAS     Matt's General Store / fort resupply
  RIVER.PAS     ford / caulk / ferry / hire-guide
  HUNTING.PAS   real-time hunt minigame
  GRAPHX.PAS    BGI + Genus pcxLib wrapper, 8x8 font
  MUSIC.PAS     SONGS.TXT PLAY-string parser
  DIALOGS.PAS   length-prefixed NPC record reader
  SAVELOAD.PAS  *.GAM / HISCORES.REC / TOMB.REC
  MAKEFILE      Borland MAKE rules
  README.TXT    this file

BUILDING
--------
The source targets Turbo Pascal 6.0.  From a DOS prompt with TP6 in PATH:

    tpc /m OREGON.PAS

Or with the Borland MAKE rules in MAKEFILE:

    make

The game expects to be run from the directory holding the original
asset files (CGA.BGI / VGA256.BGI / OTCGA.PCL / OTMCGA.PCL / SONGS.TXT
/ DIALOGS.REC / BIT8X8.GFT).

RUNNING IN A MODERN ENVIRONMENT
-------------------------------
Use DOSBox or DOSBox-X to host TP6 and run OREGON.EXE.  Mount this
directory:

    mount c "E:\Projects\BASIC Programs\Collections\Oregon Trail\..."
    c:
    cd src
    tpc /m OREGON.PAS
    oregon

KNOWN GAPS
----------
The reverse-engineering analysis flagged the following as UNCERTAIN
or partially understood -- they are simulated approximately here:

1. The 11-byte DIALOGS.REC metadata block (event-binding flags).  The
   DIALOGS unit currently treats it as opaque and serves random lines.
2. The PRODUCT.PF copy-protect check.  Not implemented; the rebuild
   makes no startup gate.
3. Exact RNG algorithm.  The rebuild uses a timer-driven LCG mix,
   which matches the documented behavior (per-press unpredictable)
   without claiming to reproduce the exact bit sequence.
4. The 0x7D flag found on Fort Bridger and Fort Walla Walla records
   in the landmark table -- meaning still unknown; flagged in code.
5. The PCX decode path in GRAPHX.PAS leaves the actual RLE-to-VRAM
   write stubbed: in the original this is provided by the Genus
   pcxLib runtime library, which would need to be linked or
   reimplemented to render the landmark backdrops.

NEXT STEPS FOR A FULL FIDELITY BUILD
------------------------------------
* Wire a PCX RLE decoder into GRAPHX.ShowPicture.
* Tighten the event-table row selection (PickRow) once the segment
  indexing scheme is fully decoded from disassembly.
* Decode the DIALOGS.REC metadata block to gate advice on actual
  game events / location.
* Verify save/load round-trip against the shipped ZOP12.GAM.

==============================================================================
