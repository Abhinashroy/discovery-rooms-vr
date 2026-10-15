import { LOCI } from '../data/loci.js';

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en') : '';
}

export function scoreTerm(answer, fact) {
  const value = normalized(answer);
  if (!value) return 0;
  return [fact.term, ...(fact.termAliases ?? [])].some((term) => normalized(term) === value)
    ? 1
    : 0;
}

export function scoreSummary(session, attempt) {
  if (
    !attempt ||
    attempt.recallStatus !== 'submitted' ||
    !Array.isArray(attempt.answers) ||
    attempt.answers.length !== LOCI.length
  ) {
    return { termScore: null, meaningScore: null, meaningPending: null, termMarks: null };
  }
  const termMarks = (attempt.factsSnapshot ?? session.facts).map((fact, index) => {
    const automatic = scoreTerm(attempt.answers[index].term, fact);
    const override = attempt.termOverrides?.[index] ?? null;
    return { automatic, final: override?.score ?? automatic, override };
  });
  const meaningPending = (attempt.meaningMarks ?? []).filter((mark) => mark === null).length;
  const meaningScore =
    meaningPending === 0 && attempt.meaningMarks?.length === LOCI.length
      ? attempt.meaningMarks.reduce((sum, mark) => sum + mark.score, 0)
      : null;
  return {
    termScore: termMarks.reduce((sum, mark) => sum + mark.final, 0),
    meaningScore,
    meaningPending,
    termMarks,
  };
}

export function percentOfSix(score) {
  return score === null ? null : (100 * score) / LOCI.length;
}
