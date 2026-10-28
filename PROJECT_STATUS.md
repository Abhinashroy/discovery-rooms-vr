# Project status

Updated **28 October 2026**. Current application: **0.23.0**.

Public website: [https://abhinashroy.github.io/discovery-rooms-vr/](https://abhinashroy.github.io/discovery-rooms-vr/).

## Implemented

| Area                | Current state                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Room selection      | Three room cards; Main room return resets the outgoing run                                                                                     |
| Classroom Detective | Large walkable classroom; four random moved props from a set of 13; supplied sounds                                                            |
| Planetarium Rescue  | Eight exhibits, local inspection, shrinking name choices, submission review and five-of-30 quiz                                                |
| Earth Explorer      | Two connected views; shared UTC clock; giant spherical travel; 195 sourced country cards; five-question quiz; stars/comets and supplied sounds |
| Input               | Keyboard/mouse and native WebXR controller controls, with seated/stationary alternatives                                                       |
| Content             | Local map/textures/audio; no API key required for the current rooms                                                                            |
| Repository          | Formatted source, pinned npm lockfile, CI, contributor guidance and third-party notices                                                        |

## Verification

- 101 automated tests cover current rooms and retained legacy routes.
- Eight production entries build: selector, three current rooms and four legacy pages.
- Desktop browser journeys cover room navigation, classroom rounds, Planetarium naming/quiz, Earth clock boundaries, globe movement, tiny-country search, country cards, quiz locking and corrections.
- Latest Earth journey: five opened cards; fact, region, Turkey's paired continents and map prompts; deliberate 4/5 result; exactly one completion Hooray. Walking for 1.8 seconds started five supplied thuds.
- All 195 country destinations are validated inside their bundled polygon. A visible decorative comet, compact clock and shared-clock editing without leaving Globe mode were checked.
- Repository preparation: Prettier formatting passes, all 101 tests pass, eight production pages build, Python helpers parse and pass Ruff formatting, and npm audit reports zero known vulnerabilities. The generated country catalog remains unchanged. GitHub Actions repeats the Node formatting/test/build checks.

## Remaining acceptance

1. Quest 3: validate controller rays, short steps/teleport, upright tracking, B/Y hiding, native panels, country pagination, audio, Exit VR and room re-entry.
2. Record actual headset frame stability, readability and comfort; fix observed failures.
3. Observe an unfamiliar learner aged 10–15 navigating each learning flow. Record confusion/help needed without claiming proven memory improvement.
4. Live AI remains deferred for the three current rooms. The optional tutor and earlier prototypes are retained legacy code.

Use [the headset checklist](docs/headset-smoke-check.md) for device observations. The **Deploy website** workflow validates and publishes the static build to GitHub Pages after pushes to `main`. The earlier Sites project still returns project-not-found; its original link has not been updated.

## Commands

```sh
npm ci
npm run format:check
npm test
npm run build
npm run dev
```

See [README](README.md) for controls, [deployment](docs/deployment.md) for Quest launch steps and [CHANGELOG](CHANGELOG.md) for the compact version history. Local historical packages and recovery backups are excluded from Git.
