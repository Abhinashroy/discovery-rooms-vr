export const PRESETS = {
  emblem: ['Star', 'Leaf', 'Lightning'],
  companion: ['Robot', 'Owl', 'Cat'],
  palette: ['Plum', 'Teal', 'Copper'],
};
export const DEFAULT_PROFILE = { emblem: 'Star', companion: 'Robot', palette: 'Plum' };
export const ACCENTS = { Plum: '#654078', Teal: '#195e65', Copper: '#824323' };
export function profileFor(value = {}) {
  return Object.fromEntries(
    Object.entries(PRESETS).map(([key, list]) => [
      key,
      list.includes(value[key]) ? value[key] : DEFAULT_PROFILE[key],
    ]),
  );
}
