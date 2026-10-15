import {
  validateDiscoveryRequest,
  validateDiscoveryReply,
  guideContent,
  DISCOVERY_INSTRUCTIONS,
  DISCOVERY_SCHEMA,
} from '../src/discovery/tutor-contract.js';
export async function callDiscoveryTutor(input, { key, model, fetchImpl = fetch }) {
  const request = validateDiscoveryRequest(input);
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      model,
      store: false,
      instructions: DISCOVERY_INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: JSON.stringify({
            request,
            lesson: guideContent(request.adventure, request.tableId),
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'discovery_guide',
          strict: true,
          schema: DISCOVERY_SCHEMA,
        },
      },
      max_output_tokens: 1200,
    }),
  });
  if (!response.ok) throw new Error('AI unavailable.');
  const result = await response.json();
  if (result.status !== 'completed') throw new Error('Incomplete AI answer.');
  const parts = result.output?.flatMap((v) => v.content || []) || [];
  if (parts.some((p) => p.type === 'refusal')) throw new Error('AI declined.');
  return validateDiscoveryReply(
    JSON.parse(
      parts
        .filter((p) => p.type === 'output_text')
        .map((p) => p.text)
        .join(''),
    ),
  );
}
export function discoveryTutorMiddleware({
  key = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL,
  enabled = process.env.DISCOVERY_AI_ENABLED === 'true',
  fetchImpl = fetch,
} = {}) {
  const ready = Boolean(enabled && key && model);
  let busy = false,
    lastCall = 0;
  const json = (res, code, value) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (path === '/api/discovery-tutor/status' && req.method === 'GET')
      return json(res, 200, { ready });
    if (path !== '/api/discovery-tutor') return next();
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });
    const origin = req.headers.origin;
    if (
      req.headers['sec-fetch-site'] === 'cross-site' ||
      (origin && ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(origin))
    )
      return json(res, 403, { error: 'Use the guide from this room.' });
    if (!ready) return json(res, 503, { error: 'AI is unavailable. The room guide still works.' });
    if (busy || Date.now() - lastCall < 1500)
      return json(res, 429, { error: 'Try again shortly. The room guide still works.' });
    if (!req.headers['content-type']?.includes('application/json'))
      return json(res, 415, { error: 'Expected JSON.' });
    busy = true;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 2048) return json(res, 413, { error: 'Request too large.' });
        chunks.push(bytes);
      }
      let request;
      try {
        request = validateDiscoveryRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        return json(res, 400, { error: 'Choose a listed guide request.' });
      }
      lastCall = Date.now();
      const reply = await callDiscoveryTutor(request, { key, model, fetchImpl });
      json(res, 200, { ...reply, source: 'live-ai' });
    } catch {
      return json(res, 502, { error: 'AI could not answer. The room guide still works.' });
    } finally {
      busy = false;
    }
  };
}
