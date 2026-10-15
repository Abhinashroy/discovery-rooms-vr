export const PROP_IDS = Object.freeze([
  'book',
  'box',
  'ball',
  'key',
  'lock',
  'clock',
  'battery',
  'gear',
]);
export const ANIMATION_IDS = Object.freeze(['none', 'bounce', 'spin', 'pulse']);
export const COLOR_IDS = Object.freeze(['red', 'blue', 'green', 'yellow', 'purple', 'orange']);

export const PROP_COLORS = Object.freeze({
  red: '#ce594f',
  blue: '#467fb2',
  green: '#4d9366',
  yellow: '#e8b744',
  purple: '#9068b0',
  orange: '#dc8a48',
});

export const EMPTY_CUE = Object.freeze({
  scene: '',
  meaningLink: '',
  propId: 'book',
  animationId: 'none',
  colorId: 'blue',
});
