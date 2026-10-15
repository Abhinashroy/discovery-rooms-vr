import illustrativeCues from './illustrative-ai-cues.json' with { type: 'json' };
import { createDemoSession, approveCue } from '../state.js';
import { importAiResponse } from '../ai/import-cues.js';
import { serializePreparedSession, parseSessionJson } from '../storage.js';

export function createPreparedDemonstration() {
  let session = createDemoSession();
  const batch = importAiResponse(
    session,
    JSON.stringify({
      schemaVersion: session.schemaVersion,
      sessionId: session.sessionId,
      contentRevision: session.contentRevision,
      cues: illustrativeCues.cues,
    }),
    { source: 'illustrative-example', modelName: 'unknown', generatedAt: 'unknown' },
  );
  if (batch.errors.length) throw new Error(batch.errors.join(' '));
  session = batch.session;
  for (let index = 0; index < 6; index++) {
    const approved = approveCue(session, index);
    if (approved.errors.length) throw new Error(approved.errors.join(' '));
    session = approved.session;
  }
  session.timing = {
    preparationStartedAt: null,
    preparationCompletedAt: null,
    preparationSeconds: null,
    promptExportedAt: null,
    generationAndTransferSeconds: null,
  };
  return parseSessionJson(serializePreparedSession(session)).session;
}
