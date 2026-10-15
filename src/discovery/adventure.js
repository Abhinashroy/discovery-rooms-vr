// Authored Space Rescue slice. Layout stays stable across future adventures.
export const TABLES = [
  { id: 'cargo', title: 'Cargo launch', icon: '01', x: -4.5, z: -4, available: true },
  { id: 'solar', title: 'Solar neighborhood', icon: '02', x: 0, z: -4 },
  { id: 'globe', title: 'Day & night', icon: '03', x: 4.5, z: -4 },
  { id: 'moon', title: 'Moon observer', icon: '04', x: -4.5, z: 1.2 },
  { id: 'mission', title: 'Mission sequence', icon: '05', x: 0, z: 1.2 },
  { id: 'beacon', title: 'Beacon assembly', icon: '06', x: 4.5, z: 1.2 },
];
export const DISCOVERY = { id: 'drawer', title: 'Explorer drawer', x: -5.8, z: 4.2 };
export const TREASURE = {
  id: 'treasure',
  title: 'Constellation treasure',
  x: 0,
  z: 6.7,
  approach: { x: 0, z: 5.4 },
};
export const PROPS = [
  { id: 'satellite', title: 'Satellite viewer', x: 6.2, z: 4.2, approach: { x: 5.5, z: 5.5 } },
  { id: 'meteorite', title: 'Meteorite display', x: -6.3, z: -1.4, approach: { x: -6.3, z: 0.2 } },
];
export const DESTINATIONS = [...TABLES, DISCOVERY, TREASURE, ...PROPS];
export const SUPPLIES = [
  {
    id: 'water',
    name: 'Water',
    shape: 'circle',
    color: '#65d9dc',
    clue: 'Water belongs in the CIRCLE compartment.',
  },
  {
    id: 'food',
    name: 'Food',
    shape: 'triangle',
    color: '#ffc269',
    clue: 'Food belongs in the TRIANGLE compartment.',
  },
  {
    id: 'tools',
    name: 'Tools',
    shape: 'square',
    color: '#c2a6ff',
    clue: 'Tools belong in the SQUARE compartment.',
  },
];
export const TOKEN_NAMES = ['Star', 'Comet', 'Ringed planet'];
export const FOUND_OBJECTS = ['Crystal', 'Compass', 'Tiny rocket'];
export const CLUE =
  'Find the cargo table beneath the orange 01 sign. Match the supplies to their symbols to reveal a fragment.';
export function random(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = value;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(values, seed) {
  const result = [...values],
    next = random(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
