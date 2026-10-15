import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopScene } from '../src/discovery/workshop-world.js';
import { createQuest, reduceQuest } from '../src/discovery/quest-state.js';
function node(tag, attrs = {}) {
  return {
    tag,
    attrs,
    children: [],
    append(...items) {
      this.children.push(...items);
    },
    replaceChildren() {
      this.children = [];
    },
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
  };
}
const helpers = {
  node,
  box: (position, size, color, attrs = {}) => node('box', { position, size, color, ...attrs }),
  sphere: (position, radius, color, attrs = {}) =>
    node('sphere', { position, radius, color, ...attrs }),
  sign: (text, position, ...rest) => node('sign', { text, position, rest }),
  action: () => ({}),
};
function descendants(n) {
  return [n, ...n.children.flatMap(descendants)];
}
test('circuit lamp appearance agrees with completion: missing battery stays dark even with closed switch', () => {
  let s = createQuest(12, 'guided', 'workshop');
  const act = (id, verb, value) => {
    s = reduceQuest(s, { type: 'task', id, verb, value });
  };
  for (const id of ['cargo', 'solar']) {
    act(id, 'assist');
    act(id, 'reveal');
    act(id, 'collect');
  }
  act('globe', 'fit', 'Lamp');
  act('globe', 'fit', 'Switch');
  act('globe', 'switch');
  const root = node('root'),
    scene = createWorkshopScene(root, helpers);
  const lamp = () =>
    descendants(root).find((n) => n.tag === 'sphere' && n.attrs.position === '0.55 1.65 .1');
  scene.render(s);
  assert.equal(lamp().attrs.color, '#70818d');
  assert.notEqual(s.tasks.globe.phase, 'completed');
  act('globe', 'fit', 'Battery');
  scene.render(s);
  assert.equal(lamp().attrs.color, '#fff19a');
  assert.equal(s.tasks.globe.phase, 'completed');
});
test('reduced motion removes Workshop demonstrations without changing the final ramp comparison', () => {
  let s = createQuest(17, 'guided', 'workshop');
  for (const id of ['cargo', 'solar', 'globe', 'moon'])
    for (const verb of ['assist', 'reveal', 'collect'])
      s = reduceQuest(s, { type: 'task', id, verb });
  s = reduceQuest(s, { type: 'task', id: 'mission', verb: 'run' });
  const root = node('root'),
    scene = createWorkshopScene(root, helpers);
  scene.render(s, { reducedMotion: true });
  assert.equal(descendants(root).filter((n) => n.attrs.animation).length, 0);
  const table = root.children.find((n) => n.attrs['data-workshop-table'] === 'mission');
  const balls = descendants(table).filter((n) => n.tag === 'sphere');
  assert.equal(balls.length, 2);
  const positions = balls.map((n) => n.attrs.position.split(' ').map(Number));
  assert.ok(positions[0][2] > positions[1][2]);
  scene.render(s, { reducedMotion: false });
  assert.ok(descendants(root).some((n) => n.attrs.animation));
});
