# Tapper — working in this folder

*Tapper, Bally Midway / Sega, 1984. Moved into this repository on 2026-08-02
from a separate one where it had been reconstructed by another agent. This
section records what changed in the move and where the reading stands; what
follows it is that work, unaltered.*

## What changed in the move

**The reconstruction is no longer stored.** `src/tapper.asm` was 528 KB of
NASM that assembles to a byte-identical copy of `TAPPER.COM` — the same
SHA-256, `EC85DB55…`. That is the game in source form, and this repository
does not carry the game. It is regenerated into `recovered/` by `build.ps1`,
from a copy you own, in about ten seconds. The old repository had no remote,
so nothing was ever published.

**The eleven sprite sheets and screen captures moved to `reference/`**, which
is gitignored for the reason the repository's `.gitignore` states out loud: a
PNG pulled out of a copyrighted game is still that game.

**`symbols.json` changed coordinates.** Routine keys are file offsets, because
that is what `comrec` labels are. Global keys are addresses, because that is
how a `.COM` listing writes a memory operand. They had been the same way round,
and getting it wrong substituted one global in a hundred and seventy-six —
silently, because a symbol that never lands cannot fail loudly.

## Where the reading stands

    .\build.ps1 -Toolkit ..\..\DOS-Decompiler -Nasm C:\path\to\nasm.exe

| | |
|---|---|
| rebuild | **byte-identical**, `EC85DB55…` |
| routines named | **583 — all 77 call targets and every tail-call entry** |
| variables named | 182 |
| decoded as code | **74.5%** of the file |
| **still unnamed** | **133 addresses the listing references** |

That last row is the difference between this game and the other five here,
which have none. `build.ps1` prints the list every time it runs, and the list
is the work queue.

The 74.5% is worth a note. A recursive walk reaches what something branches to,
and this release's crack installs an INT 80h floppy shim through a loader that
never runs under reconstruction — so those bytes stayed data and the names for
them landed nowhere. `comrec --entries-from symbols.json` seeds the walk with
every routine the symbol file knows about, which took the file from 68.9% to
74.5% with byte-identity still deciding. The flag was added for this game.

---

# Petunjuk kerja di repo ini

Repo ini berisi rekonstruksi **byte-identik** Tapper (IBM PC, 1984) dari
salinan ter-crack, lengkap dengan alat dan dokumentasinya.

Baca ini dulu sebelum menyentuh apa pun.

## Aturan yang tidak boleh dilanggar

1. **Jangan pernah menyunting `src/tapper.asm` dengan tangan.** Berkas
   itu dihasilkan `tools/reconstruct.py`. Semua anotasi masuk ke
   `NAMED_CODE`, `NAMED_DATA`, `ROUTINE_DOCS` di sana.
2. **Build harus tetap byte-identik.** `.\build.cmd` (atau `build.sh`)
   wajib mencetak `byte-identical`. Kalau merah, kembalikan
   (`git checkout -- tools/reconstruct.py`), regenerate, pastikan hijau,
   baru cari tahu sebabnya.
3. **Jangan commit kalau build merah.** Tidak ada pengecualian.
4. **Tunggu `reconstruct.py` selesai sebelum build.** Membangun di
   tengah regenerasi menghasilkan kegagalan palsu — ini sudah pernah
   terjadi dan memakan waktu.
5. **Jangan menamai atau menyimpulkan dari satu sumber.** Seluruh tabel
   koreksi di `DECISIONS.md` lahir dari kebiasaan ini.

## Siklus kerja standar

```
python tools/hot_vars.py          # variabel apa yang ramai
python tools/audit_symbols.py     # nama apa yang lemah
#   baca src/tapper.asm SAMPAI `ret`, bukan sampai paham garis besar
#   sunting tools/reconstruct.py
python tools/reconstruct.py       # TUNGGU sampai selesai
.\build.cmd                       # HARUS byte-identical
python tools/check_docs.py --fix  # sinkronkan angka di dokumentasi
git add -A && git commit
```

## Kebiasaan yang terbukti mahal kalau dilewatkan

- **Cari penulisnya, bukan pembacanya.** Nama yang lahir dari efek
  hampir selalu terbalik arahnya (`slow_machine_flag` → `is_pcjr`).
- **Baca rutin sampai `ret`.** Nama dari empat baris pertama sudah
  menghasilkan tiga koreksi (`erase_bar_list_a/b`, `spawn_mug`).
- **Keluaran yang ada belum tentu benar.** PNG tersimpan bukan bukti;
  buka dan lihat. `sprites.png` "berhasil" dengan separuh isi salah.
- **Ketiadaan hasil bukan ketiadaan fakta.** Grep tidak menemukan
  rujukan ≠ tidak terjangkau (`CS:4690` ternyata intro crack yang jalan
  tiap startup).
- **Sapu klaim basi secara berkala.** Angka dan nama simbol membusuk
  diam-diam. Sudah tiga kali ditemukan, termasuk di dalam paragraf yang
  menjelaskan jebakan itu sendiri.

## Peta dokumentasi

| berkas | isi |
|---|---|
| `README.md` | status, cara membangun, daftar perkakas |
| `ARCHITECTURE.md` | peta memori, shim disk, pipeline aset dan render |
| `FINDINGS.md` | temuan teknis, terperinci, dengan alamatnya |
| `DECISIONS.md` | **tabel koreksi** — setiap klaim yang pernah salah |
| `PLAYBOOK.md` | metodologi RE game DOS, bisa dipakai proyek lain |
| `PROGRESS.md` | catatan kerja tiga fase, dan apa yang masih terbuka |
| `GAME.md` | tentang game-nya sendiri |
| `TEACHING.md` | pelajaran pemrograman dari kode ini |
| `PORTING.md` | opsi bahasa untuk port, dan pertimbangannya |
| `LOOP.md` | protokol kerja tanpa pengawasan |

## Status singkat

- 576 label, seluruhnya bernama, nol generik
- Build byte-identik
- Katalog sprite lengkap di `screens/`
- Terbuka: dua hal yang butuh mesin PC/PCjr asli — **bukan** penghalang
  recompile, lihat `PROGRESS.md`

## Provenance — sebutkan, jangan sembunyikan

Salinan ini **bukan binary pristine**. Title screen asli didahului intro
grup crack, entry point dipatch di `CS:0110`. Untuk memahami format data
itu justru membantu, tapi untuk klaim arkival ini bukan rilis 1984.
Setiap dokumen yang menyebut "asli" harus jelas maksudnya yang mana.
