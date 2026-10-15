import { createPlanetAudio } from '../planetarium/audio.js';
// The same supplied clips as Planetarium; no duplicate trim or new recordings.
export function createEarthAudio(report = () => {}, played = () => {}) {
  const audio = createPlanetAudio(report, played);
  let stepTimer;
  const stop = () => {
    clearTimeout(stepTimer);
    stepTimer = undefined;
    audio.stopAll();
  };
  return {
    ...audio,
    walk(distance) {
      if (!stepTimer) audio.walk(distance);
    },
    step() {
      clearTimeout(stepTimer);
      audio.stopWalking();
      audio.walk(0.01);
      stepTimer = setTimeout(() => {
        stepTimer = undefined;
        audio.stopWalking();
      }, 400);
    },
    stopWalking() {
      if (!stepTimer) audio.stopWalking();
    },
    stopAll: stop,
    setMuted(value) {
      if (value) stop();
      audio.setMuted(value);
    },
  };
}
