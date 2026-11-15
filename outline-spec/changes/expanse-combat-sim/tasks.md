# Tasks

## 1. Project setup

- [x] 1.1 Scaffold a Vite + TypeScript app with Three.js and Vitest. Add `.superpowers/` to `.gitignore`. Verify that `npm run dev` serves a blank page and `npm test` runs an empty suite green.
- [x] 1.2 Create the simulation core as a module with no DOM or Three.js imports, plus a Web Worker entry that runs it. Verify with a lint/import check test that fails if the core imports `three` or touches `window`.
- [x] 1.3 Add a seeded RNG and a units/constants module (c, g = 9.80665, ship and weapon tables from the outline). Verify that the same seed yields the same sequence in a unit test.

## 2. Physics core

- [x] 2.1 Implement 3D vector/quaternion math and rigid-body state (position, velocity, attitude, angular velocity, mass, box inertia tensor). Verify with unit tests that coasting matches v·t within 1e-9 and constant thrust matches ½at² within 1e-6.
- [x] 2.2 Implement maneuvering-thruster torque with a max-torque limit, plus an attitude controller that rotates to a target heading. Verify that a 180° flip takes no less than the bang-bang minimum time for the body's inertia and torque.
- [x] 2.3 Implement the keel-only main drive with reaction-mass consumption at a set exhaust velocity. Verify that burning to empty matches the rocket equation, and that thrust is zero once mass is spent.
- [x] 2.4 Implement a fixed-step loop driven by a warp scheduler (steps per frame, capped by a CPU budget). Verify that identical seed and orders give identical event logs at ×1 and max warp.
- [x] 2.5 Implement swept collision between point masses and oriented boxes and between box pairs, recording impact time, relative velocity and energy. Verify that a 1,500 km/s slug crossing a 46 m box within one step is detected, at several step sizes.
- [x] 2.6 Implement firing impulses (recoil). Verify that the Roci's Δv after a shot equals −m·v/M along the keel.

## 3. Crew g-tolerance

- [x] 3.1 Implement g-dose accumulation (linear plus rotational acceleration at the crew position) and the hazard function. Verify the four calibration points in `crew-g-tolerance` › Lethality with unit tests.
- [x] 3.2 Implement crew death: drive cut, orders ignored, coasting, match-end event. Verify with a test that a crew killed mid-burn leaves the ship coasting.

## 4. Light-speed perception

- [x] 4.1 Record per-emitter state history and solve retarded time for any observer. Verify that a static emitter at 3 light-seconds is seen 3 s late, and a moving observer converges to the correct t_r.
- [x] 4.2 Implement flash events propagating at c, and per-observer delivery when a flash's sphere reaches the observer. Verify that a launch flash is delivered to an observer 1.5M km away exactly 5.0 s after launch.
- [x] 4.3 Implement the observer view API (ships, torpedoes and flashes only; never clouds or coasting slugs). Verify with an information-leak test that AI, guidance and fire-control inputs contain only retarded data.
- [x] 4.4 Implement maneuver sampling (0–3 burns with rotation time, plus continue and coast samples) and survival weighting from observed dose. Verify that cloud size grows like ½at² and lethal plans weigh near zero.
- [x] 4.5 Implement precomputed body-frame displacement tables per class, plus the rotate-and-translate query. Verify against direct simulation of the same samples: agreement within the target's length at 1 s, 60 s and 1,000 s horizons.
- [ ] 4.6 Benchmark predictions in the worker for 8 in-flight torpedoes plus both ships. Verify that per-step cost fits the frame budget at the max warp level, and record the numbers in the change notes.

## 5. Weapons

- [x] 5.1 Implement the railgun: keel-only, 2 kg at 1,500 km/s, 6 s cooldown, recoil, swept slug. Verify that a shot waits for keel alignment and for the cooldown.
- [x] 5.2 Implement torpedoes: 150 g drive, 500 km/s Δv, tubes with reload, magazine count, guidance on their own observations and prediction cloud, coasting when dry. Verify that a torpedo intercepts a non-maneuvering target, and coasts after exhausting its fuel.
- [x] 5.3 Implement PDC clouds: N rounds from burst duration × rate, ballistic centroid, growth from dispersion and burst length, finite ammo per mount. Verify that density at 2× distance is about ¼.
- [x] 5.4 Implement cloud crossing: column density along the relative path × silhouette area, then a Poisson draw. Verify that the broadside/nose-on expected-hit ratio equals the silhouette ratio, and that the hit rate over many seeded trials matches the mean.
- [x] 5.5 Implement automatic point defense that aims bursts at incoming torpedoes' prediction clouds. Verify in a scenario test that a single non-evading torpedo is usually killed before impact.
- [x] 5.6 Apply any-hit-kills and friendly fire. Verify that the Roci's own slug destroys its own torpedo in a scripted geometry test.

## 6. Command and AI

- [x] 6.1 Implement the player autopilot: direction intent and g allowance, rotate then burn, never over the allowance. Verify that a reverse-course order flips and decelerates without exceeding the allowance.
- [x] 6.2 Implement weapon orders (railgun at an aim point, torpedo at a contact, offensive PDC burst) with refusal reasons. Verify that an empty-magazine order is refused with a reason.
- [x] 6.3 Implement the destroyer AI: keep range, size salvos to swamp PDCs, evade predicted railgun lines, same dose limits. Verify in a headless match that the AI only reads its observer view and launches salvos of more than one torpedo.
- [x] 6.4 Implement time-warp drops on arriving flashes and on low torpedo time-to-impact, plus pause with order queueing. Verify with a test that a launch flash arriving at ×100 sets warp to ×1.

## 7. Match flow

- [x] 7.1 Implement match setup with the outline's book-derived stats and a 1–3M km start, and end conditions (hit, crew death, mutual kill, draw). Verify each end condition with a scripted scenario.
- [ ] 7.2 Tune default start velocities and warp levels so headless AI-vs-autopilot matches typically finish in 5–10 real minutes. Record the measured spread.
- [x] 7.3 Record seed and orders, and rebuild the match for the truth replay. Verify that the replayed event log equals the live one.

## 8. Tactical display

- [x] 8.1 Build the Three.js scene with camera-relative rendering, an orbit/zoom camera, the grid plane and drop lines. Verify by zooming from 3M km to 100 m on a ship with no visible jitter.
- [x] 8.2 Draw contacts as markers far away and true-size blocks close up, with ghost age labels from the player's observer view only. Verify that the label matches the light delay in a test scene.
- [x] 8.3 Render prediction clouds as true-scale 3D density, the arrival-time cloud while aiming, and own PDC clouds. Verify that the cloud is sub-pixel at map zoom and resolves on zoom, matching `designs/tactical-view.html`.
- [x] 8.4 Draw light rings (one per light-second, labelled) and the highlighted burn/shot ring with a countdown to the enemy's last known position. Verify that the countdown matches distance/c.
- [x] 8.5 Build the HUD and controls (g allowance, direction, weapon orders, warp, pause) per the design. Verify by playing a match end to end in the browser.
- [x] 8.6 Build the truth replay view with timeline scrubbing, true positions, each side's ghosts and aimed-at clouds. Verify by scrubbing to a railgun shot and seeing truth, ghost and cloud together.

## 9. Archive

- [ ] 9.1 Run `outline-spec validate expanse-combat-sim`, then `outline-spec archive expanse-combat-sim` to apply outline.md to the live specs
