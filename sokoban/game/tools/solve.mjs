/**
 * @file Solves Sokoban rooms using worker threads across all CPU cores.
 * Verifies each solution with replayLurd, merges solutions.manual.json if present,
 * and outputs src/data/solutions.generated.json and .scratch/solve/report.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { parseLevel } from '../src/core/level.js';
import { solve } from '../src/core/solver/solver.js';
import { replayLurd } from '../src/core/replay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Worker Thread Execution ---
if (!isMainThread) {
  const { room, weight, maxTimeMs, maxNodes } = workerData;
  try {
    const level = parseLevel(room.rows);
    // w = 1 is the exact search; the retries add goal-room macros (solver.js).
    const result = solve(level, {
      weight,
      maxTimeMs,
      maxNodes,
      macros: weight > 1,
    });

    if (result.solved) {
      const verify = replayLurd(level, result.lurd);
      if (!verify.ok || !verify.solved) {
        parentPort.postMessage({
          roomNumber: room.number,
          solved: false,
          weight,
          nodes: result.nodes ?? 0,
          ms: result.ms ?? 0,
          reason: 'error',
          error: 'Replay verification failed',
        });
      } else {
        parentPort.postMessage({
          roomNumber: room.number,
          solved: true,
          lurd: result.lurd,
          steps: result.steps,
          pushes: result.pushes,
          weight: result.weight,
          nodes: result.nodes,
          ms: result.ms,
          reason: 'solved',
        });
      }
    } else {
      parentPort.postMessage({
        roomNumber: room.number,
        solved: false,
        weight,
        reason: result.reason || 'time',
        nodes: result.nodes ?? 0,
        ms: result.ms ?? 0,
      });
    }
  } catch (err) {
    parentPort.postMessage({
      roomNumber: room.number,
      solved: false,
      weight,
      reason: 'error',
      nodes: 0,
      ms: 0,
      error: err.message,
    });
  }
}

// --- Main Thread Functions ---
export async function runSolve(args = process.argv.slice(2)) {
  const roomsPath = path.resolve(__dirname, '../src/data/rooms.generated.json');
  if (!fs.existsSync(roomsPath)) {
    console.error('rooms.generated.json not found! Run npm run rooms or import-rooms.mjs first.');
    process.exit(1);
  }

  const roomsData = JSON.parse(fs.readFileSync(roomsPath, 'utf8'));
  let roomsToSolve = roomsData.rooms;

  // Filter by --room or --rooms if specified
  const roomArgIdx = args.indexOf('--room');
  if (roomArgIdx !== -1 && args[roomArgIdx + 1]) {
    const targetRoom = parseInt(args[roomArgIdx + 1], 10);
    roomsToSolve = roomsToSolve.filter((r) => r.number === targetRoom);
  }
  const roomsArgIdx = args.indexOf('--rooms');
  if (roomsArgIdx !== -1 && args[roomsArgIdx + 1]) {
    const rawRooms = args[roomsArgIdx + 1].split(',').map((x) => parseInt(x.trim(), 10));
    roomsToSolve = roomsToSolve.filter((r) => rawRooms.includes(r.number));
  }

  const solutionsPath = path.resolve(__dirname, '../src/data/solutions.generated.json');
  let existingSolutions = {};
  if (fs.existsSync(solutionsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(solutionsPath, 'utf8'));
      existingSolutions = parsed.solutions || {};
    } catch {
      // ignore
    }
  }

  // Load manual solutions if present
  const manualPath = path.resolve(__dirname, '../src/data/solutions.manual.json');
  const manualSolutions = {};
  if (fs.existsSync(manualPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
      const rawManual = parsed.solutions || parsed;
      for (const [rNum, entry] of Object.entries(rawManual)) {
        const roomObj = roomsData.rooms.find((r) => r.number === Number(rNum));
        if (roomObj) {
          const level = parseLevel(roomObj.rows);
          const lurd = typeof entry === 'string' ? entry : entry.lurd;
          const verify = replayLurd(level, lurd);
          if (verify.ok && verify.solved) {
            manualSolutions[rNum] = {
              lurd,
              steps: verify.steps,
              pushes: verify.pushes,
              weight: 'manual',
              ms: 0,
            };
          }
        }
      }
      console.log(`Merged ${Object.keys(manualSolutions).length} verified manual solutions.`);
    } catch (err) {
      console.warn('Could not read solutions.manual.json:', err.message);
    }
  }

  const coreCount = os.availableParallelism ? os.availableParallelism() : os.cpus().length;

  // --threads N overrides the worker-pool size; default is one worker per
  // core (ARCHITECTURE.md §6.2 asks that the thread count and the machine's
  // core count both be reported, since they are not always the same number).
  let numThreads = coreCount;
  const threadsArgIdx = args.indexOf('--threads');
  if (threadsArgIdx !== -1 && args[threadsArgIdx + 1]) {
    const parsed = parseInt(args[threadsArgIdx + 1], 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      numThreads = parsed;
    }
  }
  const numCPUs = numThreads;
  console.log(
    `Starting solver on ${roomsToSolve.length} rooms using ${numThreads} thread(s) (machine has ${coreCount} core(s))...`
  );

  const results = new Map();

  // Fill in manual solutions
  for (const [rNum, sol] of Object.entries(manualSolutions)) {
    results.set(Number(rNum), {
      roomNumber: Number(rNum),
      solved: true,
      ...sol,
    });
  }

  // Helper to run room in a worker thread with progressive weights
  function solveRoomInWorker(room) {
    return new Promise(async (resolve) => {
      const weights = [1, 2, 3];
      const budgetPerAttemptMs = 120_000;
      const maxNodes = 6_000_000;
      const maxRoomTimeMs = 600_000; // max 10 min per room as per ARCHITECTURE §6.2

      const roomStartTime = Date.now();
      const attempts = [];
      let solvedResult = null;

      for (const weight of weights) {
        const remainingTime = maxRoomTimeMs - (Date.now() - roomStartTime);
        if (remainingTime <= 0) break;

        const attemptTimeLimit = Math.min(budgetPerAttemptMs, remainingTime);

        const workerResult = await new Promise((resWorker) => {
          const worker = new Worker(__filename, {
            workerData: {
              room,
              weight,
              maxTimeMs: attemptTimeLimit,
              maxNodes,
            },
          });

          worker.on('message', (msg) => {
            resWorker(msg);
          });

          worker.on('error', (err) => {
            resWorker({
              roomNumber: room.number,
              solved: false,
              weight,
              nodes: 0,
              ms: 0,
              reason: 'error',
              error: err.message,
            });
          });

          worker.on('exit', (code) => {
            if (code !== 0) {
              resWorker({
                roomNumber: room.number,
                solved: false,
                weight,
                nodes: 0,
                ms: 0,
                reason: 'error',
                error: `Worker stopped with code ${code}`,
              });
            }
          });
        });

        const ms = workerResult.ms ?? 0;
        const nodes = workerResult.nodes ?? 0;
        const nps = ms > 0 ? Math.round(nodes / (ms / 1000)) : 0;
        const reason = workerResult.reason || (workerResult.solved ? 'solved' : 'exhausted');

        attempts.push({
          weight,
          nodes,
          nps,
          ms,
          reason,
        });

        if (workerResult.solved) {
          solvedResult = workerResult;
          break;
        }
      }

      const totalMs = attempts.reduce((acc, a) => acc + a.ms, 0);

      if (solvedResult) {
        resolve({
          roomNumber: room.number,
          solved: true,
          lurd: solvedResult.lurd,
          steps: solvedResult.steps,
          pushes: solvedResult.pushes,
          weight: solvedResult.weight,
          ms: totalMs,
          totalMs,
          attempts,
        });
      } else {
        resolve({
          roomNumber: room.number,
          solved: false,
          ms: totalMs,
          totalMs,
          attempts,
        });
      }
    });
  }

  // Worker pool queue
  const queue = roomsToSolve.filter((r) => !results.has(r.number));
  let completedCount = results.size;
  const totalToSolve = roomsToSolve.length;

  async function workerPoolRunner() {
    while (queue.length > 0) {
      const room = queue.shift();
      const t0 = Date.now();
      const res = await solveRoomInWorker(room);
      const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
      results.set(room.number, res);
      completedCount++;

      const statusStr = res.solved
        ? `SOLVED (${res.steps} steps, ${res.pushes} pushes, w=${res.weight}, ${res.attempts.length} attempt(s), ${durationSec}s)`
        : `UNSOLVED (${res.attempts.map((a) => `w${a.weight}:${a.reason}`).join(', ')}, ${durationSec}s)`;

      console.log(`[${completedCount}/${totalToSolve}] Room ${room.number}: ${statusStr}`);
    }
  }

  const poolWorkers = [];
  const workerCount = Math.min(numCPUs, roomsToSolve.length);
  for (let i = 0; i < workerCount; i++) {
    poolWorkers.push(workerPoolRunner());
  }
  await Promise.all(poolWorkers);

  // Save solutions.generated.json
  const finalSolutions = { ...existingSolutions, ...manualSolutions };
  for (const [rNum, res] of results.entries()) {
    if (res.solved) {
      finalSolutions[rNum] = {
        lurd: res.lurd,
        steps: res.steps,
        pushes: res.pushes,
        weight: res.weight,
        ms: res.totalMs ?? res.ms,
      };
    }
  }

  const outputSolutions = {
    generated: new Date().toISOString(),
    solutions: finalSolutions,
  };

  fs.writeFileSync(solutionsPath, JSON.stringify(outputSolutions, null, 2), 'utf8');
  console.log(`Wrote verified solutions to: ${solutionsPath}`);

  // Generate report
  const scratchSolveDir = path.resolve(__dirname, '../../.scratch/solve');
  fs.mkdirSync(scratchSolveDir, { recursive: true });
  const reportPath = path.join(scratchSolveDir, 'report.md');

  let reportMd = `# Sokoban Solver Report\n\n`;
  reportMd += `Generated: ${new Date().toISOString()}\n\n`;
  reportMd += `Threads: ${numThreads} (machine has ${coreCount} core(s))\n\n`;
  reportMd += `## Summary Table\n\n`;
  reportMd += `| Room | Solved | Steps | Pushes | Solved Weight | Total Seconds | Attempts Breakdown |\n`;
  reportMd += `|---|---|---|---|---|---|---|\n`;

  let solvedCount = 0;
  const sortedRooms = [...roomsToSolve].sort((a, b) => a.number - b.number);

  for (const room of sortedRooms) {
    const res = results.get(room.number) || {};
    const isSolved = res.solved ? 'Yes' : 'No';
    if (res.solved) solvedCount++;
    const steps = res.steps ?? '—';
    const pushes = res.pushes ?? '—';
    const weight = res.weight ?? '—';
    const sec = res.totalMs !== undefined ? (res.totalMs / 1000).toFixed(2) : '—';
    const attemptsStr = (res.attempts || [])
      .map((a) => `w=${a.weight} (${a.nodes.toLocaleString()} nodes, ${a.nps.toLocaleString()} nps, ${(a.ms / 1000).toFixed(2)}s, ${a.reason})`)
      .join('; ');
    reportMd += `| ${room.number} | ${isSolved} | ${steps} | ${pushes} | ${weight} | ${sec} | ${attemptsStr || '—'} |\n`;
  }

  reportMd += `\n**Total Solved:** ${solvedCount} / ${roomsToSolve.length}\n\n`;

  reportMd += `## Detailed Attempt Log\n\n`;
  reportMd += `| Room | Weight | Nodes Explored | Nodes/s | Time (ms) | Stop Reason |\n`;
  reportMd += `|---|---|---|---|---|---|\n`;

  for (const room of sortedRooms) {
    const res = results.get(room.number) || {};
    if (res.attempts && res.attempts.length > 0) {
      for (const a of res.attempts) {
        reportMd += `| ${room.number} | ${a.weight} | ${a.nodes.toLocaleString()} | ${a.nps.toLocaleString()} | ${a.ms} | ${a.reason} |\n`;
      }
    }
  }

  fs.writeFileSync(reportPath, reportMd, 'utf8');
  console.log(`Saved solve report to: ${reportPath}`);
  console.log(reportMd);

  return {
    solvedCount,
    totalRooms: roomsToSolve.length,
    reportPath,
    reportMd,
  };
}

if (isMainThread && process.argv[1] === fileURLToPath(import.meta.url)) {
  runSolve().catch((err) => {
    console.error('Solve error:', err);
    process.exit(1);
  });
}
