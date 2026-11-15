# Outline

## Proposal
Build a browser game where the player captains the Rocinante against an AI torpedo destroyer in open 3D space. Every object is physically simulated, every observer sees only light-delayed information, and all numbers come from the novels (agreed design: `docs/superpowers/specs/2026-11-06-expanse-combat-sim-design.md`).

## Requirements
1. physics-core: Simulates every object in the arena with Newtonian mechanics, so all motion, rotation and collision come from physics, not scripting.
  a. Mechanics: All objects move in three dimensions under Newtonian mechanics in SI units, in one inertial frame with no gravity.
    a. The frame's origin is the two ships' initial center of mass.
    b. Positions and velocities keep at least 64-bit floating point precision.
    c. Relativistic mechanics is ignored, because the fastest object (a slug at 0.5% c) differs from Newtonian by about 10⁻⁵.
    d. A coasting object's displacement over time t equals v·t within 1e-9 relative error.
  b. Rigid bodies: Ships and torpedoes are rigid bodies with mass, a box-shaped inertia tensor, a main drive along the keel, and maneuvering thrusters with finite torque.
    a. The main drive accelerates a body only along its keel axis.
    b. A body changes heading only under applied torque, so a 180° flip takes at least the time its maximum torque and moment of inertia allow.
    c. A body changes velocity only under thrust or an impulse.
  c. Reaction mass: Each drive spends reaction mass at its exhaust velocity, and the body's mass falls as it does.
    a. Total velocity change matches the rocket equation for the exhaust velocity and mass ratio.
    b. A drive with no reaction mass left produces no thrust.
  d. Momentum on firing: Firing any projectile applies an equal and opposite impulse to the firing body.
  e. Continuous collision: Collisions between projectiles, torpedoes and ships are found along each object's full swept path, so no speed or step size lets an object pass through another.
    a. A 1,500 km/s slug crossing a 46 m ship within a single step registers a hit.
  f. Determinism: Given a seed and a timestamped log of orders, the simulation produces the same fight every time on the same machine.
    a. The simulation advances in fixed game-time steps.
    b. Time warp changes only how many steps run per real second, never the step size.
    c. When the machine can't sustain the requested warp, the warp is capped instead.
    d. The same seed and orders give identical events at ×1 and at maximum warp.
  g. Impact record: Every collision records the relative velocity and kinetic energy of the impact.
2. crew-g-tolerance: Makes acceleration a life-or-death choice by tracking each crew's accumulated g-dose, calibrated to the juiced tolerances in the novels.
  a. G-dose: Each crewed ship accumulates g-dose from the acceleration its crew feels, including acceleration from rotation.
    a. The juice is assumed active at all times and is not modeled separately.
  b. Lethality: The chance of crew death rises steeply above about 5 g and with duration.
    a. A crew at 3 g for 1 hour survives with probability above 99%.
    b. A crew at 10 g for 1 minute survives with probability above 95%.
    c. A crew at 10 g for 5 minutes dies with probability above 50%.
    d. A crew at 20 g for 30 seconds dies with probability above 50%.
  c. Crew death: When a crew dies, its ship cuts its drive, stops following orders, and coasts.
3. weapons: The railgun, torpedoes and PDCs are physically simulated, use values derived from the novels, and kill with any hit.
  a. Any hit kills: Any projectile, torpedo or PDC round that strikes a ship or torpedo destroys it.
    a. Friendly fire applies, so a side's own slugs and PDC clouds can destroy its own ship and torpedoes.
  b. Railgun: The Rocinante carries one keel-mounted railgun that fires a 2 kg slug at 1,500 km/s relative to the ship.
    a. The gun fires only along the keel, so the ship must rotate to aim.
    b. The gun fires at most once every 6 seconds.
    c. Each shot recoils the Rocinante (see `physics-core` Momentum on firing).
    d. A slug is a point mass that coasts until it hits something.
  c. Torpedoes: Torpedoes are uncrewed rigid bodies with about a 150 g drive and about 500 km/s of Δv.
    a. A torpedo has no g limit, only its fuel.
    b. A launched torpedo starts with its ship's position and velocity, uses one round from the magazine, and holds its tube until the tube reloads.
    c. A torpedo steers using only what it observes from its own position (see `light-speed-perception`).
    d. A torpedo that has spent its fuel coasts without steering.
  d. PDC clouds: Each PDC burst becomes one cloud of rounds that moves ballistically and grows as it travels.
    a. Rounds weigh about 25 g, leave at 5 km/s plus the shooter's velocity, and fire at about 4,000 rounds per minute per mount.
    b. A cloud's width grows with its angular dispersion times the distance travelled, and its length reflects the burst's duration.
    c. A cloud that has travelled twice as far has about one quarter the peak density.
    d. Clouds never expire.
    e. Each mount has finite ammunition, and an empty mount can't fire.
  e. PDC hits: An object crossing a cloud takes a random number of hits whose mean is the cloud's rounds per m² along the crossing path times the object's silhouette area.
    a. The crossing path and silhouette are taken relative to the cloud's motion, so orientation matters.
    b. A ship crossing broadside expects more hits than nose-on, by the ratio of the two silhouette areas.
    c. The hit count is drawn from a Poisson distribution using the seeded random generator.
  f. Point defense: PDCs automatically fire at incoming torpedoes, aiming at each torpedo's prediction cloud.
    a. The player can also order offensive PDC bursts (see `player-command`).
  g. Loadouts: Each ship starts with this armament.
    | id | Ship | Railguns | PDC mounts | Torpedo tubes | Torpedo magazine |
    |---|---|---|---|---|---|
    | rocinante | Rocinante | 1 | 6 | 2 | 20 |
    | destroyer | Destroyer | 0 | 10 | 8 | 40 |
4. light-speed-perception: Makes the speed of light the central mechanic, so every observer sees only delayed information and predicts the present from simulation.
  a. Delayed observation: Each observer sees each other object only as it was when its light left, at the speed of light, 299,792,458 m/s.
    a. Observers are the player's ship, the enemy ship, and every torpedo.
    b. The player's display, the enemy AI, torpedo guidance and PDC fire control never use another object's true current state.
    c. An enemy 3 light-seconds away appears as it was about 3 seconds earlier.
    d. The enemy AI can't react to a player burn until the light from that burn reaches the enemy.
  b. Observables: Ships and torpedoes are always observable, and some events send out a flash at the speed of light.
    a. Flashes come from a drive lighting, cutting off or changing burn, a torpedo launch, a railgun shot, and a PDC burst.
    b. PDC clouds and coasting slugs can't be observed.
    c. Observations are exact apart from the light delay.
  c. Prediction cloud: For any observed contact and any time, the game builds a cloud of where the contact could be by simulating many possible maneuvers from its last observed state.
    a. A maneuver is up to 3 burns, each with a direction, a g level up to the contact's maximum, and a duration, with coasts between them.
    b. Each burn first pays the time needed to rotate the contact into position.
    c. "Keep doing what it was doing" and "coast" are always among the maneuvers.
    d. A crewed contact's maneuvers are weighted only by whether its crew would survive them, using the dose implied by its observed history (see `crew-g-tolerance`).
    e. A torpedo's maneuvers are limited only by its fuel.
    f. A cloud predicted further from the last observation is larger, in line with ½·a·t².
  d. Shared prediction: The player's aiming, the enemy AI, torpedo guidance and PDC fire control all use the same prediction clouds, each from its own observations.
  e. Precomputed maneuvers: Maneuver results are computed ahead of time for each ship and torpedo type and reused, moved onto the contact's coasting path and turned to its observed heading.
    a. A reused prediction agrees with a fresh simulation of the same maneuvers to within the contact's length.
5. tactical-display: Shows the 3D fight on a 2.5D block display that makes light delay, prediction and scale visible without revealing anything the player couldn't know.
  a. Block view: Every object is drawn as a block in 3D, seen through a camera the player can orbit and zoom.
    a. A faint grid plane runs through the player's ship.
    b. A drop line joins every displayed contact to that plane, and its length is the contact's height above or below it.
  b. Scale: Distant contacts show as fixed-size markers and close ones as true-size blocks.
    a. Zooming from a 3-million-km view down to a 100 m view of a ship shows no visible jitter.
  c. Ghosts: During play, every contact is drawn where it was observed and labelled with how old that observation is, such as "seen 6.3 s ago".
  d. Cloud drawing: Prediction clouds are drawn as soft 3D density at their true size and are never enlarged.
    a. A 3 km cloud in a 3-million-km view is too small to see until the player zooms in.
    b. No possible paths are drawn, only the cloud.
    c. While aiming a weapon, the cloud shown is the one for the moment the weapon would arrive.
  e. Light rings: Rings on the grid plane spread from the player's ship at the speed of light, one per light-second, labelled with distance.
    a. A highlighted ring follows the player's latest burn change or shot and counts down until it reaches the enemy's last known position.
  f. Own PDC clouds: The player's own PDC clouds are drawn as density, since the player fired them.
  g. HUD: The HUD shows the game clock, warp level, g allowance, current g, crew dose, reaction mass left, and ammunition for each weapon.
6. player-command: Lets the player act as the Rocinante's captain: set intent, g allowance, weapon orders and time warp, while an autopilot carries them out under real physics.
  a. G allowance: The player sets a maximum g from 0 to the ship's 15 g limit, and the autopilot never exceeds it.
  b. Direction: The player sets a desired direction, and the autopilot gets there by rotating the ship and then burning, within the g allowance.
    a. A direction opposite the current velocity makes the ship flip and burn against its motion.
  c. Weapon orders: The player orders railgun shots at an aim point, torpedo launches at a contact, and offensive PDC bursts at a point or contact.
    a. For a railgun shot, the autopilot first turns the keel onto the aim point.
    b. An order the ship can't carry out, such as a launch with an empty magazine, does nothing and the HUD says why.
  d. Time warp: The player picks a warp level from ×1 up to what the machine can sustain, and can pause.
    a. Warp drops to ×1 when the light from a launch, burn change or shot reaches the player's ship.
    b. Warp drops to ×1 when an observed hostile torpedo's predicted time to impact falls below a set threshold.
    c. While paused, game time stops but the player can still move the camera and queue orders.
7. match-flow: Runs a single 5–10 minute engagement from setup to outcome, including the enemy AI's doctrine and the post-match truth replay.
  a. Setup: A match starts with the two ships 1–3 million km apart, with configurable starting velocities.
    a. Ship stats default to values from the novels or derived from them, never from the TV series.
      | id | Ship | Mass t | Size m | Max g | Δv km/s |
      |---|---|---|---|---|---|
      | rocinante | Rocinante | 300 | 46 × 12 × 12 | 15 | 4000 |
      | destroyer | Destroyer | 7000 | 140 × 25 × 25 | 10 | 3000 |
    b. With default settings and warp, a typical match lasts 5–10 real minutes.
  b. End: A match ends when either ship is hit, or when either crew dies.
    a. Both ships destroyed in the same step is a mutual kill.
    b. A match is a draw when neither side can still engage, either out of ammunition or out of reaction mass and separating.
  c. Enemy AI: The destroyer fights a torpedo-heavy battle, keeping its distance, launching salvos big enough to swamp point defense, and staying out of predicted railgun lines.
    a. The AI acts only on its own delayed observations and prediction clouds.
    b. The AI is held to the same crew g-dose limits as the player.
  d. Truth replay: After a match, the player can scrub through an all-seeing replay showing true positions next to what each side saw and predicted at that moment.
    a. The replay is rebuilt from the seed and the recorded orders.
    b. At the moment of a railgun shot, the replay shows the enemy's true position, the ghost the player saw, and the cloud the player aimed at.

## Out of Scope
1. Damage model beyond any hit kills
2. The Ring, slow zone, planets and gravity
3. Modeling the juice
4. TV-series values
5. Multiplayer, campaign and sound
6. Mobile and tablet support
