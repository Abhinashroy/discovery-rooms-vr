# Project status

Updated **28 October 2026**. Current application: **0.24.1**.

Public website: [https://abhinashroy.github.io/discovery-rooms-vr/](https://abhinashroy.github.io/discovery-rooms-vr/).

## Latest VR fixes — 0.24.1

- Planet selection opens a native information card in Explore, with optional close-up at the exhibit. Naming still opens name choices and quiz mode does not expose facts.
- Earth right-trigger selection intersects the actual globe surface before opening country information; left trigger remains teleport. The globe cannot intercept menu rays while a panel is open.
- Information cards capture the selection gaze with bounded tilt and stay fixed after opening. Both space rooms use opaque full-panel backings so world objects cannot show through text or gaps.
- Earth menus stop player travel while a playing orbit/rotation keeps advancing. Explicit clock Pause, Globe mode and quiz state still control simulation playback.
- Globe Explorer's VR player is raised 35 cm relative to 0.24.0. Tracked seated/standing head movement is retained; desktop height is unchanged.
- 115 automated checks pass. Native production-app rendering previews and actual controller event routing are checked on desktop; actual Quest comfort/readability retest remains required.
- Production-app preview evidence: Mercury/Saturn facts open without close-up; optional close-up/end keeps the card; a right-controller ray opens India's fact even with an unrelated decorative intersection; left-trigger teleport leaves the panel closed. Globe rig height is 10.35 m plus tracked eye height. Time advances with the native menu open, then remains unchanged after explicit Pause. Opaque full-menu/card screenshots are retained locally; no browser errors in the checked journeys.

## Previous VR fixes — 0.24.0

- Planetarium and Earth native menu labels retain their textures before A-Frame's asynchronous object attachment. Buttons render one textured face instead of overlapping background/text planes, with correctly proportioned, readable text.
- Both rooms place menus in world space on opening. Head turns and content redraws do not move them. B/Y closes and reopens at the current view; headset tracking remains active while a menu is open.
- Removed both controller MENU planes and wrist/status boxes from these two rooms. Controller rays and B/Y still work.
- Earth VR removes the artificial 1.5 m lift and respects tracked seated/standing eye height. The desktop giant view is preserved. Controller Help explains right-trigger country information, left-trigger teleport, sticks and B/Y.
- Desktop rendering previews exercise the actual native menu meshes: all eight planet names visible, canvas-ray selection works, used names leave the list, repeated redraws preserve text, head-turn preview leaves world pose unchanged, Earth country/help/card menus render and controller UI child count is zero. This is not an actual Quest pass; the owner's hardware retest remains required.

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

- 115 automated tests cover current rooms and retained legacy routes.
- Eight production entries build: selector, three current rooms and four legacy pages.
- Desktop browser journeys cover room navigation, classroom rounds, Planetarium naming/quiz, Earth clock boundaries, globe movement, tiny-country search, country cards, quiz locking and corrections.
- Latest Earth journey: five opened cards; fact, region, Turkey's paired continents and map prompts; deliberate 4/5 result; exactly one completion Hooray. Walking for 1.8 seconds started five supplied thuds.
- All 195 country destinations are validated inside their bundled polygon. A visible decorative comet, compact clock and shared-clock editing without leaving Globe mode were checked.
- Repository preparation: Prettier formatting passes, all 115 tests pass, eight production pages build, Python helpers parse and pass Ruff formatting, and npm audit reports zero known vulnerabilities. The generated country catalog remains unchanged. GitHub Actions repeats the Node formatting/test/build checks.

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
