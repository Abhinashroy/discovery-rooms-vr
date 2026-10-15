import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCI, nextRouteIndex } from '../src/data/loci.js';
import { createDemoSession, SCHEMA_VERSION, STAGES } from '../src/state.js';

test('six fixed, distinct loci retain the specified order', () => {
  assert.deepEqual(
    LOCI.map(({ id }) => id),
    ['door', 'desk', 'bookshelf', 'window', 'plant', 'lamp'],
  );
  assert.equal(new Set(LOCI.map(({ x, z }) => `${x},${z}`)).size, 6);
});

test('route traversal reaches both endpoints and stays in bounds', () => {
  let index = 0;
  for (let stop = 1; stop < 6; stop++) index = nextRouteIndex(index, 1);
  assert.equal(index, 5);
  assert.equal(nextRouteIndex(index, 1), 5);
  for (let stop = 1; stop < 6; stop++) index = nextRouteIndex(index, -1);
  assert.equal(index, 0);
  assert.equal(nextRouteIndex(index, -1), 0);
});

test('versioned fixture keeps facts separate from empty, unapproved cues', () => {
  const session = createDemoSession('test-session');
  assert.equal(session.schemaVersion, SCHEMA_VERSION);
  assert.equal(session.contentRevision, 1);
  assert.equal(session.stage, 'familiarize');
  assert.ok(STAGES.includes(session.stage));
  assert.equal(session.dataKind, 'fixture');
  assert.equal(session.facts.length, 6);
  assert.equal(session.cues.length, 6);
  for (let i = 0; i < 6; i++) {
    assert.equal(session.facts[i].itemId, session.cues[i].itemId);
    assert.equal(session.facts[i].locusId, LOCI[i].id);
    assert.equal(session.cues[i].approved, false);
    assert.equal(session.cues[i].suggestion, null);
    assert.equal(session.cues[i].final, null);
    assert.ok(session.facts[i].term.length <= 60);
    assert.ok(session.facts[i].meaning.length <= 180);
  }
});
