export const EMPTY_EVALUATION = Object.freeze({
  participantId: '',
  familiarity: '',
  effortRating: null,
  meaningfulnessRating: null,
  feedback: '',
  assistanceGiven: '',
  preparationCapSeconds: 360,
  preparationCappedAt: null,
  approvedAtCap: null,
});

export function validateEvaluation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return ['Evaluation fields are invalid.'];
  const errors = [];
  if (value.participantId !== '' && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(value.participantId))
    errors.push('Anonymous participant ID is invalid.');
  if (typeof value.familiarity !== 'string' || value.familiarity.length > 500)
    errors.push('Familiarity note is invalid.');
  for (const field of ['effortRating', 'meaningfulnessRating']) {
    if (
      value[field] !== null &&
      (!Number.isInteger(value[field]) || value[field] < 1 || value[field] > 7)
    )
      errors.push(`${field} must be 1–7 or unavailable.`);
  }
  for (const field of ['feedback', 'assistanceGiven'])
    if (typeof value[field] !== 'string' || value[field].length > 500)
      errors.push(`${field} is invalid.`);
  if (
    !Number.isFinite(value.preparationCapSeconds) ||
    value.preparationCapSeconds < 1 ||
    value.preparationCapSeconds > 3600
  )
    errors.push('Preparation cap is invalid.');
  if (
    value.preparationCappedAt !== null &&
    (typeof value.preparationCappedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.preparationCappedAt)))
  )
    errors.push('Preparation cap timestamp is invalid.');
  if (
    value.approvedAtCap !== null &&
    (!Number.isInteger(value.approvedAtCap) || value.approvedAtCap < 0 || value.approvedAtCap > 6)
  )
    errors.push('Approved count at cap is invalid.');
  return errors;
}

export function saveEvaluation(session, fields) {
  const proposed = { ...EMPTY_EVALUATION, ...session.evaluation, ...fields };
  const errors = validateEvaluation(proposed);
  if (errors.length) return { session, errors };
  return { session: { ...session, evaluation: proposed }, errors: [] };
}

export function markPreparationCap(session, now = new Date().toISOString()) {
  if (session.stage !== 'author' || !session.timing.preparationStartedAt)
    return { session, errors: ['Start cue preparation before marking the cap.'] };
  if (session.cues.every((cue) => cue.approved))
    return { session, errors: ['All six cues are already approved.'] };
  const next = structuredClone(session);
  next.evaluation ??= { ...EMPTY_EVALUATION };
  next.evaluation.preparationCappedAt = now;
  next.evaluation.approvedAtCap = next.cues.filter((cue) => cue.approved).length;
  return { session: next, errors: [] };
}
