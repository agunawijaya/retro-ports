# Kalau di-porting, ke mana?

Berkas ini menimbang opsi bahasa untuk porting Tapper, plus beberapa hal
yang mudah terlewat kalau langsung memilih bahasa lebih dulu.

**Belum ada keputusan di sini.** Ini bahan untuk memutuskan.

---

## 0. Dua hal yang perlu diputuskan sebelum bahasa

### 0.1 Port, reimplementasi, atau emulasi?

Ketiganya sering disebut "porting" padahal sangat berbeda:

| pendekatan | artinya | hasilnya |
|---|---|---|
| **Emulasi** | jalankan binary aslinya di emulator | perilaku identik, tapi tidak ada kode baru yang bisa dikembangkan |
| **Port literal** | terjemahkan tiap rutin apa adanya | perilaku sangat dekat, kodenya tetap aneh dan sulit dikembangkan |
| **Reimplementasi** | tulis ulang dari pemahaman | kodenya bersih dan bisa dikembangkan, tapi perilakunya perlu diverifikasi |

Proyek ini sudah menghasilkan bahan untuk **ketiganya**. Yang paling
masuk akal biasanya jalur tengah: reimplementasi yang **memakai
dokumentasi ini sebagai spesifikasi**, dengan emulator sebagai penguji.

### 0.2 Setia sampai mana?

Ini pertanyaan yang menentukan banyak hal teknis:

- **Palet CGA magenta/cyan** dipertahankan, atau diberi palet modern?
- **60 Hz terkunci** (seperti aslinya), atau frame-rate independen?
- **Bug ikut ditiru?** Misalnya `or bx, 0xe000` yang mati sehingga suara
  pecah membaca wilayah ROM yang salah, dan permintaan sprite di luar
  jangkauan yang ditelan diam-diam.
- **Resolusi 320×200** dengan piksel non-persegi (aslinya 4:3), atau
  di-scale?

Tidak ada jawaban benar. Tapi menjawabnya **sebelum** memilih bahasa
menghemat banyak pekerjaan ulang.

---

## 1. Opsi bahasa

### 1.1 HTML + CSS + JavaScript (Canvas 2D)

**Cocok kalau:** tujuannya orang bisa memainkannya dengan satu klik.

**Pro**
- **Distribusi tanpa tanding.** Satu URL, jalan di mana saja, tanpa
  instalasi. Untuk game 1984 yang nilai utamanya nostalgia dan edukasi,
  ini hampir menentukan segalanya.
- Canvas 2D lebih dari cukup: 320×200 dengan sprite kecil sangat ringan
  untuk hardware mana pun hari ini.
- Perkakas debug bawaan browser sangat baik — bisa inspeksi frame,
  profil, dan step.
- `ImageData` memetakan hampir langsung ke model framebuffer game ini,
  jadi kode blitter-nya bisa diterjemahkan cukup harfiah.
- Mudah dipasangi hal edukatif: penampil sprite, overlay debug, tampilan
  side-by-side kode vs perilaku.

**Kontra**
- Timing tidak akurat. `requestAnimationFrame` terikat refresh monitor
  (biasanya 60 Hz — kebetulan cocok, tapi 120/144 Hz makin umum). Butuh
  akumulator waktu untuk mengunci logika di 60 Hz.
- Audio butuh kerja. Suara asli menggerakkan speaker bit demi bit;
  meniru itu perlu Web Audio dengan buffer sampel, bukan oscillator
  sederhana.
- Perlu disiplin supaya kode tidak jadi berantakan — JavaScript tidak
  memaksa struktur.
- Input keyboard di browser punya kekhasan (key repeat, focus, browser
  shortcut yang bentrok).

**Catatan jujur:** untuk *game ini*, kekurangan performa JavaScript
praktis tidak relevan. Beban aslinya dirancang untuk 4,77 MHz.

---

### 1.2 TypeScript + Canvas/WebGL

Sama seperti di atas, dengan tipe.

**Pro**
- Semua keuntungan JavaScript, plus tipe yang **sangat** membantu di
  domain ini: `Bar`, `EntityState`, `SpriteId`, ukuran sprite sebagai
  union type. Banyak kesalahan yang kami buat saat RE (salah ukuran,
  salah indeks, salah bank) tertangkap kompiler.
- Enum untuk bit state `+6` membuat kode terbaca seperti dokumentasinya.

**Kontra**
- Perlu build step, jadi sedikit lebih berat untuk dibuka orang lain
  yang cuma ingin melihat.
- Overhead belajar kalau kamu belum memakainya.

**Ini rekomendasi utama saya** kalau tujuannya port yang dipakai orang
sekaligus dibaca orang.

---

### 1.3 C

**Cocok kalau:** tujuannya kesetiaan maksimal dan port ke banyak
platform termasuk retro.

**Pro**
- Paling dekat dengan aslinya. Manipulasi bit, pointer, dan layout
  struct memetakan hampir satu-satu dari assembly.
- Bisa dikompilasi untuk DOS sungguhan (via DJGPP/Open Watcom), sehingga
  bisa **dibandingkan langsung** dengan binary asli di mesin yang sama.
- Dengan SDL2, jalan di Windows/Linux/macOS, dan bisa di-compile ke
  WebAssembly lewat Emscripten — jadi tetap bisa masuk browser.
- Cocok untuk target retro lain (Amiga, Atari ST) kalau itu menarik.

**Kontra**
- Lambat ditulis, dan kesalahan memori mahal.
- Perkakas dan distribusi jauh lebih repot daripada web.
- Untuk game sesederhana ini, kontrol level-rendahnya sebagian besar
  tidak terpakai.

---

### 1.4 Rust

**Pro**
- Enum dan pattern matching sangat pas untuk mesin state entitas —
  delapan bit `+6` itu praktis meminta jadi `bitflags`.
- Aman dari kesalahan memori tanpa garbage collector.
- `macroquad` atau `bevy` memberi rendering lintas platform, dan
  keduanya bisa ke WebAssembly.

**Kontra**
- Kurva belajar paling curam di daftar ini.
- Borrow checker bisa terasa melawan saat memodelkan struktur berbagi
  seperti daftar tertaut gelas — yang di aslinya justru pointer mentah.
- Waktu kompilasi lambat memperlambat siklus eksperimen.

---

### 1.5 Python + Pygame

**Pro**
- Paling cepat untuk membuat prototipe dan bereksperimen.
- **Sudah ada di proyek ini** — emulator, decoder sprite, dan semua
  perkakas sudah Python. Port Python bisa memakai ulang `cga.py`,
  `decode_screen.py`, dan `trace.py` sebagai penguji.
- Sangat baik untuk tujuan edukatif: kodenya bisa dibaca orang yang baru
  belajar.

**Kontra**
- Distribusi ke pemain awam merepotkan.
- Performa cukup untuk game ini, tapi tidak lapang.
- Kurang cocok sebagai "hasil akhir" yang dipamerkan.

**Saran:** bagus sebagai **prototipe validasi** sebelum port sungguhan.

---

### 1.6 C# (MonoGame / Godot) atau Godot GDScript

**Pro**
- Perkakas matang, editor visual, ekspor multi-platform termasuk web dan
  konsol.
- Kalau nanti ingin menambah level editor, engine sudah menyediakannya.

**Kontra**
- Engine besar untuk game 320×200 dengan empat bar.
- Abstraksi engine justru menghalangi kalau kamu ingin meniru perilaku
  frame-exact.

---

## 2. Ringkasan pilihan

| bahasa | distribusi | kesetiaan | kecepatan tulis | nilai edukatif |
|---|---|---|---|---|
| **TypeScript** | sangat baik | baik | baik | **sangat baik** |
| JavaScript | sangat baik | baik | sangat baik | baik |
| C + SDL2 | sedang | **sangat baik** | lambat | sedang |
| Rust | baik | sangat baik | lambat | sedang |
| Python | kurang | baik | **sangat baik** | sangat baik |
| C#/Godot | baik | sedang | baik | sedang |

**Kalau harus memilih satu:** TypeScript + Canvas 2D. Distribusinya
menang telak untuk game seperti ini, tipenya menangkap justru kelas
kesalahan yang paling sering terjadi di domain ini, dan hasilnya bisa
langsung dipakai sebagai bahan ajar bersama `TEACHING.md`.

**Kalau tujuannya arkival dan kesetiaan:** C, dikompilasi ke DOS *dan*
WebAssembly, sehingga bisa diuji berdampingan dengan aslinya.

---

## 3. Strategi pengujian — ini keunggulan yang sudah kita punya

Ini bagian yang paling sering terlewat di proyek port, dan proyek ini
kebetulan sudah punya bahannya.

**Emulator sebagai oracle.** `tools/emu8086.py` menjalankan binary asli
dan `tools/frame_dump.py` sudah bisa mengeluarkan frame apa adanya dari
memori video. Artinya:

1. Jalankan binary asli sampai titik tertentu, dump framebuffer
2. Jalankan port sampai titik yang sama, dump framebuffer
3. **Bandingkan piksel**

Itu memberi *golden test* yang objektif — jenis pengujian yang biasanya
tidak tersedia untuk port game.

Lebih jauh: hook di emulator sudah terbukti bisa mencatat pemanggilan
per-rutin. Port bisa diuji pada tingkat perilaku, bukan hanya tampilan —
misalnya "setelah 1000 tick, berapa gelas aktif di tiap bar".

**Saran konkret:** bangun perbandingan framebuffer **sebelum** menulis
banyak kode port. Ia mengubah porting dari menebak jadi mengukur.

---

## 4. Potensi pengembangan

Diurutkan dari yang paling mudah dan paling berdampak:

**Mudah**
- **Save state.** Seluruh keadaan permainan muat di beberapa ratus byte —
  15 byte per pemain, 16 record entitas, daftar gelas.
- **Pilihan palet.** CGA asli, mode composite, atau palet modern.
- **Scaling & aspect ratio** yang benar (piksel aslinya tidak persegi).
- **Penampil sprite interaktif** — katalog di `screens/` sudah jadi,
  tinggal dijadikan halaman.

**Sedang**
- **Dua pemain**, yang sudah ada di kode aslinya lewat
  `swap_player_context`.
- **Jalur suara PCjr** (SN76496 di port `0xC0`) yang selama ini jarang
  terdengar karena butuh perangkat kerasnya.
- **Mode latihan** — mulai dari ronde mana pun, kecepatan bisa diatur.
- **Overlay debug** yang menampilkan bit state entitas secara langsung.
  Ini menghubungkan `TEACHING.md` dengan permainan yang berjalan.

**Ambisius**
- **Level editor.** Tata letak bar sudah berupa rumus, dan isi ronde
  berasal dari `round_spawn_table` yang formatnya sudah terbaca (jumlah
  di AH, kecepatan di AL).
- **Netplay.** Game ini deterministik dan terkunci 60 Hz — kondisi ideal
  untuk *rollback netcode*.
- **Mode "lihat kodenya"** — main sambil menyorot rutin assembly yang
  sedang berjalan. Untuk tujuan edukatif ini akan sangat kuat.

---

## 5. Hal-hal yang mungkin belum terpikirkan

### 5.1 Status hukum — ini perlu dipertimbangkan sungguhan

Tapper adalah properti komersial (Bally Midway, 1984; hak ciptanya
berpindah beberapa kali sejak itu). **"Abandonware" bukan status hukum**
— tidak ada mekanisme di hukum hak cipta yang membuat perangkat lunak
lama menjadi bebas.

Yang perlu dibedakan:

- **Analisis dan dokumentasi** (yang sudah dikerjakan) umumnya berpijak
  jauh lebih aman, terutama untuk tujuan riset dan interoperabilitas.
- **Mendistribusikan binary asli atau asetnya** jelas bermasalah.
- **Port yang memuat aset asli** ikut membawa masalah yang sama.
- **Reimplementasi mesin permainan tanpa aset** adalah pola yang dipakai
  banyak proyek serupa (mereka meminta pengguna menyediakan berkas data
  aslinya sendiri).

Saya bukan penasihat hukum dan ini bukan nasihat hukum. Tapi kalau port
ini akan dipublikasikan, **pola "mesin terbuka, aset dari pengguna"**
adalah yang paling lazim dan paling defensif — dan kebetulan juga paling
mudah, karena `TAPPER.DAT` memang sudah dipisahkan lewat `.gitignore`.

### 5.2 Salinan ini bukan rilis 1984

`DECISIONS.md` mencatatnya, tapi implikasinya untuk port perlu ditegaskan:
binary yang direkonstruksi **sudah di-crack**. Entry point dipatch, dan
intro grup crack berjalan sebelum game.

Artinya:
- Port yang meniru "perilaku asli" sebenarnya meniru **perilaku salinan
  ter-crack**.
- Perbedaannya kemungkinan kecil, tapi tidak diketahui — kami tidak punya
  pembanding rilis asli.
- Kalau kesetiaan arkival penting, ini harus dinyatakan, bukan
  disembunyikan.

### 5.3 Perilaku yang bergantung perangkat keras

Dua hal tidak bisa direplikasi tanpa memutuskan sesuatu:

- **Derau ROM.** Suara pecah membaca F000:0000-1FFF. Di mesin berbeda
  isinya berbeda, jadi **suaranya berbeda di tiap mesin**. Port harus
  memilih: rekam satu versi, atau bangkitkan derau setara.
- **Loop delay.** Semua timing pakai busy loop yang panjangnya
  bergantung kecepatan CPU. Port harus memakai waktu nyata, dan itu
  berarti perilakunya tidak akan identik dengan mesin mana pun tertentu.

### 5.4 Preservasi berbeda dari port

Port yang bagus **tidak** menggantikan kebutuhan preservasi. Kalau
tujuannya menjaga game ini tetap bisa dipelajari, keluaran paling
berharga mungkin bukan port melainkan:

- dokumentasi yang sudah ada di repo ini
- `src/tapper.asm` yang beranotasi dan bisa dibangun ulang byte-identik
- katalog aset di `screens/`

Port adalah **tambahan**, bukan pengganti. Repo ini sudah punya nilai
tanpa port sama sekali.

### 5.5 Kesempatan edukatif yang lebih besar daripada game-nya

Menurut saya ini yang paling menarik dan paling mudah terlewat.

Bahan yang ada di repo ini — assembly beranotasi penuh, emulator yang
bisa dihook, katalog sprite, tabel koreksi yang jujur — adalah bahan ajar
yang jarang ada dalam bentuk lengkap.

Bentuk yang mungkin lebih berharga daripada port biasa:

- **Artikel bertahap** yang membangun ulang satu subsistem per bagian
- **Notebook interaktif** yang menjalankan emulator dan menunjukkan
  hasilnya
- **Halaman "kode dan hasilnya berdampingan"** — assembly di kiri, frame
  yang dihasilkannya di kanan

`TEACHING.md` adalah kerangka awalnya. Port bisa jadi kendaraan untuk itu,
bukan tujuan akhirnya.
