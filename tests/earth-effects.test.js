import test from 'node:test';
import assert from 'node:assert/strict';
import { createCometSchedule } from '../src/earth-explorer/ambience.js';
import { createEarthAudio } from '../src/earth-explorer/audio.js';

test('distant comets are occasional single passes and cancel during menus, quizzes or reduced motion', () => {
  const schedule = createCometSchedule(7);
  let active = schedule.tick(3.1, true);
  assert.ok(active);
  assert.ok(active.duration >= 8 && active.duration <= 12);
  assert.equal(schedule.tick(0.1, true), active);
  assert.equal(schedule.tick(0.1, false), null);
  assert.equal(schedule.tick(0, true), null);
  active = schedule.tick(40, true);
  assert.ok(active);
  assert.equal(schedule.tick(20, true), null);
  assert.equal(schedule.tick(0.1, true), null);
});

test('Earth footsteps and completion Hooray use supplied clips; muted or cancelled steps cannot play late', async () => {
  const previousWindow = globalThis.window,
    previousFetch = globalThis.fetch;
  const played = [],
    urls = [];
  let decode;
  const ready = new Promise((resolve) => (decode = resolve));
  class Context {
    state = 'running';
    destination = {};
    resume() {
      return Promise.resolve();
    }
    async decodeAudioData(bytes) {
      await ready;
      return { name: new TextDecoder().decode(bytes) };
    }
    createGain() {
      return { gain: {}, connect() {}, disconnect() {} };
    }
    createBufferSource() {
      const source = {
        connect() {},
        disconnect() {},
        start() {
          played.push(source.buffer.name);
        },
        stop() {
          source.onended?.();
        },
      };
      return source;
    }
  }
  globalThis.window = { AudioContext: Context };
  globalThis.fetch = async (url) => {
    urls.push(url);
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
  };
  const audio = createEarthAudio();
  try {
    audio.step();
    audio.stopAll();
    decode();
    await audio.unlock();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(played, []);
    audio.walk(0.1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(played, ['./audio/footstep.wav']);
    audio.walk(0);
    audio.celebrate();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(played.at(-1), './audio/Hooray.m4a');
    audio.setMuted(true);
    audio.step();
    audio.celebrate();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(played.length, 2);
    assert.deepEqual(urls.sort(), ['./audio/Hooray.m4a', './audio/footstep.wav'].sort());
  } finally {
    audio.stopAll();
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});
