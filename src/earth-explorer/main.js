import './style.css';
import { DAY, clock, modelAt, sunlight, geoVector, dot } from './astronomy.js';
import { surfaceFrame, countryAt } from './geography.js';
import { COUNTRIES, COUNTRY_BY_ID, matchesCountry } from './countries.js';
import { newEarthSession, reduceEarth, activeQuestion, quizScore } from './state.js';
import { createEarthAudio } from './audio.js';
import { createEarthWorld } from './world.js';
import { freshEntry, changeRoom } from '../rooms/routes.js';
const $ = (id) => document.getElementById(id),
  seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let state = newEarthSession(seed()),
  panel = null,
  timeOpen = true,
  busy = false,
  phase,
  readoutTime = 0;
const timers = new Set();
let settings = {
  stationary: false,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  large: false,
  mapLight: true,
  paths: true,
  axis: false,
  muted: false,
};
try {
  const shared = JSON.parse(localStorage.getItem('classroom-comfort') || '{}'),
    saved = JSON.parse(localStorage.getItem('earth-display') || '{}');
  for (const k of Object.keys(settings)) {
    const v = Object.hasOwn(saved, k) ? saved[k] : shared[k];
    if (typeof v === 'boolean') settings[k] = v;
  }
} catch {}
const audio = createEarthAudio(
  (text) => {
    $('sound-status').textContent = text;
    $('sound-status').hidden = !text;
  },
  (name) => {
    $('room').dataset[name + 'Count'] = String(Number($('room').dataset[name + 'Count'] || 0) + 1);
  },
);
audio.setMuted(settings.muted);
const room = createEarthWorld($('room'), {
  action: act,
  gesture() {
    audio.unlock();
  },
  walk(distance) {
    audio.walk(distance);
  },
  assets({ ready, error }) {
    $('load-status').hidden = ready;
    $('load-status').textContent = error
      ? 'A local globe asset could not load. Refresh to retry.'
      : 'Loading local globe and country map…';
    $('quiz-button').disabled = !ready;
  },
  immersive(value) {
    document.body.classList.toggle('immersive', value);
    closeDialogs();
    if (!value && panel) {
      if (panel === 'time') {
        timeOpen = true;
        room.pause(false);
        panel = null;
      } else if (panel === 'leave-confirm') {
        panel = 'activity';
        $('leave-warning').hidden = false;
        dialogFor(panel).showModal();
      } else if (panel !== 'country') dialogFor(panel)?.showModal();
    } else if (value && timeOpen && !panel) {
      timeOpen = false;
    }
  },
  tick(dt) {
    const next = reduceEarth(state, { type: 'tick', elapsed: dt });
    if (next !== state) {
      state = next;
      room.setState(state);
    }
    readoutTime += dt;
    if (readoutTime > 0.15) {
      readoutTime = 0;
      updateClock();
    }
  },
  location(location) {
    state = reduceEarth(state, { type: 'location', location });
    room.setState(state);
  },
  teleport(location, step = false) {
    transition(() => {
      state = reduceEarth(state, { type: 'location', location });
      room.setState(state);
      render();
      if (step) audio.step();
    });
  },
  pick(feature) {
    if (COUNTRY_BY_ID[feature.id]) dispatch({ type: 'select', id: feature.id });
    else {
      $('feedback').textContent =
        feature.name +
        ' · Mapped territory or region. Open Countries for the full learning collection.';
      $('feedback').hidden = false;
    }
  },
  hover(text) {
    $('focus-country').textContent = text;
  },
  readout: updateLocation,
});
freshEntry(() => room.scene);
function updateLocation(location, features) {
  const here = countryAt(features, location.lat, location.lon);
  $('current-place').textContent = here?.properties.name || 'Ocean';
  $('coordinates').textContent =
    Math.abs(location.lat).toFixed(1) +
    '°' +
    (location.lat < 0 ? 'S' : 'N') +
    ' · ' +
    Math.abs(location.lon).toFixed(1) +
    '°' +
    (location.lon < 0 ? 'W' : 'E');
  $('light-readout').textContent =
    sunlight(state.timestamp, location.lat, location.lon).label +
    (settings.mapLight ? ' · Map light' : '');
  drawMini(location, features);
}

function save() {
  try {
    localStorage.setItem('earth-display', JSON.stringify(settings));
  } catch {}
}
function later(fn, delay) {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, delay);
  timers.add(id);
}
function transition(fn) {
  if (busy) return;
  audio.stopAll();
  busy = true;
  document.body.classList.add('transitioning');
  later(
    () => {
      fn();
      later(
        () => {
          document.body.classList.remove('transitioning');
          busy = false;
        },
        settings.reduced ? 20 : 140,
      );
    },
    settings.reduced ? 20 : 140,
  );
}
const dialogFor = (mode) =>
  $(
    mode === 'mode'
      ? 'mode-dialog'
      : mode === 'countries'
        ? 'countries'
        : mode === 'activity'
          ? 'activity'
          : 'menu',
  );
function closeDialogs() {
  for (const id of ['menu', 'mode-dialog', 'countries', 'activity']) $(id).close();
}
function close() {
  panel = null;
  closeDialogs();
  room.pause(false);
  if (state.phase !== 'explore') open('activity');
}
function open(mode) {
  audio.stopAll();
  closeDialogs();
  panel = mode;
  room.pause(true, mode);
  if (!room.immersive && mode !== 'country' && mode !== 'time') {
    const d = dialogFor(mode);
    d.showModal();
    (d.querySelector('[tabindex="-1"]') || d.querySelector('button'))?.focus();
  }
}
function dispatch(action) {
  const before = state;
  state = reduceEarth(state, action);
  if (state === before) return;
  render();
  if (state.phase === 'quiz' || state.phase === 'result') open('activity');
  else if (action.type === 'select' && room.immersive) open('country');
  if (before.phase === 'quiz' && state.phase === 'result') audio.celebrate();
}
function act(action) {
  if (busy) return;
  const [type, id, qid] = action.split(':');
  if (type === 'room') {
    audio.stopAll();
    room.pause(true);
    changeRoom(id, room.scene, () => {
      timers.forEach(clearTimeout);
      timers.clear();
      room.dispose();
    });
    return;
  }
  if (type === 'menu') {
    open('menu');
    return;
  }
  if (type === 'close') {
    close();
    return;
  }
  if (type === 'activity') {
    $('leave-warning').hidden = true;
    open('activity');
    return;
  }
  if (type === 'mode-panel') {
    open(state.phase === 'explore' ? 'mode' : 'activity');
    return;
  }
  if (['countries', 'comfort', 'controls'].includes(type)) {
    if (state.phase !== 'explore') {
      open('activity');
      return;
    }
    open(type);
    return;
  }
  if (type === 'hide-time') {
    timeOpen = false;
    render();
    return;
  }
  if (type === 'country-page') {
    room.countryPage(Number(id));
    return;
  }
  if (type === 'time') {
    if (state.phase !== 'explore') {
      open('activity');
      return;
    }
    if (room.immersive) open('time');
    else {
      close();
      timeOpen = !timeOpen;
      render();
    }
    return;
  }
  if (type === 'mode' && state.phase === 'explore') {
    transition(() => {
      closeDialogs();
      panel = null;
      state = reduceEarth(state, { type, id });
      room.pause(false);
      timeOpen = id === 'orbit';
      render();
    });
    return;
  }
  if (type === 'view') {
    if (state.phase !== 'explore') {
      open('activity');
      return;
    }
    transition(() => {
      state = reduceEarth(state, { type: 'mode', id: 'orbit' });
      close();
      render();
      room.view(id);
    });
    return;
  }
  if (type === 'visit' || type === 'land') {
    if (state.phase !== 'explore') return;
    transition(() => {
      state = reduceEarth(state, { type: 'land', id });
      if (type === 'visit') state = reduceEarth(state, { type: 'select', id });
      timeOpen = false;
      close();
      render();
      if (room.immersive && state.card) open('country');
    });
    return;
  }
  if (type === 'select') {
    dispatch({ type, id });
    if (!room.immersive) close();
    return;
  }
  if (type === 'close-card') {
    dispatch({ type });
    close();
    return;
  }
  if (['stationary', 'reduced', 'large', 'mapLight', 'paths', 'axis', 'muted'].includes(type)) {
    settings[type] = !settings[type];
    if (type === 'muted') audio.setMuted(settings.muted);
    if (type === 'stationary') audio.stopAll();
    save();
    render();
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
  if (type === 'exit-vr') {
    room.scene.exitVR();
    return;
  }
  if (type === 'body') {
    $('feedback').textContent =
      id === 'moon'
        ? 'The Moon orbits Earth. Its visible phase follows sunlight.'
        : 'The Sun lights Earth and the Moon. Use Time to watch the changes.';
    return;
  }
  if (type === 'quiz-start') {
    if (!room.ready) {
      $('feedback').textContent = 'Wait for the local map to load before starting the quiz.';
      return;
    }
    if (state.visited.length < 5) {
      timeOpen = false;
      dispatch({ type });
      if (room.immersive) open('countries');
      else {
        $('feedback').focus();
      }
      return;
    }
    transition(() => {
      timeOpen = false;
      dispatch({ type, seed: seed() });
    });
    return;
  }
  if (type === 'choose') {
    dispatch({ type, id: activeQuestion(state)?.choices[Number(id)], question: qid });
    return;
  }
  if (['confirm', 'next'].includes(type)) {
    dispatch({ type, question: id });
    return;
  }
  if (type === 'leave-request') {
    if (state.answers.length === 0) {
      dispatch({ type: 'leave-quiz' });
      close();
    } else if (room.immersive) open('leave-confirm');
    else $('leave-warning').hidden = false;
    return;
  }
  if (type === 'leave-quiz') {
    dispatch({ type });
    $('leave-warning').hidden = true;
    close();
    return;
  }
  if (type === 'show-country') {
    transition(() => {
      closeDialogs();
      panel = null;
      dispatch({ type, id });
      room.pause(false);
      if (room.immersive) open('country');
    });
    return;
  }
  if (type === 'explore') {
    dispatch({ type });
    close();
    return;
  }
  if (type === 'last-result') {
    timeOpen = false;
    dispatch({ type });
    return;
  }
  if (type === 'step-hour') {
    dispatch({ type: 'step-hour', value: Number(id) });
    return;
  }
  if (type === 'cycle-speed') {
    const speeds = [DAY / 20, DAY / 8, DAY, DAY * 3];
    dispatch({ type: 'speed', value: speeds[(speeds.indexOf(state.speed) + 1) % speeds.length] });
    return;
  }
  if (['step-day', 'year'].includes(type)) {
    dispatch({ type, value: Number(id) });
    return;
  }
  if (type === 'play') {
    dispatch({ type });
    return;
  }
}
function makeButton(text, action) {
  const b = document.createElement('button');
  b.textContent = text;
  b.dataset.action = action;
  return b;
}
function updateClock() {
  const c = clock(state.timestamp);
  $('date-readout').textContent = c.date;
  $('compact-clock').textContent = c.date + ' · ' + c.time + ' UTC';
  $('time-readout').textContent = c.time + ' UTC';
  $('day-readout').textContent = 'Day ' + c.day + ' / ' + c.days;
  $('hour-readout').textContent = c.time;
  $('day-range').max = c.days;
  $('day-range').value = c.day;
  $('hour-range').value = c.minutes;
  $('date').value = c.date;
  if (!$('year').querySelector('option[value="' + c.year + '"]')) {
    const o = document.createElement('option');
    o.value = c.year;
    o.textContent = c.year;
    $('year').append(o);
  }
  $('year').value = c.year;
  $('speed').value = state.speed;
  $('speed').disabled = state.mode !== 'orbit';
  $('time-play').disabled = state.mode !== 'orbit';
  for (const id of ['pause', 'time-play'])
    $(id).textContent = state.playing ? 'Pause' : 'Play time';
  $('moon-readout').textContent =
    'Moon illuminated: ' +
    Math.round(modelAt(state.timestamp).lit * 100) +
    '% · Approximate teaching model';
}
function renderCountries() {
  const search = $('country-search').value.trim().toLowerCase(),
    list = COUNTRIES.filter((c) => matchesCountry(c, search));
  $('country-list').replaceChildren();
  $('no-countries').hidden = list.length > 0;
  $('explored-count').textContent =
    state.visited.length +
    ' / ' +
    COUNTRIES.length +
    ' country cards explored. Open five to unlock a quiz.';
  for (const c of list) {
    const row = document.createElement('div'),
      text = document.createElement('div');
    row.className = 'country-row';
    const title = document.createElement('strong'),
      note = document.createElement('small');
    title.textContent = c.name + (state.visited.includes(c.id) ? ' ✓' : '');
    note.textContent = c.continent;
    text.append(title, note);
    row.append(
      text,
      makeButton('Visit ' + c.name, 'visit:' + c.id),
      makeButton('Read ' + c.name, 'select:' + c.id),
    );
    $('country-list').append(row);
  }
}
function render() {
  room.render(state, settings);
  updateLocation(state.location, room.features);
  document.body.dataset.mode = state.mode;
  document.body.classList.toggle('time-open', timeOpen && state.phase === 'explore');
  document.body.dataset.phase = state.phase;
  document.body.classList.toggle('large', settings.large);
  $('mode-label').textContent = state.mode === 'orbit' ? 'ORBIT OBSERVATORY' : 'GLOBE EXPLORER';
  $('goal').textContent =
    state.mode === 'orbit' ? 'See Earth in motion.' : 'A few steps. A whole world.';
  $('feedback').textContent = state.message;
  $('feedback').hidden = !state.message;
  $('chapter').textContent =
    state.mode === 'orbit'
      ? 'ONE EARTH · TWO PERSPECTIVES'
      : state.visited.length + ' / ' + COUNTRIES.length + ' COUNTRIES EXPLORED';
  $('focus-country').textContent =
    state.mode === 'globe'
      ? 'WASD travel · Drag look · E select · M menu'
      : 'Drag to orbit · Scroll to zoom';
  $('pause').hidden = state.mode !== 'orbit';
  $('explore-here').hidden = state.mode !== 'orbit';
  $('map-overview').hidden = state.mode !== 'globe' || state.phase !== 'explore';
  $('time-panel').hidden = !timeOpen || state.phase !== 'explore';
  $('time-button').hidden = false;
  $('clock-mini').hidden = timeOpen || state.phase !== 'explore';
  $('sound').textContent = settings.muted ? 'Sound off' : 'Sound on';
  $('sound-menu').textContent = settings.muted ? 'Sound: off' : 'Sound: on';
  $('quiz-button').textContent =
    state.visited.length < 5 ? 'Quiz · ' + state.visited.length + ' / 5 explored' : 'Country quiz';
  $('last-result').hidden = !state.completed;
  const c = COUNTRY_BY_ID[state.card];
  $('country-card').hidden = !c || state.phase !== 'explore';
  if (c) {
    $('country-name').textContent = c.name;
    $('country-continent').textContent = c.continent;
    $('country-fact').textContent = c.fact;
    $('country-source').href = c.factSource;
    $('land-country').dataset.action = 'land:' + c.id;
  }
  for (const [id, key, label] of [
    ['map-light', 'mapLight', 'Map light'],
    ['reduced', 'reduced', 'Reduced motion'],
    ['large', 'large', 'Larger text'],
    ['paths', 'paths', 'Orbit paths'],
    ['axis', 'axis', 'Earth axis'],
  ])
    $(id).textContent = label + ': ' + (settings[key] ? 'on' : 'off');
  $('stationary').textContent = settings.stationary ? 'Enable walking' : 'Use stationary travel';
  updateClock();
  renderCountries();
  renderQuiz();
  if (state.phase !== phase) {
    $('goal').focus();
    phase = state.phase;
  }
}
function renderQuiz() {
  const q = activeQuestion(state),
    quiz = state.phase === 'quiz';
  $('quiz-options').replaceChildren();
  $('quiz-review').replaceChildren();
  for (const id of ['confirm', 'next', 'explore', 'leave-quiz']) $(id).hidden = true;
  $('quiz-fact').hidden = !quiz || !q?.fact;
  if (quiz) {
    const locked = state.answers.length > state.question;
    $('activity-chapter').textContent =
      'COUNTRY QUIZ · ' + (state.question + 1) + ' / 5 · ' + q.type.toUpperCase();
    $('activity-title').textContent = q.prompt;
    $('activity-text').textContent = locked
      ? 'Answer recorded. Continue when ready.'
      : 'Choose one of four, then confirm.';
    $('quiz-fact').textContent = q.fact || '';
    q.choices.forEach((id, i) => {
      const b = makeButton(
        String.fromCharCode(65 + i) + '. ' + (q.type === 'continent' ? id : COUNTRY_BY_ID[id].name),
        'choose:' + i + ':' + q.id,
      );
      b.setAttribute('aria-pressed', String(state.choice === id));
      b.disabled = locked;
      $('quiz-options').append(b);
    });
    $('confirm').hidden = locked;
    $('confirm').disabled = !state.choice;
    $('confirm').dataset.action = 'confirm:' + q.id;
    $('next').hidden = !locked;
    $('next').textContent = state.question === 4 ? 'Show final score' : 'Next question';
    $('next').dataset.action = 'next:' + q.id;
    $('leave-quiz').hidden = false;
  }
  if (state.phase === 'result') {
    $('activity-chapter').textContent = 'COUNTRY QUIZ COMPLETE';
    $('activity-title').textContent = 'Your score: ' + quizScore(state) + ' / 5';
    $('activity-text').textContent = 'Review your answers, then revisit places on the globe.';
    state.queue.forEach((q, i) => {
      const a = state.answers[i],
        c = COUNTRY_BY_ID[q.target],
        row = document.createElement('div'),
        title = document.createElement('strong'),
        p = document.createElement('p');
      row.className = 'review-row ' + (a.correct ? 'correct' : 'incorrect');
      title.textContent = i + 1 + '. ' + q.prompt;
      p.textContent =
        (a.correct ? 'Correct ✓' : 'Incorrect ✕') +
        ' · Your answer: ' +
        (q.type === 'continent' ? a.choice : COUNTRY_BY_ID[a.choice].name) +
        ' · Correct answer: ' +
        (q.type === 'continent' ? q.answer : c.name) +
        '. ' +
        (q.type === 'fact' ? q.fact : c.name + ' is shown in ' + c.continent + '.');
      row.append(title, p, makeButton('Show ' + c.name + ' on globe', 'show-country:' + c.id));
      $('quiz-review').append(row);
    });
    $('explore').hidden = false;
  }
}
let miniKey = '';
const miniRings = new WeakMap();
function drawMini(location, features) {
  if (state.mode !== 'globe' || state.phase !== 'explore') return;
  const key = location.lat + ',' + location.lon + ',' + features.length;
  if (key === miniKey) return;
  miniKey = key;
  const canvas = $('mini-globe'),
    x = canvas.getContext('2d'),
    f = surfaceFrame(location);
  x.clearRect(0, 0, 180, 180);
  x.fillStyle = '#0a2f48';
  x.beginPath();
  x.arc(90, 90, 77, 0, Math.PI * 2);
  x.fill();
  x.save();
  x.beginPath();
  x.arc(90, 90, 77, 0, Math.PI * 2);
  x.clip();
  x.strokeStyle = '#7daea5';
  x.lineWidth = 0.6;
  for (const feature of features) {
    const polys =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const rings of polys)
      for (const ring of rings) {
        x.beginPath();
        let pen = false;
        let vectors = miniRings.get(ring);
        if (!vectors) {
          const stride = Math.max(1, Math.floor(ring.length / 120));
          vectors = ring
            .filter((p, i) => i % stride === 0 || i === ring.length - 1)
            .map(([lon, lat]) => geoVector(lat, lon));
          miniRings.set(ring, vectors);
        }
        for (const n of vectors) {
          const visible = dot(n, f.normal) > 0;
          if (visible) {
            const a = 90 + dot(n, f.east) * 77,
              b = 90 - dot(n, f.north) * 77;
            pen ? x.lineTo(a, b) : x.moveTo(a, b);
          }
          pen = visible;
        }
        x.stroke();
      }
  }
  x.restore();
  x.fillStyle = '#ffd875';
  x.beginPath();
  x.arc(90, 90, 4, 0, Math.PI * 2);
  x.fill();
}
for (let y = 2020; y <= 2035; y++) {
  const o = document.createElement('option');
  o.value = y;
  o.textContent = y;
  $('year').append(o);
}
for (const [id, type] of [
  ['year', 'year'],
  ['date', 'date'],
  ['day-range', 'day'],
  ['hour-range', 'minutes'],
  ['speed', 'speed'],
])
  $(id).addEventListener(id.includes('range') ? 'input' : 'change', (e) =>
    dispatch({ type, value: type === 'date' ? e.target.value : Number(e.target.value) }),
  );
$('country-search').addEventListener('input', renderCountries);
document.addEventListener('pointerdown', () => audio.unlock());
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-action]');
  if (b && !b.disabled) act(b.dataset.action);
});
for (const id of ['menu', 'countries', 'mode-dialog', 'activity'])
  $(id).addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
window.addEventListener('pagehide', () => {
  audio.stopAll();
  timers.forEach(clearTimeout);
  timers.clear();
  room.dispose();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.stopAll();
});
window.addEventListener('blur', () => {
  audio.stopAll();
  if (state.playing) {
    state = { ...state, playing: false };
    room.setState(state);
    updateClock();
  }
});
async function checkVR() {
  try {
    const supported = await navigator.xr?.isSessionSupported('immersive-vr');
    $('vr').disabled = !supported;
    $('vr').textContent = supported ? 'Enter VR' : 'VR unavailable here';
  } catch {
    $('vr').textContent = 'VR unavailable here';
  }
}
room.scene.addEventListener('loaded', checkVR);
checkVR();
render();
open('mode');
