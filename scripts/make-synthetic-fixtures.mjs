import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreparedDemonstration } from '../src/data/prepared-demo.js';
import {
  createDemoSession,
  beginAuthoring,
  editCue,
  approveCue,
  startStudy,
  visitStudyLocus,
  completeStudy,
} from '../src/state.js';
import {
  beginDistractor,
  beginRecall,
  editRecallAnswer,
  submitRecall,
  markResult,
} from '../src/recall/state.js';
import { serializeResultJson } from '../src/results/export.js';
import { serializeWorkingSession } from '../src/storage.js';
import { markPreparationCap } from '../src/evaluation.js';
import { LOCI } from '../src/data/loci.js';

const folder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'synthetic',
);
await mkdir(folder, { recursive: true });

let complete = createPreparedDemonstration();
complete.sessionId = 'synthetic-complete';
complete.sourcePreparationId = 'synthetic-prep-complete';
complete.dataKind = 'pilot';
complete.evaluation.participantId = 'SYNTH-A';
complete.evaluation.familiarity = 'Synthetic: zero facts familiar';
complete.evaluation.effortRating = 3;
complete.evaluation.meaningfulnessRating = 5;
complete.evaluation.assistanceGiven = 'Synthetic fixture; no person was assisted';
complete.timing = {
  preparationStartedAt: '2026-09-29T10:00:00.000Z',
  preparationCompletedAt: '2026-09-29T10:04:00.000Z',
  preparationSeconds: 240,
  promptExportedAt: '2026-09-29T10:01:00.000Z',
  generationAndTransferSeconds: 45,
};
complete.attempts[0].attemptId = 'SYNTH-A-run1';
complete.attempts[0].sourcePreparationId = complete.sourcePreparationId;
complete = startStudy(complete, '2026-09-29T10:05:00.000Z', 'desktop').session;
for (const locus of LOCI) complete = visitStudyLocus(complete, locus.id);
complete = completeStudy(complete, '2026-09-29T10:07:00.000Z').session;
complete = beginDistractor(complete, '2026-09-29T10:07:00.000Z').session;
complete = beginRecall(complete, '2026-09-29T10:08:00.000Z').session;
for (let index = 0; index < 6; index++)
  complete = editRecallAnswer(complete, index, {
    term: index < 4 ? complete.facts[index].term : '',
    meaning: index < 3 ? complete.facts[index].meaning : '',
  }).session;
complete = submitRecall(complete, '2026-09-29T10:10:00.000Z').session;
for (let index = 0; index < 3; index++)
  complete = markResult(complete, index, 'meaning', 1, 'facilitator').session;
await writeFile(path.join(folder, 'synthetic-complete-result.json'), serializeResultJson(complete));

let incomplete = createDemoSession('synthetic-incomplete');
incomplete.sourcePreparationId = 'synthetic-prep-incomplete';
incomplete.dataKind = 'pilot';
incomplete.evaluation.participantId = 'SYNTH-B';
incomplete.evaluation.effortRating = 6;
incomplete.evaluation.meaningfulnessRating = null;
incomplete.evaluation.feedback = 'Synthetic fixture: preparation stopped at cap';
incomplete = beginAuthoring(incomplete, '2026-09-29T11:00:00.000Z');
for (let index = 0; index < 2; index++) {
  incomplete = editCue(incomplete, index, {
    scene: `Synthetic cue ${index + 1}`,
    meaningLink: `Synthetic meaning link ${index + 1}`,
  });
  incomplete = approveCue(incomplete, index, '2026-09-29T11:02:00.000Z').session;
}
incomplete = markPreparationCap(incomplete, '2026-09-29T11:06:00.000Z').session;
await writeFile(
  path.join(folder, 'synthetic-incomplete-working.json'),
  serializeWorkingSession(incomplete),
);
