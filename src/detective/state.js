import { chooseDestination, radius } from './placements.js';
export const ITEMS = Object.freeze({
  chalk: { name: 'Chalk', kind: 'chalk', home: [-1.4, 1.24, -6.5], place: 'board tray' },
  eraser: { name: 'Board eraser', kind: 'eraser', home: [1.4, 1.24, -6.5], place: 'board tray' },
  bag: { name: 'School bag', kind: 'bag', home: [7.6, 1.2, 4.8, -90], place: 'right wall hook' },
  bottle: {
    name: 'Water bottle',
    kind: 'bottle',
    home: [-3.2, 1.06, 3.2],
    place: 'left back desk',
  },
  books: { name: 'Books', kind: 'books', home: [-3.2, 1.06, 0], place: 'left middle desk' },
  globe: { name: 'Globe', kind: 'globe', home: [-3.2, 1.06, -3.2], place: 'left front desk' },
  ruler: { name: 'Ruler', kind: 'ruler', home: [-6.5, 1.12, 0], place: 'left cupboard' },
  pencils: { name: 'Pencil box', kind: 'pencils', home: [6.5, 1.12, 0], place: 'right cupboard' },
  plant: { name: 'Potted plant', kind: 'plant', home: [-6.5, 1.12, -4.5], place: 'front cupboard' },
  bin: { name: 'Dustbin', kind: 'bin', home: [-5.3, 0, 2.3], place: 'left aisle' },
  clock: { name: 'Wall clock', kind: 'clock', home: [-5, 2.7, -6.78], place: 'front wall, left' },
  fan: { name: 'Ceiling fan', kind: 'fan', home: [0, 4.55, -2.2], place: 'front ceiling mount' },
  poster: {
    name: 'Class poster',
    kind: 'poster',
    home: [-2.5, 2.5, 6.78, 180],
    place: 'back wall, left',
  },
});
export const OBJECTS = Object.freeze(
  Object.fromEntries(Object.entries(ITEMS).map(([id, d]) => [id, d.name])),
);
export const SLOTS = Object.freeze(
  Object.fromEntries(
    Object.entries(ITEMS).map(([id, d]) => [
      'home:' + id,
      { x: d.home[0], y: d.home[1], z: d.home[2], yaw: d.home[3] || 0, radius: radius(d.kind) },
    ]),
  ),
);
export const BASELINE = Object.freeze(
  Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 'home:' + id])),
);
export const CHANGE_COUNT = 4;
export function newCase(seed = Date.now(), previous = {}) {
  let n = Number(seed) >>> 0 || 1;
  const random = () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ids = Object.keys(ITEMS);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const moved = ids.slice(0, CHANGE_COUNT),
    slots = { ...SLOTS },
    changed = { ...BASELINE },
    reserved = Object.values(SLOTS);
  for (const id of moved) {
    const key = 'moved:' + id;
    slots[key] = chooseDestination(ITEMS[id].kind, random, reserved, undefined, previous[id]);
    reserved.push(slots[key]);
    changed[id] = key;
  }
  return {
    seed: Number(seed) >>> 0,
    phase: 'intro',
    changed,
    slots,
    moved,
    lastDestinations: {
      ...previous,
      ...Object.fromEntries(moved.map((id) => [id, slots[changed[id]]])),
    },
    layout: { ...BASELINE },
    found: [],
    attempts: [],
    message: '',
  };
}
export function reduceCase(s, a) {
  if (a.type === 'restart')
    return {
      ...newCase(a.seed, s.lastDestinations),
      phase: 'study',
      message: 'Explore and remember the classroom. Choose Ready when you want to begin.',
    };
  if (a.type === 'start' && s.phase === 'intro')
    return { ...s, phase: 'study', message: 'Explore and remember the classroom. Take your time.' };
  if (a.type === 'ready' && s.phase === 'study') {
    let slots = s.slots;
    const p = slots[s.changed.bin];
    if (s.moved.includes('bin') && a.player && Math.hypot(p.x - a.player.x, p.z - a.player.z) < 1) {
      let n = s.seed;
      const random = () => {
        n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
        return n / 4294967296;
      };
      const reserved = Object.entries(slots)
        .filter(([key]) => key !== 'moved:bin')
        .map(([, v]) => v);
      slots = {
        ...slots,
        'moved:bin': chooseDestination('bin', random, reserved, a.player, s.lastDestinations.bin),
      };
    }
    return {
      ...s,
      slots,
      lastDestinations: {
        ...s.lastDestinations,
        ...(s.moved.includes('bin') ? { bin: slots[s.changed.bin] } : {}),
      },
      phase: 'change',
      message: 'The classroom is changing…',
    };
  }
  if (a.type === 'changed' && s.phase === 'change')
    return {
      ...s,
      phase: 'find',
      layout: { ...s.changed },
      message: 'Four things moved. Find them and click to send them home.',
    };
  if (a.type !== 'guess' || !Object.hasOwn(ITEMS, a.id)) return s;
  const id = a.id,
    name = ITEMS[id].name;
  if (s.phase === 'study') return { ...s, message: `${name} · ${ITEMS[id].place}.` };
  if (s.found.includes(id)) return { ...s, message: `${name} is already back home.` };
  if (s.phase !== 'find') return s;
  if (!s.moved.includes(id))
    return {
      ...s,
      attempts: [...s.attempts, { id, correct: false }],
      message: 'This has not moved. Keep exploring.',
    };
  const found = [...s.found, id];
  return {
    ...s,
    phase: found.length === CHANGE_COUNT ? 'complete' : 'find',
    found,
    layout: { ...s.layout, [id]: BASELINE[id] },
    attempts: [...s.attempts, { id, correct: true }],
    message: `Yay! ${name} is back home.${found.length === CHANGE_COUNT ? ' You found all four changes!' : ''}`,
  };
}
