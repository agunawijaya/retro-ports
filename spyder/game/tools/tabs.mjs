// Screenshots of every settings tab (the hero frame shows only the first).
//
//   node tabs.mjs [out-folder]

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gameUrl, launch, openQa, watchErrors } from './common.mjs';
import { scratchDir } from './review.mjs';

const outDir = resolve(process.argv[2] ?? scratchDir('tabs'));
mkdirSync(outDir, { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = watchErrors(page, 'tabs');
await openQa(page, gameUrl());
await page.evaluate(() => window.__spyder.setup('settings'));
for (const tab of ['character', 'difficulty', 'sound', 'visual']) {
  await page.click(`#tab-${tab}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, `settings-${tab}.jpg`), type: 'jpeg', quality: 90 });
  console.log('saved', tab);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
