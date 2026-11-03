/**
 * @file Keyboard and pointer input, shared by every screen.
 *
 * Ported from `reference/index.html` section 15, minus the reference-only
 * keys (no mood keys, no N for next level, no backquote panel toggle) —
 * `Digit1`-`Digit5`/`Numpad1`-`Numpad5` are wired to `onDigit(n)` here, but
 * what a digit *means* is each screen's own business, not this module's.
 * This module only translates DOM events into calls on `handlers` — it
 * knows nothing about game state. `main.js` routes each call to the
 * top-most screen's own `input` object (`ARCHITECTURE.md` §7.3); this file
 * is unaware of screens entirely.
 */

const KEY_TO_SCREEN_DIR = {
  ArrowUp: 0, KeyW: 0,
  ArrowRight: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2,
  ArrowLeft: 3, KeyA: 3,
};

const KEY_TO_DIGIT = {
  Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5,
  Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4, Numpad5: 5,
};

/**
 * @param {HTMLElement} target The canvas to bind pointer events on (keyboard binds on window).
 * @param {{
 *   onDirection?: (screenDir: number) => void,
 *   onSkip?: () => void,
 *   onUndo?: () => void,
 *   onRestart?: () => void,
 *   onRotate?: (delta: number) => void,
 *   onSound?: () => void,
 *   onConfirm?: () => void,
 *   onBack?: () => void,
 *   onPause?: () => void,
 *   onDigit?: (n: number) => void,
 *   onPointerMove?: (x: number, y: number) => void,
 *   onPointerDown?: (x: number, y: number) => void,
 *   onAnyKey?: (code: string) => void,
 * }} handlers
 * @returns {{ dispose(): void }}
 */
export function bindInput(target, handlers) {
  function onKeyDown(e) {
    handlers.onAnyKey?.(e.code);

    if (e.code in KEY_TO_SCREEN_DIR) {
      e.preventDefault();
      handlers.onDirection?.(KEY_TO_SCREEN_DIR[e.code]);
      return;
    }
    if (e.code in KEY_TO_DIGIT) {
      handlers.onDigit?.(KEY_TO_DIGIT[e.code]);
      return;
    }
    switch (e.code) {
      case 'KeyZ':
      case 'Backspace':
        e.preventDefault();
        handlers.onUndo?.();
        break;
      case 'KeyR':
        handlers.onRestart?.();
        break;
      case 'KeyQ':
        handlers.onRotate?.(-1);
        break;
      case 'KeyE':
        handlers.onRotate?.(1);
        break;
      case 'KeyM':
        handlers.onSound?.();
        break;
      case 'Enter':
        handlers.onConfirm?.();
        break;
      case 'Space':
        e.preventDefault();
        handlers.onSkip?.();
        break;
      case 'Escape':
        handlers.onBack?.();
        break;
      case 'KeyP':
        handlers.onPause?.();
        break;
      default:
        break;
    }
  }

  function onPointerMove(e) {
    handlers.onPointerMove?.(e.clientX, e.clientY);
  }

  function onPointerDown(e) {
    handlers.onPointerDown?.(e.clientX, e.clientY);
  }

  window.addEventListener('keydown', onKeyDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerdown', onPointerDown);

  return {
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerdown', onPointerDown);
    },
  };
}
