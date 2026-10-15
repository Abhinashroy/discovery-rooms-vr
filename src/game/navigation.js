import { LESSONS } from './lessons.js';

export const BOUNDS = { minX: -6.7, maxX: 6.7, minZ: -6.5, maxZ: 6.5 };
export const OBSTACLES = LESSONS.map(({ x, z }) => ({
  minX: x - 1.35,
  maxX: x + 1.35,
  minZ: z - 0.85,
  maxZ: z + 0.85,
}));
export function canStand(x, z) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x >= BOUNDS.minX &&
    x <= BOUNDS.maxX &&
    z >= BOUNDS.minZ &&
    z <= BOUNDS.maxZ &&
    !OBSTACLES.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)
  );
}
export function movePlayer(position, dx, dz) {
  const next = { x: position.x, z: position.z };
  // Small substeps prevent a large frame or diagonal step tunnelling through an exhibit.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
  for (let i = 0; i < steps; i++) {
    if (canStand(next.x + dx / steps, next.z)) next.x += dx / steps;
    if (canStand(next.x, next.z + dz / steps)) next.z += dz / steps;
  }
  return next;
}
export const approachPoint = (lesson) => ({ x: lesson.x, z: lesson.z + 1.8 });

// A small room grid is sufficient here; a navmesh would add little for six fixed rectangular exhibits.
export function findPath(start, goal) {
  const key = (p) => `${p.x},${p.z}`;
  const snap = (p) => ({ x: Math.round(p.x * 2) / 2, z: Math.round(p.z * 2) / 2 });
  const from = snap(start),
    to = snap(goal);
  if (!canStand(from.x, from.z) || !canStand(to.x, to.z)) return [];
  const queue = [from],
    previous = new Map([[key(from), null]]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (key(current) === key(to)) {
      const path = [];
      for (let node = current; node; node = previous.get(key(node))) path.unshift(node);
      return path;
    }
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const next = { x: current.x + dx, z: current.z + dz };
      if (canStand(next.x, next.z) && !previous.has(key(next))) {
        previous.set(key(next), current);
        queue.push(next);
      }
    }
  }
  return [];
}
