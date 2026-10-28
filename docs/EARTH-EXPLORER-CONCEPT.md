# Earth Explorer — Room 3 specification and implementation

Revision R4 · 28 October 2026 · **Implemented in local checkpoint 0.24.0; actual Quest and learner validation pending.**

This is the active specification for Earth Explorer, Room 3. The owner expanded the initial 12-country version to all 195 countries, a larger traveller, supplied movement/completion sounds, a compact shared clock and a decorative star/comet sky. Classroom and Planetarium remain separate preserved rooms.

## Current checkpoint

All 195 learning countries have distinct authored facts, per-card source links and polygon-interior destinations. The scope is 193 UN member states plus Holy See and Palestine; other mapped territories retain names. Natural Earth v5.1.2 50m supplies 242 map features, including the small countries. Native country destinations paginate ten per page. A gold ring locates tiny countries without enlarging their borders.

Globe radius is 10 m with a 1.5 m lift on desktop only, giving the desktop traveller about 2.86 times the previous size relative to Earth. Desktop travel is 2.5 m/s. Quest uses its natural tracked eye height with no artificial lift, 1.8 m faded steps or point teleport, and no forced headset roll. All actual-device comfort/performance acceptance remains open.

The shared UTC clock minimizes to a date/time button and expands in either mode. Globe time stays paused while walking; date/hour changes still update illumination. A 2,400-point star field is visible in both modes. A single occasional distant comet is decorative, unrelated to the date/time model, and stops during menus, quizzes, reduced motion and hidden tabs.

Existing footstep.wav supplies one thud per travelled metre; short Quest steps get one thud, long teleports none. Existing Hooray.m4a plays once after a completed quiz at any score. Mute/menu/blur/hidden/departure cancel audio. No ambient soundtrack or live AI is added.

109 automated checks pass and eight production entries build. Project status records browser journeys and pending hardware/learner checks. Run npm test, npm run build and npm run dev; choose Earth Explorer at the printed URL. After five cards, Country quiz starts five questions. Quest setup is in deployment.md.

## 1. Core idea

**See how Earth moves, then explore the places on it.**

Ages 10–15. One space-themed learning experience, with only three celestial bodies: Sun, Earth and Moon. Two named views share the same simulation and explored-country collection:

- **Orbit Observatory:** watch Earth rotate and orbit the Sun, and the Moon orbit Earth. Change date/time and see sunlight move.
- **Globe Explorer:** become a giant traveller on a miniature spherical Earth, crossing large geographic distances in a few virtual steps. Discover countries and their locations, then take an optional quiz.

This is an abstract educational globe, not realistic street-level travel. Keep the curved globe visibly recognisable. There are no separate country rooms. Native VR menus stay in world space while the player looks around; B/Y closes/reopens them at the current view. Right trigger on land opens country information, left trigger teleports, and Controller Help explains these actions. Both views belong to one game entry on the existing Main room selector.

## 2. Player journey

1. Main room → Earth Explorer → short choice between the two modes.
2. Orbit Observatory opens paused with Earth, Sun, Moon and the date/time controls visible.
3. Move the year/day controls, or press Play, to inspect motion and day/night.
4. Select Earth countries from the distant view, or use **Countries → Visit** for a precise country destination. **Explore here** switches to the last/default globe location; a country card's **Visit this country** lands at that country.
5. A short fade opens Globe Explorer at that geographic location. The selected date/time is retained, and time pauses.
6. Move across the globe, reveal nearby country labels and open country cards.
7. After opening five different country cards, the optional **Country quiz** becomes available.
8. Answer five questions, see score/corrections, and revisit countries from the review.
9. **Orbit Observatory** returns to the distant view with the same date/time and selected location. **Main room** ends this run and returns to room selection.

Exploration is open-ended; the quiz is a deliberate choice. Opening a card records an explored country, not proof that the learner understood or memorised it.

## 3. Orbit Observatory

### Environment and camera

A calm observatory viewpoint in space shows a luminous Sun, textured Earth with an atmosphere, and textured Moon. Add optional orbit paths, Earth-axis marker and sunlight arrows. Keep overlays individually switchable. Country borders/labels belong to geography exploration, rather than covering the entire distant globe.

Desktop: drag to orbit the model, zoom within useful limits, and choose System view or Earth close view. Quest: stationary observation with natural head tracking and deliberate preset-view changes; avoid automatic camera flights. The Moon and Earth remain selectable targets even when their rendered meshes are small.

### Calendar / year bar

- Choose a calendar year; show the correct 365 or 366 dates for that year.
- A compact timeline displays month markers, selected date and day number, such as Day 120 / 365.
- Scrubbing pauses playback and updates the shared simulation timestamp.
- Include Play/Pause, step backward/forward one day and a small speed control.
- Common and leap years have different date counts, including 29 February when applicable.
- Leap years change the calendar; do not force an orbit to take exactly 365 days in one year and 366 in another. Gregorian dates map to continuous elapsed time.
- Preserve the selected hour while changing the date. Moving past midnight advances the date; crossing the year boundary updates the calendar.

### 24-hour bar

- Label the clock **UTC simulation time**, with a clear 00:00–24:00 scale and readable hour value.
- Changing it advances time within the selected day and updates Earth orientation, sunlight and Moon position consistently.
- 24:00 means 00:00 on the next date; it is not a second independent midnight.
- A selected place can show Day / Night / Near sunrise or sunset, derived from sunlight at that position. Do not show an invented country-wide local clock: countries can span time zones.
- Sunrise is not hardcoded to 06:00 and sunset to 18:00 everywhere.
- Use one clock for both sliders. They must not independently spin Earth into contradictory states.

### Scientific model

Build a coherent teaching model with Earth rotation, a slightly elliptical annual path, an axis tilted about 23.4 degrees that retains its direction during the orbit, and an inclined lunar orbit. Day/night comes from Earth turning relative to sunlight. Seasonal illumination comes from tilt, not a claim that summer is simply being nearer the Sun.

Use a 24-hour mean solar day for the learning control. Sidereal rotation relative to distant stars is about 23 h 56 min, so Earth orientation must also account for its changing direction to the Sun. A constant 360-degree spin per solar day in a fixed star frame would drift against the intended sunlight clock.

The Moon completes an orbit in about 27.3 days; its phase cycle is about 29.5 days. Phase appearance should come from lighting/relative positions, not an unrelated animation. Ordinary phases are not Earth's shadow.

Bodies, orbital distances and travel scale are adjusted for visibility and explicitly labelled. This teaching model is not a live ephemeris or a predictor of exact sunrise/eclipse events. Earth and Moon motion must still agree with the selected elapsed time. Detailed eclipse prediction is a later improvement.

## 4. Globe Explorer

### Appearance and scale

The player stands on a smooth spherical learning surface following Earth. Current prototype radius: 10 virtual metres with the raised traveller eye; tune comfort after actual Quest tests. Continents retain geographic shapes; major countries span a few steps. These dimensions are prototype values, not real Earth scale.

Show coastlines, thin country outlines, oceans and restrained terrain shading. Keep curvature visible and provide a small globe overview showing the current location. Large-scale geographic travel is intentional. The learning surface can cross oceans; it is not survival or swimming gameplay.

Time is paused on entry so the globe does not move the player while reading or travelling. Changing mode preserves the clock. A **Map light** option can brighten geography overlays at night without moving the Sun or silently changing the date/time. Country labels and interaction highlights must remain readable in darkness.

### Movement and VR decision

- Desktop: WASD follows the curved surface; mouse look; click or E selects a nearby country.
- Quest default: point-and-teleport or short virtual steps with a fade, plus snap turning. Physical walking is not required.
- Prototype optional thumbstick globe travel, but do not promise comfort before hardware testing.
- Following a small sphere's local vertical can pitch/roll the camera substantially. Do not copy flat-room movement and then rotate the tracked headset unexpectedly. Prototype surface travel first, with an upright landing view and user-controlled transitions.
- Use fades between modes and long jumps. Preserve the user's real head tracking.
- Provide continent/country destination controls, seated play, keyboard equivalents, larger text and reduced motion.

### Labels and selection

Show at most three nearby country labels, depth-occluded by the globe. The mini-globe readout shows the country underfoot; Quest uses nearby country labels and a fixed menu; controller-mounted boxes are removed. Selecting a country highlights its shape. Label overlap/readability still needs actual-headset review.

Tiny countries and islands need a selectable label and searchable country list. Preserve their geographic shape rather than enlarging their land area to make them clickable. All learning-enabled countries must be reachable without precision pointing.

Open only one country card at a time:

1. Country name.
2. Continent, with the game's geographic convention clearly stated.
3. One concise memorable fact, ideally a natural feature, landmark or cultural/scientific connection.
4. Revisit / Close actions.

A small illustration can accompany the fact. Do not add capitals, population, flags, currencies and many statistics to every initial card. Facts are authored and sourced before entering the quiz. Avoid unstable superlatives, stereotypes and ambiguous fact questions.

## 5. Geographic coverage and conventions

Render the whole globe with **195 learning-enabled countries**: 193 UN members plus Holy See and Palestine. Country data and facts live in src/earth-explorer/data/facts-{a,b,c}.json; scripts/build-country-catalog.mjs merges them into catalog.json, checks unique ISO codes/facts and verifies every landing inside the bundled polygon. Country shape/name data is Natural Earth v5.1.2 50m, 242 features. Other mapped territories retain names but are not counted as extra countries in the learning collection.

Use geographical world-region labels: Africa, Asia, Europe, North America, South America and Oceania. Oceania includes Australia and Pacific island countries; it is a region rather than a continent. Russia, Turkey and Kazakhstan have Europe / Asia labels and paired-continent questions, avoiding grading a single-continent answer for them. Antarctica is visible but is not a country answer. No quiz tests disputed borders or recognition.

Each card shows one distinct, concise memory fact and its exact supporting source. Sources include UNESCO, government/tourism agencies, museums, research and encyclopedia references. Facts are original summaries, not copied source paragraphs. Shape release, boundary policy, fact sources, texture licenses and hashes are in public/earth-explorer/credits.json. The map remains generalised; searchable destinations and locator rings support tiny countries without changing their land area.

## 6. Country quiz

### Eligibility and contents

A compact **Country quiz** menu action is always discoverable. Before five distinct country cards are opened, explain how many more to explore. Once eligible, generate a five-question round only from opened cards and their frozen fact versions.

Proposed mix:

- **2 location questions:** highlight a country on an overview globe; ask which country is outlined, with four country-name choices. Hide its label and fact card while answering.
- **2 continent questions:** ask which continent a named explored country belongs to, with four choices. Hide continent names/answer-bearing colour keys during the prompt.
- **1 fact question:** ask which explored country matches a fact previously shown, with four country choices.

Do not ask about a fact the player has not opened. Distractors must be plausible, distinct and reviewed so exactly one option is correct under the declared convention. Randomness varies questions/options; it does not generate factual content or grading.

### Interaction and review

Choose → Confirm → Next. Confirmed answers lock; delayed/repeated clicks cannot answer another question. Pause simulation during the quiz. Users may leave an unfinished quiz without it being presented as a completed score; warn only when discarding actual answers.

At completion show score out of five and each answer/correction. A **Show on globe** action highlights the relevant country and reopens its learning card after the quiz. Explanations use the same authored fact record that was tested. An explicit Help action, if later added, must mark that response as assisted rather than secretly preserving an independent score.

## 7. Interface and integration

- Earth Explorer is the third card in Main room.
- Compact corner controls: Mode, Country quiz and Menu. Open the two sliders only in Orbit Observatory's time panel; do not turn the full screen into a permanent settings overlay.
- Menu groups: Continue, switch mode, time/view controls, comfort and Main room.
- Desktop and VR share the same actions and clock/state.
- Switching views retains the current visit, clock and explored countries. Leaving for Main room resets the room's run, consistent with the existing project.
- Keep Classroom Detective and Planetarium Rescue functioning as their existing separate experiences.
- The base room works offline from local assets/content after loading. Live AI is not required for the authored facts or quiz. Audio uses the existing footstep and Hooray recordings as specified in the current checkpoint.

## 8. Making procedure and acceptance stages

Engineering for all stages is present in 0.22.0. The device/learner portions of acceptance remain pending and must be recorded before calling these stages fully validated.

| Stage                   | Work                                                                                    | Acceptance                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| E0: movement prototype  | Bare sphere, landing transitions, desktop surface travel and Quest teleport/step travel | Remain on surface, predictable upright landings, no forced headset roll; actual Quest observations before committing to smooth travel |
| E1: orbit and clock     | Sun/Earth/Moon, lighting, shared timestamp, date/year/time controls                     | Leap-date transitions correct; both controls agree; day/night and lunar geometry follow timestamp; pause/scrub work                   |
| E2: connected views     | Orbit Observatory ↔ Globe Explorer, selection/landing mapping                           | Selected geographic location and date/time persist; no automatic world spin in Explorer; safe reversible transitions                  |
| E3: geography           | Country polygons/labels, 195 authored cards, accessible navigation                      | Labels align to land shapes; no far-side/overlapping labels; all countries reachable; facts/source/convention reviewed                |
| E4: quiz                | Eligibility, explored-only questions, four options, answer locking and review           | All three prompt types appear; no answer labels leak; one valid key; score accurate; unfinished attempt distinct from completion      |
| E5: release integration | Main room card/menu, cleanup, asset attribution, responsive UI and device checks        | Existing two rooms still work; departure resets/stops work; keyboard/mouse and actual Quest journey recorded                          |

Engineering checks should cover calendar boundaries, clock-to-lighting consistency, orbit/phase invariants, coordinate transforms, spherical movement, country picking, quiz keys/eligibility and navigation cleanup. Browser tests cannot establish headset comfort or learning benefit. A supervised unfamiliar-player walkthrough should check whether children understand the two modes and remember the intended content.

### Implemented files

| File                                     | Responsibility                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| earth.html                               | Earth entry, compact controls, country cards, time controls and quiz/review                       |
| src/earth-explorer/astronomy.js          | Continuous UTC timestamp, Gregorian calendar, tilted Earth and approximate orbital/lunar geometry |
| src/earth-explorer/geography.js          | Globe coordinates, surface frames, great-circle travel, polygon picking including holes/dateline  |
| src/earth-explorer/countries.js          | 195 authored country/region/fact/source records                                                   |
| src/earth-explorer/state.js              | Connected modes, visits, clock actions, guarded quiz and retained completed review                |
| src/earth-explorer/world.js              | A-Frame/Three bodies, borders/highlights, spherical travel, rays, native VR menus and cleanup     |
| src/earth-explorer/main.js and style.css | Shared actions, fades, DOM panels, mini-globe, display preferences and responsive layout          |
| tests/earth-explorer.test.js             | Eleven deterministic acceptance checks                                                            |
| scripts/fetch-earth-assets.py            | Reproducible pinned map and Moon asset acquisition                                                |
| public/earth-explorer/                   | Local country geometry, Moon texture and full source/license manifest                             |

## 9. Scope boundaries and later improvements

First implementation includes the two views, three bodies, shared date/time, globe traversal, country learning and country quiz. Additional facts per country, exact civil time zones, population/statistics feeds, advanced eclipse lessons, detailed terrain/cities and AI conversation are later improvements. No claim of perfect astronomical prediction or proven memory improvement is made.

## 10. Reference basis

- [NASA Earth facts](https://science.nasa.gov/earth/facts/): rotation/orbit, tilt and seasonal illumination.
- [NASA seasons explanation](https://spaceplace.nasa.gov/seasons/en/): non-circular orbit and the role of tilt.
- [NASA reference systems](https://science.nasa.gov/learn/basics-of-space-flight/chapter2-1/): solar versus sidereal day.
- [NASA Moon phases](https://science.nasa.gov/moon/moon-phases/): orbit and phase-cycle distinction.
- [US Naval Observatory leap-year rule](https://aa.usno.navy.mil/faq/leap_years): Gregorian calendar and leap dates.
- [Natural Earth](https://www.naturalearthdata.com/about/): map data, public-domain terms and boundary policy.
- [UN M49](https://unstats.un.org/unsd/methodology/M49): geographic identifiers/regions, distinct from a school continent convention.
