# Oregon Trail JS — Claude Code Build Prompt
# Paste seluruh file ini ke Claude Code untuk memulai build.
#
# KONTEKS PROYEK
# ==============
# Ini adalah rebuild Oregon Trail v2.1 (MECC, 1990) dalam HTML + Vanilla JavaScript.
# Tujuan: BELAJAR — bukan komersial. Source code harus penuh comments dan penjelasan.
# Assets (PNG) sudah tersedia dari hasil reverse engineering game aslinya.
# Logic game direkonstruksi dari 4 phase binary analysis.
#
# FOLDER STRUKTUR — SELF-CONTAINED (tidak ada dependency ke folder lain)
# ======================================================================
# Game root: E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon-trail-js\
#
# oregon-trail-js\          <- ROOT, berdiri sendiri
# ├── images\               <- 29 PNG assets (sudah ada, hasil RE game asli)
# ├── index.html
# ├── css\
# │   └── style.css
# ├── js\
# │   ├── main.js
# │   ├── constants.js
# │   ├── assets.js
# │   ├── state.js
# │   ├── trail.js
# │   ├── events.js
# │   ├── store.js
# │   ├── river.js
# │   ├── hunting.js
# │   ├── scoring.js
# │   ├── renderer.js
# │   └── ui.js
# └── README.md
#
# CARA MENJALANKAN SETELAH BUILD
# ==============================
# Dari folder ROOT oregon-trail-js\ :
#   python -m http.server 8080
# Lalu buka: http://localhost:8080/
# Karena semua assets ada dalam satu folder, bisa juga langsung
# double-click index.html (tidak ada cross-origin issue).

# ===========================================================================
# INSTRUKSI UNTUK CLAUDE CODE
# ===========================================================================
#
# Bangun game Oregon Trail dalam HTML + Vanilla JavaScript.
# Buat semua file di: E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon-trail-js\
#
# ATURAN PENTING:
# 1. Setiap file harus penuh comments — jelaskan MENGAPA, bukan hanya APA
# 2. Setiap fungsi harus ada docstring/comment blok yang menjelaskan:
#    - Apa yang dilakukan fungsi ini
#    - Parameter apa yang diterima
#    - Apa yang dikembalikan
#    - Dari mana logic ini berasal (RE findings, game original, dll)
# 3. Gunakan ES6+ modern JavaScript (class, const/let, arrow functions, modules)
# 4. TIDAK BOLEH pakai framework (React, Vue, jQuery, dll) — vanilla only
# 5. Setelah setiap file dibuat, jalankan server dan verifikasi di browser
# 6. Tulis semua file LENGKAP — jangan placeholder atau "// TODO: implement"

# ===========================================================================
# ARSITEKTUR FILE
# ===========================================================================
#
# oregon-trail-js/
# ├── index.html              ← Entry point. Canvas 320x200 + UI panel di bawah
# ├── css/
# │   └── style.css           ← Styling: retro DOS look, layout, fonts
# ├── js/
# │   ├── main.js             ← Entry point JS: init game, game loop utama
# │   ├── constants.js        ← Semua konstanta game (CONFIRMED dari RE)
# │   ├── assets.js           ← Asset loader: load semua PNG, sprite definitions
# │   ├── state.js            ← GameState, PartyMember, Supplies classes
# │   ├── trail.js            ← Landmark data, daily travel logic
# │   ├── events.js           ← Event system, illness system
# │   ├── store.js            ← Store logic (Matt's General Store)
# │   ├── river.js            ← River crossing logic
# │   ├── hunting.js          ← Hunting mini-game
# │   ├── scoring.js          ← Score calculation
# │   ├── renderer.js         ← Canvas rendering: scenes, map, travel animation
# │   └── ui.js               ← Menu system, text display, dialog boxes
# └── README.md               ← Cara menjalankan + penjelasan arsitektur

# ===========================================================================
# SPEC: constants.js
# ===========================================================================
# Semua nilai di bawah adalah CONFIRMED dari reverse engineering binary,
# kecuali yang ditandai [HYPOTHESIS].
#
# export const TRAIL_LENGTH_MILES = 2000;
#
# export const OCCUPATION = {
#   FARMER:    { id: 0, name: 'Farmer',    scoreMultiplier: 3, startingCash: 400 },
#   CARPENTER: { id: 1, name: 'Carpenter', scoreMultiplier: 2, startingCash: 800 },
#   BANKER:    { id: 2, name: 'Banker',    scoreMultiplier: 1, startingCash: 1600 },
# };
# // Score formula CONFIRMED @0x13D3A: base * (3 - occupation_id)
# // Farmer dapat multiplier terbesar karena "more farmers were needed"
#
# export const DIFFICULTY = {
#   GREENHORN:   { id: 0, name: 'Greenhorn',   eventScale: 0.7 },
#   ADVENTURER:  { id: 1, name: 'Adventurer',  eventScale: 1.0 },
#   TRAIL_GUIDE: { id: 2, name: 'Trail Guide', eventScale: 1.4 },
# };
#
# export const PACE = {
#   STEADY:     { id: 0, name: 'Steady',     hoursPerDay: 8  },
#   STRENUOUS:  { id: 1, name: 'Strenuous',  hoursPerDay: 12 },
#   GRUELING:   { id: 2, name: 'Grueling',   hoursPerDay: 16 },
#   REST:       { id: 3, name: 'Rest',       hoursPerDay: 0  },
# };
# // Pace hours CONFIRMED dari string analysis unpacked EXE
#
# export const RATION = {
#   FILLING:    { id: 0, name: 'Filling',    poundsPerPersonPerDay: 3 },
#   MEAGER:     { id: 1, name: 'Meager',     poundsPerPersonPerDay: 2 },
#   BARE_BONES: { id: 2, name: 'Bare Bones', poundsPerPersonPerDay: 1 },
# };
#
# // Illness table CONFIRMED dari binary @0x24156 (names) + @0x24198 (params)
# // W0=probability weight, W1=unknown, W2=recovery days [HYPOTHESIS], W3=health drain/day [CONFIRMED]
# export const ILLNESS = [
#   { id: 0, name: 'exhaustion', w0: 200, w1: 0,  w2: 48, w3: 109 },
#   { id: 1, name: 'typhoid',    w0: 109, w1: 0,  w2: 71, w3: 49  },
#   { id: 2, name: 'cholera',    w0: 0,   w1: 49, w2: 60, w3: 36  },
#   { id: 3, name: 'measles',    w0: 67,  w1: 51, w2: 79, w3: 41  },
#   { id: 4, name: 'dysentery',  w0: 59,  w1: 0,  w2: 45, w3: 44  },
#   { id: 5, name: 'a fever',    w0: 0,   w1: 0,  w2: 53, w3: 32  },
# ];
# // Total weight = 200+109+0+67+59+0 = 435
# // Exhaustion paling sering (200/435 = 46%), a fever & cholera jarang (w0=0 = rare/trigger only)
#
# // Store prices CONFIRMED sebagai code immediates di binary (MOV AL, 0x28 = $40)
# export const STORE_PRICES = {
#   OXEN:     40,   // $40 per oxen (0x28 di assembly)
#   FOOD:     0.20, // $0.20 per pound
#   AMMO:     2,    // $2 per box of 50 rounds
#   CLOTHING: 10,   // $10 per set
#   WHEEL:    10,   // $10 per spare wheel
#   AXLE:     10,   // $10 per spare axle
#   TONGUE:   10,   // $10 per spare tongue
# };
#
# export const FERRY_COST = { SHALLOW: 5, DEEP: 10 }; // CONFIRMED dari EXE strings "$5.00" "$10.00"
# export const FORD_SAFE_DEPTH_FT = 2.5; // CONFIRMED dari dialog "2.5 feet"

# ===========================================================================
# SPEC: state.js
# ===========================================================================
# Tiga class utama yang merepresentasikan game state.
# Di game asli (Turbo Pascal), ini adalah global variables dan records.
# Di versi JS kita, kita enkapsulasi dengan proper class — ini adalah salah satu
# perbedaan utama antara coding style 1990 vs modern.
#
# class PartyMember:
#   Properties: name, health (0-100), isAlive, currentIllness (null atau illness object),
#               illnessDaysLeft, slot (0-4)
#   Methods:
#     applyDailyHealthUpdate(pace, ration) — kurangi health berdasarkan kondisi
#     applyIllness(illness) — set illness, mulai countdown
#     recoverDay() — kurangi illnessDaysLeft, cek apakah sembuh
#     die(cause) — set isAlive=false, record cause of death
#
# class Supplies:
#   Properties: food (lbs), ammunition (rounds), clothingSets, oxen,
#               spareWheels, spareAxles, spareTongues, cash
#   Methods:
#     consumeDaily(aliveCount, rationSetting) — kurangi food per hari
#     canAfford(item, quantity) — cek apakah cukup cash
#     buy(item, quantity) — kurangi cash, tambah item
#
# class GameState:
#   Properties:
#     phase: 'SETUP' | 'STORE' | 'TRAVELLING' | 'HUNTING' | 'RIVER' | 'GAMEOVER' | 'WIN'
#     occupation, difficulty, departureMonth
#     pace, ration
#     totalMiles, currentDay, currentMonth, currentYear (mulai 1848)
#     currentLandmarkIndex
#     party: array of 5 PartyMember
#     supplies: Supplies instance
#     messages: array of string (log harian untuk ditampilkan)
#   Methods:
#     advanceDay() — satu hari berlalu, panggil semua update
#     addMessage(text) — tambah ke message log
#     save() / load() — serialize/deserialize ke localStorage
#     countAlive() — berapa member masih hidup (recreate fungsi @0x13045)

# ===========================================================================
# SPEC: trail.js
# ===========================================================================
# Data landmark dan logika perjalanan harian.
#
# LANDMARK_TABLE — CONFIRMED dari binary @0x23D86, 16 records × 37 bytes
# Setiap landmark punya:
#   id, name, requiredMiles, imageFile, isFort, isRiver, songIndex
#
# const LANDMARKS = [
#   { id: 0,  name: 'Independence, Missouri', miles: 0,    image: 'vga_P0',  isFort: false, isRiver: false },
#   { id: 1,  name: 'Kansas River Crossing',  miles: 102,  image: 'vga_P1',  isFort: false, isRiver: true  },
#   { id: 2,  name: 'Big Blue River Crossing',miles: 185,  image: 'vga_P2',  isFort: false, isRiver: true  },
#   { id: 3,  name: 'Fort Kearney',           miles: 304,  image: 'vga_P3',  isFort: true,  isRiver: false },
#   { id: 4,  name: 'Chimney Rock',           miles: 554,  image: 'vga_P4',  isFort: false, isRiver: false },
#   { id: 5,  name: 'Fort Laramie',           miles: 640,  image: 'vga_P5',  isFort: true,  isRiver: false },
#   { id: 6,  name: 'Independence Rock',      miles: 830,  image: 'vga_P6',  isFort: false, isRiver: false },
#   { id: 7,  name: 'South Pass',             miles: 932,  image: 'vga_P7',  isFort: false, isRiver: false },
#   { id: 8,  name: 'Fort Bridger',           miles: 1070, image: 'vga_P8',  isFort: true,  isRiver: false },
#   { id: 9,  name: 'Green River Crossing',   miles: 1160, image: 'vga_P9',  isFort: false, isRiver: true  },
#   { id: 10, name: 'Soda Springs',           miles: 1295, image: 'vga_P10', isFort: false, isRiver: false },
#   { id: 11, name: 'Fort Hall',              miles: 1395, image: 'vga_P11', isFort: true,  isRiver: false },
#   { id: 12, name: 'Snake River Crossing',   miles: 1490, image: 'vga_P12', isFort: false, isRiver: true  },
#   { id: 13, name: 'Fort Boise',             miles: 1600, image: 'vga_P13', isFort: true,  isRiver: false },
#   { id: 14, name: 'Blue Mountains',         miles: 1680, image: 'vga_P14', isFort: false, isRiver: false },
#   { id: 15, name: 'Fort Walla Walla',       miles: 1750, image: 'vga_P15', isFort: true,  isRiver: false },
#   { id: 16, name: 'The Dalles',             miles: 1870, image: 'vga_P16', isFort: false, isRiver: false },
#   { id: 17, name: 'Willamette Valley',      miles: 2000, image: 'vga_P17', isFort: false, isRiver: false },
# ];
#
# function calculateMilesPerDay(pace, oxenCount, terrain):
#   // pace.hoursPerDay × speed_factor
#   // speed_factor berkurang jika oxen sedikit atau terrain berat
#   // [HYPOTHESIS] karena exact formula belum di-trace dari binary
#   // Estimasi: 15-20 miles per hour "traveling", 5-8 miles/hr di gunung
#
# function getDailyTrailSegment(totalMiles):
#   // Return segmen trail saat ini: 0=Plains, 1=Mid, 2=Mountains, 3=Pacific
#   // Dipakai event system untuk menentukan event probability

# ===========================================================================
# SPEC: events.js
# ===========================================================================
# Sistem event dan illness.
#
# EVENT_TABLE — CONFIRMED struktur dari binary @0x241C8 (20 rows × 8 bytes)
# 4 segmen trail dengan threshold berbeda:
#
# const EVENT_TABLE = [
#   // segment 0: Plains (0-499 miles)
#   { illnessThreshold: 10, weatherThreshold: 20, damageThreshold: 30, positiveThreshold: 40 },
#   // segment 1: Mid-trail (500-999 miles)
#   { illnessThreshold: 15, weatherThreshold: 25, damageThreshold: 35, positiveThreshold: 44 },
#   // segment 2: Mountains (1000-1599 miles)
#   { illnessThreshold: 25, weatherThreshold: 35, damageThreshold: 42, positiveThreshold: 48 },
#   // segment 3: Pacific slope (1600-2000 miles)
#   { illnessThreshold: 20, weatherThreshold: 30, damageThreshold: 38, positiveThreshold: 46 },
# ];
# // Nilai threshold di atas adalah APPROXIMATION — exact values masih [HYPOTHESIS]
# // karena exact field mapping dari 8-byte rows belum dikonfirmasi
#
# class EventSystem:
#   rollDailyEvent(gameState):
#     // Custom RNG — game asli TIDAK pakai standard LCG
#     // RNG asli berbasis timer interrupt (INT 1Ch @ 18.2Hz)
#     // Kita simulasikan dengan Math.random() + seed dari Date.now()
#     // Ini adalah simplifikasi yang sah untuk tujuan pembelajaran
#     // Roll 0-99, bandingkan dengan threshold per segmen
#     // Return: { type: 'illness'|'weather'|'damage'|'positive'|'none', detail: {} }
#
#   chooseIllness():
#     // Weighted random dari ILLNESS array menggunakan W0 sebagai weight
#     // Total weight = 435 (sum semua W0)
#     // Roll 0-434, iterate illness list, pilih yang W0-nya menutupi roll
#
#   applyEvent(event, gameState):
#     // Terapkan efek event ke game state
#     // illness → pilih random member, set illness
#     // weather → tambah/kurangi health semua
#     // damage  → kurangi spare part atau supplies
#     // positive → tambah food atau cash kecil

# ===========================================================================
# SPEC: assets.js
# ===========================================================================
# Load semua PNG dan definisikan sprite coordinates.
#
# const IMG_BASE = 'images/';
# // Path relatif dari root oregon-trail-js/ — semua PNG ada di images/ subfolder
#
# SPRITE DEFINITIONS berdasarkan inspect_assets.py analysis:
#
# vga_SUPPLIES (292×33) — 7 store item icons dalam satu baris
# Dari full-bg cols: [0, 28-36, 71-78, ...] → spacing ~36-40px
# const SUPPLY_SPRITES = {
#   OXEN:     { sx: 3,   sy: 3, sw: 25, sh: 27 },
#   FOOD:     { sx: 40,  sy: 3, sw: 25, sh: 27 },
#   AMMO:     { sx: 78,  sy: 3, sw: 25, sh: 27 },
#   CLOTHING: { sx: 116, sy: 3, sw: 25, sh: 27 },
#   WHEEL:    { sx: 154, sy: 3, sw: 25, sh: 27 },
#   AXLE:     { sx: 192, sy: 3, sw: 25, sh: 27 },
#   TONGUE:   { sx: 230, sy: 3, sw: 25, sh: 27 },
# };
# // CATATAN: koordinat ini adalah estimasi dari full-bg col data.
# // Claude Code harus verifikasi secara visual dengan menampilkan debug grid overlay
# // dan adjust sampai tiap icon benar-benar terpotong dengan pas.
#
# vga_TRAVELOX (320×139) — sprite strip animasi wagon berjalan
# Dari full-bg rows: [0, 20-21, 46-50, 74-81, 105-107, 130+]
# const TRAVELOX_FRAMES = [
#   { sy: 1,   sh: 19 },  // frame 0
#   { sy: 22,  sh: 24 },  // frame 1
#   { sy: 51,  sh: 23 },  // frame 2
#   { sy: 82,  sh: 23 },  // frame 3
#   { sy: 108, sh: 22 },  // frame 4
# ];
# const TRAVELOX_FRAME_MS = 250; // advance frame setiap 250ms
#
# vga_ANIMALS (320×83) — hunting targets dalam grid
# Dari full-bg rows [0, 32-35, 70+] dan cols [0, 79-88, 176, 255+]:
# → 2 baris × ~3-4 kolom = ~6-8 sprite hewan
# const ANIMAL_SPRITES = [
#   { name: 'deer',   sx: 1,   sy: 1,  sw: 78, sh: 31 },
#   { name: 'bison',  sx: 89,  sy: 1,  sw: 86, sh: 31 },
#   { name: 'rabbit', sx: 177, sy: 1,  sw: 77, sh: 31 },
#   // baris bawah (sy=36)
#   { name: 'bear',   sx: 1,   sy: 36, sw: 78, sh: 34 },
#   { name: 'fox',    sx: 89,  sy: 36, sw: 86, sh: 34 },
# ];
# // Semua ini perlu verifikasi visual — nama hewan adalah HYPOTHESIS
#
# class AssetLoader:
#   async loadAll() — load semua images secara parallel dengan Promise.all
#   getImage(name) — return HTMLImageElement yang sudah loaded
#   drawSprite(ctx, spriteDef, destX, destY, destW, destH) — helper crop & draw

# ===========================================================================
# SPEC: renderer.js
# ===========================================================================
# Semua rendering ke Canvas.
# Canvas size: 320×200 (resolusi game DOS asli), di-scale ke layar via CSS.
#
# class Renderer:
#   constructor(canvas, assets)
#
#   drawScene(sceneName):
#     // Gambar fullscreen scene (landmark images, dll)
#     // ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
#
#   drawTravelScreen(gameState, frameIndex):
#     // Gambar layar perjalanan harian:
#     // - Background dari vga_SCENERY atau vga_TERRAIN
#     // - Wagon animation dari vga_TRAVELOX, frame bergilir
#     // - Text overlay: tanggal, miles, cuaca
#
#   drawMap(gameState):
#     // Tampilkan vga_MAP dengan marker posisi saat ini
#     // Hitung posisi marker dari totalMiles / 2000
#
#   drawHuntingScreen(targets):
#     // Background vga_HUNTER
#     // Overlay target animals dari vga_ANIMALS di posisi acak
#     // Crosshair dari mouse position
#
#   drawTextPanel(lines, x, y, width, height):
#     // Kotak teks dengan border retro
#     // Font: monospace, warna hijau/amber seperti terminal DOS
#
#   clearScreen(color = '#000000')

# ===========================================================================
# SPEC: ui.js
# ===========================================================================
# Sistem menu dan text — sebagian besar game ini adalah text-driven.
#
# class UI:
#   constructor(renderer, gameState)
#
#   showMainMenu():
#     // Tampilkan: New Trail, Continue Trail, The Oregon Trail (info), End
#
#   showSetupFlow():
#     // Multi-step setup:
#     // Step 1: Pilih occupation (Farmer/Carpenter/Banker) + penjelasan starting cash
#     // Step 2: Pilih difficulty (Greenhorn/Adventurer/Trail Guide)
#     // Step 3: Masukkan nama 5 anggota party (input text)
#     // Step 4: Pilih bulan keberangkatan (Maret-Juni)
#     // Setiap pilihan ditampilkan sebagai numbered menu, input dari keyboard
#
#   showDailyMenu():
#     // Menu utama saat traveling:
#     // 1. Continue on trail
#     // 2. Check supplies
#     // 3. Look at map
#     // 4. Change pace    → showPaceMenu()
#     // 5. Change rations → showRationMenu()
#     // 6. Stop to rest
#     // 7. Hunt for food  → handoff ke hunting.js
#     // 8. Talk to people → ambil random dialog dari DIALOGS data
#
#   showLandmarkArrival(landmark):
#     // Tampilkan image landmark (vga_Pn)
#     // Text: "You have reached [name]"
#     // Jika fort: tawarkan resupply
#     // Jika river: handoff ke river.js
#
#   showMessage(text, duration):
#     // Pesan sementara di layar (event notification, dll)
#
#   showSuppliesScreen():
#     // Tabel supplies saat ini dengan icons dari vga_SUPPLIES
#
#   promptInput(question, callback):
#     // Text input dari user (untuk nama party, dll)
#     // Tampilkan sebagai overlay text box

# ===========================================================================
# SPEC: store.js
# ===========================================================================
# Logic toko Matt's General Store.
# "Hello, I'm Matt. So you want to..." — dialog CONFIRMED dari EXE strings
#
# class Store:
#   constructor(fortName, priceMultiplier = 1.0)
#   // priceMultiplier > 1.0 untuk fort di tengah jalan (harga lebih mahal)
#
#   showStorefront(gameState, ui):
#     // Tampilkan inventory toko
#     // Player input: pilih item, masukkan quantity
#     // Validasi: cukup cash? cukup supply di toko?
#
#   calculateCost(item, quantity):
#     // STORE_PRICES[item] × quantity × priceMultiplier
#
#   processPurchase(item, quantity, gameState):
#     // Kurangi cash, tambah supply ke gameState.supplies

# ===========================================================================
# SPEC: river.js
# ===========================================================================
# Logic penyeberangan sungai.
# Confirmed dari dialog strings: "2.5 feet", "$5.00", "$10.00", "ferry not operating"
#
# class RiverCrossing:
#   constructor(riverName, baseDepthFt)
#
#   getDepth():
#     // Random depth: baseDepthFt ± 30% variasi
#     // Bisa lebih dalam di musim semi (salju mencair)
#
#   showCrossingMenu(depth, gameState, ui):
#     // Display: kedalaman sungai, kondisi arus
#     // Menu: 1.Ford 2.Caulk 3.Ferry($5/$10) 4.Hire Guide
#
#   ford(depth, gameState):
#     // Jika depth <= 2.5: success
#     // Jika depth > 2.5: roll risiko (70% failure)
#     // Failure consequences: kehilangan supplies, bisa member drowning
#
#   caulk(gameState):
#     // 70% berhasil, 30% wagon terbalik
#     // Wagon terbalik: kehilangan ~50% food dan ammo
#
#   ferry(gameState):
#     // Butuh cash: $5 (shallow) atau $10 (deep)
#     // Jika river terlalu dangkal: "Ferry not operating today"
#     // Selalu sukses jika punya uang
#
#   hireGuide(gameState):
#     // Selalu sukses, biaya $15-25 [HYPOTHESIS — belum dikonfirmasi dari binary]

# ===========================================================================
# SPEC: hunting.js
# ===========================================================================
# Mini-game berburu — satu-satunya real-time gameplay.
# Game asli: SPACE = tembak, joystick/keyboard untuk aim
# Versi JS kita: mouse untuk aim, click untuk tembak
#
# class HuntingGame:
#   constructor(canvas, assets, gameState)
#
#   start():
#     // Check: punya amunisi?
#     // Setup: spawn 3-5 target hewan dari ANIMAL_SPRITES di posisi random
#     // Start game loop: requestAnimationFrame
#     // Timer: 30 detik (atau sampai amunisi habis)
#
#   // Hewan bergerak horizontal, bounce di tepi canvas
#   // Click = tembak, reduce ammo by 1
#   // Hit detection: bounding box sederhana
#   // Setiap hit: add meat (deer=50lb, bison=100lb, rabbit=10lb) [HYPOTHESIS values]
#
#   end():
#     // Tambah meat ke food supply
#     // Kurangi amunisi yang dipakai
#     // Return ke daily menu dengan report hasil

# ===========================================================================
# SPEC: scoring.js
# ===========================================================================
# Score calculation — CONFIRMED dari disassembly @0x13D3A
#
# function calculateFinalScore(gameState):
#   // Formula CONFIRMED: base * (3 - occupation_id)
#   // occupation_id: 0=Farmer(×3), 1=Carpenter(×2), 2=Banker(×1)
#   //
#   // base = sum of:
#   //   - remaining cash (nilai penuh)
#   //   - remaining food × 0.2 (approximate food value)
#   //   - remaining ammo × 2 (price per box)
#   //   - remaining oxen × 40
#   //   - surviving party members × 500 [HYPOTHESIS — nilai belum dikonfirmasi]
#   // Base formula MASIH [HYPOTHESIS] — full formula tidak berhasil di-trace
#
# function checkHighScore(score, name):
#   // Bandingkan dengan localStorage high scores
#   // 10 slot, seperti HISCORES.REC di game asli
#   // Pre-seed dengan 10 nama historis Oregon Trail (CONFIRMED dari binary):
#   //   Stephen Meek (7650), Celinda Hines (5694), Andrew Sublette (4138), dll

# ===========================================================================
# SPEC: index.html
# ===========================================================================
# <!DOCTYPE html>
# <html lang="en">
# <head>
#   <meta charset="UTF-8">
#   <title>The Oregon Trail — JS Rebuild (Study Project)</title>
#   <link rel="stylesheet" href="css/style.css">
# </head>
# <body>
#   <!-- Canvas utama: 320x200 (resolusi DOS asli), di-scale 2x via CSS -->
#   <div id="game-container">
#     <canvas id="game-canvas" width="320" height="200"></canvas>
#     <!-- Panel UI di bawah canvas: text input, message log -->
#     <div id="ui-panel">
#       <div id="message-log"></div>
#       <div id="input-area"></div>
#     </div>
#   </div>
#   <!-- Load semua JS modules — urutan penting karena ada dependencies -->
#   <script type="module" src="js/main.js"></script>
# </body>
# </html>
#
# CSS style.css:
#   - Background: #000 (hitam seperti DOS)
#   - Canvas: scale 2x (640x400 display dari 320x200 native)
#   - Font: 'Courier New' monospace, warna #00ff00 (terminal green)
#   - Game container: centered, border solid 2px #00ff00
#   - Message log: scrollable, max-height 150px

# ===========================================================================
# SPEC: README.md
# ===========================================================================
# Tulis README dengan konten:
# 1. Apa ini (study project rebuild Oregon Trail)
# 2. Cara menjalankan (python -m http.server 8080 dari parent folder)
# 3. Struktur file dan apa fungsi masing-masing
# 4. Sumber: dari mana game logic ini berasal (RE findings)
# 5. Apa yang dikonfirmasi dari binary vs hipotesis
# 6. Referensi ke LEARN_OregonTrail.md dan oregon_trail_reverse.md

# ===========================================================================
# URUTAN BUILD YANG HARUS DIIKUTI CLAUDE CODE
# ===========================================================================
#
# Phase 1 — Foundation (verifikasi bisa jalan di browser):
#   1. Buat index.html + style.css
#   2. Buat constants.js (semua konstanta, tidak ada logic)
#   3. Buat assets.js (load 1 image dulu: logo_vga.png) → test di browser
#   4. Buat renderer.js (drawScene saja dulu) → test: tampil logo
#   CHECKPOINT: Browser harus menampilkan logo game
#
# Phase 2 — State & Core Logic:
#   5. Buat state.js (GameState, PartyMember, Supplies)
#   6. Buat trail.js (LANDMARKS array, calculateMilesPerDay)
#   7. Buat events.js (EventSystem dengan rollDailyEvent)
#   8. Buat scoring.js
#   CHECKPOINT: Bisa instantiate GameState di console, advanceDay() jalan
#
# Phase 3 — UI & Game Flow:
#   9. Buat ui.js (showMainMenu, showSetupFlow)
#   10. Buat store.js
#   11. Buat river.js
#   12. Update main.js dengan game loop lengkap
#   CHECKPOINT: Bisa main dari menu → setup → store → mulai travel
#
# Phase 4 — Visual Polish & Mini-game:
#   13. Verifikasi sprite coordinates (debug grid overlay untuk vga_SUPPLIES, vga_TRAVELOX)
#   14. Buat hunting.js
#   15. Integrasikan travel animation (vga_TRAVELOX frames)
#   16. Test full game flow: start → travel → events → win/lose
#   CHECKPOINT: Full game bisa dimainkan end-to-end
#
# Phase 5 — Comments & Documentation:
#   17. Review semua file, pastikan setiap fungsi ada comment block
#   18. Tambahkan inline comments untuk logic yang tidak obvious
#   19. Tulis README.md
#   CHECKPOINT: Code bisa dibaca oleh orang yang tidak ikut membuatnya

# ===========================================================================
# NOTES UNTUK CLAUDE CODE
# ===========================================================================
#
# 1. SPRITE VERIFICATION WAJIB:
#    Setelah load vga_SUPPLIES, vga_TRAVELOX, vga_ANIMALS:
#    Buat halaman debug sementara (debug.html) yang menampilkan semua sprite
#    dengan grid overlay berwarna untuk verifikasi koordinat.
#    Adjust SUPPLY_SPRITES, TRAVELOX_FRAMES, ANIMAL_SPRITES sampai visual benar.
#
# 2. JANGAN HARD-CODE TEXT:
#    Semua text in-game (menu labels, event messages, NPC dialogs) harus di
#    constants.js atau file data terpisah — bukan di-embed di dalam logic functions.
#    Ini penting untuk maintainability dan pembelajaran.
#
# 3. COMMENTS HARUS SUBSTANTIF:
#    Bukan: // increment counter
#    Tapi:  // Advance the day counter. Each day = one iteration of the travel loop,
#           // which is how the original Turbo Pascal game was structured.
#           // See DailyTravelLoop() in LEARN_OregonTrail.md §5.1
#
# 4. GAME LOGIC REFERENCE:
#    Setiap kali implement sebuah game mechanic, sertakan comment yang menyebutkan:
#    - Apakah ini CONFIRMED dari binary atau HYPOTHESIS
#    - Binary offset jika CONFIRMED (e.g., "@0x13D3A score formula")
#    - File referensi: LEARN_OregonTrail.md section berapa
#
# 5. SERVER UNTUK TEST:
#    Dari folder ROOT oregon-trail-js\ :
#      python -m http.server 8080
#    Akses: http://localhost:8080/
#    Karena folder berdiri sendiri, bisa juga langsung double-click index.html.
#    Tidak ada cross-origin issue karena semua assets dalam satu folder.
#
# 6. ERROR HANDLING:
#    Semua asset load harus punya fallback yang jelas:
#    Jika image gagal load → tampilkan colored rectangle dengan label nama file
#    Ini memudahkan debugging saat ada path issue
