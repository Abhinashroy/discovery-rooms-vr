import './game.css';
import { LESSONS, lessonById, initialExhibit, interact, gradeChoice } from './lessons.js';
import { createWorld } from './world.js';
import { validateTutorReply } from './tutor-contract.js';

const $ = (id) => document.getElementById(id);
const state = {
  started: false,
  activeId: null,
  targetId: null,
  visited: new Set(),
  exhibits: Object.fromEntries(LESSONS.map((l) => [l.id, initialExhibit(l.id)])),
  position: { x: 0, z: 5.7 },
  aiReady: false,
  busy: false,
  history: [],
  quiz: null,
  answered: false,
  correct: 0,
  attempts: 0,
  practiceIndex: 0,
};
let toastTimer;
function hint(text, persistent = false) {
  $('game-message').textContent = text;
  clearTimeout(toastTimer);
  if (!persistent)
    toastTimer = setTimeout(() => {
      $('game-message').textContent = '';
    }, 7000);
}
const world = createWorld($('world'), {
  select: selectExhibit,
  action: doAction,
  hint,
  answer: answerQuiz,
  position(p) {
    state.position = p;
    drawMap();
    if (state.activeId)
      for (const button of $('exhibit-actions').children)
        button.disabled = world.distance(state.activeId) > 3.7;
  },
  console(action) {
    if (action === 'exit') {
      world.scene.exitVR();
      return;
    }
    if (state.aiReady)
      askTutor(
        {
          explain: 'Explain the current exhibit and suggest an action.',
          guide: 'Guide me to an exhibit I have not tried.',
          quiz: 'Give me a quiz question about the current exhibit.',
        }[action],
      );
    else if (action === 'guide') {
      guideTo(LESSONS.find((l) => !state.visited.has(l.id))?.id ?? LESSONS[0].id);
      world.setTutor(
        'Local room guide: follow the lit path or select its floor pad. Live AI is not connected.',
      );
    } else if (action === 'quiz') startPractice();
    else {
      const lesson = lessonById(state.activeId) ?? LESSONS[0];
      world.setTutor(`Exhibit guide (not live AI): ${lesson.meaning} ${lesson.task}`);
    }
  },
  immersive(value) {
    document.body.classList.toggle('immersive', value);
    if (value) enterRoom();
    else updatePause();
  },
});

function enterRoom() {
  if (state.started) return;
  state.started = true;
  world.start();
  $('welcome').hidden = true;
  $('reticle').hidden = false;
  $('objective').hidden = false;
  $('bottom-bar').hidden = false;
  guideTo('stack');
  hint(
    'Follow the glowing path to Stack. Walk with WASD, look by dragging the mouse, and press E near an exhibit.',
  );
}
function updatePause() {
  world.pause(!$('tutor-panel').hidden || !$('quiz-panel').hidden);
}
function togglePanel(id, open = $(id).hidden) {
  $(id).hidden = !open;
  if (open && document.pointerLockElement) document.exitPointerLock();
  updatePause();
}
function guideTo(id) {
  const lesson = lessonById(id);
  if (!lesson) return;
  state.targetId = id;
  world.guide(id);
  $('objective-text').textContent = `Follow the path to ${lesson.title}`;
  drawMap();
  hint(`The path to ${lesson.title} is lit. Walk there or select its colored floor pad.`);
}
function selectExhibit(id) {
  const lesson = lessonById(id);
  if (!lesson) return;
  state.activeId = id;
  $('exhibit-panel').hidden = false;
  $('exhibit-title').textContent = lesson.title;
  $('exhibit-number').textContent = `EXHIBIT ${LESSONS.indexOf(lesson) + 1} / 6`;
  $('exhibit-meaning').textContent = lesson.meaning;
  $('exhibit-task').textContent = lesson.task;
  $('exhibit-message').textContent = state.exhibits[id].message;
  $('exhibit-actions').replaceChildren(
    ...lesson.actions.map(([action, label]) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.disabled = world.distance(id) > 3.7;
      button.addEventListener('click', () => doAction(id, action));
      return button;
    }),
  );
  world.setTutor(`${lesson.title}: ${lesson.meaning} ${lesson.task}`);
}
function doAction(id, action) {
  if (world.distance(id) > 3.7)
    return hint('Walk closer to the exhibit or select its colored floor pad.');
  state.exhibits[id] = interact(state.exhibits[id], action);
  world.renderExhibit(state.exhibits[id]);
  state.visited.add(id);
  selectExhibit(id);
  $('exhibit-message').textContent = state.exhibits[id].message;
  world.setTutor(state.exhibits[id].message);
  $('progress').textContent = `${state.visited.size} / 6 tried`;
  $('progress-bar').style.width = `${(state.visited.size / 6) * 100}%`;
  if (state.visited.size === 6) $('objective-text').textContent = 'All six tried. Ask for a quiz!';
  drawMap();
}
function drawMap() {
  const canvas = $('minimap'),
    ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 300, 260);
  ctx.fillStyle = '#0c222e';
  ctx.fillRect(0, 0, 300, 260);
  const px = (x) => 150 + x * 19,
    pz = (z) => 130 + z * 17;
  ctx.strokeStyle = '#34545f';
  ctx.strokeRect(17, 11, 266, 238);
  for (const lesson of LESSONS) {
    ctx.fillStyle = lesson.id === state.targetId ? '#edfff8' : lesson.color;
    ctx.fillRect(px(lesson.x) - 20, pz(lesson.z) - 9, 40, 18);
    ctx.fillStyle = '#cbe1e8';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${state.visited.has(lesson.id) ? '✓ ' : ''}${lesson.title}`,
      px(lesson.x),
      pz(lesson.z) - 16,
    );
  }
  ctx.beginPath();
  ctx.arc(px(state.position.x), pz(state.position.z), 6, 0, Math.PI * 2);
  ctx.fillStyle = '#a3f1d3';
  ctx.fill();
  ctx.fillText('YOU', px(state.position.x), pz(state.position.z) + 17);
}
for (const lesson of LESSONS) {
  const button = document.createElement('button');
  button.textContent = lesson.title;
  button.addEventListener('click', () => {
    enterRoom();
    guideTo(lesson.id);
    hint(`Path to ${lesson.title} is lit. Walk there or select its floor pad.`);
  });
  $('map-links').append(button);
}

function showQuiz(question, source) {
  state.quiz = question;
  state.answered = false;
  $('quiz-source').textContent = source;
  $('quiz-question').textContent = question.question;
  $('quiz-feedback').textContent = '';
  $('quiz-options').replaceChildren(
    ...question.options.map((option, index) => {
      const button = document.createElement('button');
      button.textContent = `${index + 1}. ${option}`;
      button.addEventListener('click', () => answerQuiz(index));
      return button;
    }),
  );
  $('quiz-score').textContent =
    `This visit: ${state.correct} correct / ${state.attempts} answered. Practice feedback only.`;
  togglePanel('quiz-panel', true);
  world.setTutor(question.question, question);
}
function startPractice() {
  const lesson = LESSONS[state.practiceIndex++ % LESSONS.length];
  showQuiz(lesson, 'AUTHORED PRACTICE QUESTION · NO AI REQUIRED');
}
function answerQuiz(index) {
  if (!state.quiz || state.answered) return;
  const result = gradeChoice(state.quiz, index);
  state.answered = true;
  state.attempts++;
  if (result.correct) state.correct++;
  const text = `${result.correct ? 'Correct.' : 'Not quite.'} ${result.explanation}`;
  $('quiz-feedback').textContent = text;
  for (const button of $('quiz-options').children) button.disabled = true;
  $('quiz-score').textContent =
    `This visit: ${state.correct} correct / ${state.attempts} answered. Practice feedback only.`;
  world.setTutor(text);
}
function addChat(role, text, label = role === 'user' ? 'YOU' : 'ROOM TUTOR') {
  const entry = document.createElement('div');
  entry.className = `chat-entry ${role}`;
  const heading = document.createElement('small');
  heading.textContent = label;
  entry.append(heading, document.createTextNode(text));
  $('chat-log').append(entry);
  entry.scrollIntoView({ block: 'nearest' });
  return entry;
}
async function askTutor(message) {
  if (state.busy || !message?.trim()) return;
  addChat('user', message);
  if (!state.aiReady) {
    const text =
      'Live AI is not connected. Set OPENAI_API_KEY and OPENAI_MODEL in the server .env file, then restart. You can still use the Room map, all six exhibits and the authored Practice quiz.';
    addChat('assistant', text, 'CONNECTION STATUS');
    world.setTutor(
      'Live AI is not connected. The local exhibits, guide and practice questions still work.',
    );
    return;
  }
  state.busy = true;
  $('chat-send').disabled = true;
  world.setTutor('The live tutor is thinking…');
  try {
    const response = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(50000),
      body: JSON.stringify({
        message,
        activeId: state.activeId,
        exhibitState: state.activeId ? state.exhibits[state.activeId] : null,
        visited: [...state.visited],
        history: state.history.slice(-8),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The tutor request failed.');
    const answer = validateTutorReply({
      message: result.message,
      targetId: result.targetId,
      quiz: result.quiz,
    });
    $('ai-status').textContent = `Live AI connected · ${result.model}`;
    const entry = addChat('assistant', answer.message, `LIVE AI · ${result.model}`);
    state.history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: answer.message },
    );
    state.history = state.history.slice(-8);
    world.setTutor(answer.message);
    if (answer.targetId) {
      guideTo(answer.targetId);
      const button = document.createElement('button');
      button.textContent = `Follow path to ${lessonById(answer.targetId).title}`;
      button.addEventListener('click', () => togglePanel('tutor-panel', false));
      entry.append(document.createElement('br'), button);
    }
    if (answer.quiz) showQuiz(answer.quiz, `AI-GENERATED QUESTION · ${result.model}`);
  } catch (error) {
    const text = error.name === 'TimeoutError' ? 'The tutor timed out. Try again.' : error.message;
    addChat('assistant', text, 'CONNECTION ERROR');
    world.setTutor(text);
  } finally {
    state.busy = false;
    $('chat-send').disabled = false;
  }
}
async function checkAI() {
  try {
    const response = await fetch('/api/tutor/status');
    if (!response.ok) throw new Error();
    const info = await response.json();
    state.aiReady = info.ready === true;
    $('ai-status').textContent = state.aiReady
      ? `Live AI configured · ${info.model} · first answer verifies access`
      : 'Live AI not connected · exhibits and practice quiz are available';
    $('ai-status').classList.toggle('ready', state.aiReady);
  } catch {
    $('ai-status').textContent =
      'AI server unavailable · start with npm run dev or npm run preview';
  }
}
async function checkVR() {
  let supported = false;
  try {
    supported = Boolean(navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr')));
  } catch {}
  $('vr-button').disabled = !supported;
  $('vr-button').textContent = supported ? 'Enter VR' : 'VR headset not detected';
  $('vr-button').title = 'Use a compatible headset browser over HTTPS. Desktop play works here.';
}

$('enter-button').addEventListener('click', enterRoom);
$('map-toggle').addEventListener('click', () => {
  enterRoom();
  togglePanel('map-panel');
});
$('map-close').addEventListener('click', () => togglePanel('map-panel', false));
$('tutor-toggle').addEventListener('click', () => {
  enterRoom();
  togglePanel('tutor-panel');
});
$('tutor-close').addEventListener('click', () => togglePanel('tutor-panel', false));
$('exhibit-close').addEventListener('click', () => {
  $('exhibit-panel').hidden = true;
});
$('exhibit-ask').addEventListener('click', () => {
  togglePanel('tutor-panel', true);
  askTutor(
    `Explain ${lessonById(state.activeId).title} using this exhibit and suggest something to try.`,
  );
});
$('quiz-toggle').addEventListener('click', () => {
  enterRoom();
  startPractice();
});
$('quiz-next').addEventListener('click', startPractice);
$('quiz-close').addEventListener('click', () => {
  togglePanel('quiz-panel', false);
  state.quiz = null;
  world.setTutor('Continue exploring, or ask for another question.');
});
$('quiz-ai').addEventListener('click', () => {
  togglePanel('quiz-panel', false);
  togglePanel('tutor-panel', true);
  askTutor('Give me another quiz question about the room topics.');
});
$('chat-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = $('chat-input').value.trim();
  if (text) {
    $('chat-input').value = '';
    askTutor(text);
  }
});
document
  .querySelectorAll('[data-prompt]')
  .forEach((button) => button.addEventListener('click', () => askTutor(button.dataset.prompt)));
$('mouse-lock').addEventListener('click', () => {
  if (document.pointerLockElement) {
    document.exitPointerLock();
    return;
  }
  try {
    const pending = world.scene.canvas.requestPointerLock();
    pending?.catch(() =>
      hint('Mouse capture is unavailable here. Drag the mouse to look, or use arrow keys.'),
    );
  } catch {
    hint('Drag the mouse to look, or use arrow keys.');
  }
});
document.addEventListener('pointerlockchange', () => {
  $('mouse-lock').textContent = document.pointerLockElement
    ? 'Release mouse (Esc)'
    : 'Capture mouse';
});
$('help-button').addEventListener('click', () =>
  hint(
    'WASD walks; arrows turn; drag mouse looks; E opens the nearest exhibit. Click its buttons to experiment. M opens the map, T the tutor. VR: left stick moves, right stick snap-turns, trigger selects floor pads/buttons, Exit VR leaves immersion.',
    true,
  ),
);
$('vr-button').addEventListener('click', async () => {
  enterRoom();
  try {
    await world.scene.enterVR();
  } catch (error) {
    hint(`Could not enter VR: ${error.message}`);
  }
});
window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.code.startsWith('Arrow')) event.preventDefault();
  if (event.repeat) return;
  if (event.code === 'Escape') {
    togglePanel('tutor-panel', false);
    togglePanel('quiz-panel', false);
    togglePanel('map-panel', false);
    state.quiz = null;
    world.setTutor('Continue exploring, or ask for another question.');
    return;
  }
  if (!state.started) return;
  if (event.code === 'KeyT') {
    event.preventDefault();
    togglePanel('tutor-panel');
  }
  if (event.code === 'KeyM') {
    event.preventDefault();
    togglePanel('map-panel');
  }
  if (event.code === 'KeyE') {
    event.preventDefault();
    const nearest = world.nearest();
    if (world.distance(nearest.id) < 3.7) selectExhibit(nearest.id);
    else hint('Walk closer to an exhibit, then press E.');
  }
});
world.scene.addEventListener('loaded', () => hint('Room ready. Enter to explore.'));
checkAI();
checkVR();
drawMap();
addChat(
  'assistant',
  'Walk up to an exhibit and try its controls. With live AI connected, ask me why something happens, request a guided path, or ask for a quiz.',
  'WELCOME',
);
