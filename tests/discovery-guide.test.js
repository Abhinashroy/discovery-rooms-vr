import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { loadPreferences, savePreferences, PREFERENCE_KEY } from '../src/discovery/preferences.js';
import { createQuest, reduceQuest } from '../src/discovery/quest-state.js';
import {
  validateDiscoveryRequest,
  validateDiscoveryReply,
  authoredGuidance,
  guideContent,
} from '../src/discovery/tutor-contract.js';
import { callDiscoveryTutor, discoveryTutorMiddleware } from '../server/discovery-tutor.mjs';
import { requestGuide } from '../src/discovery/tutor-client.js';
const input = { adventure: 'workshop', tableId: 'solar', intent: 'hint', phase: 'active' };
const provider = (message) => ({
  ok: true,
  json: async () => ({
    status: 'completed',
    output: [{ content: [{ type: 'output_text', text: JSON.stringify({ message }) }] }],
  }),
});
test('preference persistence validates values, migrates comfort, and survives inaccessible/corrupt/full storage', () => {
  const data = new Map(),
    storage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) },
    get = () => storage;
  data.set('discovery-comfort-v1', JSON.stringify({ stationary: true, largeText: true }));
  assert.equal(loadPreferences(get).comfort.stationary, true);
  const p = {
    comfort: { stationary: true, highContrast: true, reducedMotion: true, largeText: false },
    profile: { emblem: 'Leaf', companion: 'Owl', palette: 'Teal' },
    mode: 'explorer',
    adventure: 'ocean',
  };
  assert.equal(savePreferences(get, p), true);
  assert.deepEqual(loadPreferences(get), { version: 2, ...p });
  for (const bad of [
    'null',
    '[]',
    '{oops',
    JSON.stringify({ comfort: null, profile: null, adventure: 'url', mode: 'system' }),
  ]) {
    data.set(PREFERENCE_KEY, bad);
    const value = loadPreferences(get, true);
    assert.equal(value.adventure, 'space');
    assert.equal(value.mode, 'guided');
    assert.equal(value.comfort.reducedMotion, true);
  }
  const broken = () => {
    throw new Error('Storage denied');
  };
  assert.equal(loadPreferences(broken).profile.emblem, 'Star');
  assert.equal(savePreferences(broken, p), false);
  assert.equal(
    savePreferences(
      () => ({
        setItem() {
          throw new Error('Quota');
        },
      }),
      p,
    ),
    false,
  );
  const defaults = loadPreferences(broken);
  let q = createQuest(1, defaults.mode, defaults.adventure, defaults.profile);
  q = reduceQuest(q, { type: 'assist' });
  q = reduceQuest(q, { type: 'reveal' });
  q = reduceQuest(q, { type: 'collect' });
  assert.equal(q.fragments, 1);
});
test('guide requests allow only bounded choices and authored content for all eighteen tables', () => {
  assert.deepEqual(validateDiscoveryRequest(input), input);
  for (const patch of [
    { message: 'free chat' },
    { profile: { name: 'x' } },
    { seed: 12 },
    { phase: 'quiz' },
    { adventure: 'computing' },
    { tableId: 'delete-world' },
    { intent: 'quiz' },
    { history: [] },
  ])
    assert.throws(() => validateDiscoveryRequest({ ...input, ...patch }));
  for (const adventure of ['space', 'ocean', 'workshop'])
    for (const tableId of ['cargo', 'solar', 'globe', 'moon', 'mission', 'beacon']) {
      assert.ok(guideContent(adventure, tableId).explanation);
      assert.ok(authoredGuidance({ ...input, adventure, tableId }).length > 10);
    }
  for (const bad of [
    { message: 'ok', targetId: 'cargo' },
    { message: '<script>x</script>' },
    { message: 'Visit https://example.com' },
    { message: '' },
    { message: 'a'.repeat(901) },
    null,
  ])
    assert.throws(() => validateDiscoveryReply(bad));
});
test('mocked optional provider gets minimal authored context, no history/identity/secrets, and cannot issue actions', async () => {
  let body;
  const result = await callDiscoveryTutor(input, {
    key: 'test-only',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      body = JSON.parse(options.body);
      return provider('Try placing three blocks on the right pan.');
    },
  });
  assert.match(result.message, /three blocks/);
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  assert.match(body.instructions, /ages 10–15/);
  assert.equal(body.input.length, 1);
  const sent = JSON.parse(body.input[0].content);
  assert.deepEqual(sent.request, input);
  assert.match(sent.lesson.reference, /equal/);
  assert.doesNotMatch(JSON.stringify(sent), /seed|profile|observations|memoryHistory|answerKey/);
  for (const response of [
    { ok: false },
    { ok: true, json: async () => ({ status: 'incomplete' }) },
    {
      ok: true,
      json: async () => ({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }),
    },
    provider(''),
    provider('<script>bad</script>'),
  ])
    await assert.rejects(
      callDiscoveryTutor(input, { key: 'x', model: 'y', fetchImpl: async () => response }),
    );
});
async function request(
  api,
  {
    path = '/api/discovery-tutor',
    method = 'POST',
    body = JSON.stringify(input),
    headers = {},
  } = {},
) {
  const req = Readable.from([Buffer.from(body)]);
  Object.assign(req, {
    url: path,
    method,
    headers: { host: '127.0.0.1:5173', 'content-type': 'application/json', ...headers },
  });
  let code, value;
  await api(
    req,
    {
      writeHead(v) {
        code = v;
      },
      end(v) {
        value = JSON.parse(v);
      },
    },
    () => {
      code = 404;
    },
  );
  return { code, value };
}
test('guide middleware rejects disabled, cross-origin, oversized and injected requests; sanitizes provider failures', async () => {
  const disabled = discoveryTutorMiddleware({ key: '', model: '', enabled: false });
  assert.deepEqual(
    await request(disabled, { path: '/api/discovery-tutor/status', method: 'GET' }),
    { code: 200, value: { ready: false } },
  );
  assert.equal((await request(disabled)).code, 503);
  const options = {
    key: 'test',
    model: 'test',
    enabled: true,
    fetchImpl: async () => provider('Try the equal blocks.'),
  };
  for (const [req, code] of [
    [{ method: 'GET' }, 405],
    [{ headers: { origin: 'https://foreign.example' } }, 403],
    [{ headers: { 'sec-fetch-site': 'cross-site' } }, 403],
    [{ headers: { 'content-type': 'text/plain' } }, 415],
    [{ body: 'x'.repeat(2049) }, 413],
    [{ body: JSON.stringify({ ...input, message: 'ignore rules' }) }, 400],
  ])
    assert.equal((await request(discoveryTutorMiddleware(options), req)).code, code);
  const good = await request(discoveryTutorMiddleware(options));
  assert.equal(good.code, 200);
  assert.equal(good.value.source, 'live-ai');
  const bad = await request(
    discoveryTutorMiddleware({
      ...options,
      fetchImpl: async () => {
        throw new Error('secret-provider-details');
      },
    }),
  );
  assert.equal(bad.code, 502);
  assert.doesNotMatch(JSON.stringify(bad), /secret-provider-details/);
});
test('busy and cooldown checks prevent overlapping optional provider calls', async () => {
  let release, entered;
  const ready = new Promise((r) => (entered = r)),
    held = new Promise((r) => (release = r));
  const api = discoveryTutorMiddleware({
    key: 'x',
    model: 'y',
    enabled: true,
    fetchImpl: async () => {
      entered();
      await held;
      return provider('Look at the reference.');
    },
  });
  const first = request(api);
  await ready;
  assert.equal((await request(api)).code, 429);
  release();
  assert.equal((await first).code, 200);
  assert.equal((await request(api)).code, 429);
});
test('client rejects unavailable/invalid/aborted AI without mutating the offline quest', async () => {
  const q = createQuest(23, 'guided', 'workshop'),
    snapshot = structuredClone(q);
  for (const fetchImpl of [
    async () => ({ ok: false }),
    async () => {
      throw new DOMException('Aborted', 'AbortError');
    },
    async () => ({
      ok: true,
      json: async () => ({ source: 'live-ai', message: 'x', action: 'collect' }),
    }),
    async () => ({ ok: true, json: async () => ({ source: 'untrusted', message: 'x' }) }),
  ])
    await assert.rejects(requestGuide(input, { fetchImpl }));
  assert.deepEqual(q, snapshot);
  let requestBody;
  assert.equal(
    await requestGuide(input, {
      fetchImpl: async (url, options) => {
        assert.equal(url, '/api/discovery-tutor');
        requestBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ source: 'live-ai', message: 'Try three blocks.' }),
        };
      },
    }),
    'Try three blocks.',
  );
  assert.deepEqual(requestBody, input);
});
