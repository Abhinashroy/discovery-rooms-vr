import { createServer, preview } from 'vite';
const config = {
  configFile: false,
  appType: 'mpa',
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
};
const server = process.argv.includes('--preview')
  ? await preview(config)
  : await createServer(config);
if (server.listen) await server.listen();
server.printUrls();
