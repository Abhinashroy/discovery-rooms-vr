export const SUN_KM = 1391400,
  SUN_DIAMETER = 20;
export const displayDiameter = (km) => (km / SUN_KM) * SUN_DIAMETER;
// Enlarge the four inner planets together; Mercury now equals the former Earth model.
export const INNER_ENLARGEMENT = 12756 / 4879;
export const PLANETS = Object.freeze(
  [
    {
      id: 'mercury',
      name: 'Mercury',
      km: 4879,
      tilt: 0.034,
      cue: 'The smallest planet. Look for its grey, cratered surface.',
      x: -19,
      z: -2,
    },
    {
      id: 'venus',
      name: 'Venus',
      km: 12104,
      tilt: 177.4,
      cue: 'A rocky planet hidden under thick, creamy clouds.',
      x: -16,
      z: 4,
    },
    {
      id: 'earth',
      name: 'Earth',
      km: 12756,
      tilt: 23.4,
      cue: 'Our home: oceans, continents and white clouds.',
      x: -12,
      z: 9,
    },
    {
      id: 'mars',
      name: 'Mars',
      km: 6792,
      tilt: 25.2,
      cue: 'The red planet, with rusty terrain and polar ice.',
      x: -6,
      z: 12,
    },
    {
      id: 'jupiter',
      name: 'Jupiter',
      km: 142984,
      tilt: 3.1,
      ringKm: [122500, 129000],
      cue: 'The largest planet. Notice its bands and Great Red Spot.',
      x: 1,
      z: 13,
    },
    {
      id: 'saturn',
      name: 'Saturn',
      km: 120536,
      tilt: 26.7,
      ringKm: [74500, 136780],
      cue: 'Pale cloud bands and broad, bright rings.',
      x: 9,
      z: 11,
    },
    {
      id: 'uranus',
      name: 'Uranus',
      km: 51118,
      tilt: 97.8,
      ringKm: [41837, 51149],
      cue: 'A blue-green ice giant tilted almost onto its side.',
      x: 16,
      z: 6,
    },
    {
      id: 'neptune',
      name: 'Neptune',
      km: 49528,
      tilt: 28.3,
      ringKm: [41900, 62930],
      cue: 'The eighth planet: a blue-green ice giant, farthest from the Sun.',
      x: 19,
      z: 0,
    },
  ].map((p, i) =>
    Object.freeze({
      ...p,
      order: i + 1,
      diameter: displayDiameter(p.km) * (i < 4 ? INNER_ENLARGEMENT : 1),
    }),
  ),
);
export const BY_ID = Object.freeze(Object.fromEntries(PLANETS.map((p) => [p.id, p])));
export const IDS = Object.freeze(PLANETS.map((p) => p.id));
export function randomSource(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled(values, random) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const LEARNING_FACTS = Object.freeze({
  mercury: [
    'Mercury is first from the Sun and the smallest planet.',
    'Its grey, rocky surface is covered in impact craters.',
  ],
  venus: [
    'Venus is second from the Sun and similar to Earth in size.',
    'Its thick atmosphere traps heat, making its surface the hottest.',
  ],
  earth: [
    'Earth is third from the Sun and our home.',
    'It is one of the four rocky inner planets, with oceans, continents and clouds.',
  ],
  mars: [
    'Mars is fourth from the Sun, just after Earth.',
    'Rusty iron minerals give the Red Planet its reddish colour.',
  ],
  jupiter: [
    'Jupiter is fifth from the Sun and the largest planet.',
    'It is a gas giant. Its stripes are clouds; the Great Red Spot is a giant storm.',
  ],
  saturn: [
    'Saturn is sixth, between Jupiter and Uranus, and is a gas giant.',
    'Its broad bright rings contain many separate pieces of ice and rock.',
  ],
  uranus: [
    'Uranus is seventh from the Sun and is an ice giant.',
    'It rotates almost on its side, with a tilt of about 98 degrees.',
  ],
  neptune: [
    'Neptune is eighth, the farthest of the eight planets from the Sun.',
    'Neptune and Uranus are the two ice giants.',
  ],
});
export const SOLAR_NOTES = [
  'The Sun is a star. Eight planets orbit it; Pluto is a dwarf planet.',
  'To orbit means to travel around another body, such as a planet travelling around the Sun.',
  'The inner four planets are rocky. Jupiter and Saturn are gas giants; Uranus and Neptune are ice giants.',
];
