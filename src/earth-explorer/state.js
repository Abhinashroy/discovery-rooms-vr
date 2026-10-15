import { DAY, clock, changeYear, changeDay, changeMinutes } from './astronomy.js';
import { COUNTRIES, COUNTRY_BY_ID } from './countries.js';
import { randomSource, shuffled } from '../planetarium/content.js';
export const CONTINENTS = [
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
];
export function newEarthSession(seed = Date.now()) {
  return {
    seed,
    mode: 'orbit',
    phase: 'explore',
    timestamp: Date.UTC(2026, 5, 21, 12),
    playing: false,
    speed: DAY / 8,
    location: { lat: 20, lon: 77 },
    selected: null,
    card: null,
    visited: [],
    queue: [],
    question: 0,
    choice: null,
    answers: [],
    completed: null,
    abandoned: [],
    message: 'See how Earth moves, then explore the places on it.',
  };
}
export const activeQuestion = (s) => s.queue[s.question];
export const quizScore = (s) => s.answers.filter((a) => a.correct).length;
export function makeQuiz(visited, seed) {
  const random = randomSource(seed),
    pool = [...new Set(visited)].map((id) => COUNTRY_BY_ID[id]).filter(Boolean);
  if (pool.length < 5) return [];
  const targets = shuffled(pool, random).slice(0, 5),
    types = shuffled(['location', 'location', 'continent', 'continent', 'fact'], random);
  return targets.map((c, i) => {
    const type = types[i],
      paired = c.continent === 'Europe / Asia',
      answer = type === 'continent' ? c.continent : c.id;
    const other =
      type === 'continent'
        ? paired
          ? ['Africa / Asia', 'Europe / Africa', 'North America / South America']
          : CONTINENTS.filter((v) => v !== answer)
        : pool.map((p) => p.id).filter((id) => id !== answer);
    return {
      id: type + '-' + c.id,
      type,
      target: c.id,
      answer,
      prompt:
        type === 'location'
          ? 'Which country is highlighted on the globe?'
          : type === 'continent'
            ? paired
              ? 'Which pair of continents does ' + c.name + ' span?'
              : 'Which continent or world region contains ' + c.name + '?'
            : "Which country's card included this fact?",
      fact: type === 'fact' ? c.fact : null,
      source: c.factSource,
      factVersion: c.factVersion,
      choices: shuffled([answer, ...shuffled(other, random).slice(0, 3)], random),
    };
  });
}
export function reduceEarth(s, a) {
  const c = COUNTRY_BY_ID[a.id],
    q = activeQuestion(s),
    locked = s.answers.length > s.question;
  if (a.type === 'restart') return newEarthSession(a.seed ?? s.seed + 1);
  if (
    a.type === 'tick' &&
    s.playing &&
    s.phase === 'explore' &&
    s.mode === 'orbit' &&
    a.elapsed > 0
  )
    return { ...s, timestamp: s.timestamp + Math.min(a.elapsed, 0.1) * s.speed };
  if (s.phase === 'explore') {
    if (a.type === 'mode' && ['orbit', 'globe'].includes(a.id))
      return {
        ...s,
        mode: a.id,
        playing: false,
        message:
          a.id === 'globe'
            ? 'Travel across the globe. Select countries to discover them.'
            : 'Use Time controls to watch Earth, Sun and Moon.',
      };
    if (a.type === 'select' && c)
      return {
        ...s,
        selected: c.id,
        card: c.id,
        visited: [...new Set([...s.visited, c.id])],
        message: c.name + ' · ' + c.continent,
      };
    if (a.type === 'land' && c)
      return {
        ...s,
        mode: 'globe',
        playing: false,
        selected: c.id,
        location: { lat: c.lat, lon: c.lon },
        message: 'Explore ' + c.name + ' and select its outline to open the learning card.',
      };
    if (
      a.type === 'location' &&
      Number.isFinite(a.location?.lat) &&
      Number.isFinite(a.location?.lon)
    )
      return { ...s, location: a.location };
    if (a.type === 'close-card') return { ...s, card: null };
    if (a.type === 'speed' && [DAY / 20, DAY / 8, DAY, DAY * 3].includes(a.value))
      return { ...s, speed: a.value };
    if (a.type === 'play' && s.mode === 'orbit') return { ...s, playing: !s.playing };
    if (['year', 'day', 'minutes', 'step-day', 'step-hour', 'date'].includes(a.type)) {
      const value = Number(a.value);
      let timestamp = s.timestamp;
      if (a.type === 'year' && Number.isInteger(value) && value >= 1900 && value <= 2100)
        timestamp = changeYear(timestamp, value);
      if (a.type === 'day' && Number.isFinite(value)) timestamp = changeDay(timestamp, value);
      if (a.type === 'minutes' && Number.isFinite(value))
        timestamp = changeMinutes(timestamp, value);
      if (a.type === 'step-day' && [-1, 1].includes(value)) timestamp += value * DAY;
      if (a.type === 'step-hour' && [-1, 1].includes(value)) timestamp += (value * DAY) / 24;
      if (a.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(a.value)) {
        const date = Date.parse(a.value + 'T00:00:00Z');
        if (
          Number.isFinite(date) &&
          new Date(date).getUTCFullYear() >= 1900 &&
          new Date(date).getUTCFullYear() <= 2100 &&
          new Date(date).toISOString().slice(0, 10) === a.value
        )
          timestamp = date + clock(s.timestamp).minutes * 60000;
      }
      return { ...s, timestamp, playing: false };
    }
    if (a.type === 'quiz-start') {
      const queue = makeQuiz(s.visited, a.seed ?? s.seed);
      if (queue.length !== 5)
        return {
          ...s,
          message:
            'Open ' +
            Math.max(0, 5 - s.visited.length) +
            ' more country cards to unlock your quiz.',
        };
      return {
        ...s,
        seed: a.seed ?? s.seed,
        phase: 'quiz',
        playing: false,
        card: null,
        queue,
        question: 0,
        choice: null,
        answers: [],
        message: 'Five questions about countries you explored.',
      };
    }
    if (a.type === 'last-result' && s.completed)
      return {
        ...s,
        phase: 'result',
        queue: s.completed.queue,
        answers: s.completed.answers,
        question: 4,
        card: null,
        playing: false,
      };
  }
  if (s.phase === 'quiz') {
    if (a.type === 'choose' && !locked && a.question === q?.id && q.choices.includes(a.id))
      return { ...s, choice: a.id };
    if (a.type === 'confirm' && !locked && a.question === q?.id && q.choices.includes(s.choice))
      return {
        ...s,
        answers: [
          ...s.answers,
          { question: q.id, choice: s.choice, correct: s.choice === q.answer },
        ],
      };
    if (a.type === 'next' && locked && a.question === q?.id) {
      if (s.question < 4) return { ...s, question: s.question + 1, choice: null };
      return {
        ...s,
        phase: 'result',
        choice: null,
        completed: {
          queue: s.queue.map((q) => ({ ...q, choices: [...q.choices] })),
          answers: s.answers.map((a) => ({ ...a })),
        },
        message: 'Quiz complete. Review and revisit the countries.',
      };
    }
    if (a.type === 'leave-quiz')
      return {
        ...s,
        phase: 'explore',
        queue: [],
        answers: [],
        choice: null,
        abandoned: [...s.abandoned, { answered: s.answers.length, completed: false }],
        message: 'Quiz left unfinished. Your country discoveries remain.',
      };
  }
  if (a.type === 'show-country' && s.phase === 'result' && c)
    return {
      ...s,
      phase: 'explore',
      mode: 'globe',
      location: { lat: c.lat, lon: c.lon },
      selected: c.id,
      card: c.id,
      playing: false,
      message: 'Review ' + c.name + ' on the globe.',
    };
  if (a.type === 'explore' && s.phase === 'result')
    return {
      ...s,
      phase: 'explore',
      playing: false,
      message: 'Explore more countries or revisit your quiz results.',
    };
  return s;
}
