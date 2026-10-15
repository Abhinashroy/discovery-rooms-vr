import { LESSONS, initialExhibit } from './lessons.js';
import { canStand, movePlayer, approachPoint, findPath } from './navigation.js';

const e = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs))
    node.setAttribute(name, typeof value === 'object' ? value : String(value));
  node.append(...children);
  return node;
};
const box = (p, s, color, extra = {}) =>
  e('a-box', { position: p, width: s[0], height: s[1], depth: s[2], color, ...extra });
const glow = (color) => ({ color, emissive: color, emissiveIntensity: 0.65, roughness: 0.5 });

function textTexture(
  lines,
  { color = '#eaf8fb', background = '#152733', width = 1024, height = 320, size = 44 } = {},
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const wrapped = [];
  for (const line of lines) {
    let row = '';
    for (const word of String(line).split(' ')) {
      const next = row ? `${row} ${word}` : word;
      if (ctx.measureText(next).width > width - 64 && row) {
        wrapped.push(row);
        row = word;
      } else row = next;
    }
    wrapped.push(row);
  }
  const lineHeight = Math.min(size * 1.4, (height - 30) / wrapped.length);
  wrapped.forEach((line, i) =>
    ctx.fillText(line, width / 2, height / 2 + (i - (wrapped.length - 1) / 2) * lineHeight),
  );
  return canvas.toDataURL();
}
function panel(
  text,
  position,
  width,
  height,
  color = '#eaf8fb',
  background = '#152733',
  extra = {},
) {
  const lines = Array.isArray(text) ? text : [text];
  const size = lines.some((line) => line.length > 30) ? 44 : lines.length > 1 ? 72 : 120;
  return e('a-plane', {
    position,
    width,
    height,
    material: {
      shader: 'flat',
      src: textTexture(lines, { color, background, size }),
      side: 'double',
    },
    ...extra,
  });
}
function setPanel(node, text, color = '#eaf8fb') {
  const lines = Array.isArray(text) ? text : [text];
  const size = lines.some((line) => line.length > 30) ? 44 : lines.length > 1 ? 72 : 120;
  node.setAttribute('material', 'src', textTexture(lines, { color, size }));
}

export function createWorld(mount, callbacks) {
  const AFRAME = window.AFRAME;
  if (!AFRAME) throw new Error('The local A-Frame runtime did not load.');
  if (!AFRAME.components['learning-movement'])
    AFRAME.registerComponent('learning-movement', {
      init() {
        this.keys = new Set();
        this.stick = { x: 0, y: 0 };
        this.turnReady = true;
        this.lastReport = 0;
        this.keydown = (event) => {
          if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.ctrlKey || event.metaKey)
            return;
          const scene = this.el.sceneEl;
          // A short tap gets one small step even when released between render frames.
          if (
            !this.keys.has(event.code) &&
            scene.dataset.started &&
            scene.dataset.paused !== 'true' &&
            !scene.is('vr-mode')
          ) {
            const directions = {
              KeyW: [0, 1],
              ArrowUp: [0, 1],
              KeyS: [0, -1],
              ArrowDown: [0, -1],
              KeyA: [-1, 0],
              KeyD: [1, 0],
            };
            const input = directions[event.code],
              camera = this.el.querySelector('[camera]');
            if (input && camera) {
              const forward = new AFRAME.THREE.Vector3(0, 0, -1).applyQuaternion(
                camera.object3D.getWorldQuaternion(new AFRAME.THREE.Quaternion()),
              );
              forward.y = 0;
              forward.normalize();
              const p = this.el.object3D.position;
              const next = movePlayer(
                p,
                (forward.x * input[1] - forward.z * input[0]) * 0.09,
                (forward.z * input[1] + forward.x * input[0]) * 0.09,
              );
              p.set(next.x, 0, next.z);
            }
          }
          this.keys.add(event.code);
        };
        this.keyup = (event) => this.keys.delete(event.code);
        this.blur = () => {
          this.keys.clear();
          this.stick = { x: 0, y: 0 };
        };
        window.addEventListener('keydown', this.keydown);
        window.addEventListener('keyup', this.keyup);
        window.addEventListener('blur', this.blur);
      },
      tick(time, delta) {
        const scene = this.el.sceneEl,
          camera = this.el.querySelector('[camera]');
        if (
          !camera ||
          !scene.dataset.started ||
          (scene.dataset.paused === 'true' && !scene.is('vr-mode')) ||
          /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)
        ) {
          this.keys.clear();
          return;
        }
        const dt = Math.min(delta || 0, 50) / 1000;
        const rotation = camera.components['look-controls']?.yawObject;
        if (!scene.is('vr-mode') && rotation) {
          if (this.keys.has('ArrowLeft')) rotation.rotation.y += dt * 1.3;
          if (this.keys.has('ArrowRight')) rotation.rotation.y -= dt * 1.3;
        }
        const forward =
          (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
          (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
          this.stick.y;
        const side =
          (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.stick.x;
        if (forward || side) {
          const direction = new AFRAME.THREE.Vector3(0, 0, -1).applyQuaternion(
            camera.object3D.getWorldQuaternion(new AFRAME.THREE.Quaternion()),
          );
          direction.y = 0;
          direction.normalize();
          const speed = scene.is('vr-mode') ? 1.5 : this.keys.has('ShiftLeft') ? 3.6 : 2.5;
          const factor = (speed * dt) / Math.max(1, Math.hypot(forward, side));
          const p = this.el.object3D.position;
          const head = camera.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
          const next = movePlayer(
            head,
            (direction.x * forward - direction.z * side) * factor,
            (direction.z * forward + direction.x * side) * factor,
          );
          p.x += next.x - head.x;
          p.z += next.z - head.z;
        }
        if (time - this.lastReport > 150) {
          this.lastReport = time;
          this.el.dataset.playerX = this.el.object3D.position.x.toFixed(3);
          this.el.dataset.playerZ = this.el.object3D.position.z.toFixed(3);
          this.el.dataset.heading = camera.object3D.rotation.y.toFixed(3);
          this.el.emit('player-moved', {
            x: this.el.object3D.position.x,
            z: this.el.object3D.position.z,
          });
        }
      },
      remove() {
        window.removeEventListener('keydown', this.keydown);
        window.removeEventListener('keyup', this.keyup);
        window.removeEventListener('blur', this.blur);
      },
    });

  const scene = e('a-scene', {
    embedded: '',
    renderer: 'antialias: true; colorManagement: true',
    background: 'color: #0b1822',
    'xr-mode-ui': 'enabled: false',
    'loading-screen': 'enabled: false',
  });
  scene.append(
    box('0 -.15 0', [14, 0.3, 14], '#1e333e'),
    box('0 2.3 -7', [14, 4.6, 0.2], '#253b47'),
    box('-7 2.3 0', [0.2, 4.6, 14], '#1c303e'),
    box('7 2.3 0', [0.2, 4.6, 14], '#1c303e'),
    box('0 2.3 7', [14, 4.6, 0.2], '#253b47'),
    box('0 4.7 0', [14, 0.2, 14], '#11232f'),
    e('a-light', { type: 'ambient', color: '#c8e7ef', intensity: 1.1 }),
    e('a-light', { type: 'directional', position: '0 4 4', color: '#d4e8ff', intensity: 1.4 }),
  );
  for (let n = -6; n <= 6; n += 2) {
    scene.append(
      box(`${n} .006 0`, [0.018, 0.012, 14], '#314b56'),
      box(`0 .006 ${n}`, [14, 0.012, 0.018], '#314b56'),
    );
    scene.append(box(`${n} 4.52 0`, [0.07, 0.035, 12], '#89d9e1', { material: glow('#89d9e1') }));
  }
  for (const x of [-6.82, 6.82]) {
    scene.append(box(`${x} 2.4 -1.5`, [0.06, 2.8, 7.3], '#0c1f30'));
    for (const z of [-4.6, -2.5, -0.4, 1.7])
      scene.append(
        box(`${x > 0 ? x - 0.03 : x + 0.03} 2.5 ${z}`, [0.025, 2.4, 1.6], '#235672', {
          material: { color: '#235672', emissive: '#123b54', emissiveIntensity: 0.7 },
        }),
      );
    scene.append(box(`${x} .15 0`, [0.07, 0.12, 13], '#3b969b', { material: glow('#3b969b') }));
  }
  scene.append(
    panel(['THE COMPUTING ROOM', 'LEARN BY DOING'], '0 3.55 -6.86', 5.4, 1.0, '#abeee0'),
  );
  scene.append(
    panel(
      ['EXPLORE · EXPERIMENT · ASK', 'Six ideas. One room.'],
      '0 3.6 6.86',
      4.5,
      0.9,
      '#abeee0',
      '#152733',
      { rotation: '0 180 0' },
    ),
  );

  const stations = new Map();
  for (const [index, lesson] of LESSONS.entries()) {
    const group = e('a-entity', {
      id: `exhibit-${lesson.id}`,
      position: `${lesson.x} 0 ${lesson.z}`,
      'data-exhibit': lesson.id,
    });
    const ring = e('a-ring', {
      position: '0 .02 0',
      rotation: '-90 0 0',
      'radius-inner': '1.3',
      'radius-outer': '1.35',
      material: { shader: 'flat', color: lesson.color, opacity: 0.3, transparent: true },
    });
    group.append(
      ring,
      box('0 .45 0', [2.15, 0.9, 1.1], '#142935', {
        class: 'interactable',
        'data-select': lesson.id,
      }),
      box('0 .92 0', [2.4, 0.12, 1.35], '#48616b'),
      box('0 .82 .57', [2, 0.06, 0.025], lesson.color, { material: glow(lesson.color) }),
      panel(
        [`${String(index + 1).padStart(2, '0')} / ${lesson.title.toUpperCase()}`, lesson.subtitle],
        '0 2.7 -.42',
        2.65,
        0.7,
        lesson.color,
        '#152733',
        { class: 'interactable', 'data-select': lesson.id },
      ),
    );
    const status = panel(lesson.task, '0 .49 .572', 2.04, 0.43);
    group.append(status);
    const visuals = e('a-entity', { position: '0 1.02 0', 'data-visual': lesson.id });
    group.append(visuals);
    for (const [buttonIndex, [action, label]] of lesson.actions.entries()) {
      group.append(
        panel(
          label,
          `${buttonIndex === 0 ? -0.58 : 0.58} 1.02 .77`,
          1.02,
          0.25,
          '#0c2631',
          lesson.color,
          {
            rotation: '-18 0 0',
            class: 'interactable',
            'data-action': action,
            'data-station': lesson.id,
          },
        ),
      );
    }
    const pad = approachPoint(lesson);
    scene.append(
      e('a-circle', {
        position: `${pad.x} .025 ${pad.z}`,
        rotation: '-90 0 0',
        radius: '.38',
        material: { shader: 'flat', color: lesson.color, opacity: 0.45, transparent: true },
        class: 'interactable',
        'data-teleport': lesson.id,
      }),
    );
    scene.append(group);
    stations.set(lesson.id, { group, ring, status, visuals });
  }
  const pathGroup = e('a-entity', { id: 'guide-path' });
  scene.append(pathGroup);
  const rig = e('a-entity', { id: 'player-rig', position: '0 0 5.7', 'learning-movement': '' });
  const camera = e('a-entity', {
    id: 'player-camera',
    camera: 'active: true; fov: 78',
    position: '0 1.65 0',
    'look-controls': 'pointerLockEnabled: false; touchEnabled: true',
    cursor: 'rayOrigin: mouse; fuse: false',
    raycaster: 'objects: .interactable; far: 15',
  });
  rig.append(camera);
  // A room-space console follows the player only while immersed. No HTML overlay is required in VR.
  const vrConsole = e('a-entity', {
    id: 'vr-tutor-console',
    position: '0 -.6 -1.5',
    visible: false,
  });
  const vrText = panel(['ROOM TUTOR', 'Point at an exhibit or a floor pad.'], '0 .3 0', 1.4, 0.56);
  vrConsole.append(vrText);
  for (const [index, label] of ['Explain', 'Guide', 'Quiz', 'Exit VR'].entries())
    vrConsole.append(
      panel(label, `${-0.54 + index * 0.36} -.1 0`, 0.33, 0.15, '#112a33', '#a7e6d6', {
        class: 'vr-control',
        'data-console': ['explain', 'guide', 'quiz', 'exit'][index],
      }),
    );
  const vrQuiz = e('a-entity', { visible: false });
  for (let i = 0; i < 3; i++)
    vrQuiz.append(
      panel(`${i + 1}`, '0 0 0', 1.4, 0.15, '#d5f2eb', '#27434f', {
        position: `0 ${-0.32 - i * 0.18} 0`,
        class: 'vr-choice',
        'data-quiz-choice': i,
      }),
    );
  vrConsole.append(vrQuiz);
  camera.append(vrConsole);
  for (const hand of ['left', 'right']) {
    const controller = e('a-entity', {
      'laser-controls': `hand: ${hand}; model: false`,
      raycaster: 'objects: .interactable; far: 15; lineColor: #8df3d1',
    });
    controller.addEventListener('thumbstickmoved', ({ detail }) => {
      const movement = rig.components['learning-movement'];
      if (!movement) return;
      if (hand === 'left')
        movement.stick = {
          x: Math.abs(detail.x) > 0.2 ? detail.x : 0,
          y: Math.abs(detail.y) > 0.2 ? detail.y : 0,
        };
      else if (Math.abs(detail.x) < 0.3) movement.turnReady = true;
      else if (Math.abs(detail.x) > 0.7 && movement.turnReady) {
        rig.object3D.rotation.y -= (Math.sign(detail.x) * Math.PI) / 6;
        movement.turnReady = false;
      }
    });
    controller.addEventListener('controllerdisconnected', () => {
      const movement = rig.components['learning-movement'];
      if (movement) movement.stick = { x: 0, y: 0 };
    });
    rig.append(controller);
  }
  scene.append(rig);
  let targetId = null,
    lastPath = 0;
  const getPosition = () => {
    const head = camera.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
    return { x: head.x, z: head.z };
  };
  const distance = (id) => {
    const lesson = LESSONS.find((l) => l.id === id);
    return Math.hypot(getPosition().x - lesson.x, getPosition().z - lesson.z);
  };
  const drawPath = () => {
    pathGroup.replaceChildren();
    const lesson = LESSONS.find((l) => l.id === targetId);
    if (!lesson) return;
    const path = findPath(getPosition(), approachPoint(lesson));
    for (const [i, p] of path.entries())
      if (i > 0)
        pathGroup.append(
          e('a-circle', {
            position: `${p.x} .035 ${p.z}`,
            rotation: '-90 0 0',
            radius: '.075',
            material: { shader: 'flat', color: '#99fbd8' },
          }),
        );
  };
  const guide = (id) => {
    targetId = id;
    for (const [key, station] of stations) {
      station.ring.setAttribute('material', 'opacity', key === id ? 1 : 0.3);
      station.ring.setAttribute('scale', key === id ? '1.1 1.1 1.1' : '1 1 1');
    }
    drawPath();
  };
  const teleport = (id) => {
    const lesson = LESSONS.find((l) => l.id === id);
    if (!lesson) return;
    const p = approachPoint(lesson);
    if (!canStand(p.x, p.z)) return;
    // Move the rig so the headset, including its physical tracking offset, arrives at the pad.
    const head = camera.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
    rig.object3D.position.x += p.x - head.x;
    rig.object3D.position.z += p.z - head.z;
    if (!scene.is('vr-mode')) {
      rig.object3D.rotation.y = 0;
      const look = camera.components['look-controls'];
      if (look) {
        look.yawObject.rotation.y = 0;
        look.pitchObject.rotation.x = 0;
      }
    }
    callbacks.select(id);
    drawPath();
  };
  scene.addEventListener('click', ({ target }) => {
    if (!scene.dataset.started) return;
    const el = target.closest?.('.interactable');
    if (!el) return;
    if (el.dataset.teleport) return teleport(el.dataset.teleport);
    if (el.dataset.console) return callbacks.console(el.dataset.console);
    if (el.dataset.quizChoice !== undefined) return callbacks.answer(Number(el.dataset.quizChoice));
    const id = el.dataset.station ?? el.dataset.select;
    if (!id) return;
    if (distance(id) > 3.7) {
      guide(id);
      callbacks.hint('Follow the glowing floor trail, or select its floor pad to teleport closer.');
      return;
    }
    callbacks.select(id);
    if (el.dataset.action) callbacks.action(id, el.dataset.action);
  });
  rig.addEventListener('player-moved', ({ detail }) => {
    callbacks.position(detail);
    if (performance.now() - lastPath > 800) {
      lastPath = performance.now();
      drawPath();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    camera.setAttribute('cursor', 'rayOrigin', document.pointerLockElement ? 'entity' : 'mouse');
    // Capture is an explicit HUD action, so ordinary canvas drags never force capture.
    if (camera.components['look-controls'])
      camera.components['look-controls'].pointerLocked = Boolean(document.pointerLockElement);
  });
  let activeQuiz = null;
  const syncConsoleTargets = () => {
    vrConsole
      .querySelectorAll('.vr-control')
      .forEach((node) => node.classList.toggle('interactable', scene.is('vr-mode')));
    vrQuiz
      .querySelectorAll('.vr-choice')
      .forEach((node) =>
        node.classList.toggle('interactable', scene.is('vr-mode') && Boolean(activeQuiz)),
      );
  };
  scene.addEventListener('enter-vr', () => {
    vrConsole.setAttribute('visible', true);
    syncConsoleTargets();
    callbacks.immersive(true);
  });
  scene.addEventListener('exit-vr', () => {
    vrConsole.setAttribute('visible', false);
    syncConsoleTargets();
    callbacks.immersive(false);
  });
  mount.append(scene);

  function renderExhibit(state) {
    const lesson = LESSONS.find((l) => l.id === state.id),
      station = stations.get(state.id),
      v = station.visuals;
    v.replaceChildren();
    setPanel(station.status, state.message);
    const tile = (label, p, size, color = lesson.color) => {
      const [x, y, z] = p.split(' ').map(Number);
      const item = e('a-entity', { position: p });
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        item.setAttribute('animation', {
          property: 'position',
          from: `${x} ${y + 0.12} ${z}`,
          to: p,
          dur: 220,
          easing: 'easeOutQuad',
        });
      item.append(
        box('0 0 0', size, color),
        panel(label, `0 0 ${size[2] / 2 + 0.008}`, size[0] * 0.9, size[1] * 0.8, '#10222f', color),
      );
      v.append(item);
    };
    if (state.id === 'stack') {
      v.append(box('0 .03 0', [1.4, 0.06, 0.7], '#203843'));
      state.items.forEach((item, index) =>
        tile(String(item), `0 ${0.14 + index * 0.23} 0`, [0.8, 0.2, 0.55]),
      );
      if (!state.items.length)
        v.append(panel('PUSH TO BUILD', '0 .4 .02', 1.2, 0.35, lesson.color));
    } else if (state.id === 'queue') {
      v.append(box('0 .03 0', [2.1, 0.08, 0.8], '#203843'));
      state.items.forEach((item, index) =>
        tile(String(item), `${-0.8 + index * 0.4} .25 0`, [0.31, 0.4, 0.4]),
      );
      v.append(panel('OUT ← FRONT       BACK ← IN', '0 .65 0', 2.1, 0.27, lesson.color));
    } else if (state.id === 'cache') {
      tile('STORE', '-.66 .36 -.22', [0.65, 0.7, 0.44], '#627d8c');
      tile(
        state.cached ? 'COPY' : 'EMPTY',
        '.63 .24 .1',
        [0.7, 0.46, 0.6],
        state.cached ? lesson.color : '#627d8c',
      );
      v.append(
        box('0 .12 .1', [0.55, 0.045, 0.08], state.hits ? '#84e8b4' : '#f8b374', {
          material: glow(state.hits ? '#84e8b4' : '#f8b374'),
        }),
      );
      v.append(
        panel(
          state.hits ? 'HIT → NEAR COPY' : state.cached ? 'MISS → COPY SAVED' : 'REQUEST DATA',
          '0 .93 0',
          2.05,
          0.28,
          lesson.color,
        ),
      );
    } else if (state.id === 'recursion') {
      const count = [1, 2, 3, 3, 2, 1][state.step];
      for (let i = 0; i < count; i++)
        tile(
          state.step === 5 ? '3! = 6' : `${3 - i}!${i === 2 ? ' = 1' : ''}`,
          `0 ${0.14 + i * 0.3} ${-i * 0.08}`,
          [1.5 - i * 0.3, 0.24, 0.5],
          i === 2 ? '#ffe29d' : lesson.color,
        );
    } else if (state.id === 'deadlock') {
      for (const x of [-0.65, 0.65]) {
        v.append(
          box(`${x} .23 0`, [0.43, 0.45, 0.4], lesson.color),
          e('a-sphere', { position: `${x} .63 0`, radius: '.19', color: '#a2cad4' }),
        );
      }
      tile(state.step ? 'KEY 1' : 'READY', '-.65 .98 0', [0.75, 0.23, 0.04]);
      tile(state.step ? 'KEY 2' : 'READY', '.65 .98 0', [0.75, 0.23, 0.04]);
      if (state.step === 2) {
        v.append(panel('A → WAIT ← B', '0 .47 .25', 1.9, 0.25, '#ffe194'));
        v.append(box('0 .14 .18', [0.7, 0.05, 0.06], '#ef708c', { material: glow('#ef708c') }));
      }
    } else if (state.id === 'semaphore') {
      for (let i = 0; i < 2; i++) {
        const occupied = i < state.items.length;
        v.append(
          e('a-cylinder', {
            position: `${-0.5 + i} .1 0`,
            radius: '.36',
            height: '.18',
            color: occupied ? lesson.color : '#355563',
          }),
        );
        if (occupied)
          v.append(
            e('a-sphere', { position: `${-0.5 + i} .49 0`, radius: '.22', color: lesson.color }),
          );
      }
      v.append(
        panel(
          `${2 - state.items.length} FREE PERMITS${state.waiting ? ' · 1 WAITING' : ''}`,
          '0 1.02 0',
          2.2,
          0.3,
          lesson.color,
        ),
      );
      if (state.waiting)
        v.append(e('a-sphere', { position: '1 .35 .3', radius: '.17', color: '#ff8398' }));
    }
  }
  LESSONS.forEach((lesson) => renderExhibit(initialExhibit(lesson.id)));
  return {
    scene,
    camera,
    rig,
    guide,
    teleport,
    renderExhibit,
    distance,
    getPosition,
    start() {
      scene.dataset.started = 'true';
    },
    pause(value) {
      scene.dataset.paused = String(value);
      if (value && document.pointerLockElement) document.exitPointerLock();
    },
    nearest() {
      return [...LESSONS].sort((a, b) => distance(a.id) - distance(b.id))[0];
    },
    setTutor(text, quiz = null) {
      activeQuiz = quiz;
      syncConsoleTargets();
      setPanel(vrText, text.length > 420 ? `${text.slice(0, 417)}…` : text);
      vrQuiz.setAttribute('visible', Boolean(quiz));
      if (quiz) {
        setPanel(vrText, quiz.question);
        [...vrQuiz.children].forEach((node, i) => setPanel(node, `${i + 1}. ${quiz.options[i]}`));
      }
    },
  };
}
