# Notes: review loop

Running log of findings and fixes after the first full build. Newest iteration last.

## Benchmarks (task 4.6)

- Pure physics plus perception, no torpedoes: about 0.03 ms per step, which sustains ×400 warp at 12 ms per frame.
- With 20 or more torpedoes in flight, before the optimizations: about 0.3 ms per step, which caps warp near ×41.
- Main costs:
  - Prediction aim points: an O(N²) densest-sample search. Now grid-binned.
  - Body-pair collision checks. Now sweep-and-prune on x.
  - The retarded-time solve. Was 100 bisection passes, now 3–4 fixed-point passes.
- The per-step torpedo burn-change flash flood is fixed: torpedoes now flash only on ignition and cut-off.

## Iteration 1

Found while play-testing:

1. **No shot odds.** The aim view shows the cloud, but not the chance a slug fired now hits. Players fire blind at 1M km, where a slug needs a 667 s flight and the cloud is about 11,000 km wide.
2. **No own-motion cues.** Nothing shows your velocity or drive direction, so it's hard to know where you're going.
3. **No threat readout.** Incoming torpedo ghosts carry no time-to-impact, and their labels are hidden.
4. **Warp drop spam with no context.** Every enemy burn change drops warp, and nothing tells you what you saw.
5. **No controls help.**

Fixed in iteration 1:

- **Shot odds.** Aim view now shows them on the Railgun button: the share of the arrival-time cloud a slug through its densest point would meet, sized by the target's silhouette. Built only from the player's own observations.
- **Prediction prior bug.** The first maneuver used a fixed log-uniform delay of up to 2,000 s, so long-flight clouds over-weighted "does nothing", and odds at 1M km read 15%. The first maneuver's start is now uniform over the queried span, and the same odds now read 0.1%.
  - **Needs attention:** this is a prior choice. It assumes the enemy is equally likely to act at any moment.
- **Own-motion vectors.** Fixed-screen-length arrows show velocity (blue, labelled with speed) and drive direction (orange, shown while burning).
- **Incoming list.** Hostile torpedo ghosts, with range, closing speed and estimated time to impact. Red under 30 s.
- **Light received feed.** The last 8 events, each with how old its light was.
- **Warp drops.** Launches and shots still always drop warp. Routine enemy burn changes drop it at most once every 20 s.
- **How to play overlay.** Opened with `?`, closed with Esc.
