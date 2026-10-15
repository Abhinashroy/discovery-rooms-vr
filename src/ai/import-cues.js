import { LOCI } from '../data/loci.js';
import { SCHEMA_VERSION } from '../data/schema.js';
import { validateCue } from '../validation.js';
import { applyAiSuggestions } from '../state.js';

export const MAX_AI_RESPONSE_BYTES = 100 * 1024;
const OUTER_KEYS = ['schemaVersion', 'sessionId', 'contentRevision', 'cues'];
const CUE_KEYS = ['itemId', 'locusId', 'scene', 'meaningLink', 'propId', 'animationId', 'colorId'];

function exactKeys(value, expected, label, errors) {
  const actual = Object.keys(value);
  for (const key of expected) if (!actual.includes(key)) errors.push(`${label}.${key} is missing.`);
  for (const key of actual)
    if (!expected.includes(key)) errors.push(`${label}.${key} is not allowed.`);
}

function stripOneFence(text) {
  const match = text.match(/^\s*```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```\s*$/i);
  return match ? match[1] : text;
}

export function parseAiResponse(text, session) {
  const errors = [];
  if (typeof text !== 'string') return { cues: null, errors: ['AI response must be JSON text.'] };
  if (new TextEncoder().encode(text).byteLength > MAX_AI_RESPONSE_BYTES) {
    return { cues: null, errors: ['AI response exceeds 100 KB.'] };
  }
  let response;
  try {
    response = JSON.parse(stripOneFence(text));
  } catch {
    return {
      cues: null,
      errors: [
        'AI response is malformed JSON. Paste one JSON object, optionally inside one JSON fence.',
      ],
    };
  }
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { cues: null, errors: ['AI response must be one JSON object.'] };
  }
  exactKeys(response, OUTER_KEYS, 'response', errors);
  if (response.schemaVersion !== SCHEMA_VERSION)
    errors.push(`response.schemaVersion must be ${SCHEMA_VERSION}.`);
  if (response.sessionId !== session.sessionId)
    errors.push(`response.sessionId does not match this session (${session.sessionId}).`);
  if (response.contentRevision !== session.contentRevision)
    errors.push(
      `response.contentRevision is stale or invalid; expected ${session.contentRevision}.`,
    );
  if (!Array.isArray(response.cues))
    errors.push('response.cues must be an array of exactly six objects.');
  else {
    if (response.cues.length !== LOCI.length)
      errors.push(
        `response.cues must contain exactly six objects; received ${response.cues.length}.`,
      );
    const seen = new Set();
    response.cues.forEach((cue, index) => {
      const label = `cues[${index}]`;
      if (!cue || typeof cue !== 'object' || Array.isArray(cue)) {
        errors.push(`${label} must be an object.`);
        return;
      }
      exactKeys(cue, CUE_KEYS, label, errors);
      const expectedIndex = LOCI.findIndex((_, position) => `f${position + 1}` === cue.itemId);
      if (expectedIndex < 0) errors.push(`${label}.itemId is unknown.`);
      else {
        if (seen.has(cue.itemId)) errors.push(`${label}.itemId duplicates ${cue.itemId}.`);
        seen.add(cue.itemId);
        if (cue.locusId !== LOCI[expectedIndex].id)
          errors.push(`${label}.locusId for ${cue.itemId} must be ${LOCI[expectedIndex].id}.`);
      }
      errors.push(...validateCue(cue).map((error) => `${label}.${error}`));
    });
    for (let index = 0; index < LOCI.length; index++) {
      const itemId = `f${index + 1}`;
      if (!seen.has(itemId)) errors.push(`response.cues is missing ${itemId}.`);
    }
  }
  if (errors.length) return { cues: null, errors };
  return {
    cues: LOCI.map((_, index) => response.cues.find((cue) => cue.itemId === `f${index + 1}`)),
    errors: [],
  };
}

export function buildRepairPrompt(errors, session) {
  const expected = {
    schemaVersion: SCHEMA_VERSION,
    sessionId: session.sessionId,
    contentRevision: session.contentRevision,
    cues: LOCI.map((locus, index) => ({
      itemId: `f${index + 1}`,
      locusId: locus.id,
      scene: '<nonempty text, at most 180 characters>',
      meaningLink: '<nonempty text, at most 180 characters>',
      propId: '<book|box|ball|key|lock|clock|battery|gear>',
      animationId: '<none|bounce|spin|pulse>',
      colorId: '<red|blue|green|yellow|purple|orange>',
    })),
  };
  return `Repair your previous JSON response for the same six facts. Return one complete JSON object only. Preserve the original facts and the item/locus mapping.\n\nValidation errors:\n${errors.map((error) => `- ${error}`).join('\n')}\n\nExpected schema and current IDs (replace angle-bracket placeholders with valid values):\n${JSON.stringify(expected, null, 2)}`;
}

export function importAiResponse(session, text, metadata, now = new Date().toISOString()) {
  const parsed = parseAiResponse(text, session);
  if (parsed.errors.length) return { session, errors: parsed.errors };
  return applyAiSuggestions(session, parsed.cues, metadata, now);
}
