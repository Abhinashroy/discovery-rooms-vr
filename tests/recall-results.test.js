import test from 'node:test';
import assert from 'node:assert/strict';
import illustrative from '../src/data/illustrative-ai-cues.json' with { type: 'json' };
import { LOCI } from '../src/data/loci.js';
import {
  createDemoSession,
  beginAuthoring,
  approveCue,
  startStudy,
  visitStudyLocus,
  completeStudy,
  replaceFacts,
} from '../src/state.js';
import { importAiResponse } from '../src/ai/import-cues.js';
import {
  beginDistractor,
  beginRecallOnly,
  beginRecall,
  editRecallAnswer,
  submitRecall,
  skipRecall,
  markResult,
  exitHiddenPhase,
  recordExternalObservation,
} from '../src/recall/state.js';
import { scoreTerm, scoreSummary } from '../src/recall/scoring.js';
import {
  buildResultRecord,
  serializeResultJson,
  serializeResultCsv,
  csvCell,
} from '../src/results/export.js';
import {
  parseSessionJson,
  serializeWorkingSession,
  serializePreparedSession,
} from '../src/storage.js';

function approvedSession(id = 'recall-test') {
  let session = createDemoSession(id);
  const facts = session.facts.map((fact, index) => ({
    term: fact.term,
    meaning: fact.meaning,
    termAliases: index === 0 ? ['LIFO'] : fact.termAliases,
    meaningRubric: fact.meaningRubric,
  }));
  session = replaceFacts(session, facts).session;
  session = beginAuthoring(session, '2026-09-29T10:00:00.000Z');
  const response = {
    schemaVersion: 1,
    sessionId: session.sessionId,
    contentRevision: session.contentRevision,
    cues: illustrative.cues,
  };
  session = importAiResponse(
    session,
    JSON.stringify(response),
    { source: 'illustrative-example' },
    '2026-09-29T10:01:00.000Z',
  ).session;
  for (let i = 0; i < 6; i++) session = approveCue(session, i, '2026-09-29T10:02:00.000Z').session;
  return session;
}

function completedRehearsal(id) {
  let session = startStudy(approvedSession(id), '2026-09-29T10:03:00.000Z').session;
  for (const locus of LOCI.slice(1)) session = visitStudyLocus(session, locus.id);
  return completeStudy(session, '2026-09-29T10:05:00.000Z').session;
}

test('six raw answers stay hidden until one submission; scoring uses the fact at each locus', () => {
  let session = completedRehearsal('complete-loop');
  session = beginDistractor(session, '2026-09-29T10:06:00.000Z').session;
  assert.equal(session.stage, 'distractor');
  session = beginRecall(session, '2026-09-29T10:07:00.000Z').session;
  assert.equal(session.stage, 'recall');
  assert.equal(session.attempts.at(-1).distractorSeconds, 60);
  assert.equal(scoreSummary(session, session.attempts.at(-1)).termScore, null);
  const answers = [
    ['  lifo  ', 'The newest added item is removed first.'],
    ['Stack', ''],
    ['cache', '=SUM(1,2)\n"quoted"'],
    ['RECURSION', 'It calls itself on smaller cases until a base case.'],
    ['', ''],
    ['Semaphore', 'Permits limit simultaneous access.'],
  ];
  for (let i = 0; i < 6; i++) {
    const result = editRecallAnswer(session, i, { term: answers[i][0], meaning: answers[i][1] });
    assert.deepEqual(result.errors, []);
    session = result.session;
  }
  assert.equal(
    scoreTerm('Stack', session.facts[1]),
    0,
    'right fact at wrong locus gets no term credit',
  );
  session = submitRecall(session, '2026-09-29T10:09:00.000Z').session;
  assert.equal(session.stage, 'results');
  assert.equal(session.attempts.at(-1).recallSeconds, 120);
  assert.deepEqual(
    session.attempts.at(-1).answers.map((answer) => answer.term),
    answers.map((answer) => answer[0]),
  );
  assert.deepEqual(
    session.attempts.at(-1).meaningMarks.map((mark) => mark?.score ?? null),
    [null, 0, null, null, 0, null],
  );
  assert.equal(scoreSummary(session, session.attempts.at(-1)).termScore, 4);
  assert.equal(scoreSummary(session, session.attempts.at(-1)).meaningScore, null);
  assert.equal(
    markResult(session, 4, 'meaning', 1, 'self').session,
    session,
    'blank answer cannot earn credit',
  );
  for (const [index, score] of [
    [0, 1],
    [2, 0],
    [3, 1],
    [5, 1],
  ]) {
    session = markResult(session, index, 'meaning', score, 'self').session;
  }
  assert.equal(scoreSummary(session, session.attempts.at(-1)).meaningScore, 3);
  session = markResult(session, 1, 'term', 1, 'facilitator').session;
  assert.equal(scoreSummary(session, session.attempts.at(-1)).termScore, 5);
  assert.equal(session.attempts.at(-1).termOverrides[1].scorer, 'facilitator');
  const result = JSON.parse(serializeResultJson(session));
  assert.equal(result.score.term, 5);
  assert.equal(result.score.meaning, 3);
  assert.equal(result.facts[0].rawTerm, '  lifo  ');
  assert.equal(result.facts[1].automaticTermMark, 0);
  assert.equal(result.timing.preparationSeconds, 120);
  assert.equal(result.timing.setupGapSeconds, 60);
  assert.equal(result.timing.rehearsalSeconds, 120);
  const csv = serializeResultCsv(session);
  assert.equal(
    csv.trimEnd().split('\r\n').length,
    7,
    'embedded newline remains inside one quoted cell',
  );
  assert.match(csv, /"'=SUM\(1,2\)\n""quoted"""/);
  assert.equal(csvCell('  =1+1'), '"\'  =1+1"');
  assert.equal(
    parseSessionJson(serializeWorkingSession(session)).session.attempts.at(-1).meaningMarks[0]
      .score,
    1,
  );
  const firstId = session.attempts.at(-1).attemptId;
  const updatedFacts = session.facts.map((fact) => ({
    term: fact.term,
    meaning: fact.meaning,
    termAliases: fact.termAliases,
    meaningRubric: fact.meaningRubric,
  }));
  updatedFacts[0].term = 'Changed';
  const changed = replaceFacts(session, updatedFacts).session;
  assert.equal(
    buildResultRecord(changed, firstId).facts[0].term,
    'Stack',
    'old result uses its fact snapshot',
  );
  assert.equal(buildResultRecord(changed, firstId).score.term, 5);
});

test('skipped recall differs from six blank submitted answers; repeats get distinct IDs', () => {
  let session = beginDistractor(
    completedRehearsal('skip-loop'),
    '2026-09-29T11:00:00.000Z',
  ).session;
  session = skipRecall(session, '2026-09-29T11:00:30.000Z').session;
  const skipped = buildResultRecord(session);
  assert.equal(skipped.recallStatus, 'skipped');
  assert.equal(skipped.score.term, null);
  assert.equal(skipped.score.meaning, null);
  const previousId = session.attempts.at(-1).attemptId;
  session = startStudy(session, '2026-09-29T11:10:00.000Z').session;
  assert.notEqual(session.attempts.at(-1).attemptId, previousId);
  for (const locus of LOCI.slice(1)) session = visitStudyLocus(session, locus.id);
  session = completeStudy(session, '2026-09-29T11:12:00.000Z').session;
  session = beginDistractor(session, '2026-09-29T11:13:00.000Z').session;
  session = beginRecall(session, '2026-09-29T11:14:00.000Z').session;
  session = submitRecall(session, '2026-09-29T11:15:00.000Z').session;
  const blank = buildResultRecord(session);
  assert.equal(blank.score.term, 0);
  assert.equal(blank.score.meaning, 0);
  assert.ok(blank.facts.every((fact) => fact.rawTerm === '' && fact.meaningMark.score === 0));
});

test('prepared recall-only handoff and reload preserve an interrupted attempt without revealing answers', () => {
  const prepared = parseSessionJson(serializePreparedSession(approvedSession('handoff'))).session;
  assert.equal(prepared.preparedImport, true);
  let session = beginRecallOnly(prepared, 'vr').session;
  assert.equal(session.stage, 'distractor');
  assert.equal(session.attempts.at(-1).status, 'not_observed');
  assert.equal(session.attempts.at(-1).displayMode, 'vr');
  session = beginRecall(session, '2026-09-29T12:00:00.000Z').session;
  session = editRecallAnswer(session, 0, { term: 'Stack' }).session;
  const restored = parseSessionJson(serializeWorkingSession(session));
  assert.equal(restored.recovered, true);
  assert.equal(restored.session.stage, 'familiarize');
  assert.equal(restored.session.attempts.at(-1).recallStatus, 'interrupted');
  assert.equal(restored.session.attempts.at(-1).invalidated, true);
  assert.equal(restored.session.attempts.at(-1).answers[0].term, 'Stack');
  assert.match(restored.session.attempts.at(-1).protocolDeviations.join(' '), /Reloaded/);
  const exited = exitHiddenPhase(session);
  assert.equal(exited.stage, 'familiarize');
  assert.equal(exited.attempts.at(-1).invalidated, true);
});

test('external observation requires prepared content and a unique anonymous ID, preserving manual durations', () => {
  const base = approvedSession('external');
  const prepared = parseSessionJson(serializePreparedSession(base)).session;
  const form = {
    attemptId: 'P01-run1',
    displayMode: 'vr',
    scorer: 'facilitator',
    answers: LOCI.map((_, index) => ({
      term: prepared.facts[index].term,
      meaning: index === 0 ? '' : 'Observed explanation',
    })),
    meaningScores: [0, 1, 1, 0, null, 1],
    setupGapSeconds: 75,
    rehearsalSeconds: 180,
    distractorSeconds: null,
    recallSeconds: 95,
    deviation: 'Facilitator entered spoken answers after headset recall.',
  };
  assert.equal(recordExternalObservation(base, form).session, base);
  let result = recordExternalObservation(prepared, form, '2026-09-29T13:00:00.000Z');
  assert.deepEqual(result.errors, []);
  const session = result.session;
  assert.equal(session.attempts.at(-1).attemptId, 'P01-run1');
  assert.equal(session.attempts.at(-1).source, 'external-observation');
  assert.equal(session.attempts.at(-1).meaningMarks[0].scorer, 'blank-rule');
  assert.equal(session.attempts.at(-1).meaningMarks[1].scorer, 'facilitator');
  const record = buildResultRecord(session);
  assert.equal(record.timing.preparationSeconds, base.timing.preparationSeconds);
  assert.equal(record.timing.setupGapSeconds, 75);
  assert.equal(record.timing.distractorSeconds, null);
  assert.equal(record.recallMode, 'external');
  assert.equal(record.displayMode, 'vr');
  assert.equal(record.score.term, 6);
  assert.equal(record.score.meaning, null);
  assert.equal(record.score.meaningPending, 1);
  result = recordExternalObservation(session, form);
  assert.equal(result.session, session);
  assert.match(result.errors.join(' '), /already recorded/);
  const invalid = { ...form, attemptId: 'P01-run2', meaningScores: [1, 1, 1, 0, null, 1] };
  assert.match(
    recordExternalObservation(session, invalid).errors.join(' '),
    /Blank meaning answer 1/,
  );
});

test('changing a predeclared alias or meaning rubric increments revision and clears approvals', () => {
  const session = approvedSession('rubric-change');
  const facts = session.facts.map((fact) => ({
    term: fact.term,
    meaning: fact.meaning,
    termAliases: [...fact.termAliases],
    meaningRubric: fact.meaningRubric,
  }));
  facts[0].meaningRubric = 'Revised scoring rule before a new attempt.';
  const result = replaceFacts(session, facts);
  assert.deepEqual(result.errors, []);
  assert.equal(result.session.contentRevision, session.contentRevision + 1);
  assert.ok(result.session.cues.every((cue) => !cue.approved));
  assert.equal(scoreTerm('lifo', session.facts[0]), 1);
  assert.equal(scoreTerm('first in first out', session.facts[0]), 0);
});

test('an earlier submitted attempt remains markable and exportable after a later attempt', () => {
  let session = beginDistractor(
    completedRehearsal('attempt-history'),
    '2026-09-29T14:00:00.000Z',
  ).session;
  session = beginRecall(session, '2026-09-29T14:01:00.000Z').session;
  session = editRecallAnswer(session, 0, {
    term: 'Stack',
    meaning: 'The newest item leaves first.',
  }).session;
  session = submitRecall(session, '2026-09-29T14:02:00.000Z').session;
  const firstId = session.attempts.at(-1).attemptId;
  session = startStudy(session, '2026-09-29T14:03:00.000Z').session;
  const secondId = session.attempts.at(-1).attemptId;
  for (const locus of LOCI.slice(1)) session = visitStudyLocus(session, locus.id);
  session = completeStudy(session, '2026-09-29T14:04:00.000Z').session;
  session = beginDistractor(session, '2026-09-29T14:05:00.000Z').session;
  session = skipRecall(session, '2026-09-29T14:06:00.000Z').session;
  session = markResult(session, 0, 'meaning', 1, 'facilitator', firstId).session;
  assert.equal(session.attempts[0].meaningMarks[0].score, 1);
  assert.equal(session.attempts[1].recallStatus, 'skipped');
  assert.equal(JSON.parse(serializeResultJson(session, firstId)).score.term, 1);
  assert.equal(JSON.parse(serializeResultJson(session, secondId)).score.term, null);
});
