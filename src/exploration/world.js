import { roleLabel } from './guidance.js';
import { THEMES, ANCHORS, MAIN } from './catalog.js';
import { available, progress, canStand, move, pathTo } from './state.js';
import { readVRInput } from '../discovery/vr-input.js';
const el = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...children);
  return n;
};
const box = (p, size, color, extra = {}) =>
  el('a-box', { position: p, width: size[0], height: size[1], depth: size[2], color, ...extra });
const ball = (p, r, color) =>
  el('a-sphere', { position: p, radius: r, color, 'segments-width': 20, 'segments-height': 12 });
const cylinder = (p, r, h, color) =>
  el('a-cylinder', { position: p, radius: r, height: h, color, 'segments-radial': 24 });
const ring = (p, r, color, rotation = '0 0 0') =>
  el('a-torus', { position: p, radius: r, 'radius-tubular': 0.025, color, rotation });
const textures = new Map();
function sign(text, p, width = 1.8, height = 0.35, bg = '#142333', color = '#f7f1df', intent) {
  const key = JSON.stringify([text, bg, color]);
  let src = textures.get(key);
  if (!src) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 384;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = color;
    const font = text.length > 150 ? 46 : text.length > 60 ? 65 : text.length > 28 ? 90 : 130;
    ctx.font = `600 ${font}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let lines = [],
      line = '';
    for (const word of text.split(/\s+/)) {
      if (ctx.measureText(`${line} ${word}`).width > 940) {
        lines.push(line);
        line = word;
      } else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) =>
      ctx.fillText(
        l,
        512,
        192 + (i - (lines.length - 1) / 2) * Math.min(font * 1.2, 350 / lines.length),
      ),
    );
    src = c.toDataURL();
    textures.set(key, src);
  }
  return el('a-plane', {
    position: p,
    width,
    height,
    material: { shader: 'flat', src, side: 'double' },
    ...(intent ? { class: 'explore-target', 'data-action': intent } : {}),
  });
}
// Every model has a visible state change corresponding to its authored experiment.
export function model(kind, t, color, reduced = false) {
  const g = el('a-entity'),
    done = t.done,
    n = t.step || 0;
  if (kind === 'globe') {
    g.append(ball('-1 .25 0', 0.2, '#ffdb76'), sign('SUN', '-1 -.15 .15', 0.55, 0.18));
    const earth = el('a-entity', { rotation: `0 ${n === 1 ? 0 : 180} 0` }, [
      ball('0 .25 0', 0.5, '#429dad'),
      ball('-.47 .25 .15', 0.08, '#ffe0a2'),
    ]);
    g.append(
      earth,
      ring('0 .25 0', 0.54, color, '75 0 0'),
      sign(n === 1 ? 'MARKED TOWN: DAY' : 'MARKED TOWN: NIGHT', '0 -.5 .2', 1.6, 0.25),
    );
  } else if (kind === 'planets') {
    g.append(ball('-.9 .15 0', 0.23, '#ffdb76'));
    ['Mercury', 'Venus', 'Earth', 'Mars'].forEach((name, i) => {
      g.append(
        ball(
          `${-0.45 + i * 0.43} .15 0`,
          i < n ? 0.12 : 0.055,
          ['#b7aba2', '#e9ba7a', '#68d0dc', '#e79675'][i],
        ),
        sign(i < n ? name : String(i + 1), `${-0.45 + i * 0.43} -.2 .1`, 0.42, 0.18),
      );
    });
    g.append(sign('INNER PLANETS / NOT TO SCALE', '0 -.55 .15', 2, 0.25));
  } else if (kind === 'moon') {
    g.append(
      ball('-.85 .15 0', 0.18, '#ffd984'),
      ball('0 .15 0', 0.22, '#7bc2dd'),
      ball(`${n === 1 ? -0.45 : 0.55} .15 0`, 0.13, '#ddd3c3'),
      sign(n === 1 ? 'EARTH VIEW: NEW MOON' : 'EARTH VIEW: FULL MOON', '0 -.4 .2', 1.8, 0.3),
    );
  } else if (kind === 'circuit') {
    g.append(box('0 0 0', [1.8, 1, 0.12], '#284448'));
    for (const x of [-0.65, 0.65])
      g.append(box(`${x} 0 .09`, [0.04, 0.7, 0.04], n >= 3 ? color : '#6e7d7d'));
    for (const y of [-0.35, 0.35])
      g.append(box(`0 ${y} .09`, [1.3, 0.04, 0.04], n >= 3 ? color : '#6e7d7d'));
    g.append(
      cylinder('-.6 0 .18', 0.1, n >= 1 ? 0.4 : 0.1, '#dfba82'),
      ball('.6 .2 .2', 0.18, done ? '#fff2a3' : '#637575'),
      box(`0 -.35 .22`, [0.25, 0.06, 0.12], n >= 3 ? '#ffd38b' : '#6e7d7d', {
        rotation: `0 0 ${done ? 0 : 30}`,
      }),
    );
  } else if (kind === 'balance') {
    const beam = el('a-entity', { rotation: `0 0 ${done ? 0 : -15 + n * 6}` });
    beam.append(box('0 .3 0', [1.8, 0.08, 0.1], color));
    for (const x of [-0.7, 0.7]) {
      beam.append(
        box(`${x} 0 0`, [0.02, 0.6, 0.02], color),
        cylinder(`${x} -.3 0`, 0.3, 0.06, '#d4bd90'),
      );
      for (let i = 0; i < (x < 0 ? 2 : n); i++)
        beam.append(box(`${x} ${-0.2 + i * 0.18} 0`, [0.18, 0.16, 0.18], '#ffce84'));
    }
    g.append(cylinder('0 -.2 0', 0.08, 1, '#d4bd90'), beam);
  } else if (kind === 'gears') {
    for (let i = 0; i < 3; i++) {
      const gear = el('a-entity', { position: `${-0.65 + i * 0.65} .1 0` }, [
        cylinder('0 0 0', 0.27, 0.12, color),
      ]);
      gear.firstChild.setAttribute('rotation', '90 0 0');
      for (let j = 0; j < 8; j++)
        gear.append(
          box(
            `${Math.cos((j * Math.PI) / 4) * 0.28} ${Math.sin((j * Math.PI) / 4) * 0.28} 0`,
            [0.13, 0.13, 0.15],
            '#d8ba81',
            { rotation: `0 0 ${j * 45}` },
          ),
        );
      if (done && !reduced)
        gear.setAttribute(
          'animation',
          `property: rotation; to: 0 0 ${i % 2 ? -360 : 360}; dur: 8000; loop: true; easing: linear`,
        );
      g.append(gear);
    }
  } else if (kind === 'depth') {
    ['SUNLIT', 'DIM', 'DARK'].forEach((label, i) =>
      g.append(
        box(`0 ${0.6 - i * 0.5} 0`, [1.3, 0.46, 0.35], ['#6cd4cf', '#327e9d', '#173c66'][i]),
        sign(label, `0 ${0.6 - i * 0.5} .2`, 1.2, 0.25),
      ),
    );
    if (n) g.append(ball('.8 .6 0', 0.13, '#ffe9a0'));
  } else if (kind === 'food') {
    ['ALGAE', 'GRAZER', 'PREDATOR'].forEach((v, i) => {
      g.append(
        ball(`${-0.7 + i * 0.7} 0 0`, 0.13 + i * 0.04, i < n ? color : '#56777d'),
        sign(v, `${-0.7 + i * 0.7} -.35 .1`, 0.65, 0.22),
      );
      if (i < 2) g.append(sign('→', `${-0.35 + i * 0.7} 0 .1`, 0.25, 0.2));
    });
  } else if (kind === 'fish') {
    g.append(ball('0 .3 0', 0.28, color));
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      g.append(
        el('a-cylinder', {
          position: `${Math.cos(angle) * 0.32} -.05 ${Math.sin(angle) * 0.32}`,
          radius: 0.045,
          height: 0.55,
          color,
          rotation: `${Math.sin(angle) * 35} 0 ${-Math.cos(angle) * 35}`,
        }),
      );
    }
    g.append(sign('EIGHT ARMS / OBSERVE THE VISITOR', '0 -.6 .5', 1.7, 0.3));
  } else if (kind === 'cleanup') {
    if (!done) g.append(cylinder('-.5 .1 0', 0.12, 0.4, '#8acadd'));
    g.append(
      el('a-cone', {
        position: '0 0 0',
        height: 0.25,
        'radius-bottom': 0.2,
        color: '#efd1a5',
        rotation: '90 0 0',
      }),
      el('a-dodecahedron', { position: '.5 0 0', radius: 0.2, color: '#8b9295' }),
      sign(
        done ? 'LITTER COLLECTED / HABITAT KEPT' : 'BOTTLE / SHELL / ROCK',
        '0 -.4 .3',
        1.8,
        0.3,
      ),
    );
  } else if (kind === 'reef' || kind === 'habitat') {
    g.append(
      box('0 0 -.2', [1.9, 1.1, 0.5], '#215870', {
        material: 'color: #215870; transparent: true; opacity: .5',
      }),
    );
    for (let i = 0; i < (done ? 7 : 3); i++) {
      const x = -0.7 + i * 0.22;
      g.append(
        cylinder(
          `${x} -.3 0`,
          0.05,
          0.2 + (i % 3) * 0.16,
          ['#dc8f96', '#7dcdb7', '#f0bf77'][i % 3],
        ),
      );
    }
    for (let i = 0; i < (done ? 4 : 1); i++) {
      const fish = el('a-entity', { position: `${-0.6 + i * 0.4} ${0.1 + (i % 2) * 0.2} .12` }, [
        ball('0 0 0', 0.12, color),
        el('a-cone', {
          position: '-.18 0 0',
          height: 0.2,
          'radius-bottom': 0.12,
          rotation: '0 0 90',
          color,
        }),
      ]);
      if (done && !reduced)
        fish.setAttribute(
          'animation',
          `property: position; to: ${0.6 - i * 0.4} ${0.1 + (i % 2) * 0.2} .12; dir: alternate; dur: ${5000 + i * 700}; loop: true; easing: easeInOutSine`,
        );
      g.append(fish);
    }
  } else if (kind === 'ramp') {
    for (let i = 0; i < 2; i++) {
      g.append(
        box(`${-0.5 + i} 0 0`, [0.6, 0.08, 1.5], color, { rotation: `${i ? 12 : 28} 0 0` }),
        ball(`${-0.5 + i} ${done ? -0.15 : 0.4} ${done ? 0.6 : -0.5}`, 0.12, '#f8d18e'),
      );
    }
    g.append(
      sign(done ? 'STEEPER ARRIVED FIRST' : 'SAME LENGTH / MATCHING BALLS', '0 -.5 .8', 1.9, 0.3),
    );
  } else if (kind === 'channel') {
    for (let i = 0; i < 3; i++) {
      g.append(
        box(`${-0.65 + i * 0.65} 0 0`, [0.57, 0.13, 0.6], i < n ? color : '#648087'),
        sign(['RIGHT', 'STRAIGHT', 'LEFT'][i], `${-0.65 + i * 0.65} .2 .2`, 0.6, 0.22),
      );
    }
    if (done) g.append(ball('.9 .25 .2', 0.13, '#ffe297'));
  } else if (kind === 'rover' || kind === 'toy') {
    const toy = el('a-entity', {}, [
      box('0 .1 0', [0.8, 0.3, 0.5], color),
      ball('.1 .35 0', 0.15, '#f6db9c'),
    ]);
    for (const x of [-0.25, 0.25])
      for (const z of [-0.3, 0.3]) toy.append(ball(`${x} -.1 ${z}`, 0.12, '#263442'));
    if (kind === 'rover' && done) {
      if (reduced) toy.setAttribute('position', '.45 0 -.35');
      else {
        toy.setAttribute(
          'animation__forward',
          'property: position; from: 0 0 0; to: 0 0 -.35; dur: 1000; easing: linear',
        );
        toy.setAttribute(
          'animation__turn',
          'property: rotation; to: 0 -90 0; delay: 1000; dur: 500',
        );
        toy.setAttribute(
          'animation__finish',
          'property: position; from: 0 0 -.35; to: .45 0 -.35; delay: 1500; dur: 1000; easing: linear',
        );
      }
    } else if (done && !reduced)
      toy.setAttribute(
        'animation',
        'property: position; to: .6 0 0; dir: alternate; dur: 3000; loop: true; easing: easeInOutSine',
      );
    g.append(toy, sign(done ? 'ROUTE COMPLETE' : 'REPAIR DIAGRAM', '0 -.5 .1', 1.5, 0.25));
  } else if (kind === 'robot') {
    g.append(box('0 -.1 0', [0.7, 0.7, 0.45], color), box('0 .55 0', [0.65, 0.5, 0.45], '#e2d2ad'));
    for (const x of [-0.17, 0.17])
      g.append(ball(`${x} .58 .24`, 0.065, done ? '#75ffe0' : '#344254'));
    for (const x of [-0.5, 0.5])
      g.append(
        box(`${x} .05 0`, [0.16, 0.6, 0.15], '#bd9970', {
          rotation: `0 0 ${done ? Math.sign(x) * 55 : 0}`,
        }),
      );
  } else if (kind === 'beacon') {
    g.append(
      cylinder('0 -.1 0', 0.3, 0.8, '#e1c697'),
      ball('0 .4 0', 0.28, done ? color : '#597180'),
    );
    for (let i = 0; i < 4; i++)
      g.append(
        box(
          `${Math.cos((i * Math.PI) / 2) * (done ? 0.6 : 0.35)} .2 ${Math.sin((i * Math.PI) / 2) * (done ? 0.6 : 0.35)}`,
          [0.12, 0.8, 0.25],
          color,
          { rotation: `0 ${i * 90} ${done ? 35 : 0}` },
        ),
      );
  } else {
    g.append(
      box('0 0 0', [1.5, 1, 0.45], '#354a59'),
      box(`${done ? 0.85 : 0} .1 .3`, [1.4, 0.85, 0.08], color, {
        rotation: `0 ${done ? -65 : 0} 0`,
      }),
    );
    if (kind === 'recorder')
      for (let i = 0; i < 2; i++) g.append(ring(`${-0.4 + i * 0.8} .1 .37`, 0.22, '#edc686'));
    if (kind === 'locker') {
      g.append(ring('.4 .15 .44', 0.18, '#fff0c8'), sign('CIRCLE SLOT', '.4 -.2 .46', 0.7, 0.2));
      g.append(
        cylinder('-.45 .1 .6', 0.14, 0.4, '#79d8ed'),
        ring('-.45 .1 .76', 0.07, '#fff0c8'),
        sign('WATER / CIRCLE', '-.45 -.3 .8', 0.8, 0.23),
      );
    }
    if (kind === 'tools') {
      g.append(
        cylinder('-.4 .2 .5', 0.09, 0.35, '#f0c387'),
        box('-.4 -.1 .5', [0.04, 0.3, 0.04], '#cbd7dd'),
        ball('.4 .1 .5', 0.15, '#cbd7dd'),
        box('.4 .1 .66', [0.2, 0.03, 0.02], '#203a45'),
        sign('SCREWDRIVER / SCREW', '0 -.45 .7', 1.5, 0.24),
      );
    }
    if (done) g.append(ball('0 .05 .4', 0.18, '#ffe4a4'));
  }
  return g;
}
export function discoveryModel(theme, i, p, color) {
  const g = el('a-entity', { rotation: `0 ${p.rotation} 0` }),
    v = p.value;
  if (i === 1) {
    if (theme === 'ocean') {
      for (let j = 0; j < Number(v); j++) g.append(ball(`${-0.45 + j * 0.3} 0 0`, 0.1, color));
    } else {
      g.append(box('0 0 0', [0.6, 0.15, 0.2], '#c7b58c'));
      for (let j = 0; j < Number(v); j++)
        g.append(
          theme === 'space'
            ? box(`${-0.45 + j * 0.3} .12 0`, [0.2, 0.06, 0.4], color)
            : ball(`${-0.45 + j * 0.3} -.15 .15`, 0.1, color),
        );
    }
  } else if (theme === 'space' && i === 0) {
    if (v === 'Star') {
      for (let j = 0; j < 5; j++)
        g.append(box('0 0 0', [0.08, 0.65, 0.08], color, { rotation: `0 0 ${j * 36}` }));
    } else if (v === 'Leaf')
      g.append(
        el('a-sphere', { radius: 0.25, scale: '.6 1.5 .2', color }),
        box('0 -.2 0', [0.03, 0.4, 0.03], '#d8c58d'),
      );
    else
      for (let j = 0; j < 3; j++)
        g.append(
          box(`${j % 2 ? 0.1 : 0} ${0.3 - j * 0.25} 0`, [0.1, 0.35, 0.06], color, {
            rotation: '0 0 -35',
          }),
        );
  } else if (theme === 'space') {
    g.append(el('a-dodecahedron', { radius: 0.3, color: '#8e8b9c' }));
    if (v === 'Ridges')
      for (let j = 0; j < 3; j++)
        g.append(box(`${-0.15 + j * 0.15} 0 .25`, [0.035, 0.35, 0.04], '#c2b3c7'));
    if (v === 'Pits')
      for (let j = 0; j < 3; j++)
        g.append(ball(`${-0.15 + j * 0.15} ${(j % 2) * 0.1} .25`, 0.05, '#39414d'));
  } else if (theme === 'ocean' && i === 0) {
    g.append(
      el('a-cone', {
        radius: 0.3,
        'radius-bottom': 0.3,
        height: 0.5,
        rotation: '90 0 0',
        color: '#edcfa7',
      }),
    );
    if (v === 'Spiral shell') g.append(ring('0 0 .25', 0.15, color));
    if (v === 'Fan shell')
      for (let j = 0; j < 5; j++)
        g.append(box('0 0 .2', [0.025, 0.5, 0.02], color, { rotation: `0 0 ${j * 25}` }));
    if (v === 'Striped shell')
      for (let j = 0; j < 3; j++)
        g.append(box(`0 ${-0.15 + j * 0.15} .25`, [0.3, 0.035, 0.03], color));
  } else if (theme === 'ocean') {
    g.append(el('a-sphere', { radius: 0.28, scale: '1.4 .65 .5', color }));
    if (v === 'Spots')
      for (let j = 0; j < 3; j++) g.append(ball(`${-0.2 + j * 0.2} 0 .14`, 0.04, '#183b4f'));
    if (v === 'Stripes')
      for (let j = 0; j < 3; j++)
        g.append(box(`${-0.2 + j * 0.2} 0 .14`, [0.025, 0.25, 0.02], '#183b4f'));
  } else if (i === 0) {
    g.append(ring('0 0 0', 0.25, color));
    for (let j = 0; j < 5; j++)
      g.append(
        v === 'Dotted washer'
          ? ball(`${Math.cos(j * 1.25) * 0.25} ${Math.sin(j * 1.25) * 0.25} .03`, 0.035, '#253548')
          : box(
              `${Math.cos(j * 1.25) * 0.25} ${Math.sin(j * 1.25) * 0.25} .03`,
              [0.025, 0.12, 0.03],
              '#253548',
              { rotation: `0 0 ${v === 'Zigzag washer' ? (j % 2) * 90 : 0}` },
            ),
      );
  } else
    g.append(
      el('a-cylinder', {
        radius: 0.3,
        height: 0.07,
        rotation: '90 0 0',
        'segments-radial': { Triangle: 3, Square: 4, Hexagon: 6 }[v],
        color,
      }),
    );
  return g;
}
export function createWorld(mount, callbacks) {
  const A = window.AFRAME,
    THREE = A.THREE;
  const scene = el('a-scene', {
    embedded: '',
    background: 'color: #122136',
    renderer: 'antialias: true; colorManagement: true',
    'xr-mode-ui': 'enabled: false',
    'loading-screen': 'enabled: false',
  });
  const room = el('a-entity'),
    fixtures = el('a-entity'),
    trail = el('a-entity');
  scene.append(room);
  const rig = el('a-entity', { position: '0 0 5.7' }),
    camera = el('a-entity', {
      camera: 'active: true',
      position: '0 1.65 0',
      'look-controls': 'pointerLockEnabled: false',
      cursor: 'rayOrigin: mouse; fuse: false',
      raycaster: 'objects: .explore-target; far: 20',
    });
  rig.append(camera);
  scene.append(rig);
  const panel = el('a-entity', { position: '0 0 -1.65', visible: false });
  camera.append(panel);
  let state,
    settings = {},
    menu = null,
    page = 0,
    textPage = 0,
    immersive = false,
    paused = true,
    started = false,
    route = null,
    lens = null;
  const keys = new Set();
  let menuHeld = false,
    turnReady = true;
  const position = () => {
    const p = camera.object3D.getWorldPosition(new THREE.Vector3());
    return { x: p.x, z: p.z };
  };
  function step(side, forward, amount) {
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.object3D.getWorldQuaternion(new THREE.Quaternion()),
    );
    d.y = 0;
    d.normalize();
    const p = position(),
      next = move(p, (d.x * forward - d.z * side) * amount, (d.z * forward + d.x * side) * amount);
    rig.object3D.position.x += next.x - p.x;
    rig.object3D.position.z += next.z - p.z;
  }
  function moveTo(id) {
    const a = ANCHORS[id];
    if (!a || state?.quiz) return;
    const p = position();
    if (canStand(a.approach.x, a.approach.z)) {
      rig.object3D.position.x += a.approach.x - p.x;
      rig.object3D.position.z += a.approach.z - p.z;
      if (!immersive) {
        const yaw = camera.components['look-controls']?.yawObject;
        if (yaw) yaw.rotation.y = Math.atan2(a.approach.x - a.x, a.approach.z - a.z);
      }
      drawTrail();
    }
  }
  function drawTrail() {
    trail.replaceChildren();
    if (!route || !state || state.quiz) return;
    for (const p of pathTo(position(), ANCHORS[route].approach))
      trail.append(
        el('a-circle', {
          position: `${p.x} .025 ${p.z}`,
          rotation: '-90 0 0',
          radius: 0.07,
          material: 'shader: flat; color: #ffcf86',
        }),
      );
  }
  function drawPanel() {
    panel.replaceChildren();
    panel.setAttribute('visible', immersive && Boolean(menu));
    if (!immersive || !menu) return;
    const count = Math.max(1, Math.ceil(menu.buttons.length / 6));
    page = Math.min(page, count - 1);
    const prose = menu.text
      .replace(/\n/g, ' ')
      .match(settings.large ? /.{1,140}(?:\s|$)|.{1,140}/g : /.{1,220}(?:\s|$)|.{1,220}/g) || [''];
    textPage = textPage % prose.length;
    panel.append(
      sign(menu.title, '0 .6 0', 1.9, 0.24),
      sign(prose[textPage], '0 .23 0', 1.9, 0.46),
    );
    const buttons = [
      ...menu.buttons.slice(page * 6, page * 6 + 6),
      ...(count > 1 ? [{ label: `More ${page + 1}/${count}`, action: 'page' }] : []),
      ...(prose.length > 1
        ? [{ label: `Read more ${textPage + 1}/${prose.length}`, action: 'text-page' }]
        : []),
      ...(!state?.quiz ? [{ label: 'Hide / B or Y', action: 'close' }] : []),
      { label: 'Exit VR', action: 'exit-vr' },
    ];
    buttons.forEach((b, i) =>
      panel.append(
        sign(
          b.label,
          `${i % 2 ? 0.49 : -0.49} ${-0.13 - Math.floor(i / 2) * 0.19} .01`,
          0.94,
          0.17,
          '#f6ecd5',
          '#173347',
          b.action,
        ),
      ),
    );
  }
  function drawRoom() {
    const theme = THEMES[state.theme];
    room.replaceChildren();
    room.append(
      box('0 -.14 0', [14, 0.28, 14], '#d4c6a5'),
      box('0 2.5 -7', [14, 5, 0.2], theme.dark),
      box('-7 2.5 0', [0.2, 5, 14], theme.dark),
      box('7 2.5 0', [0.2, 5, 14], theme.dark),
      box('0 2.5 7', [14, 5, 0.2], theme.dark),
      box('0 5 0', [14, 0.15, 14], '#263c4d'),
    );
    for (let i = -6; i <= 6; i += 2) {
      room.append(
        box(`${i} .006 0`, [0.025, 0.01, 14], '#b5a787'),
        box(`0 .006 ${i}`, [14, 0.01, 0.025], '#b5a787'),
      );
    }
    for (const x of [-6.7, 6.7])
      for (const z of [-5, -1, 3])
        room.append(
          box(`${x} 2.5 ${z}`, [0.18, 5, 0.2], '#8c9a98'),
          box(`${x * 0.99} 3.6 ${z}`, [0.08, 0.6, 0.25], theme.color),
        );
    for (const x of [-4, 0, 4]) room.append(box(`${x} 4.88 0`, [0.1, 0.08, 12], theme.color));
    room.append(
      sign(theme.title.toUpperCase(), '0 4.1 -6.85', 5, 0.5, '#152b3a', '#f3dfad'),
      sign('DISCOVERY ROOM / EXIT', '0 2.6 6.85', 2.8, 0.45, '#152b3a', '#f3dfad'),
    );
    room.lastChild.setAttribute('rotation', '0 180 0');
    room.append(box('0 1.3 6.88', [2.1, 2.6, 0.05], '#758e8f'));
    // Tall observation windows give each theme depth without leaving the room.
    for (const x of [-5.5, 2.6]) {
      room.append(
        el('a-circle', { position: `${x} 2.9 -6.83`, radius: 1.05, color: '#0a1b31' }),
        ring(`${x} 2.9 -6.79`, 1.08, theme.color),
      );
      for (let i = 0; i < 12; i++)
        room.append(
          ball(
            `${x + Math.cos(i * 2.4) * (0.3 + (i % 3) * 0.22)} ${2.9 + Math.sin(i * 2.4) * (0.3 + (i % 3) * 0.22)} -6.76`,
            state.theme === 'ocean' ? 0.055 : 0.025,
            theme.color,
          ),
        );
    }
    room.append(fixtures, trail);
    drawTrail();
  }
  function render(s, opts) {
    const changed = state?.theme !== s.theme;
    state = s;
    settings = opts;
    if (changed) drawRoom();
    fixtures.replaceChildren();
    const theme = THEMES[s.theme];
    for (const [id, a] of Object.entries(ANCHORS)) {
      const g = el('a-entity', { position: `${a.x} 0 ${a.z}` });
      fixtures.append(g);
      if (id.startsWith('prop')) {
        const i = Number(id.slice(4)),
          p = s.props[i],
          def = theme.props[i];
        g.append(
          cylinder('0 .6 0', 0.38, 1.2, '#617b7d'),
          sign(def[0], '0 1.55 .2', 1.3, 0.3, '#192f41', '#f8e8c6', `inspect:${i}`),
          sign(
            p.opened ? p.value : 'MEMORY / INSPECT',
            '0 1.15 .45',
            1.2,
            0.25,
            '#f0e0bf',
            '#163346',
            `inspect:${i}`,
          ),
        );
        const shape = discoveryModel(s.theme, i, p, theme.color);
        shape.setAttribute('position', '0 1.9 0');
        g.append(shape);
        continue;
      }
      const t = s.tasks[id],
        d = theme.tasks[id],
        unlocked = available(s, id),
        color = t.done ? '#89e4b5' : unlocked ? theme.color : '#809296';
      if (id === 'finale') {
        g.append(cylinder('0 .32 0', 1, 0.64, '#3f626b'), ring('0 .67 0', 0.95, color, '90 0 0'));
      } else if (['arrival', 'synthesis'].includes(id)) {
        g.append(box('0 .9 -.35', [1.4, 1.8, 0.45], '#526b71'));
      } else if (id === 'sideB') {
        g.append(box('0 .35 0', [1.5, 0.7, 0.9], '#75877e'));
      } else if (id === 'branchA') {
        g.append(cylinder('0 3.3 -.2', 0.035, 3, '#b4c6bf'));
      } else g.append(box('0 1.4 -.45', [1.9, 2.5, 0.16], '#425e6a'));
      const object = model(d.kind, t, color, opts.reduced);
      object.setAttribute('position', `0 ${id === 'sideB' ? 1 : 1.65} 0`);
      g.append(object);
      const label = `${roleLabel(s, id)} / ${d.title}`;
      g.append(
        sign(
          label,
          `0 ${id === 'sideB' ? 2.1 : 2.85} .3`,
          2,
          0.35,
          '#142e41',
          '#fff1cf',
          `open:${id}`,
        ),
      );
      g.append(
        sign(
          s.pocket?.id === id
            ? `USE ${s.pocket.value}`
            : t.done
              ? 'REVIEW'
              : unlocked
                ? 'OPEN TASK'
                : 'WHY LOCKED?',
          '0 .85 .65',
          1.5,
          0.28,
          '#eee0bf',
          '#223c49',
          s.pocket?.id === id ? `use:${id}` : `open:${id}`,
        ),
      );
    }
    if (s.treasure) {
      const celebration = el('a-entity', { position: '0 4.5 -.4' });
      for (let i = 0; i < 8; i++)
        celebration.append(
          ball(`${Math.cos(i * 0.785) * 1.7} 0 ${Math.sin(i * 0.785) * 1.7}`, 0.085, theme.color),
        );
      if (!opts.reduced)
        celebration.setAttribute(
          'animation',
          'property: rotation; to: 0 360 0; dur: 60000; loop: true; easing: linear',
        );
      fixtures.append(
        celebration,
        sign(`${opts.emblem || 'Star'} EXPLORER / KEEPSAKE UNLOCKED`, '0 3.4 -.4', 3.2, 0.4),
      );
    }
    const companion = model('robot', { step: 0, done: s.treasure }, theme.color, true);
    companion.setAttribute('position', '2.5 1 5.6');
    companion.setAttribute('scale', '.5 .5 .5');
    fixtures.append(companion);
    fixtures.append(sign(`${progress(s)} / 5 MAIN DISCOVERIES`, '0 .75 1', 2.2, 0.3));
    room.setAttribute('visible', !s.quiz);
    room
      .querySelectorAll('[data-action]')
      .forEach((n) => n.classList.toggle('explore-target', !s.quiz && !menu));
    if (lens) lens.remove();
    lens = null;
  }
  function showLens(i) {
    if (state.quiz) return;
    const p = state.props[i],
      copy = discoveryModel(state.theme, i, p, THEMES[state.theme].color);
    copy.setAttribute('scale', '1.5 1.5 1.5');
    lens = el('a-entity', { position: '1.25 .05 -2' }, [copy, sign(p.value, '0 -.55 .1', 1, 0.25)]);
    camera.append(lens);
  }
  const light = el('a-light', { type: 'ambient', intensity: 1.4, color: '#fff3d7' });
  scene.append(light, el('a-light', { type: 'directional', position: '0 5 5', intensity: 1.8 }));
  for (const hand of ['left', 'right']) {
    const c = el('a-entity', {
      'laser-controls': `hand: ${hand}; model: false`,
      raycaster: 'objects: .explore-target; far: 20; lineColor: #ffd795',
    });
    c.append(sign('MENU', '0 .08 -.2', 0.18, 0.06, '#173447', '#fff1cc', 'menu'));
    rig.append(c);
  }
  scene.addEventListener('click', (e) => {
    const target = e.target.closest?.('.explore-target');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'page') {
      page = (page + 1) % Math.ceil(menu.buttons.length / 6);
      drawPanel();
    } else if (action === 'text-page') {
      textPage++;
      drawPanel();
    } else callbacks.action(action);
  });
  scene.addEventListener('enter-vr', () => {
    immersive = true;
    drawPanel();
    callbacks.immersive(true);
  });
  scene.addEventListener('exit-vr', () => {
    immersive = false;
    drawPanel();
    callbacks.immersive(false);
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
    if (e.code === 'Escape' || e.code === 'KeyM') {
      e.preventDefault();
      callbacks.action(menu ? 'close' : 'menu');
    }
    if (e.code === 'KeyE' && !menu && started) {
      const p = position(),
        id = Object.keys(ANCHORS).sort(
          (a, b) =>
            Math.hypot(p.x - ANCHORS[a].x, p.z - ANCHORS[a].z) -
            Math.hypot(p.x - ANCHORS[b].x, p.z - ANCHORS[b].z),
        )[0];
      callbacks.action(id.startsWith('prop') ? `inspect:${id.slice(4)}` : `open:${id}`);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  let lastRoute = 0;
  if (!A.components['exploration-tick'])
    A.registerComponent('exploration-tick', {
      tick(time, delta) {
        this.el.explorationTick?.(time, delta);
      },
    });
  scene.explorationTick = (time, delta) => {
    const input = readVRInput(scene.renderer?.xr?.getSession()?.inputSources),
      dt = Math.min(delta || 0, 50) / 1000;
    if (immersive && input.menu && !menuHeld) callbacks.action(menu ? 'close' : 'menu');
    menuHeld = input.menu;
    if (Math.abs(input.turn) < 0.3) turnReady = true;
    if (started && !paused && !state?.quiz && !settings.stationary) {
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
      if (side || forward)
        step(
          side,
          forward,
          (dt * (immersive ? 1.3 : 2.2)) / Math.max(1, Math.hypot(side, forward)),
        );
      const look = camera.components['look-controls']?.yawObject;
      if (!immersive && look)
        look.rotation.y +=
          (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.5;
    } else keys.clear();
    if (time - lastRoute > 700) {
      lastRoute = time;
      drawTrail();
    }
  };
  scene.setAttribute('exploration-tick', '');
  mount.append(scene);
  return {
    scene,
    camera,
    rig,
    render,
    moveTo,
    position,
    showLens,
    start() {
      started = true;
      paused = false;
    },
    guide(id) {
      route = id;
      drawTrail();
    },
    reset() {
      rig.object3D.position.set(0, 0, 5.7);
      rig.object3D.rotation.y = 0;
      route = null;
      const look = camera.components['look-controls'];
      if (look) {
        look.yawObject.rotation.y = 0;
        look.pitchObject.rotation.x = 0;
      }
    },
    panel(data) {
      if (menu?.title !== data?.title) page = 0;
      if (menu?.text !== data?.text) textPage = 0;
      menu = data;
      paused = Boolean(data);
      if (lens) {
        lens.remove();
        lens = null;
      }
      room
        .querySelectorAll('[data-action]')
        .forEach((n) => n.classList.toggle('explore-target', !state?.quiz && !menu));
      drawPanel();
    },
    get immersive() {
      return immersive;
    },
  };
}
