# 04 — Ships, Sensors, Defenses, Damage

Thread: ship classes and stats, the Green Ronin RPG ship-combat abstraction, sensors and stealth, and the damage model.

**Source tiers:** [BOOK] novels, [NOVELLA], [SHOW] TV series or its official production material, [RPG] Green Ronin core rules or *Ships of the Expanse* (SotE), [WIKI-unsourced] Expanse fandom wiki with no citation, [FAN-CALC] fan or blog estimate, [DERIVED] my own calculation from the cited numbers.
Book chapter citations such as "LW 16" are the wiki's own `Bookref` tags. Some book claims come from my recall and not a quoted passage; those are marked **(recall)** and should be checked against the text.

Abbreviations: LW Leviathan Wakes, CW Caliban's War, AG Abaddon's Gate, CB Cibola Burn, NG Nemesis Games, BA Babylon's Ashes, PR Persepolis Rising, TW Tiamat's Wrath, LF Leviathan Falls.

---

## 1. Master ship table

Lengths and crew counts without a book tier come mostly from SotE. The books almost never give lengths. "RPG size" uses the core-rules size bands (see §3.1).

| Ship / class | Faction | Role | Length | Mass | Crew (std / min) | Max accel | Sustained accel | Armament | RPG size |
|---|---|---|---|---|---|---|---|---|---|
| **Rocinante** (ex-MCRN *Tachi*), *Corvette*-class light frigate | MCRN → independent | Multirole frigate: torpedo bomber, boarding insertion | 46 m [RPG][SHOW] | 4,770 t [SHOW wiki infobox]; ~250 t dry / 350 t wet [FAN-CALC ToughSF]; ~230 t [DERIVED cube-scaling from Donnager] | "over a dozen" + 6 marines, max 22 [BOOK per wiki]; 16 / 4 [RPG]; 18 (up to 30) [SHOW] | 12 g flown briefly leaving the Donnager; design max "fifteen or twenty" g, Holden can't remember which [BOOK LW 51]; ~17 g [SHOW per fan] | Multi-hour burns at several g on juice [BOOK]; 5 g over ~10 h [FAN-CALC] | PDC network, full coverage, plus 2 fore torpedo tubes [RPG]. 6× 40 mm PDC, 2 launchers with 10 torpedoes each = 20 [SHOW]. Keel railgun added after AG, firing "two-pound" tungsten slugs [BOOK per wiki]; 1 kg at ~9.98 km/s [SHOW wiki, low-confidence figure] | Large |
| **Donnager**, *Donnager*-class battleship | MCRN, Jupiter fleet flagship | Battleship and carrier | "nearly 500 m", 130-story building [SHOW/WIKI]; 475.5 m [RPG] | "Quarter-million tons" (Alex) [BOOK/SHOW, recall says both] | 2,086 [BOOK LW 16]; 312 min [RPG] | Unknown | Unknown | 14 torpedo bays (6 fore, 8 aft), 2 turreted railguns, full PDC [RPG]. 59× 40 mm PDC, 2× VX-12 "Foehammer" railguns at 80–90 m [SHOW/WIKI-unsourced]. Hangar holds frigates and patrol destroyers | Colossal |
| *Donnager*-class (8 built) | MCRN, later Laconia and the Underground | Battleship | as above | — | — | — | — | as above; "thick hull" [RPG] | Colossal |
| **Scirocco**-class assault cruiser | MCRN | Fast cruiser and troop carrier | 200 m × 72 m [RPG] | — | 430 / 54 [RPG], plus 120 marines | "fast", 4 Epstein drives [RPG] | — | 10 torpedo bays (5 fore, 5 aft), 1 fore railgun, PDCs, grappler cannons, 3 dropships [RPG]. Ship appears only in the SHOW; no book Scirocco | Gigantic |
| **Raptor**-class fast attack cruiser | MCRN | Interceptor cruiser | 282 m [RPG] | — | — | "designed to accelerate rapidly" [RPG] | — | 12 torpedo bays (6 fore, 2 port, 2 starboard, 2 aft), 2 keel railguns (fore and aft), grapplers [RPG]. Two of them plus 4 destroyers beat 6 UNN destroyers [BOOK CW 43] | Gigantic |
| **Hammurabi** | MCRN | Frigate | — | — | — | — | — | Unknown. Carried marines into the Slow Zone [BOOK AG 22, 29] | — |
| *Morrigan*-class patrol destroyer | MCRN | Patrol / picket | 33.5 m × 14 m [SHOW fan chart] | — | 12 [SHOW] | — | — | 2× 40 mm PDC, 2 launchers [SHOW]; some fitted with stealth panels | Medium–Large |
| *Asp*-class fast attack craft | MCRN | Torpedo boat | 23 m [RPG] | — | 4 / 2 [RPG] | very high [RPG flavor] | — | ≥2 PDC, 2 fore torpedo tubes [RPG] | Medium |
| **Truman**-class dreadnought (*Agatha King*, *Okimbo*, *Tripoli*, *Montenegro*) | UNN | Fleet flagship | 376 m [RPG][SHOW]; 110 m wide [SHOW] | — | 1,400 / 256 [RPG] | "just enough thrust to keep from lumbering" [RPG] | — | 2 railguns (fore and aft), 9 torpedo bays (3 fore, 3 ventral, 3 aft), PDC network, grapplers [RPG]. TV adds 22–36 launchers and 42+ PDCs [SHOW] | Gigantic–Colossal |
| *Xerxes*-class battleship (*Thomas Prince*) | UNN | Battleship | 500 m × 200 m [BOOK AG 8 per wiki] | — | 1,400 / 280 [RPG] | — | — | 2 fore railguns, 24 torpedo bays (6 per face), 4 grapplers, full PDC [RPG] | Colossal |
| *Leonidas*-class battleship (*Nathan Hale*) | UNN | Old battleship / troop carrier | 270 m [SHOW] | — | 920 [SHOW] | Poor; old S-250 drives [SHOW] | — | 2 railguns that can't train under thrust, 30 missile tubes, 21 PDC [SHOW] | Gigantic |
| *Munroe*-class light destroyer | UNN | Line destroyer, hunts in groups of 6 | 152 m [RPG] | — | 70 / 18 [RPG] | "not fast" [RPG] | — | 8 PDC, 6 torpedo tubes, 1 keel rapid-fire railgun [RPG per wiki, which cites CW 43] | Huge |
| *Andronicus*-class destroyer | UNN | Sensor / EW destroyer | 132 m [RPG] | — | 64 / 16 [RPG] | — | — | Full PDC, 4 torpedo bays, 1 keel railgun; strong sensors and jamming [RPG] | Huge |
| **Seung Un** | UNN | Fleet support | — | — | — | — | — | Sabotaged by a bomb; crew dumped core and evacuated [BOOK AG 15] | — |
| **Canterbury** ("Cant") | Pur'n'Kleen Water | Century-old ice hauler, ex-colony ship | ~750 m × 250 m [WIKI-unsourced]; 1,000 × 250 m [SHOW] | Hauls glaciers; probably 10⁶+ t loaded [DERIVED, order of magnitude] | ~50 [BOOK LW] | Low; haulers run long low-g burns (recall) | <1 g | None | Colossal–Titanic |
| **Knight** | *Canterbury*'s shuttle | Shuttle | 20 m long, ~10 m diameter, "tea kettle" [WIKI per LW 3] | — | 5 aboard [BOOK] | Fusion torch up to ~7 g; steam RCS ~0.1 g [FAN-CALC] | — | None | Medium |
| **Razorback** | Mao family (Julie Mao) | Racing pinnace | 20 m × 7.85 m [SHOW] | — | 2 [SHOW] | Racing drive; fastest small craft shown. Unknown; 15–20 g plausible [FAN-CALC] | — | Unarmed. Escaped missiles by dumping its core [BOOK NG] | Small–Medium |
| **Pella** | Free Navy flagship (ex-MCRN) | Gunship; "light cruiser" per authors' tweet | — | — | ~12 named crew [BOOK] | High-g pursuit of the Roci [BOOK BA] | — | Torpedoes, PDC, stealth-composite coating [BOOK BA 26]. Damaged by Roci PDCs | Large–Huge |
| **Nauvoo → Behemoth → Medina Station** | LDS → OPA → Free Navy → Transport Union → Laconia | Generation ship → improvised dreadnought → hub station | 2 km+ × 0.5 km [BOOK LW 17]; 2,148 m [RPG]; 2,460 × 960 m [SHOW] | — | 4,000 (7,000) / 986 [RPG]; station 3,000 [BOOK CB 4] | Very low; 8 G-4000 drives [SHOW] | — | Behemoth: heavy railguns, external torpedo bays, PDCs, weaponized comm laser [WIKI-unsourced]; firing a torpedo crashed its power grid; railgun recoil would tear the structure [WIKI, probably AG]. Medina: 1 external bay of 40 missiles [BOOK PR 8] plus PDCs; separate Ring Station railguns | Titanic |
| **Anubis**, *Anubis*/*Amun-Ra*-class stealth frigate (9 built by Protogen at Bush Shipyards) | Protogen | Stealth strike frigate | 55 m [RPG]; 61.5 × 24.2 m [SHOW] | — | ~50 [BOOK]; 50 / 18 [RPG] | — | — | 12 "huge" torpedo tubes for capital-ship busters in a central bay as wide as the Roci [BOOK LW]. RPG: full PDC, 12 tubes, 1 keel railgun. SHOW: 1 internal light railgun, 4 hypercooled retractable PDCs, 2 rapid-reload launchers | Large |
| **Barbapiccola** | Belter refugees | Colony/cargo ship that settled Ilus | ~144 m [SHOW VFX model] | — | — | — | — | Unarmed | Huge |
| **Edward Israel** | Royal Charter Energy | Ex-hauler, colony/research ship | 310 m [SHOW] | — | — | — | — | No weapons, but its old comm laser can be "hacked to cutting strength" [BOOK CB 3] | Gigantic |
| **Chetzemoka** | Naomi → Free Navy | Small transport skiff | — | — | — | No Epstein drive [BOOK NG 19] | — | None. Rigged to lose reactor containment when a ship approached [BOOK NG 35] | Small–Medium |
| *Magnetar*-class battleship (*Heart of the Tempest*, *Eye of the Typhoon*, *Voice of the Whirlwind*; 3 built) | Laconian Imperial Navy | Super-battleship | Unknown; holds "a dozen *Pulsar* destroyers" [BOOK TW 30] | — | Includes marines [BOOK PR 16] | Unknown | — | USM field projector (range under 3,000,000 km [WIKI]), railguns, torpedoes, long-range PDCs [BOOK PR 8]. Self-healing protomolecule-derived hull. Shrugged off EMC torpedo and railgun hits [BOOK PR] | Titanic |
| *Pulsar*-class fast destroyer ("**Storm**-class" to the Underground): *Gathering Storm*, *Rising Derecho* | Laconian Imperial Navy | Fast attack destroyer | Unknown; "tall and sleek" [BOOK PR 8] | — | Marine fireteams, 12 landing craft [WIKI] | High ("fast") | — | 1 keel railgun, 2 torpedo batteries with 4 rails each and fast reload, 12 rapid-fire PDC [BOOK TW 6]. Self-healing hull. ~280 built [WIKI-unsourced] | Huge (guess) |
| **Falcon** | Laconian Imperial Navy | Fast science ship | — | — | ~6 named | ≥30 g using full-immersion liquid crash couches [BOOK TW, via wiki] | — | — | Medium–Large |
| Free Navy ex-MCRN corvettes (*Corvette*-class stolen through Duarte: *Connaught*, *Andreas Hofer*) | Free Navy | Wolf-pack frigates | 46 m [RPG] | — | — | Comparable to the Roci [BOOK BA] | — | As Corvette-class; some coated in stealth composites | Large |
| Belter / OPA gunships (*Tynan*, Drummer fleet, *Bashi Bazouk*) | OPA / Free Navy | Improvised gunships and torpedo boats | *Tynan* 36 m [SHOW] | — | — | Civilian drives | — | External torpedo racks, 1–2 PDCs, breaching pods [SHOW]. Books: "armed Belter skiffs", rock-throwers | Medium–Large |
| *Guy Molinari* | OPA | Converted cargo hauler used as an assault ship | — | — | — | — | — | Breaching pods. The Roci rode in its radar shadow to Thoth [SHOW] | — |

---

## 2. Per-class notes

### Rocinante / *Corvette*-class light frigate
- **Layout** [BOOK]: a "tower" of decks stacked from the drive cone and reactor up through engineering, machine shop, galley and crew deck, medbay, airlock deck, ops, and the cockpit at the nose. Thrust supplies "down". Praxidike Meng: "a big chisel with an upside-down coffee cup on the back" [BOOK CW].
- **Combat record** [BOOK]:
  - Killed both Protogen stealth defenders at Thoth and took a heavy gauss round through the galley and machine shop [LW].
  - Pushed itself to a higher orbit at Ilus by firing the new keel railgun as a thruster when fusion was suppressed [CB].
  - Hull and railgun mounts buckled, and the external hull was replaced from scratch [NG].
  - Against three Free Navy ships including the *Pella*: killed one, drove off the *Pella*, and the third peeled away to deal with Ceres missiles. High-g aiming turns cost a crew member [BA].
- **Disguise kit** [BOOK LF 1]: bolt-on plates that change the silhouette and can be blown off with charges, a drive tuned "just dirty enough" to change its signature, and liquid hydrogen dribbled over the hull to alter the thermal profile. It flew as the freighter *Vincent Soo*.
- **Transponder spoofing** [BOOK LW]: Fred Johnson supplied new transponder codes, and Tycho briefly dressed the Roci as a gas freighter.
- **Notable crew**: Holden, Naomi (XO and engineer), Alex (pilot), Amos (engineer), Bobbie (gunner, later captain), Clarissa (assistant engineer).

### Donnager-class
- Eight built [RPG]. The *Donnager* was lost to a Protogen stealth squadron plus boarders. The captain scuttled the ship ("Condition Zero" in the SHOW) [BOOK LW / SHOW].
- In the SHOW, two torpedoes leaked through the PDC screen; one hit a nacelle "to little effect" and one hit the **reactor core**, after which repeated railgun penetrations knocked out power and PDCs. It killed 4 of the 6 attackers before the scuttle [SHOW].
- The TV railguns are 80–90 m long. Two more mounts sit unused because of reactor-load fears [WIKI-unsourced].

### UNN capital ships
- **Agatha King**: Admiral Nguyen's flagship. Infected by a protomolecule hybrid pod and scuttled by self-destruct. The wiki says Larson pressed the button [BOOK CW, recall-level detail].
- **Truman-class** [RPG]: hammerhead bow, 6 drives, 6 dropship skiffs plus 4 repair skiffs, shorter range than the Donnager-class.
- **Doctrine** [RPG flavor]: UNN ships are mass-produced and massed. The Munroe-class works in six-ship packs, the Andronicus-class trades guns for sensors. MCRN ships are fewer and better.

### Protogen stealth frigates (Anubis / Amun-Ra)
- [BOOK LW]: "looked like a shark… long, lean and utterly black… radar-deflecting curves". Twelve huge torpedo tubes for capital-ship busters.
- It killed the *Canterbury* with torpedoes without being detected beforehand.
- Defense [BOOK LW 39 via wiki]: 4 hypercooled retractable PDCs on the spine, plus chaff and comm lasers used to confuse missile guidance.
- Hull is black composite with active cooling. With the drive cold, its thermal signature blends with an asteroid or the background [WIKI].
- Six of them attacked the Donnager in close formation so they read as one contact at long range [SHOW].

### Behemoth / Medina
- Book canon: 2+ km × 0.5 km; four Donnagers would fit inside [BOOK LW 17].
- The warship refit is a glass cannon: torpedo launches overload the grid, railgun recoil threatens the structure, and reloading is done by drones [WIKI-unsourced; matches AG].
- Ring Station railguns [BOOK AG–PR] are fixed, very large (wiki estimate ~230–250 m), and were destroyed in one shot by the Tempest's USM projector [BOOK PR].

### Laconian ships (Magnetar, Pulsar/Storm, Falcon)
- **Grown, not built**, at the Ring Builder shipyards around Laconia. They have **self-repairing hulls**.
- The Tempest took multiple EMC torpedo and railgun hits "with no effect". It used long-range PDCs and its own railguns and torpedoes. The EMC 2nd Fleet lost about a third of its ships [BOOK PR, Tempest Jovian battle].
- **How the Tempest died** [BOOK TW 32]: earlier battle damage left a **blind spot in its sensor coverage**. The Underground slipped a stolen antimatter canister through the PDC grid there while the *Gathering Storm* distracted it at long range.
  - **Simulator lesson:** sensor damage creates exploitable firing arcs.
- **USM field projector** [BOOK PR]: one-shot kills on ships, stations, and Pallas. Each use causes system-wide time loss of about 3 minutes, which made it strategically self-limiting. Treat it as a scenario superweapon, not a line weapon.
- **Falcon** [BOOK TW]: liquid-immersion couches allow ≥30 g. This is the canonical upper bound for crewed acceleration in the late series.

### Free Navy / Belter ships
- Mostly stolen MCRN *Corvette*-class ships via Duarte, plus Belter conversions.
- Stealth composites from corrupt MCR officials coated both ships (*Pella*, *Shinsakuto*) [BOOK BA 26] and the **asteroids dropped on Earth**, which stayed undetected until impact [BOOK NG].
- Belter gunships are civilian hulls with external torpedo racks and bolt-on PDC turrets. They are fragile, but numerous and cheap.

---

## 3. Green Ronin RPG ship-combat model (a ready-made abstraction)

Sources: Green Ronin's [Space Combat blog post](https://greenronin.com/blog/2019/01/28/the-expanse-space-combat/), a [community summary on HackMD](https://hackmd.io/@startgamecrusaders/rJiyh4qI8), [the Expanse RPG community site](https://expanserpgcommunity.com/2025/09/13/spaceship-qualities-and-damage-control/), and reviews ([Mephit James](https://mephitjamesblog.wordpress.com/2019/04/30/the-expanse-rpg-review-part-2/), [Gnome Stew](https://gnomestew.com/the-expanse-roleplaying-game-review/)).
I did not read the core rulebook itself; a pirated copy surfaced and I skipped it. Values marked *extrapolated* are my fill-ins and should be checked against a legal copy.

### 3.1 Ship statistics
Each ship has **Size**, which sets Hull and crew; **Hull**, damage-soak dice like character Toughness; **Crew** as minimum (standard); **Drive**; **Sensors** (–2 to +6, added to scan and EW rolls and setting the defender's TN); **Weapons**; and **Qualities/Flaws**.

| Size | Length | Crew min (std) | Hull | Example |
|---|---|---|---|---|
| Tiny | 5 m | 1 (2) | *extrapolated: 0 / 1d3* | Breaching pod; torpedoes are treated as Tiny |
| Small | 10 m | 1 (2) | *extrapolated: 1d3* | Razorback |
| Medium | 25 m | 2 (4) | **1d6** [RPG, ship's boat] | Knight, ship's boat |
| Large | 50 m | 4 (16) | **2d6** [RPG, Roci in the official combat example] | Rocinante |
| Huge | 100 m | 16 (64) | *extrapolated: 3d6* | Scopuli, destroyers |
| Gigantic | 250 m | 64 (512) | *extrapolated: 4d6* | Scirocco, Truman |
| Colossal | 500 m | 256 (2,048) | *extrapolated: 5d6* | Donnager, Canterbury (750 m) |
| Titanic | 1 km+ | 1,024 (8,192) | *extrapolated: 6d6* | Nauvoo |

The lengths and crews follow the core-book table as reproduced by a [Fate conversion](https://mechanteanemone.wordpress.com/2020/09/01/the-expanse-in-fate-ship-building/), so treat them as [RPG via fan]. Each step doubles length; crew goes ×4 (min) and roughly ×4–8 (std).

### 3.2 Round structure
A space-combat round is "upward of a minute", and ships act simultaneously.
1. **Command.** The commander rolls a TN 11 Communication (Leadership) test. Success gives 1 Stunt Point (SP) plus SP equal to the Drama Die. These SP can go to any crew test that round.
2. **Maneuvers.** Range bands:
   - **Long** 100–1,000+ km (torpedoes)
   - **Medium** 5–100 km (railguns)
   - **Close** ≤5 km (PDCs, grapplers)

   Holding or changing range is an opposed Dexterity (Piloting) test, with **+1 per size category smaller** than the opponent.
   - **High-g maneuver:** take a +1 to +6 bonus and you may shift **two** range bands. Every crew member makes a Constitution (Stamina) test at TN 8 + the bonus taken; failures take fatigue or damage.
3. **Electronic warfare.** Roll 3d6 + Intelligence (Technology) + Sensors vs TN 11, opposed. The winner gets a bonus equal to half the Drama Die, rounded up.
4. **Weapon attacks.** The attacker doesn't roll; the targeting computer is assumed to point the weapon correctly.

   | Weapon | Range | Damage | Notes |
   |---|---|---|---|
   | PDC | Close | 2d6 | Used offensively at +2 TN; also does point defense |
   | Railgun | Medium | 3d6 | |
   | Torpedo | Long, delivered across bands | 4d6 (plasma 3d6) | Resolved as a **torpedo chase**: the torpedo counts as Tiny with +2 on chase tests |
   | Grappler | Close | 0 | Enables boarding (breaching pods) |
5. **Defensive actions.** The defender rolls:
   - **Evasion:** 3d6 + Dexterity (Piloting) vs TN 10 + attacker's Sensors
   - **Point defense:** 3d6 + Sensors vs TN 10 + attacker's Sensors
6. **Attack damage.** Damage minus the rolled Hull total. If any damage remains, the ship takes **Losses**: each minor loss cancels 1d6 and each serious loss cancels 2d6, up to two losses per hit. Any remainder after that destroys or disables the ship.
7. **Damage control.** Roll 3d6 + Intelligence (Engineering) vs TN 11. A success threshold of 5 repairs one loss and 10 repairs two. **Hull and Collateral losses can't be repaired in combat.**

### 3.3 Losses (damage conditions)
| Loss | Effect |
|---|---|
| Hull | –1 to Hull totals after rolling; cumulative |
| Reactor Offline (serious) | Main drive down: no high-g maneuvers, –2 to evasion |
| Sensors | –1 Sensors per loss |
| Maneuverability / Handling (thrusters) | Penalty to maneuver tests |
| Weapons | A weapon system is out |
| Collateral | Crew injuries; characters take damage |

### 3.4 Stunts (spent from command and test SP)
| SP | Stunt | Effect |
|---|---|---|
| 1+ | Guidance | +1 per SP to a maneuver, EW, evasion, point-defense, or damage-control test |
| 1+ | Blinding Maneuver | Enemy Sensors –1 per SP (minimum –2) until next round. This models "point your drive plume at them" |
| 2 | Multi-Targeting | PDCs can attack and defend in the same round without penalty |
| 2+ | On-Target | +1 TN per 2 SP to evade your weapons |
| 2+ | Tactics | +1 per 2 SP to the enemy commander's next TN |
| 3+ | Evasive Action | +1d6 Hull per 3 SP against incoming damage |
| 3 | Perceived Weakness | +1d6 damage on one successful hit |
| 4 | Precise Hit | One hit inflicts an extra Loss |
| 4+ | Set-Up | Maneuver the enemy into a hazard; damage = ½ SP rounded down, in d6 |

### 3.5 Ship qualities and flaws (partial)
- **Stealth Coating:** –2 to enemy tests to notice, target, or identify; an extra –1 at long or extreme range; –1 to enemy EW at medium range or beyond. Stops working after 3+ Hull losses until reapplied.
- **Backup Reactor / Coupled Reactor / Parallel Reactors** (Large and up):
  - Backup: an automatic or manual restart path.
  - Coupled: ignore the first Reactor Offline serious loss.
  - Parallel: take two Reactor Offline losses before losing main power.
  - All three add the *High Maintenance* flaw and cut cargo space.
- **Paramilitary Refit:** a Small ship gets 1 torpedo launcher or railgun; a Medium ship gets 2 launchers, 2 railguns, or 1 high-charge railgun.
- **Emergency reactor restart** is a skill challenge: threshold 20, 1 test per minute, TN 13–15. Failures escalate through radiation damage (1d6 up to 4d6) to a forced core dump or "game over".

### 3.6 How to use this in a simulator
The RPG gives a clean **discrete-state** layer that sits well on top of continuous physics:
- **Range bands → weapon eligibility.** Long means torpedoes, Medium adds railguns, Close adds PDCs and grapplers.
- **Hull soak scaled by size.** Damage is ~3.5 per d6, so a Large ship soaks about 7 per hit and a Colossal one about 17.5.
- **Typed losses** instead of HP. Reactor, sensors, thrusters, weapons, crew.
- **Sensors as the attacker's TN modifier.** Better sensors make your shots harder to dodge or intercept.

The RPG also makes pilot skill matter about as much as hull size, which fits the books.

---

## 4. Sensors, detection, and stealth

### 4.1 What the books establish
- **Drive plumes are very bright.**
  - An Epstein plume is visible across enormous distances. Fleets track each other by drive flare with telescopes, and light-lag sets the age of every track [BOOK throughout].
  - A ship under thrust effectively can't hide. Stealth works only **coasting with the drive cold** [BOOK; WIKI stealth page].
- **Transponders** [BOOK LW]: every legal ship broadcasts an ID. Spoofed codes, as Fred gave the Roci, are a primary disguise method. Ships flying dark (no transponder) are suspicious by default.
- **Active sensors** [BOOK/SHOW]:
  - Radar and lidar give range and velocity.
  - Lidar "painting" for targeting lock is treated as a hostile act and is detectable by the target.
  - The Roci's threat board shows tracks; its PDCs and torpedoes fire from computer firing solutions.
- **Passive sensors:** IR and visible telescopes, plus intercepting comm lasers. Laser comm is directional and hard to intercept; radio broadcasts are not.
- **Jamming / EW:**
  - The Donnager's attackers jammed its communications [SHOW].
  - Protogen ships used comm lasers and chaff to confuse missiles [BOOK LW 39 via wiki].
  - Torpedoes can be spoofed and are themselves jammed (recall; see weapons thread).
- **Stealth materials:**
  - Protogen: black radar-absorbent composite with angular radar-deflecting curves and active cooling, so the hull matches asteroid temperature when the drive is cold [BOOK LW / WIKI].
  - Free Navy: MCR stealth composites coated both ships and **asteroids that reached Earth undetected** [BOOK NG]. The only warning came when one rock broke up and a science ship saw the debris field [WIKI-unsourced].
  - The Underground's old stealth ships used "old stealth composites and internal **heat sinks**" and were still "not bad" decades later [BOOK TW 41].
  - Laconian self-healing plating has some stealth properties [WIKI-unsourced].
- **Signature management, short of true stealth:**
  - Run the drive "dirty" to change its spectral signature [BOOK LF].
  - Change the hull's thermal profile with cryogens [BOOK LF].
  - Bolt on plates to change the silhouette [BOOK LF].
  - Hide in a bigger ship's radar shadow, or drift as fake jettisoned cargo [SHOW Thoth].
  - Hide behind moons or stations [SHOW].
- **Sensor damage is decisive.** The Tempest's sensor blind spot let an antimatter canister through [BOOK TW 32]. The Tempest had already lost some sensor capability earlier [BOOK TW].

### 4.2 Detection-range guidance [DERIVED / FAN-CALC]
- **Drive plume:** a TW-class fusion exhaust is detectable at **AU scale**, effectively system-wide, by IR or visible telescope.
  - ToughSF estimates ~97 TW fusion power and ~60 TW thrust power for the Roci ([ToughSF](http://toughsf.blogspot.com/2019/10/the-expanses-epstein-drive.html)).
  - Atomic Rockets' position is "no stealth in space" while thrusting.
- **Cold, coasting stealth hull:** detection range scales with emitted IR. Halving surface temperature cuts emission 16× and detection range only 4× (Stefan–Boltzmann). Heat sinks buy **hours to days**, not indefinitely.
- **Active radar/lidar on a stealth hull:** practical lock ranges are short. In canon, stealth ships were "seen" only when they fired or lit their drives (Canterbury, Thoth). For a simulator: stealth hulls can't be locked beyond roughly 1,000–10,000 km until they thrust or fire, and non-stealth hulls can be locked at roughly 10⁵–10⁶ km. These are invented tuning values, not canon.

---

## 5. Damage and survivability model

### 5.1 What kills ships, roughly fastest first
1. **Reactor containment failure ("bottle failure").** The magnetic bottle fails and the ship becomes a brief small star.
   - Used deliberately as a scuttle: Donnager [BOOK LW], Agatha King [BOOK CW].
   - Used as a booby trap: Chetzemoka [BOOK NG 35].
   - Caused by a hit: in the SHOW the Sagarmatha's reactor housing was "splintered" by missiles in the aft.
   - Engineers **dump core** (vent the plasma) to prevent it. The ship survives but loses its drive until restart. Examples: Seung Un [BOOK AG 15], EMC Ontario [BOOK PR 27].
2. **Torpedoes** that get past the PDCs. The Canterbury, a 750 m-class civilian hull, died to them in one strike [BOOK LW]. Capital ships absorb more hits, but a leaker on the reactor or drive is decisive [SHOW Donnager].
3. **Railgun slugs** make through-and-through penetrations.
   - They are small holes, but they wreck whatever they cross: reactor housing, CIC, crew.
   - The Roci survived a heavy gauss round through two decks [BOOK LW].
   - The Donnager died to accumulated railgun penetrations once power failed [SHOW].
   - TV dialogue suggests a Truman-class railgun can "perforate the full mass" of a target within ~1,000 km [SHOW/WIKI].
4. **Boarding** after the PDCs and drive are suppressed: breaching pods, power armor. Donnager [BOOK LW], Gathering Storm captured [BOOK PR 49].
5. **The crew's own acceleration.** [BOOK BA, LW]. High g is a damage source in itself.
6. **Exotic:** antimatter (the Tempest), the USM projector, Ring gamma bursts, slow-zone dampening (reactors suppressed at Ilus [BOOK CB]).

### 5.2 Survivability features
- **Compartmentalized "tower" decks with pressure doors** [BOOK].
  - Crews suit up for combat.
  - Ships may pull or vent atmosphere before battle to limit fire and explosive decompression [SHOW; books describe suited combat; recall].
- **Distributed PDC coverage** [BOOK/RPG]: full-sphere PDC networks are standard on military hulls. Capital ships carry dozens (59 on the Donnager [SHOW], 170 on the Behemoth [WIKI]).
- **Armor:**
  - MCRN hulls are "thick", built to take hits that would destroy lesser ships [RPG].
  - The SHOW Roci gets "carbon silicate lace plating" in season 6.
  - Laconian hulls self-heal [BOOK].
  - No canonical armor thickness exists.
- **Redundant reactors** (RPG qualities), a backup drive on thrusters only, and escape shuttles. Many hulls must carry shuttles by regulation [RPG; Knight in BOOK LW 1].
- **Crash couches and the juice** let crews survive combat burns. Liquid-immersion couches push the limit to ≥30 g [BOOK TW].

### 5.3 Drive-plume damage
The exhaust is a hot fusion plasma jet moving at roughly 1–7 % of c [FAN-CALC]. It destroys anything it washes over at short range (the "Kzinti lesson").
- In canon, the Razorback **dumped its core** to destroy missiles chasing it [BOOK NG].
- The SHOW *Tynan* had to evade a pirate ship's core dump [SHOW S4].
- Docking and near-station procedures avoid pointing the drive at structures (recall).
- For a simulator, model a **damage cone** behind any thrusting ship: high damage within ~1–10 km, falling off quickly with distance [DERIVED, tunable]. Model core dump as a one-shot area attack behind the ship that also disables its own drive.

---

## 6. Recommended simulator defaults

Every value here is a tuning default, not canon. Where canon exists, it is cited in §1.

| Class | Length | Mass | Max accel | Combat sustained | Cruise | PDCs | Torpedo tubes / magazine | Railguns | Hull (RPG soak) | Sensors (RPG –2..+6) |
|---|---|---|---|---|---|---|---|---|---|---|
| Torpedo boat / fast attack (Asp, Belter gunship) | 20–35 m | 100–300 t | 15 g | 8 g | 1 g | 2 | 2 / 6–8 | 0 | 1d6 | 0 |
| Light frigate (Rocinante, Corvette-class) | 46 m | 300 t* | 12 g (burst; 15 design) | 6–8 g on juice | 1 g | 6 | 2 / 20 | 0, or 1 keel (refit) | 2d6 | +2 |
| Stealth frigate (Anubis) | 55 m | 400 t | 10 g | 6 g | 1 g | 4 | 2 / 12 (heavy) | 1 keel | 2d6 + Stealth Coating | +2 |
| Patrol destroyer (Morrigan) | 34 m | 200 t | 12 g | 6 g | 1 g | 2 | 2 / 8 | 0 | 1d6–2d6 | +1 |
| Destroyer (Munroe / Andronicus / Pulsar) | 130–150 m | 5–10 kt | 10 g | 5 g | 1 g | 8–12 | 4–8 / 24–40 | 1 keel | 3d6 | +2 (+3 Andronicus or Pulsar) |
| Cruiser (Scirocco / Raptor) | 200–280 m | 30–60 kt | 8 g | 4 g | 1 g | 20–30 | 10–12 / 60 | 1–2 | 4d6 | +3 |
| Battleship (Donnager / Truman / Xerxes) | 375–500 m | 250 kt (Donnager canon) | 6 g | 3 g | 0.5–1 g | 40–60 | 9–24 / 150+ | 2 turreted (Donnager) or 2 fixed | 5d6 | +3 |
| Laconian Magnetar | ~800–1,000 m+ | 1 Mt+ | 6 g | 3 g | 1 g | long-range PDCs | many | several | 6d6 + self-repair (regain 1 Hull loss every N rounds) | +4 |
| Civilian hauler (Canterbury) | 750 m | ~1 Mt loaded | 1 g | 0.3 g | 0.3 g | 0 | 0 | 0 | 5d6 (soft, no armor) | –1 |
| Shuttle / pinnace (Knight, Razorback) | 20 m | 20–50 t | 7 g (Knight) / 15–20 g (Razorback) | 3 / 10 g | 1 g | 0 | 0 | 0 | 1d6 | –1 / +1 |
| Behemoth (improvised) | 2,000 m+ | ~10 Mt+ | 0.3 g | 0.1 g | 0.1 g | 170 | 6 bays / drone reload | 6 (can't fire safely) | 6d6, with power-grid fragility | +1 |

\* For Roci mass, cube-scaling from the Donnager's 250,000 t gives ~230 t and ToughSF gives 250–350 t; the TV infobox's 4,770 t is the outlier. Pick 300 t unless collisions or railgun momentum need a heavier value.

**Human limits:**
- 1 g is comfortable indefinitely.
- 3–5 g is sustainable for hours on couches with the juice.
- 8–12 g is sustainable for minutes to tens of minutes on juice, with risk to the old or injured.
- 15–20 g is a short burst only.
- ≥30 g needs Laconian liquid couches.

Apply an RPG-style Constitution check, or a cumulative injury probability, that scales with g and duration.

**Systems model:** replace HP with an RPG-style hull soak plus typed losses (Reactor, Drive, Sensors, Thrusters, Weapons per mount, PDC per mount, Crew). Give reactor hits a small chance to escalate to containment failure unless the crew dumps core, which costs the drive.

**Range bands:** Close ≤5 km, Medium 5–100 km, Long 100–1,000+ km [RPG]. Extend with an "Extreme" band beyond ~10,000 km where only torpedoes and passive tracking work [DERIVED].

**Stealth:**
- With the drive off and stealth coat on, enemy detection and targeting rolls get –2 (–3 at long range or beyond) [RPG].
- Lighting the drive or firing any weapon removes stealth for that round and the next [DERIVED from canon behavior].
- The coat degrades after 3 Hull losses [RPG].

---

## 7. Gaps and uncertainty

- **Acceleration per class is almost entirely uncanonical.** The only hard book numbers are the Roci (12 g flown; 15–20 g design max) and the Falcon (≥30 g). Battleship, cruiser, and destroyer g limits are guesses. The RPG Drive ratings per ship weren't obtainable without the rulebook.
- **Masses:** only the Donnager (250,000 t) is quotable. Roci estimates span 230 t to 4,770 t.
- **RPG hull dice** for Tiny, Small, Huge, Gigantic, Colossal, and Titanic are extrapolated. Only Medium (1d6) and Large (2d6) are confirmed. Per-ship RPG Sensors and Drive ratings and the full qualities/flaws list are missing. **Next step:** read SotE chapter 4 and core chapter 6 from a legally owned copy.
- **Book weapon counts** (number of PDCs and torpedoes per ship) are mostly unstated. PDC counts here come from the SHOW or the RPG.
- **Armor:** no canonical thickness or material spec beyond "thick" (MCRN), black composite (Protogen), and self-healing (Laconia).
- **Detection ranges:** no canonical numbers. The bands in §4.2 are invented tuning values.
- **Several "(recall)" items** need checking against the text: Donnager "quarter-million tons" in the book (it is definitely in the show), venting atmosphere before combat, Agatha King's scuttle details, and the Behemoth weapon list.
- The **Pulsar fleet size (280)** and **USM range (<3,000,000 km)** are wiki-unsourced.
- The wiki pages for Pella (TV), Hammurabi (TV), and Agatha King (TV) were fetched but not mined in depth. The show-tier data is thin there by design.

## Sources
- Expanse fandom wiki pages pulled through the MediaWiki API (Rocinante, Donnager, Donnager-class, Corvette-class, Truman-class, Xerxes, Munroe, Andronicus, Raptor, Scirocco, Asp, Leonidas, Morrigan, Anubis/Amun-Ra, Nauvoo, Magnetar, Pulsar, Gathering Storm, Heart of the Tempest, Falcon, Chetzemoka, Edward Israel, Barbapiccola, Razorback, Knight, Canterbury, Free Navy, Stealth technology, Dumping core, USM field projector, Tempest Jovian battle). Raw dumps are in the session scratchpad.
- [Green Ronin: The Expanse Space Combat](https://greenronin.com/blog/2019/01/28/the-expanse-space-combat/)
- [HackMD space-combat summary](https://hackmd.io/@startgamecrusaders/rJiyh4qI8)
- [Expanse RPG community: qualities and damage control](https://expanserpgcommunity.com/2025/09/13/spaceship-qualities-and-damage-control/)
- [Fate conversion with the RPG size table](https://mechanteanemone.wordpress.com/2020/09/01/the-expanse-in-fate-ship-building/)
- [ToughSF: The Expanse's Epstein Drive](http://toughsf.blogspot.com/2019/10/the-expanses-epstein-drive.html)
- [Rocky Mountain Navy: Expanse ships in Traveller](https://rockymountainnavy.com/2017/02/26/theexpanse-ships-in-travellerrpg/) (cites LW ch. 51)
