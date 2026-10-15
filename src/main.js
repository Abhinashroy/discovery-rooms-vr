import './styles.css';
import { LOCI, nextRouteIndex } from './data/loci.js';
import { PROP_IDS, ANIMATION_IDS, COLOR_IDS, EMPTY_CUE } from './data/props.js';
import demoFacts from './data/demo-facts.json' with { type: 'json' };
import illustrativeCues from './data/illustrative-ai-cues.json' with { type: 'json' };
import {
  createDemoSession,
  replaceFacts,
  beginAuthoring,
  editCue,
  approveCue,
  allApproved,
  startStudy,
  visitStudyLocus,
  interruptStudy,
  completeStudy,
  recordPromptExport,
  replaceSuggestionManually,
} from './state.js';
import { buildAiPrompt } from './ai/build-prompt.js';
import { importAiResponse, buildRepairPrompt, MAX_AI_RESPONSE_BYTES } from './ai/import-cues.js';
import {
  beginDistractor,
  beginRecallOnly,
  beginRecall,
  editRecallAnswer,
  submitRecall,
  skipRecall,
  markResult,
  exitHiddenPhase,
  recordExternalObservation,
} from './recall/state.js';
import { scoreSummary, percentOfSix } from './recall/scoring.js';
import { serializeResultJson, serializeResultCsv } from './results/export.js';
import {
  loadSession,
  saveSession,
  serializeWorkingSession,
  serializePreparedSession,
  parseSessionJson,
  MAX_SESSION_BYTES,
} from './storage.js';
import { buildRoom, highlightLandmark } from './scene/room.js';
import { renderCueProp } from './scene/cues.js';
import { scenePresentation } from './scene/interaction.js';
import { createPreparedDemonstration } from './data/prepared-demo.js';
import { EMPTY_EVALUATION, saveEvaluation, markPreparationCap } from './evaluation.js';

const byId = (id) => document.getElementById(id);
const pilotLocked = (session) =>
  session.dataKind === 'pilot' &&
  allApproved(session) &&
  session.attempts.at(-1)?.invalidated !== true;
const loaded = loadSession();
const appState = {
  session: loaded.session ?? createDemoSession(),
  routeIndex: 0,
  dirty: !loaded.session || Boolean(loaded.recovered),
  factsDirty: false,
  noAnimation: false,
  previewVrPanel: false,
  externalFieldsKey: null,
  resultAttemptId: null,
};
const routeList = byId('route-list');
const previousButton = byId('previous-button');
const nextButton = byId('next-button');
const scene = buildRoom(
  byId('scene-mount'),
  (locusId) => {
    const index = LOCI.findIndex((locus) => locus.id === locusId);
    if (index >= 0) selectRouteIndex(index);
  },
  handleSceneAction,
);
scene.addEventListener('enter-vr', () => render());
scene.addEventListener('exit-vr', () => render());

function handleSceneAction(action) {
  if (action === 'previous' || action === 'next') {
    selectRouteIndex(nextRouteIndex(appState.routeIndex, action === 'next' ? 1 : -1));
    return;
  }
  if (action === 'exit') {
    if (scene.is?.('vr-mode')) scene.exitVR();
    else {
      appState.previewVrPanel = false;
      byId('preview-vr-panel').checked = false;
      render();
    }
    return;
  }
  if (action !== 'phase') return;
  const session = appState.session;
  const attempt = session.attempts.at(-1);
  if (session.stage === 'study' && attempt?.status === 'in_progress') {
    const result = completeStudy(session);
    if (result.errors.length) return message(result.errors.join(' '), 'error');
    appState.session = result.session;
    markDirty();
    render();
  } else if (session.stage === 'study' && attempt?.status === 'complete') {
    applyPhaseResult(beginDistractor(session), 'Distractor started. Study content is hidden.');
  } else if (session.stage === 'distractor') {
    applyPhaseResult(beginRecall(session), 'Blank-landmark recall started.');
  }
}

function message(text, kind = 'info') {
  const element = byId('app-message');
  element.textContent = text;
  element.dataset.kind = kind;
}

function markDirty() {
  appState.dirty = true;
  renderSaveState();
}

function renderSaveState() {
  const element = byId('save-state');
  element.textContent = appState.factsDirty
    ? 'Unsaved fact edits · save the six facts first'
    : appState.dirty
      ? 'Unsaved session · save locally or download a backup'
      : 'Saved locally in this browser';
  element.dataset.saved = String(!appState.dirty && !appState.factsDirty);
  byId('prepared-button').disabled = !allApproved(appState.session) || appState.factsDirty;
  const hiddenPhase = ['distractor', 'recall'].includes(appState.session.stage);
  byId('backup-button').hidden = hiddenPhase;
  byId('prepared-button').hidden = hiddenPhase;
}

function renderEvaluationFields() {
  const evaluation = appState.session.evaluation ?? EMPTY_EVALUATION;
  byId('evaluation-id').value = evaluation.participantId;
  byId('evaluation-familiarity').value = evaluation.familiarity;
  byId('evaluation-effort').value = evaluation.effortRating ?? '';
  byId('evaluation-meaningfulness').value = evaluation.meaningfulnessRating ?? '';
  byId('evaluation-assistance').value = evaluation.assistanceGiven;
  byId('evaluation-feedback').value = evaluation.feedback;
  byId('evaluation-cap-status').textContent = evaluation.preparationCappedAt
    ? `At the preparation cap: ${evaluation.approvedAtCap}/6 cues approved at ${evaluation.preparationCappedAt}. Keep this incomplete outcome in the working backup.`
    : 'No incomplete preparation cap recorded.';
}

function makeOption(select, value) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value[0].toUpperCase() + value.slice(1);
  select.append(option);
}

for (const value of PROP_IDS) makeOption(byId('cue-prop'), value);
for (const value of ANIMATION_IDS) makeOption(byId('cue-animation'), value);
for (const value of COLOR_IDS) makeOption(byId('cue-color'), value);

for (const [index, locus] of LOCI.entries()) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.index = String(index);
  li.append(button);
  routeList.append(li);
}

function renderFactFields() {
  const container = byId('facts-fields');
  container.replaceChildren();
  byId('data-kind').value = appState.session.dataKind;
  for (const [index, locus] of LOCI.entries()) {
    const fact = appState.session.facts[index];
    const card = document.createElement('div');
    card.className = 'fact-card';
    const heading = document.createElement('h3');
    heading.textContent = `${index + 1}. ${locus.name}`;
    const termLabel = document.createElement('label');
    termLabel.textContent = 'Term';
    const term = document.createElement('input');
    term.name = `term-${index}`;
    term.maxLength = 60;
    term.value = fact.term;
    termLabel.append(term);
    const meaningLabel = document.createElement('label');
    meaningLabel.textContent = 'Short meaning';
    const meaning = document.createElement('textarea');
    meaning.name = `meaning-${index}`;
    meaning.maxLength = 180;
    meaning.rows = 2;
    meaning.value = fact.meaning;
    meaningLabel.append(meaning);
    const aliasesLabel = document.createElement('label');
    aliasesLabel.textContent = 'Allowed term aliases (one per line, max 10)';
    const aliases = document.createElement('textarea');
    aliases.name = `aliases-${index}`;
    aliases.rows = 2;
    aliases.value = (fact.termAliases ?? []).join('\n');
    aliasesLabel.append(aliases);
    const rubricLabel = document.createElement('label');
    rubricLabel.textContent = 'Meaning scoring rubric (max 500 characters)';
    const rubric = document.createElement('textarea');
    rubric.name = `rubric-${index}`;
    rubric.maxLength = 500;
    rubric.rows = 3;
    rubric.value = fact.meaningRubric ?? '';
    rubricLabel.append(rubric);
    card.append(heading, termLabel, meaningLabel, aliasesLabel, rubricLabel);
    container.append(card);
  }
}

function currentCue() {
  return appState.session.cues[appState.routeIndex];
}

function renderAuthor({ fillFields = true } = {}) {
  const index = appState.routeIndex;
  const fact = appState.session.facts[index];
  const cue = currentCue();
  const final = cue.final ?? EMPTY_CUE;
  byId('author-fact-term').textContent = `${fact.term} · ${LOCI[index].name}`;
  byId('author-fact-meaning').textContent = fact.meaning;
  byId('approval-count').textContent =
    `${appState.session.cues.filter((entry) => entry.approved).length} of 6 approved`;
  byId('preparation-cap-button').disabled =
    allApproved(appState.session) || Boolean(appState.session.evaluation?.preparationCappedAt);
  byId('cue-approval').textContent = cue.approved
    ? 'Approved for rehearsal'
    : 'Needs review and approval';
  byId('cue-approval').dataset.approved = String(cue.approved);
  byId('ai-prompt').value = buildAiPrompt(appState.session);
  byId('load-illustrative').disabled = !appState.session.facts.every(
    (fact, position) =>
      fact.term === demoFacts.facts[position].term &&
      fact.meaning === demoFacts.facts[position].meaning,
  );
  byId('original-suggestion').hidden = !cue.suggestion;
  if (cue.suggestion) {
    byId('suggested-scene').textContent = cue.suggestion.scene;
    byId('suggested-link').textContent = cue.suggestion.meaningLink;
    byId('suggested-symbol').textContent =
      `Supporting symbol: ${cue.suggestion.colorId} ${cue.suggestion.propId}; animation: ${cue.suggestion.animationId}.`;
    const source =
      cue.provenance?.source === 'illustrative-example'
        ? 'Illustrative example, not fresh AI output'
        : 'Imported AI response';
    byId('suggestion-source').textContent =
      `${source} · model: ${cue.provenance?.modelName ?? 'unknown'} · generation date: ${cue.provenance?.generatedAt ?? 'unknown'} · review: ${cue.reviewOutcome ?? (cue.replacementMode ? 'manual replacement in progress' : 'pending')}`;
    byId('replace-suggestion').hidden = cue.replacementMode === true;
  }
  if (fillFields) {
    byId('cue-scene').value = final.scene;
    byId('cue-link').value = final.meaningLink;
    byId('cue-prop').value = final.propId;
    byId('cue-animation').value = final.animationId;
    byId('cue-color').value = final.colorId;
  }
  byId('preview-locus').textContent = LOCI[index].name;
  byId('preview-scene').textContent = final.scene || 'Write a scene to preview it.';
  byId('preview-link').textContent = final.meaningLink || 'Explain the meaning connection.';
  byId('preview-symbol').textContent =
    `Supporting 3D symbol: ${final.colorId} ${final.propId}; animation: ${final.animationId}. Richer actions in your sentence are imagined.`;
  byId('study-button').disabled = !allApproved(appState.session);
}

function renderStudy() {
  const attempt = appState.session.attempts.at(-1);
  const done = attempt?.status === 'complete';
  const inProgress = attempt?.status === 'in_progress';
  byId('study-content').hidden = !inProgress;
  byId('study-complete-message').hidden = !done;
  byId('finish-study-button').hidden = !inProgress;
  byId('start-distractor-button').hidden =
    !done || (attempt.recallStatus && attempt.recallStatus !== 'not_started');
  byId('repeat-study-button').hidden = true;
  byId('edit-cues-button').hidden = pilotLocked(appState.session);
  byId('study-progress').textContent = inProgress
    ? `${attempt.visitedLoci.length} of 6 landmarks visited · attempt ${appState.session.attempts.length}`
    : done
      ? `Attempt ${appState.session.attempts.length} complete`
      : 'No active rehearsal';
  byId('finish-study-button').disabled = !inProgress || attempt.visitedLoci.length !== LOCI.length;
  if (!inProgress) return;
  const fact = appState.session.facts[appState.routeIndex];
  const cue = currentCue().final;
  byId('study-term').textContent = fact.term;
  byId('study-meaning').textContent = fact.meaning;
  byId('study-scene').textContent = cue.scene;
  byId('study-link').textContent = cue.meaningLink;
  byId('study-symbol').textContent =
    `Supporting 3D symbol: ${cue.colorId} ${cue.propId}; animation: ${cue.animationId}.`;
}

function renderDistractor() {
  const attempt = appState.session.attempts.at(-1);
  const recallOnly = attempt?.source === 'recall-only';
  byId('distractor-instruction').textContent = recallOnly
    ? 'Recall-only handoff: approved content is hidden. When the participant is ready at the blank room, begin typed recall. The earlier rehearsal was not observed by this browser.'
    : 'Without looking back at the facts or cues, count backward by threes from 100 for about 60 seconds. When ready, begin blank-landmark recall.';
  const elapsed = attempt?.distractorStartedAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(attempt.distractorStartedAt)) / 1000))
    : null;
  byId('distractor-elapsed').textContent =
    elapsed === null
      ? 'No browser distractor duration is recorded for this recall-only handoff.'
      : `Distractor elapsed: ${elapsed} seconds (from the recorded start timestamp).`;
}

function renderRecall({ fillFields = true } = {}) {
  const attempt = appState.session.attempts.at(-1);
  const answer = attempt.answers[appState.routeIndex];
  byId('recall-locus').textContent =
    `${appState.routeIndex + 1}. ${LOCI[appState.routeIndex].name}`;
  const entered = attempt.answers.filter((item) => item.term.trim() || item.meaning.trim()).length;
  byId('recall-progress').textContent = `${entered} of 6 positions contain text`;
  if (fillFields) {
    byId('recall-term').value = answer.term;
    byId('recall-meaning').value = answer.meaning;
  }
}

function resultOption(value, label, selected = false, disabled = false) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  option.selected = selected;
  option.disabled = disabled;
  return option;
}

function renderResults() {
  const session = appState.session;
  const available = session.attempts.filter((entry) =>
    ['submitted', 'skipped'].includes(entry.recallStatus),
  );
  let attempt =
    available.find((entry) => entry.attemptId === appState.resultAttemptId) ?? available.at(-1);
  appState.resultAttemptId = attempt?.attemptId ?? null;
  const attemptSelect = byId('results-attempt-select');
  attemptSelect.replaceChildren(
    ...available.map((entry) =>
      resultOption(
        entry.attemptId,
        `${entry.attemptId} · ${entry.recallStatus} · ${entry.displayMode ?? 'unknown mode'}`,
        entry.attemptId === appState.resultAttemptId,
      ),
    ),
  );
  const summary = scoreSummary(session, attempt);
  const submitted = attempt?.recallStatus === 'submitted';
  const facts = attempt?.factsSnapshot ?? session.facts;
  byId('results-attempt').textContent = attempt ? `Attempt ID: ${attempt.attemptId}` : 'No attempt';
  byId('results-context').textContent = attempt
    ? `${attempt.dataKind ?? session.dataKind} · ${attempt.condition ?? session.condition} · ${attempt.displayMode ?? 'mode unavailable'} · ${attempt.recallMode ?? 'recall mode unavailable'} · ${attempt.source ?? 'browser'} ${attempt.source === 'external-observation' ? '· manually entered, not browser telemetry' : attempt.source === 'recall-only' ? '· earlier rehearsal mode selected manually; recall typed on laptop' : ''}`
    : 'No result is available.';
  byId('term-score').textContent =
    summary.termScore === null
      ? 'Term recall: unavailable /6'
      : `Term recall: ${summary.termScore}/6 (${percentOfSix(summary.termScore).toFixed(1)}%)`;
  byId('meaning-score').textContent =
    summary.meaningScore === null
      ? `Meaning recall: pending or unavailable /6${summary.meaningPending === null ? '' : ` · ${summary.meaningPending} awaiting human marks`}`
      : `Meaning recall: ${summary.meaningScore}/6 (${percentOfSix(summary.meaningScore).toFixed(1)}%)`;
  const timing = attempt?.preparationSnapshot ?? session.timing;
  const duration = (value) => (value === null || value === undefined ? 'unavailable' : `${value}s`);
  byId('results-timing').textContent =
    `Preparation ${duration(timing.preparationSeconds)} · AI generation and transfer ${duration(timing.generationAndTransferSeconds)} · setup gap ${duration(attempt?.setupGapSeconds)} · rehearsal ${duration(attempt?.rehearsalSeconds)} · distractor ${duration(attempt?.distractorSeconds)} · recall ${duration(attempt?.recallSeconds)}.`;
  byId('results-warning').textContent =
    attempt?.recallStatus === 'skipped'
      ? 'Recall test skipped: both scores are unavailable (null), not zero.'
      : attempt?.invalidated
        ? `Attempt invalidated: ${attempt.invalidationReason ?? 'protocol deviation'}. ${attempt.protocolDeviations?.join(' ') ?? ''}`
        : 'Score only the fact assigned to each landmark. A fact recalled at the wrong landmark earns no term or meaning point there. Term marks use trimmed, case-normalized terms and predeclared aliases; meaning marks require human review against each rubric. Self marks are self-assessed.';
  byId('results-scorer').parentElement.hidden = !submitted;
  const container = byId('results-facts');
  container.replaceChildren();
  if (!attempt) return;
  for (const [index, locus] of LOCI.entries()) {
    const fact = facts[index];
    const answer = attempt.answers?.[index] ?? null;
    const card = document.createElement('article');
    card.className = 'result-card';
    const title = document.createElement('h3');
    title.textContent = `${index + 1}. ${locus.name}`;
    const expected = document.createElement('p');
    expected.textContent = `Expected: ${fact.term} — ${fact.meaning}`;
    const raw = document.createElement('p');
    raw.textContent = answer
      ? `Raw answer: ${answer.term || '(blank)'} — ${answer.meaning || '(blank)'}`
      : 'No recall answer was collected.';
    const rubric = document.createElement('p');
    rubric.textContent = `Meaning rubric: ${fact.meaningRubric || 'No rubric supplied; use human judgment and record the scorer.'}`;
    card.append(title, expected, raw, rubric);
    if (submitted) {
      const termLabel = document.createElement('label');
      termLabel.textContent = `Term: automatic ${summary.termMarks[index].automatic}; override`;
      const termSelect = document.createElement('select');
      termSelect.dataset.index = String(index);
      termSelect.dataset.kind = 'term';
      const override = attempt.termOverrides?.[index] ?? null;
      termSelect.append(
        resultOption('', 'Use automatic mark', override === null),
        resultOption('0', 'Override: 0', override?.score === 0),
        resultOption('1', 'Override: 1', override?.score === 1, !answer.term.trim()),
      );
      termLabel.append(termSelect);
      const meaningLabel = document.createElement('label');
      meaningLabel.textContent = 'Meaning: human mark';
      const meaningSelect = document.createElement('select');
      meaningSelect.dataset.index = String(index);
      meaningSelect.dataset.kind = 'meaning';
      const mark = attempt.meaningMarks?.[index] ?? null;
      meaningSelect.append(
        resultOption('', 'Awaiting human mark', mark === null, !answer.meaning.trim()),
        resultOption('0', '0 — does not meet rubric', mark?.score === 0),
        resultOption('1', '1 — meets rubric', mark?.score === 1, !answer.meaning.trim()),
      );
      meaningLabel.append(meaningSelect);
      const scorer = document.createElement('p');
      scorer.className = 'symbol-note';
      scorer.textContent = `Term scorer: ${override?.scorer ?? 'automatic rule'} · meaning scorer: ${mark?.scorer === 'self' ? 'self-assessed' : (mark?.scorer ?? 'awaiting human review')}.`;
      card.append(termLabel, meaningLabel, scorer);
    }
    container.append(card);
  }
}

function renderExternalFields() {
  const key = `${appState.session.sessionId}:${appState.session.contentRevision}`;
  if (appState.externalFieldsKey === key) return;
  appState.externalFieldsKey = key;
  const container = byId('external-answers');
  container.replaceChildren();
  for (const [index, locus] of LOCI.entries()) {
    const fact = appState.session.facts[index];
    const card = document.createElement('div');
    card.className = 'result-card';
    const heading = document.createElement('h3');
    heading.textContent = `${index + 1}. ${locus.name}`;
    const expected = document.createElement('p');
    expected.textContent = `Reference: ${fact.term} — ${fact.meaning} Rubric: ${fact.meaningRubric || 'Use human judgment.'}`;
    const termLabel = document.createElement('label');
    termLabel.textContent = 'Raw term answer';
    const term = document.createElement('input');
    term.id = `external-term-${index}`;
    term.maxLength = 500;
    termLabel.append(term);
    const meaningLabel = document.createElement('label');
    meaningLabel.textContent = 'Raw meaning answer';
    const meaning = document.createElement('textarea');
    meaning.id = `external-meaning-${index}`;
    meaning.maxLength = 500;
    meaning.rows = 2;
    meaningLabel.append(meaning);
    const markLabel = document.createElement('label');
    markLabel.textContent = 'Meaning mark';
    const mark = document.createElement('select');
    mark.id = `external-mark-${index}`;
    mark.append(
      resultOption('', 'Pending human mark'),
      resultOption('0', '0'),
      resultOption('1', '1'),
    );
    markLabel.append(mark);
    card.append(heading, expected, termLabel, meaningLabel, markLabel);
    container.append(card);
  }
}

function renderRoomCue() {
  const stage = appState.session.stage;
  const attempt = appState.session.attempts.at(-1);
  const cue = currentCue();
  const final =
    stage === 'author'
      ? cue.final
      : stage === 'study' && attempt?.status === 'in_progress' && cue.approved
        ? cue.final
        : null;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  renderCueProp(scene, LOCI[appState.routeIndex].id, final, {
    animate: !appState.noAnimation && !reducedMotion,
  });
}

function render() {
  const stage = appState.session.stage;
  const hiddenPhase = ['distractor', 'recall'].includes(stage);
  for (const view of ['facts', 'route', 'author', 'study', 'distractor', 'recall', 'results']) {
    byId(`${view}-view`).hidden =
      stage !==
      {
        facts: 'setup',
        route: 'familiarize',
        author: 'author',
        study: 'study',
        distractor: 'distractor',
        recall: 'recall',
        results: 'results',
      }[view];
  }
  document.querySelector('.stage-nav').hidden = hiddenPhase;
  byId('session-transfer').hidden = hiddenPhase;
  byId('evaluation-panel').hidden = hiddenPhase;
  byId('external-panel').hidden =
    hiddenPhase || appState.session.preparedImport !== true || !allApproved(appState.session);
  if (!byId('external-panel').hidden) renderExternalFields();
  const recallOnlyAvailable =
    stage === 'familiarize' &&
    appState.session.preparedImport === true &&
    allApproved(appState.session);
  byId('recall-only-button').hidden = !recallOnlyAvailable;
  byId('recall-only-mode-label').hidden = !recallOnlyAvailable;
  byId('recall-only-note').hidden = !recallOnlyAvailable;
  const frozenPilot = pilotLocked(appState.session);
  byId('author-button').hidden = frozenPilot;
  byId('edit-facts-button').hidden = frozenPilot;
  byId('pilot-ready-controls').hidden = !(stage === 'familiarize' && frozenPilot);
  for (const button of document.querySelectorAll('.stage-nav button')) {
    const active = button.dataset.stage === stage;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.disabled = false;
    if (button.dataset.stage === 'study') button.disabled = !allApproved(appState.session);
    if (button.dataset.stage === 'results')
      button.disabled = !appState.session.attempts.some((entry) =>
        ['submitted', 'skipped'].includes(entry.recallStatus),
      );
    if (frozenPilot && ['setup', 'author'].includes(button.dataset.stage)) button.disabled = true;
    if (frozenPilot && button.dataset.stage === 'study' && stage === 'familiarize')
      button.disabled = true;
  }
  const locus = LOCI[appState.routeIndex];
  byId('active-position').textContent = `Stop ${appState.routeIndex + 1} of 6`;
  byId('active-name').textContent = locus.name;
  byId('active-description').textContent = locus.description;
  for (const button of routeList.querySelectorAll('button')) {
    const index = Number(button.dataset.index);
    button.textContent = `${index + 1}. ${LOCI[index].name}${!hiddenPhase && appState.session.cues[index].approved ? ' ✓' : ''}`;
    const active = index === appState.routeIndex;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  previousButton.disabled = appState.routeIndex === 0;
  nextButton.disabled = appState.routeIndex === LOCI.length - 1;
  highlightLandmark(scene, locus.id);
  if (stage === 'author') renderAuthor();
  if (stage === 'study') renderStudy();
  if (stage === 'distractor') renderDistractor();
  if (stage === 'recall') renderRecall();
  if (stage === 'results') renderResults();
  renderRoomCue();
  scene.sceneControls(
    scenePresentation(appState.session, appState.routeIndex),
    appState.previewVrPanel || Boolean(scene.is?.('vr-mode')),
  );
  renderSaveState();
}

function selectRouteIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LOCI.length) return;
  appState.routeIndex = index;
  const next = visitStudyLocus(appState.session, LOCI[index].id);
  if (next !== appState.session) {
    appState.session = next;
    markDirty();
  }
  render();
}

function goStage(stage) {
  if (['distractor', 'recall'].includes(appState.session.stage)) {
    message(
      'Finish recall or use Exit and invalidate attempt before opening study content.',
      'error',
    );
    return;
  }
  if (pilotLocked(appState.session) && ['setup', 'author'].includes(stage)) {
    message(
      'Approved pilot content stays hidden until timed rehearsal. An invalidated attempt unlocks editing.',
      'error',
    );
    return;
  }
  if (appState.factsDirty && stage !== 'setup') {
    message('Save the six fact edits or discard them before changing stages.', 'error');
    return;
  }
  if (
    stage === 'study' &&
    appState.session.stage === 'study' &&
    ['in_progress', 'complete'].includes(appState.session.attempts.at(-1)?.status)
  ) {
    render();
    return;
  }
  if (
    stage === 'results' &&
    !appState.session.attempts.some((entry) =>
      ['submitted', 'skipped'].includes(entry.recallStatus),
    )
  ) {
    message('No submitted or skipped recall result is available.', 'error');
    return;
  }
  const base = stage === 'study' ? appState.session : interruptStudy(appState.session);
  if (stage === 'author') {
    appState.session = beginAuthoring(base);
    markDirty();
  } else if (stage === 'study') {
    const result = startStudy(base, new Date().toISOString(), byId('study-display-mode').value);
    if (result.errors.length) return message(result.errors.join(' '), 'error');
    appState.session = result.session;
    appState.routeIndex = 0;
    markDirty();
  } else {
    appState.session = { ...base, stage };
    markDirty();
    if (stage === 'setup') renderFactFields();
  }
  render();
  message(
    stage === 'author' ? 'Write each cue, check its meaning link, then approve it.' : '',
    'info',
  );
}

document.querySelector('.stage-nav').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-stage]');
  if (button && !button.disabled) goStage(button.dataset.stage);
});
routeList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-index]');
  if (button) selectRouteIndex(Number(button.dataset.index));
});
previousButton.addEventListener('click', () =>
  selectRouteIndex(nextRouteIndex(appState.routeIndex, -1)),
);
nextButton.addEventListener('click', () =>
  selectRouteIndex(nextRouteIndex(appState.routeIndex, 1)),
);
document.addEventListener('keydown', (event) => {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
  )
    return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    selectRouteIndex(nextRouteIndex(appState.routeIndex, event.key === 'ArrowLeft' ? -1 : 1));
  }
});

byId('facts-form').addEventListener('input', (event) => {
  appState.factsDirty = true;
  const match = event.target.name?.match(/^(term|meaning)-(\d)$/);
  if (match) {
    const index = Number(match[2]);
    const prior = appState.session.facts[index];
    const card = event.target.closest('.fact-card');
    if (event.target.value.trim() !== prior[match[1]] && card.dataset.scoringCleared !== 'true') {
      byId('facts-form').elements[`aliases-${index}`].value = '';
      byId('facts-form').elements[`rubric-${index}`].value = '';
      card.dataset.scoringCleared = 'true';
      message(
        `Fact ${index + 1} changed. Check its aliases and enter a rubric for human meaning scoring.`,
        'info',
      );
    }
  }
  renderSaveState();
});
byId('data-kind').addEventListener('change', () => {
  appState.factsDirty = true;
  renderSaveState();
});
byId('facts-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const facts = LOCI.map((_, index) => ({
    term: byId('facts-form').elements[`term-${index}`].value,
    meaning: byId('facts-form').elements[`meaning-${index}`].value,
    termAliases: byId('facts-form')
      .elements[`aliases-${index}`].value.split(/\r?\n/)
      .map((alias) => alias.trim())
      .filter(Boolean),
    meaningRubric: byId('facts-form').elements[`rubric-${index}`].value,
  }));
  if (byId('data-kind').value === 'pilot' && facts.some((fact) => !fact.meaningRubric.trim())) {
    return message('Pilot sessions require a meaning scoring rubric for every fact.', 'error');
  }
  const result = replaceFacts(appState.session, facts);
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  const changed = result.session !== appState.session;
  const requestedKind = byId('data-kind').value;
  const matchesDemo = result.session.facts.every(
    (fact, index) =>
      fact.term === demoFacts.facts[index].term && fact.meaning === demoFacts.facts[index].meaning,
  );
  const dataKind = requestedKind === 'fixture' && !matchesDemo ? 'practice' : requestedKind;
  appState.session = { ...result.session, dataKind };
  appState.factsDirty = false;
  appState.routeIndex = 0;
  appState.session = { ...appState.session, stage: 'familiarize' };
  markDirty();
  render();
  message(
    changed
      ? 'Facts saved in this session. Earlier cues and approvals were cleared because the facts changed.'
      : 'Facts confirmed. Learn the route, then create cues.',
    'success',
  );
});
byId('evaluation-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = (id) => byId(id).value.trim();
  const result = saveEvaluation(appState.session, {
    participantId: value('evaluation-id'),
    familiarity: value('evaluation-familiarity'),
    effortRating: value('evaluation-effort') ? Number(value('evaluation-effort')) : null,
    meaningfulnessRating: value('evaluation-meaningfulness')
      ? Number(value('evaluation-meaningfulness'))
      : null,
    assistanceGiven: value('evaluation-assistance'),
    feedback: value('evaluation-feedback'),
  });
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  appState.session = result.session;
  for (const attempt of appState.session.attempts) {
    if (attempt.sourcePreparationId === appState.session.sourcePreparationId)
      attempt.evaluationSnapshot = structuredClone(appState.session.evaluation);
  }
  markDirty();
  renderEvaluationFields();
  message(
    'Anonymous pilot record fields saved. Export the working backup or result after scoring.',
    'success',
  );
});
byId('preparation-cap-button').addEventListener('click', () => {
  const result = markPreparationCap(appState.session);
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  appState.session = result.session;
  markDirty();
  renderEvaluationFields();
  renderAuthor();
  message(
    'Incomplete preparation and approved count recorded. Save or export the working backup; ask for effort/feedback too.',
    'info',
  );
});
byId('discard-facts-button').addEventListener('click', () => {
  appState.factsDirty = false;
  renderFactFields();
  renderSaveState();
  message('Unsaved fact edits discarded.', 'info');
});

const cueForm = byId('cue-form');
cueForm.addEventListener('input', updateCueFromForm);
cueForm.addEventListener('change', updateCueFromForm);
function updateCueFromForm() {
  const patch = {
    scene: byId('cue-scene').value,
    meaningLink: byId('cue-link').value,
    propId: byId('cue-prop').value,
    animationId: byId('cue-animation').value,
    colorId: byId('cue-color').value,
  };
  const next = editCue(appState.session, appState.routeIndex, patch);
  if (next !== appState.session) {
    appState.session = next;
    markDirty();
    renderAuthor({ fillFields: false });
    renderRoomCue();
    for (const button of routeList.querySelectorAll('button')) {
      const index = Number(button.dataset.index);
      button.textContent = `${index + 1}. ${LOCI[index].name}${appState.session.cues[index].approved ? ' ✓' : ''}`;
    }
    message('Cue changed. Review and approve the current version.', 'info');
  }
}
cueForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = approveCue(appState.session, appState.routeIndex);
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  appState.session = result.session;
  if (allApproved(appState.session) && appState.session.dataKind === 'pilot')
    appState.session.stage = 'familiarize';
  markDirty();
  render();
  message(
    allApproved(appState.session)
      ? appState.session.dataKind === 'pilot'
        ? 'All six cues approved. Pilot content is hidden until timed rehearsal starts.'
        : 'All six cues approved. Start rehearsal when ready.'
      : 'Cue approved. Continue to the next landmark.',
    'success',
  );
});

byId('author-button').addEventListener('click', () => goStage('author'));
byId('edit-facts-button').addEventListener('click', () => goStage('setup'));
byId('back-route-button').addEventListener('click', () => goStage('familiarize'));
byId('pilot-start-study').addEventListener('click', () => {
  byId('study-display-mode').value = byId('pilot-display-mode').value;
  goStage('study');
});
byId('study-button').addEventListener('click', () => goStage('study'));
byId('edit-cues-button').addEventListener('click', () => goStage('author'));
byId('finish-study-button').addEventListener('click', () => {
  const result = completeStudy(appState.session);
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  appState.session = result.session;
  markDirty();
  render();
  message(
    'Rehearsal completed. Study content is hidden; start the distractor before recall.',
    'success',
  );
});
byId('repeat-study-button').addEventListener('click', () => {
  const result = startStudy(appState.session);
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  appState.session = result.session;
  appState.routeIndex = 0;
  markDirty();
  render();
  message('New practice attempt started.', 'info');
});
byId('no-animation').addEventListener('change', (event) => {
  appState.noAnimation = event.target.checked;
  renderRoomCue();
});
byId('preview-vr-panel').addEventListener('change', (event) => {
  appState.previewVrPanel = event.target.checked;
  render();
});

function applyPhaseResult(result, successMessage) {
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  appState.session = result.session;
  if (appState.session.stage === 'results')
    appState.resultAttemptId = appState.session.attempts.at(-1)?.attemptId ?? null;
  appState.routeIndex = 0;
  markDirty();
  render();
  message(successMessage, 'success');
}

byId('start-distractor-button').addEventListener('click', () =>
  applyPhaseResult(
    beginDistractor(appState.session),
    'Distractor started. Study content is hidden.',
  ),
);
byId('recall-only-button').addEventListener('click', () =>
  applyPhaseResult(
    beginRecallOnly(appState.session, byId('recall-only-display-mode').value),
    'Hidden recall-only handoff is ready. No study content is visible.',
  ),
);
byId('begin-recall-button').addEventListener('click', () =>
  applyPhaseResult(
    beginRecall(appState.session),
    'Blank-landmark recall started. Enter all six responses before revealing feedback.',
  ),
);
byId('skip-recall-button').addEventListener('click', () =>
  applyPhaseResult(
    skipRecall(appState.session),
    'Recall skipped. Scores are unavailable, not zero.',
  ),
);
for (const id of ['exit-distractor-button', 'exit-recall-button'])
  byId(id).addEventListener('click', () => {
    appState.session = exitHiddenPhase(
      appState.session,
      'Hidden-content phase exited before recall submission.',
    );
    markDirty();
    render();
    message(
      'Attempt invalidated and preserved with a protocol deviation. Study content may now be opened.',
      'error',
    );
  });

function updateRecallFromForm() {
  const result = editRecallAnswer(appState.session, appState.routeIndex, {
    term: byId('recall-term').value,
    meaning: byId('recall-meaning').value,
  });
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  if (result.session !== appState.session) {
    appState.session = result.session;
    markDirty();
    renderRecall({ fillFields: false });
  }
}
byId('recall-term').addEventListener('input', updateRecallFromForm);
byId('recall-meaning').addEventListener('input', updateRecallFromForm);
byId('submit-recall-button').addEventListener('click', () =>
  applyPhaseResult(
    submitRecall(appState.session),
    'All six raw answer pairs were saved before feedback was shown. Review meaning marks against the rubrics.',
  ),
);

byId('results-facts').addEventListener('change', (event) => {
  const select = event.target.closest('select[data-kind][data-index]');
  if (!select) return;
  const score = select.value === '' ? null : Number(select.value);
  const result = markResult(
    appState.session,
    Number(select.dataset.index),
    select.dataset.kind,
    score,
    byId('results-scorer').value,
    appState.resultAttemptId,
  );
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  appState.session = result.session;
  markDirty();
  renderResults();
  message('Human mark saved in this session. Save locally or export the result.', 'success');
});
byId('results-attempt-select').addEventListener('change', (event) => {
  appState.resultAttemptId = event.target.value;
  renderResults();
});
byId('export-result-json').addEventListener('click', () => {
  try {
    downloadText(
      'ai-mol-vr-result.json',
      serializeResultJson(appState.session, appState.resultAttemptId),
    );
    message('Result JSON downloaded for the current attempt.', 'success');
  } catch (error) {
    message(error.message, 'error');
  }
});
byId('export-result-csv').addEventListener('click', () => {
  try {
    downloadText(
      'ai-mol-vr-result.csv',
      serializeResultCsv(appState.session, appState.resultAttemptId),
      'text/csv',
    );
    message('Result CSV downloaded with six locus rows.', 'success');
  } catch (error) {
    message(error.message, 'error');
  }
});
byId('new-attempt-button').addEventListener('click', () =>
  applyPhaseResult(
    startStudy(appState.session, new Date().toISOString(), byId('study-display-mode').value),
    'A distinct practice attempt started.',
  ),
);

function durationInput(id) {
  const value = byId(id).value.trim();
  return value === '' ? null : Number(value);
}
byId('external-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = {
    attemptId: byId('external-attempt-id').value,
    displayMode: byId('external-display-mode').value,
    scorer: byId('external-scorer').value,
    answers: LOCI.map((_, index) => ({
      term: byId(`external-term-${index}`).value,
      meaning: byId(`external-meaning-${index}`).value,
    })),
    meaningScores: LOCI.map((_, index) =>
      byId(`external-mark-${index}`).value === ''
        ? null
        : Number(byId(`external-mark-${index}`).value),
    ),
    setupGapSeconds: durationInput('external-setup'),
    rehearsalSeconds: durationInput('external-rehearsal'),
    distractorSeconds: durationInput('external-distractor'),
    recallSeconds: durationInput('external-recall'),
    deviation: byId('external-deviation').value,
  };
  const result = recordExternalObservation(appState.session, form);
  if (result.errors.length) return message(result.errors.join(' '), 'error');
  appState.session = result.session;
  appState.resultAttemptId = appState.session.attempts.at(-1).attemptId;
  byId('results-scorer').value = form.scorer;
  byId('external-form').reset();
  appState.externalFieldsKey = null;
  markDirty();
  render();
  message(
    'External observation recorded under its anonymous attempt ID. Durations and marks are labelled manually entered.',
    'success',
  );
});

function clearAiErrors() {
  byId('ai-errors').replaceChildren();
  byId('ai-errors').hidden = true;
  byId('ai-repair').hidden = true;
  byId('ai-repair-prompt').value = '';
}

function showAiErrors(errors) {
  const list = byId('ai-errors');
  list.replaceChildren();
  for (const error of errors) {
    const item = document.createElement('li');
    item.textContent = error;
    list.append(item);
  }
  list.hidden = false;
  byId('ai-repair-prompt').value = buildRepairPrompt(errors, appState.session);
  byId('ai-repair').hidden = false;
  message(
    `AI response rejected: ${errors.length} validation error${errors.length === 1 ? '' : 's'}. The current session was kept.`,
    'error',
  );
}

function notePromptExport() {
  appState.session = recordPromptExport(appState.session);
  markDirty();
}

async function copyFromTextarea(id, successMessage) {
  const field = byId(id);
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(field.value);
    message(successMessage, 'success');
  } catch {
    field.focus();
    field.select();
    message(
      'Clipboard access failed. The text is selected: copy it manually, or download the prompt.',
      'info',
    );
  }
}

byId('copy-ai-prompt').addEventListener('click', async () => {
  notePromptExport();
  await copyFromTextarea(
    'ai-prompt',
    'AI prompt copied. Paste it into an external GPT chat and return with its JSON response.',
  );
});
byId('download-ai-prompt').addEventListener('click', () => {
  notePromptExport();
  downloadText('ai-mol-vr-prompt.txt', byId('ai-prompt').value, 'text/plain');
  message(
    'Prompt downloaded. Use it in an external GPT chat, then import the full JSON response.',
    'success',
  );
});
byId('copy-ai-repair').addEventListener('click', () =>
  copyFromTextarea('ai-repair-prompt', 'Repair prompt copied.'),
);

function importAiText(text, source = 'external-gpt-import') {
  const metadata = {
    source,
    modelName: source === 'illustrative-example' ? 'unknown' : byId('ai-model-name').value,
    generatedAt: source === 'illustrative-example' ? 'unknown' : byId('ai-generation-date').value,
  };
  const result = importAiResponse(appState.session, text, metadata);
  if (result.errors.length) return showAiErrors(result.errors);
  appState.session = result.session;
  appState.routeIndex = 0;
  byId('ai-response').value = '';
  clearAiErrors();
  markDirty();
  render();
  message(
    source === 'illustrative-example'
      ? 'Illustrative example loaded for the bundled facts. Review and approve each cue; this is not a fresh AI generation.'
      : 'Six AI suggestions imported. Review their meaning links against the original facts, edit or replace as needed, and approve each cue.',
    'success',
  );
}

byId('import-ai-response').addEventListener('click', () => importAiText(byId('ai-response').value));
byId('ai-response-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_AI_RESPONSE_BYTES) showAiErrors(['AI response exceeds 100 KB.']);
  else {
    try {
      importAiText(await file.text());
    } catch (error) {
      showAiErrors([`AI response file could not be read: ${error.message}`]);
    }
  }
  event.target.value = '';
});
byId('load-illustrative').addEventListener('click', () => {
  if (byId('load-illustrative').disabled) return;
  importAiText(
    JSON.stringify({
      schemaVersion: appState.session.schemaVersion,
      sessionId: appState.session.sessionId,
      contentRevision: appState.session.contentRevision,
      cues: illustrativeCues.cues,
    }),
    'illustrative-example',
  );
});
byId('replace-suggestion').addEventListener('click', () => {
  appState.session = replaceSuggestionManually(appState.session, appState.routeIndex);
  markDirty();
  render();
  message('The original suggestion remains recorded. Write your own cue and approve it.', 'info');
});

byId('save-button').addEventListener('click', () => {
  if (appState.factsDirty) return message('Save or discard fact edits first.', 'error');
  const result = saveSession(appState.session);
  if (!result.ok) return message(result.error, 'error');
  appState.dirty = false;
  renderSaveState();
  message('Session saved in this browser. Download a backup for another device.', 'success');
});

function downloadText(filename, text, mimeType = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

byId('backup-button').addEventListener('click', () => {
  if (appState.factsDirty) return message('Save or discard fact edits first.', 'error');
  try {
    downloadText('ai-mol-vr-working-session.json', serializeWorkingSession(appState.session));
    message('Working backup downloaded. Keep it in a safe local place.', 'success');
  } catch (error) {
    message(error.message, 'error');
  }
});
byId('prepared-button').addEventListener('click', () => {
  if (appState.factsDirty) return message('Save or discard fact edits first.', 'error');
  try {
    downloadText('ai-mol-vr-prepared-session.json', serializePreparedSession(appState.session));
    message('Prepared session downloaded with approved cues and no attempt results.', 'success');
  } catch (error) {
    message(error.message, 'error');
  }
});

function importText(text) {
  try {
    const result = parseSessionJson(text);
    appState.session = result.session;
    appState.resultAttemptId = null;
    appState.routeIndex = 0;
    appState.factsDirty = false;
    appState.externalFieldsKey = null;
    markDirty();
    renderFactFields();
    renderEvaluationFields();
    render();
    byId('import-text').value = '';
    message(
      result.prepared
        ? 'Prepared session imported. Approved cues can be rehearsed, used for hidden recall-only handoff, or linked to a manually entered external observation.'
        : 'Working backup restored. Save locally if desired.',
      'success',
    );
  } catch (error) {
    message(`Import failed: ${error.message} The current session was kept.`, 'error');
  }
}
byId('import-paste-button').addEventListener('click', () => importText(byId('import-text').value));
byId('import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > MAX_SESSION_BYTES) {
    message('Import failed: file exceeds 256 KB. The current session was kept.', 'error');
    event.target.value = '';
    return;
  }
  try {
    importText(await file.text());
  } catch (error) {
    message(`Import failed: ${error.message} The current session was kept.`, 'error');
  }
  event.target.value = '';
});
byId('load-prepared-demo').addEventListener('click', () => {
  try {
    appState.session = createPreparedDemonstration();
    appState.routeIndex = 0;
    appState.resultAttemptId = null;
    appState.externalFieldsKey = null;
    appState.factsDirty = false;
    markDirty();
    renderFactFields();
    renderEvaluationFields();
    render();
    message(
      'Prepared illustrative demonstration loaded. Its cues are preapproved fixture content, not a fresh AI generation or participant work.',
      'info',
    );
  } catch (error) {
    message(`Demo load failed: ${error.message}`, 'error');
  }
});

async function showVrCapability() {
  const status = byId('vr-status');
  if (!window.isSecureContext) {
    status.textContent =
      'Desktop practice works here. Immersive VR requires HTTPS or localhost plus a compatible headset/browser.';
    return;
  }
  if (!navigator.xr?.isSessionSupported) {
    status.textContent =
      'Desktop practice works here. This browser does not expose immersive WebXR.';
    return;
  }
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    status.textContent = supported
      ? 'Immersive VR appears available. Use controller rays and the scene controls; actual headset validation remains pending.'
      : 'Desktop practice works here. No compatible immersive VR device is available in this browser.';
  } catch {
    status.textContent =
      'Desktop practice works here. Immersive VR support could not be checked in this browser.';
  }
}

renderFactFields();
renderEvaluationFields();
render();
message(
  loaded.error ??
    (loaded.recovered
      ? 'An unfinished rehearsal or recall was marked interrupted after reload. Save this recovered session when ready.'
      : loaded.session
        ? 'Saved session restored from this browser.'
        : 'Demonstration facts loaded. You can edit them or learn the route.'),
  loaded.error ? 'error' : 'info',
);
showVrCapability();
