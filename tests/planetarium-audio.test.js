import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanetAudio } from '../src/planetarium/audio.js';
test('planetarium loads only two supplied clips, cancels delayed steps, respects mute and cleans up sources', async () => {
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
      audio = createPlanetAudio(
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
    audio.celebrate();
    audio.walk(0.02);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(played.sort(), ['./audio/Hooray.m4a', './audio/footstep.wav'].sort());
    assert.deepEqual(events, ['hooray', 'walk']);
    audio.setMuted(true);
    assert.equal(stopped.length, 2);
    audio.celebrate();
    audio.walk(0.1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(played.length, 2);
    audio.setMuted(false);
    audio.walk(0.02);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(played.length, 3);
    assert.deepEqual(events, ['hooray', 'walk', 'walk']);
    audio.stopAll();
    assert.equal(stopped.length, 3);
    assert.equal(errors.length, 0);
    assert.equal(urls.length, 2);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});
