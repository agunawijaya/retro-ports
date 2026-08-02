# Cara Meng-compile

Source di `src/tapper.asm` di-assemble menjadi `TAPPER.COM` yang **byte-identik**
dengan binary asli. Verifikasi adalah bagian dari build, bukan langkah terpisah:
build yang lolos berarti source-nya terbukti benar.

---

## 0. Berkas game tidak ada di repo

`Tapper/` sengaja tidak di-commit — repo ini berisi hasil rekonstruksi dan
perkakas analisis, bukan game-nya. Meng-assemble source **tidak** memerlukannya,
tapi **verifikasi byte-identik memerlukannya**: skrip build membandingkan
hasilnya dengan `Tapper/TAPPER.COM`.

Tanpa berkas itu, build tetap jalan dan melaporkan bahwa verifikasi dilewati.
Untuk mengaktifkannya, taruh salinan Anda sendiri di `Tapper/` dan cocokkan
hash-nya dengan [bagian 4](#4-verifikasi-manual).

---

## 1. Prasyarat

Hanya satu: **NASM** (Netwide Assembler), versi 2.x atau 3.x.

Tidak perlu DOSBox, tidak perlu toolchain DOS, tidak perlu Python. NASM
menghasilkan flat binary `.COM` secara native di Windows, Linux, dan macOS.

### Windows

```powershell
winget install --id NASM.NASM -e
```

Installer tidak selalu menambahkan NASM ke `PATH`. Skrip build sudah mencari di
lokasi umum, tapi kalau ingin memakainya manual:

```powershell
$env:PATH += ";$env:LOCALAPPDATA\bin\NASM"
```

Alternatif: `choco install nasm`, atau unduh dari <https://www.nasm.us/>.

### Linux

```bash
sudo apt install nasm        # Debian / Ubuntu
sudo dnf install nasm        # Fedora
sudo pacman -S nasm          # Arch
```

### macOS

```bash
brew install nasm
```

### Verifikasi

```
$ nasm -v
NASM version 3.02
```

---

## 2. Build

Dari direktori akar proyek:

### Windows

```
.\build.cmd
```

Catatan: `cmd.exe` pada sebagian konfigurasi tidak mencari executable di
direktori kerja, jadi awalan `.\` diperlukan.

### Linux / macOS / Git Bash

```
./build.sh
```

Kalau belum executable:

```
chmod +x build.sh
```

### Keluaran yang diharapkan

```
Assembling src/tapper.asm ...
OK: build/tapper.com is byte-identical to Tapper/TAPPER.COM
```

Hasilnya ada di `build/tapper.com`.

---

## 3. Build manual

Kalau tidak ingin memakai skrip:

```
nasm -f bin -o build/tapper.com src/tapper.asm
```

| Flag | Fungsi |
|---|---|
| `-f bin` | Flat binary, tanpa header — inilah format `.COM` |
| `-o` | Berkas keluaran |

Source sudah memuat `bits 16` dan `org 0x100`, jadi tidak ada flag lain yang
diperlukan.

---

## 4. Verifikasi manual

Skrip build sudah melakukan ini, tapi untuk memeriksa sendiri:

### Windows

```powershell
(Get-FileHash Tapper\TAPPER.COM -Algorithm SHA256).Hash
(Get-FileHash build\tapper.com  -Algorithm SHA256).Hash
fc /b Tapper\TAPPER.COM build\tapper.com
```

Hasil yang benar: kedua hash sama, dan `fc` melaporkan
`FC: no differences encountered`.

### Linux / macOS

```bash
sha256sum Tapper/TAPPER.COM build/tapper.com
cmp Tapper/TAPPER.COM build/tapper.com && echo identical
```

### Hash acuan

```
EC85DB55A21814E7E08BF3F0270F5CE3DD8B1E34335B7CFE242A9B2E874A42B1
```

Kalau hash Anda berbeda dari ini, kemungkinan besar berkas `TAPPER.COM` Anda
berasal dari rilis atau crack yang berbeda. Source ini direkonstruksi dari
binary dengan hash di atas.

---

## 5. Menjalankan hasilnya

`tapper.com` memerlukan `TAPPER.DAT` dan `TAPPER.PIC` di direktori yang sama —
ia membuka keduanya berdasarkan nama dan langsung keluar bila tidak ditemukan.

```powershell
copy build\tapper.com  run\
copy Tapper\TAPPER.DAT run\
copy Tapper\TAPPER.PIC run\
```

Lalu jalankan `run\tapper.com` di DOSBox:

```powershell
winget install --id DOSBoxStaging.DOSBoxStaging -e
```

Di dalam DOSBox:

```
mount c C:\Projects\Tapper\run
c:
tapper.com
```

**Game ini tidak menanyakan `R` (RGB) atau `C` (composite).** String prompt-nya
masih ada di data, tapi kode yang mencetaknya dibuang crack — lihat
[FINDINGS.md](FINDINGS.md#pilihan-modenya-sendiri-sudah-dirusak-crack). Mode
tampilan akhirnya ditentukan byte rendah segmen tempat DOS memuat program, jadi
Anda bisa mendapat jalur render composite tanpa pernah memilihnya. Kalau warnanya
tampak salah, itu sebabnya, dan tidak ada tombol untuk mengubahnya.

---

## 6. Regenerasi source

`src/tapper.asm` dihasilkan oleh perkakas, bukan diedit tangan. Untuk
membangkitkannya ulang:

```
python tools/reconstruct.py
```

Perlu Python 3 dengan `capstone`:

```
python -m pip install capstone
```

Perkakas ini membongkar binary asli, meng-assemble hasilnya, membandingkan
byte per byte, dan **menurunkan instruksi apa pun yang di-encode NASM berbeda
menjadi blob `db`** — lalu mengulang sampai keluarannya identik. Karena itu
keluarannya selalu byte-identik secara konstruksi.

Anotasi (nama rutin, komentar blok, nama variabel) ada di tabel `NAMED_CODE`,
`NAMED_DATA`, dan `ROUTINE_DOCS` di dalam `tools/reconstruct.py`. Menambah nama
di sana lalu menjalankan ulang perkakasnya tidak mengubah encoding, sehingga
build tetap byte-identik.

---

## 7. Bila build gagal

| Gejala | Sebab | Solusi |
|---|---|---|
| `nasm not found` | NASM tidak di `PATH` | Lihat bagian 1 |
| `'build.cmd' is not recognized` | `cmd.exe` tidak mencari di direktori kerja | Pakai `.\build.cmd` |
| `FAIL: ... differs from ...` | `TAPPER.COM` Anda beda rilis | Cocokkan hash di bagian 4 |
| Galat sintaks dari NASM | `src/tapper.asm` diedit tangan | Regenerasi lewat bagian 6 |

---

## 8. Catatan

Binary yang direkonstruksi adalah **versi crack**: entry point dipatch, layar
judul asli diganti intro grup crack, dan ada `NOP` sled bekas kode proteksi.
Hasil byte-identik ini cocok dengan binary tersebut, bukan dengan rilis Sega
1984 yang asli.

Berkas game di `Tapper/` tidak pernah dimodifikasi oleh proses build.
