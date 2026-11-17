import demoCues from './demo-cues.json' with { type: 'json' };
import { createDemoSession, editCue, approveCue } from '../state.js';
import { serializePreparedSession, parseSessionJson } from '../storage.js';

export function approveDemoCues(session, now) {
  for (const { itemId, locusId, ...cue } of demoCues.cues) {
    const index = session.cues.findIndex(
      (entry) => entry.itemId === itemId && entry.locusId === locusId,
    );
    session = editCue(session, index, cue, now);
    const approved = approveCue(session, index, now);
    if (approved.errors.length) throw new Error(approved.errors.join(' '));
    session = approved.session;
  }
  return session;
}

export function createPreparedDemonstration() {
  const session = approveDemoCues(createDemoSession());
  session.timing = {
    preparationStartedAt: null,
    preparationCompletedAt: null,
    preparationSeconds: null,
    promptExportedAt: null,
    generationAndTransferSeconds: null,
  };
  return parseSessionJson(serializePreparedSession(session)).session;
}
