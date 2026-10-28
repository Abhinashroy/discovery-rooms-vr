import {
  RAD,
  TAU,
  geoVector,
  vectorGeo,
  unit,
  dot,
  cross,
  scale,
  add,
  clamp,
} from './astronomy.js';
// Larger traveller relative to Earth: smaller globe + lift above the tracked eye.
export const GLOBE_RADIUS = 10;
export const GLOBE_EYE_LIFT = 1.5;
// Respect the headset's tracked standing/seated eye height; no artificial VR lift.
export const globeEyeLift = (immersive) => (immersive ? 0 : GLOBE_EYE_LIFT);
export function surfaceFrame(location) {
  const normal = geoVector(location.lat, location.lon),
    candidate = location.north || [
      -Math.sin(location.lat * RAD) * Math.cos(location.lon * RAD),
      Math.cos(location.lat * RAD),
      Math.sin(location.lat * RAD) * Math.sin(location.lon * RAD),
    ],
    north = unit(add(candidate, scale(normal, -dot(candidate, normal)))),
    east = unit(cross(north, normal));
  return { normal, north, east };
}
export function moveSurface(location, eastMetres, northMetres) {
  const distance = Math.hypot(eastMetres, northMetres);
  if (!Number.isFinite(distance) || distance === 0) return location;
  const f = surfaceFrame(location),
    tangent = unit(add(scale(f.east, eastMetres), scale(f.north, northMetres))),
    angle = distance / GLOBE_RADIUS,
    normal = add(scale(f.normal, Math.cos(angle)), scale(tangent, Math.sin(angle))),
    axis = unit(cross(f.normal, tangent));
  const north = add(
    add(scale(f.north, Math.cos(angle)), scale(cross(axis, f.north), Math.sin(angle))),
    scale(axis, dot(axis, f.north) * (1 - Math.cos(angle))),
  );
  return { ...vectorGeo(normal), north: unit(north) };
}
export function unwrapRing(ring, reference = ring[0]?.[0] || 0) {
  let last = reference;
  return ring.map(([lon, lat]) => {
    while (lon - last > 180) lon -= 360;
    while (lon - last < -180) lon += 360;
    last = lon;
    return [lon, lat];
  });
}
const ringCache = new WeakMap();
function inRing(lon, lat, ring) {
  let cached = ringCache.get(ring);
  if (!cached) {
    const points = unwrapRing(ring);
    if (!points.length) return false;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    cached = { points, minX, maxX, minY, maxY, centre: (minX + maxX) / 2 };
    ringCache.set(ring, cached);
  }
  const { points, minX, maxX, minY, maxY, centre } = cached;
  while (lon - centre > 180) lon -= 360;
  while (lon - centre < -180) lon += 360;
  if (lon < minX || lon > maxX || lat < minY || lat > maxY) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [x, y] = points[i],
      [a, b] = points[j];
    if (y > lat !== b > lat && lon < ((a - x) * (lat - y)) / (b - y) + x) inside = !inside;
  }
  return inside;
}
export function contains(feature, lon, lat) {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  return polygons.some(
    (rings) => inRing(lon, lat, rings[0]) && !rings.slice(1).some((r) => inRing(lon, lat, r)),
  );
}
export const countryAt = (features, lat, lon) =>
  features.find((f) => contains(f, lon, lat)) || null;
export function distanceDegrees(a, b) {
  return Math.acos(clamp(dot(geoVector(a.lat, a.lon), geoVector(b.lat, b.lon)), -1, 1)) / RAD;
}
