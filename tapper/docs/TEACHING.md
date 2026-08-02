# Belajar pemrograman dari Tapper (1984)

Berkas ini bukan tentang reverse engineering. Ini tentang **apa yang bisa
dipelajari seorang programmer** dari kode yang ditulis empat puluh tahun
lalu untuk mesin dengan CPU 4,77 MHz dan RAM 64 KB.

Semua contoh di sini nyata, ada alamatnya, dan bisa kamu periksa sendiri
di `src/tapper.asm`.

---

## Bagian 1 — Ide besar yang masih relevan hari ini

### 1.1 Jangan simpan apa yang bisa ditanyakan

Ini tema paling kuat di seluruh program, dan mungkin pelajaran paling
berharga untuk programmer modern.

Tapper hampir **tidak pernah menyimpan keadaan turunan**. Kalau sesuatu
bisa dihitung ulang atau ditanyakan ke data yang sudah ada, ia tidak
disimpan.

**Contoh A — "ronde selesai" tidak punya penghitung.**

Dugaan wajar: ada variabel `pelanggan_tersisa`, dikurangi tiap pelanggan
pergi, dan ronde selesai saat nol. Tapper tidak melakukan itu. Di
`CS:1F7F` ia **menyusuri keenam belas record entitas** mencari satu saja
yang masih aktif:

```asm
    mov cx, 0x10                 ; 16 slot
    mov bp, entity_table
loop:
    test byte [bp + 6], 1        ; masih bermain?
    jne masih_ada                ; ya -> kembali ke permainan
    add bp, 0x10
    loop loop
    ; jatuh ke sini = ronde selesai
```

**Kenapa ini pintar:** penghitung bisa melenceng. Kalau ada satu jalur
kode yang lupa mengurangi, kamu dapat bug yang muncul sekali dalam
sejuta. Memindai tabel **tidak bisa salah** — jawabannya selalu
mencerminkan keadaan sebenarnya. Dan ongkosnya konstan: 16 tes, entah
sisa satu pelanggan atau lima belas.

Ini pelajaran yang berulang di pemrograman modern dengan nama lain:
*single source of truth*, *derived state*, *normalization*. Prinsipnya
sama persis.

**Contoh B — kondisi kalah tidak punya pemeriksaan sendiri.**

Pemeriksaan batas bar memang **sudah harus** ada untuk menahan pelanggan
supaya tidak berjalan keluar layar. Kondisi kalah menumpang di situ:

```asm
    ; entity_at_bound, CS:1310
    test byte [bp + 6], 0x20     ; sedang bergerak?
    jne masih_main               ; ya -> lanjut
    jmp player_death_sequence    ; tidak -> mati
```

Tidak ada kode "cek apakah pemain kalah". Kalah **jatuh** dari
pemeriksaan yang sudah ada.

**Contoh C — nyawa tambahan dari flag carry.**

Ini favorit saya. Tidak ada tabel ambang bonus, tidak ada perbandingan:

```asm
    ; check_bonus_life, CS:3184
    add al, byte [next_bonus_score]
    daa                          ; koreksi desimal
    jae lanjut                   ; tidak carry -> belum
    inc byte [lives]             ; carry -> nyawa tambahan
```

Tingkat bonusnya dikodekan sebagai **jarak menuju carry berikutnya**.
Melewati ambang dan mendeteksi pelewatannya adalah **instruksi yang
sama**.

> **Latihan:** Coba tulis "beri nyawa tambahan tiap 10.000 poin" di
> bahasa favoritmu tanpa perbandingan apa pun. Kamu akan menemukan bahwa
> triknya adalah memilih representasi yang membuat kondisinya jatuh
> sendiri.

---

### 1.2 Geometri sebagai aritmetika, bukan tabel

Di mana letak keempat bar di layar? Tidak ada tabel koordinat. Setiap
kali gelas dilahirkan, posisinya **dihitung**:

```
alamat_layar = (nomor_bar * 20 + 24) * 80 + kolom
```

Tiga konstanta itu adalah seluruh tata letak:

- **80** — byte per scanline CGA 320×200 2bpp
- **24** — bar teratas 24 baris ke dalam bank
- **20** — jarak antar bar

**Pelajarannya:** data yang punya struktur teratur sering lebih baik
dinyatakan sebagai rumus daripada disimpan. Tabel 4 entri mungkin murah,
tapi tabel yang bisa melenceng dari kode yang memakainya tidak pernah
murah.

Hal serupa muncul di tabel sprite: setiap entri persis
`basis + i * 0x80`, sehingga **tabel 66 pointer itu sebenarnya
redundan** — bisa diganti satu perkalian.

---

### 1.3 Ratakan biaya, jangan kurangi

Tapper punya tiga trik yang semuanya bukan "membuat lebih cepat"
melainkan "menyebar bebannya".

**A. Hanya satu bar disegarkan per frame.** `flush_bar_band` (`CS:1EB5`)
menyalin **22 scanline** — setinggi sprite bar — bukan layar penuh. 1,7 KB
per frame alih-alih 16 KB.

**B. Enam belas entitas di-stagger ke empat frame.** Tiap record punya
penghitung mundur di `+0x0D`, disemai dengan 1, 2, 3, 0 saat boot. Jadi
tidak semua entitas diperbarui di frame yang sama.

**C. Gambar ganda karena bank CGA, bukan double buffering.** Setiap
sprite digambar dua kali dengan `xor di, 0x2000`, karena CGA menyimpan
baris genap dan ganjil di dua wilayah terpisah.

**Pelajarannya:** frame rate ditentukan oleh frame **terburuk**, bukan
rata-rata. Meratakan beban sering lebih berharga daripada mengurangi
totalnya. Prinsip ini persis sama dengan *time slicing* dan
*incremental GC* modern.

---

### 1.4 Satu byte, delapan keputusan

Seluruh perilaku entitas didispatch dari satu byte di `+6`:

| bit | arti |
|---|---|
| 0 | sedang bermain |
| 1 | membawa gelas |
| 2 | memilih varian sprite |
| 3 | slot terpakai |
| 4 | sedang menuang |
| 5 | sedang bergerak |
| 6 | sedang kembali |
| 7 | arah hadap |

Dan **urutan pengujiannya adalah urutan prioritas biaya**: slot kosong
cukup satu tes dan langsung keluar; entitas yang bergerak tidak pernah
menyentuh timernya; hanya yang diam cukup lama sampai ke kerja animasi.

**Pelajarannya:** menyusun percabangan dari yang paling sering menolak ke
yang paling mahal adalah optimasi gratis. Kamu melakukan hal yang sama
tiap kali menulis *guard clause* di awal fungsi.

---

## Bagian 2 — Trik yang terlihat canggih untuk zamannya

### 2.1 LFSR yang mengambil bit umpan balik dari flag parity

Ini yang paling elegan di seluruh program.

Pembangkit acaknya adalah *linear feedback shift register* 16-bit. Cara
biasa menghitung bit umpan baliknya: XOR beberapa bit tertentu. Itu butuh
beberapa instruksi dan register cadangan.

```asm
    ; advance_rng, CS:2F50
    and ax, 0xd598      ; sisakan hanya bit tap
    jnp short $ + 3     ; parity genap -> CF tetap 0
    stc                 ; parity ganjil -> CF = 1
    rcl [rng_state], 1  ; geser masuk di bawah
```

Kuncinya: **flag parity 8086 adalah XOR dari bit-bit di byte rendah.**
Jadi `and` + `jnp` menggantikan empat XOR. Dua instruksi, nol register
cadangan.

> **Kenapa ini layak dipelajari:** ini contoh sempurna dari *memahami
> alat kerjamu*. Flag parity ada di 8086 untuk pemeriksaan error
> komunikasi serial. Programmer ini melihatnya sebagai "XOR gratis" dan
> memakainya di tempat yang sama sekali tidak dimaksudkan.

### 2.2 Modulo tanpa DIV

`DIV` di 8088 mahal (80+ siklus). Butuh tahu apakah sebuah nilai
kelipatan 20:

```asm
1:  sub al, 0x14        ; kurangi 20
    jl  selesai         ; lewat nol -> bukan kelipatan
    jne 1b              ; masih positif -> ulangi
    shl ah, 1           ; mendarat TEPAT di nol -> kelipatan
```

Untuk nilai kecil, pengurangan berulang lebih cepat daripada satu `DIV`.
Cetak dua digit desimal juga pakai trik yang sama (`CS:1025`).

**Pelajarannya:** kompleksitas asimptotik tidak selalu yang penting.
Untuk `n` kecil dan konstanta besar, algoritma "bodoh" menang. Ini masih
benar hari ini — itulah kenapa `sort` modern beralih ke insertion sort
untuk sub-array kecil.

### 2.3 Derau dari isi ROM

Suara gelas pecah tidak memakai chip suara atau wavetable:

```asm
    ; play_rom_noise, CS:3B1E
    and al, 0xfe        ; matikan gerbang timer
    ...
    test byte [es:bx], 1   ; ES = 0xF000 -- ROM SISTEM
    ; bit itu menggerakkan speaker langsung
```

Apa pun yang kebetulan tertulis di ROM dipakai sebagai sumber derau.
**Nol biaya penyimpanan, nol kode pembangkit.**

**Pelajarannya:** "acak" tidak selalu perlu pembangkit acak. Kadang kamu
sudah punya data tak beraturan di tangan.

### 2.4 Memilih lima yang salah supaya sisanya benar

Babak bonus harus memilih satu kaleng yang benar dari enam. Cara yang
dipakai justru terbalik:

1. `CS:2466` menandai **lima** bit acak yang berbeda di sebuah byte
2. `CS:2603` memutar byte itu mencari **satu bit yang masih kosong**
3. hitungan posisinya **ditimpakan ke byte yang sama**, kini jadi indeks
   jawaban

**Kenapa terbalik justru lebih baik:** kalau kamu mengundi pemenang
langsung, kamu masih harus memastikan lima pengecoh berbeda darinya —
butuh loop ulang. Dengan cara ini, **persis satu jawaban benar dijamin
oleh konstruksi**.

> **Latihan:** Ini pola umum bernama *complement selection*. Di mana lagi
> memilih "yang tidak" lebih murah daripada memilih "yang ya"?

### 2.5 Perintah yang menumpang di dalam teks

String UI bukan sekadar teks:

| byte | arti |
|---|---|
| `0x00` | akhir string |
| `0x01`–`0x07` | ganti warna, lanjut |
| `0xFF` | **word berikutnya** adalah posisi kursor |
| lainnya | cetak |

Warna dan posisi ikut mengalir di dalam teks, sehingga hampir tidak ada
pemanggil yang perlu menyetel kursor sendiri.

Ini nenek moyang langsung dari **ANSI escape code**, **markdown**, dan
**rich text** — data dan perintah dalam satu aliran.

Ada jebakan yang menyertainya, dan kami terjebak: urutan `FF 10 14` di
dalam string terbaca disassembler sebagai instruksi `call`. Selama
berminggu-minggu itu tercatat sebagai "empat situs misterius yang tak
pernah tereksekusi".

---

## Bagian 3 — Keputusan desain yang layak ditiru

### 3.1 Loop dibuka penuh hanya di jalur panas

Rutin yang sama muncul dua kali dengan bentuk berbeda:

- `erase_entity_16x16` (`CS:11BA`) — **dibuka penuh**, 16 baris ditulis
  lurus, `0x94` byte kode. Jalan **tiap frame**.
- `restore_16x16_background` (`CS:2169`) — bentuk sama, **tetap loop**.
  Jalan hanya di jalur kematian.

Programmer ini tidak membuka semua loop. Ia membuka yang panas saja, dan
membayar ukuran kode hanya di tempat yang menghasilkan.

**Pelajarannya:** optimasi adalah *trade*, dan trade hanya masuk akal di
tempat yang ramai. Ukur dulu, baru buka.

### 3.2 Figur besar dari blitter kecil

Ada tujuh blitter: 8x8, 12x16, 16x12, 16x16, 24x22, 32x16, 32x22.
Pemainnya berukuran 32x32 — dan **tidak ada blitter 32x32**.

Pemain dirakit dari **dua sprite 32x16 bertumpuk**, dengan indeks paruh
bawah selalu paruh atas + 2.

**Pelajarannya:** komposisi mengalahkan penambahan kasus. Menambah
blitter kedelapan berarti menambah kode; menyusun dua yang sudah ada
tidak.

### 3.3 Aturan yang konsisten tanpa dipaksakan

Di ketujuh blitter, **displacement mask selalu sama dengan ukuran data**:

| blitter | mask | hitungan |
|---|---|---|
| 8x8 | `0x10` | 2 × 8 |
| 16x16 | `0x40` | 4 × 16 |
| 12x16 | `0x30` | 3 × 16 |
| 32x16 | `0x80` | 8 × 16 |
| 24x22 | `0x84` | 6 × 22 |
| 32x22 | `0xB0` | 8 × 22 |

Dan langkah barisnya **selalu `0x50`** — satu scanline — tanpa
pengecualian.

Tidak ada mekanisme yang memaksakan konsistensi ini. Ia dipelihara oleh
disiplin. Dan justru karena konsisten, aturannya bisa **ditemukan**
puluhan tahun kemudian dan dipakai untuk membaca data yang tidak
berlabel.

**Pelajarannya:** konsistensi bukan estetika. Ia membuat sistemmu bisa
dipahami oleh orang yang tidak pernah bicara denganmu — termasuk dirimu
enam bulan lagi.

### 3.4 Satu byte, dua peran — dan kenapa itu berisiko

Byte di `0x4528` hidup dua kali: mula-mula bitmap "lima sudah terpilih",
lalu **ditimpa** oleh indeks jawaban.

Itu hemat memori dan sah. Tapi ia juga menyebabkan salah satu kesalahan
penamaan kami: byte itu dinamai `picked_bitmap` dari fase pertamanya, dan
nama itu salah separuh hidupnya.

**Pelajarannya:** *variable reuse* punya ongkos yang tidak terlihat di
runtime — ongkosnya dibayar oleh pembaca. Di 1984 dengan RAM 64 KB itu
trade yang benar. Hari ini hampir tidak pernah.

---

## Bagian 4 — Yang membuat program ini bisa dibaca ulang

Beberapa sifat yang membuat rekonstruksi ini mungkin — dan yang layak
kamu tiru di kodemu sendiri:

1. **Tabel bersebelahan dengan yang memakainya.** Batas bar, arah bar,
   dan posisi sprite bar semuanya sejajar, diindeks dengan variabel yang
   sama. Kedekatan itu memungkinkan kami menyimpulkan struktur dari
   alamat.
2. **Ukuran record tetap.** Semua entitas 16 byte. Semua node gelas 8
   byte. Semua blok simpanan pemain 15 byte. Aritmetika alamat jadi
   bukti.
3. **Konstanta yang bermakna.** `0x50` selalu satu scanline. `0x2000`
   selalu pergantian bank. `0x10` selalu satu record entitas. Angka yang
   sama selalu berarti hal yang sama.
4. **Tidak ada kode yang memodifikasi dirinya.** Program ini tidak
   menulis ke wilayah kodenya sendiri. Itu bukan keharusan di era itu,
   dan ketiadaannya membuat pembacaan statis dapat dipercaya.

---

## Bagian 5 — Latihan

Kalau kamu mau benar-benar belajar dari ini, bukan sekadar membaca:

1. **Hitung sendiri.** Buka `src/tapper.asm` di `CS:1CEE` dan turunkan
   rumus posisi bar. Cocokkan dengan `screens/frame_play.png`.
2. **Tulis ulang LFSR-nya** di bahasamu, lalu ukur berapa instruksi yang
   dibutuhkan versi XOR biasa. Bandingkan.
3. **Implementasikan "beri nyawa tiap N poin"** tanpa perbandingan.
4. **Cari satu tempat di kodemu sendiri** yang menyimpan keadaan turunan
   yang sebenarnya bisa ditanyakan. Hapus. Lihat apakah ada bug yang
   ikut hilang.
5. **Ambil satu aturan** yang kodemu patuhi secara diam-diam. Tulis di
   dokumentasi. Itu yang membuat kode Tapper bisa dibaca 40 tahun
   kemudian.

---

## Bagian 6 — Pelajaran dari proses membacanya

Bukan tentang kodenya, tapi tentang bagaimana memahaminya. Ini terangkum
dari `DECISIONS.md`, yang mencatat **setiap klaim yang pernah salah**
selama proyek ini.

**Kesimpulan dari satu sumber hampir selalu perlu dikoreksi.** Tanpa
kecuali. Yang bertahan adalah yang punya dua sumber bebas.

Bentuk kesalahannya berulang:

| pola | contoh |
|---|---|
| Dinamai dari efeknya, bukan penulisnya | `slow_machine_flag` → `is_pcjr`, arahnya terbalik |
| Dinamai dari beberapa baris pertama | `erase_bar_list_a` ternyata bisa membunuh pemain |
| Ketiadaan hasil = ketiadaan fakta | `CS:4690` "tak terjangkau", ternyata jalan tiap startup |
| Keluaran ada = keluaran benar | `sprites.png` separuh salah selama berhari-hari |
| Klaim membusuk diam-diam | "enam blitter" bertahan di lima berkas setelah dikoreksi jadi tujuh |

Dan satu yang tidak terduga: **beberapa temuan datang dari orang yang
memandangi gambarnya lebih lama**, bukan dari membaca kode. Sprite
"bartender dilempar ke atas meja" teridentifikasi begitu — dan baru
setelah itu kodenya diperiksa dan membenarkan, sampai ke detail bahwa ia
diberi kecepatan supaya meluncur.

Untuk **struktur**, kode menang. Untuk **makna gambar**, mata menang.
