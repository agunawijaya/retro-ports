# 07 — Resume Prompt: Karateka T-Rex-style Remake

> Copy-paste blok di bawah ini ke Claude session baru saat Anda siap melanjutkan.
> Sesi sebelumnya sudah menyiapkan semua asset dan dokumentasi yang diperlukan.

---

## Prompt untuk dipaste ke Claude

```
Saya ingin remake Karateka dengan style seperti Chrome T-Rex offline game
(single HTML file, Canvas2D, TypeScript, satu URL siap-deploy).

Project sudah punya basis lengkap di:
  E:\Projects\DOS Games\Karateka\karateka\

Baca dulu (ringkas):
  01-game-logic.md          — model game (FSM, etiquette, scripted events)
  02-pseudo-code.md          — pseudo-code engine loop, FSM, collision
  04-best-language-to-remake.md — keputusan: TypeScript + Canvas2D
  05-trex-style-remake.md   — arsitektur target, file layout, estimasi effort
  08-original-files-inventory.md — apa file original game DOS
  09-runtime-memory-and-capture.md — WAJIB kalau mau pakai/extract asset DOS

JANGAN baca:
  - 03-decompile-disassemble.md, 06-debug-findings.md (IBM PC reverse-engineering;
    sudah selesai, tidak diperlukan untuk remake — TAPI 06 §12 berisi runtime
    memory map kalau perlu reference)
  - extract_karateka.py, disasm_karateka.py, compose_scene.py, hgr_scan.py
    (research tools; remake tidak pakai ini)
  - extracted/sprites/, extracted/scenes/, extracted/hgr_scan*/ (output research,
    visual hasilnya kurang clean — JANGAN pakai)

JANGAN COBA EXTRACT SPRITE DARI K*.DAT pakai BAL/CAL figure number — itu
NAMESPACE BERBEDA dengan IND sprite IDs. Lihat 09 sebelum mencoba.

Asset yang DIPAKAI ada di remake_assets/:
  apple_ii/
    hero.png             ← Hero, 8 animation group LABELED (Idle/Fighting Stance,
                            Reverence, Kicking, Punching, Walking, Stepping,
                            Victory, Running) — orange-on-black HGR style
    princess.png         ← Princess Mariko, 7 anim group labeled
    title_screen.png     ← Brøderbund splash + "A Game By Jordan Mechner" +
                            "KARATEKA" wordmark + opening narrative text
  nes/
    hero.png             ← Hero, 8 anim + Death — pink/magenta, MOST recognisable
    akuma.png            ← Akuma boss with red headband
    enemies.png          ← Guards (blue, same skeleton as hero)
    mariko.png           ← Princess Mariko (NES, pink)
  backgrounds/
    akuma_castle.png     ← Title scene (moon + pagoda + demon-horn)
    fight_room.png       ← Arena interior
    marikos_cell.png     ← Prison interior
  dos_backgrounds/       ← NEW: pixel-perfect CGA renders captured from the
                            original DOS game via DOSBox-X memory dumps.
                            Use these if you want byte-exact DOS look (black
                            / cyan / magenta / white CGA palette 1):
    castle_title.png         ← Akuma's castle title screen (CASTLE.BCG, 320x192)
    title_wordmark.png       ← KARATEKA wordmark screen (TITLE.BCG, 320x54)
    splash_jordan_mechner.png← "A Game By Jordan Mechner" splash text
    mt_fuji.png              ← Mt Fuji silhouette (FUJI.BCG, 320x35, recurring backdrop)
    torii_gate_full.png      ← Tall torii gate with crenelated lintel (outdoor scenes)
    torii_pillar_only.png    ← Just one torii pillar column (for tiling)
    building_gate.png        ← Ornate pagoda-roof gate (palace entrance)
    fence_section.png        ← Horizontal cliff-edge fence + post (overlooks the ocean)
    ocean.png                ← Cyan-on-black sea — visible behind the cliff fence;
                                player arrived at the island by ocean
    plateau_magenta.png      ← Magenta foreground plateau where hero walks
    cell_door_closed_partial.png ← Magenta double door (CLOSED) — interior cell;
                                the crop captures only part of the full door
    cell_window_grille.png   ← Horizontal cyan window grille (interior fight room)
    cell_floor.png           ← Striped magenta interior floor tiling
    power_meter_outdoor.png  ← HUD POWER METER (bottom strip) seen on outdoor cliff
                                scene: magenta right-facing triangles = player power,
                                cyan left-facing triangles = computer's power
    power_meter_indoor.png   ← Same HUD power meter as seen inside the building
    _scene_*.png             ← Full 320x200 reference renders of each captured scene
    _contact_sheet.png       ← All pieces laid out in one image for review

Tujuan: build single-page TypeScript + Canvas2D remake. Deliverable:
  - 1 HTML file (loadable via file:// or GitHub Pages)
  - Boot: title screen → press any key → first encounter
  - Vertical slice: hero walks right, meets one guard, bow, fight, win
  - Sprites animated frame-by-frame from sheets
  - Keyboard: ←/→ move, Space toggle stance, Z punch, X kick, ↑↓ height
  - CGA palette feel (pakai kombinasi black/cyan/magenta/white untuk gameplay
    OR pakai Apple II orange/blue palette — bebas pilih, asal consistent)

Mulai dengan:
  1. Setup project: src/main.ts, src/actor.ts, src/anim.ts, src/sprites.ts,
     index.html, plus build via Vite or esbuild
  2. Sprite-sheet slicer: parse the labeled PNGs, identify frame boundaries
     (manual coords table is fine — labels are visible in sheets)
  3. Implement Actor FSM (state diagram di 01-game-logic.md §4)
  4. Render loop dengan requestAnimationFrame
  5. Test: walk + stance toggle works
  6. Add: one guard, bow encounter, basic combat
  7. Polish: title screen, end conditions

Output: kode TypeScript clean, tanpa engine dependency selain Pixi.js OPTIONAL
(boleh raw Canvas2D, lebih simple). Deploy target: GitHub Pages atau itch.io.

Saya sudah download asset, semua sudah di tempat. Anda fokus ke code & integration.
```

---

## Apa yang sudah siap (jangan harus dibuat ulang)

Di `E:\Projects\DOS Games\Karateka\karateka\`:

**Documentation (referensi saja, no execution needed)**
- `01-game-logic.md` — game model, FSM, etiquette sub-system
- `02-pseudo-code.md` — engine loop pseudo-code
- `04-best-language-to-remake.md` — keputusan stack
- `05-trex-style-remake.md` — target architecture
- `08-original-files-inventory.md` — apa saja file original game DOS
- `09-runtime-memory-and-capture.md` — **WAJIB BACA kalau mau extract sprite
  tambahan dari game DOS.** Menjelaskan kenapa lookup IND sprite ID langsung
  dari BAL/CAL script TIDAK BISA (ada 3 layer indirection), dan workflow
  capture pakai DOSBox-X yang sudah terbukti bekerja.

**Clean assets (langsung pakai)**
- `remake_assets/apple_ii/` — Hero, Princess, Title sequence (Apple II rips)
- `remake_assets/nes/` — Hero, Akuma, Enemies, Mariko (NES rips, paling clean)
- `remake_assets/backgrounds/` — Akuma's Castle, Fight Room, Mariko's Cell (rips)
- `remake_assets/dos_backgrounds/` — **NEW.** Pixel-perfect CGA renders captured
  from the original DOS game via DOSBox-X memory dumps. 15 cropped background
  pieces + 6 full-scene references + 1 contact sheet. Use these if you want
  the byte-exact original DOS look.

**Reference dari live game (untuk visual ground truth)**
- `extracted/boot_seq*.png` — screenshot dari DOSBox-X running Karateka asli
- `extracted/dosbox_run.png` — confirmation game booted
- `extracted/GROUND_TRUTH.html` — side-by-side comparison page
- `extracted/shadow_renders/` — full-scene renders decoded from runtime
  shadow-buffer dumps (each one is a 320x200 PNG of an exact in-game frame)
- `screenshots/` — DOSBox-X screen captures (window incl. title bar)
- `MEMDUMP_*.BIN` — raw memory dumps from DOSBox-X (kept for re-analysis)

**Yang tidak dipakai (skip):**
- Semua `K?*.DAT`, `K?*.IND` (DOS sprite packs — character actor sprites, but
  the figure-to-sprite indirection is only partially decoded; structural
  pieces aren't here at all. Lihat `09-runtime-memory-and-capture.md`)
- `extracted/sprites/` (output decoder saya, hasil messy — known broken)
- `extracted/scenes/` (composition output, hasil partial)
- `extracted/hgr_scan*/` (disk extraction, hasil ber-noise)
- `dosbox-x_run.conf`, `KARATEKA_NOCHK.EXE` (DOSBox setup, sudah diverifikasi tapi
  remake tidak butuh ini)

---

## Quick-start checklist (untuk Anda sendiri saat siap mulai)

- [ ] Buka folder project
- [ ] Buka `remake_assets/` — pastikan semua PNG ada
- [ ] Buka Claude Code di folder ini
- [ ] Paste prompt di atas
- [ ] Tunggu setup project
- [ ] Test boot: `npm run dev` atau equivalent
- [ ] Iterate

---

## Estimasi effort (dari `05-trex-style-remake.md`)

Untuk solo dev familiar dengan TypeScript:

| Phase | Time |
|---|---|
| Setup project + engine skeleton + 1 hero sprite | 1 weekend |
| Hero walking + stance toggle + 1 guard + bow + fight | 1 weekend |
| Multiple guards + level scripting (events di X-position) | 1 weekend |
| Eagle + Princess + title + ending | 1 weekend |
| Polish + audio (WebAudio square waves) + deploy | 1 weekend |

**Total ~5 weekend** untuk versi lengkap. Vertical slice (hero + 1 guard) bisa dikejar dalam **1 weekend**.

---

## Catatan jujur dari sesi sebelumnya

- IBM PC sprite reverse-engineering: format dipecahkan secara struktur (`0x7B` RLE,
  3-byte header, column-major RTL, bit-reverse) — tapi composition list (cara
  engine merakit karakter utuh dari pieces) hanya partial. Jangan habiskan waktu
  decode ulang — pakai Apple II/NES rips saja.
- Apple II disk extraction: copy-protection menghalangi parse normal. Pattern-scan
  HGR berhasil dapat beberapa scene image, tapi noisy. Cukup pakai Spriters
  Resource rips.
- DOSBox-X boot: butuh `PRNGAL` + `TITLE.BCG` di folder game (atau patch EXE).
  Detail di `06-debug-findings.md` kalau Anda ingin run game asli untuk visual
  reference.

Untuk REMAKE, semua itu tidak relevan. Pure TypeScript + Canvas2D, asset sudah
clean, game design jelas di docs. Tinggal eksekusi.
