import {
  OCEAN_TABLES,
  oceanView,
  oceanUnlocked,
  ANIMALS,
  CREATURES,
  ZONES,
  CHAIN,
  LITTER,
  HABITATS,
} from './ocean.js';
import { PROPS, DISCOVERY } from './adventure.js';
import { approachPoint } from './navigation.js';

export function createOceanScene(root, { node, box, sphere, sign, action }) {
  function animal(name, position, scale = 1, color = '#edb672') {
    const group = node('a-entity', { position, scale: `${scale} ${scale} ${scale}` });
    group.append(sphere('0 0 0', 0.18, color, { scale: '1.5 .8 .65' }));
    if (name === 'Crab') {
      for (const x of [-0.3, 0.3]) {
        group.append(sphere(`${x} .08 0`, 0.09, color));
        for (let i = 0; i < 3; i++)
          group.append(box(`${x * 0.7} -.05 ${-0.1 + i * 0.1}`, [0.3, 0.035, 0.035], color));
      }
    } else if (name === 'Octopus') {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        group.append(
          node('a-cylinder', {
            position: `${Math.cos(a) * 0.15} -.15 ${Math.sin(a) * 0.15}`,
            radius: 0.03,
            height: 0.27,
            color,
          }),
        );
      }
    } else
      group.append(
        node('a-cone', {
          position: '-.3 0 0',
          'radius-bottom': 0.13,
          'radius-top': 0,
          height: 0.2,
          color,
          rotation: '0 0 -90',
          'segments-radial': 3,
        }),
      );
    group.append(sphere('.13 .04 .115', 0.025, '#183e49'));
    return group;
  }
  function shell(name, position, scale = 1) {
    const g = node('a-entity', { position, scale: `${scale} ${scale} ${scale}` });
    g.append(sphere('0 0 0', 0.2, '#f3c797', { scale: '1.2 .7 .5' }));
    if (name.includes('Spiral'))
      g.append(
        node('a-torus', {
          position: '0 0 .11',
          radius: 0.1,
          'radius-tubular': 0.025,
          color: '#b77c72',
        }),
      );
    else
      for (let i = 0; i < 5; i++)
        g.append(
          box(`${-0.12 + i * 0.06} 0 .1`, [0.018, 0.22, 0.015], '#b77c72', {
            rotation: `0 0 ${name.includes('Fan') ? (i - 2) * 18 : 0}`,
          }),
        );
    return g;
  }
  return {
    render(s) {
      root.replaceChildren();
      root.append(sign('OCEAN GUARDIANS', '0 4.13 -6.78', 4.2, 0.55, '#23596a', '#fff0d1'));
      for (const x of [-4.6, 0, 4.6]) {
        root.append(
          node('a-circle', { position: `${x} 2.9 -6.86`, radius: 1.12, color: '#3f93a4' }),
          node('a-torus', {
            position: `${x} 2.9 -6.8`,
            radius: 1.16,
            'radius-tubular': 0.08,
            color: '#c5e5dc',
          }),
        );
        root.append(animal('Fish', `${x} 2.9 -6.65`, 1.8));
      }
      for (const table of OCEAN_TABLES) {
        const t = s.tasks[table.id],
          view = oceanView(s, table.id),
          g = node('a-entity', {
            position: `${table.x} 0 ${table.z}`,
            'data-ocean-table': table.id,
          });
        root.append(g);
        const tint = t.collected ? '#8bc8aa' : oceanUnlocked(s, table.id) ? '#63b7bb' : '#8babb4';
        g.append(
          box('0 .52 0', [1.85, 1.04, 0.85], '#e3dfc6'),
          box('0 1.06 0', [2.4, 0.14, 1.35], tint),
          sign(
            `${table.icon} / ${table.title}`,
            '0 2.85 -.5',
            2.5,
            0.35,
            '#d4ece1',
            '#1d4658',
            action(`open:${table.id}`, table.id),
          ),
          sign(
            view.text,
            '0 2.43 -.35',
            2.5,
            0.48,
            '#f5f2db',
            '#1e4554',
            action(`open:${table.id}`, table.id),
          ),
        );
        if (table.id === 'cargo')
          ANIMALS.forEach((name, i) => {
            const x = -0.75 + i * 0.75;
            g.append(
              animal(
                name,
                `${x} ${t.steps.includes(name) ? 1.75 : 1.4} 0`,
                0.85,
                t.selected === name ? '#f4bc69' : '#e89075',
              ),
              sign(name, `${x} 1.17 .2`, 0.67, 0.16),
            );
          });
        if (table.id === 'solar')
          ZONES.forEach((zone, i) => {
            g.append(
              box(
                `0 ${1.9 - i * 0.25} -.15`,
                [1.6, 0.23, 0.42],
                ['#8fd4d7', '#397d9a', '#233e67'][i],
              ),
              sign(
                `${zone}${t.steps.includes(CREATURES[i]) ? ` / ${CREATURES[i]}` : ''}`,
                `0 ${1.9 - i * 0.25} .08`,
                1.6,
                0.2,
                '#d9ece4',
                '#1e4554',
              ),
            );
          });
        if (table.id === 'globe') {
          CHAIN.forEach((v, i) => {
            const x = -0.7 + i * 0.7;
            if (i === 2) g.append(animal('Fish', `${x} 1.65 0`, 0.8));
            else
              for (let j = 0; j < 4; j++)
                g.append(
                  sphere(
                    `${x + (j % 2) * 0.13} ${1.6 + Math.floor(j / 2) * 0.13} 0`,
                    0.065,
                    i ? '#e5b992' : '#80c894',
                  ),
                );
            g.append(sign(t.steps.includes(v) ? v : '?', `${x} 1.25 .1`, 0.65, 0.2));
            if (i < 2) g.append(sign('→', `${x + 0.37} 1.7 .1`, 0.25, 0.2));
          });
          g.append(sign('ENERGY →', '0 2.05 .05', 1.3, 0.2));
        }
        if (table.id === 'moon') {
          [...LITTER, 'Rock', 'Shell'].forEach((v, i) => {
            const picked = t.steps.includes(v),
              x = picked ? 0.78 : -0.85 + i * 0.35,
              y = picked ? 1.3 + i * 0.06 : 1.4;
            if (v === 'Shell') g.append(shell('Fan shell', `${x} ${y} 0`, 0.5));
            else
              g.append(
                box(
                  `${x} ${y} 0`,
                  [0.17, 0.15, 0.2],
                  v === 'Rock' ? '#929e9e' : v === 'Plastic bottle' ? '#a1d5da' : '#d0aa83',
                ),
              );
          });
          g.append(sign('COLLECTION TRAY', '.78 1.18 .3', 0.8, 0.16));
        }
        if (table.id === 'mission') {
          t.turns.forEach((v, i) => {
            const x = -0.65 + i * 0.65;
            g.append(box(`${x} 1.35 0`, [0.58, 0.15, 0.55], '#4698a6'));
            const arrow = node('a-entity', {
              position: `${x} 1.72 .15`,
              rotation: `0 0 ${-90 * v}`,
            });
            arrow.append(
              box('0 -.04 0', [0.055, 0.23, 0.04], '#173f50'),
              node('a-cone', {
                position: '0 .13 0',
                'radius-bottom': 0.11,
                'radius-top': 0,
                height: 0.16,
                'segments-radial': 3,
                color: '#173f50',
              }),
            );
            g.append(arrow);
          });
          g.append(
            sphere(`${t.steps.length ? 1.05 : -1.05} 1.6 0`, 0.11, '#f5cf82'),
            sign('IN → GATE', '0 1.12 .2', 1.4, 0.16),
          );
        }
        if (table.id === 'beacon') {
          g.append(box('0 1.2 0', [1.9, 0.12, 0.8], '#97c8b4'));
          HABITATS.forEach((v, i) => {
            if (t.steps.includes(v)) {
              const x = -0.65 + i * 0.65;
              g.append(
                box(`${x} 1.43 0`, [0.4, 0.42, 0.3], ['#d98887', '#b5b2a0', '#76babc'][i]),
                animal('Fish', `${x} 1.8 .1`, 0.45),
              );
            }
          });
        }
        if (t.phase === 'revealed') {
          g.append(
            box('0 1.85 -.2', [1.6, 0.1, 0.45], '#d4ac77', { rotation: '-40 0 0' }),
            sign(`DISCOVERY: ${t.symbol}`, '0 2.06 .2', 1.9, 0.24, '#ffe0a6', '#21475b'),
          );
        }
        view.actions.forEach((a, i) =>
          g.append(
            sign(
              a.label,
              `${i % 2 ? 0.57 : -0.57} ${0.94 - Math.floor(i / 2) * 0.22} .8`,
              1.08,
              0.19,
              tint,
              '#183e49',
              action(`task:${table.id}:${a.verb}:${a.value || ''}`, table.id),
            ),
          ),
        );
        if (!oceanUnlocked(s, table.id))
          g.append(
            sign(
              'READ CLUE',
              '0 .8 .8',
              1.7,
              0.27,
              tint,
              '#183e49',
              action(`open:${table.id}`, table.id),
            ),
          );
        const p = approachPoint(table);
        root.append(
          node('a-circle', {
            position: `${p.x} .02 ${p.z}`,
            rotation: '-90 0 0',
            radius: 0.33,
            color: tint,
            ...action(`teleport:${table.id}`),
          }),
        );
      }
      const drawer = node('a-entity', { position: `${DISCOVERY.x} 0 ${DISCOVERY.z}` });
      root.append(drawer);
      drawer.append(
        box('0 .55 0', [1.25, 1.1, 0.65], '#7fb7b2'),
        sign('SHELL DRAWER', '0 1.8 .1', 1.4, 0.3),
      );
      if (s.drawerOpen)
        drawer.append(shell(s.discovery, '0 1.25 .1'), sign(s.discovery, '0 .8 .35', 1.15, 0.23));
      drawer.append(
        sign(
          'OPEN & INSPECT',
          '0 .4 .35',
          1.2,
          0.26,
          '#d9ece4',
          '#21475b',
          action('inspect-drawer', 'drawer'),
        ),
      );
      for (const [i, p] of PROPS.entries()) {
        const prop = s.props[p.id],
          g = node('a-entity', { position: `${p.x} 0 ${p.z}` });
        root.append(g);
        g.append(
          sign(i ? 'FISH VIEWER' : 'PERISCOPE VIEWER', '0 2.5 0', 1.25, 0.3),
          sign(
            prop.opened ? prop.value : 'INSPECT',
            '0 1.2 .15',
            1.25,
            0.25,
            '#d9ece4',
            '#21475b',
            action(`inspect-prop:${p.id}`, p.id),
          ),
        );
        if (!i) {
          g.append(box('0 1.9 -.1', [1.35, 0.75, 0.1], '#367d95'));
          for (let j = 0; j < Number(prop.value); j++)
            g.append(animal('Fish', `${-0.4 + j * 0.27} 1.9 .05`, 0.4));
        } else {
          const fish = animal('Fish', '0 1.8 0', 1.2);
          g.append(fish);
          if (prop.value === 'Spots')
            for (let j = 0; j < 3; j++)
              g.append(sphere(`${-0.1 + j * 0.1} 1.82 .16`, 0.035, '#234a68'));
          if (prop.value === 'Stripes')
            for (let j = 0; j < 3; j++)
              g.append(box(`${-0.1 + j * 0.1} 1.8 .16`, [0.025, 0.22, 0.02], '#234a68'));
        }
      }
      const chest = node('a-entity', { position: '0 0 6.75', rotation: '0 180 0' });
      root.append(chest);
      chest.append(
        box('0 1.65 0', [2.5, 1.2, 0.12], '#285b67'),
        sign(
          s.treasure
            ? 'REEF CHEST RECOVERED'
            : s.fragments === 6
              ? 'OPEN REEF CHEST'
              : `${s.fragments} / 6 FRAGMENTS`,
          '0 2.5 .1',
          2.6,
          0.4,
          '#f2d293',
          '#21475b',
          action('treasure', 'treasure'),
        ),
      );
      if (s.treasure) chest.append(shell('Fan shell', '0 1.7 .2', 2));
    },
  };
}
