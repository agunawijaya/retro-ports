# Tapper (IBM PC, 1984) — reconstruction

Reverse engineering of the DOS release of Tapper, producing assembly source
that **reassembles byte-for-byte into the original executable**.

```
$ ./build.cmd
Assembling src\tapper.asm ...
OK: build\tapper.com is byte-identical to Tapper\TAPPER.COM
```

## Membangun

Perlu [NASM](https://www.nasm.us/) di PATH. Tidak ada dependensi lain.

```
build.cmd      # Windows
./build.sh     # Linux / macOS / Git Bash
```

Skrip build meng-assemble `src/tapper.asm` lalu **membandingkannya dengan binary
asli**. Verifikasi adalah bagian dari build, bukan langkah terpisah — build yang
lolos berarti source-nya terbukti benar, bukan sekadar bisa di-assemble.

## Status

| | |
|---|---|
| Source | `src/tapper.asm`, 9901 baris |
| Instruksi | 5474 |
| Byte sebagai kode | 13986 / 17920 (**78,0%**) |
| Byte sebagai `db` | 3934 — data (string, tabel, jump table, padding) |
| Label simbolik | 578, dengan 544 blok cross-reference |
| Rutin bernama | 578, dengan 123 blok komentar |
| Variabel bernama | 176 |
| Verifikasi | SHA256 identik, `fc /b` bersih |

Cara build ada di [BUILD.md](BUILD.md).

Bagian yang masih `db` sebagian besar memang data, bukan kode yang belum
dibongkar. Lihat [FINDINGS.md](FINDINGS.md) untuk rinciannya.

Tiap label membawa daftar pemanggilnya, jadi peran sebuah rutin bisa dinilai
dari jumlah call site-nya tanpa perlu menebak nama:

```asm
; xref: 1593, 159C, 19CB, 19D4, 1E05, 1E10, +6 more   (12 sites)
blit_sprite_16x16:
```

**Seluruh 578 label kini bernama — nol `sub_XXXX`/`loc_XXXX` tersisa.** Tiap
nama diberikan setelah rutinnya dibaca sampai `ret`, bukan dari tebakan yang
terdengar masuk akal. Prinsip itu dipertahankan sampai akhir: label generik yang
jujur tidak merugikan siapa pun, nama salah merugikan — dan tabel koreksi di
[DECISIONS.md](DECISIONS.md) mencatat setiap kali prinsip itu tetap gagal
dipatuhi.

## Melanjutkan pekerjaan

**Decompile sudah selesai.** Tiga fase tuntas — penamaan (576/576 label),
semantik (lima sasaran), dan katalog sprite (25/25 entri tabel campuran) —
dengan build byte-identik di setiap siklus. Rinciannya di
[PROGRESS.md](PROGRESS.md).

Fase berikutnya adalah **porting**, dan pertimbangannya ada di
[PORTING.md](PORTING.md). Ritual di bawah tetap berlaku untuk perubahan apa pun
yang menyentuh `tools/reconstruct.py`.

`src/tapper.asm` **dihasilkan perkakas — jangan diedit tangan.** Anotasi
ditambahkan lewat tiga tabel di `tools/reconstruct.py`:

| Tabel | Isi |
|---|---|
| `NAMED_CODE` | alamat → nama rutin |
| `NAMED_DATA` | alamat → nama variabel |
| `ROUTINE_DOCS` | alamat → blok komentar |

`NAMED_CODE` dan `ROUTINE_DOCS` terpisah; menambah ke satu tanpa yang lain
menghasilkan komentar yang menempel pada label generik.

### Ritual satu siklus

```
python tools/hot_vars.py           # pilih target berikutnya
python tools/audit_symbols.py      # cek pembaca/penulis simbol
                                   # -- baca kodenya, lalu edit reconstruct.py
python tools/reconstruct.py        # regenerasi source
.\build.cmd                        # WAJIB hijau
python tools/check_docs.py --fix   # sinkronkan angka dokumen
```

Perhatikan dua metrik, bukan hanya hash: **byte sebagai kode** dan **jumlah
demosi**. Hash tetap cocok walau kualitas turun — dua percobaan perbaikan
encoding pernah menghilangkan 27 lalu 64 instruksi tanpa memicu kegagalan build.

### Antrian saat ini

Kandidat teratas dari `hot_vars.py`: `0x452A`, `0x4518`, `0x44BF`, `0x44B9`.
Catatan: `0x2000` di daftar itu **false positive** — konstanta bank CGA, bukan
variabel. Daftar alamat tak bernama tinggal 66, dari 96 di awal rangkaian ini.

Sebelum menamai alamat berikutnya, kurangkan dulu dengan basis record yang sudah
dikenal (`entity_table`, `player_top`, blok progres pemain). Empat nama terakhir
ternyata field, bukan variabel; lihat `PLAYBOOK.md` bagian 7.10.

### Penamaan label yang tersisa

Sedang berjalan: menamai sisa label generik. `tools/label_triage.py` memilahnya
menurut apakah rutin pemiliknya sudah punya komentar blok, dan **melaporkan
span** — span lebar berarti rutin pelingkupnya yang belum bernama, bukan
labelnya yang banyak.

```
python tools/label_triage.py         # ringkasan
python tools/label_triage.py owner   # dikelompokkan per rutin pemilik
```

Kerjanya per rutin, dibaca dulu baru dinamai. Putaran pertama sudah membongkar
dua hal yang terlewat fase sebelumnya: **blitter ketujuh** (`blit_sprite_16x12`)
dan field `+0x07` blok pemain yang ternyata `score_column`. Lihat `PLAYBOOK.md`
bagian 7.7b.

Satu utas lain masih terbuka: **kepemilikan entri tabel sprite**.
`tools/sprite_sheet.py` menurunkannya dengan mengait `lookup_ptr_pair` dan
`set_entity_sprite`, tapi run 60 juta instruksi baru menyentuh awal satu ronde
dan hanya tiga indeks yang sempat diminta.

Sudah tertutup: **mode 0** (tidak pernah mandek — timeout menunya ±36 juta
instruksi emulator, semua run sebelumnya terlalu pendek), **kompresi layar**
(RLE, `unpack_screen` di `CS:2DB5`), **empat site `call word ptr [bx+si]`** yang
ternyata data salah baca, peta bit `keys_down_bitmap`, peta pemakai aset, baris
ke-21 tabel ronde, frekuensi `CS:1099`, dan `text_page_index` yang ternyata
`page_index`.

Aturan penamaan: cari **penulis atau pasangan** sebuah field sebelum menamainya.
Satu pembaca hanya menunjukkan cara pakai di satu tempat, bukan isinya — tiga
koreksi terakhir semuanya lahir dari berhenti di pembaca yang sudah dikenal.
Lihat `PLAYBOOK.md` bagian 7.7.

## Dokumentasi

| Berkas | Isi |
|---|---|
| [FINDINGS.md](FINDINGS.md) | Format data: `TAPPER.DAT`, `TAPPER.PIC`, sprite, direktori aset |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arsitektur teknis dengan diagram |
| [GAME.md](GAME.md) | Tentang game-nya: sejarah, cara main, level, tips |
| [PLAYBOOK.md](PLAYBOOK.md) | Metodologi untuk membongkar game DOS lain |
| [DECISIONS.md](DECISIONS.md) | Pendekatan yang sudah dicoba dan gagal, plus koreksi yang pernah dibuat |
| [TEACHING.md](TEACHING.md) | Pelajaran pemrograman dari kode ini — untuk yang sedang belajar |
| [PORTING.md](PORTING.md) | Opsi bahasa untuk port, strategi pengujian, potensi pengembangan |
| [PROGRESS.md](PROGRESS.md) | Catatan tiga fase kerja dan apa yang masih terbuka |
| [CLAUDE.md](CLAUDE.md) | Petunjuk kerja di repo ini — baca lebih dulu |

## Yang ditemukan

Rilis IBM PC aslinya adalah **PC Booter** — disket self-booting tanpa DOS.
Seluruh badan game hanya memakai BIOS (`INT 10h`, `13h`, `16h`, `1Ah`); satu-
satunya panggilan DOS ada di kode crack. Salinan ini adalah hasil konversi:
`.COM` yang memasang handler `INT 80h` untuk meniru pembacaan sektor floppy dari
`TAPPER.DAT`.

Rantai aset lengkapnya terpetakan, dari nomor aset sampai byte sampai di layar:

```
indeks aset -> tabel CS:05B1 -> LSN -> (LSN-27)*512 -> sektor TAPPER.DAT
            -> buffer overlay CS:3C80 -> blitter CS:2CFF -> back buffer 23DB
            -> salin tersinkron retrace -> B800 (CGA 320x200)
```

## Perkakas

`tools/` berisi perkakas analisis yang dipakai, termasuk interpreter 8086
(`emu8086.py`) yang menjalankan game secara headless. Emulator inilah yang
memecahkan hal-hal yang tidak bisa dijangkau analisis statis: handler interrupt
yang dipasang lewat IVT, dan format blitter sprite.

`tools/inject_state.py` menulis variabel progres langsung di titik eksekusi
tertentu, untuk mencapai kode yang tidak pernah dijangkau permainan emulator.
Temuan dari situ selalu ditandai **"terjangkau di bawah state paksaan"** —
lihat `PLAYBOOK.md` bagian 7.8d.

`tools/decode_screen.py` membongkar layar bar langsung dari `TAPPER.DAT`
memakai format RLE yang dibaca dari source hasil rekonstruksi — tanpa
menjalankan game sama sekali. `tools/render_player.py` memaksa mode tampilan 0
supaya tabel sprite yang benar terbangun, lalu merender pose bartender:

```
python tools/decode_screen.py     # -> screens/saloon|sports|punk|space.png
python tools/render_player.py     # -> screens/bartender.png
python tools/sprite_sheet.py      # -> screens/sprites.png + peta kepemilikan
```

Generator source: `python tools/reconstruct.py`.

## Catatan

Salinan yang dianalisis adalah **versi crack** — entry point dipatch, layar
judul diganti, dan ada `NOP` sled bekas kode proteksi. Hasil byte-identik ini
cocok dengan binary tersebut, bukan dengan rilis Sega 1984 yang asli.

Berkas game asli di `Tapper/` tidak dimodifikasi. Repo ini berisi source hasil
rekonstruksi dan perkakas analisis; ia tidak mendistribusikan game-nya.
