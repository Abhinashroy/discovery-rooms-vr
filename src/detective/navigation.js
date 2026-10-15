export const ROOM = { halfX: 8, halfZ: 7, height: 5.2 };
export const DESKS = [-3.2, 3.2].flatMap((x) => [-3.2, 0, 3.2].map((z) => ({ x, z })));
export const CUPBOARDS = [-6.5, 6.5].flatMap((x) => [-4.5, 0, 4.5].map((z) => ({ x, z })));
export const OBSTACLES = [
  ...DESKS.flatMap((p) => [
    { ...p, hx: 1.02, hz: 0.67 },
    { x: p.x, z: p.z + 1.12, hx: 0.48, hz: 0.43 },
  ]),
  ...CUPBOARDS.map((p) => ({ ...p, hx: 0.85, hz: 0.8 })),
  { x: 0, z: -5.3, hx: 1.6, hz: 0.72 },
];
export function canStand(x, z, extra = []) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) <= ROOM.halfX - 0.3 &&
    Math.abs(z) <= ROOM.halfZ - 0.3 &&
    ![...OBSTACLES, ...extra].some(
      (o) => Math.abs(x - o.x) < o.hx + 0.22 && Math.abs(z - o.z) < o.hz + 0.22,
    )
  );
}
export function movePlayer(p, dx, dz, extra = []) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  let { x, z } = p;
  for (let i = 0; i < steps; i++) {
    if (canStand(x + dx / steps, z, extra)) x += dx / steps;
    if (canStand(x, z + dz / steps, extra)) z += dz / steps;
  }
  return { x, z };
}
export const VIEWS = { back: { x: 0, z: 5.8 }, middle: { x: 0, z: 0 }, front: { x: 0, z: -3.6 } };
