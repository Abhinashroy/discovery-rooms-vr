import { BY_ID, LEARNING_FACTS } from './content.js';

// Desktop has an HTML detail card; VR needs an explicit native panel.
export function planetPanelAfter(action, state, immersive) {
  if (['planet', 'unassign'].includes(action) && state.phase === 'naming' && state.focus)
    return 'cards';
  if (
    immersive &&
    ['planet', 'inspect', 'close-inspect'].includes(action) &&
    state.phase === 'explore' &&
    BY_ID[state.focus]
  )
    return 'detail';
  return null;
}

export function planetInformation(state) {
  const planet = state.phase === 'explore' && BY_ID[state.focus];
  if (!planet) return null;
  return {
    title: planet.order + ' · ' + planet.name,
    facts: LEARNING_FACTS[planet.id],
    inspection: state.inspection === planet.id,
  };
}
