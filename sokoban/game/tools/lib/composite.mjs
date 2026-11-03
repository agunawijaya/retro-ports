/**
 * @file Side-by-side composite images for regress.mjs, built the same way
 * `review.mjs`'s `makeSheet` builds its sheets: a headless page drawing to a
 * `<canvas>`, no image-manipulation npm packages.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Composes a labelled reference|game pair into one JPEG.
 * @param {import('playwright-core').Browser} browser a running browser to open a scratch page in
 * @param {string} leftPath screenshot file (reference side)
 * @param {string} rightPath screenshot file (game side)
 * @param {string} label caption, e.g. 'room06-fajar'
 * @param {string} outPath where to write the composite JPEG
 */
export async function composeSideBySide(browser, leftPath, rightPath, label, outPath) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 560 } });

  const toDataUri = (file) => {
    if (!file || !fs.existsSync(file)) return null;
    const ext = path.extname(file).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  };

  const leftUri = toDataUri(leftPath);
  const rightUri = toDataUri(rightPath);

  const resultDataUri = await page.evaluate(
    async ({ leftUri, rightUri, label }) => {
      const cellW = 960;
      const cellH = 540;
      const canvas = document.createElement('canvas');
      canvas.width = cellW * 2;
      canvas.height = cellH + 20;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#2b2833';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      function loadInto(uri, x, caption) {
        return new Promise((resolve) => {
          if (!uri) {
            ctx.fillStyle = '#3a3644';
            ctx.fillRect(x, 20, cellW, cellH);
            ctx.fillStyle = '#efe8f2';
            ctx.font = '400 16px sans-serif';
            ctx.fillText(`[${caption}: missing]`, x + 24, 20 + cellH / 2);
            resolve();
            return;
          }
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, x, 20, cellW, cellH);
            resolve();
          };
          img.onerror = () => {
            ctx.fillStyle = '#3a3644';
            ctx.fillRect(x, 20, cellW, cellH);
            resolve();
          };
          img.src = uri;
        });
      }

      await loadInto(leftUri, 0, 'ref');
      await loadInto(rightUri, cellW, 'game');

      ctx.fillStyle = '#efe8f2';
      ctx.font = '400 14px sans-serif';
      ctx.fillText(`ref · ${label}`, 16, 14);
      ctx.fillText(`game · ${label}`, cellW + 16, 14);

      return canvas.toDataURL('image/jpeg', 0.8);
    },
    { leftUri, rightUri, label }
  );

  await page.close();

  const base64Data = resultDataUri.replace(/^data:image\/jpeg;base64,/, '');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
  return outPath;
}
