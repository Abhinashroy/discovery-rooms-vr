import demo from './data/demo-facts.json' with { type: 'json' };
import { LOCI } from './data/loci.js';
import { EMPTY_CUE } from './data/props.js';
import { SCHEMA_VERSION, STAGES } from './data/schema.js';
import { validateFacts, validateCue } from './validation.js';
import { EMPTY_EVALUATION } from './evaluation.js';

export { SCHEMA_VERSION, STAGES };

export function newId(prefix = 'session') {
  const value =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

function emptyCues() {
  return LOCI.map((locus, index) => ({
    itemId: `f${index + 1}`,
    locusId: locus.id,
    suggestion: null,
    final: null,
    approved: false,
    provenance: null,
    reviewOutcome: null,
    replacementMode: false,
  }));
}

export function newReadyAttempt(session) {
  return {
    attemptId: newId('attempt'),
    sourcePreparationId: session.sourcePreparationId,
    contentRevision: session.contentRevision,
    status: 'ready',
    startedAt: null,
    completedAt: null,
    visitedLoci: [],
    rehearsalSeconds: null,
    invalidated: false,
    invalidationReason: null,
    source: 'browser',
    displayMode: null,
    recallMode: null,
    dataKind: session.dataKind,
    condition: session.condition,
    factsSnapshot: null,
    cueSnapshot: null,
    preparationSnapshot: null,
    evaluationSnapshot: null,
    setupGapSeconds: null,
    distractorStartedAt: null,
    distractorSeconds: null,
    recallStatus: 'not_started',
    recallStartedAt: null,
    recallSubmittedAt: null,
    recallSeconds: null,
    answers: null,
    termOverrides: null,
    meaningMarks: null,
    protocolDeviations: [],
  };
}

export function createDemoSession(sessionId = newId()) {
  const facts = demo.facts.map(
    ({ itemId, locusId, term, meaning, termAliases, meaningRubric }) => ({
      itemId,
      locusId,
      term,
      meaning,
      termAliases: [...termAliases],
      meaningRubric,
    }),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    contentRevision: 1,
    stage: 'familiarize',
    dataKind: 'fixture',
    condition: 'manual',
    sourcePreparationId: `prep-${sessionId}`,
    preparedImport: false,
    facts,
    cues: emptyCues(),
    attempts: [],
    evaluation: { ...EMPTY_EVALUATION },
    timing: {
      preparationStartedAt: null,
      preparationCompletedAt: null,
      preparationSeconds: null,
      promptExportedAt: null,
      generationAndTransferSeconds: null,
    },
  };
}

export function replaceFacts(session, inputFacts) {
  if (!Array.isArray(inputFacts))
    return { session, errors: ['Facts must be an array of exactly six pairs.'] };
  const proposed = inputFacts.map((fact, index) => {
    const prior = session.facts[index];
    const sameFact = fact?.term?.trim() === prior?.term && fact?.meaning?.trim() === prior?.meaning;
    return {
      itemId: `f${index + 1}`,
      locusId: LOCI[index]?.id ?? null,
      term: fact?.term,
      meaning: fact?.meaning,
      termAliases: fact?.termAliases ?? (sameFact ? [...prior.termAliases] : []),
      meaningRubric: fact?.meaningRubric ?? (sameFact ? prior.meaningRubric : ''),
    };
  });
  const errors = validateFacts(proposed);
  if (errors.length) return { session, errors };
  const changed = proposed.some(
    (fact, index) =>
      fact.term.trim() !== session.facts[index].term ||
      fact.meaning.trim() !== session.facts[index].meaning ||
      JSON.stringify(fact.termAliases) !== JSON.stringify(session.facts[index].termAliases) ||
      fact.meaningRubric.trim() !== session.facts[index].meaningRubric,
  );
  if (!changed) return { session, errors: [] };
  const next = structuredClone(session);
  next.facts = proposed.map((fact) => ({
    ...fact,
    term: fact.term.trim(),
    meaning: fact.meaning.trim(),
    termAliases: fact.termAliases.map((alias) => alias.trim()),
    meaningRubric: fact.meaningRubric.trim(),
  }));
  next.contentRevision += 1;
  next.sourcePreparationId = newId('prep');
  next.dataKind = 'practice';
  next.condition = 'manual';
  next.preparedImport = false;
  if (next.evaluation) {
    next.evaluation.preparationCappedAt = null;
    next.evaluation.approvedAtCap = null;
  }
  next.cues = emptyCues();
  next.attempts = next.attempts.map((attempt) => ({
    ...attempt,
    invalidated: true,
    invalidationReason: 'Facts changed after this attempt.',
  }));
  next.timing = {
    preparationStartedAt: null,
    preparationCompletedAt: null,
    preparationSeconds: null,
    promptExportedAt: null,
    generationAndTransferSeconds: null,
  };
  next.stage = 'familiarize';
  return { session: next, errors: [] };
}

export function beginAuthoring(session, now = new Date().toISOString()) {
  const next = structuredClone(session);
  next.stage = 'author';
  if (!next.timing.preparationStartedAt) next.timing.preparationStartedAt = now;
  return next;
}

export function recordPromptExport(session, now = new Date().toISOString()) {
  const next = structuredClone(session);
  next.timing.promptExportedAt = now;
  next.timing.generationAndTransferSeconds = null;
  return next;
}

export function applyAiSuggestions(session, cues, metadata, now = new Date().toISOString()) {
  const modelName =
    typeof metadata?.modelName === 'string' ? metadata.modelName.trim() || 'unknown' : 'unknown';
  const generatedAt =
    typeof metadata?.generatedAt === 'string'
      ? metadata.generatedAt.trim() || 'unknown'
      : 'unknown';
  const source = metadata?.source ?? 'external-gpt-import';
  const errors = [];
  if (!['external-gpt-import', 'illustrative-example'].includes(source))
    errors.push('Suggestion source is invalid.');
  if (typeof modelName !== 'string' || modelName.length > 120)
    errors.push('Model name must be at most 120 characters.');
  if (
    typeof generatedAt !== 'string' ||
    (generatedAt !== 'unknown' && !/^\d{4}-\d{2}-\d{2}$/.test(generatedAt))
  )
    errors.push('Generation date must be YYYY-MM-DD or unknown.');
  if (!Array.isArray(cues) || cues.length !== LOCI.length)
    errors.push('Exactly six validated suggestions are required.');
  else
    cues.forEach((cue, index) => {
      if (cue.itemId !== `f${index + 1}` || cue.locusId !== LOCI[index].id)
        errors.push(`Suggestion ${index + 1} has the wrong item/locus mapping.`);
      errors.push(...validateCue(cue).map((error) => `Suggestion ${index + 1}: ${error}`));
    });
  if (errors.length) return { session, errors };
  const next = structuredClone(session);
  const priorComplete = next.cues.every((cue) => cue.approved);
  next.sourcePreparationId = newId('prep');
  next.condition = 'ai-assisted';
  next.stage = 'author';
  const provenance = { source, modelName, generatedAt, importedAt: now, transfer: 'manual-json' };
  next.cues = cues.map(({ itemId, locusId, scene, meaningLink, propId, animationId, colorId }) => {
    const suggestion = { scene, meaningLink, propId, animationId, colorId };
    return {
      itemId,
      locusId,
      suggestion,
      final: { ...suggestion },
      approved: false,
      provenance: { ...provenance },
      reviewOutcome: null,
      replacementMode: false,
    };
  });
  if (priorComplete) next.timing.preparationStartedAt = next.timing.promptExportedAt ?? now;
  next.timing.preparationCompletedAt = null;
  next.timing.preparationSeconds = null;
  const exported = Date.parse(next.timing.promptExportedAt ?? '');
  next.timing.generationAndTransferSeconds =
    source === 'external-gpt-import' && Number.isFinite(exported)
      ? Math.max(0, Math.round((Date.parse(now) - exported) / 1000))
      : null;
  for (const attempt of next.attempts) {
    attempt.invalidated = true;
    attempt.invalidationReason = 'AI suggestions replaced the approved cue set.';
  }
  if (next.attempts.length) next.attempts.push(newReadyAttempt(next));
  return { session: next, errors: [] };
}

export function replaceSuggestionManually(session, index, now = new Date().toISOString()) {
  if (!Number.isInteger(index) || index < 0 || index >= LOCI.length)
    throw new RangeError('Invalid cue index.');
  if (!session.cues[index].suggestion) return session;
  const next = editCue(session, index, EMPTY_CUE, now);
  const result = next === session ? structuredClone(session) : next;
  result.cues[index].replacementMode = true;
  result.cues[index].approved = false;
  result.cues[index].reviewOutcome = null;
  return result;
}

export function editCue(session, index, patch, now = new Date().toISOString()) {
  if (!Number.isInteger(index) || index < 0 || index >= LOCI.length)
    throw new RangeError('Invalid cue index.');
  const allowed = ['scene', 'meaningLink', 'propId', 'animationId', 'colorId'];
  if (Object.keys(patch).some((key) => !allowed.includes(key)))
    throw new TypeError('Unknown cue field.');
  const oldEntry = session.cues[index];
  const current = oldEntry.final ?? EMPTY_CUE;
  const final = { ...current, ...patch };
  if (allowed.every((key) => final[key] === current[key]) && oldEntry.final) return session;
  const next = structuredClone(session);
  const wasApproved = next.cues[index].approved;
  const hadCompletePreparation = next.cues.every((cue) => cue.approved);
  next.cues[index].final = final;
  next.cues[index].approved = false;
  next.cues[index].reviewOutcome = null;
  if (wasApproved) {
    if (hadCompletePreparation) {
      next.sourcePreparationId = newId('prep');
      next.timing.preparationStartedAt = now;
    }
    next.timing.preparationCompletedAt = null;
    next.timing.preparationSeconds = null;
    const last = next.attempts.at(-1);
    if (
      last &&
      (last.status === 'in_progress' ||
        last.status === 'complete' ||
        last.status === 'interrupted' ||
        last.status === 'not_observed')
    ) {
      last.invalidated = true;
      last.invalidationReason = 'Approved cue revised after rehearsal began.';
      next.attempts.push(newReadyAttempt(next));
    }
  }
  next.stage = 'author';
  return next;
}

export function approveCue(session, index, now = new Date().toISOString()) {
  if (!Number.isInteger(index) || index < 0 || index >= LOCI.length)
    return { session, errors: ['Invalid cue index.'] };
  const errors = validateCue(session.cues[index].final);
  if (errors.length) return { session, errors };
  const next = structuredClone(session);
  next.cues[index].approved = true;
  const entry = next.cues[index];
  const fields = ['scene', 'meaningLink', 'propId', 'animationId', 'colorId'];
  entry.reviewOutcome = !entry.suggestion
    ? 'manual'
    : entry.replacementMode
      ? 'replaced-manually'
      : fields.every((field) => entry.final[field] === entry.suggestion[field])
        ? 'accepted-unchanged'
        : 'edited';
  if (next.cues.every((cue) => cue.approved)) {
    next.timing.preparationCompletedAt = now;
    const started = Date.parse(next.timing.preparationStartedAt ?? now);
    next.timing.preparationSeconds = Math.max(0, Math.round((Date.parse(now) - started) / 1000));
  }
  return { session: next, errors: [] };
}

export function allApproved(session) {
  return (
    session.cues.length === LOCI.length &&
    session.cues.every((cue) => cue.approved && validateCue(cue.final).length === 0)
  );
}

export function startStudy(session, now = new Date().toISOString(), displayMode = 'desktop') {
  if (!allApproved(session))
    return { session, errors: ['Approve all six valid cues before rehearsal.'] };
  if (!['desktop', 'vr'].includes(displayMode))
    return { session, errors: ['Display mode must be desktop or VR.'] };
  if (session.attempts.at(-1)?.status === 'in_progress')
    return { session, errors: ['A rehearsal is already in progress.'] };
  const next = structuredClone(session);
  let attempt = next.attempts.at(-1);
  if (!attempt || attempt.status !== 'ready') {
    attempt = newReadyAttempt(next);
    next.attempts.push(attempt);
  }
  attempt.status = 'in_progress';
  attempt.source = 'browser';
  attempt.displayMode = displayMode;
  attempt.recallMode = 'typed';
  attempt.dataKind = next.dataKind;
  attempt.condition = next.condition;
  attempt.factsSnapshot = structuredClone(next.facts);
  attempt.cueSnapshot = structuredClone(next.cues);
  attempt.preparationSnapshot = structuredClone(next.timing);
  attempt.evaluationSnapshot = structuredClone(next.evaluation ?? EMPTY_EVALUATION);
  attempt.startedAt = now;
  attempt.completedAt = null;
  attempt.visitedLoci = [LOCI[0].id];
  attempt.rehearsalSeconds = null;
  const preparedAt = Date.parse(next.timing.preparationCompletedAt ?? '');
  const earlierAttempt = next.attempts.some(
    (entry) =>
      entry !== attempt &&
      entry.sourcePreparationId === next.sourcePreparationId &&
      entry.status !== 'ready',
  );
  attempt.setupGapSeconds =
    !earlierAttempt && Number.isFinite(preparedAt)
      ? Math.max(0, Math.round((Date.parse(now) - preparedAt) / 1000))
      : null;
  next.stage = 'study';
  return { session: next, errors: [] };
}

export function visitStudyLocus(session, locusId) {
  if (session.stage !== 'study') return session;
  const last = session.attempts.at(-1);
  if (!last || last.status !== 'in_progress' || last.visitedLoci.includes(locusId)) return session;
  const next = structuredClone(session);
  next.attempts.at(-1).visitedLoci.push(locusId);
  return next;
}

export function interruptStudy(session) {
  const last = session.attempts.at(-1);
  if (session.stage !== 'study' || last?.status !== 'in_progress') return session;
  const next = structuredClone(session);
  next.attempts.at(-1).status = 'interrupted';
  return next;
}

export function completeStudy(session, now = new Date().toISOString()) {
  const last = session.attempts.at(-1);
  if (!last || last.status !== 'in_progress')
    return { session, errors: ['No rehearsal is in progress.'] };
  if (last.visitedLoci.length !== LOCI.length)
    return { session, errors: ['Visit all six landmarks before finishing rehearsal.'] };
  const next = structuredClone(session);
  const attempt = next.attempts.at(-1);
  attempt.status = 'complete';
  attempt.completedAt = now;
  attempt.rehearsalSeconds = Math.max(
    0,
    Math.round((Date.parse(now) - Date.parse(attempt.startedAt)) / 1000),
  );
  return { session: next, errors: [] };
}
