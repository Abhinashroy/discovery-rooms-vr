import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANETS,
  IDS,
  INNER_ENLARGEMENT,
  SUN_KM,
  displayDiameter,
} from '../src/planetarium/content.js';
import { QUIZ_POOL, questions } from '../src/planetarium/quiz.js';
import {
  newSession,
  reduceSession,
  activeQuestion,
  hiddenName,
  availableNames,
  namingScore,
  quizScore,
  shouldCelebrate,
} from '../src/planetarium/state.js';
import {
  HALL,
  SUN,
  VIEWS,
  canStand,
  movePlayer,
  inspectionPlacement,
} from '../src/planetarium/layout.js';
import { PATHS, createSchedule } from '../src/planetarium/ambience.js';
import { changeRoom, freshEntry } from '../src/rooms/routes.js';
const action = (s, type, id) => reduceSession(s, { type, id, question: activeQuestion(s)?.id });
function named(seed = 1, permutation = IDS) {
  let s = action(newSession(seed), 'ready');
  for (let i = 0; i < 8; i++) s = action(action(s, 'planet', IDS[i]), 'card', permutation[i]);
  return s;
}
function quiz(seed = 1) {
  return action(action(named(seed), 'submit-names'), 'quiz-start');
}
test('enlarged inner planets preserve their ratios, Mercury equals former Earth; outer bodies and routes fit', () => {
  assert.equal(displayDiameter(SUN_KM), 20);
  assert.equal(PLANETS.length, 8);
  assert.ok(Math.abs(PLANETS[0].diameter - displayDiameter(12756)) < 1e-12);
  for (const p of PLANETS) {
    assert.ok(
      Math.abs(p.diameter - displayDiameter(p.km) * (p.order <= 4 ? INNER_ENLARGEMENT : 1)) < 1e-12,
    );
    const r = p.ringKm ? (p.ringKm[1] / SUN_KM) * 20 : p.diameter / 2;
    assert.ok(Math.abs(p.x) + r < HALL.halfX);
    assert.ok(Math.abs(p.z) + r < HALL.halfZ);
  }
  for (const p of PLANETS.slice(0, 4))
    assert.ok(Math.abs(p.diameter / PLANETS[0].diameter - p.km / 4879) < 1e-12);
  assert.ok(SUN.y - SUN.radius >= 0 && SUN.y + SUN.radius < HALL.height);
  for (const p of Object.values(VIEWS)) assert.ok(canStand(p.x, p.z));
  const grid = [],
    seen = new Set(),
    key = (x, z) => x + ',' + z;
  grid.push({ x: 0, z: 17 });
  seen.add(key(0, 17));
  for (let i = 0; i < grid.length; i++) {
    const p = grid[i];
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const x = p.x + dx,
        z = p.z + dz,
        k = key(x, z);
      if (!seen.has(k) && canStand(x, z)) {
        grid.push({ x, z });
        seen.add(k);
      }
    }
  }
  for (const p of Object.values(VIEWS))
    assert.ok(grid.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.6));
  const walked = movePlayer(VIEWS.entrance, 0, -50);
  assert.ok(canStand(walked.x, walked.z));
  assert.ok(walked.z > SUN.z + 10);
  const wall = movePlayer(VIEWS.entrance, 100, 0);
  assert.ok(wall.x <= 23.6);
});
test('naming is planet-first, accepts wrong guesses silently, keeps names unique and permits editing/releasing', () => {
  let s = action(newSession(9), 'ready');
  assert.equal(action(s, 'card', 'venus'), s);
  assert.equal(action(s, 'submit-names'), s);
  assert.equal(availableNames(s).length, 8);
  for (const id of IDS) assert.ok(hiddenName(s, id));
  s = action(action(s, 'planet', 'mercury'), 'card', 'venus');
  assert.equal(s.assignments.mercury, 'venus');
  assert.equal(s.namingReview.length, 0);
  assert.equal('correct' in s, false);
  s = action(s, 'planet', 'earth');
  assert.equal(availableNames(s).length, 7);
  assert.ok(!availableNames(s).includes('venus'));
  assert.equal(action(s, 'card', 'venus'), s);
  s = action(s, 'card', 'earth');
  s = action(s, 'planet', 'mercury');
  assert.ok(availableNames(s).includes('venus'));
  s = action(s, 'card', 'mercury');
  assert.equal(s.assignments.mercury, 'mercury');
  assert.ok(availableNames(s).includes('venus'));
  s = action(s, 'unassign');
  assert.equal(s.assignments.mercury, undefined);
  assert.equal(availableNames(s).length, 7);
  assert.equal(action(s, 'quiz-start'), s);
});
test('Submit grades all eight once with right/wrong review; completed assignment is frozen and restart clears run', () => {
  const permutation = ['venus', 'mercury', ...IDS.slice(2)];
  const before = named(4, permutation);
  assert.equal(availableNames(before).length, 1);
  let s = action(before, 'submit-names');
  assert.equal(s.phase, 'naming-review');
  assert.equal(namingScore(s), 6);
  assert.deepEqual(s.namingReview.slice(0, 2), [
    { id: 'mercury', assigned: 'venus', correct: false },
    { id: 'venus', assigned: 'mercury', correct: false },
  ]);
  assert.equal(shouldCelebrate(before, s), false);
  for (const type of ['card', 'unassign', 'planet', 'submit-names'])
    assert.equal(action(s, type, 'earth'), s);
  const perfect = named();
  const submitted = action(perfect, 'submit-names');
  assert.equal(shouldCelebrate(perfect, submitted), true);
  assert.equal(shouldCelebrate(submitted, action(submitted, 'submit-names')), false);
  s = reduceSession(s, { type: 'restart', seed: 20 });
  assert.deepEqual(s, newSession(20));
});
test('30-question pool has four unique choices and one key; each seeded quiz selects five distinct questions', () => {
  assert.equal(QUIZ_POOL.length, 30);
  assert.equal(new Set(QUIZ_POOL.map((q) => q.id)).size, 30);
  for (const q of QUIZ_POOL) {
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4);
    assert.equal(q.choices.filter((c) => c === q.answer).length, 1);
    assert.ok(q.explanation && q.source.startsWith('https://science.nasa.gov/'));
  }
  const coverage = new Set(),
    rounds = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const qs = questions(seed);
    assert.deepEqual(qs, questions(seed));
    assert.equal(qs.length, 5);
    assert.equal(new Set(qs.map((q) => q.id)).size, 5);
    rounds.add(qs.map((q) => q.id).join(','));
    for (const q of qs) {
      coverage.add(q.id);
      assert.equal(new Set(q.choices).size, 4);
      assert.ok(q.choices.includes(q.answer));
    }
  }
  assert.equal(coverage.size, 30);
  assert.ok(rounds.size > 90);
});
test('quiz locks confirmed answers, rejects stale/invalid clicks, requires five answers and reports independent scores', () => {
  let s = quiz(7);
  assert.equal(action(s, 'next-question'), s);
  assert.equal(action(s, 'confirm-answer'), s);
  assert.equal(action(s, 'answer', 'invalid'), s);
  assert.equal(action(s, 'planet', 'mercury'), s);
  assert.equal(
    reduceSession(s, { type: 'answer', id: activeQuestion(s).answer, question: 'stale' }),
    s,
  );
  for (let i = 0; i < 5; i++) {
    const q = activeQuestion(s),
      choice = i % 2 ? q.choices.find((c) => c !== q.answer) : q.answer;
    s = action(s, 'answer', choice);
    s = action(s, 'confirm-answer');
    assert.equal(action(s, 'confirm-answer'), s);
    assert.equal(action(s, 'answer', q.answer), s);
    const before = s;
    s = action(s, 'next-question');
    assert.equal(shouldCelebrate(before, s), i === 4);
    if (i < 4) assert.equal(reduceSession(s, { type: 'next-question', question: q.id }), s);
  }
  assert.equal(s.phase, 'result');
  assert.equal(s.answers.length, 5);
  assert.equal(quizScore(s), 3);
  assert.equal(namingScore(s), 8);
  assert.equal(action(s, 'next-question'), s);
  let zero = quiz(2);
  for (let i = 0; i < 5; i++) {
    zero = action(
      zero,
      'answer',
      activeQuestion(zero).choices.find((c) => c !== activeQuestion(zero).answer),
    );
    zero = action(action(zero, 'confirm-answer'), 'next-question');
  }
  assert.equal(quizScore(zero), 0);
  assert.equal(zero.phase, 'result');
});
test('ambience stays on safe upper surfaces, is single-instance, seedable and disabled during tasks', () => {
  const a = createSchedule(8),
    b = createSchedule(8);
  let passes = 0,
    last = null;
  for (let i = 0; i < 4000; i++) {
    const x = a.tick(0.1, true),
      y = b.tick(0.1, true);
    assert.deepEqual(x, y);
    if (x !== last && x) passes++;
    last = x;
    if (x) {
      assert.ok(x.duration >= 6 && x.duration <= 10);
      for (let t = 0; t <= 1; t += 0.1) {
        const p = x.from.map((v, j) => v + (x.to[j] - v) * t);
        assert.ok(p[1] >= 12 && p[1] < HALL.height);
        assert.ok(Math.hypot(p[0] - SUN.x, p[1] - SUN.y, p[2] - SUN.z) > SUN.radius + 0.3);
      }
    }
  }
  assert.ok(passes > 5);
  assert.equal(a.tick(0.1, false), null);
  assert.ok(PATHS.length >= 4);
});
test('room navigation stops outgoing work before leaving XR and rejects unknown destinations', async () => {
  const before = globalThis.window,
    events = [];
  const listeners = {};
  globalThis.window = {
    location: { assign: (url) => events.push(url), reload: () => events.push('reload') },
    addEventListener: (name, fn) => (listeners[name] = fn),
  };
  try {
    await changeRoom('bad', null, () => events.push('stop'));
    assert.deepEqual(events, []);
    await changeRoom(
      'planetarium',
      { is: () => true, exitVR: async () => events.push('exit') },
      () => events.push('stop'),
    );
    assert.deepEqual(events, ['stop', 'exit', './planetarium.html']);
    events.length = 0;
    await changeRoom('main', { is: () => true, exitVR: async () => events.push('exit') }, () =>
      events.push('stop'),
    );
    assert.deepEqual(events, ['stop', 'exit', './']);
    freshEntry(() => ({
      pause: () => events.push('pause'),
      renderer: {
        setAnimationLoop: (value) => events.push(value),
        dispose: () => events.push('dispose'),
        forceContextLoss: () => events.push('release'),
      },
    }));
    listeners.pageshow({ persisted: true });
    assert.equal(events.at(-1), 'reload');
    listeners.pagehide();
    assert.deepEqual(events.slice(-4), ['pause', null, 'dispose', 'release']);
  } finally {
    globalThis.window = before;
  }
});

test('inspection remains at each exhibit, respects its floor clearance and preserves outer sizes without moving the player', () => {
  assert.equal(inspectionPlacement('bad'), null);
  assert.equal(VIEWS.inspection, undefined);
  for (const p of PLANETS) {
    const pose = inspectionPlacement(p.id);
    assert.equal(pose.x, p.x);
    assert.equal(pose.z, p.z);
    assert.ok(pose.y - pose.radius >= 1.05 - 1e-12);
    assert.equal(pose.magnified, p.order <= 4);
    assert.equal(pose.radius, p.order <= 4 ? 0.55 : p.diameter / 2);
    assert.ok(canStand(VIEWS[p.id].x, VIEWS[p.id].z));
    let s = action(newSession(1), 'planet', p.id);
    s = action(s, 'inspect');
    assert.equal(s.inspection, p.id);
    s = action(s, 'close-inspect');
    assert.equal(s.inspection, null);
    assert.equal(s.focus, p.id);
  }
});
