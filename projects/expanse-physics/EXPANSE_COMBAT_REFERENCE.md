# Expanse Combat Reference — Physics, Movement, Weapons

Synthesis of five research threads (`02_findings/`). Built to seed a combat simulator.

**Source tiers:** `BOOK` novels/novellas · `BOOK?` recalled or paraphrased, needs ebook check · `SHOW` Amazon series · `RPG` Green Ronin *Expanse RPG* / *Ships of the Expanse* · `WIKI` fandom wiki, unsourced · `DERIVED` computed from canon · `REAL` real-world physics/biology.

**The headline:** the books give very few hard specs. They give *scenes*: a distance, a time, a feeling of weight. Most "canon" numbers online (40 mm PDCs, 9.98 km/s railguns, 59 PDCs on the Donnager) are from the show or the RPG. The sim should ship with two presets, **Book** and **Show**, and treat everything below as tunable.

---

## 1. Movement

### The Epstein drive
- Fusion drive, water reaction mass, pellet fuel. Its defining trait: sustained high thrust *and* high efficiency — weeks at 1 g. `BOOK`
- Solomon Epstein's first flight (*Drive* novella): "four gravities… Five. Six. Seven." Burned 37 h, reached ~5% c. Implies ~11.5 g average. `BOOK` / `DERIVED`
- Implied exhaust velocity: ~1–7% c in fan analyses. A 100 t ship holding 1 g for a week needs ~5,900 km/s Δv, vₑ ≈ 8,600 km/s at mass ratio 2, ~4 TW jet power, ~10 t water/day. `DERIVED`
- Real-physics problem: even 0.1% waste heat needs thousands of m² of red-hot radiator. Expanse ships have none. Ignore drive heat in the sim. `REAL`

### Acceleration by ship class

| Ship / class | Cruise | Combat sustained | Max / burst | Tier |
|---|---|---|---|---|
| Commercial cruise (anything) | 0.3 g | — | — | `BOOK` |
| Canterbury (ice hauler) | 0.3 g | — | ~1–3 g | `BOOK`/`SHOW` |
| Knight (shuttle) | 1 g | 3 g | ~7 g | `WIKI` |
| Rocinante (MCRN Corvette-class) | 1 g | 6–8 g on juice | 12 g flown (LW); design "fifteen g… twenty?" (LW ch51); >17 g in show | `BOOK`/`SHOW` |
| Razorback (racing pinnace) | 1 g | ~6–10 g | 15 g+ (couldn't outrun torpedoes at 15 g, NG) | `BOOK` |
| Destroyers / frigates | 1 g | ~5 g | ~10 g | `DERIVED` |
| Cruisers | 1 g | ~4 g | ~8 g | `DERIVED` |
| Battleships (Donnager, Truman) | 0.5–1 g | ~3 g | ~6 g | `DERIVED` |
| Duarte's fleet leaving Mars | 8–10 g transit | — | — | `WIKI` (NG) |
| Laconian Falcon (liquid-immersion couches) | — | — | ≥30 g crewed | `WIKI` (TW) |
| Behemoth / Nauvoo (generation ship) | 0.1–0.3 g | — | — | `DERIVED` |
| **Torpedoes** | — | — | **~150–177 g** | `DERIVED` from LW |

Capital-ship accelerations are never stated in the books. Those rows are scaled estimates.

### Transit times (flip-and-burn, rest-to-rest)

| Route | 0.3 g | 1 g | 3 g | 10 g |
|---|---|---|---|---|
| Earth–Mars, close (0.52 AU) | 3.8 d | 2.1 d | 1.2 d | 0.7 d |
| Earth–Mars, far (2.52 AU) | 8.3 d | 4.5 d | 2.6 d | 1.4 d |
| Earth–Ceres (~1.8 AU) | 7.0 d | 3.8 d | 2.2 d | 1.2 d |
| Jupiter–Saturn (~4.3 AU) | 10.8 d | 5.9 d | 3.4 d | 1.9 d |
| Saturn–Ring (~9.6 AU) | 16.2 d | 8.9 d | 5.1 d | 2.8 d |

Δv needed at 1 g is ~900–3,800 km/s. The books show *longer* trips (Ceres→Ring ~3 months vs 22 days at 0.3 g), so ships burn–coast–burn. Δv (reaction mass) is the real limit. `DERIVED`

### Human g-limits

| Load | Duration | Effect | Tier |
|---|---|---|---|
| 0.3–1 g | Indefinite | Comfortable. Belters prefer low g; Earthers handle 1 g. | `BOOK` |
| ~3 g | Hours | Exhausting without juice | `BOOK?` |
| ~5 g ("body weighed five hundred kilos") | Minutes | Unconsciousness threshold without juice | `BOOK` (LW) |
| 6–10 g ("almost ten gs", BA) | Minutes to tens of minutes | Combat burns on juice | `BOOK` |
| 12 g | Brief | Roci escape from Donnager | `BOOK` (LW) |
| 15–20 g | Seconds | Roci drive ceiling; extreme crew-risk territory | `BOOK` |
| ≥30 g | Brief | Laconian liquid-immersion couches only | `WIKI` (TW) |

**Real NASA eyeballs-in limits:** ~11 g for 1 min, ~6 g for 10 min, ~4.5 g for 30 min (falls roughly as duration^-¼). Expanse multi-hour 5–12 g burns are 1.5–3× past this. `REAL`

**The juice:** anti-blackout injection through the crash couch. Extends g tolerance; leaves crew wrung out. Overuse at high g is a crew-loss risk in canon. `BOOK`

### Maneuvering
- **Flip-and-burn:** standard. Turn 180° at midpoint, decelerate.
- **Juking:** irregular lateral thrust to spoil railgun/PDC solutions. No canon turn rates. Default: a few seconds for a 180° flip on small ships, tens of seconds for capitals. `DERIVED`
- Keel-mounted railguns require pointing the whole hull — the flip itself loads the crew. `BOOK`

### The Ring and slow zone (special rules)
- Slow zone: ~1,000,000 km across, 1,373 gates, each ring ~1,000 km across. `BOOK`/`WIKI`
- **Hard speed cap: 600 m/s.** Anything faster is stopped instantly — it grips the hull, not the contents. `BOOK` (AG)
- After weapons fire, the cap dropped to ~40 m/s ("a fast pitch") within ~5 s — ~11 g shock, hundreds dead. `BOOK` / `DERIVED`
- Gates: too much mass/energy through a gate in a short window and ships vanish — 13 of 437 lost (NG). Weaponized to destroy the Free Navy fleet (BA). `BOOK`

---

## 2. Weapons

### Point Defense Cannons (PDCs)

| Parameter | Value | Tier |
|---|---|---|
| Muzzle velocity | "several thousand m/s"; 5 km/s | `BOOK` (LW, CW) / `SHOW` |
| Caliber | 40 mm | `SHOW` |
| Round mass | ~25 g (20,000-round crate weighs >500 kg) | `DERIVED` (CW) |
| Rate of fire | "thousands of rounds per minute"; default 4,000 rpm | `RPG` / `DERIVED` |
| Effective vs. torpedoes | 1–15 km (high hit chance ≤5 km) | `WIKI` / `DERIVED` |
| Effective vs. ships | ≤20 km | `DERIVED` |
| Engagement window vs. a 30 g torpedo | open fire 15–250 km out to kill it 1–5 km out; ~2–6 s of fire, 200–600 rounds per mount | `DERIVED` |
| Mounts | Roci 6–7 · Donnager 59 · Truman 42 · Pulsar 12 · Behemoth 170 | `RPG`/`SHOW`/`WIKI` |

Computer-controlled; crews set the fire mode. Ammo depletion is a real constraint in long fights.

### Railguns

| Parameter | Book | Show | Tier |
|---|---|---|---|
| Rocinante keel gun projectile | 2 lb (CW) → 2 kg tungsten (BA) | 1 kg | `BOOK` / `SHOW` |
| Muzzle velocity | "a measurable fraction of c" (BA) → default 1,500 km/s (0.5% c) | 9.98 km/s | `BOOK`/`DERIVED` / `SHOW` |
| Kinetic energy per shot | ~2.25 TJ | ~50 MJ | `DERIVED` |
| Recoil | Shoves the firing ship; apply Δv = m·v / M_ship | — | `BOOK` (BA) |
| Effective range vs. maneuvering ship | "hundreds or even dozens of km, not thousands" (LW) | — | `BOOK` |
| Rate of fire | Ring Station guns: 30 rpm; keel guns ~1 per 6 s | — | `BOOK` (BA) / `DERIVED` |
| Battleship no-fly zone | "a thousand klicks across" (Donnager, LW) | — | `BOOK` |

**Why range is short:** the target dodges during time of flight. Range at which a juking target can't clear 50 m:

| Round speed | Target at 1 g | 3 g | 10 g |
|---|---|---|---|
| 5 km/s | 16 km | 9 km | 5 km |
| 10 km/s | 32 km | 18 km | 10 km |
| 20 km/s | 64 km | 37 km | 20 km |
| 1,500 km/s (0.5% c) | 4,800 km | 2,800 km | 1,500 km |
| 3,000 km/s (1% c) | 9,600 km | 5,500 km | 3,000 km |

Model railgun hits as probability = f(target lateral accel × time of flight²), not a hard range. Against ballistic targets (stations, coasting ships, rocks), range is effectively unlimited. `DERIVED`

### Torpedoes

| Parameter | Value | Tier |
|---|---|---|
| Acceleration | ~150–177 g (Canterbury: ~200,000 km in 8 min, "over forty klicks a second") | `DERIVED` (LW) |
| Floor | >15 g (outran the 15 g Razorback, NG) | `BOOK` |
| Flight time | 3–10 min typical; Pella fight: PDC range "in eight minutes and ten seconds" | `BOOK` (BA) |
| 150 g from rest | 10,000 km in 1.9 min (172 km/s) · 100,000 km in 6.1 min (542 km/s) · 200,000 km in 8.7 min (767 km/s) | `DERIVED` |
| Δv budget | 100–1,000 km/s (sources disagree; default 500) | `DERIVED` |
| Warheads | Plasma (armor-melting), high-explosive. | `BOOK` |
| Coasting weakness | Ballistic torpedoes are easy PDC kills — defenders shot down an entire coasting salvo (LF) | `BOOK` |
| Minimum range | ~1,000 km | `DERIVED` |
| Loadouts | Roci 2 tubes / 20 · Martian flagship "nearly ninety" left (NG) · Medina 40-missile bay | `BOOK`/`RPG` |


### Other weapons
- **Drive plume:** an Epstein exhaust deals heavy damage astern. Pointing your drive at someone is an attack. `BOOK`
- **Rock bombardment** (Free Navy, NG): 3 stealth-coated rocks, hours apart, detected ~1 s before impact. Mass and speed never given. `BOOK`
- **Laconian magnetic weapon** (Magnetar-class): antimatter-primed, one-shot ship/station kill, destroyed Pallas. Firing knocks the whole system out for ~3 min. Range "<3,000,000 km" is a wiki figure. Treat as a scripted event. `BOOK` / `WIKI`
- **Electronic warfare:** jamming bought an ambusher <3 s of blindness on a Laconian destroyer — enough for 5 torpedo hits (LF). `BOOK`
- **Boarding:** matched velocity, breaching charges, gauss rifles, MCRN Goliath power armor. `BOOK`

---

## 3. Sensors and stealth
- A burning drive is visible across the system. Real-physics estimate: 0.5–80 AU. **Stealth works only with the drive cold.** `BOOK` / `REAL`
- Cold 300 K hull: detectable at ~2–60 million km with real telescopes. Expanse is more generous: plan on 10⁴–10⁵ km for an uncoated hull, ≤10³ km for stealth-coated. `REAL` / `DERIVED`
- Canon stealth: Protogen/Anubis black composite plus active cooling; Free Navy stealth-coated rocks; the Roci's disguise kit in LF. `BOOK`
- **Light lag:** 1 light-second ≈ 300,000 km. At torpedo ranges (≤200,000 km) lag is under 1 s. At interplanetary range it's minutes — sensors show where the enemy *was*. `REAL`

## 4. Engagement bands

| Band | Range | What fights there | Tier |
|---|---|---|---|
| Detection | System-wide (drives lit) | Passive telescopes, with light lag | `BOOK` |
| Torpedo launch | 10,000–200,000 km | Torpedoes; flight 3–10 min | `BOOK` / `DERIVED` |
| Capital railgun | ~1,000–10,000 km vs. slow targets | Battleship turrets | `BOOK` (LW) / `DERIVED` |
| Railgun vs. dodging ship | ~10–1,000 km | Keel guns | `BOOK` (LW) |
| PDC vs. torpedoes | 1–15 km | PDC screen | `BOOK` / `WIKI` |
| PDC vs. ships | ≤20 km | PDCs as guns | `DERIVED` |
| Boarding | Matched velocity | Marines, power armor | `BOOK` |

RPG range bands (Close ≤5 km, Medium 5–100 km, Long 100–1,000+ km) are far tighter than what the books show. Add an "Extreme" band past 10,000 km.

## 5. What kills ships
1. **Reactor containment ("bottle") failure** — instant ship loss. Dumping core prevents it but kills the drive.
2. **Torpedoes that leak through the PDC screen** — usually by saturation.
3. **Railgun penetrations** through vital systems, crew, or the drive.
4. **Boarding.**
5. **Sensor blind spots** — how the Heart of the Tempest died.

## 6. Recommended simulator model

- **Physics:** Newtonian in SI units, float64. A local inertial frame per engagement. Fixed timestep with symplectic Euler or velocity Verlet. Ignore gravity, relativity, and drive waste heat inside an engagement.
- **Fast rounds:** sweep railgun and PDC rounds as analytic rays per tick, not stepped particles.
- **Resources:** track Δv/reaction mass, PDC rounds, torpedo magazine.
- **Crew:** a g-dose meter (g × time). Blackout and injury risk rise steeply above 5 g, multiplied by age and juice quality. Juice extends tolerance at a toxicity cost.
- **Sensors:** timestamped contacts with light lag. Drive-on equals detected. Firing breaks stealth for a round.
- **Damage:** hull soak plus typed system losses (Reactor, Drive, Sensors, Thrusters, each PDC and weapon, Crew). A small chance that a reactor hit escalates to containment failure.
- **Presets:** **Book** (railgun 1,500 km/s, PDC 25 g rounds) vs. **Show** (railgun 10 km/s, PDC 40 mm).

### Default constants

| Constant | Default |
|---|---|
| g | 9.80665 m/s² |
| Exhaust velocity | 10,000 km/s |
| Warship Δv | 2,000–4,000 km/s |
| Freighter Δv | 500–1,500 km/s |
| Roci mass | ~300 t (sources range 230–4,770 t) |
| Donnager mass | 250,000 t |
| Torpedo accel / Δv | 150 g / 500 km/s |
| PDC | 5 km/s, 4,000 rpm, 25 g rounds, 20,000 rounds per crate |
| Keel railgun | 2 kg at 1,500 km/s (Book) or 1 kg at 10 km/s (Show), 1 shot per 6 s |

## 7. Gaps
- No book states torpedo acceleration, railgun velocity, or capital-ship g. Everything in those rows is derived.
- `BOOK?` items and page citations need checking against the ebooks.
- RPG per-ship Drive/Sensors ratings need a legal copy of *Ships of the Expanse*.
- The physics cross-check file (`05_physics_crosscheck.md`) wasn't saved — the agent's file writes were blocked. Its key numbers are folded in above; re-run them in a script before locking constants.
