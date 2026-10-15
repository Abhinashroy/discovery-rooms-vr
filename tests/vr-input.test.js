import test from 'node:test';
import assert from 'node:assert/strict';
import { readVRInput } from '../src/discovery/vr-input.js';
const controller = (handedness, axes, pressed = false) => ({
  handedness,
  gamepad: {
    mapping: 'xr-standard',
    axes,
    buttons: Array.from({ length: 6 }, (_, i) => ({ pressed: i === 5 && pressed })),
  },
});
test('Quest sticks use reserved XR axes, with independent move, turn and menu', () => {
  assert.deepEqual(
    readVRInput([controller('left', [0, 0, 0.6, -1]), controller('right', [0, 0, 0.9, 0], true)]),
    { x: 0.6, y: -1, turn: 0.9, menu: true },
  );
});
test('controller loss and deadzone stop movement; nonstandard inputs are ignored', () => {
  assert.deepEqual(readVRInput(), { x: 0, y: 0, turn: 0, menu: false });
  assert.equal(readVRInput([controller('left', [1, 1, 0.1, -0.1])]).y, 0);
  assert.equal(
    readVRInput([{ handedness: 'left', gamepad: { mapping: '', axes: [1, 1, 1, 1] } }]).x,
    0,
  );
});
