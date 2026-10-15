import { ITEMS } from './state.js';
import { ROOM, DESKS, CUPBOARDS, movePlayer, VIEWS, canStand } from './navigation.js';
import { readVRInput } from '../discovery/vr-input.js';
const node = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...children);
  return n;
};
const box = (p, size, color) =>
  node('a-box', { position: p, width: size[0], height: size[1], depth: size[2], color });
const ball = (p, r, color) =>
  node('a-sphere', { position: p, radius: r, color, 'segments-width': 16, 'segments-height': 12 });
const cylinder = (p, r, h, color) =>
  node('a-cylinder', { position: p, radius: r, height: h, color, 'segments-radial': 20 });
const ring = (p, r, color, rotation = '0 0 0') =>
  node('a-torus', { position: p, radius: r, 'radius-tubular': 0.025, color, rotation });
const textures = new Map();
function label(text, p, width = 1, height = 0.25, bg = '#fff8e8', color = '#243f3b', action) {
  const key = JSON.stringify([text, bg, color]);
  let src = textures.get(key);
  if (!src) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = color;
    ctx.font = `bold ${text.length > 50 ? 38 : text.length > 24 ? 60 : 92}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 128, 960);
    src = c.toDataURL();
    textures.set(key, src);
  }
  return node('a-plane', {
    position: p,
    width,
    height,
    material: { shader: 'flat', src, side: 'double' },
    ...(action ? { 'data-action': action, class: 'room-target' } : {}),
  });
}
function model(kind) {
  const g = node('a-entity');
  if (kind === 'chalk')
    for (let i = 0; i < 3; i++)
      g.append(
        node('a-cylinder', {
          position: `${-0.18 + i * 0.18} .06 0`,
          rotation: '0 0 90',
          radius: 0.05,
          height: 0.3,
          color: ['#fff4d9', '#f4cb75', '#dfc5de'][i],
        }),
      );
  if (kind === 'eraser')
    g.append(
      box('0 .05 0', [0.4, 0.1, 0.23], '#4e555b'),
      box('0 .13 0', [0.42, 0.08, 0.25], '#c6a16b'),
    );
  if (kind === 'bag') {
    g.append(
      box('0 .34 0', [0.55, 0.65, 0.25], '#c65e50'),
      box('0 .2 .17', [0.42, 0.27, 0.13], '#e58966'),
      ring('0 .7 0', 0.12, '#764c40'),
    );
    for (const x of [-0.19, 0.19]) g.append(box(`${x} .34 -.17`, [0.06, 0.55, 0.06], '#764c40'));
  }
  if (kind === 'bottle')
    g.append(
      cylinder('0 .27 0', 0.14, 0.54, '#5da9c7'),
      cylinder('0 .59 0', 0.095, 0.12, '#304f75'),
      ring('0 .27 0', 0.143, '#e4f1da', '90 0 0'),
    );
  if (kind === 'books')
    for (let i = 0; i < 3; i++) {
      g.append(
        box(`0 ${0.055 + i * 0.11} 0`, [0.65, 0.1, 0.43], ['#cf7556', '#62899c', '#b6a45e'][i]),
        box(`0 ${0.06 + i * 0.11} .22`, [0.55, 0.06, 0.012], '#f6efd7'),
      );
    }
  if (kind === 'globe')
    g.append(
      cylinder('0 .04 0', 0.22, 0.08, '#a07845'),
      cylinder('0 .22 0', 0.025, 0.35, '#9e824c'),
      ball('0 .48 0', 0.3, '#5e9bbb'),
      ring('0 .48 0', 0.34, '#b2a16b', '0 0 20'),
      ball('-.12 .58 .23', 0.12, '#7eaa72'),
      ball('.14 .36 .21', 0.08, '#7eaa72'),
    );
  if (kind === 'ruler') {
    g.append(box('0 .025 0', [0.7, 0.05, 0.12], '#e2ba68'));
    for (let i = 0; i < 10; i++)
      g.append(box(`${-0.3 + i * 0.06} .052 0`, [0.01, 0.005, 0.06], '#725a3a'));
  }
  if (kind === 'pencils') {
    g.append(box('0 .08 0', [0.6, 0.16, 0.28], '#658ba5'));
    for (let i = 0; i < 4; i++)
      g.append(
        node('a-cylinder', {
          position: `${-0.2 + i * 0.13} .25 0`,
          radius: 0.018,
          height: 0.35,
          color: ['#e4a559', '#bb6d74', '#78a37a', '#f3dba0'][i],
        }),
      );
  }
  if (kind === 'plant') {
    g.append(
      node('a-cone', {
        position: '0 .17 0',
        height: 0.34,
        'radius-top': 0.22,
        'radius-bottom': 0.16,
        color: '#c67c50',
      }),
      cylinder('0 .4 0', 0.025, 0.4, '#507854'),
    );
    for (const [x, y, z] of [
      [-0.14, 0.53, 0],
      [0.13, 0.65, 0],
      [0, 0.73, 0.1],
    ])
      g.append(
        node('a-sphere', {
          position: `${x} ${y} ${z}`,
          radius: 0.15,
          scale: '.8 1.4 .5',
          color: '#447d58',
        }),
      );
  }
  if (kind === 'bin')
    g.append(cylinder('0 .32 0', 0.3, 0.65, '#647878'), ring('0 .66 0', 0.3, '#ced9ce', '90 0 0'));
  if (kind === 'clock') {
    g.append(
      node('a-cylinder', {
        position: '0 0 0',
        radius: 0.38,
        height: 0.08,
        rotation: '90 0 0',
        color: '#567267',
      }),
      node('a-circle', { position: '0 0 .05', radius: 0.34, color: '#fff7dc' }),
      box('0 .08 .065', [0.025, 0.18, 0.012], '#354f49'),
      box('.1 0 .065', [0.22, 0.025, 0.012], '#354f49'),
    );
  }
  if (kind === 'poster')
    g.append(
      box('0 0 0', [1.15, 0.9, 0.05], '#c29259'),
      label('BE CURIOUS', '0 .15 .04', 1, 0.23),
      label('ASK • NOTICE • TRY', '0 -.17 .04', 1, 0.18),
    );
  if (kind === 'fan') {
    g.append(cylinder('0 .25 0', 0.045, 0.5, '#627375'), ball('0 0 0', 0.15, '#5c7070'));
    const blades = node('a-entity');
    for (let i = 0; i < 3; i++) {
      const arm = node('a-entity', { rotation: `0 ${i * 120} 0` }, [
        box('.54 -.03 0', [1.15, 0.05, 0.18], '#c3b38d'),
      ]);
      blades.append(arm);
    }
    g.append(blades);
    g.fanBlades = blades;
  }
  return g;
}
function desk(scene, x, z) {
  scene.append(box(`${x} 1 ${z}`, [1.65, 0.12, 1], '#c89861'));
  for (const dx of [-0.68, 0.68])
    for (const dz of [-0.35, 0.35])
      scene.append(box(`${x + dx} .48 ${z + dz}`, [0.07, 1, 0.07], '#53636a'));
  const cz = z + 1.12;
  scene.append(
    box(`${x} .52 ${cz}`, [0.7, 0.1, 0.65], '#638f99'),
    box(`${x} .88 ${cz + 0.3}`, [0.7, 0.65, 0.08], '#638f99'),
  );
  for (const dx of [-0.28, 0.28])
    scene.append(box(`${x + dx} .25 ${cz}`, [0.06, 0.5, 0.5], '#53636a'));
}
export function createRoom(mount, callbacks) {
  const A = window.AFRAME,
    T = A.THREE;
  const scene = node('a-scene', {
      embedded: '',
      'xr-mode-ui': 'enabled: false',
      'loading-screen': 'enabled: false',
      background: 'color: #e8e6d8',
      renderer: 'antialias: true; colorManagement: true',
    }),
    environment = node('a-entity');
  scene.append(environment);
  scene.append(
    node('a-light', { type: 'ambient', intensity: 1.3, color: '#fff7e6' }),
    node('a-light', { type: 'directional', position: '2 5 4', intensity: 1.4 }),
  );
  environment.append(
    box('0 -.1 0', [16, 0.2, 14], '#d8cfb7'),
    box('0 2.6 -7', [16, 5.2, 0.15], '#e0ddc9'),
    box('0 2.6 7', [16, 5.2, 0.15], '#e0ddc9'),
    box('-8 2.6 0', [0.15, 5.2, 14], '#d4dfd9'),
    box('8 2.6 0', [0.15, 5.2, 14], '#d4dfd9'),
    box('0 5.2 0', [16, 0.1, 14], '#f4efdc'),
  );
  for (let x = -7; x <= 7; x++)
    environment.append(box(`${x} .007 0`, [0.015, 0.01, 14], '#c5bca3'));
  environment.append(
    box('0 2.5 -6.85', [5.5, 2.3, 0.12], '#805b39'),
    box('0 2.5 -6.77', [5.3, 2.1, 0.04], '#294e40'),
    box('0 1.19 -6.54', [5.5, 0.09, 0.35], '#a77e51'),
    label('OUR CLASSROOM', '0 3.2 -6.72', 3.8, 0.4, '#294e40', '#fff4d2'),
    label('Look • Remember • Find', '0 2.5 -6.72', 3.8, 0.35, '#294e40', '#fff4d2'),
    label('A B C     1 2 3', '0 1.85 -6.72', 3.3, 0.3, '#294e40', '#e5e7cb'),
  );
  for (const p of DESKS) desk(environment, p.x, p.z);
  environment.append(box('0 1.05 -5.3', [2.75, 0.15, 1.1], '#ac8253'));
  for (const x of [-1.2, 1.2]) environment.append(box(`${x} .5 -5.3`, [0.12, 1, 0.9], '#53636a'));
  for (const p of CUPBOARDS)
    environment.append(
      box(`${p.x} .53 ${p.z}`, [1.3, 1.06, 1.2], '#94ad9d'),
      box(`${p.x} 1.09 ${p.z}`, [1.4, 0.06, 1.3], '#bd9262'),
    );
  for (const x of [-7.91, 7.91])
    for (const z of [-3, 2]) {
      const w = node(
        'a-entity',
        { position: `${x} 3.1 ${z}`, rotation: `0 ${x < 0 ? 90 : -90} 0` },
        [box('0 0 0', [2.4, 1.9, 0.06], '#a7cdd8')],
      );
      for (const dx of [-1.2, 0, 1.2]) w.append(box(`${dx} 0 .04`, [0.06, 2, 0.08], '#f7f0da'));
      w.append(box('0 0 .05', [2.4, 0.06, 0.08], '#f7f0da'));
      environment.append(w);
    }
  for (const x of [-7.65, 7.65]) {
    const h = node('a-entity', { position: `${x} 2 4.8`, rotation: `0 ${x < 0 ? 90 : -90} 0` }, [
      box('0 0 0', [0.3, 0.6, 0.08], '#a67d54'),
      ring('0 -.05 .1', 0.08, '#627272'),
    ]);
    environment.append(h);
  }
  environment.append(
    box('0 1.5 6.88', [2, 3, 0.05], '#8baf9a'),
    label('CLASSROOM', '0 2.1 6.8', 1.5, 0.25),
  );
  for (const x of [-3.2, 3.2])
    for (const z of [-3.2, 3.2])
      environment.append(box(`${x} 5.02 ${z}`, [1.8, 0.06, 0.45], '#e9ead3'));
  const rig = node('a-entity', { id: 'player-rig', position: '0 0 5.8' }),
    camera = node('a-entity', {
      camera: 'fov: 75',
      position: '0 1.65 0',
      'look-controls': 'pointerLockEnabled: false',
      cursor: 'rayOrigin: mouse; fuse: false',
      raycaster: 'objects: .room-target; far: 16',
    });
  rig.append(camera);
  scene.append(rig);
  const cover = node('a-plane', {
      position: '0 0 -.3',
      width: 20,
      height: 20,
      material: 'shader: flat; color: #e6dfca',
      visible: false,
    }),
    panel = node('a-entity', { position: '0 0 -1.7', visible: false });
  camera.append(cover, panel);
  const objects = {};
  let state,
    settings = {},
    lastLayout,
    menu = false,
    immersive = false,
    turnReady = true,
    menuHeld = false,
    drag = 0,
    dragStart = null;
  for (const [id, d] of Object.entries(ITEMS)) {
    const g = model(d.kind),
      name = label(d.name, d.kind === 'fan' ? '0 -.55 0' : '0 .85 0', 1.1, 0.22);
    name.setAttribute('visible', false);
    g.append(name);
    const wide = ['fan', 'poster', 'clock'].includes(d.kind),
      target = box(
        wide ? '0 0 0' : '0 .3 0',
        wide
          ? [
              d.kind === 'fan' ? 2.5 : 1.3,
              d.kind === 'fan' ? 0.6 : 1.1,
              d.kind === 'fan' ? 2.5 : 0.35,
            ]
          : [0.85, 1.1, 0.8],
        '#fff',
      );
    target.setAttribute('material', 'opacity: 0; transparent: true; depthWrite: false');
    target.dataset.object = id;
    g.append(target);
    const marker = label('✓ BACK HOME', d.kind === 'fan' ? '0 -.3 0' : '0 1.1 0', 1.1, 0.22);
    marker.setAttribute('visible', false);
    g.append(marker);
    target.addEventListener('mouseenter', () => name.setAttribute('visible', true));
    target.addEventListener('mouseleave', () => name.setAttribute('visible', false));
    objects[id] = { g, target, marker, name };
    environment.append(g);
  }
  const keys = new Set(),
    position = () => {
      const v = camera.object3D.getWorldPosition(new T.Vector3());
      return { x: v.x, z: v.z };
    };
  const blockers = () => {
    if (!state) return [];
    const p = state.slots[state.layout.bin];
    return [{ x: p.x, z: p.z, hx: 0.32, hz: 0.32 }];
  };
  function step(side, forward, amount) {
    const direction = new T.Vector3(0, 0, -1).applyQuaternion(
      camera.object3D.getWorldQuaternion(new T.Quaternion()),
    );
    direction.y = 0;
    direction.normalize();
    const p = position(),
      next = movePlayer(
        p,
        (direction.x * forward - direction.z * side) * amount,
        (direction.z * forward + direction.x * side) * amount,
        blockers(),
      );
    rig.object3D.position.x += next.x - p.x;
    rig.object3D.position.z += next.z - p.z;
    rig.setAttribute('position', rig.object3D.position);
    return Math.hypot(next.x - p.x, next.z - p.z);
  }
  function moveTo(id) {
    const p = VIEWS[id];
    if (!p || !canStand(p.x, p.z, blockers())) return;
    const old = position();
    rig.object3D.position.x += p.x - old.x;
    rig.object3D.position.z += p.z - old.z;
    rig.setAttribute('position', rig.object3D.position);
    if (!immersive) {
      const look = camera.components['look-controls'];
      if (look) {
        look.yawObject.rotation.y = 0;
        look.pitchObject.rotation.x = 0;
      }
    }
  }
  function drawPanel() {
    panel.replaceChildren();
    panel.setAttribute('visible', immersive && menu);
    if (!immersive || !menu || !state) return;
    const action =
      state.phase === 'study'
        ? ['Ready — change room', 'ready']
        : state.phase === 'complete'
          ? ['Play again', 'restart']
          : ['Continue exploring', 'close'];
    const title =
      state.phase === 'complete'
        ? 'Classroom restored!'
        : state.phase === 'find'
          ? `Find four changes · ${state.found.length}/4 back home`
          : 'Explore and remember this classroom';
    panel.append(label(title, '0 .57 0', 1.9, 0.25));
    const buttons = [
      action,
      ['Back view', 'view:back'],
      ['Middle view', 'view:middle'],
      ['Front view', 'view:front'],
      [settings.stationary ? 'Enable walking' : 'Stationary mode', 'stationary'],
      [settings.muted ? 'Sound on' : 'Sound off', 'mute'],
      ['Close menu / B or Y', 'close'],
      ['Exit VR', 'exit-vr'],
      ['Main room', 'room:main'],
    ];
    buttons.forEach(([text, a], i) =>
      panel.append(
        label(
          text,
          `${i % 2 ? 0.49 : -0.49} ${0.27 - Math.floor(i / 2) * 0.23} .01`,
          0.94,
          0.19,
          '#f5ead4',
          '#203e38',
          a,
        ),
      ),
    );
  }
  function targets() {
    for (const { target } of Object.values(objects))
      target.classList.toggle(
        'room-target',
        !menu && ['study', 'find', 'complete'].includes(state?.phase),
      );
  }
  function render(s, options = {}) {
    state = s;
    settings = options;
    for (const [id, { g, target, marker, name }] of Object.entries(objects)) {
      const p = s.slots[s.layout[id]],
        to = `${p.x} ${p.y} ${p.z}`;
      if (
        lastLayout &&
        lastLayout[id] !== s.layout[id] &&
        s.found.includes(id) &&
        !settings.reduced
      ) {
        const old = s.slots[lastLayout[id]];
        g.setAttribute('animation__return', {
          property: 'position',
          from: `${old.x} ${old.y} ${old.z}`,
          to,
          dur: 450,
          easing: 'easeOutCubic',
        });
      } else if (!lastLayout || lastLayout[id] !== s.layout[id] || s.phase === 'study') {
        g.removeAttribute('animation__return');
        g.setAttribute('position', to);
      }
      g.setAttribute('rotation', `0 ${p.yaw} 0`);
      marker.setAttribute('visible', s.found.includes(id));
      if (menu) name.setAttribute('visible', false);
      if (g.fanBlades) {
        if (settings.reduced) g.fanBlades.removeAttribute('animation');
        else if (!g.fanBlades.hasAttribute('animation'))
          g.fanBlades.setAttribute(
            'animation',
            'property: rotation; to: 0 360 0; dur: 5000; loop: true; easing: linear',
          );
      }
      g.setAttribute('aria-label', ITEMS[id].name);
    }
    lastLayout = { ...s.layout };
    environment.setAttribute('visible', s.phase !== 'change');
    cover.setAttribute('visible', s.phase === 'change');
    targets();
    drawPanel();
  }
  for (const hand of ['left', 'right']) {
    const c = node('a-entity', {
      'laser-controls': `hand: ${hand}; model: false`,
      raycaster: 'objects: .room-target; far: 16; lineColor: #efcf7d',
    });
    c.append(label('MENU', '0 .08 -.2', 0.18, 0.06, '#203e38', '#fff5d8', 'menu'));
    rig.append(c);
  }
  scene.addEventListener('click', (e) => {
    if (!immersive && drag > 6) return;
    const target = e.target.closest?.('.room-target');
    if (target?.dataset.object) callbacks.action('guess:' + target.dataset.object);
    else if (target?.dataset.action) callbacks.action(target.dataset.action);
  });
  scene.addEventListener('enter-vr', () => {
    immersive = true;
    callbacks.immersive(true);
    drawPanel();
  });
  scene.addEventListener('exit-vr', () => {
    immersive = false;
    callbacks.immersive(false);
    drawPanel();
  });
  window.addEventListener('pointerdown', (e) => {
    drag = 0;
    dragStart = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', (e) => {
    if (e.buttons && dragStart)
      drag = Math.max(drag, Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y));
  });
  window.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        e.code,
      )
    ) {
      if (!menu) e.preventDefault();
      keys.add(e.code);
    }
    if ((e.code === 'Escape' || e.code === 'KeyM') && !e.repeat) {
      e.preventDefault();
      callbacks.action(menu ? 'close' : 'menu');
    }
    if (
      e.code === 'KeyE' &&
      !e.repeat &&
      !menu &&
      ['study', 'find', 'complete'].includes(state?.phase)
    ) {
      const ray = new T.Raycaster();
      ray.setFromCamera(new T.Vector2(0, 0), camera.components.camera.camera);
      const hit = ray.intersectObjects(
        Object.values(objects).map((o) => o.target.object3D),
        true,
      )[0];
      if (hit && hit.distance < 16) {
        let o = hit.object;
        while (o && !o.el?.dataset.object) o = o.parent;
        if (o?.el?.dataset.object) callbacks.action('guess:' + o.el.dataset.object);
      }
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) keys.clear();
  });
  if (!A.components['detective-walk'])
    A.registerComponent('detective-walk', {
      tick(time, delta) {
        this.el.walkTick?.(delta);
      },
    });
  scene.walkTick = (delta) => {
    const input = readVRInput(scene.renderer?.xr?.getSession()?.inputSources),
      dt = Math.min(delta || 0, 50) / 1000;
    if (immersive && input.menu && !menuHeld) callbacks.action(menu ? 'close' : 'menu');
    menuHeld = input.menu;
    if (Math.abs(input.turn) < 0.3) turnReady = true;
    if (!state || menu || !['study', 'find', 'complete'].includes(state.phase)) {
      keys.clear();
      callbacks.walk?.(0);
      return;
    }
    if (immersive && Math.abs(input.turn) > 0.7 && turnReady) {
      const before = position();
      rig.object3D.rotation.y -= (Math.sign(input.turn) * Math.PI) / 6;
      rig.object3D.updateMatrixWorld(true);
      const after = position();
      rig.object3D.position.x += before.x - after.x;
      rig.object3D.position.z += before.z - after.z;
      turnReady = false;
    }
    const side = immersive ? input.x : Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
      forward = immersive
        ? -input.y
        : Number(keys.has('KeyW') || keys.has('ArrowUp')) -
          Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const travelled =
      !settings.stationary && (side || forward)
        ? step(side, forward, (dt * 2) / Math.max(1, Math.hypot(side, forward)))
        : 0;
    callbacks.walk?.(travelled > 1e-5 ? travelled : 0);
    const look = camera.components['look-controls'];
    if (!immersive && look)
      look.yawObject.rotation.y +=
        (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.4;
  };
  scene.setAttribute('detective-walk', '');
  mount.append(scene);
  return {
    scene,
    render,
    moveTo,
    position,
    panel(open) {
      menu = open;
      keys.clear();
      targets();
      drawPanel();
      camera.setAttribute('look-controls', 'enabled', !menu);
    },
    reset() {
      moveTo('back');
    },
    get immersive() {
      return immersive;
    },
  };
}
