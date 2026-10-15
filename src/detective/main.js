import './style.css';
import { newCase, reduceCase, OBJECTS, CHANGE_COUNT } from './state.js';
import { createRoom } from './world.js';
import { createGameAudio } from './audio.js';
import { freshEntry, changeRoom } from '../rooms/routes.js';
freshEntry(() => room.scene);
const $ = (id) => document.getElementById(id),
  seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let state = newCase(seed()),
  changeTimer,
  renderedPhase,
  menuOpen = false;
let settings = {
  muted: false,
  stationary: false,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  large: false,
};
try {
  const stored = JSON.parse(localStorage.getItem('classroom-comfort') || 'null');
  for (const k of Object.keys(settings))
    if (typeof stored?.[k] === 'boolean') settings[k] = stored[k];
} catch {}
const sounds = createGameAudio(
  (message) => {
    $('sound-status').textContent = message;
  },
  (name) => {
    const status = $('sound-status');
    status.dataset.lastSound = name;
    status.dataset[name] = String(Number(status.dataset[name] || 0) + 1);
  },
);
sounds.setMuted(settings.muted);
const room = createRoom($('room'), {
  action: act,
  walk: (distance) => sounds.walk(distance),
  immersive(v) {
    document.body.classList.toggle('immersive', v);
    if (v) {
      $('menu').close();
      if (state.phase === 'intro') dispatch({ type: 'start' });
    } else if (menuOpen && !$('menu').open) $('menu').showModal();
  },
});
for (const [id, name] of Object.entries(OBJECTS)) {
  const b = document.createElement('button');
  b.id = 'choose-' + id;
  b.dataset.action = 'guess:' + id;
  b.textContent = name;
  $('object-controls').append(b);
}
function save() {
  try {
    localStorage.setItem('classroom-comfort', JSON.stringify(settings));
  } catch {}
}
function dispatch(a) {
  if (a.type === 'ready') a = { ...a, player: room.position() };
  clearTimeout(changeTimer);
  const count = state.found.length,
    phase = state.phase;
  state = reduceCase(state, a);
  render();
  if ((a.type === 'start' && phase === 'intro') || a.type === 'restart') sounds.start();
  if (state.found.length > count) sounds.celebrate();
  if (state.phase === 'complete' && menuOpen) {
    closeMenu();
    $('again').focus();
  }
  if (a.type === 'restart') room.reset();
  if (state.phase === 'change') {
    sounds.stopWalking();
    changeTimer = setTimeout(() => dispatch({ type: 'changed' }), 700);
  }
}
function closeMenu() {
  menuOpen = false;
  room.panel(false);
  $('menu').close();
  $('menu-button').focus();
}
function openMenu() {
  if (state.phase === 'intro' || state.phase === 'change') return;
  sounds.stopWalking();
  menuOpen = true;
  room.panel(true);
  if (!room.immersive && !$('menu').open) {
    $('menu').showModal();
    $('menu-title').focus();
  }
}
function act(action) {
  const [type, id] = action.split(':');
  if (type === 'room') {
    clearTimeout(changeTimer);
    room.panel(true);
    changeRoom(id, room.scene, () => sounds.stopAll());
    return;
  }
  if (type === 'menu') {
    menuOpen ? closeMenu() : openMenu();
    return;
  }
  if (type === 'close') {
    closeMenu();
    return;
  }
  if (type === 'view') {
    room.moveTo(id);
    closeMenu();
    return;
  }
  if (type === 'mute') {
    settings.muted = !settings.muted;
    sounds.setMuted(settings.muted);
    save();
    render();
    return;
  }
  if (['stationary', 'reduced', 'large'].includes(type)) {
    settings[type] = !settings[type];
    save();
    render();
    return;
  }
  if (type === 'exit-vr') {
    room.scene.exitVR();
    return;
  }
  if (type === 'vr') {
    if (state.phase === 'intro') dispatch({ type: 'start' });
    closeMenu();
    room.scene.enterVR().catch(() => {
      $('feedback').textContent =
        'VR could not start. Use Meta Quest Browser with secure HTTPS or forwarded localhost.';
    });
    return;
  }
  if (['ready', 'restart'].includes(type)) closeMenu();
  dispatch(type === 'guess' ? { type, id } : { type, seed: seed() });
}
function render() {
  sounds.setMuted(settings.muted);
  if (settings.stationary) sounds.stopWalking();
  room.render(state, settings);
  document.body.dataset.phase = state.phase;
  document.body.classList.toggle('large-text', settings.large);
  $('welcome').hidden = state.phase !== 'intro';
  $('play-controls').hidden = state.phase === 'intro';
  $('walk-controls').hidden = state.phase === 'intro';
  $('cover').hidden = state.phase !== 'change';
  const instructions = {
    intro: 'Look around. Remember. Find what moved.',
    study: 'Explore and remember the classroom.',
    change: 'The classroom is changing…',
    find: 'Four things moved. Click them to send them home.',
    complete: 'Yay! The classroom is restored!',
  };
  $('instruction').textContent = instructions[state.phase];
  $('phase-label').textContent = {
    intro: 'CLASSROOM DETECTIVE',
    study: 'LOOK & REMEMBER',
    change: 'A SMALL CHANGE',
    find: 'WHAT MOVED?',
    complete: 'CLASSROOM RESTORED',
  }[state.phase];
  $('feedback').textContent = state.message;
  $('menu-feedback').textContent = state.message;
  $('ready').hidden = state.phase !== 'study';
  $('again').hidden = state.phase !== 'complete';
  $('restart').hidden = !['study', 'find'].includes(state.phase);
  $('progress').textContent = ['find', 'complete'].includes(state.phase)
    ? `Back home ${state.found.length} of ${CHANGE_COUNT}`
    : '';
  for (const id of ['mute', 'mute-menu'])
    $(id).textContent = settings.muted ? 'Sound: off' : 'Sound: on';
  $('mute').setAttribute('aria-pressed', String(settings.muted));
  $('stationary').textContent = settings.stationary ? 'Enable walking' : 'Use stationary views';
  $('reduced').textContent = `Reduced motion: ${settings.reduced ? 'on' : 'off'}`;
  $('large').textContent = `Larger text: ${settings.large ? 'on' : 'off'}`;
  for (const id of Object.keys(OBJECTS)) {
    const b = $('choose-' + id);
    b.disabled = !['study', 'find', 'complete'].includes(state.phase);
    b.textContent = OBJECTS[id] + (state.found.includes(id) ? ' · ✓ Back home' : '');
  }
  for (const id of ['feedback', 'menu-feedback', 'progress'])
    $(id).hidden = !$(id).textContent.trim();
  $('menu-ready').hidden = state.phase !== 'study';
  $('walk-hint').textContent = settings.stationary
    ? 'Stationary mode · use Menu viewpoints'
    : 'W A S D / ↑ ↓ move · Drag to look · ← → turn · E select ahead · M menu';
  if (state.phase !== renderedPhase) {
    if (['study', 'change', 'find'].includes(state.phase)) $('instruction').focus();
    if (state.phase === 'complete') $('again').focus();
  }
  renderedPhase = state.phase;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-action]');
  if (b) act(b.dataset.action);
});
$('menu').addEventListener('cancel', (e) => {
  e.preventDefault();
  closeMenu();
});
window.addEventListener('pagehide', () => {
  clearTimeout(changeTimer);
  sounds.stopAll();
});
window.addEventListener('blur', () => sounds.stopWalking());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sounds.stopAll();
});
document.addEventListener('pointerdown', () => sounds.unlock());
document.addEventListener('keydown', () => sounds.unlock());
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
