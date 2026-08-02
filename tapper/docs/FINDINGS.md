# Tapper (DOS) — catatan reverse engineering

Status: format data terpecahkan seluruhnya dan terverifikasi dari kode —
container `TAPPER.PIC` dan `TAPPER.DAT`, direktori aset, ketujuh varian sprite,
serta struktur entitas dan node objek dinamis. Source hasil rekonstruksi
di-assemble ulang menjadi binary byte-identik.

Empat layar bar dibongkar langsung dari `TAPPER.DAT` oleh
`tools/decode_screen.py`, tanpa emulator — hasilnya di `screens/`. Yang tersisa
adalah katalog **sprite** (bukan layar), dan membawa mode tampilan 0 melewati
attract loop.

## File

| File | Ukuran | Status |
|---|---|---|
| `TAPPER.COM` | 17.920 B | COM murni (ORG 100h), tidak dipacked. **Sudah di-crack/dimodifikasi** |
| `TAPPER.DAT` | 92.160 B | Image floppy mentah — **terpecahkan** |
| `TAPPER.PIC` | 16.384 B | Satu halaman CGA mentah — **terpecahkan** |

## TAPPER.PIC — selesai

Bukan format berstruktur. Kode di `CS:4680` membukanya, men-set `DS = 0xB800`
(video RAM CGA), lalu `read()` 0x4000 byte **langsung ke `B800:0000`** dan tutup.

Jadi isinya persis layout hardware CGA:

- 320×200, 2 bit/pixel, 4 warna, palette 1 high-intensity (hitam/cyan/magenta/putih)
- 80 byte per scanline, 4 pixel per byte, MSB dulu
- Bank interleave: baris genap di `0x0000`, baris ganjil di `0x2000`
- 192 byte padding tak terpakai di ekor tiap bank

Decoder: `tools/cga.py` + `tools/dump_pic.py` → `out/pic_320x200_pal1.png`.

Isinya adalah layar intro grup crack, bukan title screen asli.

## TAPPER.DAT — container terpecahkan

Game asli membaca **sektor floppy fisik** lewat BIOS INT 13h. Crack mengganti
itu dengan emulasi berbasis file:

1. `CS:064F` memasang vektor **INT 80h** → handler di `CS:0135`
   (`mov di,0x200` dengan `ES=0`, yaitu slot IVT 0x80×4).
2. Handler di `CS:0135` memakai konvensi register INT 13h AH=02h persis:
   `AL`=jumlah sektor, `CH`=track, `CL`=sektor, `ES:BX`=buffer tujuan.
3. Terjemahannya (`CS:0139`–`CS:0159`):

```
offset = ((CH - 5) * 9 + (CL - 1)) * 512
count  = AL * 512
```

lalu `LSEEK` (INT 21h AH=42h) + `READ` (AH=3Fh), diakhiri **`IRET`**.

Maka geometrinya:

- Sektor 512 byte, **9 sektor per track**, track dimulai dari **5**
- 92.160 / 512 = **180 sektor** = **20 track** (track 5–24)
- Drive di-hardcode `DL=1` (B:), `DH=0` (head 0) di call site

Pemanggilnya (satu-satunya, di `CS:0515`) mengalamati aset dengan
**logical sector number** dari sebuah tabel, bukan CHS langsung:

```
LSN     = [SI]
track   = LSN / 9 + 2
sector  = LSN % 9 + 1
count   = ceil(byte_count / 512), di-clamp agar tidak lintas track
```

Clamp itu warisan batasan floppy: satu perintah baca tidak boleh melewati
batas track.

### Catatan

2560 byte pertama `TAPPER.DAT` identik dengan ekor `TAPPER.COM` di offset file
`0x3B80` (alamat memori `CS:3C80`). Itu hanya 5 sektor pertama track 5 yang
ikut dibakukan ke dalam executable. Angka "record 2560 byte" bukan struktur
file — kebetulan 92160 habis dibagi 2560.

### Peta isi (dari statistik byte, `tools/probe_dat.py`)

- Track 5 sektor 1–3: tabel teks/menu (string UI, tutorial, pesan error)
- Track 5 sektor 4 – track 23: data grafis
- Track 24 sektor 3–9: filler `0xCD`

## Blitter sprite — terpecahkan dari kode yang dieksekusi

Ditemukan lewat emulasi (`tools/emu8086.py` + `tools/trace.py`), bukan analisis
statis. Rutin di `CS:2CE0`, inner loop `CS:2CFF`:

```
2CFF  mov cx, 8          ; 8 baris per bank CGA
2D02  mov dl, 4          ; 4 word = 8 byte = 32 pixel per baris
2D04  mov ax, [di]       ; baca tujuan
2D06  and ax, [bp+0x80]  ; AND dengan mask, 128 byte setelah data
2D0A  or  ax, [bp]       ; OR dengan data
2D0D  stosw
2D14  add di, 0x48       ; 72 + 8 dari stosw = 80 = satu scanline
```

Pemanggil menjalankannya dua kali dengan `xor di, 0x2000` di antaranya, satu
per bank CGA.

| Properti | Nilai |
|---|---|
| Ukuran sprite | 32 x 16 pixel |
| Per baris | 4 word = 8 byte |
| Data | 128 byte, bank-interleaved |
| Mask | 128 byte, di offset `+0x80` |
| Operasi | `tujuan = (tujuan AND mask) OR data` |

**Ini satu dari tujuh varian**, bukan satu-satunya ukuran sprite. Rutin di
`CS:2CFF` ini yang pertama ditemukan; lima lainnya beserta aturan umumnya —
offset mask selalu sama dengan ukuran data — ada di bagian
[Katalog sprite](#katalog-sprite) di bawah.

### Mask bersifat per-bit, bukan per-pixel

Diverifikasi numerik terhadap data yang benar-benar mengalir di blitter: pada
dua sprite yang tertangkap, 59,4% dan 22,3% pasangan pixel melanggar invarian
mask 2bpp standar (mask harus `00` atau `11`; bila `11` maka data harus `0`).

Artinya AND/OR bekerja di level bit, bukan level pixel. Konsekuensinya:
**tampilan sprite bergantung pada isi tujuan di bawahnya**, sehingga sprite
tidak bisa dirender berdiri sendiri tanpa konteks latar.

### Rendering dua tahap

`ES` selama blit bernilai `0x23DB`, bukan `0xB800`. Game menyusun gambar di
**back buffer** RAM, lalu menyalinnya ke video memory lewat rutin
tersinkron-retrace di `CS:1ED5`/`CS:1EE3` (`repne movsw`, 40 word = 1 scanline,
`xor si, 0x2000` untuk pindah bank).

## Arsitektur interrupt (dari runtime)

Game memasang tiga vektor:

| Vektor | Handler | Dipasang di | Fungsi |
|---|---|---|---|
| `INT 09h` | `1000:33A5` | `CS:06C9` | keyboard IRQ1, mengisi ring buffer 16 byte di `0x35AF` |
| `INT 1Ch` | `1000:3758` | `CS:06E5` | timer tick |
| `INT 80h` | `1000:0135` | `CS:0659` | shim disk (crack) |

Ring buffer keyboard: head di `0x35AB`, tail di `0x35AD`, data di `0x35AF`,
wrap 16 entri (`and di, 0xf`). Loop tunggu ada di `CS:2F71`.

Game berjalan dengan interrupt ter-mask hampir sepanjang waktu dan hanya
sesekali membuka jendela `sti`.

## `indirect_call_vector` — terpecahkan

`select_display_mode` (`CS:0747`) memilih dua set nilai berdasarkan satu flag:

| | `AL == 0` | `AL != 0` |
|---|---|---|
| `display_mode` (`0x44BD`) | `0xFF` | `0` |
| `screen_script_ptr` | `0x3C18` | `0x3C12` |
| `0x4497` | `0x3C28` | `0x3C21` |
| `indirect_call_vector` | `0x2F22` | `0x2F0F` |

Baris terakhir menyelesaikan `indirect_call_vector` (`0x4499`), tempat
`call word ptr cs:[0x4499]` di `CS:0CD3` dan `CS:2EEE` menuju: isinya **hanya
pernah** `display_variant_a` atau `display_variant_b`.

`display_mode` juga dibaca `mode_attract_step` untuk menutup satu bit di
`screen_config`. Digabung dengan prompt `R`/`C` di awal permainan, ini pilihan
RGB versus composite.

### Skrip layar

Skripnya stream byte, maju satu byte per layar lewat `inc si`, berakhir saat
`si == 0x3C13`. Tiap byte adalah indeks aset yang diteruskan ke
`load_asset_from_stream` oleh `load_and_show_screen`, yang lalu membaca
`screen_config` dari word di offset `0x4000` data aset tersebut.

## Kenapa sweep statistik gagal

Sebelum blitter dibaca, saya mencoba menemukan layout sprite lewat sweep stride
otomatis (`tools/find_stride.py`, `tools/sweep_layout.py`). Hasilnya gagal —
skor tertinggi hanya ~0,3–0,4 dan seri antara 40/80.

Kegagalan itu ternyata **informatif, bukan sekadar buntu**: tidak adanya stride
global memang jawaban yang benar, karena track berisi sprite bank dengan enam
ukuran berbeda, bukan raster tunggal. Yang menyelesaikannya adalah membaca kode
blitter, bukan statistik yang lebih baik.

Pengecualian yang sempat membingungkan: track 5 sektor 4–8 **memang** terbaca
sebagai raster stride-80 dan merender logo "Tapper"
(`out/dat/rec02_w320.png`) — sebagian aset betulan full-width 320px.

## Yang belum terpecahkan

**Kepemilikan entri tabel sprite.** Peta pemakai aset sudah lengkap dan layar
bar sudah ter-decode; yang tersisa adalah entri mana milik aktor mana. Mekanisme
menurunkannya sudah ada di `tools/sprite_sheet.py`, tapi run terpanjang baru
menyentuh awal satu ronde sehingga baru tiga indeks yang teramati. Lihat
[Katalog sprite dan kepemilikan entri](#katalog-sprite-dan-kepemilikan-entri).

**Empat site `call word ptr [bx+si]` — ternyata bukan kode sama sekali.**
`3BAC`, `3E26`, `3E78`, `3EC9` tidak pernah tereksekusi karena tidak ada yang
bisa mengeksekusinya: keempatnya **data yang salah dibaca sebagai instruksi**.

Byte-nya `FF 10`, dan tiga di antaranya berada di tengah string:

```
3E20  "...TON TO" FF 10 14 "OPEN CAN" 00
3E72  "...BAR TO" FF 10 14 "OPEN CAN" 00
3EC3  "      "    FF 10 14 "        " 00
```

`0xFF` adalah kode kontrol `print_string`: **word berikutnya posisi kursor**.
`FF 10 14` berarti "pindahkan kursor ke baris 20, kolom 16", bukan
`call word ptr [bx+si]`.

Yang keempat, `0x3BAC`, adalah awal tabel data — `CS:3B43` memuatnya dengan
`mov si, 0x3BAC` lalu membacanya dengan `lodsb` berpasangan, setelah menyetel
`ES = 0xF000` dan menulis port `0x61`. Itu data suara, bukan entry kode.

Jadi item ini gugur sebagai artefak disassembly. `indirect_call_vector` dan
kedua jump table memang satu-satunya kontrol tak langsung yang nyata, dan
ketiganya sudah terselesaikan.

**Ekor panjang penamaan — sudah habis.** Bagian ini dulu mencatat bahwa
sebagian besar label masih generik: kode alur tanpa penanda struktural, yang
hanya bisa dibaca berurutan. Ekor itu dituntaskan dalam 21 siklus; **nol label
generik tersisa**, dan setiap nama diberikan setelah rutinnya dibaca sampai
`ret`. Lihat [PROGRESS.md](PROGRESS.md).

### Tracing pasif sudah mentok

Menaikkan batas instruksi tidak lagi membeli cakupan. Perbandingan langsung:

| | 12M instruksi | 40M instruksi |
|---|---|---|
| Alamat kode berbeda tereksekusi | 2.340 | 2.396 |
| Setup ronde (`CS:0FA3`) | 3 | 5 |
| Kenaikan penghitung ronde (`CS:0D7A`) | 1 | 1 |
| Kematian (`CS:13DA`) | 3 | 5 |
| Bonus bar-bersih (`CS:1F8A`) | 0 | 0 |
| Popup tip terpicu (`CS:1DA9`) | 0 | 0 |
| Kalibrasi joystick (`CS:31A3`) | 0 | 0 |
| Pembungkusan halaman (`CS:0C19`) | 0 | 0 |

Instruksi 3,3× lipat hanya menambah **56 alamat** (2,4%) dan **nol subsistem
baru**. Sebabnya jelas dari angkanya: emulator memainkan game dengan buruk — ia
mati lima kali, tidak pernah membersihkan bar, tidak pernah memungut tip, dan
penghitung ronde hanya naik sekali. `collect_pickup` sendiri jalan 2.677 kali
tapi tidak pernah menemukan apa pun untuk dipungut.

Artinya, empat aset yang belum terlihat dan empat site `call word ptr [bx+si]`
tidak akan muncul dari trace yang lebih panjang. Yang dibutuhkan adalah
**menyuntik state**, bukan menunggu — dan sekarang variabel yang menentukannya
(`page_index`, `round_param_index`, `abort_sequence_flag`, `pickup_ptr`) sudah
bernama dan beralamat pasti.

### Suntikan state — apa yang dibuka, dan batas klaimnya

`tools/inject_state.py` menulis variabel progres langsung di titik eksekusi
tertentu, lalu mencatat aset yang diminta dan alamat yang tercapai. **Semua
temuan di bawah berlaku "di bawah state paksaan"** — lebih lemah daripada "game
melakukan ini", dan sengaja tidak dinaikkan derajatnya.

**Suntikan halaman memvalidasi peta id-layar → aset.** Prediksi dari tabel
dikonfirmasi dua kali oleh emulator:

| Suntikan | id layar | `screen_aux_mode1[id]` | Aset diminta |
|---|---|---|---|
| `page_index = 7` | 3 | `0x0F` | **15** ✓ |
| `page_index = 12` | 4 | `0x11` | **17** ✓ |

Keduanya di luar 15 entri direktori. Direktori itu sendiri kini terkonfirmasi
dari sisi data: pola LSN menaik (0, 32, 37, 51, … 188) **putus tepat di entri
15**, dan entri 17 di `0x5F5` terbaca sebagai LSN 53390 panjang 65468 — mustahil
untuk image 180 sektor.

Screenshot dari kedua run menutup argumennya secara visual, dan bedanya justru
memperjelas:

| Run | "Entri" direktori | Layar |
|---|---|---|
| `page:12` → aset 17 | LSN 53390, panjang 65468 | **hitam** — pembacaan jauh di luar berkas tidak menghasilkan apa pun |
| `page:7` → aset 15 | LSN 184, panjang 36480 | **derau** — ada byte yang terbaca, hanya saja bukan gambar |

Di keduanya sprite pelanggan tetap tergambar di atas latar yang gagal itu.
Permintaan aset yang tidak bisa dijawab direktori menghasilkan layar rusak,
bukan crash.

Aset 11, 13, 14 tetap tidak muncul, dan sebabnya jelas sekarang: ketiganya ada
di `screen_aux_mode0`, tabel **mode tampilan yang lain**.

**Suntikan mode tampilan: dua jalur render, bukan sekadar palet.** `CS:0732`
adalah `cmp al, 0`, percabangan mode itu, dan emulator selalu tiba dengan
`AL = 0`. Memaksa `AL` non-nol di situ — mengubah **input** percabangan, bukan
menulis keempat variabel keluarannya dengan tangan — membuka mode 0:

| | mode 1 (`AL = 0`) | mode 0 (`AL ≠ 0`) |
|---|---|---|
| Skrip layar | 9 entri, aset 2…10 | 6 entri, aset 2…7 |
| `CS:2EEE` lewat `indirect_call_vector` | tak pernah tercapai | **16.704 panggilan** dalam 6M instruksi, ke `display_variant_a` |

Jadi perbedaannya bukan palet, melainkan **jalur render yang berbeda**.
Transform per-byte di mode 0 begitu mahal sehingga anggaran instruksi yang sama
membawa game jauh lebih pendek — penting diketahui sebelum menyimpulkan apa pun
dari trace mode 0 yang singkat.

Mode 0 juga merender **title screen game-nya sendiri**: layar Bally Midway 1983
dengan `HIGH SCORE` di atasnya (`out/inject_mode0.png`). Yang diganti crack
adalah gambar startup, bukan ini — art title aslinya masih ada dan masih
digambar.

#### Pilihan modenya sendiri sudah dirusak crack

Melacak `AL` di `CS:0732` ke belakang menghasilkan sesuatu yang tidak enak:

```
0656  mov ax, cs        ; untuk memasang vektor INT 80h
0659  jmp short 0680    ; melompati 19 byte NOP di 065B
...                     ; tidak ada yang menyentuh AX
06A3  push ax
0731  pop ax
0732  cmp al, 0         ; <- byte rendah segmen muat
```

Jadi **mode tampilan ditentukan byte rendah segmen tempat DOS memuat program**,
bukan oleh pilihan siapa pun.

Prompt yang seharusnya menentukannya masih ada di data —
`'PRESS "R" FOR RGB DISPLAY'` di `0x3C37` dan pasangan composite-nya di
`0x3C53` — tapi menyisir **seluruh image** untuk pointer ke prefiks kursornya di
`0x3C30` tidak menemukan apa pun. Tidak ada yang mencetaknya. Dan NOP sled 19
byte di `CS:065B`, yang dilompati `jmp` tambahan crack di `CS:0659`, persis
berada di tempat kode itu seharusnya.

Kedua cabangnya masih berfungsi penuh — memaksa `AL` non-nol merender title
screen asli dengan benar. Yang hilang adalah **yang memilih**. Di emulator
`CS = 0x1000`, jadi `AL` selalu 0 dan hanya satu kolom yang pernah dijalankan;
di DOS sungguhan hasilnya bergantung alamat muat.

**Koreksi.** `README.md`, `BUILD.md`, dan catatan di `tools/trace.py` sama-sama
menyatakan game menanyakan `R` atau `C` di awal. Untuk binary ini **tidak** —
pertanyaannya sudah dibuang. Klaim itu berasal dari menemukan string prompt di
data lalu menganggapnya masih dipakai; tidak ada yang memeriksa perujuknya.

### Peta aset — siapa memakai yang mana

Item "katalog sprite belum lengkap" ternyata dua pertanyaan yang tercampur, dan
hanya satu yang tertutup di sini.

**Yang tertutup: peta pemakainya.** Siapa meminta aset nomor berapa, di mode
apa, kini terbaca penuh dari tabel statis — tanpa emulator sama sekali:

| Aset | Dipakai oleh | Lewat |
|---|---|---|
| 0 | tidak ada | LSN 0, di bawah awal data (LSN 27) — slot kosong |
| 1 | tabel sprite, dimuat sekali saat init | `CS:077F`, `sprite_table_default` |
| 2–7 | layar skrip, kedua mode | `screen_script_mode0` (6 entri) |
| 8–10 | layar skrip, hanya mode 1 | `screen_script_mode1` (9 entri) |
| 8–14 | layar bar | `screen_aux_mode0`, id 0…6 → 8, 9, 10, 11, 13, 14, 12 |
| 15, 16, 17, 19 | **tidak ada** — di luar direktori | `screen_aux_mode1`, id 3…6 |

Jadi di mode 0 setiap entri direktori punya peran, dan tidak ada nomor yang
tersisa tak terjelaskan. Yang menganga justru mode 1: empat id layarnya menunjuk
ke luar direktori 15 entri, dan dua di antaranya sudah dikonfirmasi lewat
suntikan menghasilkan layar rusak.

Aset 0 layak dicatat sendiri: LSN-nya 0, sedangkan rumus offset handler INT 80h
adalah `(LSN − 27) × 512`, jadi entri itu tidak bisa dibaca sama sekali. Ia bukan
aset yang belum ditemukan, melainkan slot yang memang tidak dipakai.

**Isi layar bar: terpecahkan — aset layar itu terkompresi RLE.**
`out/assets_png/` memang memuat aset 1–14, tapi itu dump mentah, dan itulah
sebabnya deraunya: aset 9 hanya 6.419 byte sedangkan satu halaman CGA butuh
16.384. Tidak ada yang salah dengan ekstraksinya — yang salah membaca byte
terkompresi sebagai pixel.

Dekompresornya `unpack_screen` (`CS:2DB5`), dan formatnya terbaca utuh:

```
si = 0x4012                 ; stream mulai 0x12 byte ke dalam data yang dimuat
al = [0x4001]               ; byte tinggi screen_config
test al, 8                  ; bit 3 kosong -> tersimpan apa adanya
  kosong: mov cx, 0x2000 / repne movsw     ; 16 KB disalin langsung
  set   : satu word per token --
            0x0000    selesai
            0xFFFF    di = 0x2000, pindah ke bank baris ganjil
            n         salin n byte literal
            n|0x8000  baca satu word lagi, isi n & 0x7FFF byte dengan AL
```

`tools/decode_screen.py` menjalankan loop itu persis dan membongkar keempat
layar bar langsung dari `TAPPER.DAT` — **tanpa menjalankan game**. Hasilnya ada
di `screens/`.

Itu sekaligus uji yang cukup langsung terhadap rekonstruksinya: direktori aset,
aritmetika sektor handler INT 80h, dan encoding di atas semuanya berasal dari
source hasil pemulihan. Salah di salah satunya akan langsung terlihat sebagai
gambar rusak.

Yang **masih** terbuka adalah katalog sprite (bukan layar): track-track sprite
bank dengan tujuh ukuran berbeda, dengan mask per-bit yang membuat sprite tidak
bisa dirender berdiri sendiri tanpa latar. Lihat
[Kenapa sweep statistik gagal](#kenapa-sweep-statistik-gagal).

**Suntikan `abort_sequence_flag` membuktikan cabang matinya kode hidup.** Set
flag itu ke 1 langsung membawa eksekusi ke `CS:1F8A`: bonus bar-bersih dijalankan
(`add_score` dengan `DX = 0x1000`) dan penghitung ronde maju — dua kali dalam
run itu, padahal tiap run lain hanya sekali. 38 alamat baru tercapai:

| Wilayah | Alamat |
|---|---|
| blok bonus bar-bersih | `1F8A`–`1FB9` |
| `add_score` | `3150`–`3176` |
| `loc_0BE3` | `0BE3`–`0BE5` |

**Efek samping yang lebih penting dari temuannya sendiri:** run pertama berhenti
di `unimplemented opcode 27h` — `DAA`, di dalam `add_score`. Emulator memang
sengaja tidak mengimplementasikannya, dengan komentar bahwa opcode BCD "tidak
dipakai jalur kode nyata di program ini". Itu salah. Skor disimpan BCD, jadi
**seluruh jalur penambahan skor tidak pernah sekali pun tereksekusi di
emulator** sampai suntikan ini. `DAA`/`DAS`/`AAA`/`AAS` sekarang terpasang.

Empat site `call word ptr [bx+si]` tetap gelap di kedua eksperimen.

## Direktori aset — terpecahkan

Tabel di `CS:05B1`, 15 entri, 4 byte per entri: `[+0]` logical sector number,
`[+2]` jumlah byte. Loader di `CS:0502` mengindeksnya dengan nomor aset di `AL`:

```
0507  mov ah, 0
0509  shl ax,1 / shl ax,1   ; indeks * 4
050D  add ax, 0x5b1
0512  mov ax, [si+2]        ; jumlah byte
051F  mov ax, [si]          ; LSN
```

Menggabungkan pemetaan loader dengan handler INT 80h menghasilkan identitas
yang bersih:

```
track  = LSN/9 + 2 ,  sector = LSN%9 + 1        (CS:0521-0528)
offset = ((track-5)*9 + sector-1) * 512         (CS:0139-014B)
       = (LSN - 27) * 512
```

### Peta lengkap TAPPER.DAT

| Offset | LSN | Isi |
|---|---|---|
| 0–2559 | 27–31 | Blok teks/string, juga dibakukan di `TAPPER.COM` `CS:3C80` |
| 2560–88478 | 32–199 | 14 aset data, kontigu |
| 88479–92159 | 200–206 | Filler ekor |

| Idx | LSN | Byte | Sektor | Offset |
|---|---|---|---|---|
| 1 | 32 | 2105 | 5 | 2560 |
| 2 | 37 | 7127 | 14 | 5120 |
| 3 | 51 | 5282 | 11 | 12288 |
| 4 | 62 | 8582 | 17 | 17920 |
| 5 | 79 | 3152 | 7 | 26624 |
| 6 | 86 | 4290 | 9 | 30208 |
| 7 | 95 | 2500 | 5 | 34816 |
| 8 | 100 | 6360 | 13 | 37376 |
| 9 | 113 | 6419 | 13 | 44032 |
| 10 | 126 | 7876 | 16 | 50688 |
| 11 | 142 | 8592 | 17 | 58880 |
| 12 | 159 | 8592 | 17 | 67584 |
| 13 | 176 | 5908 | 12 | 76288 |
| 14 | 188 | 6046 | 12 | 82432 |

Entri 0 (LSN 0, 15883 byte) menunjuk di bawah track 5, jadi di luar
`TAPPER.DAT` — itu kode game di track 0–4 floppy asli, yang kini jadi
`TAPPER.COM`.

**Validasi:** untuk setiap aset, LSN + jumlah sektornya (dibulatkan ke atas)
sama persis dengan LSN aset berikutnya — 13 dari 13 cek lolos. Aset menutupi
file secara kontigu tanpa celah. Ini bukti kuat bahwa pembacaan tabelnya benar.

### Isi aset

Aset di-render dengan dua tafsir (`tools/render_assets.py`):

- **Sprite bank 32x16** — menghasilkan sprite karakter yang jelas terkenali
  (figur dalam berbagai pose animasi). Contoh terbaik: aset 4
  (`out/assets_png/asset04_lsn062_8582b_sprites.png`).
- **Raster full-width stride 80** — aset 2 merender logo "Tapper", tampil dua
  kali karena tersimpan per-bank CGA (baris genap lalu baris ganjil).

Ukuran aset tidak habis dibagi 256, jadi tiap aset bukan sprite bank murni —
ada header/tabel di dalamnya yang belum dipetakan.

## Katalog sprite

### Keluarga blitter

Enam varian, semuanya `dst = (dst AND mask) OR data`. Offset mask selalu sama
dengan ukuran data, jadi ia menyatakan geometri sprite secara langsung. Tiap
varian menyesuaikan `add di` agar langkah per baris tepat 80 byte.

| Rutin | Baris/bank | Byte/baris | Mask | Ukuran data |
|---|---|---|---|---|
| `blit_sprite_8x8` | 4 | 2 | `+0x10` | 2×8 = 16 |
| `blit_sprite_12x16` | 8 | 3 | `+0x30` | 3×16 = 48 |
| `blit_sprite_16x16` | 8 | 4 | `+0x40` | 4×16 = 64 |
| `blit_sprite_32x16` | 8 | 8 | `+0x80` | 8×16 = 128 |
| `blit_sprite_24x22` | 11 | 6 | `+0x84` | 6×22 = 132 |
| `blit_sprite_32x22` | 11 | 8 | `+0xB0` | 8×22 = 176 |

Pemanggil menjalankan tiap blitter dua kali dengan `xor di, 0x2000` di antaranya,
satu per bank CGA. `BP` **tidak** direset di antara kedua panggilan, jadi
panggilan kedua terlihat di `base + datasize/2`. Instrumentasi yang tidak
melipat pasangan ini akan menghitung setiap sprite dua kali.

### Struktur aset

Aset yang berisi sprite diawali tabel offset:

```
offset 0 : count (word)
offset 2 : count entri offset 16-bit, relatif terhadap basis tabel
```

**Entri berselang-seling data dan mask.** Jarak antar-entri sama dengan ukuran
data, bukan data+mask — karena mask adalah entri berikutnya. Inilah sebabnya
`lookup_ptr_pair` (`CS:2E1E`) mengambil dua entri berurutan sekaligus, dan
sebabnya blitter bisa membaca mask di `[bp + datasize]`: keduanya bersebelahan.

| Aset | Entri | Jarak | Geometri | Jumlah sprite |
|---|---|---|---|---|
| 3 | 80 | 64 | 16×16 | 40 |
| 4 | 66 | 128 | 32×16 | 33 |
| 5 | 7 | 448 | 32×16 (campuran) | — |
| 6 | 32 | 132 | 24×22 | 16 |
| 7 | 25 | campuran | 8×8, 12×16, 16×16, 32×22 | — |

Sembilan aset lain tidak diawali tabel dalam bentuk ini — kemungkinan latar
raster full-width atau format lain yang belum dipetakan.

### Validasi silang

Dua metode independen sepakat: analisis header statis memprediksi sprite pertama
asset 3 di offset 162 dan asset 5 di offset 16; observasi runtime menemukan
keduanya persis di sana.

### Alamat muat

Aset dimuat ke alamat tetap, tapi **beberapa aset berbagi alamat** — asset 2 dan
asset 12 sama-sama dimuat ke `0x4000`. Jadi atribusi sprite berdasarkan alamat
saja bersifat ambigu terhadap waktu; perlu memperhatikan aset mana yang sedang
aktif.

## Logika game

### Skor — BCD 6 digit

`add_score` (`CS:3150`, 5 call site) menambahkan `DX` ke skor pemain aktif.
Skor disimpan sebagai 6 digit BCD di tiga byte, byte rendah lebih dulu:

| Alamat | Isi |
|---|---|
| `0x44C8` | `score_bcd_hi` |
| `0x44C9` | `score_bcd_mid` |
| `0x44CA` | `score_bcd_lo` |

`DX` membawa nilai poin dalam bentuk BCD juga, sehingga tiap byte ditambahkan
lalu dikoreksi dengan `daa`.

Poin yang teridentifikasi di call site-nya:

| Call site | `DX` | Peristiwa |
|---|---|---|
| `1F90` | `0x1000` | 1000 poin |
| `29B2` | `0x3000` | 3000 poin — ronde bonus, cocok dengan string `"Congratulations!"` / `"3000 Points"` |
| `13D0` | `0x0150` | 150 poin, bersyarat |

### Nyawa dan bonus

Begitu skor melewati `next_bonus_score` (`0x44D5`), `lives` (`0x44D0`)
bertambah satu dengan **batas 9**, lalu ambangnya maju — sebesar 1, atau 6 bila
flag `0x448D` kosong.

### Dua pemain

`draw_score_display` (`CS:2FFB`) mengungkap skor simpanan per pemain di
`p1_saved_score` (`0x44D7`) dan `p2_saved_score` (`0x44E6`), dipilih lewat
`two_player_flag` (`0x448C`) dan `current_player` (`0x44C0`) — yang digambar
adalah skor pemain yang **sedang tidak** bermain. Skor yang sedang aktif selalu
berada di `score_bcd_hi`. Keduanya adalah field `+1` di dalam blok progres
15 byte; lihat [Blok progres pemain](#blok-progres-pemain--15-byte-satu-aktif-dan-dua-slot-simpanan).

### Blitter ketujuh, ditemukan lewat penamaan label

Dokumentasi ini enam kali menyebut "enam varian blitter". Ada **tujuh**.

`blit_sprite_16x12` (`CS:3136`) tidak pernah masuk daftar karena ia hanya
dipanggil dari penggambaran baris status, dan daftar blitter di
`tools/sprite_catalog.py` tidak pernah mencakup jalur itu:

```
mov cx, 6            ; 6 baris per bank CGA
mov dl, 2            ; 2 word = 4 byte = 16 pixel per baris
and ax, [bp+0x30]    ; mask 0x30 byte setelah data
or  ax, [bp]
add di, 0x4C         ; 0x4C + 4 dari stosw = 80, satu scanline
```

Data `0x30` byte untuk kedua bank, mask `0x30` lagi — mengikuti aturan yang sama
dengan enam lainnya: **offset mask sama dengan ukuran data**.

Yang menggambarnya `draw_score_and_lives` (`CS:30D7`), dan rutin itu sendiri
menjelaskan satu hal lagi: ia membaca `[si+8]` sebagai nyawa (dibatasi 5) dan
`[si+6]` sebagai `score_column`, keduanya field blok pemain. Jadi satu panggilan
per pemain menghasilkan dua pasang skor-dan-ikon berdampingan di baris status.

Temuan ini murni hasil kerja penamaan: label `sub_3136` tidak menarik perhatian
sampai rutin di sekitarnya dibaca untuk diberi nama.

### Skor digambar ulang per digit, bukan seluruhnya

`redraw_changed_digits` (`CS:3055`) tidak menggambar ulang seluruh skor. Ia
membandingkan tiap digit BCD dengan **salinan bayangan** tiga byte di
belakangnya, dan hanya memanggil penggambar untuk digit yang berbeda:

```
mov al, [cs:si]          ; digit sekarang
mov ah, [cs:si + 3]      ; digit yang terakhir digambar
shr al, cl / shr ah, cl
and al, 0xf / and ah, 0xf
cmp al, ah
je  lewati               ; sama -> tidak digambar ulang
call suppress_leading_zeros
```

Setelah keenam digit selesai, `score_shadow_update` (`CS:309D`) menyalin skor
sekarang ke bayangannya untuk perbandingan berikutnya. Bayangannya di
`score_shadow` (`0x44CB`) dan `score_shadow_lo` (`0x44CD`) — tepat tiga byte
setelah `score_bcd_hi`, yang menjelaskan `[si + 3]` di atas.

Optimasi ini masuk akal untuk CGA: menulis ulang digit yang tidak berubah
berarti membakar siklus di jalur yang berjalan tiap kali skor bertambah.

### Semua tick di program ini adalah 1/60 detik

`CS:08BA` memprogram ulang PIT kanal 0 dengan pembagi `0x4DAE`. Pada
masukan 1193182 Hz itu **60,0 Hz** — bukan 18,2 Hz bawaan BIOS.

Konsekuensinya berlaku di seluruh berkas: setiap penghitung tick di sini
bersatuan seperenam puluh detik, dan `tick_countdown` mencapai 60 berarti
tepat satu detik. Angka-angka seperti `popup_tick_divider = 0x10` jadi
bisa dibaca sebagai waktu nyata (16/60 ≈ 0,27 detik).

### Modulo ditulis sebagai pengurangan berulang

`tick_drink_timer` (`CS:1641`) menentukan berapa lama pelanggan minum.
Nilai muat dasarnya 2 (1 di PCjr), lalu **digandakan** bila satu syarat
terpenuhi — dan syarat itu diuji tanpa `DIV`:

```
    al = (sprite_base & 0x7F) + 9
1:  al -= 0x14
    jl  selesai          ; lewat nol, bukan kelipatan
    jne 1b               ; masih positif, ulangi
    shl ah, 1            ; mendarat tepat di nol -> kelipatan 20
```

Jadi sprite tertentu minum dua kali lebih lama, dipilih lewat aritmetika
atas indeks sprite-nya sendiri, bukan lewat flag.

Saat penghitung habis, `finish_drink` menghapus bit 1 state — overlay 8x8
berhenti digambar, gelasnya lepas dari tangan. Ini pasangan tepat dari
`entity_enter_carry`.

### Intro grup crack, dan ia berjalan setiap kali

Region `CS:4690` sempat saya catat sebagai perkakas pengembang yang tidak
terjangkau. **Itu salah.** Entry point-nya sendiri yang membantah:

```
0100  EB 0E        jmp short 0110   (melompati "Tapper.Dat")
0110  E9 6D 45     jmp near 4680    <- crack_entry_patch
4680  EB 0E        jmp short 4690   (melompati "Tapper.Pic")
4690  ...          setel mode 4, muat gambar, tunggu tombol
46CA  E9 47 BA     jmp near start   -> 0114, game yang sebenarnya
```

Dua `jmp short` melewati nama berkas inline adalah idiom yang sama, dua
kali: aslinya di `CS:0100` melompati `"Tapper.Dat"`, dan salinan crack di
`CS:4680` melompati `"Tapper.Pic"`. Yang menambal ini meniru gaya rumah.

Isinya membaca `0x4000` byte langsung ke `B800:0000` — frame CGA mentah,
tanpa dekompresi. Itulah sebabnya `DECISIONS.md` mencatat title screen
asli "sudah diganti": ia sebenarnya **tidak diganti di data sama sekali**,
melainkan **didahului** oleh ini.

Kenapa saya salah: saya grep `4690` dan `46A7`, tidak menemukan rujukan,
lalu menyimpulkan tak terjangkau. Pintu masuknya `4680`, dan rantainya
lewat `crack_entry_patch` — label yang **sudah ada di proyek ini sejak
lama**. Petunjuknya ada, saya tidak menelusurinya.

### Nama berkas yang menyamar jadi instruksi

`loc_46F6` bukan kode sama sekali. Byte di `CS:4682` mengeja
`"Tapper.Pic"`, dan `0x70 0x70` — dua huruf **p** — terbaca disassembler
sebagai `jo short 0x46f6`. Labelnya ada semata karena ada "cabang" yang
seolah menargetkannya.

Perangkap yang sama persis dengan empat situs hantu
`call word ptr [bx+si]` di [DECISIONS.md](DECISIONS.md): disassembler
tidak bisa membedakan nama berkas dari instruksi.

### Joystick diukur dengan waktu, dan dua sumbu dihitung dalam satu word

Menulis apa pun ke port `0x201` memicu monostable kartu joystick.
Posisi sumbu adalah **lamanya** tiap bit bertahan tinggi, jadi
`joystick_sample_loop` mencuplik kedua bit, mengisolasinya dengan
`and 1`, lalu menambahkannya ke BX.

Triknya: bit 0 ditaruh di AL dan bit 1 digeser turun ke AH, sehingga satu
`add bx, ax` memajukan **dua pencacah sekaligus** — BL untuk satu sumbu,
BH untuk sumbu lain.

Interupsi dimatikan selama seluruh loop, karena satu tick di tengah
pencuplikan akan terbaca sebagai gerakan.

`joystick_sample_count` yang jadi batas loop diisi kalibrasi dengan
maksimum rentang yang teramati.

### Bertukar pemain = memindahkan 15 byte, dua kali

`save_live_block` menyalin 15 byte keadaan hidup mulai `round_number` ke
slot pemain sekarang, lalu `load_other_block` menyalin slot pemain
satunya kembali ke 15 byte yang sama. Kedua slot berjarak `0x0F`, jadi
**AL sendirian** — nomor pemain — menentukan mana sumber dan mana tujuan
di kedua arah.

Lima belas byte itu seluruh permainan seorang pemain: ronde, indeks
halaman, skor, nyawa, ambang bonus. Bersebelahan memang disengaja, supaya
satu `repne movsb` cukup.

### LFSR yang mengambil bit umpan balik dari flag parity

`advance_rng` adalah LFSR 16-bit, dan cara ia menghitung bit umpan
baliknya rapi sekali:

```
    and ax, 0xd598      ; sisakan hanya bit tap
    jnp short $ + 3     ; parity genap -> CF tetap 0
    stc                 ; parity ganjil -> CF = 1
    rcl [rng_state], 1  ; geser masuk di bawah
```

Meng-XOR empat tap butuh empat instruksi dan satu register cadangan.
`and` plus flag parity 8086 menyelesaikannya dalam dua — karena **parity
memang XOR dari bit-bit yang tersisa**.

Keadaan nol akan menggeser nol selamanya. Itulah sebabnya
`seed_from_bios_clock` menolak hitungan tick nol.

### Aturan mask berlaku di ketujuh blitter

Setelah `blit_sprite_32x16`, `_16x16`, dan `_24x22` terbaca, aturan
"displacement mask = ukuran data" kini terbukti di **semua** blitter:

| blitter | mask | hitungan |
|---|---|---|
| 8x8 | `0x10` | 2 × 8 |
| pickup | `0x18` | 4 × 6 |
| 16x16 | `0x40` | 4 × 16 |
| 12x16 | `0x30` | 3 × 16 |
| 32x16 | `0x80` | 8 × 16 |
| 24x22 | `0x84` | 6 × 22 |
| 32x22 | `0xB0` | 8 × 22 |

Langkah barisnya selalu `0x50` bila `stos` ikut dihitung — satu scanline
CGA di dalam bank, tanpa kecuali.

### Aturan mask terbukti aritmetis di tiga blitter sekaligus

Aturan "displacement mask = ukuran data" sudah lama tercatat. Tiga loop
baris yang dinamai siklus ini membuktikannya dengan angka:

| loop | mask | hitungan |
|---|---|---|
| `blit_8x8_row` | `[bp+0x10]` | 2 byte × 8 baris = `0x10` |
| `blit_pickup_row` | `[bp+0x18]` | 4 byte × 6 baris = `0x18` |
| `blit_12x16_row` | `[bp+0x30]` | 3 byte × 16 baris = `0x30` |

12 piksel itu tiga byte — lebar ganjil untuk mesin word — jadi loopnya
menulis satu word lalu satu byte, dengan BP dimajukan dua kali lalu
sekali agar cocok.

Langkah barisnya selalu `0x50` bila stores ikut dihitung: `0x4D` di sini
ditambah tiga byte yang ditulis, `0x4E` ditambah satu word di tempat
lain. `0x50` = 80 = satu scanline CGA di dalam bank.

### Pemain 32x32 dirakit dari blitter yang tidak punya varian 32x32

`draw_player_32x32` menggambar paruh atas ke kedua bank, lalu memajukan
SI `0x280` dan BP `0x80` dan mengulang untuk paruh bawah. `0x280` = 640
byte = delapan scanline di dalam bank; `0x80` = besar data satu sprite
32x16. Dua konstanta itu melangkahkan layar dan sumbernya serentak.

Pasangannya `erase_player_32x32` menyusuri jalur sama dengan
`copy_32px_unmasked` — latar dikembalikan, tanpa perlu mask.

### Format string: warna dan posisi kursor ikut di dalam teks

`print_string` menguji tiap byte dalam urutan ini:

| byte | arti |
|---|---|
| `0x00` | akhir string |
| `0x01`–`0x07` | setel `text_colour`, lanjut |
| `0xFF` | **word berikutnya** adalah posisi kursor untuk `INT 10h/2` |
| lainnya | cetak lewat `INT 10h/0Eh` dengan warna berjalan |

Inilah arti urutan `FF 10 14` di data yang dulu sempat tercatat sebagai
empat situs `call word ptr [bx+si]` yang "tidak pernah tersentuh" —
disassembler membacanya sebagai instruksi. Lihat tabel koreksi di
[DECISIONS.md](DECISIONS.md).

Karena warna dan posisi ikut menumpang di dalam teks, hampir tidak ada
pemanggil yang perlu menyetel kursor sendiri.

### Gelas di tangan pelanggan: dua baris di bawah, setengah sel di depan

`overlay_offset_table` diisi `0xA0`, atau `0xA0 + 2` saat `bar_direction`
nol. `0xA0` = 160 byte, dan pada 80 byte per scanline itu **dua baris ke
bawah** di dalam bank; tambahan 2 menggeser satu sel 4-piksel ke samping
untuk arah hadap satunya.

Itulah offset yang ditambahkan `draw_entity_loop` di `CS:1E2A` sebelum
blit 8x8 — jadi seluruh geometri gelas di tangan pelanggan ada di satu
konstanta.

### Tiga besaran hadiah, berjarak sekitar sepuluh kali

| kejadian | nilai |
|---|---|
| menangkap gelas kembali | `0x150` |
| menyelesaikan ronde | `0x1000` |
| memungut pickup | `0x1500` |

### Nyawa tambahan lahir dari carry BCD, bukan perbandingan

`check_bonus_life` (`CS:3184`) tidak pernah membandingkan skor dengan
ambang. Skor ditambah dengan `daa`, lalu `next_bonus_score` ditambahkan
di atasnya — dan nyawa tambahan jatuh dari **apakah penjumlahan kedua itu
membawa carry**.

Tidak ada tabel ambang. Tingkat bonusnya dikodekan sebagai *jarak menuju
carry berikutnya*, jadi melewatinya dan mendeteksi pelewatannya adalah
instruksi yang sama.

### Benih acak diambil dari jam BIOS, dan nol ditolak

`seed_from_bios_clock` (`CS:0B28`) memanggil `int 0x1a` lalu mengulang
selama DX nol. Karena hitungan tick hanya melewati nol saat tengah malam,
putaran itu praktis gratis — tapi ia menjamin benihnya tidak pernah nol,
yang penting untuk pembangkit bergaya LFSR yang akan macet di sana.

Di atasnya, blok simpanan pemain 2 diisi langsung: skor nol, **nyawa 5**
(satu lebih banyak daripada pemain 1), bonus 1. Saat `key_capture_mode`
menyala, tiga field itu ditimpa `0xFF` — begitulah demo attract menandai
konteks yang bukan pemain sungguhan.

### "GAME OVER" itu per pemain, bukan per permainan

`show_game_over` bukan akhir. Setelah pesannya tampil, `two_player_flag`
yang menentukan: di permainan satu pemain kontrol langsung kembali ke
attract, tapi di dua pemain `swap_player_context` bertukar dulu ke blok
simpanan pemain satunya — dan hanya kalau **pemain itu pun** kehabisan
nyawa layar attract muncul.

Jadi rutin ini artinya "pemain ini selesai". Mesin baru kembali ke
attract saat pemain terakhir habis.

### Register mode CGA dirakit dari flag, bukan disimpan

`set_video_mode` menyusun byte mode dari `0x2A` sebagai dasar, lalu bit 2
BL menambah `0x04` dan bit 4 BL menambah `0x10`, sebelum dikirim ke port
`0x3D8` dengan byte warna menyusul di `0x3D9`. Satu bit diputar tiga
tempat dari BH ke AH di tengah jalan — begitulah satu flag pemanggil
mendarat di posisi yang benar di register warna.

Pola pisah jalurnya sama dengan kode suara: jalur umum diselesaikan
sampai `ret`, dan `is_pcjr` mengirim ke `pcjr_video_setup` untuk register
tambahan mesin itu.

### Kalah pun tidak punya penghitung

`entity_at_bound` (`CS:1310`) memakai batas yang **sudah harus dihitung**
untuk menahan pelanggan di bar, lalu mencabang atas bit 5 state:

- **bergerak** → `entity_enter_carry`, atau `apply_knockback` kalau lewat
  batas — pelanggan masih dalam permainan
- **berhenti** → `player_death_sequence`

Jadi kondisi kalah jatuh begitu saja dari pemeriksaan yang sudah ada.
Sepasang dengan `check_round_complete` yang memindai tabel alih-alih
memelihara penghitung: game ini konsisten memilih **menanyakan keadaan**
daripada **membukukan keadaan**.

### Skor tertinggi dibandingkan sebagai byte biasa

`update_high_score` membandingkan tiga byte BCD dari yang paling
signifikan dan berhenti di perbedaan pertama. Percabangan tiga arahnya
adalah seluruh rutin: `jb` berarti skor tersimpan lebih kecil (timpa),
`jbe` berarti sama (lanjut ke pasangan digit berikutnya), dan jatuh
lewat berarti tersimpan lebih besar (kembali tanpa menulis).

Membandingkan BCD terkemas sebagai byte biasa bekerja justru karena tiap
byte memuat dua digit desimal berurutan — tidak perlu dibongkar.

### Joystick dibaca dengan sepasang ambang, bukan titik tengah

Sumbu joystick tidak dibandingkan dengan nilai tengah lalu diberi zona
mati. Tiap sumbu punya **dua ambang terpisah**:

| sumbu | bawah | atas | dipakai di |
|---|---|---|---|
| horizontal | `joystick_low` | `joystick_high` | kursor babak bonus |
| vertikal | `joystick_y_low` | `joystick_y_high` | pindah bar |

Nilai di antara keduanya berarti diam. Ini juga yang akhirnya memastikan
pasangan mana yang vertikal — koreksi lama `joystick_center` di
[DECISIONS.md](DECISIONS.md) sudah menduga ada pasangannya, dan di sini
pasangan keduanya ketemu.

### Tiga dari empat lintasan input tidak melakukan apa-apa

`check_player_bar` (`CS:1A5A`) menggandakan `player_bar` lalu
membandingkannya dengan `bar_index_x2`; kalau tidak cocok, langsung
keluar. Loop per-bar menjalankan kode input ini empat kali per frame dan
tiga di antaranya kosong.

Itu lebih murah daripada menaruh penanganan input di tempat lain dan
harus mencari record pemain lagi dari awal.

### PCjr dianggap separuh kecepatan, di sembilan tempat

Pola membagi dua muncul di mana-mana begitu `is_pcjr` menyala:

| tempat | PC | PCjr |
|---|---|---|
| `entity_tick_reload` | 4 | 2 |
| nilai muat timer minum | 2 | 1 |
| lima loop delay di animasi guncang | `0x4448` | `0x2224` |
| `delay_busy_loop`, 10 pemanggil | `0x8000` | `0x4000` |
| delay ungkap babak bonus | `0x2224` | `0x1112` |

Yang terakhir itu menentukan. Membagi dua **hitungan busy-loop** hanya
masuk akal kalau mesinnya memang menyelesaikan tiap iterasi kira-kira
dua kali lebih lambat — dan itu memang sifat PCjr: RAM video-nya
dipakai bersama CPU, jadi akses memori melambat drastis dibanding PC.

Jadi bukan "PCjr dapat lebih banyak waktu" melainkan "PCjr dihitung
separuh kecepatan, semua tetapan waktunya dikompensasi". Sembilan situs
konsisten dan penjelasan perangkat kerasnya cocok — tapi *alasannya*
tetap inferensi; tidak ada baris kode yang menyatakannya.

Ini juga menutup rapi koreksi lama `slow_machine_flag` → `is_pcjr` di
[DECISIONS.md](DECISIONS.md).

### Byte state entitas, lengkap

Seluruh mesin state entitas didispatch dari satu byte di `+6`. Sepanjang
loop penamaan ini pembacanya terkumpul satu per satu, dan sekarang
byte-nya bisa ditulis utuh:

| bit | arti | bukti |
|---|---|---|
| 0 `0x01` | sedang bermain | dipindai `check_round_complete` di `CS:1F7F`; loop gambar juga mensyaratkannya |
| 1 `0x02` | membawa gelas | menggerakkan overlay 8x8 di `CS:1E13`; di sini mengalihkan ke `death_hand_off` |
| 2 `0x04` | disetel `entity_random_step`, dihapus massal `clear_entity_serve_bit`; memilih sprite `+8` |
| 3 `0x08` | slot terpakai | slot kosong tidak pernah masuk mesin state, dan dilewati saat menggambar |
| 4 `0x10` | sedang menuang | dinyalakan `start_serve` |
| 5 `0x20` | sedang bergerak | langsung ke `advance_entity_position` sebelum timer jalan |
| 6 `0x40` | dinyalakan bersama bit 0 oleh `entity_enter_return` |
| 7 `0x80` | arah hadap | dilipat ke indeks sprite di mana-mana lewat `and al, 0x80` |

Urutan pengujiannya adalah urutan prioritas: slot kosong cukup satu tes,
entitas yang bergerak tidak pernah menyentuh timernya, dan hanya yang
diam cukup lama sampai `+0x0D` habis yang sampai ke kerja animasi.

### Tidak ada penghitung "pelanggan tersisa"

Ronde dinyatakan selesai bukan dengan variabel melainkan dengan
**pertanyaan ke tabel**. `CS:1F7F` menyusuri keenam belas record entitas
mencari satu saja yang bit 0 state-nya menyala; temuan pertama langsung
kembali ke permainan. Baru kalau seluruh tabel sepi, kontrol jatuh ke
`round_cleared`.

Batasnya ukuran tabel, jadi ongkos pemeriksaan sama saja entah sisa satu
pelanggan atau lima belas. Tidak ada penghitung yang bisa melenceng dari
kenyataan.

### Bit 7 AL: satu nilai, dua tugas

Komentar `repaint_playfield` sempat mencatat bahwa `and al, 0x7f`
menyiratkan bit teratas AL adalah flag, tanpa tahu siapa yang
menyetelnya. Penyetelnya ada di `round_cleared`: empat lintasan
`repaint_playfield` dengan `xor al, 0x80` di antaranya — kedipan
perayaan.

Jadi nilai yang sama memilih pasangan sprite pemain lewat bit 7, dan
lewat tujuh bit bawahnya menentukan apakah lintasan entitas dilewati.

Ekornya `mov cx, 0x8000` lalu `loop $` telanjang: 32768 iterasi kosong
sebelum melompat ke `CS:0BE3`.

### Posisi pickup diturunkan, bukan dipilih

`spawn_pickup` (`CS:16F4`) tidak mengundi tempat. Ia mengambil alamat
layar pelanggan lalu menambah `0x280` — 640 byte, dan pada 80 byte per
scanline itu **delapan baris ke bawah**. Kecepatan di `+0x0E` digeser
kiri dua kali, jadi condong empat kolom per satuan laju ke arah gerak.

Hasilnya pickup selalu mendarat di depan-bawah pelanggan yang
meninggalkannya.

`pickup_budget` dikurangi di sini, dan hanya saat belum ada pickup hidup.
Jadi ia membatasi **berapa yang muncul per ronde**, bukan berapa yang ada
sekaligus.

### Bit 1 state entitas = sedang membawa gelas

`entity_enter_carry` (`CS:173F`) mematikan bit 5 dan menyalakan bit 1.
Bit 1 itulah yang diuji `draw_entity_loop` di `CS:1E13` sebelum
menggambar sprite 8x8 di posisi entitas + `overlay_offset_table` —
overlay yang membuat gelas terlihat di tangan pelanggan.

Daftar frame-nya ikut bertukar ke `0x40BA` atau `0x40C4` menurut
`bar_direction`: frame berjalan-sambil-membawa untuk dua arah hadap.

### Kartu "PLAYER n" tepat satu detik

`show_player_banner` (`CS:0DBF`) menyetel `key_pending`, memuat
`tick_countdown` dengan `0x3C`, lalu berputar di `CS:0DDE` sampai ISR
menghapusnya. `0x3C` = 60, dan tick-nya 60 Hz — jadi kartunya tampil
persis satu detik.

Ini pembacaan bersih pertama yang mengonfirmasi angka 60 Hz dari sisi
pemakainya, bukan cuma dari pembagi PIT.

### Isi bar ronde datang dari tabel (jumlah, kecepatan)

`seed_bar_entities` (`CS:0E1A`) mengisi empat bar dari `round_spawn_table`
yang diindeks `round_param_index * 8`. Tiap word tabel membawa **jumlah
di AH** dan **kecepatan bertanda di AL**.

AL ditulis ke `+0x0E` sebanyak record itu berturut-turut; dibagi dua lalu
dinegasikan menghasilkan arah bar. Jadi satu word menentukan berapa
pelanggan datang dan secepat apa mereka bergerak.

Sebelum itu, tiga buffer disamakan: dua salinan `0x2000` word (16 KB,
satu frame CGA penuh) dari staging ke text target dan draw target. Mesin
inkremental baru punya dasar yang sah setelah ini.

### Loop yang dibuka penuh, dan yang tidak

`erase_entity_16x16` (`CS:11BA`) menghapus entitas dengan delapan pasang
`mov ax,[di]` / `stosw` berselang `add di, 0x4c`, lalu diulang penuh di
bank satunya. Tidak ada loop sama sekali — `0x94` byte kode ditukar
dengan hilangnya penghitung dan cabang.

Bentuk yang sama muncul **sebagai loop** di `restore_16x16_background`.
Bedanya jalur: yang pertama jalan tiap frame, yang kedua cuma di jalur
kematian tempat biayanya tidak penting.

### Enam belas entitas di-stagger ke empat frame

`init_entity_slots` (`CS:088C`) menulis dua byte ke tiap record entitas
dengan langkah `0x10`: `+0x0C` selalu 2, dan `+0x0D` mengambil AL yang
di-`inc` lalu di-mask `3` — jadi 1, 2, 3, 0, 1, 2, 3, 0, ...

`+0x0D` **bukan** nomor bar melainkan penghitung mundur: `CS:1278`
menurunkannya tiap pass dan baru bertindak saat nol, lalu memuat ulang
dari `entity_tick_reload`. Menyemainya dengan 1, 2, 3, 0 berarti enam
belas entitas tersebar ke empat frame berbeda, bukan diperbarui serentak.

Biayanya tidak berkurang, hanya diratakan — trik yang sama semangatnya
dengan menyegarkan satu pita bar per frame.

### Dua buffer kerja berjarak persis satu layar CGA

`load_common_tables` menurunkan `text_target_segment` dari tempat pemuatan
aset berhenti: alamat akhir digeser kanan empat kali jadi paragraf,
ditambah `0x401`, lalu ditambah CS. `staging_segment` diambil mundur
`0x400` paragraf dari situ — 16 KB, persis satu layar CGA.

### Frame permainan asli, langsung dari memori video

`tools/frame_dump.py` menjalankan game 400 juta instruksi lalu men-decode
`draw_target_segment` apa adanya — `0x4000` byte, kedua bank CGA — ke
`screens/frame_play.png`.

Hasilnya **layar Tapper yang sebenarnya**: empat bar bergaris, panel
skor, gelas, pelanggan, dan struktur keran di ujung bar.

Itu satu uji yang memvalidasi banyak hal sekaligus. Kalau emulasi CPU,
interleave bank, atau paletnya salah, gambarnya tidak akan terlihat
seperti Tapper. Ini juga yang akhirnya mengidentifikasi isi
`sprites_bar.png`: bentuk bersudut dengan segitiga magenta di entri
1/3/5/7 adalah **struktur keran** itu.

**Jangan baca posisinya dari frame ini.** Di frame yang tertangkap
kerannya di ujung kiri, tapi itu satu adegan — bukan aturan. Kodenya
justru menyatakan sebaliknya: `bar_bound_table` menyimpan **dua batas per
bar, satu per arah**, dan `spawn_mug` mengindeksnya
`bar_bound_table[bar + dir]`. Kalau ujung keran selalu sama, indeks arah
itu tidak perlu ada sama sekali.

Pelajarannya: sprite yang dilihat terisolasi bisa bersih dan tetap tak
terbaca. Yang memberi arti adalah tempatnya.

### Mengatalogkan tabel tanpa tipe: runtime gagal, statik berhasil

Menonton runtime adalah cara yang jelas untuk memulihkan ukuran, dan
memang bekerja — tapi cakupannya buruk. Run 400 juta instruksi hanya
menyentuh **1 dari 25** entri, karena jalur yang memakai sisanya tidak
pernah tercapai.

Yang berhasil justru membaca situs panggilnya. Sebagian besar situs
memuat AL dengan **immediate** satu-dua baris sebelum panggilan, dan
blitter penyusulnya ada di listing yang sama:

| indeks | ukuran | dipakai di |
|---|---|---|
| 1–4, 16–21 | 8x8 | frame animasi tuang, lewat `frame_list_cursor` |
| 5 | 16x12 | ikon baris status |
| 11 | 12x16 | gelas, lima situs `blit_sprite_12x16` |
| 13, 14 | 32x22 | `0x0D`/`0x0E` yang berselang di animasi guncang |
| 15 | pickup | sprite pickup di `render_frame` |
| 22 | 16x16 | frame pertama `mug_crash_animation` |

Semuanya **saling mengunci dengan temuan sebelumnya** — bukan render yang
berdiri sendiri. Indeks 13/14 persis pasangan sprite yang
`reveal_animation_step` gantikan bergantian. Yang 8x8 menunjukkan gelas
dengan tingkat isi berbeda-beda, sesuai perannya sebagai frame tuang.

Soal **apa** yang digambarkan 13/14, dua bacaan hidup berdampingan dan
belum dipisahkan: saya membacanya sebagai figur bertopeng mengguncang
kaleng (dari perannya di babak bonus), sementara pembacaan visual
melihatnya sebagai **pelanggan marah yang melempar sesuatu**. Kodenya
hanya memberi tahu *di mana* sprite itu dipakai, bukan apa maksud
gambarnya. Yang pasti: pasangan ini berselang-seling dengan jeda di
antaranya, jadi gerakannya berulang.

Sepuluh indeks 8x8 itu awalnya terlewat karena polanya beda: `mov al`
ada **sebelum** kepala loop dan `inc al` berjalan di dalam badannya, jadi
tidak ada immediate di sebelah panggilan. Rantainya:
`fill_frame_ptrs_*` mengisi daftar frame di `0x40B0`–`0x40C6`,
`render_frame` menyusurinya lewat `frame_list_cursor` di `CS:1E96`, lalu
menyerahkannya ke `blit_sprite_8x8` di `CS:1EA9`.

Situs yang **menghitung** AL juga bisa dibaca, hanya perlu lebih teliti —
masing-masing menghasilkan himpunan kecil, bukan satu nilai:

| situs | perhitungan | indeks | ukuran |
|---|---|---|---|
| `CS:1CB6` | `al=5`, `inc` bila bit hadap kosong | 5, 6 | 16x12 |
| `CS:22FE` | `al=7`, `inc` bila `[bx+6]<=0`, `+2` bila `cycle_countdown==2` | 7–10 | 16x12 |
| `CS:19AF` | `al=0x18`, `inc` bila arah bar menyala | 24, 25 | 16x16 |

Hasil akhirnya **23 dari 25 entri terkatalog**, dan rendernya
mengonfirmasi mekanika permainan secara visual:

- **5, 6** — gelas **penuh**, magenta terisi. Yang `spawn_mug` luncurkan.
- **7–10** — gelas **kosong**, hanya garis luar. Yang kembali lewat
  `bar_list_heads_b`.

Gelas penuh berangkat, gelas kosong pulang — terbaca langsung dari
sprite-nya, bukan disimpulkan dari kode.

Indeks 5 muncul dari dua jalur berbeda (immediate di `CS:3117` dan
perhitungan di `CS:1CB6`) dan keduanya memberi 16x12 — satu-satunya
tempat kedua metode bertemu, dan mereka sepakat.

### Sprite 59/61: bartender dilempar ke atas meja bar

Identifikasi ini datang dari **memandangi gambarnya**, lalu terkonfirmasi
di kode. Di `sprites_out_of_range.png`, entri dalam-jangkauan 59 dan 61
terlihat seperti figur terbaring di atas bar.

`player_death_sequence` membenarkannya baris demi baris:

```
1419  mov bp, player_top
1438  mov dx, [si + bar_row_top]     ; pindahkan ke BARIS BAR
143D  add dx, bx                     ; bx = +/-0x0B menurut arah
1460  mov [bp + 0x0e], ah            ; beri KECEPATAN +/-1
1465  add al, 0x3b                   ; sprite 59
1467  and byte [bp + 6], 0xf7        ; matikan bit 3
```

Bartendernya tidak sekadar diganti sprite-nya. Ia **dipindahkan ke baris
bar** dan **diberi kecepatan**, jadi ia meluncur di atas meja. Sprite 61
adalah paruh bawahnya lewat aturan +2 yang sama seperti figur berjalan.

Ini juga menjelaskan kenapa kepemilikan runtime mencatat 59 → `player_top`
dan 61 → `player_bottom`: keduanya dua paruh satu figur 32x32.

Entri 63 dan 65 di sebelahnya adalah garis-garis gerak, konsisten dengan
sesuatu yang meluncur.

### Katalog gelas: penuh, setengah, kosong

Pembacaan visual atas `sprites_untyped.png` menghaluskan temuan
sebelumnya. Saya mencatatnya sebagai dua keadaan — penuh (5, 6) dan
kosong (7–10). Yang terlihat sebenarnya **bertingkat**: sepuluh sprite
8x8 (1–4, 16–21) menunjukkan gelas pada tingkat isi berbeda-beda, bukan
hanya dua ujungnya.

Itu masuk akal dengan perannya sebagai frame animasi tuang — gelas
mengisi bertahap, bukan berpindah dari kosong ke penuh sekaligus.

### Tiap entri memuat data dan mask-nya sendiri

Indeks 12 dan 23 tidak punya situs panggil sama sekali. Ukurannya tetap
bisa diturunkan — dari tata letak, bukan dari pemakainya.

Mengurutkan entri menurut alamat lalu mengukur rentang masing-masing
menunjukkan pola tegas: **tiap entri menempati persis dua kali ukuran
data sprite-nya**, karena data dan mask duduk bersebelahan.

| ukuran | data | rentang entri |
|---|---|---|
| 8x8 | 16 | 32 |
| 16x12, 12x16 | 48 | 96 |
| 16x16 | 64 | 128 |
| 32x22 | 176 | 352 |

Pola itu cocok untuk **20 dari 23** entri yang ukurannya sudah diketahui.
Dan indeks 12 maupun 23 sama-sama berentang **128** — sama persis dengan
tetangganya 22 dan 24 yang sudah terkonfirmasi 16x16.

Rendernya membenarkan, dan keduanya jatuh di kelompok semantik yang
tepat: **12** adalah wajah menyeringai bermata cyan, tokoh yang sama
dengan 13/14 di babak bonus; **23** adalah pola percikan, sekeluarga
dengan 22 dan 24 yang menggambarkan gelas pecah.

**25 dari 25 entri terkatalog.**

Hipotesis yang gugur di jalan: saya sempat menduga 12 dan 23 adalah
paruh **mask** tetangganya. Kalau begitu selisih 11→12 harus 48; ternyata
96. Justru kegagalan itu yang memunculkan model data+mask bersebelahan.

### Tabel sprite tanpa tipe — ukurannya ada di pemanggil

Lima dari enam tabel sprite adalah kisi datar yang stride-nya sama dengan
satu sprite. `sprite_table_ptr` satu-satunya yang tidak: 25 entri dengan
jarak tidak seragam, bahkan **negatif** — entrinya tidak berurutan
alamat.

Sebabnya: tabel itu memuat sprite **segala ukuran tercampur**, dan
ukurannya tidak dicatat di mana pun. Yang menentukan adalah blitter mana
yang dipanggil berikutnya oleh pemanggilnya:

| pemanggil | blitter |
|---|---|
| `1E52` | `blit_pickup_sprite` |
| `2190` | `blit_sprite_16x16` |
| `2313` | loop enam baris di tempat |
| `24FE`, `2521`, `2544` | `blit_sprite_32x22` |
| `2570`, `274B`, `2784`, `2992`, `2A6D` | `blit_sprite_12x16` |
| `3117` | `blit_sprite_16x12` |

Konsekuensinya untuk katalog: tabel ini **tidak bisa dibaca sendirian**.
Mengatalogkannya berarti mencatat blitter apa yang menyusul tiap
panggilan, bukan mengukur stride.

### Aturan transparansi harus mengikuti blitter, bukan menebaknya

Selama ini render memakai syarat `mask == 3 **dan** data == 0` untuk
menyatakan piksel transparan. Blitter tidak pernah menguji begitu:

```
    and ax, [bp + mask]      ; mask 11 mempertahankan latar
    or  ax, [bp]             ; data di-OR di atasnya
```

Jadi transparan berarti **`mask == 3` saja**, tanpa peduli nilai data.
Syarat tambahan `data == 0` sepakat pada sprite yang datanya bersih, dan
meninggalkan bintik pada yang tidak. Setelah diperbaiki, bintik papan
catur di tepi sprite bar hilang.

### Enam tabel sprite, dan stride-nya membuktikan geometrinya

| tabel | entri | stride | geometri |
|---|---|---|---|
| `ptr_table_a` / `_b` | 66 | `0x80` | 32x16 — 8 byte × 16 baris |
| `bar_sprite_table` | 32 | `0x84` | 24x22 — 6 × 22 |
| `popup_table_a` / `_b` | 7 | `0x1C0` | 56x32 — 14 × 16 × 2 bank |
| `sprite_table_ptr` | 25 | **tidak seragam** | campuran ukuran |

Stride-nya bukan tebakan melainkan pemeriksaan silang: `0x84` persis
displacement mask yang dipakai `blit_sprite_24x22`, dan `0x1C0` tepat dua
kali blok 14×16 yang disalin `draw_popup_frame` per bank. Kalau
geometrinya salah, rendernya akan miring — dan itu langsung terlihat.

`sprite_table_ptr` satu-satunya yang stride-nya tidak seragam, bahkan
memuat selisih negatif — entrinya tidak berurutan alamat. Itu bank
campuran ukuran, dan belum dikatalogkan.

### Popup skor itu enam frame dua penari

`screens/sprites_popup.png`: enam gambar 56x32 tanpa mask, masing-masing
dua figur dengan pose berbeda tiap frame. Digambar dengan salinan mentah
`repne movsb`, bukan blit ber-mask — itu sebabnya tabelnya menyimpan
gambar utuh alih-alih pasangan data/mask.

### Tabel sprite berpasangan (data, mask) — indeks valid selalu ganjil

`ptr_table_a` bukan daftar 65 sprite melainkan **33 pasangan**.
`lookup_ptr_pair` mengambil indeks `i` dan memakai `entry(i)` sebagai
piksel dan `entry(i+1)` sebagai mask. Word pertama tabel adalah
jumlahnya, jadi pasangan sungguhan mulai di indeks 1 dan melangkah dua.

Tiga sumber bebas mengatakan hal yang sama:

1. **Kode** — `lookup_ptr_pair` memang membaca `i` dan `i+1`.
2. **Runtime** — dari indeks dalam-jangkauan yang benar-benar diminta
   (1, 3, 11, 13, 17, 19, 21, 23, 31, 33, 59, 61), **semuanya ganjil**.
3. **Render** — versi lama `sprite_sheet.py` menyusuri tiap `i`, jadi
   separuh gambarnya memakai blok data sebagai mask. Yang salah itu
   keluar **buram total**, karena blok data tidak punya bit transparan.

Poin ketiga itu yang paling meyakinkan justru karena bisa dilihat:
lembar lama berselang-seling gelap-putih, dan yang putih semuanya
pasangan yang bergeser. Setelah melangkah dua, ke-33 entri transparan.

Pelajaran lamanya berlaku lagi: `sprites.png` sudah ada dan "berhasil"
sejak run 400M — tapi separuh isinya salah sampai gambarnya dibuka dan
dilihat.

### Kepemilikan entri tabel sprite, akhirnya dari runtime

Run 400M instruksi (naik dari 60M yang cuma menyentuh tiga indeks)
menghasilkan **16 indeks** dengan pemiliknya, diturunkan dari kaitan pada
`lookup_ptr_pair` dan `set_entity_sprite` — bukan dari pengamatan mata.

Tiga hal langsung terlihat:

**Aturan +2 muncul sendiri di data.** Indeks datang berpasangan berjarak
dua: 1/3, 11/13, 21/23, 31/33, 59/61, 78/80. Persis aturan "paruh bawah =
paruh atas + 2" yang ditemukan saat membaca `animate_player`. Dua sumber
bebas, satu kesimpulan.

**Pemain dan pelanggan berbagi sprite jalan.** Indeks 1, 3, 11, 13
diminta oleh `player_top`/`player_bottom` **dan** oleh slot entitas.
Masuk akal — semuanya orang yang berjalan di bar.

**Slot yang menghadap arah sama berbagi indeks.** Bar 0 slot 0 dan bar 2
slot 0 sama-sama memakai indeks 1, sementara bar 1 dan bar 3 memakai slot
1 untuk indeks yang sama. Itu pola `bar_direction` yang berselang-seling,
konsisten dengan pelipatan arah `and al, 0x80`.

### Game meminta sprite di luar tabelnya sendiri

`ptr_table_a` berisi **66 entri**, tapi runtime mencatat permintaan untuk
indeks **78, 80, dan 126**.

`sprite_index_in_range` (`CS:2E64`) melakukan `cmp word [cs:bx], ax` lalu
`jb` ke akhir — jadi indeks di atas 66 **diabaikan diam-diam**, tanpa
error, tanpa sprite. Ketiganya diminta `player_top`/`player_bottom`.

Ini mekanisme yang sama yang dulu membuat render bartender gagal: mode 1
membangun tabel 7 entri sementara yang diminta indeks 13. Sekarang
terlihat bahwa permintaan di luar jangkauan bukan kasus tepi langka
melainkan sesuatu yang benar-benar terjadi saat game berjalan normal.

**Hipotesis "tabel lebih besar di mode lain" sudah gugur.** Kedua mode
tampilan diukur langsung:

| mode | `ptr_table_a` | entri |
|---|---|---|
| 0 | `7107` | 66 |
| 1 | `7DEB` | 7 |

Tidak ada yang bisa melayani indeks 78, 80, apalagi 126.

Dan isinya **bukan sampah acak melainkan potongan yang salah bingkai** —
data sprite yang nyata, dibaca pada offset yang meleset dari kisinya,
sehingga beberapa sprite bertetangga masuk satu jendela dan tak satu pun
utuh. Persis seperti meng-crop sprite sheet di posisi yang salah.

Itu bisa dihitung, bukan cuma dilihat. Bank sprite 32x16 adalah kisi
datar: **jarak antar entri berurutan selalu tepat `0x80`, 65 celah,
tanpa pengecualian**, dari `0x718D` sampai `0x920D`. Blok data dan mask
berselang-seling, jadi pasangan berjarak `0x100`.

| indeks | offset dari basis | sisa bagi `0x80` |
|---|---|---|
| 78 | `0x66` | meleset 102 byte |
| 80 | `0xE7A` | meleset 122 byte |
| 126 | `0xEFBA` | meleset 58 byte |

Tidak satu pun mendarat di kisi — itulah sebabnya jendelanya mengangkangi
batas blok. Alamatnya sendiri juga sudah membocorkan kekacauannya:
indeks 78 memberi mask `7107`, yaitu **alamat basis tabelnya sendiri**,
dan indeks 126 memberi data `16147`, melampaui 16 bit.

Konsekuensi lain dari kisi yang serapi itu: **tabel pointernya sebenarnya
redundan.** Setiap entri persis `basis + i*0x80`, jadi bisa dihitung
alih-alih disimpan. 65 celah × `0x80` = `0x2080`, tepat sebesar
wilayahnya — tidak ada sprite tersembunyi di antara entri.

Jadi yang bisa dinyatakan: permintaan itu **tidak bisa dilayani di kedua
mode**, dan `sprite_index_in_range` menelannya diam-diam sehingga tidak
ada yang tergambar. Apakah kode 1984 aslinya bermaksud sesuatu di sana
tidak bisa dijawab dari salinan ini.

### `or bx, 0xe000` terbukti mati — diukur, bukan dinalar

`tools/probe_rom_noise.py` memaksa `play_rom_noise` berjalan dan mencatat
ES:BX tepat di `test byte [es:bx], 1` — alamat yang benar-benar akan
dibaca. Hasilnya:

```
4000 reads observed
  segment(s) : F000
  offset lo  : 0x0001
  offset hi  : 0x05cc
```

Tidak ada satu pun di atas `0x2000`. Jadi `or bx, 0xe000` di `CS:3B5D`
memang tidak pernah berpengaruh — `and bx, 0x1fff` di dalam loop
menghapusnya sebelum pembacaan pertama — dan sumber deraunya
**F000:0000-1FFF**, bukan ROM BIOS di F000:E000-FFFF.

Ujinya bisa gagal: kalau OR itu hidup, offsetnya akan mendarat di
`0xE000`–`0xFFFF`. Tidak.

**Yang belum terjawab, dan sekarang lebih tajam.** Speaker hanya bergerak
kalau nilai bit 0 berturut-turut **berbeda**. Daerah yang terisi seragam
— seluruhnya `0x00` maupun seluruhnya `0xFF` — menghasilkan senyap dengan
jeda yang tetap utuh. Jadi pertanyaannya bukan lagi "apakah OR itu mati"
(sudah terjawab: ya) melainkan "apakah F000:0000-1FFF berisi byte yang
bervariasi di mesin target".

Emulator ini menyimpan nol semua di sana, tapi itu **celah emulator**,
bukan bukti tentang perangkat keras. Menjawabnya butuh peta memori mesin
asli.

### Suara pecah dibangkitkan dari isi ROM

`play_rom_noise` (`CS:3B1E`) tidak memakai PIT sama sekali. `and al, 0xfe`
mematikan gerbang timer supaya bit 1 port `0x61` menggerakkan kerucut
speaker langsung, satu bit sekali.

Bit-bitnya diambil dari `ES:BX` dengan `ES = 0xF000` — **ROM sistem**.
Tiap byte diuji bit 0-nya, dan apa pun yang kebetulan ada di ROM itulah
sumber derau. Tidak ada RNG, tidak ada wavetable, tidak ada biaya
penyimpanan sama sekali.

Bentuknya diatur `rom_noise_script`: pasangan byte (jumlah toggle,
delay*2), diakhiri word nol. Delay makin besar berarti derak makin kasar,
jadi urutan `0x20, 0x60, 0x58, 0x30 ...` adalah bunyi pecah yang meluruh.

Dengan `sound_flags` bit 0 mati, jalur senyap di `CS:3B96` tetap membakar
tempo yang sama lewat `key_pending` — jeda kematian terlihat identik
walau suara dimatikan.

### Dua tingkat penyegaran layar

Game punya dua rutin gambar-ulang, dan pilihannya menjelaskan anggaran
waktunya:

- **`flush_bar_band`** — satu pita 22 scanline, satu bar. Dipakai tiap
  frame saat bermain.
- **`repaint_playfield`** — keempat bar, semua entitas, seluruh pemain.
  Dipakai hanya di transisi tempat isi layar tidak bisa dipercaya lagi
  (`CS:13EB`, `146C`, `1632`, `1FA8`, dan setelah gelas pecah).

`repaint_playfield` melakukan tiga lintasan atas geometri yang sama:
`copy_all_bar_bands` memulihkan latar bersih dari staging ke text target,
semuanya digambar ke situ, lalu `copy_all_bar_bands` sekali lagi dari
text target ke draw target. Jadi buffer perantaranya nyata, tapi cuma
dipakai di jalur mahal ini.

`and al, 0x7f` sebelum membandingkan dengan `0x17` menunjukkan bit
teratas AL adalah flag, bukan bagian indeks — saat cocok, seluruh
lintasan entitas dilewati.

### Gelas pecah selalu berarti mati

`mug_crash_animation` (`CS:2144`) hanya punya dua pemanggil, dan keduanya
berpola sama: bebaskan node, panggil ini, lalu jatuh langsung ke
`on_player_death`. Tidak ada jalur keluar lain. Jadi rutin ini selalu hal
terakhir yang pemain lihat sebelum kehilangan nyawa.

Animasinya tiga frame — sprite `0x16`, `0x17`, lalu `0x16` lagi — di
kedua bank, dengan `delay_busy_loop` di antara dua yang pertama.

### Nomor ronde yang dilihat pemain selalu +1

Setiap pembacaan `round_number` untuk ditampilkan atau dipakai menghitung
kesulitan adalah `round_number + 1`. Jadi penghitung di `0x44C7` bernilai
0 pada ronde yang pemain lihat sebagai **1**.

Cetak dua digitnya pakai pengurangan 10 berulang (`CS:1025`), bukan
`DIV` — lebih murah di 8088 untuk nilai di bawah 100.

Tiga nilai kesulitan lahir dari penghitung yang sama:

| nilai | rumus |
|---|---|
| `pickup_budget` | ronde+1, tapi **4** sejak ronde 2 — angka 3 dilompati |
| `pickup_spawn_countdown` | ronde+1 dijepit 2..7, disimpan di kedua byte |
| `intro_delay_count` | `0x1388`, dibagi dua sejak ronde 6, dan cuma `0x190` di PCjr |

`theme_sprite_base` tidak diskalakan melainkan dipetakan: `(tema+1)*2`
jadi **1, 3, 7, 5** lewat `dec` di bawah 4 dan `or 5 / and 7` di atasnya.
`tema+1` yang sama dikirim ke `start_sound_effect`, jadi tiap saloon
punya jingle pembuka sendiri.

### Tidak ada flag pause; yang ada flag telan-tombol

Pause dibangun di atas `swallow_next_key`. `CS:10CC` berputar selama byte
itu bukan nol, dan ISR keyboard di `CS:33B8` menghapusnya pada key-down
pertama **sambil membuang scancode-nya**. Jadi satu mekanisme mengurus
dua hal, dan tombol yang melanjutkan permainan sengaja tidak sampai ke
game.

### Babak bonus tidak pernah memilih pemenang

Cara Tapper menentukan kaleng yang benar terbalik dari dugaan: ia memilih
**lima yang salah**, dan sisanya otomatis jadi jawaban.

`CS:2466` menandai lima bit berbeda di `bonus_answer` (mulai dari `0xC0`
supaya bit 6-7 terkunci, jadi undiannya efektif 0..5). `CS:2603` lalu
memutar byte itu ke kanan sambil menghitung sampai menemukan satu-satunya
bit yang masih kosong, dan menulis hitungan itu **menimpa bitmap-nya
sendiri**. Byte yang sama berubah peran dari bitmap jadi indeks.

Keuntungannya nyata: tidak perlu loop ulang untuk memastikan pemenangnya
unik. Persis satu pilihan benar, dijamin oleh konstruksi.

Ini juga sebabnya nama lama `picked_bitmap` cuma benar separuh — lihat
[DECISIONS.md](DECISIONS.md).

### Kalah lebih panjang daripada menang

Dua cabang di `bonus_judge_choice` sangat timpang, dan itu petunjuk mana
yang dianggap tontonan:

- **Benar** (`CS:29AF`): hentikan suara, tambah 0x3000 skor, gambar sprite
  0x33, cetak dua string. Selesai.
- **Salah** (`CS:2878`): kalengnya digoyang — dua loop salin empat word
  dengan BX turun lalu naik, menggeser gambar dua byte per pass, delapan
  pass tiap arah. Lalu efek suara 9 dan animasi semprot yang menyelang
  kaleng dengan sprite 0x0B empat kali, di kedua bank.

Keduanya bertemu di `bonus_end_pause`: empat `loop $` masing-masing
0x10000 iterasi, kira-kira satu detik di 4,77 MHz.

Enam pilihan berjarak 8 byte (32 piksel), dan `0x30` yang dipakai saat
membungkus kursor persis 6*8.

### Rahasia kecepatan: cuma satu pita 320x22 yang disegarkan

`flush_bar_band` (`CS:1EB5`) tidak pernah menyalin layar penuh. Ia
menyalin **11 pass × 2 bank × 80 byte** = 22 scanline — persis setinggi
sprite bar 24x22. Satu frame hanya menyegarkan satu bar.

Itu penjelasan bagaimana game ini lancar di 4,77 MHz: layar 320x200 penuh
butuh 16 KB salinan per frame, sedangkan pita ini cuma 1,7 KB.

Dua baca `in al, 0x3da` di `CS:1EC9` dan `CS:1ECC` terlihat seperti idiom
tunggu vertical retrace — bit 3 memang mask yang benar untuk itu — tapi
hasilnya tidak pernah dipakai. Menelusuri flag ke depan:

| alamat | instruksi | flag |
|---|---|---|
| `1ECD` | `test al, 8` | **disetel** |
| `1ECF` | `mov ax, 0xb` | tidak disentuh |
| `1ED2` | `mov cx, 0x28` | tidak disentuh |
| `1ED5` | `repne movsw` | tidak dibaca — REPNE pada MOVS sama dengan REP di 8086 |
| `1ED7` | `sub si, 0x50` | **ditimpa** |

Tidak ada satu pun cabang bersyarat di jendela itu. Jadi kode ini
**tidak** menunggu retrace. Uji ini bisa gagal: satu `jz`/`jnz` di antara
`1ECF` dan `1ED7` akan membantahnya.

**Kenapa ditulis begitu, tidak diketahui — dan sengaja dibiarkan begitu.**
Ia terbaca seperti tunggu-retrace yang cabangnya hilang, tapi cerita itu
tidak punya sumber kedua: ini satu-satunya situs `0x3DA` di seluruh
binary, jadi tidak ada pembanding, dan tidak ada NOP di mana pun di
`0x1D00`–`0x1FFF` yang menandakan tambalan. Dugaan "sisa kode yang
lumpuh" yang sempat dicatat **dicabut**.

### Menggambar dua kali itu interleave, bukan double buffer

Di seluruh `render_frame`, setiap sprite digambar dua kali dengan
`xor di, 0x2000`. Itu bukan buffer ganda — itu dua bank CGA yang
berselang-seling baris. Kalau hanya satu yang ditulis, figurnya tampak
bergaris sisir.

Urutan gambarnya belakang-ke-depan: empat record entitas, pickup, gelas
di bar, sprite bar 24x22, lalu pemain paling akhir supaya berdiri di
depan bar. `player_prev_top` digambar lebih dulu saat bit 3 state menyala
— itulah cara posisi lama dihapus.

### Geometri bar tertulis sebagai aritmetika di tempat gelas lahir

`spawn_mug` (`CS:1C6B`) menghitung alamat layar gelas baru begini:

```
    (bar*20 + 24) * 80 + kolom
```

Tiga konstanta itu adalah tata letak layar Tapper, dinyatakan sebagai
perkalian, bukan sebagai tabel:

- **80** — byte per scanline CGA 320x200 2bpp
- **24** — bar teratas mulai 24 baris ke dalam bank (scanline 48, karena
  bank berselang-seling)
- **20** — jarak antar bar, 20 baris bank = 40 scanline

Empat bar berarti baris bank 24, 44, 64, 84. Tidak ada tabel koordinat bar
di data; posisinya dihitung ulang setiap gelas dituang.

### Fisika gelas cuma tiga field

Node gelas yang baru diambil dari `free_list_head` diisi empat field, dan
itu sudah seluruh perilakunya:

| offset | isi | arti |
|---|---|---|
| +2 | `(bar*20+24)*80 + kolom` | posisi layar |
| +4 | `BP` | pointer data sprite dari `select_sprite_ptr` |
| +6 | `+2` atau `-2` | langkah horizontal, tandanya dari bit arah pemain |
| +7 | `bar_bound_table[bar+dir] + 3 - 4*dir` | kolom awal |

Gelas dimasukkan ke **kepala** daftar bar, jadi gelas terbaru diproses
lebih dulu. Kolom awalnya tiga kolom di dalam batas yang sama yang menahan
pemain — itulah sebabnya gelas tampak keluar dari keran, bukan dari tangan.

### Pemain itu dua sprite 32x16 bertumpuk

`animate_player` (`CS:1D1E`) selalu berakhir di `draw_player_lower` dengan
BP sudah maju 0x10, dan indeks sprite paruh bawah selalu paruh atas + 2.
Jadi figur 32x32 pemain adalah dua record berurutan, bukan satu sprite
besar — konsisten dengan tujuh blitter yang tidak punya varian 32x32.

Siklus jalannya lambat dengan sengaja: `test [bp+7], 3` membuat hanya
setiap tick keempat yang mengubah frame.

### Menuang itu animasi tiga langkah, dan posisinya disentak ke keran

`start_serve` (`CS:1BA2`) tidak langsung melahirkan gelas. Ia:

1. menghapus gambar pemain dari layar
2. **menyentak** posisi `+0x08` pemain ke kolom keran bar, diambil dari tabel
   di `0x4032` yang diindeks arah bar
3. menyetel `move_step_count` **dan** `slow_move_divider` ke 3
4. menyalakan bit 4 state, lalu memilih sprite tuang (`0x0B` + bit arah)

Frame-nya kemudian diputar `serve_step_frame` sampai `move_step_count` habis.
Jadi "menuang" adalah animasi tiga langkah yang posisinya dipatok ke keran —
bukan aksi seketika di posisi pemain berdiri.

Itu juga menjelaskan `slow_move_divider`: di PCjr, langkah hanya maju saat
pembagi habis, jadi animasi yang sama membentang tiga kali lebih banyak pass.

### Tombol tuang — dua skema kontrol bertemu di satu tempat

`check_serve_input` (`CS:1B6B`) menerima **salah satu dari dua**:

| Skema | Uji |
|---|---|
| Joystick | `joystick_buttons != 0x30` |
| Keyboard | bit 8 `keys_down_bitmap`, yaitu **Space** menurut peta tombol |

Keduanya bertemu di `start_serve`, bukan di ISR. Jadi pemisahan joystick/keyboard
tidak terjadi di lapisan input melainkan di titik aksi — konsisten dengan
`player_read_move_input`, yang juga memilih sumber gerak di tempat pemakaian.

Sekalian terbaca apa arti "aktif" bagi entitas: `entity_activate` (`CS:1B3D`)
menyalakan bit 0 state, menyetel indeks sprite dasar ke `0x1F`, dan mengisi
pencacah animasi dengan 1. Pemicunya **mencapai posisi batas**, bukan undian —
menguatkan catatan lama di `move_entity_along_bar`.

### Menu — empat opsi, empat variabel berurutan

`menu_lookup_option` (`CS:09D0`) memindai `menu_key_table` (`0x3D7C`): empat
baris scancode dipisah `0xFF`, satu baris per opsi. Pemindaiannya menyimpan dua
penghitung — `DI` nomor baris, `DH` posisi di dalam baris — jadi satu kecocokan
langsung memberi **opsi mana** dan **nilai keberapa**.

Variabel opsinya kemudian cukup `DI` byte setelah `input_enabled`. Itu sebabnya
keempatnya berurutan, dan urutannya sama dengan urutan di layar:

| Alamat | Variabel | Pilihan |
|---|---|---|
| `0x448B` | `input_enabled` | `JOYSTICK` / `KEYBOARD` |
| `0x448C` | `two_player_flag` | `ONE PLAYER` / `TWO PLAYER` |
| `0x448D` | `difficulty` | `BEGINNER` / `ARCADE` / `EXPERT` |
| `0x448E` | `sound_flags` | `NO SOUND` / … / `EXTERNAL SOUND` |

Menerapkan pilihan menghapus penanda lama lalu menulis yang baru lewat
`menu_marker_addr`, yang mengindeks `menu_marker_table` (`0x3D89`) untuk offset
layar tiap baris.

### Penanganan tombol

`dispatch_key_action` (`CS:3405`) di dalam ISR keyboard mengindeks
`key_action_table` (`0x3573`) dengan `(14 - CX) * 4` lalu melompat lewat tabel
itu. `keys_down_bitmap` (`0x449B`) berfungsi sebagai debounce: tombol yang sudah
ditandai ditekan akan diabaikan, sehingga menahan tombol tidak mengulang aksi.

### `is_pcjr` — bukan "mesin lambat", melainkan deteksi PCjr

Flag di `0x44C6` selama ini bernama `slow_machine_flag`. Itu **salah**, dan
melacak asalnya di `CS:06E9` menyelesaikannya:

```
mov ax, 0xffff
mov es, ax
cmp byte [es:0xe], 0xfd     ; F000:FFFE -- byte model BIOS IBM
je  short (lewati)
inc al                      ; AL masuk 0xFF; hanya di-inc kalau BUKAN PCjr
mov byte [is_pcjr], al
```

`ES = 0xFFFF` dengan offset `0x0E` mendarat di **F000:FFFE**, byte model BIOS,
dan `0xFD` adalah **PCjr**. `AL` masuk bernilai `0xFF` dan hanya dinaikkan jadi
`0x00` bila mesinnya bukan PCjr. Jadi flag ini **set di PCjr, kosong di mesin
lain** — kebalikan dari yang namanya sarankan.

Tiga perangkat keras khas PCjr bergantung padanya, dan itu konfirmasi sekuat
byte model-nya sendiri:

| Port | Apa | Di mana |
|---|---|---|
| `0x3DF` | register halaman video PCjr | `CS:072D` |
| `0xC0` | chip suara SN76496 | seluruh mesin suara |
| `0x3D4`/`0x3D5` | penyetelan CRTC register 2 | ISR keyboard |

Yang selama ini dibaca sebagai "kompensasi mesin lambat" sebenarnya
**penyesuaian untuk PCjr**:

| Tempat | Efek di PCjr |
|---|---|
| `CS:1003` | `entity_tick_reload` 4 → 2 |
| `CS:10EC` | `popup_tick_divider` dimuat `0x10` lalu dikurangi 6 → 10 |
| `CS:1EF7` | `slow_move_divider` dipakai mengatur laju langkah gerak |
| `CS:3831` | suara lewat SN76496, bukan PC speaker |

`slow_move_divider` (`0x4525`) ditulis `3` berdampingan dengan
`move_step_count` di `CS:1BE0` dan `CS:1C44`, tapi **dibaca di satu tempat
saja** — di dalam blok yang dijaga `is_pcjr`. Di mesin non-PCjr variabel itu
ditulis dan tidak pernah dibaca.

**Koreksi.** Nama lamanya bukan sekadar kurang tepat; ia membalik arah
pemahaman. "Mesin lambat mendapat lebih banyak waktu" terdengar masuk akal dan
itulah sebabnya bertahan lama — padahal yang terjadi adalah kode
mesin-spesifik untuk satu model komputer tertentu.

**Konfirmasi keempat, dari menu.** `CS:09EE` menerima scancode `0x2D` **hanya
bila `is_pcjr` diset**, dan menyetel opsi suara ke nilai 3 — yaitu
`EXTERNAL SOUND`, jalur SN76496. Jadi menunya menolak menawarkan chip itu pada
mesin yang tidak punya. Bukti ini datang dari wilayah kode yang sama sekali
terpisah dari byte model, port video, maupun mesin suara.

### Objek dinamis — pool dan daftar berkait

Selain array entitas statis, game mengelola objek lewat **alokator pool
berbasis free list**. Ini lapisan kedua yang terpisah dan tidak terlihat dari
struktur entitas.

**Pool.** `free_list_head` (`0x4531`) diinisialisasi ke `free_list_pool`
(`0x46C3`) di `CS:0FA3`. Tiap node bebas menyimpan pointer node berikutnya, jadi
pop berarti membaca word yang ditunjuk head:

```
mov si, [free_list_head]
mov ax, [cs:si]              ; next
mov [free_list_head], ax     ; pop
```

`free_list_splice` (`CS:2EB3`) melakukan sebaliknya — mengembalikan node.

**Dua daftar per-bar.** `bar_list_heads_a` (`0x4533`) dan `bar_list_heads_b`
(`0x453B`) berjarak tepat 8 byte — empat word masing-masing, satu head per bar.
`alloc_node_to_bar_list` (`CS:167E`) mem-pop dari pool lalu men-push ke head bar
yang bersangkutan; `CS:1C9E` melakukan hal sama untuk daftar A.

**Layout node:**

| Offset | Isi |
|---|---|
| `+0x00` | pointer node berikutnya |
| `+0x02` | offset tujuan layar |
| `+0x04` | **pointer data sprite** |
| `+0x06` | kecepatan, bertanda |
| `+0x07` | posisi, dimajukan oleh kecepatan |

**Koreksi `+0x04`.** Field itu lama tercatat sebagai "pointer entitas
pemiliknya". Bukan. `CS:1CC2` memanggil `select_sprite_ptr`, yang mengembalikan
hasilnya di `BP`, lalu menyimpan `BP` itu langsung ke `[bx+4]`. Dan `CS:2376`
memuatnya kembali ke `BP` untuk mem-blit. Pointer entitas tidak mungkin dipakai
begitu — pengambilan mask di `[bp+0x30]` akan membaca jauh melewati ujung record
entitas yang cuma 16 byte.

**Koreksi:** `+0x06` sebelumnya saya dokumentasikan sebagai byte state, karena
`draw_bar_list_b` hanya menguji tandanya. `CS:1812` menyelesaikannya — byte itu
ditambahkan ke posisi `+0x07` **dan** ke offset layar `+0x02`, jadi itu
kecepatan; sprite-nya sekadar bergantung arah gerak. Diinisialisasi di `CS:1CD1`
sebagai `x*4 − 2`, menghasilkan +2 atau −2.

Node daftar A maju setiap pass; node daftar B dilewati pada satu fase
`cycle_countdown` (`CS:192F`), jadi bergerak lebih lambat.

**Daftar B ternyata gelas kosong yang kembali.** `update_returning_mugs`
(`CS:18AE`) — dulu bernama `erase_bar_list_b`, nama yang meremehkan isinya —
melakukan empat hal per node: menghapus persegi 16×12 di `[bx+2]`, menambahkan
kecepatan `[bx+6]` ke posisi dan offset layar, lalu memutuskan nasibnya.

| Hasil | Syarat | Akibat |
|---|---|---|
| **Tertangkap** | node di bar pemain, posisinya di jendela `[player_column − 1 + 2×player_velocity, +7]` | `free_list_splice` + `add_score 0x100` |
| **Lolos** | melewati `bar_bound_table` untuk arahnya | animasi jatuh 8 frame (`+0x50` per frame, satu scanline), lalu `on_player_death` |

Jendela tangkapnya **melampaui posisi pemain sebesar dua kali kecepatan** — jadi
bartender yang berlari menangkap sedikit di depan gambarnya sendiri.

Identifikasi "gelas kosong" datang dari perilakunya, bukan dari art: ditangkap
memberi skor, terlewat memakan nyawa. Indeks sprite-nya `0x18`, atau `0x19` bila
byte arah bar diset.

Nama lamanya menyesatkan dengan cara yang khas: **menghapus memang yang
dilakukan empat baris pertama**, dan sisanya — memindahkan, menilai, membunuh —
tidak tercermin sama sekali.

**Daftar A punya penyakit nama yang sama, dan melengkapi simetrinya.**
`erase_bar_list_a` juga bukan penghapus: ia menghapus, lalu jatuh ke
`advance_node_position` dan `resolve_node_collision`, dan diakhiri uji batas
yang berujung `on_player_death`. Namanya kini `update_served_mugs`.

| Daftar | Arah | Kena sesuatu | Lewat batas |
|---|---|---|---|
| A | menuju entitas | node dilepas, bit 5 state entitas diset, kecepatan entitas **dibalik dan digandakan** | `on_player_death` |
| B | kembali ke pemain | node dilepas, `add_score 0x100` | `on_player_death` |

Simetri itulah yang mengidentifikasi objeknya. Dokumentasi
`resolve_node_collision` dulu menulis bahwa mekanismenya *mirip* gelas mencapai
pelanggan tapi tidak ada yang menyebut pihaknya. Setelah kedua daftar dibaca,
pasangannya sulit dihindari: **daftar A gelas yang dilempar, daftar B gelas
kosong yang kembali** — dan keduanya membunuh pemain dengan syarat yang sama
persis, di ujung yang berlawanan.

`CS:18A5` tidak `ret`: ia mengarahkan `SI` ke `bar_list_heads_b` lalu **jatuh
langsung** ke `update_returning_mugs`. Jadi satu panggilan memproses kedua
daftar untuk satu bar.

**Head pool ini pernah dirusak — dan selalu diperbaiki lebih dulu.**
`player_death_sequence` (`CS:13E4`) menyimpan `bar_index_x2` dengan
`mov [cs:death_bar_index_x2], ax`, yaitu penyimpanan **word** ke `0x4530` —
sedangkan `0x4531` adalah `free_list_head`. Karena `bar_index_x2` tidak pernah
melebihi 6, byte tingginya 0, jadi byte rendah head pool ikut dinolkan
(`0x46C3` → `0x4600`).

Tidak ada yang membacanya di sela itu: animasi kematian tidak mengalokasikan
apa pun, dan semua jalur keluar dari `on_player_death` melewati setup ronde,
tempat `init_free_list` menulis ulang head sebelum alokasi berikutnya. Jadi
kerusakannya nyata tapi selalu ditimpa sebelum sempat berpengaruh.

**Pass render.** Enam pembaca `[cs:bx+2]` tersusun dalam tiga pasang bank, satu
per bank CGA:

| Pass | Bank 0 | Bank 1 | Jenis |
|---|---|---|---|
| Hapus daftar A | `17A0` | `17D7` | tanpa mask |
| Hapus daftar B | `18B8` | `18EF` | tanpa mask |
| Gambar daftar B | `2316` | `2338` | bermask, geometri 12×16 |

**Daftar A tidak punya pass gambar.** Hanya hapus dan tabrakan. Karena node
menyimpan pointer entitas di `+0x04`, kemungkinan besar objek daftar A digambar
lewat entitasnya dan daftar itu hanya untuk pembukuan.

**Tabrakan.** `resolve_node_collision` (`CS:1840`) menguji posisi node `+0x07`
terhadap jendela selebar 3. Saat kena: state bit 5 entitas dinyalakan, node
dikembalikan ke pool, kecepatan entitas dibalik dan **dilipat dua**, pencacah
animasi direset, sprite maju 4 frame.

Bit 5 itu tepat bit yang menggerbangi `apply_knockback`. Perlu dicatat keduanya
tidak berbagi helper: di sini `neg` lalu `shl` (lipat dua), di `apply_knockback`
`neg` lalu `sar` (setengahkan).

Pada `draw_bar_list_b` indeks sprite dipilih dari state node `+0x06` **dan**
`cycle_countdown` global, jadi objek ini beranimasi tersinkron ritme game, bukan
timer privat.

### Timebase dan input

`int1c_timer_isr` (`CS:3758`) adalah detak game. Tiap tick:

- `timer_reentry_guard` (`0x448A`) mencegah tick kedua masuk saat tick pertama
  masih berjalan
- memanggil `advance_rng`
- mem-polling joystick di **port `0x201`** dan men-debounce tombolnya ke
  `joystick_buttons` (`0x44B7`), dengan bacaan sebelumnya di `0x44B8`
- menghitung mundur `tick_countdown` (`0x44C2`) dari 60 tick (~3,3 detik pada
  18,2 Hz)

### RNG

`advance_rng` (`CS:2F4C`) adalah **LFSR 16-bit**: state di `rng_state`
(`0x449D`) di-AND dengan tap mask `0xD598`, paritas hasilnya jadi bit masuk,
lalu dirotasi lewat carry (`rcl`).

### Tabel tombol

ISR keyboard memindai scancode di tabel 15 byte pada `0x3565` (`repne scasb`),
lalu mengindeks `key_action_table` dengan `(14 - CX) * 4`.

| Scancode | Tombol | Aksi | | Scancode | Tombol | Aksi |
|---|---|---|---|---|---|---|
| `0x48` | Up | `34EF` | | `0x1E` | A | `34EF` |
| `0x50` | Down | `348B` | | `0x2C` | Z | `348B` |
| `0x4B` | Left | `34C3` | | `0x26` | L | `34C3` |
| `0x4D` | Right | `3499` | | `0x27` | `;` | `3499` |
| `0x39` | Space | `354A` | | `0x45` | NumLock | `3542` |

Ada **dua set tombol gerak** — panah dan A/Z/L/; — yang memetakan ke aksi
identik.

### Peta bit `keys_down_bitmap` — tuntas

`keys_down_bitmap` itu **word** (`0x449B`–`0x449C`). Dua angka lahir dari `CX`
yang sama setelah `repne scasb`, dan keduanya **berlawanan arah**:

```
bx = (14 − cx) × 4        ; entri di key_action_table
dx = 1 << (cx − 1)        ; dari stc + rcl dx, cl, dengan dx = 0
```

Untuk entri pindai ke-*i*, indeks aksinya *i* tapi bit debounce-nya **13 − i**.
Itulah sebabnya membaca mask bit berurutan menurut tabel pindai menghasilkan
tombol yang salah — dan kenapa pemetaan ini sengaja tidak diklaim di siklus
sebelumnya.

| Entri | Scancode | Tombol | Bit | Make | Break |
|---|---|---|---|---|---|
| 0 | `53` | Del | 13 | `check_ctrl_alt_del` | — |
| 1 | `1D` | Ctrl | 12 | — | — |
| 2 | `38` | Alt | 11 | — | — |
| 3 | `01` | Esc | 10 | `key_action_escape` | — |
| 4 | `45` | NumLock | 9 | `key_action_numlock` | — |
| 5 | `39` | Space | 8 | `key_action_space` | — |
| 6 | `2C` | Z | 7 | `key_action_down` | — |
| 7 | `27` | `;` | 6 | `key_action_right` | `key_release_right` |
| 8 | `26` | L | 5 | `key_action_left` | `key_release_left` |
| 9 | `1E` | A | 4 | `key_action_up` | — |
| 10 | `50` | Down | 3 | `key_action_down` | — |
| 11 | `4D` | Right | 2 | `key_action_right` | `key_release_right` |
| 12 | `4B` | Left | 1 | `key_action_left` | `key_release_left` |
| 13 | `48` | Up | 0 | `key_action_up` | — |

**Pembagian byte-nya ternyata tidak sembarang:** bit 0–7 persis kedelapan tombol
gerak (dua set empat yang saling menggantikan), bit 8–13 persis tombol sistem.
Karena itu ketiga situs yang menguji `keys_down_hi` semuanya menanyakan
modifier.

Tiga pemakaian itu sekaligus mengonfirmasi peta di atas dari tiga arah berbeda:

| Situs | Uji | Artinya |
|---|---|---|
| `CS:33D2` | bit 12, bersama scancode `0x46` | **Ctrl-Break** — cocok dengan string `"USE Ctrl Break TO ABORT"` |
| `CS:3512` | bit 11 **dan** 12, di handler tombol Del | **Ctrl-Alt-Del** → reboot hangat (`[0x472] = 0x1234`, lalu `jmp FFFF:0`) |
| `CS:2859` | bit 8 | **Space** ditahan |

Ctrl dan Alt tidak punya aksi sendiri — kedua entrinya menunjuk
`key_action_done`. Mereka ada semata agar tercatat di bitmap supaya
kombinasinya bisa diuji.

**Aritmetika kedekatan sekali lagi:** `key_action_table` berisi 14 entri dua
word (make lalu break) dan berakhir di `0x3573 + 56 = 0x35AB` — tepat `kbd_head`.
Pemindaiannya meminta 15 byte terhadap tabel 14 entri, jadi slot terakhirnya
adalah byte rendah pointer pertama tabel itu sendiri (`0x12`, scancode E).
Kecocokan di situ menyisakan `CX = 0` dan `jcxz` di `CS:3403` memperlakukannya
sebagai tidak ketemu — jadi limpahan itu tidak bisa dispatch. **Lima belas
dipindai, empat belas bisa menyala.**

### Bartender tidak beranimasi — dan sebabnya kerusakan mode tampilan

Pemain adalah dua record 32×16 bertumpuk yang pointer sprite-nya diisi
`lookup_ptr_pair` (`CS:2E1E`). Rutin itu memeriksa indeks terhadap word jumlah
di kepala tabel, dan bila indeksnya kelewat besar ia **diam-diam membiarkan
pointer lama**:

```
cmp word [cs:bx], ax      ; 2E35  jumlah entri vs indeks
jb  short (lewati)        ; 2E38  kelewat besar -> tidak menulis apa pun
```

Pada game apa adanya itulah yang terjadi. Pemain meminta indeks sprite **13**,
`ptr_table_a` hanya berisi **7** entri, dan permintaan itu ditolak — 208 kali
dalam satu run 3 juta instruksi. Bartender tidak pernah berganti pose.

Penyebabnya `CS:0776`, yang bercabang berdasarkan basis skrip layar, sehingga
kedua mode membangun tabel sprite lewat jalur berbeda:

| | `ptr_table_a` | Stride |
|---|---|---|
| mode 1 (apa adanya) | **7 entri** | `0x1C0` |
| mode 0 (dipaksa) | **66 entri** | `0x80` |

`0x80` persis yang diasumsikan `blit_sprite_32x16`: ia membaca data di `[bp]`
dan mask di `[bp+0x80]`, jadi dengan stride `0x80` mask sprite ke-*i* adalah
entri *i+1* — dan itu juga sebabnya `lookup_ptr_pair` mengisi word 0 dan word 2
record dari **entri berurutan**. Tabel stride `0x1C0` tidak bisa memenuhi itu.

Jadi rangkaiannya menyambung: prompt mode dibuang crack → mode ditentukan byte
rendah segmen muat → di mode 1 tabel sprite dibangun jalur pendek → indeks
sprite pemain di luar jangkauan → bartender beku. Merender pointer mode 1
sebagai sprite pun menghasilkan derau, karena stride-nya memang tidak cocok.

`tools/render_player.py` memaksa mode 0, membiarkan game membangun tabel yang
benar, lalu membaca sprite-nya per indeks. Hasilnya `screens/bartender.png` —
enam pose dari entri 19…42.

### Katalog sprite dan kepemilikan entri

`tools/sprite_sheet.py` menutup dua hal sekaligus. Ia merender **seluruh 65
entri** tabel mode 0 ke `screens/sprites.png`, dan sekaligus **menurunkan**
kepemilikan alih-alih menebaknya dari gambar.

Kepemilikan itu bisa diturunkan karena setiap pointer sprite dipasang lewat
salah satu dari dua rutin — `lookup_ptr_pair` (`CS:2E1E`) dan
`set_entity_sprite` (`CS:2E53`) — dan keduanya menerima **record di BP** dan
**indeks di AL**. Record-nya sendiri sudah bernama. Jadi mengait keduanya
langsung memberi peta "record ini meminta indeks itu".

Hasil satu run mode 0 sepanjang 60 juta instruksi:

| Indeks | Diminta oleh |
|---|---|
| 1 | `player_top`, entity bar 0 slot 0, entity bar 2 slot 0 |
| 3 | `player_bottom` |
| 11 | entity bar 1 slot 0, entity bar 3 slot 0 |

Dua hal langsung terlihat. Indeks 1 dan 3 memang milik pemain — cocok dengan
yang dulu saya temukan dengan melihat. Dan **kepemilikannya tidak eksklusif**:
indeks 1 dipakai `player_top` *dan* entitas, jadi tabel ini bukan "blok per
aktor" melainkan kumpulan bersama.

**Batas yang jujur:** run itu baru menyentuh awal satu ronde, jadi hanya tiga
indeks yang sempat diminta. Frame bartender berlari di entri 19…42 terlihat
jelas di lembar sprite, tapi **belum ada satu pun run yang memintanya** — jadi
identifikasinya masih visual, bukan turunan. Yang berubah: mekanismenya kini
ada, tinggal butuh run yang masuk lebih dalam ke permainan.

Membaca lembar sprite-nya, isi bank ini terbaca berurutan: pasangan
data/mask bergantian (ganjil data, genap mask), bartender di awal, figur
berlari di tengah, wajah-wajah pelanggan, lalu ledakan, figur terjengkang, dan
garis-garis kecepatan di ekornya.

### Mode 0 "mandek" di attract loop — ternyata cuma lambat

Mencatat nilai balik `read_key` per panggilan menyelesaikannya, dan hasilnya
membatalkan dua dugaan saya sendiri.

| Mode | Yang diterima loop menu (`CS:099B`) | Hasil |
|---|---|---|
| 1 (apa adanya) | `AL=13` (R), lalu `AL=39` (Space) | permainan mulai |
| 0 (dipaksa) | `AL=13`, lalu `02`, `03`, `04`, `1C` | tidak pernah mulai |

Dugaan pertama saya — terminator skrip layar di `CS:0776` — **salah**. Cabang
itu memang membedakan kedua mode, tapi bukan sebagai terminator: ia memilih dua
jalur setup tabel sprite yang berbeda (lihat bagian bartender di atas).

Dugaan kedua — kehabisan atau kesalahan urutan tombol — juga salah. Dengan
skrip yang isinya Space semua, 293 tombol terkirim dan loop menunya **tetap
hanya berjalan dua kali**. Artinya `read_key` tidak pernah kembali, bukan
menerima tombol yang salah.

Sebabnya aritmetika di timer ISR, dan itu dua pembagi bersarang, bukan satu:

```
dec tick_countdown          ; tiap tick
jne done                    ; ...hanya tiap ke-60 lolos ke sini
mov tick_countdown, 0x3C
cmp key_pending, 0 / je done
dec key_pending             ; jadi sekali per 60 tick
```

Timeout `read_key` dinyatakan dalam satuan `key_pending`, jadi nilai 30 yang
diminta menu berarti **1.800 tick timer** — sekitar 99 detik pada 18,2 Hz. Di
emulator, dengan satu tick tiap 20.000 instruksi, itu **± 36 juta instruksi
untuk satu timeout menu**.

Semua run mode 0 saya sebelumnya 6M–30M instruksi. Semuanya berhenti **sebelum
satu timeout pun selesai**. Yang saya baca sebagai "mandek" sebenarnya menu yang
sedang menunggu, dan mode 0 memperburuknya karena transform per-byte-nya
menghabiskan jauh lebih banyak instruksi per frame.

Prediksinya diuji langsung: satu run mode 0 sepanjang **55 juta instruksi**,
melewati satu timeout penuh.

| | 12M | 55M |
|---|---|---|
| Nilai balik `read_key` di menu | `AL=13` saja | `AL=13`, lalu **`AL=00`** (timeout) |
| Attract demo dimasuki | 0 | **1** |
| Penghitung ronde maju | 0 | **1** |
| `CS:0E0B` membaca `round_param_index` | 0 | **1** |
| Alamat kode berbeda | 826 | **1.777** |

Jadi mode 0 tidak pernah mandek. Ia menunggu, timeout-nya lewat, attract demo
jalan, dan setup ronde berjalan sampai layar saloon terender lengkap dengan
sprite. Item ini ditutup.

**Pelajarannya:** "tidak pernah maju" perlu dibandingkan dengan **skala waktu
internal program**, bukan dengan panjang run yang kebetulan dipakai. Di sini
satuannya tersembunyi di balik dua pembagi bersarang di ISR — dan angka "30"
di call site terlihat kecil sampai satuannya diketahui.

### ISR keyboard kedua yang tidak pernah dipakai

Ada handler lengkap kedua di `CS:32EA`: prolog sama, jalur make dan break sama,
dispatch `(14 − CX) × 4` sama. Bedanya ia memindai `alt_key_scan_table`
(`0x3557`), yang menukar Esc/NumLock/Space dengan **F8/F9/F10** dan menggeser
tombol gerak naik empat bit. Jadi keduanya tidak bisa saling menggantikan —
bitmap yang sama akan berarti tombol yang berbeda.

Tidak ada yang memasangnya. `init` mengarahkan INT 09h ke `int09_keyboard_isr`,
dan menyisir image untuk byte `0x32EA` menemukan **tepat satu** kecocokan:
perbandingan di `read_key`, yang menanyakan apakah `alt_isr_slot` berisi alamat
itu. `alt_isr_slot` sendiri tidak pernah ditulis siapa pun. Tidak ada trace,
polos maupun disuntik, yang pernah mengeksekusi satu byte pun darinya.

Dan uji di `read_key` itu menutup lingkarannya: kalau lolos, ia mengembalikan
scancode `0x13` — huruf **R**, jawaban `'PRESS "R" FOR RGB DISPLAY'`. Jadi
handler alternatif itu dulunya menjawab prompt tampilan secara otomatis.
Ketiganya mati bersama — prompt, handler, dan slot-nya — karena ketiganya satu
fitur, dan crack mencabutnya sampai ke akar.

### Berapa lama satu "tick" — diukur, bukan ditebak

Blok `CS:1099` memegang beberapa pembagi laju, jadi berapa sering ia berjalan
menentukan arti semua angka di sekitarnya. Emulator menjawabnya:

| Alamat | 12M instruksi | 40M instruksi | Arti |
|---|---|---|---|
| `CS:1ED2` | 70.587 | 117.733 | badan loop salin layar, 11× per salinan |
| salinan layar | 6.417 | 10.703 | = `1ED2` ÷ 11, tepat habis dibagi |
| `CS:1099` | 6.420 | 10.708 | **satu kali per salinan layar**, plus 3/5 pass ekstra dari kematian |
| `CS:10DE` | 401 | 669 | pembagi habis = pass ÷ 16 ✓ |
| `CS:1F71` | 6.417 | 10.703 | uji `abort_sequence_flag`, sekali per frame, tak pernah bercabang |

Jadi `popup_tick_divider` benar-benar membagi 16, dan popup skor bertahan
**1.024 salinan layar**. Mengubahnya jadi detik masih perlu timing siklus yang
tidak dimodelkan emulator — tapi angka tick-nya kini terukur, bukan diasumsikan.

### Tip: dua penghitung yang menarik ke arah berlawanan

Ekor `alloc_node_to_bar_list` adalah gerbang kemunculan tip:

```
dec pickup_spawn_countdown / jne selesai
isi ulang dari pickup_spawn_reload
pickup_popup_timer sibuk?  -> selesai
sudah ada pickup tertunda? -> tempatkan saja
pickup_budget == 0         -> selesai
dec pickup_budget, lalu tempatkan
```

Keduanya di-set per ronde, dan menariknya ke arah berlawanan:

| Ronde | `pickup_spawn_reload` | `pickup_budget` |
|---|---|---|
| 0 | 2 | 1 |
| 1 | 3 | 2 |
| 2 | 4 | 4 |
| 6 ke atas | 7 (mentok) | 4 (mentok) |

Jeda antar-tip **memanjang** sementara jatah tip per ronde **bertambah**. Bukan
sekadar "makin sulit" atau "makin murah hati" — dua parameter terpisah dengan
arah berbeda.

### Joystick — kalibrasi menentukan anggaran sampling

`read_joystick_axes` (`CS:32C2`) memakai metode game-port PC standar: tulis ke
port `0x201` untuk memicu one-shot, lalu baca berulang dan hitung berapa lama
bit 0 dan 1 bertahan tinggi. Jumlah iterasinya diambil dari
`joystick_sample_count` (`0x4489`).

`calibrate_joystick` (`CS:31A3`) yang mengisinya:

1. Set `joystick_sample_count` = `0xFF` (anggaran maksimum)
2. Baca sekali; bila `BL` masih `0xFF`, stik tidak menjawab dalam anggaran itu →
   tampilkan `str_no_joystick` (`"JOYSTICK NOT FOUND"`) dan berhenti
3. Bila menjawab, tiga prompt dan tiga pembacaan berurutan
4. `CS:3263` menyetel `joystick_sample_count` dari kedua maksimum itu

Ketiga pembacaan itu yang menutup slot terakhir:

| Prompt | Disimpan ke |
|---|---|
| `"MOVE THE JOYSTICK TO THE TOP LEFT HAND CORNER…"` | `joystick_low` (`0x44B1`) |
| `"…TO THE MIDDLE…"` | `joystick_centre` (`0x44B3`) |
| `"…TO THE LOWER RIGHT HAND CORNER…"` | `joystick_high` (`0x44B5`) |

Ini sekaligus menuntaskan koreksi lama `joystick_center`. `0x44B1` memang batas
bawah sepasang ambang — dan pembacaan tengah yang sesungguhnya ternyata variabel
tak bernama tepat di sebelahnya. Ia dipakai **hanya saat kalibrasi**: `CS:3212`
menarik `joystick_high` seperempat jalan ke arahnya untuk membuka zona mati.

Prompt-nya sendiri tiga baris masing-masing, dengan warna per baris diambil dari
`prompt_colour_table` (`0x3EF3`). Tabel itu 9 byte — 3 prompt × 3 baris — dan
berakhir **tepat** di `0x3EFC`, tempat teksnya mulai.

Jadi anggaran sampling **dipaskan ke stik yang benar-benar terpasang**, bukan
konstanta. Pemanggil di `CS:09B8` (scancode `0x24`, huruf J) memeriksa setelahnya
apakah nilainya masih `0xFF`; kalau ya, kalibrasi gagal dan `input_enabled`
dinyalakan lagi — kembali ke keyboard.

**Satu kecerobohan yang tidak menggigit.** `joystick_sample_count` byte, tapi
dimuat dengan pembacaan word (`mov cx, word [cs:0x4489]`), jadi `CH` berasal
dari `timer_reentry_guard` di sebelahnya. Aman karena guard bernilai 0 di luar
ISR dan rutin ini berjalan dengan interrupt mati — tapi kedua variabel itu tidak
berhubungan sama sekali. Pola yang sama muncul di `player_death_sequence`.

### `abort_sequence_flag` — cabang yang tak pernah diambil

`0x4487` dibaca di dua tempat dan keduanya berarti "sudahi urutan ini sekarang":

| Tempat | Efek bila flag diset |
|---|---|
| `CS:1F71` | lewati pemindaian 16 slot entitas, langsung ke bonus bar-bersih |
| `CS:2A9E` (`check_bonus_abort`) | keluar dari ronde bonus, lompat ke `CS:0BE3` |

**Tidak ada yang pernah menyetelnya.** Menyisir seluruh image untuk byte operand
`87 44` menemukan tepat empat lokasi: dua `cmp ... , 0` dan dua `mov ... , 0` —
yaitu keempat site di atas. Jadi kedua pintasan itu kode mati, dan pemeriksaan
bar-bersih selalu jatuh ke pemindaian entitas.

Satu-satunya NOP sled di binary ada di `CS:0649` dan `CS:065B` (6 dan 19 byte),
di dalam `init` — persis tempat crack membuang kode. Penulis flag ini bisa saja
termasuk yang dibuang. Itu hipotesis yang tidak bisa diselesaikan dari binary
ini, bukan kesimpulan.

### Struktur entitas — terpecahkan

`update_moving_entities` (`CS:1570`) memajukan dan menggambar ulang empat
entitas bergerak. Entitas berukuran **16 byte**, array-nya ditunjuk oleh
`entity_array_ptr` (`0x44F8`).

| Offset | Ukuran | Isi |
|---|---|---|
| `+0x00` | word | pointer data sprite (diteruskan ke blitter lewat `BP`) |
| `+0x02` | word | pointer kedua dari pasangan, ditulis bersama `+0x00` oleh `lookup_ptr_pair` |
| `+0x04` | word | offset layar = posisi |
| `+0x06` | byte | flag; bit 0 menandai slot aktif |
| `+0x07` | byte | pencacah animasi |
| `+0x08` | byte | komponen posisi sekunder |
| `+0x09` | byte | di-set saat init dari `entity_init_table` (`CS:0E68`) |
| `+0x0A` | byte | indeks frame animasi |
| `+0x0B` | byte | indeks sprite dasar |
| `+0x0C` | byte | pencacah mundur ketiga; `dec` di `CS:1641`, isi ulang di `CS:1664` dari nilai yang dilipat dua |
| `+0x0D` | byte | pencacah aksi |
| `+0x0E` | byte | kecepatan, ditambahkan ke posisi tiap frame |

Bahwa `+0x00` dan `+0x02` diisi **sebagai pasangan** itu penting: entri tabel
aset berselang-seling data dan mask, jadi satu pengambilan pasangan menghasilkan
kedua paruh dari satu sprite, bukan dua pointer yang tak berhubungan.

### Tiga pencacah per entitas

Satu entitas membawa tiga pencacah mundur independen, masing-masing dengan
sumber isi ulang berbeda:

| Field | Fungsi | Sumber isi ulang |
|---|---|---|
| `+0x07` | animasi | 2, atau nilai bergantung bar (`CS:12DB`) |
| `+0x0C` | — | nilai dilipat dua (`CS:1662`) |
| `+0x0D` | aksi | `entity_tick_reload` |

Ketiganya yang memungkinkan satu entitas beranimasi, berubah state, dan
bertindak pada tiga ritme berbeda tanpa penjadwal per-entitas sama sekali.

### Keenam belas byte tuntas

`+0x05` dan `+0x0F` tidak pernah dirujuk di mana pun, dan memang tidak perlu:
`+0x05` adalah byte tinggi dari word posisi di `+0x04`, sementara `+0x0F` adalah
padding yang membulatkan record ke 16 byte agar stride `add bp, 0x10` pas.

Tiga word + sembilan byte + satu padding = tepat 16.

Tiap slot aktif digambar dengan `blit_sprite_16x16`, dipanggil dua kali dengan
`xor di, 0x2000` di antaranya.

### Array entitas berbasis bar

`CS:1194` menghitung pointer array: `bp` digeser kiri enam kali (**×64**) lalu
ditambah basis `entity_table` (`0x4583`). Karena entitas 16 byte, 64 byte =
**4 slot**, dan setiap loop atas array ini memakai `mov cx, 4`.

```
entity_array_ptr = entity_table + bar_index * 64
```

Indeks yang sama, dikali 2, disimpan terpisah di `bar_index_x2` (`0x44F6`).

Empat slot per bar, masing-masing dengan posisi, kecepatan, dan frame animasi
sendiri, cocok dengan aturan yang terdokumentasi bahwa satu bar menampung
maksimal empat pelanggan. Layout-nya teramati; siapa yang menempati slot itu
disimpulkan dari kecocokan tersebut, bukan dikonfirmasi saat runtime.

### Pemain adalah empat record berbentuk entitas

Basis kedua di `0x4683` — tepat `0x100` dari `entity_table`, yaitu 16 entitas —
dulu dicatat sebagai "kemungkinan array sejenis untuk aktor lain". Ternyata itu
**pemainnya**, dan bukan satu record melainkan empat:

| Alamat | Isi |
|---|---|
| `player_top` (`0x4683`) | separuh atas sprite pemain |
| `player_bottom` (`0x4693`) | separuh bawah |
| `player_prev_top` (`0x46A3`) | posisi sebelumnya, untuk menghapus |
| `player_prev_bottom` (`0x46B3`) | idem |

Yang mengunci pembacaan ini adalah `advance_player_bar` (`CS:2044`–`CS:20C3`):

- `+4` dari record atas diisi `bar_row_top`, `+4` record bawah diisi
  `bar_row_bottom` — makanya "atas" dan "bawah"
- `CS:2089` menyalin `[bp+4]` ke `[bp+0x24]` dan `[bp+0x14]` ke `[bp+0x34]`,
  yaitu posisi sekarang → posisi sebelumnya, tepat sebelum pemain dipindahkan
- bit 3 dari `player_prev_top_flags` menandai "ada gambar lama yang perlu
  dihapus"; `CS:2047` mengujinya lalu `CS:2081` menyetelnya

Layout 16 byte-nya sama persis dengan entitas biasa, jadi field-nya ikut
bernama: `player_column` (`0x468B`) adalah `+0x08`, dan `player_velocity`
(`0x4691`) adalah `+0x0E`.

**Koreksi.** `0x4691` sebelumnya bernama `input_flag_right`. Ia memang ditulis
handler tombol kanan, tapi bukan flag yang ditafsirkan kode lain kemudian — ia
**field kecepatan record pemain**. Handler menulis `+1` di `CS:34A0`, `−1` di
`CS:34CA`, dan `0` saat tombol dilepas; jadi ISR keyboard menyetir kecepatan
pemain langsung. Petunjuknya sudah ada di dokumentasi lama ("disalin ke field
kecepatan sebuah entitas" di `CS:1482`) — yang tidak dilakukan hanya memeriksa
apakah `0x4691` sendiri sudah berada di dalam sebuah record entitas.

**Koreksi:** sesi sebelumnya saya menduga keempat slot ini adalah gelas yang
meluncur. Setelah perhitungan indeks per-bar terbaca, pembacaan "pelanggan"
jauh lebih didukung.

Stride 16 byte yang sama muncul di banyak tempat lain (`add bp, 0x10`,
`add bx, 0x10`), dengan field tambahan yang terlihat diakses: `+0x08` komponen
posisi dan `+0x0A` indeks frame animasi. Di `CS:15A5` sebuah delta diterapkan ke
entitas `bp` **dan** `bp+0x10` sebelum keduanya digambar — sosok dua bagian,
kemungkinan bartender.

### Pemutar suara

`tick_sound_voice` (`CS:397C`) memajukan satu voice per tick: byte 0 deskriptor
adalah state (0 = idle), state lain di-dispatch lewat `voice_state_table`
(`0x3990`). Timer ISR memanggilnya untuk tiga deskriptor di `0x3731`, `0x373E`,
`0x374B`.

Dua struktur independen kini sepakat bahwa ini memang subsistem suara: tiga
voice di `start_sound_effect` (stride 8) dan tiga kanal yang di-tick tiap frame
di sini.

#### Dua perangkat audio, bukan satu

Menamai label internal mesin suara membuka sesuatu yang tidak pernah muncul
sebelumnya: **game ini mendukung dua perangkat**, dan `sound_flags` bit 1 yang
memilihnya — persis opsi `"EXTERNAL SOUND"` di menu.

| Bit 1 | Perangkat | Cara tulis |
|---|---|---|
| kosong | PC speaker | periode ke PIT kanal 2 lewat port `0x42`, gerbang dinyalakan lewat bit 0 port `0x61` |
| set | chip suara di port `0xC0` | byte latch + byte data, nomor kanal di bit 5–6 |

`DH` masuk sebagai `0x80`, `0xA0`, atau `0xC0` dari timer ISR — satu per voice.
Port dan protokol itu **TI SN76496**, chip yang dibawa PCjr dan Tandy 1000. Itu
sekaligus menjelaskan `sound_chip_volume`: menulis `0x10` + kanal + nibble
terbalik adalah register atenuasi chip tersebut, jadi rutin itu **ramp volume**,
bukan penulisan nada lagi.

Tiap perangkat punya tabel nadanya sendiri, dipilih di `voice_note_on`:
`speaker_period_table` (`0x3BC0`) untuk PIT dan `chip_period_table` (`0x3BDC`)
untuk chip, keduanya diindeks `nada × 2` lalu digeser kanan sebanyak oktaf. Dua
tabel karena kedua perangkat membagi clock yang berbeda.

Ini menutup satu hal lain juga: `0x3BAC`, salah satu dari empat "site
`call word ptr [bx+si]`" yang dulu dikira kode, memang data suara — dan sekarang
tetangganya di `0x3BC0` dan `0x3BDC` punya nama.

### Field state entitas (`+0x06`)

Bukan sekadar flag aktif, melainkan **bitfield state** yang ditulis di 24 lokasi
berbeda. Bit 0 = aktif (dibaca oleh `update_moving_entities`); bit 1–6 dipakai
sebagai penanda state lain yang belum dipetakan artinya.

Tiga lokasi menulis **seluruh byte** alih-alih OR/AND — pola inisialisasi:
`CS:0EB1` (`= 9`), `CS:0F7F` dan `CS:207D` (`= 8`).

### Inisialisasi entitas

Loop di `CS:0E63`–`CS:0EBB` mengisi slot berurutan (`add bp, 0x10`): menulis
posisi ke `+0x04`/`+0x08`, mengambil nilai dari `entity_init_table` (`0x41AD`),
memilih sprite, lalu menetapkan state `+0x06 = 9`.

### Jalur input ke gerakan

`CS:145A`–`CS:1460` menghitung kecepatan dari nilai 0/1:

```
mov ah, al / shl ah, 1 / dec ah      ; 0 -> -1, 1 -> +1
mov [bp+0xe], ah
```

Jadi `+0x0E` menyimpan **arah** ±1, bukan besaran kecepatan bebas.

Rantainya tersambung penuh dengan penanganan tombol: `key_action_right`
(`CS:3499`, dari scancode Right dan `;`) menaikkan `input_flag_right`
(`0x4691`), dan `CS:1482` membaca flag itu langsung ke field `+0x0E` sebuah
entitas. `key_action_down` (`CS:348B`) melakukan hal setara lewat
`input_flag_down` (`0x4521`).

### AI — perilaku otonom

Dua titik keputusan ditemukan lewat penyaringan: dari 24 penulis field state
`+0x06`, cari yang **tidak** berada di jalur input, lalu silangkan dengan lima
pemanggil `advance_rng` (`133A`, `1DC7`, `2466`, `267F`, dan `3791` di timer
ISR). Perubahan state tanpa input, ditambah randomness, adalah tanda AI.

**`apply_knockback` (`CS:132C`)** — dorongan mundur:

```
mov al, [bp+0x0E]   ; kecepatan
neg al              ; balik arah
sar al, 1           ; setengahkan besarnya
```

Membalik lalu menyetengahkan adalah cara pelanggan terdorong mundur saat
terkena gelas. Penyetengahan itu juga yang membuat dorongan makin pendek
seiring permainan berlanjut — kurva kesulitan yang terdokumentasi di
[GAME.md](GAME.md). Hanya dimasuki bila bit state 5 menyala.

**`entity_random_step` (`CS:1DBA`)** — langkah acak per-entitas. Menyusuri grup
dengan `add bp, 0x10`; untuk slot yang lolos uji bit, memanggil `advance_rng`,
mencampur kedua paruhnya dengan `xor al, ah`, lalu menyimpan satu bit — lemparan
koin berimbang. Bila lolos, indeks sprite di `+0x0B` maju 8, bit state 2 menyala
dan bit 6 padam.

Ini perilaku otonom: tidak ada input yang mencapainya, dan hasilnya ditentukan
RNG.

### Aktivasi slot

`CS:1B43`–`CS:1B51` mengaktifkan slot yang belum aktif: menyalakan bit 0,
menetapkan `+0x0B = 0x1F` dan `+0x07 = 1`. Dijaga oleh uji "sudah aktif?"
sehingga satu slot tidak diaktifkan dua kali.

### Ronde bonus — seleksi acak tanpa pengulangan

**`reroll_distinct_pick` (`CS:2466`)** mengambil lima nilai berbeda dari 0..7.
`picked_bitmap` (`0x4528`) dimulai dari `0xC0` sehingga bit 6 dan 7 sudah
ditandai dan undian efektif berjalan pada 0..5. Tiap putaran mengambil
`advance_rng` modulo 8, menguji bitnya, dan mengulang undian bila nilai itu
sudah terpakai; bila belum, bit ditandai dan nilainya disimpan di
`last_random_pick` (`0x4527`). Pemanggilnya berputar lima kali.

Lima benda dipilih tanpa pengulangan cocok dengan ronde bonus, tempat sosok
bertopeng mengocok lima kaleng.

**`reroll_spaced_pick` (`CS:267F`)** serupa, tetapi kandidat juga ditolak bila
bit di kiri atau kanannya sudah menyala — posisi terpilih tidak pernah
bersebelahan. Pemanggilnya berjalan 16 putaran: penyebaran dengan jarak minimum.

### Seluruh konsumen RNG terpetakan

| Pemanggil | Fungsi |
|---|---|
| `CS:3791` | timer ISR — memajukan RNG tiap tick |
| `CS:133A` | `apply_knockback` |
| `CS:1DC7` | `entity_random_step` |
| `CS:2466` | `reroll_distinct_pick` — ronde bonus |
| `CS:267F` | `reroll_spaced_pick` — penyebaran berjarak |

### Urutan halaman — 27 entri yang menggerakkan seluruh permainan

`page_index` (`0x44D1`) menunjuk urutan **27 halaman**. Tiga tabel berjalan
darinya dan ketiganya bersambung tanpa celah:

| Tabel | Alamat | Isi |
|---|---|---|
| `page_screen_table` | `0x40CE` | id layar/aset; `0` berarti halaman tanpa layar |
| — | `0x40E9` | `0xFF`, terbaca sebagai lookup `+1` pada halaman 26 |
| `page_theme_table` | `0x40EA` | bar keberapa (0…3) |
| `round_spawn_table` | `0x4105` | di sinilah tabel ronde mulai |

`0x40CE + 27 = 0x40E9` dan `0x40EA + 27 = 0x4105` — kedua batas menutup persis.

Isi `page_screen_table`:

```
idx : 0  1  2  3  4  5  6  7  8  9 10 11 12  13 14  15 16 17  18 19 20 21 22 23 24 25 26
val : 1  1  0  2  2  2  0  3  6  3  6  0  4 132  5 133  0  1 129  0  2  2  2  0  3  6  3
```

Enam halaman bernilai 0 (idx 2, 6, 11, 16, 19, 23) — itulah halaman tanpa layar,
dan justru merekalah yang membuat 27 halaman menghasilkan 21 ronde.

#### Bukan sekuensor teks: satu tabel dibaca dua kali

`show_next_page` (`CS:0BE8`) memuat `SI` dengan alamat string **tetap**
`str_get_ready` (`0x3ED5` = `"GET READY TO SERVE"`) lalu memuat `DI` dengan
`page_index` hanya untuk satu uji:

```
mov si, str_get_ready
mov di, word [cs:page_index]
cmp byte [cs:di + next_page_screen], 0
je  short (lewati)
call near print_string_at
```

`print_string_at` hanya memakai `SI` — `DI` tidak disentuh sama sekali. Jadi
`DI` bukan pemilih string, dan `next_page_screen` (`0x40CF`) itu
`page_screen_table + 1` yang dibaca dengan indeks **sebelum** dinaikkan. Dua
alamat, satu tabel, satu halaman: uji ini menanyakan apakah halaman yang akan
dijalankan punya layar, dan `load_page_screen` membaca entri yang sama persis
setelah indeksnya naik.

Pesannya sendiri berakhir tepat di `0x3EEB`, alamat `row_offset_table` — string
27 karakter yang menutup rapat ke tabel berikutnya.

**Koreksi.** Tiga nama sebelumnya (`text_page_table`, `text_page_param`,
`text_page_index`) lahir dari satu asumsi yang sama: bahwa `DI` memilih string.
Tidak ada yang memverifikasi asumsi itu ke `print_string_at`, dan sekali nama
pertama salah, dua tetangganya ikut. Lihat `PLAYBOOK.md` bagian 7.7.

### Kesulitan yang menanjak — tabel per-ronde, diindeks penghitung ronde

Kesulitan Tapper memang **digerakkan data**: parameter per-bar dibaca dari tabel
statis, bukan dihitung. Yang lama menggantung adalah pertanyaan berikutnya —
*apa yang memilih baris mana yang dipakai*. Jawabannya `round_param_index`
(`0x44D3`), dan bersamanya ada penghitung ronde `round_number` (`0x44C7`).

Keduanya mulai dari −1 (`0xFFFF` di `CS:0B34`, `0xFF` di `CS:0B40`) dan
dinaikkan bersama di `begin_round` (`CS:0D7A`), sekali per ronde:

```
inc word [cs:round_param_index]
inc byte [cs:round_number]
```

`round_param_index` mengindeks dua tabel, satu baris per ronde:

| Tabel | Alamat | Ukuran baris | Isi |
|---|---|---|---|
| `round_spawn_table` | `0x4105` | 8 byte = 4 bar × word | byte tinggi: jumlah pelanggan yang muncul di bar itu; byte rendah: arah datang, `+1` atau `-1` |
| `entity_init_table` | `0x41AD` | 32 byte = 4 bar × 4 entitas × word | byte rendah: tipe pelanggan, ditulis ke indeks sprite dasar entitas di `+0x0B` (`CS:0E9F`) dengan arah di-OR ke bit teratas. Hanya delapan nilai muncul, berjarak `0x0A`: `0x01 0x0B 0x15 0x1F 0x29 0x33 0x3D 0x47`. Byte tingginya nol di semua baris |

**Keduanya tepat 21 baris**, dan aritmetikanya menutup persis seperti pada
`init_free_list`: `0x4105 + 21*8 = 0x41AD`, yaitu awal `entity_init_table`, dan
`0x41AD + 21*32 = 0x444D`, tempat data berubah jadi nol. Jadi game ini punya
**21 ronde parameter**.

Menyusuri barisnya memperlihatkan ramp-nya: ronde 0 memunculkan satu pelanggan
per bar, ronde 8 memunculkan empat, dan tipe pelanggan menanjak `0x01` → `0x0B`
→ `0x15` … → `0x47` sebelum campurannya dimulai lagi di baris 13.

#### 21 baris = 13 layar satu siklus, lalu 8 baris siklus kedua

Tipe pelanggan berganti di batas yang rapi, dan **ukuran kelompoknya cocok
dengan jumlah layar per tema** yang tercatat di [GAME.md](GAME.md#3-level) —
dari sumber yang sepenuhnya lain, deskripsi game yang dipublikasikan:

| Baris | Tipe pelanggan | Jumlah baris | Halaman | `page_theme_table` |
|---|---|---|---|---|
| 0–1 | `0x01` / `0x0B` | 2 | 0, 1 | 0 — Saloon Western |
| 2–4 | `0x15` / `0x1F` | 3 | 3, 4, 5 | 1 — Bar olahraga |
| 5–8 | `0x29` / `0x33` | 4 | 7, 8, 9, 10 | 2 — Bar punk rock |
| 9–12 | `0x3D` / `0x47` | 4 | 12, 13, 14, 15 | 3 — Bar luar angkasa |
| 13–14 | `0x0B` / `0x01` | 2 | 17, 18 | 0 — siklus kedua |
| 15–17 | `0x15` / `0x1F` | 3 | 20, 21, 22 | 1 |
| 18–20 | `0x29` / `0x33` | 3 | 24, 25, 26 | 2 |

Baris 0–12 berjumlah **13** — tepat "13 layar per siklus penuh", dengan pola
2/3/4/4 pada urutan yang sama. Dua tipe per tema, berjarak `0x0A`, kemungkinan
dua varian sprite pelanggan.

Kolom terakhir bukan tebakan lagi. `page_theme_table` (`0x40EA`) berisi indeks
bar 0…3 per halaman, dan setelah keenam halaman tanpa layar dibuang, urutannya
**cocok baris demi baris** dengan pengelompokan tipe pelanggan di
`entity_init_table` — untuk seluruh 21 baris. Dua tabel di bagian binary yang
berbeda sepakat pada urutan bar yang sama; masing-masing sendirian tidak akan
cukup.

Yang masih disimpulkan dari urutan, bukan dari sprite yang dirender, hanyalah
nama temanya (Western/olahraga/punk/angkasa). Yang dibuktikan data adalah
pengelompokan 2/3/4/4 dan kesepakatan kedua tabel itu.

#### Kenapa indeks ronde tidak pernah melewati baris ke-21

`begin_round` hanya menaikkan `round_param_index` bila `screen_index_flags`
bukan 0 — yaitu bila halaman itu memang memuat layar. Halaman yang entri
`page_screen_table`-nya nol memakan satu halaman tapi bukan satu ronde. Itu gigi
penghubung antara `page_index` (0…26) dan indeks ronde (0…20): dari 27 halaman,
enam tidak berlayar, jadi tersisa **21 halaman berlayar = 21 baris tabel ronde**.

Saat halaman membungkus, `show_next_page` tidak mengembalikannya ke 0 melainkan
ke 10, setelah menghitung entri non-nol pada sembilan entri pertama
`page_screen_table` dan menyimpan hasilnya — **7** — ke `round_param_index`. Itu
persis nilai yang dipegang `round_param_index` sesaat sebelum halaman 10
dijalankan pada putaran pertama: halaman 0…9 punya delapan entri non-nol, dan
−1 + 8 = 7. Jadi pembungkusan bukan mereset progres, ia memutar ulang kedua
penghitung ke keadaan yang dilihat halaman 10 dulu, lalu game mengulang halaman
10…25 tanpa batas.

**Baris 20 tak terjangkau — dan sekarang alasannya konkret, bukan aritmetika.**
Ronde berpadanan satu-satu dengan halaman berlayar, dan baris 20 milik halaman
26. `show_next_page` memeriksa `cmp si, 0x1A` lalu membungkus **sebelum** halaman
26 dijalankan, jadi baris terakhir kedua tabel ronde memang tidak pernah dipakai.

Mati kehilangan nyawa juga tidak menggeser penghitung: `restart_round_after_death`
melompat ke `CS:0D84`, di dalam `begin_round` tapi sesudah kedua `inc`.

`round_number` sendiri yang membuktikan namanya: `CS:101A` memecah
`round_number + 1` jadi puluhan dan satuan lalu mencetaknya lewat
`print_decimal_digit` di baris 23 — angka ronde di baris status. `CS:1037` dan
`CS:1045` menjepit nilai yang sama ke `0x451F` dan `0x4510`, dan `CS:108D`
menyetengahkan tundaan di `0x4516` begitu ronde mencapai 6.

**Koreksi.** Catatan terdahulu di sini menyimpulkan `0x44D1`/`0x44D3` sebagai
"sekuensor teks attract mode" dan menyatakan tidak ada penghitung level di
program ini. Untuk `0x44D3` itu salah, dan untuk `0x44D1` tidak lengkap —
keduanya berpasangan dengan ronde, bukan hanya dengan halaman teks. Penyebabnya
satu: yang dibaca cuma pemakai yang sudah dikenal. `0x44D3` dilihat dari
`show_next_text_page` saja, sedangkan pembacanya yang menentukan ada di
`CS:0E0B`. Ramp per-frame di
`tighten_difficulty` (penghitung milestone `0x452F`) tetap benar — ia bekerja
*di dalam* satu ronde, dan `begin_round` memegang separuh per-ronde dari kurva
kesulitan.

Sisa jalur yang ditelusuri dan tetap berlaku:

| Jalur | Hasil |
|---|---|
| Kelima pemanggil `advance_rng` | Semua teridentifikasi; tidak satu pun mengubah parameter kesulitan |
| Penulis `bar_limit_table` | Hanya satu, di `CS:0EC8` — menyalin dari tabel statis `bar_limit_source` (`0x404A`) saat inisialisasi |

### Kesulitan awal — tangga bertingkat

`apply_difficulty` (`CS:0B5D`) dijalankan di awal permainan. Bentuknya cascade,
bukan switch: nilai dasar ditulis lebih dulu, lalu tiap tingkat jatuh ke bawah
menambah perubahannya sendiri.

```
semua tingkat  lives = 4, next_bonus_score = 1
cmp difficulty, 0    -- BEGINNER berhenti di sini
ARCADE ke atas next_bonus_score = 2, lives = 2, ...
cmp difficulty, 1    -- ARCADE berhenti di sini
EXPERT         sepuluh penulisan tambahan
```

`difficulty` (`0x448D`) menyimpan pilihan menu: 0 = `BEGINNER`, 1 = `ARCADE`,
2 = `EXPERT`.

Setiap penulisan di rutin ini mendarat di blok progres 15 byte
(`round_number`) atau di slot simpanan pemain 2 (`p2_saved_block`) — itulah
sebabnya penulisannya berpasangan berjarak `0x1E`, yaitu dua lebar slot.

Yang menarik, EXPERT tidak hanya mengetatkan batas: ia **memulai permainan di
tengah tangga ronde** — `round_number` dan `round_param_index` di-set `0x0C`
untuk pemain 1 dan `0x0D` untuk pemain 2, jadi ronde awalnya 13. Itu alasan
kedua penghitung ronde ditulis di sini.

`apply_knockback` adalah salah satu mekanisme pengetatan lain — penyetengahan
kecepatan membuat dorongan mundur makin pendek.

### Blok progres pemain — 15 byte, satu aktif dan dua slot simpanan

Yang menyelesaikan layout ini adalah `swap_player_context` (`CS:2FC4`), bukan
pola penulisan `apply_difficulty`:

```
mov di, p1_saved_block          ; 0x44D6
or al, al / add di, 0x0F        ; al = current_player
mov si, round_number            ; 0x44C7, blok aktif
mov cx, 0x0F / repne movsb      ; aktif -> slot[current_player]
...                             ; DI kini menunjuk lewat slot itu
mov di, round_number
mov cx, 0x0F / repne movsb      ; slot yang lain -> aktif
xor byte [current_player], 1
```

Jadi satuannya **15 byte, bukan 30**, dan ada **tiga** blok:

| Alamat | Isi |
|---|---|
| `0x44C7` | pemain yang sedang bermain — satu-satunya yang dibaca kode game |
| `0x44D6` (`p1_saved_block`) | simpanan pemain 1 (`current_player == 0`) |
| `0x44E5` (`p2_saved_block`) | simpanan pemain 2 (`current_player == 1`) |

Offset field, dikonfirmasi karena ketiga blok sepakat:

| Offset | Ukuran | Isi |
|---|---|---|
| `+0x00` | byte | nomor ronde, ditampilkan sebagai +1 (`CS:101A`) |
| `+0x01` | 3 byte | skor BCD (`score_bcd_hi` / `_mid` / `_lo`) |
| `+0x04` | byte | `0xFF` di awal, ditulis sebagai word bersama `+3` |
| `+0x05` | word | `0xFFFF` di awal |
| `+0x07` | word | `score_column` — 1 di blok aktif, `0x21` di slot pemain 2 |
| `+0x09` | byte | `lives` |
| `+0x0A` | word | `text_page_index` |
| `+0x0C` | word | `round_param_index` |
| `+0x0E` | byte | `next_bonus_score` |

Field `+0x07` sempat lama dicatat sebagai "1 di blok aktif, `0x21` di slot pemain
2" tanpa penjelasan. Penamaan label internal menutupnya: `redraw_changed_digits`
(`CS:305B`) memuatnya ke `DX`, dan `DL` adalah **kolom** tempat digit skor
digambar. Jadi 1 dan `0x21` (33) adalah dua posisi berdampingan di baris status
— satu skor per pemain.

Dua silang-uji yang berdiri sendiri mengunci offset yang sama. Pertama, skor
duduk di `+1` pada ketiga blok: `draw_score_display` membaca `score_bcd_hi`,
`p1_saved_score`, dan `p2_saved_score` — yaitu `0x44C8`, `0x44D7`, `0x44E6`.
Kedua, `reset_all_scores` (`CS:0A9F`) mengosongkan ketiganya dengan pasangan
penulisan yang sama — satu word di `+1` dan satu byte di `+3` — di
`0x44C8`/`0x44CA`, `0x44D7`/`0x44D9`, dan `0x44E6`/`0x44E8`.

**Koreksi.** Jarak `0x1E` yang dulu dibaca sebagai "ukuran blok 30 byte"
ternyata cuma `2 × 0x0F` — jarak dari blok aktif ke slot kedua. Ini juga
menjelaskan kenapa `p2_saved_round_param` dan tetangganya punya penulis tapi
tidak punya pembaca: tidak ada yang membacanya lewat alamat, `repne movsb` yang
menukarnya sekaligus.

Anomali `lives` juga ikut selesai. Dulu dicatat "tidak cocok" karena `lives`
di-set 2 sementara padanannya (`p2_saved_lives`) di-set 3. Pola sebenarnya
konsisten: **pemain 2 selalu dapat satu nyawa lebih** — 4/5 di `BEGINNER`, 2/3
dari `ARCADE` ke atas.

Empat site `call word ptr [bx+si]` (`3BAC`, `3E26`, `3E78`, `3EC9`) masih belum
tersentuh saat tracing.

**Catatan metodologi:** memprofil rutin berdasarkan jumlah eksekusi
(`tools/profile_routines.py`) **tidak** menemukan logika game. Puncaknya
seluruhnya rendering dan loop tunggu — `loc_0C86` sendiri memakan 20% waktu
hanya untuk menunggu flag `key_pending`. Logika game berjalan sekali per frame
per entitas, jadi secara struktural tidak akan pernah muncul di puncak profil
semacam itu. Sinyal yang lebih berguna ternyata adalah menelusuri apa yang
dipanggil dari timer ISR.

## Rekonstruksi source — byte-identik

`tools/reconstruct.py` menghasilkan source NASM yang di-assemble ulang menjadi
`TAPPER.COM` **persis byte-per-byte**.

```
SHA256 asli        : EC85DB55A21814E7E08BF3F0270F5CE3DD8B1E34335B7CFE242A9B2E874A42B1
SHA256 reassembled : EC85DB55A21814E7E08BF3F0270F5CE3DD8B1E34335B7CFE242A9B2E874A42B1
fc /b              : no differences encountered
```

### Cara kerjanya (always-green)

Alih-alih membongkar semua lalu berharap cocok, urutannya dibalik: emit
instruksi di bagian yang dipahami dan blob `db` di sisanya, assemble,
bandingkan. Instruksi yang di-encode NASM berbeda dari aslinya **otomatis
diturunkan jadi `db`** dan build diulang. Hasilnya selalu byte-identik, dan
persentase instruksi nyata menjadi metrik kemajuan yang terukur.

Demosi hanya diterapkan pada instruksi di **perbedaan pertama** tiap pass.
Versi awal menurunkan semua byte yang berbeda sekaligus, tapi bila satu
instruksi berubah ukuran maka seluruh byte sesudahnya ikut bergeser — 16.367
byte terlihat "beda" dan 5108 instruksi ikut turun padahal baik-baik saja.

### Status

| Metrik | Nilai |
|---|---|
| Instruksi nyata | 5474 |
| Byte sebagai kode | 13986 / 17920 (**78,0%**) |
| Byte sebagai `db` | 3934 |
| Instruksi yang masih diturunkan | 54 |
| Label simbolik | 578 |
| Blok cross-reference | 544 |
| Rutin bernama | 578 |
| Variabel bernama | 176 |
| Blok komentar rutin | 123 |
| Baris source | 9901 |

Progresi cakupan: 0,2% → 67,6% → 72,2% → 77,7% → 78,0%.

Source ada di `src/tapper.asm`. Build lewat `build.cmd` (Windows) atau
`build.sh` (POSIX); keduanya meng-assemble lalu **memverifikasi byte-identik**
terhadap binary asli, jadi build yang lolos berarti source-nya terbukti benar.

### Perbaikan encoding yang diperlukan

Tiga pola menyebabkan demosi massal, semuanya karena NASM memilih encoding lain
yang sah untuk instruksi yang sama:

| Pola | Masalah | Perbaikan | Perolehan |
|---|---|---|---|
| Cabang pendek | NASM pilih bentuk near (`E9 0D 00`) walau asli short (`EB 0E`) | `jmp short` / `jcc short` eksplisit | 509 → 96 demosi |
| `cwde` | Opcode `98` di mode 16-bit adalah **`cbw`**; capstone memakai nama 32-bit, NASM meng-assemble jadi 2 byte (`66 98`) | Emit `cbw` (dan `cwd` untuk `99`) | 40 instruksi |
| Immediate 16-bit | NASM perpendek jadi sign-extended imm8 bila muat (`3D 00 00` → `83 F8 00`) | `strict word` pada immediate | ~4 instruksi |

### Seed dari eksekusi

Handler interrupt tidak terjangkau recursive descent — tidak ada yang
"memanggil" `INT 09h` di `33A5` atau `INT 1Ch` di `3758`; keduanya dipasang
lewat tulisan ke IVT. Alamat yang tercatat saat emulasi dijamin batas instruksi
yang benar, jadi aman jadi seed. Ini menemukan 214 alamat yang terlewat statis
dan menaikkan cakupan 72,2% → 77,7%.

Seeding dinamis sudah jenuh: memperpanjang run dari 6 juta ke 20 juta instruksi
hanya menambah 87 alamat dan **nol** perbaikan cakupan.

### Demosi tersisa bukan kerugian

Uji promosi bisect (delta debugging) memulihkan **0 dari 102** demosi — tidak
ada demosi palsu; semuanya ketidakcocokan encoding asli. Dari 57 yang tersisa,
35 adalah `add di, di` / `add bh, bh` di `0x40E8`–`0x412E`, yaitu **data yang
ter-decode sebagai kode**. Untuk byte-byte itu `db` justru representasi yang
benar.

## Tooling

| Script | Fungsi |
|---|---|
| `tools/cga.py` | Dekoding framebuffer CGA (2bpp/1bpp, bank interleave) |
| `tools/dump_pic.py` | `TAPPER.PIC` → PNG |
| `tools/probe_dat.py` | Peta `TAPPER.DAT` per track/sektor |
| `tools/disasm.py` | Disassembler recursive-descent, resolusi jump table, 73% |
| `tools/find_stride.py` | Estimasi stride via korelasi vertikal |
| `tools/sweep_layout.py` | Uji hipotesis layout (plain / de-interleave / bank) |
| `tools/render_dat.py` | Render sektor sebagai bitmap 2bpp |
| `tools/emu8086.py` | Interpreter 8086 real-mode |
| `tools/trace.py` | Driver emulator: stub DOS/BIOS, injeksi IRQ, screenshot |
| `tools/extract_sprites.py` | Ekstraksi sprite memakai format hasil blitter |
| `tools/probe_blit.py` | Tangkap ground truth operasi blit |
| `tools/asset_table.py` | Dump direktori aset `CS:05B1`, ekstrak 14 aset |
| `tools/render_assets.py` | Render aset sebagai raster dan sprite bank |
| `tools/reconstruct.py` | Source NASM byte-identik (always-green) |

Terpasang: Python 3.11 + Pillow + capstone, NASM 3.02,
DOSBox Staging 0.82.2, DOSBox-X 2026.07.02.
