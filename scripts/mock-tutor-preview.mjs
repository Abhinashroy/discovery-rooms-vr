// Browser integration fixture only. Never a demonstration of an actual model call.
import { preview } from 'vite';
import { tutorMiddleware } from '../server/tutor.mjs';
const api = tutorMiddleware({
  key: 'mock-only',
  model: 'MOCK-ONLY-NO-PROVIDER',
  fetchImpl: async (_url, options) => {
    const request = JSON.parse(options.body),
      question = JSON.parse(request.input.at(-1).content).question;
    const quiz = /quiz/i.test(question)
      ? {
          question: 'MOCK CHECK: after pushing A then B, which item pops first?',
          options: ['A', 'B', 'Neither'],
          correct: 1,
          explanation:
            'B was pushed last. This question is a browser integration fixture, not AI generation.',
        }
      : null;
    const answer = {
      message: quiz
        ? 'MOCK CHECK: answer this test question.'
        : 'MOCK CHECK: the validated response selected Queue; its path should now light up.',
      targetId: quiz ? null : 'queue',
      quiz,
    };
    return {
      ok: true,
      json: async () => ({
        status: 'completed',
        output: [{ content: [{ type: 'output_text', text: JSON.stringify(answer) }] }],
      }),
    };
  },
});
const server = await preview({
  configFile: false,
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  plugins: [
    {
      name: 'mock-tutor-ui-check',
      configurePreviewServer(server) {
        server.middlewares.use(api);
      },
    },
  ],
});
console.log('MOCKED TUTOR UI CHECK ONLY. No API key or provider request is used.');
server.printUrls();
