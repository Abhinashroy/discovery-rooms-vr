import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DAY,
  EPOCH,
  YEAR_DAYS,
  MOON_DAYS,
  geoVector,
  vectorGeo,
  dot,
  clock,
  changeYear,
  changeDay,
  changeMinutes,
  yearDays,
  modelAt,
  sunlight,
} from '../src/earth-explorer/astronomy.js';
import {
  GLOBE_RADIUS,
  GLOBE_EYE_LIFT,
  globeEyeLift,
  surfaceFrame,
  moveSurface,
  contains,
  countryAt,
} from '../src/earth-explorer/geography.js';
import { COUNTRIES, COUNTRY_BY_ID, matchesCountry } from '../src/earth-explorer/countries.js';
import {
  newEarthSession,
  reduceEarth,
  makeQuiz,
  activeQuestion,
  quizScore,
} from '../src/earth-explorer/state.js';
const features = JSON.parse(
  readFileSync(new URL('../public/earth-explorer/countries.geojson', import.meta.url)),
).features;
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, a + ' != ' + b);
const act = (s, type, extra = {}) => reduceEarth(s, { type, ...extra });
function discovered() {
  let s = newEarthSession(9);
  for (const c of COUNTRIES.slice(0, 5)) s = act(s, 'select', { id: c.id });
  return s;
}
test('Earth clock handles leap days, Gregorian century rules, year clamp and midnight consistently', () => {
  assert.equal(yearDays(2026), 365);
  assert.equal(yearDays(2028), 366);
  assert.equal(yearDays(2100), 365);
  assert.equal(yearDays(2000), 366);
  const t = Date.UTC(2028, 1, 28, 23, 45);
  assert.equal(clock(t + DAY).date, '2028-02-29');
  assert.equal(clock(t + 2 * DAY).date, '2028-03-01');
  assert.equal(clock(t).day, 59);
  assert.equal(clock(changeMinutes(t, 1440)).date, '2028-02-29');
  assert.equal(clock(changeMinutes(t, 1440)).minutes, 0);
  assert.equal(clock(changeYear(t + DAY, 2026)).date, '2026-02-28');
  assert.equal(clock(changeDay(t, 366)).date, '2028-12-31');
  assert.equal(clock(changeDay(t, 366)).minutes, 1425);
  let s = { ...newEarthSession(), timestamp: Date.UTC(2026, 0, 1) };
  s = act(s, 'step-hour', { value: -1 });
  assert.equal(clock(s.timestamp).date, '2025-12-31');
  assert.equal(clock(s.timestamp).time, '23:00');
});
test('orbit is periodic independently of calendar year, tilted seasons and solar-day orientation agree', () => {
  const a = modelAt(EPOCH),
    b = modelAt(EPOCH + YEAR_DAYS * DAY);
  for (let i = 0; i < 3; i++) near(a.earth[i], b.earth[i], 1e-7);
  const radii = [];
  for (let d = 0; d < 366; d++) radii.push(Math.hypot(...modelAt(EPOCH + d * DAY).earth));
  assert.ok(Math.max(...radii) - Math.min(...radii) > 1);
  assert.equal(sunlight(EPOCH, 0, 0).label, 'Day');
  assert.equal(sunlight(EPOCH + DAY / 2, 0, 0).label, 'Night');
  assert.ok(dot(modelAt(EPOCH).sunLocal, modelAt(EPOCH + DAY).sunLocal) > 0.999);
  for (const [month, sign] of [
    [5, 1],
    [11, -1],
  ]) {
    const m = modelAt(Date.UTC(2026, month, 21, 12)),
      declination = vectorGeo(m.sunLocal).lat;
    assert.ok(declination * sign > 22);
  }
  assert.ok(Math.hypot(...a.earth) < 39);
  assert.ok(Math.hypot(...a.earth) > 37);
});
test('lunar orbit repeats in sidereal time while illumination follows relative geometry', () => {
  const a = modelAt(EPOCH),
    b = modelAt(EPOCH + MOON_DAYS * DAY);
  for (let i = 0; i < 3; i++) near(a.moon[i] - a.earth[i], b.moon[i] - b.earth[i], 1e-7);
  let min = 1,
    max = 0;
  for (let d = 0; d < 35; d += 0.2) {
    const m = modelAt(EPOCH + d * DAY);
    near(Math.hypot(...m.moon.map((v, i) => v - m.earth[i])), 6);
    min = Math.min(min, m.lit);
    max = Math.max(max, m.lit);
  }
  assert.ok(min < 0.01 && max > 0.99);
});
test('globe coordinates match texture orientation and round-trip across hemispheres', () => {
  for (const c of COUNTRIES) {
    const p = vectorGeo(geoVector(c.lat, c.lon));
    near(p.lat, c.lat);
    near(p.lon, c.lon);
  }
  assert.deepEqual(geoVector(0, 0), [1, 0, -0]);
  near(geoVector(0, 90)[2], -1);
});
test('surface walking follows great circles, handles poles/dateline and parallel-transports an upright frame', () => {
  let p = { lat: 0, lon: 0 };
  const distance = (GLOBE_RADIUS * Math.PI) / 2;
  p = moveSurface(p, distance, 0);
  near(p.lat, 0);
  near(p.lon, 90);
  p = moveSurface(p, distance, 0);
  near(p.lon, 180);
  p = { lat: 88, lon: 20 };
  for (let i = 0; i < 2000; i++) {
    p = moveSurface(p, 0.01, 0.03);
    const f = surfaceFrame(p);
    for (const v of [f.normal, f.north, f.east]) near(Math.hypot(...v), 1);
    near(dot(f.normal, f.north), 0);
    near(dot(f.normal, f.east), 0);
    near(dot(f.east, f.north), 0);
    assert.ok(Number.isFinite(p.lon) && Math.abs(p.lat) <= 90);
  }
  assert.equal(moveSurface(p, 0, 0), p);
});
test('all 195 country facts have valid map landings and sources; polygon holes and dateline are respected', () => {
  assert.equal(features.length, 242);
  assert.equal(new Set(features.map((f) => f.properties.id)).size, 242);
  assert.equal(COUNTRIES.length, 195);
  assert.equal(COUNTRY_BY_ID.aus.iso2, 'AU');
  assert.ok(matchesCountry(COUNTRY_BY_ID.vat, 'Vatican'));
  assert.ok(matchesCountry(COUNTRY_BY_ID.civ, 'Côte d’Ivoire'));
  assert.ok(matchesCountry(COUNTRY_BY_ID.tur, 'Türkiye'));
  assert.ok(matchesCountry(COUNTRY_BY_ID.usa, 'USA'));
  assert.equal(new Set(COUNTRIES.map((c) => c.fact)).size, 195);
  assert.equal(new Set(COUNTRIES.map((c) => c.iso2)).size, 195);
  for (const c of COUNTRIES) {
    assert.equal(countryAt(features, c.lat, c.lon)?.properties.id, c.id);
    assert.ok(c.fact.length > 25 && c.fact.length < 220);
    assert.ok(c.factSource.startsWith('https://'));
    assert.equal(c.factVersion, 2);
  }
  const polygon = {
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    },
  };
  assert.ok(contains(polygon, 2, 2));
  assert.equal(contains(polygon, 5, 5), false);
  const seam = {
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [170, -10],
          [-170, -10],
          [-170, 10],
          [170, 10],
          [170, -10],
        ],
      ],
    },
  };
  assert.ok(contains(seam, 179, 0));
  assert.ok(contains(seam, -179, 0));
  assert.equal(contains(seam, 0, 0), false);
});
test('changing view preserves time/discoveries, pauses playback; landing alone does not count as reading', () => {
  let s = discovered(),
    t = s.timestamp;
  s = act(s, 'play');
  assert.ok(s.playing);
  s = act(s, 'mode', { id: 'globe' });
  assert.equal(s.playing, false);
  assert.equal(s.timestamp, t);
  assert.equal(s.visited.length, 5);
  s = act(s, 'land', { id: 'aus' });
  assert.equal(s.mode, 'globe');
  assert.equal(s.location.lat, COUNTRY_BY_ID.aus.lat);
  assert.equal(s.visited.length, 5);
  s = act(s, 'select', { id: 'aus' });
  assert.equal(s.visited.length, 6);
  assert.equal(act(s, 'select', { id: 'aus' }).visited.length, 6);
  assert.equal(act(s, 'tick', { elapsed: 0.05 }), s);
  assert.deepEqual(act(s, 'restart', { seed: 10 }), newEarthSession(10));
});
test('clock controls pause playback, reject bad dates, preserve hour and remain locked during quiz', () => {
  let s = act(newEarthSession(), 'play');
  s = act(s, 'tick', { elapsed: 0.05 });
  assert.ok(s.timestamp > newEarthSession().timestamp);
  s = act(s, 'year', { value: 2028 });
  assert.equal(s.playing, false);
  assert.equal(clock(s.timestamp).days, 366);
  s = act(s, 'date', { value: '2028-02-29' });
  assert.equal(clock(s.timestamp).date, '2028-02-29');
  const t = s.timestamp;
  s = act(s, 'date', { value: '2026-02-29' });
  assert.equal(s.timestamp, t);
  s = act(s, 'date', { value: '1800-01-01' });
  assert.equal(s.timestamp, t);
  s = act(discovered(), 'quiz-start', { seed: 3 });
  assert.equal(s.phase, 'quiz');
  for (const type of ['play', 'day', 'minutes', 'year', 'mode', 'land', 'select', 'tick'])
    assert.equal(act(s, type, { value: 10, id: 'aus', elapsed: 0.1 }), s);
});
test('country quiz is explored-only, has all three types, unique targets and four valid distinct options', () => {
  assert.equal(makeQuiz(['ind', 'jpn'], 1).length, 0);
  const visited = COUNTRIES.slice(0, 7).map((c) => c.id),
    seen = new Set();
  for (let seed = 0; seed < 50; seed++) {
    const qs = makeQuiz(visited, seed);
    assert.deepEqual(qs, makeQuiz(visited, seed));
    assert.equal(qs.length, 5);
    assert.equal(new Set(qs.map((q) => q.target)).size, 5);
    assert.equal(qs.filter((q) => q.type === 'location').length, 2);
    assert.equal(qs.filter((q) => q.type === 'continent').length, 2);
    assert.equal(qs.filter((q) => q.type === 'fact').length, 1);
    for (const q of qs) {
      assert.ok(visited.includes(q.target));
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices).size, 4);
      assert.ok(q.choices.includes(q.answer));
      assert.equal(q.factVersion, 2);
      if (q.type !== 'continent') for (const id of q.choices) assert.ok(visited.includes(id));
      seen.add(q.target);
    }
  }
  assert.equal(seen.size, 7);
});
test('quiz confirms once, rejects stale events, reports mixed score and preserves completed review on revisit', () => {
  let s = act(discovered(), 'quiz-start', { seed: 8 });
  assert.equal(act(s, 'confirm', { question: activeQuestion(s).id }), s);
  for (let i = 0; i < 5; i++) {
    const q = activeQuestion(s),
      choice = i === 2 ? q.choices.find((c) => c !== q.answer) : q.answer;
    assert.equal(act(s, 'choose', { id: choice, question: 'stale' }), s);
    s = act(s, 'choose', { id: choice, question: q.id });
    s = act(s, 'confirm', { question: q.id });
    assert.equal(act(s, 'confirm', { question: q.id }), s);
    assert.equal(act(s, 'choose', { id: q.answer, question: q.id }), s);
    s = act(s, 'next', { question: q.id });
    if (i < 4) assert.equal(act(s, 'next', { question: q.id }), s);
  }
  assert.equal(s.phase, 'result');
  assert.equal(quizScore(s), 4);
  const saved = s.completed;
  s = act(s, 'show-country', { id: s.queue[2].target });
  assert.equal(s.phase, 'explore');
  assert.equal(s.mode, 'globe');
  assert.equal(s.completed, saved);
  s = act(s, 'last-result');
  assert.equal(s.phase, 'result');
  assert.equal(quizScore(s), 4);
});
test('unfinished quiz records abandonment separately and never creates a completed score', () => {
  let s = act(discovered(), 'quiz-start', { seed: 2 }),
    q = activeQuestion(s);
  s = act(s, 'choose', { id: q.answer, question: q.id });
  s = act(s, 'confirm', { question: q.id });
  s = act(s, 'leave-quiz');
  assert.equal(s.phase, 'explore');
  assert.equal(s.completed, null);
  assert.equal(s.answers.length, 0);
  assert.equal(s.visited.length, 5);
  assert.deepEqual(s.abandoned, [{ answered: 1, completed: false }]);
});

test('global quiz handles Oceania, tiny countries and paired transcontinental answers without ambiguous choices', () => {
  for (const id of ['vat', 'mco', 'nru', 'tuv', 'rus', 'tur', 'kaz', 'fji', 'aus']) {
    const visited = [id, 'ind', 'jpn', 'bra', 'can'];
    let found = false;
    for (let seed = 0; seed < 30; seed++) {
      const q = makeQuiz(visited, seed).find((q) => q.target === id && q.type === 'continent');
      if (!q) continue;
      found = true;
      assert.equal(q.choices.length, 4);
      assert.equal(q.choices.filter((c) => c === q.answer).length, 1);
      if (['rus', 'tur', 'kaz'].includes(id)) {
        assert.match(q.prompt, /pair/);
        assert.equal(q.answer, 'Europe / Asia');
        assert.ok(q.choices.every((c) => c.includes(' / ')));
      } else if (['fji', 'aus'].includes(id)) assert.equal(q.answer, 'Oceania');
    }
    assert.ok(found, 'No region question for ' + id);
  }
});

test('Earth VR respects tracked eye height without the desktop giant viewpoint lift', () => {
  assert.equal(globeEyeLift(true), 0);
  assert.equal(globeEyeLift(false), GLOBE_EYE_LIFT);
  assert.equal(GLOBE_RADIUS + globeEyeLift(false) - (GLOBE_RADIUS + globeEyeLift(true)), 1.5);
});
