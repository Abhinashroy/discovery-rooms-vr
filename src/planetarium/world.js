import { PLANETS, BY_ID, LEARNING_FACTS, SOLAR_NOTES } from './content.js';
import { HALL, SUN, VIEWS, canStand, movePlayer, inspectionPlacement } from './layout.js';
import { createMaterials } from './materials.js';
import { createSchedule } from './ambience.js';
import { hiddenName, activeQuestion, availableNames, namingScore, quizScore } from './state.js';
import { readVRInput } from '../discovery/vr-input.js';
const el = (tag, attrs = {}) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
export function createPlanetarium(mount, callbacks) {
  const A = window.AFRAME,
    T = A.THREE,
    scene = el('a-scene', {
      embedded: '',
      'xr-mode-ui': 'enabled: false',
      'loading-screen': 'enabled: false',
      background: 'color: #080c21',
      renderer: 'antialias: true; colorManagement: true',
    });
  const environment = el('a-entity'),
    rig = el('a-entity', { id: 'planet-player', position: '0 0 17' }),
    camera = el('a-entity', {
      camera: 'fov: 75; far: 100',
      position: '0 1.65 0',
      'look-controls': 'pointerLockEnabled: false',
      cursor: 'rayOrigin: mouse; fuse: false',
      raycaster: 'objects: .planet-target; far: 45',
    });
  rig.append(camera);
  scene.append(environment, rig);
  const root = new T.Group();
  environment.setObject3D('exhibits', root);
  const mats = createMaterials(T, callbacks.assets),
    labels = new Map(),
    labelMaterials = new Map(),
    labelGeometry = new Map();
  const ownGeometry = [],
    ownMaterial = [];
  function mesh(g, m, p = [0, 0, 0]) {
    ownGeometry.push(g);
    ownMaterial.push(m);
    const o = new T.Mesh(g, m);
    o.position.set(...p);
    root.add(o);
    return o;
  }
  function box(p, size, color, emissive = 0) {
    return mesh(
      new T.BoxGeometry(...size),
      new T.MeshStandardMaterial({ color, roughness: 0.8, emissive, emissiveIntensity: 0.3 }),
      p,
    );
  }
  function glow(p, size, color) {
    return mesh(new T.BoxGeometry(...size), new T.MeshBasicMaterial({ color }), p);
  }
  function sign(text, width = 2, height = 0.3, color = '#cbdde9', bg = '#12233a') {
    const key = JSON.stringify([text, color, bg]);
    let tex = labels.get(key);
    if (!tex) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = bg;
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = color;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font =
        '600 ' + (text.length > 40 ? 18 : text.length > 25 ? 23 : 33) + 'px Segoe UI, sans-serif';
      if (text.length > 40) {
        const lines = [],
          words = text.split(' ');
        let line = '';
        for (const word of words) {
          const next = line ? line + ' ' + word : word;
          if (x.measureText(next).width > 480 && line) {
            lines.push(line);
            line = word;
          } else line = next;
        }
        if (line) lines.push(line);
        lines.forEach((line, i) =>
          x.fillText(line, 256, 64 + (i - (lines.length - 1) / 2) * 28, 490),
        );
      } else x.fillText(text, 256, 64, 490);
      tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = T.LinearFilter;
      labels.set(key, tex);
      const m = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide });
      ownMaterial.push(m);
      labelMaterials.set(key, m);
    }
    const shape = width + ':' + height;
    let g = labelGeometry.get(shape);
    if (!g) {
      g = new T.PlaneGeometry(width, height);
      ownGeometry.push(g);
      labelGeometry.set(shape, g);
    }
    return new T.Mesh(g, labelMaterials.get(key));
  }
  // A stable observatory shell with cosmic panels and visible architecture.
  const sky = mats.texture('stars'),
    skyMat = new T.MeshBasicMaterial({ map: sky, color: 0x91a6d0, side: T.DoubleSide });
  skyMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>\nvec2 nebulaUV = vMapUv;\nfloat hazeA=exp(-8.0*length((nebulaUV-vec2(0.3,0.6))*vec2(1.0,1.4)));\nfloat hazeB=exp(-9.0*length((nebulaUV-vec2(0.72,0.3))*vec2(1.0,1.5)));\ndiffuseColor.rgb += vec3(0.085,0.035,0.18)*hazeA + vec3(0.025,0.11,0.17)*hazeB;`,
    );
  };
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fx = floorCanvas.getContext('2d');
  fx.scale(0.5, 0.5);
  fx.fillStyle = '#080e23';
  fx.fillRect(0, 0, 1024, 1024);
  for (const [x, y, c] of [
    [250, 400, '#3d206f'],
    [750, 600, '#154565'],
    [650, 120, '#252858'],
  ]) {
    const gradient = fx.createRadialGradient(x, y, 0, x, y, 450);
    gradient.addColorStop(0, c);
    gradient.addColorStop(1, 'transparent');
    fx.fillStyle = gradient;
    fx.fillRect(0, 0, 1024, 1024);
  }
  const floorTex = new T.CanvasTexture(floorCanvas);
  floorTex.colorSpace = T.SRGBColorSpace;
  mesh(
    new T.BoxGeometry(48, 0.2, 40),
    new T.MeshStandardMaterial({ map: floorTex, color: 0x8393bc, roughness: 0.95 }),
    [0, -0.1, 0],
  );
  for (const [p, size] of [
    [
      [0, 13, -20],
      [48, 26, 0.15],
    ],
    [
      [0, 13, 20],
      [48, 26, 0.15],
    ],
    [
      [-24, 13, 0],
      [0.15, 26, 40],
    ],
    [
      [24, 13, 0],
      [0.15, 26, 40],
    ],
    [
      [0, 26, 0],
      [48, 0.15, 40],
    ],
  ])
    mesh(new T.BoxGeometry(...size), skyMat, p);
  const starVertices = [],
    starColors = [];
  let starSeed = 913;
  const random = () => {
    starSeed = (Math.imul(starSeed, 1664525) + 1013904223) >>> 0;
    return starSeed / 4294967296;
  };
  for (let i = 0; i < 900; i++) {
    const surface = i % 6,
      x = (random() - 0.5) * 47,
      z = (random() - 0.5) * 39,
      y = 3 + random() * 22;
    starVertices.push(
      ...(surface === 0
        ? [x, 0.015, z]
        : surface === 1
          ? [x, 25.7, z]
          : surface === 2
            ? [-23.8, y, z]
            : surface === 3
              ? [23.8, y, z]
              : surface === 4
                ? [x, y, -19.8]
                : [x, y, 19.8]),
    );
    const brightness = surface === 0 ? 0.22 : 0.6 + random() * 0.4;
    starColors.push(brightness * 0.65, brightness * 0.8, brightness);
  }
  const starsGeometry = new T.BufferGeometry();
  starsGeometry.setAttribute('position', new T.Float32BufferAttribute(starVertices, 3));
  starsGeometry.setAttribute('color', new T.Float32BufferAttribute(starColors, 3));
  const starsMaterial = new T.PointsMaterial({
    size: 0.065,
    vertexColors: true,
    sizeAttenuation: true,
  });
  ownGeometry.push(starsGeometry);
  ownMaterial.push(starsMaterial);
  root.add(new T.Points(starsGeometry, starsMaterial));
  // Instanced ribs keep architecture readable without hundreds of draw calls.
  const ribGeo = new T.BoxGeometry(0.15, 26, 0.2),
    ribMat = new T.MeshStandardMaterial({ color: 0x263657, roughness: 0.7 }),
    ribs = new T.InstancedMesh(ribGeo, ribMat, 14);
  ownGeometry.push(ribGeo);
  ownMaterial.push(ribMat);
  const matrix = new T.Matrix4();
  let ri = 0;
  for (const z of [-18, -12, -6, 0, 6, 12, 18])
    for (const x of [-23.9, 23.9]) {
      matrix.makeTranslation(x, 13, z);
      ribs.setMatrixAt(ri++, matrix);
    }
  root.add(ribs);
  for (const x of [-23.5, 23.5]) glow([x, 0.02, 0], [0.06, 0.02, 39], 0x395784);
  for (const z of [-19.5, 19.5]) glow([0, 0.02, z], [47, 0.02, 0.06], 0x395784);
  const sun = mats.body({ id: 'sun', tilt: 0 }, 10);
  sun.position.set(SUN.x, SUN.y, SUN.z);
  root.add(sun);
  const sunBoundary = mesh(
    new T.TorusGeometry(10.6, 0.035, 8, 128),
    new T.MeshBasicMaterial({ color: 0x9c7049 }),
    [0, 0.035, -8],
  );
  sunBoundary.rotation.x = Math.PI / 2;
  // Soft halo rather than an expensive screen-space bloom effect.
  const halo = mesh(
    new T.SphereGeometry(10.12, 64, 32),
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.BackSide,
      vertexShader:
        'varying vec3 n; varying vec3 p; void main(){n=normalize(normalMatrix*normal);vec4 v=modelViewMatrix*vec4(position,1.0);p=v.xyz;gl_Position=projectionMatrix*v;}',
      fragmentShader:
        'varying vec3 n;varying vec3 p;void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(-p))),3.0);gl_FragColor=vec4(1.0,0.55,0.15,a*0.22);}',
    }),
    [0, 12, -8],
  );
  const sunCaption = sign('THE SUN · OUR STAR', 5, 0.7, '#ffe8a3');
  sunCaption.position.set(0, 2.1, 2.8);
  root.add(sunCaption);
  const entranceSign = sign('INNER PLANETS ENLARGED 2.61x · SPACING ARRANGED', 10, 0.65);
  entranceSign.position.set(0, 4.5, 19.7);
  entranceSign.rotation.y = Math.PI;
  root.add(entranceSign);
  // Ordered teaching trail: not a pretend orbital-distance model.
  const trailPoints = PLANETS.map((p) => new T.Vector3(p.x, 0.035, p.z + 2.1)),
    trailCurve = new T.CatmullRomCurve3(trailPoints);
  mesh(
    new T.TubeGeometry(trailCurve, 100, 0.035, 4, false),
    new T.MeshBasicMaterial({ color: 0x458eaf }),
  );
  const stations = {};
  for (const p of PLANETS) {
    const radius = p.diameter / 2,
      bodyY = Math.max(1.45, radius + 1.05),
      body = mats.body(p, radius);
    body.position.set(p.x, bodyY, p.z);
    root.add(body);
    mesh(
      new T.CylinderGeometry(0.52, 0.65, 1.05, 32),
      new T.MeshStandardMaterial({ color: 0x1a2846, metalness: 0.35, roughness: 0.5 }),
      [p.x, 0.525, p.z],
    );
    const base = mesh(
      new T.TorusGeometry(0.57, 0.025, 8, 48),
      new T.MeshBasicMaterial({ color: 0x55bdd1 }),
      [p.x, 1.06, p.z],
    );
    base.rotation.x = Math.PI / 2;
    const labelGroup = new T.Group();
    labelGroup.position.set(p.x, 1.14, p.z + 1.35);
    root.add(labelGroup);
    const marker = el('a-box', {
      position: `${p.x} 1.55 ${p.z + 0.8}`,
      width: 0.9,
      height: 1.1,
      depth: 0.4,
      material: 'opacity: 0; transparent: true; depthWrite: false',
      class: 'planet-target',
      'data-action': 'planet:' + p.id,
      'data-planet': p.id,
    });
    environment.append(marker);
    const bodyTarget = el('a-sphere', {
      position: `${p.x} ${bodyY} ${p.z}`,
      radius: Math.max(0.45, radius),
      material: 'opacity: 0; transparent: true; depthWrite: false',
      class: 'planet-target',
      'data-action': 'planet:' + p.id,
    });
    environment.append(bodyTarget);
    const labelTarget = el('a-box', {
      position: `${p.x} 1.14 ${p.z + 1.35}`,
      width: 2,
      height: 0.4,
      depth: 0.1,
      material: 'opacity: 0; transparent: true; depthWrite: false',
      class: 'planet-target',
      'data-action': 'planet:' + p.id,
    });
    environment.append(labelTarget);
    const focusRing = mesh(
      new T.TorusGeometry(0.65, 0.025, 8, 48),
      new T.MeshBasicMaterial({ color: 0xffda86 }),
      [p.x, 1.07, p.z],
    );
    focusRing.rotation.x = Math.PI / 2;
    focusRing.visible = false;
    stations[p.id] = { body, labelGroup, marker, bodyTarget, labelTarget, focusRing };
  }
  const inspectionContainer = el('a-entity', { id: 'planet-inspection', visible: false });
  environment.append(inspectionContainer);
  const inspectionRoot = new T.Group();
  inspectionContainer.setObject3D('planet', inspectionRoot);
  scene.append(
    el('a-light', { type: 'ambient', color: '#cddcf8', intensity: 1.6 }),
    el('a-light', { type: 'directional', position: '-8 12 18', color: '#fff9ee', intensity: 2.4 }),
    el('a-light', { type: 'directional', position: '15 8 -10', color: '#a8c8ff', intensity: 0.7 }),
  );
  let state,
    settings = {},
    paused = false,
    immersive = false,
    lastMenu = false,
    turnReady = true,
    lastInspection = null,
    inspectionBody = null,
    dragStart,
    drag = 0,
    disposed = false,
    fly = null,
    panelMode = 'menu';
  const keys = new Set(),
    schedule = createSchedule(Date.now()),
    flyRoot = new T.Group();
  root.add(flyRoot);
  const panel = el('a-entity', { visible: false, position: '0 0 -1.8' });
  camera.append(panel);
  function button(text, action, x, y, w = 0.98, h = 0.2) {
    const b = el('a-plane', {
      position: `${x} ${y} .01`,
      width: w,
      height: h,
      material: 'shader: flat; color: #182e49',
      ...(action ? { class: 'planet-target', 'data-action': action } : {}),
    });
    b.setObject3D('label', sign(text, w, h - 0.01, '#e8f1ff'));
    panel.append(b);
  }
  function drawPanel() {
    panel.replaceChildren();
    panel.setAttribute('visible', immersive && paused);
    if (!immersive || !paused || !state) return;
    const q = activeQuestion(state),
      activity = ['activity', 'learning'].includes(panelMode);
    let title =
        panelMode === 'cards'
          ? 'NAME EXHIBIT ' + BY_ID[state.focus]?.order
          : panelMode === 'views'
            ? 'EXHIBIT VIEWPOINTS'
            : 'PLANETARIUM CONTROLS',
      options = [];
    if (panelMode === 'learning') {
      title = state.focus ? BY_ID[state.focus].name + ' · LEARNING NOTES' : 'SOLAR SYSTEM NOTES';
      options = [...(state.focus ? LEARNING_FACTS[state.focus] : []), ...SOLAR_NOTES].map(
        (text) => [text, null],
      );
      options.push(['Back to menu', 'menu-home'], ['Continue in room', 'close']);
    } else if (activity) {
      if (state.phase === 'naming-review') {
        title = namingScore(state) + ' / 8 NAMES CORRECT';
        options = state.namingReview.map((r) => [
          '#' +
            BY_ID[r.id].order +
            ' ' +
            BY_ID[r.assigned].name +
            (r.correct ? ' — correct' : ' — wrong; ' + BY_ID[r.id].name),
          null,
        ]);
        options.push(['Start quiz — 5 questions', 'quiz-start']);
      }
      if (state.phase === 'quiz') {
        const answered = state.answers.length > state.question;
        title = state.question + 1 + '/5 · ' + q.prompt;
        options = q.choices.map((c, i) => [
          (state.choice === c ? 'Selected: ' : '') + c,
          answered ? null : 'answer:' + i + ':' + q.id,
        ]);
        options.push(
          answered
            ? [state.question === 4 ? 'Show final score' : 'Next question', 'next-question:' + q.id]
            : [
                state.choice ? 'Confirm answer' : 'Choose an answer first',
                state.choice ? 'confirm-answer:' + q.id : null,
              ],
        );
      }
      if (state.phase === 'result') {
        title = 'QUIZ SCORE ' + quizScore(state) + ' / 5 · NAMES ' + namingScore(state) + '/8';
        options = state.queue.map((q, i) => [
          i +
            1 +
            '. ' +
            (state.answers[i].correct ? 'Correct' : 'Wrong') +
            ' · Answer: ' +
            q.answer,
          null,
        ]);
        options.push(['Explore and try again', 'restart']);
      }
      options.push(['Menu / change room', 'menu']);
    } else if (panelMode === 'cards') {
      options = (state.phase === 'naming' && state.focus ? availableNames(state) : []).map((id) => [
        (state.assignments[state.focus] === id ? 'Selected: ' : '') + BY_ID[id].name,
        'card:' + id,
      ]);
      if (state.assignments[state.focus]) options.push(['Remove this name', 'unassign']);
    } else if (panelMode === 'views')
      options = PLANETS.map((p) => [
        hiddenName(state) ? 'Exhibit ' + p.order : p.name,
        'view:' + p.id,
      ]);
    else if (panelMode === 'comfort')
      options = [
        ['Entrance view', 'view:entrance'],
        [settings.stationary ? 'Enable walking' : 'Stationary mode', 'stationary'],
        [settings.reduced ? 'Motion on' : 'Reduced motion', 'reduced'],
        [settings.large ? 'Normal text' : 'Larger text', 'large'],
        [settings.muted ? 'Sound off' : 'Sound on', 'muted'],
      ];
    else {
      const primary = {
        explore: ['Start naming', 'ready'],
        naming:
          Object.keys(state.assignments).length === 8
            ? ['Submit all eight names', 'submit-names']
            : state.focus
              ? ['Edit selected name', 'cards']
              : null,
        'naming-review': ['Naming results / quiz', 'activity'],
        quiz: ['Return to quiz', 'activity'],
        result: ['Final score', 'activity'],
      }[state.phase];
      options = [
        primary,
        state.phase === 'explore' ? ['Learning notes', 'learning'] : null,
        ['Exhibit viewpoints', 'views'],
        state.phase === 'explore'
          ? [
              state.inspection ? 'Close inspection' : 'Inspect selected',
              state.inspection ? 'close-inspect' : 'inspect',
            ]
          : null,
        ['Next exhibit', 'next-view'],
        ['Comfort settings', 'comfort'],
        ['Continue in room', 'close'],
        ['Main room', 'room:main'],
        ['Exit VR', 'exit-vr'],
      ].filter(Boolean);
    }
    if (!activity && panelMode !== 'menu')
      options.push(['Back to menu', 'menu-home'], ['Continue in room', 'close']);
    const heading = el('a-entity', { position: '0 1.0 0' });
    heading.setObject3D('title', sign(title, activity ? 2.7 : 2.05, activity ? 0.35 : 0.23));
    panel.append(heading);
    if (activity) {
      const compact = state.phase === 'naming-review';
      options.forEach(([text, action], i) =>
        button(
          text,
          action,
          0,
          (compact ? 0.7 : 0.55) - i * (compact ? 0.18 : 0.26),
          2.7,
          compact ? 0.16 : 0.23,
        ),
      );
    } else
      options.forEach(([text, action], i) =>
        button(text, action, i % 2 ? 0.54 : -0.54, 0.6 - Math.floor(i / 2) * 0.25),
      );
    if (!activity) {
      const status = el('a-entity', { position: '0 -.92 0' });
      status.setObject3D(
        'status',
        sign(
          state.phase === 'naming'
            ? Object.keys(state.assignments).length + '/8 named · Select planet, then name'
            : state.feedback,
          2.1,
          0.25,
        ),
      );
      panel.append(status);
    }
  }
  function pruneLabels() {
    const used = new Set();
    const collect = (o) => {
      if (o.material?.map) used.add(o.material.map);
    };
    root.traverse(collect);
    rig.object3D.traverse(collect);
    for (const [key, texture] of labels)
      if (!used.has(texture)) {
        const material = labelMaterials.get(key);
        material.map = null;
        material.dispose();
        const i = ownMaterial.indexOf(material);
        if (i >= 0) ownMaterial.splice(i, 1);
        texture.dispose();
        labels.delete(key);
        labelMaterials.delete(key);
      }
  }
  function position() {
    const v = camera.object3D.getWorldPosition(new T.Vector3());
    return { x: v.x, z: v.z };
  }
  function moveTo(id) {
    const p = VIEWS[id];
    if (!p || !canStand(p.x, p.z)) return;
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
  function turnInspection(direction) {
    if (inspectionBody) inspectionBody.rotation.y += (direction * Math.PI) / 6;
  }
  function render(s, options) {
    state = s;
    settings = options;
    for (const p of PLANETS) {
      const station = stations[p.id];
      station.body.visible = s.inspection !== p.id;
      const pose =
        s.inspection === p.id
          ? inspectionPlacement(p.id)
          : { y: Math.max(1.45, p.diameter / 2 + 1.05), radius: p.diameter / 2 };
      station.bodyTarget.setAttribute('position', `${p.x} ${pose.y} ${p.z}`);
      station.bodyTarget.setAttribute('radius', Math.max(0.45, pose.radius));
      const hidden = hiddenName(s),
        assigned = s.assignments[p.id],
        review = s.namingReview.find((r) => r.id === p.id);
      const name = hidden ? 'Exhibit ' + p.order : p.name;
      for (const target of [station.marker, station.bodyTarget, station.labelTarget]) {
        target.setAttribute('aria-label', name);
        target.classList.toggle(
          'planet-target',
          !paused && ['explore', 'naming'].includes(s.phase),
        );
      }
      station.labelGroup.clear();
      const text = hidden
        ? name + (s.phase === 'naming' && assigned ? ' · ' + BY_ID[assigned].name : '')
        : p.order +
          ' · ' +
          p.name +
          (s.inspection === p.id && p.order <= 4 ? ' · ENLARGED CLOSE-UP' : '') +
          (review ? (review.correct ? ' ✓' : ' ✕') : '');
      station.labelGroup.add(
        sign(
          text,
          2,
          0.29,
          review && !hidden ? (review.correct ? '#a5eee7' : '#ffc27b') : '#d0e2f1',
        ),
      );
      station.focusRing.visible = s.focus === p.id;
    }
    if (s.inspection !== lastInspection) {
      if (inspectionBody) {
        inspectionRoot.remove(inspectionBody);
        mats.forget(inspectionBody);
      }
      const pose = inspectionPlacement(s.inspection);
      inspectionBody = pose
        ? mats.body(BY_ID[s.inspection], pose.radius, { inspection: true })
        : null;
      if (inspectionBody) {
        inspectionRoot.add(inspectionBody);
        inspectionContainer.setAttribute('position', `${pose.x} ${pose.y} ${pose.z}`);
      }
      inspectionContainer.setAttribute('visible', Boolean(inspectionBody));
      inspectionContainer.dataset.planet = s.inspection || '';
      lastInspection = s.inspection;
    }
    if (wrist) {
      wrist.clear();
      const cue =
        s.phase === 'quiz'
          ? 'Quiz ' + (s.question + 1) + '/5 · B/Y for controls'
          : s.phase === 'naming'
            ? Object.keys(s.assignments).length + '/8 named · Select planet, then name'
            : ['naming-review', 'result'].includes(s.phase)
              ? 'Review results · B/Y for controls'
              : s.focus
                ? BY_ID[s.focus].name + ' · B/Y for learning notes'
                : 'B/Y: explore or start naming';
      wrist.add(sign(cue, 0.48, 0.12));
    }
    drawPanel();
    pruneLabels();
  }
  function pause(value, mode = 'menu') {
    paused = value;
    panelMode = mode;
    keys.clear();
    callbacks.walk?.(0);
    camera.setAttribute('look-controls', 'enabled', !paused);
    if (state) render(state, settings);
  }
  function buildFly(kind) {
    flyRoot.clear();
    const group = new T.Group();
    const m = new T.MeshBasicMaterial({ color: kind === 'comet' ? 0xbae4ff : 0xb3bbd5 });
    const head = new T.Mesh(new T.SphereGeometry(kind === 'comet' ? 0.11 : 0.2, 12, 8), m);
    if (kind === 'ufo') head.scale.set(1, 0.25, 1);
    group.add(head);
    if (kind === 'comet') {
      const tail = new T.Mesh(
        new T.ConeGeometry(0.13, 2, 8),
        new T.MeshBasicMaterial({
          color: 0x8cb7ee,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        }),
      );
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.95;
      group.add(tail);
    } else {
      const dome = new T.Mesh(
        new T.SphereGeometry(0.09, 12, 8),
        new T.MeshBasicMaterial({ color: 0x70d0cb }),
      );
      dome.position.y = 0.08;
      group.add(dome);
    }
    flyRoot.add(group);
  }
  function clearFly() {
    flyRoot.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    flyRoot.clear();
  }
  if (!A.components['planetarium-tick'])
    A.registerComponent('planetarium-tick', {
      tick(time, delta) {
        this.el.planetTick?.(delta);
      },
    });
  scene.planetTick = (delta) => {
    if (disposed) return;
    const dt = Math.min(delta || 0, 50) / 1000,
      input = readVRInput(scene.renderer?.xr?.getSession()?.inputSources);
    if (immersive && input.menu && !lastMenu) callbacks.action(paused ? 'close' : 'menu');
    lastMenu = input.menu;
    if (Math.abs(input.turn) < 0.3) turnReady = true;
    mats.tick(dt, settings.reduced || paused || document.hidden);
    const next = schedule.tick(
      dt,
      !paused &&
        !document.hidden &&
        !settings.reduced &&
        ['explore', 'naming'].includes(state?.phase),
    );
    if (next !== fly) {
      clearFly();
      if (next) buildFly(next.kind);
      fly = next;
    }
    environment.dataset.flyby = next?.kind || 'none';
    if (next) {
      const t = next.elapsed / next.duration;
      flyRoot.position.set(...next.from.map((v, i) => v + (next.to[i] - v) * t));
      flyRoot.quaternion.setFromUnitVectors(
        new T.Vector3(1, 0, 0),
        new T.Vector3(...next.to).sub(new T.Vector3(...next.from)).normalize(),
      );
    }
    if (paused || document.hidden || !state) {
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
    let travelled = 0;
    if (!settings.stationary && (side || forward)) {
      const direction = new T.Vector3(0, 0, -1).applyQuaternion(
        camera.object3D.getWorldQuaternion(new T.Quaternion()),
      );
      direction.y = 0;
      direction.normalize();
      const p = position(),
        amount = (dt * 2) / Math.max(1, Math.hypot(side, forward)),
        next = movePlayer(
          p,
          (direction.x * forward - direction.z * side) * amount,
          (direction.z * forward + direction.x * side) * amount,
        );
      travelled = Math.hypot(next.x - p.x, next.z - p.z);
      rig.object3D.position.x += next.x - p.x;
      rig.object3D.position.z += next.z - p.z;
      rig.setAttribute('position', rig.object3D.position);
    }
    callbacks.walk?.(travelled);
    const look = camera.components['look-controls'];
    if (!immersive && look)
      look.yawObject.rotation.y +=
        (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.4;
    const info = scene.renderer?.info;
    if (info)
      callbacks.metrics?.({
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        textures:
          mats.estimatedTextureBytes() + labels.size * 512 * 128 * 4 + (512 * 512 * 4 * 4) / 3,
      });
  };
  scene.setAttribute('planetarium-tick', '');
  const listeners = [],
    listen = (target, type, fn) => {
      target.addEventListener(type, fn);
      listeners.push(() => target.removeEventListener(type, fn));
    };
  listen(window, 'keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        e.code,
      )
    ) {
      if (!paused) e.preventDefault();
      keys.add(e.code);
    }
    if (!e.repeat && (e.code === 'KeyM' || e.code === 'Escape')) {
      e.preventDefault();
      callbacks.action(paused ? 'close' : 'menu');
    }
    if (e.code === 'KeyE' && !paused && !e.repeat) {
      const ray = new T.Raycaster();
      ray.setFromCamera(new T.Vector2(), camera.components.camera.camera);
      const hit = ray.intersectObjects(
        Object.values(stations).flatMap((s) => [
          s.marker.object3D,
          s.bodyTarget.object3D,
          s.labelTarget.object3D,
        ]),
        true,
      )[0];
      if (hit) {
        let o = hit.object;
        while (o && !o.el?.dataset.action) o = o.parent;
        if (o?.el?.dataset.action) callbacks.action(o.el.dataset.action);
      }
    }
  });
  listen(window, 'keyup', (e) => {
    keys.delete(e.code);
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].some((k) => keys.has(k)))
      callbacks.walk?.(0);
  });
  listen(window, 'blur', () => keys.clear());
  listen(document, 'visibilitychange', () => {
    if (document.hidden) keys.clear();
  });
  listen(window, 'pointerdown', (e) => {
    drag = 0;
    dragStart = [e.clientX, e.clientY];
  });
  listen(window, 'pointermove', (e) => {
    if (e.buttons && dragStart)
      drag = Math.max(drag, Math.hypot(e.clientX - dragStart[0], e.clientY - dragStart[1]));
  });
  listen(scene, 'click', (e) => {
    if (!immersive && drag > 6) return;
    const target = e.target.closest?.('.planet-target');
    if (target?.dataset.action) callbacks.action(target.dataset.action);
  });
  let wrist;
  for (const hand of ['left', 'right']) {
    const controller = el('a-entity', {
      'laser-controls': `hand: ${hand}; model: false`,
      raycaster: 'objects: .planet-target; far: 45; lineColor: #65d5dc',
    });
    const menu = el('a-plane', {
      position: '0 .08 -.2',
      width: 0.2,
      height: 0.06,
      class: 'planet-target',
      'data-action': 'menu',
    });
    menu.setObject3D('label', sign('MENU', 0.2, 0.06));
    controller.append(menu);
    if (hand === 'left') {
      const cue = el('a-entity', { position: '0 .18 -.3', rotation: '-35 0 0' });
      wrist = new T.Group();
      cue.setObject3D('cue', wrist);
      controller.append(cue);
    }
    rig.append(controller);
  }
  listen(scene, 'enter-vr', () => {
    immersive = true;
    callbacks.immersive(true);
    drawPanel();
  });
  listen(scene, 'exit-vr', () => {
    immersive = false;
    callbacks.immersive(false);
    drawPanel();
  });
  mount.append(scene);
  return {
    scene,
    render,
    pause,
    moveTo,
    position,
    turnInspection,
    get immersive() {
      return immersive;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      keys.clear();
      schedule.reset();
      listeners.forEach((fn) => fn());
      clearFly();
      mats.dispose();
      ownGeometry.forEach((g) => g.dispose());
      ownMaterial.forEach((m) => m.dispose());
      labels.forEach((t) => t.dispose());
      floorTex.dispose();
    },
  };
}
