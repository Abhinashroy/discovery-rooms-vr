import './style.css';
import { PLANETS, BY_ID, LEARNING_FACTS } from './content.js';
import {
  newSession,
  reduceSession,
  activeQuestion,
  hiddenName,
  availableNames,
  namingScore,
  quizScore,
  shouldCelebrate,
} from './state.js';
import { createPlanetarium } from './world.js';
import { createPlanetAudio } from './audio.js';
import { planetPanelAfter } from './presentation.js';
import { freshEntry, changeRoom } from '../rooms/routes.js';
const $ = (id) => document.getElementById(id),
  seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let state = newSession(seed()),
  menu = false,
  phase,
  viewIndex = -1;
let settings = {
  stationary: false,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  large: false,
  muted: false,
};
try {
  const saved = JSON.parse(localStorage.getItem('classroom-comfort') || '{}');
  for (const k of Object.keys(settings)) if (typeof saved[k] === 'boolean') settings[k] = saved[k];
} catch {}
const audio = createPlanetAudio(
  (message) => {
    $('sound-status').textContent = message;
  },
  (name) => {
    const d = $('sound-status').dataset;
    d[name] = Number(d[name] || 0) + 1;
  },
);
audio.setMuted(settings.muted);
const room = createPlanetarium($('room'), {
  action: act,
  walk: (distance) => audio.walk(distance),
  assets({ loaded, failed }) {
    $('load-status').hidden = loaded >= 12 && !failed;
    $('load-status').textContent = failed
      ? 'A texture could not load. Refresh to retry.'
      : loaded >= 12
        ? 'Local maps loaded'
        : 'Loading local planet maps…';
  },
  metrics(m) {
    $('room').dataset.drawCalls = m.drawCalls;
    $('room').dataset.triangles = m.triangles;
    $('room').dataset.textureMib = (m.textures / 1048576).toFixed(1);
  },
  immersive(value) {
    document.body.classList.toggle('immersive', value);
    hideDialogs();
    if (value && state.phase === 'explore' && state.focus && !menu) open('detail');
    if (!value && menu) $(activityPhase() ? 'activity' : 'menu').showModal();
  },
});
freshEntry(() => room.scene);
const activityPhase = () => ['naming-review', 'quiz', 'result'].includes(state.phase);
function save() {
  try {
    const old = JSON.parse(localStorage.getItem('classroom-comfort') || '{}');
    localStorage.setItem('classroom-comfort', JSON.stringify({ ...old, ...settings }));
  } catch {}
}
function hideDialogs() {
  for (const id of ['menu', 'cards', 'activity']) $(id).close();
}
function close() {
  menu = false;
  room.pause(false);
  hideDialogs();
  if (activityPhase()) open('activity');
}
function open(mode = 'menu') {
  hideDialogs();
  menu = true;
  audio.stopWalking();
  room.pause(true, mode);
  if (!room.immersive) {
    $(mode).showModal();
    $(
      mode === 'activity' ? 'activity-title' : mode === 'cards' ? 'cards-title' : 'menu-title',
    ).focus();
  }
}
function act(action) {
  const [type, id, qid] = action.split(':');
  audio.unlock();
  if (type === 'menu') {
    open('menu');
    return;
  }
  if (type === 'close') {
    close();
    return;
  }
  if (type === 'activity') {
    open('activity');
    return;
  }
  if (type === 'cards') {
    if (state.phase === 'naming' && state.focus) open('cards');
    return;
  }
  if (type === 'detail') {
    if (state.phase === 'explore' && state.focus) open('detail');
    return;
  }
  if (['views', 'comfort', 'learning', 'menu-home'].includes(type)) {
    menu = true;
    room.pause(true, type === 'menu-home' ? 'menu' : type);
    return;
  }
  if (type === 'view') {
    audio.stopWalking();
    room.moveTo(id);
    viewIndex = PLANETS.findIndex((p) => p.id === id);
    close();
    return;
  }
  if (type === 'previous' || type === 'next-view') {
    audio.stopWalking();
    viewIndex =
      viewIndex < 0
        ? type === 'previous'
          ? 7
          : 0
        : (viewIndex + (type === 'previous' ? -1 : 1) + 8) % 8;
    room.moveTo(PLANETS[viewIndex].id);
    close();
    return;
  }
  if (['stationary', 'reduced', 'large', 'muted'].includes(type)) {
    settings[type] = !settings[type];
    audio.stopWalking();
    audio.setMuted(settings.muted);
    save();
    render();
    return;
  }
  if (type === 'room') {
    audio.stopAll();
    room.pause(true);
    changeRoom(id, room.scene, () => room.dispose());
    return;
  }
  if (type === 'exit-vr') {
    room.scene.exitVR();
    return;
  }
  if (type === 'vr') {
    close();
    room.scene.enterVR().catch(() => {
      $('feedback').textContent =
        'VR could not start. Use Quest Browser on secure HTTPS or forwarded localhost.';
    });
    return;
  }
  if (type === 'rotate') {
    room.turnInspection(id === 'left' ? -1 : 1);
    return;
  }
  const before = state,
    payload = { type, id, seed: seed() };
  if (type === 'answer') {
    payload.id = activeQuestion(state)?.choices[Number(id)];
    payload.question = qid;
  }
  if (['confirm-answer', 'next-question'].includes(type)) payload.question = id;
  state = reduceSession(state, payload);
  if (state === before) return;
  if (shouldCelebrate(before, state)) audio.celebrate();
  if (['ready', 'restart', 'card'].includes(type)) {
    menu = false;
    hideDialogs();
    room.pause(false);
  }
  if (['inspect', 'close-inspect'].includes(type) && !room.immersive) {
    menu = false;
    hideDialogs();
    room.pause(false);
  }
  if (type === 'restart') {
    audio.stopAll();
    viewIndex = -1;
    room.moveTo('entrance');
  }
  render();
  const nextPanel = planetPanelAfter(type, state, room.immersive);
  if (nextPanel) open(nextPanel);
  else if (activityPhase()) open('activity');
}
function button(text, action) {
  const b = document.createElement('button');
  b.textContent = text;
  b.dataset.action = action;
  return b;
}
function render() {
  room.render(state, settings);
  document.body.classList.toggle('large', settings.large);
  document.body.dataset.phase = state.phase;
  const q = activeQuestion(state),
    naming = state.phase === 'naming',
    quiz = state.phase === 'quiz',
    count = Object.keys(state.assignments).length;
  const instructions = {
    explore: 'Explore the eight planets.',
    naming: 'Visit a planet. Give it a name.',
    'naming-review': 'Your naming results',
    quiz: 'Solar system quiz',
    result: 'Your final score',
  };
  $('instruction').textContent = instructions[state.phase];
  $('chapter').textContent = naming
    ? '01 / NAME THE PLANETS'
    : quiz
      ? '02 / KNOW YOUR SOLAR SYSTEM'
      : 'YOUR SOLAR SYSTEM';
  $('phase-label').textContent = state.phase.toUpperCase().replace('-', ' ');
  $('feedback').textContent = state.feedback;
  $('progress').textContent = naming
    ? count + ' / 8 named · Answers checked only after Submit'
    : quiz
      ? 'Question ' + (state.question + 1) + ' / 5'
      : '';
  $('menu-status').textContent = state.feedback + ' ' + $('progress').textContent;
  $('primary').hidden = state.phase !== 'explore';
  $('cards-open').hidden = !naming || !state.focus;
  $('submit-names').hidden = !naming || count !== 8;
  $('activity-open').hidden = !activityPhase();
  const detail = state.phase === 'explore' && state.focus;
  $('detail').hidden = !detail;
  if (detail) {
    const p = BY_ID[state.focus];
    $('detail-title').textContent = p.order + ' · ' + p.name;
    $('detail-text').textContent = LEARNING_FACTS[p.id].join(' ');
    $('detail-scale').textContent =
      'Main exhibit diameter: ' +
      (p.diameter < 0.5 ? (p.diameter * 100).toFixed(1) + ' cm' : p.diameter.toFixed(2) + ' m') +
      (p.order <= 4 ? ' · Enlarged 2.61×' : '') +
      (state.inspection
        ? p.order <= 4
          ? ' · Local close-up enlarged for detail.'
          : ' · Inspecting here at the exhibit.'
        : '');
  }
  $('inspect-view').dataset.action = 'view:' + state.inspection;
  for (const id of ['feedback', 'progress', 'menu-status'])
    $(id).hidden = !$(id).textContent.trim();
  $('inspect').hidden = Boolean(state.inspection);
  for (const id of ['inspect-view', 'inspect-close', 'rotate-left', 'rotate-right'])
    $(id).hidden = !state.inspection;
  $('stationary').textContent = settings.stationary ? 'Enable walking' : 'Use stationary views';
  $('reduced').textContent = 'Reduced motion: ' + (settings.reduced ? 'on' : 'off');
  $('large').textContent = 'Larger text: ' + (settings.large ? 'on' : 'off');
  for (const id of ['sound', 'mute-menu'])
    $(id).textContent = settings.muted ? 'Sound off' : 'Sound on';
  $('walk-hint').textContent = settings.stationary
    ? 'Stationary · use exhibit viewpoints'
    : 'WASD move · Drag look · E select · M menu';
  $('name-cards').replaceChildren();
  for (const id of naming && state.focus ? availableNames(state) : []) {
    const b = button(BY_ID[id].name, 'card:' + id);
    b.setAttribute('aria-pressed', String(state.assignments[state.focus] === id));
    $('name-cards').append(b);
  }
  $('cards-title').textContent = 'Name Exhibit ' + (BY_ID[state.focus]?.order || '');
  $('cards-instruction').textContent =
    'Choose an unused name. Assigned names leave the list. To change a used name, remove it from its current planet first.';
  $('unassign').hidden = !state.assignments[state.focus];
  $('exhibit-buttons').replaceChildren();
  for (const p of PLANETS) {
    const row = document.createElement('div'),
      neutral = hiddenName(state) ? 'Exhibit ' + p.order : p.name;
    row.append(
      button('View ' + neutral, 'view:' + p.id),
      button('Select ' + neutral, 'planet:' + p.id),
    );
    $('exhibit-buttons').append(row);
  }
  $('naming-review').replaceChildren();
  $('quiz-options').replaceChildren();
  $('quiz-review').replaceChildren();
  for (const id of ['quiz-start', 'confirm-answer', 'next-question', 'restart'])
    $(id).hidden = true;
  if (state.phase === 'naming-review') {
    $('activity-chapter').textContent = '01 / NAMING COMPLETE';
    $('activity-title').textContent = namingScore(state) + ' / 8 names correct';
    $('activity-text').textContent =
      'Here is what you named. Your answers are locked. Next: five random multiple-choice questions.';
    for (const r of state.namingReview) {
      const row = document.createElement('p');
      row.className = 'review-row ' + (r.correct ? 'correct' : 'incorrect');
      row.textContent =
        'Exhibit ' +
        BY_ID[r.id].order +
        ' · ' +
        BY_ID[r.assigned].name +
        ' — ' +
        (r.correct ? 'Correct ✓' : 'Incorrect ✕ · Correct name: ' + BY_ID[r.id].name);
      $('naming-review').append(row);
    }
    $('quiz-start').hidden = false;
  }
  if (quiz) {
    const answered = state.answers.length > state.question;
    $('activity-chapter').textContent =
      '02 / QUIZ · QUESTION ' + (state.question + 1) + ' OF 5 · ' + q.category.toUpperCase();
    $('activity-title').textContent = q.prompt;
    $('activity-text').textContent = answered
      ? 'Answer recorded. Your score will appear after all five questions.'
      : 'Choose one of four answers, then confirm. You can change your choice before confirming.';
    q.choices.forEach((choice, i) => {
      const b = button(String.fromCharCode(65 + i) + '. ' + choice, 'answer:' + i + ':' + q.id);
      b.setAttribute('aria-pressed', String(state.choice === choice));
      b.disabled = answered;
      $('quiz-options').append(b);
    });
    $('confirm-answer').hidden = answered;
    $('confirm-answer').disabled = !state.choice;
    $('confirm-answer').dataset.action = 'confirm-answer:' + q.id;
    $('next-question').hidden = !answered;
    $('next-question').textContent = state.question === 4 ? 'Show final score' : 'Next question';
    $('next-question').dataset.action = 'next-question:' + q.id;
  }
  if (state.phase === 'result') {
    $('activity-chapter').textContent = 'MISSION COMPLETE';
    $('activity-title').textContent = 'Final quiz score: ' + quizScore(state) + ' / 5';
    $('activity-text').textContent =
      'Naming: ' +
      namingScore(state) +
      ' / 8 · Quiz: ' +
      quizScore(state) +
      ' / 5. Review the answers below or explore and try again.';
    state.queue.forEach((q, i) => {
      const a = state.answers[i],
        row = document.createElement('div');
      row.className = 'review-row ' + (a.correct ? 'correct' : 'incorrect');
      const title = document.createElement('strong'),
        text = document.createElement('p');
      title.textContent = i + 1 + '. ' + q.prompt;
      text.textContent =
        (a.correct ? 'Correct ✓' : 'Incorrect ✕') +
        ' · Your answer: ' +
        a.choice +
        ' · Correct answer: ' +
        q.answer +
        '. ' +
        q.explanation;
      row.append(title, text);
      $('quiz-review').append(row);
    });
    $('restart').hidden = false;
  }
  if (phase !== state.phase) {
    $('instruction').focus();
    phase = state.phase;
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-action]');
  if (b && !b.disabled) act(b.dataset.action);
});
for (const id of ['menu', 'cards', 'activity'])
  $(id).addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
window.addEventListener('pagehide', () => {
  audio.stopAll();
  room.dispose();
});
window.addEventListener('blur', () => audio.stopWalking());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.stopAll();
});
document.addEventListener('pointerdown', () => audio.unlock());
document.addEventListener('keydown', () => audio.unlock());
async function checkVR() {
  try {
    const ok = await navigator.xr?.isSessionSupported('immersive-vr');
    $('vr').disabled = !ok;
    $('vr').textContent = ok ? 'Enter VR' : 'VR unavailable here';
  } catch {
    $('vr').textContent = 'VR unavailable here';
  }
}
room.scene.addEventListener('loaded', checkVR);
checkVR();
render();
