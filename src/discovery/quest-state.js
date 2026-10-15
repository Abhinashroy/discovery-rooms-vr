import { createWorkshop, applyWorkshop } from './workshop.js';
import { profileFor } from './personalization.js';
import { SUPPLIES, TOKEN_NAMES, FOUND_OBJECTS, random, shuffled } from './adventure.js';
import { applyTask } from './space.js';
import { createOcean, applyOcean } from './ocean.js';

export function createQuest(seed, mode = 'guided', adventure = 'space', profile = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Invalid session seed.');
  if (!['guided', 'explorer'].includes(mode)) throw new Error('Choose a challenge mode.');
  if (!['space', 'ocean', 'workshop'].includes(adventure)) throw new Error('Unknown adventure.');
  if (adventure === 'workshop')
    return { ...createWorkshop(seed, mode), profile: profileFor(profile) };
  if (adventure === 'ocean') return { ...createOcean(seed, mode), profile: profileFor(profile) };
  const next = random(seed);
  return {
    seed,
    mode,
    adventure,
    profile: profileFor(profile),
    phase: 'available',
    selected: null,
    placed: [],
    hint: 0,
    assisted: false,
    fragments: 0,
    cargoCollected: false,
    treasure: false,
    tasks: Object.fromEntries(
      ['solar', 'globe', 'moon', 'mission', 'beacon'].map((id, i) => [
        id,
        {
          phase: 'available',
          steps: [],
          hint: 0,
          assisted: false,
          collected: false,
          orientation: 1,
          position: 0,
          selected: null,
          symbol: shuffled(['Moon', 'Sun', 'Rocket', 'Diamond', 'Wave'], seed ^ 193)[i],
        },
      ]),
    ),
    props: {
      satellite: { opened: false, value: String(2 + (seed % 3)) },
      meteorite: { opened: false, value: ['Ridges', 'Pits', 'Smooth surface'][seed % 3] },
    },
    round: [],
    roundIndex: 0,
    memoryHistory: [],
    token: TOKEN_NAMES[Math.floor(next() * TOKEN_NAMES.length)],
    discovery: FOUND_OBJECTS[Math.floor(next() * FOUND_OBJECTS.length)],
    drawerOpen: false,
    observations: [],
    memory: null,
    message: 'Select a supply, then choose its matching compartment.',
    cargoMessage: 'Select a supply, then choose its matching compartment.',
  };
}
function observe(state, id, answer, location, choices) {
  if (!state.observations.some((record) => record.id === id))
    state.observations.push({ id, answer, location, choices: [...choices] });
}
export function makeMemoryQuestion(state) {
  if (!state.observations.length) return null;
  // Prefer the optional discovery when it was explicitly opened; never infer inspection from proximity.
  const record = state.observations.find((item) => item.id === 'drawer') ?? state.observations[0];
  return questionFor(record, state.seed);
}
function questionFor(record, seed) {
  const options = shuffled(record.choices, seed ^ 0x9165);
  return {
    source: record.id,
    prompt:
      record.prompt ||
      (record.id === 'drawer'
        ? 'What did you uncover in the explorer drawer?'
        : 'Which symbol was on your cargo fragment?'),
    options,
    correct: options.indexOf(record.answer),
    answer: record.answer,
    location: record.location,
    assisted: false,
    result: null,
    looking: false,
  };
}
export function reduceQuest(previous, action) {
  if (action.type === 'switch-adventure')
    return createQuest(action.seed, previous.mode, action.adventure, previous.profile);
  const state = structuredClone(previous);
  // During recall no other action may disclose a fact. Look again is explicit assisted practice.
  if (
    state.memory &&
    !state.memory.result &&
    !['answer', 'skip-memory', 'look-again', 'return-memory'].includes(action.type)
  )
    return state;
  switch (action.type) {
    case 'personalize':
      state.profile = profileFor({ ...state.profile, ...action.value });
      break;
    case 'task':
      (state.adventure === 'workshop'
        ? applyWorkshop
        : state.adventure === 'ocean'
          ? applyOcean
          : applyTask)(state, action);
      break;
    case 'inspect-prop': {
      const p = state.props[action.id];
      if (!p) throw new Error('Unknown discovery.');
      p.opened = true;
      if (state.adventure === 'workshop') {
        observe(
          state,
          action.id,
          p.value,
          action.id === 'satellite'
            ? 'Wind-up toy beside the entrance'
            : 'Magnifying viewer on the left wall',
          action.id === 'satellite' ? ['2', '3', '4'] : ['Triangle', 'Square', 'Hexagon'],
        );
        state.observations.find((r) => r.id === action.id).prompt =
          action.id === 'satellite'
            ? 'How many wheels did the wind-up toy have?'
            : 'Which shape did the magnifying viewer show?';
        state.message =
          action.id === 'satellite' ? `Toy wheels: ${p.value}.` : `Magnified shape: ${p.value}.`;
        break;
      }
      if (state.adventure === 'ocean') {
        observe(
          state,
          action.id,
          p.value,
          action.id === 'satellite'
            ? 'Periscope viewer beside the entrance'
            : 'Fish viewer on the left wall',
          action.id === 'satellite' ? ['2', '3', '4'] : ['Spots', 'Stripes', 'Plain'],
        );
        state.observations.find((r) => r.id === action.id).prompt =
          action.id === 'satellite'
            ? 'How many fish were in the periscope view?'
            : 'Which pattern did the fish viewer show?';
        state.message =
          action.id === 'satellite'
            ? `You saw ${p.value} fish in the periscope.`
            : `Fish pattern: ${p.value}.`;
        break;
      }
      observe(
        state,
        action.id,
        p.value,
        action.id === 'satellite'
          ? 'Satellite viewer beside the entrance'
          : 'Meteorite display on the left wall',
        action.id === 'satellite' ? ['2', '3', '4'] : ['Ridges', 'Pits', 'Smooth surface'],
      );
      state.observations.find((r) => r.id === action.id).prompt =
        action.id === 'satellite'
          ? 'How many solar panels did the satellite have?'
          : 'Which surface did the meteorite display show?';
      state.message =
        action.id === 'satellite'
          ? `You turned the satellite: ${p.value} solar panels.`
          : `Meteorite inspected: ${p.value}. This is an illustrative model, not a rock identification test.`;
      break;
    }
    case 'treasure':
      if (state.fragments === 6) {
        state.treasure = true;
        state.message =
          state.adventure === 'workshop'
            ? 'Workshop complete! Your gear keepsake is unlocked.'
            : state.adventure === 'ocean'
              ? 'Ocean Guardians complete! Your shell keepsake is unlocked.'
              : 'Space Rescue complete! Your constellation keepsake is unlocked. Try your memory journal.';
      }
      break;
    case 'select': {
      if (state.adventure !== 'space') return state;
      const supply = SUPPLIES.find((item) => item.id === action.id);
      if (!supply) throw new Error('Unknown supply.');
      if (['completed', 'revealed'].includes(state.phase) || state.placed.includes(supply.id))
        return state;
      state.phase = 'active';
      state.selected = supply.id;
      state.message =
        state.mode === 'guided'
          ? supply.clue
          : `${supply.name} selected. Check its symbol and choose a compartment.`;
      break;
    }
    case 'place': {
      if (state.adventure !== 'space') return state;
      if (!SUPPLIES.some((item) => item.shape === action.shape))
        throw new Error('Unknown compartment.');
      if (['completed', 'revealed'].includes(state.phase)) return state;
      if (!state.selected) {
        state.message = 'First select one supply from the front of the table.';
        break;
      }
      const supply = SUPPLIES.find((item) => item.id === state.selected);
      if (supply.shape !== action.shape) {
        state.message = `Try another compartment. ${supply.clue} Your packed supplies are safe.`;
        break;
      }
      state.placed.push(supply.id);
      state.selected = null;
      state.message = `${supply.name} packed! ${state.placed.length} of 3 supplies are ready.`;
      if (state.placed.length === 3) {
        state.phase = 'completed';
        state.message = 'Cargo ready! Open the cargo lid to discover what is inside.';
      }
      break;
    }
    case 'hint': {
      if (state.adventure !== 'space') return state;
      state.hint = Math.min(3, state.hint + 1);
      const next = SUPPLIES.find((item) => !state.placed.includes(item.id));
      state.message = !next
        ? 'Open the cargo lid, then collect your fragment.'
        : state.hint === 1
          ? 'Look at the symbol on a supply. Where else can you see that shape?'
          : state.hint === 2
            ? `Look closely at ${next.name} and the ${next.shape.toUpperCase()} compartment.`
            : `Select ${next.name}, then select ${next.shape.toUpperCase()}. ${next.clue}`;
      break;
    }
    case 'assist':
      if (state.adventure !== 'space') return state;
      if (['completed', 'revealed'].includes(state.phase)) return state;
      state.placed = SUPPLIES.map((item) => item.id);
      state.selected = null;
      state.assisted = true;
      state.phase = 'completed';
      state.message =
        'Packed together: Water → circle, Food → triangle, Tools → square. Now open the lid.';
      break;
    case 'reveal':
      if (state.adventure !== 'space') return state;
      if (state.phase !== 'completed') return state;
      state.phase = 'revealed';
      observe(state, 'cargo', state.token, 'Cargo launch table', TOKEN_NAMES);
      state.message = `You found a fragment marked ${state.token}! Matching labels helps explorers find supplies quickly. Collect it for your notebook.`;
      break;
    case 'collect':
      if (state.adventure !== 'space') return state;
      if (state.phase !== 'revealed' || state.cargoCollected) return state;
      state.cargoCollected = true;
      state.fragments++;
      state.message = `First fragment collected${state.assisted ? ' with a little help' : ''}! Find the Sun model at table 02 in the middle of the back row.`;
      break;
    case 'inspect-drawer':
      state.drawerOpen = true;
      if (state.adventure === 'workshop') {
        observe(state, 'drawer', state.discovery, 'Parts drawer beside the entrance', [
          'Striped washer',
          'Dotted washer',
          'Zigzag washer',
        ]);
        state.observations.find((r) => r.id === 'drawer').prompt =
          'Which patterned washer was in the parts drawer?';
        state.message = `Found ${state.discovery}.`;
        break;
      }
      if (state.adventure === 'ocean') {
        observe(state, 'drawer', state.discovery, 'Shell drawer beside the entrance', [
          'Spiral shell',
          'Striped shell',
          'Fan shell',
        ]);
        state.observations.find((r) => r.id === 'drawer').prompt =
          'Which shell did you find in the shell drawer?';
        state.message = `You discovered a ${state.discovery}.`;
        break;
      }
      observe(
        state,
        'drawer',
        state.discovery,
        'Explorer drawer beside the entrance',
        FOUND_OBJECTS,
      );
      state.message = `Discovery! A ${state.discovery} is inside the explorer drawer beside the entrance. Take a moment to notice its shape.`;
      break;
    case 'mode':
      if (!['guided', 'explorer'].includes(action.value)) throw new Error('Unknown mode.');
      state.mode = action.value;
      break;
    case 'start-memory':
      // A round snapshots up to five unasked observations. Reopening retains the current result.
      if (!state.memory) {
        const records = shuffled(state.observations, state.seed ^ 773).slice(0, 5);
        state.round = records.map((record, i) => questionFor(record, state.seed + i * 71));
        state.roundIndex = 0;
        state.memory = state.round[0] || null;
      }
      if (!state.memory)
        state.message =
          'Reveal a fragment or inspect a discovery before starting a memory question.';
      break;
    case 'next-memory':
      if (state.memory?.result && state.roundIndex + 1 < state.round.length) {
        state.memoryHistory.push(state.memory);
        state.roundIndex++;
        state.memory = state.round[state.roundIndex];
      }
      break;
    case 'new-memory': {
      if (state.memory && !state.memory.result) return state;
      if (state.memory && state.roundIndex + 1 < state.round.length) return state;
      const history = [...state.memoryHistory, ...(state.memory ? [state.memory] : [])];
      const records = shuffled(
        state.observations.filter((r) => !history.some((q) => q.source === r.id)),
        state.seed ^ 391,
      ).slice(0, 5);
      if (records.length) {
        state.memoryHistory = history;
        state.round = records.map((r, i) => questionFor(r, state.seed + i * 73));
        state.roundIndex = 0;
        state.memory = state.round[0];
      }
      break;
    }
    case 'look-again':
      if (state.memory && !state.memory.result) {
        state.memory.assisted = true;
        state.memory.looking = true;
      }
      break;
    case 'return-memory':
      if (state.memory) state.memory.looking = false;
      break;
    case 'answer':
      if (!state.memory || state.memory.result || state.memory.looking) return state;
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= state.memory.options.length
      )
        throw new Error('Choose a listed answer.');
      state.memory.result = action.index === state.memory.correct ? 'correct' : 'incorrect';
      break;
    case 'skip-memory':
      if (state.memory && !state.memory.result) {
        state.memory.result = 'skipped';
        state.memory.looking = false;
      }
      break;
    default:
      throw new Error('Unknown adventure action.');
  }
  if (['select', 'place', 'hint', 'assist', 'reveal', 'collect'].includes(action.type))
    state.cargoMessage = state.message;
  return state;
}
