// Approximate teaching model, not an ephemeris. All views use this one elapsed-time clock.
export const DAY = 86400000,
  TAU = Math.PI * 2,
  RAD = Math.PI / 180,
  EPOCH = Date.UTC(2000, 0, 1, 12);
export const YEAR_DAYS = 365.25636,
  MOON_DAYS = 27.321661,
  TILT = 23.4393 * RAD;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const scale = (a, k) => a.map((v) => v * k);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const unit = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
export function rotateY(a, t) {
  return [a[0] * Math.cos(t) + a[2] * Math.sin(t), a[1], -a[0] * Math.sin(t) + a[2] * Math.cos(t)];
}
export function rotateZ(a, t) {
  return [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t), a[2]];
}
export function geoVector(lat, lon) {
  return [
    Math.cos(lat * RAD) * Math.cos(lon * RAD),
    Math.sin(lat * RAD),
    -Math.cos(lat * RAD) * Math.sin(lon * RAD),
  ];
}
export function vectorGeo(v) {
  const n = unit(v);
  return { lat: Math.asin(clamp(n[1], -1, 1)) / RAD, lon: Math.atan2(-n[2], n[0]) / RAD };
}
export const leapYear = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
export const yearDays = (y) => (leapYear(y) ? 366 : 365);
export function clock(t) {
  const d = new Date(t),
    year = d.getUTCFullYear();
  return {
    year,
    day:
      Math.floor((Date.UTC(year, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(year, 0, 1)) / DAY) +
      1,
    days: yearDays(year),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    date: d.toISOString().slice(0, 10),
    time: d.toISOString().slice(11, 16),
  };
}
export function changeYear(t, y) {
  const d = new Date(t),
    month = d.getUTCMonth(),
    last = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
  return Date.UTC(y, month, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes());
}
export function changeDay(t, day) {
  const c = clock(t);
  return Date.UTC(c.year, 0, clamp(Math.round(day), 1, c.days), 0, c.minutes);
}
export function changeMinutes(t, minutes) {
  const c = clock(t);
  return Date.UTC(c.year, 0, c.day, 0, clamp(Math.round(minutes), 0, 1440));
}
function orbit(d) {
  const e = 0.0167,
    M = (TAU * (d - 1.5)) / YEAR_DAYS;
  let E = M;
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const a = 38,
    x = a * (Math.cos(E) - e),
    z = a * Math.sqrt(1 - e * e) * Math.sin(E),
    w = (-TAU * 169) / YEAR_DAYS;
  return [x * Math.cos(w) - z * Math.sin(w), 0, x * Math.sin(w) + z * Math.cos(w)];
}
const anchorSun = rotateZ(scale(orbit(0), -1), -TILT),
  SPIN_ANCHOR = Math.atan2(-anchorSun[2], anchorSun[0]);
export function modelAt(t) {
  const days = (t - EPOCH) / DAY,
    earth = orbit(days),
    spin = SPIN_ANCHOR + TAU * (1 + 1 / YEAR_DAYS) * days,
    angle = (TAU * days) / MOON_DAYS,
    inclination = 5.145 * RAD,
    moonOffset = [
      6 * Math.cos(angle),
      6 * Math.sin(angle) * Math.sin(inclination),
      6 * Math.sin(angle) * Math.cos(inclination),
    ],
    moon = add(earth, moonOffset),
    sunLocal = rotateY(rotateZ(unit(scale(earth, -1)), -TILT), -spin),
    moonLocal = rotateY(rotateZ(unit(moonOffset), -TILT), -spin),
    lit = (1 + dot(unit(scale(moonOffset, -1)), unit(scale(moon, -1)))) / 2;
  return { earth, moon, spin, tilt: TILT, sunLocal, moonLocal, lit: clamp(lit, 0, 1) };
}
export function sunlight(t, lat, lon) {
  const altitude = Math.asin(clamp(dot(geoVector(lat, lon), modelAt(t).sunLocal), -1, 1)) / RAD;
  return {
    altitude,
    label: altitude > 3 ? 'Day' : altitude < -3 ? 'Night' : 'Near sunrise / sunset',
  };
}
