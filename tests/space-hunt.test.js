import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuest, reduceQuest } from '../src/discovery/quest-state.js';
import {
  PLANETS,
  FLIGHT,
  MOON_VIEWS,
  fragmentList,
  unlocked,
  taskView,
} from '../src/discovery/space.js';
const act = (s, id, verb, value) => reduceQuest(s, { type: 'task', id, verb, value });
const cargo = (s) =>
  reduceQuest(reduceQuest(reduceQuest(s, { type: 'assist' }), { type: 'reveal' }), {
    type: 'collect',
  });
const collect = (s, id) => act(act(s, id, 'reveal'), id, 'collect');

test('full Space hunt enforces unlocks, distinct solutions, safe retries and six single awards', () => {
  let s = createQuest(15);
  assert.equal(unlocked(s, 'solar'), false);
  s = act(s, 'solar', 'assist');
  assert.deepEqual(s.tasks.solar.steps, []);
  assert.equal(reduceQuest(s, { type: 'treasure' }).treasure, false);
  s = cargo(s);
  assert.equal(unlocked(s, 'solar'), true);
  s = act(s, 'solar', 'choose', 'Mars');
  assert.deepEqual(s.tasks.solar.steps, []);
  for (const p of PLANETS) s = act(s, 'solar', 'choose', p);
  assert.equal(s.tasks.solar.phase, 'completed');
  assert.equal(unlocked(s, 'globe'), false);
  s = collect(s, 'solar');
  assert.equal(unlocked(s, 'globe'), true);
  s = act(s, 'globe', 'choose', 'day');
  assert.deepEqual(s.tasks.globe.steps, []);
  s = act(s, 'globe', 'rotate');
  s = act(s, 'globe', 'choose', 'day');
  s = act(s, 'globe', 'choose', 'night');
  assert.deepEqual(s.tasks.globe.steps, ['day']);
  s = act(s, 'globe', 'rotate');
  s = act(s, 'globe', 'choose', 'night');
  s = collect(s, 'globe');
  for (let i = 0; i < 3; i++) {
    s = act(s, 'moon', 'position', String((i + 1) % 3));
    s = act(s, 'moon', 'choose', MOON_VIEWS[i]);
    assert.equal(s.tasks.moon.steps.length, i);
    s = act(s, 'moon', 'position', String(i));
    s = act(s, 'moon', 'choose', MOON_VIEWS[i]);
  }
  s = collect(s, 'moon');
  s = act(s, 'mission', 'choose', 'Return');
  assert.deepEqual(s.tasks.mission.steps, []);
  for (const card of FLIGHT) s = act(s, 'mission', 'choose', card);
  s = collect(s, 'mission');
  for (const f of fragmentList(s)) {
    s = act(s, 'beacon', 'choose', f.id);
    const before = s.tasks.beacon.steps.length;
    s = act(s, 'beacon', 'socket', f.id === 'cargo' ? 'solar' : 'cargo');
    assert.equal(s.tasks.beacon.steps.length, before);
    s = act(s, 'beacon', 'socket', f.id);
  }
  s = collect(s, 'beacon');
  assert.equal(s.fragments, 6);
  assert.equal(s.observations.length, 6);
  for (const id of ['solar', 'globe', 'moon', 'mission', 'beacon']) {
    s = collect(s, id);
    assert.equal(s.tasks[id].assisted, false);
  }
  assert.equal(s.fragments, 6);
  s = reduceQuest(s, { type: 'treasure' });
  assert.equal(s.treasure, true);
});

test('help and hints work at every table without bypassing reveal or collect; fresh mission clears all', () => {
  let s = cargo(createQuest(20));
  for (const id of ['solar', 'globe', 'moon', 'mission', 'beacon']) {
    for (let i = 0; i < 4; i++) s = act(s, id, 'hint');
    assert.equal(s.tasks[id].hint, 3);
    const count = s.fragments;
    s = act(s, id, 'assist');
    assert.equal(s.tasks[id].phase, 'completed');
    assert.equal(s.tasks[id].assisted, true);
    assert.equal(s.fragments, count);
    s = act(s, id, 'collect');
    assert.equal(s.fragments, count);
    s = collect(s, id);
    assert.equal(s.fragments, count + 1);
    assert.equal(taskView(s, id).actions.length, 0);
  }
  const fresh = createQuest(20);
  assert.equal(fresh.fragments, 0);
  assert.equal(fresh.treasure, false);
  assert.deepEqual(fresh.observations, []);
  assert.equal(fresh.memory, null);
  for (const t of Object.values(fresh.tasks)) {
    assert.deepEqual(t.steps, []);
    assert.equal(t.collected, false);
  }
});

test('memory rounds snapshot at most five unique inspected sources, preserve outcomes and never repeat', () => {
  let s = cargo(createQuest(38));
  for (const id of ['solar', 'globe', 'moon', 'mission', 'beacon'])
    s = collect(act(s, id, 'assist'), id);
  s = reduceQuest(s, { type: 'inspect-drawer' });
  s = reduceQuest(s, { type: 'inspect-prop', id: 'satellite' });
  s = reduceQuest(s, { type: 'inspect-prop', id: 'meteorite' });
  s = reduceQuest(s, { type: 'start-memory' });
  assert.equal(s.round.length, 5);
  assert.equal(new Set(s.round.map((q) => q.source)).size, 5);
  for (let i = 0; i < 5; i++) {
    const q = s.memory,
      record = s.observations.find((r) => r.id === q.source);
    assert.equal(q.answer, record.answer);
    assert.equal(q.options[q.correct], q.answer);
    assert.equal(new Set(q.options).size, q.options.length);
    assert.deepEqual(reduceQuest(s, { type: 'inspect-prop', id: 'satellite' }), s);
    if (i === 1) {
      s = reduceQuest(s, { type: 'look-again' });
      s = reduceQuest(s, { type: 'return-memory' });
    }
    s = reduceQuest(s, i === 2 ? { type: 'skip-memory' } : { type: 'answer', index: q.correct });
    const result = s.memory.result;
    s = reduceQuest(s, { type: 'start-memory' });
    assert.equal(s.memory.result, result);
    if (i < 4) s = reduceQuest(s, { type: 'next-memory' });
  }
  assert.equal(s.fragments, 6);
  const old = new Set([...s.memoryHistory, s.memory].map((q) => q.source));
  s = reduceQuest(s, { type: 'new-memory' });
  assert.equal(s.round.length, 4);
  assert.ok(s.round.every((q) => !old.has(q.source)));
  for (let i = 0; i < 4; i++) {
    s = reduceQuest(s, { type: 'skip-memory' });
    if (i < 3) s = reduceQuest(s, { type: 'next-memory' });
  }
  assert.deepEqual(reduceQuest(s, { type: 'new-memory' }), s);
  assert.equal(s.memoryHistory.length, 8);
});

test('optional discoveries are stable, explicit and independent of quest progression', () => {
  for (let seed = 0; seed < 6; seed++) {
    let s = createQuest(seed);
    assert.equal(s.observations.length, 0);
    for (const id of ['satellite', 'meteorite']) {
      const value = s.props[id].value;
      s = reduceQuest(s, { type: 'inspect-prop', id });
      s = reduceQuest(s, { type: 'inspect-prop', id });
      assert.equal(s.props[id].value, value);
      assert.equal(s.observations.filter((r) => r.id === id).length, 1);
    }
    assert.equal(s.fragments, 0);
  }
});
