# Diagrams

## Sequence Diagrams
Light carries every piece of information between ships. Nobody acts on the present.

<sub>Light-Delayed Engagement Sequence</sub>

```mermaid
sequenceDiagram
    participant Roci as Rocinante (player)
    participant Light as Light at c
    participant Dest as Destroyer (AI)
    participant Torp as Torpedo
    Dest->>Light: launch flash (t = 0)
    Note over Light: 1.5M km takes 5 s
    Light->>Roci: launch seen at t = 5 s, warp drops to x1
    Roci->>Roci: predict torpedo cloud from the 5 s old view
    Roci->>Roci: rotate, then burn at the g allowance
    Roci->>Light: burn-change flash (t = 6 s)
    Light->>Torp: torpedo sees the burn change later, from its own position
    Torp->>Torp: re-aim at the Roci's new prediction cloud
    Roci->>Roci: PDCs fire bursts at the torpedo's cloud
    Torp->>Roci: torpedo crosses the PDC cloud, Poisson hit draw
```

## Pseudocode
One fixed game-time step. Warp only changes how many of these run per real second.

<sub>Simulation Step Pseudocode</sub>

```diff
+ step(dt):
+   for each observer (ships, torpedoes):
+     observations := retarded-time view of every other emitter
+     orders := autopilot / AI / guidance from observations and prediction clouds only
+   apply orders: thruster torque, main drive thrust (capped by g allowance), weapon fire
+   integrate every rigid body, slug and cloud centroid by dt; burn reaction mass
+   add equal and opposite impulse for every shot fired
+   swept collision of slugs and torpedoes against oriented boxes over [t, t+dt]
+   for every object crossing a PDC cloud: hits ~ Poisson(column density x silhouette)
+   accumulate crew g-dose and draw crew death
+   emit flashes (launch, burn change, shot) into the light-event history
+   record state history for retarded-time lookups and the truth replay
+   check end conditions
```

## State Machine
How time warp reacts to what reaches the player.

<sub>Time Warp State Machine</sub>

```mermaid
stateDiagram-v2
    direction LR
    [*] --> RealTime
    RealTime --> Warp : player raises warp
    Warp --> Warp : player changes level / capped by CPU budget
    Warp --> RealTime : light event reaches player (launch, burn change, shot)
    Warp --> RealTime : hostile torpedo time to impact below threshold
    RealTime --> Paused : pause
    Warp --> Paused : pause
    Paused --> RealTime : resume
    RealTime --> Ended : hit or crew death
    Warp --> Ended : hit or crew death
    Ended --> Replay : open truth replay
    Replay --> [*]
```

## Contracts
- **Invariant:** no observer-facing logic reads another object's true current state. Only the truth replay is all-seeing.
- **Invariant:** the same seed and orders produce identical events at any warp level.
- **Invariant:** prediction clouds are drawn at their true size.
- **Boundary:** nothing changes heading without torque or velocity without thrust or impulse.
- **Boundary:** no fast object passes through another between steps.
- **Postcondition of firing:** the shooter's momentum changes by minus the projectile's momentum.

## Glossary
* ghost - A contact drawn where its light left it, labelled with that light's age
* retarded time - The moment light now arriving from an object left it
* flash - A light-speed event (launch, burn change, shot) that observers see once it reaches them
* prediction cloud - The weighted set of places a contact could be at a given time, from simulating possible maneuvers
* PDC cloud - The spreading group of rounds from one PDC burst, treated as a density of rounds per m²
* g-dose - A crew's accumulated exposure to acceleration, which sets its chance of death
* g allowance - The most acceleration the player lets the autopilot use
