# Expanse Combat Sim — Design

Status: draft for approval · 2026-11-06
Research basis: `projects/expanse-physics/EXPANSE_COMBAT_REFERENCE.md` and `projects/expanse-physics/02_findings/`.

## Intent

A browser game simulating a ship-to-ship fight in the style of *The Expanse*: the Rocinante against a torpedo-armed destroyer, in open space far from any gravity well. The point is honest physics. The fun comes from making command decisions against hard constraints: g-load on the crew, reaction mass, and above all the speed of light. You never see where the enemy *is*, only where it *was* when its light left it, so every shot is a prediction.

The player is the captain, not the pilot. The decisions that matter:

1. **How many g's** to allow, which trades speed and dodging against the risk of killing the crew.
2. **When to fire, and with which weapon**: railgun, torpedoes, offensive PDC bursts.
3. **Which direction to fly.**
4. **Predicting the enemy** from light-delayed information.
5. **Time warp.** Most of the fight runs fast-forwarded, then drops to real time when something interesting happens.

A match takes **5–10 minutes** of real time.

## Goals

- Every object is physically simulated in 3D: ships, torpedoes, railgun slugs, PDC clouds.
- The speed of light is a major, visible mechanic.
- The player, enemy AI, and torpedo guidance all work from light-delayed information and the same probabilistic prediction machinery.
- After the match, a truth replay shows what really happened next to what each side saw.

## Non-goals (v1)

- Damage model. **Any hit kills**: ship, torpedo, or crew. Relative velocity and impact energy are still computed and stored for later.
- The Ring and slow zone, planets, gravity.
- Modeling the juice. Everyone is assumed to be on it in combat; it is baked into the crew g-tolerance curve.
- Multiplayer, campaign, sound, art beyond blocks.

## Anti-goals: failure even if it "works"

- **Faked physics**: teleporting, scripted hits, dice rolls not grounded in geometry, objects that steer without thrust, rotation without torque.
- **Information leaks**: the player HUD, the enemy AI, or a torpedo using true positions instead of light-delayed observations. Only the post-match truth replay is omniscient.
- **Warp changing outcomes.** The same inputs at ×1 and ×1000 must produce the same fight.
- **Missed collisions** because a fast object stepped past a target between ticks.
- Drawing the prediction cloud larger than its true size. Knowing precisely is the point; the player zooms in to see it.

## Physics

- **Mechanics:** Newtonian, 3D, SI units, float64. A single inertial frame for the arena, with the origin at the initial center of mass. No gravity.
- **Deliberate approximation:** relativistic mechanics is ignored. The fastest objects (railgun slugs at ~0.5% c) have γ−1 ≈ 10⁻⁵. Finite light speed for *information* is fully modeled (see Perception). Sensors are assumed to correct for their own aberration, so an observer reconstructs where the light came from in the arena frame.
- **Ships and torpedoes are rigid bodies.** Each has mass, a box-shaped inertia tensor, a main drive along the keel, and maneuvering thrusters with finite torque. Changing direction means physically rotating, then burning. Mass falls as reaction mass is spent, and Δv is finite.
- **Determinism:** a seeded RNG and fixed game-time steps. Warp only changes how many steps run per rendered frame. If the CPU can't keep up, cap warp rather than lengthening the step.
- **No tunnelling:** fast objects (slugs, torpedoes, ships passing clouds) use swept (continuous) collision tests against oriented boxes.
- **Crew g-dose:** each crewed ship accumulates dose from sustained acceleration (linear and rotational). Hazard is zero in the comfortable band and climbs steeply above ~5 g with duration. Juice is assumed to be on. Calibrate from the research:
  - 3–5 g is sustainable for hours.
  - 8–12 g is tolerable for minutes.
  - 15–20 g lasts seconds.
  - A 10 g burn for 5 minutes is likely lethal.

  Crew death ends the match for that side.

## Ships and weapons (starting stats, all tunable)

**Book numbers only.** No TV-show values. Where the books are silent, values are derived from book scenes or scaled, and noted as such in the research.

| | Rocinante | Destroyer |
|---|---|---|
| Size (block) | ~46 × 12 × 12 m | ~140 × 25 × 25 m |
| Mass | ~300 t | ~7,000 t |
| Max g (player/AI g allowance cap) | 15 g | 10 g |
| Δv budget | ~4,000 km/s | ~3,000 km/s |
| Railgun | 1, keel-mounted | none |
| PDCs | 6 | 10 |
| Torpedoes (tubes / magazine) | 2 / 20 | 8 / 40 |

- **Railgun:** 2 kg tungsten slug, simulated as a point mass with swept collision.
  - Muzzle velocity: **1,500 km/s.** The books say "a measurable fraction of c"; 0.5% c is the derived default.
  - Fires along the keel, so aiming is pointing the ship.
  - Recoil is applied to the Roci as Δv = m·v / M.
  - Rate of fire: ~1 shot per 6 s.
- **Torpedoes:** small rigid bodies, ~150 g drive and ~500 km/s Δv. They have no crew, so no g limit, only fuel. Guidance runs on the torpedo's own light-delayed observations and aims at the target's prediction cloud. A coasting torpedo is predictable and easy for PDCs to kill.
- **PDCs:** 5 km/s muzzle velocity, ~4,000 rpm, ~25 g rounds, and finite ammo per mount.
  - **Defense is automatic** against incoming torpedoes.
  - The player can also **order offensive bursts**.

### PDC cloud model (decided)

- **A burst is one cloud object, not individual rounds.** It holds N rounds, the burst duration, and an angular dispersion. Its centroid moves ballistically at the shooter's velocity plus muzzle velocity.
- **The cloud grows physically.** Its width scales with the dispersion times the distance travelled, and it is stretched lengthwise by the burst duration.
- **Density is rounds per m² along the crossing path.** For any object passing through, compute the column density of rounds along its path *relative to the cloud*.
- **Hits are a random draw.** Expected hits = density × the object's projected cross-section, where cross-section is the block's silhouette perpendicular to its relative velocity, so orientation matters. Draw a Poisson count; ≥1 hit kills.
- **Clouds never expire.** They keep drifting and thinning.
- **Clouds are invisible to sensors.** Only the muzzle flash is observable.

## Perception: the speed of light

- **Each observer sees each emitter at its retarded time** t_r, where |x_obs(t) − x_src(t_r)| = c·(t − t_r). Observers are the player ship, the AI ship, and each torpedo. Keep state history per emitter and solve for t_r.
- **What is observable:**
  - Ships and torpedoes: always visible, with light delay.
  - Events emit a flash that travels outward at c: drive ignition or cut-off, a burn change, torpedo launch, a railgun or PDC firing.
  - PDC clouds and coasting slugs: not observable.
- **Prediction cloud:** a Monte Carlo sample of where a contact could be *now*, or at any future time such as a weapon's arrival.
  - From the last observed state (position, velocity, attitude, burn), sample a few thousand maneuvers. Each is a burn direction (any direction in 3D), a g level up to that ship's max, and a start time.
  - Propagate each sample with the same physics, including the rotation time needed before a new burn can start.
  - **Weighting is by crew survivability only**, using the g-dose model, never by guessed intent. Torpedo samples are limited by fuel only.
  - This one machine serves the player's aiming, the AI's aiming, and torpedo guidance.

## Presentation

- **Rendering:** 2.5D presentation of a 3D world with block graphics.
  - A reference plane with a faint grid through the player's ship.
  - Drop lines from every contact to that plane.
  - An orbitable and zoomable camera.
- **Scale:** the arena is millions of km across and ships are tens of metres. Contacts get fixed-size screen markers when far away and true-size blocks when zoomed in. Use camera-relative (floating-origin) rendering, because WebGL's float32 can't hold arena coordinates.
- **Ghosts:** contacts are drawn where they were observed, labelled with how old the image is, such as "seen 6.3 s ago".
- **Prediction cloud:** a soft 3D density volume at **true scale**. It is invisible at map zoom and resolves when you zoom toward the contact. When aiming, show the cloud at the weapon's predicted arrival time. No trajectory lines are drawn.
- **Light rings:**
  - Radar-style spheres, drawn as rings on the reference plane, expand from the player's ship at c, one per light-second, labelled with distance.
  - A highlighted ring follows the player's latest burn change or firing and shows when it reaches the enemy's last known position.
- **Own PDC clouds:** the player knows these exactly, because they fired them, and they are drawn as density volumes.
- **HUD:** game clock, warp level, g allowance, current g, crew dose meter, reaction mass, and ammo for each weapon.
- **Truth replay** after the match: scrub the timeline in an omniscient view, showing true positions alongside each side's ghosts and clouds.

## Controls

- **G allowance:** a button or stepper that sets the maximum g the autopilot may use.
- **Direction:** the player sets intent and the autopilot executes it by rotating with the maneuvering thrusters and then burning.
- **Weapons:** fire railgun (the autopilot points the keel at the chosen aim point first), launch torpedo(es) at a contact, order an offensive PDC burst at a point or contact.
- **Time warp:** player-controlled levels.
  - It drops to ×1 automatically when a new light event reaches the player, such as a launch flash, a burn change, or a weapon firing.
  - It also drops when a torpedo is within a set time-to-impact of the player's ship.

## Match

- **Setup:** the two ships start a few light-seconds apart, about 1–3 million km, with configurable initial velocities. Defaults should make a typical match 5–10 real minutes with warp.
- **End:** a ship is hit by anything (slug, torpedo, PDC round), or its crew dies from g-dose. Optional draw when both sides are out of ammo, or have spent their reaction mass and are separating.
- **Enemy AI:** a torpedo-heavy doctrine. It keeps range, launches salvos to saturate PDCs, and evades railgun lines. It only uses its own light-delayed observations and prediction clouds.

## Platform and performance (decided)

- **Desktop browsers only.**
- **Precompute the Monte Carlo.** In empty space, physics is the same everywhere and for any constant velocity. So a contact's possible position is exactly its ballistic extrapolation (x₀ + v₀·t) plus a maneuver displacement that depends only on the ship's own characteristics.
  - Precompute those displacement sample sets, in the ship's own body frame, for each ship or torpedo class.
  - Key them by: elapsed time, current burn level, attitude relative to velocity where it matters, and crew dose band.
  - At runtime, rotate each set into the observed attitude and translate it onto the extrapolated position.
  - This is reuse of exact simulations, not an approximation. The only error is the binning resolution, which the builder sizes so it stays well under a ship's length at combat ranges.
- Run the physics and perception core in a Web Worker from the start.

## Calls made after review (Claude's, flagged for checking)

- **One prediction sample is a short burn plan:** 0–3 burn segments, each with a direction, a g level, and a duration, separated by coasts. It ends in a coast or in the last observed burn continued. Explicit "keep doing what it was doing" and "pure coast" samples are always included. Each segment pays its rotation time first. Weighting stays crew survivability only, with dose inferred from the target's *observed* history, so the true dose never leaks. This covers "hard left at 5 g, then coast" as well as "flip and decelerate".
- **Sensors are exact apart from light delay** in v1. No noise.
- **Friendly fire is on.** Your own PDC clouds and slugs can kill your own ship and torpedoes.
- **Determinism scope: same machine, same session.** The truth replay re-simulates from seed plus recorded inputs and does not store cloud samples. Cross-browser bit-exact replay is out of scope, so standard `Math` functions are fine.

## How it gets made (builder's call unless noted)

- My recommendation: TypeScript + Vite + Three.js.
  - A pure, deterministic physics and perception core with no rendering dependencies, unit-tested with Vitest. Run it in a Web Worker if the main thread struggles.
  - The renderer reads snapshots from it.
- Exact tuning values: dispersion, torque, the dose curve, warp levels, and drop triggers.
- The exact direction-control UI.
- AI internals.

## Decided in conversation

- 3D physics with 2.5D presentation and block graphics.
- Any hit kills, with energy stored for later.
- The PDC cloud model as described.
- Prediction by Monte Carlo maneuver simulation, weighted by crew survivability, used by everyone.
- Cloud drawn at true scale.
- Radar-style light rings from the player's ship.
- Truth replay after the match.
- Juice assumed on, not modeled.
- PDCs defend automatically.
- No slow zone.
