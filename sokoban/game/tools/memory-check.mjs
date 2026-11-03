/**
 * @file Memory check (prompt 05 §4 / ARCHITECTURE §14).
 * Tests:
 * 1. 20 room changes: geometry, texture and program counts return to baseline;
 *    JS heap does not grow by more than 10 % after a GC.
 * 2. 5 floor/courtyard round trips: geometry, texture and program counts return to baseline;
 *    JS heap does not grow by more than 10 % after a GC.
 *
 * Usage:
 *   node tools/memory-check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { resolveTarget, waitForHening, withParams } from './lib/harness.mjs';
import { scratchDir } from './review.mjs';

async function launchBrowserWithGc() {
  return chromium.launch({
    channel: 'msedge',
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--js-flags=--expose-gc',
    ],
  });
}

async function main() {
  const target = await resolveTarget();
  const browser = await launchBrowserWithGc();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log(`memory: target = ${target.url}`);

  await page.goto(withParams(target.url, { qa: 1, room: 1 }), { waitUntil: 'load', timeout: 30000 });
  await waitForHening(page, 10000);
  await page.waitForFunction(() => window.hening?.current?.()?.base === 'room', null, { timeout: 15000 });
  await page.waitForTimeout(500);

  // Helper to force GC and get stats
  async function getStats() {
    return await page.evaluate(() => {
      if (window.gc) {
        window.gc();
        window.gc();
      }
      const mem = window.hening.memoryInfo ? window.hening.memoryInfo() : null;
      const heap = window.performance?.memory?.usedJSHeapSize ?? 0;
      return { ...mem, jsHeap: heap };
    });
  }

  const reports = [];

  // ==========================================
  // Part 1: 20 Room Changes
  // ==========================================
  console.log('\n--- Test 1: 20 Room Changes ---');
  // Settle at room 1
  await page.evaluate(() => window.hening.screen('room', { room: 1 }));
  await page.waitForTimeout(500);
  const baselineRoom = await getStats();
  console.log('Room baseline:', baselineRoom);

  // Cycle through 20 room changes: 2..21 then back to 1
  for (let r = 2; r <= 21; r++) {
    const roomNum = ((r - 1) % 50) + 1;
    await page.evaluate((n) => window.hening.screen('room', { room: n }), roomNum);
    await page.waitForTimeout(100);
  }
  // Return to room 1
  await page.evaluate(() => window.hening.screen('room', { room: 1 }));
  await page.waitForTimeout(500);

  const finalRoom = await getStats();
  console.log('Room final after 20 changes:', finalRoom);

  const geoRoomMatch = finalRoom.geometries === baselineRoom.geometries;
  const texRoomMatch = finalRoom.textures === baselineRoom.textures;
  const progRoomMatch = finalRoom.programs === baselineRoom.programs;
  const heapGrowthRoom = baselineRoom.jsHeap > 0 ? (finalRoom.jsHeap - baselineRoom.jsHeap) / baselineRoom.jsHeap : 0;
  const heapRoomPass = heapGrowthRoom <= 0.10;

  reports.push({
    name: '20 room changes (return to room 1)',
    baseline: baselineRoom,
    final: finalRoom,
    geoMatch: geoRoomMatch,
    texMatch: texRoomMatch,
    progMatch: progRoomMatch,
    heapGrowthPct: (heapGrowthRoom * 100).toFixed(1) + '%',
    pass: geoRoomMatch && texRoomMatch && progRoomMatch && heapRoomPass,
  });

  // ==========================================
  // Part 2: 5 Floor / Courtyard Round Trips
  // ==========================================
  console.log('\n--- Test 2: 5 Floor / Courtyard Round Trips ---');
  await page.evaluate(() => window.hening.screen('courtyard'));
  await page.waitForFunction(() => window.hening?.current?.()?.base === 'courtyard', null, { timeout: 15000 });
  await page.waitForTimeout(500);

  // Warm up floor/courtyard once so static floor assets/shaders are initialized
  await page.evaluate(() => window.hening.screen('floor', { floor: 1 }));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.hening.screen('courtyard'));
  await page.waitForTimeout(500);

  const baselineCourtyard = await getStats();
  console.log('Courtyard baseline:', baselineCourtyard);

  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.hening.screen('floor', { floor: 1 }));
    await page.waitForTimeout(150);
    await page.evaluate(() => window.hening.screen('courtyard'));
    await page.waitForTimeout(150);
  }

  await page.waitForTimeout(500);
  const finalCourtyard = await getStats();
  console.log('Courtyard final after 5 round trips:', finalCourtyard);

  const geoCourtMatch = finalCourtyard.geometries === baselineCourtyard.geometries;
  const texCourtMatch = finalCourtyard.textures === baselineCourtyard.textures;
  const progCourtMatch = finalCourtyard.programs === baselineCourtyard.programs;
  const heapGrowthCourt = baselineCourtyard.jsHeap > 0 ? (finalCourtyard.jsHeap - baselineCourtyard.jsHeap) / baselineCourtyard.jsHeap : 0;
  const heapCourtPass = heapGrowthCourt <= 0.10;

  reports.push({
    name: '5 floor/courtyard round trips (return to courtyard)',
    baseline: baselineCourtyard,
    final: finalCourtyard,
    geoMatch: geoCourtMatch,
    texMatch: texCourtMatch,
    progMatch: progCourtMatch,
    heapGrowthPct: (heapGrowthCourt * 100).toFixed(1) + '%',
    pass: geoCourtMatch && texCourtMatch && progCourtMatch && heapCourtPass,
  });

  await page.close();
  await browser.close();
  await target.close();

  // Print Report Table
  const lines = [];
  lines.push('# Memory Leak Check Report');
  lines.push('');
  lines.push('| Test | Baseline (geo/tex/prog) | Final (geo/tex/prog) | Heap Growth | Result |');
  lines.push('|---|---|---|---|---|');
  for (const rep of reports) {
    const bStr = `${rep.baseline.geometries} / ${rep.baseline.textures} / ${rep.baseline.programs}`;
    const fStr = `${rep.final.geometries} / ${rep.final.textures} / ${rep.final.programs}`;
    lines.push(`| ${rep.name} | ${bStr} | ${fStr} | ${rep.heapGrowthPct} | ${rep.pass ? 'PASS' : 'FAIL'} |`);
  }

  const outStr = lines.join('\n');
  const outDir = scratchDir('memory');
  const outPath = path.join(outDir, 'report.md');
  fs.writeFileSync(outPath, outStr, 'utf8');

  console.log('\n' + outStr);
  console.log(`\nWritten to ${outPath}`);

  if (reports.some((r) => !r.pass)) process.exitCode = 1;
}

main().catch(console.error);
