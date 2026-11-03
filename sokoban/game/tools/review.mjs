/**
 * @file Review tools: gallery generator, audit check, sheet composer, and current frame saves.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const paths = {
  root: path.resolve(__dirname, '../..'),
  review: path.resolve(__dirname, '../../review'),
  scratch: path.resolve(__dirname, '../../.scratch'),
};

/**
 * Creates and returns the path to a scratch directory.
 * @param {string} name
 * @returns {string}
 */
export function scratchDir(name) {
  const dir = path.join(paths.scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Saves current page screenshot at 1920x1080 JPEG q90 into review/current/<target>/<state>.jpg.
 * @param {object} page Playwright Page
 * @param {string} target Subfolder under current (e.g. 'room', 'title')
 * @param {string} state State name (e.g. 'arrival', 'solved')
 */
export async function saveCurrent(page, target, state) {
  const targetDir = path.join(paths.review, 'current', target);
  fs.mkdirSync(targetDir, { recursive: true });
  const outPath = path.join(targetDir, `${state}.jpg`);
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
  return outPath;
}

/**
 * Composes a 1920-wide sheet of 2 columns of 960x540 cells with Jost caption strips.
 * Uses a headless Playwright page with <canvas> (no image npm packages).
 *
 * @param {string} promptId e.g. '00-foundation'
 * @param {Array<{ src: string, label: string }>} cells
 * @returns {Promise<string>} Path to generated sheet.jpg
 */
export async function makeSheet(promptId, cells) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  const outDir = path.join(paths.review, 'prompts', promptId);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'sheet.jpg');

  // Convert cells src into base64 data URIs so the headless page can load them directly
  const preparedCells = cells.map((cell) => {
    let dataUri = cell.src;
    if (fs.existsSync(cell.src)) {
      const ext = path.extname(cell.src).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      const b64 = fs.readFileSync(cell.src).toString('base64');
      dataUri = `data:${mime};base64,${b64}`;
    }
    return {
      src: dataUri,
      label: cell.label,
    };
  });

  // Fonts path for Jost font injection
  const jostFontPath = path.join(paths.root, 'game/src/assets/fonts/jost-400.woff2');
  let jostBase64 = '';
  if (fs.existsSync(jostFontPath)) {
    jostBase64 = fs.readFileSync(jostFontPath).toString('base64');
  }

  const resultDataUri = await page.evaluate(
    async ({ cellsList, fontB64 }) => {
      // Inject Jost font if provided
      if (fontB64) {
        const fontFace = new FontFace(
          'Jost',
          `url(data:font/woff2;base64,${fontB64})`
        );
        await fontFace.load();
        document.fonts.add(fontFace);
      }

      const cols = 2;
      const cellW = 960;
      const cellH = 540;
      const numRows = Math.ceil(cellsList.length / cols);
      const width = 1920;
      const height = numRows * cellH;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#2b2833';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < cellsList.length; i++) {
        const cell = cellsList[i];
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);
        const x = colIdx * cellW;
        const y = rowIdx * cellH;

        // Load image
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            // Landscape frames fill the cell; a phone frame (portrait) is
            // letterboxed on the sheet's dark ground instead of stretched.
            if (img.naturalWidth / img.naturalHeight < (cellW / cellH) * 0.8) {
              const w = Math.round(cellH * img.naturalWidth / img.naturalHeight);
              ctx.fillStyle = '#2b2833';
              ctx.fillRect(x, y, cellW, cellH);
              ctx.drawImage(img, x + Math.round((cellW - w) / 2), y, w, cellH);
            } else {
              ctx.drawImage(img, x, y, cellW, cellH);
            }

            // Draw caption strip at bottom
            const stripH = 46;
            ctx.fillStyle = 'rgba(43, 40, 51, 0.78)';
            ctx.fillRect(x, y + cellH - stripH, cellW, stripH);

            // Caption text
            ctx.fillStyle = '#efe8f2';
            ctx.font = '400 18px "Jost", -apple-system, sans-serif';
            ctx.letterSpacing = '0.04em';
            ctx.textBaseline = 'middle';
            ctx.fillText(cell.label, x + 24, y + cellH - stripH / 2);

            resolve();
          };
          img.onerror = () => {
            // Placeholder if image fails
            ctx.fillStyle = '#3a3644';
            ctx.fillRect(x, y, cellW, cellH);
            ctx.fillStyle = '#efe8f2';
            ctx.font = '400 18px "Jost", sans-serif';
            ctx.fillText(`[${cell.label}]`, x + 24, y + 270);
            resolve();
          };
          img.src = cell.src;
        });
      }

      return canvas.toDataURL('image/jpeg', 0.8);
    },
    { cellsList: preparedCells, fontB64: jostBase64 }
  );

  const base64Data = resultDataUri.replace(/^data:image\/jpeg;base64,/, '');
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));

  await browser.close();
  console.log(`Generated sheet: review/prompts/${promptId}/sheet.jpg`);
  return outPath;
}

/**
 * Renders a 5x5 room grid schematic (960x540) for a range of rooms.
 * Scaled so all 25 rows sit within y = 0..480, safely above the 46px caption strip.
 *
 * @param {Array<object>} roomsList
 * @param {object} solutions
 * @param {string} outPath
 */
export async function renderRoomGrid(roomsList, solutions, outPath) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
  });

  // Fonts path for Jost font injection
  const jostFontPath = path.join(paths.root, 'game/src/assets/fonts/jost-400.woff2');
  let jostBase64 = '';
  if (fs.existsSync(jostFontPath)) {
    jostBase64 = fs.readFileSync(jostFontPath).toString('base64');
  }

  const dataUri = await page.evaluate(
    async ({ rooms, solutionsData, fontB64 }) => {
      if (fontB64) {
        const fontFace = new FontFace(
          'Jost',
          `url(data:font/woff2;base64,${fontB64})`
        );
        await fontFace.load();
        document.fonts.add(fontFace);
      }

      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#2b2833';
      ctx.fillRect(0, 0, 960, 540);

      const gridCols = 5;
      const gridRows = 5;
      const cellW = 960 / gridCols; // 192 px
      const gridH = 480;            // Leaves 60px at bottom for margin + caption strip
      const cellH = gridH / gridRows; // 96 px per row

      function drawHexagon(cx, cy, radius) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const hx = cx + radius * Math.cos(angle);
          const hy = cy + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
      }

      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        const cellX = col * cellW;
        const cellY = row * cellH;

        const sol = solutionsData[String(room.number)];
        const label = sol
          ? `${room.number} · ${sol.steps}/${sol.pushes}`
          : `${room.number} · belum`;

        // Label at top of cell
        ctx.fillStyle = '#efe8f2';
        ctx.font = '500 11px "Jost", -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, cellX + cellW / 2, cellY + 13);

        // Determine board drawing area
        const maxBoardW = cellW - 16; // 176 px
        const maxBoardH = cellH - 20; // 76 px
        const tileSize = Math.min(
          Math.floor(maxBoardW / room.cols),
          Math.floor(maxBoardH / room.rows),
          8
        );

        const boardPixelW = room.cols * tileSize;
        const boardPixelH = room.rows * tileSize;
        const startX = cellX + Math.floor((cellW - boardPixelW) / 2);
        const startY = cellY + 16 + Math.floor((maxBoardH - boardPixelH) / 2);

        // 1. Draw floor (#f2ece4)
        ctx.fillStyle = '#f2ece4';
        for (let r = 0; r < room.rows; r++) {
          for (let c = 0; c < room.cols; c++) {
            if (room.inside[r]?.[c] && !room.wall[r]?.[c]) {
              ctx.fillRect(startX + c * tileSize, startY + r * tileSize, tileSize, tileSize);
            }
          }
        }

        // 2. Draw walls (#8f8ab8)
        ctx.fillStyle = '#8f8ab8';
        for (let r = 0; r < room.rows; r++) {
          for (let c = 0; c < room.cols; c++) {
            if (room.wall[r]?.[c]) {
              ctx.fillRect(startX + c * tileSize, startY + r * tileSize, tileSize, tileSize);
            }
          }
        }

        // 3. Draw targets (rings)
        ctx.strokeStyle = '#8f8ab8';
        ctx.lineWidth = 1.2;
        const ringR = Math.max(tileSize * 0.35, 2);
        for (const tgt of room.targets) {
          const cx = startX + tgt.c * tileSize + tileSize / 2;
          const cy = startY + tgt.r * tileSize + tileSize / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 4. Draw objects (filled hexagons #5c5270)
        ctx.fillStyle = '#5c5270';
        const hexR = Math.max(tileSize * 0.38, 2.5);
        for (const obj of room.objects) {
          const cx = startX + obj.c * tileSize + tileSize / 2;
          const cy = startY + obj.r * tileSize + tileSize / 2;
          drawHexagon(cx, cy, hexR);
        }

        // 5. Draw start as dot (#c75d4d)
        if (room.start) {
          ctx.fillStyle = '#c75d4d';
          const cx = startX + room.start.c * tileSize + tileSize / 2;
          const cy = startY + room.start.r * tileSize + tileSize / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(tileSize * 0.22, 1.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      return canvas.toDataURL('image/jpeg', 0.9);
    },
    { rooms: roomsList, solutionsData: solutions, fontB64: jostBase64 }
  );

  const b64 = dataUri.replace(/^data:image\/jpeg;base64,/, '');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  await browser.close();
  return outPath;
}

/**
 * Builds review/prompts/00-foundation-fix-1/sheet.jpg with properly scaled 5x5 room grids.
 */
export async function buildFix1Sheet() {
  const roomsFile = path.join(paths.root, 'game/src/data/rooms.generated.json');
  const solutionsFile = path.join(paths.root, 'game/src/data/solutions.generated.json');

  const roomsData = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));
  const solutionsData = fs.existsSync(solutionsFile)
    ? JSON.parse(fs.readFileSync(solutionsFile, 'utf8')).solutions || {}
    : {};

  const { parseLevel } = await import('../src/core/level.js');

  function prepareBatch(startNum, endNum) {
    const batch = [];
    for (let num = startNum; num <= endNum; num++) {
      const room = roomsData.rooms.find((r) => r.number === num);
      if (!room) continue;
      const level = parseLevel(room.rows);
      batch.push({
        number: num,
        rows: level.rows,
        cols: level.cols,
        wall: level.wall,
        inside: level.inside,
        targets: level.targets,
        objects: level.objects,
        start: level.start,
      });
    }
    return batch;
  }

  const batch1 = prepareBatch(1, 25);
  const batch2 = prepareBatch(26, 50);

  const scratch = scratchDir('sheet-fix-1');
  const path1 = path.join(scratch, 'schematic-1-25.jpg');
  const path2 = path.join(scratch, 'schematic-26-50.jpg');

  console.log('Rendering Ruang 1–25 schematic (scaled)...');
  await renderRoomGrid(batch1, solutionsData, path1);

  console.log('Rendering Ruang 26–50 schematic (scaled)...');
  await renderRoomGrid(batch2, solutionsData, path2);

  const cells = [
    { src: path1, label: 'Ruang 1–25' },
    { src: path2, label: 'Ruang 26–50' },
    { src: path.join(paths.review, 'reference/room06-fajar.jpg'), label: 'Quality bar · Fajar' },
    { src: path.join(paths.review, 'reference/scrub-protest-up.jpg'), label: 'Quality bar · protes' },
  ];

  await makeSheet('00-foundation-fix-1', cells);

  // Clean up scratch files
  fs.rmSync(scratch, { recursive: true, force: true });
}

/**
 * Writes markdown content to review/prompts/<promptId>/summary.md.
 * @param {string} promptId
 * @param {string} md Markdown content
 */
export function writeSummary(promptId, md) {
  const dir = path.join(paths.review, 'prompts', promptId);
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'summary.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`Saved summary: review/prompts/${promptId}/summary.md`);
  return outPath;
}

/**
 * Rebuilds review/index.html with all embedded gallery data.
 */
export function gallery() {
  fs.mkdirSync(paths.review, { recursive: true });

  // 1. Collect prompts
  const promptsDir = path.join(paths.review, 'prompts');
  const promptList = [];
  if (fs.existsSync(promptsDir)) {
    const entries = fs.readdirSync(promptsDir).sort().reverse();
    for (const name of entries) {
      const p = path.join(promptsDir, name);
      if (fs.statSync(p).isDirectory()) {
        const sheetPath = path.join(p, 'sheet.jpg');
        const summaryPath = path.join(p, 'summary.md');
        promptList.push({
          id: name,
          hasSheet: fs.existsSync(sheetPath),
          sheetUrl: `prompts/${name}/sheet.jpg`,
          summaryMd: fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '',
        });
      }
    }
  }

  // 2. Collect current frames by target
  const currentDir = path.join(paths.review, 'current');
  const currentTargets = {};
  if (fs.existsSync(currentDir)) {
    for (const target of fs.readdirSync(currentDir)) {
      const tp = path.join(currentDir, target);
      if (fs.statSync(tp).isDirectory()) {
        currentTargets[target] = [];
        for (const file of fs.readdirSync(tp)) {
          if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
            currentTargets[target].push({
              name: path.parse(file).name,
              url: `current/${target}/${file}`,
            });
          }
        }
      }
    }
  }

  // 3. Collect reference frames (quality bar)
  const refDir = path.join(paths.review, 'reference');
  const referenceFrames = [];
  if (fs.existsSync(refDir)) {
    for (const file of fs.readdirSync(refDir)) {
      if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
        referenceFrames.push({
          name: path.parse(file).name,
          url: `reference/${file}`,
        });
      }
    }
  }

  const galleryData = {
    generated: new Date().toISOString(),
    prompts: promptList,
    current: currentTargets,
    reference: referenceFrames,
  };

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hening — Review Gallery</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #2b2833;
    --card: #34303e;
    --text: #efe8f2;
    --text-soft: rgba(239, 232, 242, 0.65);
    --border: #4a4558;
    --accent: #f2d1b8;
    --serif: "Cormorant Garamond", Georgia, serif;
    --sans: "Jost", -apple-system, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 48px 40px;
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  header {
    max-width: 1400px;
    margin: 0 auto 56px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  h1 {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 300;
    font-size: 46px;
    margin: 0;
    letter-spacing: 0.02em;
  }
  .sub {
    color: var(--text-soft);
    font-size: 13px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-top: 6px;
  }
  .container {
    max-width: 1400px;
    margin: 0 auto;
  }
  section {
    margin-bottom: 72px;
  }
  h2 {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 400;
    font-size: 28px;
    margin: 0 0 24px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 10px;
  }
  .prompt-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 32px;
    margin-bottom: 40px;
  }
  .prompt-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 20px;
  }
  .prompt-title {
    font-family: var(--serif);
    font-style: italic;
    font-size: 32px;
    color: var(--accent);
  }
  .sheet-container {
    margin: 24px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .sheet-container img {
    width: 100%;
    height: auto;
    display: block;
    transition: transform 0.25s ease;
  }
  .sheet-container:hover img {
    transform: scale(1.008);
  }
  .summary-box {
    margin-top: 24px;
    padding: 24px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text-soft);
  }
  .summary-box pre {
    background: rgba(0, 0, 0, 0.3);
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }
  .thumb-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--card);
    cursor: pointer;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }
  .thumb-card:hover {
    transform: translateY(-3px);
    border-color: var(--accent);
  }
  .thumb-card img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
  }
  .thumb-card .caption {
    padding: 10px 14px;
    font-size: 13px;
    color: var(--text);
    letter-spacing: 0.04em;
  }
  /* Lightbox */
  #lightbox {
    position: fixed;
    inset: 0;
    background: rgba(20, 18, 25, 0.94);
    display: none;
    place-items: center;
    z-index: 1000;
  }
  #lightbox.active {
    display: grid;
  }
  #lightbox img {
    max-width: 92vw;
    max-height: 88vh;
    border-radius: 6px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.8);
    border: 1px solid var(--border);
  }
  #lightbox .close-btn {
    position: absolute;
    top: 24px;
    right: 32px;
    color: #efe8f2;
    font-size: 32px;
    cursor: pointer;
  }
  #lightbox .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: #efe8f2;
    font-size: 40px;
    padding: 16px;
    cursor: pointer;
    user-select: none;
  }
  #lightbox .prev-btn { left: 24px; }
  #lightbox .next-btn { right: 24px; }
  #lightbox .caption {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 14px;
    letter-spacing: 0.1em;
    color: var(--text-soft);
  }
</style>
</head>
<body>

<header>
  <div>
    <h1>Hening</h1>
    <div class="sub">Galeri Tinjauan · Arsip Kualitas</div>
  </div>
  <div style="font-size: 12px; color: var(--text-soft);">
    Diperbarui: ${new Date().toLocaleString('id-ID')}
  </div>
</header>

<div class="container">
  <!-- Prompts -->
  <section id="prompts-section">
    <h2>Catatan Prompt</h2>
    <div id="prompts-list"></div>
  </section>

  <!-- Quality Bar (Reference) -->
  <section id="reference-section">
    <h2>Quality Bar (Referensi Asli)</h2>
    <div class="grid" id="reference-grid"></div>
  </section>

  <!-- Current Frames -->
  <section id="current-section">
    <h2>Tangkapan Terkini (Current)</h2>
    <div id="current-groups"></div>
  </section>
</div>

<!-- Lightbox Modal -->
<div id="lightbox">
  <span class="close-btn">&times;</span>
  <span class="nav-btn prev-btn">&#8249;</span>
  <span class="nav-btn next-btn">&#8250;</span>
  <img id="lb-img" src="" alt="preview">
  <div class="caption" id="lb-caption"></div>
</div>

<script>
const data = ${JSON.stringify(galleryData, null, 2)};

// Simple markdown to HTML renderer for summaries
function renderMd(md) {
  if (!md) return '';
  return md
    .replace(/^### (.*$)/gim, '<h4 style="margin:16px 0 8px;color:#f2d1b8;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="margin:20px 0 10px;color:#efe8f2;">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 style="margin:24px 0 12px;">$1</h2>')
    .replace(/^\\* (.*$)/gim, '<li>$1</li>')
    .replace(/\\*\\*(.*?)\\*\\*/gim, '<b>$1</b>')
    .replace(/\\*(.*?)\\*/gim, '<i>$1</i>')
    .replace(/\\n/gim, '<br>');
}

// Lightbox state
let lightboxImages = [];
let currentIdx = 0;

function openLightbox(url, caption) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lb-img');
  const cap = document.getElementById('lb-caption');
  img.src = url;
  cap.textContent = caption || '';
  lb.classList.add('active');

  currentIdx = lightboxImages.findIndex(item => item.url === url);
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
}

function nextLightbox() {
  if (lightboxImages.length === 0) return;
  currentIdx = (currentIdx + 1) % lightboxImages.length;
  const item = lightboxImages[currentIdx];
  document.getElementById('lb-img').src = item.url;
  document.getElementById('lb-caption').textContent = item.caption || '';
}

function prevLightbox() {
  if (lightboxImages.length === 0) return;
  currentIdx = (currentIdx - 1 + lightboxImages.length) % lightboxImages.length;
  const item = lightboxImages[currentIdx];
  document.getElementById('lb-img').src = item.url;
  document.getElementById('lb-caption').textContent = item.caption || '';
}

// Render prompts
const promptsEl = document.getElementById('prompts-list');
if (data.prompts.length === 0) {
  promptsEl.innerHTML = '<p style="color:var(--text-soft);">Belum ada lembar prompt.</p>';
} else {
  data.prompts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.innerHTML = \`
      <div class="prompt-header">
        <div class="prompt-title">Prompt \${p.id}</div>
      </div>
      \${p.hasSheet ? \`
        <div class="sheet-container" onclick="openLightbox('\${p.sheetUrl}', 'Prompt \${p.id} Sheet')">
          <img src="\${p.sheetUrl}" alt="Sheet \${p.id}">
        </div>
      \` : ''}
      \${p.summaryMd ? \`
        <div class="summary-box">\${renderMd(p.summaryMd)}</div>
      \` : ''}
    \`;
    promptsEl.appendChild(card);
    if (p.hasSheet) lightboxImages.push({ url: p.sheetUrl, caption: \`Prompt \${p.id} Sheet\` });
  });
}

// Render quality bar reference
const refGrid = document.getElementById('reference-grid');
data.reference.forEach(item => {
  const card = document.createElement('div');
  card.className = 'thumb-card';
  card.onclick = () => openLightbox(item.url, item.name);
  card.innerHTML = \`
    <img src="\${item.url}" alt="\${item.name}" loading="lazy">
    <div class="caption">\${item.name}</div>
  \`;
  refGrid.appendChild(card);
  lightboxImages.push({ url: item.url, caption: item.name });
});

// Render current frames
const currentEl = document.getElementById('current-groups');
const currentKeys = Object.keys(data.current);
if (currentKeys.length === 0) {
  currentEl.innerHTML = '<p style="color:var(--text-soft);">Belum ada tangkapan layar terkini.</p>';
} else {
  currentKeys.forEach(target => {
    const group = document.createElement('div');
    group.innerHTML = \`<h3 style="margin:28px 0 12px;font-family:var(--serif);font-size:22px;">Target: \${target}</h3>\`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    data.current[target].forEach(item => {
      const card = document.createElement('div');
      card.className = 'thumb-card';
      card.onclick = () => openLightbox(item.url, \`\${target} / \${item.name}\`);
      card.innerHTML = \`
        <img src="\${item.url}" alt="\${item.name}" loading="lazy">
        <div class="caption">\${item.name}</div>
      \`;
      grid.appendChild(card);
      lightboxImages.push({ url: item.url, caption: \`\${target} / \${item.name}\` });
    });
    group.appendChild(grid);
    currentEl.appendChild(group);
  });
}

// Lightbox event listeners
document.querySelector('#lightbox .close-btn').onclick = closeLightbox;
document.querySelector('#lightbox .next-btn').onclick = (e) => { e.stopPropagation(); nextLightbox(); };
document.querySelector('#lightbox .prev-btn').onclick = (e) => { e.stopPropagation(); prevLightbox(); };
document.getElementById('lightbox').onclick = (e) => { if (e.target.id === 'lightbox') closeLightbox(); };

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') nextLightbox();
  if (e.key === 'ArrowLeft') prevLightbox();
});
</script>

</body>
</html>`;

  const outHtmlPath = path.join(paths.review, 'index.html');
  fs.writeFileSync(outHtmlPath, html, 'utf8');
  console.log(`Rebuilt gallery: review/index.html`);
  return outHtmlPath;
}

/**
 * Audits repository for images located outside of sanctioned directories.
 * Prints nothing and exits 0 when clean.
 */
export function audit() {
  const allowedDirs = new Set([
    'review',
    '.scratch',
    'original',
    'src',
    'src-game',
    '_archive',
    'node_modules',
    '.git',
    '.gemini',
  ]);

  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff']);
  const violations = [];

  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!allowedDirs.has(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (imageExts.has(ext)) {
          violations.push(fullPath);
        }
      }
    }
  }

  scan(paths.root);

  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`Audit violation: Image found outside sanctioned directories: ${v}`);
    }
    process.exit(1);
  }

  // Clean exit: prints nothing
  process.exit(0);
}

/**
 * Builds review/prompts/03-modes-garden/sheet.jpg with the 12 specified cells (prompt 03 §Deliverable).
 */
export async function build03ModesSheet() {
  const currentDir = path.join(paths.review, 'current/modes');
  const cells = [
    { src: path.join(currentDir, 'gate-choice.jpg'), label: 'gerbang · pilih jalan' },
    { src: path.join(currentDir, 'dupa-stick.jpg'), label: 'dupa · menyala' },
    { src: path.join(currentDir, 'dupa-last-minute.jpg'), label: 'dupa · menit terakhir' },
    { src: path.join(currentDir, 'dupa-padam.jpg'), label: 'dupa telah padam' },
    { src: path.join(currentDir, 'results-dupa.jpg'), label: 'selesai · dupa' },
    { src: path.join(currentDir, 'records-dupa.jpg'), label: 'batu catatan · dupa' },
    { src: path.join(currentDir, 'mimpi.jpg'), label: 'mimpi' },
    { src: path.join(currentDir, 'helper.jpg'), label: 'penunjuk' },
    { src: path.join(currentDir, 'garden-slots.jpg'), label: 'taman sendiri · daftar' },
    { src: path.join(currentDir, 'garden-editor.jpg'), label: 'taman sendiri · menyunting' },
    { src: path.join(currentDir, 'garden-play.jpg'), label: 'taman sendiri · coba' },
    { src: path.join(currentDir, 'phone-editor.jpg'), label: 'ponsel · menyunting' },
  ];

  await makeSheet('03-modes-garden', cells);
}

/**
 * Builds review/prompts/04-themes/sheet.jpg with the 12 specified cells (prompt 04 §Deliverable).
 */
export async function buildThemesSheet() {
  const currentDir = path.join(paths.review, 'current/themes');
  const cells = [
    { src: path.join(currentDir, 'lentera-instanced-room06.jpg'), label: 'lentera · instanced (ruang 06)' },
    { src: path.join(currentDir, 'bintang-room06.jpg'), label: 'cahaya bintang · ruang 06' },
    { src: path.join(currentDir, 'bintang-closeup.jpg'), label: 'cahaya bintang · dekat' },
    { src: path.join(currentDir, 'batu-room06.jpg'), label: 'taman batu · ruang 06' },
    { src: path.join(currentDir, 'batu-rings.jpg'), label: 'taman batu · lingkaran pasir' },
    { src: path.join(currentDir, 'candi-room06.jpg'), label: 'candi · ruang 06' },
    { src: path.join(currentDir, 'candi-closeup.jpg'), label: 'candi · dekat' },
    { src: path.join(currentDir, 'mata-air-room06.jpg'), label: 'mata air · ruang 06' },
    { src: path.join(currentDir, 'mata-air-sealed.jpg'), label: 'mata air · semua tertutup' },
    { src: path.join(currentDir, 'malam-all.jpg'), label: 'malam · keempat tema' },
    { src: path.join(currentDir, 'kolam-themes.jpg'), label: 'kolam · tema' },
    { src: path.join(currentDir, 'floor2-candi.jpg'), label: 'lantai II · candi' },
  ];

  await makeSheet('04-themes', cells);
}

// CLI handler
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'gallery') {
    gallery();
  } else if (cmd === 'audit') {
    audit();
  } else if (cmd === 'sheet') {
    const target = process.argv[3];
    let fn = buildFix1Sheet;
    if (target === '03' || target === '03-modes-garden') fn = build03ModesSheet;
    else if (target === '04' || target === '04-themes') fn = buildThemesSheet;
    fn().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    console.log('Usage: node tools/review.mjs [gallery|audit|sheet [04-themes]]');
  }
}
