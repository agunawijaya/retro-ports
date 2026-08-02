# Protokol loop tanpa pengawasan

Berkas ini adalah kontrak yang dijalankan Claude saat bekerja sendirian
(dijadwalkan cron, tanpa ada yang menonton). Isinya sengaja pendek: satu
siklus, beberapa aturan berhenti, dan daftar hal yang **tidak boleh**
dilakukan justru ketika tergoda menyelesaikan pekerjaan lebih cepat.

## Fase 1 — penamaan: **SELESAI**

575 dari 575 label bernama, nol generik, 21 siklus, build byte-identik di
setiap siklus. Laporannya di [PROGRESS.md](PROGRESS.md).

## Fase 3 — katalog sprite penuh: **SELESAI**

Ketiga sasaran tertutup dalam 6 siklus. Katalognya di `screens/`. Fase
berikutnya adalah porting — lihat `PORTING.md`, bukan berkas ini.

Tujuan: merender **enam ukuran sprite sisanya** (8x8, 12x16, 16x12,
16x16, 24x22, 32x22) seperti 32x16 sudah dirender ke
`screens/sprites.png`.

| # | Sasaran | Selesai berarti |
|---|---|---|
| 1 | Temukan tabel pointer tiap ukuran | Alamat tabel + jumlah entri, dari kode yang membacanya |
| 2 | Render tiap ukuran ke PNG | Gambar **dibuka dan dilihat**, latarnya transparan, isinya koheren |
| 3 | Petakan ukuran ke pemakainya | Rutin blit mana memakai tabel mana, dari xref |

Aturan tambahan fase ini, dari pelajaran #5: **PNG yang tersimpan bukan
bukti.** Sebuah render dianggap selesai hanya setelah gambarnya dibuka
dan isinya diperiksa. Dua kali di proyek ini keluaran yang "berhasil"
ternyata separuh salah.

## Fase 2 — semantik: SELESAI

Tujuan: **menutup pertanyaan terbuka dengan bukti**, bukan menambah
nama atau menambah prosa.

Bedanya dengan fase 1 penting dan harus disadari terus: penamaan punya
ukuran objektif — label generik habis atau tidak. Semantik **tidak
punya**. Karena itu setiap sasaran di bawah harus punya kriteria
"selesai" yang bisa gagal, dan sasaran tanpa kriteria semacam itu tidak
boleh dikerjakan dalam loop.

### Antrean, dengan kriteria selesainya

| # | Sasaran | Selesai berarti |
|---|---|---|
| 1 | Kepemilikan entri tabel sprite | `sprite_sheet.py` melaporkan pasangan record↔indeks untuk **lebih dari tiga** indeks, dari runtime bukan pengamatan mata |
| 2 | `or bx, 0xe000` di `CS:3B5D` | Terukur apa yang dibaca `play_rom_noise` di F000:0000-1FFF, lalu dinyatakan bug atau bukan — dengan angka |
| 3 | Dua `in al, 0x3da` di `CS:1EC9` | Ada bukti kedua bahwa itu tunggu-retrace yang lumpuh, atau klaim dicabut |
| 4 | 54 instruksi masih `db` | Jumlahnya turun, **atau** dicatat kenapa tiap sisa tidak bisa turun |
| 5 | Katalog sprite | Sprite dirender dengan latarnya, seperti `screens/` dan `render_player.py` sudah membuktikan bisa |

Kerjakan **satu** sasaran per siklus. Sasaran yang macet setelah dua
siklus dipindahkan ke "Terbuka untuk manusia" di `PROGRESS.md`, bukan
dipaksakan.

## Satu siklus

1. Pilih sasaran teratas yang belum selesai dari antrean di atas.
2. Kerjakan dengan **bukti yang bisa gagal** — ukuran, render, atau
   pembacaan kode sampai `ret`. Bukan penalaran saja.
3. Kalau menyentuh `tools/reconstruct.py`: regenerate, **tunggu
   selesai**, `.\build.cmd` harus `byte-identical`.
4. `python tools/check_docs.py --fix`
5. `git add -A && git commit`
6. Catat satu baris ke `PROGRESS.md`.

## Aturan berhenti

Loop berhenti sendiri, dan **melapor**, bila salah satu terjadi:

- **Seluruh antrean selesai atau dipindahkan ke "Terbuka untuk
  manusia".**
- **Build merah dan tidak bisa dipulihkan dalam satu percobaan.**
  `git checkout -- tools/reconstruct.py`, regenerate, pastikan hijau
  lagi, lalu berhenti dan tulis sebabnya.
- **Dua siklus berturut-turut tanpa bukti baru.** Artinya yang tersisa
  butuh keputusan manusia, bukan waktu lebih banyak.

## Yang tidak boleh, terutama saat ingin cepat

- **Jangan menyunting `src/tapper.asm` dengan tangan.** Berkas itu
  dihasilkan alat.
- **Jangan menulis kesimpulan yang tidak bisa gagal.** Prosa yang
  terdengar meyakinkan tanpa cara membuktikannya salah adalah kegagalan
  fase ini, bukan hasilnya.
- **Jangan menamai atau menyimpulkan dari satu sumber.** Tabel koreksi
  di `DECISIONS.md` seluruhnya lahir dari kebiasaan ini.
- **Jangan percaya keluaran yang ada tanpa membukanya.** Adanya PNG
  bukan berarti PNG-nya benar — pelajaran yang sudah tercatat.
- **Jangan commit kalau build merah.** Tidak ada pengecualian.
- **Jangan mengejar jumlah.** Satu pertanyaan tertutup dengan bukti
  lebih berharga daripada lima paragraf baru.

## Sapuan klaim basi

Sekali tiap beberapa siklus, cari klaim yang membusuk: nama simbol lama
di komentar, angka yang tidak lagi benar, "belum terpecahkan" untuk hal
yang sudah terpecahkan. Fase 1 menemukan empat; sapuan terakhir
menemukan lima rujukan "enam varian blitter" yang seharusnya tujuh —
padahal koreksinya sudah tercatat di `FINDINGS.md` sendiri.

## Kalau ragu

Tinggalkan pertanyaannya terbuka, tulis alasannya di `PROGRESS.md` di
bawah **Terbuka untuk manusia**, dan lanjut ke sasaran berikutnya.
Pertanyaan terbuka yang jujur tidak merugikan siapa pun; jawaban yang
salah merugikan.
