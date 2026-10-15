import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuest, reduceQuest } from '../src/discovery/quest-state.js';
import { WORKSHOP_TABLES, TOOLS, JOBS, PARTS, SYMBOLS } from '../src/discovery/workshop.js';
import { TABLES } from '../src/discovery/adventure.js';
import { tablesFor, unlocked, taskView } from '../src/discovery/content.js';
import { PRESETS, ACCENTS, profileFor } from '../src/discovery/personalization.js';
const act = (s, id, verb, value) => reduceQuest(s, { type: 'task', id, verb, value });
const collect = (s, id) => act(act(s, id, 'reveal'), id, 'collect');
function solve(s) {
  for (let i = 0; i < 3; i++) {
    s = act(s, 'cargo', 'choose', TOOLS[i]);
    s = act(s, 'cargo', 'place', JOBS[(i + 1) % 3]);
    assert.equal(s.tasks.cargo.steps.length, i);
    s = act(s, 'cargo', 'place', JOBS[i]);
  }
  s = collect(s, 'cargo');
  s = act(s, 'solar', 'remove');
  assert.equal(s.tasks.solar.count, 0);
  s = act(s, 'solar', 'check');
  assert.notEqual(s.tasks.solar.phase, 'completed');
  for (let i = 0; i < 4; i++) s = act(s, 'solar', 'add');
  s = act(s, 'solar', 'check');
  assert.notEqual(s.tasks.solar.phase, 'completed');
  s = act(s, 'solar', 'remove');
  s = act(s, 'solar', 'check');
  s = collect(s, 'solar');
  s = act(s, 'globe', 'switch');
  assert.notEqual(s.tasks.globe.phase, 'completed');
  for (const v of PARTS) s = act(s, 'globe', 'fit', v);
  s = collect(s, 'globe');
  s = act(s, 'moon', 'turn');
  assert.notEqual(s.tasks.moon.phase, 'completed');
  s = act(s, 'moon', 'predict', 'Counterclockwise');
  s = act(s, 'moon', 'turn');
  assert.notEqual(s.tasks.moon.phase, 'completed');
  s = act(s, 'moon', 'predict', 'Clockwise');
  s = act(s, 'moon', 'turn');
  s = collect(s, 'moon');
  s = act(s, 'mission', 'answer', 'higher');
  assert.notEqual(s.tasks.mission.phase, 'completed');
  s = act(s, 'mission', 'run');
  s = act(s, 'mission', 'answer', 'same');
  assert.notEqual(s.tasks.mission.phase, 'completed');
  s = act(s, 'mission', 'answer', 'higher');
  s = collect(s, 'mission');
  s = act(s, 'beacon', 'start');
  assert.notEqual(s.tasks.beacon.phase, 'completed');
  for (const v of SYMBOLS) s = act(s, 'beacon', 'fit', v);
  s = act(s, 'beacon', 'start');
  assert.notEqual(s.tasks.beacon.phase, 'completed');
  s = act(s, 'beacon', 'power');
  s = act(s, 'beacon', 'start');
  return collect(s, 'beacon');
}
test('Workshop six distinct solutions recover from mistakes and award only once', () => {
  let s = createQuest(21, 'guided', 'workshop');
  assert.equal(unlocked(s, 'solar'), false);
  assert.deepEqual(act(s, 'solar', 'assist'), s);
  s = solve(s);
  assert.equal(s.fragments, 6);
  assert.equal(s.observations.length, 6);
  for (const t of TABLES) s = collect(s, t.id);
  assert.equal(s.fragments, 6);
  assert.equal(reduceQuest(s, { type: 'treasure' }).treasure, true);
});
test('Workshop hints/help still require reveal and collect; memory snapshots use inspected workshop facts', () => {
  let s = createQuest(19, 'explorer', 'workshop');
  assert.equal(reduceQuest(s, { type: 'start-memory' }).memory, null);
  for (const t of TABLES) {
    for (let i = 0; i < 4; i++) s = act(s, t.id, 'hint');
    assert.equal(s.tasks[t.id].hint, 3);
    s = act(s, t.id, 'assist');
    assert.equal(s.tasks[t.id].assisted, true);
    assert.equal(s.observations.length, s.fragments);
    s = collect(s, t.id);
  }
  for (const a of [
    { type: 'inspect-drawer' },
    { type: 'inspect-prop', id: 'satellite' },
    { type: 'inspect-prop', id: 'meteorite' },
  ]) {
    s = reduceQuest(s, a);
    s = reduceQuest(s, a);
  }
  assert.equal(s.observations.length, 9);
  s = reduceQuest(s, { type: 'start-memory' });
  assert.equal(s.round.length, 5);
  for (const q of s.round) {
    assert.equal(q.options[q.correct], q.answer);
    assert.equal(new Set(q.options).size, q.options.length);
    assert.doesNotMatch(
      JSON.stringify([q.prompt, q.options, q.location]),
      /Space|Ocean|reef|cargo|satellite/i,
    );
  }
  assert.deepEqual(reduceQuest(s, { type: 'personalize', value: { emblem: 'Leaf' } }), s);
});
test('All preset combinations preserve solutions and placement; every set switch starts fresh but keeps style', () => {
  for (const emblem of PRESETS.emblem)
    for (const companion of PRESETS.companion)
      for (const palette of PRESETS.palette) {
        const profile = { emblem, companion, palette };
        let s = solve(createQuest(23, 'guided', 'workshop', profile));
        assert.equal(s.fragments, 6);
        for (const adventure of ['space', 'ocean', 'workshop']) {
          s = reduceQuest(s, { type: 'switch-adventure', adventure, seed: 5 });
          assert.deepEqual(s, createQuest(5, 'guided', adventure, profile));
          assert.equal(s.fragments, 0);
          assert.equal(s.memory, null);
          assert.deepEqual(
            tablesFor(s).map((t) => [t.id, t.x, t.z]),
            TABLES.map((t) => [t.id, t.x, t.z]),
          );
        }
      }
  assert.deepEqual(
    profileFor({ emblem: 'untrusted', companion: 'url', palette: 'white' }),
    profileFor(),
  );
  assert.deepEqual(
    WORKSHOP_TABLES.map((t) => t.id),
    TABLES.map((t) => t.id),
  );
  assert.equal(taskView(createQuest(1, 'guided', 'workshop'), 'solar').actions.length, 0);
});
test('Every accent has readable white button text and dark-on-paper labels remain fixed', () => {
  for (const hex of Object.values(ACCENTS)) {
    const c = hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    assert.ok(1.05 / (l + 0.05) >= 4.5);
  }
});
