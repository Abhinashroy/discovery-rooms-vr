import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newCase,
  reduceCase,
  BASELINE,
  ITEMS,
  SLOTS,
  CHANGE_COUNT,
} from '../src/detective/state.js';
import { movePlayer, canStand, VIEWS } from '../src/detective/navigation.js';
import { validPlacement, separated } from '../src/detective/placements.js';
const next = (s, type, id) => reduceCase(s, { type, id });
const find = (seed) => next(next(next(newCase(seed), 'start'), 'ready'), 'changed');
const permutations = (a) =>
  a.length
    ? a.flatMap((v, i) => permutations(a.filter((_, j) => i !== j)).map((rest) => [v, ...rest]))
    : [[]];
function safeLayout(s) {
  const active = Object.values(s.layout).map((key) => s.slots[key]);
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++)
      assert.ok(separated(active[i], active[j]), 'overlapping layout');
}
test('seeded rounds choose four objects and safe random destinations for every classroom prop', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const s = newCase(seed);
    assert.equal(s.moved.length, CHANGE_COUNT);
    assert.equal(new Set(s.moved).size, 4);
    assert.deepEqual(s, newCase(seed));
    assert.deepEqual(s.layout, BASELINE);
    assert.equal(Object.keys(s.changed).filter((id) => s.changed[id] !== BASELINE[id]).length, 4);
    for (const id of s.moved) {
      seen.add(id);
      assert.ok(validPlacement(s.slots[s.changed[id]], ITEMS[id].kind));
      assert.ok(Object.values(SLOTS).every((p) => separated(p, s.slots[s.changed[id]])));
    }
    safeLayout({ ...s, layout: s.changed });
  }
  assert.equal(seen.size, Object.keys(ITEMS).length);
});
test('books and fan have varied coordinates across rounds, including multiple book surfaces', () => {
  const positions = { books: new Set(), fan: new Set() },
    surfaces = new Set();
  for (let seed = 1; seed <= 400; seed++) {
    const s = newCase(seed);
    for (const id of Object.keys(positions))
      if (s.moved.includes(id)) {
        const p = s.slots[s.changed[id]];
        positions[id].add([p.x, p.y, p.z].map((v) => v.toFixed(2)).join(','));
        if (id === 'books') surfaces.add(p.surface);
        else assert.equal(p.type, 'ceiling');
      }
  }
  assert.ok(positions.books.size > 20);
  assert.ok(positions.fan.size > 20);
  assert.ok(surfaces.size >= 4);
});
test('study cannot award and destination snapshots stay fixed after Ready', () => {
  let s = newCase(18);
  assert.deepEqual(next(s, 'guess', 'fan'), s);
  s = next(s, 'start');
  s = next(s, 'guess', s.moved[0]);
  assert.equal(s.attempts.length, 0);
  assert.deepEqual(s.layout, BASELINE);
  const slots = structuredClone(s.slots);
  s = next(s, 'ready');
  assert.equal(s.phase, 'change');
  assert.deepEqual(next(s, 'guess', s.moved[0]), s);
  s = next(s, 'changed');
  assert.equal(s.phase, 'find');
  assert.deepEqual(s.layout, s.changed);
  assert.deepEqual(s.slots, slots);
});
test('all 24 return orders are overlap-free and only reward each item once', () => {
  for (const seed of [1, 17, 42, 100]) {
    const initial = find(seed);
    for (const order of permutations(initial.moved)) {
      let s = initial;
      for (let i = 0; i < 4; i++) {
        s = next(s, 'guess', order[i]);
        assert.equal(s.layout[order[i]], BASELINE[order[i]]);
        assert.equal(s.found.length, i + 1);
        assert.equal(s.phase, i === 3 ? 'complete' : 'find');
        safeLayout(s);
        const count = s.attempts.length;
        s = next(s, 'guess', order[i]);
        assert.equal(s.attempts.length, count);
        assert.equal(s.found.length, i + 1);
      }
      assert.deepEqual(s.layout, BASELINE);
    }
  }
});
test('wrong guesses retain returns; replay resets snapshots; stale events do not change Study', () => {
  let s = find(5),
    id = s.moved[0],
    unchanged = Object.keys(ITEMS).find((k) => !s.moved.includes(k));
  s = next(s, 'guess', id);
  s = next(s, 'guess', unchanged);
  assert.deepEqual(s.found, [id]);
  assert.equal(s.layout[id], BASELINE[id]);
  const previous = s.lastDestinations;
  s = reduceCase(s, { type: 'restart', seed: 99 });
  assert.equal(s.phase, 'study');
  assert.deepEqual(s.layout, BASELINE);
  assert.equal(s.found.length, 0);
  assert.equal(s.attempts.length, 0);
  assert.deepEqual(next(s, 'changed'), s);
  assert.deepEqual(next(s, 'guess', 'unknown'), s);
  assert.deepEqual(s.slots, newCase(99, previous).slots);
});
test('a randomly moved bin avoids the actual player position and preset views', () => {
  let s;
  for (let seed = 1; seed < 200; seed++) {
    const candidate = newCase(seed);
    if (candidate.moved.includes('bin')) {
      s = next(candidate, 'start');
      break;
    }
  }
  const p = s.slots[s.changed.bin],
    ready = reduceCase(s, { type: 'ready', player: { x: p.x, z: p.z } }),
    after = ready.slots[ready.changed.bin];
  assert.ok(Math.hypot(after.x - p.x, after.z - p.z) >= 1);
  for (const v of Object.values(VIEWS)) assert.ok(Math.hypot(after.x - v.x, after.z - v.z) >= 1);
  assert.deepEqual(ready.moved, s.moved);
  assert.deepEqual(ready.layout, BASELINE);
});
test('walking respects walls, desks and a relocated bin; views remain valid', () => {
  const walked = movePlayer(VIEWS.back, 0, -1);
  assert.ok(walked.z < VIEWS.back.z);
  assert.ok(canStand(walked.x, walked.z));
  const wall = movePlayer(VIEWS.back, 100, 0);
  assert.ok(wall.x <= 7.7);
  const desk = movePlayer({ x: 0, z: 0 }, 6, 0);
  assert.ok(desk.x < 2);
  const teacher = movePlayer(VIEWS.back, 0, -50);
  assert.ok(teacher.z > -4.5);
  const bin = movePlayer({ x: 5.3, z: 5.8 }, 0, -6, [{ x: 5.3, z: 2.3, hx: 0.32, hz: 0.32 }]);
  assert.ok(bin.z > 2.8);
  for (const p of Object.values(VIEWS)) assert.ok(canStand(p.x, p.z));
});
test('all sampled original and destination positions have a reachable approach', () => {
  const key = (x, z) => `${x},${z}`,
    queue = [{ x: 0, z: 6 }],
    seen = new Set([key(0, 6)]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
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
        seen.add(k);
        queue.push({ x, z });
      }
    }
  }
  for (let seed = 1; seed <= 100; seed++) {
    const s = newCase(seed);
    for (const [key, p] of Object.entries(s.slots))
      assert.ok(
        queue.some((v) => Math.hypot(v.x - p.x, v.z - p.z) < 1.8),
        'unreachable ' + key,
      );
  }
});

test('repeat selections use another surface or a clearly different ceiling/floor location', () => {
  let s = newCase(1);
  const seen = new Set();
  for (let seed = 2; seed <= 150; seed++) {
    const previous = s.lastDestinations;
    s = reduceCase(s, { type: 'restart', seed });
    for (const id of s.moved) {
      const before = previous[id],
        after = s.slots[s.changed[id]];
      if (!before) continue;
      seen.add(id);
      if (after.type === 'table' || after.type === 'wall')
        assert.notEqual(after.surface, before.surface);
      else assert.ok(Math.hypot(after.x - before.x, after.z - before.z) >= 1.5);
    }
  }
  assert.equal(seen.size, Object.keys(ITEMS).length);
});
