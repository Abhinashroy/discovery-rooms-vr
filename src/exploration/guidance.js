import { THEMES, MAIN, PREREQUISITES } from './catalog.js';
import { available, currentObjective } from './state.js';

export function roleLabel(state, id) {
  if (id.startsWith('prop')) return 'MEMORY OBJECT · optional';
  if (state.tasks[id].done) return 'DONE';
  if (!available(state, id)) return 'LATER';
  if (id === 'arrival') return 'START HERE';
  return id.startsWith('side') ? 'SIDE QUEST · optional' : 'MAIN MISSION';
}

export function purpose(state, id) {
  const theme = THEMES[state.theme];
  if (id.startsWith('prop'))
    return 'Look closely and remember its detail. It can appear in the optional memory quiz. It is not needed to unlock treasure.';
  if (id === 'arrival')
    return 'Your first practice task. Learn how to select and use a control. Finishing opens the two main investigations.';
  if (id === 'branchA' || id === 'branchB')
    return `This experiment gives you one of the two clues needed at ${theme.tasks.synthesis.title}. You can do the two investigations in either order.`;
  if (id === 'synthesis')
    return `Use what you learned at ${theme.tasks.branchA.title} and ${theme.tasks.branchB.title}. Completing this prepares ${theme.tasks.finale.title}.`;
  if (id === 'finale')
    return 'This is your final mission task. Use your completed work to bring the room to life and earn the treasure.';
  return 'An extra experiment for curious explorers. You can skip it and still finish the main mission.';
}

export function nextActions(state) {
  if (state.treasure) return [];
  return MAIN.filter((id) => !state.tasks[id].done && available(state, id));
}

export function nextInstruction(state) {
  if (state.treasure)
    return 'Mission complete! Try optional side quests, inspect memory objects, or choose a quiz from your menu.';
  const id = currentObjective(state),
    task = THEMES[state.theme].tasks[id];
  return `${task.steps[state.tasks[id].step].prompt} Open this task below to begin. Select a choice, then press Use selected item / control.`;
}

export function unlockInstruction(state, id) {
  return (
    'Do this first: ' +
    PREREQUISITES[id]
      .filter((k) => !state.tasks[k].done)
      .map((k) => THEMES[state.theme].tasks[k].title)
      .join(' + ') +
    '.'
  );
}
