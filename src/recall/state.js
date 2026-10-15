import { LOCI } from '../data/loci.js';
import { allApproved, newReadyAttempt } from '../state.js';
import { EMPTY_EVALUATION } from '../evaluation.js';

const nowIso = () => new Date().toISOString();
const secondsBetween = (start, end) => {
  const from = Date.parse(start ?? '');
  const to = Date.parse(end ?? '');
  return Number.isFinite(from) && Number.isFinite(to)
    ? Math.max(0, Math.round((to - from) / 1000))
    : null;
};
const blankAnswers = () =>
  LOCI.map((locus, index) => ({
    itemId: `f${index + 1}`,
    locusId: locus.id,
    term: '',
    meaning: '',
  }));

function fillRecallFields(attempt) {
  attempt.source ??= 'browser';
  attempt.displayMode ??= 'desktop';
  attempt.recallMode ??= 'typed';
  attempt.setupGapSeconds ??= null;
  attempt.distractorStartedAt ??= null;
  attempt.distractorSeconds ??= null;
  attempt.recallStatus ??= 'not_started';
  attempt.recallStartedAt ??= null;
  attempt.recallSubmittedAt ??= null;
  attempt.recallSeconds ??= null;
  attempt.answers ??= null;
  attempt.termOverrides ??= null;
  attempt.meaningMarks ??= null;
  attempt.protocolDeviations ??= [];
}

export function beginDistractor(session, now = nowIso()) {
  const attempt = session.attempts.at(-1);
  if (
    session.stage !== 'study' ||
    attempt?.status !== 'complete' ||
    (attempt.recallStatus && attempt.recallStatus !== 'not_started')
  ) {
    return { session, errors: ['Finish a rehearsal before starting the distractor.'] };
  }
  const next = structuredClone(session);
  const current = next.attempts.at(-1);
  fillRecallFields(current);
  current.distractorStartedAt = now;
  next.stage = 'distractor';
  return { session: next, errors: [] };
}

export function beginRecallOnly(session, displayMode = 'desktop') {
  if (session.preparedImport !== true || !allApproved(session)) {
    return { session, errors: ['Import an approved prepared session before recall-only handoff.'] };
  }
  if (!['desktop', 'vr'].includes(displayMode))
    return { session, errors: ['Select the earlier rehearsal display mode.'] };
  const next = structuredClone(session);
  let attempt = next.attempts.at(-1);
  if (!attempt || attempt.status !== 'ready') {
    if (next.attempts.length >= 100)
      return { session, errors: ['This session has reached the 100-attempt limit.'] };
    attempt = newReadyAttempt(next);
    next.attempts.push(attempt);
  }
  fillRecallFields(attempt);
  attempt.source = 'recall-only';
  attempt.status = 'not_observed';
  attempt.displayMode = displayMode;
  attempt.recallMode = 'typed';
  attempt.dataKind = next.dataKind;
  attempt.condition = next.condition;
  attempt.factsSnapshot = structuredClone(next.facts);
  attempt.cueSnapshot = structuredClone(next.cues);
  attempt.preparationSnapshot = structuredClone(next.timing);
  attempt.evaluationSnapshot = structuredClone(next.evaluation ?? EMPTY_EVALUATION);
  attempt.distractorStartedAt = null;
  next.stage = 'distractor';
  return { session: next, errors: [] };
}

export function beginRecall(session, now = nowIso()) {
  const attempt = session.attempts.at(-1);
  if (
    session.stage !== 'distractor' ||
    !attempt ||
    !['complete', 'not_observed'].includes(attempt.status) ||
    !['not_started', undefined].includes(attempt.recallStatus)
  ) {
    return { session, errors: ['A completed rehearsal or recall-only handoff is required.'] };
  }
  const next = structuredClone(session);
  const current = next.attempts.at(-1);
  fillRecallFields(current);
  current.distractorSeconds = secondsBetween(current.distractorStartedAt, now);
  current.recallStatus = 'in_progress';
  current.recallStartedAt = now;
  current.recallSubmittedAt = null;
  current.recallSeconds = null;
  current.answers = blankAnswers();
  current.termOverrides = Array(LOCI.length).fill(null);
  current.meaningMarks = Array(LOCI.length).fill(null);
  next.stage = 'recall';
  return { session: next, errors: [] };
}

export function editRecallAnswer(session, index, patch) {
  const attempt = session.attempts.at(-1);
  if (session.stage !== 'recall' || attempt?.recallStatus !== 'in_progress')
    return { session, errors: ['Recall is not in progress.'] };
  if (!Number.isInteger(index) || index < 0 || index >= LOCI.length)
    return { session, errors: ['Invalid recall position.'] };
  if (
    !patch ||
    Object.keys(patch).some((key) => !['term', 'meaning'].includes(key)) ||
    Object.values(patch).some((value) => typeof value !== 'string' || value.length > 500)
  ) {
    return { session, errors: ['Answers must be text of at most 500 characters.'] };
  }
  const old = attempt.answers[index];
  if (Object.keys(patch).every((key) => patch[key] === old[key])) return { session, errors: [] };
  const next = structuredClone(session);
  Object.assign(next.attempts.at(-1).answers[index], patch);
  return { session: next, errors: [] };
}

export function submitRecall(session, now = nowIso()) {
  const attempt = session.attempts.at(-1);
  if (
    session.stage !== 'recall' ||
    attempt?.recallStatus !== 'in_progress' ||
    !Array.isArray(attempt.answers) ||
    attempt.answers.length !== LOCI.length
  ) {
    return { session, errors: ['A six-position recall attempt is required.'] };
  }
  const next = structuredClone(session);
  const current = next.attempts.at(-1);
  current.recallStatus = 'submitted';
  current.recallSubmittedAt = now;
  current.recallSeconds = secondsBetween(current.recallStartedAt, now);
  current.meaningMarks = current.answers.map((answer) =>
    answer.meaning.trim() ? null : { score: 0, scorer: 'blank-rule' },
  );
  next.stage = 'results';
  return { session: next, errors: [] };
}

export function skipRecall(session, now = nowIso()) {
  const attempt = session.attempts.at(-1);
  if (session.stage !== 'distractor' || !attempt)
    return { session, errors: ['No recall test is ready to skip.'] };
  const next = structuredClone(session);
  const current = next.attempts.at(-1);
  fillRecallFields(current);
  current.distractorSeconds = secondsBetween(current.distractorStartedAt, now);
  current.recallStatus = 'skipped';
  current.answers = null;
  current.meaningMarks = null;
  current.termOverrides = null;
  next.stage = 'results';
  return { session: next, errors: [] };
}

export function markResult(
  session,
  index,
  kind,
  score,
  scorer,
  attemptId = session.attempts.at(-1)?.attemptId,
) {
  const attemptIndex = session.attempts.findIndex((entry) => entry.attemptId === attemptId);
  const attempt = session.attempts[attemptIndex];
  if (session.stage !== 'results' || attempt?.recallStatus !== 'submitted')
    return { session, errors: ['Submit recall before marking results.'] };
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= LOCI.length ||
    !['term', 'meaning'].includes(kind) ||
    ![null, 0, 1].includes(score) ||
    !['self', 'facilitator'].includes(scorer)
  ) {
    return { session, errors: ['Invalid mark, position, or scorer.'] };
  }
  const answer = attempt.answers[index][kind];
  if (!answer.trim() && score === 1)
    return { session, errors: ['A blank answer must score zero.'] };
  if (kind === 'meaning' && !answer.trim() && score === null)
    return { session, errors: ['A blank meaning answer scores zero.'] };
  const next = structuredClone(session);
  const current = next.attempts[attemptIndex];
  const mark = score === null ? null : { score, scorer };
  if (kind === 'term') current.termOverrides[index] = mark;
  else current.meaningMarks[index] = !answer.trim() ? { score: 0, scorer: 'blank-rule' } : mark;
  return { session: next, errors: [] };
}

export function exitHiddenPhase(session, reason = 'Recall exited before submission.') {
  if (!['distractor', 'recall'].includes(session.stage)) return session;
  const next = structuredClone(session);
  const attempt = next.attempts.at(-1);
  fillRecallFields(attempt);
  attempt.recallStatus = 'interrupted';
  attempt.invalidated = true;
  attempt.invalidationReason = reason;
  attempt.protocolDeviations.push(reason);
  next.stage = 'familiarize';
  return next;
}

export function recordExternalObservation(session, form, now = nowIso()) {
  const errors = [];
  if (session.preparedImport !== true || !allApproved(session))
    errors.push('An approved prepared-session import is required.');
  const attemptId = typeof form?.attemptId === 'string' ? form.attemptId.trim() : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(attemptId))
    errors.push('Anonymous attempt ID must use 1–120 letters, digits, underscores, or hyphens.');
  if (session.attempts.some((attempt) => attempt.attemptId === attemptId))
    errors.push('This attempt ID is already recorded.');
  if (!['desktop', 'vr'].includes(form?.displayMode)) errors.push('Display mode is required.');
  if (!['self', 'facilitator'].includes(form?.scorer)) errors.push('Scorer is required.');
  if (!Array.isArray(form?.answers) || form.answers.length !== LOCI.length)
    errors.push('Exactly six raw answer pairs are required.');
  else
    form.answers.forEach((answer, index) => {
      if (
        !answer ||
        typeof answer.term !== 'string' ||
        typeof answer.meaning !== 'string' ||
        answer.term.length > 500 ||
        answer.meaning.length > 500
      )
        errors.push(`Answer ${index + 1} must contain term and meaning text up to 500 characters.`);
    });
  if (
    !Array.isArray(form?.meaningScores) ||
    form.meaningScores.length !== LOCI.length ||
    form.meaningScores.some((score) => ![null, 0, 1].includes(score))
  )
    errors.push('Six meaning marks must be 0, 1, or pending.');
  else if (Array.isArray(form?.answers) && form.answers.length === LOCI.length) {
    form.answers.forEach((answer, index) => {
      if (
        typeof answer?.meaning === 'string' &&
        !answer.meaning.trim() &&
        form.meaningScores[index] === 1
      ) {
        errors.push(`Blank meaning answer ${index + 1} must score zero.`);
      }
    });
  }
  for (const field of [
    'setupGapSeconds',
    'rehearsalSeconds',
    'distractorSeconds',
    'recallSeconds',
  ]) {
    const value = form?.[field];
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 604800))
      errors.push(`${field} must be a nonnegative duration or unavailable.`);
  }
  if (typeof form?.deviation !== 'string' || form.deviation.length > 500)
    errors.push('Protocol note must be text of at most 500 characters.');
  if (errors.length) return { session, errors };
  const next = structuredClone(session);
  let attempt = next.attempts.at(-1);
  if (!attempt || attempt.status !== 'ready') {
    if (next.attempts.length >= 100)
      return { session, errors: ['This session has reached the 100-attempt limit.'] };
    attempt = newReadyAttempt(next);
    next.attempts.push(attempt);
  }
  attempt.attemptId = attemptId;
  attempt.source = 'external-observation';
  attempt.status = 'not_observed';
  attempt.displayMode = form.displayMode;
  attempt.recallMode = 'external';
  attempt.dataKind = next.dataKind;
  attempt.condition = next.condition;
  attempt.factsSnapshot = structuredClone(next.facts);
  attempt.cueSnapshot = structuredClone(next.cues);
  attempt.preparationSnapshot = structuredClone(next.timing);
  attempt.evaluationSnapshot = structuredClone(next.evaluation ?? EMPTY_EVALUATION);
  attempt.startedAt = null;
  attempt.completedAt = null;
  attempt.visitedLoci = [];
  attempt.setupGapSeconds = form.setupGapSeconds;
  attempt.rehearsalSeconds = form.rehearsalSeconds;
  attempt.distractorStartedAt = null;
  attempt.distractorSeconds = form.distractorSeconds;
  attempt.recallStatus = 'submitted';
  attempt.recallStartedAt = null;
  attempt.recallSubmittedAt = null;
  attempt.recallSeconds = form.recallSeconds;
  attempt.answers = form.answers.map((answer, index) => ({
    itemId: `f${index + 1}`,
    locusId: LOCI[index].id,
    term: answer.term,
    meaning: answer.meaning,
  }));
  attempt.termOverrides = Array(LOCI.length).fill(null);
  attempt.meaningMarks = form.meaningScores.map((score, index) =>
    !form.answers[index].meaning.trim()
      ? { score: 0, scorer: 'blank-rule' }
      : score === null
        ? null
        : { score, scorer: form.scorer },
  );
  attempt.protocolDeviations = form.deviation.trim() ? [form.deviation.trim()] : [];
  attempt.enteredAt = now;
  next.stage = 'results';
  return { session: next, errors: [] };
}
