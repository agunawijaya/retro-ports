import { describe, it, expect } from 'vitest';
import { parseLevel } from '../src/core/level.js';
import { createGame } from '../src/core/game.js';

describe('game.js', () => {
  // Test fixture room: our own small room
  // Row 0: #######
  // Row 1: #@ $ .#  (player at (1,1), object at (1,3), target 0 at (1,5))
  // Row 2: #  $ .#  (object at (2,3), target 1 at (2,5))
  // Row 3: #######
  const createTestLevel = () =>
    parseLevel([
      '#######',
      '#@ $ .#',
      '#  $ .#',
      '#######',
    ]);

  it('performs walk and updates counters and history', () => {
    const level = createTestLevel();
    const game = createGame(level);

    const res = game.move('right');
    expect(res.kind).toBe('walk');
    expect(res.from).toEqual({ r: 1, c: 1 });
    expect(res.to).toEqual({ r: 1, c: 2 });
    expect(res.dir).toBe('right');

    expect(game.state.player).toEqual({ r: 1, c: 2 });
    expect(game.state.steps).toBe(1);
    expect(game.state.pushes).toBe(0);
    expect(game.toLurd()).toBe('r');
  });

  it('reports blocked-wall when moving into a wall', () => {
    const level = createTestLevel();
    const game = createGame(level);

    const res = game.move('left');
    expect(res.kind).toBe('blocked-wall');
    expect(res.dir).toBe('left');
    expect(game.state.player).toEqual({ r: 1, c: 1 });
    expect(game.state.steps).toBe(0);
  });

  it('performs push and tracks lit/unlit target indices and solved event', () => {
    // Room designed so pushing right lands on target
    const level = parseLevel([
      '######',
      '#@$. #',
      '# $. #',
      '######',
    ]);
    const game = createGame(level);

    // Push right: object at (1, 2) pushed to (1, 3) which is target 0
    const res = game.move('right');
    expect(res.kind).toBe('push');
    expect(res.objectFrom).toEqual({ r: 1, c: 2 });
    expect(res.objectTo).toEqual({ r: 1, c: 3 });
    expect(res.lit).toBe(0);
    expect(res.unlit).toBe(null);
    expect(res.solved).toBeUndefined(); // not all targets covered yet

    expect(game.state.steps).toBe(1);
    expect(game.state.pushes).toBe(1);

    // Walk around to line up second push
    // Move left to (1, 1), down to (2, 1), then push right
    game.move('left');
    game.move('down');
    const finalMove = game.move('right');

    expect(finalMove.kind).toBe('push');
    expect(finalMove.lit).toBe(1);
    expect(finalMove.solved).toBeDefined();
    expect(finalMove.solved).toEqual({ steps: 4, pushes: 2 });
    expect(game.state.solved).toBe(true);

    // Push object OFF a target to test unlit
    // Level where object starts on target
    const unlitLevel = parseLevel([
      '#######',
      '#@*  .#',
      '# $  .#',
      '#######',
    ]);
    const unlitGame = createGame(unlitLevel);
    // Push right: moves off target at (1,2) to floor at (1,3)
    const offTargetMove = unlitGame.move('right');
    expect(offTargetMove.kind).toBe('push');
    expect(offTargetMove.unlit).toBe(0);
    expect(offTargetMove.lit).toBe(null);
  });

  it('reports blocked-object when pushing object against a wall or another object', () => {
    const level = parseLevel([
      '#####',
      '#@$##', // object at (1, 2) directly against wall at (1, 3)
      '#$$ #', // two objects at (2, 1) and (2, 2)
      '#####',
    ]);
    const game = createGame(level);

    // Pushing into object backed by wall
    const wallBlocked = game.move('right');
    expect(wallBlocked.kind).toBe('blocked-object');
    expect(wallBlocked.dir).toBe('right');
    expect(wallBlocked.objectIndex).toBe(0);

    // Walk down into an object backed by another object
    const objBlocked = game.move('down');
    expect(objBlocked.kind).toBe('blocked-object');
    expect(objBlocked.dir).toBe('down');
  });

  it('handles undo of walk and push correctly', () => {
    const level = parseLevel([
      '######',
      '#@$. #',
      '#  . #',
      '######',
    ]);
    const game = createGame(level);

    // Push
    game.move('right');
    expect(game.state.player).toEqual({ r: 1, c: 2 });
    expect(game.state.objects[0]).toEqual({ r: 1, c: 3 });
    expect(game.state.steps).toBe(1);
    expect(game.state.pushes).toBe(1);

    // Undo push
    const undoPush = game.undo();
    expect(undoPush).not.toBeNull();
    expect(game.state.player).toEqual({ r: 1, c: 1 });
    expect(game.state.objects[0]).toEqual({ r: 1, c: 2 });
    expect(game.state.steps).toBe(0);
    expect(game.state.pushes).toBe(0);

    // Undo when empty returns null
    expect(game.undo()).toBeNull();
  });

  it('handles restart as a single undoable history entry', () => {
    const level = parseLevel([
      '######',
      '#@$. #',
      '#  . #',
      '######',
    ]);
    const game = createGame(level);

    // Make some moves
    game.move('right'); // push
    expect(game.state.steps).toBe(1);
    expect(game.state.pushes).toBe(1);

    // Restart
    const restartResult = game.restart();
    expect(restartResult.kind).toBe('restart');
    expect(game.state.steps).toBe(0);
    expect(game.state.pushes).toBe(0);
    expect(game.state.player).toEqual({ r: 1, c: 1 });
    expect(game.state.objects[0]).toEqual({ r: 1, c: 2 });

    // Accidental restart: single undo restores previous state completely
    const undoRestart = game.undo();
    expect(undoRestart.kind).toBe('undo-restart');
    expect(game.state.steps).toBe(1);
    expect(game.state.pushes).toBe(1);
    expect(game.state.player).toEqual({ r: 1, c: 2 });
    expect(game.state.objects[0]).toEqual({ r: 1, c: 3 });
  });
});
