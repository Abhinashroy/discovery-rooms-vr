import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, ANCHORS, MAIN } from '../src/exploration/catalog.js';
import {
  createSession,
  reduceSession,
  available,
  progress,
  canStand,
  move,
  pathTo,
  summary,
} from '../src/exploration/state.js';
function finish(s, id) {
  for (const step of THEMES[s.theme].tasks[id].steps) {
    s = reduceSession(s, { type: 'select', id, value: step.answer });
    s = reduceSession(s, { type: 'use', id });
  }
  return s;
}
for (const theme of Object.keys(THEMES)) {
  test(`${theme}: both branch orders complete main hunt without optional quests; repeated use cannot reward twice`, () => {
    for (const branches of [
      ['branchA', 'branchB'],
      ['branchB', 'branchA'],
    ]) {
      let s = createSession(theme, 24);
      assert.equal(available(s, 'synthesis'), false);
      assert.deepEqual(reduceSession(s, { type: 'assist', id: 'finale' }), s);
      s = finish(s, 'arrival');
      assert.ok(available(s, 'branchA') && available(s, 'branchB'));
      s = finish(s, branches[0]);
      assert.equal(available(s, 'synthesis'), false);
      s = finish(s, branches[1]);
      assert.ok(available(s, 'synthesis'));
      s = finish(s, 'synthesis');
      s = finish(s, 'finale');
      assert.equal(progress(s), 5);
      assert.equal(s.treasure, true);
      assert.equal(s.tasks.sideA.done, false);
      assert.equal(s.tasks.sideB.done, false);
      assert.deepEqual(reduceSession(s, { type: 'use', id: 'finale' }), s);
      s = finish(s, 'sideA');
      s = finish(s, 'sideB');
      assert.ok(s.tasks.sideA.done && s.tasks.sideB.done && s.treasure);
    }
  });
  test(`${theme}: debrief uses acknowledged concepts and explicit snapshots; recall freezes hidden evidence`, () => {
    let s = createSession(theme, 123);
    assert.equal(reduceSession(s, { type: 'start-quiz' }).quiz, null);
    for (const id of MAIN) s = finish(s, id);
    assert.equal(s.records.length, 0);
    for (const id of ['branchA', 'branchB', 'synthesis'])
      s = reduceSession(s, { type: 'acknowledge', id });
    for (let i = 0; i < 3; i++) s = reduceSession(s, { type: 'inspect', id: i });
    assert.equal(s.records.length, 6);
    s = reduceSession(s, { type: 'inspect', id: 0 });
    assert.equal(s.records.length, 6);
    s = reduceSession(s, { type: 'start-quiz', mode: 'mixed' });
    assert.equal(s.quiz.questions.length, 5);
    assert.equal(new Set(s.quiz.questions.map((q) => q.id)).size, 5);
    assert.equal(s.quiz.questions.filter((q) => q.category === 'concept').length, 3);
    for (const q of s.quiz.questions) {
      assert.equal(q.choices.filter((c) => c === q.answer).length, 1);
      assert.equal(new Set(q.choices).size, q.choices.length);
      assert.ok(!q.id.includes('side'));
    }
    for (const action of [
      { type: 'inspect', id: 0 },
      { type: 'rotate-lens', id: 0 },
      { type: 'assist', id: 'sideA' },
      { type: 'return-item' },
    ])
      assert.deepEqual(reduceSession(s, action), s);
    s = reduceSession(s, { type: 'look' });
    assert.equal(s.quiz.questions[0].assisted, true);
    const answer = s.quiz.questions[0].answer;
    assert.equal(
      reduceSession(s, { type: 'answer', value: answer }).quiz.questions[0].result,
      null,
    );
    s = reduceSession(s, { type: 'return' });
    s = reduceSession(s, { type: 'answer', value: answer });
    assert.equal(
      summary(s).reduce((n, r) => n + r.assisted, 0),
      1,
    );
    while (s.quiz.index < s.quiz.questions.length - 1) {
      s = reduceSession(s, { type: 'next' });
      s = reduceSession(s, { type: 'skip' });
    }
    s = reduceSession(s, { type: 'end-quiz' });
    assert.equal(s.quiz, null);
    assert.ok(s.treasure);
  });
}
test('wrong actions, pocket recovery and worked assistance preserve prior steps', () => {
  let s = createSession('space', 5);
  s = reduceSession(s, { type: 'select', id: 'arrival', value: 'Food capsule' });
  s = reduceSession(s, { type: 'use', id: 'arrival' });
  assert.equal(s.tasks.arrival.step, 0);
  assert.equal(s.pocket, null);
  s = reduceSession(s, { type: 'select', id: 'arrival', value: 'Water capsule' });
  s = reduceSession(s, { type: 'return-item' });
  assert.equal(s.pocket, null);
  s = reduceSession(s, { type: 'assist', id: 'arrival' });
  assert.ok(s.tasks.arrival.done && s.tasks.arrival.assisted);
  s = reduceSession(s, { type: 'inspect', id: 1 });
  const snapshot = structuredClone(s.records[0]);
  s = reduceSession(s, { type: 'rotate-lens', id: 1 });
  assert.deepEqual(s.records[0], snapshot);
  s = reduceSession(s, { type: 'start-quiz', mode: 'memory' });
  assert.equal(s.quiz.questions.length, 1);
  assert.equal(s.quiz.questions[0].category, 'observation');
});
test('new layout shares collision and landmark geometry; every destination is reachable', () => {
  const start = { x: 0, z: 5.7 };
  for (const a of Object.values(ANCHORS)) {
    assert.ok(canStand(a.approach.x, a.approach.z));
    const path = pathTo(start, a.approach);
    assert.ok(path.length, `unreachable ${a.label}`);
    assert.ok(path.every((p) => canStand(p.x, p.z)));
  }
  assert.equal(canStand(0, -0.4), false);
  assert.equal(canStand(7, 0), false);
  const p = move(start, 0, -20);
  assert.ok(canStand(p.x, p.z));
  assert.ok(p.z > 0.7);
});
test('switching via a fresh session has no cross-theme evidence or progress', () => {
  let s = finish(createSession('space', 4), 'arrival');
  s = reduceSession(s, { type: 'inspect', id: 0 });
  const next = createSession('ocean', 4);
  assert.equal(next.records.length, 0);
  assert.equal(progress(next), 0);
  assert.equal(next.pocket, null);
  assert.notEqual(next.props[0].value, s.props[0].value);
});
