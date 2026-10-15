import { randomSource } from '../planetarium/content.js';
// Decorative paths in a distant sky; deliberately unrelated to simulation time.
export function createCometSchedule(seed) {
  const random = randomSource(seed);
  let delay = 3,
    active = null;
  return {
    tick(dt, enabled) {
      if (!enabled) {
        if (active) {
          active = null;
          delay = 14 + random() * 18;
        }
        return null;
      }
      if (active) {
        active.elapsed += dt;
        if (active.elapsed >= active.duration) {
          active = null;
          delay = 14 + random() * 18;
        }
      } else if ((delay -= Math.max(0, dt)) <= 0) {
        const reverse = random() < 0.5;
        active = {
          elapsed: 0,
          duration: 8 + random() * 4,
          from: reverse ? 240 : -240,
          to: reverse ? -240 : 240,
          height: random() * 25,
        };
      }
      return active;
    },
  };
}
