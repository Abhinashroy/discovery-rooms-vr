// One metre per step = 0.5 seconds at the room's normal 2 m/s walking speed.
// Measure travelled distance, so diagonal input, sliding and collisions stay honest.
export function createFootsteps(play, stop) {
  let walking = false,
    distance = 0;
  return {
    update(travelled) {
      if (!(travelled > 0)) {
        if (walking) stop();
        walking = false;
        distance = 0;
        return;
      }
      if (!walking) {
        walking = true;
        distance = 0;
        play();
      } else {
        distance += travelled;
        if (distance >= 1) {
          distance %= 1;
          play();
        }
      }
    },
    reset() {
      walking = false;
      distance = 0;
      stop();
    },
  };
}

export function createGameAudio(report = () => {}, onPlayback = () => {}) {
  const files = {
    start: './audio/start.mp3',
    hooray: './audio/Hooray.m4a',
    walk: './audio/footstep.wav',
  };
  const data = Object.fromEntries(
    Object.entries(files).map(([name, url]) => [
      name,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error('Audio missing');
          return r.arrayBuffer();
        })
        .catch(() => null),
    ]),
  );
  let context,
    loading,
    muted = false;
  const buffers = {},
    active = new Map(),
    tokens = { start: 0, hooray: 0, walk: 0 };
  function stop(name) {
    tokens[name]++;
    active.get(name)?.stop();
    active.delete(name);
  }
  async function unlock() {
    try {
      if (!context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) throw new Error('Audio unsupported');
        context = new Context();
      }
      // Called directly from Play, keyboard and controller gestures.
      const resumed = context.resume();
      loading ??= Promise.all(
        Object.keys(files).map(async (name) => {
          const bytes = await data[name];
          if (bytes)
            try {
              buffers[name] = await context.decodeAudioData(bytes);
            } catch {}
        }),
      );
      await Promise.all([resumed, loading]);
    } catch {
      report('Sound could not play; you can still complete the game.');
    }
  }
  async function play(name) {
    if (muted) return;
    stop(name);
    const token = tokens[name];
    await unlock();
    if (muted || token !== tokens[name]) return;
    if (!buffers[name] || context?.state !== 'running') {
      report('Sound could not play; you can still complete the game.');
      return;
    }
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffers[name];
    gain.gain.value = name === 'walk' ? 0.45 : 0.8;
    source.connect(gain);
    gain.connect(context.destination);
    active.set(name, source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (active.get(name) === source) active.delete(name);
    };
    source.start();
    onPlayback(name);
  }
  const footsteps = createFootsteps(
    () => play('walk'),
    () => stop('walk'),
  );
  return {
    unlock,
    start() {
      report('');
      play('start');
    },
    celebrate() {
      report('');
      play('hooray');
    },
    walk(distance) {
      if (muted) footsteps.reset();
      else footsteps.update(distance);
    },
    setMuted(value) {
      if (muted === value) return;
      muted = value;
      if (muted) this.stopAll();
    },
    stopWalking() {
      footsteps.reset();
    },
    stopAll() {
      footsteps.reset();
      for (const name of Object.keys(files)) stop(name);
    },
  };
}
