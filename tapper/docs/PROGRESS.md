# Catatan loop tanpa pengawasan

Dijalankan menurut [LOOP.md](LOOP.md).

## Ringkasan

| | |
|---|---|
| Mulai | 2026-07-31, 235 label generik |
| Selesai | 2026-07-31, **0 label generik** |
| Status | **tuntas** — aturan berhenti "nol label generik" terpicu |
| Siklus | 21 |
| Build | byte-identik di **setiap** siklus, tanpa kecuali |

Seluruh label bernama. Tidak ada `loc_XXXX` atau `sub_XXXX` tersisa di
`src/tapper.asm`.

## Apa yang ditemukan, bukan sekadar dinamai

Penamaan ternyata bukan pekerjaan kosmetik. Dua puluh satu siklus
menghasilkan temuan struktural yang tidak terlihat sebelum kodenya
dibaca sampai `ret`:

**Waktu.** PIT diprogram ulang ke **60,0 Hz** (`0x4DAE`), bukan 18,2 Hz
bawaan BIOS — jadi setiap penghitung tick di berkas ini bersatuan 1/60
detik. Dikonfirmasi dari dua sisi: pembagi PIT-nya sendiri, dan kartu
"PLAYER n" yang memuat `0x3C` lalu menunggu ISR.

**Kecepatan.** Layar tidak pernah disegarkan penuh saat bermain — hanya
satu pita 22 scanline (setinggi sprite bar), 1,7 KB bukan 16 KB. Enam
belas entitas di-stagger ke empat frame. Tiga dari empat lintasan input
sengaja kosong karena itu lebih murah daripada mencari record pemain
lagi.

**PCjr diperlakukan separuh kecepatan** di sembilan tempat, termasuk
`delay_busy_loop` dengan 10 pemanggil. Membagi dua hitungan busy-loop
hanya masuk akal kalau mesinnya memang dua kali lebih lambat per
iterasi — dan itu sifat PCjr dengan RAM video yang dipakai bersama CPU.

**Game ini hampir tidak menyimpan keadaan turunan.** Ronde selesai
ditentukan dengan memindai tabel entitas, bukan penghitung. Kalah jatuh
dari pemeriksaan batas yang memang sudah harus jalan. Nyawa tambahan
lahir dari carry BCD, bukan perbandingan ambang. Babak bonus tidak
pernah memilih pemenang — ia memilih lima yang salah, dan bit sisa
ditimpakan ke byte yang sama sebagai indeks jawaban.

**Aritmetika menggantikan tabel.** Geometri bar dihitung
`(bar*20 + 24) * 80 + kolom`, tanpa tabel koordinat. Uji kelipatan 20
ditulis sebagai pengurangan berulang tanpa `DIV`. LFSR mengambil bit
umpan balik dari **flag parity** — dua instruksi menggantikan empat XOR.

**Aturan mask terbukti di ketujuh blitter**: displacement mask selalu
sama dengan ukuran data, dan langkah baris selalu `0x50` tanpa kecuali.

**Suara pecah dibangkitkan dari isi ROM sistem** — tanpa RNG, tanpa
wavetable, nol biaya penyimpanan.

**Perkakas pengembang tertinggal di binary** (`CS:4690`): buka
`Tapper.Pic`, baca `0x4000` byte langsung ke `B800:0000`, restart.
Tidak ada yang menjangkaunya.

## Koreksi yang lahir dari penamaan

Empat nama salah tertangkap justru karena rutinnya akhirnya dibaca utuh.
Semuanya sudah masuk tabel koreksi [DECISIONS.md](DECISIONS.md):

- `picked_bitmap` → `bonus_answer` — byte yang berganti peran di tengah
  jalan tidak bisa dinamai dari satu penulis
- entitas `+0x0D` "nomor bar" → **penghitung mundur**; nilai 1,2,3,0
  adalah stagger, bukan pembagian bar
- doc `spawn_mug` node `+0x04` — saya mengulang kesalahan yang **sudah
  ada di tabel koreksi**, karena membaca `mov [bx+4], bp` tanpa
  memperhatikan `push bp` yang mengapit `select_sprite_ptr`
- dua nama basi di komentar (`slow_machine_flag`, `erase_bar_list_a`)
  yang bertahan setelah simbolnya sendiri dikoreksi

Polanya sama dengan yang sudah tercatat berulang di proyek ini:
**kesimpulan dari satu sumber hampir selalu perlu dikoreksi.**

## Ditinggalkan sengaja

- **`0x4561`** — memilih kolom cetak nomor ronde (0 atau `0x26`). Hanya
  satu situs menyentuhnya, jadi artinya tidak bisa ditentukan. Menebak
  "pemain 2" akan terdengar masuk akal dan mungkin salah.

## Fase 3 — katalog sprite penuh: **SELESAI**

Ketiga sasaran tertutup dalam 6 siklus. Enam tabel sprite ditemukan dan
diukur, keempat bank dirender dan **dibuka serta diperiksa**, dan
pemetaan ukuran→pemakai lengkap.

Katalognya di `screens/`: `sprites.png` (33 pasangan 32x16),
`sprites_bar.png` (16 × 24x22), `sprites_popup.png` (6 × 56x32),
`sprites_untyped.png` (25 entri campuran), `frame_play.png` (satu frame
permainan utuh), `sprites_out_of_range.png` (bukti potongan salah
bingkai).

**Tiga koreksi lahir dari fase ini:**

- Aturan transparansi salah di semua render — harus `mask == 3` saja,
  mengikuti `and`/`or` blitter, bukan `mask == 3 dan data == 0`.
- `mug_draw` saya petakan sebagai `pickup` tanpa verifikasi; sebenarnya
  16x12.
- Batas jangkauan meleset satu — `jb` berarti indeks ke-`n` sah.

**Satu identifikasi dari pengguna, terkonfirmasi kode:** sprite 59/61
adalah **bartender dilempar ke atas meja bar**. `player_death_sequence`
memindahkan `player_top` ke `bar_row_top`, memberinya kecepatan `±1`,
lalu `add al, 0x3b` = 59. Ia meluncur di atas meja, bukan sekadar
berganti sprite. 61 paruh bawahnya lewat aturan +2.

**Dan satu koreksi dari pengguna:** "keran di ujung kiri tiap bar"
digeneralisasi dari satu frame. `bar_bound_table` menyimpan dua batas per
bar, satu per arah — kode yang sudah dibaca lama justru sudah
membantahnya.

## Fase 3 — rincian siklus

- **#2 Tabel tanpa tipe — 25 dari 25 SELESAI.** Indeks 12 dan 23 tidak
  punya situs panggil sama sekali; ukurannya diturunkan dari tata letak.
  Mengurutkan entri menurut alamat menunjukkan **tiap entri menempati dua
  kali ukuran data** karena data dan mask bersebelahan — cocok untuk 20
  dari 23 entri yang sudah diketahui. Keduanya berentang 128, sama dengan
  tetangga 16x16-nya, dan rendernya jatuh di kelompok semantik yang tepat
  (12 wajah tokoh babak bonus, 23 percikan pecahan). Hipotesis awal bahwa
  keduanya paruh **mask** gugur — dan justru kegagalannya yang
  memunculkan model data+mask bersebelahan.
- **#2 Tabel tanpa tipe — 23 dari 25 terkatalog.** Situs yang menghitung
  AL ternyata terbaca juga; masing-masing menghasilkan himpunan kecil
  (`5,6` / `7-10` / `24,25`). Rendernya mengonfirmasi mekanika secara
  visual: **5,6 gelas penuh** yang berangkat, **7-10 gelas kosong** yang
  pulang. Indeks 5 muncul dari dua jalur bebas dan keduanya memberi
  16x12. Sekaligus dua koreksi alat: `mug_draw` saya petakan sebagai
  `pickup` tanpa verifikasi (sebenarnya 16x12), dan batas jangkauan
  meleset satu — game memakai `jb`, jadi indeks ke-`n` sah. Sisa terbuka
  tinggal **indeks 12 dan 23**.
- **#2 Tabel tanpa tipe — 16 dari 25 terkatalog.** Runtime hanya
  memulihkan 1 entri dalam 400M instruksi; membaca situs panggil statis
  memulihkan 16. Sepuluh di antaranya indeks 8x8 yang awalnya terlewat
  karena `mov al` ada sebelum kepala loop, bukan di sebelah panggilan.
  Semua render koheren dan cocok dengan pemakainya yang sudah dibaca
  lebih dulu. Sisa **9 entri** (0, 6–10, 12, 23, 24) tanpa situs panggil
  ber-immediate, plus 5 situs yang menghitung AL — dilewati, bukan
  ditebak. Langkah berikutnya yang bisa gagal: apakah kesembilan itu
  pernah diminta sama sekali, atau entri mati.
- **#3 Petakan ukuran ke pemakainya — SELESAI.** `sprite_table_ptr`
  adalah **tabel tanpa tipe**: 25 entri, stride tidak seragam bahkan
  negatif, memuat sprite segala ukuran tercampur. Ukurannya tidak dicatat
  di tabel melainkan ditentukan blitter yang dipanggil pemanggilnya —
  enam blitter berbeda dari 18 situs panggil. Mengatalogkannya berarti
  mencatat blitter penyusul, bukan mengukur stride.
- **#2 Render — sprite bar TERIDENTIFIKASI.** `tools/frame_dump.py`
  men-decode `draw_target_segment` setelah 400M instruksi ke
  `screens/frame_play.png`: **layar Tapper yang sebenarnya**. Bentuk
  bersudut di `sprites_bar.png` entri 1/3/5/7 adalah struktur keran di
  ujung bar. Satu uji yang sekaligus memvalidasi emulasi CPU, interleave
  bank, dan palet. **Ujung mana tidak boleh disimpulkan dari frame ini** —
  `bar_bound_table` menyimpan dua batas per bar, satu per arah.
- **#2 Render tiap ukuran — SEBAGIAN.** `sprites_popup.png` **koheren
  dan teridentifikasi**: enam frame 56x32, dua penari, pose berbeda tiap
  frame. `sprites_bar.png` bersih dan latarnya transparan, tapi isinya
  **belum bisa saya kenali** sebagai objek — belum saya sebut selesai.
  Sekaligus mengoreksi aturan transparansi di semua render: harus
  `mask == 3` saja, mengikuti `and`/`or` blitter, bukan
  `mask == 3 dan data == 0`.

  Catatan cara kerja: saya sempat menyatakan render bar "tidak koheren"
  setelah sekali lihat. Diagnostik render mentah menunjukkan geometrinya
  justru benar — yang saya kira kemiringan adalah blok **mask** yang
  memang berpola papan catur. Penilaian sekali-lihat terbukti tidak
  cukup, persis seperti koreksi sebelumnya.
- **#1 Tabel pointer tiap ukuran — SELESAI.** Ada **enam** tabel, bukan
  satu, masing-masing dengan satu pembaca yang sudah dibaca sampai `ret`:
  `ptr_table_a`/`ptr_table_b` (32x16, dipilih bit 7 di `lookup_ptr_pair`),
  `bar_sprite_table` (`0x44A5`, dibaca `lookup_bar_sprite`),
  `popup_table_a`/`popup_table_b` (`0x44A7`/`0x44A9`, dibaca
  `sprite_ptr_from_index`), dan `sprite_table_ptr` (`0x44AB`, dibaca
  `select_sprite_ptr`).

## Fase 2 — semantik: **SELESAI**

Kelima sasaran tertutup dalam 4 siklus, build byte-identik di setiap
siklus. Dua di antaranya tertutup dengan cara yang tidak menambah
kepastian palsu: #3 ditutup dengan **mencabut** dugaan, #2 ditutup
separuh dengan sisanya dipindahkan ke bawah.

**Dua koreksi lahir dari fase ini**, keduanya dari pola yang sama —
ketiadaan hasil dibaca sebagai ketiadaan fakta:

- `CS:4690` bukan perkakas pengembang tak terjangkau melainkan **intro
  grup crack** yang berjalan tiap startup. Grep tidak menemukan rujukan
  ke `4690`; pintu masuknya `4680`, lewat label `crack_entry_patch` yang
  sudah bernama sejak lama.
- `sprites.png` sudah "berhasil" sejak run 400M, tapi separuh isinya
  salah sampai gambarnya dibuka dan dilihat.


- **#1 Kepemilikan entri tabel sprite — SELESAI.** Run 400M (naik dari
  60M) menghasilkan **16 indeks** dengan pemiliknya dari runtime, bukan
  pengamatan mata. Kriteria ">3 indeks" terpenuhi. Aturan "paruh bawah =
  paruh atas + 2" muncul sendiri di datanya — sumber kedua yang bebas.
  Temuan sampingan: game meminta indeks 78, 80, 126 padahal tabelnya 66
  entri, dan permintaan itu diabaikan diam-diam.
- **#5 Katalog sprite — SELESAI.** `ptr_table_a` ternyata **33 pasangan
  (data, mask)**, bukan 65 sprite. Versi lama `sprite_sheet.py` menyusuri
  tiap `i` sehingga separuh gambarnya memakai blok data sebagai mask —
  terlihat sebagai entri buram berselang-seling. Setelah melangkah dua,
  ke-33 entri transparan dan terbaca. Tiga sumber bebas sepakat: kode
  `lookup_ptr_pair`, indeks runtime yang semuanya ganjil, dan render.
- **#4 54 instruksi `db` — SELESAI, terklasifikasi.** Metriknya ternyata
  menghitung dua hal berbeda. **39 dari 54 bukan instruksi sama sekali**
  — mereka di dalam tabel data bernama (`bar_limit_source`,
  `round_spawn_table`, tabel nada di `0x42CC`-`0x4348`, dan string
  `"Tapper.Pic"`), jadi tidak akan pernah berhenti jadi `db`. Sisanya 15
  benar-benar kode: 13 kasus lebar displacement + 2 encoding jump/call.
  **Sekaligus mengoreksi siklus #20**: `CS:4690` bukan perkakas
  pengembang tak terjangkau melainkan **intro grup crack** yang berjalan
  tiap startup.
- **#3 Dua `in al, 0x3da` — SELESAI, dengan klaim dicabut.** Fakta
  mekanisnya diperkuat: flag dari `test al, 8` ditimpa `sub si, 0x50`
  tanpa pernah dibaca, dan tidak ada cabang bersyarat di jendela itu
  (uji bisa gagal — satu `jz` di sana akan membantahnya). Tapi dugaan
  "sisa kode yang lumpuh" **dicabut**: ini satu-satunya situs `0x3DA` di
  binary jadi tidak ada pembanding, dan tidak ada NOP di `0x1D00`-`0x1FFF`
  yang menandakan tambalan. Alasannya tidak diketahui, dan dibiarkan
  begitu.
- **#2 `or bx, 0xe000` — SELESAI sebagian.** `tools/probe_rom_noise.py`
  mengukur 4000 pembacaan: semuanya segmen F000, offset `0x0001`
  sampai `0x05CC`, **tidak satu pun di atas `0x2000`**. OR itu
  terbukti mati. Sisanya dipindahkan ke bawah karena butuh perangkat
  keras.

## Tidak menghalangi recompile

Ditegaskan supaya tidak jadi kekhawatiran berulang: **rekonstruksi sudah
byte-identik** dengan `TAPPER.COM` asli, dan itu ukuran yang menutup
pertanyaan recompile sepenuhnya. Apa pun yang terjadi saat *runtime* —
isi ROM mesin host, permintaan sprite yang diabaikan — tidak mengubah
satu byte pun di keluaran.

Kedua hal di bawah relevan untuk **porting**, bukan untuk recompile.

## Terbuka untuk manusia

- **TIDAK BISA DIVALIDASI — tidak ada mesin PC/PCjr asli.**
  Apakah F000:0000-1FFF berisi byte yang bervariasi di mesin target?
  Pertanyaan ini sekarang tajam. Sudah terukur bahwa `play_rom_noise`
  membaca daerah itu (bukan ROM BIOS). Speaker hanya bergerak kalau
  nilai bit 0 berturut-turut **berbeda**; daerah yang terisi seragam —
  seluruhnya `0x00` maupun `0xFF` — menghasilkan senyap dengan jeda utuh.

  Emulator ini menyimpan nol semua di sana, tapi itu celah emulator,
  bukan bukti perangkat keras. Menjawabnya butuh peta memori PC/PCjr
  asli atau mesin sungguhan.

- **TERJAWAB SEBAGIAN — indeks sprite di luar jangkauan.** Hipotesis
  "tabel lebih besar di mode lain" **gugur**: mode 0 punya 66 entri,
  mode 1 hanya 7. Rendernya di `screens/sprites_out_of_range.png`
  **bukan sampah acak melainkan potongan yang salah bingkai** — pengamatan
  ini datang dari **melihat gambarnya**, bukan dari kode. Bank sprite
  ternyata kisi datar `0x80` tanpa pengecualian, dan ketiga indeks itu
  meleset 102, 122, dan 58 byte dari kisinya, sehingga jendela 128 byte-nya
  mengangkangi batas blok. Yang tersisa dan tidak bisa dijawab dari
  salinan ini: apakah kode 1984 aslinya bermaksud sesuatu di sana.


## Langkah berikutnya

Ketiga fase tuntas: penamaan, semantik, katalog sprite. Yang tersisa
bukan pekerjaan decompile melainkan **porting**, yang memang ditunda
sejak awal.

Dua hal di atas ("Terbuka untuk manusia") tidak menghalangi keduanya —
rekonstruksi sudah byte-identik, dan keduanya baru relevan saat
memutuskan perilaku apa yang perlu ditiru di port.
