import { TABLES, shuffled } from './adventure.js';
export const WORKSHOP_TABLES = TABLES.map((t, i) => ({
  ...t,
  title: [
    'Tool detective',
    'Balance bench',
    'Complete the circuit',
    'Gear direction',
    'Ramp experiment',
    'Machine repair',
  ][i],
}));
export const SYMBOLS = ['Gear', 'Bolt', 'Key', 'Wheel', 'Spring', 'Cog'];
export const TOOLS = ['Hammer', 'Screwdriver', 'Spanner'];
export const JOBS = ['Tap a nail', 'Turn a screw', 'Turn a nut'];
export const PARTS = ['Battery', 'Switch', 'Lamp'];
export const WORKSHOP_DETAILS = {
  cargo: {
    instruction: 'Match each tool to its illustrated job.',
    reference: 'Hammer → Tap a nail. Screwdriver → Turn a screw. Spanner → Turn a nut.',
    explanation: 'Different tool shapes suit different jobs. These are virtual tools.',
    clue: 'Find the toolbox at table 01, back left.',
  },
  solar: {
    instruction: 'Balance three equal blocks on the left by adding blocks to the right.',
    reference:
      'Each block has the same weight and both pans are equally far from the pivot. Add or remove blocks, then check.',
    explanation: 'Three equal blocks on each side balance this equal-arm scale.',
    clue: 'Find the balance scale at table 02, back middle.',
  },
  globe: {
    instruction: 'Place the battery, switch and lamp into the loop, then close the switch.',
    reference:
      'Fit all three labeled components. A closed switch completes the path; an open switch breaks it.',
    explanation:
      'Our virtual low-voltage circuit lights the lamp only when the loop is complete. This is a simplified model, not a wiring activity.',
    clue: 'Find the lamp and wire loop at table 03, back right.',
  },
  moon: {
    instruction:
      'Predict the third gear direction when the first turns clockwise, then turn the handle.',
    reference:
      'Each touching gear turns opposite to its neighbor: clockwise → counterclockwise → clockwise.',
    explanation:
      'Two changes of direction make the third gear turn the same way as the first in this fixed three-gear train.',
    clue: 'Find the three meshing gears at table 04, front left.',
  },
  mission: {
    instruction: 'Run both ramps, then choose the observation that matches the display.',
    reference:
      'Same ball, same ramp length, starting from rest. In this ideal rolling model the higher ramp finishes first. Both finish positions are shown without a timer for you.',
    explanation:
      'With equal ramp lengths, the steeper ramp gives greater acceleration in this simplified rolling model. Friction losses and air drag are omitted.',
    clue: 'Find the two ball ramps at table 05, front middle.',
  },
  beacon: {
    instruction:
      'Fit the five recovered fragments and the supplied final symbol, set power ON, then start the machine.',
    reference:
      'Five symbols come from your discoveries; the sixth is supplied here. Fit every matching socket. Turn power ON before pressing Start.',
    explanation:
      'You combined the workshop discoveries to repair a tabletop automaton. Your gear keepsake awaits at the entrance.',
    clue: 'Find the automaton at table 06, front right.',
  },
};
export const workshopCollected = (s, id) => Boolean(s.tasks[id]?.collected);
export const workshopUnlocked = (s, id) => {
  const i = WORKSHOP_TABLES.findIndex((t) => t.id === id);
  return i === 0 || (i > 0 && workshopCollected(s, WORKSHOP_TABLES[i - 1].id));
};
export function createWorkshop(seed, mode) {
  return {
    seed,
    mode,
    adventure: 'workshop',
    fragments: 0,
    treasure: false,
    tasks: Object.fromEntries(
      WORKSHOP_TABLES.map((t, i) => [
        t.id,
        {
          phase: 'available',
          steps: [],
          selected: null,
          hint: 0,
          assisted: false,
          collected: false,
          count: 0,
          closed: false,
          prediction: null,
          ran: false,
          power: false,
          symbol: shuffled(SYMBOLS, seed ^ 521)[i],
        },
      ]),
    ),
    discovery: ['Striped washer', 'Dotted washer', 'Zigzag washer'][seed % 3],
    drawerOpen: false,
    props: {
      satellite: { opened: false, value: String(2 + (seed % 3)) },
      meteorite: { opened: false, value: ['Triangle', 'Square', 'Hexagon'][seed % 3] },
    },
    observations: [],
    memory: null,
    round: [],
    roundIndex: 0,
    memoryHistory: [],
    message: WORKSHOP_DETAILS.cargo.instruction,
  };
}
export function workshopView(s, id) {
  const t = s.tasks[id],
    d = WORKSHOP_DETAILS[id];
  if (!t) return null;
  if (!workshopUnlocked(s, id))
    return { text: 'Collect the previous table fragment to unlock this task.', actions: [] };
  if (t.collected) return { text: `Collected ${t.symbol}. ${d.explanation}`, actions: [] };
  if (t.phase === 'revealed')
    return {
      text: `Found ${t.symbol}. ${d.explanation}`,
      actions: [{ label: `Collect ${t.symbol} fragment`, verb: 'collect' }],
    };
  if (t.phase === 'completed')
    return {
      text: 'Experiment complete. Reveal your discovery.',
      actions: [{ label: 'Reveal discovery', verb: 'reveal' }],
    };
  const a = (label, verb, value) => ({ label, verb, value });
  let actions = [];
  if (id === 'cargo')
    actions = t.selected
      ? JOBS.map((v) => a(v, 'place', v))
      : TOOLS.filter((v) => !t.steps.includes(v)).map((v) => a(`Select ${v}`, 'choose', v));
  if (id === 'solar')
    actions = [
      a('Add block', 'add'),
      a('Remove block', 'remove'),
      a(`Check balance: 3 left / ${t.count} right`, 'check'),
    ];
  if (id === 'globe')
    actions = [
      ...PARTS.filter((v) => !t.steps.includes(v)).map((v) => a(`Fit ${v}`, 'fit', v)),
      a(t.closed ? 'Open switch' : 'Close switch', 'switch'),
    ];
  if (id === 'moon')
    actions = [
      a('Predict clockwise', 'predict', 'Clockwise'),
      a('Predict counterclockwise', 'predict', 'Counterclockwise'),
      a('Turn handle', 'turn'),
    ];
  if (id === 'mission')
    actions = [
      a('Run both ramps', 'run'),
      ...(t.ran
        ? [
            a('Higher ramp finishes first', 'answer', 'higher'),
            a('Both finish together', 'answer', 'same'),
            a('Lower ramp finishes first', 'answer', 'lower'),
          ]
        : []),
    ];
  if (id === 'beacon')
    actions = [
      ...SYMBOLS.filter((v) => !t.steps.includes(v)).map((v) => a(`Fit ${v} socket`, 'fit', v)),
      a(t.power ? 'Power OFF' : 'Power ON', 'power'),
      a('Start automaton', 'start'),
    ];
  return {
    text: t.message || d.instruction,
    actions: [
      ...actions,
      a(`Hint${t.hint ? ` ${t.hint}/3` : ''}`, 'hint'),
      a('Help me finish', 'assist'),
    ],
  };
}
export function applyWorkshop(s, a) {
  const t = s.tasks[a.id],
    d = WORKSHOP_DETAILS[a.id];
  if (!t || !workshopUnlocked(s, a.id) || t.collected) return;
  const id = a.id;
  if (a.verb === 'reveal' && t.phase === 'completed') {
    t.phase = 'revealed';
    s.observations.push({
      id,
      answer: t.symbol,
      choices: SYMBOLS,
      location: WORKSHOP_TABLES.find((x) => x.id === id).title,
      prompt: `Which symbol did you reveal at ${WORKSHOP_TABLES.find((x) => x.id === id).title}?`,
    });
    t.message = `Found ${t.symbol}. ${d.explanation}`;
  } else if (a.verb === 'collect' && t.phase === 'revealed') {
    t.collected = true;
    s.fragments++;
    t.message =
      s.fragments === 6
        ? 'Open the machine treasure at the entrance.'
        : WORKSHOP_DETAILS[WORKSHOP_TABLES.find((x) => !workshopCollected(s, x.id)).id].clue;
  } else if (!['completed', 'revealed'].includes(t.phase)) {
    t.phase = 'active';
    let done = false;
    if (a.verb === 'hint') {
      t.hint = Math.min(3, t.hint + 1);
      t.message =
        t.hint === 1
          ? d.instruction
          : t.hint === 2
            ? d.reference
            : `Worked step: ${['Match Hammer to Tap a nail.', 'Make the right pan contain 3 blocks, then Check.', 'Fit all components, then Close switch.', 'Predict clockwise, then Turn handle.', 'Run both ramps, then choose Higher ramp finishes first.', 'Fit every socket, select Power ON, then Start.'][WORKSHOP_TABLES.findIndex((x) => x.id === id)]}`;
    } else if (a.verb === 'assist') {
      t.assisted = true;
      t.steps =
        id === 'cargo'
          ? [...TOOLS]
          : id === 'globe'
            ? [...PARTS]
            : id === 'beacon'
              ? [...SYMBOLS]
              : ['Finished together'];
      t.count = 3;
      t.closed = true;
      t.prediction = 'Clockwise';
      t.ran = true;
      t.power = true;
      done = true;
    } else if (id === 'cargo') {
      if (a.verb === 'choose' && TOOLS.includes(a.value) && !t.steps.includes(a.value))
        t.selected = a.value;
      if (a.verb === 'place' && t.selected) {
        if (a.value === JOBS[TOOLS.indexOf(t.selected)]) {
          t.steps.push(t.selected);
          t.selected = null;
        } else t.message = 'Try another job. Read the tool shape reference.';
      }
      done = t.steps.length === 3;
    } else if (id === 'solar') {
      if (a.verb === 'add') t.count = Math.min(5, t.count + 1);
      if (a.verb === 'remove') t.count = Math.max(0, t.count - 1);
      t.message = `Left: 3 blocks. Right: ${t.count}. ${t.count === 3 ? 'Level.' : t.count < 3 ? 'Left pan lower.' : 'Right pan lower.'}`;
      if (a.verb === 'check') {
        done = t.count === 3;
        if (done) t.steps = ['3 blocks on each pan'];
        else t.message += ' Add or remove a block and check again.';
      }
    } else if (id === 'globe') {
      if (a.verb === 'fit' && PARTS.includes(a.value) && !t.steps.includes(a.value))
        t.steps.push(a.value);
      if (a.verb === 'switch') t.closed = !t.closed;
      done = t.steps.length === 3 && t.closed;
      t.message = done
        ? 'The closed loop lights the lamp.'
        : 'Lamp off: fit every component and close the switch.';
    } else if (id === 'moon') {
      if (a.verb === 'predict' && ['Clockwise', 'Counterclockwise'].includes(a.value))
        t.prediction = a.value;
      if (a.verb === 'turn') {
        t.ran = true;
        done = t.prediction === 'Clockwise';
        t.message = done
          ? 'The third gear turns clockwise!'
          : 'Observe: clockwise → counterclockwise → clockwise. Choose a prediction and turn again.';
        if (done) t.steps = ['Clockwise'];
      }
    } else if (id === 'mission') {
      if (a.verb === 'run') {
        t.ran = true;
        t.message =
          'At the same model instant: higher ball at FINISH; lower ball still on its ramp.';
      }
      if (a.verb === 'answer' && t.ran) {
        done = a.value === 'higher';
        t.message = done
          ? 'Your observation matches.'
          : 'Look at the two marked ball positions and try again.';
        if (done) t.steps = ['Higher ramp first'];
      }
    } else if (id === 'beacon') {
      if (a.verb === 'fit' && SYMBOLS.includes(a.value) && !t.steps.includes(a.value))
        t.steps.push(a.value);
      if (a.verb === 'power') t.power = !t.power;
      if (a.verb === 'start') {
        done = t.steps.length === 6 && t.power;
        t.message = done
          ? 'The automaton waves hello!'
          : 'Fit all six sockets and turn power ON before starting.';
      }
    }
    if (done) {
      t.phase = 'completed';
      t.message = `Challenge complete${t.assisted ? ' with help' : ''}. ${d.explanation} Reveal your discovery.`;
    }
  }
  s.message = t.message || d.instruction;
}
