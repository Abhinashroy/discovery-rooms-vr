import test from 'node:test';
import assert from 'node:assert/strict';
import { scenePresentation } from '../src/scene/interaction.js';
import { createPreparedDemonstration } from '../src/data/prepared-demo.js';

const session = {
  stage: 'study',
  facts: Array.from({ length: 6 }, (_, index) => ({
    term: `Secret term ${index + 1}`,
    meaning: `Secret meaning ${index + 1}`,
  })),
  cues: Array.from({ length: 6 }, () => ({
    final: { scene: 'Secret scene', meaningLink: 'Secret link' },
  })),
  attempts: [{ status: 'in_progress', visitedLoci: [] }],
};

test('scene presentation shows approved study content but no answers in hidden phases', () => {
  const study = scenePresentation(session, 0);
  assert.match(study.lines.join(' '), /Secret term 1/);
  assert.equal(study.phase, null);
  const complete = structuredClone(session);
  complete.attempts[0].visitedLoci = ['door', 'desk', 'bookshelf', 'window', 'plant', 'lamp'];
  assert.equal(scenePresentation(complete, 5).phase, 'Finish');
  complete.attempts[0].status = 'complete';
  assert.equal(scenePresentation(complete, 5).phase, 'Distractor');
  for (const stage of ['distractor', 'recall']) {
    complete.stage = stage;
    const hidden = scenePresentation(complete, 2);
    assert.equal(hidden.lines.join(' ').includes('Secret'), false);
    assert.equal(hidden.visible, true);
  }
  assert.equal(scenePresentation(complete, 0).previousDisabled, true);
  assert.equal(scenePresentation(complete, 5).nextDisabled, true);
});

test('bundled prepared demonstration is explicitly a fixture with no claimed preparation timing', () => {
  const ready = createPreparedDemonstration();
  assert.equal(ready.dataKind, 'fixture');
  assert.equal(ready.preparedImport, true);
  assert.equal(ready.timing.preparationSeconds, null);
  assert.equal(
    ready.cues.every((cue) => cue.approved && cue.provenance.source === 'illustrative-example'),
    true,
  );
  assert.equal(ready.attempts.length, 1);
  assert.equal(ready.attempts[0].status, 'ready');
});
