/*
 * Spyder — the screens around the rooms.
 *
 * Title, how to play, settings, the house map, and the in-room cards
 * (pause, results, game over). All of them are paper laid over the canvas,
 * like the HUD: an old letter, a card with index tabs, a sheet of plans.
 * This file shows and hides them, keeps the settings form in step with the
 * saved settings, and paints the little pictures on them — with the game's
 * own hero and spider rig, so they are the same characters, not clip-art.
 *
 * It does not decide where the player goes next; it reports every button
 * press to `onAction(name, button)` and main.js routes.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const P = S.palette;

  // Full screens hide the in-room HUD; the in-room cards only dim it.
  const SCREENS = ['title', 'howto', 'settings', 'map'];

  S.createScreens = function createScreens({ hud, progress, audio, onAction, onSettingsChanged }) {
    const body = document.body;
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    let current = null;

    // Every [data-action] button anywhere on the page reports here.
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button || button.disabled) return;
      onAction(button.dataset.action, button);
    });

    function show(name) {
      current = name;
      body.classList.toggle('is-screen', SCREENS.includes(name));
      if (name === 'title') refreshTitle();
      if (name === 'howto') paintSnapshots();
      if (name === 'settings') {
        paintPortraits();
        syncSettings();
      }
      hud.showCard(name);
    }

    // ── Title ─────────────────────────────────────────────────────────

    const title = $('[data-card="title"]');

    function setReady(ready) {
      body.classList.toggle('is-ready', ready);
      $('[data-action="new-game"]', title).disabled = !ready;
      refreshTitle();
    }

    // "Continue" only when there is something to continue.
    function refreshTitle() {
      const resume = $('[data-action="continue"]', title);
      resume.hidden = !progress.hasSave() || !body.classList.contains('is-ready');
      const fresh = $('[data-action="new-game"]', title);
      fresh.classList.toggle('card__button--quiet', !resume.hidden);
      confirmNewGame(false);
    }

    function confirmNewGame(open) {
      $('[data-menu]', title).hidden = open;
      $('[data-confirm]', title).hidden = !open;
      if (open) $('[data-action="confirm-new"]', title).focus();
    }

    // The first button that can be pressed: what Enter means on the title.
    function firstTitleButton() {
      return $$('button', title).find((b) => !b.disabled && !b.hidden && !b.closest('[hidden]'));
    }

    // ── Results, pause, fled ──────────────────────────────────────────

    function fillResults({ room, stats, unlockedWeapon, next }) {
      hud.fillResults(stats);
      const set = (key, text) => {
        const el = $(`[data-result="${key}"]`);
        if (el) el.textContent = text;
      };
      set('kicker', `Work order No. ${String(room.number).padStart(2, '0')} · complete`);
      set('title', S.rooms.titleOf(room));
      set('found', room.storyObject || '');

      const unlockEl = $('[data-result="unlock"]');
      const unlockLabel = $('[data-result="unlock-label"]');
      const unlockCanvas = $('[data-result="unlock-canvas"]');
      // Only the clear that actually granted the unlock shows "Found: …"
      // (progress.js records which weapon, if any, that clear just unlocked).
      const foundWeapon = unlockedWeapon || null;

      if (foundWeapon && unlockEl) {
        unlockEl.hidden = false;
        const name = foundWeapon === 'web-cutter' ? 'Web-Cutter' : 'Foam Spray';
        if (unlockLabel) unlockLabel.textContent = `Found: ${name}`;
        if (unlockCanvas) {
          const g = unlockCanvas.getContext('2d');
          g.clearRect(0, 0, unlockCanvas.width, unlockCanvas.height);
          drawResultsItemBlockout(g, foundWeapon, unlockCanvas.width, unlockCanvas.height);
        }
      } else if (unlockEl) {
        unlockEl.hidden = true;
      }

      const coinsEl = $('[data-result="coins"]');
      if (coinsEl) {
        if (stats && stats.coins) {
          coinsEl.hidden = false;
          coinsEl.textContent = `Coins +${stats.coins}`;
        } else {
          coinsEl.hidden = true;
        }
      }

      const nextButton = $('[data-action="next-room"]');
      const soon = $('[data-result="next-soon"]');
      nextButton.hidden = !(next && next.playable);
      soon.hidden = !(next && !next.playable);
      if (next && next.playable) {
        nextButton.textContent = 'Next room →';
        nextButton.setAttribute('aria-label', `Next room: ${next.name}`);
        nextButton.dataset.room = next.id;
      }
      if (next && !next.playable) soon.textContent = `next on the plan: the ${next.name} — not built yet`;
    }

    function setMuted(muted) {
      for (const b of $$('[data-mute-label]')) b.textContent = muted ? 'Sound: off' : 'Sound: on';
    }

    // ── Settings ──────────────────────────────────────────────────────

    const settingsCard = $('[data-card="settings"]');
    const tabs = $$('[role="tab"]', settingsCard);

    function selectTab(name, focus = false) {
      for (const tab of tabs) {
        const on = tab.dataset.tab === name;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        $(`#${tab.getAttribute('aria-controls')}`).hidden = !on;
        if (on && focus) tab.focus();
      }
    }
    for (const tab of tabs) tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    $('[role="tablist"]', settingsCard).addEventListener('keydown', (e) => {
      const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      selectTab(tabs[(i + step + tabs.length) % tabs.length].dataset.tab, true);
    });

    // Form ← saved settings.
    function syncSettings() {
      const s = progress.settings;
      const check = (name, value) => {
        for (const input of $$(`input[name="${name}"]`, settingsCard)) input.checked = input.value === value;
      };
      check('difficulty', s.difficulty);
      check('shake', s.shake ? 'on' : 'off');
      check('particles', s.particles);
      check('grain', s.grain ? 'on' : 'off');
      for (const input of $$('[data-volume]', settingsCard)) {
        const key = input.dataset.volume;
        input.value = String(Math.round(s.volume[key] * 100));
        $(`[data-volume-text="${key}"]`, settingsCard).textContent = input.value;
      }
      $('[data-storage-note]', settingsCard).hidden = progress.storageAvailable;
    }

    // Form → saved settings, applied at once.
    settingsCard.addEventListener('change', (e) => {
      const input = e.target;
      if (input.name === 'difficulty') progress.updateSettings({ difficulty: input.value });
      if (input.name === 'shake') progress.updateSettings({ shake: input.value === 'on' });
      if (input.name === 'particles') progress.updateSettings({ particles: input.value });
      if (input.name === 'grain') progress.updateSettings({ grain: input.value === 'on' });
      if (input.dataset.volume) progress.updateSettings({ volume: { [input.dataset.volume]: Number(input.value) / 100 } });
      onSettingsChanged(progress.settings);
    });
    // Sliders sound while they move; they are saved when let go ('change').
    settingsCard.addEventListener('input', (e) => {
      const input = e.target;
      if (!input.dataset.volume) return;
      $(`[data-volume-text="${input.dataset.volume}"]`, settingsCard).textContent = input.value;
      audio.setVolumes({ [input.dataset.volume]: Number(input.value) / 100 });
    });

    // ── Pictures: snapshots for "how to play", portraits for the cast ──

    let snapshotsPainted = false;
    function paintSnapshots() {
      if (snapshotsPainted) return;
      snapshotsPainted = true;
      for (const canvas of $$('[data-tip]')) {
        const g = canvas.getContext('2d');
        photoBackdrop(g, canvas.width, canvas.height, 7);
        TIPS[canvas.dataset.tip](g, canvas.width, canvas.height);
        photoFinish(g, canvas.width, canvas.height);
      }
    }

    let portraitsPainted = false;
    function paintPortraits() {
      if (portraitsPainted) return;
      portraitsPainted = true;
      for (const canvas of $$('[data-portrait]')) {
        const who = canvas.dataset.portrait;
        if (who === 'exterminator') paintIdPhoto(canvas);
        else paintSketch(canvas, who);
      }
    }

    return {
      show,
      get current() {
        return current;
      },
      setReady,
      refreshTitle,
      confirmNewGame,
      firstTitleButton,
      fillResults,
      setMuted,
      syncSettings,
      paintSnapshots,
      paintPortraits,
    };
  };

  // ART: blockout - results item label
  // A small paper label tied to the item's ink drawing, slightly rotated
  // The item on the results card, drawn in ink like a sketch in a notebook:
  // slightly wobbly lines, a little hatching for shade. The canvas is drawn
  // at twice its displayed size so the lines stay crisp.
  function drawResultsItemBlockout(g0, weaponId) {
    const c = g0.canvas;
    if (c.width !== 192) {
      c.width = 192;
      c.height = 104;
    }
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    const rng = S.createRng(weaponId === 'web-cutter' ? 4101 : 4102);
    const ink = (a = 0.9) => `rgba(42,31,23,${a})`;
    // A hand-drawn line: a few short segments, each nudged a little.
    const line = (pts, width = 2.4, a = 0.9) => {
      g.strokeStyle = ink(a);
      g.lineWidth = width;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = x + rng.range(-0.6, 0.6);
        const jy = y + rng.range(-0.6, 0.6);
        if (i === 0) g.moveTo(jx, jy);
        else g.lineTo(jx, jy);
      });
      g.stroke();
    };
    const box = (x, y, w, h, r = 6) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push([x + r + ((w - 2 * r) * i) / 8, y]);
      pts.push([x + w, y + r], [x + w, y + h - r]);
      for (let i = 8; i >= 0; i--) pts.push([x + r + ((w - 2 * r) * i) / 8, y + h]);
      pts.push([x, y + h - r], [x, y + r], [x + r, y]);
      line(pts);
    };
    const hatch = (x0, y0, x1, y1, step = 5) => {
      g.save();
      g.beginPath();
      g.rect(x0, y0, x1 - x0, y1 - y0);
      g.clip();
      for (let x = x0 - (y1 - y0); x < x1; x += step) line([[x, y1], [x + (y1 - y0), y0]], 1, 0.45);
      g.restore();
    };
    g.save();
    g.translate(96, 52);
    g.rotate(-0.06);
    g.translate(-96, -52);
    if (weaponId === 'web-cutter') {
      // The launcher: body, barrel with a notched muzzle, the drum on top
      // with a blade showing.
      box(28, 50, 86, 26, 6);
      hatch(28, 66, 114, 76);
      box(114, 54, 46, 18, 3);
      line([[160, 54], [160, 58]]);
      line([[160, 62], [160, 66]]);
      line([[160, 69], [160, 72]]);
      line([[56, 50], [56, 76]], 1.6);
      line([[104, 50], [104, 76]], 1.6);
      g.strokeStyle = ink();
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(74, 34, 18, 0, Math.PI * 2);
      g.stroke();
      const star = [];
      for (let k = 0; k <= 8; k++) {
        const a = (k * Math.PI) / 4 - Math.PI / 2;
        const r = k % 2 ? 5 : 13;
        star.push([74 + Math.cos(a) * r, 34 + Math.sin(a) * r]);
      }
      line(star, 1.8);
      // The grip below.
      line([[46, 76], [40, 96], [54, 96], [60, 76]]);
    } else {
      // The sprayer: a fat canister with its pump, the level window, the
      // hose and the wide flat nozzle.
      box(24, 40, 70, 40, 16);
      hatch(24, 66, 94, 80);
      box(38, 52, 40, 12, 4);
      line([[50, 40], [50, 24]]);
      line([[38, 22], [62, 22]]);
      line([[94, 66], [108, 84], [124, 82], [132, 62]], 2.4);
      line([[132, 56], [166, 44], [166, 82], [132, 70], [132, 56]]);
      line([[166, 48], [166, 78]], 1.2, 0.5);
      // A dab of foam at the nozzle.
      g.strokeStyle = ink(0.8);
      g.lineWidth = 1.6;
      for (const [x, y, r] of [[176, 58, 5], [182, 66, 4], [175, 72, 3]]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.restore();
  }

  // ── Snapshot painting ──────────────────────────────────────────────

  // A small dark photo of the house: wallpaper, a floorboard line, one warm
  // light. The same lighting idea as a room, at the size of a print.
  function photoBackdrop(g, w, h, seed) {
    const wall = g.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, S.mixHex(P.umber, P.taupe, 0.35));
    wall.addColorStop(0.72, S.mixHex(P.umber, P.taupe, 0.55));
    wall.addColorStop(0.72, P.walnut);
    wall.addColorStop(1, S.mixHex(P.walnut, P.umber, 0.5));
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    // Faint wallpaper stripes, as in the rooms (low contrast).
    const rng = S.createRng(seed);
    for (let x = 6; x < w; x += 18) {
      g.fillStyle = S.rgba(P.linen, rng.range(0.03, 0.06));
      g.fillRect(x, 0, 6, h * 0.72);
    }
    // Ceiling band and floorboard seams.
    g.fillStyle = S.rgba(P.soot, 0.55);
    g.fillRect(0, 0, w, 22);
    g.strokeStyle = S.rgba(P.soot, 0.4);
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(w / 2 - i * 50, h * 0.72);
      g.lineTo(w / 2 - i * 140, h);
      g.moveTo(w / 2 + i * 50, h * 0.72);
      g.lineTo(w / 2 + i * 140, h);
      g.stroke();
    }
  }

  // Light, vignette and grain over the finished print.
  function photoFinish(g, w, h, lightAt = { x: 0.62, y: 0.3 }) {
    g.save();
    g.globalCompositeOperation = 'soft-light';
    const lamp = g.createRadialGradient(w * lightAt.x, h * lightAt.y, 4, w * lightAt.x, h * lightAt.y, w * 0.8);
    lamp.addColorStop(0, S.rgba(P.amber, 0.75));
    lamp.addColorStop(1, S.rgba(P.amber, 0));
    g.fillStyle = lamp;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(10,6,4,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.12;
    g.fillStyle = g.createPattern(S.paint.grainTile(128, 5), 'repeat');
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  // Settle a rig into a natural pose before photographing it.
  function settle(rig, seconds = 0.6) {
    for (let t = 0; t < seconds; t += 1 / 60) rig.update(1 / 60, t + 2);
  }

  function silk(g, x0, y0, x1, y1) {
    g.strokeStyle = S.rgba(P.silk, 0.7);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + 3, (y0 + y1) / 2, x1, y1);
    g.stroke();
  }

  // The dart, as the runtime draws it: a bright slug with rings of air.
  function dart(g, x, y, angle) {
    for (let i = 1; i <= 3; i++) {
      g.strokeStyle = `rgba(240,232,214,${0.3 / i})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(x - Math.cos(angle) * i * 16, y - Math.sin(angle) * i * 16, 3 + i * 2, 6 + i * 2.5, angle, 0, Math.PI * 2);
      g.stroke();
    }
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    const body = g.createLinearGradient(-18, 0, 8, 0);
    body.addColorStop(0, 'rgba(255,240,210,0)');
    body.addColorStop(1, 'rgba(255,248,230,0.95)');
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(-5, 0, 14, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    S.light.glow(g, x, y, 26, '#FFF1D6', 0.5);
  }

  function spark(g, x, y, size) {
    g.save();
    g.globalCompositeOperation = 'screen';
    g.fillStyle = S.rgba(P.dawn, 0.95);
    g.beginPath();
    g.moveTo(x, y - size);
    g.quadraticCurveTo(x, y, x + size, y);
    g.quadraticCurveTo(x, y, x, y + size);
    g.quadraticCurveTo(x, y, x - size, y);
    g.quadraticCurveTo(x, y, x, y - size);
    g.fill();
    g.restore();
  }

  function stillHero(x, y, { aim = -Math.PI / 2, facing = 1, expression = 'neutral', airborne = false, look = { x: 0, y: -1 } } = {}) {
    const hero = new S.Hero(x, y);
    hero.aim = aim;
    hero.facing = facing;
    hero.time = 1.3;
    hero.nextBlink = 99;
    hero.feel(expression, 9);
    hero.look = look;
    if (airborne) {
      hero.onGround = false;
      hero.lastGroundY = y + 70;
    }
    return hero;
  }

  const TIPS = {
    // A spider on its thread, a dart cutting the silk just above it.
    snip(g, w) {
      const spider = new S.spiders.StringSpider({ x: w * 0.56, ceiling: 22, targetY: 150, seed: 12 });
      spider.rig.y = 150;
      spider.rig.scale = 0.78;
      settle(spider.rig);
      const end = spider.silkEnd();
      silk(g, spider.anchorX, 22, end.x + 4, 70);
      silk(g, end.x + 6, 84, end.x, end.y);
      spider.rig.draw(g);
      dart(g, w * 0.5, 80, -0.25);
      spark(g, end.x + 5, 77, 12);
      S.light.glow(g, spider.rig.eyePoint().x, spider.rig.eyePoint().y, 16, P.spiderEye, 0.5);
    },

    // Coming down boots-first on a hatchling.
    stomp(g, w, h) {
      const hatch = new S.spiders.Hatchling({ x: w * 0.5, y: h * 0.86, seed: 41 });
      hatch.rig.scale = 0.55;
      hatch.rig.heading = Math.PI * 0.95;
      hatch.rig.vx = -40;
      settle(hatch.rig, 0.3);
      hatch.rig.draw(g);
      g.save();
      g.translate(w * 0.5, h * 0.62);
      g.scale(0.62, 0.62);
      stillHero(0, 0, { aim: -0.7, expression: 'determined', airborne: true, look: { x: 0, y: 1 } }).draw(g);
      g.restore();
      // Motion lines above the boots.
      g.strokeStyle = S.rgba(P.bone, 0.35);
      g.lineWidth = 2;
      for (const dx of [-26, 0, 26]) {
        g.beginPath();
        g.moveTo(w * 0.5 + dx, h * 0.12);
        g.lineTo(w * 0.5 + dx, h * 0.24);
        g.stroke();
      }
    },

    // A spider overhead, an egg on its way down, a hero who has noticed.
    egg(g, w, h) {
      const spider = new S.spiders.StringSpider({ x: w * 0.42, ceiling: 22, targetY: 70, seed: 33 });
      spider.rig.y = 70;
      spider.rig.scale = 0.62;
      settle(spider.rig);
      silk(g, spider.anchorX, 22, spider.silkEnd().x, spider.silkEnd().y);
      spider.rig.draw(g);
      const egg = new S.spiders.EggSac({ x: w * 0.47, y: h * 0.42, mode: 'falling', seed: 3 });
      g.save();
      g.translate(egg.x, egg.y);
      g.scale(0.7, 0.7);
      g.translate(-egg.x, -egg.y);
      egg.draw(g);
      g.restore();
      g.strokeStyle = S.rgba(P.bone, 0.3);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(egg.x, egg.y - 22);
      g.lineTo(egg.x, egg.y - 44);
      g.stroke();
      g.save();
      g.translate(w * 0.52, h * 0.97);
      g.scale(0.5, 0.5);
      stillHero(0, 0, { aim: -2.0, facing: -1, expression: 'surprised', look: { x: -0.3, y: -1 } }).draw(g);
      g.restore();
    },
  };

  // ── Cast: an ID photo, and three pencil sketches ─────────────────────

  // The Exterminator, photographed against the living-room wallpaper.
  function paintIdPhoto(canvas) {
    const g = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    photoBackdrop(g, w, h, 19);
    g.save();
    g.translate(w * 0.5, h * 0.99);
    g.scale(0.98, 0.98);
    stillHero(0, 0, { aim: -1.15, expression: 'neutral', look: { x: 0.1, y: 0.15 } }).draw(g);
    g.restore();
    photoFinish(g, w, h, { x: 0.35, y: 0.25 });
  }

  // The other three share the Exterminator's skeleton (ART-DIRECTION §8):
  // the same legs, body and face — their own hair, clothes and the thing
  // they carry. Drawn in colour off-screen, then turned into graphite.
  function paintSketch(canvas, who) {
    const w = canvas.width;
    const h = canvas.height;
    const colour = S.makeCanvas(w, h);
    const c = colour.getContext('2d');
    const hero = stillHero(0, 0, { aim: -0.4, expression: who === 'kid' ? 'surprised' : 'neutral', look: { x: 0.25, y: 0.05 } });
    const k = who === 'kid' ? 0.9 : 1; // the kid is a head shorter
    c.save();
    c.translate(w * 0.5, h * 0.98);
    c.scale(1.25 * k, 1.25 * k); // Hero.SCALE, as Hero.draw would
    const bob = hero.bob();
    if (who === 'hunter') longCoat(c, false);
    hero.drawLegs(c);
    hero.drawTorso(c, bob);
    CLOTHES[who](c, bob);
    bareHead(c, hero, bob, who);
    ACCESSORY[who](c);
    c.restore();
    pencil(canvas.getContext('2d'), colour, who.length * 13);
  }

  // Body units, facing right, feet at (0, 0); head centre at (0, -134).
  const HEAD = { y: -134, r: 33 };

  // Skin, hair and the shared face; no hood, no goggles.
  function bareHead(c, hero, bob, who) {
    const hy = HEAD.y + bob;
    const r = HEAD.r;
    const hair = { kid: '#7A4A33', heir: '#4A3640', hunter: '#3E3128' }[who];
    // Hair mass behind the face.
    c.fillStyle = hair;
    c.beginPath();
    c.ellipse(-4, hy - 4, r + 4, r + 2, 0, 0, Math.PI * 2);
    c.fill();
    if (who === 'heir') {
      // Hair tied up: a bun on top, a strand loose at the back.
      c.beginPath();
      c.arc(-8, hy - r - 10, 15, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(-30, hy + 10, 7, 20, 0.3, 0, Math.PI * 2);
      c.fill();
    }
    const face = c.createRadialGradient(6, hy - 6, 3, 2, hy + 2, r);
    face.addColorStop(0, S.shade(P.skin, 0.08));
    face.addColorStop(1, P.skinShade);
    c.fillStyle = face;
    c.beginPath();
    c.ellipse(4, hy + 4, r - 4, r - 6, 0, 0, Math.PI * 2);
    c.fill();
    // A fringe across the forehead.
    c.fillStyle = hair;
    c.beginPath();
    c.ellipse(2, hy - 18, r - 6, 11, -0.12, Math.PI, 0);
    c.fill();
    hero.drawFace(c, hy);
    if (who === 'kid') {
      // Peaked cap, worn the right way round.
      c.fillStyle = '#7A4A33';
      c.beginPath();
      c.ellipse(-2, hy - 20, r + 2, 18, 0, Math.PI, 0);
      c.fill();
      c.fillRect(-2, hy - 24, 58, 7);
    }
    if (who === 'hunter') {
      // Wide brim, low crown.
      c.fillStyle = '#2B2420';
      c.beginPath();
      c.ellipse(0, hy - 26, 54, 9, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(0, hy - 38, 30, 18, 0, Math.PI, 0);
      c.fill();
    }
  }

  const CLOTHES = {
    // A hoodie with the hood down and a front pocket.
    kid(c, bob) {
      c.fillStyle = '#5A524A';
      c.beginPath();
      c.ellipse(-10, -100 + bob, 30, 12, 0.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(40,30,20,0.6)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-14, -66 + bob);
      c.quadraticCurveTo(0, -60 + bob, 16, -66 + bob);
      c.stroke();
    },
    // A long cardigan, open over the front, with buttons down one side.
    heir(c, bob) {
      c.fillStyle = '#4F5A42';
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(side * 4, -108 + bob);
        c.lineTo(side * 26, -106 + bob);
        c.lineTo(side * 30, -34 + bob);
        c.lineTo(side * 6, -38 + bob);
        c.closePath();
        c.fill();
      }
      c.fillStyle = P.brass;
      for (const y of [-94, -80, -66, -52]) {
        c.beginPath();
        c.arc(-8, y + bob, 2.5, 0, Math.PI * 2);
        c.fill();
      }
    },
    // The coat's front panel, closed over the body.
    hunter(c) {
      longCoat(c, true);
    },
  };

  // What each of them carries in the front hand.
  const ACCESSORY = {
    // A torch, and the beam it throws.
    kid(c) {
      arm(c, 10, -90, 44, -80);
      c.fillStyle = P.gear;
      c.save();
      c.translate(44, -80);
      c.rotate(-0.25);
      c.fillRect(0, -6, 34, 12);
      c.fillStyle = P.brass;
      c.fillRect(30, -9, 8, 18);
      c.restore();
      c.strokeStyle = 'rgba(200,190,170,0.9)';
      c.lineWidth = 1.5;
      for (const k of [-1, 0, 1]) {
        c.beginPath();
        c.moveTo(84, -92 + k * 4);
        c.lineTo(120, -104 + k * 16);
        c.stroke();
      }
    },
    // A feather duster.
    heir(c) {
      arm(c, 10, -90, 40, -96);
      c.strokeStyle = P.oak;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(40, -96);
      c.lineTo(66, -150);
      c.stroke();
      c.fillStyle = P.linen;
      for (let i = 0; i < 7; i++) {
        c.beginPath();
        c.ellipse(66 + Math.cos(i) * 8, -160 + Math.sin(i * 1.7) * 8, 12, 5, i, 0, Math.PI * 2);
        c.fill();
      }
    },
    // An EMF reader with its little antenna.
    hunter(c) {
      arm(c, 10, -90, 46, -84);
      c.fillStyle = P.gear;
      c.fillRect(42, -100, 26, 34);
      c.fillStyle = '#C9B8A0';
      c.fillRect(46, -96, 18, 12);
      c.strokeStyle = P.gear;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(62, -100);
      c.lineTo(70, -126);
      c.stroke();
    },
  };

  function arm(c, x0, y0, x1, y1) {
    c.strokeStyle = P.jumpsuit;
    c.lineWidth = 12;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo((x0 + x1) / 2, y1 + 18, x1, y1);
    c.stroke();
  }

  // The Ghost Hunter's coat flares from the shoulders to below the knee.
  function longCoat(c, front) {
    c.fillStyle = front ? 'rgba(43,36,32,0.55)' : '#2B2420';
    c.beginPath();
    c.moveTo(-26, -112);
    c.lineTo(26, -112);
    c.lineTo(40, -14);
    c.lineTo(-38, -14);
    c.closePath();
    c.fill();
  }

  /*
   * Colour → pencil. Dark areas become graphite tone and hatching, edges
   * (where the outline or a colour change is) become firm lines, and a
   * second, slightly shifted pass of the lines gives the sketchy double
   * stroke of a quick drawing.
   */
  function pencil(g, colour, seed) {
    const w = colour.width;
    const h = colour.height;
    const src = colour.getContext('2d').getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    const alpha = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      alpha[i] = src[i * 4 + 3] / 255;
      lum[i] = (0.3 * src[i * 4] + 0.59 * src[i * 4 + 1] + 0.11 * src[i * 4 + 2]) / 255;
    }
    const lines = g.createImageData(w, h);
    const out = lines.data;
    const rng = S.createRng(seed);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : alpha[y * w + x]);
    const lumAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 1 : lum[y * w + x] * alpha[y * w + x] + (1 - alpha[y * w + x]));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        // Outline: inside, next to outside.
        const a = alpha[i];
        const edgeA = a > 0.5 && (at(x - 1, y) < 0.5 || at(x + 1, y) < 0.5 || at(x, y - 1) < 0.5 || at(x, y + 1) < 0.5) ? 1 : 0;
        // Interior lines: where brightness jumps (Sobel).
        const gx = lumAt(x + 1, y - 1) + 2 * lumAt(x + 1, y) + lumAt(x + 1, y + 1) - lumAt(x - 1, y - 1) - 2 * lumAt(x - 1, y) - lumAt(x - 1, y + 1);
        const gy = lumAt(x - 1, y + 1) + 2 * lumAt(x, y + 1) + lumAt(x + 1, y + 1) - lumAt(x - 1, y - 1) - 2 * lumAt(x, y - 1) - lumAt(x + 1, y - 1);
        const edgeL = S.clamp((Math.hypot(gx, gy) - 0.35) * 1.4, 0, 1) * a;
        // Tone: darker colour, more graphite; hatched on the diagonal.
        const dark = (1 - lum[i]) * a;
        const hatch = (x + y) % 6 < 1.4 ? 1 : 0;
        const tone = dark * 0.16 + (dark > 0.45 ? hatch * 0.32 * dark : 0);
        const ink = Math.max(edgeA * 0.92, edgeL * 0.7, tone * 0.85) * (0.82 + rng.next() * 0.36);
        out[i * 4] = 52;
        out[i * 4 + 1] = 48;
        out[i * 4 + 2] = 46;
        out[i * 4 + 3] = Math.round(S.clamp(ink, 0, 1) * 255);
      }
    }
    const layer = S.makeCanvas(w, h);
    layer.getContext('2d').putImageData(lines, 0, 0);
    g.clearRect(0, 0, w, h);
    g.globalAlpha = 0.95;
    g.drawImage(layer, 0, 0);
    g.globalAlpha = 0.38;
    g.drawImage(layer, 1.5, -1); // the second, quicker pass
    g.globalAlpha = 1;
  }
})();
