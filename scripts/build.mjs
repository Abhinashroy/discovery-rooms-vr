import { build } from 'vite';
await build({
  configFile: false,
  base: './',
  build: {
    rolldownOptions: {
      input: {
        game: 'index.html',
        classroom: 'classroom.html',
        planetarium: 'planetarium.html',
        earth: 'earth.html',
        exploration: 'exploration.html',
        classic: 'classic.html',
        computing: 'computing.html',
        authoring: 'authoring.html',
      },
    },
  },
});
