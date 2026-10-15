import { LOCI } from '../data/loci.js';

const SHOW_STAGES = new Set([
  'setup',
  'familiarize',
  'author',
  'study',
  'distractor',
  'recall',
  'results',
]);
const CANVAS_SIZE = { width: 1024, height: 768 };

function element(tag, attributes = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function canvasAsset(scene, id) {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.width = CANVAS_SIZE.width;
  canvas.height = CANVAS_SIZE.height;
  scene.querySelector('a-assets').append(canvas);
  return canvas;
}

function card(canvas, lines, { button = false } = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.fillStyle = button ? '#17465a' : '#142e3c';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#f8bf59';
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.fillStyle = '#ffffff';
  if (button) {
    ctx.font = 'bold 110px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lines[0], width / 2, height / 2, width - 80);
    return;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = 33;
  for (const [index, section] of lines.entries()) {
    ctx.font = index === 0 ? 'bold 52px system-ui, sans-serif' : '38px system-ui, sans-serif';
    const words = String(section).split(/\s+/);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width - 82 && line) {
        ctx.fillText(line, 42, y);
        y += index === 0 ? 65 : 49;
        line = word;
      } else line = next;
    }
    if (line) {
      ctx.fillText(line, 42, y);
      y += index === 0 ? 65 : 49;
    }
    y += index === 0 ? 13 : 8;
  }
}

function refreshTexture(node, canvas) {
  node.setAttribute('material', 'src', canvas.toDataURL('image/png'));
}

export function scenePresentation(session, routeIndex) {
  const stage = session.stage;
  const locus = LOCI[routeIndex];
  const attempt = session.attempts.at(-1);
  let lines = [`${routeIndex + 1} / 6  ${locus.name}`];
  let phase = null;
  if (stage === 'study' && attempt?.status === 'in_progress') {
    const fact = session.facts[routeIndex];
    const cue = session.cues[routeIndex].final;
    lines.push(
      `Term: ${fact.term}`,
      `Meaning: ${fact.meaning}`,
      `Imagine: ${cue.scene}`,
      `Link: ${cue.meaningLink}`,
    );
    phase = attempt.visitedLoci.length === LOCI.length ? 'Finish' : null;
  } else if (stage === 'study' && attempt?.status === 'complete') {
    lines.push('Rehearsal complete. Study content hidden. Start the neutral distractor.');
    phase = 'Distractor';
  } else if (stage === 'distractor') {
    lines.push('Hidden-content interval. Count backward by threes from 100 for about 60 seconds.');
    phase = 'Recall';
  } else if (stage === 'recall') {
    lines.push(
      'Blank landmark. Recall the term and meaning. Exit VR to type all six answers before submission.',
    );
  } else {
    lines.push(
      locus.description,
      stage === 'familiarize'
        ? 'Select a landmark or use Previous and Next.'
        : 'Exit VR to use the 2D authoring or results form.',
    );
  }
  return {
    visible: SHOW_STAGES.has(stage),
    lines,
    phase,
    previousDisabled: routeIndex === 0,
    nextDisabled: routeIndex === LOCI.length - 1,
  };
}

export function mountSceneControls(scene) {
  const camera = scene.querySelector('#route-camera');
  const assets = element('a-assets');
  scene.insertBefore(assets, scene.firstChild);
  const canvas = canvasAsset(scene, 'xr-info-canvas');
  const panel = element('a-plane', {
    'data-xr-panel': '',
    position: '0 0.64 -2.15',
    width: '2.65',
    height: '1.74',
    material: 'shader: flat; src: #xr-info-canvas; side: double',
  });
  const controls = element('a-entity', { 'data-xr-controls': '' });
  const buttons = {};
  for (const [index, action] of ['previous', 'next', 'phase', 'exit'].entries()) {
    const id = `xr-${action}-canvas`;
    const buttonCanvas = canvasAsset(scene, id);
    const button = element('a-plane', {
      'data-xr-action': action,
      class: 'xr-control-hit',
      position: `${(index - 1.5) * 0.68} -0.61 -1.8`,
      width: '0.61',
      height: '0.34',
      material: `shader: flat; src: #${id}; side: double`,
    });
    buttons[action] = { canvas: buttonCanvas, node: button };
    controls.append(button);
  }
  camera.append(panel, controls);
  for (const hand of ['left', 'right'])
    scene.append(
      element('a-entity', {
        'data-xr-controller': hand,
        'laser-controls': `hand: ${hand}`,
        raycaster: 'objects: .landmark-hit, .xr-control-hit; far: 12',
      }),
    );
  const redraw = (presentation, show) => {
    panel.setAttribute('visible', show && presentation.visible);
    controls.setAttribute('visible', show && presentation.visible);
    if (!show || !presentation.visible) return;
    card(canvas, presentation.lines);
    refreshTexture(panel, canvas);
    const labels = {
      previous: 'Previous',
      next: 'Next',
      phase: presentation.phase,
      exit: 'Exit VR',
    };
    for (const [action, item] of Object.entries(buttons)) {
      item.node.setAttribute('visible', Boolean(labels[action]));
      item.node.classList.toggle(
        'xr-control-hit',
        Boolean(labels[action]) &&
          !(action === 'previous' && presentation.previousDisabled) &&
          !(action === 'next' && presentation.nextDisabled),
      );
      if (labels[action]) {
        card(item.canvas, [labels[action]], { button: true });
        refreshTexture(item.node, item.canvas);
      }
    }
  };
  redraw({ visible: false }, false);
  return redraw;
}
