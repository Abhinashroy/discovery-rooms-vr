import { buildResultRecord } from './results/export.js';
import { validateSession } from './validation.js';
import { EMPTY_EVALUATION } from './evaluation.js';

const MODES = ['desktop', 'vr'];
const CONDITIONS = ['manual', 'ai-assisted'];
const numeric = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function recordsFromExport(value) {
  if (value?.format === 'ai-mol-vr-prepared-session')
    throw new Error(
      'Prepared-session files contain no observed outcome; provide working backups or result JSON.',
    );
  if (value?.format === 'ai-mol-vr-working-session') {
    const session = value.session;
    const errors = validateSession(session);
    if (errors.length) throw new Error(`Invalid working session: ${errors.join(' ')}`);
    if (session.attempts.length)
      return session.attempts.map((attempt) => buildResultRecord(session, attempt.attemptId));
    return [
      {
        sessionId: session.sessionId,
        sourcePreparationId: session.sourcePreparationId,
        attemptId: null,
        dataKind: session.dataKind,
        condition: session.condition,
        displayMode: null,
        recallMode: null,
        recallStatus: 'not_started',
        invalidated: false,
        evaluation: session.evaluation ?? EMPTY_EVALUATION,
        preparedCueCount: session.cues.filter((cue) => cue.approved).length,
        editedCueCount: session.cues.filter((cue) =>
          ['edited', 'replaced-manually'].includes(cue.reviewOutcome),
        ).length,
        timing: {
          ...session.timing,
          setupGapSeconds: null,
          rehearsalSeconds: null,
          distractorSeconds: null,
          recallSeconds: null,
        },
        score: { term: null, meaning: null },
      },
    ];
  }
  if (
    value?.schemaVersion !== 1 ||
    !value.sessionId ||
    !value.attemptId ||
    !['fixture', 'practice', 'pilot'].includes(value.dataKind) ||
    !CONDITIONS.includes(value.condition) ||
    !MODES.includes(value.displayMode) ||
    !value.timing ||
    !value.score ||
    !Array.isArray(value.facts) ||
    value.facts.length !== 6
  ) {
    throw new Error('Expected a valid per-attempt result JSON or working session export.');
  }
  for (const field of ['term', 'meaning'])
    if (
      value.score[field] !== null &&
      (!Number.isInteger(value.score[field]) || value.score[field] < 0 || value.score[field] > 6)
    )
      throw new Error(`Invalid ${field} score.`);
  return [value];
}

function observation(record) {
  const evaluation = { ...EMPTY_EVALUATION, ...record.evaluation };
  const capHit = evaluation.preparationCappedAt !== null;
  const prepared = record.preparedCueCount === 6;
  const preparationSeconds = capHit
    ? record.timing?.preparationStartedAt
      ? Math.max(
          0,
          Math.round(
            (Date.parse(evaluation.preparationCappedAt) -
              Date.parse(record.timing.preparationStartedAt)) /
              1000,
          ),
        )
      : null
    : numeric(record.timing?.preparationSeconds);
  const completedWithinCap = capHit
    ? false
    : prepared && preparationSeconds !== null
      ? preparationSeconds <= evaluation.preparationCapSeconds
      : null;
  return {
    participantId: evaluation.participantId || null,
    sessionId: record.sessionId,
    sourcePreparationId: record.sourcePreparationId,
    attemptId: record.attemptId,
    dataKind: record.dataKind,
    condition: record.condition,
    displayMode: record.displayMode ?? null,
    recallMode: record.recallMode ?? null,
    preparedCueCount: capHit ? evaluation.approvedAtCap : record.preparedCueCount,
    completedWithinCap,
    preparationSeconds,
    generationAndTransferSeconds: numeric(record.timing?.generationAndTransferSeconds),
    setupGapSeconds: numeric(record.timing?.setupGapSeconds),
    rehearsalSeconds: numeric(record.timing?.rehearsalSeconds),
    distractorSeconds: numeric(record.timing?.distractorSeconds),
    recallSeconds: numeric(record.timing?.recallSeconds),
    termCorrect: record.recallStatus === 'submitted' ? numeric(record.score?.term) : null,
    meaningCorrect: record.recallStatus === 'submitted' ? numeric(record.score?.meaning) : null,
    effortRating: evaluation.effortRating,
    meaningfulnessRating: evaluation.meaningfulnessRating,
    editedCueCount:
      record.editedCueCount ??
      (record.facts ?? []).filter((fact) =>
        ['edited', 'replaced-manually'].includes(fact.cueReviewOutcome),
      ).length,
    assistanceGiven: evaluation.assistanceGiven,
    familiarity: evaluation.familiarity,
    invalidated: Boolean(record.invalidated),
    recallStatus: record.recallStatus,
  };
}

function distribution(values) {
  const sorted = values
    .filter((value) => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const center = Math.floor(sorted.length / 2);
  return {
    n: sorted.length,
    median: sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
  };
}

function groupSummary(rows) {
  const complete = rows.filter((row) => row.completedWithinCap === true);
  const recall = complete.filter((row) => row.recallStatus === 'submitted' && !row.invalidated);
  return {
    attempts: rows.length,
    participants: new Set(rows.map((row) => row.participantId || row.sessionId)).size,
    completedWithinCap: complete.length,
    incompleteAtCap: rows.filter((row) => row.completedWithinCap === false).length,
    completionUnknown: rows.filter((row) => row.completedWithinCap === null).length,
    recallEligible: complete.length,
    recallSubmitted: recall.length,
    missing: Object.fromEntries(
      [
        'participantId',
        'displayMode',
        'recallMode',
        'preparationSeconds',
        'termCorrect',
        'meaningCorrect',
        'effortRating',
        'meaningfulnessRating',
      ].map((field) => [
        field,
        rows.filter((row) => row[field] === null || row[field] === '').length,
      ]),
    ),
    preparationAmongCompleters: distribution(complete.map((row) => row.preparationSeconds)),
    approvedAtCapAmongIncomplete: distribution(
      rows.filter((row) => row.completedWithinCap === false).map((row) => row.preparedCueCount),
    ),
    effort: distribution(rows.map((row) => row.effortRating)),
    termAmongSubmittedCompleters: distribution(recall.map((row) => row.termCorrect)),
    meaningAmongSubmittedCompleters: distribution(recall.map((row) => row.meaningCorrect)),
    editedCueCountAmongCompleters: distribution(complete.map((row) => row.editedCueCount)),
  };
}

export function analyzeExports(exports) {
  const raw = exports.flatMap(recordsFromExport);
  const ids = new Set();
  for (const record of raw) {
    const key = `${record.sessionId}:${record.attemptId ?? 'preparation-only'}`;
    if (ids.has(key))
      throw new Error(
        `Duplicate exported record ${key}; remove one copy to avoid double counting.`,
      );
    ids.add(key);
  }
  const rows = raw.map(observation);
  const groups = {};
  for (const row of rows) {
    const key = `${row.dataKind} | ${row.condition} | ${row.displayMode ?? 'mode unavailable'} | ${row.recallMode ?? 'recall unavailable'}`;
    (groups[key] ??= []).push(row);
  }
  return {
    message: rows.length
      ? 'Descriptive prototype observations only; no causal or long-term memory claim.'
      : 'No participant data collected.',
    total: groupSummary(rows),
    groups: Object.fromEntries(
      Object.entries(groups).map(([key, values]) => [key, groupSummary(values)]),
    ),
    rows,
  };
}

export function formatAnalysis(report) {
  if (!report.rows.length) return 'No participant data collected.\n';
  const stat = (value) =>
    value ? `${value.median} (range ${value.min}–${value.max}; n=${value.n})` : 'unavailable';
  const lines = [
    '# Descriptive pilot analysis',
    '',
    report.message,
    '',
    `Records: ${report.total.attempts}; distinct anonymous participant/session keys: ${report.total.participants}.`,
    `Completed preparation within cap: ${report.total.completedWithinCap}; incomplete at cap: ${report.total.incompleteAtCap}; unknown: ${report.total.completionUnknown}.`,
    'Recall scores below include only preparation completers with submitted, non-invalidated recall. They are a selected subset.',
    `Preparation seconds among completers: ${stat(report.total.preparationAmongCompleters)}.`,
    `Approved cues among incomplete-at-cap records: ${stat(report.total.approvedAtCapAmongIncomplete)}.`,
    `Effort rating: ${stat(report.total.effort)}.`,
    `Term /6: ${stat(report.total.termAmongSubmittedCompleters)}. Meaning /6: ${stat(report.total.meaningAmongSubmittedCompleters)}.`,
    '',
    '## Missing values',
    '',
  ];
  for (const [field, count] of Object.entries(report.total.missing))
    lines.push(`- ${field}: ${count}/${report.total.attempts}`);
  lines.push('', '## Condition and mode groups', '');
  for (const [key, group] of Object.entries(report.groups))
    lines.push(
      `- ${key}: ${group.attempts} record(s), ${group.completedWithinCap} preparation completer(s), ${group.recallSubmitted} submitted recall(s); term ${stat(group.termAmongSubmittedCompleters)}, meaning ${stat(group.meaningAmongSubmittedCompleters)}.`,
    );
  lines.push(
    '',
    'These summaries are descriptive. Do not pool desktop and VR or typed and externally recorded recall as equivalent. Generation-and-transfer time is inside preparation time and must not be added to it.',
  );
  return `${lines.join('\n')}\n`;
}
