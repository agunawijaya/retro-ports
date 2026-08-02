# Keputusan dan Pendekatan yang Ditolak

`FINDINGS.md` memuat apa yang **terpecahkan**. Berkas ini memuat apa yang
**dicoba dan gagal**, beserta alasannya — supaya tidak diulang.

`PLAYBOOK.md` memuat pelajaran yang bisa dipindahkan ke game lain. Yang di sini
spesifik untuk Tapper.

---

## Keputusan besar

### Target: ASM byte-identik, bukan C

Tapper ditulis assembly tangan — pola `50 53 51 52 57 56` (push enam register)
tersebar di puluhan tempat, tanpa prolog `push bp / mov bp,sp` yang konsisten.
Tidak ada source C yang pernah ada untuk dipulihkan.

Konsekuensinya: "decompile ke C yang rapi" bukan target yang bisa diverifikasi.
Yang bisa dibuktikan adalah reassembly byte-identik — hash cocok atau tidak.

### mzretools tidak dipakai

User mengusulkannya di awal. Dua alasan menolak: README-nya menyatakan `.com`
tidak didukung, dan alurnya (tulis ulang di C → compile → `mzdiff`) dirancang
untuk game hasil kompilasi C. Untuk assembly tangan, alur itu tidak relevan.

### Emulator sendiri, bukan debugger DOSBox-X

DOSBox-X punya debugger, tapi GUI dan butuh tangan manusia tiap iterasi.
Interpreter Python bisa dijalankan headless, berulang, dan di-instrumentasi
sesuka hati. Keputusan ini terbayar berkali-kali — write-watch, probe blitter,
dan instrumentasi `load_asset` semuanya mustahil lewat debugger interaktif.

### Ghidra dan IDA tidak dipakai

Decompiler 16-bit real mode lemah menangani segmentasi. Untuk binary 17 KB,
tooling Python sendiri lebih efektif dan bisa disesuaikan.

---

## Pendekatan yang gagal

### Sweep stride statistik untuk format sprite

Korelasi vertikal dan uji hipotesis layout (plain / de-interleave / bank).
Skor tertinggi hanya ~0,3–0,4 dan seri antara stride 40 dan 80.

**Kenapa gagal:** tidak ada stride global karena track berisi sprite bank dengan
tujuh ukuran berbeda. Ketiadaan hasil itu justru jawabannya.

**Yang berhasil:** membaca rutin blitter.

### Profil rutin berdasarkan jumlah eksekusi

Dibangun untuk menemukan logika game. Puncaknya seluruhnya rendering dan loop
tunggu — `loc_0C86` sendiri 20% waktu hanya menunggu flag.

**Kenapa gagal secara struktural:** logika game berjalan sekali per frame per
entitas, jadi tidak akan pernah muncul di puncak profil semacam itu.

**Yang berhasil:** menelusuri pemanggil blitter yang melakukan loop atas banyak
entitas, dan write-watch pada memori entitas.

### Tiga jangkar untuk mencari ramp kesulitan

1. Kelima pemanggil `advance_rng` — semua teridentifikasi, tidak ada yang
   mengubah parameter kesulitan
2. Daftar variabel yang ditulis `apply_difficulty` — dibaca sebagai sekuensor
   teks attract mode; **kesimpulan ini salah**, lihat koreksi di bawah. Yang
   ditulis di situ justru urutan halaman dan penghitung ronde
3. Penulis `bar_limit_table` — hanya satu, salinan tabel statis saat init

**Yang berhasil:** write-watch menemukan `update_entity_states`, yang membawa ke
`entity_tick_reload`, yang penulis ketiganya adalah `tighten_difficulty`. Grep
numerik melewatkan penulis itu karena barisnya sudah tersimbolkan.

**Jangkar kedua dibuka belakangan oleh `hot_vars.py`:** memeringkat alamat data
yang belum bernama menaruh `0x44D3` di puncak, dan membaca *semua* pemakainya
(bukan hanya yang sudah dikenal) menemukan `CS:0E0B` — indeks tabel parameter
per-ronde. Separuh per-ronde dari ramp kesulitan ada di situ, bukan hilang.

### Dua percobaan perbaikan encoding displacement

Aturan ModR/M umum: demosi 59 → 86. Dibatasi hanya opcode `mov`: 54 → 118.

**Kenapa gagal:** memaksa lebar displacement mengubah instruksi yang sudah benar
lebih cepat daripada memperbaiki yang salah. Yang kedua lebih buruk padahal
seharusnya lebih aman, jadi masalahnya bukan pemilihan opcode.

**Status:** 13 kasus displacement dibiarkan sebagai `db`. Tidak sepadan dicoba
lagi tanpa cara menguji satu instruksi pada satu waktu.

### Bot pemain untuk menembus state game lebih dalam

Direncanakan, tidak dikerjakan. Setelah terlihat AI sudah berjalan di level
Saloon, mengejar state baru bukan jalur tercepat — dan menulis bot Tapper yang
kompeten adalah proyek tersendiri.

**Akibatnya:** empat site `call word ptr [bx+si]` dan aset 0, 11, 13, 14 tetap
belum tersentuh.

**Diuji ulang belakangan, dan trace lebih panjang bukan gantinya.** Menaikkan
batas dari 12M ke 40M instruksi hanya menambah 56 alamat kode (2.340 → 2.396)
dan tidak membuka satu subsistem pun: bonus bar-bersih, popup tip, kalibrasi
joystick, dan pembungkusan halaman tetap nol eksekusi. Emulator mati lima kali
dan menaikkan penghitung ronde sekali. Rinciannya di
[FINDINGS.md](FINDINGS.md#tracing-pasif-sudah-mentok).

Jalan keluarnya bukan bot yang bermain bagus, melainkan **menyuntik state
langsung** — dan itu baru mungkin setelah variabel penentunya bernama
(`page_index`, `round_param_index`, `abort_sequence_flag`). Penamaan yang
tampak seperti pekerjaan kosmetik ternyata yang membuka opsi ini.

**Catatan susulan:** satu dari dua alasan "emulator tidak maju" ternyata bukan
soal bermain buruk sama sekali, melainkan run yang terlalu pendek — timeout
menu memakan ±36 juta instruksi. Jadi kesimpulan "tracing pasif mentok" tetap
benar untuk cakupan, tapi sebagiannya dulu diukur dengan run yang belum
melewati satu timeout pun.

---

## Koreksi yang pernah dibuat

Dicatat karena semuanya sempat masuk dokumentasi sebagai fakta.

| Klaim awal | Sebenarnya | Sebab keliru |
|---|---|---|
| `TAPPER.DAT` = 36 record × 2560 byte | 180 sektor × 512 byte | 92160 kebetulan habis dibagi 2560 |
| Cakupan 102% | Seeding immediate terlalu longgar | `sum(size)` menghitung ganda saat tumpang tindih |
| Cakupan 78,5% | 73% | Padding nol ter-decode sebagai `add [bx+si],al` |
| `load_asset` di `0x502` | `0x503` | Byte `0x00` nyasar di depan |
| `entity_tick_reload` bukan kontrol kesulitan | Ya, penulis ketiga di `0x1F55` | Grep numerik buta setelah penamaan |
| Node `+0x06` = state | Kecepatan | Disimpulkan dari satu pembaca |
| `joystick_center` | Batas bawah sepasang ambang | Belum menemukan pasangannya |
| Tabel `screen_aux` bukan indeks aset | Ya indeks aset | Nilai di luar jangkauan ternyata tak pernah dipakai |
| `0x44D3` = sekuensor teks attract mode | `round_param_index`, indeks tabel parameter per-ronde | Hanya `show_next_text_page` yang dibaca; pembaca penentunya di `CS:0E0B` |
| Tidak ada penghitung level di program ini | `round_number` (`0x44C7`), dicetak di baris status | Klaim diambil dari `apply_difficulty` saja, tanpa mencari pembaca `0x44C7` |
| Dua blok state pemain 30 byte | Satu blok aktif 15 byte + dua slot simpanan | `0x1E` disimpulkan dari pola penulisan, bukan dari `swap_player_context` |
| `lives` P1=2 vs P2=3 "tidak cocok" | Pemain 2 selalu +1 nyawa (4/5, 2/3) | Hanya satu tingkat kesulitan yang dibandingkan |
| `text_page_table` / `_param` / `_index` | `page_screen_table` / `page_theme_table` / `page_index` — satu urutan 27 halaman | Diasumsikan `DI` memilih string; `print_string_at` ternyata hanya memakai `SI`. Satu nama salah menyeret dua tetangganya |
| Popup skor bertahan "64 frame" | 64 tick `popup_tick_divider`; durasi dalam frame belum ditetapkan | Nilai muat `0x40` dibaca sebagai penghitung frame tanpa memeriksa apa yang menurunkannya |
| `input_flag_right` | `player_velocity` — field `+0x0E` record pemain | Dinamai dari penulisnya (handler tombol) tanpa memeriksa bahwa alamatnya ada di dalam sebuah record entitas |
| `0x4683` "kemungkinan array entitas untuk aktor lain" | Empat record pemain: atas, bawah, dan posisi sebelumnya masing-masing | Disimpulkan dari jaraknya (`0x100`) ke `entity_table`, bukan dari kode yang memakainya |
| Tabel `screen_aux` di `0x3C21` berisi nilai di luar jangkauan | Yang berisi nilai di luar jangkauan `0x3C28`; `0x3C21` maksimal `0x0E` | Kedua tabel bertumpang tindih tujuh byte, dan isinya tidak pernah didump |
| Opcode BCD "tidak dipakai jalur kode nyata" (komentar di `emu8086.py`) | `add_score` memakai `DAA`; seluruh jalur skor tak pernah tereksekusi di emulator | Ketiadaan eksekusi dibaca sebagai ketiadaan pemakaian, padahal jalurnya memang tak pernah tercapai |
| Game menanyakan `R`/`C` di awal (README, BUILD, komentar `trace.py`) | Prompt-nya dibuang crack; mode ditentukan byte rendah segmen muat | String prompt ditemukan di data lalu dianggap masih dipakai, tanpa memeriksa apakah ada yang merujuknya |
| "Katalog sprite belum lengkap" karena aset tak pernah diminta | Dua soal tercampur: peta **pemakai** ada di tabel statis, sedangkan **isi** aset layar ternyata cuma terkompresi RLE | Ketiadaan permintaan runtime dibaca sebagai ketiadaan data |
| Empat site `call word ptr [bx+si]` "belum tersentuh saat tracing" | Bukan kode: tiga adalah kode kontrol kursor `FF 10 14` di dalam string, satu awal tabel data suara | Byte data dibaca sebagai instruksi, lalu ketiadaan eksekusinya dicatat sebagai misteri alih-alih sebagai petunjuk bahwa itu bukan kode |
| Mode 0 "mandek" di attract loop | Tidak mandek, cuma lambat: timeout `read_key` ± 36 juta instruksi emulator, semua run 6M–30M | Panjang run dibandingkan dengan intuisi, bukan dengan satuan waktu internal program |
| Mode 0 mandek karena terminator skrip layar `CS:0776` | Cabang itu memilih dua jalur setup tabel sprite, bukan terminator | Dugaan yang konsisten dengan bukti, tapi tidak diuji dengan eksperimen yang membedakannya dari alternatif |
| "Enam varian blitter" (disebut di empat berkas) | **Tujuh** — `blit_sprite_16x12` (`CS:3136`) menggambar ikon baris status | Daftar blitter disusun dari jalur yang dicakup emulator; penggambaran baris status tidak pernah masuk daftar itu |
| Suara = PC speaker | **Dua perangkat**: PC speaker (PIT port `0x42`) dan chip SN76496 (port `0xC0`), dipilih `sound_flags` bit 1 | Jalur chip hanya tersentuh bila bit itu diset, dan emulator tidak pernah menyetelnya; string menu `"EXTERNAL SOUND"` sudah lama terbaca tapi tidak pernah dihubungkan ke kodenya |
| `slow_machine_flag` | `is_pcjr` — hasil membaca byte model BIOS di F000:FFFE dan membandingkannya dengan `0xFD` | Nama diberikan dari *efeknya* (pembagi dilebarkan) tanpa menelusuri **siapa yang menulisnya**; arah pemahamannya jadi terbalik, dan "mesin lambat dapat lebih banyak waktu" terdengar terlalu masuk akal untuk dipertanyakan |
| `erase_bar_list_b` | `update_returning_mugs` — menghapus, memindahkan, menilai tangkapan, dan bisa membunuh pemain | Dinamai dari **empat baris pertamanya**. Rutin panjang gampang dinamai dari yang terlihat lebih dulu, dan sisanya tidak pernah diperiksa |
| `erase_bar_list_a` | `update_served_mugs` — penyakit yang sama; juga berakhir di `on_player_death` | Sama; dan karena nama pasangannya juga salah, keduanya saling meneguhkan kesalahan |
| Node `+0x04` = "pointer entitas pemiliknya" | **Pointer data sprite** — hasil `select_sprite_ptr` yang disimpan di `CS:1CC5` dan di-blit di `CS:2376` | Disimpulkan dari konteks penulisannya tanpa memeriksa pembacanya; pembacanya memakai `[bp+0x30]` sebagai mask, yang mustahil untuk record entitas 16 byte |
| `+0x07` blok pemain "1 vs `0x21`, tidak jelas" | `score_column` — kolom layar tempat skor digambar | Dicatat sebagai anomali dan dibiarkan; baru terpecah saat label internal `redraw_changed_digits` dibaca untuk diberi nama |
| "Keran di ujung **kiri** tiap bar" | Ujungnya bergantung arah/adegan; `bar_bound_table` menyimpan **dua batas per bar, satu per arah**, dan `spawn_mug` mengindeksnya `[bar + dir]` | Digeneralisasi dari **satu frame** yang kebetulan tertangkap. Kode yang sudah dibaca berbulan-bulan sebelumnya justru sudah membantahnya — indeks arah pada tabel batas tidak akan ada kalau posisinya tetap. Bukti visual tunggal mengalahkan bukti struktural yang sudah dimiliki |
| Render indeks di luar jangkauan = "sampah" | **Potongan yang salah bingkai** — data sprite nyata dibaca meleset dari kisi `0x80`, sehingga beberapa sprite bertetangga masuk satu jendela | Kata "sampah" dipilih dari melihat sekilas dan dari alamatnya yang kacau. Bedanya penting: sampah acak tidak memberi informasi, sedangkan potongan meleset **membuktikan datanya berkisi rapat** — dan dari situ stride `0x80` bisa diukur. Koreksi ini datang dari pengguna yang benar-benar memandangi gambarnya |
| `CS:4690` "perkakas pengembang yang tak terjangkau" (ditulis siklus #20) | **Intro grup crack**, dijalankan tiap startup lewat `crack_entry_patch` di `CS:0110` | Grep `4690`/`46A7` tidak menemukan rujukan, lalu ketiadaan hasil dibaca sebagai ketiadaan jalur. Pintu masuknya `4680`, dan rantainya lewat label `crack_entry_patch` yang **sudah bernama sejak lama** — petunjuknya ada, tidak ditelusuri maju dari entry point |
| Entitas `+0x0D` = nomor bar, "empat pelanggan per bar" (ditulis siklus #4) | Penghitung mundur per-entitas; nilai awal 1,2,3,0 adalah **stagger** supaya 16 entitas tersebar ke empat frame | Dinamai dari penulisnya di `init_entity_slots` saja. Nilai yang berulang 0..3 di sebelah `entity_table` terlalu mirip indeks bar untuk dicurigai, dan pembacanya di `CS:1278` baru terbaca satu siklus kemudian |
| `picked_bitmap` | `bonus_answer` — bitmap lima-dari-enam yang di `CS:2603` **ditimpa** oleh indeks bit sisanya, jadi indeks jawaban | Dinamai dari fase pertamanya saja. Byte yang berganti peran di tengah jalan tidak bisa dinamai dari satu penulis |
| Node gelas `+0x04` = pointer record pemain (doc `spawn_mug`, sempat ditulis giliran ini) | Pointer data sprite dari `select_sprite_ptr` | Kesalahan yang **sudah ada di tabel ini** (baris di atas) diulang, karena `mov [bx+4], bp` dibaca tanpa memperhatikan bahwa `select_sprite_ptr` mengubah BP — itulah gunanya `push bp` yang mengapitnya |

Polanya konsisten: **kesimpulan dari satu sumber bukti hampir selalu perlu
dikoreksi.** Yang selamat adalah yang punya dua sumber independen — mask per-bit
(uji numerik + render), kapasitas pool (layout field + alamat tabel tetangga),
kontiguitas direktori aset (13 dari 13 cek), blok progres 15 byte
(`swap_player_context` + offset skor yang sama di `draw_score_display` dan
`reset_all_scores`), dan 21 ronde (dua tabel berbeda, dua aritmetika kedekatan).

Empat koreksi terakhir di tabel itu datang dari satu pembacaan yang sama, dan
itu sendiri sebuah pelajaran: **satu simpul yang salah dibaca menyebar ke setiap
klaim di sekitarnya.** Yang membongkarnya bukan bukti baru dari luar, melainkan
membaca pemakai yang belum bernama lebih dahulu.

---

## Transcript

Percakapan lengkap ada di
`~/.claude/projects/C--Projects-Tapper/<session-id>.jsonl` (5,4 MB).
Terlalu besar untuk dibaca utuh, tapi bisa di-grep untuk pertanyaan spesifik
seperti "mengapa pendekatan X ditolak". Untuk melanjutkan dengan konteks asli,
gunakan `claude --resume`.
