/*
 * Spyder — the rooms of the house.
 *
 * Two lists live here:
 *
 *   HOUSE     every room the game will ever have, in house order (DESIGN.md
 *             §5), with the floor it is on. The house map draws from this,
 *             so rooms that are not built yet still appear — in pencil,
 *             marked "coming soon".
 *   registry  the rooms that actually exist. A room file calls
 *             S.rooms.register({...}) when its <script> loads; nothing else
 *             has to be told about it.
 *
 * Unlocking is linear over the rooms that exist: a room opens once every
 * built room before it in house order is clean. Rooms that are not built
 * yet are skipped, so the game is always playable from the first room that
 * exists. Cleared rooms can always be replayed.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  const HOUSE = [
    { number: 1, id: 'front-porch', name: 'Front Porch', floor: 'ground', act: 1 },
    { number: 2, id: 'living-room', name: 'Living Room', floor: 'ground', act: 1 },
    { number: 3, id: 'family-room', name: 'Family Room', floor: 'ground', act: 1 },
    { number: 4, id: 'kitchen', name: 'Kitchen', floor: 'ground', act: 1 },
    { number: 5, id: 'dining-room', name: 'Dining Room', floor: 'ground', act: 1 },
    { number: 6, id: 'downstairs-bathroom', name: 'Downstairs Bathroom', floor: 'ground', act: 2 },
    { number: 7, id: 'upstairs-hallway', name: 'Upstairs Hallway', floor: 'upstairs', act: 2 },
    { number: 8, id: 'master-bedroom', name: 'Master Bedroom', floor: 'upstairs', act: 2 },
    { number: 9, id: 'kids-bedroom', name: "Kid's Bedroom", floor: 'upstairs', act: 2 },
    { number: 10, id: 'study', name: 'Study', floor: 'upstairs', act: 3 },
    { number: 11, id: 'upstairs-bathroom', name: 'Upstairs Bathroom', floor: 'upstairs', act: 3 },
    { number: 12, id: 'attic', name: 'Attic', floor: 'attic', act: 3 },
    // Secret rooms: not drawn on the map until something unlocks them.
    { number: 13, id: 'basement', name: 'Basement', floor: 'basement', act: 4, secret: true },
    { number: 14, id: 'greenhouse', name: 'Greenhouse', floor: 'ground', act: 4, secret: true },
    { number: 15, id: 'the-wall', name: 'The Wall', floor: 'attic', act: 4, secret: true },
  ];

  const registry = new Map();
  const artRegistry = new Map();

  function attachCss(room) {
    if (!room.css || typeof document === 'undefined') return Promise.resolve();
    const existing = document.querySelector(`link[data-room-css="${room.id}"]`);
    if (existing) return room._cssReady || Promise.resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = room.css;
    link.dataset.roomCss = room.id;
    room._cssReady = new Promise((resolve) => {
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => resolve(), { once: true });
    });
    document.head.appendChild(link);
    return room._cssReady;
  }

  function attachArtScript(room) {
    if (!room.art || typeof document === 'undefined') return Promise.resolve();
    if (typeof room.art === 'object' && room._artAttached) return Promise.resolve(room.art);
    const existing = document.querySelector(`script[data-room-art="${room.id}"]`);
    if (existing) return room._artReady || Promise.resolve();
    const script = document.createElement('script');
    script.src = `rooms/${room.id}/art.js`;
    script.dataset.roomArt = room.id;
    room._artReady = new Promise((resolve) => {
      script.addEventListener('load', () => {
        const art = artRegistry.get(room.id);
        if (art) {
          room.art = art;
          room._artAttached = true;
          Object.assign(room, art);
        }
        resolve(art || null);
      }, { once: true });
      script.addEventListener('error', () => resolve(null), { once: true });
    });
    document.head.appendChild(script);
    return room._artReady;
  }

  function attachArt(id, art) {
    artRegistry.set(id, art);
    const room = registry.get(id);
    if (room) {
      room.art = art;
      room._artAttached = true;
      Object.assign(room, art);
    }
    return art;
  }

  function register(room) {
    const plan = HOUSE.find((h) => h.id === room.id);
    if (!plan) throw new Error(`Room "${room.id}" is not in the house plan (room-registry.js).`);
    if (room.number !== plan.number) {
      throw new Error(`Room "${room.id}" says it is number ${room.number}; the house plan says ${plan.number}.`);
    }
    attachCss(room);
    if (artRegistry.has(room.id)) {
      const art = artRegistry.get(room.id);
      room.art = art;
      room._artAttached = true;
      Object.assign(room, art);
    } else if (room.art === true) {
      attachArtScript(room);
    }
    registry.set(room.id, room);
    return room;
  }

  const get = (id) => registry.get(id) || null;
  const exists = (id) => registry.has(id);

  // Built rooms in house order.
  const built = () => HOUSE.filter((h) => registry.has(h.id)).map((h) => registry.get(h.id));

  // "The Kitchen", "The Living Room" — but "The Wall" stays "The Wall".
  function titleOf(room) {
    if (room.title) return room.title;
    return /^the /i.test(room.name) ? room.name : `The ${room.name}`;
  }

  /*
   * Where a room stands for the player. `progress` is S.progress.
   *   'cleared'      clean, can be replayed
   *   'open'         the next room to clean
   *   'locked'       built, but an earlier built room is still dirty
   *   'coming-soon'  not built yet
   *   'secret'       a secret room that has not been found
   */
  function statusOf(id, progress) {
    const plan = HOUSE.find((h) => h.id === id);
    if (!plan) return 'coming-soon';
    if (plan.secret && !progress.isFound(id)) return 'secret';
    if (!registry.has(id)) return 'coming-soon';
    if (progress.isCleared(id)) return 'cleared';
    for (const room of built()) {
      if (room.id === id) return 'open';
      const earlier = HOUSE.find((h) => h.id === room.id);
      if (earlier.secret) continue; // secrets never block the main house
      if (!progress.isCleared(room.id)) return 'locked';
    }
    return 'locked';
  }

  // The first built, uncleared, non-secret room in house order.
  function nextRoom(progress) {
    for (const room of built()) {
      if (statusOf(room.id, progress) === 'open') return room;
    }
    return null;
  }

  // The room after this one in house order, built or not (for "Next room").
  // A secret room is only a candidate once it has been found — otherwise
  // naming it on the results card would give it away (same check as
  // statusOf's 'secret' case, above).
  function after(id, progress) {
    const i = HOUSE.findIndex((h) => h.id === id);
    if (i < 0) return null;
    return HOUSE.slice(i + 1).find((h) => !h.secret || (progress && progress.isFound(h.id))) || null;
  }

  const rooms = S.rooms || {};
  Object.assign(rooms, { HOUSE, register, attachArt, get, exists, built, titleOf, statusOf, nextRoom, after });
  S.rooms = rooms;
})();
