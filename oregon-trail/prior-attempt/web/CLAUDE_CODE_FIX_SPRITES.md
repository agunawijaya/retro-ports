# Oregon Trail JS — Fix: Sprites, Transparency, Layout
# Paste ini ke Claude Code.
#
# Ada 6 perbaikan yang diminta. Semua harus dikerjakan sekaligus.
# Pertahankan semua comments yang ada, tambah // FIX: di setiap perubahan.

# ═══════════════════════════════════════════════════════════════════
# CONTEXT: vga_TRAVELOX.png
# ═══════════════════════════════════════════════════════════════════
#
# Dari data inspect_assets.py sebelumnya:
# vga_TRAVELOX (320x139) — full-bg rows di [0, 20-21, 46-50, 74-81, 105-107, 130+]
# Artinya ada separator rows antara frames.
#
# 3 frame TERATAS yang diminta:
#   Frame 0: rows  1..19  (height 19px) — sy=1,  sh=19
#   Frame 1: rows 22..45  (height 24px) — sy=22, sh=24
#   Frame 2: rows 51..73  (height 23px) — sy=51, sh=23
#
# Wagon berada di bagian kiri gambar (full 320px wide).
# Saat render, crop region yang mengandung wagon saja — jangan render
# 320px penuh karena sebagian besar adalah hitam kosong.
# Estimasi: wagon berada di kira-kira x=0..200 dari tiap frame.
# Claude Code harus VERIFIKASI koordinat ini secara visual dan adjust.

# ═══════════════════════════════════════════════════════════════════
# FIX 1: Landing page — animasi 3 sprite wagon dari TRAVELOX
# ═══════════════════════════════════════════════════════════════════
#
# Di renderer.js, update drawMainMenu():
#
# - Background: clearScreen('#1a0a00')  <- warna coklat gelap seperti tanah
# - Di bagian bawah canvas (y ~ 140..200), gambar terrain strip jika ada
# - Di tengah canvas, render animasi wagon menggunakan 3 frame TRAVELOX
# - Frame di-cycle setiap 300ms menggunakan requestAnimationFrame
# - Warna hitam (0,0,0) di TRAVELOX harus TRANSPARENT (lihat Fix 3)
#
# Di main.js, tambahkan animasi loop untuk landing page:
#   let landingFrame = 0;
#   let lastFrameTime = 0;
#   const FRAME_INTERVAL = 300; // ms
#
#   function animateLanding(timestamp) {
#     if (timestamp - lastFrameTime > FRAME_INTERVAL) {
#       landingFrame = (landingFrame + 1) % 3;
#       lastFrameTime = timestamp;
#       renderer.drawMainMenu(landingFrame);
#     }
#     if (gameState.phase === 'MENU') {
#       requestAnimationFrame(animateLanding);
#     }
#   }
#   requestAnimationFrame(animateLanding);

# ═══════════════════════════════════════════════════════════════════
# FIX 2: Welcome screen — gunakan vga_FAMILY bukan vga_HUNTER
# ═══════════════════════════════════════════════════════════════════
#
# Di renderer.js, tambahkan/update fungsi drawWelcomeScreen():
#
#   drawWelcomeScreen() {
#     // vga_FAMILY.png berisi character portraits — lebih cocok untuk
#     // welcome screen karena menampilkan keluarga/party yang akan melakukan
#     // perjalanan. vga_HUNTER adalah backdrop hutan untuk mini-game berburu.
#     // FIX: was ASSET_KEYS.HUNTER, now ASSET_KEYS.FAMILY
#     this.drawScene(ASSET_KEYS.FAMILY);
#   }
#
# Di ui.js atau main.js, pastikan welcome screen (setelah setup selesai,
# sebelum store) memanggil renderer.drawWelcomeScreen() bukan drawScene(HUNTER).

# ═══════════════════════════════════════════════════════════════════
# FIX 3: Transparency — hitam jadi transparan saat composite
# ═══════════════════════════════════════════════════════════════════
#
# Ini adalah teknik "black as transparent" yang umum di game DOS era ini.
# Warna hitam (R=0, G=0, B=0) adalah warna background/mask, bukan warna solid.
# Ketika sprite di-composite di atas scene, pixel hitam harus tidak muncul.
#
# Implementasi di assets.js, update drawSprite():
#
#   drawSprite(ctx, imageKey, sprite, dx, dy, dw, dh) {
#     const img = this.getImage(imageKey);
#     if (!img) { /* fallback */ return; }
#
#     // FIX: Render sprite melalui offscreen canvas untuk apply
#     // black-as-transparent sebelum composite ke canvas utama.
#     const offscreen = document.createElement('canvas');
#     offscreen.width  = sprite.sw;
#     offscreen.height = sprite.sh;
#     const offCtx = offscreen.getContext('2d');
#
#     // 1. Gambar region sprite ke offscreen canvas
#     offCtx.drawImage(img, sprite.sx, sprite.sy, sprite.sw, sprite.sh,
#                           0, 0, sprite.sw, sprite.sh);
#
#     // 2. Ambil pixel data dan set alpha=0 untuk pixel hitam
#     const imageData = offCtx.getImageData(0, 0, sprite.sw, sprite.sh);
#     const data = imageData.data;
#     for (let i = 0; i < data.length; i += 4) {
#       const r = data[i], g = data[i+1], b = data[i+2];
#       // Threshold: pixel dianggap "hitam" jika semua channel < 16
#       // (sedikit toleransi untuk kompresi artifacts)
#       if (r < 16 && g < 16 && b < 16) {
#         data[i + 3] = 0; // alpha = 0 = fully transparent
#       }
#     }
#     offCtx.putImageData(imageData, 0, 0);
#
#     // 3. Composite offscreen ke canvas utama dengan scaling
#     ctx.drawImage(offscreen, 0, 0, sprite.sw, sprite.sh,
#                              dx, dy, dw, dh);
#   }
#
# CATATAN PERFORMA: offscreen canvas dibuat setiap frame — untuk animasi
# yang smooth, cache offscreen canvas per sprite key+region di AssetLoader.
# Implementasi cache sederhana:
#
#   constructor() {
#     this.images = {};
#     this._spriteCache = {}; // key: "imageKey_sx_sy_sw_sh" -> ImageData
#   }
#
#   // Di drawSprite, cek cache sebelum buat offscreen baru:
#   const cacheKey = `${imageKey}_${sprite.sx}_${sprite.sy}_${sprite.sw}_${sprite.sh}`;
#   if (!this._spriteCache[cacheKey]) {
#     // ... buat offscreen canvas seperti di atas ...
#     this._spriteCache[cacheKey] = offscreen; // simpan canvas, bukan ImageData
#   }
#   ctx.drawImage(this._spriteCache[cacheKey], 0, 0, sprite.sw, sprite.sh,
#                                              dx, dy, dw, dh);

# ═══════════════════════════════════════════════════════════════════
# FIX 4: Supplies icons — koordinat presisi, width tidak harus seragam
# ═══════════════════════════════════════════════════════════════════
#
# vga_SUPPLIES.png (292x33) berisi 7 item icons.
# Dari full-bg cols: [0, 1, 2, 28, 29, 30..36, 71..78, ...]
# Ini berarti ada margin hitam di kiri, lalu icon 1, separator, icon 2, dst.
#
# Claude Code harus:
# 1. Load vga_SUPPLIES.png di sebuah halaman debug sederhana
# 2. Gambar grid overlay untuk melihat boundary tiap icon secara visual
# 3. Tentukan koordinat presisi masing-masing 7 icon
# 4. Update SUPPLY_SPRITES di assets.js dengan koordinat yang benar
#
# Format yang diinginkan (contoh — koordinat aktual harus diverifikasi visual):
#
#   export const SUPPLY_SPRITES = {
#     // FIX: koordinat presisi per item, tidak seragam
#     OXEN:     { sx:  3, sy: 3, sw: 24, sh: 26 },  // yoke icon
#     FOOD:     { sx: 40, sy: 3, sw: 28, sh: 26 },  // food bag icon
#     AMMO:     { sx: 79, sy: 3, sw: 22, sh: 26 },  // ammo box icon
#     CLOTHING: { sx: 114, sy: 3, sw: 30, sh: 26 }, // clothing icon
#     WHEEL:    { sx: 153, sy: 3, sw: 26, sh: 26 }, // wheel icon
#     AXLE:     { sx: 190, sy: 3, sw: 28, sh: 26 }, // axle icon
#     TONGUE:   { sx: 228, sy: 3, sw: 24, sh: 26 }, // tongue icon
#   };
#   // CATATAN: nilai di atas adalah ESTIMASI. Claude Code WAJIB verifikasi
#   // secara visual dengan debug overlay sebelum pakai nilai ini.
#
# Cara verifikasi:
# Buat file debug/debug_supplies.html yang:
# - Menampilkan vga_SUPPLIES.png di canvas besar (scale 4x)
# - Overlay garis merah vertikal di setiap sx dan sx+sw
# - Overlay garis hijau horizontal di sy dan sy+sh
# - Label nama item di atas tiap region
# - Tampilkan juga semua 7 icon yang sudah di-crop dengan black-as-transparent

# ═══════════════════════════════════════════════════════════════════
# FIX 5: Map — gambar harus centered di canvas
# ═══════════════════════════════════════════════════════════════════
#
# Di renderer.js, update drawMapScreen() / drawMap():
#
#   drawMap(gameState) {
#     this.clearScreen('#000000');
#     const img = this.assets.getImage(ASSET_KEYS.MAP);
#
#     if (!img) {
#       // Fallback jika vga_MAP.png tidak ada
#       this.ctx.fillStyle = '#00aa00';
#       this.ctx.font = '12px monospace';
#       this.ctx.fillText('[ Trail Map - Image Missing ]',
#                         this.width/2 - 80, this.height/2);
#     } else {
#       // FIX: Center gambar di canvas dengan mempertahankan aspect ratio
#       const imgW = img.naturalWidth;   // dimensi asli gambar
#       const imgH = img.naturalHeight;
#
#       // Hitung scale untuk fit dalam canvas tanpa distorsi
#       const scaleX = this.width  / imgW;
#       const scaleY = this.height / imgH;
#       const scale  = Math.min(scaleX, scaleY); // fit, jangan crop
#
#       const drawW = Math.floor(imgW * scale);
#       const drawH = Math.floor(imgH * scale);
#
#       // Center: offset dari tepi canvas
#       const offsetX = Math.floor((this.width  - drawW) / 2);
#       const offsetY = Math.floor((this.height - drawH) / 2);
#
#       this.ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
#     }
#
#     // Overlay posisi pemain (marker kuning) — sesuaikan koordinat
#     // dengan posisi relatif dalam gambar yang sudah di-center dan di-scale
#     this._drawTrailMarker(gameState, offsetX, offsetY, drawW, drawH);
#   }
#
#   _drawTrailMarker(gameState, mapX, mapY, mapW, mapH) {
#     // t = progress 0..1 sepanjang trail
#     const t = Math.min(1, gameState.totalMiles / TRAIL_LENGTH_MILES);
#
#     // Polyline dari kanan-bawah (Independence) ke kiri-atas (Oregon)
#     // Koordinat dalam PERSENTASE dari map image (0..1)
#     // Sesuaikan dengan jalur yang terlihat di vga_MAP.png
#     const polyline = [
#       { t: 0.00, px: 0.78, py: 0.80 },  // Independence
#       { t: 0.15, px: 0.68, py: 0.73 },
#       { t: 0.30, px: 0.56, py: 0.68 },
#       { t: 0.45, px: 0.44, py: 0.62 },
#       { t: 0.60, px: 0.34, py: 0.57 },
#       { t: 0.75, px: 0.25, py: 0.50 },
#       { t: 0.90, px: 0.17, py: 0.43 },
#       { t: 1.00, px: 0.09, py: 0.38 },  // Willamette Valley
#     ];
#
#     // Interpolasi posisi pada polyline
#     let px = polyline[0].px, py = polyline[0].py;
#     for (let i = 0; i < polyline.length - 1; i++) {
#       const a = polyline[i], b = polyline[i+1];
#       if (t >= a.t && t <= b.t) {
#         const local = (t - a.t) / (b.t - a.t);
#         px = a.px + (b.px - a.px) * local;
#         py = a.py + (b.py - a.py) * local;
#         break;
#       }
#     }
#
#     // Konversi dari persentase map ke koordinat canvas
#     const x = Math.floor(mapX + px * mapW);
#     const y = Math.floor(mapY + py * mapH);
#
#     // Gambar marker
#     this.ctx.fillStyle = '#000000';
#     this.ctx.fillRect(x - 2, y - 2, 5, 5);
#     this.ctx.fillStyle = '#ffff00';
#     this.ctx.fillRect(x - 1, y - 1, 3, 3);
#   }

# ═══════════════════════════════════════════════════════════════════
# FIX 6: Travel screen — animasi wagon sprite sama seperti landing page
# ═══════════════════════════════════════════════════════════════════
#
# Di renderer.js, update drawTravelScreen():
#
#   drawTravelScreen(gameState, frameIndex) {
#     // 1. Background landscape
#     this.drawScene(ASSET_KEYS.SCENERY);
#
#     // 2. Wagon animation — 3 frame dari TRAVELOX, SAMA seperti landing page
#     //    FIX: frameIndex di-pass dari main.js game loop (0, 1, 2, cycle)
#     const TRAVELOX_3_FRAMES = [
#       { sx: 0, sy:  1, sw: 200, sh: 19 },  // frame 0 — crop 200px lebar
#       { sx: 0, sy: 22, sw: 200, sh: 24 },  // frame 1
#       { sx: 0, sy: 51, sw: 200, sh: 23 },  // frame 2
#     ];
#     // CATATAN: sw=200 adalah estimasi untuk crop area yang mengandung wagon.
#     // Claude Code harus verifikasi dan adjust agar wagon tidak terpotong.
#
#     const frame = TRAVELOX_3_FRAMES[frameIndex % 3];
#
#     // Posisi wagon: horizontal center, vertikal di sekitar 60% dari atas
#     const destX = Math.floor((this.width - frame.sw) / 2);
#     const destY = Math.floor(this.height * 0.55);
#
#     // Gunakan drawSprite dengan black-as-transparent (Fix 3)
#     this.assets.drawSprite(
#       this.ctx, ASSET_KEYS.TRAVELOX, frame,
#       destX, destY, frame.sw, frame.sh
#     );
#
#     // 3. Status overlay (date, miles, pace, food)
#     const lines = [
#       `${MONTH_NAMES[gameState.currentMonth]} ${gameState.currentDay}, ${gameState.currentYear}`,
#       `Miles: ${gameState.totalMiles}`,
#       `Pace: ${gameState.pace.name}`,
#       `Food: ${gameState.supplies.food} lb`,
#     ];
#     this.drawTextPanel(lines, 2, 2, 160, 52);
#   }
#
# Di main.js, travel screen juga harus punya frame counter:
#   let travelFrame = 0;
#   let lastTravelFrameTime = 0;
#
#   // Di dalam game loop / advanceDay:
#   function animateTravel(timestamp) {
#     if (timestamp - lastTravelFrameTime > 300) {
#       travelFrame = (travelFrame + 1) % 3;
#       lastTravelFrameTime = timestamp;
#     }
#     if (gameState.phase === 'TRAVELLING') {
#       renderer.drawTravelScreen(gameState, travelFrame);
#       requestAnimationFrame(animateTravel);
#     }
#   }

# ═══════════════════════════════════════════════════════════════════
# URUTAN PENGERJAAN YANG DISARANKAN
# ═══════════════════════════════════════════════════════════════════
#
# 1. Fix 3 dulu (transparency) — ini yang paling fundamental karena
#    semua sprite rendering bergantung padanya.
#
# 2. Fix 4 (supplies koordinat) — buat debug/debug_supplies.html,
#    verifikasi visual, update SUPPLY_SPRITES.
#
# 3. Fix 1 + Fix 6 bersama (TRAVELOX sprites di landing & travel) —
#    karena keduanya pakai logic yang sama.
#
# 4. Fix 2 (welcome screen family portrait).
#
# 5. Fix 5 (map centering).
#
# 6. Final test: jalankan dari landing page sampai ke travel,
#    verifikasi semua 6 fix bekerja dengan benar.

# ═══════════════════════════════════════════════════════════════════
# NOTES
# ═══════════════════════════════════════════════════════════════════
#
# - Pertahankan SEMUA comments yang sudah ada di file
# - Setiap perubahan diberi label: // FIX 1:, // FIX 2:, dst.
# - Koordinat sprite (sx, sy, sw, sh) WAJIB diverifikasi secara
#   visual sebelum final — jangan hanya pakai estimasi angka
# - Threshold "hitam" untuk transparency: pixel dengan R<16, G<16, B<16
#   (bukan hanya R=0,G=0,B=0 persis — ada noise dari kompresi PCX)
