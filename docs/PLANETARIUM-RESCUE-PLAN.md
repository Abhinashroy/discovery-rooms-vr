# Planetarium Rescue — Room 2 plan and implementation

Revision R3 · 15 October 2026 · **Room 2 behavior implemented in 0.21.0 and preserved in the 0.23.0 three-room checkpoint; actual Quest/learner validation pending.**

This revision incorporates the owner's new size, naming, quiz and sound instructions. It supersedes R1's strict inner-body scale, grouped card-first restoration, assisted adaptive recall and silent room. Classroom Detective remains the accepted implementation. Keep the hall, planet materials, navigation, room selector and fresh-entry behavior. R3 adds grouped Main room menus, compact corner controls and inspection at each planet’s own exhibit.

## 1. Purpose and scope

For ages 10–15, learn eight planet names, their order and a few memorable characteristics through exploration, naming and a separate knowledge quiz. There is one enclosed planetarium and the existing classroom, with no extra hub, timer, lives, branching missions or AI requirement.

Mercury → Venus → Earth → Mars → Jupiter → Saturn → Uranus → Neptune.

The Sun is a star and is outside the eight-planet naming score. Pluto is a dwarf planet. Facts use [NASA's planet guide](https://science.nasa.gov/solar-system/planets/) and [solar-system facts](https://science.nasa.gov/solar-system/solar-system-facts/). Every quiz record stores its supporting NASA URL.

## 2. Size revision

The original display scale remains actual diameter / 1,391,400 km × 20 m. Sun diameter stays 20 m. Apply **12756/4879 = 2.614470...** to the four inner planet diameters only. This makes new Mercury equal to old Earth and keeps the four inner planets proportional to each other.

| Body    | Current display diameter, rounded |
| ------- | --------------------------------: |
| Sun     |                          20.000 m |
| Mercury |                           0.183 m |
| Venus   |                           0.455 m |
| Earth   |                           0.479 m |
| Mars    |                           0.255 m |
| Jupiter |                           2.055 m |
| Saturn  |                           1.733 m |
| Uranus  |                           0.735 m |
| Neptune |                           0.712 m |

Compute from unrounded reference values. The entrance/HUD/credits explain that inner planets are enlarged and spacing is arranged for exploration. Do not claim every body shares one size scale. Ring extents retain the original scale; none of the enlarged inner planets has rings. Main textures, tilts, clouds and atmospheres remain. Inner planets temporarily enlarge to 1.1 m at their own exhibits during inspection, with a visible close-up label. Outer planets keep their display sizes. Closing restores the baseline.

## 3. Retained environment and asset procedure

- Enclosed 48 × 40 × 26 m observatory: walls at x±24/z±20, ceiling y26. Cosmos wall/ceiling maps, stable galaxy floor, architectural ribs and floor edge strips.
- Sun centre (0,12,-8), radius 10 m, protected floor boundary radius 10.6 m.
- Eight fixed stands form a horseshoe in planet order: Mercury (-19,-2), Venus (-16,4), Earth (-12,9), Mars (-6,12), Jupiter (1,13), Saturn (9,11), Uranus (16,6), Neptune (19,0). Coordinates are x/z in metres.
- Entrance (0,17) and safe named viewpoints; no central inspection pedestal. Body/ring/stand clearance comes from the same layout used for movement collisions.
- Textured bodies with shared cached local maps, Earth cloud/atmosphere layers, giant-planet bands, Saturn's broad rings, simplified faint other-giant rings, moderate Neptune blue-green and restrained Sun halo.
- The local assets already exist. scripts/fetch-planetarium-assets.py reproduces the Solar System Scope / INOVE CC BY 4.0 downloads and lower-resolution variants. Preserve source/license details in public/planetarium/credits.json.
- Equal-sized interaction proxies let users select small planets. Inspection opens one detail display at the selected stand, hides its original, and never moves the player. It can be rotated and closed; swapping/disposal does not accumulate textures.
- Tiny comet/UFO passes use seeded safe upper-surface paths, one at a time, every roughly 25–45 seconds, lasting 6–10 seconds. They stop while paused, hidden, in quiz/results or reduced motion. They are fictional decoration.

## 4. Complete player procedure

### A. Choose and explore

Choose Planetarium from the root selector. Learn the name/order at each exhibit, read its short notes and optionally inspect that planet in place (inner planets enlarge). General learning notes cover the Sun, orbit, planet families and Pluto. Walk virtually or use safe viewpoints. No physical walking is required.

### B. Name all eight

Press Start naming challenge. Correct exhibit names and learning details hide. All eight are initially unassigned.

1. Go to a planet and select its body/marker, E ahead, controller trigger or equivalent menu action.
2. The name chooser identifies the selected neutral exhibit. It offers all currently unused planet names.
3. Selecting a name assigns it to this planet and removes it from other planets' lists. Return to the room to choose another planet.
4. The visible label contains the user's guess. Do not show correct/wrong marks, auto-corrections or answer hints before Submit.
5. Selecting an assigned planet allows editing. Its own current name remains available; other used names do not. Remove returns the current name to the shared list. Swapping two used names requires releasing them first.
6. Progress shows assigned count out of eight. Submit appears only when every planet has one unique name.

### C. Submit and review

Submit freezes the assignments and grades the entire round once. Show score out of eight and all eight rows: exhibit number, chosen name, correct/incorrect and correct planet name for mistakes. Hooray plays once only for 8/8. Repeated actions and setting changes cannot rescore or replay it. Present Start quiz after review; an imperfect naming round can also proceed.

### D. Quiz

Start quiz selects five distinct random questions from the 30-question pool. Shuffle each question's four options. The panel looks different from the name grid and does not ask the user to click a scene planet as an answer.

For each question: show question number/category/prompt → choose A–D → allow changing the choice → Confirm locks the answer → Next advances. The fifth Next is labelled Show final score. No timer, retries, hints or early Finish is needed. Reveal correctness only in the final review. Question-ID guards reject delayed clicks from a previous prompt.

The authored pool covers order (8), size (3), worlds (7), reasoning (5), families (3) and solar-system basics (4). Questions/keys/options/explanations/source URLs live in src/planetarium/quiz.js. Sampling is deterministic for a session seed and different seeds vary both questions and option order. There are no API calls or generated answer keys.

### E. Final score and replay

Show quiz score out of five, naming score out of eight and every quiz response with correct answer and a short explanation. Hooray plays once when this section finishes, including a zero or imperfect score. Explore and try again starts a fresh session with a new seed. Leaving the room discards the entire run.

## 5. Audio

Use only the user's existing public/audio/footstep.wav and Hooray.m4a in Planetarium. The footstep is one trimmed thud from walk sound.mp3, using the classroom's existing extraction/cadence. No new trim or download is needed.

- Actual movement starts a thud, then one per travelled metre: approximately 0.5 seconds at 2 m/s.
- Base cadence on collision-resolved distance, not key repeat, diagonal speed or teleport distance.
- Stop walking sources and queued decode playback when input stops, blocked, paused, stationary, blurred or leaving.
- Muting stops all channels. Browser/user gestures unlock Web Audio; errors are non-blocking.
- Hooray: once on perfect naming submission; once on quiz completion. No per-name or per-question reward.
- Do not add an opening clip or ambient soundtrack to Planetarium. Classroom audio remains unchanged.

## 6. Desktop, VR and inclusion

WASD/Up/Down movement, drag look, arrow turning, E select, M/Escape controls. Both room menus offer Main room to return to the selector; they no longer offer direct cross-room buttons. The classroom Menu and planetarium viewpoint controls use rounded corner docks. Empty status/feedback areas hide. Stationary mode offers every exhibit viewpoint; menu keyboard actions provide equivalents for selection. Larger text, reduced motion, mute, explicit labels and visible right/wrong words accompany colour. No timer or required sound comprehension.

VR implementation uses left-stick movement, right-stick 30° snap turns, either-controller rays and B/Y controls. Settings are hidden during roaming. Selecting a planet opens name choices; submission/review and quiz have intentional activity panels with equivalent actions. Learning notes are available in the VR menu. Main room return stops audio/work, exits immersion and loads the selector; VR re-entry may be required.

Actual Quest 3 ergonomics, text/ray readability and frame stability must be measured on hardware. Supervised learner testing is separate from engineering checks. The browser game is a complete input option; no claimed cognitive improvement without evaluation.

## 7. Implementation stages and acceptance

| Stage                 | Version / state   | Acceptance                                                                                                       |
| --------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| P1–P4 baseline        | 0.19.0 historical | Selector, hall/assets, inspection, prior activities and controls implemented                                     |
| R2 scale              | 0.20.0 complete   | Mercury equals old Earth; inner ratios preserved; outer/Sun unchanged; safe routes                               |
| R2 naming             | 0.20.0 complete   | Planet-first, shrinking names, edit/release, unique full submission, accurate frozen review                      |
| R2 quiz/audio         | 0.20.0 complete   | Valid pool30, random five, four options, confirmation/locking, final score, transition sounds and footsteps      |
| R2 desktop checkpoint | 0.20.0 complete   | 86 tests, seven-entry build, actual browser journeys and screenshots                                             |
| R3 menus/inspection   | 0.21.0 complete   | Main room navigation, compact corner controls, empty containers hidden, local inspection without player movement |
| P5 hardware/learner   | Pending           | Quest controls/readability/comfort, unfamiliar learner observations and fixes                                    |

Run npm test (101 checks across all rooms) and npm run build (eight entries). Browser evidence in PROJECT_STATUS.md covers 6/8 and 8/8 naming, edit/shrinking choices, all eight direct E targets, a complete 4/5 quiz, footsteps/celebration and room departure. Run npm run build for the current production output; Earth Explorer is the separate third room. Local historical packages are excluded from Git. GitHub source publication does not update game hosting.

## 8. Commands and checkpoint

```powershell
cd discovery-rooms-vr
npm test
npm run build
npm run dev
```

Open the printed URL (normally http://127.0.0.1:5173/) and refresh any old tab. Choose Planetarium and follow Explore → Name → Submit → Start quiz → Confirm/Next → Final score. For the packaged build run npm run preview after build. Stop with Ctrl+C. Quest USB forwarding is in [deployment.md](deployment.md); hardware acceptance is in [headset-smoke-check.md](headset-smoke-check.md).
