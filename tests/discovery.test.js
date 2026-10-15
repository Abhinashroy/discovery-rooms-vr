import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPLIES, DESTINATIONS, TOKEN_NAMES, FOUND_OBJECTS } from '../src/discovery/adventure.js';
import { createQuest, reduceQuest, makeMemoryQuestion } from '../src/discovery/quest-state.js';
import { canStand, findPath, approachPoint, movePlayer } from '../src/discovery/navigation.js';

function pack(state) {
  for (const item of SUPPLIES) {
    state = reduceQuest(state, { type: 'select', id: item.id });
    state = reduceQuest(state, { type: 'place', shape: item.shape });
  }
  return state;
}
test('cargo preserves packed work on mistakes and gates reveal/collection until a correct solution', () => {
  const fresh = createQuest(42);
  let s = reduceQuest(fresh, { type: 'collect' });
  assert.equal(s.fragments, 0);
  s = reduceQuest(s, { type: 'reveal' });
  assert.equal(s.phase, 'available');
  s = reduceQuest(s, { type: 'place', shape: 'circle' });
  assert.match(s.message, /First select/);
  s = reduceQuest(s, { type: 'select', id: 'water' });
  s = reduceQuest(s, { type: 'place', shape: 'square' });
  assert.deepEqual(s.placed, []);
  assert.match(s.message, /CIRCLE/);
  s = reduceQuest(s, { type: 'place', shape: 'circle' });
  s = reduceQuest(s, { type: 'select', id: 'food' });
  s = reduceQuest(s, { type: 'place', shape: 'square' });
  assert.deepEqual(s.placed, ['water']);
  s = pack(s);
  assert.equal(s.phase, 'completed');
  assert.deepEqual(s.observations, []);
  assert.equal(s.fragments, 0);
  s = reduceQuest(s, { type: 'reveal' });
  assert.equal(s.phase, 'revealed');
  assert.equal(s.observations.length, 1);
  assert.equal(s.observations[0].answer, s.token);
  for (let i = 0; i < 3; i++) {
    s = reduceQuest(s, { type: 'collect' });
    s = reduceQuest(s, { type: 'reveal' });
    s = reduceQuest(s, { type: 'assist' });
  }
  assert.equal(s.fragments, 1);
  assert.equal(s.assisted, false);
  assert.equal(s.observations.length, 1);
  assert.deepEqual(fresh.placed, []);
});
test('hints progress, assistance explains the solution and never skips reveal or collection', () => {
  let s = createQuest(12, 'explorer');
  for (let i = 0; i < 4; i++) s = reduceQuest(s, { type: 'hint' });
  assert.equal(s.hint, 3);
  assert.match(s.message, /Select Water/);
  s = reduceQuest(s, { type: 'assist' });
  assert.equal(s.assisted, true);
  assert.equal(s.phase, 'completed');
  assert.equal(s.fragments, 0);
  assert.equal(s.observations.length, 0);
  s = reduceQuest(s, { type: 'reveal' });
  s = reduceQuest(s, { type: 'collect' });
  assert.equal(s.fragments, 1);
  assert.match(s.message, /with a little help/);
  assert.throws(() => reduceQuest(s, { type: 'select', id: 'unknown' }));
  assert.throws(() => reduceQuest(s, { type: 'place', shape: 'hexagon' }));
  assert.throws(() => reduceQuest(s, { type: 'mode', value: 'hidden' }));
});
test('environment questions are seeded, varied, inspection-only and have exactly one correct choice', () => {
  const variants = new Set(),
    answers = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const fresh = createQuest(seed);
    assert.deepEqual(fresh, createQuest(seed));
    assert.equal(makeMemoryQuestion(fresh), null);
    let s = reduceQuest(fresh, { type: 'inspect-drawer' });
    s = reduceQuest(s, { type: 'inspect-drawer' });
    assert.equal(s.observations.length, 1);
    const q = makeMemoryQuestion(s);
    assert.equal(q.options[q.correct], s.discovery);
    assert.equal(new Set(q.options).size, 3);
    assert.ok(q.options.every((x) => FOUND_OBJECTS.includes(x)));
    variants.add(s.discovery);
    answers.add(q.correct);
    s = reduceQuest(pack(s), { type: 'reveal' });
    assert.equal(makeMemoryQuestion(s).source, 'drawer');
    const cargo = reduceQuest(pack(createQuest(seed)), { type: 'reveal' });
    assert.ok(TOKEN_NAMES.includes(makeMemoryQuestion(cargo).answer));
  }
  assert.equal(variants.size, 3);
  assert.equal(answers.size, 3);
  assert.throws(() => createQuest(-1));
  assert.throws(() => createQuest(1.2));
});
test('recall freezes world actions, captures assistance and cannot be rescored or reset by reopening', () => {
  let s = reduceQuest(createQuest(77), { type: 'inspect-drawer' });
  s = reduceQuest(s, { type: 'start-memory' });
  const snapshot = structuredClone(s);
  assert.deepEqual(reduceQuest(s, { type: 'assist' }), snapshot);
  s = reduceQuest(s, { type: 'look-again' });
  assert.equal(s.memory.assisted, true);
  assert.equal(s.memory.looking, true);
  assert.equal(reduceQuest(s, { type: 'answer', index: s.memory.correct }).memory.result, null);
  s = reduceQuest(s, { type: 'return-memory' });
  s = reduceQuest(s, { type: 'answer', index: (s.memory.correct + 1) % 3 });
  assert.equal(s.memory.result, 'incorrect');
  s = reduceQuest(s, { type: 'answer', index: s.memory.correct });
  s = reduceQuest(s, { type: 'start-memory' });
  assert.equal(s.memory.result, 'incorrect');
  assert.equal(s.memory.assisted, true);
  assert.equal(createQuest(77).memory, null);
  assert.deepEqual(createQuest(77).observations, []);
});
test('skip and correct recall are distinct and do not remove collected treasure', () => {
  let base = reduceQuest(reduceQuest(pack(createQuest(91)), { type: 'reveal' }), {
    type: 'collect',
  });
  base = reduceQuest(base, { type: 'start-memory' });
  const skipped = reduceQuest(base, { type: 'skip-memory' });
  assert.equal(skipped.memory.result, 'skipped');
  assert.equal(skipped.fragments, 1);
  const correct = reduceQuest(base, { type: 'answer', index: base.memory.correct });
  assert.equal(correct.memory.result, 'correct');
  assert.equal(correct.memory.assisted, false);
  assert.equal(correct.fragments, 1);
  assert.throws(() => reduceQuest(base, { type: 'answer', index: 50 }));
});
test('all six preview tables and discovery drawer are reachable; virtual movement cannot cross furniture', () => {
  for (const target of DESTINATIONS) {
    const goal = approachPoint(target);
    assert.ok(canStand(goal.x, goal.z), target.id);
    const path = findPath({ x: 0, z: 5.7 }, goal);
    assert.ok(path.length, target.id);
    assert.ok(path.every((p) => canStand(p.x, p.z)));
  }
  const stopped = movePlayer({ x: 0, z: 5.7 }, 0, -30);
  assert.ok(stopped.z > 2);
  assert.ok(canStand(stopped.x, stopped.z));
  const drawer = movePlayer({ x: -5.8, z: 6 }, 0, -8);
  assert.ok(drawer.z >= 4.7);
  assert.ok(canStand(drawer.x, drawer.z));
  const wall = movePlayer({ x: 5, z: 5 }, 100, 100);
  assert.ok(wall.x <= 6.65 && wall.z <= 6.5);
});
