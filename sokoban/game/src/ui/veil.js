/**
 * @file Small DOM pieces the screens share: a caption that floats over a
 * point in the world, a veiled card, and a row (or column) of choices whose
 * selected item breathes (ART-DIRECTION §12, §13.8). Opacity only.
 */

import './screens.css';

export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** A caption anchored to a screen point: above it by default, below with `below`. */
export function createCaption({ below = false } = {}) {
  const root = el('div', below ? 'caption below' : 'caption');
  const name = el('div', 'name');
  const detail = el('div', 'detail');
  root.append(name, detail);
  document.body.appendChild(root);
  let shown = '';
  return {
    root,
    show(text, more = '') {
      if (shown !== text + more) {
        name.textContent = text;
        detail.textContent = more;
        detail.style.display = more ? '' : 'none';
        shown = text + more;
      }
      root.classList.add('on');
    },
    hide() {
      root.classList.remove('on');
    },
    place(x, y) {
      root.style.left = `${x}px`;
      root.style.top = `${y}px`;
    },
    get visible() {
      return root.classList.contains('on');
    },
    dispose() {
      root.remove();
    },
  };
}

/** A full-screen veil holding one card; shows on the next frame so it fades in. */
export function createCard(className = '') {
  const root = el('div', 'card-veil');
  const inner = el('div', className);
  root.appendChild(inner);
  document.body.appendChild(root);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('on')));
  return {
    root,
    inner,
    /** Fades out, then removes itself. */
    dispose() {
      root.classList.remove('on');
      root.style.pointerEvents = 'none';
      setTimeout(() => root.remove(), 650);
    },
  };
}

/**
 * Choices the keyboard walks and the pointer taps.
 * @param {{ label: string, disabled?: boolean, run: () => void }[]} items
 * @param {{ vertical?: boolean, index?: number }} [options]
 */
export function createChoices(items, { vertical = false, index = 0 } = {}) {
  const root = el('div', vertical ? 'choices vertical' : 'choices');
  const buttons = items.map((item, i) => {
    const b = el('button', 'choice', item.label);
    b.disabled = !!item.disabled;
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (item.disabled) return;
      setIndex(i);
      item.run();
    });
    root.appendChild(b);
    return b;
  });
  let current = -1;
  function setIndex(i) {
    current = i;
    buttons.forEach((b, j) => b.classList.toggle('sel', j === i));
  }
  const enabled = (i) => !items[i].disabled;
  setIndex(enabled(index) ? index : items.findIndex((_, i) => enabled(i)));
  return {
    root,
    get index() {
      return current;
    },
    setIndex,
    /** Steps to the next enabled item in direction `d` (wraps). */
    move(d) {
      for (let k = 1; k <= items.length; k++) {
        const i = (current + d * k + items.length * 4) % items.length;
        if (enabled(i)) {
          setIndex(i);
          return;
        }
      }
    },
    pick() {
      if (current >= 0 && enabled(current)) items[current].run();
    },
  };
}
