import { LOCI } from './data/loci.js';
import { PROP_IDS, ANIMATION_IDS, COLOR_IDS } from './data/props.js';
import { SCHEMA_VERSION, STAGES } from './data/schema.js';
import { validateEvaluation } from './evaluation.js';

const ITEM_IDS = LOCI.map((_, index) => `f${index + 1}`);

export function validateFacts(facts) {
  const errors = [];
  if (!Array.isArray(facts)) return ['Facts must be an array of exactly six term–meaning pairs.'];
  if (facts.length !== LOCI.length)
    errors.push(`Expected exactly six facts; received ${facts.length}.`);
  for (let index = 0; index < Math.min(facts.length, LOCI.length); index++) {
    const fact = facts[index];
    const label = `Fact ${index + 1}`;
    if (!fact || typeof fact !== 'object' || Array.isArray(fact)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (fact.itemId !== ITEM_IDS[index]) errors.push(`${label} itemId must be ${ITEM_IDS[index]}.`);
    if (fact.locusId !== LOCI[index].id) errors.push(`${label} locusId must be ${LOCI[index].id}.`);
    for (const [field, limit] of [
      ['term', 60],
      ['meaning', 180],
    ]) {
      const value = fact[field];
      if (typeof value !== 'string' || !value.trim()) errors.push(`${label} ${field} is required.`);
      else if (value.trim().length > limit)
        errors.push(`${label} ${field} exceeds ${limit} characters.`);
    }
    if (
      fact.termAliases !== undefined &&
      (!Array.isArray(fact.termAliases) ||
        fact.termAliases.length > 10 ||
        fact.termAliases.some(
          (alias) => typeof alias !== 'string' || !alias.trim() || alias.trim().length > 60,
        ))
    )
      errors.push(`${label} termAliases is invalid.`);
    if (
      fact.meaningRubric !== undefined &&
      (typeof fact.meaningRubric !== 'string' || fact.meaningRubric.length > 500)
    )
      errors.push(`${label} meaningRubric is invalid.`);
  }
  return errors;
}

export function validateCue(cue, { allowIncomplete = false } = {}) {
  const errors = [];
  if (cue === null || cue === undefined)
    return ['Scene sentence is required.', 'Meaning link is required.'];
  if (typeof cue !== 'object' || Array.isArray(cue)) return ['Cue must be an object.'];
  for (const [field, limit] of [
    ['scene', 180],
    ['meaningLink', 180],
  ]) {
    if (typeof cue[field] !== 'string') errors.push(`${field} must be text.`);
    else if (!allowIncomplete && !cue[field].trim()) errors.push(`${field} is required.`);
    else if (cue[field].trim().length > limit) errors.push(`${field} exceeds ${limit} characters.`);
  }
  for (const [field, values] of [
    ['propId', PROP_IDS],
    ['animationId', ANIMATION_IDS],
    ['colorId', COLOR_IDS],
  ]) {
    if (!values.includes(cue[field])) errors.push(`${field} must be one of: ${values.join(', ')}.`);
  }
  return errors;
}

export function validateSession(session, { prepared = false } = {}) {
  const errors = [];
  if (!session || typeof session !== 'object' || Array.isArray(session))
    return ['Session must be an object.'];
  if (session.schemaVersion !== SCHEMA_VERSION)
    errors.push(`Unsupported session schemaVersion ${String(session.schemaVersion)}.`);
  if (typeof session.sessionId !== 'string' || !session.sessionId || session.sessionId.length > 120)
    errors.push('sessionId is invalid.');
  if (!Number.isInteger(session.contentRevision) || session.contentRevision < 1)
    errors.push('contentRevision must be a positive integer.');
  if (!STAGES.includes(session.stage)) errors.push('stage is invalid.');
  if (!['fixture', 'practice', 'pilot'].includes(session.dataKind))
    errors.push('dataKind is invalid.');
  if (!['manual', 'ai-assisted'].includes(session.condition)) errors.push('condition is invalid.');
  if (
    typeof session.sourcePreparationId !== 'string' ||
    !session.sourcePreparationId ||
    session.sourcePreparationId.length > 120
  )
    errors.push('sourcePreparationId is invalid.');
  if (session.preparedImport !== undefined && typeof session.preparedImport !== 'boolean')
    errors.push('preparedImport is invalid.');
  if (session.evaluation !== undefined) errors.push(...validateEvaluation(session.evaluation));
  errors.push(...validateFacts(session.facts));
  if (!Array.isArray(session.cues) || session.cues.length !== LOCI.length) {
    errors.push(
      `Expected exactly six cues; received ${Array.isArray(session.cues) ? session.cues.length : 'invalid data'}.`,
    );
  } else {
    session.cues.forEach((entry, index) => {
      const label = `Cue ${index + 1}`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`${label} must be an object.`);
        return;
      }
      if (entry.itemId !== ITEM_IDS[index] || entry.locusId !== LOCI[index].id)
        errors.push(`${label} has the wrong item/locus mapping.`);
      if (typeof entry.approved !== 'boolean')
        errors.push(`${label} approved must be true or false.`);
      if (entry.suggestion !== null && entry.suggestion !== undefined) {
        errors.push(
          ...validateCue(entry.suggestion).map((error) => `${label} suggestion: ${error}`),
        );
        const provenance = entry.provenance;
        if (
          !provenance ||
          typeof provenance !== 'object' ||
          Array.isArray(provenance) ||
          !['external-gpt-import', 'illustrative-example'].includes(provenance.source) ||
          typeof provenance.modelName !== 'string' ||
          !provenance.modelName ||
          provenance.modelName.length > 120 ||
          typeof provenance.generatedAt !== 'string' ||
          (provenance.generatedAt !== 'unknown' &&
            !/^\d{4}-\d{2}-\d{2}$/.test(provenance.generatedAt)) ||
          typeof provenance.importedAt !== 'string' ||
          !Number.isFinite(Date.parse(provenance.importedAt)) ||
          provenance.transfer !== 'manual-json'
        )
          errors.push(`${label} provenance is invalid.`);
      } else if (entry.provenance !== null && entry.provenance !== undefined)
        errors.push(`${label} provenance requires a suggestion.`);
      if (entry.replacementMode !== undefined && typeof entry.replacementMode !== 'boolean')
        errors.push(`${label} replacementMode must be true or false.`);
      if (entry.replacementMode && !entry.suggestion)
        errors.push(`${label} replacementMode requires a suggestion.`);
      if (
        entry.reviewOutcome !== null &&
        entry.reviewOutcome !== undefined &&
        !['manual', 'accepted-unchanged', 'edited', 'replaced-manually'].includes(
          entry.reviewOutcome,
        )
      )
        errors.push(`${label} reviewOutcome is invalid.`);
      if (entry.approved && !entry.reviewOutcome)
        errors.push(`${label} approved cue needs a review outcome.`);
      if (entry.final === null) {
        if (entry.approved || prepared) errors.push(`${label} needs a final cue.`);
      } else {
        errors.push(
          ...validateCue(entry.final, { allowIncomplete: !entry.approved && !prepared }).map(
            (error) => `${label}: ${error}`,
          ),
        );
      }
      if (entry.approved && entry.final) {
        const fields = ['scene', 'meaningLink', 'propId', 'animationId', 'colorId'];
        const expectedOutcome = !entry.suggestion
          ? 'manual'
          : entry.replacementMode
            ? 'replaced-manually'
            : fields.every((field) => entry.final[field] === entry.suggestion[field])
              ? 'accepted-unchanged'
              : 'edited';
        if (entry.reviewOutcome !== expectedOutcome)
          errors.push(`${label} reviewOutcome must be ${expectedOutcome}.`);
      }
      if (prepared && !entry.approved) errors.push(`${label} is not approved.`);
    });
  }
  if (!Array.isArray(session.attempts) || session.attempts.length > 100)
    errors.push('attempts must be an array of at most 100 records.');
  else {
    const ids = new Set();
    session.attempts.forEach((attempt, index) => {
      const label = `Attempt ${index + 1}`;
      if (
        !attempt ||
        typeof attempt !== 'object' ||
        typeof attempt.attemptId !== 'string' ||
        !attempt.attemptId ||
        !['ready', 'in_progress', 'complete', 'interrupted', 'not_observed'].includes(
          attempt.status,
        ) ||
        !Array.isArray(attempt.visitedLoci)
      ) {
        errors.push(`${label} is invalid.`);
        return;
      }
      if (ids.has(attempt.attemptId))
        errors.push(`${label} duplicates attemptId ${attempt.attemptId}.`);
      ids.add(attempt.attemptId);
      if (
        attempt.source !== undefined &&
        !['browser', 'recall-only', 'external-observation'].includes(attempt.source)
      )
        errors.push(`${label} source is invalid.`);
      if (
        attempt.displayMode !== undefined &&
        attempt.displayMode !== null &&
        !['desktop', 'vr'].includes(attempt.displayMode)
      )
        errors.push(`${label} displayMode is invalid.`);
      if (
        attempt.recallMode !== undefined &&
        attempt.recallMode !== null &&
        !['typed', 'external'].includes(attempt.recallMode)
      )
        errors.push(`${label} recallMode is invalid.`);
      if (
        attempt.recallStatus !== undefined &&
        !['not_started', 'in_progress', 'submitted', 'skipped', 'interrupted'].includes(
          attempt.recallStatus,
        )
      )
        errors.push(`${label} recallStatus is invalid.`);
      for (const field of [
        'setupGapSeconds',
        'rehearsalSeconds',
        'distractorSeconds',
        'recallSeconds',
      ]) {
        const value = attempt[field];
        if (
          value !== undefined &&
          value !== null &&
          (!Number.isFinite(value) || value < 0 || value > 604800)
        )
          errors.push(`${label} ${field} is invalid.`);
      }
      for (const field of [
        'distractorStartedAt',
        'recallStartedAt',
        'recallSubmittedAt',
        'enteredAt',
      ]) {
        const value = attempt[field];
        if (
          value !== undefined &&
          value !== null &&
          (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
        )
          errors.push(`${label} ${field} is invalid.`);
      }
      if (
        attempt.protocolDeviations !== undefined &&
        (!Array.isArray(attempt.protocolDeviations) ||
          attempt.protocolDeviations.some((note) => typeof note !== 'string' || note.length > 500))
      )
        errors.push(`${label} protocolDeviations is invalid.`);
      if (
        attempt.dataKind !== undefined &&
        !['fixture', 'practice', 'pilot'].includes(attempt.dataKind)
      )
        errors.push(`${label} dataKind is invalid.`);
      if (attempt.condition !== undefined && !['manual', 'ai-assisted'].includes(attempt.condition))
        errors.push(`${label} condition is invalid.`);
      if (attempt.factsSnapshot !== undefined && attempt.factsSnapshot !== null) {
        errors.push(
          ...validateFacts(attempt.factsSnapshot).map(
            (error) => `${label} factsSnapshot: ${error}`,
          ),
        );
      }
      if (
        attempt.cueSnapshot !== undefined &&
        attempt.cueSnapshot !== null &&
        (!Array.isArray(attempt.cueSnapshot) ||
          attempt.cueSnapshot.length !== LOCI.length ||
          attempt.cueSnapshot.some(
            (cue, position) =>
              !cue || cue.itemId !== ITEM_IDS[position] || cue.locusId !== LOCI[position].id,
          ))
      ) {
        errors.push(`${label} cueSnapshot is invalid.`);
      }
      if (
        attempt.preparationSnapshot !== undefined &&
        attempt.preparationSnapshot !== null &&
        (!attempt.preparationSnapshot ||
          typeof attempt.preparationSnapshot !== 'object' ||
          (attempt.preparationSnapshot.preparationSeconds !== null &&
            (!Number.isFinite(attempt.preparationSnapshot.preparationSeconds) ||
              attempt.preparationSnapshot.preparationSeconds < 0)))
      ) {
        errors.push(`${label} preparationSnapshot is invalid.`);
      }
      if (attempt.evaluationSnapshot !== undefined && attempt.evaluationSnapshot !== null)
        errors.push(
          ...validateEvaluation(attempt.evaluationSnapshot).map((error) => `${label} ${error}`),
        );
      if (attempt.answers !== undefined && attempt.answers !== null) {
        if (!Array.isArray(attempt.answers) || attempt.answers.length !== LOCI.length)
          errors.push(`${label} needs six answers.`);
        else
          attempt.answers.forEach((answer, position) => {
            if (
              !answer ||
              answer.itemId !== ITEM_IDS[position] ||
              answer.locusId !== LOCI[position].id ||
              typeof answer.term !== 'string' ||
              answer.term.length > 500 ||
              typeof answer.meaning !== 'string' ||
              answer.meaning.length > 500
            )
              errors.push(`${label} answer ${position + 1} is invalid.`);
          });
      }
      if (
        attempt.recallStatus === 'submitted' &&
        (!Array.isArray(attempt.answers) || attempt.answers.length !== LOCI.length)
      )
        errors.push(`${label} submitted recall needs six answers.`);
      if (attempt.recallStatus === 'skipped' && attempt.answers !== null)
        errors.push(`${label} skipped recall must have null answers.`);
      for (const [field, allowedScorers] of [
        ['termOverrides', ['self', 'facilitator']],
        ['meaningMarks', ['self', 'facilitator', 'blank-rule']],
      ]) {
        const marks = attempt[field];
        if (marks === undefined || marks === null) continue;
        if (!Array.isArray(marks) || marks.length !== LOCI.length)
          errors.push(`${label} ${field} needs six positions.`);
        else
          marks.forEach((mark, position) => {
            if (
              mark !== null &&
              (!mark || ![0, 1].includes(mark.score) || !allowedScorers.includes(mark.scorer))
            )
              errors.push(`${label} ${field}[${position}] is invalid.`);
            if (
              mark?.scorer === 'blank-rule' &&
              (mark.score !== 0 || attempt.answers?.[position]?.meaning?.trim())
            )
              errors.push(`${label} blank-rule mark is invalid.`);
          });
      }
      if (
        attempt.recallStatus === 'submitted' &&
        (!Array.isArray(attempt.meaningMarks) || attempt.meaningMarks.length !== LOCI.length)
      )
        errors.push(`${label} submitted recall needs six meaning mark slots.`);
    });
  }
  if (!session.timing || typeof session.timing !== 'object' || Array.isArray(session.timing))
    errors.push('timing is invalid.');
  else if (
    !['preparationStartedAt', 'preparationCompletedAt'].every(
      (key) => session.timing[key] === null || typeof session.timing[key] === 'string',
    ) ||
    (session.timing.preparationSeconds !== null &&
      (typeof session.timing.preparationSeconds !== 'number' ||
        session.timing.preparationSeconds < 0)) ||
    (session.timing.promptExportedAt !== undefined &&
      session.timing.promptExportedAt !== null &&
      typeof session.timing.promptExportedAt !== 'string') ||
    (session.timing.generationAndTransferSeconds !== undefined &&
      session.timing.generationAndTransferSeconds !== null &&
      (typeof session.timing.generationAndTransferSeconds !== 'number' ||
        session.timing.generationAndTransferSeconds < 0))
  )
    errors.push('timing fields are invalid.');
  return errors;
}
