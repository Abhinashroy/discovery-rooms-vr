import { createCometSchedule } from './ambience.js';
import { modelAt, geoVector, vectorGeo, dot, scale as scaleVector } from './astronomy.js';
import {
  surfaceFrame,
  moveSurface,
  GLOBE_RADIUS,
  GLOBE_EYE_LIFT,
  countryAt,
  unwrapRing,
  distanceDegrees,
} from './geography.js';
import { COUNTRIES, COUNTRY_BY_ID } from './countries.js';
import { activeQuestion, quizScore } from './state.js';
import { readVRInput } from '../discovery/vr-input.js';
const el = (tag, attrs = {}) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
export function createEarthWorld(mount, callbacks) {
  const A = window.AFRAME,
    T = A.THREE,
    scene = el('a-scene', {
      embedded: '',
      'xr-mode-ui': 'enabled: false',
      'loading-screen': 'enabled: false',
      background: 'color: #030b1d',
      renderer: 'antialias: true; colorManagement: true',
    }),
    environment = el('a-entity'),
    rig = el('a-entity', { id: 'earth-player' }),
    camera = el('a-entity', {
      camera: 'fov: 68; far: 800',
      position: '0 1.65 0',
      'look-controls': 'pointerLockEnabled: false',
    });
  rig.append(camera);
  scene.append(environment, rig);
  mount.append(scene);
  const root = new T.Group();
  environment.setObject3D('world', root);
  const owned = [],
    textures = [],
    loader = new T.TextureLoader();
  let disposed = false,
    state,
    settings = {},
    paused = false,
    panelMode = 'menu',
    immersive = false,
    features = [],
    lastView = '',
    lastHighlight = '',
    hoverTick = 0,
    panelTick = 0,
    wasMenu = false,
    snapReady = true,
    stepCooldown = 0,
    observerView = 'system',
    yaw = 0,
    pitch = 0.43,
    zoom = 82,
    countryPage = 0,
    drag,
    dragDistance = 0;
  const keys = new Set();
  let textureCount = 0,
    mapReady = false;
  const vec = (a) => new T.Vector3(...a),
    report = () => callbacks.assets?.({ ready: mapReady && textureCount === 4, error: false });
  function texture(url) {
    const t = loader.load(
      url,
      () => {
        textureCount++;
        report();
      },
      undefined,
      () => callbacks.assets?.({ ready: false, error: true }),
    );
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    textures.push(t);
    return t;
  }
  const dayMap = texture('./planetarium/2k_earth_daymap.jpg'),
    cloudMap = texture('./planetarium/low_2k_earth_clouds.jpg'),
    sunMap = texture('./planetarium/2k_sun.jpg'),
    moonMap = texture('./earth-explorer/moon.jpg');
  function mesh(g, m, parent = root) {
    owned.push(g, m);
    const o = new T.Mesh(g, m);
    parent.add(o);
    return o;
  }
  // One point-cloud draw call; stars and a single occasional distant comet in both views.
  const sky = new T.Group();
  root.add(sky);
  const starPositions = [],
    starColours = [];
  let skySeed = 93877;
  const skyRandom = () => {
    skySeed = (1664525 * skySeed + 1013904223) >>> 0;
    return skySeed / 4294967296;
  };
  for (let i = 0; i < 2400; i++) {
    const y = skyRandom() * 2 - 1,
      a = skyRandom() * Math.PI * 2,
      r = Math.sqrt(1 - y * y);
    starPositions.push(Math.cos(a) * r * 430, y * 430, Math.sin(a) * r * 430);
    const warm = skyRandom();
    starColours.push(warm > 0.75 ? 1 : 0.68, warm > 0.75 ? 0.83 : 0.85, 1);
  }
  const starGeometry = new T.BufferGeometry();
  starGeometry.setAttribute('position', new T.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new T.Float32BufferAttribute(starColours, 3));
  const starMaterial = new T.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    depthWrite: false,
  });
  owned.push(starGeometry, starMaterial);
  sky.add(new T.Points(starGeometry, starMaterial));
  const comet = new T.Group(),
    cometHead = mesh(
      new T.SphereGeometry(0.85, 10, 6),
      new T.MeshBasicMaterial({ color: 0xdfffff }),
      comet,
    ),
    tailGeometry = new T.BufferGeometry().setFromPoints([
      new T.Vector3(),
      new T.Vector3(-23, -2, 0),
    ]),
    tailMaterial = new T.LineBasicMaterial({ color: 0x90dcff, transparent: true, opacity: 0.75 });
  owned.push(tailGeometry, tailMaterial);
  comet.add(new T.Line(tailGeometry, tailMaterial));
  comet.visible = false;
  sky.add(comet);
  const cometSchedule = createCometSchedule(718234);
  let lastComet = null,
    cometYaw = 0;
  function updateSky(dt) {
    sky.position.copy(camera.object3D.getWorldPosition(new T.Vector3()));
    const active = cometSchedule.tick(
      dt,
      !paused && state.phase === 'explore' && !settings.reduced && !document.hidden,
    );
    comet.visible = !!active;
    if (active) {
      if (lastComet !== active) {
        lastComet = active;
        const direction = new T.Vector3(0, 0, -1).applyQuaternion(
          camera.object3D.getWorldQuaternion(new T.Quaternion()),
        );
        cometYaw = Math.atan2(-direction.x, -direction.z);
      }
      const u = active.elapsed / active.duration,
        position = new T.Vector3(
          active.from + (active.to - active.from) * u,
          (state.mode === 'globe' ? -170 : -40) + active.height,
          -300,
        ).applyAxisAngle(new T.Vector3(0, 1, 0), cometYaw);
      comet.position.copy(position);
      comet.rotation.set(0, cometYaw, active.to > active.from ? 0 : Math.PI);
      mount.dataset.comet = 'visible';
    } else mount.dataset.comet = 'waiting';
  }
  const sun = mesh(
    new T.SphereGeometry(5.5, 48, 24),
    new T.MeshBasicMaterial({ map: sunMap, color: 0xffefd0 }),
  );
  const earthEntity = el('a-entity', { id: 'earth-model', class: 'earth-target' });
  environment.append(earthEntity);
  const earth = new T.Group();
  earthEntity.setObject3D('planet', earth);
  const earthMaterial = new T.MeshStandardMaterial({
      map: dayMap,
      roughness: 1,
      emissiveMap: dayMap,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
    }),
    globe = mesh(new T.SphereGeometry(1, 96, 48), earthMaterial, earth);
  const clouds = mesh(
    new T.SphereGeometry(1.008, 64, 32),
    new T.MeshStandardMaterial({
      alphaMap: cloudMap,
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      roughness: 1,
    }),
    earth,
  );
  const atmosphere = mesh(
    new T.SphereGeometry(1.025, 64, 32),
    new T.MeshBasicMaterial({
      color: 0x448ecc,
      transparent: true,
      opacity: 0.07,
      side: T.BackSide,
      depthWrite: false,
    }),
    earth,
  );
  const moon = mesh(
    new T.SphereGeometry(0.72, 48, 24),
    new T.MeshStandardMaterial({ map: moonMap, roughness: 1 }),
  );
  const sunlight = new T.PointLight(0xfff5df, 2.8, 0, 0),
    ambient = new T.AmbientLight(0xb9d4ff, 0.12);
  root.add(sunlight, ambient);
  const orbitPoints = [];
  for (let i = 0; i <= 240; i++) {
    const p = modelAt(Date.UTC(2000, 0, 1, 12) + (i / 240) * 365.25636 * 86400000).earth;
    orbitPoints.push(vec(p));
  }
  const orbitGeometry = new T.BufferGeometry().setFromPoints(orbitPoints),
    orbitMaterial = new T.LineBasicMaterial({ color: 0x355578 });
  owned.push(orbitGeometry, orbitMaterial);
  const orbitPath = new T.Line(orbitGeometry, orbitMaterial);
  root.add(orbitPath);
  const lunarPoints = [];
  for (let i = 0; i <= 120; i++) {
    const angle = (i / 120) * Math.PI * 2;
    lunarPoints.push(
      new T.Vector3(
        6 * Math.cos(angle),
        6 * Math.sin(angle) * Math.sin((5.145 * Math.PI) / 180),
        6 * Math.sin(angle) * Math.cos((5.145 * Math.PI) / 180),
      ),
    );
  }
  const lunarGeometry = new T.BufferGeometry().setFromPoints(lunarPoints);
  owned.push(lunarGeometry);
  const lunarPath = new T.Line(lunarGeometry, orbitMaterial);
  root.add(lunarPath);
  const axis = mesh(
    new T.CylinderGeometry(0.008, 0.008, 2.8, 8),
    new T.MeshBasicMaterial({ color: 0xffdc87 }),
    earth,
  );
  axis.visible = false;
  const mapRoot = new T.Group();
  earth.add(mapRoot);
  let borderLines, highlight, locator;
  const labels = new Map(),
    textCache = new Map(),
    textMaterials = new Map(),
    labelGeo = [];
  function textMesh(text, width = 2, height = 0.3, color = '#d4edf3', bg = '#10283b') {
    const key = JSON.stringify([text, color, bg]);
    let mat = textMaterials.get(key);
    if (!mat) {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = bg;
      x.fillRect(0, 0, 1024, 256);
      x.fillStyle = color;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = '600 38px Segoe UI';
      const lines = [];
      let line = '';
      for (const word of text.split(' ')) {
        const next = line ? line + ' ' + word : word;
        if (x.measureText(next).width > 970 && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      lines.forEach((line, i) =>
        x.fillText(line, 512, 128 + (i - (lines.length - 1) / 2) * 48, 980),
      );
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.generateMipmaps = false;
      t.minFilter = T.LinearFilter;
      mat = new T.MeshBasicMaterial({ map: t, side: T.DoubleSide, depthTest: false });
      textCache.set(key, t);
      textMaterials.set(key, mat);
    }
    const g = new T.PlaneGeometry(width, height);
    labelGeo.push(g);
    return new T.Mesh(g, mat);
  }
  function sprite(text) {
    const c = document.createElement('canvas');
    c.width = Math.max(160, Math.min(640, text.length * 38 + 48));
    c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = '#092337dd';
    x.fillRect(0, 0, c.width, 96);
    x.fillStyle = '#dbfff2';
    x.font = '600 58px Segoe UI';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, c.width / 2, 48, c.width - 24);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    textures.push(t);
    const m = new T.SpriteMaterial({ map: t, depthTest: true, transparent: true });
    owned.push(m);
    const o = new T.Sprite(m);
    o.userData.aspect = c.width / 96;
    o.scale.set(o.userData.aspect * 2.1, 2.1, 1);
    return o;
  }
  const bodyLabels = { sun: sprite('SUN'), earth: sprite('EARTH'), moon: sprite('MOON') };
  Object.values(bodyLabels).forEach((o) => root.add(o));
  for (const c of COUNTRIES) {
    const o = sprite(c.name);
    o.scale.set(o.userData.aspect * 0.026, 0.026, 1);
    o.position.copy(vec(geoVector(c.lat, c.lon)).multiplyScalar(1.017));
    earth.add(o);
    labels.set(c.id, o);
  }
  function buildBorders() {
    const points = [];
    for (const f of features) {
      const polygons =
        f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const rings of polygons)
        for (const ring of rings) {
          const unwrapped = unwrapRing(ring);
          for (let i = 1; i < unwrapped.length; i++) {
            const a = unwrapped[i - 1],
              b = unwrapped[i],
              steps = Math.max(
                1,
                Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 3),
              );
            for (let j = 0; j < steps; j++) {
              for (const u of [j / steps, (j + 1) / steps])
                points.push(
                  ...geoVector(a[1] + (b[1] - a[1]) * u, a[0] + (b[0] - a[0]) * u).map(
                    (v) => v * 1.003,
                  ),
                );
            }
          }
        }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    const m = new T.LineBasicMaterial({ color: 0x9bdec8, transparent: true, opacity: 0.55 });
    owned.push(g, m);
    borderLines = new T.LineSegments(g, m);
    mapRoot.add(borderLines);
  }
  function buildHighlight(id) {
    if (locator) {
      mapRoot.remove(locator);
      locator.geometry.dispose();
      locator.material.dispose();
      locator = null;
    }
    if (highlight) {
      mapRoot.remove(highlight);
      highlight.geometry.dispose();
      highlight.material.dispose();
      highlight = null;
    }
    const feature = features.find((f) => f.properties.id === id);
    if (!feature) return;
    const points = [],
      polygons =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
    function triangle(a, b, c, depth = 0) {
      if (
        depth < 5 &&
        Math.max(
          Math.hypot(a[0] - b[0], a[1] - b[1]),
          Math.hypot(a[0] - c[0], a[1] - c[1]),
          Math.hypot(b[0] - c[0], b[1] - c[1]),
        ) > 5
      ) {
        const ab = a.map((v, i) => (v + b[i]) / 2),
          ac = a.map((v, i) => (v + c[i]) / 2),
          bc = b.map((v, i) => (v + c[i]) / 2);
        triangle(a, ab, ac, depth + 1);
        triangle(ab, b, bc, depth + 1);
        triangle(ac, bc, c, depth + 1);
        triangle(ab, bc, ac, depth + 1);
      } else for (const p of [a, b, c]) points.push(...geoVector(p[1], p[0]).map((v) => v * 1.005));
    }
    for (const rings of polygons) {
      const reference = rings[0][0][0],
        contour = unwrapRing(rings[0], reference)
          .slice(0, -1)
          .map((p) => new T.Vector2(...p)),
        holes = rings.slice(1).map((r) =>
          unwrapRing(r, reference)
            .slice(0, -1)
            .map((p) => new T.Vector2(...p)),
        ),
        all = [...contour, ...holes.flat()];
      for (const indices of T.ShapeUtils.triangulateShape(contour, holes)) {
        const p = indices.map((i) => [all[i].x, all[i].y]);
        triangle(...p);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    g.computeVertexNormals();
    const m = new T.MeshBasicMaterial({
      color: 0xffd875,
      transparent: true,
      opacity: 0.6,
      side: T.DoubleSide,
      depthWrite: false,
    });
    highlight = new T.Mesh(g, m);
    mapRoot.add(highlight);
    const c = COUNTRY_BY_ID[id],
      rings =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
    const small = rings.every((poly) => {
      const r = unwrapRing(poly[0]),
        xs = r.map((p) => p[0]),
        ys = r.map((p) => p[1]);
      return Math.max(...xs) - Math.min(...xs) < 2 && Math.max(...ys) - Math.min(...ys) < 2;
    });
    if (c && small) {
      locator = new T.Mesh(
        new T.RingGeometry(0.016, 0.02, 40),
        new T.MeshBasicMaterial({ color: 0xffdc78, side: T.DoubleSide, depthWrite: false }),
      );
      const normal = vec(geoVector(c.lat, c.lon));
      locator.position.copy(normal).multiplyScalar(1.015);
      locator.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
      mapRoot.add(locator);
    }
  }
  fetch('./earth-explorer/countries.geojson')
    .then((r) => {
      if (!r.ok) throw Error('map');
      return r.json();
    })
    .then((data) => {
      if (disposed) return;
      features = data.features;
      mapReady = true;
      buildBorders();
      lastHighlight = '';
      report();
      if (state) render(state, settings);
    })
    .catch(() => callbacks.assets?.({ ready: false, error: true }));
  function navQuaternion(location, front = false) {
    const f = surfaceFrame(location),
      matrix = front
        ? new T.Matrix4().makeBasis(vec(f.east), vec(f.north), vec(f.normal))
        : new T.Matrix4().makeBasis(vec(f.east), vec(f.normal), vec(f.north).negate());
    return new T.Quaternion().setFromRotationMatrix(matrix).invert();
  }
  function aimRig(target, position) {
    rig.object3D.position.copy(position);
    rig.setAttribute('position', rig.object3D.position);
    const eye = position.clone().add(new T.Vector3(0, 1.65, 0)),
      matrix = new T.Matrix4().lookAt(eye, target, new T.Vector3(0, 1, 0)),
      q = new T.Quaternion().setFromRotationMatrix(matrix);
    if (immersive) {
      const e = new T.Euler().setFromQuaternion(q, 'YXZ');
      rig.object3D.rotation.set(0, e.y, 0);
    } else rig.object3D.quaternion.copy(q);
  }
  function resetLook() {
    const look = camera.components['look-controls'];
    if (look?.yawObject && look?.pitchObject) {
      look.yawObject.rotation.y = 0;
      look.pitchObject.rotation.x = 0;
    }
    camera.object3D.rotation.set(0, 0, 0);
  }
  function orbitCamera() {
    const m = modelAt(state.timestamp),
      target =
        observerView === 'earth'
          ? vec(m.earth).add(new T.Vector3(0, -5, 0))
          : new T.Vector3(6, -22, 0),
      radius = observerView === 'earth' ? Math.min(30, zoom / 3) : zoom;
    aimRig(
      target,
      target
        .clone()
        .add(
          new T.Vector3(
            Math.sin(yaw) * Math.cos(pitch) * radius,
            Math.sin(pitch) * radius,
            Math.cos(yaw) * Math.cos(pitch) * radius,
          ),
        ),
    );
  }
  function applyView() {
    if (!state) return;
    keys.clear();
    resetLook();
    camera.setAttribute(
      'look-controls',
      'enabled',
      immersive || (state.mode === 'globe' && state.phase === 'explore' && !paused),
    );
    if (state.phase !== 'explore') {
      const mobile = window.innerWidth < 760;
      aimRig(
        new T.Vector3(mobile ? 0 : 9, mobile ? -13 : 0, 0),
        new T.Vector3(mobile ? 0 : 9, mobile ? -12 : 1, mobile ? 45 : 36),
      );
      return;
    }
    if (state.mode === 'globe') {
      rig.object3D.position.set(0, GLOBE_RADIUS + GLOBE_EYE_LIFT, 0);
      rig.object3D.rotation.set(0, 0, 0);
      rig.setAttribute('position', rig.object3D.position);
      if (!immersive) {
        const look = camera.components['look-controls'];
        if (look?.pitchObject) look.pitchObject.rotation.x = -0.95;
      }
    } else orbitCamera();
  }
  function updateModel() {
    if (!state) return;
    const m = modelAt(state.timestamp),
      quiz = state.phase !== 'explore',
      surface = state.mode === 'globe' && !quiz;
    if (surface) {
      earth.position.set(0, 0, 0);
      earth.scale.setScalar(GLOBE_RADIUS);
      earth.quaternion.copy(navQuaternion(state.location));
      sun.position.copy(vec(m.sunLocal).applyQuaternion(earth.quaternion).multiplyScalar(220));
      sun.scale.setScalar(0.65);
      moon.position.copy(
        vec(m.moonLocal)
          .applyQuaternion(earth.quaternion)
          .multiplyScalar((220 * 6) / Math.hypot(...m.earth)),
      );
      moon.scale.setScalar(1.5);
    } else if (quiz) {
      earth.position.set(0, 0, 0);
      earth.scale.setScalar(11);
      const q = activeQuestion(state),
        target = q?.type !== 'fact' ? COUNTRY_BY_ID[q?.target] : null;
      earth.quaternion.copy(navQuaternion(target || state.location, true));
      sun.position.set(-90, 25, 90);
      sun.scale.setScalar(0.65);
      moon.visible = false;
    } else {
      earth.position.copy(vec(m.earth));
      earth.scale.setScalar(2.5);
      earth.quaternion
        .setFromAxisAngle(new T.Vector3(0, 0, 1), m.tilt)
        .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), m.spin));
      sun.position.set(0, 0, 0);
      sun.scale.setScalar(1);
      moon.position.copy(vec(m.moon));
      moon.scale.setScalar(1);
    }
    if (!quiz) moon.visible = true;
    sunlight.position.copy(sun.position);
    moon.lookAt(earth.position);
    earthMaterial.emissiveIntensity = quiz ? 0.32 : surface && settings.mapLight ? 0.5 : 0.08;
    clouds.visible = !quiz;
    mapRoot.visible = surface || quiz;
    axis.visible = !surface && !quiz && settings.axis;
    orbitPath.visible = !surface && !quiz && settings.paths;
    lunarPath.visible = orbitPath.visible;
    lunarPath.position.copy(vec(m.earth));
    const showLabels = surface && !paused;
    for (const controller of controllers) controller.object3D.visible = immersive;
    if (wristCue) {
      wristCue.visible = showLabels && immersive;
      wristCue.scale.setScalar(settings.large ? 1.15 : 1);
    }
    const nearby = COUNTRIES.map((c) => ({
      id: c.id,
      distance: distanceDegrees(state.location, c),
    }))
      .filter((c) => c.distance < 60)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((c) => c.id);
    for (const [id, o] of labels) {
      o.visible = showLabels && nearby.includes(id);
      const size = 0.026 * (settings.large ? 1.15 : 1);
      o.scale.set(o.userData.aspect * size, size, 1);
    }
    bodyLabels.sun.position.copy(sun.position).add(new T.Vector3(0, surface ? 5 : 8, 0));
    bodyLabels.earth.position.copy(earth.position).add(new T.Vector3(0, 5, 0));
    bodyLabels.moon.position.copy(moon.position).add(new T.Vector3(0, 2, 0));
    for (const o of Object.values(bodyLabels)) o.visible = !surface && !quiz;
    const q = activeQuestion(state),
      wanted = quiz
        ? state.phase === 'quiz' && q?.type !== 'fact'
          ? q.target
          : null
        : state.selected;
    if (wanted !== lastHighlight) {
      lastHighlight = wanted;
      buildHighlight(wanted);
    }
    environment.dataset.mode = surface ? 'globe' : quiz ? 'quiz' : 'orbit';
    earthEntity.dataset.lat = state.location.lat.toFixed(4);
    earthEntity.dataset.lon = state.location.lon.toFixed(4);
    earthEntity.dataset.timestamp = String(Math.round(state.timestamp));
    if (!immersive && !surface && !quiz) orbitCamera();
  }

  const panel = el('a-entity', { position: '0 0 -2', visible: false });
  camera.append(panel);
  function pruneText() {
    const used = new Set();
    rig.object3D.traverse((o) => {
      if (o.material?.map) used.add(o.material.map);
    });
    for (const [key, t] of textCache)
      if (!used.has(t)) {
        textMaterials.get(key).dispose();
        t.dispose();
        textCache.delete(key);
        textMaterials.delete(key);
      }
  }
  function panelButton(text, action, x, y, width = 1.1, height = 0.22) {
    const b = el('a-plane', {
      position: `${x} ${y} .01`,
      width,
      height,
      material: 'shader: flat; color: #132f43',
      ...(action ? { class: 'xr-button', 'data-action': action } : {}),
    });
    b.setObject3D('label', textMesh(text, width, height - 0.01));
    panel.append(b);
  }
  function drawPanel() {
    const side = state?.phase === 'quiz' && panelMode === 'activity',
      parent = side ? rig : camera;
    if (panel.parentElement !== parent) parent.append(panel);
    panel.setAttribute('position', side ? '1.8 1.65 -3' : '0 0 -2');
    panel.setAttribute('rotation', side ? '0 -30 0' : '0 0 0');
    panel.object3D.scale.setScalar(settings.large ? 1.12 : 1);
    panel.object3D.traverse((o) => {
      if (o.geometry) {
        o.geometry.dispose();
        const i = labelGeo.indexOf(o.geometry);
        if (i >= 0) labelGeo.splice(i, 1);
      }
    });
    panel.replaceChildren();
    panel.setAttribute('visible', immersive && paused);
    if (!immersive || !paused || !state) {
      pruneText();
      return;
    }
    let title = 'EARTH EXPLORER',
      rows = [],
      full = false;
    const c = COUNTRY_BY_ID[state.card],
      q = activeQuestion(state);
    if (panelMode === 'countries') {
      const pages = Math.ceil(COUNTRIES.length / 10);
      title = 'COUNTRIES · ' + (countryPage + 1) + ' / ' + pages;
      rows = COUNTRIES.slice(countryPage * 10, countryPage * 10 + 10).map((c) => [
        c.name + (state.visited.includes(c.id) ? ' · read' : ''),
        'visit:' + c.id,
      ]);
      rows.push(['Previous page', 'country-page:-1'], ['Next page', 'country-page:1']);
    } else if (panelMode === 'country' && c) {
      title = c.name + ' · ' + c.continent;
      rows = [
        [c.fact, null],
        ['Visit this country', 'land:' + c.id],
        ['Other countries', 'countries'],
        ['Close card', 'close-card'],
      ];
      full = true;
    } else if (panelMode === 'mode') {
      title = 'CHOOSE YOUR VIEW';
      rows = [
        ['Orbit Observatory', 'mode:orbit'],
        ['Globe Explorer', 'mode:globe'],
      ];
    } else if (panelMode === 'time') {
      const d = new Date(state.timestamp);
      title = d.toISOString().slice(0, 10) + ' · ' + d.toISOString().slice(11, 16) + ' UTC';
      rows = [
        ['Previous day', 'step-day:-1'],
        ['Next day', 'step-day:1'],
        ['Hour −', 'step-hour:-1'],
        ['Hour +', 'step-hour:1'],
        ['Year −', 'year:' + String(d.getUTCFullYear() - 1)],
        ['Year +', 'year:' + String(d.getUTCFullYear() + 1)],
        ['Minimize clock', 'close'],
        [
          state.mode === 'globe' ? 'Paused while exploring' : state.playing ? 'Pause' : 'Play',
          state.mode === 'globe' ? null : 'play',
        ],
        ['Speed: ' + (state.speed / 86400000).toFixed(2) + ' days/s', 'cycle-speed'],
      ];
    } else if (panelMode === 'activity' && state.phase === 'quiz') {
      const locked = state.answers.length > state.question;
      title = 'Question ' + (state.question + 1) + '/5 · ' + q.prompt;
      rows = [
        ...(q.fact ? [[q.fact, null]] : []),
        ...q.choices.map((id, i) => [
          (state.choice === id ? 'Selected: ' : '') +
            (q.type === 'continent' ? id : COUNTRY_BY_ID[id].name),
          locked ? null : 'choose:' + i + ':' + q.id,
        ]),
        locked
          ? [state.question === 4 ? 'Show final score' : 'Next question', 'next:' + q.id]
          : [
              state.choice ? 'Confirm answer' : 'Choose an answer first',
              state.choice ? 'confirm:' + q.id : null,
            ],
        ['Leave unfinished quiz', 'leave-request'],
      ];
      full = true;
    } else if (panelMode === 'activity' && state.phase === 'result') {
      title = 'QUIZ SCORE ' + quizScore(state) + ' / 5';
      rows = state.queue.map((q, i) => [
        i +
          1 +
          '. ' +
          (state.answers[i].correct ? 'Correct' : 'Wrong') +
          ' · ' +
          COUNTRY_BY_ID[q.target].name,
        'show-country:' + q.target,
      ]);
      rows.push(['Continue exploring', 'explore']);
      full = true;
    } else if (panelMode === 'leave-confirm') {
      title = 'LEAVE UNFINISHED QUIZ?';
      rows = [
        ['Leave quiz', 'leave-quiz'],
        ['Keep answering', 'activity'],
      ];
    } else if (panelMode === 'comfort') {
      title = 'COMFORT & DISPLAY';
      rows = [
        [settings.stationary ? 'Walking disabled' : 'Walking enabled', 'stationary'],
        [settings.mapLight ? 'Map light on' : 'Map light off', 'mapLight'],
        [settings.reduced ? 'Reduced motion on' : 'Reduced motion off', 'reduced'],
        [settings.large ? 'Larger text on' : 'Larger text off', 'large'],
        [settings.paths ? 'Orbit paths on' : 'Orbit paths off', 'paths'],
        [settings.axis ? 'Earth axis on' : 'Earth axis off', 'axis'],
        [settings.muted ? 'Sound off' : 'Sound on', 'muted'],
      ];
    } else {
      rows = [
        ['Continue', 'close'],
        ['Choose view', 'mode-panel'],
        ['Countries (' + state.visited.length + '/' + COUNTRIES.length + ')', 'countries'],
        [
          state.phase === 'explore' ? 'Country quiz' : 'Quiz / results',
          state.phase === 'explore' ? 'quiz-start' : 'activity',
        ],
        ['Time controls', 'time'],
        ['System view', 'view:system'],
        ['Earth close view', 'view:earth'],
        ['Comfort & display', 'comfort'],
        ['Main room', 'room:main'],
        ['Exit VR', 'exit-vr'],
      ];
    }
    if (panelMode !== 'menu') rows.push(['Menu', 'menu']);
    if (!full && panelMode !== 'menu') rows.push(['Continue', 'close']);
    const heading = el('a-entity', { position: '0 1.03 0' });
    heading.setObject3D('label', textMesh(title, 2.7, 0.35, '#a5f1dc'));
    panel.append(heading);
    let rowTop = 0.82;
    rows.forEach(([text, action], i) => {
      if (full) {
        const height = text.length > 80 ? 0.38 : 0.25;
        panelButton(text, action, 0, rowTop - height / 2, 2.7, height);
        rowTop -= height + 0.04;
      } else
        panelButton(
          text,
          action,
          i % 2 ? 0.61 : -0.61,
          0.65 - Math.floor(i / 2) * 0.235,
          1.16,
          0.21,
        );
    });
    pruneText();
  }
  function render(s, options) {
    const changedView = lastView !== s.mode + ':' + s.phase;
    state = s;
    settings = options;
    if (changedView) {
      lastView = s.mode + ':' + s.phase;
      applyView();
    }
    updateModel();
    drawPanel();
  }
  function pause(value, mode = 'menu') {
    paused = value;
    if (value) {
      callbacks.walk?.(0);
      comet.visible = false;
    }
    panelMode = mode;
    keys.clear();
    camera.setAttribute(
      'look-controls',
      'enabled',
      immersive || (state?.mode === 'globe' && state?.phase === 'explore' && !paused),
    );
    drawPanel();
  }
  function selectRay(ray, left = false) {
    earth.updateWorldMatrix(true, true);
    const hit = ray.intersectObject(globe, true)[0];
    if (hit) {
      const p = earth.worldToLocal(hit.point.clone()),
        location = vectorGeo([p.x, p.y, p.z]);
      if (immersive && left && state.mode === 'globe' && state.phase === 'explore') {
        callbacks.teleport?.(location);
        return;
      }
      const feature = countryAt(features, location.lat, location.lon);
      if (feature) callbacks.pick?.(feature.properties);
      else callbacks.hover?.('Ocean · choose a country on land');
      return;
    }
    const body = ray.intersectObjects([sun, moon], true)[0];
    if (body) callbacks.action('body:' + (body.object === sun ? 'sun' : 'moon'));
  }
  const listeners = [],
    listen = (target, type, fn, options) => {
      target.addEventListener(type, fn, options);
      listeners.push(() => target.removeEventListener(type, fn, options));
    };
  const pointerRay = (e) => {
    const bounds = scene.canvas.getBoundingClientRect(),
      ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(e.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      camera.components.camera.camera,
    );
    return ray;
  };
  listen(scene, 'loaded', () => {
    applyView();
    const canvas = scene.canvas;
    listen(canvas, 'pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      dragDistance = 0;
    });
    listen(canvas, 'pointermove', (e) => {
      if (drag && e.buttons && !immersive) {
        const dx = e.clientX - drag.x,
          dy = e.clientY - drag.y;
        dragDistance += Math.hypot(dx, dy);
        drag = { x: e.clientX, y: e.clientY };
        if (state.mode === 'orbit' && !paused) {
          yaw -= dx * 0.006;
          pitch = Math.max(0.08, Math.min(1.3, pitch + dy * 0.005));
          orbitCamera();
        }
      }
    });
    listen(canvas, 'pointerup', (e) => {
      if (!paused && state.phase === 'explore' && dragDistance < 6) selectRay(pointerRay(e));
      drag = null;
    });
    listen(
      canvas,
      'wheel',
      (e) => {
        if (!paused && state.mode === 'orbit') {
          e.preventDefault();
          zoom = Math.max(36, Math.min(115, zoom + e.deltaY * 0.035));
          orbitCamera();
        }
      },
      { passive: false },
    );
  });
  listen(window, 'keydown', (e) => {
    callbacks.gesture?.();
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
    if (e.code === 'KeyE' && !e.repeat && !paused && state.phase === 'explore') {
      const ray = new T.Raycaster();
      ray.setFromCamera(new T.Vector2(), camera.components.camera.camera);
      selectRay(ray);
    }
  });
  listen(window, 'keyup', (e) => keys.delete(e.code));
  listen(window, 'blur', () => keys.clear());
  listen(document, 'visibilitychange', () => {
    if (document.hidden) keys.clear();
  });
  listen(scene, 'click', (e) => {
    const target = e.target.closest?.('.xr-button');
    if (target?.dataset.action) {
      callbacks.gesture?.();
      callbacks.action(target.dataset.action);
      return;
    }
    if (immersive && !paused && e.target.closest?.('.earth-target') && e.detail?.intersection) {
      callbacks.gesture?.();
      const point = e.detail.intersection.point.clone(),
        local = earth.worldToLocal(point),
        location = vectorGeo([local.x, local.y, local.z]),
        hand = e.detail.cursorEl?.getAttribute('laser-controls')?.hand;
      if (hand === 'left' && state.mode === 'globe') callbacks.teleport?.(location);
      else {
        const f = countryAt(features, location.lat, location.lon);
        if (f) callbacks.pick?.(f.properties);
      }
    }
  });
  const controllers = [];
  let wristTexture,
    wristCanvas,
    wristCue,
    wristText = '';
  for (const hand of ['left', 'right']) {
    const controller = el('a-entity', {
        'laser-controls': `hand: ${hand}; model: false`,
        raycaster: 'objects: .earth-target, .xr-button; far: 300; lineColor: #90ead0',
      }),
      menu = el('a-plane', {
        position: '0 .08 -.2',
        width: 0.2,
        height: 0.06,
        class: 'xr-button',
        'data-action': 'menu',
      });
    menu.setObject3D('label', textMesh('MENU', 0.2, 0.06));
    controller.append(menu);
    if (hand === 'left') {
      wristCanvas = document.createElement('canvas');
      wristCanvas.width = 512;
      wristCanvas.height = 128;
      wristTexture = new T.CanvasTexture(wristCanvas);
      wristTexture.colorSpace = T.SRGBColorSpace;
      textures.push(wristTexture);
      const g = new T.PlaneGeometry(0.46, 0.115),
        m = new T.MeshBasicMaterial({ map: wristTexture, side: T.DoubleSide });
      owned.push(g, m);
      const cue = new T.Mesh(g, m);
      cue.position.set(0, 0.18, -0.3);
      cue.rotation.x = -0.6;
      controller.object3D.add(cue);
      wristCue = cue;
    }
    controllers.push(controller);
    rig.append(controller);
  }
  listen(scene, 'enter-vr', () => {
    immersive = true;
    applyView();
    callbacks.immersive?.(true);
    drawPanel();
  });
  listen(scene, 'exit-vr', () => {
    immersive = false;
    applyView();
    callbacks.immersive?.(false);
    drawPanel();
  });
  if (!A.components['earth-explorer-tick'])
    A.registerComponent('earth-explorer-tick', {
      tick(time, delta) {
        this.el.earthTick?.(delta);
      },
    });
  scene.earthTick = (delta) => {
    mount.dataset.frames = String(Number(mount.dataset.frames || 0) + 1);
    mount.dataset.frameMs = String(Math.round(delta || 0));
    if (disposed || !state || document.hidden) return;
    const dt = Math.min(delta || 0, 50) / 1000,
      input = readVRInput(scene.renderer?.xr?.getSession()?.inputSources);
    if (immersive && input.menu && !wasMenu) callbacks.action(paused ? 'close' : 'menu');
    wasMenu = input.menu;
    if (Math.abs(input.turn) < 0.3) snapReady = true;
    stepCooldown = Math.max(0, stepCooldown - dt);
    if (!paused || panelMode === 'time') callbacks.tick?.(dt);
    updateModel();
    updateSky(Math.min((delta || 0) / 1000, 1));
    let travelled = 0;
    if (!paused && state.mode === 'globe' && state.phase === 'explore') {
      if (immersive && Math.abs(input.turn) > 0.7 && snapReady) {
        rig.object3D.rotation.y -= (Math.sign(input.turn) * Math.PI) / 6;
        snapReady = false;
      }
      const forward = immersive
          ? -input.y
          : Number(keys.has('KeyW') || keys.has('ArrowUp')) -
            Number(keys.has('KeyS') || keys.has('ArrowDown')),
        side = immersive ? input.x : Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
        look = camera.components['look-controls'];
      if (!immersive && look?.yawObject)
        look.yawObject.rotation.y +=
          (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.4;
      if (!settings.stationary && (forward || side)) {
        mount.dataset.travelFrames = String(Number(mount.dataset.travelFrames || 0) + 1);
        const direction = new T.Vector3(0, 0, -1).applyQuaternion(
          camera.object3D.getWorldQuaternion(new T.Quaternion()),
        );
        direction.y = 0;
        direction.normalize();
        const amount = immersive ? 1.8 : dt * 2.5,
          normalizer = Math.max(1, Math.hypot(side, forward)),
          east = ((direction.x * forward - direction.z * side) * amount) / normalizer,
          north = (-(direction.z * forward + direction.x * side) * amount) / normalizer,
          location = moveSurface(state.location, east, north);
        if (immersive) {
          if (stepCooldown === 0) {
            stepCooldown = 0.6;
            callbacks.teleport?.(location, true);
          }
        } else {
          travelled = Math.hypot(east, north);
          callbacks.location?.(location);
        }
      }
    } else keys.clear();
    callbacks.walk?.(travelled);
    hoverTick += dt;
    panelTick += dt;
    if (hoverTick > 0.2) {
      hoverTick = 0;
      callbacks.readout?.(state.location, features);
      if (wristTexture && state.mode === 'globe' && state.phase === 'explore') {
        const place =
            countryAt(features, state.location.lat, state.location.lon)?.properties.name || 'Ocean',
          text = place + ' · ' + state.visited.length + '/' + COUNTRIES.length;
        if (text !== wristText) {
          const x = wristCanvas.getContext('2d');
          x.fillStyle = '#0a2538';
          x.fillRect(0, 0, 512, 128);
          x.fillStyle = '#bdeddb';
          x.font = '600 32px Segoe UI';
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText(text, 256, 64, 490);
          wristTexture.needsUpdate = true;
          wristText = text;
        }
      }
    }
    if (immersive && paused && panelMode === 'time' && panelTick > 0.5) {
      panelTick = 0;
      drawPanel();
    }
  };
  scene.setAttribute('earth-explorer-tick', '');
  return {
    scene,
    render,
    pause,
    countryPage(delta) {
      countryPage =
        (countryPage + delta + Math.ceil(COUNTRIES.length / 10)) % Math.ceil(COUNTRIES.length / 10);
      drawPanel();
    },
    setState(s) {
      state = s;
    },
    view(id) {
      if (!['system', 'earth'].includes(id)) return;
      observerView = id;
      yaw = 0;
      pitch = id === 'earth' ? 0.26 : 0.43;
      zoom = id === 'earth' ? 62 : 82;
      applyView();
    },
    get immersive() {
      return immersive;
    },
    get ready() {
      return mapReady && textureCount === 4;
    },
    get features() {
      return features;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      keys.clear();
      listeners.forEach((fn) => fn());
      if (highlight) {
        highlight.geometry.dispose();
        highlight.material.dispose();
      }
      if (locator) {
        locator.geometry.dispose();
        locator.material.dispose();
      }
      owned.forEach((o) => o.dispose?.());
      textures.forEach((t) => t.dispose());
      textCache.forEach((t) => t.dispose());
      textMaterials.forEach((m) => m.dispose());
      labelGeo.forEach((g) => g.dispose());
    },
  };
}
