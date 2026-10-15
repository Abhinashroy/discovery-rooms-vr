import { validateDiscoveryRequest, validateDiscoveryReply } from './tutor-contract.js';
export async function requestGuide(request, { fetchImpl = fetch, signal } = {}) {
  const clean = validateDiscoveryRequest(request);
  const response = await fetchImpl('/api/discovery-tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clean),
    signal,
  });
  if (!response.ok) throw new Error('AI could not answer. Keep using the room guide below.');
  const value = await response.json();
  if (
    value.source !== 'live-ai' ||
    Object.keys(value).some((k) => !['source', 'message'].includes(k))
  )
    throw new Error('AI could not answer. Keep using the room guide below.');
  return validateDiscoveryReply({ message: value.message }).message;
}
