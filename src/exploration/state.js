import { THEMES, MAIN, PREREQUISITES, ANCHORS } from './catalog.js';
import { shuffled } from '../discovery/adventure.js';
export const available = (s, id) => (PREREQUISITES[id] || []).every((key) => s.tasks[key]?.done);
export const progress = (s) => MAIN.filter((id) => s.tasks[id].done).length;
export function createSession(theme = 'space', seed = 1) {
  if (!THEMES[theme] || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw Error('Invalid expedition');
  return {
    theme,
    seed,
    tasks: Object.fromEntries(
      Object.keys(PREREQUISITES).map((id) => [
        id,
        { step: 0, done: false, acknowledged: false, hints: 0, assisted: false, trial: null },
      ]),
    ),
    pocket: null,
    records: [],
    props: THEMES[theme].props.map((p, i) => ({
      value: p[2][(seed + i) % p[2].length],
      opened: false,
      rotation: 0,
    })),
    quiz: null,
    treasure: false,
    message: THEMES[theme].intro,
  };
}
export function choices(s, id) {
  const t = s.tasks[id],
    d = THEMES[s.theme].tasks[id];
  return d?.steps[t?.step]?.options || [];
}
export function currentObjective(s) {
  return MAIN.find((id) => !s.tasks[id].done && available(s, id)) || 'finale';
}
export function reduceSession(previous, a) {
  const s = structuredClone(previous),
    theme = THEMES[s.theme];
  // Recall freezes all world state, including pocket, lens and inspection records.
  if (s.quiz && !['answer', 'look', 'return', 'next', 'skip', 'end-quiz'].includes(a.type))
    return s;
  if (a.type === 'select') {
    if (
      !s.tasks[a.id] ||
      !available(s, a.id) ||
      s.tasks[a.id].done ||
      !choices(s, a.id).includes(a.value)
    )
      return s;
    s.pocket = { id: a.id, value: a.value };
    s.message = `Selected: ${a.value}. Use the highlighted mechanism, or return it to choose another.`;
  } else if (a.type === 'return-item') {
    s.pocket = null;
    s.message = 'Item returned. Nothing has been lost.';
  } else if (a.type === 'use') {
    const t = s.tasks[a.id],
      d = theme.tasks[a.id];
    if (!t || !available(s, a.id) || t.done) return s;
    if (s.pocket?.id !== a.id) {
      s.message = 'Select an item or control for this mechanism first.';
      return s;
    }
    const step = d.steps[t.step];
    t.trial = s.pocket.value;
    if (s.pocket.value !== step.answer) {
      s.message = `Try another approach. ${step.feedback} Completed work is safe.`;
      t.feedback = s.message;
      s.pocket = null;
      return s;
    }
    t.step++;
    s.pocket = null;
    s.message = step.feedback;
    t.feedback = s.message;
    if (t.step === d.steps.length) {
      t.done = true;
      s.message = `${d.title} restored. ${d.explanation}`;
      if (a.id === 'finale') s.treasure = true;
    }
  } else if (a.type === 'hint') {
    const t = s.tasks[a.id],
      d = theme.tasks[a.id];
    if (!t || !available(s, a.id) || t.done) return s;
    t.hints = Math.min(3, t.hints + 1);
    const step = d.steps[t.step];
    s.message =
      t.hints === 1
        ? step.prompt
        : t.hints === 2
          ? step.feedback
          : `Next action: ${step.answer}. Select it, then use the mechanism.`;
  } else if (a.type === 'assist') {
    const t = s.tasks[a.id],
      d = theme.tasks[a.id];
    if (!t || !available(s, a.id) || t.done) return s;
    t.assisted = true;
    s.pocket = { id: a.id, value: d.steps[t.step].answer };
    return reduceSession(s, { type: 'use', id: a.id });
  } else if (a.type === 'acknowledge') {
    const t = s.tasks[a.id],
      d = theme.tasks[a.id];
    if (!t?.done || t.acknowledged) return s;
    t.acknowledged = true;
    if (d.quiz)
      s.records.push({
        id: `concept:${a.id}`,
        category: 'concept',
        location: d.title,
        ...d.quiz,
        explanation: d.explanation,
        learningAssisted: t.assisted,
      });
    s.message = 'Explanation added to your discovery journal.';
  } else if (a.type === 'inspect') {
    const i = Number(a.id),
      p = s.props[i],
      def = theme.props[i];
    if (!p || !def) return s;
    if (!p.opened) {
      p.opened = true;
      s.records.push({
        id: `observation:${i}`,
        category: 'observation',
        location: def[0],
        answer: p.value,
        choices: [...def[2]],
        prompt: `What ${def[1]} did you inspect at the ${def[0]}?`,
        explanation: `You inspected ${p.value} at the ${def[0]}.`,
      });
    }
    s.message = `${def[0]}: ${p.value}. Rotate the enlarged model to look closer.`;
  } else if (a.type === 'rotate-lens') {
    const p = s.props[Number(a.id)];
    if (p?.opened) p.rotation = (p.rotation + 45) % 360;
  } else if (a.type === 'start-quiz') {
    const concepts = shuffled(
        s.records.filter((r) => r.category === 'concept'),
        s.seed ^ 71,
      ),
      observations = shuffled(
        s.records.filter((r) => r.category === 'observation'),
        s.seed ^ 81,
      );
    const chosen =
      a.mode === 'memory'
        ? observations.slice(0, 5)
        : [...concepts.slice(0, 3), ...observations.slice(0, 2)];
    // A shorter fair round is preferable to unseen facts or duplicate questions.
    if (!chosen.length) {
      s.message = 'Inspect a discovery or finish an experiment and read its explanation first.';
      return s;
    }
    s.quiz = {
      index: 0,
      mode: a.mode,
      questions: shuffled(chosen, s.seed ^ 91).map((r, i) => ({
        ...r,
        choices: shuffled(r.choices, s.seed + i * 17),
        result: null,
        assisted: false,
        looking: false,
      })),
    };
  } else if (s.quiz) {
    const q = s.quiz.questions[s.quiz.index];
    if (a.type === 'look' && !q.result) {
      q.assisted = true;
      q.looking = true;
    }
    if (a.type === 'return') q.looking = false;
    if (a.type === 'answer' && !q.result && !q.looking && q.choices.includes(a.value))
      q.result = a.value === q.answer ? 'correct' : 'incorrect';
    if (a.type === 'skip' && !q.result) {
      q.result = 'skipped';
      q.looking = false;
    }
    if (a.type === 'next' && q.result && s.quiz.index < s.quiz.questions.length - 1) s.quiz.index++;
    if (a.type === 'end-quiz' && s.quiz.questions.every((x) => x.result)) s.quiz = null;
  }
  return s;
}
export function summary(s) {
  return ['concept', 'observation'].map((category) => {
    const qs = s.quiz?.questions.filter((q) => q.category === category) || [];
    return {
      category,
      total: qs.length,
      correct: qs.filter((q) => q.result === 'correct' && !q.assisted).length,
      assisted: qs.filter((q) => q.assisted).length,
      skipped: qs.filter((q) => q.result === 'skipped').length,
    };
  });
}
export const obstacles = Object.entries(ANCHORS).map(([id, a]) => ({
  id,
  x: a.x,
  z: a.z,
  r: id === 'finale' ? 1.15 : id.startsWith('prop') ? 0.5 : 0.8,
}));
export const canStand = (x, z) =>
  Number.isFinite(x) &&
  Number.isFinite(z) &&
  Math.abs(x) <= 6.5 &&
  Math.abs(z) <= 6.4 &&
  !obstacles.some((o) => Math.abs(x - o.x) < o.r && Math.abs(z - o.z) < o.r);
export function move(position, dx, dz) {
  const p = { ...position },
    n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
  for (let i = 0; i < n; i++) {
    if (canStand(p.x + dx / n, p.z)) p.x += dx / n;
    if (canStand(p.x, p.z + dz / n)) p.z += dz / n;
  }
  return p;
}
export function pathTo(start, goal) {
  const snap = (p) => ({ x: Math.round(p.x * 2) / 2, z: Math.round(p.z * 2) / 2 }),
    key = (p) => `${p.x},${p.z}`,
    from = snap(start),
    to = snap(goal);
  if (!canStand(from.x, from.z) || !canStand(to.x, to.z)) return [];
  const queue = [from],
    prev = new Map([[key(from), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (key(p) === key(to)) {
      const result = [];
      for (let n = p; n; n = prev.get(key(n))) result.unshift(n);
      return result;
    }
    for (const [x, z] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const n = { x: p.x + x, z: p.z + z };
      if (canStand(n.x, n.z) && !prev.has(key(n))) {
        prev.set(key(n), p);
        queue.push(n);
      }
    }
  }
  return [];
}
