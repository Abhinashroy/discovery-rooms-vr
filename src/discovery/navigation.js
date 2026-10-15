import { TABLES, DISCOVERY } from './adventure.js';
export const BOUNDS = { minX: -6.65, maxX: 6.65, minZ: -6.5, maxZ: 6.5 };
export const OBSTACLES = [
  ...TABLES.map(({ x, z }) => ({ minX: x - 1.35, maxX: x + 1.35, minZ: z - 0.85, maxZ: z + 0.85 })),
  {
    minX: DISCOVERY.x - 0.8,
    maxX: DISCOVERY.x + 0.8,
    minZ: DISCOVERY.z - 0.55,
    maxZ: DISCOVERY.z + 0.55,
  },
];
export const approachPoint = (target) =>
  target.approach ?? {
    x: target.x,
    z: target.z + (TABLES.some((t) => t.id === target.id) ? 2.6 : 1.8),
  };
export function canStand(x, z) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x >= BOUNDS.minX &&
    x <= BOUNDS.maxX &&
    z >= BOUNDS.minZ &&
    z <= BOUNDS.maxZ &&
    !OBSTACLES.some((o) => x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ)
  );
}
export function movePlayer(position, dx, dz) {
  const p = { x: position.x, z: position.z },
    steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
  for (let i = 0; i < steps; i++) {
    if (canStand(p.x + dx / steps, p.z)) p.x += dx / steps;
    if (canStand(p.x, p.z + dz / steps)) p.z += dz / steps;
  }
  return p;
}
export function findPath(start, goal) {
  const snap = (p) => ({ x: Math.round(p.x * 2) / 2, z: Math.round(p.z * 2) / 2 }),
    key = (p) => `${p.x},${p.z}`;
  const from = snap(start),
    to = snap(goal);
  if (!canStand(from.x, from.z) || !canStand(to.x, to.z)) return [];
  const queue = [from],
    previous = new Map([[key(from), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (key(p) === key(to)) {
      const path = [];
      for (let n = p; n; n = previous.get(key(n))) path.unshift(n);
      return path;
    }
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const n = { x: p.x + dx, z: p.z + dz };
      if (canStand(n.x, n.z) && !previous.has(key(n))) {
        previous.set(key(n), p);
        queue.push(n);
      }
    }
  }
  return [];
}
