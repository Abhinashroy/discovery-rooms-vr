# Discovery Rooms — validation R10

## Earth Explorer — 0.23.0

101 automated tests and the eight-entry production build pass. Earth tests cover Gregorian/UTC boundaries, approximate orbital/lighting invariants, coordinate mapping, pole/dateline surface travel, polygon holes, all 195 landings and quiz eligibility/guards/scoring/abandonment. Production desktop journeys verify leap day, midnight rollover, mode/country selection, direct E card opening, movement coordinates, all question types, a deliberate 4/5 result, corrections, country revisit and saved review. Evidence and limitations are in PROJECT_STATUS.md.

The embedded preview reported about 1000 ms between rendered frames; do not record this as a performance pass. The new desktop journey records five thuds during 1.8 seconds of walking, a 4/5 quiz and exactly one Hooray. No actual Quest, child/usability or learning-benefit pass is claimed. Record device/browser versions, render settings, observed frame stability, session length and any discomfort before closing the following gates:

| Quest check             | Required observation                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry / modes           | Earth card, Enter VR, mode choice, short fades, stationary observer with natural head tracking; mode changes preserve time/discoveries                                                                                             |
| Surface travel          | Left-stick short faded steps, right 30° snap turns, left-trigger point teleport; upright predictable view, no physical walking or forced roll; stop on release/pause/input loss                                                    |
| Seated alternative      | All 195 countries reachable through native paginated destination panel with walking disabled                                                                                                                                       |
| Selection / readability | Right ray opens correct country card; current-country wrist cue and nearby labels readable, no far-side labels; fact/continent controls reachable                                                                                  |
| Hidden controls         | B/Y opens/closes; hidden panels do not intercept rays; Exit VR and Main room reachable                                                                                                                                             |
| Larger traveller        | 10 m radius, raised eye-origin, no forced roll; comfortable curvature, controller reach and predictable 1.8 m faded steps                                                                                                          |
| Clock minimize          | Expanded clock collapses to compact date/time, reopens in either mode without changing views; native Minimize closes its panel                                                                                                     |
| Sky                     | Stars visible in both views; occasional distant comet, none during quiz/menus/reduced motion; no foreground interception                                                                                                           |
| Time / lighting         | Native Day/Hour/Year and Play/speed agree with UTC display; leap date, midnight, day/night and Moon geometry agree after changing views                                                                                            |
| Comfort display         | Map light brightens learning surface without moving Sun/clock; paths/axis, reduced motion and larger text usable                                                                                                                   |
| Quiz                    | Five cards unlock; five prompts and four choices each; outlined country remains visible beside panel; labels/cards/wrist cue do not reveal answers; Confirm locks; Next scores once                                                |
| Review / abandon        | Deliberate wrong answer corrected in final score; revisit and last result retained; leaving after answering warns and stays unfinished                                                                                             |
| Lifecycle / sound       | Main room resets run, no continued rendering/timers, all three entries reopen; Earth thuds only for actual walking/short steps; one Hooray per completed quiz, including imperfect scores; mute/menu/departure stop pending sounds |

For an unfamiliar learner aged 10–15, observe understanding of the two views, finding five cards, recognising the map highlight, quiz choices and corrections. Record help needed and confusion before adding content. A pilot is usability evidence, not proof of improved memory.

## Planetarium / room navigation — 0.21.0

87 automated tests and the seven-entry build pass. Production browser evidence is in PROJECT_STATUS.md: enlarged Mercury; all eight E selections; name edit/remove/shrinking list; 6/8 and 8/8 submissions; distinct four-option quiz with change/confirm/locking, accurate 4/5 result; footsteps and the two completion Hoorays; room switch/reset. Latest browser checks additionally verify grouped Main room menus, compact corner controls and local inspection without player movement. No errors in the checked browser journey. Earlier 0.19 screenshots are historical.

Additional actual Quest checks remain pending:

1. Enter each room, use left-stick walking/right snap turn/either ray and hidden B/Y menu. Stop walking on stick release, loss of input, pause and stationary mode.
2. Read enlarged inner planets and size disclosures. Inspect maps/rings/tilts/clouds and rotate/close the local inspection at each planet’s exhibit; the player never moves automatically.
3. Start naming; visit/select a planet first. Choose a name and see it disappear for others. Edit/remove a name; verify guesses remain ungraded until all eight Submit.
4. Review right/wrong assignments and score, including correct names for mistakes. Read every review row and reach Start quiz. Hooray only for perfect naming, once.
5. Complete five random questions, each with four readable selectable options. Change before Confirm, verify lock, Next and final 0–5 score/review. One Hooray at completion, irrespective of score.
6. Listen for single footsteps during actual travel, silence while blocked/paused/stationary and cancellation/mute. No opening/ambient clip in Planetarium.
7. Use Main room during play/review/quiz, then choose either room. Audio stops and destination starts fresh; re-enter immersion if needed. Check hidden controls cannot intercept rays while roaming.
8. Check decoration is occasional, unobtrusive and disabled in quiz/menus/reduced motion. Record real frame stability, runtime settings and comfort observations.

Observe an unfamiliar learner's understanding of Explore → Name → Submit → Quiz. P5 is pending until real observations and fixes are recorded.

## Preserved classroom evidence and checks

The classroom baseline is 0.15.0, preserved in the 0.21.0 two-room checkpoint. Actual evidence is recorded in [PROJECT_STATUS.md](../PROJECT_STATUS.md); the [classroom plan](ROOM-DETECTIVE-PLAN.md) owns its scope. Tests alone cannot establish headset comfort or learner understanding.

## Engineering evidence

78 tests pass, including exactly four distinct changes across 200 seeds, books/fan coordinate variation across 400 seeds, repeat avoidance across 150 rounds, all 24 return orders, wrong/duplicate/reset behavior, player-safe bin placement, wall/furniture/dynamic-bin collisions and reachable sampled positions across 100 seeds. Two audio checks cover distance cadence, stop/restart, delayed-decode cancellation, asset selection, mute and cleanup. Five-entry production build passes with the expected vendored A-Frame notices.

Production browser checks: W advances the rig; menu pauses translation; arrow turn changes the view; a random round changes four actual scene positions; all four return and complete. Final replay/direct-selection checks and browser logs belong in PROJECT_STATUS.md.

## Desktop/usability checks

| Check                 | Required observation                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clear goal            | New player understands explore → remember → find four                                                                                                                                       |
| No advance clues      | Opening, HUD, labels and menu never identify the selected subset                                                                                                                            |
| Visibility            | All 13 props can be found at original and away placements, including ceiling/back-wall objects                                                                                              |
| Movement              | WASD/arrow translation, mouse/arrow look, wall/furniture collision and diagonal speed                                                                                                       |
| Pause/recovery        | Menu and blur stop input; closing resumes; wrong clicks preserve findings                                                                                                                   |
| Selection             | Direct mesh, E ahead and Tab/Enter equivalents; drag look does not accidentally guess                                                                                                       |
| Return                | One item returns per correct click; duplicates silent; exactly four complete                                                                                                                |
| Replay                | New study/baseline and random selection; no stale timer or findings                                                                                                                         |
| Destination variation | Repeatedly selected books use another surface; fan stays on ceiling at a different position                                                                                                 |
| Comfort               | Stationary viewpoints, turning, reduced motion, larger text and mute                                                                                                                        |
| Sound                 | start.mp3 on Play/replay; Hooray.m4a once per correct return; one thud per metre during walking; no steps while blocked/paused; mute stops all audio; playback failures preserve completion |

Record a real unfamiliar-player walkthrough before claiming the game is understandable. Include anonymous age band/input mode, confusing objects, assistance needed, perceived difficulty and fixes. A small pilot is for usability; it is not evidence of general cognitive improvement.

## Quest 3 checks — pending

Use the intended secure new build, record headset/browser/runtime versions and input mode, then test:

1. Enter/exit and natural head tracking, including during the covered change.
2. Both rays; left-stick walking; right-stick 30-degree snap turn; loss of controller input.
3. B/Y menu toggle, hidden-by-default panel, hidden targets not intercepting rays, Exit VR always reachable.
4. Ready/replay, stationary/viewpoint actions and all four returns. Listen for start, Hooray and individual footsteps; verify silence when sticks stop, movement is blocked or menu/stationary/mute is active.
5. Readability/selection of small supplies, ceiling fan, wall clock, back poster and near-floor dustbin.
6. Comfort and real frame/stall observations against a recorded runtime target.

Physical movement is not constrained by virtual collision. Verify the device's current manufacturer age/use guidance before supervised learner headset sessions. Desktop remains a complete input option. No actual headset pass is recorded for this build.

## Release gates

| Gate                                              | State                    |
| ------------------------------------------------- | ------------------------ |
| Round/navigation tests and build                  | Passed                   |
| Recorded production desktop journey               | Passed for listed checks |
| New-player goal/action understanding              | Pending                  |
| Actual Quest 3 controls/readability/comfort       | Pending                  |
| Supervised pilot and fixes                        | Pending                  |
| Optional AI/reference/quiz                        | Not implemented          |
| Restored hosting access and matching public build | Pending                  |

Log concrete reproduction steps, fixes and retests. Never substitute simulated headset/child feedback for an actual result. The public URL is not this current local build.
