# Oregon Trail JS — Prompt Final: Semua Perbaikan
# Paste seluruh file ini ke Claude Code.
#
# Semua koordinat dan data di dokumen ini SUDAH TERVERIFIKASI VISUAL.
# Jangan ubah nilai numerik tanpa verifikasi ulang.
#
# Working directory: E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon-trail-js\
# vga_MAP.png: 640x399, sudah tersedia di images/

# =============================================================================
# PERBAIKAN 1: Landing page — logo menempel ke atas, wagon di bawah logo
# =============================================================================
# Di renderer.js, fungsi drawMainMenu(frameIndex):
#
#   drawMainMenu(frameIndex = 0) {
#     this.clearScreen('#1a0a00');
#
#     // Logo menempel ke atas canvas (y=0, tidak ada jarak)
#     const logo = this.assets.getImage(ASSET_KEYS.LOGO);
#     if (logo) {
#       const logoH = Math.floor(logo.naturalHeight * (this.width / logo.naturalWidth));
#       this.ctx.drawImage(logo, 0, 0, this.width, logoH);
#     }
#
#     // Wagon di bawah logo, bukan di posisi % canvas
#     const logoDisplayH = logo ? Math.floor(logo.naturalHeight * (this.width / logo.naturalWidth)) : 30;
#     const frame = WAGON_FRAMES.frames[frameIndex % WAGON_FRAMES.frames.length];
#     const scale = 3;
#     const dw = frame.sw * scale;
#     const dh = frame.sh * scale;
#     const dx = Math.floor((this.width - dw) / 2);
#     const dy = logoDisplayH + 10;  // tepat di bawah logo + 10px margin
#     this.assets.drawSprite(this.ctx, WAGON_FRAMES.sourceKey, frame, dx, dy, dw, dh);
#   }

# =============================================================================
# PERBAIKAN 2: Store screen — supply coordinates TERVERIFIKASI
# =============================================================================
# Update SUPPLY_ICONS di assets.js dengan koordinat ini PERSIS:
#
#   export const SUPPLY_ICONS = {
#     sourceKey: ASSET_KEYS.SUPPLIES,
#     sprites: {
#       FOOD:          { sx:   2, sy:  0, sw:  52, sh:  49 },
#       WHEEL:         { sx:  59, sy:  0, sw:  46, sh:  49 },
#       AXLE:          { sx:  59, sy:  0, sw:  46, sh:  49 },
#       TONGUE:        { sx:  59, sy:  0, sw:  46, sh:  49 },
#       OXEN:          { sx: 111, sy:  0, sw:  66, sh:  49 },
#       CLOTHING:      { sx:   3, sy: 51, sw:  57, sh:  41 },
#       AMMO:          { sx:  70, sy: 51, sw:  76, sh:  41 },
#       STORE_MANAGER: { sx: 201, sy:  0, sw:  47, sh: 119 },
#     },
#   };
#
# Store screen layout (renderer.js drawStoreScreen()):
#   KIRI (38%): STORE_MANAGER portrait dari vga_SUPPLIES (sx:201)
#   KANAN (62%): grid 3x3 items — 7 items, 2 slot kosong atau info cash
#
#   drawStoreScreen(playerCash) {
#     this.clearScreen('#1a0a00');
#     const leftW = Math.floor(this.width * 0.38);
#
#     // Store manager portrait (kiri)
#     const suppImg = this.assets.getImage(ASSET_KEYS.SUPPLIES);
#     if (suppImg) {
#       const mgr = SUPPLY_ICONS.sprites.STORE_MANAGER;
#       // Scale manager to fill left column
#       const scale = Math.min(leftW / mgr.sw, this.height / mgr.sh);
#       const dw = Math.floor(mgr.sw * scale);
#       const dh = Math.floor(mgr.sh * scale);
#       const dx = Math.floor((leftW - dw) / 2);
#       const dy = Math.floor((this.height - dh) / 2);
#       this.assets.drawSprite(this.ctx, ASSET_KEYS.SUPPLIES, mgr, dx, dy, dw, dh);
#     }
#
#     // Matt's header
#     this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
#     this.ctx.fillRect(0, 0, leftW, 18);
#     this.ctx.fillStyle = '#ffff00';
#     this.ctx.font = 'bold 8px monospace';
#     this.ctx.textAlign = 'center';
#     this.ctx.fillText("Matt's Store", leftW/2, 12);
#     this.ctx.fillStyle = '#00ff00';
#     this.ctx.font = '7px monospace';
#     this.ctx.fillText(`Cash: $${playerCash}`, leftW/2, this.height - 5);
#
#     // Grid 3x3 items (kanan)
#     const rightX = leftW + 3;
#     const rightW = this.width - rightX;
#     const cols = 3; const rows = 3;
#     const cellW = Math.floor(rightW / cols);
#     const cellH = Math.floor(this.height / rows);
#
#     const items = [
#       { key:'FOOD',     label:'Food',     price:`$${STORE_PRICES.FOOD}/lb`    },
#       { key:'OXEN',     label:'Oxen',     price:`$${STORE_PRICES.OXEN}/ea`    },
#       { key:'AMMO',     label:'Ammo',     price:`$${STORE_PRICES.AMMO}/box`   },
#       { key:'CLOTHING', label:'Clothing', price:`$${STORE_PRICES.CLOTHING}/set`},
#       { key:'WHEEL',    label:'Wheel',    price:`$${STORE_PRICES.WHEEL}/ea`   },
#       { key:'AXLE',     label:'Axle',     price:`$${STORE_PRICES.AXLE}/ea`    },
#       { key:'TONGUE',   label:'Tongue',   price:`$${STORE_PRICES.TONGUE}/ea`  },
#     ];
#
#     items.forEach((item, idx) => {
#       const col = idx % cols;
#       const row = Math.floor(idx / cols);
#       const cx = rightX + col * cellW;
#       const cy = row * cellH;
#
#       this.ctx.fillStyle = '#001500';
#       this.ctx.fillRect(cx+1, cy+1, cellW-2, cellH-2);
#       this.ctx.strokeStyle = '#003300';
#       this.ctx.lineWidth = 1;
#       this.ctx.strokeRect(cx+1, cy+1, cellW-2, cellH-2);
#
#       // Number shortcut
#       this.ctx.fillStyle = '#888';
#       this.ctx.font = '7px monospace';
#       this.ctx.textAlign = 'left';
#       this.ctx.fillText(`${idx+1}.`, cx+3, cy+9);
#
#       // Icon — scale to fit cell nicely
#       const sp = SUPPLY_ICONS.sprites[item.key];
#       const iconScale = Math.min((cellW-8)/sp.sw, (cellH-24)/sp.sh);
#       const iconW = Math.floor(sp.sw * iconScale);
#       const iconH = Math.floor(sp.sh * iconScale);
#       const iconX = cx + Math.floor((cellW - iconW) / 2);
#       const iconY = cy + 10;
#       this.assets.drawSprite(this.ctx, ASSET_KEYS.SUPPLIES, sp, iconX, iconY, iconW, iconH);
#
#       this.ctx.fillStyle = '#00ff00';
#       this.ctx.font = '7px monospace';
#       this.ctx.textAlign = 'center';
#       this.ctx.fillText(item.label, cx+cellW/2, iconY+iconH+8);
#       this.ctx.fillStyle = '#ffff00';
#       this.ctx.fillText(item.price, cx+cellW/2, iconY+iconH+16);
#     });
#
#     this.ctx.fillStyle = '#555';
#     this.ctx.font = '7px monospace';
#     this.ctx.textAlign = 'center';
#     this.ctx.fillText('1-7: select item  |  ESC: leave', this.width/2, this.height-3);
#   }
#
# STORE GUIDANCE — tambahkan rekomendasi jumlah items berdasarkan kondisi party:
# Di ui.js atau store.js, sebelum menampilkan menu beli, tampilkan saran:
#
#   function getStoreRecommendations(gameState) {
#     const alive = gameState.countAlive();
#     const milesLeft = TRAIL_LENGTH_MILES - gameState.totalMiles;
#     const daysLeft = Math.ceil(milesLeft / 15);  // estimasi 15 miles/day
#     return {
#       FOOD:     Math.max(0, daysLeft * alive * 3 - gameState.supplies.food),
#       OXEN:     Math.max(0, 6 - gameState.supplies.oxen),
#       AMMO:     Math.max(0, 200 - gameState.supplies.ammunition),
#       CLOTHING: Math.max(0, 4 - gameState.supplies.clothingSets),
#       WHEEL:    Math.max(0, 2 - gameState.supplies.spareWheels),
#       AXLE:     Math.max(0, 1 - gameState.supplies.spareAxles),
#       TONGUE:   Math.max(0, 1 - gameState.supplies.spareTongues),
#     };
#   }
# Tampilkan rekomendasi ini di bawah nama item di store grid.

# =============================================================================
# PERBAIKAN 3: Party member screen — background vga_FAMILY, tidak di-stretch
# =============================================================================
# vga_FAMILY.png berukuran 320x98 — JANGAN di-stretch ke 200px tinggi.
# Tampilkan dengan letterbox: gambar di bagian atas, area kosong di bawah hitam.
#
#   drawPartySetupScreen() {
#     this.clearScreen('#000000');
#     const img = this.assets.getImage(ASSET_KEYS.FAMILY);
#     if (img) {
#       // Tampilkan di atas canvas, scale width=320, height proporsional
#       const scaledH = Math.floor(img.naturalHeight * (this.width / img.naturalWidth));
#       this.ctx.drawImage(img, 0, 0, this.width, scaledH);
#     }
#     // Semi-transparent overlay untuk text input di bawah gambar
#     const imgH = img ? Math.floor(img.naturalHeight * (this.width / img.naturalWidth)) : 0;
#     this.ctx.fillStyle = 'rgba(0,0,0,0.85)';
#     this.ctx.fillRect(0, imgH, this.width, this.height - imgH);
#   }
#
# Berlaku juga untuk "kind_of_people" screen (occupation/difficulty choice):
# Gunakan pendekatan letterbox yang sama — JANGAN stretch.

# =============================================================================
# PERBAIKAN 4: Map screen — fix bug + tampilkan vga_MAP.png (640x399)
# =============================================================================
# vga_MAP.png sekarang berukuran 640x399.
# Di renderer.js drawMap():
#
#   drawMap(gameState) {
#     this.clearScreen('#000000');
#     const img = this.assets.getImage(ASSET_KEYS.MAP);
#
#     if (img) {
#       // 640x399 ditampilkan dalam canvas 320x200 — scale down 50%
#       // Gunakan letterbox agar proporsional
#       const scale = Math.min(this.width / img.naturalWidth,
#                              this.height / img.naturalHeight);
#       const dw = Math.floor(img.naturalWidth  * scale);
#       const dh = Math.floor(img.naturalHeight * scale);
#       const ox = Math.floor((this.width  - dw) / 2);
#       const oy = Math.floor((this.height - dh) / 2);
#       this.ctx.drawImage(img, ox, oy, dw, dh);
#       this._drawTrailMarker(gameState, ox, oy, dw, dh);
#     }
#
#     // "Press any key" bar
#     this.ctx.fillStyle = 'rgba(0,0,0,0.75)';
#     this.ctx.fillRect(0, this.height-14, this.width, 14);
#     this.ctx.fillStyle = '#ffffff';
#     this.ctx.font = '8px monospace';
#     this.ctx.textAlign = 'center';
#     this.ctx.fillText('Press any key to return', this.width/2, this.height-4);
#   }
#
# Di ui.js showMap() — WAJIB tunggu keypress:
#   async showMap() {
#     this.renderer.drawMap(this.gameState);
#     await this.waitForAnyKey();
#   }
#
# Di assets.js buildAssetList() — pastikan MAP masuk load list:
#   // Tambahkan jika belum ada:
#   if (!list.includes(ASSET_KEYS.MAP)) list.push(ASSET_KEYS.MAP);

# =============================================================================
# PERBAIKAN 5: CSS — frame center + margin atas browser
# =============================================================================
# Ganti seluruh body/container CSS di style.css:
#
#   *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
#
#   body {
#     background: #000;
#     min-height: 100vh;
#     display: flex;
#     flex-direction: column;
#     align-items: center;
#     justify-content: flex-start;
#     padding-top: 40px;
#   }
#
#   #game-container {
#     display: flex;
#     flex-direction: column;
#     align-items: center;
#   }
#
#   #game-canvas {
#     display: block;
#     width: 640px;
#     height: 400px;
#     image-rendering: pixelated;
#     image-rendering: crisp-edges;
#     border: 2px solid #00ff00;
#   }
#
#   #ui-panel {
#     width: 640px;
#   }

# =============================================================================
# PERBAIKAN 6: "What now?" menu — tampilkan vga_Pxx sesuai posisi di map
# =============================================================================
# Saat menampilkan menu harian "What now?", background harus vga_P{n}
# di mana n = index landmark yang paling dekat dengan posisi player.
#
# Di renderer.js drawDailyMenu(gameState):
#
#   drawDailyMenu(gameState) {
#     // Cari landmark terdekat (yang sudah dilewati atau sedang di sana)
#     const landmarkIdx = Math.min(
#       gameState.currentLandmarkIndex,
#       LANDMARK_IMG_COUNT - 1
#     );
#     const img = this.assets.getLandmarkImage(landmarkIdx);
#     if (img) {
#       this.ctx.drawImage(img, 0, 0, this.width, this.height);
#     } else {
#       this.clearScreen('#1a1a00');
#     }
#     // Semi-transparent overlay untuk menu text
#     this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
#     this.ctx.fillRect(0, this.height - 90, this.width, 90);
#   }

# =============================================================================
# PERBAIKAN 7: "Continue on trail" — animasi wagon + terrain + events
# =============================================================================
# Saat player memilih "Continue on trail", jalankan animasi ~30-60 detik
# sebelum kembali ke menu harian. Animasi ini menampilkan:
#   1. Background terrain sesuai posisi (lihat terrain tile guide di bawah)
#   2. Wagon bergerak dari kanan ke kiri (3 frame TRAVELOX cycle)
#   3. Event icon mendekati dari kanan kalau ada landmark/event berikutnya
#   4. Jika wagon wheel patah: tampilkan hitSprite wagon (terbalik/rusak)
#
# TERRAIN TILES dari vga_TERRAIN.png (vga_009.png), terverifikasi:
#   Band 0 (sy=3,  sh=17): full-width strip, dominant GREEN  → PLAINS/GRASS
#   Band 1 (sy=24, sh=22): full-width strip, dominant MAGENTA → SPECIAL/EVENT
#   Band 2: banyak tile kecil (1-73px wide), dominant BROWN   → ROAD/DIRT PATH
#     Tile 2_18: sx=66,  sy=52, sw=42, sh=21 → ROAD segment
#     Tile 2_19: sx=119, sy=52, sw=39, sh=21 → ROAD segment
#     Tile 2_20: sx=168, sy=52, sw=41, sh=21 → ROAD lighter
#     Tile 2_21: sx=223, sy=52, sw=73, sh=21 → ROAD wider
#   Band 3 (sy=85, sh=20): 5 tiles — event icons
#     Tile 3_0: sx=3,   dominant RED    → DANGER/ILLNESS
#     Tile 3_1: sx=31,  dominant WHITE  → FORT/BUILDING
#     Tile 3_2: sx=53,  dominant ORANGE → MOUNTAIN
#     Tile 3_3: sx=95,  dominant BLUE   → RIVER/WATER
#     Tile 3_4: sx=164, dominant GREEN  → PLAINS ahead
#   Band 4 (sy=109, sh=20): 5 tiles — more terrain/weather icons
#     Tile 4_0: sx=4,   dominant LIGHT GRAY → SNOW/WINTER
#     Tile 4_1: sx=60,  dominant MID GRAY   → CLOUDY/WEATHER
#     Tile 4_2: sx=112, dominant LIGHT BLUE → SKY/CLEAR
#     Tile 4_3: sx=171, dominant MAGENTA    → SPECIAL EVENT
#     Tile 4_4: sx=227, dominant BLUE       → WATER/RIVER
#
# Animasi "Continue on trail" di travel.js atau main.js:
#
#   async animateTravel(gameState, daysToAdvance) {
#     const canvas = this.canvas;
#     const ctx    = canvas.getContext('2d');
#     let frameIdx = 0;
#     let wagonX   = canvas.width + 50;  // mulai dari luar kanan
#     const WAGON_SPEED = 1.2;           // pixels per frame
#     const FRAME_MS    = 300;
#     let lastFrame = 0;
#     let done = false;
#
#     // Tentukan terrain background berdasarkan posisi
#     const segment = getTrailSegment(gameState.totalMiles);
#     // segment 0=Plains, 1=Mid, 2=Mountains, 3=Pacific
#
#     return new Promise((resolve) => {
#       const loop = (timestamp) => {
#         if (done) { resolve(); return; }
#
#         // Background terrain
#         this.renderer.clearScreen('#4a3000');
#         // Gambar terrain strip di bagian bawah
#         const terrainStrip = TERRAIN_TILES.plains; // sesuaikan per segment
#         this.assets.drawSprite(ctx, ASSET_KEYS.TERRAIN, terrainStrip,
#                                0, canvas.height - terrainStrip.sh * 2,
#                                canvas.width, terrainStrip.sh * 2);
#
#         // Wagon bergerak dari kanan ke kiri
#         if (timestamp - lastFrame > FRAME_MS) {
#           frameIdx = (frameIdx + 1) % 3;
#           lastFrame = timestamp;
#         }
#         wagonX -= WAGON_SPEED;
#
#         const frame = WAGON_FRAMES.frames[frameIdx];
#         const scale = 3;
#         const dy = canvas.height - frame.sh * scale - terrainStrip.sh * 2 - 5;
#         this.assets.drawSprite(ctx, WAGON_FRAMES.sourceKey, frame,
#                                Math.floor(wagonX), dy, frame.sw*scale, frame.sh*scale);
#
#         // Jika wagon sudah keluar layar kiri → selesai
#         if (wagonX + frame.sw * scale < 0) done = true;
#
#         requestAnimationFrame(loop);
#       };
#       requestAnimationFrame(loop);
#     });
#   }

# =============================================================================
# URUTAN PENGERJAAN
# =============================================================================
# 1. CSS (Fix 5) — paling cepat
# 2. Supply coordinates di assets.js (Fix 2 coords)
# 3. Store screen layout (Fix 2 layout)
# 4. Party/occupation screen letterbox (Fix 3)
# 5. Landing page logo+wagon (Fix 1)
# 6. Map screen (Fix 4) — pastikan asset load + waitForKey
# 7. Daily menu background (Fix 6)
# 8. Travel animation (Fix 7)
#
# Test setelah selesai:
#   python -m http.server 8080  (dari folder oregon-trail-js)
#   http://localhost:8080/
#   Test: landing → occupation (letterbox FAMILY) → names (letterbox FAMILY)
#         → store (manager kiri, grid kanan, food icon benar)
#         → travel (wagon animasi di atas terrain)
#         → what now? (background vga_Pxx sesuai posisi)
#         → map (640x399, centered, press key untuk kembali)

# =============================================================================
# NOTES
# =============================================================================
# - Pertahankan SEMUA comments yang ada
# - Setiap perubahan diberi label // FIX 1: dst
# - vga_MAP.png sekarang 640x399 — renderer harus scale down saat display
# - vga_FAMILY.png 320x98 — JANGAN stretch, gunakan letterbox
# - Black-as-transparent tetap berlaku: R<16 && G<16 && B<16 → alpha=0
# - Canvas native 320x200, display 640x400 via CSS
