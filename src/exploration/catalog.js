const step = (prompt, options, answer, feedback) => ({ prompt, options, answer, feedback });
const lesson = (prompt, answer, others) => ({ prompt, answer, choices: [answer, ...others] });
const task = (title, kind, steps, explanation, quiz) => ({ title, kind, steps, explanation, quiz });
export const THEMES = {
  space: {
    title: 'The Silent Observatory',
    subtitle: 'Restore a signal. Uncover a universe.',
    color: '#77d9ed',
    dark: '#152b49',
    reward: 'A constellation unfolds above you',
    intro:
      'The observatory has lost its navigation signal. Open the supply locker, investigate Earth and the planets in either order, then use your findings to restore the beacon.',
    tasks: {
      arrival: task(
        'Supply locker',
        'locker',
        [
          step(
            'Select the water capsule, then fit it into the matching slot.',
            ['Water capsule', 'Food capsule', 'Tool capsule'],
            'Water capsule',
            'The water capsule and its slot both carry a circle.',
          ),
        ],
        'Matching labels helps us find the right equipment. You recovered the observatory badge.',
        null,
      ),
      branchA: task(
        'Suspended Earth',
        'globe',
        [
          step(
            'Turn the marked town into sunlight.',
            ['Turn town toward the Sun', 'Turn town away from the Sun'],
            'Turn town toward the Sun',
            'A town facing the Sun receives sunlight.',
          ),
          step(
            'Now turn the town into night.',
            ['Turn town toward the Sun', 'Turn town away from the Sun'],
            'Turn town away from the Sun',
            'Turning away puts the town on the unlit side.',
          ),
        ],
        'Earth rotates. The marked town moves into sunlight for day and away for night. This two-position model simplifies Earth and Sun sizes.',
        lesson(
          'What caused night at the marked town?',
          'Earth turned the town away from sunlight',
          ['The Sun stopped shining', 'The Moon covered the town'],
        ),
      ),
      branchB: task(
        'Planetary wall',
        'planets',
        ['Mercury', 'Venus', 'Earth', 'Mars'].map((p, i) =>
          step(
            `Fit the next planet into orbit slot ${i + 1}, starting nearest the Sun.`,
            ['Mercury', 'Venus', 'Earth', 'Mars'],
            p,
            'Reference: Mercury → Venus → Earth → Mars. Size and spacing are not to scale.',
          ),
        ),
        'The four inner planets, from the Sun, are Mercury, Venus, Earth and Mars. The wall model is not to scale.',
        lesson('Which inner planet is nearest the Sun?', 'Mercury', ['Earth', 'Mars']),
      ),
      synthesis: task(
        'Flight recorder',
        'recorder',
        [
          step(
            'Set the target to the planet immediately outside Earth’s orbit.',
            ['Mercury', 'Venus', 'Mars'],
            'Mars',
            'Your planetary wall showed Mercury → Venus → Earth → Mars.',
          ),
          step(
            'Configure the model Earth departure view for daylight at the marked town.',
            ['Town faces the Sun', 'Town faces away'],
            'Town faces the Sun',
            'Your Earth investigation showed that the sunward town is in daylight.',
          ),
        ],
        'You used both records: Mars follows Earth in the supplied order, and sunlight reaches the sunward town. This is a reasoning puzzle, not real spacecraft navigation.',
        lesson('Which departure view showed daylight?', 'Town faces the Sun', [
          'Town faces away',
          'Either view is always daylight',
        ]),
      ),
      finale: task(
        'Signal beacon',
        'beacon',
        [
          step(
            'Fit the recovered navigation record into the beacon.',
            ['Navigation record'],
            'Navigation record',
            'The recorder carries both investigation results.',
          ),
          step(
            'Send the restored signal.',
            ['Activate beacon'],
            'Activate beacon',
            'The signal releases the constellation.',
          ),
        ],
        'The beacon uses your completed observations. Your explorer keepsake is ready.',
        null,
      ),
      sideA: task(
        'Moon window',
        'moon',
        [
          step(
            'Place the Moon between Earth and Sun in this simplified model.',
            ['Moon toward the Sun', 'Moon opposite the Sun'],
            'Moon toward the Sun',
            'With the Moon toward the Sun, its lit half mostly faces away from Earth.',
          ),
          step(
            'Move it to the opposite side of Earth.',
            ['Moon toward the Sun', 'Moon opposite the Sun'],
            'Moon opposite the Sun',
            'We can now see the lit half as a full Moon; tilt is simplified.',
          ),
        ],
        'Ordinary Moon phases come from changing views of its sunlit half, not Earth’s shadow.',
        lesson(
          'What explains ordinary Moon phases?',
          'Our changing view of the Moon’s sunlit half',
          ['Earth’s shadow every month', 'The Moon makes its own light'],
        ),
      ),
      sideB: task(
        'Stranded rover',
        'rover',
        [
          step(
            'Repair the rover’s missing wheel.',
            ['Wheel', 'Dish', 'Flag'],
            'Wheel',
            'The diagram shows a circular wheel at the empty axle.',
          ),
          ...['Forward', 'Turn right', 'Forward'].map((a, i) =>
            step(
              `Program route step ${i + 1}. Diagram: Forward → Turn right → Forward.`,
              ['Forward', 'Turn right', 'Turn left'],
              a,
              'Follow the three arrows in order.',
            ),
          ),
        ],
        'A program is an ordered set of instructions. Your rover follows the diagram to reach its flag.',
        lesson('Why did the rover reach its flag?', 'It followed the ordered route', [
          'The order did not matter',
          'It guessed every turn',
        ]),
      ),
    },
    props: [
      ['Mission cabinet', 'badge', ['Star', 'Leaf', 'Lightning']],
      ['Satellite alcove', 'panels', ['2', '3', '4']],
      ['Meteorite lens', 'surface', ['Ridges', 'Pits', 'Smooth']],
    ],
  },
  ocean: {
    title: 'The Missing Reef Signal',
    subtitle: 'Follow the current. Bring the reef to life.',
    color: '#6ce5b7',
    dark: '#143c48',
    reward: 'The restored reef reveals its explorer chest',
    intro:
      'The research cabin’s reef display is incomplete. Identify its first visitor, investigate light and food connections, then build a suitable habitat.',
    tasks: {
      arrival: task(
        'Observation window',
        'fish',
        [
          step(
            'Match the visitor with eight arms to its label.',
            ['Octopus', 'Fish', 'Crab'],
            'Octopus',
            'Reference: an octopus has eight arms; fish have fins and crabs have jointed legs.',
          ),
        ],
        'Careful observation of body features helps us describe organisms.',
        null,
      ),
      branchA: task(
        'Depth column',
        'depth',
        [
          step(
            'Place the sunlight marker at the brightest layer.',
            ['Surface', 'Deep water'],
            'Surface',
            'Sunlight enters from above; less reaches deeper water.',
          ),
          step(
            'Place the photosynthesis marker where light is available.',
            ['Sunlit layer', 'Dark deep layer'],
            'Sunlit layer',
            'Photosynthesis needs light.',
          ),
        ],
        'Light decreases with depth. Photosynthetic organisms need suitable light; this display uses simplified layers.',
        lesson('Which layer receives the most sunlight?', 'Surface', [
          'Dark deep layer',
          'Both receive the same light',
        ]),
      ),
      branchB: task(
        'Food-web wall',
        'food',
        ['Algae', 'Small grazing animal', 'Larger predator'].map((a, i) =>
          step(
            `Connect energy link ${i + 1}. Reference: algae → grazer → predator.`,
            ['Algae', 'Small grazing animal', 'Larger predator'],
            a,
            'Arrows run from food to the animal receiving its energy.',
          ),
        ),
        'In this supplied example, energy passes from algae to a grazer to a predator. Real food webs have more connections.',
        lesson(
          'What do the arrows in this food chain show?',
          'Energy passing from food to consumer',
          ['The direction animals swim', 'Water depth'],
        ),
      ),
      synthesis: task(
        'Habitat planner',
        'habitat',
        [
          step(
            'Choose a layer for the display’s algae.',
            ['Sunlit shelf', 'Dark shelf'],
            'Sunlit shelf',
            'Your depth column showed where light is available.',
          ),
          step(
            'Add the organism that grazes on algae.',
            ['Small grazing animal', 'Larger predator'],
            'Small grazing animal',
            'Your food-web wall showed the algae → grazer link.',
          ),
        ],
        'You connected light requirements with a supplied food relationship to plan this simplified habitat.',
        lesson('Why did the algae go on the sunlit shelf?', 'They need light for photosynthesis', [
          'All organisms need shallow water',
          'Dark water has no living things',
        ]),
      ),
      finale: task(
        'Living reef',
        'reef',
        [
          step(
            'Fit the habitat plan into the reef display.',
            ['Habitat plan'],
            'Habitat plan',
            'Both investigations inform your plan.',
          ),
          step(
            'Open the observation shutters.',
            ['Restore reef'],
            'Restore reef',
            'The restored model reveals your chest.',
          ),
        ],
        'Shelter, suitable conditions and food connections help form habitats. This miniature is a simplified representation.',
        null,
      ),
      sideA: task(
        'Shoreline cleanup',
        'cleanup',
        [
          step(
            'Lift only the human-made litter into the collection pocket.',
            ['Plastic bottle', 'Shell', 'Rock'],
            'Plastic bottle',
            'Shells and rocks can be habitat materials; the bottle is human-made litter.',
          ),
          step(
            'Place the bottle in the collection bin.',
            ['Collection bin'],
            'Collection bin',
            'Leave the natural materials in place.',
          ),
        ],
        'Removing litter is different from removing all objects from a habitat.',
        lesson('Which item was litter in this model?', 'Plastic bottle', ['Shell', 'Rock']),
      ),
      sideB: task(
        'Current channel',
        'channel',
        [
          step(
            'Turn the first channel to the arrow on the reference diagram.',
            ['Turn right', 'Turn left'],
            'Turn right',
            'Diagram: Right → Straight → Left.',
          ),
          step(
            'Set the middle channel.',
            ['Straight', 'Turn right'],
            'Straight',
            'Keep the marker moving along the diagram.',
          ),
          step(
            'Turn the final channel toward the collector.',
            ['Turn left', 'Turn right'],
            'Turn left',
            'The channel now reaches its collection point.',
          ),
        ],
        'This channel is a routing puzzle, not a fluid simulation. Connected sections guide the marker.',
        lesson('What made the channel route work?', 'All sections connected to the collector', [
          'Unconnected sections',
          'The marker could cross walls',
        ]),
      ),
    },
    props: [
      ['Shell cabinet', 'shell', ['Spiral shell', 'Fan shell', 'Striped shell']],
      ['Periscope alcove', 'fish', ['2', '3', '4']],
      ['Fish lens', 'pattern', ['Spots', 'Stripes', 'Plain']],
    ],
  },
  workshop: {
    title: 'The Sleeping Machine',
    subtitle: 'Make a prediction. Wake an invention.',
    color: '#ffc47e',
    dark: '#3b3046',
    reward: 'The automaton wakes with your keepsake',
    intro:
      'The inventor left a sleeping machine. Find a useful tool, investigate balance and electricity, then configure its drive mechanism.',
    tasks: {
      arrival: task(
        'Tool cabinet',
        'tools',
        [
          step(
            'Choose the tool for the illustrated screw head.',
            ['Screwdriver', 'Spanner', 'Brush'],
            'Screwdriver',
            'The screwdriver tip fits the screw head.',
          ),
        ],
        'Tools have shapes suited to particular tasks.',
        null,
      ),
      branchA: task(
        'Circuit wall',
        'circuit',
        ['Battery', 'Lamp', 'Switch', 'Close switch'].map((a, i) =>
          step(
            `Build the loop: step ${i + 1}. Diagram: battery → lamp → switch → closed return wire.`,
            ['Battery', 'Lamp', 'Switch', 'Close switch'],
            a,
            'All components and a closed loop are needed to light the lamp.',
          ),
        ),
        'A complete circuit provides a closed path through the battery and lamp. This is a virtual low-voltage model.',
        lesson('When did the lamp light?', 'When the complete circuit was closed', [
          'When the battery was missing',
          'When the switch was open',
        ]),
      ),
      branchB: task(
        'Hanging balance',
        'balance',
        [
          step(
            'The left pan holds two equal blocks. Add the first block to the right pan.',
            ['Add right block', 'Add left block'],
            'Add right block',
            'Equal arms need equal total weights to balance.',
          ),
          step(
            'Add one more equal block to the right pan.',
            ['Add right block', 'Add left block'],
            'Add right block',
            'Two equal blocks now sit on each side.',
          ),
        ],
        'With equal arm lengths, equal total weights balance. The model uses identical blocks.',
        lesson('What balanced the equal-arm scale?', 'Equal total weights on both sides', [
          'More weight on one side',
          'Any number of blocks',
        ]),
      ),
      synthesis: task(
        'Drive mechanism',
        'gears',
        [
          step(
            'Choose the motor’s power configuration using your circuit record.',
            ['Complete closed circuit', 'Open circuit'],
            'Complete closed circuit',
            'Your circuit investigation showed when power could flow.',
          ),
          step(
            'Set the equal-arm stabilizer using your balance record.',
            ['Equal weights', 'Unequal weights'],
            'Equal weights',
            'The hanging balance demonstrated equal total weights.',
          ),
          step(
            'Inspect the three fixed meshing gears: clockwise → counterclockwise → clockwise. Turn the handle to test.',
            ['Turn handle'],
            'Turn handle',
            'Each neighboring gear reverses rotation.',
          ),
        ],
        'You combined a closed circuit and balanced stabilizer to run the model. Its three fixed meshing gears alternate direction.',
        lesson('How did the last of three meshing gears turn?', 'Same direction as the first', [
          'Opposite direction to the first',
          'It did not move',
        ]),
      ),
      finale: task(
        'Sleeping automaton',
        'robot',
        [
          step(
            'Fit the tested drive into the machine.',
            ['Tested drive'],
            'Tested drive',
            'Your powered, balanced mechanism is ready.',
          ),
          step(
            'Wake the automaton.',
            ['Wake machine'],
            'Wake machine',
            'It presents your explorer keepsake.',
          ),
        ],
        'Testing parts before combining them helps us understand how a machine works.',
        null,
      ),
      sideA: task(
        'Ramp laboratory',
        'ramp',
        [
          step(
            'Predict which equal-length, smooth ramp has the greater vertical drop.',
            ['Steeper ramp', 'Shallower ramp'],
            'Steeper ramp',
            'The steeper ramp starts higher for the same ramp length.',
          ),
          step(
            'Release both model balls and compare their travel down the ramps.',
            ['Release balls'],
            'Release balls',
            'In this simplified model, the steeper ramp ball reaches the bottom first.',
          ),
        ],
        'This authored comparison assumes equal balls, equal ramp lengths and matching surfaces. It does not model every real-world force.',
        lesson('Which ramp had the larger vertical drop?', 'Steeper ramp', [
          'Shallower ramp',
          'They were identical',
        ]),
      ),
      sideB: task(
        'Wind-up toy',
        'toy',
        [
          step(
            'Fit the missing winding key.',
            ['Winding key', 'Paintbrush', 'Wheel'],
            'Winding key',
            'The diagram points to the square winding socket.',
          ),
          step(
            'Wind and release the toy.',
            ['Wind and release'],
            'Wind and release',
            'The toy moves along its short display rail.',
          ),
        ],
        'Winding stores energy in a spring. The model represents its release as motion.',
        lesson('What did winding the toy do?', 'Stored energy in its spring', [
          'Created energy from nothing',
          'Removed its wheels',
        ]),
      ),
    },
    props: [
      ['Parts cabinet', 'washer', ['Striped washer', 'Dotted washer', 'Zigzag washer']],
      ['Toy alcove', 'wheels', ['2', '3', '4']],
      ['Magnifying lens', 'shape', ['Triangle', 'Square', 'Hexagon']],
    ],
  },
};
export const MAIN = ['arrival', 'branchA', 'branchB', 'synthesis', 'finale'];
export const PREREQUISITES = {
  arrival: [],
  branchA: ['arrival'],
  branchB: ['arrival'],
  synthesis: ['branchA', 'branchB'],
  finale: ['synthesis'],
  sideA: ['arrival'],
  sideB: ['arrival'],
};
// Shared anchors describe both the rendered fixtures and collision/navigation footprint.
export const ANCHORS = {
  arrival: { x: -4.8, z: 4.6, approach: { x: -3.5, z: 4.6 }, label: 'Entrance locker' },
  branchA: { x: 4.8, z: -3.6, approach: { x: 3.5, z: -2 }, label: 'Suspended model' },
  branchB: { x: -3.8, z: -5.6, approach: { x: -3.8, z: -3.8 }, label: 'Wall mechanism' },
  synthesis: { x: 4.9, z: 1.1, approach: { x: 3.3, z: 1.1 }, label: 'Investigation alcove' },
  finale: { x: 0, z: -0.4, approach: { x: 0, z: 1.9 }, label: 'Central feature' },
  sideA: { x: 0, z: -5.5, approach: { x: 0, z: -3.7 }, label: 'Observation window' },
  sideB: { x: -4.9, z: 0, approach: { x: -3.3, z: 0 }, label: 'Side workshop' },
  prop0: { x: -5.4, z: 2.6, approach: { x: -3.7, z: 2.6 }, label: 'Discovery cabinet' },
  prop1: { x: 5.4, z: 4.5, approach: { x: 3.6, z: 4.5 }, label: 'Discovery alcove' },
  prop2: { x: 5.3, z: -5.7, approach: { x: 3.5, z: -5.7 }, label: 'Inspection lens' },
};
