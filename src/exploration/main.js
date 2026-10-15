import './style.css';
import { roleLabel, purpose, nextActions, nextInstruction, unlockInstruction } from './guidance.js';
import { THEMES, ANCHORS, MAIN, PREREQUISITES } from './catalog.js';
import {
  createSession,
  reduceSession,
  available,
  progress,
  currentObjective,
  choices,
  summary,
} from './state.js';
import { createWorld } from './world.js';
const $ = (id) => document.getElementById(id),
  seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let state = createSession('space', seed()),
  started = false,
  view = null,
  lastFocus = null,
  noticeTimer;
let settings = {
  stationary: false,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  large: false,
  contrast: false,
  mode: 'guided',
  emblem: 'Star',
};
try {
  const saved = JSON.parse(localStorage.getItem('discovery-exploration-preferences') || 'null');
  if (saved) {
    for (const key of ['stationary', 'reduced', 'large', 'contrast'])
      if (typeof saved[key] === 'boolean') settings[key] = saved[key];
    if (['Star', 'Leaf', 'Lightning'].includes(saved.emblem)) settings.emblem = saved.emblem;
    if (['guided', 'explorer'].includes(saved.mode)) settings.mode = saved.mode;
  }
} catch {}
const world = createWorld($('world'), {
  action: act,
  immersive(value) {
    document.body.classList.toggle('immersive', value);
    if (value && !started) start();
    if (value) {
      $('notebook').close();
    } else if (view) show(view);
  },
});
function notify(text) {
  $('notice').textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($('notice').textContent = ''), 7000);
}
function save() {
  try {
    localStorage.setItem('discovery-exploration-preferences', JSON.stringify(settings));
  } catch {
    notify('Preferences could not be saved. This expedition still works.');
  }
}
function applySettings() {
  document.body.classList.toggle('large-text', settings.large);
  document.body.classList.toggle('high-contrast', settings.contrast);
  document.documentElement.style.setProperty('--accent', THEMES[state.theme].color);
  save();
}
$('navigation').value = settings.stationary ? 'stationary' : 'walk';
$('mode').value = settings.mode;
$('emblem').value = settings.emblem;
function start() {
  if (started) return;
  settings.stationary = $('navigation').value === 'stationary';
  settings.mode = $('mode').value;
  settings.emblem = $('emblem').value;
  state = createSession($('theme').value, seed());
  started = true;
  $('welcome').hidden = true;
  $('mission').hidden = false;
  $('controls').hidden = false;
  applySettings();
  world.start();
  world.reset();
  world.guide('arrival');
  refresh();
  show('briefing');
}
function refresh() {
  world.render(state, settings);
  $('theme-name').textContent = THEMES[state.theme].title;
  $('objective').textContent = state.treasure
    ? 'The room is alive'
    : THEMES[state.theme].tasks[currentObjective(state)].title;
  $('objective-detail').textContent = nextInstruction(state);
  $('open-next').textContent = state.treasure
    ? 'Choose a quiz'
    : `Open ${THEMES[state.theme].tasks[currentObjective(state)].title}`;
  $('progress').textContent = `${progress(state)} / 5 main discoveries`;
  $('side-progress').textContent =
    `${['sideA', 'sideB'].filter((id) => state.tasks[id].done).length} / 2 optional quests`;
  if (view) show(view);
}
function dispatch(a) {
  state = reduceSession(state, a);
  refresh();
  notify(state.message);
}
const button = (label, action) => ({ label, action });
function close() {
  if (state.quiz) return;
  view = null;
  world.panel(null);
  $('notebook').close();
  lastFocus?.focus?.();
}
function show(name) {
  view = name;
  let title = '',
    text = '',
    buttons = [];
  const theme = THEMES[state.theme];
  $('panel-extra').replaceChildren();
  if (name === 'briefing') {
    title = 'Your mission: ' + theme.title;
    text =
      theme.intro +
      '\n\nHOW TO PLAY\n1. Open a task. Read its goal and clue.\n2. Select a choice, then press Use selected item / control. Watch what changes.\n3. Complete both investigations, combine their clues, then activate the final model.\n\nMAIN MISSION objects earn treasure. SIDE QUESTS are extra experiments. MEMORY OBJECTS are optional details to remember for a quiz. There is no timer.';
    buttons = [
      button('Take me to the first task', 'travel:arrival'),
      button('Explore on my own', 'close'),
    ];
  } else if (name === 'menu') {
    title = 'Your explorer kit';
    text =
      'Left stick / WASD: move. Right stick: turn. Triggers: select. B/Y or M: menu. All experiments work seated through the map.';
    buttons = [
      button('What am I trying to do?', 'briefing'),
      button('Open my next task', 'open-next'),
      button('Mission map', 'map'),
      button('Discovery journal', 'journal'),
      button('Mission debrief', 'debrief'),
      button('Comfort & controls', 'settings'),
      button('Change expedition / restart', 'restart'),
      button('Continue exploring', 'close'),
    ];
  } else if (name === 'map') {
    title = 'Mission map · choose a task';
    text =
      theme.intro +
      '\n\nMAIN MISSION: required for treasure. SIDE QUEST: optional experiment. MEMORY OBJECT: optional quiz detail. LATER: finish its earlier tasks first. Select a button to go there and open its instructions.';
    const ns = 'http://www.w3.org/2000/svg',
      svg = document.createElementNS(ns, 'svg');
    svg.classList.add('map');
    svg.setAttribute('viewBox', '0 0 360 300');
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      'Single room map with numbered landmarks. The numbered controls below provide navigation.',
    );
    let i = 0;
    for (const [id, a] of Object.entries(ANCHORS)) {
      i++;
      const x = 180 + a.x * 23,
        y = 145 + a.z * 20,
        c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', id === 'finale' ? 15 : 9);
      svg.append(c);
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', x);
      t.setAttribute('y', y - 15);
      t.setAttribute('text-anchor', 'middle');
      t.textContent = `${i}`;
      svg.append(t);
      const label = `${roleLabel(state, id)} — ${id.startsWith('prop') ? theme.props[Number(id.slice(4))][0] : theme.tasks[id].title}`;
      buttons.push(button(`${i}. ${label}`, `travel:${id}`));
    }
    const p = world.position(),
      dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', 180 + p.x * 23);
    dot.setAttribute('cy', 145 + p.z * 20);
    dot.setAttribute('r', '5');
    dot.style.fill = '#fff';
    svg.append(dot);
    $('panel-extra').append(svg);
  } else if (name === 'journal') {
    title = 'Your discovery journal';
    text = state.records.length
      ? state.records
          .map(
            (r) =>
              `${r.category === 'concept' ? 'LEARNED' : 'OBSERVED'} · ${r.location}: ${r.answer}`,
          )
          .join('\n\n')
      : 'No evidence yet. Investigate a mechanism or inspect one of the three optional discoveries.';
    buttons = [
      button('Mission debrief', 'debrief'),
      button('Memory-only round', 'quiz:memory'),
      button('Back to map', 'map'),
    ];
  } else if (name === 'debrief') {
    title = 'Report your discoveries';
    text =
      'Up to three concept questions and two observation questions, drawn only from your completed explanations and inspected objects. The room and journal will be concealed. Look again counts as assisted practice. Your treasure stays yours.';
    buttons = [
      button('Begin mixed debrief', 'quiz:mixed'),
      button('Memory only', 'quiz:memory'),
      button('Keep exploring', 'close'),
    ];
  } else if (name === 'settings') {
    title = 'Make yourself comfortable';
    text =
      'Walking uses controller sticks or keyboard; it never requires physical walking. Stationary mode opens all activities through the map. Teleport is available in both modes.';
    buttons = [
      button(
        settings.stationary ? 'Enable stick / keyboard walking' : 'Use stationary mode',
        'setting:stationary',
      ),
      button(`Reduced motion: ${settings.reduced ? 'on' : 'off'}`, 'setting:reduced'),
      button(`Larger text: ${settings.large ? 'on' : 'off'}`, 'setting:large'),
      button(`High contrast: ${settings.contrast ? 'on' : 'off'}`, 'setting:contrast'),
      button(`Hints: ${settings.mode}`, 'mode'),
      button(`Emblem: ${settings.emblem}`, 'emblem'),
    ];
  } else if (name === 'restart') {
    title = 'Start a fresh expedition?';
    text =
      'Choosing an expedition starts a new hunt and clears the current discoveries and debrief. Your comfort preferences stay.';
    buttons = Object.entries(THEMES).map(([id, t]) => button(t.title, `restart:${id}`));
    buttons.push(button('Keep current expedition', 'close'));
  } else if (name === 'quiz') {
    const q = state.quiz.questions[state.quiz.index];
    title = `${q.category === 'concept' ? 'Concept' : 'Observation'} / ${state.quiz.index + 1} of ${state.quiz.questions.length}`;
    text = q.prompt;
    if (q.result) {
      text += `\n${q.result === 'correct' ? 'Correct' : q.result === 'skipped' ? 'Skipped' : 'A discovery to revisit'}. ${q.answer}. ${q.explanation}`;
      buttons =
        state.quiz.index < state.quiz.questions.length - 1
          ? [button('Next discovery', 'quiz-next')]
          : [button('See debrief summary', 'quiz-summary')];
    } else if (q.looking) {
      text = `Look again (assisted): ${q.answer}. ${q.explanation}`;
      buttons = [button('Return to question', 'quiz-return'), button('Skip', 'quiz-skip')];
    } else
      buttons = [
        ...q.choices.map((v, i) => button(v, `answer:${i}`)),
        button('Look again · assisted', 'quiz-look'),
        button('Skip question', 'quiz-skip'),
      ];
  } else if (name === 'summary') {
    title = 'Your mission debrief';
    text =
      summary(state)
        .map(
          (r) =>
            `${r.category === 'concept' ? 'Concepts' : 'Observations'}: ${r.correct} correct unassisted / ${r.total}; ${r.assisted} assisted; ${r.skipped} skipped.`,
        )
        .join('\n') + '\nThis is practice, not a memory assessment. Your treasure remains earned.';
    buttons = [button('Back to the room', 'quiz-end')];
  } else if (name.startsWith('inspect:')) {
    const i = Number(name.split(':')[1]),
      p = state.props[i];
    title = theme.props[i][0];
    text = `${purpose(state, 'prop' + i)}\n\nDETAIL TO REMEMBER: ${p.value}. Saved in your journal. Rotate the enlarged model to look more closely.`;
    buttons = [
      button('Rotate inspection model', 'rotate:' + i),
      button('Open journal', 'journal'),
      button('Return to room', 'close'),
    ];
  } else {
    const id = name,
      t = state.tasks[id],
      d = theme.tasks[id];
    if (!t) return;
    title = `${id.startsWith('side') ? 'Optional · ' : ''}${d.title}`;
    if (!available(state, id)) {
      text = purpose(state, id) + '\n\n' + unlockInstruction(state, id);
      buttons = [
        ...nextActions(state).map((k) => button('Open ' + theme.tasks[k].title, 'travel:' + k)),
        button('Back to map', 'map'),
      ];
    } else if (t.done) {
      text =
        'TASK COMPLETE\n' +
        d.explanation +
        (t.assisted ? ' You used worked assistance.' : '') +
        '\n\nWHAT NEXT?\n' +
        (state.treasure
          ? 'Your main mission is finished. Optional activities and quizzes are available in the menu.'
          : nextActions(state)
              .map((k) => theme.tasks[k].title)
              .join(' or '));
      buttons = [
        button(t.acknowledged ? 'Explanation saved' : 'Save explanation to journal', `ack:${id}`),
        button('Continue exploring', 'close'),
        ...(state.treasure
          ? [button('Choose a quiz', 'debrief')]
          : nextActions(state).map((k) => button('Next: ' + theme.tasks[k].title, 'travel:' + k))),
      ];
    } else {
      const stage = d.steps[t.step];
      text = `WHY THIS OBJECT?\n${purpose(state, id)}\n\nDO NOW · action ${t.step + 1} of ${d.steps.length}\n${stage.prompt}\n\nCLUE: ${stage.feedback}${t.feedback ? '\nRESULT OF LAST TRY: ' + t.feedback : ''}\n\nSelect one choice below. Then press Use selected item / control to try it.`;
      if (state.pocket?.id === id) {
        text += `\nSelected: ${state.pocket.value}.`;
        buttons = [
          button('Use selected item / control', `use:${id}`),
          button('Return selected item', 'return-item'),
          button('Try on the room model', 'close'),
        ];
      } else buttons = choices(state, id).map((value, i) => button(value, `select:${id}:${i}`));
      buttons.push(
        button('Give me a hint', `hint:${id}`),
        button('Show the next action', `assist:${id}`),
      );
    }
  }
  $('panel-title').textContent = title;
  $('panel-text').textContent = text;
  $('panel-actions').replaceChildren();
  for (const b of buttons) {
    const n = document.createElement('button');
    n.textContent = b.label;
    n.dataset.action = b.action;
    $('panel-actions').append(n);
  }
  $('close').hidden = Boolean(state.quiz);
  world.panel({ title, text, buttons });
  if (name.startsWith('inspect:')) world.showLens(Number(name.split(':')[1]));
  if (!world.immersive && !$('notebook').open) {
    lastFocus = document.activeElement;
    $('notebook').showModal();
    $('panel-title').focus();
  }
  if (!world.immersive && !$('notebook').contains(document.activeElement)) $('panel-title').focus();
}
function act(action) {
  if (!action) return;
  const [type, id, index] = action.split(':');
  if (type === 'exit-vr') {
    world.scene.exitVR();
    return;
  }
  if (!started) {
    start();
  }
  if (
    state.quiz &&
    ![
      'answer',
      'quiz-look',
      'quiz-return',
      'quiz-next',
      'quiz-skip',
      'quiz-end',
      'quiz-summary',
    ].includes(type)
  )
    return;
  if (type === 'close') {
    close();
    return;
  }
  if (type === 'menu') {
    view ? close() : show('menu');
    return;
  }
  if (type === 'open-next') {
    state.treasure ? show('debrief') : act('travel:' + currentObjective(state));
    return;
  }
  if (['briefing', 'map', 'journal', 'settings', 'debrief', 'restart'].includes(type) && !id) {
    show(type);
    return;
  }
  if (type === 'next') {
    const target = currentObjective(state);
    world.guide(target);
    close();
    notify(
      `Follow the dots to ${THEMES[state.theme].tasks[target].title}. Or use Map to teleport.`,
    );
    return;
  }
  if (type === 'travel') {
    world.moveTo(id);
    close();
    if (id.startsWith('prop')) {
      act(`inspect:${id.slice(4)}`);
    } else show(id);
    return;
  }
  if (type === 'open') {
    const a = ANCHORS[id],
      p = world.position();
    if (!a) return;
    if (!settings.stationary && Math.hypot(p.x - a.x, p.z - a.z) > 3.8) {
      world.guide(id);
      notify('Follow the dots or use Map to teleport closer.');
      return;
    }
    show(id);
    return;
  }
  if (type === 'select') {
    dispatch({ type: 'select', id, value: choices(state, id)[Number(index)] });
    return;
  }
  if (['use', 'hint', 'assist'].includes(type)) {
    view = id;
    dispatch({ type, id });
    if (type === 'hint') {
      const d = THEMES[state.theme].tasks[id];
      $('panel-text').textContent = state.message;
      world.panel({
        title: d.title,
        text: state.message,
        buttons: [
          button('Back to experiment', `open:${id}`),
          button('Show another hint', `hint:${id}`),
        ],
      });
    }
    return;
  }
  if (type === 'ack') {
    dispatch({ type: 'acknowledge', id });
    return;
  }
  if (type === 'return-item') {
    dispatch({ type });
    return;
  }
  if (type === 'inspect') {
    view = `inspect:${id}`;
    dispatch({ type: 'inspect', id });
    return;
  }
  if (type === 'rotate') {
    dispatch({ type: 'rotate-lens', id });
    return;
  }
  if (type === 'setting') {
    if (!['stationary', 'reduced', 'large', 'contrast'].includes(id)) return;
    settings[id] = !settings[id];
    applySettings();
    refresh();
    return;
  }
  if (type === 'mode') {
    settings.mode = settings.mode === 'guided' ? 'explorer' : 'guided';
    applySettings();
    refresh();
    return;
  }
  if (type === 'emblem') {
    settings.emblem = ['Star', 'Leaf', 'Lightning'][
      (['Star', 'Leaf', 'Lightning'].indexOf(settings.emblem) + 1) % 3
    ];
    applySettings();
    refresh();
    return;
  }
  if (type === 'restart' && THEMES[id]) {
    close();
    state = createSession(id, seed());
    world.reset();
    world.guide('arrival');
    applySettings();
    refresh();
    show('briefing');
    return;
  }
  if (type === 'quiz') {
    state = reduceSession(state, { type: 'start-quiz', mode: id });
    if (state.quiz) view = 'quiz';
    refresh();
    if (!state.quiz) notify(state.message);
    return;
  }
  if (type === 'answer') {
    dispatch({ type: 'answer', value: state.quiz.questions[state.quiz.index].choices[Number(id)] });
    return;
  }
  if (type === 'quiz-summary') {
    show('summary');
    return;
  }
  const quizAction = {
    'quiz-look': 'look',
    'quiz-return': 'return',
    'quiz-next': 'next',
    'quiz-skip': 'skip',
    'quiz-end': 'end-quiz',
  }[type];
  if (quizAction) {
    state = reduceSession(state, { type: quizAction });
    if (!state.quiz) {
      close();
    } else view = 'quiz';
    refresh();
  }
}
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (target && target.tagName === 'BUTTON') act(target.dataset.action);
});
$('notebook').addEventListener('cancel', (e) => {
  e.preventDefault();
  close();
});
$('start').addEventListener('click', start);
function updateWelcome() {
  $('welcome-mission').textContent = THEMES[$('theme').value].intro;
}
$('theme').addEventListener('change', () => {
  updateWelcome();
  if (!started) {
    state = createSession($('theme').value, seed());
    refresh();
  }
});
$('vr').addEventListener('click', async () => {
  if (!started) start();
  close();
  try {
    await world.scene.enterVR();
  } catch {
    notify(
      'VR could not start. Open this HTTPS page in Meta Quest Browser and allow immersive access.',
    );
  }
});
async function checkVR() {
  try {
    const supported = await navigator.xr?.isSessionSupported('immersive-vr');
    $('vr').disabled = !supported;
    $('vr').textContent = supported ? 'Enter VR' : 'Desktop mode';
  } catch {
    $('vr').textContent = 'Desktop mode';
  }
}
world.scene.addEventListener('loaded', checkVR);
checkVR();
refresh();
updateWelcome();
