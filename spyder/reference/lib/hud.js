/*
 * Spyder — diegetic HUD.
 *
 * The interface pretends to be objects from the house: an engraved brass
 * plate for the score, a pinned work-order card for progress, a pressure
 * gauge for the hero's nerve, a luggage tag for the weapon. All of it is
 * plain DOM laid over the canvas, positioned in stage units (1920×1080)
 * and scaled together with the canvas.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  class Hud {
    constructor(root) {
      this.root = root;
      this.$ = (sel) => root.querySelector(sel);
      this.score = this.$('[data-score]');
      this.comboTag = this.$('[data-combo]');
      this.comboText = this.$('[data-combo-text]');
      this.cleanInk = this.$('[data-clean-ink]');
      this.cleanText = this.$('[data-clean-text]');
      this.spiderText = this.$('[data-spiders]');
      this.webText = this.$('[data-webs]');
      this.stampEl = this.$('[data-stamp]');
      this.needle = this.$('[data-needle]');
      this.chargeDots = [...root.querySelectorAll('[data-charge] i')];
      this.lastCombo = 1;
      this.shownScore = 0;
      this.targetScore = 0;
    }

    setScore(value) {
      this.targetScore = value;
    }

    // Called every frame so the number rolls up like an odometer.
    tick(dt) {
      if (this.shownScore !== this.targetScore) {
        const step = Math.max(1, Math.ceil((this.targetScore - this.shownScore) * Math.min(1, dt * 10)));
        this.shownScore = Math.min(this.targetScore, this.shownScore + step);
        this.score.textContent = String(this.shownScore).padStart(6, '0');
      }
    }

    setCombo(multiplier) {
      if (multiplier === this.lastCombo) return;
      this.comboTag.classList.toggle('is-visible', multiplier > 1);
      this.comboText.textContent = `×${multiplier}`;
      // Swing the tag on its string when the value changes.
      this.comboTag.classList.remove('is-swinging');
      void this.comboTag.offsetWidth;
      this.comboTag.classList.add('is-swinging');
      this.lastCombo = multiplier;
    }

    setProgress({ clean, kills, quota, websTorn }) {
      const pct = Math.round(clean * 100);
      this.cleanInk.style.strokeDashoffset = String(1 - clean);
      this.cleanText.textContent = `${pct}%`;
      this.spiderText.textContent = `${kills} / ${quota}`;
      this.webText.textContent = `${Math.round(websTorn * 100)}%`;
    }

    setNerve(value) {
      // The needle sweeps from -120° (empty) to +120° (full).
      const angle = S.lerp(-120, 120, value / 100);
      this.needle.style.transform = `rotate(${angle}deg)`;
      this.root.classList.toggle('is-shaken', value < 35);
    }

    setCharge(fraction) {
      const lit = Math.round(fraction * this.chargeDots.length);
      this.chargeDots.forEach((dot, i) => dot.classList.toggle('is-on', i < lit));
    }

    stamp() {
      this.stampEl.classList.add('is-stamped');
    }

    reset() {
      this.stampEl.classList.remove('is-stamped');
      this.shownScore = 0;
      this.targetScore = 0;
      this.score.textContent = '000000';
      this.lastCombo = 0;
      this.setCombo(1);
    }

    // ── Cards (start, pause, results, game over) ─────────────────────

    showCard(name) {
      for (const card of document.querySelectorAll('[data-card]')) {
        card.classList.toggle('is-open', card.dataset.card === name);
      }
      const open = Boolean(name);
      document.body.classList.toggle('has-card', open);
      if (open) {
        const focusable = document.querySelector(`[data-card="${name}"] button`);
        if (focusable) focusable.focus();
      }
    }

    fillResults(stats) {
      const set = (key, value) => {
        const el = document.querySelector(`[data-result="${key}"]`);
        if (el) el.textContent = value;
      };
      set('score', stats.score.toLocaleString('en-US'));
      set('time', formatTime(stats.time));
      set('spiders', String(stats.kills));
      set('eggs', String(stats.eggs));
      set('bestCombo', `×${stats.bestCombo}`);
      set('untouched', stats.untouched ? 'Yes — not a scratch' : 'No');
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  S.Hud = Hud;
})();
