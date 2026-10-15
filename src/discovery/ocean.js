import { TABLES, shuffled } from './adventure.js';

// IDs are fixed room anchors, not subject names. Each adventure owns its state/content.
export const OCEAN_TABLES = TABLES.map((t, i) => ({
  ...t,
  title: [
    'Reef explorer',
    'Ocean zones',
    'Food connections',
    'Reef cleanup',
    'Current channel',
    'Reef restoration',
  ][i],
}));
export const OCEAN_SYMBOLS = ['Shell', 'Coral', 'Pearl', 'Seahorse', 'Anchor', 'Starfish'];
export const ANIMALS = ['Fish', 'Crab', 'Octopus'];
export const ZONES = ['Sunlight', 'Twilight', 'Midnight'];
export const CREATURES = ['Reef fish', 'Hatchetfish', 'Deep-sea anglerfish'];
export const CHAIN = ['Phytoplankton', 'Zooplankton', 'Fish larvae'];
export const LITTER = ['Plastic bottle', 'Tin can', 'Fishing line'];
export const HABITATS = ['Branch shelter', 'Rock ledge', 'Open channel'];
export const OCEAN_DETAILS = {
  cargo: {
    instruction: 'Match each animal to the reference with the same body features.',
    reference: 'Fish: fins and tail. Crab: claws and legs. Octopus: eight arms.',
    explanation:
      'Look at body features to tell these models apart. Real animals vary in shape and size.',
    clue: 'Find the three animal models at table 01, back left.',
  },
  solar: {
    instruction: 'Select a creature card, then its described ocean zone.',
    reference:
      'In this display: reef fish in Sunlight; hatchetfish in Twilight; deep-sea anglerfish in Midnight. These are examples, not limits on where all fish live.',
    explanation:
      'Sunlight decreases with depth: bright upper waters, faint twilight, then no sunlight. Depths and creatures here are simplified examples.',
    clue: 'Find the three blue depth layers at table 02, back middle.',
  },
  globe: {
    instruction: 'Connect the food chain in the direction energy travels.',
    reference:
      'Phytoplankton → Zooplankton → Fish larvae. The arrow goes from food to the organism eating it.',
    explanation:
      'This is one small food-chain example. Real food webs have many connections. Many zooplankton eat phytoplankton, and fish larvae can eat zooplankton.',
    clue: 'Find the plankton models at table 03, back right.',
  },
  moon: {
    instruction:
      'Move human-made litter into the collection tray. Leave rocks and shells in the display.',
    reference:
      'Collect Plastic bottle, Tin can and Fishing line. Rock and Shell belong to this model habitat.',
    explanation:
      'Removing human-made litter helps protect habitats. This is a virtual cleanup, not instructions to handle waste outdoors.',
    clue: 'Find the cleanup tray at table 04, front left.',
  },
  mission: {
    instruction: 'Turn all three channel arrows RIGHT, then release the floating token.',
    reference:
      'The inlet is on the left and collection gate is on the right. Each turn moves an arrow clockwise: Up → Right → Down → Left.',
    explanation:
      'Connected channels let the token reach the gate. This is a routing puzzle, not a simulation of real ocean currents.',
    clue: 'Find the channel arrows at table 05, front middle.',
  },
  beacon: {
    instruction: 'Place each habitat piece where the reef plan marks its purpose.',
    reference:
      'Branch shelter → Fish hideout. Rock ledge → Shaded nook. Open channel → Swimming lane.',
    explanation:
      'A habitat offers places to shelter and move. Follow this miniature reef plan to reveal the chest key; real restoration needs expert care.',
    clue: 'Find the reef building pieces at table 06, front right.',
  },
};
export const oceanCollected = (s, id) => Boolean(s.tasks[id]?.collected);
export const oceanCurrent = (s) =>
  OCEAN_TABLES.find((t) => !oceanCollected(s, t.id)) ?? OCEAN_TABLES[5];
export const oceanUnlocked = (s, id) => {
  const i = OCEAN_TABLES.findIndex((t) => t.id === id);
  return i === 0 || (i > 0 && oceanCollected(s, OCEAN_TABLES[i - 1].id));
};
export function createOcean(seed, mode) {
  return {
    seed,
    mode,
    adventure: 'ocean',
    fragments: 0,
    treasure: false,
    tasks: Object.fromEntries(
      OCEAN_TABLES.map((t, i) => [
        t.id,
        {
          phase: 'available',
          steps: [],
          selected: null,
          hint: 0,
          assisted: false,
          collected: false,
          turns: [0, 2, 3],
          symbol: shuffled(OCEAN_SYMBOLS, seed ^ 943)[i],
        },
      ]),
    ),
    discovery: ['Spiral shell', 'Striped shell', 'Fan shell'][seed % 3],
    drawerOpen: false,
    props: {
      satellite: { opened: false, value: String(2 + (seed % 3)) },
      meteorite: { opened: false, value: ['Spots', 'Stripes', 'Plain'][seed % 3] },
    },
    observations: [],
    memory: null,
    round: [],
    roundIndex: 0,
    memoryHistory: [],
    message: OCEAN_DETAILS.cargo.instruction,
  };
}
export function oceanView(s, id) {
  const t = s.tasks[id],
    d = OCEAN_DETAILS[id];
  if (!t) return null;
  if (!oceanUnlocked(s, id))
    return {
      text: `Collect the fragment at ${OCEAN_TABLES[OCEAN_TABLES.findIndex((x) => x.id === id) - 1].title} first.`,
      actions: [],
    };
  if (t.collected) return { text: `Collected ${t.symbol}. ${d.explanation}`, actions: [] };
  if (t.phase === 'revealed')
    return {
      text: `You revealed ${t.symbol}. ${d.explanation}`,
      actions: [{ label: `Collect ${t.symbol} fragment`, verb: 'collect' }],
    };
  if (t.phase === 'completed')
    return {
      text: 'Challenge complete! Open the discovery compartment.',
      actions: [{ label: 'Reveal discovery', verb: 'reveal' }],
    };
  let actions = [];
  if (['cargo', 'solar', 'beacon'].includes(id)) {
    const sources = id === 'cargo' ? ANIMALS : id === 'solar' ? CREATURES : HABITATS;
    const targets =
      id === 'cargo'
        ? ANIMALS
        : id === 'solar'
          ? ZONES
          : ['Fish hideout', 'Shaded nook', 'Swimming lane'];
    actions = t.selected
      ? targets.map((value) => ({ label: `Place: ${value}`, verb: 'place', value }))
      : shuffled(sources, s.seed ^ 31)
          .filter((v) => !t.steps.includes(v))
          .map((value) => ({ label: `Select: ${value}`, verb: 'choose', value }));
  } else if (id === 'globe')
    actions = shuffled(CHAIN, s.seed ^ 37)
      .filter((v) => !t.steps.includes(v))
      .map((value) => ({ label: value, verb: 'choose', value }));
  else if (id === 'moon')
    actions = [...LITTER, 'Rock', 'Shell']
      .filter((v) => !t.steps.includes(v))
      .map((value) => ({ label: `Collect: ${value}`, verb: 'choose', value }));
  else
    actions = [
      ...t.turns.map((v, i) => ({
        label: `Turn ${i + 1}: ${['Up', 'Right', 'Down', 'Left'][v]}`,
        verb: 'rotate',
        value: String(i),
      })),
      { label: 'Release token', verb: 'release' },
    ];
  return {
    text: t.message || d.instruction,
    actions: [
      ...actions,
      { label: `Hint${t.hint ? ` ${t.hint}/3` : ''}`, verb: 'hint' },
      { label: 'Help me finish', verb: 'assist' },
    ],
  };
}
export function applyOcean(s, a) {
  const t = s.tasks[a.id],
    d = OCEAN_DETAILS[a.id];
  if (!t || !oceanUnlocked(s, a.id) || t.collected) return;
  const id = a.id,
    goal =
      id === 'cargo'
        ? ANIMALS
        : id === 'solar'
          ? CREATURES
          : id === 'globe'
            ? CHAIN
            : id === 'moon'
              ? LITTER
              : id === 'beacon'
                ? HABITATS
                : ['Token delivered'];
  if (a.verb === 'reveal' && t.phase === 'completed') {
    t.phase = 'revealed';
    s.observations.push({
      id,
      answer: t.symbol,
      location: OCEAN_TABLES.find((x) => x.id === id).title,
      choices: OCEAN_SYMBOLS,
      prompt: `Which symbol did you uncover at ${OCEAN_TABLES.find((x) => x.id === id).title}?`,
    });
    t.message = `You found ${t.symbol}. ${d.explanation}`;
  } else if (a.verb === 'collect' && t.phase === 'revealed') {
    t.collected = true;
    s.fragments++;
    t.message =
      s.fragments === 6
        ? 'Six fragments! Open the reef chest beside the entrance.'
        : OCEAN_DETAILS[oceanCurrent(s).id].clue;
  } else if (!['completed', 'revealed'].includes(t.phase)) {
    t.phase = 'active';
    if (a.verb === 'hint') {
      t.hint = Math.min(3, t.hint + 1);
      t.message =
        t.hint === 1
          ? d.instruction
          : t.hint === 2
            ? d.reference
            : `Try ${goal.find((v) => !t.steps.includes(v))}. ${d.reference}`;
    } else if (a.verb === 'assist') {
      t.steps = [...goal];
      t.turns = [1, 1, 1];
      t.selected = null;
      t.assisted = true;
      t.message = `Finished together. ${d.reference}`;
    } else if (a.verb === 'choose') {
      if (['cargo', 'solar', 'beacon'].includes(id)) {
        if (goal.includes(a.value) && !t.steps.includes(a.value)) {
          t.selected = a.value;
          t.message = `Selected ${a.value}. ${d.reference}`;
        }
      } else if (id === 'globe') {
        if (a.value === goal[t.steps.length]) {
          t.steps.push(a.value);
          t.message = `Connected ${a.value}. Energy flows along the arrows.`;
        } else t.message = `Try again. ${d.reference}`;
      } else if (id === 'moon') {
        if (LITTER.includes(a.value) && !t.steps.includes(a.value)) {
          t.steps.push(a.value);
          t.message = `${a.value} moved to the tray.`;
        } else t.message = 'Leave that natural object in the habitat. Look for human-made litter.';
      }
    } else if (a.verb === 'place' && t.selected) {
      const targets =
        id === 'cargo'
          ? ANIMALS
          : id === 'solar'
            ? ZONES
            : ['Fish hideout', 'Shaded nook', 'Swimming lane'];
      if (a.value === targets[goal.indexOf(t.selected)]) {
        t.steps.push(t.selected);
        t.selected = null;
        t.message = `Placed correctly. ${t.steps.length} of 3.`;
      } else t.message = `Try another location. Your completed matches are safe. ${d.reference}`;
    } else if (a.verb === 'rotate' && id === 'mission' && ['0', '1', '2'].includes(a.value)) {
      const i = Number(a.value);
      t.turns[i] = (t.turns[i] + 1) % 4;
      t.message = 'Check that every arrow points RIGHT before releasing.';
    } else if (a.verb === 'release' && id === 'mission') {
      if (t.turns.every((v) => v === 1)) {
        t.steps = ['Token delivered'];
        t.message = 'The token reached the collection gate!';
      } else t.message = 'The route is not connected. Turn every arrow RIGHT and try again.';
    }
    if (t.steps.length === goal.length) {
      t.phase = 'completed';
      t.message += ' Reveal your discovery.';
    }
  }
  s.message = t.message;
}
