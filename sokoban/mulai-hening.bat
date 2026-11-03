@echo off
rem Mulai Hening: build the game, then open it in the default browser.
rem The build is one file (game\dist\hening.html) that plays offline from disk.
rem Needs Node.js (npm). The rooms come from the original 1984 files in
rem original\sokoban\ (never committed): the first run imports them; without
rem them the game starts with its one small practice room.
rem
rem   mulai-hening.bat          build, then play
rem   mulai-hening.bat cepat    play the last build without building again

setlocal
cd /d "%~dp0game"

if /i "%~1"=="cepat" if exist "dist\hening.html" goto play

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js tidak ditemukan. Pasang Node.js dari https://nodejs.org lalu coba lagi.
  if exist "dist\hening.html" goto play
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Memasang paket untuk pertama kali...
  call npm install
  if errorlevel 1 goto failed
)

if not exist "src\data\rooms.generated.json" (
  if exist "..\original\sokoban" (
    echo Mengimpor 50 ruang dari original\sokoban untuk pertama kali...
    call npm run rooms
    if errorlevel 1 goto failed
  ) else (
    echo original\sokoban tidak ada: Hening dimulai dengan satu ruang latihan saja.
  )
)

echo Membangun Hening...
call npm run build
if errorlevel 1 goto failed

:play
if not exist "dist\hening.html" goto failed
echo Membuka Hening di peramban...
start "" "%cd%\dist\hening.html"
exit /b 0

:failed
echo.
echo Build gagal. Lihat pesan di atas.
if exist "dist\hening.html" (
  echo Membuka build terakhir yang masih ada...
  start "" "%cd%\dist\hening.html"
  pause
  exit /b 0
)
pause
exit /b 1
