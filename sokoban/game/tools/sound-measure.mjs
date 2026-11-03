/**
 * @file Sound measuring tool (prompt 05 §5).
 * Measures the perceived loudness (RMS of a one-octave run) of the five
 * lighting instruments in their theme tunings, and proposes balance gains so
 * all five match perceived loudness without clipping.
 *
 * Usage:
 *   node tools/sound-measure.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, resolveTarget, waitForHening, withParams } from './lib/harness.mjs';
import { scratchDir } from './review.mjs';

async function main() {
  const target = await resolveTarget();
  const browser = await launchBrowser();
  const page = await browser.newPage();

  await page.goto(withParams(target.url, { qa: 1 }), { waitUntil: 'load', timeout: 30000 });
  await waitForHening(page, 10000);

  const results = await page.evaluate(async () => {
    // Import theme instrument definitions
    const { lentera } = await import('/src/themes/lentera.js');
    const { batu } = await import('/src/themes/batu.js');
    const { bintang } = await import('/src/themes/bintang.js');
    const { candi } = await import('/src/themes/candi.js');
    const { mataAir } = await import('/src/themes/mata-air.js');
    const { PENTATONIC, SLENDRO } = await import('/src/themes/scales.js');

    const instruments = [
      { id: 'lentera', name: 'Lentera (wind chime)', inst: lentera.instrument, scale: PENTATONIC.slice(0, 5) },
      { id: 'batu', name: 'Taman Batu (koto)', inst: batu.instrument, scale: PENTATONIC.slice(0, 5) },
      { id: 'bintang', name: 'Cahaya Bintang (marimba)', inst: bintang.instrument, scale: PENTATONIC.slice(0, 5) },
      { id: 'candi', name: 'Candi (bonang)', inst: candi.instrument, scale: SLENDRO.slice(0, 5) },
      { id: 'mata-air', name: 'Mata Air (handpan)', inst: mataAir.instrument, scale: PENTATONIC.slice(0, 5) },
    ];

    const sampleRate = 44100;
    const duration = 4.0; // 4 seconds
    const step = 0.45; // 450 ms between notes in octave run
    const defaultLevel = 0.16;

    const data = [];

    for (const item of instruments) {
      const actx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
      const dry = actx.createGain();
      dry.gain.value = 1.0;
      dry.connect(actx.destination);

      const fakeSound = { ctx: actx, dry };

      // Play 5 notes of the octave run
      for (let i = 0; i < item.scale.length; i++) {
        item.inst.play(fakeSound, item.scale[i], i * step, defaultLevel);
      }

      const buffer = await actx.startRendering();
      const channel = buffer.getChannelData(0);

      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < channel.length; i++) {
        const v = channel[i];
        sumSq += v * v;
        const abs = Math.abs(v);
        if (abs > peak) peak = abs;
      }
      const rms = Math.sqrt(sumSq / channel.length);
      data.push({ id: item.id, name: item.name, rms, peak });
    }

    // Target RMS: match to baseline (lentera)
    const baselineRms = data[0].rms;
    for (const d of data) {
      d.relRms = d.rms / baselineRms;
      d.proposedGain = Number((baselineRms / d.rms).toFixed(3));
      d.rms = Number(d.rms.toFixed(5));
      d.peak = Number(d.peak.toFixed(4));
    }

    return data;
  });

  await page.close();
  await browser.close();
  await target.close();

  // Print results
  const lines = [];
  lines.push('# Sound balance measurement (one-octave run)');
  lines.push('');
  lines.push('| Instrument | RMS | Peak | Relative RMS | Proposed Gain |');
  lines.push('|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| ${r.name} | ${r.rms} | ${r.peak} | ${r.relRms.toFixed(2)}× | ${r.proposedGain} |`);
  }
  lines.push('');
  lines.push('Baseline: Lentera (wind chime). Proposed gain = baselineRMS / instrumentRMS.');

  const report = lines.join('\n');
  const outDir = scratchDir('sound-measure');
  const outPath = path.join(outDir, 'report.md');
  fs.writeFileSync(outPath, report, 'utf8');

  console.log(report);
  console.log(`\nWritten to ${outPath}`);
}

main().catch(console.error);
