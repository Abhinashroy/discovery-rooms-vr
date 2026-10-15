import { randomSource } from './content.js';
// All paths stay above the exhibits and outside the 20 m Sun's full sphere.
export const PATHS = [
  { from: [-22, 24.6, 8], to: [22, 24.6, -2] },
  { from: [22, 24.6, 12], to: [-22, 24.6, 5] },
  { from: [-23.5, 13, -16], to: [-23.5, 20, 16] },
  { from: [23.5, 19, 16], to: [23.5, 12, -16] },
  { from: [-21, 16, 19.4], to: [21, 20, 19.4] },
];
export function createSchedule(seed) {
  const random = randomSource(seed);
  let waiting = 25 + random() * 20,
    active = null;
  return {
    tick(dt, enabled) {
      if (!enabled) {
        active = null;
        return null;
      }
      if (active) {
        active.elapsed += dt;
        if (active.elapsed >= active.duration) {
          active = null;
          waiting = 25 + random() * 20;
        }
      } else if ((waiting -= dt) <= 0)
        active = {
          ...PATHS[Math.floor(random() * PATHS.length)],
          kind: random() < 0.7 ? 'comet' : 'ufo',
          duration: 6 + random() * 4,
          elapsed: 0,
        };
      return active;
    },
    reset() {
      active = null;
      waiting = 25 + random() * 20;
    },
  };
}
