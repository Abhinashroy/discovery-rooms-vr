import { createWorkshopScene } from './workshop-world.js';
import { readVRInput } from './vr-input.js';
import { profileFor, ACCENTS } from './personalization.js';
import { TABLES, DESTINATIONS, SUPPLIES, DISCOVERY, PROPS } from './adventure.js';
import { canStand, movePlayer, approachPoint, findPath } from './navigation.js';
import { taskView, DETAILS, PLANETS, FLIGHT, fragmentList, collected, unlocked } from './space.js';
import { createOceanScene } from './ocean-world.js';

const node = (tag, attrs = {}, children = []) => {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.append(...children);
  return element;
};
const box = (position, size, color, attrs = {}) =>
  node('a-box', { position, width: size[0], height: size[1], depth: size[2], color, ...attrs });
const sphere = (position, radius, color, attrs = {}) =>
  node('a-sphere', {
    position,
    radius,
    color,
    'segments-width': 20,
    'segments-height': 12,
    ...attrs,
  });
const paint = new Map();
function texture(text, background, foreground) {
  const key = JSON.stringify([text, background, foreground]);
  if (paint.has(key)) return paint.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 320);
  const size = text.length > 95 ? 35 : text.length > 40 ? 44 : text.length > 20 ? 58 : 85;
  ctx.font = `700 ${size}px Segoe UI, sans-serif`;
  ctx.fillStyle = foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 944) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  const height = Math.min(size * 1.3, 290 / lines.length);
  lines.forEach((line, i) => ctx.fillText(line, 512, 160 + (i - (lines.length - 1) / 2) * height));
  const result = canvas.toDataURL();
  paint.set(key, result);
  return result;
}
function sign(
  text,
  position,
  width = 2,
  height = 0.45,
  bg = '#f6ede0',
  color = '#302d52',
  attrs = {},
) {
  return node('a-plane', {
    position,
    width,
    height,
    material: { shader: 'flat', src: texture(text, bg, color), side: 'double' },
    ...attrs,
  });
}
const action = (intent, destination) => ({
  class: 'room-action selectable',
  'data-intent': intent,
  ...(destination ? { 'data-destination': destination } : {}),
});
function shape(kind, position, color, scale = 0.2) {
  if (kind === 'circle') return sphere(position, scale, color);
  if (kind === 'triangle')
    return node('a-cone', {
      position,
      'radius-bottom': scale * 1.2,
      'radius-top': 0,
      height: scale * 2.1,
      'segments-radial': 3,
      color,
    });
  return box(position, [scale * 1.6, scale * 1.6, scale * 1.6], color);
}
function rocket(position, scale = 1) {
  return node('a-entity', { position, scale: `${scale} ${scale} ${scale}` }, [
    node('a-cylinder', {
      position: '0 .65 0',
      radius: 0.28,
      height: 1.05,
      color: '#f9eee0',
      'segments-radial': 20,
    }),
    node('a-cone', {
      position: '0 1.35 0',
      'radius-bottom': 0.28,
      'radius-top': 0,
      height: 0.42,
      color: '#f17a56',
    }),
    sphere('0 .8 .24', 0.13, '#496c90'),
    box('-.31 .26 0', [0.18, 0.55, 0.27], '#d391d7', { rotation: '0 0 -18' }),
    box('.31 .26 0', [0.18, 0.55, 0.27], '#d391d7', { rotation: '0 0 18' }),
    node('a-cone', {
      position: '0 -.01 0',
      'radius-bottom': 0.06,
      'radius-top': 0.2,
      height: 0.4,
      color: '#ffc96e',
    }),
  ]);
}
function tokenModel(name) {
  const group = node('a-entity');
  if (name === 'Tiny rocket' || name === 'Rocket') group.append(rocket('0 0 0', 0.42));
  else if (name === 'Moon' || name === 'Sun')
    group.append(sphere('0 .2 0', 0.18, name === 'Sun' ? '#ffd06b' : '#c9bfd6'));
  else if (name === 'Diamond')
    group.append(node('a-octahedron', { position: '0 .2 0', radius: 0.21, color: '#b5d5dc' }));
  else if (name === 'Wave')
    group.append(
      node('a-torus', {
        position: '0 .2 0',
        radius: 0.19,
        'radius-tubular': 0.035,
        arc: 180,
        color: '#83d0db',
      }),
    );
  else if (name === 'Crystal')
    group.append(
      node('a-octahedron', {
        position: '0 .2 0',
        radius: 0.27,
        color: '#a387df',
        rotation: '0 20 12',
      }),
    );
  else if (name === 'Compass') {
    group.append(
      node('a-cylinder', { position: '0 .15 0', radius: 0.26, height: 0.09, color: '#edb763' }),
      box('0 .24 0', [0.04, 0.04, 0.35], '#c8585c', { rotation: '0 30 0' }),
    );
  } else if (name === 'Ringed planet')
    group.append(
      sphere('0 .2 0', 0.19, '#bf9be1'),
      node('a-torus', {
        position: '0 .2 0',
        radius: 0.31,
        'radius-tubular': 0.025,
        color: '#f7bd65',
        rotation: '65 0 0',
      }),
    );
  else if (name === 'Comet')
    group.append(
      sphere('-.1 .22 0', 0.17, '#ffd37e'),
      node('a-cone', {
        position: '.16 .33 0',
        'radius-bottom': 0.12,
        'radius-top': 0,
        height: 0.55,
        color: '#f18c62',
        rotation: '0 0 -58',
      }),
    );
  else {
    for (let i = 0; i < 5; i++)
      group.append(box('0 .23 0', [0.1, 0.52, 0.08], '#ffd071', { rotation: `0 0 ${i * 36}` }));
  }
  return group;
}

export function createDiscoveryWorld(mount, callbacks) {
  const AFRAME = window.AFRAME;
  if (!AFRAME) throw new Error('The local 3D runtime could not load.');
  if (!AFRAME.components['discovery-movement'])
    AFRAME.registerComponent('discovery-movement', {
      init() {
        this.keys = new Set();
        this.stick = { x: 0, y: 0 };
        this.turnReady = true;
        this.lastReport = 0;
        this.down = (event) => {
          if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.ctrlKey || event.metaKey)
            return;
          const scene = this.el.sceneEl;
          if (
            scene.dataset.started !== 'true' ||
            scene.dataset.paused === 'true' ||
            scene.dataset.stationary === 'true'
          )
            return;
          const directions = {
            KeyW: [0, 1],
            KeyS: [0, -1],
            KeyA: [-1, 0],
            KeyD: [1, 0],
            ArrowUp: [0, 1],
            ArrowDown: [0, -1],
          };
          if (event.code.startsWith('Arrow')) event.preventDefault();
          if (!this.keys.has(event.code) && directions[event.code] && !scene.is('vr-mode'))
            this.step(...directions[event.code], 0.09);
          this.keys.add(event.code);
        };
        this.up = (event) => this.keys.delete(event.code);
        this.blur = () => {
          this.keys.clear();
          this.stick = { x: 0, y: 0 };
        };
        window.addEventListener('keydown', this.down);
        window.addEventListener('keyup', this.up);
        window.addEventListener('blur', this.blur);
      },
      step(side, forward, amount) {
        const camera = this.el.querySelector('[camera]');
        if (!camera) return;
        const direction = new AFRAME.THREE.Vector3(0, 0, -1).applyQuaternion(
          camera.object3D.getWorldQuaternion(new AFRAME.THREE.Quaternion()),
        );
        direction.y = 0;
        direction.normalize();
        const head = camera.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
        const p = movePlayer(
          head,
          (direction.x * forward - direction.z * side) * amount,
          (direction.z * forward + direction.x * side) * amount,
        );
        this.el.object3D.position.x += p.x - head.x;
        this.el.object3D.position.z += p.z - head.z;
      },
      tick(time, delta) {
        const scene = this.el.sceneEl,
          camera = this.el.querySelector('[camera]');
        if (!camera) return;
        const input = readVRInput(scene.renderer?.xr?.getSession()?.inputSources);
        this.stick = scene.is('vr-mode') ? { x: input.x, y: input.y } : { x: 0, y: 0 };
        if (input.menu && !this.menuHeld) this.el.emit('vr-menu-toggle');
        this.menuHeld = input.menu;
        const paused =
          scene.dataset.started !== 'true' ||
          scene.dataset.paused === 'true' ||
          scene.dataset.stationary === 'true';
        if (Math.abs(input.turn) < 0.3) this.turnReady = true;
        if (!paused && scene.is('vr-mode') && Math.abs(input.turn) > 0.7 && this.turnReady) {
          const before = camera.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
          this.el.object3D.rotation.y -= (Math.sign(input.turn) * Math.PI) / 6;
          this.el.object3D.updateMatrixWorld(true);
          const after = camera.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
          this.el.object3D.position.x += before.x - after.x;
          this.el.object3D.position.z += before.z - after.z;
          this.turnReady = false;
        }
        if (paused) this.keys.clear();
        else {
          const dt = Math.min(delta || 0, 50) / 1000,
            look = camera.components['look-controls']?.yawObject;
          if (!scene.is('vr-mode') && look) {
            if (this.keys.has('ArrowLeft')) look.rotation.y += dt * 1.3;
            if (this.keys.has('ArrowRight')) look.rotation.y -= dt * 1.3;
          }
          const forward =
            Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
            Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
            this.stick.y;
          const side = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.stick.x;
          if (forward || side)
            this.step(
              side,
              forward,
              ((scene.is('vr-mode') ? 1.35 : 2.2) * dt) / Math.max(1, Math.hypot(side, forward)),
            );
        }
        if (time - this.lastReport > 150) {
          this.lastReport = time;
          const head = camera.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
          this.el.dataset.playerX = head.x.toFixed(3);
          this.el.dataset.playerZ = head.z.toFixed(3);
          this.el.emit('player-moved', { x: head.x, z: head.z });
        }
      },
      remove() {
        window.removeEventListener('keydown', this.down);
        window.removeEventListener('keyup', this.up);
        window.removeEventListener('blur', this.blur);
      },
    });

  const scene = node('a-scene', {
    embedded: '',
    renderer: 'antialias: true; colorManagement: true',
    background: 'color: #292640',
    'xr-mode-ui': 'enabled: false',
    'loading-screen': 'enabled: false',
  });
  const room = node('a-entity', { id: 'room-contents' });
  scene.append(room);
  room.append(
    box('0 -.15 0', [14, 0.3, 14], '#ded9d1'),
    box('0 2.4 -7', [14, 4.8, 0.2], '#9aabd0'),
    box('-7 2.4 0', [0.2, 4.8, 14], '#b9b4ce'),
    box('7 2.4 0', [0.2, 4.8, 14], '#b9b4ce'),
    box('0 2.4 7', [14, 4.8, 0.2], '#b4afc8'),
    box('0 4.8 0', [14, 0.15, 14], '#d4ccd8'),
  );
  scene.append(
    node('a-light', { type: 'ambient', intensity: 1.5, color: '#fff5e9' }),
    node('a-light', { type: 'directional', position: '1 5 6', intensity: 1.7, color: '#fff0de' }),
  );
  for (let n = -6; n <= 6; n += 2) {
    room.append(
      box(`${n} .005 0`, [0.016, 0.01, 14], '#c8c4cb'),
      box(`0 .005 ${n}`, [14, 0.01, 0.016], '#c8c4cb'),
    );
  }
  for (const x of [-6, 0, 6])
    room.append(
      box(`${x} 4.62 0`, [0.16, 0.06, 12], '#fff4db', { material: 'shader: flat; color: #fff4db' }),
    );
  const spaceRoom = node('a-entity', { 'data-adventure': 'space' });
  room.append(spaceRoom);
  // Three portholes form recognizable landmarks; all adventure scenery remains inside one room.
  for (const x of [-4.6, 0, 4.6]) {
    spaceRoom.append(
      node('a-circle', {
        position: `${x} 2.9 -6.86`,
        radius: 1.12,
        color: '#34385e',
        material: 'shader: flat; color: #34385e',
      }),
      node('a-torus', {
        position: `${x} 2.9 -6.8`,
        radius: 1.16,
        'radius-tubular': 0.08,
        color: '#eee4e0',
      }),
    );
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4,
        r = 0.3 + (i % 3) * 0.23;
      spaceRoom.append(
        sphere(`${x + Math.cos(a) * r} ${2.9 + Math.sin(a) * r} -6.78`, 0.018, '#f9dc9d', {
          material: 'shader: flat; color: #f9dc9d',
        }),
      );
    }
  }
  spaceRoom.append(sign('SPACE RESCUE', '0 4.13 -6.78', 4.2, 0.55, '#34385e', '#fff1d5'));
  spaceRoom.append(
    sign(
      'DISCOVERY ROOM\nOne room. A universe of ideas.',
      '0 3.2 6.83',
      4.6,
      0.9,
      '#514668',
      '#fff1d5',
      { rotation: '0 180 0' },
    ),
  );
  const tableNodes = new Map();
  for (const table of TABLES) {
    const group = node('a-entity', { position: `${table.x} 0 ${table.z}`, 'data-table': table.id });
    const tint = table.available ? '#f29168' : '#8885ac';
    group.append(
      box('0 .52 0', [1.85, 1.04, 0.85], '#f1e5d9'),
      box('0 1.06 0', [2.4, 0.14, 1.35], tint),
      box('0 .15 .01', [1.65, 0.18, 0.72], '#a6a0b6'),
    );
    group.append(
      sign(
        `${table.icon} / ${table.title}`,
        '0 .65 .435',
        1.8,
        0.32,
        '#f8eddf',
        '#39344c',
        action(`open:${table.id}`, table.id),
      ),
    );
    if (table.available)
      group.append(
        sign(
          '01 / CARGO LAUNCH',
          '0 2.72 -.5',
          2.7,
          0.54,
          '#f29168',
          '#332f49',
          action('open:cargo', 'cargo'),
        ),
      );
    else
      group.append(
        sign(
          `${table.icon} / SPACE RESCUE`,
          '0 2.85 -.5',
          2.5,
          0.35,
          '#e5dded',
          '#554a68',
          action(`open:${table.id}`, table.id),
        ),
      );
    const ring = node('a-ring', {
      position: '0 .02 0',
      rotation: '-90 0 0',
      'radius-inner': 1.37,
      'radius-outer': 1.4,
      material: { shader: 'flat', color: tint },
    });
    group.append(ring);
    spaceRoom.append(group);
    tableNodes.set(table.id, { group, ring });
    const p = approachPoint(table);
    spaceRoom.append(
      node('a-circle', {
        position: `${p.x} .02 ${p.z}`,
        rotation: '-90 0 0',
        radius: 0.33,
        material: { shader: 'flat', color: tint, opacity: 0.6, transparent: true },
        ...action(`teleport:${table.id}`),
      }),
    );
  }
  const challengeModels = new Map();
  for (const table of TABLES.slice(1)) {
    const group = node('a-entity');
    tableNodes.get(table.id).group.append(group);
    challengeModels.set(table.id, group);
  }
  const treasure = node('a-entity', { position: '0 0 6.75', rotation: '0 180 0' });
  spaceRoom.append(treasure);
  const propGroups = new Map(
    PROPS.map((p) => {
      const group = node('a-entity', { position: `${p.x} 0 ${p.z}` });
      spaceRoom.append(group);
      return [p.id, group];
    }),
  );

  function renderChallenges(state) {
    for (const table of TABLES.slice(1)) {
      const id = table.id,
        t = state.tasks[id],
        group = challengeModels.get(id),
        view = taskView(state, id);
      group.replaceChildren();
      const tint = collected(state, id) ? '#82c1ac' : unlocked(state, id) ? '#eead78' : '#aaa0bc';
      group.append(
        sign(view.text, '0 2.43 -.35', 2.5, 0.48, '#f7eedf', '#3a3050', action(`open:${id}`, id)),
      );
      if (id === 'solar') {
        group.append(sphere(`${t.collected ? 0 : -1} 1.65 -.2`, 0.19, '#ffc86e'));
        const orbit = node('a-entity', { position: '0 1.65 -.2' });
        group.append(orbit);
        for (let i = 0; i < 4; i++) {
          const x = -0.55 + i * 0.45,
            placed = t.steps.includes(PLANETS[i]);
          orbit.append(
            sphere(
              t.collected
                ? `${Math.cos(i * 1.5) * (0.3 + i * 0.17)} 0 ${Math.sin(i * 1.5) * (0.3 + i * 0.17)}`
                : `${x} 0 0`,
              placed ? 0.09 : 0.045,
              ['#b5a6a1', '#e6c298', '#72c1dc', '#dc8764'][i],
            ),
          );
          group.append(
            sign(placed ? `${i + 1} ${PLANETS[i]}` : String(i + 1), `${x} 1.28 .03`, 0.43, 0.15),
          );
        }
        if (t.collected && !settings.reducedMotion)
          orbit.setAttribute(
            'animation',
            `property: rotation; to: 0 360 0; loop: true; dur: 28000; easing: linear; pauseEvents: pause-orbit; resumeEvents: resume-orbit; autoplay: ${!paused}`,
          );
      } else if (id === 'globe') {
        group.append(
          sphere('-.95 1.7 -.2', 0.19, '#ffd079'),
          sign('SUN →', '-.95 1.32 .08', 0.5, 0.18),
        );
        const earth = node('a-entity', {
          position: '0 1.7 -.2',
          rotation: `0 ${t.orientation ? 180 : 0} 0`,
        });
        earth.append(
          sphere('0 0 0', 0.36, '#6bafcb'),
          sphere('-.35 0 .1', 0.08, t.orientation ? '#ffdf7d' : '#f2a178'),
          box('-.38 .06 .09', [0.08, 0.1, 0.08], t.orientation ? '#fff2af' : '#8c6761'),
        );
        group.append(earth);
        group.append(
          sign(
            `Marked town: ${t.orientation ? 'NIGHT / lights on' : 'DAY / faces Sun'}`,
            '0 1.2 .05',
            1.65,
            0.2,
          ),
        );
      } else if (id === 'moon') {
        group.append(
          sphere('-.95 1.7 -.2', 0.17, '#ffd079'),
          sphere('0 1.55 -.2', 0.16, '#6eafcb'),
        );
        const positions = [
            [-0.53, 1.55, -0.2],
            [0, 1.55, -0.7],
            [0.53, 1.55, -0.2],
          ],
          p = positions[t.position];
        group.append(sphere(p.join(' '), 0.1, '#d1c8d5'), sign('SUN →', '-.95 1.35 0', 0.45, 0.16));
        group.append(
          node('a-circle', {
            position: '.65 1.95 .04',
            radius: 0.2,
            material: 'shader: flat; color: #292838',
          }),
        );
        if (t.position > 0)
          group.append(
            node('a-circle', {
              position: '.65 1.95 .045',
              radius: 0.195,
              'theta-start': t.position === 1 ? -90 : 0,
              'theta-length': t.position === 1 ? 180 : 360,
              material: 'shader: flat; color: #fff0c9',
            }),
          );
        group.append(
          sign(
            `Earth view: ${['dark', 'right half lit', 'fully lit'][t.position]}`,
            '0 1.16 .08',
            1.9,
            0.19,
          ),
        );
      } else if (id === 'mission') {
        for (let i = 0; i < 4; i++) {
          const x = -0.84 + i * 0.56;
          group.append(
            box(`${x} 1.24 -.15`, [0.48, 0.12, 0.5], i < t.steps.length ? '#a0cebe' : '#b7a2ca'),
            sign(t.steps[i] || `${i + 1}`, `${x} 1.4 .18`, 0.5, 0.18),
          );
        }
        group.append(rocket(`${-0.84 + Math.max(0, t.steps.length - 1) * 0.56} 1.52 -.2`, 0.32));
      } else {
        group.append(rocket('0 1.35 -.3', 0.48));
        fragmentList(state).forEach((f, i) => {
          const x = -0.9 + i * 0.45;
          group.append(
            sphere(`${x} 1.3 .02`, 0.09, t.steps.includes(f.id) ? '#fbc55f' : '#6e6885'),
            sign(f.symbol, `${x} 1.13 .12`, 0.43, 0.15),
          );
        });
      }
      if (t.phase === 'revealed') {
        group.append(
          box('-.85 1.3 .3', [0.55, 0.12, 0.5], '#dcb68b'),
          box('-.85 1.6 .05', [0.55, 0.08, 0.5], '#dcb68b', { rotation: '-65 0 0' }),
          node('a-entity', { position: '-.85 1.36 .3', scale: '.6 .6 .6' }, [tokenModel(t.symbol)]),
          sign(`DISCOVERY: ${t.symbol}`, '0 2.05 .1', 1.9, 0.23, '#ffe0a6', '#42314e'),
        );
      }
      view.actions.forEach((a, i) =>
        group.append(
          sign(
            a.label,
            `${i % 2 ? 0.57 : -0.57} ${0.94 - Math.floor(i / 2) * 0.22} .8`,
            1.08,
            0.19,
            tint,
            '#332c46',
            action(`task:${id}:${a.verb}:${a.value || ''}`, id),
          ),
        ),
      );
      if (!unlocked(state, id))
        group.append(
          sign('READ CLUE', '0 .8 .8', 1.7, 0.27, tint, '#332c46', action(`open:${id}`, id)),
        );
    }
    treasure.replaceChildren();
    treasure.append(
      box('0 1.65 0', [2.5, 1.2, 0.12], '#4d4368'),
      sign(
        state.treasure
          ? 'CONSTELLATION RECOVERED'
          : state.fragments === 6
            ? 'OPEN CONSTELLATION TREASURE'
            : `${state.fragments} / 6 FRAGMENTS`,
        '0 2.5 .1',
        2.6,
        0.4,
        '#f2d293',
        '#40304e',
        action('treasure', 'treasure'),
      ),
    );
    for (let i = 0; i < 6; i++)
      treasure.append(
        sphere(
          `${-0.9 + i * 0.36} ${1.6 + (i % 2) * 0.32} .16`,
          state.treasure ? 0.09 : 0.055,
          i < state.fragments ? '#ffdc88' : '#877b9c',
        ),
      );
    for (const p of PROPS) {
      const group = propGroups.get(p.id),
        prop = state.props[p.id];
      group.replaceChildren();
      group.append(
        sign(p.title, '0 2.5 0', 1.25, 0.3),
        sign(
          prop.opened ? `${prop.value}${p.id === 'satellite' ? ' panels' : ''}` : 'INSPECT',
          '0 1.2 .15',
          1.25,
          0.25,
          '#e5d3ed',
          '#3b3150',
          action(`inspect-prop:${p.id}`, p.id),
        ),
      );
      if (p.id === 'satellite') {
        const model = node('a-entity', {
          position: '0 1.8 0',
          rotation: `0 ${prop.opened ? 35 : 0} 0`,
        });
        model.append(box('0 0 0', [0.2, 0.25, 0.2], '#dfc8a0'));
        for (let i = 0; i < Number(prop.value); i++)
          model.append(box(`${-0.45 + i * 0.3} .02 0`, [0.18, 0.08, 0.35], '#647db6'));
        group.append(model);
      } else {
        group.append(
          node('a-dodecahedron', { position: '0 1.85 0', radius: 0.25, color: '#9b8597' }),
        );
        if (prop.value === 'Ridges')
          for (let i = 0; i < 3; i++)
            group.append(box(`${-0.13 + i * 0.13} 1.85 .2`, [0.04, 0.32, 0.07], '#66576c'));
        if (prop.value === 'Pits')
          for (let i = 0; i < 3; i++)
            group.append(
              sphere(`${-0.12 + i * 0.12} ${1.85 + (i % 2) * 0.1} .21`, 0.04, '#584e66'),
            );
      }
    }
  }

  const cargo = tableNodes.get('cargo').group,
    cargoItems = node('a-entity'),
    cargoBins = node('a-entity'),
    cargoReveal = node('a-entity');
  cargo.append(cargoItems, cargoBins, cargoReveal);
  const drawer = node('a-entity', {
    position: `${DISCOVERY.x} 0 ${DISCOVERY.z}`,
    'data-prop': 'drawer',
  });
  drawer.append(
    box('0 .55 0', [1.25, 1.1, 0.65], '#c6b4dc'),
    box('0 1.13 0', [1.45, 0.12, 0.8], '#efe2cf'),
    sign(
      'EXPLORER DRAWER',
      '0 .78 .34',
      1.15,
      0.26,
      '#c6b4dc',
      '#332b46',
      action('inspect-drawer', 'drawer'),
    ),
  );
  const drawerInside = node('a-entity');
  drawer.append(drawerInside);
  spaceRoom.append(drawer);
  const p = approachPoint(DISCOVERY);
  spaceRoom.append(
    node('a-circle', {
      position: `${p.x} .02 ${p.z}`,
      rotation: '-90 0 0',
      radius: 0.32,
      color: '#ad92d0',
      ...action('teleport:drawer'),
    }),
  );
  // Friendly companion is decorative; no personal data or autonomous movement is used.
  const companion = node('a-entity', { position: '2.6 1.15 5.8', rotation: '0 -30 0' }, [
    sphere('0 .1 0', 0.32, '#b2a2d5'),
    sphere('0 .48 0', 0.25, '#ebdfcb'),
    sphere('-.085 .5 -.22', 0.045, '#36324d'),
    sphere('.085 .5 -.22', 0.045, '#36324d'),
    box('0 -.2 0', [0.32, 0.15, 0.26], '#f2bf74'),
  ]);
  room.append(companion);
  const oceanRoot = node('a-entity', { 'data-adventure': 'ocean' });
  room.append(oceanRoot);
  const oceanScene = createOceanScene(oceanRoot, { node, box, sphere, sign, action });
  const workshopRoot = node('a-entity', { 'data-adventure': 'workshop' });
  room.append(workshopRoot);
  const workshopScene = createWorkshopScene(workshopRoot, { node, box, sphere, sign, action });
  const identity = node('a-entity');
  room.append(identity);
  function personalize(state) {
    const p = profileFor(state.profile),
      color = ACCENTS[p.palette];
    companion.replaceChildren();
    companion.append(
      p.companion === 'Robot'
        ? box('0 .1 0', [0.5, 0.5, 0.4], color)
        : sphere('0 .1 0', 0.32, color),
      sphere('0 .48 0', 0.25, '#ebdfcb'),
      sphere('-.085 .5 -.22', 0.045, '#263746'),
      sphere('.085 .5 -.22', 0.045, '#263746'),
    );
    if (p.companion !== 'Robot')
      for (const x of [-0.16, 0.16])
        companion.append(
          node('a-cone', {
            position: `${x} .72 0`,
            radius: 0.1,
            'radius-bottom': 0.1,
            height: 0.19,
            color,
          }),
        );
    if (p.companion === 'Owl')
      companion.append(
        node('a-cone', {
          position: '0 .42 -.25',
          'radius-bottom': 0.06,
          height: 0.13,
          rotation: '90 0 0',
          color: '#d49952',
        }),
      );
    companion.append(
      sign(`${p.companion} / ${p.emblem}`, '0 -.4 -.2', 1.15, 0.25, '#f5f1e8', '#243348', {
        rotation: '0 180 0',
      }),
    );
    identity.replaceChildren();
    if (state.treasure)
      identity.append(
        sign(`${p.emblem} EMBLEM / YOUR KEEPSAKE`, '0 1 6.59', 2.4, 0.26, '#f5f1e8', '#243348', {
          rotation: '0 180 0',
        }),
      );
  }
  const pathGroup = node('a-entity', { id: 'guide-path' });
  room.append(pathGroup);
  const rig = node('a-entity', { id: 'player-rig', position: '0 0 5.7', 'discovery-movement': '' });
  const camera = node('a-entity', {
    id: 'player-camera',
    camera: 'active: true; fov: 75',
    position: '0 1.65 0',
    'look-controls': 'pointerLockEnabled: false',
    cursor: 'rayOrigin: mouse; fuse: false',
    raycaster: 'objects: .selectable; far: 16',
  });
  rig.append(camera);
  const consoleNode = node('a-entity', {
    id: 'vr-console',
    position: '0 -.18 -1.4',
    visible: false,
  });
  camera.append(consoleNode);
  let consoleData = { text: 'Welcome, explorer.', buttons: [] },
    consolePage = 0,
    menuOpen = false,
    immersive = false,
    hidden = false,
    paused = false,
    settings = { stationary: false, reducedMotion: false },
    targetId = null,
    lastPath = 0,
    lastState = null;
  const getPosition = () => {
    const p = camera.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
    return { x: p.x, z: p.z };
  };
  const distance = (id) => {
    const item = DESTINATIONS.find((item) => item.id === id);
    if (!item) return Infinity;
    const p = getPosition();
    return Math.hypot(p.x - item.x, p.z - item.z);
  };
  function updateTargets() {
    room
      .querySelectorAll('.room-action')
      .forEach((el) =>
        el.classList.toggle(
          'selectable',
          !hidden &&
            !paused &&
            (!el.closest('[data-adventure]') ||
              el.closest('[data-adventure]').dataset.adventure ===
                (lastState?.adventure || 'space')),
        ),
      );
  }
  function drawConsole() {
    const visible = immersive && (menuOpen || paused || hidden);
    consoleNode.replaceChildren();
    consoleNode.setAttribute('visible', visible);
    if (!visible) return;
    consoleNode.append(sign(consoleData.text, '0 .35 0', 1.7, 0.54, '#28243c', '#fff4dd'));
    const pages = Math.max(1, Math.ceil(consoleData.buttons.length / 8));
    consolePage = Math.min(consolePage, pages - 1);
    const list = [
      ...consoleData.buttons.slice(consolePage * 8, consolePage * 8 + 8),
      ...(pages > 1
        ? [{ label: `More controls ${consolePage + 1}/${pages}`, intent: 'console-page' }]
        : []),
      ...(!hidden ? [{ label: 'Hide menu / B or Y', intent: 'hide-vr-menu' }] : []),
      { label: 'Exit VR', intent: 'exit-vr' },
    ];
    list.forEach((item, i) => {
      const row = Math.floor(i / 2),
        x = i % 2 ? 0.43 : -0.43;
      consoleNode.append(
        sign(item.label, `${x} ${-0.02 - row * 0.17} .005`, 0.8, 0.145, '#eee3d5', '#322b48', {
          class: 'selectable',
          'data-intent': item.intent,
        }),
      );
    });
  }
  function drawPath() {
    pathGroup.replaceChildren();
    const dest = DESTINATIONS.find((item) => item.id === targetId);
    if (!dest) return;
    for (const [i, p] of findPath(getPosition(), approachPoint(dest)).entries())
      if (i)
        pathGroup.append(
          node('a-circle', {
            position: `${p.x} .035 ${p.z}`,
            rotation: '-90 0 0',
            radius: 0.085,
            material: 'shader: flat; color: #ac6944',
          }),
        );
  }
  function guide(id) {
    targetId = id;
    for (const [key, { ring }] of tableNodes)
      ring.setAttribute('material', 'color', key === id ? '#9c482c' : '#b9aabd');
    drawPath();
  }
  function teleport(id) {
    const dest = DESTINATIONS.find((item) => item.id === id);
    if (!dest || hidden) return;
    const p = approachPoint(dest);
    if (!canStand(p.x, p.z)) return;
    const head = getPosition();
    rig.object3D.position.x += p.x - head.x;
    rig.object3D.position.z += p.z - head.z;
    if (!immersive) {
      rig.object3D.rotation.y = 0;
      const look = camera.components['look-controls'];
      if (look) {
        look.yawObject.rotation.y = id === 'treasure' ? Math.PI : 0;
        look.pitchObject.rotation.x = -0.12;
      }
    }
    callbacks.position(getPosition());
    drawPath();
  }
  for (const hand of ['left', 'right']) {
    const controller = node('a-entity', {
      'laser-controls': `hand: ${hand}; model: false`,
      raycaster: 'objects: .selectable; far: 16; lineColor: #ffbf70',
    });
    controller.append(
      sign('MENU · B / Y', '0 .07 -.18', 0.18, 0.055, '#28243c', '#fff4dd', {
        class: 'selectable',
        'data-intent': 'toggle-vr-menu',
        rotation: '-35 0 0',
      }),
    );
    controller.addEventListener('controllerdisconnected', () => {
      const m = rig.components['discovery-movement'];
      if (m) m.stick = { x: 0, y: 0 };
    });
    rig.append(controller);
  }
  scene.append(rig);
  mount.append(scene);
  function toggleMenu() {
    if (!immersive || hidden) return;
    if (paused) {
      menuOpen = false;
      callbacks.intent('close');
    } else menuOpen = !menuOpen;
    drawConsole();
  }
  rig.addEventListener('vr-menu-toggle', toggleMenu);
  scene.addEventListener('click', ({ target }) => {
    if (scene.dataset.started !== 'true') return;
    const el = target.closest?.('.selectable');
    if (!el) return;
    const id = el.dataset.destination;
    if (id && !settings.stationary && distance(id) > 3.7) {
      guide(id);
      callbacks.hint('Follow the dots, or open Mission map and choose Go there.');
      return;
    }
    if (el.dataset.intent === 'console-page') {
      consolePage = (consolePage + 1) % Math.ceil(consoleData.buttons.length / 8);
      drawConsole();
      return;
    }
    if (el.dataset.intent === 'toggle-vr-menu') {
      toggleMenu();
      return;
    }
    if (el.dataset.intent === 'hide-vr-menu' || el.dataset.intent === 'close') {
      menuOpen = false;
      callbacks.intent('close');
      drawConsole();
      return;
    }
    callbacks.intent(el.dataset.intent);
  });
  rig.addEventListener('player-moved', ({ detail }) => {
    callbacks.position(detail);
    if (performance.now() - lastPath > 1000) {
      lastPath = performance.now();
      drawPath();
    }
  });
  scene.addEventListener('enter-vr', () => {
    immersive = true;
    menuOpen = false;
    drawConsole();
    callbacks.immersive(true);
  });
  scene.addEventListener('exit-vr', () => {
    immersive = false;
    menuOpen = false;
    drawConsole();
    callbacks.immersive(false);
  });
  document.addEventListener('pointerlockchange', () => {
    camera.setAttribute('cursor', 'rayOrigin', document.pointerLockElement ? 'entity' : 'mouse');
    if (camera.components['look-controls'])
      camera.components['look-controls'].pointerLocked = Boolean(document.pointerLockElement);
  });

  return {
    scene,
    rig,
    camera,
    getPosition,
    distance,
    guide,
    teleport,
    start() {
      scene.dataset.started = 'true';
    },
    pause(value) {
      paused = value;
      scene.dataset.paused = String(value || hidden);
      if (value && document.pointerLockElement) document.exitPointerLock();
      room
        .querySelectorAll('[animation]')
        .forEach((el) => el.emit(value ? 'pause-orbit' : 'resume-orbit'));
      updateTargets();
    },
    settings(value) {
      settings = value;
      scene.dataset.stationary = String(value.stationary);
      if (lastState) {
        if (lastState.adventure === 'space') renderChallenges(lastState);
        if (lastState.adventure === 'workshop') workshopScene.render(lastState, settings);
        updateTargets();
      }
    },
    conceal(value) {
      hidden = value;
      room.setAttribute('visible', !value);
      scene.dataset.paused = String(paused || value);
      updateTargets();
    },
    console(text, buttons) {
      if (text !== consoleData.text) consolePage = 0;
      consoleData = { text, buttons };
      drawConsole();
    },
    resetPosition() {
      rig.object3D.position.set(0, 0, 5.7);
      rig.object3D.rotation.y = 0;
      const look = camera.components['look-controls'];
      if (look) {
        look.yawObject.rotation.y = 0;
        look.pitchObject.rotation.x = 0;
      }
      guide(null);
    },
    nearest() {
      return [...DESTINATIONS].sort((a, b) => distance(a.id) - distance(b.id))[0];
    },
    render(state) {
      lastState = state;
      personalize(state);
      const ocean = state.adventure === 'ocean',
        workshop = state.adventure === 'workshop';
      spaceRoom.setAttribute('visible', !ocean && !workshop);
      oceanRoot.setAttribute('visible', ocean);
      workshopRoot.setAttribute('visible', workshop);
      if (workshop) {
        oceanRoot.replaceChildren();
        workshopScene.render(state, settings);
        updateTargets();
        return;
      }
      workshopRoot.replaceChildren();
      if (ocean) {
        oceanScene.render(state);
        updateTargets();
        return;
      }
      oceanRoot.replaceChildren();
      renderChallenges(state);
      cargoItems.replaceChildren();
      cargoBins.replaceChildren();
      cargoReveal.replaceChildren();
      SUPPLIES.forEach((supply, index) => {
        const x = -0.76 + index * 0.76,
          placed = state.placed.includes(supply.id),
          selected = state.selected === supply.id;
        const holder = node('a-entity', { position: `${x} 0 0` });
        holder.append(
          box('0 1.18 -.24', [0.66, 0.16, 0.5], placed ? supply.color : '#74657f'),
          sign(
            supply.shape.toUpperCase(),
            '0 1.72 -.3',
            0.7,
            0.22,
            selected ? '#f9d290' : '#f3e8da',
            '#332c46',
            action(`place:${supply.shape}`, 'cargo'),
          ),
        );
        if (placed) holder.append(shape(supply.shape, '0 1.34 -.22', supply.color, 0.13));
        cargoBins.append(holder);
        if (!placed) {
          const item = node('a-entity', { position: `${x} 1.3 .4` });
          const solid = shape(supply.shape, '0 .1 0', supply.color, 0.18);
          // Ray targets belong to actual meshes; a transform-only parent has no mesh of its own.
          for (const [key, value] of Object.entries(action(`select:${supply.id}`, 'cargo')))
            solid.setAttribute(key, value);
          item.append(solid);
          if (selected)
            item.append(
              node('a-torus', {
                position: '0 .1 0',
                radius: 0.25,
                'radius-tubular': 0.025,
                color: '#8d4830',
                rotation: '90 0 0',
              }),
            );
          item.append(
            sign(
              `${supply.name}\n${supply.shape}`,
              '0 -.02 .2',
              0.68,
              0.3,
              selected ? '#f9d290' : '#f8eddf',
              '#332c46',
              action(`select:${supply.id}`, 'cargo'),
            ),
          );
          cargoItems.append(item);
        }
      });
      if (state.phase === 'completed')
        cargoReveal.append(
          sign(
            'OPEN CARGO LID',
            '0 1.92 -.2',
            1.8,
            0.32,
            '#eea171',
            '#382e4a',
            action('reveal', 'cargo'),
          ),
        );
      if (state.phase === 'revealed') {
        cargoReveal.append(
          box('0 1.78 -.4', [1.55, 0.12, 0.52], '#d99d79', { rotation: '-35 0 0' }),
        );
        const fragment = node(
          'a-entity',
          { position: '0 1.83 .04', ...action('collect', 'cargo') },
          [tokenModel(state.token)],
        );
        cargoReveal.append(
          fragment,
          sign(
            state.fragments ? `${state.token} / COLLECTED` : `${state.token} / COLLECT`,
            '0 2.35 -.15',
            1.9,
            0.32,
            '#ffe0a6',
            '#42314e',
            action('collect', 'cargo'),
          ),
        );
      }
      drawerInside.replaceChildren();
      if (state.drawerOpen) {
        const found = node('a-entity', { position: '0 1.18 .1' }, [tokenModel(state.discovery)]);
        drawerInside.append(
          found,
          sign(
            state.discovery,
            '0 1.85 0',
            1.35,
            0.3,
            '#e9d4f0',
            '#382d4c',
            action('inspect-drawer', 'drawer'),
          ),
          box('0 .45 .55', [1.1, 0.22, 0.6], '#f1dcc1'),
        );
      } else
        drawerInside.append(
          sign(
            'OPEN & INSPECT',
            '0 .39 .35',
            1.12,
            0.26,
            '#3e375b',
            '#fff0d5',
            action('inspect-drawer', 'drawer'),
          ),
        );
      updateTargets();
    },
  };
}
