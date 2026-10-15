import { LOCI } from '../data/loci.js';
import { mountSceneControls } from './interaction.js';

const COLORS = {
  wall: '#e8e4d9',
  floor: '#b4a68d',
  wood: '#926c50',
  darkWood: '#674c3c',
  blue: '#385f86',
  ink: '#25394b',
  cream: '#f8f2df',
  gold: '#f8bf59',
  green: '#447657',
  clay: '#ae694b',
};

function entity(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  for (const child of children) element.append(child);
  return element;
}

function box(position, size, color, clickable = false) {
  return entity('a-box', {
    position,
    width: size[0],
    height: size[1],
    depth: size[2],
    color,
    ...(clickable ? { class: 'landmark-hit' } : {}),
  });
}

function cylinder(position, radius, height, color, clickable = false) {
  return entity('a-cylinder', {
    position,
    radius,
    height,
    color,
    ...(clickable ? { class: 'landmark-hit' } : {}),
  });
}

function door() {
  return [
    box('0 1.38 0', [1.26, 2.76, 0.14], COLORS.darkWood, true),
    box('0 1.35 0.09', [1.05, 2.57, 0.05], COLORS.blue, true),
    box('0 2.08 0.13', [0.75, 0.65, 0.04], '#7fa5bd', true),
    entity('a-sphere', {
      position: '0.4 1.17 0.18',
      radius: '0.07',
      color: COLORS.gold,
      class: 'landmark-hit',
    }),
  ];
}

function desk() {
  return [
    box('0 0.79 0', [1.75, 0.16, 0.75], COLORS.wood, true),
    box('-0.68 0.39 -0.17', [0.12, 0.7, 0.12], COLORS.darkWood),
    box('0.68 0.39 -0.17', [0.12, 0.7, 0.12], COLORS.darkWood),
    box('-0.68 0.39 0.24', [0.12, 0.7, 0.12], COLORS.darkWood),
    box('0.68 0.39 0.24', [0.12, 0.7, 0.12], COLORS.darkWood),
    box('-0.48 0.48 0.32', [0.43, 0.36, 0.06], '#b48d6b', true),
    box('0.48 0.48 0.32', [0.43, 0.36, 0.06], '#b48d6b', true),
    entity('a-sphere', { position: '-0.48 0.49 0.36', radius: '0.035', color: COLORS.gold }),
    entity('a-sphere', { position: '0.48 0.49 0.36', radius: '0.035', color: COLORS.gold }),
  ];
}

function bookshelf() {
  const parts = [
    box('0 1.27 -0.04', [1.42, 2.52, 0.24], COLORS.darkWood, true),
    box('0 0.04 0.12', [1.42, 0.08, 0.42], COLORS.wood),
    box('0 0.92 0.12', [1.42, 0.08, 0.42], COLORS.wood),
    box('0 1.72 0.12', [1.42, 0.08, 0.42], COLORS.wood),
    box('0 2.48 0.12', [1.42, 0.08, 0.42], COLORS.wood),
    box('-0.67 1.27 0.12', [0.08, 2.52, 0.42], COLORS.wood),
    box('0.67 1.27 0.12', [0.08, 2.52, 0.42], COLORS.wood),
  ];
  const bookColors = ['#bd6a5c', '#4b7b8c', '#d2a54c', '#607c60', '#8d6a9e'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      parts.push(
        box(
          `${-0.48 + col * 0.24} ${0.5 + row * 0.8} 0.22`,
          [0.17, 0.55, 0.22],
          bookColors[(row + col) % bookColors.length],
          true,
        ),
      );
    }
  }
  return parts;
}

function windowLandmark() {
  return [
    box('0 1.68 0', [1.66, 1.65, 0.13], COLORS.darkWood, true),
    box('0 1.68 0.08', [1.48, 1.47, 0.05], '#8fc4d4', true),
    box('0 1.68 0.13', [0.09, 1.47, 0.07], COLORS.cream, true),
    box('0 1.68 0.13', [1.48, 0.09, 0.07], COLORS.cream, true),
    box('0 0.79 0.18', [1.9, 0.14, 0.35], COLORS.cream, true),
  ];
}

function plant() {
  const leaves = [
    [-0.24, 1.13, -0.06],
    [0.27, 1.26, 0.02],
    [-0.03, 1.55, -0.08],
    [0.03, 1.14, 0.26],
    [-0.21, 1.38, 0.2],
    [0.25, 1.55, -0.09],
  ];
  return [
    cylinder('0 0.34 0', 0.32, 0.62, COLORS.clay, true),
    cylinder('0 0.72 0', 0.045, 0.4, '#5e623b'),
    ...leaves.map(([x, y, z]) =>
      entity('a-sphere', {
        position: `${x} ${y} ${z}`,
        scale: '0.32 0.48 0.18',
        color: COLORS.green,
        class: 'landmark-hit',
      }),
    ),
  ];
}

function lamp() {
  return [
    cylinder('0 0.08 0', 0.32, 0.12, COLORS.ink, true),
    cylinder('0 1.03 0', 0.045, 1.9, COLORS.ink, true),
    entity('a-cone', {
      position: '0 2.12 0',
      'radius-bottom': '0.47',
      'radius-top': '0.22',
      height: '0.62',
      color: COLORS.gold,
      class: 'landmark-hit',
    }),
    entity('a-sphere', { position: '0 1.78 0', radius: '0.12', color: '#fff3b9' }),
  ];
}

const BUILDERS = { door, desk, bookshelf, window: windowLandmark, plant, lamp };

export function buildRoom(mount, onSelect, onAction = () => {}) {
  if (mount.querySelector('a-scene')) throw new Error('Room already mounted.');
  const scene = entity('a-scene', {
    embedded: '',
    renderer: 'antialias: true; colorManagement: true',
    background: 'color: #e9e5d9',
    'vr-mode-ui': 'enabled: true',
  });
  scene.append(
    entity('a-plane', {
      position: '0 0 -4.4',
      rotation: '-90 0 0',
      width: '15',
      height: '12',
      color: COLORS.floor,
    }),
    box('0 1.75 -6.55', [14.6, 3.5, 0.12], COLORS.wall),
    box('0 0.14 -6.44', [14.6, 0.28, 0.08], '#d0c8b9'),
    entity('a-light', { type: 'ambient', intensity: '0.95', color: '#ffffff' }),
    entity('a-light', {
      type: 'directional',
      intensity: '0.55',
      position: '-2 5 2',
      color: '#fff4de',
    }),
  );

  for (const locus of LOCI) {
    const group = entity('a-entity', {
      'data-locus-id': locus.id,
      position: `${locus.x} 0 ${locus.z}`,
    });
    const ring = entity('a-ring', {
      'data-highlight': '',
      position: '0 0.025 0.1',
      rotation: '-90 0 0',
      'radius-inner': '0.92',
      'radius-outer': '1.01',
      material: 'color: #426274; side: double; opacity: 0.5; transparent: true',
    });
    group.append(ring, ...BUILDERS[locus.id]());
    scene.append(group);
  }

  const camera = entity('a-entity', {
    id: 'route-camera',
    camera: 'active: true; fov: 90',
    position: '0 1.6 0',
    'look-controls': 'enabled: true; mouseEnabled: false; touchEnabled: false',
    cursor: 'rayOrigin: mouse',
    raycaster: 'objects: .landmark-hit, .xr-control-hit; far: 12',
  });
  scene.append(camera);
  scene.addEventListener('click', (event) => {
    const control = event.target.closest?.('[data-xr-action]');
    if (control) return onAction(control.dataset.xrAction);
    const group = event.target.closest?.('[data-locus-id]');
    if (group) onSelect(group.dataset.locusId);
  });
  scene.sceneControls = mountSceneControls(scene);
  mount.append(scene);
  return scene;
}

export function highlightLandmark(scene, locusId) {
  for (const group of scene.querySelectorAll('[data-locus-id]')) {
    const active = group.dataset.locusId === locusId;
    group.querySelector('[data-highlight]').setAttribute('material', {
      color: active ? COLORS.gold : '#426274',
      opacity: active ? 0.95 : 0.35,
      transparent: true,
      side: 'double',
    });
    group
      .querySelector('[data-highlight]')
      .setAttribute('scale', active ? '1.14 1.14 1.14' : '1 1 1');
  }
}
