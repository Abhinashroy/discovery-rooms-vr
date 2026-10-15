import { discoveryTutorMiddleware } from '../server/discovery-tutor.mjs';
import { createServer, preview } from 'vite';
import { tutorMiddleware } from '../server/tutor.mjs';
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const api = tutorMiddleware(),
  discoveryApi = discoveryTutorMiddleware();
const plugin = {
  name: 'room-tutor',
  configureServer(server) {
    server.middlewares.use(discoveryApi);
    server.middlewares.use(api);
  },
  configurePreviewServer(server) {
    server.middlewares.use(discoveryApi);
    server.middlewares.use(api);
  },
};
const config = {
  configFile: false,
  plugins: [plugin],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
};
const server = process.argv.includes('--preview')
  ? await preview(config)
  : await createServer(config);
if (server.listen) await server.listen();
server.printUrls();
