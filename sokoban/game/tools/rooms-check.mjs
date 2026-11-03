/**
 * @file All-rooms check (prompt 01 §3). Loads each of the 50 rooms with
 * `?qa=1&room=N&seed=N`, at desktop (1440x900) and phone (390x844) sizes, and
 * records what `ARCHITECTURE.md` §10's `window.hening.inspect()` reports:
 * gate/stones, arrival without teleport, stranger seat, water counts, koi,
 * framing fit at both sizes, console errors and frame time. Then finishes the
 * room with `arrange()` and confirms it reaches `departing` then `results`.
 *
 * Usage:
 *   node tools/rooms-check.mjs [--rooms 1,6,50] [--url <override>]
 *
 * `--url` points the tool at an already-served page (e.g. a built
 * `dist/hening.html` opened as `file://...`) instead of starting a Vite dev
 * server for `game/`. Rooms with no gate or no stranger seat are listed, not
 * failed - the reference falls back cleanly for those. The tool exits
 * non-zero only when something is wrong (a console error, or `window.hening`
 * never appearing at all); a QA call that the game has not implemented yet is
 * reported as "missing", not treated as a failure, so this tool can run
 * truthfully before prompt 01's room screen exists.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  resolveTarget,
  launchBrowser,
  collectConsoleErrors,
  heningPresent,
  waitForHening,
  tryHening,
  withParams,
  parseRoomList,
  parseFlags,
} from './lib/harness.mjs';
import { scratchDir } from './review.mjs';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const ARRANGE_TIMEOUT_MS = 20000; // generous: departing + results after arrange() on a 50-room worst case
const FRAME_SAMPLE_MS = 500;

/**
 * Loads one room at one viewport and reads `inspect()` / `frameStats()`.
 * @returns {Promise<object>} per-viewport findings
 */
async function checkRoomAtViewport(browser, baseUrl, room, seed, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = collectConsoleErrors(page);
  const url = withParams(baseUrl, { qa: 1, room, seed });

  let navError = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page); // dev/qa.js is a dynamic import; wait for it rather than guessing a settle time
  } catch (err) {
    navError = String(err && err.message ? err.message : err);
  }

  const present = navError ? false : await heningPresent(page);
  let inspect = { ok: false, value: undefined, reason: 'window.hening not present' };
  let frameStats = { ok: false, value: undefined, reason: 'window.hening not present' };

  if (present) {
    inspect = await tryHening(page, 'return window.hening.inspect ? window.hening.inspect() : Promise.reject(new Error("inspect() not implemented"));');
    frameStats = await tryHening(page, `return window.hening.frameStats ? await window.hening.frameStats(${FRAME_SAMPLE_MS}) : Promise.reject(new Error("frameStats() not implemented"));`);
  }

  await page.close();
  return { navError, present, inspect, frameStats, errors };
}

/**
 * Runs `arrange()` on a fresh desktop page for the room and confirms the
 * phase reaches `departing` then `results`.
 */
async function checkDeparture(browser, baseUrl, room, seed) {
  const page = await browser.newPage({ viewport: DESKTOP });
  const errors = collectConsoleErrors(page);
  const url = withParams(baseUrl, { qa: 1, room, seed });

  let result = { ok: false, reason: 'window.hening not present' };
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await waitForHening(page);
    const present = await heningPresent(page);
    if (present) {
      const arranged = await tryHening(page, 'if (!window.hening.arrange) throw new Error("arrange() not implemented"); window.hening.arrange(); return true;');
      if (!arranged.ok) {
        result = { ok: false, reason: arranged.reason };
      } else {
        try {
          await page.waitForFunction(
            () => window.hening && window.hening.inspect && window.hening.inspect().phase === 'departing',
            null,
            { timeout: ARRANGE_TIMEOUT_MS }
          );
          await page.waitForFunction(
            () => window.hening && window.hening.inspect && window.hening.inspect().phase === 'results',
            null,
            { timeout: ARRANGE_TIMEOUT_MS }
          );
          result = { ok: true, reason: null };
        } catch (err) {
          result = { ok: false, reason: `did not reach departing/results within ${ARRANGE_TIMEOUT_MS}ms: ${err.message}` };
        }
      }
    }
  } catch (err) {
    result = { ok: false, reason: String(err && err.message ? err.message : err) };
  }

  await page.close();
  return { result, errors };
}

function fmtBool(v) {
  if (v === true) return 'ya';
  if (v === false) return 'tidak';
  return '?';
}

function fmtWater(water) {
  if (!water) return '?';
  return `${water.ponds ?? '?'}/${water.basins ?? '?'}/${water.fountains ?? '?'}`;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const roomNumbers = flags.rooms ? parseRoomList(flags.rooms) : Array.from({ length: 50 }, (_, i) => i + 1);

  const target = await resolveTarget(typeof flags.url === 'string' ? flags.url : undefined);
  const browser = await launchBrowser();

  console.log(`rooms-check: target = ${target.url}`);
  console.log(`rooms-check: rooms = ${roomNumbers.join(',')}`);
  console.log(`rooms-check: departure timeout = ${ARRANGE_TIMEOUT_MS}ms (generous: worst-case room 50 after arrange())`);

  const rows = [];
  let anyConsoleError = false;
  let anyNavError = false;

  for (const room of roomNumbers) {
    const seed = room;
    const desktop = await checkRoomAtViewport(browser, target.url, room, seed, DESKTOP);
    const phone = await checkRoomAtViewport(browser, target.url, room, seed, PHONE);
    const departure = await checkDeparture(browser, target.url, room, seed);

    if (desktop.navError || phone.navError) anyNavError = true;
    const consoleErrors = [...desktop.errors, ...phone.errors, ...departure.errors];
    if (consoleErrors.length > 0) anyConsoleError = true;

    const insp = desktop.inspect.ok ? desktop.inspect.value : null;
    const gateFound = insp ? insp.gate?.found : undefined;
    const stones = insp ? insp.gate?.stones : undefined;
    const arrivalOk = insp ? insp.arrival?.reachedStart && !insp.arrival?.teleported : undefined;
    const seatOk = insp ? insp.stranger?.seated && insp.stranger?.onScreen : undefined;
    const water = insp ? insp.water : null;
    const koi = insp ? insp.water?.koi : undefined;
    const fitsDesktop = insp ? insp.framing?.fits : undefined;
    const fitsPhone = phone.inspect.ok ? phone.inspect.value?.framing?.fits : undefined;
    const ms = desktop.frameStats.ok ? desktop.frameStats.value?.avgMs : undefined;

    rows.push({
      room,
      gateFound,
      stones,
      arrivalOk,
      seatOk,
      water,
      koi,
      fitsDesktop,
      fitsPhone,
      ms,
      consoleErrorCount: consoleErrors.length,
      departs: departure.result.ok,
      departReason: departure.result.reason,
      inspectMissing: !desktop.inspect.ok,
      frameStatsMissing: !desktop.frameStats.ok,
      heningMissing: !desktop.present || !phone.present,
    });
  }

  await browser.close();
  await target.close();

  // --- Build the Markdown report ---
  const lines = [];
  lines.push('# rooms-check report');
  lines.push('');
  lines.push(`Target: \`${target.url}\``);
  lines.push('');
  lines.push('| Room | Stones | Arrival OK | Seat | Ponds/Basins/Fountains | Koi | Fits desktop | Fits phone | ms/frame | Departs+Results | Console errors |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(
      `| ${r.room} | ${r.stones ?? '?'} | ${fmtBool(r.arrivalOk)} | ${fmtBool(r.seatOk)} | ${fmtWater(r.water)} | ${r.koi ?? '?'} | ${fmtBool(r.fitsDesktop)} | ${fmtBool(r.fitsPhone)} | ${r.ms !== undefined ? r.ms.toFixed(2) : '?'} | ${fmtBool(r.departs)}${r.departReason ? ` (${r.departReason})` : ''} | ${r.consoleErrorCount} |`
    );
  }
  lines.push('');

  const noGate = rows.filter((r) => r.gateFound === false).map((r) => r.room);
  const noSeat = rows.filter((r) => r.seatOk === false).map((r) => r.room);
  lines.push(`Rooms with no gate found (listed, not failed): ${noGate.length ? noGate.join(', ') : 'none'}`);
  lines.push(`Rooms with no stranger seat found (listed, not failed): ${noSeat.length ? noSeat.join(', ') : 'none'}`);
  lines.push('');

  const missingApi = rows.filter((r) => r.heningMissing || r.inspectMissing || r.frameStatsMissing).length;
  lines.push(`Rooms where window.hening / inspect() / frameStats() were missing: ${missingApi} of ${rows.length}.`);
  if (missingApi > 0) {
    lines.push('This is expected before the room screen (prompt 01) is built; see the report\'s per-room reasons above.');
  }

  const report = lines.join('\n');
  const outDir = scratchDir('rooms-check');
  const outPath = path.join(outDir, 'report.md');
  fs.writeFileSync(outPath, report, 'utf8');

  console.log(report);
  console.log(`\nWritten to ${outPath}`);

  // A console error or a navigation failure is an unambiguous failure.
  // A missing QA hook (game not built yet) is not - it is reported above.
  if (anyConsoleError || anyNavError) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('rooms-check failed:', err);
  process.exit(1);
});
