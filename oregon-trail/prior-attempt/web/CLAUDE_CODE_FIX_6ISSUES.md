# Oregon Trail JS — Fix 6 Issues (Final Round)
# Paste seluruh file ini ke Claude Code.
# Working directory: E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon-trail-js\

# =============================================================================
# CONTEXT DARI SCREENSHOTS
# =============================================================================
#
# vga_FAMILY_yang_benar.png:
#   - Canvas atas: hitam ~25% tinggi (padding atas)
#   - Gambar FAMILY di tengah canvas, TIDAK dimulai dari y=0
#   - Gambar proporsional, tidak crop, tidak stretch
#   - Teks di UI panel bawah (di luar canvas)
#
# vga_FAMILY_yang_salah.png:
#   - Gambar dimulai dari y=0 → atap wagon terpotong
#   - Perbedaan: tidak ada padding atas
#
# shadow_gelap.png:
#   - vga_P0.png tampil dengan benar (gambar kota Independence)
#   - Bagian bawah gambar tertutup fillRect rgba hitam semi-transparan
#   - Overlay ini tidak perlu ada di atas canvas — teks sudah di UI panel bawah
#
# vga_HUNTER.png: 266x165, grid 6 kolom x 4 baris = 24 sprites
#   - Setiap sprite ~44x41px
#   - Row 0: menghadap kanan (senapan level, diagonal atas, diagonal bawah)
#   - Row 1: menghadap kiri (mirror)
#   - Row 2-3: pose lain
#   - Hunter diam di tempat, hanya sprite yang berubah ikut arah mouse

# =============================================================================
# FIX 1: Landing page — kembalikan vga_BANNER + wagon proporsional
# =============================================================================
# Layout landing page (dari atas ke bawah dalam canvas 320x200):
#   - vga_BANNER.png di bagian ATAS, lebar penuh, height proporsional
#     vga_BANNER aslinya 266x165 — scale ke width 320:
#     displayed height = 320 * (165/266) = ~199px → hampir penuh canvas
#     Tapi ini terlalu besar, wagon tidak muat di bawah.
#     Solusi: scale BANNER ke 60% canvas height = 120px, lebar proporsional
#     displayed width = 120 * (266/165) = ~194px, center horizontal
#   - Wagon sprite di bawah BANNER, center horizontal
#     Scale wagon agar muat: frame sw=78, sh=31 → scale 2x = 156x62px
#     posisi y = banner_bottom + 8px margin
#
# Di renderer.js drawMainMenu(frameIndex):
#
#   drawMainMenu(frameIndex = 0) {
#     this.clearScreen('#000000');
#
#     // 1. BANNER di atas, scaled proporsional ke 60% canvas height
#     const banner = this.assets.getImage(ASSET_KEYS.BANNER);
#     let bannerBottom = 0;
#     if (banner) {
#       const bannerH = Math.floor(this.height * 0.60);  // 60% = 120px
#       const bannerW = Math.floor(bannerH * (banner.naturalWidth / banner.naturalHeight));
#       const bannerX = Math.floor((this.width - bannerW) / 2);
#       this.ctx.drawImage(banner, bannerX, 0, bannerW, bannerH);
#       bannerBottom = bannerH;
#     }
#
#     // 2. Wagon di bawah banner, center horizontal, scale 2x
#     const frame = WAGON_FRAMES.frames[frameIndex % WAGON_FRAMES.frames.length];
#     const scale = 2;
#     const dw = frame.sw * scale;
#     const dh = frame.sh * scale;
#     const dx = Math.floor((this.width - dw) / 2);
#     const dy = bannerBottom + 8;
#     this.assets.drawSprite(this.ctx, WAGON_FRAMES.sourceKey, frame, dx, dy, dw, dh);
#   }

# =============================================================================
# FIX 2: vga_FAMILY — posisi konsisten, tidak crop atap wagon
# =============================================================================
# Dari screenshot "yang benar": gambar tidak dimulai dari y=0.
# Ada padding hitam ~25% canvas height di atas gambar.
# Gambar di-render mulai dari y = offsetY, lebar penuh, height proporsional.
#
# Hitung offsetY:
#   vga_FAMILY.png: 320x98
#   Scale ke width 320: height = 98px (sudah pas, tidak perlu scale)
#   offsetY = Math.floor((canvas.height - 98) / 2) = (200-98)/2 = 51px
#   Tapi dari screenshot, padding atas lebih besar (~25% = 50px)
#   Jadi offsetY = 50px sudah benar.
#
# Di renderer.js, fungsi drawFamilyScreen():
#
#   drawFamilyScreen() {
#     this.clearScreen('#000000');
#     const img = this.assets.getImage(ASSET_KEYS.FAMILY);
#     if (img) {
#       // Scale ke lebar canvas, pertahankan aspect ratio
#       const scaledW = this.width;  // 320
#       const scaledH = Math.floor(img.naturalHeight * (scaledW / img.naturalWidth));
#       // Offset dari atas: center vertikal dalam canvas
#       const offsetY = Math.floor((this.height - scaledH) / 2);
#       this.ctx.drawImage(img, 0, offsetY, scaledW, scaledH);
#     }
#   }
#
# Fungsi ini dipanggil di SEMUA screen yang pakai FAMILY:
#   - Welcome screen
#   - "Kind of people" (occupation choice)
#   - Party member names input
# JANGAN ada overlay fillRect di atas canvas untuk screen ini.
# Teks pilihan menu ada di UI panel bawah (di luar canvas), BUKAN overlay canvas.

# =============================================================================
# FIX 3: vga_P0 shadow gelap — hapus overlay fillRect dari canvas
# =============================================================================
# Dari screenshot shadow_gelap.png: ada fillRect rgba(0,0,0,0.55) menutupi
# bagian bawah canvas. Ini TIDAK diperlukan — teks sudah di UI panel bawah.
#
# Di renderer.js, hapus SEMUA fillRect overlay dari drawLandmarkScreen()
# dan drawDailyMenuBackground():
#
#   drawLandmarkScreen(landmarkId) {
#     // Tampilkan fullscreen landmark image TANPA overlay apapun
#     const img = this.assets.getLandmarkImage(landmarkId);
#     if (img) {
#       this.ctx.drawImage(img, 0, 0, this.width, this.height);
#     } else {
#       this.clearScreen('#1a1a00');
#     }
#     // TIDAK ADA fillRect overlay di sini
#   }
#
#   drawDailyMenuBackground(gameState) {
#     // Tampilkan landmark image sesuai posisi TANPA overlay
#     const idx = Math.min(gameState.currentLandmarkIndex, LANDMARK_IMG_COUNT - 1);
#     this.drawLandmarkScreen(idx);
#     // TIDAK ADA fillRect overlay di sini
#   }
#
# Semua teks (menu options, status, dll) harus di UI panel HTML di bawah canvas,
# bukan sebagai overlay di atas canvas image.

# =============================================================================
# FIX 4: "What now?" menu — jangan selalu pakai vga_P0
# =============================================================================
# Logic yang benar:
#   - Hanya tampilkan vga_Pxx saat player BARU TIBA di landmark tersebut
#   - Saat sedang berjalan di antara landmark, tampilkan background SCENERY
#   - currentLandmarkIndex hanya berubah saat player tiba di landmark baru
#
# Di game state, tambahkan flag:
#   gameState.justArrivedAtLandmark = false  (reset setiap hari)
#   gameState.justArrivedAtLandmark = true   (set saat tiba di landmark baru)
#
# Di renderer.js drawDailyMenuBackground():
#
#   drawDailyMenuBackground(gameState) {
#     if (gameState.justArrivedAtLandmark) {
#       // Baru tiba di landmark — tampilkan gambar landmark
#       const idx = Math.min(gameState.currentLandmarkIndex, LANDMARK_IMG_COUNT-1);
#       this.drawLandmarkScreen(idx);
#     } else {
#       // Sedang di perjalanan — tampilkan SCENERY generic
#       const scenery = this.assets.getImage(ASSET_KEYS.SCENERY);
#       if (scenery) {
#         this.ctx.drawImage(scenery, 0, 0, this.width, this.height);
#       } else {
#         this.clearScreen('#2a4a1a');
#       }
#     }
#   }
#
# Di trail.js atau state.js, saat advance day:
#   gameState.justArrivedAtLandmark = false;  // reset setiap hari
#   // ... travel logic ...
#   if (reachedNewLandmark) {
#     gameState.currentLandmarkIndex = newIdx;
#     gameState.justArrivedAtLandmark = true;
#   }

# =============================================================================
# FIX 5: Map screen — pakai vga_MAP.png as-is tanpa resize
# =============================================================================
# vga_MAP.png sekarang 640x399, sudah pixel-perfect. JANGAN resize lagi.
# Di renderer.js drawMap():
#
#   drawMap(gameState) {
#     this.clearScreen('#000000');
#     const img = this.assets.getImage(ASSET_KEYS.MAP);
#
#     if (img) {
#       // Tampilkan dengan scale-to-fit, pertahankan aspect ratio
#       // 640x399 dalam canvas 320x200:
#       //   scale by width: 320/640 = 0.5 → height = 399*0.5 = 199.5 ≈ 200
#       //   Hampir persis fit! Tidak perlu letterbox.
#       const scale = Math.min(
#         this.width  / img.naturalWidth,
#         this.height / img.naturalHeight
#       );
#       const dw = Math.floor(img.naturalWidth  * scale);
#       const dh = Math.floor(img.naturalHeight * scale);
#       const ox = Math.floor((this.width  - dw) / 2);
#       const oy = Math.floor((this.height - dh) / 2);
#
#       // imageSmoothingEnabled = false agar tidak blur saat scale down
#       this.ctx.imageSmoothingEnabled = false;
#       this.ctx.drawImage(img, ox, oy, dw, dh);
#       this.ctx.imageSmoothingEnabled = true;
#
#       // Trail marker posisi player
#       this._drawTrailMarker(gameState, ox, oy, dw, dh);
#     }
#
#     // "Press any key" bar — hanya di bagian paling bawah
#     this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
#     this.ctx.fillRect(0, this.height-12, this.width, 12);
#     this.ctx.fillStyle = '#ffffff';
#     this.ctx.font = '7px monospace';
#     this.ctx.textAlign = 'center';
#     this.ctx.fillText('Press any key to return', this.width/2, this.height-3);
#   }
#
# PENTING: Di renderer.js, HAPUS semua kode yang melakukan resize/scale
# pada img sebelum drawImage. Biarkan drawImage yang handle scaling.
# imageSmoothingEnabled = false adalah kunci agar tidak pecah.

# =============================================================================
# FIX 6: Hunting — hunter sprite ikut mouse, hewan lebih kecil
# =============================================================================
# vga_HUNTER.png (266x165): grid 6 kolom x 4 baris = 24 sprites
# Ukuran tiap sprite: ~44x41px
#
# HUNTER SPRITE LAYOUT (best guess dari visual):
#   Row 0 (sy=2,  sh=38): menghadap KANAN
#     Col 0 (sx=2):   rifle pointing RIGHT-LEVEL
#     Col 1 (sx=48):  rifle pointing RIGHT-UP
#     Col 2 (sx=92):  rifle pointing RIGHT-DOWN
#     Col 3 (sx=136): rifle pointing RIGHT-HIGH-UP
#     Col 4 (sx=182): rifle pointing RIGHT-FORWARD
#     Col 5 (sx=226): rifle pointing RIGHT-EXTRA
#   Row 1 (sy=44, sh=38): menghadap KIRI (mirror poses)
#     Col 0..5: same as row 0 but facing left
#   Row 2 (sy=88, sh=38): pose tambahan
#   Row 3 (sy=126,sh=38): pose tambahan / crouch
#
# Di assets.js, tambahkan HUNTER_SPRITES:
#
#   export const HUNTER_SPRITES = {
#     sourceKey: ASSET_KEYS.HUNTER,
#     spriteW: 44, spriteH: 38,
#     cols: 6, rows: 4,
#     // Mapping angle → sprite row+col
#     // angle = Math.atan2(mouseY - hunterY, mouseX - hunterX) in degrees
#     getSprite(mouseX, mouseY, hunterX, hunterY) {
#       const dx = mouseX - hunterX;
#       const dy = mouseY - hunterY;
#       const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180 to 180
#
#       // Facing right (dx > 0) = row 0, facing left (dx < 0) = row 1
#       const row = dx >= 0 ? 0 : 1;
#       const absDx = Math.abs(dx);
#
#       // Col berdasarkan vertical angle
#       let col;
#       const absAngle = Math.abs(angle);
#       if (absAngle < 15)       col = 0;  // level
#       else if (absAngle < 35)  col = dx >= 0 ? (dy < 0 ? 1 : 2) : (dy < 0 ? 1 : 2);
#       else if (absAngle < 60)  col = dy < 0 ? 1 : 2;
#       else if (absAngle < 90)  col = dy < 0 ? 3 : 2;
#       else                     col = 4;
#
#       return {
#         sx: col * 44 + 2,
#         sy: row * 44 + 2,
#         sw: 44, sh: 38
#       };
#     }
#   };
#
# Di hunting.js, update _render():
#
#   _renderHunter() {
#     // Hunter posisi tetap: center-bottom canvas
#     const hunterX = Math.floor(this.canvas.width  * 0.50);
#     const hunterY = Math.floor(this.canvas.height * 0.75);
#     const scale   = 2;  // 44x38 → 88x76px
#
#     const sprite = HUNTER_SPRITES.getSprite(
#       this.crosshair.x, this.crosshair.y,
#       hunterX, hunterY
#     );
#
#     this.assets.drawSprite(
#       this.ctx, ASSET_KEYS.HUNTER, sprite,
#       hunterX - Math.floor(sprite.sw * scale / 2),
#       hunterY - sprite.sh * scale,
#       sprite.sw * scale,
#       sprite.sh * scale
#     );
#   }
#
# Hewan lebih kecil — kurangi scale dari 3 ke 1.5:
#
#   // Di _render(), ganti:
#   const scale = 1.5;  // was 3 — hewan lebih kecil, lebih challenging
#
# Crosshair tetap di posisi mouse, tidak berubah.
# Hit detection AABB disesuaikan dengan scale baru.

# =============================================================================
# BEST GUESS: Event → Gambar yang ditampilkan
# =============================================================================
# Berdasarkan data yang tersedia (landmark table, dialog strings, screenshots):
#
# GAME FLOW DAN GAMBAR:
#
# 1. Main menu / title     → vga_BANNER (background hitam, banner di atas)
# 2. Welcome screen        → vga_FAMILY (padding atas, gambar di tengah)
# 3. Occupation choice     → vga_FAMILY (sama dengan welcome)
# 4. Party names input     → vga_FAMILY (sama)
# 5. Store (Independence)  → vga_SUPPLIES (left=manager, right=grid items)
# 6. Starting trail        → vga_P0 (Independence, Missouri)
# 7. Traveling (generic)   → vga_SCENERY (landscape) + TRAVELOX wagon animation
# 8. "What now?" menu      → vga_SCENERY (generic) ATAU vga_Pxx jika baru tiba
# 9. Arrive at landmark    → vga_P{landmarkIndex}
# 10. Fort store resupply  → vga_SUPPLIES (sama dengan Independence store)
# 11. River crossing       → vga_FLOAT (river crossing sprites)
# 12. Hunting              → vga_HUNTER background + ANIMALS targets
# 13. Illness event        → vga_EVENTS (event illustration, full screen)
# 14. Weather event        → vga_EVENTS
# 15. Wagon damage event   → vga_EVENTS
# 16. Map screen           → vga_MAP (640x399)
# 17. Win screen           → vga_P17 (Willamette Valley)
# 18. Game over screen     → vga_EVENTS (atau hitam dengan teks)
# 19. High scores          → vga_BANNER background + tabel
# 20. Tombstone screen     → hitam dengan teks (no image)
#
# TERRAIN saat traveling berdasarkan trail segment:
#   Segment 0 (Plains, 0-500mi):    vga_SCENERY (hijau, flat)
#   Segment 1 (Mid, 500-1000mi):    vga_SCENERY (mulai berbukit)
#   Segment 2 (Mountains, 1000-1600mi): vga_TERRAIN Band 0 (green strip)
#                                       + Band 2 tiles (road/path)
#   Segment 3 (Pacific, 1600-2000mi):  vga_SCENERY (hijau lagi)

# =============================================================================
# URUTAN PENGERJAAN
# =============================================================================
# 1. Fix 3 (hapus shadow overlay) — satu baris, paling mudah
# 2. Fix 2 (FAMILY positioning) — update drawFamilyScreen()
# 3. Fix 1 (landing page BANNER + wagon)
# 4. Fix 4 (What now? logic — justArrivedAtLandmark flag)
# 5. Fix 5 (map imageSmoothingEnabled=false, hapus resize code)
# 6. Fix 6 (hunter sprites + hewan lebih kecil)
#
# Test sequence:
#   http://localhost:8080/
#   - Landing: BANNER atas + wagon bawah (tidak terpotong)
#   - Welcome/Occupation/Names: FAMILY centered, tidak terpotong atas
#   - P0 (starting trail): tidak ada shadow gelap
#   - Traveling: SCENERY + wagon, "What now?" pakai SCENERY (bukan P0)
#   - Tiba di Fort Kearney: tampilkan vga_P3, lalu kembali ke SCENERY
#   - Map: tidak pecah, imageSmoothingEnabled=false
#   - Hunt: hunter bergerak ikut mouse, hewan lebih kecil

# =============================================================================
# NOTES
# =============================================================================
# - Pertahankan SEMUA comments yang ada, tambah // FIX N:
# - JANGAN ada fillRect rgba overlay di atas canvas landmark/family images
# - imageSmoothingEnabled = false untuk semua drawImage yang scale-down
# - vga_MAP.png adalah 640x399 — jangan resize, biarkan drawImage scale
# - Hunter posisi tetap, hanya sprite berubah ikut mouse direction
# - Hewan scale 1.5x (was 3x)
