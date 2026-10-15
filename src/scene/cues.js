import { PROP_COLORS } from '../data/props.js';

function node(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  element.append(...children);
  return element;
}

function box(position, size, color) {
  return node('a-box', { position, width: size[0], height: size[1], depth: size[2], color });
}

function cylinder(position, radius, height, color) {
  return node('a-cylinder', { position, radius, height, color });
}

function shape(propId, color) {
  switch (propId) {
    case 'book':
      return [
        box('0 0 0', [0.52, 0.13, 0.38], color),
        box('0 0.16 0', [0.48, 0.12, 0.35], '#f4ede0'),
        box('0 0.3 0', [0.52, 0.13, 0.38], color),
      ];
    case 'box':
      return [
        box('0 0.08 0', [0.5, 0.5, 0.5], color),
        box('0 0.35 0', [0.54, 0.06, 0.54], '#f5dba3'),
      ];
    case 'ball':
      return [node('a-sphere', { radius: '0.32', color })];
    case 'key':
      return [
        node('a-torus', {
          position: '-0.18 0.12 0',
          radius: '0.14',
          'radius-tubular': '0.045',
          color,
        }),
        box('0.12 0.12 0', [0.43, 0.08, 0.08], color),
        box('0.27 0.02 0', [0.08, 0.18, 0.08], color),
      ];
    case 'lock':
      return [
        box('0 -0.08 0', [0.45, 0.38, 0.23], color),
        node('a-torus', {
          position: '0 0.18 0',
          rotation: '0 0 180',
          radius: '0.16',
          'radius-tubular': '0.045',
          color: '#d9dee2',
        }),
        node('a-sphere', { position: '0 -0.08 0.13', radius: '0.035', color: '#293b4c' }),
      ];
    case 'clock':
      return [
        cylinder('0 0 0', 0.3, 0.1, color),
        node('a-circle', {
          position: '0 0.06 0',
          rotation: '-90 0 0',
          radius: '0.25',
          color: '#f7f2e7',
        }),
        box('0.04 0.07 0', [0.045, 0.03, 0.2], '#263746'),
      ];
    case 'battery':
      return [
        cylinder('0 0 0', 0.2, 0.55, color),
        cylinder('0 0.3 0', 0.09, 0.05, '#d9dee2'),
        box('0 0.03 0.19', [0.08, 0.18, 0.02], '#f7f2e7'),
      ];
    case 'gear': {
      const teeth = [];
      for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4;
        teeth.push(
          box(`${Math.cos(angle) * 0.29} ${Math.sin(angle) * 0.29} 0`, [0.15, 0.15, 0.1], color),
        );
      }
      return [
        node('a-cylinder', { rotation: '90 0 0', radius: '0.26', height: '0.1', color }),
        node('a-cylinder', {
          position: '0 0 0.06',
          rotation: '90 0 0',
          radius: '0.08',
          height: '0.02',
          color: '#f2eee4',
        }),
        ...teeth,
      ];
    }
    default:
      return [];
  }
}

export function renderCueProp(scene, locusId, cue, { animate = true } = {}) {
  scene.querySelectorAll('[data-cue-prop]').forEach((element) => element.remove());
  if (!cue) return;
  const group = scene.querySelector(`[data-locus-id="${locusId}"]`);
  if (!group) return;
  const root = node(
    'a-entity',
    { 'data-cue-prop': '', position: '0 1.65 0.72' },
    shape(cue.propId, PROP_COLORS[cue.colorId]),
  );
  if (animate) {
    if (cue.animationId === 'bounce')
      root.setAttribute(
        'animation',
        'property: position; from: 0 1.65 0.72; to: 0 1.91 0.72; dir: alternate; loop: true; dur: 600; easing: easeInOutSine',
      );
    if (cue.animationId === 'spin')
      root.setAttribute(
        'animation',
        'property: rotation; to: 0 360 0; loop: true; dur: 2600; easing: linear',
      );
    if (cue.animationId === 'pulse')
      root.setAttribute(
        'animation',
        'property: scale; from: 1 1 1; to: 1.22 1.22 1.22; dir: alternate; loop: true; dur: 850; easing: easeInOutSine',
      );
  }
  group.append(root);
}
