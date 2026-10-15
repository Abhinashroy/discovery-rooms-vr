import {
  TUTOR_SCHEMA,
  TUTOR_INSTRUCTIONS,
  validateTutorRequest,
  validateTutorReply,
} from '../src/game/tutor-contract.js';

export async function callTutor(input, { key, model, fetchImpl = fetch }) {
  const request = validateTutorRequest(input);
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model,
      store: false,
      instructions: TUTOR_INSTRUCTIONS,
      input: [
        ...request.history,
        {
          role: 'user',
          content: JSON.stringify({
            question: request.message,
            currentExhibit: request.activeId,
            exhibitState: request.exhibitState,
            visitedExhibits: request.visited,
          }),
        },
      ],
      text: {
        format: { type: 'json_schema', name: 'room_tutor', strict: true, schema: TUTOR_SCHEMA },
      },
      max_output_tokens: 1200,
    }),
  });
  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? 'AI service is busy or its quota is unavailable. Try again later.'
        : `AI service rejected the request (${response.status}). Check the server API key and model access.`,
    );
    error.status = 502;
    throw error;
  }
  const result = await response.json();
  if (result.status !== 'completed')
    throw new Error('The AI response did not finish. Try a shorter question.');
  const output = result.output
    ?.flatMap((entry) => entry.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('');
  try {
    return validateTutorReply(JSON.parse(output));
  } catch {
    throw new Error(
      'The AI returned an unusable answer. No room action was applied. Please try again.',
    );
  }
}

export function tutorMiddleware({
  key = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL,
  fetchImpl = fetch,
} = {}) {
  let busy = false;
  let lastCall = 0;
  const ready = Boolean(key && model);
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (path === '/api/tutor/status' && req.method === 'GET')
      return json(res, 200, { ready, model: ready ? model : null });
    if (path !== '/api/tutor') return next();
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });
    const origin = req.headers.origin;
    if (
      req.headers['sec-fetch-site'] === 'cross-site' ||
      (origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(origin))
    )
      return json(res, 403, { error: 'Use the tutor from this app’s own page.' });
    if (!ready)
      return json(res, 503, {
        error:
          'Live AI is not connected. Set OPENAI_API_KEY and OPENAI_MODEL in the server .env file and restart. The exhibits and practice quiz still work.',
      });
    if (busy || Date.now() - lastCall < 1500)
      return json(res, 429, { error: 'Wait for the current answer before asking again.' });
    if (!req.headers['content-type']?.includes('application/json'))
      return json(res, 415, { error: 'Expected JSON.' });
    busy = true;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 24000) {
          json(res, 413, { error: 'Question history is too large.' });
          return;
        }
        chunks.push(chunk);
      }
      let data;
      try {
        data = validateTutorRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
      lastCall = Date.now();
      const answer = await callTutor(data, { key, model, fetchImpl });
      json(res, 200, { ...answer, source: 'live-ai', model });
    } catch (error) {
      json(res, error.status ?? 502, {
        error: error.name === 'TimeoutError' ? 'AI response timed out. Try again.' : error.message,
      });
    } finally {
      busy = false;
    }
  };
}
