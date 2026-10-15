# Classroom Detective — active plan R5

14 October 2026 · classroom baseline 0.15.0, preserved in Discovery Rooms 0.23.0. This document is the classroom specification. The owner considers this room ready. The separate [Planetarium Rescue plan](PLANETARIUM-RESCUE-PLAN.md) specifies the implemented Room 2. [Earth Explorer](EARTH-EXPLORER-CONCEPT.md) is Room 3; both are reached from the selector. Classroom menu wiring adds Main room return and grouped controls; the bottom Menu dock is a compact rounded corner box; its case, random placements, controls and sound behavior stay as specified here.

## Purpose and scope

Explore one classroom, remember its arrangement, then identify four objects that moved. The activity practices observation and object–location memory. It has no required timer, lives, side quests, inventory or collection task. General cognitive improvements and assessment validity are not established.

Audience: ages 10–15, with full desktop play and optional VR. Actual device age/use requirements and supervised learner arrangements must be checked before child headset sessions.

The enclosed room measures approximately 16 × 14 metres with a 5.2 metre ceiling. It has six student desks/chairs, a teacher desk, six cupboards, chalkboard/tray, windows, door, hooks and ceiling lights. An open central aisle and side routes provide exploration space.

## Round content

Each new round chooses exactly four different props from the complete pool:

Chalk, board eraser, school bag, water bottle, books, globe, ruler, pencil box, potted plant, dustbin, wall clock, ceiling fan and class poster.

The four selected IDs remain stable until replay/restart. No advance instruction, highlight, object list or hint identifies that subset. Selection is seeded for reproducible tests, with a fresh random seed for ordinary play. The optional accessibility list names all 13 props only, without original locations or selected changes.

Each prop has an authored original placement. Selected props receive random coordinates on compatible classroom surfaces; no prop has one fixed moved location. All original slots are reserved, and sampled destinations have clearance from every prop and other destination. An identified prop can return immediately without moving another object. The dustbin avoids furniture, preset viewpoints and the player's location at Ready. The fan remains ceiling-mounted and avoids the lights.

Replay remembers each object's last destination, even through rounds where it was not selected. Supplies and wall objects use another surface/area next time; floor and ceiling destinations are at least 1.5 metres from the last destination. This history lasts for the current page session. Reload starts a fresh session.

| Prop       | Original placement    | Possible moved placement                  |
| ---------- | --------------------- | ----------------------------------------- |
| Chalk      | Board tray, left      | Random desk/cupboard/teacher-desk surface |
| Eraser     | Board tray, right     | Random desk/cupboard/teacher-desk surface |
| Bag        | Right wall hook       | Random desk/cupboard/teacher-desk surface |
| Bottle     | Left back desk        | Random desk/cupboard/teacher-desk surface |
| Books      | Left middle desk      | Random desk/cupboard/teacher-desk surface |
| Globe      | Left front desk       | Random desk/cupboard/teacher-desk surface |
| Ruler      | Left middle cupboard  | Random desk/cupboard/teacher-desk surface |
| Pencil box | Right middle cupboard | Random desk/cupboard/teacher-desk surface |
| Plant      | Left front cupboard   | Random desk/cupboard/teacher-desk surface |
| Dustbin    | Left aisle            | Random clear floor coordinates            |
| Clock      | Front wall, left      | Random coordinates in a clear wall area   |
| Fan        | Front ceiling mount   | Random clear ceiling coordinates          |
| Poster     | Back wall, left       | Random coordinates in a clear wall area   |

Walls, windows and structural furniture are fixed context; the 13 props above are the selectable case objects. Future props need the same definition/render/input contract, compatible random surfaces and coverage tests. Do not secretly exclude a modeled case prop from random selection.

## Player journey

1. Play shows the generic goal: explore, remember, then find four things that move.
2. Study allows untimed roaming. Point/focus reveals only an object's name; selecting it describes its current place. Nothing identifies whether it will change.
3. Ready covers the room briefly, pauses movement/guesses and applies the four changes. The player's position and head tracking are preserved.
4. Find accepts direct clicks, controller triggers, E selection ahead or optional keyboard buttons. A correct item returns home, shows a check mark and plays Hooray. An unchanged guess retains all progress.
5. Four successful returns complete the case. Repeated clicks cannot award or celebrate twice.
6. Play again/restart creates a fresh study phase, baseline and random selection. Old findings, attempts and pending transitions are cleared.

## Movement and controls

Desktop: WASD and Up/Down move relative to viewing direction. Mouse drag looks; Left/Right turn. E selects straight ahead. M/Escape opens/closes controls. Keyboard shortcuts work when buttons have focus, but not while typing or with the menu open.

Movement uses substeps and shared collision geometry for desks, chairs, cupboards, teacher desk, room walls and the dustbin's current location. Diagonal speed is normalized. Blur/controller loss clears movement. Rendered furniture and collision records must agree.

Menu pauses walking and exposes front/middle/back safe viewpoints, stationary play, reduced motion, larger text and an optional list of all objects. The list neither preselects nor focuses a moved item. Stationary mode disables translation while retaining look/turn and keyboard guesses.

VR code uses a rig with head tracking, left-stick movement, right-stick 30-degree snap turns and either controller ray. B/Y or a small controller Menu target toggles the panel. The panel starts hidden and cannot intercept rays when closed. Ready/replay, viewpoints, sound, stationary mode and Exit VR must be reachable inside immersion. Actual Quest 3 control, comfort and performance checks remain required.

## Presentation and feedback

Use recognizable silhouettes and sparse classroom decoration. Case names appear on hover, not as permanent labels on every item. Found check marks appear only after correct selection. The HUD gives the generic current goal and total returned count, without listing possible answers. It should remain small enough to leave exploration visible.

The fan rotates slowly regardless of whether it changes location, and stops under reduced motion. Fan rotation is scenery behavior, not a scored change. A move is defined by original versus changed slot, including an appropriate orientation for its mount.

Play/replay uses the supplied start.mp3; a newly correct return uses Hooray.m4a. Footsteps use a single extracted 0.365 second thud from walk sound.mp3 with short edge fades, repeated each metre of actual travel (about 0.5 seconds at full speed). Walking audio stops on release, blockage, pause, stationary mode, blur or mute. No full four-thud loop is played. Mute silences all clips. Wrong, study and duplicate clicks never celebrate. A playback failure never prevents success. Correct returns use a short animation or a static placement under reduced motion.

## Feature and acceptance register

| Feature                 | Acceptance                                                                               | State                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Larger classroom        | Open routes; furniture collision matches meshes                                          | Implemented; browser walkthrough                       |
| Random four of 13       | Four distinct changes, all props eligible, stable within round                           | Automated coverage passed                              |
| Random destinations     | Safe surface coordinates, varied books/fan positions, no repeat of last surface/location | Automated checks passed; browser return journey passed |
| No advance clues        | Generic instructions; hidden chosen subset; all-object list only on request              | Implemented; browser inspected                         |
| Immediate safe return   | Every one of 24 return orders preserves unique positions                                 | Automated checks passed                                |
| Keyboard/mouse movement | Real browser input changes position and orientation                                      | Browser W/turn checks passed                           |
| Pause/menu              | Movement stops; open/close restores play                                                 | Browser checked                                        |
| Stationary viewpoints   | Safe landing, no physical walking required; turn remains usable                          | Implemented; further usability pending                 |
| Sound/mute/replay       | Once per new finding; fresh round restores baseline                                      | Implemented; browser checks                            |
| VR mapping/menu         | Same game actions and hidden-by-default panel                                            | Code present; headset checks pending                   |
| Photo/help              | Reference must match immutable baseline; support preserves progress                      | Future work                                            |
| AI/quiz                 | Optional requested support, local scoring, server-side key                               | Future work                                            |

## Making procedure from this checkpoint

1. Finish recorded desktop verification for direct selection, collisions, replay, generic instructions, stationary controls and all four returns. Fix concrete failures.
2. Check a new player can explain the goal and explore without being told individual controls. Observe difficulty and boredom; adjust presentation before adding more rules.
3. Verify actual Quest 3 entry/exit, both rays, thumbsticks, B/Y, hidden panel targets, complete random rounds, readable ceiling/wall objects and motion comfort. Use the existing validation document.
4. Add on-demand reference photo/help and any further accessibility work only after the roaming game is understandable. Never reveal which four will change during Study.
5. Add optional bounded AI and a requested quiz later. The game owns answers, disclosed hints and scoring; a provider reply cannot change a round. Authored help survives absent credentials/network failures.
6. Pilot with supervised learners and record anonymous obstacles/fixes. Publishing needs those release checks and restored access to the original Site. No current release or effectiveness claim follows from code tests alone.

The old fixed four-item and six-object clubhouse designs are superseded. Earlier applications remain preserved routes, not competing specifications. Read PROJECT_STATUS.md for actual evidence and remaining checks.
