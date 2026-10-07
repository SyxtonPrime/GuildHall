# Hero refactor plan

Working notes for replacing the 18 fixed heroes with the class tree in `design/gem-recipe-bench/`. The bench holds the classes and skills; this file holds the rules they rely on and the engine changes those rules need.

Each item is marked **Decided**, **Proposed** (suggested, not yet agreed) or **Open**.

## Class tree and promotion

- **Decided.** The tree has four layers:
  - Roots: Mage, Warrior, Rogue. Not hired directly.
  - Starters: 8 classes, one per essence. These are what the market sells.
  - Tier 3: 20 classes with two essences.
  - Capstones: 33 classes (8 with three of one essence, 25 with four essences).
- **Decided.** Promotion is permanent and happens at training. Training already strengthens a hero and unlocks a gem slot; it will also move the hero up one tier if the gems socketed at that moment meet a higher class's requirement. If several requirements are met, the player chooses. A hero cannot train if they do not have the requirement to satisfy any teir.
- **Decided.** Essences must be socketed; a hired Frost mage does not count as having Frost. Late in a run, shop heroes may come with gems already socketed.
- **Decided.** Each class lists exactly four upgrades. Not every class whose essences fit is a valid upgrade.
- **Decided.** Passives stack along the route, and skills learned on earlier classes are kept.
- **Decided.** A hero has three open slots at its second training, so a four-essence capstone cannot be met with basic gems. Hybrid capstones are gated behind rare or fused gems. We may need to add some new rare gems to help with this.

## Roots

- **Decided.** A starter with two possible roots is assigned one at random. The root sets its stats and a starting passive.
- **Decided.** Root passives:
  - Mage: whenever this hero's attack applies a status, apply 1 more. Whenever this hero heals, heal 1 more.
  - Warrior: heal 1 every 2 seconds, +1 Armor.
  - Rogue: 1 gold at the end of each round.
- **Decided.** Mage's extra stack joins the same application; it is not a second application. It applies only to statuses the attack itself applies on hit, including gem and on-hit passive amounts, so area effects, waves and event skills are unaffected and the Elementalist's mirror copies the amount after the root's +1 without adding its own. Mage's heal bonus applies only to heals from the hero's class abilities, not gem regeneration or lifesteal.
- **Decided.** Roots have no skills of their own.
- **Decided.** The sprite depends only on the current class.

## Skill layout

- **Decided.** Four skills per class, twelve per finished hero, three at each gem count:
  - Starters: three 1-gem skills and one 2-gem skill.
  - Tier 3: two 2-gem and two 3-gem skills.
  - Capstones: one 3-gem and three 4-gem skills.
- **Decided.** A starter's three 1-gem skills are splashes, one for each hybrid upgrade, and need only that one essence. Its 2-gem skill needs two of its own essence and points at the mono upgrade.
- **Decided.** A mono tier 3 class has no skill at its own two-gem recipe, because the starter's 2-gem skill already sits there. Its two 2-gem skills are splashes and one of its 3-gem skills is the triple.
- **Decided.** Capstones: four skills drawn from 3-, 4-, 5- and 6-gem recipes. Every capstone has at least one 5- or 6-gem "super-power" skill. (The fixed layouts 1/2/1/0, 0/2/2/0 and 0/2/1/1 were the first cut; group 1 already uses 1/2/0/1 and 1/1/1/1, so the rule is the floor, not the shape.) These need the gem forge (rare or fused gems) and may be impossible without it; two 5+ skills on one class should be near impossible to hold together but need not be literally impossible.
- **Decided.** No capstone skill's recipe is a subset of the class requirement, so nothing switches on automatically at promotion. The capstone's reward is its passive and four strong skills to aim for.
- **Decided.** Gems come after heroes: a pass to add missing rare gems once all classes are written. Some classes being very hard to reach is acceptable.

## Status rework

Statuses apply to heroes and enemies alike. Each has a keyword state reached at a threshold.

### Chill and Frozen (threshold 20)

- **Decided.** Each Chill stack slows attack speed by 2.5%, up to 20 stacks (50%). Stacks can go above 20 but the slow does not.
- **Decided.** When a unit with fewer than 20 Chill attacks, its Chill halves.
- **Decided.** A unit with 20 or more Chill is Frozen. Its next attack deals half damage and consumes 20 Chill. At 40 or more it deals a quarter and consumes 40, and so on. The remainder is not halved on that attack.
- **Decided.** Halving for Frozen is applied before flat damage reductions.

### Burn and Ablaze (threshold 10)

- **Decided.** Burn deals 1 damage per stack each second (down from 2) and halves each second.
- **Decided.** A unit that reaches 10 Burn is Ablaze: its Burn no longer decays below 10. It stops being Ablaze only if Burn is removed to below 10, for example by a cleanse.
- **Proposed.** Later skills may raise a hero's Ablaze threshold, which raises the floor with it.

### Poison and Festering (threshold 15)

- **Decided.** Poison is unchanged: 1 damage per stack each second, ignoring Armor and Shield, losing 1 stack each second.
- **Decided.** A unit with 15 or more Poison is Festering: its Armor counts as 0 and it cannot be healed or gain Shield.

### Combined keywords

- **Decided.** An enemy that is Frozen and Ablaze at the same moment becomes Brittle for the rest of the fight. Every application of Chill or Burn to a Brittle enemy applies 1 more stack, joining the same application. Brittle is not a affliction. Frostburn's larger bonus is keyed to Brittle.
- **Proposed.** An enemy that is Frozen and Festering at the same moment becomes Crippled for the rest of the fight and loses a quarter of its attack speed. Like Brittle it is permanent and is not a affliction. Brittle is the casters' shared jackpot (Elementalist); Crippled is the blades' (Frostblade, Cutthroat).
- **Decided.** An enemy that is Ablaze and Festering at the same moment is Blighted for the rest of the fight: it takes 25% more damage from statuses.
- **Decided.** An enemy that is Frozen, Ablaze and Festering at the same moment is Ruined for the rest of the fight: it takes 50% more damage from all sources, and it is also Brittle, Blighted and Crippled. Combined keywords are permanent and are not afflictions. Prismatic magus and Spellblade are the classes built around Ruined.

### Heroes

- **Decided in principle.** Keep the rules symmetric. At today's enemy application rates only Festering is reachable on a hero (from spiders); Frozen and Ablaze are not.

## Rules for writing skills

- **Decided.** Skills should be conditional or build-around, not flat stat bumps. Similar classes get different hooks (Frost mage sets up one target; Fire mage spreads).
- **Proposed.** No two skills on one class share a recipe.
- **Decided.** Use flat numbers early. Damage is rounded to whole numbers and starter hits are 3 to 6, so modifiers under about 20% do nothing early.
- **Proposed.** Skills that remove or consume a status appear only on capstones. An inherited skill whose recipe sits inside a later class's requirement cannot be switched off.
- **Decided.** Avoid once-per-fight limits; repeatable triggers make better combos. Tone a trigger down only if it proves too strong. Several sources give Shield repeatedly (Protector, a Ward weapon gem, Hearthguard), so "when its Shield breaks" effects should be priced as firing about once a second.
- **Decided.** Gilt is not only income. As an option, not a rule, a Gilt skill can give a prepared-for-the-fight advantage (a guaranteed first crit, a dodged first attack) where a gold payout would be dull.
- **Decided.** On-heal effects trigger on any heal the hero performs. Class abilities should avoid per-second regeneration, which would retrigger them every tick; Plague doctor is the upgrade most likely to need care here.
- **Proposed.** Every hero has a base 10% crit chance, so crit skills and the Swordsman's passive work without an Edge gem.
- **Decided.** "Affliction" is the collective term for Frozen, Ablaze and Festering (formerly "affliction").
- **Decided.** Percentage bonuses multiply. A Healer with Renew heals an ally below a quarter HP for 1.5 × 1.5 of the base amount.
- **Proposed.** No effect makes an enemy skip attacks outright.
- **Proposed.** Later passives are written as increments on earlier ones ("also", "+1 more") because passives stack. The Healer's heal gets a name (Mend) so Cleric and Paladin can modify it.

## Starters

The eight starters and their skills are settled as of the 5 October 2026 snapshot in `design/gem-recipe-bench/recipes.json`. Tier 3 and the capstones are still first drafts and have not been checked against the rules above.

Watch list from the starter pass:

- Protector (Sentinel) gains 2 Shield whenever another ally is attacked and has no ceiling. Any tier 3 or capstone effect that scales with Shield, such as Shieldmaiden's bonus damage, needs a cap. Drop Protector to 1 if it proves too strong.
- Fan the Flames (Fire mage) needs an Ablaze enemy, which a starter cannot produce alone. It comes alive at Flamecaller.
- Cutthroat's passive duplicates the Swordsman's Pristine Gear, and Bulwark's passive is weaker than Protector. Both need new text in the tier 3 pass.
- Tainted Coin (Poisoner) and the Thief's passive are the remaining gold payouts on starters; the Thief's is capped at 3 per fight.

## Tier 3

Worked through in five sets of four, grouped by role so that lookalikes are compared side by side: status (Rimecaller, Flamecaller, Plaguecaller, Elementalist), blades (Duelist, Frostblade, Cutthroat, Mercenary), walls (Shieldmaiden, Glacier Warden, Hearthguard, Monk), menders (Blood mage, Cleric, Plague doctor, Apothecary), tempo and coin (Windrunner, Berserker, Bard, Merchant). Each class gets a niche before it gets skills.

- **Decided.** Status roles: Fire is wide and hits everything. Poison is tall and stacks on one target, which can be a small enemy or a big one. Chill is defensive and can go either way.
- **Decided.** Fire spreads while the enemy is alive (Fan the Flames). Poison is inherited when the enemy dies (Plaguecaller). No Fire skill spreads on death.
- **Decided.** Targeting is mostly random, so skills should not depend on a hero staying on one target.
- **Decided.** Set 1 niches and passives:
  - Rimecaller: the fastest route to Frozen. Every 4th attack applies 5 Chill. Always targets the enemy with the most Chill. (Trial number, to be set with the bot. With two Frost gems in the weapon it applies 4 Chill per attack, and by hand Chill on its target settles near 14, so it Freezes unaided only now and then; at 10 it settles near 18 and Freezes most cycles. A Freeze resets the build-up, so frequency changes smoothly with the number.)
  - Flamecaller: keeps Burn on every enemy. Every 4th attack applies 3 Burn to every enemy. (Wave size proposed.)
  - Plaguecaller: builds one Poison stack and carries it from corpse to corpse. When a Poisoned enemy dies, all its Poison moves to the lowest-HP enemy.
  - Elementalist: applies both at once. Whenever its attack applies Burn it applies an equal amount of Chill, and the reverse. The mirrored application does not mirror again.
- **Decided.** Keywords should not be cheap. A tier 3 class should reach it now and then unaided and reliably only with a third gem or a partner.
- **Decided.** Weapon gems add 1 of their status per attack, so a mono tier 3 mage applies 4 per attack before skills (class 1, Mage root 1, two gems). Sums must include this.
- **Open.** Status numbers are flat while enemy HP grows about fourfold across a run (`enemyMult` times `ENEMY_HP`: roughly ×1.5 on floor 1, ×3 on floor 8, ×5.5 on floor 12). Ordinary minions have about 50 to 130 HP in Act 2 and 115 to 350 in Act 3. Frozen and Festering are proportional and keep their value; Ablaze's 10 a second and small flat Burn do not. Tier 3 and capstone numbers should be judged against Act 2 and Act 3 enemies.
- **Decided.** A hit that applies a status does not count as hitting a target with that status. The hit that Freezes an enemy is not a hit against a Frozen enemy.
- **Decided.** An area effect is one status application per enemy. Brittle adds 1 to each; the Mage root does not apply, since it only affects the attack's own statuses.
- **Decided.** The duel: the Duelist challenges the enemy opposite him once per fight. The two must target each other and take half damage from anyone else's hits; status damage is unaffected. Bounty hunter keeps challenging new enemies; Champion's taunt only affects the rest. "Untargetable" means a unit cannot be chosen as a target; row-wide attacks still hit it.
- **Decided.** Set 2 niches: Duelist isolates one enemy and wins the duel alone; Frostblade runs a crit-and-Chill loop and hunts Frozen enemies; Cutthroat is an untargetable striker who converts a partner's Poison into crit damage; Mercenary snowballs on kills (+20% damage per kill this fight) and is best against crowds. Skills are in `recipes.json`. Mercenary's Shared Contract triggers gem on-kill effects too, by choice: Gilt gems and the skill add no damage, so the gold costs a slot.
- **Decided.** A class may carry one "out-there" skill whose recipe uses none of its own essences (Elementalist's Give and Take, Frostblade's Cold Blood). With three slots it costs a class gem, which is the point.
- **Decided.** Set 3 niches: Shieldmaiden is the offensive wall (Shield is ammunition); Glacier Warden the mitigation wall (attackers gain Chill and don't halve it, so persistent attackers Freeze); Hearthguard the engine wall (attackers gain Burn, Burn damage anywhere feeds his Shield); Monk the evasion wall (+15% dodge, counterattacks). Skills are in `recipes.json`.
- **Decided.** Targeting priority: a forced target (Branding Blow) overrides "always targets" rules (Rimecaller, Frost Stalker) but not the duel.
- **Decided.** A hybrid tier 3 class need not have a skill at its own two-essence recipe (Cutthroat, Glacier Warden).
- **Decided.** Menders heal on events, not timers, because every heal is an on-heal trigger. Cleric heals when an ally's Shield breaks (prevention); Blood mage's attacks heal for the damage dealt at a cost in her own HP (rescue); Plague doctor heals once a second, 1 per Poisoned enemy and 2 per Festering one (offensive sustain; one heal event a second so on-heal triggers fire once, not per tick). Apothecary is not a healer: she buffs, giving an elixir to the fastest-attacking ally so their attacks apply Poison. Skills are in `recipes.json`.
- **Decided.** Removing a status from a hero (cleansing or transferring) is allowed on tier 3. The capstone-only rule covers removing or consuming statuses on enemies.
- **Decided.** Set 5 niches: Windrunner follows up on row-mates' crits; Berserker ramps attack speed over a fight; Bard is a team attack-speed aura with event bursts; Merchant turns the hoard into a party damage bonus. Economy budget per class: at most one pure economy skill and one or two partial ones (Merchant: Fast Talker is pure; the passive's gold and Deep Pockets' interest are partial). Bard's gold is gone. Skills are in `recipes.json`.
- **Decided.** All 20 tier 3 classes have niches, passives and skills as of 6 October 2026. Next: recheck the known contradictions below against the new text, then the capstones.
- **Proposed.** Capstone passives that now duplicate a tier 3 passive need rewriting as increments: Nightblade (Cutthroat's untargetable opener), Lava strider (Hearthguard), Blade dancer (Duelist's Footwork).
- **Decided.** Set 1 skills are in the bench as of the 6 October 2026 snapshot. Numbers are untested.

## Contradictions pass, 6 October 2026

Checked every starter → tier 3 route with the parent's passive and skills stacked on the new tier 3 text.

Resolved by the tier 3 pass:

- Duelist → Champion: the duel no longer blocks other targeting, and the opponent is locked onto the Duelist anyway.
- Duelist → Bounty hunter: the Duelist challenges once; Bounty hunter keeps challenging (capstone text still to update).
- Fire mage or Frost mage → Elementalist: the mirror passive stacks on either parent's "attacks apply 1".
- Frostblade or Rimecaller → Bladestorm: nothing on tier 3 removes Chill any more.
- Windrunner into a duel: a half-damage hit, not a contradiction.
- Duelist → Blade dancer: Footwork gives the Duelist dodge, so the dodge capstone follows.
- Rimecaller and Flamecaller passives duplicating Frozen and Ablaze: rewritten.

Still open, for the capstone pass:

- Role flips: Glacier Warden → Frost Stalker (a wall that targets the back row), Berserker → Flame dancer (Bloodrush wants to be hit, Flame dancer wants to dodge).
- Capstone passives that duplicate a tier 3 passive or skill and need rewriting as increments: Nightblade (Cutthroat's opener), Lava strider (Hearthguard), Blade dancer (Footwork), Icemaiden (Consecrate), Silver tongue (Fast Talker), Bounty hunter (the duel).
- Capstone skills that still refer to 5 Chill, the old Frozen, Burn's old decay or removing statuses.
- Rimecaller → Frost Stalker stacks two "always targets" rules; needs a priority (Frozen first is the suggestion).

Rulings the pass produced:

- **Decided.** Extra attacks (Windrunner follow-ups, Monk counterattacks, Cascade) advance "every Nth attack" counters like any other attack.
- **Decided.** Targeting priority, highest first: the duel; a forced target (Branding Blow); class targeting rules (Rimecaller, Frostblade's next attack, Grave Tonic); random.
- **Decided.** Crimson Tide's "her target" is the enemy she last attacked.
- **Decided.** When two class targeting rules stack along a route (Rimecaller's most-Chill under Frost Stalker's back row), the later class's rule wins. A lock-on (Stalk) beats both.
- **Decided.** Virulence triggers only when the Plaguecaller's own attack crosses 8 Poison, not when an inherited stack arrives above it.
- **Decided.** Shared Contract triggers inherited on-kill skills too (a Thief-route Mercenary dodges after an ally's kill).

Overlaps that are intended as starter-to-tier-3 previews, not bugs: Scald and Brittle, Side Effects and Rounds, Backdraft and Hearthfire, Cold Iron and Glacier Warden's passive (the +1 still counts), Pristine Gear and Ambush.

Watch list from the pass:

- Rally stacks per heal and the Cleric heals on every Shield break, so a tank under fire can sit at +45% attack speed. Priced as intended; check in the bot.
- Vault (Acrobat) leaps a Berserker or Monk to the back row below half HP. Battle Trance and the Monk's counterattacks want to be hit. Anti-synergy, not a contradiction.
- Protector, the Shieldmaiden's passive and Phalanx are all uncapped; a Sentinel-route Shieldmaiden is the first thing to check for runaway Shield.
- Two Step with a Windrunner: dodges give crit, crits give follow-ups. Bounded by Two Step not stacking and follow-ups dealing half damage.

## Capstones

33 classes, in seven groups by role, as tier 3 was:

1. Casters: Cryomancer, Pyromancer, Venomancer, Prismatic magus, Spellblade.
2. Blades: Blademaster, Bladestorm, Nightblade, Assassin, Bounty hunter.
3. Walls: Bulwark, Champion, Icemaiden, Lava strider, Runeguard.
4. Menders: Vampire, Paladin, Herald, Witch Doctor, Reaper.
5. Dancers: Blade dancer, Flame dancer, Storm dancer, Shadow Archer, Frost Stalker.
6. Coin: Guildmaster, Silver tongue, Alchemist, Heretic.
7. Oddballs: Necromancer, Necrodancer, Phoenix, Firebomber.

Layout and reachability are settled under "Skill layout"; rare gems come after the heroes.

- **Decided.** All 33 capstones have passives and skills in `recipes.json` as of 6 October 2026. A script check confirms every class has four skills, no capstone recipe is a subset of its requirement, and every capstone has a 5- or 6-gem skill.
- **Decided.** Capstone passives are increments on the tier 3 passive beneath them (Nightblade, Lava strider, Icemaiden, Paladin, Blade dancer, Bounty hunter, Champion), and define the mechanic themselves where a route lacks it (Bounty hunter's and Champion's duel, Nightblade's untargetable window).
- **Decided.** "Stalwart" is the keyword for elites and bosses: they can't be Charmed or turned (Silver tongue). Blind, statuses and keywords still work on them.
- **Decided.** Summons: a Necromancer Skeleton is a copy of the dead enemy at half its max HP with no abilities. Wilfred (Necrodancer) is a companion with her own stats, still to be written.
- **Open.** Engine mechanics the capstones introduce: blind (next attack misses), Charm (slow and weaken, and Turncoat's side switch), summons, revive, row leaps, a lock-on target, "gold counts double" (Golden Age), permanent run-long stat gains (Bounty hunter's ATK, Reaper's souls), and the three new combined keywords.
### Capstone contradictions pass, 6 October 2026

Checked every tier 3 → capstone route with the parent's passive and skills and the grandparent's passive stacked.

Fixed in the bench:

- Footwork (Duelist) now caps at +30% crit, since Blade dancer adds its own +5% per dodge and a long duel would otherwise reach 100%.
- Elemental Rush (Spellblade) halves from 100% after a guaranteed crit, so Ambush (Cutthroat) can't chain it forever.
- Reaper collects souls only from her own kills, so Shared Contract (Mercenary) pays her heal but not her collection.

Rulings:

- **Decided.** Splash hits (Bladestorm's row hits, Shatter, Shield Slam, Volley, Firewind's adjacent hit) are plain hits: they are not crits, apply no on-hit statuses, and don't advance "every Nth attack" counters.
- **Decided.** Follow-ups, counterattacks and forced attacks go where their trigger says, ignoring the hero's own targeting rule (a Shadow Archer's Windrunner follow-up hits the row-mate's target, not the highest ATK).
- **Decided.** A capstone passive written as "X more" stands alone as X on a route whose tier 3 lacks the base (Lava strider from Flamecaller, Nightblade from Frostblade).
- **Decided.** Summons (Skeletons, Wilfred, a turned enemy) count as allies for auras, heals, elixirs and targeting, but not as heroes for hero-count effects (Many Hands). Skeletons rise without statuses. A Phoenix revive happens before Legion would raise it.
- **Decided.** Several overheal effects (Cleric's Shield, Crimson Tide, Blood Moon) all fire on the same overheal; none consumes it.
- **Decided.** Wager pays once per fight, on the first duel won.
- Redundancies left as is: Deep Pockets' cap doubling does nothing under Guildmaster (its interest clause still does); Frost Rim and Icemaiden's passive both cover her own Shield breaking.

Watch list, in the order I'd bot them:

1. Prismatic magus with Convergence: her attacks apply all three statuses, so every enemy she touches is Ruined on the first hit. Six gems, but "touch = Ruined" may need an affliction requirement.
2. Venomancer with Fixation: a 20-stack opener that never decays, follows the kill, and is always her target.
3. Bulwark from Shieldmaiden: half-max-HP Shield into an uncapped quarter-of-Shield damage bonus, then Shield Slam.
4. Paladin from Cleric with Rally: two heals per Shield break, each stacking +15% attack speed.
5. Bladestorm with Whiteout and Cascade, on the Frostblade route.
6. Heretic from Monk with Apostate: five seconds of guaranteed crit counterattacks.
7. Pyromancer with Supernova: Stoked's 50% and Flashover's full bonus from the first second.
8. Alchemist's Caustic Crit: it reads as all Poison damage on enemies, from any source, using her crit chance.

## Engine and content changes

- `applyStatus`, `effSpd` and `tickStatus` in `game/guildhall.html` for the new Chill, Burn and keyword rules; `BURN_DMG` from 2 to 1.
- Existing enemies: Imp, Fire Elemental and Pit Lord lose half their Burn damage and need retuning. Basilisk's Petrify (double damage at 5 Chill) needs a new condition. More enemies should apply small amounts of status, so skills that move or cleanse statuses have something to work with.
- Dodge. A Monk can stack Acrobat's front-row 20%, its own 15%, up to three Swift armour gems at 8%, Composure's 20% and Flow's pity bonus, and on the Healer route Quick Hands plus the Healer's timed heal is a guaranteed dodge every 3 seconds. Revisit how dodge scales before adding a cap: ideally 100 stacked dodge should not mean never being hit (diminishing returns, or dodge as a rating rather than a percentage).
- Enemy Shield: only the Mimic has any today. Add enemies that start with or gain Shield, and give some bosses Shield, so that Smelt (Flamecaller), Festering's no-Shield clause and Shield-breaking effects have something to work on.
- Existing relics that read Chill stacks or multiply Burn damage need rechecking.
- Rare gems: 19 of the 25 hybrid capstones contain an existing rare gem's essences, so they can be met in three slots. Six cannot and currently need a fused gem: Paladin, Herald, Flame dancer, Silver tongue, Champion and Bladestorm. New rares for Ward + Vital, Swift + Gilt, Ember + Swift, Frost + Edge and Ward + Edge would cover all six.
- Hero data: classes, routes, root assignment, promotion at training, inherited skills.
- Row movement during a fight: Vault (Acrobat) and Lightning Step (Storm dancer) move a hero between rows mid-fight. The engine needs a leap that re-evaluates who can target the hero. More dancer skills could use it once it exists.
- Gold held: Merchant's hoard bonus, Hired Guards, Pre-dosed, Stockpile, Hit List and Rare Reagents all scale per gold in the bank, mostly per 10. Nobody knows what a typical bank looks like mid-run (it may be under 10). Measure it with the bot before tuning those thresholds.
- `tools/tune.js`: the bot must learn to promote before any balance numbers mean anything.
- Stats and rows for every root and class. The bench has none.
- Art: about 13 of the 61 playable classes match an existing sprite by name. Each new class also needs a gear-socket spec.

## Suggested order

1. Status rework on the current heroes, so it can be tuned with the existing bot.
2. Starters with roots and promotion to tier 3.
3. The 8 mono capstones.
4. Hybrid capstones, once the slot-timing question is settled.
