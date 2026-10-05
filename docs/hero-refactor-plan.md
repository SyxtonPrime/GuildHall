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
  - Mage: whenever this hero applies Chill, Burn or Poison, or heals, apply 1 more.
  - Warrior: heal 1 every 2 seconds, +1 Armor.
  - Rogue: 1 gold at the end of each round.
- **Decided.** Mage's extra stack joins the same application; it is not a second application. Mage's heal bonus applies only to heals from the hero's class abilities, not gem regeneration or lifesteal.
- **Decided.** Roots have no skills of their own.
- **Decided.** The sprite depends only on the current class.

## Skill layout

- **Decided.** Four skills per class, twelve per finished hero, three at each gem count:
  - Starters: three 1-gem skills and one 2-gem skill.
  - Tier 3: two 2-gem and two 3-gem skills.
  - Capstones: one 3-gem and three 4-gem skills.
- **Decided.** A starter's three 1-gem skills are splashes, one for each hybrid upgrade, and need only that one essence. Its 2-gem skill needs two of its own essence and points at the mono upgrade.
- **Open.** On capstones, one 4-gem skill uses the class's exact requirement and the other two swap one essence each, so they are alternative loadouts unless the hero holds rare or fused gems.

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

- **Open.** "Crippled" is reserved for a Chill and Poison combination. One proposal: when a Festering enemy becomes Frozen (or the reverse) it is Crippled for the rest of the fight and loses a quarter of its attack speed. Whether Chill with Burn and Burn with Poison get the same treatment is undecided.

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
- **Decided.** "Serious condition" is the collective term for Frozen, Ablaze and Festering.
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

## Known contradictions in the current drafts

Found by checking all 128 routes with passives and inherited skills stacked.

- Duelist → Champion: the duel makes him untargetable by others; Champion forces enemies to attack it.
- Duelist → Bounty hunter: the duel fixes his target; Bounty hunter targets the highest-HP enemy.
- Frost mage or Fire mage → Elementalist: "attacks alternate between Burn and Chill" conflicts with a starter passive that applies one of them every attack.
- Frostblade or Rimecaller → Bladestorm: Brittle and Shatter remove Chill and end Frozen, against Bladestorm's own skills.
- Role flips: Glacier Warden → Frost Stalker, Berserker → Flame dancer, Duelist → Blade dancer.
- Windrunner's follow-up attack can target an enemy inside an allied Duelist's duel.
- Many tier 3 and capstone skills still refer to "5 Chill", the old Frozen, or Burn's old decay, and need rekeying to the keywords above. Rimecaller's and Flamecaller's passives duplicate what Frozen and Ablaze now do.

## Engine and content changes

- `applyStatus`, `effSpd` and `tickStatus` in `game/guildhall.html` for the new Chill, Burn and keyword rules; `BURN_DMG` from 2 to 1.
- Existing enemies: Imp, Fire Elemental and Pit Lord lose half their Burn damage and need retuning. Basilisk's Petrify (double damage at 5 Chill) needs a new condition. More enemies should apply small amounts of status, so skills that move or cleanse statuses have something to work with.
- Existing relics that read Chill stacks or multiply Burn damage need rechecking.
- Rare gems: 19 of the 25 hybrid capstones contain an existing rare gem's essences, so they can be met in three slots. Six cannot and currently need a fused gem: Paladin, Herald, Flame dancer, Silver tongue, Champion and Bladestorm. New rares for Ward + Vital, Swift + Gilt, Ember + Swift, Frost + Edge and Ward + Edge would cover all six.
- Hero data: classes, routes, root assignment, promotion at training, inherited skills.
- `tools/tune.js`: the bot must learn to promote before any balance numbers mean anything.
- Stats and rows for every root and class. The bench has none.
- Art: about 13 of the 61 playable classes match an existing sprite by name. Each new class also needs a gear-socket spec.

## Suggested order

1. Status rework on the current heroes, so it can be tuned with the existing bot.
2. Starters with roots and promotion to tier 3.
3. The 8 mono capstones.
4. Hybrid capstones, once the slot-timing question is settled.
