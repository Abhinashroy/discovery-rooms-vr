import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuest, reduceQuest } from '../src/discovery/quest-state.js';
import {
  OCEAN_TABLES,
  ANIMALS,
  CREATURES,
  ZONES,
  CHAIN,
  LITTER,
  HABITATS,
  OCEAN_SYMBOLS,
} from '../src/discovery/ocean.js';
import { TABLES, DESTINATIONS } from '../src/discovery/adventure.js';
import { tablesFor, unlocked, taskView, clueFor, propsFor } from '../src/discovery/content.js';
const a = (s, id, verb, value) => reduceQuest(s, { type: 'task', id, verb, value });
const collect = (s, id) => a(a(s, id, 'reveal'), id, 'collect');
test('Ocean solves six distinct tasks with recoverable mistakes and locked progression', () => {
  let s = createQuest(6, 'guided', 'ocean');
  assert.equal(unlocked(s, 'solar'), false);
  assert.deepEqual(a(s, 'solar', 'assist'), s);
  for (const [id, sources, targets] of [
    ['cargo', ANIMALS, ANIMALS],
    ['solar', CREATURES, ZONES],
  ]) {
    for (let i = 0; i < 3; i++) {
      s = a(s, id, 'choose', sources[i]);
      s = a(s, id, 'place', targets[(i + 1) % 3]);
      assert.equal(s.tasks[id].steps.length, i);
      s = a(s, id, 'place', targets[i]);
    }
    s = collect(s, id);
  }
  s = a(s, 'globe', 'choose', CHAIN[2]);
  assert.equal(s.tasks.globe.steps.length, 0);
  for (const x of CHAIN) s = a(s, 'globe', 'choose', x);
  s = collect(s, 'globe');
  s = a(s, 'moon', 'choose', 'Shell');
  assert.equal(s.tasks.moon.steps.length, 0);
  for (const x of LITTER) s = a(s, 'moon', 'choose', x);
  s = collect(s, 'moon');
  s = a(s, 'mission', 'release');
  assert.equal(s.tasks.mission.phase, 'active');
  for (let i = 0; i < 3; i++)
    while (s.tasks.mission.turns[i] !== 1) s = a(s, 'mission', 'rotate', String(i));
  s = a(s, 'mission', 'release');
  s = collect(s, 'mission');
  for (let i = 0; i < 3; i++) {
    s = a(s, 'beacon', 'choose', HABITATS[i]);
    s = a(s, 'beacon', 'place', ['Fish hideout', 'Shaded nook', 'Swimming lane'][i]);
  }
  s = collect(s, 'beacon');
  assert.equal(s.fragments, 6);
  assert.equal(s.observations.length, 6);
  for (const t of OCEAN_TABLES) s = collect(s, t.id);
  assert.equal(s.fragments, 6);
  assert.equal(reduceQuest(s, { type: 'treasure' }).treasure, true);
});
test('Ocean help at every table preserves explicit reveals, single rewards and inspection-only recall', () => {
  let s = createQuest(77, 'explorer', 'ocean');
  for (const t of OCEAN_TABLES) {
    const before = s.fragments;
    for (let i = 0; i < 4; i++) s = a(s, t.id, 'hint');
    assert.equal(s.tasks[t.id].hint, 3);
    s = a(s, t.id, 'assist');
    assert.equal(s.tasks[t.id].assisted, true);
    assert.equal(s.fragments, before);
    assert.equal(s.observations.length, before);
    s = collect(s, t.id);
  }
  for (const action of [
    { type: 'inspect-drawer' },
    { type: 'inspect-prop', id: 'satellite' },
    { type: 'inspect-prop', id: 'meteorite' },
  ])
    s = reduceQuest(s, action);
  assert.equal(s.observations.length, 9);
  s = reduceQuest(s, { type: 'start-memory' });
  assert.equal(s.round.length, 5);
  for (const q of s.round) {
    assert.equal(q.options[q.correct], q.answer);
    assert.ok(s.observations.some((r) => r.id === q.source && r.answer === q.answer));
    assert.doesNotMatch(
      JSON.stringify([q.prompt, q.options, q.location]),
      /cargo|Space|planet|satellite|Meteorite/i,
    );
  }
  assert.deepEqual(reduceQuest(s, { type: 'task', id: 'cargo', verb: 'assist' }), s);
});
test('Switching either direction clears all state and uses only selected adventure content', () => {
  let s = createQuest(4);
  s = reduceQuest(s, { type: 'assist' });
  s = reduceQuest(s, { type: 'reveal' });
  s = reduceQuest(s, { type: 'start-memory' });
  s = reduceQuest(s, { type: 'switch-adventure', adventure: 'ocean', seed: 8 });
  assert.deepEqual(s, createQuest(8, 'guided', 'ocean'));
  assert.equal(tablesFor(s)[0].title, 'Reef explorer');
  assert.match(clueFor(s), /animal/);
  assert.equal(propsFor(s)[0].title, 'Periscope viewer');
  assert.equal(reduceQuest(s, { type: 'assist' }).tasks.cargo.phase, 'available');
  for (const t of OCEAN_TABLES) {
    s = collect(a(s, t.id, 'assist'), t.id);
    assert.ok(OCEAN_SYMBOLS.includes(s.tasks[t.id].symbol));
  }
  s = reduceQuest(s, { type: 'switch-adventure', adventure: 'space', seed: 9 });
  assert.deepEqual(s, createQuest(9));
  assert.equal(tablesFor(s)[0].title, 'Cargo launch');
  assert.equal(s.fragments, 0);
  assert.equal(s.memory, null);
  assert.equal(taskView(s, 'solar').actions.length, 0);
  assert.deepEqual(
    OCEAN_TABLES.map((t) => [t.id, t.x, t.z]),
    TABLES.map((t) => [t.id, t.x, t.z]),
  );
  assert.equal(DESTINATIONS.length, 10);
  assert.throws(() => createQuest(1, 'guided', 'unknown'));
});
