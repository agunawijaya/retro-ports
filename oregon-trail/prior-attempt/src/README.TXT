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

DEEP STATIC ANALYSIS PASS (after Gap #3 closure)
------------------------------------------------
A second pass of static analysis upgraded several items previously
marked APPROXIMATED:

  - TOMB.REC layout                  -> CLOSED structurally
  - Music tempo handling             -> VERIFIED
  - Ration consumption (3/2/1 lbs)   -> CONFIRMED (was correct)
  - JOYCAL.REC layout                -> RE-VERIFIED

One item moved from APPROXIMATED to PARTIAL:
  - Score formula structure          -> component-wise sum confirmed
                                        from output template strings;
                                        exact per-resource weights still
                                        unknown.

Items that remained APPROXIMATED after the pass:
  - Pace hour constants (8/12/16)    -> NOT in binary as expected
  - Speed per oxen count             -> no constant cluster found
  - Hunting animal weights           -> not located in static scan

See STATICTRACE.TXT for the full deep-analysis report.

CLOSED GAPS
-----------
The reverse-engineering analysis originally flagged five UNCERTAIN
items.  Status as of this rebuild:

1. DIALOGS.REC 11-byte metadata block        -- CLOSED   (see DIAMETA.TXT)
   The "metadata" Phase 1 reported was an artefact of record 0.
   Records are fixed 286-byte slots with a constant trailer marker
   (00 00 00 00 4D 00 00 01 ...) at offset -16.  Per-record binding
   is the SLOT INDEX itself: slot position maps to a landmark zone
   along the trail.  Verified by matching place-name mentions in
   each record against the zone formula -- 10/10 spot checks align.
   Implemented as ReadDialogForMiles() in DIALOGS.PAS.

2. Copy-protection check                      -- CLOSED   (see COPYPROT.PAS)
   Time-bomb gate compares DOS date against 35000 days since the
   Borland TP epoch (= 1995-10-28).  Not implemented in the rebuild.

3. Exact RNG algorithm                        -- CLOSED   (see RNGNOTES.TXT)
   Combined static disasm + live DOSBox-X trace.  Startup installs a
   timer ISR for ~5.5 s to gather seed entropy, then RESTORES the
   previous handler.  INTHAND 1C in the live debugger confirmed the
   default callback is back in place during gameplay.  A memory-write
   breakpoint on the runtime counter at 0x2348:0x16B2 fired during a
   single 3-draw river-crossing event and showed exactly +3 delta
   (00->03).  RNG model: Counter += 1; return Counter mod N.  No LCG
   multiplier or XOR mask in the binary -- entropy lives in the seed.

4. Flag 0x7D on Fort Bridger / Walla Walla    -- CLOSED   (see LANDMARK.PAS)
   Flag byte at offset 0 of the 37-byte landmark record.  Appears
   only at the two landmarks that historically had alternate-route
   forks (Sublette Cutoff at Bridger, Whitman Mission alternate at
   Walla Walla).  Encoded as LmFlagFork; consumed by OfferRouteFork
   in TRAVEL.PAS.

5. PCX RLE decoder in GRAPHX                  -- CLOSED   (see GRAPHX.PAS)
   ZSoft RLE walked straight to mode-13h VRAM; shared palette from
   PAL.256; archive scanned by header signature in semantic order
   from work/extract_graphics.py.

Quick summary of each closure:

#2 Copy-protection
  Time-bomb gate: `cmp word [bp-4], 0x88B8` at 0x14C06 compares the DOS
  system date (as days-since-1899-12-30) against 35000, which resolves
  to 1995-10-28.  Past that date, the game shows "PROGRAM IS NOT
  AVAILABLE" and exits.  This is a soft expiry, not a license check.
  The rebuild deliberately ships without the gate; see COPYPROT.PAS for
  the documented reference implementation.

#5 PCX RLE decoder
  Standard ZSoft format.  GRAPHX.DecodeVgaPcx walks the RLE stream
  (byte & 0xC0 == 0xC0 -> run-length, else literal) and blits straight
  to mode-13h VRAM at A000:0000.  Shared palette comes from PAL.256
  (the 768-byte VGA palette appended after the 0x0C marker).  The
  pcxLib archives are scanned by walking for ZSoft headers in offset
  order; the 29-image scan order matches the semantic naming in
  work/extract_graphics.py.

NEXT STEPS FOR A FULL FIDELITY BUILD
------------------------------------
* Wire a PCX RLE decoder into GRAPHX.ShowPicture.
* Tighten the event-table row selection (PickRow) once the segment
  indexing scheme is fully decoded from disassembly.
* Decode the DIALOGS.REC metadata block to gate advice on actual
  game events / location.
* Verify save/load round-trip against the shipped ZOP12.GAM.

==============================================================================
