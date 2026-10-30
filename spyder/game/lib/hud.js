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
      this.orderNumber = this.$('[data-order-number]');
      this.roomName = this.$('[data-room-name]');
      this.orderList = this.$('.work-order__list');
      this.tagTitle = this.$('[data-tag-title]');
      this.tagSub = this.$('[data-tag-sub]');
      this.dotsContainer = this.$('[data-charge]');
      this.tagTank = this.$('[data-tag-tank]');
      this.tagLiquid = this.$('[data-tag-liquid]');
      this.tagTimer = this.$('[data-tag-timer]');
      this.tagFuse = this.$('[data-tag-fuse]');
      this.tagBell = this.$('[data-tag-bell]');
      this.tagIcon = this.$('[data-tag-icon]');
      this.mainTag = this.tagIcon ? this.tagIcon.closest('.tag') : null;
      this.peekCutter = this.$('[data-peek="web-cutter"]');
      this.peekFoam = this.$('[data-peek="foam-spray"]');
      this.peekVacuum = this.$('[data-peek="vacuum"]');
      this.bossCard = this.$('[data-boss-card]');
      this.bossName = this.$('[data-boss-name]');
      this.bossInk = [...root.querySelectorAll('[data-boss-ink]')];
      this.bossTicks = this.$('[data-boss-ticks]');
      this.noteEl = this.$('[data-hud-note]');
      this.noteTimer = null;
      this.bossState = null;
      this.lastCombo = 1;
      this.shownScore = 0;
      this.targetScore = 0;
      this.extraGoalEls = {};
    }

    // Every room is its own work order: "Work order No. 02 · Living Room".
    setRoom({ number, name, rules }) {
      this.orderNumber.textContent = `Work order No. ${String(number).padStart(2, '0')}`;
      this.roomName.textContent = name;
      this.initExtraGoals(rules?.extraGoals);
      if (!rules?.boss) {
        this.updateBoss(null);
      }
    }

    initExtraGoals(extraGoals) {
      if (this.orderList) {
        this.orderList.querySelectorAll('[data-extra-goal-item]').forEach((el) => el.remove());
      }
      this.extraGoalEls = {};
      if (extraGoals && this.orderList) {
        for (const goal of extraGoals) {
          const li = document.createElement('li');
          li.setAttribute('data-extra-goal-item', goal.id);
          const labelSpan = document.createElement('span');
          labelSpan.textContent = goal.label;
          const statusSpan = document.createElement('span');
          statusSpan.setAttribute('data-extra-goal', goal.id);
          this.styleGoalBox(statusSpan, false);
          li.appendChild(labelSpan);
          li.appendChild(statusSpan);
          this.orderList.appendChild(li);
          this.extraGoalEls[goal.id] = statusSpan;
        }
      }
    }

    styleGoalBox(el, done) {
      if (done) {
        el.className = 'work-order__goal-tick';
        el.style.display = 'inline-block';
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.border = 'none';
        el.style.borderRadius = '0';
        el.style.transform = 'rotate(3deg)';
        el.style.fontFamily = 'var(--font-hand)';
        el.style.fontSize = '28px';
        el.style.lineHeight = '1';
        el.style.color = 'var(--ink)';
        el.textContent = '✓';
      } else {
        el.className = 'work-order__goal-box';
        el.style.display = 'inline-block';
        el.style.width = '18px';
        el.style.height = '18px';
        el.style.border = '2px solid var(--ink)';
        el.style.borderRadius = '3px';
        el.style.transform = 'rotate(-2deg)';
        el.style.verticalAlign = 'middle';
        el.textContent = '';
      }
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

    setProgress({ clean, kills, quota, websTorn, extraGoals }) {
      const pct = Math.round(clean * 100);
      this.cleanInk.style.strokeDashoffset = String(1 - clean);
      this.cleanText.textContent = `${pct}%`;
      this.spiderText.textContent = `${kills} / ${quota}`;
      this.webText.textContent = `${Math.round(websTorn * 100)}%`;
      if (extraGoals) {
        for (const g of extraGoals) {
          let el = this.extraGoalEls[g.id];
          if (!el) {
            this.initExtraGoals(extraGoals);
            el = this.extraGoalEls[g.id];
          }
          if (el) {
            this.styleGoalBox(el, g.done);
          }
        }
      }
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

    updateWeapon(weapon, { unlocked = ['vacuum'], charge = 1, tank = 1, timer = 0, sonicCharges = 0 } = {}) {
      if (!weapon) return;

      if (this.tagTitle) this.tagTitle.textContent = weapon.name;
      if (this.tagSub) {
        if (weapon.resource === 'pressure') this.tagSub.textContent = 'Pressure';
        else if (weapon.resource === 'tank') this.tagSub.textContent = 'Tank';
        else if (weapon.resource === 'timer') this.tagSub.textContent = 'Timer';
      }

      // Resource displays. `.tag__dots` carries its own `display: flex` in
      // hud.css, which (being an author rule) outranks the UA's `[hidden] {
      // display: none }` — so the `hidden` IDL attribute alone never hides
      // it. Set its inline `display` directly as well; inline style always
      // wins over an external stylesheet rule that is not `!important`.
      if (weapon.resource === 'pressure') {
        if (this.dotsContainer) {
          this.dotsContainer.hidden = false;
          this.dotsContainer.style.display = '';
        }
        if (this.tagTank) this.tagTank.hidden = true;
        if (this.tagTimer) this.tagTimer.hidden = true;
        this.setCharge(charge);
      } else if (weapon.resource === 'tank') {
        if (this.dotsContainer) {
          this.dotsContainer.hidden = true;
          this.dotsContainer.style.display = 'none';
        }
        if (this.tagTank) this.tagTank.hidden = false;
        if (this.tagTimer) this.tagTimer.hidden = true;
        if (this.tagLiquid) this.tagLiquid.style.height = `${Math.round(tank * 100)}%`;
      } else if (weapon.resource === 'timer') {
        if (this.dotsContainer) {
          this.dotsContainer.hidden = true;
          this.dotsContainer.style.display = 'none';
        }
        if (this.tagTank) this.tagTank.hidden = true;
        if (this.tagTimer) this.tagTimer.hidden = false;
        if (this.tagFuse) this.tagFuse.style.width = `${Math.round((timer / 8.0) * 100)}%`;
      }

      // Peeking background tags (only shown when that weapon is unlocked and not
      // active — this naturally covers the Flamethrower, since it matches none
      // of the three default ids, so all of them peek together when unlocked).
      if (this.peekCutter) {
        this.peekCutter.hidden = !unlocked.includes('web-cutter') || weapon.id === 'web-cutter';
      }
      if (this.peekFoam) {
        this.peekFoam.hidden = !unlocked.includes('foam-spray') || weapon.id === 'foam-spray';
      }
      if (this.peekVacuum) {
        this.peekVacuum.hidden = !unlocked.includes('vacuum') || weapon.id === 'vacuum';
      }

      // The main tag's icon: only shown once more than one weapon is unlocked
      // (with only the Vacuum unlocked, the tag looks exactly as before —
      // prompt 12, L3). `data-weapon` lets CSS style the tag per weapon.
      if (this.tagIcon) {
        this.tagIcon.className = `tag__icon tag__icon--${weapon.id}`;
        this.tagIcon.hidden = unlocked.length <= 1;
      }
      if (this.mainTag) {
        this.mainTag.dataset.weapon = weapon.id;
      }

      // Sonic Pulse brass bell
      if (this.tagBell) {
        this.tagBell.hidden = sonicCharges <= 0;
      }
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
      for (const el of Object.values(this.extraGoalEls)) {
        this.styleGoalBox(el, false);
      }
      this.updateBoss(null);
      if (this.noteEl) {
        this.noteEl.hidden = true;
        this.noteEl.classList.remove('is-fading');
      }
      clearTimeout(this.noteTimer);
    }

    updateBoss(state) {
      if (!this.bossCard) return;
      if (!state) {
        this.bossCard.hidden = true;
        this.bossCard.classList.remove('is-defeated');
        this.bossState = null;
        return;
      }
      const isNew = !this.bossState || this.bossState.name !== state.name;
      if (isNew) {
        this.bossName.textContent = state.name;
        this.inkPhaseTicks(state.phases ?? []);
      }
      const left = state.defeated ? 0 : Math.max(0, Math.min(1, state.fraction ?? 0));
      for (const path of this.bossInk) {
        path.style.strokeDashoffset = String(1 - left);
        // A dash of zero length still leaves a round cap's dot at the start.
        path.style.opacity = left > 0 ? '' : '0';
      }
      this.bossCard.classList.toggle('is-defeated', Boolean(state.defeated));
      this.bossCard.hidden = false;
      this.bossState = state;
    }

    // Two quick pencil strokes per phase threshold, marked before the fight.
    inkPhaseTicks(phases) {
      const NS = 'http://www.w3.org/2000/svg';
      this.bossTicks.replaceChildren();
      for (const phase of phases) {
        if (!(phase.at > 0 && phase.at < 1)) continue;
        const x = 4 + 280 * phase.at;
        for (const d of [`M${x - 2.5} 4 L${x + 1} 22`, `M${x + 0.5} 5.5 L${x + 2.8} 20.5`]) {
          const stroke = document.createElementNS(NS, 'path');
          stroke.setAttribute('d', d);
          this.bossTicks.appendChild(stroke);
        }
      }
    }

    showNote(text, duration = 2000) {
      if (!this.noteEl) return;
      this.noteEl.textContent = text;
      this.noteEl.hidden = false;
      this.noteEl.classList.remove('is-fading');
      clearTimeout(this.noteTimer);
      this.noteTimer = setTimeout(() => {
        this.noteEl.classList.add('is-fading');
        setTimeout(() => {
          this.noteEl.hidden = true;
          this.noteEl.classList.remove('is-fading');
        }, 350);
      }, Math.max(100, duration - 350));
    }

    // ── Cards (start, pause, results, game over) ─────────────────────

    showCard(name) {
      for (const card of document.querySelectorAll('[data-card]')) {
        card.classList.toggle('is-open', card.dataset.card === name);
      }
      const open = Boolean(name);
      document.body.classList.toggle('has-card', open);
      if (open) {
        // First visible button, so hidden options (e.g. "Next room") are skipped.
        const buttons = document.querySelectorAll(`[data-card="${name}"] button`);
        const focusable = [...buttons].find((b) => !b.hidden && !b.closest('[hidden]'));
        if (focusable) focusable.focus({ preventScroll: true });
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
