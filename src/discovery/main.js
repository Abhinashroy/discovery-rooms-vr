import { loadPreferences, savePreferences } from './preferences.js';
import { authoredGuidance, guideContent } from './tutor-contract.js';
import { requestGuide } from './tutor-client.js';
import { PRESETS, ACCENTS } from './personalization.js';
import './discovery.css';
import { DESTINATIONS, SUPPLIES } from './adventure.js';
import { createQuest, reduceQuest } from './quest-state.js';
import { createDiscoveryWorld } from './world.js';
import { findPath, approachPoint } from './navigation.js';
import {
  taskView,
  currentTable,
  collected,
  unlocked,
  tablesFor,
  detailsFor,
  propsFor,
  isWorkshop,
  isOcean,
  titleFor,
  clueFor,
} from './content.js';

const $ = (id) => document.getElementById(id);
const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const preferences = loadPreferences(
  () => localStorage,
  matchMedia('(prefers-reduced-motion: reduce)').matches,
);
let settings = { ...preferences.comfort },
  preferencesSaved = true;
let quest = createQuest(freshSeed(), preferences.mode, preferences.adventure, preferences.profile),
  started = false,
  panelId = null,
  memoryOpen = false,
  immersive = false,
  noticeTimer,
  focusReturn = null;
let guideId = 'cargo',
  guideMode = 'explain',
  guideMessage = '',
  guideBusy = false,
  guideReady = null,
  guideSerial = 0,
  guideAbort = null,
  vrReadingPage = 0,
  vrReadingText = '';
function persistPreferences() {
  preferencesSaved = savePreferences(() => localStorage, {
    comfort: settings,
    profile: quest.profile,
    mode: quest.mode,
    adventure: quest.adventure,
  });
}
function cancelGuide() {
  guideSerial++;
  guideAbort?.abort();
  guideAbort = null;
  guideBusy = false;
}
function guideRequest() {
  return {
    adventure: quest.adventure,
    tableId: guideId,
    intent: guideMode,
    phase:
      (quest.adventure === 'space' && guideId === 'cargo'
        ? quest.phase
        : quest.tasks[guideId]?.phase) || 'available',
  };
}
async function checkGuide() {
  const serial = guideSerial;
  try {
    const r = await fetch('/api/discovery-tutor/status', { signal: AbortSignal.timeout(3000) });
    const v = r.ok ? await r.json() : {};
    if (serial !== guideSerial || panelId !== 'tutor') return;
    guideReady = v.ready === true;
  } catch {
    if (serial !== guideSerial || panelId !== 'tutor') return;
    guideReady = false;
  }
  renderPanel();
}
async function askGuide() {
  if (guideBusy || guideReady !== true || memoryOpen || panelId !== 'tutor') return;
  const serial = ++guideSerial;
  guideAbort = new AbortController();
  const controller = guideAbort,
    timer = setTimeout(() => controller.abort(), 18000);
  guideBusy = true;
  guideMessage = '';
  renderPanel();
  try {
    const message = await requestGuide(guideRequest(), { signal: controller.signal });
    if (serial === guideSerial && panelId === 'tutor' && !memoryOpen)
      guideMessage = 'Optional AI explanation: ' + message;
  } catch {
    if (serial === guideSerial && panelId === 'tutor' && !memoryOpen)
      guideMessage = 'AI could not answer. The room guide below is still available.';
  } finally {
    clearTimeout(timer);
    if (serial === guideSerial) {
      guideBusy = false;
      guideAbort = null;
      if (panelId === 'tutor') renderPanel();
    }
  }
}
let TABLES = tablesFor(quest),
  DETAILS = detailsFor(quest),
  PROPS = propsFor(quest),
  CLUE = clueFor(quest),
  pendingAdventure = null;
const treasureName = () =>
  isWorkshop(quest) ? 'machine treasure' : isOcean(quest) ? 'reef chest' : 'constellation treasure';
const drawerName = () =>
  isWorkshop(quest) ? 'Parts drawer' : isOcean(quest) ? 'Shell drawer' : 'Explorer drawer';
function refreshContent() {
  TABLES = tablesFor(quest);
  DETAILS = detailsFor(quest);
  PROPS = propsFor(quest);
  CLUE = clueFor(quest);
  document.title = `Discovery Room · ${titleFor(quest)}`;
  document.body.classList.toggle('ocean', isOcean(quest));
  document.body.classList.toggle('workshop', isWorkshop(quest));
  document.body.style.setProperty('--personal-accent', ACCENTS[quest.profile.palette]);
  document.querySelector('.planet-icon').textContent = isWorkshop(quest)
    ? '⚙'
    : isOcean(quest)
      ? '🐠'
      : '🪐';
  document.querySelector('.adventure-choice strong').textContent = titleFor(quest);
  $('room-badge').querySelector('span').textContent = titleFor(quest).toUpperCase();
  document.querySelector('.fragment-row small').textContent = titleFor(quest);
}
let position = { x: 0, z: 5.7 },
  vrButtons = [],
  vrText = [];
const shapeIcon = { circle: '●', triangle: '▲', square: '■' };
const tokenIcon = {
  Star: '✦',
  Comet: '☄',
  'Ringed planet': '🪐',
  Crystal: '◆',
  Compass: '✥',
  'Tiny rocket': '🚀',
  Moon: '☾',
  Sun: '☀',
  Rocket: '🚀',
  Diamond: '◇',
  Wave: '≈',
};
function element(tag, text, className) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function tell(text) {
  $('notice').textContent = memoryOpen ? '' : text;
  clearTimeout(noticeTimer);
  if (text) noticeTimer = setTimeout(() => ($('notice').textContent = ''), 8000);
}
const world = createDiscoveryWorld($('world'), {
  intent: handleIntent,
  hint: tell,
  position(p) {
    position = p;
    const marker = $('map-player');
    if (marker) {
      marker.setAttribute('cx', mapX(p.x));
      marker.setAttribute('cy', mapY(p.z));
    }
  },
  immersive(value) {
    immersive = value;
    document.body.classList.toggle('immersive', value);
    if (value && !started) enter();
    syncSurface();
  },
});
function applySettings() {
  for (const [key, css] of Object.entries({
    largeText: 'large-text',
    highContrast: 'high-contrast',
    reducedMotion: 'reduced-motion',
  }))
    document.body.classList.toggle(css, settings[key]);
  world.settings(settings);
  $('welcome-navigation').value = settings.stationary ? 'stationary' : 'walk';
  if (started) $('reticle').hidden = settings.stationary;
  persistPreferences();
}
function enter() {
  if (started) return;
  settings.stationary = $('welcome-navigation').value === 'stationary';
  quest = reduceQuest(quest, { type: 'mode', value: $('welcome-mode').value });
  applySettings();
  started = true;
  world.start();
  $('welcome').hidden = true;
  $('objective').hidden = false;
  $('game-footer').hidden = false;
  $('reticle').hidden = settings.stationary;
  world.guide('cargo');
  updateQuest();
  tell(
    settings.stationary
      ? `Open Mission map and choose ${TABLES[0].title}. All actions work without walking.`
      : CLUE,
  );
  document.querySelector('[data-intent="map"]').focus();
}
function closePanel() {
  cancelGuide();
  panelId = null;
  if ($('panel').open) $('panel').close();
  syncSurface();
  if (focusReturn?.isConnected) focusReturn.focus();
  else document.querySelector('[data-intent="map"]').focus();
}
function openPanel(id) {
  if (memoryOpen) return;
  if (panelId !== id) cancelGuide();
  if (!$('panel').open) focusReturn = document.activeElement;
  panelId = id;
  vrReadingPage = 0;
  renderPanel();
  if (!$('panel').open) $('panel').showModal();
  $('panel-title').focus();
  syncSurface();
}
function para(text, className) {
  vrText.push(text);
  const p = element('p', text, className);
  if (className === 'status') {
    p.setAttribute('role', 'status');
    p.setAttribute('aria-live', 'polite');
  }
  return p;
}
function button(label, intent, { disabled = false, primary = false, pressed } = {}) {
  const b = element('button', label, primary ? 'primary' : '');
  b.type = 'button';
  b.dataset.intent = intent;
  b.disabled = disabled;
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
  if (!disabled) vrButtons.push({ label, intent });
  return b;
}
function buttons(...items) {
  const row = element('div', null, 'buttons');
  row.append(...items);
  return row;
}
function canAct(id) {
  return settings.stationary || world.distance(id) <= 3.7;
}
function requireNear(id) {
  if (canAct(id)) return true;
  world.guide(id);
  tell('Get closer, choose Go there on the map, or enable no-walking mode.');
  return false;
}
function renderPanel() {
  if (!panelId) return;
  const focused = document.activeElement?.dataset.intent;
  vrButtons = [];
  vrText = [];
  const content = $('panel-content');
  content.replaceChildren();
  $('panel-label').textContent = `${quest.profile.emblem.toUpperCase()} / EXPLORER NOTEBOOK`;
  if (panelId === 'cargo' && quest.adventure === 'space') {
    $('panel-title').textContent = '01 / Cargo launch';
    const near = canAct('cargo'),
      done = ['completed', 'revealed'].includes(quest.phase);
    content.append(
      para(
        'Pack Water, Food and Tools. Select a supply, then choose the compartment with the same symbol.',
      ),
    );
    if (!near)
      content.append(
        para(
          'You are away from this table. Go there to experiment, or turn on no-walking mode in Comfort.',
          'note',
        ),
        button('Go to cargo table', 'teleport:cargo', { primary: true }),
      );
    if (!done) {
      content.append(element('h3', '1. Choose a supply'));
      const supplies = element('div', null, 'supplies');
      for (const supply of SUPPLIES) {
        const packed = quest.placed.includes(supply.id),
          b = button(`${supply.name}${packed ? ' · packed' : ''}`, `select:${supply.id}`, {
            disabled: packed || !near,
            pressed: quest.selected === supply.id,
          });
        b.prepend(element('span', shapeIcon[supply.shape], 'shape-icon'));
        b.append(element('small', supply.shape.toUpperCase()));
        supplies.append(b);
      }
      content.append(supplies, element('h3', '2. Choose a compartment'));
      const compartments = element('div', null, 'compartments');
      for (const supply of SUPPLIES)
        compartments.append(
          button(
            `${shapeIcon[supply.shape]} ${supply.shape.toUpperCase()}`,
            `place:${supply.shape}`,
            { disabled: !near },
          ),
        );
      content.append(compartments);
    }
    content.append(para(quest.cargoMessage, 'status'));
    if (quest.phase === 'completed')
      content.append(button('Open cargo lid', 'reveal', { primary: true, disabled: !near }));
    else if (quest.phase === 'revealed') {
      content.append(element('div', `${tokenIcon[quest.token]} ${quest.token}`, 'summary-token'));
      if (!quest.cargoCollected)
        content.append(button('Collect fragment', 'collect', { primary: true, disabled: !near }));
      else
        content.append(
          para('Cargo fragment collected. Follow the next clue to Solar neighborhood.', 'note'),
          buttons(
            button('Next: Solar neighborhood', 'open:solar', { primary: true }),
            button('Find the explorer drawer', 'open:drawer'),
          ),
        );
    } else
      content.append(
        element('h3', 'A little help?'),
        buttons(
          button(`Hint${quest.hint ? ` ${quest.hint}/3` : ''}`, 'hint'),
          button('Help me finish', 'assist', { disabled: !near }),
        ),
      );
    if (quest.assisted)
      content.append(para('Completed with help. Your fragment is yours to keep.', 'smallprint'));
  } else if (DETAILS[panelId]) {
    const id = panelId,
      t = quest.tasks[id],
      table = TABLES.find((x) => x.id === id),
      view = taskView(quest, id);
    $('panel-title').textContent = `${table.icon} / ${table.title}`;
    content.append(para(DETAILS[id].instruction));
    if (unlocked(quest, id)) content.append(para(DETAILS[id].reference, 'note'));
    if (t.steps.length)
      content.append(
        para(
          `Your progress: ${t.steps.map((step) => (id === 'beacon' && quest.adventure === 'space' ? (step === 'cargo' ? quest.token : quest.tasks[step].symbol) : step)).join(' → ')}`,
        ),
      );
    content.append(para(view.text, 'status'));
    const row = element('div', null, 'buttons');
    for (const a of view.actions)
      row.append(
        button(a.label, `task:${id}:${a.verb}:${a.value || ''}`, {
          disabled: !canAct(id),
          primary: ['reveal', 'collect'].includes(a.verb),
        }),
      );
    content.append(row);
    if (!canAct(id))
      content.append(button(`Go to ${table.title}`, `teleport:${id}`, { primary: true }));
    if (t.assisted)
      content.append(para('Completed with help. Your treasure stays yours.', 'smallprint'));
    if (t.collected) {
      const next = currentTable(quest);
      content.append(
        button(
          quest.fragments === 6 ? `Find ${treasureName()}` : `Next: ${next.title}`,
          quest.fragments === 6 ? 'open:treasure' : `open:${next.id}`,
          { primary: true },
        ),
      );
    }
    if (!unlocked(quest, id))
      content.append(
        button(`Current task: ${currentTable(quest).title}`, `open:${currentTable(quest).id}`),
      );
  } else if (PROPS.some((p) => p.id === panelId)) {
    const p = PROPS.find((p) => p.id === panelId),
      state = quest.props[p.id];
    $('panel-title').textContent = p.title;
    content.append(
      para(
        isWorkshop(quest)
          ? p.id === 'satellite'
            ? 'Wind up the toy and count its wheels.'
            : 'Inspect the enlarged geometric shape.'
          : isOcean(quest)
            ? p.id === 'satellite'
              ? 'Look through the viewer and count the fish.'
              : 'Turn the fish and notice its pattern.'
            : p.id === 'satellite'
              ? 'Turn the satellite and count its labeled solar panels.'
              : 'Inspect the rock model and notice its surface.',
      ),
    );
    if (state.opened)
      content.append(
        para(
          isWorkshop(quest)
            ? p.id === 'satellite'
              ? `Toy wheels: ${state.value}.`
              : `Magnified shape: ${state.value}.`
            : isOcean(quest)
              ? p.id === 'satellite'
                ? `${state.value} fish in the viewer.`
                : `Fish pattern: ${state.value}.`
              : p.id === 'satellite'
                ? `${state.value} solar panels on the satellite.`
                : `Surface: ${state.value}. Illustrative model only.`,
          'status',
        ),
      );
    content.append(
      button('Inspect discovery', `inspect-prop:${p.id}`, {
        disabled: !canAct(p.id),
        primary: true,
      }),
    );
    if (!canAct(p.id)) content.append(button(`Go to ${p.title}`, `teleport:${p.id}`));
  } else if (panelId === 'treasure') {
    $('panel-title').textContent = isWorkshop(quest)
      ? 'Your gear keepsake'
      : isOcean(quest)
        ? 'Your shell keepsake'
        : 'Your constellation keepsake';
    content.append(
      para(
        quest.fragments === 6
          ? 'Six fragments recovered! Open the wall display beside the entrance.'
          : `Recover all six fragments to unlock this display. You have ${quest.fragments} of 6.`,
      ),
    );
    if (quest.treasure)
      content.append(
        element(
          'div',
          isWorkshop(quest) ? '⚙' : isOcean(quest) ? '🐚 ≈ 🪸' : '✦ ─ ✧ ─ ✦',
          'summary-token',
        ),
        para(
          `${titleFor(quest)} complete. Your ${quest.profile.emblem} emblem marks your keepsake!`,
        ),
        button('Begin memory round', 'journal', { primary: true }),
      );
    else if (quest.fragments === 6)
      content.append(
        button(`Open ${treasureName()}`, 'treasure', {
          primary: true,
          disabled: !canAct('treasure'),
        }),
      );
    if (!canAct('treasure')) content.append(button('Go to treasure display', 'teleport:treasure'));
  } else if (panelId === 'drawer') {
    $('panel-title').textContent = 'A secret beside the entrance';
    content.append(
      para(
        `The ${drawerName().toLowerCase()} has a small surprise inside. Open it and notice what you find.`,
      ),
    );
    if (quest.drawerOpen)
      content.append(
        element('div', `${tokenIcon[quest.discovery] || '🐚'} ${quest.discovery}`, 'summary-token'),
        para(
          `You inspected a ${quest.discovery} in the ${drawerName().toLowerCase()} beside the entrance.`,
          'status',
        ),
        button('Try memory journal', 'journal', { primary: true }),
      );
    else
      content.append(
        button('Open & inspect drawer', 'inspect-drawer', {
          primary: true,
          disabled: !canAct('drawer'),
        }),
      );
    if (!canAct('drawer'))
      content.append(button(`Go to ${drawerName().toLowerCase()}`, 'teleport:drawer'));
  } else if (panelId === 'map') {
    $('panel-title').textContent = isWorkshop(quest)
      ? 'Your workshop blueprint'
      : isOcean(quest)
        ? 'Your expedition chart'
        : 'Your mission chart';
    content.append(
      para(
        quest.fragments === 6
          ? `Return to the entrance wall to open the ${treasureName()}.`
          : clueFor(quest),
      ),
    );
    content.append(makeMap());
    const links = element('div', null, 'map-list');
    for (const table of TABLES)
      links.append(
        button(
          `${table.icon} · ${table.title}${collected(quest, table.id) ? ' · ✓' : unlocked(quest, table.id) ? ' · Ready' : ' · Locked'}`,
          `open:${table.id}`,
        ),
      );
    links.append(
      button(`${quest.drawerOpen ? '✓' : '?'} ${drawerName()}`, 'open:drawer'),
      button(treasureName(), 'open:treasure'),
    );
    for (const p of PROPS)
      links.append(button(`${quest.props[p.id].opened ? '✓' : '?'} ${p.title}`, `open:${p.id}`));
    const target = quest.fragments === 6 ? 'treasure' : currentTable(quest).id;
    content.append(
      links,
      buttons(
        button('Show next route', `guide:${target}`),
        button('Go to next task', `teleport:${target}`),
      ),
      para(
        'Collect each fragment to unlock the next table. Filled circles show safe approaches.',
        'smallprint',
      ),
    );
  } else if (panelId === 'tutor') {
    $('panel-title').textContent = 'Guide: ' + guideContent(quest.adventure, guideId).table;
    content.append(
      buttons(
        button('Explain this', `guide-choice:explain`, { pressed: guideMode === 'explain' }),
        button('Give me a hint', `guide-choice:hint`, { pressed: guideMode === 'hint' }),
        button('Show me the next table', 'guide-next'),
      ),
    );
    content.append(element('h3', 'Room guide'), para(authoredGuidance(guideRequest()), 'note'));
    content.append(
      para(
        guideReady === null
          ? 'Checking optional AI availability…'
          : guideReady
            ? 'An optional AI explanation is available. It can make mistakes.'
            : 'Optional AI is unavailable. The room guide works offline.',
        'smallprint',
      ),
    );
    if (guideReady)
      content.append(
        para(
          'This sends only the adventure, table, chosen help type and task phase. It sends no name, style, memory answers or chat history.',
          'smallprint',
        ),
        button(guideBusy ? 'Asking AI…' : 'Ask optional AI', 'guide-ai', { disabled: guideBusy }),
        ...(guideBusy ? [button('Cancel AI request', 'guide-cancel')] : []),
      );
    if (guideMessage) content.append(para(guideMessage, 'status'));
    content.append(button('Back to this task', `open:${guideId}`, { primary: true }));
  } else if (panelId === 'settings') {
    $('panel-title').textContent = 'Make yourself comfortable';
    for (const [key, label] of Object.entries({
      stationary: 'No walking · play from the notebook',
      largeText: 'Larger reading text',
      highContrast: 'High contrast interface',
      reducedMotion: 'Reduced motion',
    })) {
      const row = element('label', null, 'setting-row'),
        input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = settings[key];
      input.dataset.setting = key;
      row.append(input, document.createTextNode(label));
      content.append(row);
      vrButtons.push({
        label: `${settings[key] ? 'On' : 'Off'}: ${label.split(' · ')[0]}`,
        intent: `toggle:${key}`,
      });
    }
    const label = element('label', 'Hints');
    const select = document.createElement('select');
    select.id = 'challenge-mode';
    select.setAttribute('aria-label', 'Hint mode');
    for (const [value, text] of [
      ['guided', 'Guided · helpful labels'],
      ['explorer', 'Explorer · try it yourself'],
    ]) {
      const option = element('option', text);
      option.value = value;
      select.append(option);
    }
    select.value = quest.mode;
    label.append(select);
    content.append(label);
    vrButtons.push(
      { label: 'Guided hints', intent: 'set-mode:guided' },
      { label: 'Explorer hints', intent: 'set-mode:explorer' },
    );
    content.append(
      para(
        'Comfort, explorer style, adventure and hint choices are saved when browser storage is available. Progress starts fresh after a reload. All activities are untimed.',
        'smallprint',
      ),
    );
    if (!preferencesSaved)
      content.append(para('Saving is unavailable. Your choices work for this visit.', 'status'));
  } else if (panelId === 'personalize') {
    $('panel-title').textContent = 'Your explorer style';
    content.append(
      para('Choose an emblem, companion and accent. Puzzles and room positions stay the same.'),
    );
    for (const [key, values] of Object.entries(PRESETS)) {
      content.append(
        element('h3', key),
        buttons(
          ...values.map((value) =>
            button(value, `personalize:${key}:${value}`, { pressed: quest.profile[key] === value }),
          ),
        ),
      );
    }
  } else if (panelId === 'pause') {
    $('panel-title').textContent = 'Take your time';
    content.append(
      para('Your mission is paused. Continue whenever you are ready.'),
      buttons(
        button('Continue exploring', 'close', { primary: true }),
        button('Start a fresh mission', 'restart-confirm'),
      ),
      button('Comfort settings', 'settings'),
    );
    content.append(
      button('Change adventure', 'adventures'),
      button('Explorer style', 'personalize'),
    );
  } else if (panelId === 'adventures') {
    $('panel-title').textContent = 'Choose your next adventure';
    content.append(
      para(
        'Changing adventure starts a fresh hunt. Current fragments and memory answers will reset.',
      ),
      buttons(
        button('Space Rescue', 'switch-confirm:space'),
        button('Ocean Guardians', 'switch-confirm:ocean'),
        button("Inventor's Workshop", 'switch-confirm:workshop'),
      ),
    );
  } else if (panelId === 'switch-confirm') {
    $('panel-title').textContent = `Start ${titleFor({ adventure: pendingAdventure })}?`;
    content.append(
      para('Your current hunt will be reset. Comfort settings stay the same.'),
      buttons(
        button('Start selected adventure', 'switch-adventure', { primary: true }),
        button('Keep this hunt', 'close'),
      ),
    );
  } else if (panelId === 'restart') {
    $('panel-title').textContent = 'A fresh discovery?';
    content.append(
      para('This resets all six challenges, fragments and memory answers with new secret details.'),
      buttons(
        button('Start new mission', 'restart', { primary: true }),
        button('Keep this mission', 'close'),
      ),
    );
  } else if (panelId === 'help') {
    $('panel-title').textContent = 'Your explorer field guide';
    content.append(
      para(
        'Move with WASD or the arrow keys. Drag the mouse to look around. Press E near a table to open its notebook.',
      ),
      para(
        'Press Tab to move between controls, Enter or Space to select, and Escape to close a notebook. Every table action has a labeled notebook button.',
      ),
      para(
        'For the first task: select an object, select its matching destination, then Reveal and Collect. Mistakes keep your completed work.',
      ),
      para(
        'Mission map can light a route or take you to a table. No-walking mode lets you play every action from the notebook.',
      ),
      para(
        'After you reveal a discovery, try the memory journal. Look again is always available and counts as assisted practice.',
      ),
      button('Open mission map', 'map', { primary: true }),
      button('Try the first task', settings.stationary ? 'open:cargo' : 'teleport:cargo'),
    );
  } else if (panelId === 'journal-empty') {
    $('panel-title').textContent = 'Discover something first';
    content.append(
      para(
        'Your memory journal only asks about things you have inspected. Reveal a fragment or inspect the drawer first.',
      ),
      buttons(button(TABLES[0].title, 'open:cargo'), button(drawerName(), 'open:drawer')),
    );
  } else {
    const table = TABLES.find((item) => item.id === panelId);
    $('panel-title').textContent = table?.title || 'Next chapter';
    content.append(
      element('span', 'NEXT CHAPTER', 'tag'),
      para(
        'This model is a preview. Its challenge is not part of this first mission. Your playable mission is Cargo launch at table 01.',
      ),
      buttons(
        button('Back to mission map', 'map'),
        button('Go to Cargo launch', 'teleport:cargo', { primary: true }),
      ),
    );
  }
  if (TABLES.some((t) => t.id === panelId) && unlocked(quest, panelId))
    content.append(button('Ask the room guide', `tutor:${panelId}`));
  if (focused) {
    const replacement = [...content.querySelectorAll('[data-intent]')].find(
      (e) => e.dataset.intent === focused && !e.disabled,
    );
    (
      replacement ?? content.querySelector('button.primary:not(:disabled), button:not(:disabled)')
    )?.focus();
  }
  syncSurface();
}
const mapX = (x) => 210 + x * 25,
  mapY = (z) => 170 + z * 22;
function makeMap() {
  const ns = 'http://www.w3.org/2000/svg',
    svg = document.createElementNS(ns, 'svg');
  svg.classList.add('map-svg');
  svg.setAttribute('viewBox', '0 0 420 340');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `Fixed room map. ${TABLES[0].title} at the back left; ${drawerName()} beside the entrance at the front left.`,
  );
  function part(tag, attrs, text) {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text) e.textContent = text;
    svg.append(e);
    return e;
  }
  part('rect', {
    x: 32,
    y: 15,
    width: 356,
    height: 308,
    rx: 14,
    fill: '#fdf5e8',
    stroke: '#8d799a',
    'stroke-width': 2,
  });
  const route = findPath(
    position,
    approachPoint(
      quest.fragments === 6 ? DESTINATIONS.find((d) => d.id === 'treasure') : currentTable(quest),
    ),
  );
  part('path', {
    d: route.map((p, i) => `${i ? 'L' : 'M'} ${mapX(p.x)} ${mapY(p.z)}`).join(' '),
    fill: 'none',
    stroke: '#bc7a4f',
    'stroke-width': 2,
    'stroke-dasharray': '3 7',
  });
  for (const table of TABLES) {
    const x = mapX(table.x),
      y = mapY(table.z),
      approach = approachPoint(table);
    part('rect', {
      x: x - 30,
      y: y - 15,
      width: 60,
      height: 30,
      rx: 7,
      fill: unlocked(quest, table.id) ? '#ecac80' : '#d8cce0',
      stroke: '#9c87a3',
    });
    part(
      'text',
      {
        x,
        y: y + 5,
        'text-anchor': 'middle',
        fill: '#40334f',
        'font-size': 13,
        'font-family': 'sans-serif',
      },
      `${table.icon}${collected(quest, table.id) ? ' ✓' : ''}`,
    );
    part('circle', {
      cx: mapX(approach.x),
      cy: mapY(approach.z),
      r: 6,
      fill: unlocked(quest, table.id) ? '#bd643e' : '#a591b6',
    });
  }
  part('text', { x: 64, y: 265, fill: '#654e7d', 'font-size': 24 }, quest.drawerOpen ? '✦' : '☆');
  part('text', { x: 65, y: 282, fill: '#554466', 'font-size': 10 }, 'DRAWER');
  for (const p of PROPS) {
    part('circle', {
      cx: mapX(p.x),
      cy: mapY(p.z),
      r: 8,
      fill: quest.props[p.id].opened ? '#659e91' : '#b9a3c9',
    });
    part(
      'text',
      { x: mapX(p.x), y: mapY(p.z) + 18, 'text-anchor': 'middle', fill: '#554466', 'font-size': 8 },
      isWorkshop(quest)
        ? p.id === 'satellite'
          ? 'TOY'
          : 'SHAPE'
        : isOcean(quest)
          ? p.id === 'satellite'
            ? 'PERISCOPE'
            : 'FISH'
          : p.id === 'satellite'
            ? 'SATELLITE'
            : 'ROCK',
    );
  }
  part(
    'text',
    { x: 210, y: 35, 'text-anchor': 'middle', fill: '#243348', 'font-size': 12 },
    `${quest.profile.emblem} explorer`,
  );
  part(
    'text',
    { x: 210, y: 315, 'text-anchor': 'middle', fill: '#6c597a', 'font-size': 11 },
    'ENTRANCE / TREASURE',
  );
  part('circle', {
    id: 'map-player',
    cx: mapX(position.x),
    cy: mapY(position.z),
    r: 7,
    fill: '#2b5f64',
    stroke: 'white',
    'stroke-width': 2,
  });
  return svg;
}
function syncSurface() {
  world.pause(!started || Boolean(panelId) || memoryOpen);
  world.conceal(memoryOpen);
  if (memoryOpen) {
    const q = quest.memory;
    if (!q) return;
    let text = q.prompt,
      choices = [];
    if (q.result) {
      text = `${memoryFeedback(q)} ${q.answer} was at ${q.location}. ${roundSummary()}`;
      choices =
        quest.roundIndex + 1 < quest.round.length
          ? [{ label: 'Next question', intent: 'next-memory' }]
          : [
              { label: 'Back to room', intent: 'close-memory' },
              { label: 'New observations', intent: 'new-memory' },
            ];
    } else if (q.looking) {
      text = `Look again (assisted): ${q.answer}. Location: ${q.location}.`;
      choices = [
        { label: 'Return to question', intent: 'return-memory' },
        { label: 'Skip', intent: 'skip-memory' },
      ];
    } else
      choices = [
        ...q.options.map((label, index) => ({ label, intent: `answer:${index}` })),
        { label: 'Look again', intent: 'look-again' },
        { label: 'Skip', intent: 'skip-memory' },
      ];
    world.console(text, choices);
  } else if (panelId) {
    const text = vrText.join(' ');
    if (text !== vrReadingText) {
      vrReadingText = text;
      vrReadingPage = 0;
    }
    const pages = text.match(/.{1,200}(?:\s|$)|.{1,200}/g) || [''];
    vrReadingPage = vrReadingPage % pages.length;
    world.console(`${$('panel-title').textContent}\n${pages[vrReadingPage]}`, [
      ...(pages.length > 1
        ? [{ label: `Read more ${vrReadingPage + 1}/${pages.length}`, intent: 'read-more' }]
        : []),
      ...vrButtons,
      { label: 'Close notebook', intent: 'close' },
    ]);
  } else
    world.console(
      `Left stick: move. Right stick: turn. B/Y: menu. ${settings.stationary ? 'No-walking mode is ON. Choose Enable stick walking to move.' : quest.fragments === 6 ? 'Six fragments! Open the treasure beside the entrance.' : DETAILS[currentTable(quest).id]?.clue || CLUE}`,
      [
        ...(settings.stationary ? [{ label: 'Enable stick walking', intent: 'vr-walk' }] : []),
        { label: 'Mission map', intent: 'map' },
        {
          label: 'Current task',
          intent: `open:${quest.fragments === 6 ? 'treasure' : currentTable(quest).id}`,
        },
        { label: drawerName(), intent: 'open:drawer' },
        { label: 'Room guide', intent: 'tutor' },
        { label: 'Memory journal', intent: 'journal' },
        { label: 'Comfort', intent: 'settings' },
        { label: 'Pause', intent: 'pause' },
      ],
    );
}
function memoryFeedback(q) {
  return q.result === 'skipped'
    ? 'Question skipped. You can explore again.'
    : `${q.result === 'correct' ? 'You remembered!' : 'A discovery to revisit.'}${q.assisted ? ' Assisted practice.' : ' Unassisted recall.'}`;
}
function roundSummary() {
  const all = [...quest.memoryHistory, ...(quest.memory?.result ? [quest.memory] : [])];
  return `${all.filter((q) => q.result === 'correct' && !q.assisted).length} correct unassisted · ${all.filter((q) => q.assisted).length} assisted · ${all.filter((q) => q.result === 'skipped').length} skipped.`;
}
function renderMemory() {
  const q = quest.memory;
  if (!q) return;
  $('memory-question').textContent =
    `${quest.roundIndex + 1} / ${quest.round.length} — ${q.prompt}`;
  $('memory-options').replaceChildren();
  $('memory-actions').replaceChildren();
  $('memory-feedback').textContent = '';
  const add = (label, intent, where, primary = false) => {
    const b = element('button', label, primary ? 'primary' : '');
    b.dataset.intent = intent;
    $(where).append(b);
  };
  if (q.result) {
    $('memory-feedback').textContent =
      `${memoryFeedback(q)} The answer is ${q.answer}, at ${q.location}. Your treasure stays yours. ${roundSummary()}`;
    if (quest.roundIndex + 1 < quest.round.length)
      add('Next question', 'next-memory', 'memory-actions', true);
    else {
      add('Back to the room', 'close-memory', 'memory-actions', true);
      add('Quiz new observations', 'new-memory', 'memory-actions');
      add('Start another mission', 'memory-restart', 'memory-actions');
    }
  } else if (q.looking) {
    $('memory-feedback').textContent =
      `Look again: ${q.answer}. You inspected it at ${q.location}. This question now counts as assisted practice.`;
    $('memory-options').append(element('div', tokenIcon[q.answer] || '✦', 'summary-token'));
    add('Return to question', 'return-memory', 'memory-actions', true);
    add('Skip question', 'skip-memory', 'memory-actions');
  } else {
    q.options.forEach((option, index) =>
      add(`${index + 1}. ${option}`, `answer:${index}`, 'memory-options'),
    );
    add('Look again · assisted', 'look-again', 'memory-actions');
    add('Skip question', 'skip-memory', 'memory-actions');
  }
  syncSurface();
}
function updateQuest() {
  persistPreferences();
  refreshContent();
  world.render(quest);
  $('fragment-count').textContent = `${quest.fragments} / 6 fragments`;
  $('fragment-icon').textContent = quest.fragments ? '✦' : '✧';
  $('objective-title').textContent = quest.treasure
    ? `${titleFor(quest)} complete!`
    : quest.fragments === 6
      ? 'Your treasure awaits'
      : `${currentTable(quest).icon} / ${currentTable(quest).title}`;
  $('objective-copy').textContent = quest.treasure
    ? 'Your keepsake is yours. Try the memory journal.'
    : quest.fragments === 6
      ? `Open the ${treasureName()} beside the entrance.`
      : clueFor(quest);
  document.querySelector('.route-button').dataset.intent =
    `guide:${quest.fragments === 6 ? 'treasure' : currentTable(quest).id}`;
  if (panelId) renderPanel();
  if (memoryOpen) renderMemory();
  syncSurface();
}
function dispatch(action) {
  quest = reduceQuest(quest, action);
  updateQuest();
  tell(quest.message);
}
function handleIntent(intent) {
  if (!intent) return;
  const [name, value, verb, argument] = intent.split(':');
  if (name === 'exit-vr') {
    world.scene.exitVR();
    return;
  }
  if (name === 'vr-walk' && !memoryOpen) {
    settings.stationary = false;
    applySettings();
    closePanel();
    return;
  }
  if (memoryOpen) {
    if (
      [
        'answer',
        'look-again',
        'return-memory',
        'skip-memory',
        'next-memory',
        'new-memory',
      ].includes(name)
    ) {
      quest = reduceQuest(
        quest,
        name === 'answer' ? { type: name, index: Number(value) } : { type: name },
      );
      renderMemory();
      document.querySelector('#memory-options button, #memory-actions button')?.focus();
      return;
    }
    if (name === 'close-memory' && quest.memory.result) {
      memoryOpen = false;
      $('memory').close();
      syncSurface();
      document.querySelector('[data-intent="journal"]').focus();
      return;
    }
    if (name === 'memory-restart' && quest.memory.result) {
      memoryOpen = false;
      $('memory').close();
      openPanel('restart');
      return;
    }
    return;
  }
  if (name === 'read-more') {
    vrReadingPage++;
    syncSurface();
    return;
  }
  if (name === 'tutor') {
    if (!started) enter();
    guideId =
      TABLES.some((t) => t.id === value) && unlocked(quest, value) ? value : currentTable(quest).id;
    guideMode = 'explain';
    guideMessage = '';
    guideReady = null;
    cancelGuide();
    openPanel('tutor');
    checkGuide();
    return;
  }
  if (name === 'guide-choice') {
    if (['explain', 'hint'].includes(value)) {
      cancelGuide();
      guideMode = value;
      guideMessage = '';
      renderPanel();
      if (guideReady === null) checkGuide();
    }
    return;
  }
  if (name === 'guide-ai') {
    askGuide();
    return;
  }
  if (name === 'guide-cancel') {
    cancelGuide();
    guideMessage = 'AI request cancelled. The room guide is still available.';
    renderPanel();
    return;
  }
  if (name === 'guide-next') {
    handleIntent(`guide:${quest.fragments === 6 ? 'treasure' : currentTable(quest).id}`);
    return;
  }
  if (name === 'set-mode') {
    quest = reduceQuest(quest, { type: 'mode', value });
    persistPreferences();
    renderPanel();
    return;
  }
  if (['settings', 'help', 'pause', 'adventures'].includes(name) || intent === 'personalize') {
    openPanel(name);
    return;
  }
  if (name === 'switch-confirm') {
    pendingAdventure = value;
    openPanel('switch-confirm');
    return;
  }
  if (name === 'personalize') {
    quest = reduceQuest(quest, { type: 'personalize', value: { [value]: verb } });
    updateQuest();
    return;
  }
  if (name === 'switch-adventure') {
    closePanel();
    quest = reduceQuest(quest, {
      type: 'switch-adventure',
      adventure: pendingAdventure,
      seed: freshSeed(),
    });
    pendingAdventure = null;
    world.resetPosition();
    world.guide('cargo');
    $('welcome-adventure').value = quest.adventure;
    updateQuest();
    tell(clueFor(quest));
    return;
  }
  if (name === 'toggle') {
    if (Object.hasOwn(settings, value)) {
      settings[value] = !settings[value];
      applySettings();
      renderPanel();
    }
    return;
  }
  if (name === 'close') {
    closePanel();
    return;
  }
  if (name === 'restart-confirm') {
    openPanel('restart');
    return;
  }
  if (name === 'restart') {
    closePanel();
    quest = createQuest(freshSeed(), quest.mode, quest.adventure, quest.profile);
    world.resetPosition();
    world.guide('cargo');
    updateQuest();
    tell('A fresh mission! New secret details are waiting to be discovered.');
    return;
  }
  if (!started) enter();
  if (name === 'map') {
    openPanel('map');
    return;
  }
  if (name === 'open') {
    openPanel(value);
    return;
  }
  if (name === 'guide') {
    closePanel();
    world.guide(value);
    tell(
      DETAILS[value]?.clue ||
        (value === 'cargo'
          ? CLUE
          : 'Find the marked destination beside the entrance. Follow the floor dots.'),
    );
    return;
  }
  if (name === 'teleport') {
    closePanel();
    world.teleport(value);
    openPanel(value);
    return;
  }
  if (name === 'journal') {
    quest = reduceQuest(quest, { type: 'start-memory' });
    if (!quest.memory) {
      openPanel('journal-empty');
      return;
    }
    closePanel();
    memoryOpen = true;
    $('notice').textContent = '';
    renderMemory();
    $('memory').showModal();
    return;
  }
  if (name === 'inspect-drawer') {
    if (!requireNear('drawer')) return;
    dispatch({ type: name });
    if (!panelId) openPanel('drawer');
    return;
  }
  if (name === 'task') {
    if (requireNear(value)) dispatch({ type: 'task', id: value, verb, value: argument });
    return;
  }
  if (name === 'inspect-prop') {
    if (requireNear(value)) {
      dispatch({ type: 'inspect-prop', id: value });
      openPanel(value);
    }
    return;
  }
  if (name === 'treasure') {
    if (requireNear('treasure')) {
      dispatch({ type: 'treasure' });
      openPanel('treasure');
    }
    return;
  }
  if (['select', 'place', 'reveal', 'collect', 'assist', 'hint'].includes(name)) {
    if (!requireNear('cargo')) return;
    dispatch(
      name === 'select'
        ? { type: name, id: value }
        : name === 'place'
          ? { type: name, shape: value }
          : { type: name },
    );
  }
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-intent]');
  if (button && !button.disabled) handleIntent(button.dataset.intent);
});
document.addEventListener('change', (event) => {
  if (event.target.dataset.profile) {
    quest = reduceQuest(quest, {
      type: 'personalize',
      value: { [event.target.dataset.profile]: event.target.value },
    });
    updateQuest();
  }
  if (event.target.id === 'welcome-adventure' && !started) {
    quest = createQuest(freshSeed(), quest.mode, event.target.value, quest.profile);
    updateQuest();
    document.querySelector('.adventure-choice strong').textContent = titleFor(quest);
  }
  const key = event.target.dataset.setting;
  if (key && Object.hasOwn(settings, key)) {
    settings[key] = event.target.checked;
    applySettings();
    renderPanel();
    document.querySelector(`[data-setting="${key}"]`)?.focus();
  }
  if (event.target.id === 'challenge-mode' || event.target.id === 'welcome-mode') {
    quest = reduceQuest(quest, { type: 'mode', value: event.target.value });
    persistPreferences();
    syncSurface();
  }
});
$('panel-close').addEventListener('click', closePanel);
$('panel').addEventListener('cancel', (event) => {
  event.preventDefault();
  closePanel();
});
$('memory').addEventListener('cancel', (event) => {
  event.preventDefault();
  if (quest.memory?.result) handleIntent('close-memory');
});
$('enter-button').addEventListener('click', enter);
document.addEventListener('keydown', (event) => {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) ||
    memoryOpen
  )
    return;
  if (event.key === 'Escape' && !panelId && started) {
    event.preventDefault();
    openPanel('pause');
    return;
  }
  if (panelId) return;
  if (event.code === 'KeyM') {
    event.preventDefault();
    handleIntent('map');
  }
  if (event.code === 'KeyE' && started) {
    event.preventDefault();
    const nearest = world.nearest();
    if (settings.stationary || world.distance(nearest.id) <= 3.7) openPanel(nearest.id);
    else tell('Move closer to a table, or use Mission map → Go there.');
  }
});
$('vr-button').addEventListener('click', async () => {
  try {
    await world.scene.enterVR();
  } catch {
    tell('VR could not start here. Desktop and no-walking play are available.');
  }
});
async function checkVR() {
  let supported = false;
  try {
    supported = Boolean(navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr')));
  } catch {}
  $('vr-button').disabled = !supported;
  $('vr-button').textContent = supported ? 'Enter VR' : 'VR unavailable';
  $('vr-button').title = supported
    ? 'Use your headset controllers to select objects.'
    : 'A compatible headset browser and secure connection are required.';
}
$('welcome-mode').value = quest.mode;
$('welcome-adventure').value = quest.adventure;
for (const input of document.querySelectorAll('[data-profile]'))
  input.value = quest.profile[input.dataset.profile];
refreshContent();
applySettings();
world.render(quest);
syncSurface();
checkVR();
tell('Your first mission is ready.');
