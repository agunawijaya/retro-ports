# Oregon Trail JS — Prompt Koreksi: Image Mapping & Asset Usage
# Paste ini ke Claude Code untuk memperbaiki penggunaan image yang salah.
#
# MASALAH YANG DILAPORKAN:
# "Images yang dipakai kacau balau. Banyak yang penempatannya salah.
#  Ada yang images seharusnya untuk membangun sprites digunakan sebagai
#  background yang full image. Contoh paling jelas adalah map —
#  gambar yang ditampilkan bukan map."
#
# ROOT CAUSE ANALYSIS:
# Setelah membaca code yang dihasilkan, masalahnya ada di beberapa tempat:
#
# 1. renderer.js drawScene() memanggil ASSET_KEYS.MAP untuk "map screen"
#    tapi vga_MAP.png (320x134) adalah background art untuk layar peta,
#    BUKAN gambar trail map itu sendiri. Konten dan ukurannya sudah benar
#    untuk ditampilkan fullscreen — masalahnya bukan di sini.
#
# 2. drawTravelScreen() pakai vga_SCENERY sebagai background.
#    vga_SCENERY (229x111) adalah gambar tunggal — ini BENAR.
#
# 3. vga_BANNER (266x165) ditampilkan di main menu — ini gambar judul,
#    BUKAN sprite sheet. Sudah benar.
#
# 4. vga_FAMILY (320x98) — ini mungkin digunakan sebagai background di
#    setup screen padahal seharusnya dipakai sebagai character portraits
#    di bagian kecil layar.
#
# 5. vga_EVENTS (281x119) — mungkin dipakai fullscreen padahal isinya
#    beberapa thumbnail event yang harus dipilih salah satunya.
#
# PERBAIKAN YANG DIMINTA:
# ===========================================================================

Ini adalah Oregon Trail JS study project. Kamu sudah membangun code-nya,
tapi ada masalah dengan penggunaan images. Saya perlu kamu:

1. Buat file debug/debug_assets.html yang menampilkan SEMUA 29 images
   dengan informasi dimensi aslinya, supaya kita bisa verifikasi visual
   apa isi setiap gambar sebelum memutuskan cara pakainya.

2. Setelah kita verifikasi secara visual, perbaiki asset mapping di
   renderer.js dan ui.js berdasarkan apa yang sebenarnya ada di gambar.

---

## LANGKAH 1: Buat debug viewer

Buat file: E:\Projects\BASIC Programs\Collections\Oregon Trail\oregon-trail-js\debug\debug_assets.html

File ini harus:
- Standalone HTML, tidak perlu module import
- Load semua 29 PNG dari ../images/
- Tampilkan setiap gambar dengan:
  a. Nama file
  b. Dimensi aktual (width x height)
  c. Label apakah ini kemungkinan "fullscreen scene", "sprite sheet", atau "UI element"
  d. Untuk sprite sheets (TRAVELOX, ANIMALS, SUPPLIES): overlay grid merah
     menunjukkan di mana sprite boundaries yang kita estimasi ada
- Layout: grid 3 kolom, setiap cell punya border
- Background hitam, text putih (tema DOS)

Berikut kriteria klasifikasi yang harus diterapkan otomatis:
- width >= 300 AND height >= 140 → "fullscreen scene" (label hijau)
- height <= 40 OR width/height ratio > 5 → "sprite strip" (label kuning)
- selain itu → "partial scene / UI element" (label oranye)

Untuk SUPPLY_SPRITES, tampilkan garis vertikal merah di x = 0, 28, 71, 113, 151, 188, 228, 292
Untuk TRAVELOX_FRAMES, tampilkan garis horizontal merah di y = 0, 20, 46, 74, 105, 130, 139
Untuk ANIMAL_SPRITES, tampilkan grid di row y=0,32,70 dan col x=0,79,176,255

---

## LANGKAH 2: Verifikasi dan perbaiki asset mapping

Setelah debug viewer dibuat dan bisa dilihat di browser, perbaiki penggunaan
image di seluruh codebase berdasarkan aturan berikut:

### Rule 1: Fullscreen scenes (P0-P17, HUNTER, SCENERY, MAP, BANNER)
Gambar-gambar ini ditampilkan menggunakan drawImage(img, 0, 0, canvas.width, canvas.height).
Ini sudah benar di renderer.js. JANGAN ubah ini.

Pemetaan yang benar:
- Main menu / title    : tampilkan vga_BANNER sebagai background (266x165 → scale ke 320x200)
- Travel screen        : vga_SCENERY sebagai background (229x111 → scale ke 320x200)
- Map screen           : vga_MAP sebagai background (320x134 → scale ke 320x200)
- Hunting screen       : vga_HUNTER sebagai background (320x126 → scale ke 320x200)  
- Landmark arrival     : vga_P{landmarkId} sebagai fullscreen (320x~160 → scale ke 320x200)
- Setup/family screen  : vga_FAMILY sebagai background (320x98 → scale ke 320x200 dengan letterbox)
- Event notification   : vga_EVENTS sebagai background (281x119 → scale dengan letterbox)

### Rule 2: Sprite sheets - JANGAN pernah tampilkan fullscreen

vga_SUPPLIES (292x33): HANYA dipakai untuk icon store items.
  - Tampilkan sebagai sprite di supplies screen (icons kecil di atas tabel)
  - JANGAN pernah drawScene(ASSET_KEYS.SUPPLIES)

vga_TRAVELOX (320x139): HANYA dipakai untuk animasi wagon di travel screen.
  - Crop frame tertentu dan composite di atas vga_SCENERY
  - JANGAN pernah drawScene(ASSET_KEYS.TRAVELOX)

vga_ANIMALS (320x83): HANYA dipakai untuk target hewan di hunting screen.
  - Crop sprite tertentu dan composite di atas vga_HUNTER
  - JANGAN pernah drawScene(ASSET_KEYS.ANIMALS)

### Rule 3: Logo
logo_vga.png (320x55): Tampilkan di bagian ATAS canvas saat main menu.
  - Gambar ini adalah banner teks "THE OREGON TRAIL"
  - Tampilkan di y=0 sampai y=55, lebar penuh
  - Di bawahnya tampilkan menu pilihan

---

## LANGKAH 3: Perbaiki renderer.js

Fungsi-fungsi yang perlu diupdate:

### drawTravelScreen(gameState, frameIndex)
```javascript
drawTravelScreen(gameState, frameIndex) {
    // 1. Clear to sky blue (warna langit game DOS)
    this.clearScreen('#4499CC');

    // 2. Gambar SCENERY sebagai background landscape
    //    Scale ke full canvas
    const scenery = this.assets.getImage(ASSET_KEYS.SCENERY);
    if (scenery) {
        this.ctx.drawImage(scenery, 0, 0, this.width, this.height);
    }

    // 3. Composite wagon animation (TRAVELOX frame) di atas scenery
    //    Posisi: horizontally centered, vertically di 60% dari atas
    const frame = TRAVELOX_FRAMES[frameIndex % TRAVELOX_FRAMES.length];
    const destX = Math.floor((this.width - frame.sw) / 2);
    const destY = Math.floor(this.height * 0.55);   // ~110px dari atas
    this.assets.drawSprite(
        this.ctx, ASSET_KEYS.TRAVELOX, frame,
        destX, destY, frame.sw, frame.sh
    );

    // 4. Status overlay di pojok kiri atas (semi-transparent black box)
    const lines = [
        `${MONTH_NAMES[gameState.currentMonth]} ${gameState.currentDay}, ${gameState.currentYear}`,
        `Miles: ${gameState.totalMiles} / ${TRAIL_LENGTH_MILES}`,
        `Pace: ${gameState.pace.name}`,
        `Food: ${gameState.supplies.food} lb`,
    ];
    this.drawTextPanel(lines, 2, 2, 160, 56);
}
```

### drawMainMenu()
Tambahkan fungsi baru ini:
```javascript
drawMainMenu() {
    // Background hitam
    this.clearScreen('#000000');

    // Logo "THE OREGON TRAIL" di bagian atas
    const logo = this.assets.getImage(ASSET_KEYS.LOGO);
    if (logo) {
        // Tampilkan di tengah horizontal, y=20, scale 2x
        const logoW = logo.naturalWidth * 2;
        const logoH = logo.naturalHeight * 2;
        const logoX = Math.floor((this.width - logoW) / 2);
        this.ctx.drawImage(logo, logoX, 20, logoW, logoH);
    }
}
```

### drawMapScreen(gameState)
Update fungsi ini:
```javascript
drawMapScreen(gameState) {
    // vga_MAP adalah gambar trail map (320x134)
    // Scale ke canvas dengan letterbox (pertahankan aspect ratio)
    this.clearScreen('#000000');
    const img = this.assets.getImage(ASSET_KEYS.MAP);
    if (img) {
        // Letterbox: gambar di tengah dengan bar hitam atas/bawah
        const scale = this.width / img.naturalWidth;  // 320/320 = 1
        const scaledH = img.naturalHeight * scale;    // 134
        const offsetY = Math.floor((this.height - scaledH) / 2);  // (200-134)/2 = 33
        this.ctx.drawImage(img, 0, offsetY, this.width, scaledH);
    }

    // Overlay posisi pemain
    // ... (kode marker tetap sama)
}
```

---

## LANGKAH 4: Update main.js / ui.js untuk pakai drawMainMenu() baru

Di showMainMenu flow:
1. Panggil renderer.drawMainMenu() sebelum menampilkan menu DOM
2. Ini menampilkan logo "THE OREGON TRAIL" di canvas
3. Menu pilihan tetap di DOM panel bawah

Di showLandmarkArrival:
1. Pastikan renderer.drawScene(`vga_P${landmark.id}`) dipanggil SEBELUM DOM prompt
2. Landmark id harus mapping ke file yang benar:
   - landmark 0 (Independence) → vga_P0
   - landmark 1 (Kansas River) → vga_P1
   - dst sampai landmark 17 (Willamette) → vga_P17

---

## LANGKAH 5: Verifikasi visual setelah fix

Setelah semua perubahan:
1. Buka http://localhost:8080/ (jalankan python -m http.server 8080 dari folder oregon-trail-js)
2. Verifikasi:
   - Main menu: logo Oregon Trail terlihat di atas
   - Travel screen: wagon bergerak di atas landscape
   - Map screen: peta trail terlihat (bukan gambar lain)
   - Landmark screens: gambar yang benar untuk tiap lokasi
   - Supplies screen: icon items kecil, bukan fullscreen
   - Hunting: hewan target terlihat di atas forest backdrop

---

## CATATAN PENTING

Seluruh perubahan harus tetap mempertahankan comments yang sudah ada.
Setiap perubahan logic harus ditandai dengan:
  // FIX: [deskripsi masalah yang diperbaiki]

Jangan hapus fungsi yang ada — hanya update implementasinya.
Jika ada fungsi yang tidak dipanggil sama sekali setelah fix, tandai dengan:
  // UNUSED: [alasan] — preserved for future use
