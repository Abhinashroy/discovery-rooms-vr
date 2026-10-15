import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCI } from '../src/data/loci.js';
import { validateFacts, validateCue } from '../src/validation.js';
import {
  createDemoSession,
  replaceFacts,
  beginAuthoring,
  editCue,
  approveCue,
  startStudy,
  visitStudyLocus,
  interruptStudy,
  completeStudy,
} from '../src/state.js';
import {
  serializeWorkingSession,
  serializePreparedSession,
  parseSessionJson,
  loadSession,
  saveSession,
  STORAGE_KEY,
} from '../src/storage.js';

function approvedSession() {
  let session = beginAuthoring(createDemoSession('manual-test'), '2026-09-29T10:00:00.000Z');
  for (let index = 0; index < 6; index++) {
    session = editCue(session, index, {
      scene: `A memorable ${LOCI[index].name} scene for fact ${index + 1}.`,
      meaningLink: `This recalls the meaning of fact ${index + 1}.`,
      propId: 'book',
      animationId: 'bounce',
      colorId: 'blue',
    });
    const result = approveCue(session, index, '2026-09-29T10:02:00.000Z');
    assert.deepEqual(result.errors, []);
    session = result.session;
  }
  return session;
}

test('five and seven facts are rejected with the count; invalid cues cannot be approved', () => {
  const base = createDemoSession('fact-count');
  assert.match(validateFacts(base.facts.slice(0, 5)).join(' '), /exactly six facts; received 5/);
  assert.match(
    validateFacts([...base.facts, { ...base.facts[0] }]).join(' '),
    /exactly six facts; received 7/,
  );
  assert.match(replaceFacts(base, base.facts.slice(0, 5)).errors.join(' '), /received 5/);
  assert.equal(approveCue(base, 0).session, base);
  assert.match(approveCue(base, 0).errors.join(' '), /Scene sentence is required/);
  assert.ok(
    validateCue({
      scene: '',
      meaningLink: '',
      propId: 'book',
      animationId: 'none',
      colorId: 'blue',
    }).length >= 2,
  );
});

test('fact edit increments revision and clears all dependent cues and approvals', () => {
  const before = approvedSession();
  const updatedFacts = before.facts.map((fact) => ({ term: fact.term, meaning: fact.meaning }));
  updatedFacts[0].meaning = 'A changed, user-checked meaning.';
  const result = replaceFacts(before, updatedFacts);
  assert.deepEqual(result.errors, []);
  assert.equal(result.session.contentRevision, before.contentRevision + 1);
  assert.equal(result.session.dataKind, 'practice');
  assert.ok(result.session.cues.every((cue) => cue.final === null && cue.approved === false));
  assert.equal(before.cues[0].approved, true);
  assert.equal(result.session.facts[0].meaningRubric, '');
  assert.notEqual(result.session.sourcePreparationId, before.sourcePreparationId);
});

test('six manual cues can be approved and rehearsed, then completed attempt stays complete after backup restore', () => {
  let session = approvedSession();
  assert.equal(session.cues.filter((cue) => cue.approved).length, 6);
  assert.equal(session.timing.preparationSeconds, 120);
  session = startStudy(session, '2026-09-29T10:03:00.000Z').session;
  for (const locus of LOCI.slice(1)) session = visitStudyLocus(session, locus.id);
  session = completeStudy(session, '2026-09-29T10:05:00.000Z').session;
  assert.equal(session.attempts.at(-1).status, 'complete');
  assert.equal(session.attempts.at(-1).rehearsalSeconds, 120);
  const restored = parseSessionJson(serializeWorkingSession(session)).session;
  assert.equal(restored.stage, 'study');
  assert.equal(restored.attempts.length, 1);
  assert.equal(restored.attempts[0].status, 'complete');
});

test('revising an approved cue after rehearsal invalidates its approval and makes a fresh attempt', () => {
  let session = approvedSession();
  session = startStudy(session, '2026-09-29T10:03:00.000Z').session;
  const earlierPreparationId = session.sourcePreparationId;
  session = editCue(session, 0, { scene: 'A revised scene at the door.' });
  assert.equal(session.stage, 'author');
  assert.equal(session.cues[0].approved, false);
  assert.equal(session.attempts.length, 2);
  assert.equal(session.attempts[0].invalidated, true);
  assert.equal(session.attempts[1].status, 'ready');
  assert.notEqual(session.sourcePreparationId, earlierPreparationId);
  assert.equal(session.attempts[0].sourcePreparationId, earlierPreparationId);
  assert.equal(session.attempts[1].sourcePreparationId, session.sourcePreparationId);
  session = editCue(session, 0, { meaningLink: 'Another draft link.' });
  assert.equal(session.attempts.length, 2);
});

test('leaving or reloading an unfinished rehearsal records interruption without auto-repeating', () => {
  let session = startStudy(approvedSession(), '2026-09-29T10:03:00.000Z').session;
  assert.match(startStudy(session).errors.join(' '), /already in progress/);
  session = interruptStudy(session);
  assert.equal(session.attempts.length, 1);
  assert.equal(session.attempts[0].status, 'interrupted');
  const restored = parseSessionJson(
    serializeWorkingSession({
      ...session,
      stage: 'study',
      attempts: [{ ...session.attempts[0], status: 'in_progress' }],
    }),
  );
  assert.equal(restored.recovered, true);
  assert.equal(restored.session.stage, 'author');
  assert.equal(restored.session.attempts[0].status, 'interrupted');
  assert.equal(restored.session.attempts.length, 1);
});

test('prepared export/import keeps approval and preparation provenance but creates a fresh attempt', () => {
  const session = approvedSession();
  const imported = parseSessionJson(serializePreparedSession(session));
  assert.equal(imported.prepared, true);
  assert.equal(imported.session.sessionId, session.sessionId);
  assert.equal(imported.session.sourcePreparationId, session.sourcePreparationId);
  assert.equal(imported.session.timing.preparationSeconds, session.timing.preparationSeconds);
  assert.equal(imported.session.attempts.length, 1);
  assert.equal(imported.session.attempts[0].status, 'ready');
  assert.ok(imported.session.cues.every((cue) => cue.approved));
  assert.throws(
    () => serializePreparedSession(createDemoSession('incomplete')),
    /not approved|final cue/,
  );
});

test('bad imports and unavailable storage leave the current in-memory session usable', () => {
  const session = approvedSession();
  const valid = JSON.parse(serializeWorkingSession(session));
  valid.session.facts.pop();
  assert.throws(() => parseSessionJson(JSON.stringify(valid)), /received 5/);
  assert.throws(() => parseSessionJson('{'), /malformed/);
  assert.throws(() => parseSessionJson('x'.repeat(256 * 1024 + 1)), /256 KB/);
  const brokenStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(loadSession(brokenStorage).session, null);
  assert.match(loadSession(brokenStorage).error, /could not be loaded/);
  assert.equal(saveSession(session, brokenStorage).ok, false);
  const goodStorage = new Map();
  const adapter = {
    getItem(key) {
      return goodStorage.get(key) ?? null;
    },
    setItem(key, value) {
      goodStorage.set(key, value);
    },
  };
  assert.equal(saveSession(session, adapter).ok, true);
  assert.ok(goodStorage.has(STORAGE_KEY));
  assert.equal(loadSession(adapter).session.sessionId, session.sessionId);
});
