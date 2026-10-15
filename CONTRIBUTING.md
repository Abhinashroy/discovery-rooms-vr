# Contributing

Use Node.js 24, 25 or 26 and npm. The application has no required API key.

```sh
npm ci
npm run dev
```

Before committing:

```sh
npm run format
npm run format:check
npm test
npm run build
```

Keep each room's behavior independent. Changes to shared movement, preferences, audio or room routing should preserve all three rooms. Tests cover both the current rooms and retained legacy routes.

Country facts are authored in `src/earth-explorer/data/facts-{a,b,c}.json`. Keep one concise original summary and a supporting source per country. After editing those files, run:

```sh
npm run build:catalog
```

Commit the generated `catalog.json` alongside its source facts. The generator validates coverage and landings against the bundled map. Do not hand-edit the country polygons or remove source/license manifests.

Prettier formats application code, tests, HTML, CSS, JSON and Markdown. Vendored libraries, map geometry and the generated catalog are excluded. Optional Python asset scripts use four-space indentation and Ruff formatting. Asset regeneration requires Python with Pillow, NumPy and soundfile; playing and building the app does not require Python.

Never commit `.env`, learner records, personal data, downloaded device tools, caches or old build archives. Use `.env.example` only for empty configuration names. Report device observations in `docs/headset-smoke-check.md`; desktop tests do not establish Quest comfort or learning benefit.
