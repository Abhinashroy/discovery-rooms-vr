import { IDS, BY_ID } from './content.js';
import { questions } from './quiz.js';
export function newSession(seed = Date.now()) {
  return {
    seed,
    phase: 'explore',
    focus: null,
    inspection: null,
    assignments: {},
    namingReview: [],
    queue: [],
    question: 0,
    choice: null,
    answers: [],
    feedback: 'Explore the eight planets, then start the naming challenge.',
  };
}
export const activeQuestion = (s) => s.queue[s.question];
export const availableNames = (s) =>
  IDS.filter(
    (id) =>
      !Object.entries(s.assignments).some(([planet, name]) => planet !== s.focus && name === id),
  );
export const hiddenName = (s) => s.phase === 'naming' || s.phase === 'quiz';
export const namingScore = (s) => s.namingReview.filter((r) => r.correct).length;
export const quizScore = (s) => s.answers.filter((r) => r.correct).length;
// Completion is a transition, so re-rendering or repeated clicks cannot celebrate twice.
export const shouldCelebrate = (before, after) =>
  (before.phase === 'naming' && after.phase === 'naming-review' && namingScore(after) === 8) ||
  (before.phase === 'quiz' && after.phase === 'result');
export function reduceSession(s, a) {
  const known = (id) => Object.hasOwn(BY_ID, id);
  if (a.type === 'restart') return newSession(a.seed ?? s.seed + 1);
  if (a.type === 'ready' && s.phase === 'explore')
    return {
      ...s,
      phase: 'naming',
      focus: null,
      inspection: null,
      feedback: 'Select a planet first, then give it a name. Check all eight before Submit.',
    };
  if (a.type === 'close-inspect') return { ...s, inspection: null };
  if (a.type === 'dismiss-detail') return { ...s, focus: null, inspection: null };
  if (a.type === 'inspect' && s.phase === 'explore' && known(s.focus))
    return { ...s, inspection: s.focus };
  if (a.type === 'planet' && known(a.id) && ['explore', 'naming'].includes(s.phase))
    return {
      ...s,
      focus: a.id,
      inspection: s.phase === 'explore' && s.inspection ? a.id : null,
      feedback:
        s.phase === 'explore'
          ? BY_ID[a.id].name + ' · ' + BY_ID[a.id].cue
          : 'Choose a name for Exhibit ' + BY_ID[a.id].order + '. You can edit it before Submit.',
    };
  if (
    a.type === 'card' &&
    s.phase === 'naming' &&
    known(s.focus) &&
    availableNames(s).includes(a.id)
  )
    return {
      ...s,
      assignments: { ...s.assignments, [s.focus]: a.id },
      feedback:
        'Name assigned. ' +
        (Object.keys(s.assignments).length + (s.assignments[s.focus] ? 0 : 1)) +
        ' / 8 named. Select another planet or edit this one.',
    };
  if (a.type === 'unassign' && s.phase === 'naming' && s.assignments[s.focus]) {
    const assignments = { ...s.assignments };
    delete assignments[s.focus];
    return { ...s, assignments, feedback: 'Name returned to the list. Choose again when ready.' };
  }
  if (
    a.type === 'submit-names' &&
    s.phase === 'naming' &&
    IDS.every((id) => known(s.assignments[id])) &&
    new Set(Object.values(s.assignments)).size === 8
  )
    return {
      ...s,
      phase: 'naming-review',
      focus: null,
      namingReview: IDS.map((id) => ({
        id,
        assigned: s.assignments[id],
        correct: s.assignments[id] === id,
      })),
      feedback: 'Names submitted. Review your results, then start the quiz.',
    };
  if (a.type === 'quiz-start' && s.phase === 'naming-review')
    return {
      ...s,
      phase: 'quiz',
      focus: null,
      queue: questions(s.seed),
      question: 0,
      choice: null,
      answers: [],
      feedback: 'Five questions. Choose one answer and confirm it. Results appear at the end.',
    };
  const q = activeQuestion(s),
    answered = s.answers.length > s.question;
  if (
    a.type === 'answer' &&
    s.phase === 'quiz' &&
    !answered &&
    a.question === q?.id &&
    q.choices.includes(a.id)
  )
    return { ...s, choice: a.id };
  if (
    a.type === 'confirm-answer' &&
    s.phase === 'quiz' &&
    !answered &&
    a.question === q?.id &&
    q.choices.includes(s.choice)
  )
    return {
      ...s,
      answers: [...s.answers, { question: q.id, choice: s.choice, correct: s.choice === q.answer }],
      feedback: 'Answer recorded. Continue when ready.',
    };
  if (a.type === 'next-question' && s.phase === 'quiz' && answered && a.question === q?.id) {
    const done = s.question === s.queue.length - 1;
    return {
      ...s,
      phase: done ? 'result' : 'quiz',
      question: done ? s.question : s.question + 1,
      choice: null,
      feedback: done
        ? 'Quiz complete. Here is your final score.'
        : 'Choose one answer and confirm it.',
    };
  }
  return s;
}
