// Single review & scratch image manager for Spyder (ART-DIRECTION §15).
//
// Exports:
//   paths                        { spyderRoot, reviewRoot, scratchRoot }
//   scratchDir(name)             creates & returns .scratch/<name>/
//   saveHero(page, target, st)   1920×1080 JPEG q90 -> review/current/<target>/<st>.jpg
//   makeSheet(promptId, cells)   2-col 960×540 JPEG q80 -> review/prompts/<promptId>/sheet.jpg
//   writeSummary(promptId, md)   writes review/prompts/<promptId>/summary.md
//   buildGallery()               rebuilds review/index.html
//   audit()                      returns stray image paths outside allowed folders
//
// CLI:
//   node review.mjs gallery
//   node review.mjs audit

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameRoot, launch, spyderRoot } from './common.mjs';

export const paths = Object.freeze({
  spyderRoot,
  reviewRoot: join(spyderRoot, 'review'),
  scratchRoot: join(spyderRoot, '.scratch'),
});

export function scratchDir(name = 'default') {
  const dir = join(paths.scratchRoot, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function saveHero(page, target, state) {
  const dir = join(paths.reviewRoot, 'current', target);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${state}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
  return file;
}

export function writeSummary(promptId, markdown) {
  const dir = join(paths.reviewRoot, 'prompts', promptId);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'summary.md');
  writeFileSync(file, `${String(markdown).trim()}\n`, 'utf8');
  return file;
}

function toDataUrl(src) {
  if (Buffer.isBuffer(src)) {
    const isPng = src[0] === 0x89 && src[1] === 0x50;
    return `data:image/${isPng ? 'png' : 'jpeg'};base64,${src.toString('base64')}`;
  }
  const str = String(src);
  if (str.startsWith('data:')) return str;
  const filePath = str.startsWith('file:')
    ? fileURLToPath(str)
    : existsSync(resolve(str))
      ? resolve(str)
      : resolve(paths.spyderRoot, str);
  const buf = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export async function makeSheet(promptId, cells, opts = {}) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error('makeSheet requires a non-empty cells array: [{ src, label }]');
  }
  const dir = join(paths.reviewRoot, 'prompts', promptId);
  mkdirSync(dir, { recursive: true });
  const outFile = join(dir, 'sheet.jpg');

  const fontPath = join(gameRoot, 'fonts', 'special-elite-latin-400-normal.woff2');
  const fontB64 = readFileSync(fontPath).toString('base64');
  const prepared = cells.map((c) => ({
    dataUrl: toDataUrl(c.src),
    label: c.label ? String(c.label) : '',
  }));

  const ownBrowser = !opts.browser;
  const browser = opts.browser || (await launch());
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Special Elite';
    font-style: normal;
    font-weight: 400;
    src: url("data:font/woff2;base64,${fontB64}") format("woff2");
  }
  body { margin: 0; background: #16120F; }
</style>
</head>
<body><canvas id="sheet"></canvas></body>
</html>`);

    await page.evaluate(async () => {
      await document.fonts.ready;
      try {
        await document.fonts.load('16px "Special Elite"');
      } catch {
        // fallback if font load rejects
      }
    });

    const jpegB64 = await page.evaluate(async (items) => {
      const cellW = 960;
      const cellH = 540;
      const cols = 2;
      const rows = Math.ceil(items.length / cols);
      const canvas = document.getElementById('sheet');
      canvas.width = cellW * cols;
      canvas.height = cellH * rows;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.fillStyle = '#16120F';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const loadImg = (url) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => rej(new Error('Failed to decode cell image'));
          img.src = url;
        });

      for (let i = 0; i < items.length; i++) {
        const { dataUrl, label } = items[i];
        const img = await loadImg(dataUrl);
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * cellH;

        ctx.drawImage(img, x, y, cellW, cellH);

        if (label) {
          const stripH = 28;
          const stripY = y + cellH - stripH;
          ctx.fillStyle = 'rgba(22, 18, 15, 0.92)';
          ctx.fillRect(x, stripY, cellW, stripH);
          ctx.strokeStyle = '#3E3128';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, stripY + 0.5);
          ctx.lineTo(x + cellW, stripY + 0.5);
          ctx.stroke();

          ctx.fillStyle = '#C9B8A0';
          ctx.font = '15px "Special Elite", monospace';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + 14, stripY + stripH / 2 + 1);
        }

        ctx.strokeStyle = '#3E3128';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      }

      return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }, prepared);

    writeFileSync(outFile, Buffer.from(jpegB64, 'base64'));
    await page.close();
  } finally {
    if (ownBrowser) await browser.close();
  }
  return outFile;
}

// House order for Current frames
const HOUSE_TARGETS = [
  { id: 'shell', label: 'Shell', number: 0, order: ['title', 'map', 'settings', 'howto'] },
  { id: 'front-porch', label: 'Room 1 · Front Porch', number: 1 },
  { id: 'living-room', label: 'Room 2 · Living Room', number: 2 },
  { id: 'family-room', label: 'Room 3 · Family Room', number: 3 },
  { id: 'kitchen', label: 'Room 4 · Kitchen', number: 4 },
  { id: 'dining-room', label: 'Room 5 · Dining Room', number: 5 },
  { id: 'downstairs-bathroom', label: 'Room 6 · Downstairs Bathroom', number: 6 },
  { id: 'upstairs-hallway', label: 'Room 7 · Upstairs Hallway', number: 7 },
  { id: 'master-bedroom', label: 'Room 8 · Master Bedroom', number: 8 },
  { id: 'kids-bedroom', label: "Room 9 · Kid's Bedroom", number: 9 },
  { id: 'study', label: 'Room 10 · Study', number: 10 },
  { id: 'upstairs-bathroom', label: 'Room 11 · Upstairs Bathroom', number: 11 },
  { id: 'attic', label: 'Room 12 · Attic', number: 12 },
  { id: 'basement', label: 'Room 13 · Basement', number: 13 },
  { id: 'greenhouse', label: 'Room 14 · Greenhouse', number: 14 },
  { id: 'the-wall', label: 'Room 15 · The Wall', number: 15 },
];

const ROOM_STATE_ORDER = ['dirty', 'action', 'makeover', 'clean', 'results'];
const REFERENCE_STATE_ORDER = ['title', 'dirty', 'action', 'makeover', 'clean', 'results'];
const ARCHITECT_SHEET_ORDER = ['shell.jpg', 'porch.jpg', 'kitchen.jpg', 'makeovers.jpg', 'regression.jpg'];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  let out = escapeHtml(text);
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  // Links
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

// Tiny Markdown renderer supporting headings, bullet/numbered lists, tables, bold, code, paragraphs.
export function renderMarkdown(md) {
  if (!md) return '';
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inList = null; // 'ul' | 'ol'
  let inTable = false;
  let inCode = false;
  let codeLines = [];

  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };
  const closeTable = () => {
    if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed.startsWith('```')) {
      closeList();
      closeTable();
      if (!inCode) {
        inCode = true;
        codeLines = [];
      } else {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(raw);
      continue;
    }

    if (!trimmed) {
      closeList();
      closeTable();
      continue;
    }

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      // Separator line like |---|---|
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) {
        continue;
      }
      const nextLine = (lines[i + 1] || '').trim();
      const isHeader =
        !inTable &&
        nextLine.startsWith('|') &&
        nextLine.endsWith('|') &&
        nextLine
          .slice(1, -1)
          .split('|')
          .every((c) => /^:?-{2,}:?$/.test(c.trim()));

      if (!inTable) {
        html.push('<table>');
        if (isHeader) {
          html.push(`<thead><tr>${cells.map((c) => `<th>${renderInline(c)}</th>`).join('')}</tr></thead><tbody>`);
          inTable = true;
          i++; // skip separator line
          continue;
        } else {
          html.push('<tbody>');
          inTable = true;
        }
      }
      html.push(`<tr>${cells.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`);
      continue;
    }
    closeTable();

    // Headings
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      closeList();
      const level = Math.min(4, hMatch[1].length + 1); // shift # -> h2 inside card
      html.push(`<h${level}>${renderInline(hMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inList !== 'ul') {
        closeList();
        html.push('<ul>');
        inList = 'ul';
      }
      html.push(`<li>${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inList !== 'ol') {
        closeList();
        html.push('<ol>');
        inList = 'ol';
      }
      html.push(`<li>${renderInline(olMatch[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInline(trimmed)}</p>`);
  }

  closeList();
  closeTable();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  return html.join('\n');
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function collectPrompts() {
  const promptsDir = join(paths.reviewRoot, 'prompts');
  if (!existsSync(promptsDir)) return [];
  const entries = readdirSync(promptsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  return entries.map((id) => {
    const dir = join(promptsDir, id);
    const files = readdirSync(dir);
    const imgFiles = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

    let orderedImgs = [];
    if (imgFiles.includes('sheet.jpg')) {
      orderedImgs = ['sheet.jpg', ...imgFiles.filter((f) => f !== 'sheet.jpg').sort()];
    } else {
      const known = ARCHITECT_SHEET_ORDER.filter((f) => imgFiles.includes(f));
      const rest = imgFiles.filter((f) => !known.includes(f)).sort();
      orderedImgs = [...known, ...rest];
    }

    const summaryPath = join(dir, 'summary.md');
    const summaryMd = existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8') : '';
    const statTarget = existsSync(summaryPath)
      ? summaryPath
      : orderedImgs[0]
        ? join(dir, orderedImgs[0])
        : dir;
    const mtime = formatDate(statSync(statTarget).mtime);
    const dateMatch = summaryMd.match(/\b(202\d-\d{2}-\d{2})\b/);
    const date = dateMatch ? dateMatch[1] : mtime;

    return {
      id,
      date,
      sheets: orderedImgs.map((f) => ({
        name: f.replace(/\.[^.]+$/, ''),
        file: f,
        src: `prompts/${id}/${f}`,
      })),
      summaryHtml: renderMarkdown(summaryMd),
    };
  });
}

function collectCurrentRows() {
  const currentDir = join(paths.reviewRoot, 'current');
  if (!existsSync(currentDir)) return [];

  const existingDirs = new Set(
    readdirSync(currentDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  );

  const targets = [...HOUSE_TARGETS];
  for (const dirName of existingDirs) {
    if (!targets.some((t) => t.id === dirName)) {
      targets.push({ id: dirName, label: dirName, number: 99 });
    }
  }

  const rows = [];
  for (const target of targets) {
    if (!existingDirs.has(target.id)) continue;
    const dir = join(currentDir, target.id);
    const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (files.length === 0) continue;

    const baseOrder = target.order || ROOM_STATE_ORDER;
    const statesByStem = new Map(files.map((f) => [f.replace(/\.[^.]+$/, ''), f]));
    const orderedStems = [
      ...baseOrder.filter((s) => statesByStem.has(s)),
      ...[...statesByStem.keys()].filter((s) => !baseOrder.includes(s)).sort(),
    ];

    rows.push({
      id: target.id,
      label: target.label,
      frames: orderedStems.map((stem) => ({
        state: stem,
        src: `current/${target.id}/${statesByStem.get(stem)}`,
      })),
    });
  }
  return rows;
}

function collectReferenceRow() {
  const refDir = join(paths.spyderRoot, 'reference', 'screens');
  if (!existsSync(refDir)) return [];
  const files = readdirSync(refDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const byStem = new Map(files.map((f) => [f.replace(/\.[^.]+$/, ''), f]));
  const stems = [
    ...REFERENCE_STATE_ORDER.filter((s) => byStem.has(s)),
    ...[...byStem.keys()].filter((s) => !REFERENCE_STATE_ORDER.includes(s)).sort(),
  ];
  return stems.map((stem) => ({
    state: stem,
    src: `../reference/screens/${byStem.get(stem)}`,
  }));
}

export function buildGallery() {
  mkdirSync(paths.reviewRoot, { recursive: true });
  const generatedDate = formatDate(new Date());
  const prompts = collectPrompts();
  const currentRows = collectCurrentRows();
  const referenceFrames = collectReferenceRow();

  const galleryData = { generatedDate, prompts, currentRows, referenceFrames };

  const promptCardsHtml = prompts
    .map((p) => {
      const groupId = `prompt-${p.id}`;
      const primary = p.sheets[0];
      const extras = p.sheets.slice(1);
      const primaryHtml = primary
        ? `<div class="sheet-main">
            <button type="button" class="thumb-btn sheet-btn" data-group="${escapeHtml(groupId)}" data-index="0" data-src="${escapeHtml(primary.src)}" data-caption="${escapeHtml(`${p.id} · ${primary.name}`)}">
              <img src="${escapeHtml(primary.src)}" alt="${escapeHtml(`${p.id} ${primary.name}`)}" loading="lazy">
              <span class="thumb-caption">${escapeHtml(primary.file === 'sheet.jpg' ? `${p.id} / sheet.jpg — click to enlarge` : `${primary.file} — click to enlarge`)}</span>
            </button>
          </div>`
        : '';

      const extrasHtml = extras.length
        ? `<div class="sheet-extras">
            ${extras
              .map(
                (s, idx) => `<button type="button" class="thumb-btn sheet-extra-btn" data-group="${escapeHtml(groupId)}" data-index="${idx + 1}" data-src="${escapeHtml(s.src)}" data-caption="${escapeHtml(`${p.id} · ${s.name}`)}">
                <img src="${escapeHtml(s.src)}" alt="${escapeHtml(`${p.id} ${s.name}`)}" loading="lazy">
                <span class="thumb-caption">${escapeHtml(s.file)}</span>
              </button>`
              )
              .join('\n')}
          </div>`
        : '';

      return `<article class="prompt-card" id="${escapeHtml(groupId)}">
        <header class="prompt-header">
          <h3 class="prompt-title">${escapeHtml(p.id)}</h3>
          <span class="prompt-date">${escapeHtml(p.date)}</span>
        </header>
        <div class="prompt-body">
          <div class="prompt-Visuals">
            ${primaryHtml}
            ${extrasHtml}
          </div>
          <div class="prompt-summary">
            ${p.summaryHtml}
          </div>
        </div>
      </article>`;
    })
    .join('\n');

  const currentRowsHtml = currentRows
    .map((row) => {
      const groupId = `current-${row.id}`;
      const thumbs = row.frames
        .map(
          (f, idx) => `<button type="button" class="thumb-btn frame-thumb" data-group="${escapeHtml(groupId)}" data-index="${idx}" data-src="${escapeHtml(f.src)}" data-caption="${escapeHtml(`${row.label} — ${f.state}`)}">
            <img src="${escapeHtml(f.src)}" alt="${escapeHtml(`${row.label} ${f.state}`)}" loading="lazy">
            <span class="thumb-caption">${escapeHtml(f.state)}</span>
          </button>`
        )
        .join('\n');
      return `<div class="target-row" id="${escapeHtml(groupId)}">
        <div class="row-header">
          <h3 class="row-title">${escapeHtml(row.label)}</h3>
          <span class="row-meta">${escapeHtml(row.id)} · ${row.frames.length} frames</span>
        </div>
        <div class="thumb-strip">
          ${thumbs}
        </div>
      </div>`;
    })
    .join('\n');

  const refGroupId = 'reference-quality-bar';
  const referenceHtml = referenceFrames
    .map(
      (f, idx) => `<button type="button" class="thumb-btn frame-thumb" data-group="${refGroupId}" data-index="${idx}" data-src="${escapeHtml(f.src)}" data-caption="${escapeHtml(`Reference (Quality bar) — ${f.state}`)}">
        <img src="${escapeHtml(f.src)}" alt="${escapeHtml(`Reference ${f.state}`)}" loading="lazy">
        <span class="thumb-caption">${escapeHtml(f.state)}</span>
      </button>`
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spyder — review</title>
  <style>
    @font-face {
      font-family: 'Fraunces';
      font-style: normal;
      font-weight: 400 700;
      src: url("../game/fonts/fraunces-latin-full-normal.woff2") format("woff2");
    }
    @font-face {
      font-family: 'Fraunces';
      font-style: italic;
      font-weight: 400 700;
      src: url("../game/fonts/fraunces-latin-full-italic.woff2") format("woff2");
    }
    @font-face {
      font-family: 'Special Elite';
      font-style: normal;
      font-weight: 400;
      src: url("../game/fonts/special-elite-latin-400-normal.woff2") format("woff2");
    }

    :root {
      --soot: #16120F;
      --umber: #211B17;
      --walnut: #3E3128;
      --oak: #6B5240;
      --linen: #C9B8A0;
      --bone: #E8DCC6;
      --amber: #F2A54A;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 40px 48px 80px;
      background: var(--soot);
      color: var(--bone);
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.55;
    }

    .container {
      max-width: 1720px;
      margin: 0 auto;
    }

    .page-header {
      border-bottom: 1px solid var(--walnut);
      padding-bottom: 22px;
      margin-bottom: 38px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
    }

    .page-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 2.3rem;
      font-weight: 600;
      margin: 0;
      color: var(--bone);
      letter-spacing: 0.01em;
    }

    .page-meta {
      font-family: 'Special Elite', monospace;
      font-size: 0.92rem;
      color: var(--linen);
    }

    .legend {
      width: 100%;
      margin: 10px 0 0;
      color: var(--linen);
      font-size: 0.98rem;
      max-width: 1120px;
    }

    .legend kbd {
      font-family: 'Special Elite', monospace;
      font-size: 0.84rem;
      padding: 2px 6px;
      border: 1px solid var(--walnut);
      background: var(--umber);
      color: var(--bone);
    }

    section {
      margin-bottom: 54px;
    }

    .section-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 1px solid var(--walnut);
      padding-bottom: 10px;
      margin-bottom: 26px;
    }

    .section-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.55rem;
      font-weight: 600;
      margin: 0;
      color: var(--bone);
    }

    .section-sub {
      font-family: 'Special Elite', monospace;
      font-size: 0.86rem;
      color: var(--linen);
    }

    /* Prompt cards */
    .prompts-list {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .prompt-card {
      background: var(--umber);
      border: 1px solid var(--walnut);
      padding: 24px 28px;
    }

    .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid var(--walnut);
      padding-bottom: 12px;
      margin-bottom: 20px;
    }

    .prompt-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.35rem;
      margin: 0;
      color: var(--bone);
    }

    .prompt-date {
      font-family: 'Special Elite', monospace;
      font-size: 0.88rem;
      color: var(--linen);
    }

    .prompt-body {
      display: grid;
      grid-template-columns: minmax(480px, 1.15fr) minmax(360px, 1fr);
      gap: 28px;
      align-items: start;
    }

    @media (max-width: 1180px) {
      .prompt-body {
        grid-template-columns: 1fr;
      }
    }

    .sheet-extras {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 12px;
    }

    .thumb-btn {
      appearance: none;
      background: var(--soot);
      border: 1px solid var(--walnut);
      padding: 0;
      margin: 0;
      color: var(--linen);
      cursor: pointer;
      text-align: left;
      display: flex;
      flex-direction: column;
      width: 100%;
      transition: border-color 0.15s ease;
    }

    .thumb-btn:hover,
    .thumb-btn:focus-visible {
      border-color: var(--amber);
      outline: none;
    }

    .thumb-btn img {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      background: #0E0B09;
    }

    .sheet-btn img {
      aspect-ratio: auto;
      object-fit: contain;
    }

    .thumb-caption {
      font-family: 'Special Elite', monospace;
      font-size: 0.82rem;
      color: var(--linen);
      padding: 6px 10px;
      border-top: 1px solid var(--walnut);
      background: var(--soot);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .prompt-summary {
      font-size: 0.96rem;
      color: var(--bone);
    }

    .prompt-summary h2,
    .prompt-summary h3,
    .prompt-summary h4 {
      font-family: 'Fraunces', Georgia, serif;
      color: var(--bone);
      margin: 16px 0 8px;
      font-size: 1.08rem;
    }

    .prompt-summary h2:first-child,
    .prompt-summary h3:first-child {
      margin-top: 0;
    }

    .prompt-summary p {
      margin: 0 0 10px;
    }

    .prompt-summary ul,
    .prompt-summary ol {
      margin: 0 0 12px;
      padding-left: 22px;
    }

    .prompt-summary li {
      margin-bottom: 5px;
    }

    .prompt-summary code {
      font-family: 'Special Elite', monospace;
      font-size: 0.88em;
      background: var(--soot);
      border: 1px solid var(--walnut);
      padding: 1px 5px;
      color: var(--linen);
    }

    .prompt-summary pre {
      background: var(--soot);
      border: 1px solid var(--walnut);
      padding: 10px 12px;
      overflow-x: auto;
    }

    .prompt-summary pre code {
      border: none;
      padding: 0;
    }

    .prompt-summary table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 14px;
      font-size: 0.9rem;
    }

    .prompt-summary th,
    .prompt-summary td {
      border: 1px solid var(--walnut);
      padding: 6px 10px;
      text-align: left;
    }

    .prompt-summary th {
      background: var(--soot);
      color: var(--linen);
      font-family: 'Special Elite', monospace;
      font-weight: normal;
    }

    /* Current & Reference rows */
    .target-row {
      margin-bottom: 30px;
      padding-bottom: 24px;
      border-bottom: 1px solid rgba(62, 49, 40, 0.55);
    }

    .target-row:last-child {
      border-bottom: none;
    }

    .row-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 12px;
      gap: 12px;
    }

    .row-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.18rem;
      font-weight: 600;
      margin: 0;
      color: var(--bone);
    }

    .row-meta {
      font-family: 'Special Elite', monospace;
      font-size: 0.82rem;
      color: var(--linen);
    }

    .thumb-strip {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 14px;
    }

    /* Lightbox */
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(14, 11, 9, 0.94);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px;
      z-index: 1000;
    }

    .lightbox[hidden] {
      display: none;
    }

    .lightbox-bar {
      width: min(1680px, 95vw);
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      color: var(--linen);
      font-family: 'Special Elite', monospace;
      font-size: 0.95rem;
    }

    .lightbox-controls {
      display: flex;
      gap: 10px;
    }

    .lightbox-btn {
      font-family: 'Special Elite', monospace;
      font-size: 0.85rem;
      background: var(--umber);
      color: var(--bone);
      border: 1px solid var(--walnut);
      padding: 5px 12px;
      cursor: pointer;
    }

    .lightbox-btn:hover {
      border-color: var(--amber);
    }

    .lightbox-stage {
      max-width: 95vw;
      max-height: 85vh;
      border: 1px solid var(--walnut);
      background: #0E0B09;
      overflow: auto;
    }

    .lightbox-stage img {
      display: block;
      max-width: 95vw;
      max-height: 84vh;
      width: auto;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="page-header">
      <h1 class="page-title">Spyder — review</h1>
      <div class="page-meta">Generated ${escapeHtml(generatedDate)} · review/index.html</div>
      <p class="legend">
        One place for every review image: <strong>Prompts</strong> (newest first, with each prompt's contact sheet and summary),
        <strong>Current frames</strong> (latest 1920 × 1080 hero frames for the shell and every built room in house order),
        and <strong>Reference</strong> (the six frozen Living Room frames). Click any image to enlarge; use <kbd>←</kbd> <kbd>→</kbd> to move along the row, and <kbd>Esc</kbd> to close.
      </p>
    </header>

    <section id="prompts-section">
      <div class="section-header">
        <h2 class="section-title">Prompts</h2>
        <span class="section-sub">Newest first · review/prompts/&lt;id&gt;/</span>
      </div>
      <div class="prompts-list">
        ${promptCardsHtml}
      </div>
    </section>

    <section id="current-section">
      <div class="section-header">
        <h2 class="section-title">Current frames</h2>
        <span class="section-sub">House order · review/current/&lt;target&gt;/&lt;state&gt;.jpg</span>
      </div>
      ${currentRowsHtml}
    </section>

    <section id="reference-section">
      <div class="section-header">
        <h2 class="section-title">Reference</h2>
        <span class="section-sub">Quality bar · ../reference/screens/</span>
      </div>
      <div class="target-row" id="${refGroupId}">
        <div class="row-header">
          <h3 class="row-title">Quality bar</h3>
          <span class="row-meta">reference/screens · ${referenceFrames.length} frames</span>
        </div>
        <div class="thumb-strip">
          ${referenceHtml}
        </div>
      </div>
    </section>
  </div>

  <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Image viewer">
    <div class="lightbox-bar">
      <span id="lightbox-caption"></span>
      <div class="lightbox-controls">
        <button type="button" class="lightbox-btn" id="lightbox-prev" title="Previous in row (Left arrow)">← Prev</button>
        <button type="button" class="lightbox-btn" id="lightbox-next" title="Next in row (Right arrow)">Next →</button>
        <button type="button" class="lightbox-btn" id="lightbox-close" title="Close (Esc)">Close (Esc)</button>
      </div>
    </div>
    <div class="lightbox-stage">
      <img id="lightbox-img" src="" alt="">
    </div>
  </div>

  <script>
    window.__REVIEW_DATA__ = ${JSON.stringify(galleryData)};
    (function () {
      const lightbox = document.getElementById('lightbox');
      const imgEl = document.getElementById('lightbox-img');
      const capEl = document.getElementById('lightbox-caption');
      const prevBtn = document.getElementById('lightbox-prev');
      const nextBtn = document.getElementById('lightbox-next');
      const closeBtn = document.getElementById('lightbox-close');

      let activeGroup = [];
      let activeIndex = 0;

      function showAt(index) {
        if (!activeGroup.length) return;
        activeIndex = (index + activeGroup.length) % activeGroup.length;
        const btn = activeGroup[activeIndex];
        const src = btn.getAttribute('data-src');
        const cap = btn.getAttribute('data-caption') || '';
        imgEl.src = src;
        imgEl.alt = cap;
        capEl.textContent = activeGroup.length > 1
          ? cap + '  (' + (activeIndex + 1) + ' / ' + activeGroup.length + ')'
          : cap;
      }

      function openFromButton(btn) {
        const groupName = btn.getAttribute('data-group');
        activeGroup = Array.from(document.querySelectorAll('.thumb-btn[data-group="' + groupName + '"]'));
        const idx = activeGroup.indexOf(btn);
        lightbox.hidden = false;
        showAt(idx >= 0 ? idx : 0);
      }

      function closeLightbox() {
        lightbox.hidden = true;
        imgEl.removeAttribute('src');
        activeGroup = [];
      }

      document.addEventListener('click', (e) => {
        const btn = e.target.closest('.thumb-btn');
        if (btn) {
          openFromButton(btn);
          return;
        }
        if (e.target === lightbox) {
          closeLightbox();
        }
      });

      prevBtn.addEventListener('click', () => showAt(activeIndex - 1));
      nextBtn.addEventListener('click', () => showAt(activeIndex + 1));
      closeBtn.addEventListener('click', closeLightbox);

      document.addEventListener('keydown', (e) => {
        if (lightbox.hidden) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeLightbox();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          showAt(activeIndex - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          showAt(activeIndex + 1);
        }
      });
    })();
  </script>
</body>
</html>
`;

  const indexFile = join(paths.reviewRoot, 'index.html');
  writeFileSync(indexFile, html, 'utf8');
  return indexFile;
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const ALLOWED_PREFIXES = [
  'review/',
  '.scratch/',
  'reference/screens/',
  'reference/fonts/',
  'original/',
  'spec/',
  'src/',
  '_archive/',
];

export function audit() {
  const stray = [];
  function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = join(dir, entry.name);
      const rel = relative(paths.spyderRoot, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (ALLOWED_PREFIXES.includes(`${rel}/`)) continue;
        walk(full);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (!IMAGE_EXTS.has(ext)) continue;
        if (ALLOWED_PREFIXES.some((p) => rel.startsWith(p))) continue;
        stray.push(rel);
      }
    }
  }
  walk(paths.spyderRoot);
  return stray.sort();
}

// CLI entry point
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const cmd = process.argv[2];
  if (cmd === 'gallery') {
    const out = buildGallery();
    console.log('built', out);
  } else if (cmd === 'audit') {
    const bad = audit();
    if (bad.length > 0) {
      for (const p of bad) console.log(p);
      process.exitCode = 1;
    }
  } else {
    console.error('Usage: node review.mjs <gallery|audit>');
    process.exitCode = 1;
  }
}
