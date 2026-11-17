import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, initialExhibit, interact, gradeChoice } from '../src/game/lessons.js';
import { movePlayer, canStand, findPath, approachPoint } from '../src/game/navigation.js';

test('the same insertion order demonstrates LIFO at Stack and FIFO at Queue', () => {
  let stack = initialExhibit('stack'),
    queue = initialExhibit('queue');
  for (let i = 0; i < 3; i++) {
    stack = interact(stack, 'push');
    queue = interact(queue, 'enqueue');
  }
  stack = interact(stack, 'pop');
  queue = interact(queue, 'dequeue');
  assert.deepEqual(stack.items, [1, 2]);
  assert.deepEqual(queue.items, [2, 3]);
  const empty = initialExhibit('stack');
  assert.deepEqual(interact(empty, 'pop').items, []);
  assert.equal(empty.next, 1);
  assert.throws(() => interact(stack, 'run-code'));
});
test('cache miss/hit/reset, recursive base case, deadlock release and permits change exhibit state', () => {
  let cache = interact(initialExhibit('cache'), 'request');
  assert.equal(cache.cached, true);
  assert.equal(cache.hits, 0);
  cache = interact(cache, 'request');
  assert.equal(cache.hits, 1);
  assert.equal(interact(cache, 'clear').cached, false);
  let recursive = initialExhibit('recursion');
  for (let i = 0; i < 3; i++) recursive = interact(recursive, 'step');
  assert.match(recursive.message, /Base case/);
  recursive = interact(interact(recursive, 'step'), 'step');
  assert.match(recursive.message, /= 6/);
  let lock = interact(interact(initialExhibit('deadlock'), 'step'), 'step');
  assert.match(lock.message, /DEADLOCK/);
  assert.equal(interact(lock, 'release').step, 0);
  let semaphore = initialExhibit('semaphore');
  for (let i = 0; i < 3; i++) semaphore = interact(semaphore, 'enter');
  assert.equal(semaphore.items.length, 2);
  assert.equal(semaphore.waiting, 1);
  semaphore = interact(semaphore, 'leave');
  assert.equal(semaphore.items.length, 2);
  assert.equal(semaphore.waiting, 0);
});
test('movement cannot tunnel through walls or exhibits and every station has a walkable route', () => {
  const stopped = movePlayer({ x: 0, z: 5.7 }, 0, -20);
  assert.ok(stopped.z > 2);
  assert.ok(canStand(stopped.x, stopped.z));
  const wall = movePlayer({ x: 6, z: 5 }, 100, 100);
  assert.ok(wall.x <= 6.7 && wall.z <= 6.5);
  for (const lesson of LESSONS) {
    const goal = approachPoint(lesson);
    assert.ok(canStand(goal.x, goal.z));
    const path = findPath({ x: 0, z: 5.7 }, goal);
    assert.ok(path.length > 0);
    assert.ok(path.every((p) => canStand(p.x, p.z)));
    for (let i = 1; i < path.length; i++)
      assert.equal(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].z - path[i - 1].z), 0.5);
  }
});
test('practice quiz scoring uses one listed answer', () => {
  assert.equal(gradeChoice(LESSONS[0], 2).correct, true);
  assert.equal(gradeChoice(LESSONS[0], 0).correct, false);
  assert.throws(() => gradeChoice(LESSONS[0], 7));
});
