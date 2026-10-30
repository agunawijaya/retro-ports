/*
 * Spyder — boot and routing.
 *
 * Loads the saved progress, shows the title over the dirty Living Room,
 * and moves the player between the screens:
 *
 *   title ──Continue / New game──► house map ──a room──► the room
 *     ▲                               ▲  │                 │
 *     └──────────── Esc ──────────────┘  └─── pause / results / fled ──┘
 *
 * Between a room and the map the picture fades through soot (400 ms), so
 * the change of place reads as a cut, not a glitch. Everything else — the
 * room loop, the cards, the map — lives in lib/.
 *
 * ?qa=1 freezes time and exposes window.__spyder for screenshots; see the
 * QA section at the bottom and tools/shoot.mjs.
 */
(function () {
  'use strict';

  const S = window.Spyder;
  const frameEl = document.getElementById('frame');
  const canvas = document.getElementById('stage');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The title is always the Living Room at night, with the hero in it.
  const TITLE_ROOM = 'living-room';
  const TITLE_POSE = { x: 820, facing: -1, aim: -2.05 };

  // ── The 1920 × 1080 stage, scaled to fit the window ─────────────────

  function fitStage() {
    const scale = Math.min(window.innerWidth / S.STAGE.width, window.innerHeight / S.STAGE.height);
    frameEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
    frameEl.dataset.scale = scale;
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  // ── The pieces ─────────────────────────────────────────────────────

  const progress = S.progress;
  progress.load();
  const settings = progress.settings; // one live object; everything reads it

  const audio = new S.Audio();
  audio.setVolumes(settings.volume);
  const hud = new S.Hud(document.getElementById('hud'));

  const runtime = S.createRoomRuntime({ canvas, hud, audio, settings, frameEl, onEvent: onRoomEvent });
  const screens = S.createScreens({ hud, progress, audio, onAction, onSettingsChanged });
  const map = S.createHouseMap({
    canvas,
    settings,
    sheetEl: document.querySelector('[data-map-sheet]'),
    hintEl: document.querySelector('[data-map-hint]'),
    onEnter: (id) => enterRoom(id),
  });

  let scene = 'room'; // what draws the canvas: the 'room' runtime or the 'map' desk
  let busy = false; // a fade is running: ignore buttons until it is done
  let booted = false;

  // Browsers only allow sound after a gesture; the first click or key starts it.
  const unlockAudio = () => {
    audio.start();
    audio.setVolumes(settings.volume);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
  window.addEventListener('keydown', unlockAudio, { once: true, capture: true });

  // ── Loop ───────────────────────────────────────────────────────────

  let previous = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    if (scene === 'map') map.frame(dt);
    else runtime.frame(dt);
    requestAnimationFrame(loop);
  }

  // ── Fading through soot ────────────────────────────────────────────

  const veil = document.querySelector('[data-veil]');
  const veilNote = document.querySelector('[data-veil-note]');
  const FADE = reducedMotion ? 0 : 200; // each way: 400 ms in all
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function throughSoot(work, note = '') {
    if (busy) return;
    busy = true;
    veil.classList.add('is-down');
    try {
      await wait(FADE);
      // Painting a room can take a moment; say what is happening if it does.
      const slow = setTimeout(() => (veilNote.textContent = note), 250);
      try {
        await work();
      } finally {
        clearTimeout(slow);
        veilNote.textContent = '';
      }
    } catch (err) {
      console.error(err);
    } finally {
      veil.classList.remove('is-down');
      await wait(FADE);
      busy = false;
    }
  }

  // ── Where the player can go ────────────────────────────────────────

  function showTitle() {
    return throughSoot(async () => {
      if (runtime.room?.id !== TITLE_ROOM) await runtime.load(TITLE_ROOM);
      scene = 'room';
      runtime.showTitle(TITLE_POSE);
      screens.show('title');
    });
  }

  function goToMap() {
    return throughSoot(async () => {
      runtime.leave();
      await map.ready();
      map.build(progress);
      scene = 'map';
      screens.show('map');
      map.focusDefault();
    }, 'Unfolding the plan…');
  }

  function enterRoom(id) {
    const room = S.rooms.get(id);
    if (!room) return Promise.resolve();
    return throughSoot(async () => {
      screens.show(null);
      scene = 'room';
      await runtime.load(id);
      runtime.begin();
    }, `Opening the ${room.name}…`);
  }

  function startNewGame() {
    progress.reset();
    goToMap();
  }

  // After a room is restored: where can the player go next?
  function nextAfter(room) {
    const open = S.rooms.nextRoom(progress);
    if (open && open.id !== room.id) return { id: open.id, name: open.name, playable: true };
    const after = S.rooms.after(room.id, progress);
    if (after && !S.rooms.exists(after.id)) return { id: after.id, name: after.name, playable: false };
    return null;
  }

  // ── What the room tells us ─────────────────────────────────────────

  function onRoomEvent(name, payload) {
    switch (name) {
      case 'paused':
        screens.show('pause');
        break;
      case 'resumed':
      case 'restarted':
        screens.show(null);
        break;
      case 'restored':
        screens.fillResults({ room: payload.room, stats: payload.stats, unlockedWeapon: payload.unlockedWeapon, next: nextAfter(payload.room) });
        screens.show('results');
        break;
      case 'fled':
        screens.show('fled');
        break;
      case 'muted':
        screens.setMuted(payload);
        break;
    }
  }

  // ── What the buttons ask for ───────────────────────────────────────

  function onAction(name, button) {
    if (busy) return;
    switch (name) {
      case 'continue':
        goToMap();
        break;
      case 'new-game':
        if (progress.hasSave()) screens.confirmNewGame(true);
        else startNewGame();
        break;
      case 'confirm-new':
        startNewGame();
        break;
      case 'cancel-new':
        screens.confirmNewGame(false);
        screens.firstTitleButton()?.focus();
        break;
      case 'settings':
      case 'howto':
        screens.show(name);
        break;
      case 'back': // from settings or how to play
        screens.show('title');
        break;
      case 'title': // from the map
        showTitle();
        break;
      case 'pause':
      case 'resume':
        runtime.togglePause();
        break;
      case 'restart':
        runtime.restart();
        break;
      case 'map':
        goToMap();
        break;
      case 'mute':
        screens.setMuted(audio.toggleMute());
        break;
      case 'next-room':
        enterRoom(button.dataset.room);
        break;
    }
  }

  function onSettingsChanged(next) {
    audio.setVolumes(next.volume);
    runtime.applySettings(next);
  }

  // ── Keyboard for the screens (the room handles its own keys) ────────

  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  window.addEventListener('keydown', (e) => {
    if (busy) return;
    const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    switch (screens.current) {
      case 'title':
        // Enter means the first button, wherever the focus is.
        if (e.key === 'Enter' && !onButton) {
          e.preventDefault();
          screens.firstTitleButton()?.click();
        }
        if (e.key === 'Escape') screens.confirmNewGame(false);
        break;
      case 'settings':
      case 'howto':
        if (e.key === 'Escape') {
          e.preventDefault();
          screens.show('title');
        }
        break;
      case 'map':
        if (e.key === 'Escape') {
          e.preventDefault();
          showTitle();
        } else if (ARROWS[e.key]) {
          e.preventDefault();
          map.moveFocus(...ARROWS[e.key]);
        }
        break;
      case 'results':
        if (e.key === 'n' || e.key === 'N') {
          const next = document.querySelector('[data-action="next-room"]');
          if (!next.hidden) next.click();
        }
        break;
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────

  screens.show('title');
  screens.setReady(false);
  runtime
    .load(TITLE_ROOM)
    .then(() => {
      runtime.showTitle(TITLE_POSE);
      screens.setReady(true);
      screens.firstTitleButton()?.focus({ preventScroll: true });
      booted = true;
    })
    .catch((err) => console.error(err));
  requestAnimationFrame(loop);

  // ── QA hooks (only with ?qa=1) ─────────────────────────────────────

  if (runtime.qa.enabled) {
    document.body.classList.add('is-qa');
    const qaRoom = new URLSearchParams(location.search).get('room') || TITLE_ROOM;

    const ensureRoom = async (id) => {
      if (runtime.room?.id !== id) await runtime.load(id);
    };

    window.__spyder = {
      get ready() {
        return booted;
      },
      get state() {
        return runtime.state;
      },
      get screen() {
        return screens.current;
      },
      /*
       * Stage a state with time frozen:
       *   room:    'dirty' | 'action' | 'makeover' | 'clean' | 'results'
       *            | 'pause' | 'fled' | any state the room defines in qa.states
       *   screens: 'title' | 'title-saved' | 'map' | 'map-cleared' | 'settings' | 'howto'
       */
      async setup(name) {
        if (name === 'title' || name === 'title-saved' || name === 'settings' || name === 'howto') {
          await ensureRoom(TITLE_ROOM);
          scene = 'room';
          runtime.qa.title(TITLE_POSE);
          // 'title-saved': the letter as a returning player sees it (in memory only).
          if (name === 'title-saved' && !progress.hasSave()) progress.data.lastRoom = TITLE_ROOM;
          screens.show(name === 'title-saved' ? 'title' : name);
          if (name === 'title') screens.firstTitleButton()?.focus({ preventScroll: true });
          return;
        }
        if (name === 'map' || name === 'map-cleared') {
          runtime.leave();
          runtime.qa.freeze();
          await map.ready();
          // 'map-cleared': the plan after the Living Room, shown from memory
          // only — nothing is written to the player's save.
          const view = name === 'map' ? progress : {
            ...progress,
            isCleared: (id) => id === 'living-room' || progress.isCleared(id),
            isFound: (id) => progress.isFound(id),
            record: (id) => (id === 'living-room' ? { best: 18740, bestCombo: 5, untouched: false, time: 154 } : progress.record(id)),
          };
          map.build(view);
          scene = 'map';
          screens.show('map');
          map.focusDefault();
          map.render();
          return;
        }
        await ensureRoom(qaRoom);
        scene = 'room';
        screens.show(null);
        if (name === 'pause' || name === 'fled') {
          runtime.qa.setup('dirty');
          if (name === 'pause') runtime.togglePause();
          else screens.show('fled');
          return;
        }
        runtime.qa.setup(name);
      },
      // What is in the room right now (for flow tests and timing).
      get world() {
        const w = runtime.world;
        return { time: w.time, critters: w.critters.length, kills: w.stats.kills, quota: w.rules.quota, score: w.stats.score };
      },
      get isBlockout() {
        return Boolean(runtime.world.isBlockout);
      },
      // Average milliseconds for one update + render, over `frames` frames.
      timeFrames(frames = 240) {
        const t0 = performance.now();
        runtime.qa.step(0); // warm the caches
        const start = performance.now();
        for (let i = 0; i < frames; i++) runtime.qa.step(1 / 60);
        return { msPerFrame: (performance.now() - start) / frames, warmup: start - t0 };
      },
      // Hurt the hero through the normal rules (gauge, combo, fleeing).
      hurt: (amount) => runtime.world.hurtHero(amount),
      // Put a critter in the room (e.g. spawn('egg', { x, y, mode: 'wall' })).
      // Returns the entity, so a script can set its age before stepping.
      spawn: (kind, opts) => runtime.world.spawn(kind, opts),
      step: (seconds) => runtime.qa.step(seconds),
      clearRoom: () => runtime.qa.clearRoom(),
      bossTo: (fraction) => runtime.qa.bossTo(fraction),
      bossPhase: (id) => runtime.qa.bossPhase(id),
      get boss() {
        return runtime.world?.boss;
      },
      get liveWorld() {
        return runtime.world;
      },
      play: () => runtime.qa.play(),
      // For flow tests: the real transitions, with their fades.
      enterRoom,
      goToMap,
      showTitle,
      progress,
    };
  }
})();
