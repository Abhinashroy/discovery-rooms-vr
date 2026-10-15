import { SCHEMA_VERSION } from './data/schema.js';
import { allApproved, newReadyAttempt } from './state.js';
import { validateSession } from './validation.js';

export const STORAGE_KEY = 'ai-mol-vr.active.v1';
export const MAX_SESSION_BYTES = 256 * 1024;
const WORKING_FORMAT = 'ai-mol-vr-working-session';
const PREPARED_FORMAT = 'ai-mol-vr-prepared-session';

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function makeBundle(session, format) {
  const prepared = format === PREPARED_FORMAT;
  const copy = structuredClone(session);
  if (prepared) {
    copy.stage = 'familiarize';
    copy.attempts = [];
  }
  const errors = validateSession(copy, { prepared });
  if (prepared && !allApproved(copy))
    errors.push('All six cues must be approved before prepared export.');
  if (errors.length) throw new Error(errors.join(' '));
  return {
    format,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    session: copy,
  };
}

export function serializeWorkingSession(session) {
  const text = JSON.stringify(makeBundle(session, WORKING_FORMAT), null, 2);
  if (byteLength(text) > MAX_SESSION_BYTES)
    throw new Error('Session exceeds the 256 KB size limit.');
  return text;
}

export function serializePreparedSession(session) {
  const text = JSON.stringify(makeBundle(session, PREPARED_FORMAT), null, 2);
  if (byteLength(text) > MAX_SESSION_BYTES)
    throw new Error('Prepared session exceeds the 256 KB size limit.');
  return text;
}

export function parseSessionJson(text) {
  if (typeof text !== 'string' || byteLength(text) > MAX_SESSION_BYTES)
    throw new Error('Session JSON must be 256 KB or smaller.');
  let bundle;
  try {
    bundle = JSON.parse(text);
  } catch {
    throw new Error('Session JSON is malformed.');
  }
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle))
    throw new Error('Expected a session JSON object.');
  if (![WORKING_FORMAT, PREPARED_FORMAT].includes(bundle.format))
    throw new Error('Unsupported session format. Use a working backup or prepared-session export.');
  if (bundle.schemaVersion !== SCHEMA_VERSION)
    throw new Error('Unsupported session schema version.');
  const prepared = bundle.format === PREPARED_FORMAT;
  const errors = validateSession(bundle.session, { prepared });
  if (
    bundle.session &&
    !['setup', 'familiarize', 'author', 'study', 'distractor', 'recall', 'results'].includes(
      bundle.session.stage,
    )
  )
    errors.push('This module cannot display the imported stage.');
  if (errors.length) throw new Error(errors.join(' '));
  const session = structuredClone(bundle.session);
  let recovered = false;
  if (prepared) {
    session.stage = 'familiarize';
    session.preparedImport = true;
    session.attempts = [newReadyAttempt(session)];
  } else if (['distractor', 'recall'].includes(session.stage)) {
    const attempt = session.attempts.at(-1);
    if (attempt && attempt.recallStatus !== 'submitted' && attempt.recallStatus !== 'skipped') {
      attempt.recallStatus = 'interrupted';
      attempt.invalidated = true;
      attempt.invalidationReason = 'Reloaded during distractor or recall.';
      attempt.protocolDeviations = [
        ...(attempt.protocolDeviations ?? []),
        'Reloaded during distractor or recall.',
      ];
      session.stage = 'familiarize';
      recovered = true;
    }
  } else if (session.stage === 'study' && session.attempts.at(-1)?.status === 'in_progress') {
    session.attempts.at(-1).status = 'interrupted';
    session.stage = 'author';
    recovered = true;
  }
  return { session, prepared, recovered };
}

export function saveSession(session, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, serializeWorkingSession(session));
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: `Local save failed: ${error.message}. Download a working backup to keep this session.`,
    };
  }
}

export function loadSession(storage) {
  try {
    const text = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    if (!text) return { session: null, error: null };
    const result = parseSessionJson(text);
    if (result.prepared)
      return {
        session: null,
        error: 'Saved data has the wrong format. A new unsaved session was opened.',
      };
    return { session: result.session, error: null, recovered: result.recovered };
  } catch (error) {
    return {
      session: null,
      error: `Saved data could not be loaded: ${error.message}. A new unsaved session was opened.`,
    };
  }
}
