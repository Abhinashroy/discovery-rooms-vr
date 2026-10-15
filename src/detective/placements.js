import { ROOM, DESKS, CUPBOARDS, canStand, VIEWS } from './navigation.js';

// Destinations are sampled on real furniture, floor, wall and ceiling surfaces.
export const SURFACES = Object.freeze([
  ...DESKS.map((p, i) => ({
    id: 'desk:' + i,
    type: 'table',
    x: p.x,
    z: p.z,
    y: 1.06,
    hx: 0.28,
    hz: 0.16,
  })),
  ...CUPBOARDS.map((p, i) => ({
    id: 'cupboard:' + i,
    type: 'table',
    x: p.x,
    z: p.z,
    y: 1.12,
    hx: 0.23,
    hz: 0.28,
  })),
  { id: 'teacher', type: 'table', x: 0, z: -5.3, y: 1.14, hx: 0.95, hz: 0.16 },
]);
export const WALLS = Object.freeze([
  { id: 'front-left', axis: 'x', fixed: -6.78, lo: -6.6, hi: -3.8, yaw: 0 },
  { id: 'front-right', axis: 'x', fixed: -6.78, lo: 3.8, hi: 6.6, yaw: 0 },
  { id: 'back-left', axis: 'x', fixed: 6.78, lo: -6.6, hi: -2.2, yaw: 180 },
  { id: 'back-right', axis: 'x', fixed: 6.78, lo: 2.2, hi: 6.6, yaw: 180 },
  ...[-7.78, 7.78].flatMap((x) => [
    { id: 'side:' + x + ':front', axis: 'z', fixed: x, lo: -5.9, hi: -4.6, yaw: x < 0 ? 90 : -90 },
    { id: 'side:' + x + ':back', axis: 'z', fixed: x, lo: 4.5, hi: 6, yaw: x < 0 ? 90 : -90 },
  ]),
]);
export function radius(kind) {
  return kind === 'fan' ? 1.3 : kind === 'poster' ? 0.72 : kind === 'clock' ? 0.48 : 0.43;
}
export function compatible(kind, type) {
  return kind === 'fan'
    ? type === 'ceiling'
    : ['clock', 'poster'].includes(kind)
      ? type === 'wall'
      : kind === 'bin'
        ? type === 'floor'
        : type === 'table';
}
export function separated(a, b) {
  const dx = a.x - b.x,
    dy = a.y - b.y,
    dz = a.z - b.z;
  return Math.hypot(dx, dy, dz) >= a.radius + b.radius + 0.15;
}
export function validPlacement(p, kind) {
  if (!compatible(kind, p.type) || ![p.x, p.y, p.z, p.yaw].every(Number.isFinite)) return false;
  if (p.type === 'table') {
    const s = SURFACES.find((s) => s.id === p.surface);
    return (
      Boolean(s) &&
      Math.abs(p.y - s.y) < 0.001 &&
      Math.abs(p.x - s.x) <= s.hx + 0.001 &&
      Math.abs(p.z - s.z) <= s.hz + 0.001
    );
  }
  if (p.type === 'floor')
    return (
      p.y === 0 &&
      Object.values(VIEWS).every((v) => Math.hypot(p.x - v.x, p.z - v.z) >= 1) &&
      Math.abs(p.x) < ROOM.halfX - 0.8 &&
      Math.abs(p.z) < ROOM.halfZ - 0.8 &&
      [-0.2, 0.2].every((dx) => [-0.2, 0.2].every((dz) => canStand(p.x + dx, p.z + dz)))
    );
  if (p.type === 'ceiling') {
    const clearLights = [-3.2, 3.2].every((x) =>
      [-3.2, 3.2].every((z) => Math.abs(p.x - x) > 1.15 || Math.abs(p.z - z) > 0.5),
    );
    return p.y === 4.55 && Math.abs(p.x) <= 5.5 && Math.abs(p.z) <= 4.5 && clearLights;
  }
  const w = WALLS.find((w) => w.id === p.surface);
  return (
    Boolean(w) &&
    p.y >= 2.15 &&
    p.y <= 3.75 &&
    p.yaw === w.yaw &&
    (w.axis === 'x'
      ? Math.abs(p.z - w.fixed) < 0.001 && p.x >= w.lo && p.x <= w.hi
      : Math.abs(p.x - w.fixed) < 0.001 && p.z >= w.lo && p.z <= w.hi)
  );
}
export function chooseDestination(kind, random, reserved, player, previous) {
  const between = (lo, hi) => lo + (hi - lo) * random();
  for (let tries = 0; tries < 3000; tries++) {
    let p;
    if (kind === 'fan')
      p = {
        x: between(-5.5, 5.5),
        y: 4.55,
        z: between(-4.5, 4.5),
        yaw: 0,
        type: 'ceiling',
        surface: 'ceiling',
      };
    else if (['clock', 'poster'].includes(kind)) {
      const w = WALLS[Math.floor(random() * WALLS.length)],
        v = between(w.lo, w.hi);
      p = {
        x: w.axis === 'x' ? v : w.fixed,
        y: between(2.15, 3.75),
        z: w.axis === 'x' ? w.fixed : v,
        yaw: w.yaw,
        type: 'wall',
        surface: w.id,
      };
    } else if (kind === 'bin')
      p = {
        x: between(-7.1, 7.1),
        y: 0,
        z: between(-6.1, 6.1),
        yaw: 0,
        type: 'floor',
        surface: 'floor',
      };
    else {
      const s = SURFACES[Math.floor(random() * SURFACES.length)];
      p = {
        x: between(s.x - s.hx, s.x + s.hx),
        y: s.y,
        z: between(s.z - s.hz, s.z + s.hz),
        yaw: 0,
        type: 'table',
        surface: s.id,
      };
    }
    p.radius = radius(kind);
    const repeats =
      previous &&
      (p.type === 'table' || p.type === 'wall'
        ? p.surface === previous.surface
        : Math.hypot(p.x - previous.x, p.z - previous.z) < 1.5);
    if (
      !repeats &&
      validPlacement(p, kind) &&
      reserved.every((old) => separated(p, old)) &&
      !(p.type === 'floor' && player && Math.hypot(p.x - player.x, p.z - player.z) < 1)
    )
      return p;
  }
  throw new Error('No safe destination found for ' + kind);
}
