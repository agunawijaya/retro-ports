# Playbook: Reverse Engineering Game DOS Abandonware

Panduan operasional untuk Claude Code. Ditulis dari pengalaman membongkar
Tapper (IBM PC, 1984) sampai menghasilkan source assembly yang di-assemble ulang
byte-identik.

**Cara pakai:** tunjuk Claude Code ke dokumen ini dan ke folder game. Tidak perlu
menjelaskan konteks lagi.

> Baca `PLAYBOOK.md` lalu kerjakan game DOS di folder `.\NamaGame`.
> Ikuti fase-fasenya berurutan. Tanya saya di titik keputusan yang ditandai.

---

## 0. Aturan main

Sebelum apa pun, tiga hal yang menentukan kualitas hasil:

1. **Kode adalah kebenaran, statistik adalah tebakan.** Kalau format data belum
   jelas, jangan sweep statistik berlarut-larut — cari rutin yang membaca data
   itu dan baca kodenya. Di proyek Tapper, dua jam sweep stride gagal total;
   sepuluh menit membaca blitter menyelesaikannya.
2. **Verifikasi independen.** Jangan percaya perbandingan dari skrip sendiri.
   Cek ulang dengan `Get-FileHash` / `sha256sum` dan `fc /b` / `cmp`.
3. **Laporkan angka yang jujur.** Kalau cakupan 73%, jangan bilang 78% karena
   ada padding yang ikut terhitung. Metrik yang dipoles bikin keputusan salah.

---

## 1. Fase 0 — Rekonstruksi konteks (15 menit)

Jangan install apa pun dulu. Kenali dulu apa yang dihadapi.

### 1.1 Inventaris file

```powershell
Get-ChildItem -Recurse -File .\NamaGame | Select-Object FullName, Length
```

Catat ukuran. Angka bulat itu petunjuk: 16384 = satu halaman CGA,
kelipatan 512 = image sektor disk, kelipatan 8000 = framebuffer.

### 1.2 Klasifikasi executable

Baca 64 byte pertama:

| Byte awal | Artinya |
|---|---|
| `4D 5A` (`MZ`) | MZ EXE — ada header, relokasi, multi-segmen |
| selain itu | `.COM` — segmen tunggal, `ORG 100h` |

Ciri COM asli: `EB xx` atau `E9 xx xx` di offset 0, dan sering ada
`mov ss,ax` / `mov sp,0100`.

### 1.3 Cek packing

Hitung entropy Shannon per byte:

- **< 6.5** — tidak dipacked, langsung bisa dibongkar
- **> 7.5** — dipacked/terkompresi (LZEXE, PKLITE, EXEPACK). Harus di-unpack
  dulu, atau dump dari memori saat runtime

### 1.4 Ekstrak string

Cari string ASCII ≥ 4 karakter. Ini memberi banyak sekali informasi gratis:
teks menu, pesan error, nama file yang dibuka, dan **batas antara region kode
dan region data** (string biasanya menandai awal data).

### 1.5 Deteksi PC Booter

**Ini pemeriksaan paling penting dan paling sering dilewatkan.**

Hitung pemakaian interrupt di seluruh binary. Kalau `INT 21h` (DOS) hanya
muncul di beberapa tempat di awal/akhir file, sementara badan program penuh
`INT 10h`/`13h`/`16h`/`1Ah` (BIOS), maka aslinya adalah **PC Booter** —
disket self-booting yang tidak memakai DOS sama sekali.

Konsekuensinya besar:

- Game membaca **sektor disk mentah** lewat `INT 13h`, bukan file
- Ada file data yang merupakan **image track disket**
- Salinan yang Anda pegang kemungkinan hasil crack: `.COM` pembungkus yang
  memasang handler interrupt untuk meniru pembacaan disket
- Game memasang **handler interrupt hardware sendiri** (keyboard IRQ1, timer) —
  ini akan jadi masalah besar di fase emulasi kalau tidak diantisipasi

### 1.6 Deteksi assembly tangan vs hasil compiler

Cari pola `50 53 51 52 57 56` (push ax,bx,cx,dx,di,si) dan pasangannya
`5E 5F 5A 59 5B 58`. Kalau banyak, dan tidak ada prolog `55 8B EC`
(`push bp` / `mov bp,sp`) yang konsisten, ini **assembly tulisan tangan**.

Ini menentukan target akhir yang realistis:

| Asal kode | Target yang bisa dibuktikan |
|---|---|
| Assembly tangan | Source ASM yang reassemble byte-identik |
| Hasil compiler C | Bisa dicoba rekonstruksi C + verifikasi `mzdiff` |

**Jangan janjikan "decompile ke C yang rapi" untuk game assembly tangan.**
Tidak ada source C yang bisa dipulihkan karena memang tidak pernah ada.

### 1.7 TANYA PENGGUNA — titik keputusan

Sebelum lanjut, tanyakan target akhirnya:

1. **Pahami format data saja** — cepat, hasil konkret (sprite, level, teks)
2. **Rekonstruksi ASM byte-identik** — endpoint "decompile" yang terbukti
3. **Port modern (C/SDL)** — game jalan di OS sekarang, tanpa bukti byte-level
4. **Dokumentasi/preservasi** — tulis temuan, tidak menambah cakupan

Dan tanyakan izin install software.

---

## 2. Fase 1 — Lingkungan

Install hanya yang dibutuhkan target yang dipilih.

### Wajib untuk semua target

```powershell
python -m pip install capstone Pillow
```

- **capstone** — disassembler; mode `CS_MODE_16` untuk real mode
- **Pillow** — render grafis ke PNG

### Untuk rekonstruksi source

```powershell
winget install --id NASM.NASM -e
```

NASM jalan native di Windows, tidak perlu DOSBox untuk assemble file `.COM`
(`nasm -f bin`). Jauh lebih cepat daripada MASM/TASM di dalam emulator.

### Untuk menjalankan/menguji game

```powershell
winget install --id DOSBoxStaging.DOSBoxStaging -e   # main biasa
winget install --id joncampbell123.DOSBox-X -e       # ada debugger
```

### Yang TIDAK perlu

- **mzretools** — tidak mendukung file `.COM`, dan dirancang untuk game hasil
  kompilasi C (alurnya: tulis ulang di C → compile → `mzdiff`). Untuk game
  assembly tangan, alur itu tidak relevan. Periksa asumsi tool sebelum
  berkomitmen.
- **Ghidra** — decompiler 16-bit real mode-nya lemah menangani segmentasi.
  Untuk binary ≤ 64 KB, tooling Python sendiri + emulator lebih efektif.
- **IDA** — berbayar; tidak memberi keunggulan yang sepadan di skala ini.

### Perkakas yang bisa dipakai ulang

Proyek Tapper meninggalkan `tools/` yang sebagian besar tidak spesifik game:

| Berkas | Bisa dipakai ulang? |
|---|---|
| `emu8086.py` | **Ya, langsung** — interpreter 8086 generik |
| `cga.py` | **Ya, langsung** — dekoding framebuffer CGA |
| `disasm.py` | Ya, sesuaikan `ORG` bila target MZ |
| `reconstruct.py` | Ya, kosongkan `NAMED_*` dan `ROUTINE_DOCS` |
| `trace.py` | Sebagian — `KEY_SCRIPT`, `LOAD_SEG`, probe perlu disesuaikan |
| `audit_symbols.py` | **Ya, langsung** — audit pembaca/penulis per simbol |
| `hot_vars.py` | **Ya, langsung** — peringkat variabel belum bernama |
| `check_docs.py` | Ya, sesuaikan daftar metrik dan nama berkas dokumen |
| `callers.py`, `profile_routines.py` | **Ya, langsung** — konteks call graph, profil eksekusi |
| `watch_entities.py` | Ya, sesuaikan rentang alamat yang diawasi |
| `asset_table.py`, `probe_blit.py`, dll | Template, bukan pakai-langsung |

Menyalin `emu8086.py` saja sudah memangkas pekerjaan berhari-hari.

---

## 3. Fase 2 — Disassembly statis

### 3.1 Recursive descent, bukan linear sweep

Linear sweep akan mendekode region data jadi sampah. Mulai dari entry point,
ikuti `call`/`jmp`/`jcc`, berhenti di `ret`/`iret`/`jmp`.

### 3.2 Resolusi kontrol tak langsung

Recursive descent akan mentok. Cari pola ini:

```
jmp word [bx + 0xNNNN]     ; jump table di 0xNNNN
call word [0xNNNN]         ; function pointer di variabel
jmp bx                     ; dispatch state machine
call word [bx + si]        ; vtable runtime -- TIDAK bisa diselesaikan statis
```

**Ekstraksi jump table:** baca word berurutan dari basis tabel, **berhenti di
entry pertama yang tidak valid** (di luar image, atau tidak decode jadi kode).
Tabel tidak punya penanda panjang; terminatornya struktural. Di Tabel Tapper,
`0x3573` punya 24 entri valid semua, sedangkan `0x3990` hanya 6 — sisanya
ternyata kode biasa yang mengikuti tabel.

### 3.3 JEBAKAN: seeding immediate yang terlalu longgar

**Jangan** memanen semua immediate `mov`/`push` yang jatuh di rentang image
sebagai kandidat entry point. Pointer **data** (`mov dx, 0x102` yang menunjuk
string nama file) sering kebetulan decode jadi instruksi valid. Di Tapper ini
menghasilkan 250 seed palsu dan cakupan **102%** — angka di atas 100% berarti
instruksi bertumpang tindih.

**Hanya** seed dari situs dispatch yang nyata: register yang benar-benar dipakai
di `jmp reg`, dan alamat memori yang benar-benar dipakai di `call [addr]`.

### 3.4 JEBAKAN: mengukur cakupan dengan `sum(instruction.size)`

Itu menghitung ganda saat ada tumpang tindih, dan menyembunyikan seed buruk.
Pakai bitmap byte:

```python
hits = bytearray(len(image))
for addr, ins in seen.items():
    for k in range(ins.size):
        hits[addr - ORG + k] += 1
covered = sum(1 for h in hits if h)
overlap = sum(1 for h in hits if h > 1)   # > 0 berarti ada yang salah
```

### 3.5 JEBAKAN: padding nol terhitung sebagai kode

Byte `00 00` decode jadi `add byte [bx+si], al`. Region padding yang panjang
akan "terdekode" dan menggelembungkan cakupan. Di Tapper: 513 instruksi
(982 byte, 9,2%) adalah sampah semacam ini.

Deteksi: histogram mnemonic. Kalau `add` menempati urutan kedua setelah `mov`,
atau muncul `daa`/`aaa`/`aas`/`popaw`/`lock`, itu tanda data ter-decode.

Cakupan statis yang realistis untuk binary utuh: **70–75%**.

---

## 4. Fase 3 — Emulasi (kunci semuanya)

Analisis statis punya langit-langit. Emulasi menembusnya, dan untuk game
interrupt-driven ini **wajib**, bukan opsional.

### 4.1 Kenapa emulator sendiri, bukan debugger

DOSBox-X punya debugger, tapi GUI dan butuh tangan manusia tiap iterasi.
Interpreter Python bisa dijalankan headless, berulang, dan di-instrumentasi
sesuka hati. Untuk agen otomatis ini menang telak.

Cakupan instruksi yang perlu diimplementasikan: ambil histogram mnemonic dari
disassembly dulu, lalu implementasikan tepat yang muncul. Untuk game 8086
biasanya ~60 mnemonic.

### 4.2 Yang wajib benar di CPU core

- **Flag** — CF/OF/AF/ZF/SF/PF pada add/sub/logic. Game bercabang atas ini
- **ModR/M 16-bit** — mode `[bp+...]` default ke **SS**, sisanya **DS**
- **Prefix segmen** `26/2E/36/3E`, dan `rep`/`repne`
- **Dispatch interrupt lewat IVT asli** — kalau vektor terisi, lompat ke
  handler sebagai kode nyata; hanya kalau kosong pakai stub Python

Poin terakhir kritis: game memasang handler sendiri, dan handler itu **harus
benar-benar dieksekusi**.

### 4.3 Stub yang diperlukan

`INT 21h` (3D open, 3F read, 42 lseek, 3E close, 4C exit, 25/35 vektor),
`INT 20h`, `INT 10h` (catat mode video), `INT 16h`, `INT 1Ah` (timer),
`INT 13h` (reset → sukses).

Emulasi file: baca file asli dari disk, layani dengan tabel handle sederhana.

### 4.4 JEBAKAN: game menggantung di loop tunggu

Gejala: ratusan ribu instruksi, hanya ~500 alamat unik, tidak ada progres.

Sebabnya hampir selalu **ring buffer keyboard** yang diisi handler IRQ1:

```
mov di, [head]
cmp di, [tail]
je  loop_lagi        ; buffer kosong -> putar terus
```

Emulator tidak membangkitkan IRQ, jadi buffer selamanya kosong.

**Solusi:** log semua tulisan ke IVT (segmen 0, offset < 0x400) untuk tahu
vektor apa yang dipasang game, lalu bangkitkan sendiri:

- `INT 1Ch` / `INT 08h` — timer, tiap ~20.000 instruksi
- `INT 09h` — keyboard; sediakan scancode lewat hook port `0x60`

Game membaca **scancode**, bukan ASCII (`0x13`=R, `0x39`=spasi, `0x1C`=Enter,
`0x48/50/4B/4D`=panah).

### 4.5 JEBAKAN: interrupt hampir selalu ter-mask

Game menjalankan `cli` sepanjang waktu dan hanya sesekali membuka jendela
`sti`. Kalau interrupt dikirim pada instant tetap, hampir selalu meleset.

**Solusi:** tandai permintaan, lalu kirim pada instruksi pertama saat `IF` aktif:

```python
if stalled:
    want_key = True
if want_key and cpu.if_ and keys:      # dicek TIAP instruksi
    want_key = False
    scancode = keys.pop(0)
    cpu.interrupt(9)
```

Di Tapper, versi yang mengecek hanya di batas window mendapat **0 dari 50**
kesempatan.

### 4.6 JEBAKAN: sinyal "sedang menunggu" yang salah

"Loop sempit" bukan sinyal yang benar — handler timer menyentuh cukup banyak
alamat sehingga window mana pun terlihat sibuk.

Sinyal yang benar: **tidak ada alamat baru yang tercapai** dalam satu window.

```python
stalled = not (window_addresses - seen_ever)
```

### 4.7 JEBAKAN: stub `INT 16h` memakan skrip tombol

Kalau stub BIOS keyboard mengambil dari antrian yang sama dengan skrip
scancode, layar "tekan tombol apa saja" akan memakan tombol pertama Anda.
Pisahkan: `INT 16h` selalu jawab spasi, skrip scancode hanya untuk `INT 09h`.

### 4.8 JEBAKAN: atribusi hook salah satu instruksi

`cpu.ip` sudah maju saat instruksi dieksekusi. Hook yang memakai `cpu.ip` akan
menyalahkan instruksi **berikutnya**. Simpan alamat awal instruksi:

```python
def step(self):
    self.cur_ip = self.ip     # sebelum fetch
```

### 4.9 Screenshot framebuffer — lakukan sejak awal

Dekode video memory ke PNG. Ini mengubah navigasi menu dari menebak jadi
melihat, dan memvalidasi seluruh emulator sekaligus: kalau layar game
ter-render benar, CPU + interrupt + emulasi disk + format grafis semuanya benar.

Layout CGA 320×200 4 warna: 80 byte/scanline, 4 pixel/byte (MSB kiri), baris
genap di `0x0000`, baris ganjil di `0x2000`, 192 byte padding di ekor tiap bank.

### 4.10 Ekspektasi hasil

Emulasi menemukan yang mustahil didapat statis:

- Handler interrupt (tidak ada yang "memanggil"-nya)
- Target `call [bx+si]` yang dihitung runtime
- Format blitter beserta operasi nyatanya

Tapi cepat jenuh: memperpanjang 6 juta → 20 juta instruksi di Tapper hanya
menambah 87 alamat dan **nol** perbaikan cakupan.

---

## 5. Fase 4 — Format data

### 5.1 Jangan sweep statistik untuk sprite

Korelasi vertikal / sweep stride **tidak akan** menemukan stride global kalau
file berisi sprite bank (banyak gambar kecil dengan dimensi masing-masing).
Skor akan mentok ~0,3–0,4 dan seri antar kandidat. Itu bukan kegagalan tool —
itu jawaban bahwa asumsinya salah.

Sweep hanya berguna untuk aset raster full-width (stride 80 pada CGA).

### 5.2 Cara yang benar: baca blitter

Jalankan emulator, catat instruksi mana yang paling banyak menulis ke memori
video **atau ke back buffer**, lalu disassemble rutin di sekitarnya.

Blitter sprite khas terlihat begini:

```
mov cx, 8              ; jumlah baris per bank
mov dl, 4              ; word per baris (4 word = 32 pixel)
mov ax, [di]           ; baca tujuan
and ax, [bp+0x80]      ; AND dengan mask, offset = ukuran data
or  ax, [bp]           ; OR dengan data
stosw
add di, 0x48           ; +72, plus 8 dari stosw = 80 = 1 scanline
```

Dari situ langsung terbaca: ukuran sprite, offset mask, dan stride baris.

### 5.3 JEBAKAN: `ES` mungkin bukan `0xB800`

Banyak game menyusun gambar di **back buffer** RAM lalu menyalinnya ke layar
tersinkron vertical retrace. Kalau memburu blitter dengan menyaring tulisan ke
`0xB800`, yang ketemu justru rutin penyalin, bukan blitter sprite. Periksa nilai
`ES` saat blit berjalan.

### 5.4 JEBAKAN: mask per-bit vs per-pixel

Jangan asumsikan mask 2bpp standar (tiap pasangan bit `00` atau `11`).
**Uji secara numerik:**

```python
for tiap pasangan pixel:
    mask harus 00 atau 11
    jika mask == 11 maka data harus 00
```

Di Tapper, 59% pasangan melanggar invarian ini — masknya bekerja **per-bit**.
Konsekuensinya: tampilan sprite bergantung pada isi latar, sehingga **tidak
bisa** dirender berdiri sendiri. Kalau ekstraksi standalone menghasilkan noise,
periksa ini sebelum menyalahkan pembacaan format.

### 5.5 Temukan direktori aset

Ini kunci yang membuka seluruh file data. Cari rutin loader, lalu pola indeks:

```
mov ah, 0
shl ax, 1
shl ax, 1              ; indeks * 4  -> ukuran entri
add ax, 0xNNNN         ; <- BASIS TABEL
mov si, ax
mov ax, [si+2]         ; field kedua
mov ax, [si]           ; field pertama
```

### 5.6 Validasi diri — lakukan selalu

Setelah menafsirkan tabel, cari **invarian yang membuktikan tafsirnya benar**.
Yang paling kuat: **kontiguitas**.

```
LSN[i] + ceil(bytes[i] / ukuran_sektor) == LSN[i+1]
```

Kalau ini cocok untuk semua entri, tafsirnya hampir pasti benar — tabel yang
salah dibaca tidak akan pernah menghasilkan pola serapi itu. Di Tapper, 13 dari
13 cek lolos.

Entri yang menunjuk ke luar file bukan berarti gagal: di Tapper, entri 0
menunjuk track 0–4 disket asli, yaitu kode game itu sendiri.

---

## 6. Fase 5 — Rekonstruksi always-green

Jangan bongkar semua lalu berharap cocok. Balik urutannya.

### 6.1 Alurnya

1. Emit instruksi di bagian yang dipahami, blob `db` di sisanya
2. Assemble dengan NASM, bandingkan dengan asli
3. Instruksi yang di-encode NASM berbeda → **turunkan otomatis jadi `db`**
4. Ulangi sampai byte-identik

Hasilnya byte-identik **sejak build pertama**, dan persentase instruksi nyata
jadi metrik kemajuan yang terukur, bukan janji.

### 6.2 JEBAKAN TERBESAR: demosi yang terlalu rakus

Kalau satu instruksi berubah ukuran, **semua byte sesudahnya bergeser**.
Menurunkan semua byte yang berbeda akan membuang ribuan instruksi yang sehat.
Di Tapper ini menghasilkan cakupan **0,2%**.

**Turunkan hanya instruksi pada perbedaan PERTAMA tiap pass.** Butuh ratusan
pass, tapi cache hasil trace supaya tiap pass murah.

### 6.3 Pola encoding yang harus ditangani

NASM sering memilih encoding lain yang sah untuk instruksi yang sama:

| Pola | Masalah | Perbaikan |
|---|---|---|
| Cabang pendek | NASM pilih near (`E9 0D 00`) walau asli short (`EB 0E`) | `jmp short` / `jcc short` eksplisit |
| Opcode `98`/`99` | Di mode 16-bit itu `cbw`/`cwd`; **capstone melabelinya `cwde`/`cdq`**, dan NASM meng-assemble jadi 2 byte (`66 98`) | Emit `cbw`/`cwd` berdasarkan byte, bukan nama capstone |
| Immediate 16-bit | NASM perpendek jadi sign-extended imm8 bila muat (`3D 00 00` → `83 F8 00`) | `strict word` pada immediate |
| `xchg reg, reg` | NASM membalik urutan operand → encoding lain | Tukar urutan operand |

Cabang pendek saja menyumbang 509 → 96 demosi. Opcode `98` menyumbang 40
instruksi. **Selalu percaya byte, jangan nama mnemonic dari disassembler.**

### 6.4 Pass promosi (bisect)

Demosi bersifat serakah: instruksi bisa turun karena kesalahan instruksi lain
yang lebih awal, dan tidak pernah naik lagi. Setelah build hijau, coba naikkan
kembali dengan delta debugging: coba satu grup sekaligus, pecah dua hanya kalau
grup itu gagal.

Hasilnya bervariasi — di satu run memulihkan 0 dari 102, di run lain 289 dari
348. Murah, jadi tetap jalankan.

### 6.5 Seed dari eksekusi

Alamat yang tercatat saat emulasi dijamin batas instruksi yang benar, jadi aman
jadi seed. Ini menemukan kode yang mustahil dijangkau statis — terutama handler
interrupt. Di Tapper: 214 alamat, cakupan 72,2% → 77,7%.

### 6.6 Target realistis

**78% byte sebagai kode** adalah hasil yang baik untuk binary utuh. Sisanya
memang data: string, tabel aset, jump table, padding. Demosi yang tersisa
sebagian besar juga data yang kebetulan decode jadi instruksi — untuk byte itu
`db` justru representasi yang **benar**, bukan kekurangan.

---

## 7. Fase 6 — Anotasi

### 7.1 Label dan konstanta

Ganti alamat numerik jadi label untuk semua target cabang, dan `equ` untuk
alamat data yang sudah dipahami. Label dan `equ` tidak mengubah encoding, jadi
**hash tetap hijau sepanjang proses**.

Perhatikan: label yang jatuh di tengah blob `db` mengharuskan blob itu dipecah.

### 7.2 Cross-reference — dokumentasi termurah

Untuk tiap label, emit komentar berisi daftar pemanggilnya. Diturunkan langsung
dari disassembly, jadi selalu benar:

```asm
; xref: 2630, 2639, 26A1, 26AA, 2712, 271B, +8 more   (14 sites)
blit_8_rows_mask40:
```

Jumlah call site sering lebih informatif daripada nama tebakan.

### 7.3 JEBAKAN: penamaan membuat grep numerik buta

Begitu sebuah variabel dinamai, barisnya berubah dari
`mov [cs:0x4520], al` menjadi `mov [cs:entity_tick_reload], al`. Grep untuk
alamat numerik **tidak lagi menemukannya**.

Di proyek Tapper ini menghasilkan kesimpulan yang salah dan sempat menetap di
dokumentasi: sebuah variabel laju dinyatakan "bukan kontrol kesulitan" karena
grep `[cs:0x4520]` hanya menemukan dua penulis di kode inisialisasi. Penulis
ketiga — yang menyetengahkan nilainya seiring permainan, yaitu ramp kesulitan
yang dicari berminggu-minggu — sudah tersimbolkan dan tak terlihat.

Aturannya: **setelah menamai variabel, cari nama simbolnya, bukan alamatnya.**
Lebih baik lagi, bangun audit yang mengurai source dan mendaftar pembaca serta
penulis tiap simbol. Jalankan ulang setiap kali menarik kesimpulan dari
"variabel ini hanya ditulis di sini".

Dua cacat turunan yang muncul saat membangun audit itu, keduanya layak
diantisipasi:

- **Substitusi simbol yang hanya menangani `[0xNNNN]`** akan melewatkan seluruh
  akses tabel, karena tabel selalu diakses sebagai `[cs:bx + 0xNNNN]`. Akibatnya
  tabel tampil sebagai hex mentah dan audit ikut buta.
- **Deteksi tulis yang menguji apakah operand tujuan diawali `[nama`** akan
  melewatkan bentuk terindeks seperti `mov [di + tabel], ax` — persis titik buta
  yang ingin ditangkap audit tersebut.

### 7.4 JEBAKAN: angka di dokumentasi membusuk tanpa sinyal

Proyek panjang mengoreksi diri berkali-kali. Setiap sesi memperbarui bagian
dokumen yang sedang dikerjakan, sementara tabel status di berkas lain diam-diam
basi. Di proyek Tapper, `README.md` menyebut 26 rutin bernama ketika sudah 64 —
tertinggal belasan sesi tanpa terdeteksi.

Yang membuatnya berbahaya: **tidak ada sinyal otomatis apa pun.** Build tetap
hijau, hash tetap cocok, tes tetap lolos. Berbeda dengan cakupan kode yang punya
metrik, akurasi dokumentasi tidak diawasi apa pun.

Aturannya: perlakukan angka di dokumen seperti kode — verifikasi terhadap sumber
kebenarannya, dan **otomatiskan verifikasinya**. Sebuah skrip yang menghitung
metrik dari source lalu memastikan tiap nilai memang muncul di dokumen yang
mengutipnya sudah cukup, dan mencegah pembusukan berulang.

Jangan andalkan ingatan untuk memperbarui tabel status. Ingatan justru yang
gagal di sini.

### 7.5 JEBAKAN: klaim "belum terpecahkan" ikut membusuk

Lebih berbahaya daripada angka basi. Di proyek Tapper, `FINDINGS.md` membuka
dengan "encoding sprite belum terpecahkan" sementara isi dokumen yang sama sudah
memuat ketujuh varian blitter dan struktur asetnya. Ringkasan di kepala dokumen
tertinggal belasan sesi di belakang badannya.

Angka salah membuat orang salah kutip. Klaim "belum terpecahkan" yang usang
membuat orang **mengulang pekerjaan yang sudah selesai**.

Dan ini tidak bisa diotomatiskan. Skrip pemeriksa dokumen memverifikasi angka
terhadap sumbernya; tidak ada skrip yang tahu bahwa sebuah pernyataan di halaman
pertama bertentangan dengan tabel di halaman keempat. Satu-satunya cara adalah
membaca dokumen sendiri secara skeptis, dan memperlakukan bagian "yang belum
terpecahkan" sebagai hal yang wajib ditinjau setiap kali sesuatu terpecahkan.

Batas cakupan tiap pengaman perlu disadari:

| Lapisan | Menjaga | Otomatis? |
|---|---|---|
| Hash biner | Kebenaran | Ya |
| Metrik cakupan | Kualitas kode | Ya |
| Pemeriksa dokumen | Akurasi angka | Ya |
| — | Konsistensi klaim | **Tidak** |

### 7.6 TEKNIK: aritmetika kedekatan sebagai konfirmasi

Pada binary tanpa simbol, dua fakta yang diturunkan dari jalur berbeda lalu
bertemu di angka yang sama jauh lebih meyakinkan daripada penalaran tunggal.
Pola ini terbukti tiga kali di proyek Tapper:

| Temuan | Konfirmasi |
|---|---|
| Pool free list 32 node × 8 byte | `0x46C3 + 256 = 0x47C3`, tepat alamat tabel sprite yang dinamai dari jalur lain |
| Tabel halaman 27 entri | `0x40CE + 27 = 0x40E9` dan `0x40EA + 27 = 0x4105` — tiga tabel berurutan tanpa celah |
| Dua array head per-bar | Berjarak tepat 8 byte = 4 word = satu per bar |
| 21 ronde parameter | `0x4105 + 21×8 = 0x41AD` (awal tabel init entitas) dan `0x41AD + 21×32 = 0x444D` (awal daerah nol) — dua tabel berbeda menghasilkan jumlah baris yang sama |

Kalau sebuah struktur berakhir **persis** di tempat struktur lain yang sudah
diketahui mulai, tanpa celah maupun tumpang tindih, ukuran dan kapasitasnya
terbukti — bukan disimpulkan.

Selalu periksa: berapa ukuran elemen × jumlah elemen, dan apa yang ada di alamat
tepat sesudahnya.

### 7.7 JEBAKAN: satu pembaca tidak cukup untuk menamai field

Dua nama salah di proyek Tapper, keduanya dari sebab yang sama:

- Node `+0x06` dinamai "state" karena satu-satunya pembaca hanya menguji
  tandanya. Penulisnya menunjukkan byte itu ditambahkan ke dua field posisi —
  itu **kecepatan**, dan sprite-nya sekadar bergantung arah.
- `joystick_center` dinamai dari rutin yang menggerakkannya seperempat jalan
  menuju bacaan baru — perilaku pemusatan. Menemukan **pasangannya** menunjukkan
  itu batas bawah sepasang ambang dengan zona mati, bukan titik tengah.

Aturannya: sebelum menamai sebuah field, cari **penulisnya** atau **pasangannya**.
Satu pembaca hanya memberi tahu bagaimana field itu dipakai di satu tempat, bukan
apa isinya.

**Bentuk yang lebih mahal dari jebakan yang sama: berhenti di pembaca yang sudah
Anda kenali.** `0x44D3` di Tapper dibaca dari rutin yang sudah dinamai
(`show_next_text_page`) dan langsung dicatat sebagai sekuensor halaman teks.
Pembaca yang menentukan ada di tempat lain (`CS:0E0B`) dan tidak ada namanya —
di situ nilainya dikali 8 lalu dipakai mengindeks tabel parameter per-ronde. Satu
kesalahan itu menghasilkan tiga klaim salah sekaligus di dokumentasi, termasuk
"tidak ada penghitung level di program ini", yang bertahan berhari-hari.

Karena itu langkah pertama sebelum menamai bukan grep lalu baca yang familiar,
tapi **menghitung dulu semua pemakainya** (`hot_vars.py` melakukan ini) dan
membaca **yang paling tidak dikenal lebih dahulu**. Rutin bernama sudah punya
cerita; justru pemakai yang belum bernama yang membawa informasi baru.

Nama yang salah juga menular ke tetangganya. Sekali `0x40CF` dinamai
"tabel halaman teks", tabel di sebelahnya otomatis jadi "parameter halaman
teks" dan variabel indeksnya jadi "indeks halaman teks" — tiga nama, satu
bukti. Yang membongkarnya sepele: **baca rutin yang menerima argumennya.**
`print_string_at` ternyata hanya memakai SI, jadi DI yang susah payah dihitung
di call site itu bukan pemilih string sama sekali, dan dua "tabel" berselisih
satu byte itu satu tabel yang dibaca dua kali dengan indeks berbeda.

### 7.7b TEKNIK: penamaan label internal membongkar hal yang penamaan rutin lewatkan

Menamai `sub_XXXX` dan `loc_XXXX` di dalam rutin yang sudah dipahami terlihat
seperti kerja kosmetik. Di Tapper putaran pertama kerja itu langsung
menghasilkan dua hal yang tidak muncul dari fase mana pun sebelumnya:

- **Blitter ketujuh.** `sub_3136` tidak menarik perhatian sampai rutin di
  sekitarnya dibaca untuk diberi nama. Ternyata blitter 16×12 untuk ikon baris
  status, dan dokumentasi enam kali menyebut "enam varian".
- **Field yang dibiarkan sebagai anomali.** `+0x07` blok pemain dicatat
  bertahun-tahun sebagai "1 di satu blok, `0x21` di blok lain, tidak jelas".
  Membaca `redraw_changed_digits` untuk menamai label-labelnya menunjukkan
  nilai itu dimuat ke `DL` — ia **kolom layar**, dan kedua angka itu posisi dua
  skor yang berdampingan.

Putaran kedua, di mesin suara, menghasilkan dua lagi — dan yang kedua mengoreksi
nama yang sudah dipakai berbulan-bulan:

- **Dua perangkat audio, bukan satu.** PC speaker lewat PIT port `0x42`, dan
  chip SN76496 lewat port `0xC0`. Opsi `"EXTERNAL SOUND"` di menu sudah lama
  terbaca sebagai string, tapi tidak pernah tersambung ke kodenya.
- **`slow_machine_flag` sebenarnya `is_pcjr`.** Ia diberi nama dari *efeknya*
  — pembagi laju dilebarkan — tanpa menelusuri penulisnya. Penulisnya membaca
  byte model BIOS di `F000:FFFE` dan membandingkannya dengan `0xFD`, kode PCjr.
  Jadi semua yang dikira "kompensasi mesin lambat" adalah **kode
  mesin-spesifik**, dan tiga perangkat keras khas PCjr menggantung di flag itu.

Yang membuat nama kedua bertahan lama justru karena ia terdengar masuk akal:
"mesin lambat dapat lebih banyak waktu" adalah cerita yang koheren, dan cerita
yang koheren jarang dipertanyakan. Bandingkan dengan 7.7 — sama-sama gagal
mencari **penulis**, hanya saja kali ini yang dinamai flag, bukan field.

Putaran berikutnya menambah satu jenis kesalahan lagi: **rutin panjang yang
dinamai dari beberapa baris pertamanya.** `erase_bar_list_b` memang menghapus —
di empat baris pertama. Sisanya memindahkan node, menilai tangkapan pemain,
memberi skor, dan pada kasus tertentu membunuh pemain. Namanya tidak salah
sedikit pun tentang apa yang dilihat pertama, dan justru itu yang membuatnya
tidak pernah dipertanyakan.

Ujinya sederhana: **apakah nama itu menutupi seluruh badan rutin, atau hanya
pembukaannya?** Kalau `ret`-nya jauh dari label, jangan menamainya sebelum
membaca sampai sana.

Polanya: penamaan rutin memaksa Anda menjawab "ini apa"; penamaan label internal
memaksa Anda menelusuri **alirannya**, dan aliran itu melewati field serta
pemanggil yang tidak pernah Anda tanyakan.

Alat bantunya `tools/label_triage.py` — ia memilah label generik menurut apakah
rutin pemiliknya sudah punya komentar blok, sehingga yang murah bisa diborong
dan yang mahal terlihat.

### 7.8 JANGAN memberi nama yang tidak Anda ketahui

Beri nama hanya pada rutin yang perilakunya benar-benar dipastikan lewat
pembacaan kode atau emulasi. Sisanya biarkan `sub_XXXX` / `loc_XXXX`.

Nama yang terdengar masuk akal pada kode yang belum dibaca membuat source
tampak lebih dipahami daripada kenyataannya — dan itu menyesatkan siapa pun
yang melanjutkan. Di Tapper mayoritas label sengaja dibiarkan generik; rasio
terkininya ada di tabel status `README.md`, yang disinkronkan
`tools/check_docs.py`.

Angka yang dulu tertulis di sini ("dari 549 label hanya 9 …") sendiri sudah
membusuk sebelum diperbaiki — contoh langsung dari jebakan 7.4, di berkas yang
memperingatkannya. Jangan menyalin metrik ke dalam prosa yang tidak diperiksa
perkakas; rujuk saja tempat yang diperiksa.

### 7.8b TEKNIK: hitungan eksekusi menjawab "berapa sering", murah

Sebelum menambah instrumentasi baru, cek dulu apakah `out/executed.txt` yang
sudah ada bisa menjawab. Hitungan per alamat menyelesaikan pertanyaan rasio
tanpa satu baris kode pun:

- **satuan waktu.** Di Tapper, badan loop salin layar dibagi 11 memberi jumlah
  frame; membandingkannya dengan blok loop utama membuktikan blok itu berjalan
  sekali per frame. Selisihnya persis sama dengan jumlah kematian — sanity check
  gratis
- **pembagi laju.** Rasio pass terhadap ekspirasi pembagi mengonfirmasi angka
  muat yang dibaca dari kode
- **kode mati.** Cabang yang dieksekusi 10.703 kali tanpa pernah diambil adalah
  bukti kuat, sekalipun bukan bukti mutlak

Rasio tidak bergantung pada seberapa jauh emulator bermain, jadi trace lama pun
tetap sah untuk pertanyaan semacam ini.

### 7.8c JEBAKAN: trace lebih panjang bukan cakupan lebih luas

Kalau emulator tidak pernah mencapai suatu state, menaikkan batas instruksi
hampir tidak menambah apa-apa. Di Tapper 12M → 40M instruksi hanya menambah 2,4%
alamat dan nol subsistem baru, karena emulator memainkan game dengan buruk, dan
bermain lebih lama tetap berarti bermain buruk.

Ukur dulu sebelum menghabiskan waktu: jalankan dua batas berbeda dan bandingkan
jumlah alamat berbeda. Kurva yang mendatar berarti waktunya **menyuntik state**,
bukan menunggu lebih lama.

Tapi pastikan dulu kurvanya benar-benar mendatar dan bukan sekadar belum sampai
titik lompatnya — lihat 7.8h. Di Tapper satu timeout menu memakan ±36 juta
instruksi, dan run 12M→40M yang tampak mendatar itu semuanya berhenti sebelum
lompatan berikutnya.

Dan urutannya penting: menyuntik state baru mungkin setelah variabel penentu
progres punya nama dan alamat pasti. Penamaan yang tampak kosmetik itulah yang
membuka opsi teknis berikutnya.

### 7.8d TEKNIK: suntik state, jangan tulis bot

Kalau emulator tak pernah mencapai suatu state, tulis saja variabelnya. Ini baru
mungkin setelah variabel progres punya nama dan alamat pasti — itulah nilai
praktis dari kerja penamaan yang tampak kosmetik.

Aturannya cuma tiga:

1. **Suntik di titik eksekusi, bukan di waktu.** Pilih alamat + kunjungan
   ke-berapa, bukan jumlah instruksi. Di Tapper titik suntik halaman hanya
   tercapai **sekali** per run — nth ke-3 tidak pernah menyala, dan tanpa
   pesan "poke never fired" itu akan terbaca sebagai eksperimen yang gagal
   membuktikan apa-apa.
2. **Selalu jalankan kontrol tanpa suntikan.** Kalau baselinenya tidak
   direkam, tidak ada yang bisa dibandingkan.
3. **Beri label temuannya.** Apa pun yang hanya terlihat di bawah state paksaan
   adalah *"terjangkau di bawah state paksaan"*, bukan *"game melakukan ini"*.
   Suntikan bisa memproduksi perilaku yang tak pernah dicapai game asli — dan
   itu jenis temuan yang paling gampang dipercaya terlalu cepat.

**Cek dulu apakah pertanyaannya memang butuh runtime — dan pecah dulu
pertanyaannya.** Di Tapper, "katalog sprite belum lengkap" bertahan lama sebagai
satu item, padahal isinya dua: *siapa memakai aset yang mana* dan *apa isi aset
itu*. Yang pertama ada di tabel statis dan tidak butuh emulator sama sekali;
yang kedua butuh membongkar struktur bank tiap aset. Digabung jadi satu item,
keduanya sama-sama menunggu eksperimen dinamis yang hanya relevan bagi salah
satunya.

Hati-hati juga membaca artefak sebagai bukti. Direktori `out/` di proyek ini
sudah lama berisi PNG untuk semua aset, dan itu hampir membuat saya menyatakan
katalognya selesai — padahal berkas-berkas itu dump mentah yang merender sebagai
derau. **Adanya keluaran bukan berarti keluarannya benar**; buka dan lihat.

**Nilai terbesarnya sering bukan temuan langsungnya, melainkan apa yang
dipaksanya jatuh.** Suntikan pertama di Tapper berhenti dengan
`unimplemented opcode 27h` — `DAA`, di dalam rutin skor. Emulator sengaja tidak
memasangnya, dengan komentar "opcode BCD tidak dipakai jalur kode nyata di
program ini". Ternyata skornya BCD; jalur itu memang tak pernah tercapai, dan
ketiadaan eksekusi terbaca sebagai ketiadaan pemakaian. Satu suntikan
membongkar asumsi yang sudah tertulis di perkakasnya sendiri.

Verifikasi terbaiknya tetap prediksi. Peta id-layar → aset dibaca dari tabel
lebih dulu, baru disuntik: halaman 7 diprediksi meminta aset 15, halaman 12
meminta 17, dan emulator mengonfirmasi keduanya. Suntikan yang hanya
"menjalankan sesuatu lalu melihat apa yang terjadi" jauh lebih lemah daripada
suntikan yang menguji tebakan yang sudah ditulis lebih dulu.

### 7.8e JEBAKAN: satu register, dua indeks, arah berlawanan

Kalau satu nilai dipakai menurunkan dua indeks, **jangan anggap keduanya searah.**
Di Tapper `CX` sisa `repne scasb` melahirkan dua-duanya:

```
bx = (14 − cx) × 4        ; indeks tabel aksi  -> i
dx = 1 << (cx − 1)        ; bit debounce       -> 13 − i
```

Satu naik, satu turun. Membaca mask bit berurutan menurut tabel pindai
menghasilkan tombol yang salah — dan salahnya masuk akal, jadi tidak akan
ketahuan sendiri. Yang menyelamatkan adalah **memverifikasi peta itu dengan
situs yang menguji kombinasi**: dua bit yang diuji bersama di handler tombol
Del ternyata Ctrl dan Alt, dan satu bit yang diuji bersama scancode `0x46`
ternyata Ctrl. Ctrl-Alt-Del dan Ctrl-Break sekaligus mengunci peta itu dari dua
arah.

Jadi kalau sebuah peta bit belum bisa diverifikasi silang, **jangan
mempublikasikannya**. Di siklus sebelumnya peta ini sengaja ditunda dengan
catatan "belum dipastikan"; itu keputusan yang benar, dan tabel yang sekarang
terbit sudah punya tiga konfirmasi bebas.

### 7.8f TEKNIK: hitung ulang batas loop terhadap ukuran tabel

`mov cx, 15` terhadap tabel 14 entri terlihat seperti bug, dan hampir saya
laporkan begitu. Aritmetika kedekatan menunjukkan tabel aksinya berakhir tepat
di variabel berikutnya, dan slot pindai ke-15 memang melimpah ke byte rendah
pointer pertama tabel itu sendiri.

Tapi `jcxz` sesudahnya menangkapnya: kecocokan di byte ke-15 menyisakan `CX = 0`
dan diperlakukan sebagai tidak ketemu. **Lima belas dipindai, empat belas bisa
menyala.** Selalu jalankan kasus batasnya sampai tuntas sebelum menyebut sesuatu
cacat — dan sebaliknya, jangan berasumsi penjaga seperti itu ada tanpa
menemukannya.

### 7.8g JEBAKAN: "tidak pernah tereksekusi" sering berarti "bukan kode"

Kalau sebuah instruksi tidak pernah jalan di trace mana pun, kemungkinan
pertama yang harus diuji bukan "state-nya belum tercapai", melainkan **"itu
bukan instruksi"**.

Di Tapper empat site `call word ptr [bx+si]` bertahan bertahun-tahun sebagai
misteri terbuka. Byte-nya `FF 10`. Tiga di antaranya ada di tengah string UI,
dan `0xFF` adalah kode kontrol printer string game itu sendiri: *word berikutnya
posisi kursor*. `FF 10 14` artinya "pindah ke baris 20 kolom 16". Yang keempat
awal tabel data suara, dimuat dengan `mov si` dan dibaca `lodsb`.

Ujinya murah: **cari siapa yang menunjuk alamat itu.** Kalau yang menunjuknya
`mov si`/`mov di` alih-alih `call`/`jmp`, itu data. Kalau tidak ada yang
menunjuknya sama sekali dan ia juga tidak jatuh dari instruksi sebelumnya, ia
tidak dieksekusi siapa pun.

Ini kebalikan dari 7.8c: di sana ketiadaan eksekusi berarti emulatornya kurang
jauh; di sini ketiadaan eksekusi berarti disassembler-nya terlalu bersemangat.
Bedakan keduanya sebelum membangun eksperimen mahal.

### 7.8h JEBAKAN: "tidak pernah maju" diukur terhadap jam siapa?

Sebelum menyimpulkan sebuah loop mandek, cari **satuan waktu internalnya**.
Program bisa saja menunggu dengan sabar dalam satuan yang jauh lebih besar dari
panjang run Anda.

Di Tapper menu tampak macet di `read_key` selama enam run berturut-turut.
Ternyata timeout-nya dihitung dalam satuan yang diturunkan **dua pembagi
bersarang** di timer ISR: `tick_countdown` habis tiap 60 tick, dan baru saat itu
`key_pending` turun satu. Timeout 30 satuan berarti 1.800 tick — ±99 detik nyata,
dan ±36 juta instruksi di emulator. Semua run saya 6M–30M: tidak satu pun
mencapai satu timeout penuh.

Yang menyesatkan bukan datanya, tapi perbandingan yang tidak setara: "30" terlihat
kecil sampai Anda tahu satuannya. Cari `dec` bertingkat di ISR dan hitung
faktornya sebelum menuduh sesuatu buntu.

Dan dua dugaan saya sebelumnya tentang loop ini — terminator skrip layar, lalu
urutan tombol yang salah — dua-duanya salah, padahal dua-duanya konsisten dengan
bukti yang ada saat itu. Konsisten bukan berarti benar; uji yang membedakan
keduanya (skrip berisi Space semua) yang akhirnya menutup keduanya sekaligus.

### 7.9 TEKNIK: sisir byte operand di image, bukan di disassembly

Disassembly hanya memuat yang berhasil dibongkar. Untuk menjawab "siapa yang
menulis variabel ini", cari **byte operand alamatnya di seluruh image** —
`0x4487` berarti menyisir `87 44`. Tiga hal sekaligus didapat:

- **penulis yang bersembunyi di daerah `db`** akan muncul, sementara grep pada
  source tidak akan pernah menemukannya
- **klaim negatif jadi mungkin.** Di Tapper penyisiran ini membuktikan
  `abort_sequence_flag` tidak pernah diset di mana pun: empat lokasi, semuanya
  membandingkan dengan 0 atau menulis 0. Dua cabang `jne` di dua rutin berbeda
  ternyata kode mati. Tanpa penyisiran, yang bisa dikatakan hanyalah "belum
  ketemu penulisnya"
- **kecocokan kebetulan gampang disaring** dari byte sebelumnya: `89 44 02`
  ternyata `mov [si+2], ax`, bukan operand `0x4489`

Kalau sebuah flag tak punya penulis, catat juga di mana kode dihapus (sled
`NOP`, area yang dipatch). Itu tidak membuktikan apa pun, tapi menandai
satu-satunya tempat jawabannya mungkin dulu berada.

### 7.10 JEBAKAN: alamat itu mungkin field, bukan variabel

Sebelum menamai sebuah alamat sebagai variabel berdiri sendiri, periksa apakah
ia **jatuh di dalam sebuah record yang sudah Anda kenal**. Di Tapper `0x4691`
dinamai `input_flag_right` karena handler tombol menulisinya — padahal alamat
itu `player_top + 0x0E`, yaitu field kecepatan record pemain. Nama lamanya
menyembunyikan fakta bahwa ISR keyboard menyetir kecepatan pemain langsung.

Pemeriksaannya sepele: kurangkan alamat itu dengan tiap basis record yang sudah
diketahui, dan lihat apakah sisanya offset field yang masuk akal. Sekaligus
melahirkan nama yang lebih baik untuk tetangganya — begitu `0x4683` diketahui
sebagai record pemain, `0x4687`, `0x4689`, dan `0x468B` ikut terbaca.

### 7.11 CATAT: akses word yang meluber ke variabel tetangga

Assembly tulisan tangan sering membaca atau menulis **word di alamat variabel
byte**, sehingga byte tetangganya ikut terbawa. Di Tapper ini muncul tiga kali
dengan tiga akibat berbeda:

| Situs | Akibat |
|---|---|
| `mov ax, [bar_direction + bar*2]` | **Disengaja** — dua array byte diselang-seling, satu akses mengambil kedua field |
| `mov cx, word [joystick_sample_count]` | **Kebetulan aman** — `CH` datang dari `timer_reentry_guard`, yang 0 di luar ISR |
| `mov [death_bar_index_x2], ax` | **Merusak** — menulisi byte rendah `free_list_head`, tapi selalu ditimpa ulang sebelum dibaca |

Jangan langsung menyebutnya bug, dan jangan langsung menyebutnya sengaja. Yang
menentukan adalah nilai byte tetangganya pada saat itu dan apakah ada yang
membacanya sebelum ditimpa. Ketiganya perlu ditelusuri; hanya yang ketiga yang
akhirnya layak disebut cacat.

---

## 8. Deliverable

```
README.md          pintu masuk, cara build, status, catatan provenance
FINDINGS.md        format data, dengan rujukan alamat kode tiap klaim
ARCHITECTURE.md    arsitektur teknis + diagram mermaid
build.cmd/.sh      assemble DAN verifikasi byte-identik
src/game.asm       source hasil rekonstruksi
tools/             perkakas analisis
NamaGame/          file asli, TIDAK dimodifikasi
```

**Verifikasi harus jadi bagian dari build, bukan langkah terpisah.** Build yang
lolos berarti source-nya terbukti benar; tidak ada cara ia "berhasil" tapi salah.

```
$ ./build.sh
Assembling src/game.asm ...
OK: build/game.com is byte-identical to NamaGame/GAME.COM
```

---

## 9. Provenance — sebutkan, jangan sembunyikan

Salinan abandonware sering **versi crack**. Tandanya: entry point dipatch,
layar judul diganti, `NOP` sled bekas kode proteksi, kode tambahan di ekor file.

Ini tidak menghalangi pekerjaan — malah sering membantu, karena crack biasanya
mengekspos struktur disk secara eksplisit. Tapi **katakan di README**: hasil
byte-identik cocok dengan binary crack itu, bukan dengan rilis asli pabrikan.

Catatan hukum singkat: status abandonware tidak menghapus hak cipta. Analisis
dan preservasi pribadi satu hal; mendistribusikan binary atau aset hal lain.
Pisahkan repo source dari file game.

---

## 10. Ringkasan jebakan

Urut dari yang paling mahal:

| # | Jebakan | Gejala | Perbaikan |
|---|---|---|---|
| 1 | Demosi terlalu rakus | Cakupan 0,2% | Turunkan hanya perbedaan pertama |
| 2 | Game menggantung di loop tunggu | ~500 alamat, tidak maju | Bangkitkan IRQ keyboard/timer |
| 3 | Interrupt ter-mask | Injeksi tidak pernah masuk | Tandai permintaan, kirim saat `IF` aktif |
| 4 | Seeding immediate longgar | Cakupan > 100% | Seed hanya dari situs dispatch nyata |
| 5 | Nama mnemonic dipercaya | 40 instruksi turun | Emit `cbw` dari byte `98`, bukan nama |
| 6 | Cabang short/near | 509 demosi | `jmp short` / `jcc short` eksplisit |
| 7 | Sweep statistik untuk sprite | Skor mentok 0,3–0,4 | Baca kode blitter |
| 8 | Mask diasumsikan per-pixel | Sprite jadi noise | Uji invarian secara numerik |
| 9 | Sinyal stall salah | Tombol tidak terkirim | Pakai "tidak ada alamat baru" |
| 10 | `sum(size)` untuk cakupan | Menyembunyikan seed buruk | Bitmap byte + hitung overlap |
| 11 | Padding nol terhitung kode | Cakupan +9% palsu | Filter `00 00` → `add [bx+si],al` |
| 12 | `cpu.ip` di hook | Salah instruksi | Simpan `cur_ip` sebelum fetch |
| 13 | `INT 16h` makan skrip tombol | Tombol pertama hilang | Pisahkan antrian |
| 14 | Blitter dicari di `0xB800` | Ketemu penyalin, bukan blitter | Periksa `ES` saat blit |
| 15 | Grep numerik setelah penamaan | Penulis tak terlihat, kesimpulan salah | Cari nama simbol; bangun audit simbol |
| 16 | Substitusi simbol abaikan `[reg + 0xNNNN]` | Semua akses tabel tetap hex mentah | Tangani bentuk base+displacement |
| 17 | Aturan encoding yang terlalu umum | Demosi justru naik | Perbaiki per pola byte, ukur tiap perubahan |
| 18 | Angka di dokumen membusuk | README menyebut 26 rutin saat sudah 64 | Audit dokumen terhadap build, otomatiskan |
| 19 | Klaim "belum terpecahkan" jadi usang | Ringkasan bertentangan dengan isi dokumen sendiri | Baca ulang dokumen sendiri secara skeptis; tak ada skrip yang bisa |
| 20 | Menyimpulkan field dari satu pembaca | Dua nama salah: "state" ternyata kecepatan, "center" ternyata batas bawah | Cari penulis atau pasangannya dulu |
| 21 | Tabel nama dan tabel komentar terpisah | Komentar menempel pada label generik | Pantau metrik penamaan; angka tak bergerak = satu tabel terlewat |

---

## 11. Urutan yang terbukti

```
Rekon (identifikasi, entropy, string, deteksi booter, asm vs compiler)
  -> TANYA PENGGUNA: target akhir + izin install
  -> Lingkungan (capstone, Pillow, NASM; DOSBox bila perlu)
  -> Disassembly statis (recursive descent + jump table)   ~73%
  -> Emulator (CPU, stub, IRQ, screenshot)
  -> Format data (blitter, direktori aset, validasi kontiguitas)
  -> Rekonstruksi always-green (NASM + verifikasi)          ~78%
  -> Anotasi (label, xref, komentar rutin yang dipahami)
  -> Deliverable (README, build script, dokumentasi)
```

Laporkan progres di tiap fase dengan angka jujur, dan sebutkan apa yang **tidak**
selesai beserta alasannya.
