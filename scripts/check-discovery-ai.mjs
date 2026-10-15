import { callDiscoveryTutor } from '../server/discovery-tutor.mjs';
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const key = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL;
if (process.env.DISCOVERY_AI_ENABLED !== 'true' || !key || !model) {
  console.error(
    'Live guide check not run. Configure OPENAI_API_KEY, OPENAI_MODEL and DISCOVERY_AI_ENABLED=true in the local .env file. No provider request was sent.',
  );
  process.exitCode = 1;
} else {
  console.log(
    'Live provider smoke check: three optional guide requests. Review the answers; passing schema checks does not establish suitability for children.',
  );
  for (const input of [
    { adventure: 'space', tableId: 'globe', intent: 'explain', phase: 'active' },
    { adventure: 'ocean', tableId: 'moon', intent: 'hint', phase: 'available' },
    { adventure: 'workshop', tableId: 'mission', intent: 'explain', phase: 'completed' },
  ]) {
    try {
      const reply = await callDiscoveryTutor(input, { key, model });
      console.log(`${input.adventure} / ${input.tableId} / ${input.intent}: ${reply.message}`);
    } catch {
      console.error(
        `${input.adventure}: provider check failed. Check model access/configuration and try again.`,
      );
      process.exitCode = 1;
    }
  }
}
