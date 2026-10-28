import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, LEARNING_FACTS } from '../src/planetarium/content.js';
import { newSession, reduceSession } from '../src/planetarium/state.js';
import { planetPanelAfter, planetInformation } from '../src/planetarium/presentation.js';
import { createMenuAnchor } from '../src/rooms/xr-menu.js';

const act = (state, type, id) => reduceSession(state, { type, id });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);

test('selecting any planet in VR opens its information without requiring a close-up', () => {
  for (const planet of PLANETS) {
    const state = act(newSession(7), 'planet', planet.id);
    assert.equal(state.inspection, null);
    assert.equal(planetPanelAfter('planet', state, true), 'detail');
    assert.deepEqual(planetInformation(state), {
      title: planet.order + ' · ' + planet.name,
      facts: LEARNING_FACTS[planet.id],
      inspection: false,
    });
    assert.ok(planetInformation(state).facts.length >= 2);
  }
});

test('optional close-up and its dismissal retain the selected planet information in VR', () => {
  let state = act(newSession(4), 'planet', 'saturn');
  state = act(state, 'inspect');
  assert.equal(planetPanelAfter('inspect', state, true), 'detail');
  assert.equal(planetInformation(state).inspection, true);
  assert.match(planetInformation(state).title, /Saturn/);
  state = act(state, 'close-inspect');
  assert.equal(planetPanelAfter('close-inspect', state, true), 'detail');
  assert.equal(planetInformation(state).inspection, false);
  assert.equal(state.focus, 'saturn');
});

test('desktop exploration retains its HTML information flow and invalid selections have no native card', () => {
  let state = act(newSession(3), 'planet', 'earth');
  for (const action of ['planet', 'inspect', 'close-inspect']) {
    state = act(state, action, 'earth');
    assert.equal(planetPanelAfter(action, state, false), null);
    assert.ok(planetInformation(state));
  }
  assert.equal(planetPanelAfter('planet', newSession(3), true), null);
  assert.equal(planetInformation(newSession(3)), null);
  assert.equal(planetInformation({ phase: 'explore', focus: 'unknown' }), null);
});

test('naming and quiz flows do not reveal learning facts through VR selection', () => {
  let state = act(newSession(2), 'ready');
  for (const planet of PLANETS) {
    state = act(state, 'planet', planet.id);
    for (const immersive of [false, true])
      assert.equal(planetPanelAfter('planet', state, immersive), 'cards');
    assert.equal(planetInformation(state), null);
    state = act(state, 'card', planet.id);
  }
  state = act(state, 'unassign');
  assert.equal(planetPanelAfter('unassign', state, true), 'cards');
  state = act(state, 'card', state.focus);
  state = act(state, 'submit-names');
  assert.equal(state.phase, 'naming-review');
  state = act(state, 'quiz-start');
  assert.equal(state.phase, 'quiz');
  for (const action of ['planet', 'inspect', 'close-inspect', 'unassign'])
    assert.equal(planetPanelAfter(action, state, true), null);
  assert.equal(planetInformation(state), null);
});

test('an information card opens near downward selection gaze and remains fixed during head movement', () => {
  let view = { position: [2, 4, 8], forward: [0, -Math.SQRT1_2, -Math.SQRT1_2] };
  const poses = [],
    anchor = createMenuAnchor(
      () => view,
      (pose) => poses.push(structuredClone(pose)),
    );
  anchor.show({ gaze: true, distance: 2, vertical: 0 });
  near(poses[0].position[0], 2);
  near(poses[0].position[1], 4 - Math.SQRT2);
  near(poses[0].position[2], 8 - Math.SQRT2);
  near(poses[0].rotation[0], -45);
  near(poses[0].rotation[1], 0);
  near(poses[0].rotation[2], 0);
  view = { position: [12, 6, 4], forward: [1, 0, 0] };
  anchor.show({ gaze: true });
  assert.equal(poses.length, 1, 'Redraw must not chase the user’s head');
  anchor.hide();
  anchor.show({ gaze: true });
  assert.equal(poses.length, 2);
  near(poses[1].rotation[1], -90);
});

test('information gaze tilt is bounded without roll and ordinary menus stay upright', () => {
  for (const [forward, expectedPitch] of [
    [[0, -1, 0], -55],
    [[0, 1, 0], 35],
    [[1, -1, 0], -45],
  ]) {
    let pose;
    const anchor = createMenuAnchor(
      () => ({ position: [0, 1.6, 0], forward }),
      (value) => (pose = value),
    );
    anchor.show({ gaze: true });
    near(pose.rotation[0], expectedPitch);
    near(pose.rotation[2], 0);
    assert.ok([...pose.position, ...pose.rotation].every(Number.isFinite));
    anchor.hide();
    anchor.show();
    near(pose.rotation[0], 0);
    near(pose.rotation[2], 0);
    near(pose.position[1], 1.55);
  }
});
