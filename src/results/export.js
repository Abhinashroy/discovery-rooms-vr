import { LOCI } from '../data/loci.js';
import { scoreSummary, percentOfSix } from '../recall/scoring.js';
import { EMPTY_EVALUATION } from '../evaluation.js';

function selectedAttempt(session, attemptId) {
  const attempt = attemptId
    ? session.attempts.find((entry) => entry.attemptId === attemptId)
    : session.attempts.at(-1);
  if (!attempt) throw new Error('No matching attempt is available for export.');
  return attempt;
}

export function buildResultRecord(session, attemptId) {
  const attempt = selectedAttempt(session, attemptId);
  const summary = scoreSummary(session, attempt);
  return {
    schemaVersion: session.schemaVersion,
    softwareVersion: '0.1.0',
    sessionId: session.sessionId,
    contentRevision: attempt.contentRevision,
    sourcePreparationId: attempt.sourcePreparationId,
    attemptId: attempt.attemptId,
    dataKind: attempt.dataKind ?? session.dataKind,
    condition: attempt.condition ?? session.condition,
    displayMode: attempt.displayMode ?? null,
    recallMode: attempt.recallMode ?? null,
    source: attempt.source ?? 'browser',
    rehearsalStatus: attempt.status,
    recallStatus: attempt.recallStatus ?? 'not_started',
    invalidated: attempt.invalidated,
    invalidationReason: attempt.invalidationReason,
    protocolDeviations: attempt.protocolDeviations ?? [],
    evaluation: attempt.evaluationSnapshot ?? session.evaluation ?? EMPTY_EVALUATION,
    preparedCueCount: (attempt.cueSnapshot ?? session.cues).filter((cue) => cue.approved).length,
    editedCueCount: (attempt.cueSnapshot ?? session.cues).filter((cue) =>
      ['edited', 'replaced-manually'].includes(cue.reviewOutcome),
    ).length,
    timing: {
      preparationStartedAt: (attempt.preparationSnapshot ?? session.timing).preparationStartedAt,
      preparationSeconds: (attempt.preparationSnapshot ?? session.timing).preparationSeconds,
      generationAndTransferSeconds:
        (attempt.preparationSnapshot ?? session.timing).generationAndTransferSeconds ?? null,
      setupGapSeconds: attempt.setupGapSeconds ?? null,
      rehearsalSeconds: attempt.rehearsalSeconds ?? null,
      distractorSeconds: attempt.distractorSeconds ?? null,
      recallSeconds: attempt.recallSeconds ?? null,
    },
    score: {
      term: summary.termScore,
      meaning: summary.meaningScore,
      meaningPending: summary.meaningPending,
      termPercent: percentOfSix(summary.termScore),
      meaningPercent: percentOfSix(summary.meaningScore),
    },
    facts: LOCI.map((locus, index) => {
      const fact = (attempt.factsSnapshot ?? session.facts)[index];
      const cue = (attempt.cueSnapshot ?? session.cues)[index];
      const answer = attempt.answers?.[index] ?? null;
      return {
        itemId: fact.itemId,
        locusId: locus.id,
        term: fact.term,
        meaning: fact.meaning,
        meaningRubric: fact.meaningRubric,
        rawTerm: answer?.term ?? null,
        rawMeaning: answer?.meaning ?? null,
        automaticTermMark: summary.termMarks?.[index].automatic ?? null,
        termOverride: attempt.termOverrides?.[index] ?? null,
        finalTermMark: summary.termMarks?.[index].final ?? null,
        meaningMark: attempt.meaningMarks?.[index] ?? null,
        cueReviewOutcome: cue.reviewOutcome,
        suggestionProvenance: cue.provenance,
      };
    }),
  };
}

export function serializeResultJson(session, attemptId) {
  return JSON.stringify(buildResultRecord(session, attemptId), null, 2);
}

export function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeResultCsv(session, attemptId) {
  const record = buildResultRecord(session, attemptId);
  const columns = [
    'participantId',
    'sessionId',
    'contentRevision',
    'sourcePreparationId',
    'attemptId',
    'dataKind',
    'condition',
    'displayMode',
    'recallMode',
    'source',
    'rehearsalStatus',
    'recallStatus',
    'invalidated',
    'preparedCueCount',
    'completedPreparationWithinCap',
    'effortRating',
    'meaningfulnessRating',
    'familiarity',
    'assistanceGiven',
    'feedback',
    'preparationCappedAt',
    'approvedAtCap',
    'editedCueCount',
    'preparationSeconds',
    'generationAndTransferSeconds',
    'setupGapSeconds',
    'rehearsalSeconds',
    'distractorSeconds',
    'recallSeconds',
    'termScore',
    'meaningScore',
    'meaningPending',
    'itemId',
    'locusId',
    'expectedTerm',
    'expectedMeaning',
    'rawTerm',
    'rawMeaning',
    'automaticTermMark',
    'termOverride',
    'termOverrideScorer',
    'finalTermMark',
    'meaningMark',
    'meaningScorer',
    'cueReviewOutcome',
    'protocolDeviations',
  ];
  const rows = record.facts.map((fact) => ({
    participantId: record.evaluation.participantId,
    sessionId: record.sessionId,
    contentRevision: record.contentRevision,
    sourcePreparationId: record.sourcePreparationId,
    attemptId: record.attemptId,
    dataKind: record.dataKind,
    condition: record.condition,
    displayMode: record.displayMode,
    recallMode: record.recallMode,
    source: record.source,
    rehearsalStatus: record.rehearsalStatus,
    recallStatus: record.recallStatus,
    invalidated: record.invalidated,
    preparedCueCount: record.preparedCueCount,
    completedPreparationWithinCap:
      record.evaluation.approvedAtCap !== null
        ? false
        : record.preparedCueCount === 6 && record.timing.preparationSeconds !== null
          ? record.timing.preparationSeconds <= record.evaluation.preparationCapSeconds
          : null,
    effortRating: record.evaluation.effortRating,
    meaningfulnessRating: record.evaluation.meaningfulnessRating,
    familiarity: record.evaluation.familiarity,
    assistanceGiven: record.evaluation.assistanceGiven,
    feedback: record.evaluation.feedback,
    preparationCappedAt: record.evaluation.preparationCappedAt,
    approvedAtCap: record.evaluation.approvedAtCap,
    editedCueCount: record.editedCueCount,
    ...record.timing,
    termScore: record.score.term,
    meaningScore: record.score.meaning,
    meaningPending: record.score.meaningPending,
    itemId: fact.itemId,
    locusId: fact.locusId,
    expectedTerm: fact.term,
    expectedMeaning: fact.meaning,
    rawTerm: fact.rawTerm,
    rawMeaning: fact.rawMeaning,
    automaticTermMark: fact.automaticTermMark,
    termOverride: fact.termOverride?.score ?? null,
    termOverrideScorer: fact.termOverride?.scorer ?? null,
    finalTermMark: fact.finalTermMark,
    meaningMark: fact.meaningMark?.score ?? null,
    meaningScorer: fact.meaningMark?.scorer ?? null,
    cueReviewOutcome: fact.cueReviewOutcome,
    protocolDeviations: record.protocolDeviations.join(' | '),
  }));
  return (
    [
      columns.map(csvCell).join(','),
      ...rows.map((row) => columns.map((name) => csvCell(row[name])).join(',')),
    ].join('\r\n') + '\r\n'
  );
}
