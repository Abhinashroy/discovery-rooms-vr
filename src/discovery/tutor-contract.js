import { tablesFor, detailsFor, titleFor } from './content.js';
export const TUTOR_INTENTS = ['explain', 'hint'];
const PHASES = ['available', 'active', 'completed', 'revealed'];
export function validateDiscoveryRequest(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4 ||
    Object.keys(value).some((k) => !['adventure', 'tableId', 'intent', 'phase'].includes(k))
  )
    throw new Error('Choose a listed guide request.');
  if (
    !['space', 'ocean', 'workshop'].includes(value.adventure) ||
    !tablesFor(value).some((t) => t.id === value.tableId) ||
    !TUTOR_INTENTS.includes(value.intent) ||
    !PHASES.includes(value.phase)
  )
    throw new Error('Unknown guide choice.');
  return {
    adventure: value.adventure,
    tableId: value.tableId,
    intent: value.intent,
    phase: value.phase,
  };
}
export function guideContent(adventure, tableId) {
  const context = { adventure };
  const table = tablesFor(context).find((t) => t.id === tableId);
  if (!table) throw new Error('Unknown table.');
  const detail = detailsFor(context)[tableId] || {
    instruction: 'Select a supply, then its matching compartment.',
    reference: 'Water matches Circle; Food matches Triangle; Tools matches Square.',
    explanation: 'Matching labels helps explorers organize their supplies.',
    clue: 'Find the cargo table at the back left.',
  };
  return { adventure: titleFor(context), table: table.title, ...detail };
}
export function authoredGuidance(request) {
  const r = validateDiscoveryRequest(request),
    c = guideContent(r.adventure, r.tableId);
  return r.intent === 'explain' ? c.explanation : `${c.instruction} ${c.reference}`;
}
export const DISCOVERY_INSTRUCTIONS = `You are a concise learning-room guide for ages 10–15. Use only the supplied authored lesson, simplified-model limits and the selected request. For explain, explain the displayed idea in at most three short sentences. For hint, offer one helpful next step from the reference. Do not claim to see objects, know the player's answers or know any hidden symbols. Do not create quizzes, change rules, award rewards, assess ability, invent facts, give real-world tool/wiring instructions or ask for personal information. Use supportive plain language. No chat, links, code, markdown or off-topic content. Your response is optional guidance; the game's authored rules remain authoritative.`;
export const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { message: { type: 'string' } },
  required: ['message'],
};
export function validateDiscoveryReply(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    typeof value.message !== 'string' ||
    !value.message.trim() ||
    value.message.length > 900 ||
    /[<>]|https?:\/\/|www\./i.test(value.message)
  )
    throw new Error('Unusable guide answer.');
  return { message: value.message.trim() };
}
