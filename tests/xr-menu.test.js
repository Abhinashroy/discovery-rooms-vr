import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenuAnchor, paintMenuLabel, pruneLabelResources } from '../src/rooms/xr-menu.js';

const near = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const vectorNear = (actual, expected) => actual.forEach((value, i) => near(value, expected[i]));

function menuCanvas() {
  const draws = [],
    backgrounds = [],
    fontSize = (font) => Number(/(\d+)px/.exec(font)?.[1] || 10),
    context = {
      font: '10px sans-serif',
      measureText(text) {
        return { width: String(text).length * fontSize(this.font) * 0.55 };
      },
      fillRect(...rectangle) {
        backgrounds.push({ rectangle, color: this.fillStyle });
      },
      fillText(text, x, y, maxWidth) {
        draws.push({ text, x, y, maxWidth, size: fontSize(this.font), color: this.fillStyle });
      },
    },
    canvas = {
      width: 0,
      height: 0,
      getContext(type) {
        assert.equal(type, '2d');
        return context;
      },
    };
  return { canvas, context, draws, backgrounds };
}

test('VR menu labels match the physical plane aspect and use readable planet-name glyphs', () => {
  const { canvas, draws, backgrounds } = menuCanvas();
  paintMenuLabel(canvas, 'Mercury', 1, 0.2, '#ffffff', '#123456');

  assert.equal(canvas.width, 1024);
  assert.equal(canvas.height, 205);
  near(canvas.width / canvas.height, 1 / 0.2, 0.01);
  assert.deepEqual(backgrounds, [{ rectangle: [0, 0, 1024, 205], color: '#123456' }]);
  assert.equal(draws.length, 1);
  assert.equal(draws[0].text, 'Mercury');
  assert.equal(draws[0].color, '#ffffff');
  assert.ok(draws[0].size >= canvas.height * 0.45);
  assert.ok(draws[0].size <= canvas.height * 0.8);
  near(draws[0].x, canvas.width / 2);
  near(draws[0].y, canvas.height / 2);
});

test('long VR quiz labels wrap all words within the canvas instead of clipping or flattening them', () => {
  const { canvas, context, draws } = menuCanvas(),
    question =
      'Which planet has a system of icy rings that you can inspect from different viewpoints, ' +
      'and how does that feature help you remember its name among the eight planets?';

  paintMenuLabel(canvas, question, 2.7, 0.35, '#e8f1ff', '#12233a');

  assert.ok(draws.length >= 2, 'The question should wrap over multiple readable lines');
  assert.equal(draws.map((draw) => draw.text).join(' '), question);
  for (const draw of draws) {
    assert.ok(Number.isFinite(draw.x) && Number.isFinite(draw.y));
    assert.ok(draw.y - draw.size / 2 >= 0, 'Top glyph edge must stay inside the canvas');
    assert.ok(draw.y + draw.size / 2 <= canvas.height, 'Bottom glyph edge must stay inside');
    assert.ok(context.measureText(draw.text).width <= draw.maxWidth);
    assert.ok(draw.maxWidth > 0 && draw.maxWidth <= canvas.width);
    assert.ok(draw.size >= 16);
  }
});

function texture(name) {
  return {
    name,
    disposed: 0,
    dispose() {
      this.disposed++;
    },
  };
}

function material(map) {
  return {
    map,
    disposed: 0,
    dispose() {
      this.disposed++;
    },
  };
}

function object(materialValue, children = []) {
  return {
    material: materialValue,
    children,
    traverse(visit) {
      visit(this);
      for (const child of this.children) child.traverse(visit);
    },
  };
}

test('VR label pruning preserves a newly created label before A-Frame attaches its object', () => {
  const pending = texture('Mercury'),
    unused = texture('old menu'),
    pendingMaterial = material(pending),
    unusedMaterial = material(unused),
    textures = new Map([
      ['pending', pending],
      ['unused', unused],
    ]),
    materials = new Map([
      ['pending', pendingMaterial],
      ['unused', unusedMaterial],
    ]),
    ownedMaterials = [pendingMaterial, unusedMaterial],
    detachedEntity = { object3D: object(pendingMaterial) };

  // The native scene has not received the new A-Frame entity yet.
  pruneLabelResources({
    textures,
    materials,
    roots: [object(null)],
    entities: [detachedEntity],
    ownedMaterials,
  });

  assert.equal(pendingMaterial.map, pending);
  assert.equal(pending.disposed, 0);
  assert.equal(pendingMaterial.disposed, 0);
  assert.equal(textures.get('pending'), pending);
  assert.equal(materials.get('pending'), pendingMaterial);
  assert.equal(unused.disposed, 1);
  assert.equal(unusedMaterial.disposed, 1);
  assert.equal(unusedMaterial.map, null);
  assert.equal(textures.has('unused'), false);
  assert.equal(materials.has('unused'), false);
  assert.deepEqual(ownedMaterials, [pendingMaterial]);
});

test('VR menu redraw reclaims replaced labels while retaining shared and pending choices', () => {
  const old = texture('old choice'),
    shared = texture('Back to menu'),
    next = texture('Selected: Venus'),
    oldMaterial = material(old),
    sharedMaterial = material(shared),
    nextMaterial = material(next),
    textures = new Map([
      ['old', old],
      ['shared', shared],
      ['next', next],
    ]),
    materials = new Map([
      ['old', oldMaterial],
      ['shared', sharedMaterial],
      ['next', nextMaterial],
    ]),
    ownedMaterials = [oldMaterial, sharedMaterial, nextMaterial],
    attached = object(null, [object(sharedMaterial)]),
    pending = { object3D: object(nextMaterial) };

  pruneLabelResources({
    textures,
    materials,
    roots: [attached],
    entities: [pending],
    ownedMaterials,
  });
  assert.equal(oldMaterial.map, null);
  assert.equal(old.disposed, 1);
  assert.equal(sharedMaterial.map, shared);
  assert.equal(nextMaterial.map, next);
  assert.equal(shared.disposed, 0);
  assert.equal(next.disposed, 0);

  // Once A-Frame attaches the pending label, retaining it no longer depends on
  // the detached-entity list. A second prune must not double-dispose old data.
  attached.children.push(pending.object3D);
  pruneLabelResources({ textures, materials, roots: [attached], entities: [], ownedMaterials });
  assert.equal(old.disposed, 1);
  assert.equal(oldMaterial.disposed, 1);
  assert.equal(shared.disposed, 0);
  assert.equal(next.disposed, 0);
  assert.deepEqual([...textures.keys()], ['shared', 'next']);

  attached.children.length = 0;
  pruneLabelResources({ textures, materials, roots: [attached], entities: [], ownedMaterials });
  assert.equal(shared.disposed, 1);
  assert.equal(next.disposed, 1);
  assert.equal(textures.size, 0);
  assert.equal(materials.size, 0);
  assert.deepEqual(ownedMaterials, []);
});

test('VR label collection handles multi-material meshes and absent A-Frame nodes', () => {
  const alive = texture('quiz answer'),
    aliveMaterial = material(alive),
    unrelatedMaterial = material(null),
    textures = new Map([['answer', alive]]),
    materials = new Map([['answer', aliveMaterial]]);

  assert.doesNotThrow(() =>
    pruneLabelResources({
      textures,
      materials,
      roots: [null, undefined, object([unrelatedMaterial, aliveMaterial])],
      entities: [null, undefined, {}, { object3D: null }],
    }),
  );
  assert.equal(aliveMaterial.map, alive);
  assert.equal(alive.disposed, 0);
  assert.equal(unrelatedMaterial.disposed, 0);
});

test('VR menu captures an upright world pose once and does not follow head movement or redraws', () => {
  let view = { position: [0, 1.6, 0], forward: [0, -0.6, -0.8] },
    reads = 0;
  const poses = [],
    original = structuredClone(view),
    anchor = createMenuAnchor(
      () => {
        reads++;
        return view;
      },
      (pose) => poses.push(structuredClone(pose)),
    );

  anchor.show();
  assert.equal(reads, 1);
  assert.equal(poses.length, 1);
  vectorNear(poses[0].position, [0, 1.55, -2.6]);
  vectorNear(poses[0].rotation, [0, 0, 0]);
  assert.deepEqual(view, original);

  view = { position: [4, 1.4, 2], forward: [1, 0.8, 0] };
  anchor.show();
  anchor.show({ distance: 4, lateral: 1, vertical: 0.3 });
  assert.equal(reads, 1);
  assert.equal(poses.length, 1);
  vectorNear(poses[0].position, [0, 1.55, -2.6]);

  anchor.hide();
  anchor.show({ distance: 2, lateral: 0.5, vertical: 0.1 });
  assert.equal(reads, 2);
  assert.equal(poses.length, 2);
  vectorNear(poses[1].position, [6, 1.5, 2.5]);
  vectorNear(poses[1].rotation, [0, -90, 0]);

  view = { position: [4, 1.4, 2], forward: [0, -0.9, 1] };
  anchor.recenter({ distance: 3, lateral: -1, vertical: 0 });
  assert.equal(reads, 3);
  vectorNear(poses[2].position, [5, 1.4, 5]);
  near(poses[2].rotation[0], 0);
  near(Math.abs(poses[2].rotation[1]), 180);
  near(poses[2].rotation[2], 0);
});

test('VR menu anchoring handles cardinal headings and a vertical gaze without pitch or roll', () => {
  for (const [forward, expectedPosition, expectedYaw] of [
    [[0, 0, -1], [0, 1.6, -2], 0],
    [[1, 0, 0], [2, 1.6, 0], -90],
    [[-1, 0, 0], [-2, 1.6, 0], 90],
    [[0, 1, 0], [0, 1.6, -2], 0],
  ]) {
    let pose;
    const anchor = createMenuAnchor(
      () => ({ position: [0, 1.6, 0], forward }),
      (value) => {
        pose = value;
      },
    );
    anchor.show({ distance: 2, lateral: 0, vertical: 0 });
    vectorNear(pose.position, expectedPosition);
    vectorNear(pose.rotation, [0, expectedYaw, 0]);
    assert.ok(pose.position.every(Number.isFinite));
  }
});
