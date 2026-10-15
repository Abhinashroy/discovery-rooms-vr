import { TABLES, shuffled } from './adventure.js';

export const PLANETS = ['Mercury', 'Venus', 'Earth', 'Mars'];
export const FLIGHT = ['Launch', 'Travel', 'Observe', 'Return'];
export const MOON_VIEWS = ['New Moon', 'First quarter', 'Full Moon'];
export const DETAILS = {
  solar: {
    instruction: 'Build the inner Solar System: choose the nearest remaining planet to the Sun.',
    reference: 'From the Sun: Mercury, Venus, Earth, Mars. This model simplifies size and spacing.',
    explanation:
      'These four rocky planets orbit the Sun in this order. Their real sizes, distances and orbital speeds differ.',
    clue: 'Find table 02 with the Sun model in the middle of the back row.',
  },
  globe: {
    instruction:
      'Turn the globe so the marked town faces the Sun. Check DAY, then turn it away and check NIGHT.',
    reference:
      'The Sun is on the left. A town facing the Sun has day; a town facing away has night.',
    explanation:
      'Earth rotates. A place moves into sunlight for day and away for night. This is a simplified two-position model.',
    clue: 'Find the blue globe at table 03, back right.',
  },
  moon: {
    instruction: 'Move the Moon to each marked position, then match the view seen from Earth.',
    reference:
      'Position 1: Moon toward Sun → New Moon. Position 2: quarter orbit → First quarter. Position 3: opposite Sun → Full Moon.',
    explanation:
      'Half the Moon is sunlit. As it orbits, we see different amounts of that lit half. Ordinary phases are not caused by Earth’s shadow. Distances and tilt are simplified.',
    clue: 'Find the Moon model at table 04, front left.',
  },
  mission: {
    instruction: 'Program the craft by choosing the next card in the mission brief.',
    reference:
      'Mission brief: Launch from Earth, Travel to the target, Observe it, then Return home.',
    explanation:
      'A sequence puts instructions in order. Observation happens after reaching the target; return follows the observations.',
    clue: 'Find the mission cards at table 05, front middle.',
  },
  beacon: {
    instruction: 'Select a collected fragment, then fit it into the socket with the same symbol.',
    reference:
      'Use all five collected fragments. Match each written symbol; colors are only decoration.',
    explanation:
      'The five earlier discoveries power the beacon. Its final fragment unlocks the constellation treasure beside the entrance.',
    clue: 'Find the rocket beacon at table 06, front right.',
  },
};
export const collected = (s, id) =>
  id === 'cargo' ? s.cargoCollected : Boolean(s.tasks[id]?.collected);
export const currentTable = (s) => TABLES.find((t) => !collected(s, t.id)) ?? TABLES[5];
export const unlocked = (s, id) => {
  const i = TABLES.findIndex((t) => t.id === id);
  return i === 0 || (i > 0 && collected(s, TABLES[i - 1].id));
};
export const fragmentList = (s) => [
  { id: 'cargo', symbol: s.token },
  ...TABLES.slice(1, 5).map((t) => ({ id: t.id, symbol: s.tasks[t.id].symbol })),
];

export function taskView(s, id) {
  const t = s.tasks[id],
    d = DETAILS[id];
  if (!t || !d) return null;
  if (!unlocked(s, id))
    return {
      text: `Collect the fragment at ${TABLES[TABLES.findIndex((x) => x.id === id) - 1].title} to unlock this challenge.`,
      actions: [],
    };
  if (t.collected)
    return { text: `Fragment collected: ${t.symbol}. ${d.explanation}`, actions: [] };
  if (t.phase === 'revealed')
    return {
      text: `You revealed ${t.symbol}. ${d.explanation}`,
      actions: [{ label: `Collect ${t.symbol} fragment`, verb: 'collect' }],
    };
  if (t.phase === 'completed')
    return {
      text: 'Challenge complete. Open the discovery compartment.',
      actions: [{ label: 'Reveal discovery', verb: 'reveal' }],
    };
  let choices = [];
  if (id === 'solar' || id === 'mission')
    choices = shuffled(id === 'solar' ? PLANETS : FLIGHT, s.seed ^ (id === 'solar' ? 31 : 73))
      .filter((v) => !t.steps.includes(v))
      .map((value) => ({ label: value, verb: 'choose', value }));
  if (id === 'globe')
    choices = [
      { label: `Turn globe → ${t.orientation ? 'day' : 'night'}`, verb: 'rotate' },
      {
        label: `Check ${t.steps.length ? 'NIGHT' : 'DAY'}`,
        verb: 'choose',
        value: t.steps.length ? 'night' : 'day',
      },
    ];
  if (id === 'moon')
    choices = [
      ...MOON_VIEWS.map((_, i) => ({
        label: `Position ${i + 1}${t.position === i ? ' · selected' : ''}`,
        verb: 'position',
        value: String(i),
      })),
      ...MOON_VIEWS.map((value) => ({ label: value, verb: 'choose', value })),
    ];
  if (id === 'beacon') {
    const remaining = fragmentList(s).filter((f) => !t.steps.includes(f.id));
    choices = t.selected
      ? remaining.map((f) => ({ label: `Socket: ${f.symbol}`, verb: 'socket', value: f.id }))
      : shuffled(remaining, s.seed ^ 29).map((f) => ({
          label: `Fragment: ${f.symbol}`,
          verb: 'choose',
          value: f.id,
        }));
  }
  return {
    text: t.message || d.instruction,
    actions: [
      ...choices,
      { label: `Hint${t.hint ? ` ${t.hint}/3` : ''}`, verb: 'hint' },
      { label: 'Help me finish', verb: 'assist' },
    ],
  };
}

export function applyTask(s, a) {
  const t = s.tasks[a.id];
  if (!t || !unlocked(s, a.id)) return;
  const id = a.id,
    d = DETAILS[id];
  if (t.collected) return;
  if (a.verb === 'reveal' && t.phase === 'completed') {
    t.phase = 'revealed';
    s.observations.push({
      id,
      answer: t.symbol,
      location: TABLES.find((x) => x.id === id).title,
      choices: ['Moon', 'Sun', 'Rocket', 'Diamond', 'Wave'],
      prompt: `Which symbol did you reveal at ${TABLES.find((x) => x.id === id).title}?`,
    });
    t.message = `You found ${t.symbol}! ${d.explanation}`;
  } else if (a.verb === 'collect' && t.phase === 'revealed') {
    t.collected = true;
    s.fragments++;
    t.message = `${t.symbol} collected! ${s.fragments === 6 ? 'Treasure unlocked beside the entrance.' : DETAILS[currentTable(s).id]?.clue || ''}`;
  } else if (!['completed', 'revealed'].includes(t.phase)) {
    t.phase = 'active';
    const sequence =
      id === 'solar'
        ? PLANETS
        : id === 'mission'
          ? FLIGHT
          : id === 'moon'
            ? MOON_VIEWS
            : id === 'globe'
              ? ['day', 'night']
              : fragmentList(s).map((f) => f.id);
    if (a.verb === 'hint') {
      t.hint = Math.min(3, t.hint + 1);
      t.message =
        t.hint === 1
          ? d.instruction
          : t.hint === 2
            ? d.reference
            : `Next: ${id === 'beacon' ? fragmentList(s).find((f) => !t.steps.includes(f.id))?.symbol : sequence[t.steps.length]}. ${d.reference}`;
    } else if (a.verb === 'assist') {
      t.steps = [...sequence];
      t.orientation = 1;
      t.position = 2;
      t.selected = null;
      t.assisted = true;
      t.message = `Finished together. ${d.reference}`;
    } else if (a.verb === 'rotate' && id === 'globe') {
      t.orientation = 1 - t.orientation;
      t.message = `The marked town is now in ${t.orientation ? 'night' : 'day'}.`;
    } else if (a.verb === 'position' && id === 'moon' && ['0', '1', '2'].includes(a.value)) {
      t.position = Number(a.value);
      t.message = `Position ${t.position + 1}: match the Earth-view disk. ${t.steps.length} of 3 views matched.`;
    } else if (a.verb === 'choose') {
      if (id === 'beacon') {
        if (fragmentList(s).some((f) => f.id === a.value) && !t.steps.includes(a.value)) {
          t.selected = a.value;
          t.message = `Fit ${fragmentList(s).find((f) => f.id === a.value).symbol} into its matching socket.`;
        }
      } else {
        const expected = sequence[t.steps.length];
        const correct =
          a.value === expected &&
          (id !== 'globe' || (t.orientation === 0 ? 'day' : 'night') === expected) &&
          (id !== 'moon' || t.position === t.steps.length);
        if (correct) {
          t.steps.push(a.value);
          t.message = `Matched ${a.value}. ${t.steps.length} of ${sequence.length} steps complete.`;
        } else
          t.message = `Try again; completed steps are safe. ${id === 'moon' ? `Use position ${t.steps.length + 1} next. ` : ''}${d.reference}`;
      }
    } else if (a.verb === 'socket' && id === 'beacon' && t.selected) {
      if (a.value === t.selected) {
        t.steps.push(a.value);
        t.selected = null;
        t.message = `${t.steps.length} of 5 fragments fitted.`;
      } else t.message = 'That socket has a different symbol. Your fitted fragments are safe.';
    }
    if (t.steps.length === sequence.length) {
      t.phase = 'completed';
      t.message += ' Reveal your discovery.';
    }
  }
  s.message = t.message;
}
