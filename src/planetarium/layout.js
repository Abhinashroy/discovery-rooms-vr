import { PLANETS, BY_ID, displayDiameter } from './content.js';
export const HALL = { halfX: 24, halfZ: 20, height: 26 };
export const SUN = { x: 0, y: 12, z: -8, radius: 10 };
export const FOOTPRINTS = [
  { x: 0, z: -8, radius: 10.6 },
  ...PLANETS.map((p) => ({
    x: p.x,
    z: p.z,
    radius: Math.max(
      0.65,
      p.diameter / 2 + 0.22,
      p.ringKm ? displayDiameter(p.ringKm[1]) + 0.12 : 0,
    ),
  })),
];
export function canStand(x, z) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) <= 23.6 &&
    Math.abs(z) <= 19.6 &&
    FOOTPRINTS.every((p) => Math.hypot(x - p.x, z - p.z) >= p.radius + 0.3)
  );
}
export function movePlayer(p, dx, dz) {
  let { x, z } = p;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
  for (let i = 0; i < n; i++) {
    if (canStand(x + dx / n, z)) x += dx / n;
    if (canStand(x, z + dz / n)) z += dz / n;
  }
  return { x, z };
}
export const VIEWS = {
  entrance: { x: 0, z: 17 },
  ...Object.fromEntries(
    PLANETS.map((p) => [p.id, { x: p.x, z: p.z + (p.id === 'saturn' ? 4 : 2.8) }]),
  ),
};

// Inner close-ups fit within their existing stand footprint; outer planets keep their exhibit size.
export function inspectionPlacement(id) {
  const p = BY_ID[id];
  if (!p) return null;
  const radius = p.order <= 4 ? 0.55 : p.diameter / 2;
  return { x: p.x, y: Math.max(1.45, radius + 1.05), z: p.z, radius, magnified: p.order <= 4 };
}
