import test from 'node:test';
import assert from 'node:assert/strict';
import { createFootsteps, createGameAudio } from '../src/detective/audio.js';

test('footsteps follow distance at half-second full-speed intervals and stop on blocked movement', () => {
  let steps = 0,
    stops = 0;
  const feet = createFootsteps(
    () => steps++,
    () => stops++,
  );
  feet.update(0.02);
  assert.equal(steps, 1);
  for (let i = 0; i < 49; i++) feet.update(0.02);
  assert.equal(steps, 1);
  feet.update(0.02);
  assert.equal(steps, 2);
  feet.update(0);
  assert.equal(stops, 1);
  feet.update(0);
  assert.equal(stops, 1);
  feet.update(0.01);
  assert.equal(steps, 3); // New walking burst starts immediately.
  feet.reset();
  feet.update(0.01);
  assert.equal(steps, 4);
});

test('audio uses supplied files, cancels delayed steps, respects mute, and cleans up sources', async () => {
  const originalWindow = globalThis.window,
    originalFetch = globalThis.fetch;
  const urls = [],
    played = [],
    stopped = [];
  let release;
  const decoding = new Promise((resolve) => (release = resolve));
  class Context {
    state = 'running';
    destination = {};
    resume() {
      return Promise.resolve();
    }
    async decodeAudioData(bytes) {
      await decoding;
      return { name: new TextDecoder().decode(bytes) };
    }
    createGain() {
      return { gain: {}, connect() {}, disconnect() {} };
    }
    createBufferSource() {
      const s = {
        connect() {},
        disconnect() {},
        start() {
          played.push(s.buffer.name);
        },
        stop() {
          stopped.push(s.buffer.name);
          s.onended?.();
        },
      };
      return s;
    }
  }
  globalThis.window = { AudioContext: Context };
  globalThis.fetch = async (url) => {
    urls.push(url);
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
  };
  try {
    const errors = [],
      events = [],
      audio = createGameAudio(
        (e) => {
          if (e) errors.push(e);
        },
        (name) => events.push(name),
      );
    audio.walk(0.03);
    audio.walk(0); // Releasing input before decode must not emit a delayed thud.
    release();
    await audio.unlock();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(played, []);
    audio.start();
    audio.celebrate();
    audio.walk(0.02);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
      played.sort(),
      ['./audio/Hooray.m4a', './audio/footstep.wav', './audio/start.mp3'].sort(),
    );
    assert.deepEqual(events, ['start', 'hooray', 'walk']);
    audio.setMuted(true);
    assert.equal(stopped.length, 3);
    audio.start();
    audio.celebrate();
    audio.walk(0.1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(played.length, 3);
    audio.setMuted(false);
    audio.walk(0.02);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(played.length, 4);
    assert.deepEqual(events, ['start', 'hooray', 'walk', 'walk']);
    audio.stopAll();
    assert.equal(stopped.length, 4);
    assert.equal(errors.length, 0);
    assert.equal(urls.length, 3);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});
