import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeExports, formatAnalysis, recordsFromExport } from '../src/analysis.js';
import { createDemoSession, beginAuthoring } from '../src/state.js';
import { markPreparationCap, saveEvaluation } from '../src/evaluation.js';
import { serializeWorkingSession } from '../src/storage.js';

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../data/synthetic/${name}`, import.meta.url), 'utf8'));

test('analysis distinguishes a completed score from an incomplete preparation at cap', () => {
  const result = analyzeExports([
    load('synthetic-complete-result.json'),
    load('synthetic-incomplete-working.json'),
  ]);
  assert.equal(result.total.attempts, 2);
  assert.equal(result.total.completedWithinCap, 1);
  assert.equal(result.total.incompleteAtCap, 1);
  assert.deepEqual(result.total.preparationAmongCompleters, {
    n: 1,
    median: 240,
    min: 240,
    max: 240,
  });
  assert.equal(result.total.termAmongSubmittedCompleters.median, 4);
  assert.equal(result.total.meaningAmongSubmittedCompleters.median, 3);
  assert.equal(result.total.missing.termCorrect, 1);
  assert.match(formatAnalysis(result), /selected subset/);
});

test('empty analysis reports no participant data; duplicates and invalid scores fail', () => {
  assert.equal(formatAnalysis(analyzeExports([])), 'No participant data collected.\n');
  const one = load('synthetic-complete-result.json');
  assert.throws(() => analyzeExports([one, one]), /Duplicate exported record/);
  assert.throws(
    () => recordsFromExport({ ...one, score: { ...one.score, term: 7 } }),
    /Invalid term score/,
  );
  assert.throws(
    () => recordsFromExport({ format: 'ai-mol-vr-prepared-session' }),
    /no observed outcome/,
  );
});

test('anonymous evaluation and incomplete preparation survive a working export', () => {
  let session = createDemoSession('test-cap');
  session = beginAuthoring(session, '2026-09-29T10:00:00.000Z');
  session = saveEvaluation(session, { participantId: 'P01', effortRating: 6 }).session;
  session = markPreparationCap(session, '2026-09-29T10:06:00.000Z').session;
  const record = recordsFromExport(JSON.parse(serializeWorkingSession(session)))[0];
  assert.equal(record.evaluation.participantId, 'P01');
  assert.equal(record.evaluation.approvedAtCap, 0);
  assert.equal(
    analyzeExports([JSON.parse(serializeWorkingSession(session))]).rows[0].completedWithinCap,
    false,
  );
  assert.equal(saveEvaluation(session, { participantId: 'a space' }).errors.length, 1);
});
