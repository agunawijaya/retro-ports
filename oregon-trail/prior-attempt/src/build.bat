@echo off
REM ------------------------------------------------------------------
REM  build.bat -- compile Oregon Trail reconstruction under TP 6.0
REM  Run inside DOSBox with TP installed and tpc.exe on the path.
REM ------------------------------------------------------------------

tpc /m GAMETYPE.PAS
tpc /m RNG.PAS
tpc /m GAMESTAT.PAS
tpc /m LANDMARK.PAS
tpc /m ILLNESS.PAS
tpc /m EVENTS.PAS
tpc /m UI.PAS
tpc /m STORE.PAS
tpc /m RIVER.PAS
tpc /m HUNTING.PAS
tpc /m GRAPHX.PAS
tpc /m MUSIC.PAS
tpc /m DIALOGS.PAS
tpc /m SAVELOAD.PAS
tpc /m TRAVEL.PAS
tpc /m OREGON.PAS

if exist OREGON.EXE (
    echo Build OK -- OREGON.EXE is ready.
) else (
    echo Build FAILED -- check tpc output above.
)
