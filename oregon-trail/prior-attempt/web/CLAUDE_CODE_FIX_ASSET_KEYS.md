# Oregon Trail JS — Fix ASSET_KEYS mapping
# Paste ini ke Claude Code.
#
# MASALAH:
# constants.js ASSET_KEYS memetakan key semantik ke nama file PNG.
# Setelah serangkaian rename, nama file PNG sekarang sudah benar secara visual —
# file bernama vga_HUNTER.png memang berisi gambar hunter backdrop, dst.
# Tapi ASSET_KEYS di code masih pakai mapping lama yang salah.
#
# SOLUSI:
# Update ASSET_KEYS di constants.js supaya setiap key semantik
# menunjuk ke file PNG yang benar.
#
# MAPPING YANG BENAR (dikonfirmasi secara visual):
# Key semantik    -> nama file PNG yang harus dipanggil
# ─────────────────────────────────────────────────────
# LOGO            -> logo_vga         (tidak berubah)
# BANNER          -> vga_BANNER       (tidak berubah — sudah benar)
# FAMILY          -> vga_FAMILY       (tidak berubah — sudah benar)
# HUNTER          -> vga_HUNTER       (tidak berubah — sudah benar)
# SCENERY         -> vga_SCENERY      (tidak berubah — sudah benar)
# SUPPLIES        -> vga_SUPPLIES     (tidak berubah — sudah benar)
# ANIMALS         -> vga_ANIMALS      (tidak berubah — sudah benar)
# TRAVELOX        -> vga_TRAVELOX     (tidak berubah — sudah benar)
# TERRAIN         -> vga_TERRAIN      (tidak berubah — sudah benar)
# EVENTS          -> vga_EVENTS       (tidak berubah — sudah benar)
# FLOAT           -> vga_FLOAT        (NEW — river crossing sprites)
# MAP             -> (TIDAK ADA FILE) — vga_MAP.png tidak ter-extract
#
# CATATAN PENTING TENTANG MAP:
# vga_MAP.png tidak ada di folder images/.
# Untuk sementara, gunakan vga_SCENERY sebagai fallback untuk map screen
# sampai file MAP yang benar ditemukan.
# Tambahkan MAP ke ASSET_KEYS tapi dengan fallback handling di renderer.
#
# CATATAN PENTING TENTANG FLOAT:
# vga_FLOAT.png adalah sprite sheet river crossing:
# - wagon di atas ferry/rakit
# - wagon setengah tenggelam
# - wagon ditarik oxen menyeberangi sungai
# - ada dua gambar kecil: papan penunjuk arah dan simbol road
# FLOAT harus ditambahkan ke ASSET_KEYS karena belum ada sebelumnya.
#
# ═══════════════════════════════════════════════════════════
# INSTRUKSI UNTUK CLAUDE CODE
# ═══════════════════════════════════════════════════════════
#
# 1. Update ASSET_KEYS di constants.js:
#
#    export const ASSET_KEYS = {
#        LOGO:     'logo_vga',
#        ANIMALS:  'vga_ANIMALS',   // hunting targets sprite sheet
#        BANNER:   'vga_BANNER',    // title screen banner text
#        EVENTS:   'vga_EVENTS',    // random event illustrations
#        FAMILY:   'vga_FAMILY',    // character portraits
#        FLOAT:    'vga_FLOAT',     // river crossing sprites (NEW)
#        HUNTER:   'vga_HUNTER',    // hunting backdrop scene
#        MAP:      'vga_MAP',       // trail map (file missing — use fallback)
#        SCENERY:  'vga_SCENERY',   // landscape backdrop for travel
#        SUPPLIES: 'vga_SUPPLIES',  // store item icons sprite sheet
#        TERRAIN:  'vga_TERRAIN',   // terrain tiles
#        TRAVELOX: 'vga_TRAVELOX',  // wagon travel animation strip
#    };
#
# 2. Update AssetLoader.buildAssetList() di assets.js:
#    Tambahkan ASSET_KEYS.FLOAT ke list agar ikut di-load.
#    Hapus ASSET_KEYS.MAP dari list ATAU handle null dengan graceful.
#
# 3. Update renderer.js — perbaiki setiap drawScene() call:
#
#    a. drawMainMenu():
#       - Background: clearScreen('#000000') — hitam
#       - Logo: drawImage(logo_vga, centered, y=10)
#       JANGAN pakai BANNER sebagai fullscreen background di main menu.
#       BANNER adalah gambar judul teks, bukan background scene.
#
#    b. drawTravelScreen():
#       - Background: ASSET_KEYS.SCENERY (landscape backdrop)
#       - Wagon overlay: ASSET_KEYS.TRAVELOX (animation strip)
#       JANGAN pakai TERRAIN sebagai background perjalanan.
#
#    c. drawMapScreen():
#       - Gambar: ASSET_KEYS.MAP (vga_MAP.png)
#       - Jika file tidak ada (null dari getImage), tampilkan fallback:
#         clearScreen('#001100') + text "Trail Map"
#         + gambar posisi marker berdasarkan totalMiles
#       JANGAN crash jika MAP tidak ada.
#
#    d. drawHuntingScreen():
#       - Background: ASSET_KEYS.HUNTER (forest backdrop)
#       - Targets: ASSET_KEYS.ANIMALS (sprite sheet hewan)
#       JANGAN tukar HUNTER dan ANIMALS.
#
#    e. drawSuppliesGrid():
#       - Icons: ASSET_KEYS.SUPPLIES (sprite sheet 7 items)
#       - Background: clearScreen('#001100') — hitam kehijauan
#       JANGAN tampilkan gambar fullscreen apapun di supplies screen.
#       Supplies screen hanya berisi icons kecil + teks angka.
#
#    f. drawRiverCrossing():
#       Tambahkan fungsi baru ini:
#       - Background: ASSET_KEYS.HUNTER (outdoor scene — closest we have)
#       - Overlay: ASSET_KEYS.FLOAT sebagai sprite sheet
#         vga_FLOAT berisi beberapa gambar river crossing scenarios
#         Tampilkan gambar yang sesuai dengan pilihan crossing pemain:
#         (ford, caulk, ferry) — ambil region berbeda dari sprite sheet
#       - Jika belum tahu koordinat pasti, tampilkan vga_FLOAT fullscreen
#         sebagai placeholder sampai koordinat diverifikasi
#
# 4. Update assets.js SUPPLY_SPRITES dan ANIMAL_SPRITES:
#    Koordinat estimasi sebelumnya mungkin masih sama karena
#    yang berubah hanya nama file, bukan konten gambar.
#    Tapi verifikasi ulang secara visual setelah fix ini selesai.
#
# 5. Setelah semua perubahan, jalankan server dan verifikasi:
#    - Main menu: background hitam + logo di atas
#    - Travel: landscape + wagon bergerak
#    - Supplies: icons kecil 7 item + teks quantities
#    - Map: either vga_MAP atau fallback text
#    - Hunting: forest backdrop + animal targets
#
# 6. Semua perubahan harus tetap mempertahankan comments.
#    Setiap perubahan diberi komentar:
#    // FIX: [penjelasan singkat]
