import {
  WORKSHOP_TABLES,
  workshopView,
  workshopUnlocked,
  TOOLS,
  PARTS,
  SYMBOLS,
} from './workshop.js';
import { PROPS, DISCOVERY } from './adventure.js';
import { approachPoint } from './navigation.js';
export function createWorkshopScene(root, { node, box, sphere, sign, action }) {
  const dark = '#173849',
    paper = '#eef5f5',
    metal = '#8ca6ae',
    gold = '#e8b66d';
  function gear(position, r = 0.25) {
    const g = node('a-entity', { position });
    g.append(
      node('a-cylinder', { radius: r, height: 0.07, rotation: '90 0 0', color: gold }),
      sphere('0 0 .06', 0.045, dark),
    );
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      g.append(
        box(`${Math.cos(a) * r} ${Math.sin(a) * r} 0`, [0.1, 0.1, 0.08], gold, {
          rotation: `0 0 ${i * 30}`,
        }),
      );
    }
    return g;
  }
  function robot(position, awake) {
    const g = node('a-entity', { position });
    g.append(
      box('0 0 0', [0.45, 0.45, 0.3], metal),
      box('0 .38 0', [0.4, 0.28, 0.3], gold),
      sphere('-.1 .4 .16', 0.035, dark),
      sphere('.1 .4 .16', 0.035, dark),
    );
    for (const x of [-1, 1]) {
      g.append(
        box(`${x * 0.3} ${awake && x === 1 ? 0.25 : 0} 0`, [0.12, 0.35, 0.12], metal, {
          rotation: `0 0 ${awake && x === 1 ? -55 : 0}`,
        }),
        box(`${x * 0.12} -.35 0`, [0.12, 0.28, 0.18], dark),
      );
    }
    return g;
  }
  return {
    render(s, settings = {}) {
      root.replaceChildren();
      root.append(sign('INVENTOR’S WORKSHOP', '0 4.13 -6.78', 4.5, 0.55, dark, paper));
      for (const x of [-4.6, 0, 4.6]) {
        root.append(box(`${x} 2.9 -6.84`, [2.6, 1.7, 0.05], dark));
        for (let j = 0; j < 3; j++) root.append(gear(`${x - 0.6 + j * 0.6} 2.9 -6.73`, 0.26));
      }
      for (const table of WORKSHOP_TABLES) {
        const t = s.tasks[table.id],
          id = table.id,
          view = workshopView(s, id),
          g = node('a-entity', { position: `${table.x} 0 ${table.z}`, 'data-workshop-table': id });
        root.append(g);
        const tint = t.collected ? '#92c2ad' : workshopUnlocked(s, id) ? '#cfb386' : '#a6b3bd';
        g.append(
          box('0 .52 0', [1.85, 1.04, 0.85], metal),
          box('0 1.06 0', [2.4, 0.14, 1.35], tint),
          sign(
            `${table.icon} / ${table.title}`,
            '0 2.85 -.5',
            2.5,
            0.35,
            dark,
            paper,
            action(`open:${id}`, id),
          ),
          sign(view.text, '0 2.43 -.35', 2.5, 0.48, paper, dark, action(`open:${id}`, id)),
        );
        if (id === 'cargo')
          TOOLS.forEach((v, i) => {
            const x = -0.75 + i * 0.75,
              y = t.steps.includes(v) ? 1.8 : 1.5;
            g.append(box(`${x} ${y} 0`, [0.07, 0.38, 0.07], '#885c35'));
            if (i === 0) g.append(box(`${x} ${y + 0.2} 0`, [0.32, 0.14, 0.14], metal));
            if (i === 1) g.append(box(`${x} ${y + 0.24} 0`, [0.04, 0.2, 0.04], metal));
            if (i === 2) {
              g.append(
                node('a-torus', {
                  position: `${x} ${y + 0.2} 0`,
                  radius: 0.1,
                  'radius-tubular': 0.035,
                  color: metal,
                  arc: 260,
                }),
              );
            }
            g.append(sign(v, `${x} 1.18 .2`, 0.7, 0.16, paper, dark));
          });
        if (id === 'solar') {
          const tilt = t.count === 3 ? 0 : t.count < 3 ? 12 : -12;
          g.append(box('0 1.4 0', [0.12, 0.55, 0.2], dark));
          const beam = node('a-entity', { position: '0 1.72 0', rotation: `0 0 ${tilt}` });
          beam.append(box('0 0 0', [1.7, 0.07, 0.12], gold));
          for (const [x, count] of [
            [-0.65, 3],
            [0.65, t.count],
          ]) {
            beam.append(box(`${x} -.18 0`, [0.5, 0.06, 0.4], metal));
            for (let j = 0; j < count; j++)
              beam.append(
                box(
                  `${x + (j % 2) * 0.17 - 0.08} ${-0.06 + Math.floor(j / 2) * 0.14} 0`,
                  [0.13, 0.13, 0.13],
                  gold,
                ),
              );
          }
          g.append(beam, sign(`3 LEFT / ${t.count} RIGHT`, '0 1.18 .3', 1.5, 0.18, paper, dark));
        }
        if (id === 'globe') {
          g.append(box('0 1.6 -.1', [1.8, 0.7, 0.07], dark));
          g.append(box('0 1.3 0', [1.65, 0.03, 0.03], gold));
          for (const x of [-0.8, 0.8]) g.append(box(`${x} 1.48 0`, [0.03, 0.36, 0.03], gold));
          for (const x of [-0.8, -0.28, 0.28, 0.8])
            g.append(box(`${x} 1.65 0`, [0.23, 0.03, 0.03], gold));
          PARTS.forEach((v, i) => {
            const x = -0.55 + i * 0.55;
            if (t.steps.includes(v)) {
              if (i === 2)
                g.append(
                  sphere(
                    `${x} 1.65 .1`,
                    0.14,
                    t.closed && PARTS.every((part) => t.steps.includes(part))
                      ? '#fff19a'
                      : '#70818d',
                  ),
                );
              else
                g.append(
                  box(`${x} 1.65 .1`, [0.26, 0.18, 0.15], i === 0 ? '#d98965' : metal, {
                    rotation: `0 0 ${i === 1 && !t.closed ? 35 : 0}`,
                  }),
                );
            }
            g.append(sign(v, `${x} 1.18 .2`, 0.53, 0.15, paper, dark));
          });
        }
        if (id === 'moon') {
          for (let i = 0; i < 3; i++) {
            const z = gear(`${-0.6 + i * 0.6} 1.7 0`, 0.26);
            if (t.ran) {
              z.setAttribute('rotation', `0 0 ${i % 2 ? 25 : -25}`);
              if (!settings.reducedMotion)
                z.setAttribute(
                  'animation',
                  `property: rotation; from: 0 0 0; to: 0 0 ${i % 2 ? 360 : -360}; dur: 6000; loop: true; easing: linear; pauseEvents: pause-orbit; resumeEvents: resume-orbit`,
                );
            }
            g.append(
              z,
              sign(
                t.ran ? (i % 2 ? 'COUNTER' : 'CLOCKWISE') : '?',
                `${-0.6 + i * 0.6} 1.25 .2`,
                0.58,
                0.18,
                paper,
                dark,
              ),
            );
          }
          g.append(sign('FIRST → CLOCKWISE', '0 2.06 .1', 1.7, 0.2, paper, dark));
        }
        if (id === 'mission') {
          for (let i = 0; i < 2; i++) {
            const x = i === 0 ? -0.6 : 0.6,
              angle = i === 0 ? 32 : 16;
            g.append(box(`${x} 1.48 0`, [0.43, 0.07, 1.2], metal, { rotation: `${angle} 0 0` }));
            const theta = (angle * Math.PI) / 180,
              progress = i === 0 ? 1 : Math.sin(theta) / Math.sin((32 * Math.PI) / 180),
              distance = t.ran ? -0.6 + 1.2 * progress : -0.6,
              start = `${x} ${1.48 + 0.6 * Math.sin(theta) + 0.105} ${-0.6 * Math.cos(theta)}`,
              end = `${x} ${1.48 - distance * Math.sin(theta) + 0.105} ${distance * Math.cos(theta)}`;
            const ball = sphere(end, 0.105, gold);
            if (t.ran && !settings.reducedMotion)
              ball.setAttribute(
                'animation',
                `property: position; from: ${start}; to: ${end}; dur: 1800; easing: easeInQuad; pauseEvents: pause-orbit; resumeEvents: resume-orbit`,
              );
            g.append(
              ball,
              sign(i === 0 ? 'HIGHER' : 'LOWER', `${x} 1.12 .7`, 0.8, 0.16, paper, dark),
            );
          }
          if (t.ran)
            g.append(
              sign('HIGHER: FINISH / LOWER: STILL ROLLING', '0 2.04 0', 2.1, 0.22, paper, dark),
            );
        }
        if (id === 'beacon') {
          g.append(robot('0 1.7 -.15', ['completed', 'revealed'].includes(t.phase)));
          SYMBOLS.forEach((v, i) =>
            g.append(
              sign(
                t.steps.includes(v) ? v : '□',
                `${-0.8 + (i % 3) * 0.8} ${1.32 - Math.floor(i / 3) * 0.18} .4`,
                0.7,
                0.15,
                t.steps.includes(v) ? gold : paper,
                dark,
              ),
            ),
          );
        }
        if (t.phase === 'revealed')
          g.append(sign(`DISCOVERY: ${t.symbol}`, '0 2.09 .2', 1.9, 0.23, gold, dark));
        view.actions.forEach((a, i) =>
          g.append(
            sign(
              a.label,
              `${i % 2 ? 0.59 : -0.59} ${0.94 - Math.floor(i / 2) * 0.19} .8`,
              1.12,
              0.17,
              paper,
              dark,
              action(`task:${id}:${a.verb}:${a.value || ''}`, id),
            ),
          ),
        );
        const p = approachPoint(table);
        root.append(
          node('a-circle', {
            position: `${p.x} .02 ${p.z}`,
            rotation: '-90 0 0',
            radius: 0.33,
            color: tint,
            ...action(`teleport:${id}`),
          }),
        );
      }
      const drawer = node('a-entity', { position: `${DISCOVERY.x} 0 ${DISCOVERY.z}` });
      root.append(drawer);
      drawer.append(
        box('0 .55 0', [1.25, 1.1, 0.65], metal),
        sign('PARTS DRAWER', '0 1.8 .1', 1.4, 0.3, dark, paper),
        sign(
          'OPEN & INSPECT',
          '0 .5 .35',
          1.2,
          0.26,
          paper,
          dark,
          action('inspect-drawer', 'drawer'),
        ),
      );
      if (s.drawerOpen) {
        drawer.append(
          node('a-torus', {
            position: '0 1.3 .1',
            radius: 0.17,
            'radius-tubular': 0.07,
            color: gold,
          }),
          sign(s.discovery, '0 .9 .35', 1.2, 0.23, paper, dark),
        );
        for (let j = 0; j < 3; j++)
          drawer.append(
            s.discovery.startsWith('Dotted')
              ? sphere(`${-0.13 + j * 0.13} 1.3 .21`, 0.025, dark)
              : box(`${-0.13 + j * 0.13} 1.3 .21`, [0.02, 0.22, 0.02], dark, {
                  rotation: `0 0 ${s.discovery.startsWith('Zigzag') ? (j % 2 ? 30 : -30) : 0}`,
                }),
          );
      }
      for (const [i, p] of PROPS.entries()) {
        const prop = s.props[p.id],
          g = node('a-entity', { position: `${p.x} 0 ${p.z}` });
        root.append(g);
        g.append(
          sign(i ? 'MAGNIFYING VIEWER' : 'WIND-UP TOY', '0 2.5 0', 1.4, 0.3, dark, paper),
          sign(
            prop.opened ? prop.value : 'INSPECT',
            '0 1.15 .2',
            1.3,
            0.25,
            paper,
            dark,
            action(`inspect-prop:${p.id}`, p.id),
          ),
        );
        if (!i) {
          g.append(box(`${prop.opened ? 0.1 : 0} 1.8 0`, [0.85, 0.3, 0.3], gold));
          for (let j = 0; j < Number(prop.value); j++)
            g.append(gear(`${-0.35 + j * 0.22} 1.57 .19`, 0.095));
        } else {
          g.append(
            node('a-torus', {
              position: '0 1.85 0',
              radius: 0.36,
              'radius-tubular': 0.04,
              color: metal,
            }),
            node('a-circle', {
              position: '0 1.85 .02',
              radius: 0.22,
              segments: prop.value === 'Triangle' ? 3 : prop.value === 'Square' ? 4 : 6,
              color: gold,
            }),
          );
        }
      }
      const chest = node('a-entity', { position: '0 0 6.75', rotation: '0 180 0' });
      root.append(chest);
      chest.append(
        box('0 1.65 0', [2.5, 1.2, 0.12], dark),
        sign(
          s.treasure ? 'GEAR KEEPSAKE' : `${s.fragments} / 6 · MACHINE TREASURE`,
          '0 2.5 .1',
          2.6,
          0.4,
          paper,
          dark,
          action('treasure', 'treasure'),
        ),
      );
      if (s.treasure) chest.append(gear('0 1.65 .2', 0.4));
    },
  };
}
