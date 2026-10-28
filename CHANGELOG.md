# Changelog

## Website publication — 28 October 2026

- Added GitHub Pages publication of the latest three-room build, with formatting/tests/build gates and manual re-deployment.
- Added the playable website link to the README and deployment documentation. The old Sites project could not be accessed, so its original URL remains unchanged.

## Repository preparation — 15 October 2026

- Prepared the public `Abhinashroy/discovery-rooms-vr` repository.
- Formatted maintained source and documentation; added Prettier configuration, line-ending rules, contributor guidance and GitHub Actions checks.
- Added a portable README, current screenshots and third-party license notices.
- Removed unused/duplicate files and temporary download/bytecode caches. Excluded historical packages, local tools, backup copies, learner data and credentials from source control.
- Updated the vulnerable transitive `source-map-js` dependency to a compatible patched version; npm audit reports no known vulnerabilities at this checkpoint.

## 0.23.0 — Earth expansion

- Larger traveller relative to the globe; all 195 country cards with sourced facts and validated landings.
- Search aliases, tiny-country locator rings, paginated Quest destinations and transcontinental quiz handling.
- Supplied footsteps/completion Hooray, collapsible shared clock and decorative stars/comets.

## 0.22.0 — Earth Explorer

- Added Orbit Observatory and Globe Explorer, shared calendar/time, spherical travel, initial country cards and five-question quiz.
- Added the third room to the selector; preserved Classroom and Planetarium.

## 0.21.0 — Menus and local inspection

- Added Main room return, grouped controls, compact corner docks and empty-status hiding.
- Planet inspection stays at its exhibit without moving the player.

## 0.20.0 — Planet naming and quiz

- Enlarged inner planets for visibility; added planet-first name assignment, submission review, five-of-30 quiz and supplied sounds.

## 0.19.0 — Planetarium

- Added the cosmos observatory, textured Sun/planets/rings, exhibits and room selector.

## 0.15.0 — Classroom baseline

- Accepted Classroom Detective: large room, four randomly moved objects, collision-aware movement, fan and supplied sounds.

Earlier memory-locus, computing and treasure-room prototypes remain as legacy routes and regression tests. Their old proposals and build packages are not the current product specification.
