# Discovery Rooms — architecture R10 / 0.24.0

## Three-room entry and lifecycle

index.html is the selector. classroom.html loads the accepted game; planetarium.html loads Room 2; earth.html loads Earth Explorer. Main room menu actions return to the selector. src/rooms/routes.js validates destinations, stops outgoing work, exits immersion, releases the renderer on pagehide and reloads cached abandoned pages on pageshow. Runs stay in memory; leaving discards them. Shared comfort settings persist. Earth reads existing comfort defaults and stores its own display preferences. VR may need re-entry after changing pages.

Eight production entries include four preserved legacy pages. No live AI endpoint is added to the current rooms.

## Earth Explorer modules

| File                                        | Responsibility                                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| src/earth-explorer/astronomy.js             | Continuous UTC timestamp, calendar controls, solar/sidereal rotation relationship, tilted elliptical Earth orbit and inclined lunar geometry    |
| src/earth-explorer/geography.js             | Geographic vectors, parallel-transported tangent frame, great-circle travel, dateline-aware polygon/hole picking                                |
| src/earth-explorer/countries.js             | 195 authored country/region/fact/source/version records                                                                                         |
| src/earth-explorer/audio.js and ambience.js | Cancellable supplied thud/Hooray playback and single-instance decorative comet schedule                                                         |
| scripts/build-country-catalog.mjs           | Merge 195 authored fact records and validate/repair geographic landings                                                                         |
| src/earth-explorer/state.js                 | Shared modes/clock/visits, explored-only five-question quiz, question guards, confirmed answers, completed and abandoned records                |
| src/earth-explorer/world.js                 | Three.js bodies and lighting in A-Frame, merged borders, subdivided highlights, labels, spherical travel, native VR panels and resource cleanup |
| src/earth-explorer/main.js and style.css    | Shared action dispatch, transitions, mini-globe/readouts, DOM cards/time/quiz, preferences and responsive layout                                |
| public/earth-explorer/                      | Pinned Natural Earth geometry, Moon texture and source/license/hash manifest                                                                    |
| scripts/fetch-earth-assets.py               | Reproducible map and texture download/validation                                                                                                |
| tests/earth-explorer.test.js                | Calendar, astronomy, spherical geometry, all-country content, state/quiz and transcontinental region checks                                     |

Date/year/day/hour controls update one UTC timestamp. Approximate continuous periods do not change with leap-year date counts. Earth orientation includes the annual component needed for a mean solar day. A compact clock button can reopen the shared controls in either mode without changing views. A 2,400-point star field and one occasional distant comet are decorative and unrelated to the astronomical model. Comets stop during quiz, menus, hidden tabs and reduced motion. Native country panels paginate ten destinations per page. Both views transform the same Sun/Moon directions into their display frames; this is a teaching model with compressed geometry, not an ephemeris.

The 10 m Globe surface stays centred beneath an upright rig with a 1.5 m eye-origin lift on desktop. VR uses no artificial lift and respects the headset's tracked eye height. Movement updates latitude/longitude and transports the tangent heading; the globe and celestial directions transform into that frame. Desktop travel is continuous; Quest uses short faded steps or point teleport. No tracked headset roll is imposed. Actual comfort/performance is unvalidated.

Natural Earth 50m polygons retain holes and dateline handling. Border geometry is merged, selected polygons triangulated/subdivided and replaced on selection, labels limited to three nearby countries and occluded by Earth. All 195 landing points are verified against their map feature; source coordinates that miss land are replaced with a validated map-label/interior point. Other mapped names are selectable without inventing learning facts.

Quiz targets come only from opened cards: five distinct countries, 2 location + 2 continent + 1 fact prompt. Four choices, fact/source/version snapshots, question-ID guards and Confirm/Next prevent duplicate/stale scoring. Quiz pauses time and hides answer-bearing cards/labels/location cues. A side panel leaves the outlined globe visible. Completed review survives map revisits; abandoned attempts remain unfinished. There is no AI grading. Earth reuses the tested two-clip audio engine for distance-based thuds, short-step sounds and one quiz-completion Hooray; mute/menu/blur/hidden/departure cancel pending sounds. No music is added.

Page departure clears transition timers/listeners and disposes textures/geometries/materials; shared room routing exits XR/releases the renderer. Earth state resets on re-entry. Current package passes 109 tests and the eight-entry build; device/learner gates are in the validation document.

## Shared native VR menus

`src/rooms/xr-menu.js` paints proportioned canvas labels, places upright world-space panels once per opening, and prunes label resources only after collecting both attached objects and pending A-Frame entities. This prevents immediate pruning from erasing new option names. Each button has one textured mesh, so text cannot fight with a coplanar background plane. Head turns and content redraws leave the anchor unchanged; reopening or an intentional scene/view change resets it. Both rooms remove controller UI boxes and keep native head tracking enabled during menus. Unit tests cover resource ownership, readable wrapping and anchor lifecycle. Desktop native-mesh previews verify rendering and selection; hardware comfort remains unverified.

## Planetarium modules

| File                                  | Responsibility                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| src/planetarium/content.js            | Names/order/learning notes, reference diameters, common base scale plus inner enlargement, seeded shuffle                                    |
| src/planetarium/quiz.js               | Pool of 30 authored sourced questions; seeded five-question selection and four shuffled options                                              |
| src/planetarium/state.js              | Explore → naming → naming-review → quiz → result; unique editable assignments, guarded submission/answers, score and celebration transitions |
| src/planetarium/audio.js              | Two local Web Audio clips, gesture unlock, cancellable channels and shared distance cadence                                                  |
| src/planetarium/layout.js             | Hall/footprints, safe viewpoints, substep collision                                                                                          |
| src/planetarium/materials.js          | Shared local maps, layered bodies/rings/clouds, spin and inspection-copy cleanup                                                             |
| src/planetarium/world.js              | A-Frame rig/rays, Three.js exhibits, hidden roaming menu and explicit activity panels, actual movement distance, cleanup                     |
| src/planetarium/ambience.js           | Single seeded upper-surface decorative fly-by schedule                                                                                       |
| src/planetarium/main.js and style.css | Equivalent DOM/VR actions, distinct naming/quiz/review views, settings and audio transition handling                                         |
| public/planetarium/credits.json       | Map sources/licenses, render/scale disclosure                                                                                                |

Original diameter = reference km / 1,391,400 × 20 m. Four inner diameters multiply by 12756/4879; Sun/outer bodies and rings retain the base scale. Spacing is arranged for a gallery. Equal-sized proxies are separate from body sizes. Inspection is allowed only during Explore and stays at the selected exhibit. Inner planets enlarge there to 1.1 m; outer planets retain their size. The original hides while inspecting and restores on close. inspectionPlacement supplies its position/radius; there is no central pedestal or automatic camera move.

Naming requires a focused planet before assigning an available name. An assignment releases its previous name and cannot steal another planet's name. Correctness is absent until all eight are submitted; review then freezes. Quiz uses five distinct pool IDs and four choices. Question-ID guards, confirmation and explicit Next reject stale/duplicate events; correctness is shown at the end. There are no adaptive retries or provider grading.

Audio reuses createFootsteps from the unchanged classroom audio module, but loads only Hooray and footstep. world.js reports collision-resolved distance; teleports report zero. main.js celebrates only perfect naming or quiz-completion transitions. Mute/blur/pause/departure cancel active and delayed playback. Classroom behavior remains unchanged.

Label maps are cached/pruned, body maps are shared and outgoing resources disposed. Pause/hidden/reduced/quiz suppress decoration. Desktop samples do not establish a Quest pass.

## UI layout

DOM menus group navigation, viewpoints, comfort/sound and collapsed help/selection. The classroom footer is a compact bottom-right Menu box; Planetarium has a matching viewpoint dock. Instructions moved into menu help. Empty progress/feedback/sound elements hide. VR menus use Main room instead of direct cross-room actions.

## Preserved classroom architecture

The classroom specification is [ROOM-DETECTIVE-PLAN.md](ROOM-DETECTIVE-PLAN.md). It implements a large walkable classroom with four random changes from 13 props. Classroom AI/quiz/reference photo remain future work; Planetarium has its own local multiple-choice quiz.

## Modules

| File                        | Responsibility                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| src/detective/state.js      | Authored props/homes; seeded four-object selection; round slots and destination history; reducer and findings                 |
| src/detective/placements.js | Compatible furniture/wall/floor/ceiling sampling, clearance, repeat avoidance and placement validation                        |
| src/detective/navigation.js | Shared room dimensions, desk/cupboard placements, obstacle bounds, safe viewpoints and substep movement                       |
| src/detective/world.js      | A-Frame room, 13 meshes, hover names, collision-aware camera rig, controller rays, hidden VR panel and return animations      |
| src/detective/audio.js      | Local Web Audio buffers, gesture unlock, channel cancellation, mute and distance-based single-thud cadence                    |
| scripts/extract-footstep.py | Reproducible 0.595–0.960 second trim with edge fades; requires numpy/soundfile                                                |
| src/detective/main.js       | Shared DOM/mesh action dispatch; generic goals; menu/accessibility controls; preferences, timers, audio and optional VR entry |
| src/detective/style.css     | Small HUD, full-scene exploration, responsive menu and immersive DOM suppression                                              |
| tests/detective.test.js     | Randomness/coverage, every return order, gating/reset, collisions and reachability                                            |

classroom.html loads this game. exploration.html preserves the earlier default; classic, computing and authoring remain separate routes. The eight-entry build copies local audio/vendor/planetarium/earth-explorer assets.

## Round ownership

Every prop has a unique authored home slot. A new cryptographic browser seed drives a reproducible shuffle and destination sampling; exactly four IDs become the moved set. Each receives a round-owned moved slot with random coordinates on a compatible surface. All home slots and prior sampled destinations are reserved with clearance. Rendering and dynamic collisions read state.slots rather than global destination constants.

Ordinary replay supplies another seed and preserves lastDestinations for every previously selected prop. Table/wall placements avoid the object's last surface; ceiling/floor placements avoid a 1.5 metre radius around its last destination. Ready receives the actual player position and resamples a conflicting dustbin destination before the change. No destination moves again during Find. Reload resets destination history. The chosen subset is not exposed in instructions, accessible labels or advance highlights.

The round follows INTRO → STUDY → CHANGE → FIND → COMPLETE. Study starts with the full baseline. Ready covers the environment and freezes movement/selection while applying the changed map. A correct guess immediately restores that ID's home slot and records it once. Completion requires four findings. Incorrect/duplicate actions never remove successful work or play the celebration again.

The reducer owns correctness. Rendering and audio respond to the returned state. main.js celebrates only when the found count increases, and starts the supplied opening sound on Play/replay. world.js reports actual collision-resolved travel distance per tick. audio.js plays one step each metre, clears cadence on a stop and cancels any pending playback. Mute stops all sources; returning focus permits fresh gestures to resume the AudioContext. All clips are local, with no provider call. Restart clears pending timers, generates a new case and resets the rig viewpoint. Progress stays in memory; only validated comfort settings persist.

## Rendering and navigation

One layout specification supplies furniture meshes and collision bounds. Movement projects the head/camera view onto the floor, normalizes diagonals and substeps translations to prevent tunneling. Wall margins and desks/chairs/cupboards/teacher desk are fixed obstacles; the current dustbin slot supplies a dynamic floor blocker.

Desktop supports WASD, arrow movement/turn, drag look and center-ray E selection. Named DOM buttons in an optional menu provide equivalent guesses for all props. Menu pause and blur clear keys; typing does not trigger movement. Stationary disables translation while allowing turn/look and safe viewpoint actions.

The VR rig uses the preserved xr-standard input reader. Left stick translates, right stick snaps around the tracked head, and either controller ray selects. B/Y opens/closes a head-relative panel; closed panel geometry is removed and cannot intercept rays. Head tracking remains active during a camera-attached cover. Actual Quest ergonomics and tracking offsets still require hardware checks.

Names appear only on hover. Found markers appear after a valid return. Fan blades rotate within a child group, so their visual rotation does not change the case's scored position. Reduced motion stops fan animation and returns items statically. Correct return interpolation lasts 450 ms; collisions use the authoritative destination immediately.

## Support and future API work

The current helper/menu contains navigation, comfort and all-object keyboard actions, not an answer shortlist. A future photo must freeze the round baseline and record supported practice when used. Future AI needs a separate reviewed server contract, server-side credentials, usage/access controls and local authored fallback. AI cannot pick changes, generate scores or modify a round. Quiz keys must derive from actual resolved observations.

See the [validation register](headset-smoke-check.md) for actual evidence and pending checks.
