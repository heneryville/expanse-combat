# 01 — Propulsion, Movement, and Human Limits

Thread scope: the Epstein drive, ship and missile accelerations, human g-tolerance and "the juice", flip-and-burn travel times, maneuvering, ring-gate and slow-zone physics, and protomolecule edge cases.

**Source tiers:** `[BOOK]` novel text · `[NOVELLA]` · `[SHOW]` · `[RPG]` Green Ronin · `[WIKI]` expanse.fandom.com with a book citation · `[WIKI-unsourced]` · `[FAN-CALC]` third-party analysis · `[DERIVED]` my own calculation from canon inputs.

**Method note:** The fandom wiki returns HTTP 402 to normal fetches, but its MediaWiki API (`/api.php?action=parse&prop=wikitext`) works, so wiki wikitext and its `{{Bookref|XX|ch}}` citations were read directly. Reddit, TV Tropes, the Atomic Rockets engine list and web.archive were blocked or empty. Where a book quote below came from a secondary page rather than from a book I could check, the citation column names that page.

Book abbreviations: LW Leviathan Wakes · CW Caliban's War · AG Abaddon's Gate · CB Cibola Burn · NG Nemesis Games · BA Babylon's Ashes · PR Persepolis Rising · TW Tiamat's Wrath · LF Leviathan Falls.

---

## 1. The Epstein drive

### 1.1 How it works (canon)

- It is a modified fusion drive. Epstein's change was a **"magnetic coil exhaust acceleration to increase drive efficiency"**, which lets ships "sustain thrust throughout the entire voyage": accelerate to the midpoint, flip, then decelerate. [WIKI, *Drive*/LW-derived] ([Epstein Drive](https://expanse.fandom.com/wiki/Epstein_Drive), [Solomon Epstein (Books)](https://expanse.fandom.com/wiki/Solomon_Epstein_(Books)))
- **Fuel:** fusion *pellets*, ignited in the reactor by lasers in an inertial-confinement style; probably hydrogen and helium isotopes, with He-3 refined at Io's Prospero Station. [SHOW S3E2, S4E6] ([Fuel pellets](https://expanse.fandom.com/wiki/Fuel_pellets))
- **Reaction mass:** water. The Roci's water tank is described as "the same size as the cargo hold". [FAN-CALC summary of books] ([Shoer](https://josephshoer.com/blog/2015/06/spaceships-of-the-expanse/)). Ships have to refill reaction mass between missions. In practice the books limit ships by reaction mass and crew endurance, almost never by fuel.
- "The Epstein Drive hadn't given humanity the stars, but it had delivered the planets." [BOOK LW ~2%] ([Goodreads highlight](https://www.goodreads.com/notes/38213061-leviathan-wakes/185327722-daniel-dantas?page=1))
- Known drive models (S-250, S-400, RT-10 "Kaminari", RT6-B, G-4000 on the Nauvoo, Destrier-4 on the Razorback, Bush "Silversmith" on the Amun-Ra stealth frigates) come from the RPG and show material. They are names only, with no numbers. [RPG/SHOW]

### 1.2 Epstein's first flight (*Drive* novella)

| Item | Value | Units | Tier | Citation | Notes |
|---|---|---|---|---|---|
| Acceleration called out during the runaway | "four gravities. Five. Six. Seven." | g | [NOVELLA] | *Drive*; quoted at [rockymountainnavy](https://rockymountainnavy.com/2016/10/31/theexpanse-using-travellerrpg-cepheusengine/) | Readout "rapidly increases past 7g" ([wiki plot](https://expanse.fandom.com/wiki/Drive)). 7 g may be the instrument's limit. |
| Burn duration | 37 | hours | [NOVELLA] | *Drive* (wiki plot summary) | Epstein's own estimate while still conscious |
| Final velocity | ~5 | % of c | [NOVELLA] | *Drive* | "close to five percent the speed of light" |
| Implied mean acceleration | ~11.3–11.5 | g | [DERIVED] | 0.05c / 37 h | Several sources agree |
| Fuel at start; drop rate | 90%; "a few tenths of a percent" | — | [NOVELLA] | *Drive* | The drive is far more efficient than anything before it |
| Efficiency gain (show) | "A hundred times better than anyone had even thought possible" | × | [SHOW S2E6] | [Solomon Epstein (TV)](https://expanse.fandom.com/wiki/Solomon_Epstein_(TV)) | The show also says the fuel "was going to last for weeks". The yacht display shows 10 g. |
| Yacht | three-man, 32 m | m | [BOOK LW ch1 / WIKI] | [Epstein's yacht](https://expanse.fandom.com/wiki/Epstein%27s_yacht) | Length is wiki-unsourced |

### 1.3 Performance estimates (all non-canon)

| Item | Value | Units | Tier | Citation | Notes |
|---|---|---|---|---|---|
| Exhaust velocity (Atomic Rockets, from the yacht) | 11,000 (~3.7% c) | km/s | [FAN-CALC] | [wiki Drive details](https://expanse.fandom.com/wiki/Epstein_Drive) | Isp ≈ 1.1M s, thrust 1 MN, 5.5 TW thrust power, mass ratio ~4 |
| Exhaust velocity (ToughSF, from the Roci) | 18,900 (6.3–6.8% c) | km/s | [FAN-CALC] | [ToughSF](https://toughsf.blogspot.com/2019/10/the-expanses-epstein-drive.html) | Isp ≈ 1.93M s, 6.37 MN, 60 TW thrust power, 96.8 TW total, D-He3 |
| Roci delta-v (ToughSF) | ~4,000 (1.33% c) | km/s | [FAN-CALC] | ToughSF | ~250 t dry, 352 t wet, ~57 t water, ~31 t D-He3 |
| Roci fuel burn (ToughSF) | 0.91 | kg/s | [FAN-CALC] | ToughSF | "10 hours for full water propellant burn at 5g" |
| D-He3 theoretical exhaust velocity | 8.9% c (~26,700 km/s) | — | [FAN-CALC] | [Shoer](https://josephshoer.com/blog/2015/06/spaceships-of-the-expanse/) | Upper bound |
| 5 AU trip at 0.3 g needs | ~3,300 km/s Δv; ~15% of mass as reaction mass | — | [FAN-CALC] | Shoer (comments) | Assumes 8.9% c exhaust |

**Takeaway:** canon never gives exhaust velocity. Fan estimates agree on **~1–7% of c**. At that range, Δv per tank is **thousands of km/s**: enough for full brachistochrone trips at a third of a g, but not unlimited.

---

## 2. Ship acceleration by vessel

| Ship / class | Value | Units | Tier | Citation | Notes |
|---|---|---|---|---|---|
| **Rocinante** (MCRN *Tachi*, Corvette-class light frigate): highest observed | 12 (brief) | g | [BOOK LW ch51] | ["Alex had already flown it at twelve g briefly when they'd left the Donnager"](https://rockymountainnavy.com/2017/02/26/theexpanse-ships-in-travellerrpg/) | Escaping the Donnager |
| Rocinante theoretical max | "Fifteen g, was it? Twenty?" | g | [BOOK LW ch51] | same | "a way to brag about something your ship would never really do" |
| Rocinante sustained combat | ~5 for hours, bursts to 12 | g | [FAN-CALC] | ToughSF | Reasonable reading of the books |
| Rocinante (show, "Home" S2E3) | just over 17 | g | [SHOW, FAN-CALC] | rockymountainnavy | Chasing Eros |
| Rocinante size and mass | 46 m; crew 16 std / 4 min / 22 max | m | [RPG] | [Corvette-class (Books)](https://expanse.fandom.com/wiki/Corvette-class_light_frigate_(Books)) | Mass estimates disagree: TV wiki 4,770 t, ToughSF ~250–350 t |
| **Donnager** (MCRN battleship) | "designed for long periods at high g" | — | [BOOK LW / WIKI] | [Donnager](https://expanse.fandom.com/wiki/Donnager) | ~475–500 m. "Quarter-million tons of bad news" (Alex, LW) = 250,000 t. No g figure found. |
| **Canterbury** (ice hauler) | sustained 3 g, emergency only | g | [SHOW / WIKI] | [Canterbury (TV)](https://expanse.fandom.com/wiki/Canterbury_(TV)) | Book version: ~750 × 250 m, ~50 crew, a century-old colony ship refit as a water hauler (LW). Normal hauling is slow. |
| **Knight** (Canterbury's shuttle): steam "teakettle" thrusters | ~0.1 | g | [FAN-CALC from LW ch3] | rockymountainnavy | 50,000 km in ~4 h. My check: 4d/t² ≈ 0.098 g. [DERIVED] |
| Knight: fusion torch | 2 g "low"; ~5–7 g max | g | [BOOK LW ch5 / FAN-CALC] | rockymountainnavy | Holden's body "weighed 500 kg". Pre-Epstein torch drive: "a prodigious fuel-burn rate". |
| **Razorback** (racing pinnace) | "extreme levels of acceleration limited only by the endurance of the human pilot"; one secondary source says a constant 6 g | g | [RPG/WIKI-unsourced] | [Razorback](https://expanse.fandom.com/wiki/Razorback) | 20 m long, 2 crew. Rear RCS booms extend the moment arm "for incredibly rapid turns". The CW and NG escapes are hard burns lasting days, with no number given. |
| **Pella** and other Free Navy gunships (BA) | "pulling almost ten gs" | g | [BOOK BA p.190] | [SpaceBattles quote](https://forums.spacebattles.com/threads/the-expanse-source-feats-and-discussion-thread.642601/) | The context is a pursuit or escape burn |
| **Nauvoo / Behemoth / Medina** | low. A generation ship designed for about a century of near-continuous burn to Tau Ceti. | — | [BOOK LW ch17 / WIKI] | [Nauvoo (Books)](https://expanse.fandom.com/wiki/Nauvoo_(Books)) | ~2 km × 0.5 km (LW ch17). RPG gives 2,148–2,460 m. Spin drum, G-4000 drives. Tycho had to build the fast *Chesapeake* to catch it after the Eros incident. |
| Nauvoo at the Eros intercept | ~19 | km/s | [WIKI-unsourced/secondary] | search summary ([Wikipedia LW](https://en.wikipedia.org/wiki/Leviathan_Wakes)) | Eros dodged it |
| **Truman-class** (UNN dreadnought, e.g. *Agatha King*) | "just enough thrust to keep the massive beast from lumbering"; 6 Epstein drives | — | [RPG] | [Truman-class (Books)](https://expanse.fandom.com/wiki/Truman-class_dreadnought_(Books)) | 376 m, 1,400 crew. Shorter range than the Donnager. |
| **Leonidas-class** (UNN) | "poor acceleration", outdated S-250 drives; railguns can't train under thrust | — | [SHOW/RPG] | [Leonidas-class](https://expanse.fandom.com/wiki/Leonidas-class_battleship) | 270 m |
| **Anubis / Amun-Ra-class** (stealth frigate) | no figure | — | [BOOK LW] | [Anubis (Books)](https://expanse.fandom.com/wiki/Anubis_(Books)) | 12 torpedo tubes (book). TV/RPG: 61.5 m, "hypercooled" drive to cut its thermal signature. |
| **Laconian *Falcon*** (science ship, immersion couches) | ≥30 (emergency) | g | [WIKI-unsourced, TW] | [Falcon](https://expanse.fandom.com/wiki/Falcon) | "can accelerate at a rate of at least 30Gs without significantly endangering the crew". Highest crewed figure found. |
| **Magnetar-class** (*Heart of the Tempest*) | no figure. Grown hull, self-healing plating, antimatter supply, USM magnetic weapon. | — | [BOOK PR ch8, 16; TW] | [Magnetar-class](https://expanse.fandom.com/wiki/Magnetar-class_battleship) | Could hold a dozen Pulsar destroyers. Beat the EMC fleet with no damage (PR ch27). |
| **Pulsar-class** (*Gathering Storm*) | "fast attack destroyer". No g figure. | — | [BOOK PR/TW] | [Gathering Storm](https://expanse.fandom.com/wiki/Gathering_Storm) | 2 torpedo batteries × 4 rails with fast reload (TW ch6) |
| Commercial cruise | 1/3 (≈0.3) | g | [BOOK passim] | Shoer; LW | Spin stations match it: Tycho "Spinning it up to 0.3 g had taken the best minds at Tycho Manufacturing half a generation" [BOOK LW ~4%]. Eros is spun to 0.3 g. |

---

## 3. Torpedoes and missiles

| Item | Value | Units | Tier | Citation | Notes |
|---|---|---|---|---|---|
| Anubis torpedoes vs. Canterbury | "now at over forty klicks a second and accelerating" | km/s | [BOOK LW p.52] | SpaceBattles thread | |
| Time to contact at ~200,000 km | "Just under eight minutes, sir" | min | [BOOK LW pp.47–48] | SpaceBattles; rockymountainnavy | Fan sources read this as the torpedoes' time to cross 200,000 km |
| Implied torpedo acceleration | ~150–177 | g | [FAN-CALC / DERIVED] | 2d/t² with d = 2×10⁸ m, t = 480 s → 177 g | 40 km/s fits ~23 s into a 177 g burn. SpaceBattles' "4 minutes" context would give only ~17 g, so treat it as unreliable. |
| Construction | "basic fusion reactors with a wall missing" (Amos) | — | [BOOK, paraphrase] | search summary | Missiles carry their own Epstein-type drives |
| Torpedo minimum range vs. PDCs | "Inside effective torpedo range... we'll be good for PDCs in eight minutes and ten seconds" | — | [BOOK BA p.228] | SpaceBattles | Torpedoes are long-range weapons. PDCs only work close in. |
| PDC muzzle velocity | 5,000 | m/s | [BOOK LW] | "Teflon-coated tungsten steel going five thousand meters per second" (SpaceBattles); [PDC wiki](https://expanse.fandom.com/wiki/PDC) | Covered in detail by the weapons thread |
| Missiles in the slow zone | "locked down shortly after launch, although their boosters will continue to fire" | — | [WIKI, AG] | [Missile](https://expanse.fandom.com/wiki/Missile) | The speed limit caps them |
| Guided evasion | MCRN and Protogen missiles maneuver to dodge PDC fire | — | [SHOW/WIKI] | Missile wiki | |

---

## 4. Human g-tolerance

### 4.1 The juice and couches

| Item | Value | Units | Tier | Citation | Notes |
|---|---|---|---|---|---|
| Definition | "Going on the juice was pilot-speak for a high-g burn that would knock an unmedicated human unconscious… to keep him conscious, alert, and hopefully unhurt when his body weighed five hundred kilos." | — | [BOOK LW] | quoted at [rockymountainnavy 2020](https://rockymountainnavy.com/2020/12/21/rpg-rulings-understanding-gravity-in-theexpanse-using-cepheusengine-travellerrpg/) | For an 80–100 kg body, 500 kg means **~5–6 g**. [DERIVED] That is roughly where juice becomes necessary. |
| Delivery | about a dozen needles through suit membranes from the couch | — | [BOOK LW ch5] | [Crash couch](https://expanse.fandom.com/wiki/Crash_couch) | |
| Side effects | uncomfortable; toxic with prolonged use | — | [WIKI/SHOW; BOOK paraphrase] | wiki; search summaries | Miller's spine spurs came from "cheap bone density juice", a different formulation |
| Crash couch | gel padding; gimbals to align with the thrust axis | — | [BOOK LW] | Crash couch wiki | |
| Racing couch (Razorback) | multi-axis gimbals with medical monitoring and better juice | — | [BOOK NG ch20] | Crash couch wiki | |
| Full-immersion couch (Laconian) | gel all round, lungs filled with oxygenated fluid, usable for days | — | [BOOK TW ch5] | Crash couch wiki | "A journey of weeks could be accomplished in days." Enables ≥30 g. |
| RPG: high-g effects | +1 g: Constitution (Stamina) TN 9+ per **hour** to resist fatigue. +2 g: Hindered, TN 9+ per **minute**. Good Juice gives +2. | — | [RPG core] | [search summary](https://rockymountainnavy.com/2021/01/14/rpgthursday-theexpanse-roleplaying-game-greenroninpublishing-2019-fermenting-juice/) | Partial table only. "+N" appears to mean thrust above the safe baseline. |

### 4.2 g-levels as depicted

| Band | What happens | Tier / source |
|---|---|---|
| 0.3 g | Normal cruise and station spin. Comfortable for Belters. | [BOOK] |
| 1 g | Hard for Belters. Naomi skips the hormone and bone regime colonists use for 1 g+. | [BOOK CB] (search summary) |
| 2–3 g | Hard burns that can be held for a long time. Knight's "low" torch; Canterbury emergency (show). | [BOOK/SHOW] |
| ~5–7 g | Juice needed to stay conscious. Common combat burns. Epstein readout "Seven." | [BOOK LW; NOVELLA] |
| ~10 g | Brief combat sprints ("pulling almost ten gs", BA). | [BOOK BA] |
| 12 g | Roci's escape from the Donnager. Brief, with juice. | [BOOK LW ch51; WIKI Donnager] |
| ~11.5 g sustained 37 h | Fatal (Epstein, no juice). | [NOVELLA, DERIVED] |
| 15–20 g | Roci's theoretical drive limit. Never used with crew aboard. | [BOOK LW ch51] |
| ≥30 g | Survivable only in Laconian immersion couches (*Falcon*). | [WIKI-unsourced, TW] |
| ~150–180 g | Torpedoes. | [FAN-CALC] |

### 4.3 Deaths and injuries from g

| Event | Detail | Tier |
|---|---|---|
| Solomon Epstein | Stroke after hours at >7 g with no juice | [NOVELLA] |
| Alex Kamal (show only) | Stroke after the Razorback's hard burn, S5E10. Book Alex survives the series. | [SHOW] |
| Slow-zone hard stop | Hundreds killed or injured when hulls were stopped abruptly | [BOOK AG] |
| General physiology | Blackout and injury risk rise with g and duration, worse with age. | [WIKI-unsourced] ([Earth standard gravity](https://expanse.fandom.com/wiki/Earth_standard_gravity)) |

### 4.4 Belters vs. Earthers and Martians

- Belters are 2–2.5 m tall with brittle bones from growing up in low g. They "cannot survive in Earth's gravity for very long". They **"recover faster than Earthers after periods of high-g"**. [WIKI-unsourced] ([Belter](https://expanse.fandom.com/wiki/Belter))
- McDowell: "almost two and a quarter meters and thinner than a teenager back on Earth". [BOOK LW ~4%]
- Colonists bound for planets with ≥1 g take bone and muscle growth hormones and train under a full g. [BOOK CB] (search summary)
- No canon number gives a Belter's g-ceiling relative to Earthers. **Simulator suggestion:** model a Belter as slightly worse at sustained tolerance (1–1.5 g lower over long periods) and slightly better at recovery. [DERIVED, not canon]

---

## 5. Flip-and-burn and travel times

### 5.1 Canon travel times

| Route | Value | Tier | Citation | Notes |
|---|---|---|---|---|
| Ceres → Ring (Roci) | ~3 months | [BOOK AG] | search summary ([Wikipedia](https://en.wikipedia.org/wiki/The_Expanse_(novel_series))) | Far slower than a brachistochrone at 1/3 g (~22 d), so the ship mostly coasts or burns gently to save reaction mass |
| Earth → Mars (aligned) | "only" 12 days | [WIKI-unsourced] | same | Matches about 0.05–0.1 g, or coasting |
| Mars → Ceres at 1 g | "days instead of months" | [BOOK LW, paraphrase] | search summary | |
| Earth → Saturn at cruise | 10–12 days | [FAN-CALC] | ToughSF | |
| Canterbury Saturn rings → Ceres | months per trip | [BOOK LW / SHOW] | | No exact figure found |

### 5.2 Brachistochrone table [DERIVED]

Formula: t = 2·√(d/a), v_max = √(d·a). Assumes no coasting and ignores orbital motion.

| Route (distance) | 0.1 g | 1/3 g | 1 g | 3 g | 5 g |
|---|---|---|---|---|---|
| Earth–Mars, closest (0.52 AU) | 6.5 d | 3.6 d | 2.1 d | 1.2 d | 0.9 d |
| Earth–Mars, average (1.5 AU) | 11.1 d | 6.1 d | 3.5 d | 2.0 d | 1.6 d |
| Earth–Ceres (2.0 AU) | 12.8 d | 7.0 d | 4.0 d | 2.3 d | 1.8 d |
| Ceres–Eros (~1.5 AU) | 11.1 d | 6.1 d | 3.5 d | 2.0 d | 1.6 d |
| Ceres–Jupiter (~2.6 AU) | 14.6 d | 8.0 d | 4.6 d | 2.7 d | 2.1 d |
| Ceres–Saturn (~7 AU) | 23.9 d | 13.1 d | 7.6 d | 4.4 d | 3.4 d |
| Ceres–Ring (~19 AU) | 39 d | 22 d | 12.5 d | 7.2 d | 5.6 d |

Peak velocity at 1/3 g over 1.5 AU is ~860 km/s, and the trip uses ~1,700 km/s of Δv. Book travel times are consistently **longer** than these figures. **Canon ships do not run full brachistochrones on long trips.** They burn, coast, and flip, which keeps them within reaction-mass limits.

### 5.3 Flip mechanics

- Ships flip at the midpoint and run the main drive the whole time, so "down" always points aft. The ship is laid out like a tower: drive at the bottom, cockpit at the top. [BOOK LW / WIKI Rocinante]
- Burning the drive at a pursuer is a weapon in its own right. Holden's crew kills the hybrid with the Roci's plume. [SHOW, WIKI]

---

## 6. Maneuvering thrusters, rotation, juking

| Item | Value | Tier | Citation | Notes |
|---|---|---|---|---|
| Flying "teakettle" | Maneuvering thrusters running on superheated steam, ~0.1 g | [BOOK LW ch3] | rockymountainnavy | Quiet, low-signature, slow |
| Knight RCS | "relatively quick rotational maneuvers" | [WIKI] | [Knight](https://expanse.fandom.com/wiki/Knight) | |
| Razorback | RCS on three long booms "as far from the center of mass as possible… incredibly rapid turns" | [RPG/WIKI] | Razorback | A longer moment arm means more angular acceleration |
| Thruster loss | Disabled port thrusters hamper the Roci's maneuvering (Osiris fight) | [SHOW] | PDC wiki | Thrusters can be damaged as separate systems |
| Railgun recoil as a thruster | The Roci used railgun recoil to hold the Barbapiccola in orbit. CB p.480: "how much acceleration does a two-kilo slug travelling at five thousand meters per second give the ship?" | [BOOK CB / SHOW] | SpaceBattles; Rocinante (TV) wiki | |
| Juking | Pilots throw in random lateral burns to spoil firing solutions. **No canon numbers for rotation rate or juke g.** | [BOOK, qualitative] | | Gap |

---

## 7. Ring gates and the slow zone

| Item | Value | Units | Tier | Citation | Notes |
|---|---|---|---|---|---|
| Slow-zone speed limit | 600 | m/s | [BOOK AG] | [Wikipedia AG](https://en.wikipedia.org/wiki/Abaddon%27s_Gate); [Ring Station (Books)](https://expanse.fandom.com/wiki/Ring_Station_(Books)) | Anything faster is "captured by an inertia field and pulled into an orbit circling the station" |
| Lowered limit (after the Marines attacked) | "the speed of a fast pitch" | ~40 m/s [DERIVED] | [BOOK AG / WIKI] | Ring Station (Books) | A marine's grenade "comes to a halt and drops to the ground centimeters from the barrel" |
| Mechanism | "The speed limit grips the hull of the ships, but anything inside is unaffected" | — | [BOOK AG] | [Slow zone (Books)](https://expanse.fandom.com/wiki/Slow_zone_(Books)) | Hulls stop and their contents keep moving: heavy crew injuries. Bullets inside the ship behave normally. |
| Behavior of an over-limit object | Stopped, then put into a slow orbit or debris ring around the station | — | [BOOK AG] | Ring Station (Books) | Probes and the *Y Que* ended up there |
| *Y Que* (Manéo) | Ran through the Ring fast, was halted dead, and the pilot died | — | [BOOK AG / SHOW] | [Sol gate](https://expanse.fandom.com/wiki/Sol_gate) | The show shows this at the Ring itself |
| Slow-zone size | ~1,000,000 km across, sphere | km | [BOOK AG] | Slow zone (Books) | Show: gates ~50,000 km apart |
| Number of gates | 1,373 | — | [BOOK TW ch19] | Sol gate wiki | |
| Ring inner diameter | ~1,000 | km | [WIKI] | [Ring network](https://expanse.fandom.com/wiki/Ring_gate) | |
| Sol Ring location | ~2 AU outside Uranus's orbit | AU | [WIKI {{fact}}] | Sol gate | |
| Ring Station | sphere ~5 km | km | [WIKI] | Ring Station (Books) | |
| Transit | Effectively instant. "No noticeable change" for the crew in the books. | — | [BOOK, WIKI note] | Sol gate | |
| Disappearances ("going dutchman") | 13 of 437 ships vanished | ships | [BOOK NG ch8] | [Ring network anomaly](https://expanse.fandom.com/wiki/Ring_network_anomaly) | |
| Trigger | A large amount of mass/energy passing through a gate in a short window. Ships can vanish even with a ship in between that survived (*Jaquenetta* survived while the *Oleander-Swift* and *Harmony* vanished). | — | [BOOK NG ch18, BA ch10] | anomaly wiki | Afterwards, background readings show "a discontinuity" rather than a radiation spike |
| Naomi's equation | Predicts the vanishing threshold. Used as a weapon: the Free Navy fleet (Pella plus 14 ships) vanished at the Sol gate. | — | [BOOK BA ch49, ch51] | anomaly wiki | Behind the Transport Union's transit scheduling (PR) |
| Laconian control | A USM hit on the Ring Station triggers gamma-ray bursts at every gate | — | [BOOK PR] | Ring Station (Books) | Could be used to deny gate transit |

---

## 8. Protomolecule propulsion anomalies (edge cases)

| Item | Value | Tier | Citation | Notes |
|---|---|---|---|---|
| Eros moves without inertia | Accelerated with no effect on objects inside; changed course to dodge the Nauvoo | [BOOK LW] | [Wikipedia LW](https://en.wikipedia.org/wiki/Leviathan_Wakes) | Reaction-less and inertia-less. Out of scope for normal physics. |
| Eros mass and speed | ~6.69 trillion t; "nearly 25 km/s" | [WIKI-unsourced/secondary] | search summary | Low confidence. Eros is 34.4 × 11.2 × 11.2 km ([Eros](https://expanse.fandom.com/wiki/Eros)). |
| Roci shadowing Eros (show) | Had to keep raising its acceleration to >17 g to keep up | [SHOW S2E3] | Rocinante (TV) wiki; rockymountainnavy | |
| Venus → Ring | The protomolecule launched a complex of structures from Venus out past Uranus and built the 1,000 km Ring | [BOOK CW end / WIKI] | [Protomolecule](https://expanse.fandom.com/wiki/Protomolecule) | |
| Ring Station dampening field | Can be switched off (Holden and the Investigator) | [BOOK AG] | Ring Station (Books) | |

---

## Recommended simulator defaults

| Parameter | Default | Rationale |
|---|---|---|
| g | 9.80665 m/s² | |
| Commercial cruise | 0.3 g | Canon, used throughout |
| Freighter / hauler max | 1–3 g | Canterbury 3 g emergency (show) |
| Warship "hard burn", sustainable for hours with juice | 4–6 g | The 500 kg juice threshold |
| Warship combat sprint, minutes | 8–12 g | BA "almost ten gs"; Roci 12 g |
| Roci-class drive ceiling (uncrewed or suicidal) | 15–20 g | LW ch51 |
| Capital ship (Donnager/Truman) max | 3–6 g (Truman lower, Donnager higher) | Qualitative only; mass and "lumbering" |
| Racing pinnace (Razorback) | 6 g sustained, 12+ g burst | Weak sourcing |
| Laconian (immersion couches) | 30 g crewed emergency | TW/Falcon |
| Torpedo | 150–180 g (start at 150), burn time limited | LW 200,000 km in under 8 min |
| PDC slug | 5 km/s | LW |
| Exhaust velocity | 10,000 km/s (≈3.3% c) | Midpoint of the fan estimates |
| Ship Δv budget (reaction mass) | Warship ~2,000–4,000 km/s; freighter ~500–1,500 km/s | ToughSF Roci 4,000 km/s; books show coasting |
| Juice | Required above 3 g for sustained burns and above 5 g for any burn. Gives about +1 tier of tolerance at a toxicity cost. | |
| Unconsciousness without juice | ~5 g for minutes, ~3 g over hours | Juice quote; Epstein |
| Stroke model | Hazard rate rises steeply with g × time. Multiply by age (Fred) and poor-quality juice. Lethal over hours at >10 g (Epstein, about 11.5 g for <1 h). | |
| Flip time | A few seconds for small ships, tens of seconds for capitals (placeholder) | No canon numbers |
| Slow zone | Hard velocity cap of 600 m/s relative to the Ring Station. Any object above it is stopped instantly. Hull-stop damage is about Δv² to the crew. | AG |
| Gate transit | Instant. A per-gate mass-energy accumulator decays over time; above the threshold, transiting objects are deleted with probability p. | NG/BA |

## Gaps and uncertainty

1. **No canon exhaust velocity, Δv, or reaction-mass figures.** All propulsion numbers are fan estimates, and they disagree by about 2× (Atomic Rockets vs. ToughSF). Ship masses disagree by more than 10× (Roci: 4,770 t on the TV wiki vs. ~350 t from ToughSF).
2. **Capital-ship acceleration numbers are missing.** Donnager, Truman, Magnetar and Behemoth have only qualitative descriptions.
3. **Torpedo g depends on one LW scene,** and it reads ambiguously: the "8 minutes" may be a ship's time to contact rather than the torpedoes'. The SpaceBattles 177 g and 17 g readings conflict. Torpedo burn duration and Δv are uncanonized.
4. **No rotation rates, flip durations, or juke magnitudes** in canon.
5. **The Belter g-tolerance difference** is qualitative only, and "recover faster" is wiki-unsourced.
6. **The Falcon's 30 g** is from the wiki without a direct quote. Verify in TW ch1–5 or ch19–21.
7. **Eros's ~25 km/s and 6.69 trillion t**, Earth–Mars "12 days", and Ceres→Ring "~3 months" come from secondary summaries. Verify against the text.
8. **Ring mass-energy threshold:** canon gives no numbers. Only Naomi's (unstated) equation exists.
9. **Not verified directly:** the RPG gravity table (only fragments reached me), and the Razorback, Pella and Heart of the Tempest g values in CW, NG, BA and PR. The fastest remaining fix is to search ebook text for "g" or "gs" near ship names in those chapters.
