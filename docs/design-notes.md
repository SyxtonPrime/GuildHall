# Guildhall (formerly Riftwardens) — design notes

Artifact: https://claude.ai/artifact/Q94BUTLmfaqPHnYZGTGXKD (single HTML file; engine script is DOM-free and can be simulated headlessly in node). Local working file is still named riftwardens.html; localStorage keys still rw_meta_v1 / rw_run_v2. Standalone export: `/home/claude/Guildhall.html` (proper doctype/head wrapped around the artifact's body; rebuilt after every change and attached in chat).

**Two chats edit this artifact.** The art chat publishes sprite/gear work to the same URL (e.g. v29's base 1790546875-527a added gear sockets). Before publishing, always `read` the live artifact and diff against the local copy; adopt the live file as the base when it's newer.

**Theme (v15):** plain dungeon crawl, no rift lore. Title "Guildhall" is a placeholder. Fight button "Descend", difficulty "Dungeon depth", 60 s cutoff = "time runs out", win = "Dungeon cleared".

## Run structure, paths & bonus events (v34)
- Floors 1–12 (+ endless). **Floor 1 is a plain fight. Every 4th floor is a mandatory boss. Every other floor is fight vs elite** (`genChoices` no longer offers the forge). Endless follows the same rule.
- **Bonus events (v34):** after winning each act's 2nd fight (`run.floor%4===3` when entering the next camp, endless included) the camp shows a **Bonus** strip above the path chips with **two events** (`rollEvents()` picks 2 eligible from `EVENTS`) plus **Skip**; Descend reads "Choose a bonus first" until one is done or skipped (`run.bonus={opts}`; `finishBonus()`). The market stays usable, so you can buy before forging/retiring. Opening an event and pressing "Not now" keeps the bonus pending.
  - **Gem Forge** (`openForge`): unchanged composite fusion (needs ≥2 non-composite gems).
  - **Enchanter** (`openEnchanter`, `ENCHANTS=2`): flip up to two sockets (any hero, locked sockets too) weapon ⇄ armor. Stored as `h.flip=[k…]`; `slotKind(k,h)` honours it everywhere (stats, Equip badges, gem sheets). Gear art is unchanged; the kind badge gets a ✦. Max-HP guard applies.
  - **Gem Cutter** (`openCutter`, `CUTS=2`): up to two cuts, each turns an owned gem (loose or socketed) into another with the same essence count — basic ⇄ basic, 2-essence rare ⇄ 2-essence rare, 3 ⇄ 3; composites can't be cut. Max-HP guard.
  - **Retirement** (`openRetire`): a hero leaves; another permanently gains half the retiree's base HP and ATK at their ★ (`retireGift`), stored as `h.giftHp/h.giftAtk` and added in `computeStats`; retiree's gems go loose. Needs ≥2 heroes. Hero sheet shows "inherited +X HP +Y ATK".
  - **Scout's Camp** (`openScout`): choose which of **this act's** bosses you face (current + the other two from `bossPool(floor)`). v34 briefly allowed any act's boss with rescaling (`bossNorm`/`enc.norm`, still in the engine but now always null); the user disliked cross-act bosses, so v35 added bosses instead.
  - Rejected: Mastery Shrine (too close to the forge), Wandering Hero; Black Market / free relic / free socket (gold can buy those).
- **Act boss** is decided at the start of each act (`rollActBoss`, `run.bosses[actKey]`, `bossPool(floor)`), shown in the camp header (`.bossprev`), and drawn on the boss-floor Descend button.
- Run state: `run.choices`, `run.pick`, `run.enc`, `run.bonus`, `run.merged`, `run.mergeN`, `run.bosses`. `loadRun()` drops a stale forge path choice from older saves.
- Camp layout (one screen at 360×780): header → Bonus strip (when pending) → Choose strip (Fight · +Ng / Elite · +Ng · free gem / Boss · free relic) → Market (Freeze / Reroll; hero tiles; compact gem strip — icon + green +N over gold price (v33); relic row) → Guild cells → Loose gems → Relics → sticky Descend.
- Elite fights pay +2g and a free gem pick (one rare guaranteed); elite unit ×`ELITE_BOOST=1.15`.
- **Composite gems** (engine): `defineMergedGem(id,parts)` → `GEMS[id]={merged:true,parts,ess:union,rare:3,name:'A · B'}`; `gemLeaves`, `restoreMergedGems`; not re-fusable or cuttable.
- Bot (`tune.js`): fight vs elite (`ELITE_P` 0.7); on the bonus it forges if it can (`NOEVENT` disables); `ENDLESS=1` continues past 12 (cap 60) and prints endless death-floor quantiles.

## Balance (v34)
- **Curve:** `enemyMult(floor,depth) = 0.7 · Π growth(f) for f=2..floor · (1+0.10·depth) · (floor≥9 ? ACT3_BOOST=1.12 : 1)`. Per-floor growth `ACT_GROWTH=[1.10, 1.12, 1.13]` by act, but an act's rate starts after its first floor (`floorGrowth(f)` uses `actOf(f−1)`) so act entry is no cliff; **endless `ENDLESS_GROWTH=1.20` per floor** (×2.07 every 4 floors). Act 1 identical to v32. Env overrides for the bot: `G1 G2 G3 GE ACT3`. Mult at floor 4/5/8/9/12/13/16/20: 0.93/1.02/1.44/1.81/2.61/3.13/5.40/11.2.
- Enemy HP ×2.1, ATK ×1.25; elites ×1.15.
- Bot (1500 runs, depth 0, with bonus forges): win 24% → 14%. Per-floor loss Act 1 unchanged (2: 12%, 3: 5%, 4: 1%); Act 2 23/13/9/10% (was 20/9/8/8); Act 3 37/26/19/19% (was 27/18/8/12). Endless death floor (bot) median 23 → 15, p90 43 → 20. User reports Act 3 felt easy for a human and endless dragged, so the bot's Act 3 numbers are expected to overstate difficulty.
- **Hard caps (v33.3):** dodge ≤ 75% (`DODGE_CAP`, stats and roll), attack speed ≤ 3/s (`SPD_CAP` in `effSpd`), Rogue on-kill chain ≤ 8 (`KILL_CHAIN_MAX`); Death Blossom fires once per regular swing. Unbounded but finite: shield, Berserker rage, poison stacks.
- History: v11 25%; v12 62%; v13 20%; v14 16%; v17 → 1.115; v18 → 1.11; v21 → 1.115; v23 → 1.10; v27 28%; v28 26%; v28.1 24%; v28.2 22–24%; v29–v30 22%; v31 17% (paths); v32 12% (Act 3 ×1.12); v34 14% with forging bot (act growth + endless ramp).

## Visual pass (v32.1–v33.2)
- v32.1/32.2: boss preview sprite only; Prismatic Lens gem info lists essence effects (`rareFx`).
- v33/33.1: compact market gem strip; essence palette Venom `#9be15d`, Ember `#ff5c3a`, Frost `#8fe3ff`, Ward `#5b8cff`, Edge `#f0f0f8` (blade glyph `execedge`), Vital `#ff7ab8`, Swift/dodge `#c47bff`, Gilt `#ffd166`; every shop rare has its own glyph over its essence gradient; all gems stay diamonds (relics are the hexagons). Backup of v32.2 kept as `riftwardens_v32.2_backup.html`.
- v35: unit ATK/SPD line is one fixed 12 px row (9 px, no wrap) so two-digit stats never grow a card.
- v33.2: battle rows are always reserved (invisible `.unit.ghost` placeholder) so summons/moves never shift the arena; statuses are fixed-height colour badges with the stack number (`.stx`).

## Market freeze (v26 → v32) · Playback (v31.6/31.7)
- Freeze carries the current stock to the next market **once**, then switches itself off (`rollShop(false)` clears `run.frozen` after applying it); paid reroll also unfreezes.
- Battle speed buttons 0.5× / 1× / 2× / 3× / Skip; `speed` is the real-time multiplier (one 50 ms step per 50 ms tick at 1×), saved in `meta.speed` so it persists across runs; Skip (99) is momentary — the next fight restores `meta.speed`.

## Art (pixel sprites)
- Sprite gallery: https://claude.ai/artifact/AJCyHxvrRcsr9rz7nzBKcE. All 17 new enemies wired in (v23). Every class (61, one sprite each, id = class name in lowercase letters, see `art/sprites/README.md`) and enemy (34 + Slimelet) has a sprite: 16×16 regular, 24×24 elites/bosses. Text grids `SPR`/`SPR_PAL`, `buildPixelSprites()` → `SPR_URI`, `spr(id,size,title)`, `spr:'slime'` aliasing, `ic()` fallback.
- **Gear sockets (art chat):** `EQUIP[heroId]={s,r,l}`; `h.gems[k]` per gear slot (nullable); `hspr(h,size)` draws gems into sockets and tints gear. Helpers `gemsOf`, `putGem`, `takeGem`, `firstFree`, `openSlots`.
- Relic icons: SVG glyphs (`RELIC_C`, `RELIC_G`). Battle animation: `B.anim`, `rerender(side,mover)` FLIP for `B.move`/`B.spawn`/`B.vanish`.
- Pixel-art conventions: no solid-black hat brims; props without outline boxes; bows are 1-px arcs; one clear "tell" per unit. Source: `sprites.py` + `fixes/<id>.txt` + `preview.py` in the art working folder.

## Gear slots & unlocking (v29)
- Heroes are hired with `open:[0,1]` (weapon + body). On the Equip screen each locked slot is an **Unlock · Ng** button (5g, then 9g); `unlockSlot(h,k)` adds k to `h.open` and `h.lv++` (★ = slots unlocked; +15% HP/ATK per star). Older saves fall back to the first `lv+1` slots. Equip screen: 46 px sockets in one row, 28–30 px gem icons.

## Weapon vs armor essences (v30)
- Slot kinds: **0 weapon & 3 off-hand = hand**, **1 body & 2 head = armor** (`HAND_SLOTS`, `slotKind(k,h)` — per-hero Enchanter flips in `h.flip`, `slotCounts`). `gemFx(g,activeKind)` renders both effect lines with WEAPON/ARMOR tags.
- `GEM_HAND={wardShield:1,vitalHeal:2}`, `GEM_ARMOR={spikes:2,dodge:0.08}`: Venom/Ember/Frost — hand: attacks apply +1 · armor: attackers gain 1. Ward — hand: +1 Shield per attack · armor: +1 Armor & 5 start Shield. Edge — hand: +15% crit · armor: spikes 2. Vital — hand: heal 2 per hit · armor: +12 HP & regen. Swift — hand: +15% speed · armor: +8% dodge. Gilt — hand: +1 gold per kill · armor: +1 gold per win.
- Reactive effects in per-hero `gemHooks`. Rare gems: no passives; Prismatic Lens applies 3-essence passives by socket kind. Tuning deltas (weapon/armor): Venom +29/+23, Ember +37/+33, Frost +40/+40, Ward +29/+36, Edge +18/+19, Vital +33/+31, Swift +30/+35.
- **Max-HP guard (v30.1):** `tryPut`/`tryTake` refuse changes that would leave `maxHpRaw < 1`; engine clamps `maxHp ≥ 1`.

## Board & battle UI
- `ROW_MAX=4` cells per row both sides; guild cap 3 → 5 purchasable. Summons (`u.summon`) fade out when they fall and free their cell. Spawn rules: requested row → other row → none; ≤6 living enemies. Names 9.5 px with `fitNames()`; stars vertical beside the sprite; HP bar shows `hp/max` when max changed.

## Rows & "mid" heroes (v24 → v28.7)
- Rogue and Duelist are `mid` (start in the back). Duelist **Riposte** (KS): `riposte` + `vanguard`; **Dancing Blade** (KKSF): +20% dodge, dodge → 2 Chill. Rogue **Shadowstep** (KS): `retreat` (<66% HP, once, unconditional); **Venom Dance** (KKVS) no repeat. Rogue 38 HP / 6 ATK, Duelist 40 HP.
- Monk **Serenity** (SSS): +15% dodge, dodge → 4 Shield, `weave`; **Inner Peace** (SSSH): dodge heals 5 + `meditate` (5% max HP/s in the back row).

## Relics (v28)
- Tiers common/rare/legendary with pills; shop offers one relic every floor (65/30/5); boss spoils 3 choices with one Legendary; all owned → 10 gold. Common: Warhorn, Blood Pact, Bulwark Standard, Hunting Horn, Cracked Hourglass, Deep Purse, Drums of War, Glacial Core, Lucky Coin, Steam Engine, Rally Banner, Merchant's Scales. Rare: Plague Banner, Kindling, Wildfire, Mirror Ward, Resonance, Phoenix Feather, Cloak of Shadows, Skirmisher's Boots, Tithe Box, Iron Discipline. Legendary: Smoke Bomb, Marching Orders, Necromancer's Grimoire, Contract of Blood, Prismatic Lens, Overflowing Chalice, Twin Aegis. Use `u.hero` for real heroes.

## Per-depth records (v26)
- `meta.depthStats[d] = {bestEndless, bestStreak, streak}` shown on the title for the selected depth; streak breaks on a pre-clear death or abandoning an uncleared run.

## Enemies & encounters (v23)
- `ENCOUNTERS[act]`: 6 themed templates per act; endless rolls Act 2/3 themes. Elites `{1:[hydra],2:[ogre,minotaur],3:[hydra,minotaur]}`, bosses `{1:[goblinking,ratking,broodmother],2:[lich,vampirelord,banshee],3:[rifttitan,bonedragon,pitlord]}` (v35).
- **v35 bosses** (placeholder 24×24 sprites drawn in this chat — the art chat can replace them; source grids in `scratchpad/bosses/spr.py`): **Rat King** (front 100/6/0.9) every 5 s two Rats join, +1 ATK per Rat alive · **Broodmother** (front 120/6/0.8) attacks apply 2 Poison, a **Spiderling** (new minion 8/2/1.2, 1 Poison, uses the spider sprite) hatches at 75/50/25% HP · **Vampire Lord** (front 125/6/0.9) heals half the damage he deals; at half HP he becomes untargetable for 3 s (`veilUntil`, now respected for enemies too) and three Bats join · **Banshee** (back 110/6/0.9, 30% dodge) every 4 s every hero gains 2 Chill · **Pit Lord** (front 170/9/0.7, 1 Armor, Burn-immune) every 2 s every hero gains 1 Burn, ×1.25 vs Shielded. Constants `BANSHEE_CHILL, PIT_BURN, RK_EVERY, RK_N, BR_N`.
- Bot boss-floor loss with each boss forced (`BOSS=<id>` env in tune.js, 1500 runs): Act 1 Goblin King 8% (v35.1: 110/7 → 130 HP / 9 ATK; was 2%) · Rat King 8% · Broodmother 11%; Act 2 Lich 10% · Vampire Lord 12% · Banshee 12%; Act 3 Stone Titan 25% · Bone Dragon 24% · Pit Lord 26%. Rejected: Spore Queen (too like Lich), Alpha Wolf (too punishing early), Orc Warlord, Hoard Mimic, Gorgon, Troll Chieftain. Elite fights have 2+act enemies; fights 3–6; endless 6. Each enemy has a mechanic.

## Core loop
- Autobattle, 50 ms steps, 60 s limit, any lost fight ends the run. Guild 3 slots (+6g, +10g; +1 Contract). Market each floor: 3 heroes, 3 gems, 1 relic. Gold: start 12; win = 3 + act (+2 elite, +4 boss) + interest (1 per 5, cap 3) + gem/skill gold ± bounty. Hero 3g, gem 3g, dual rare 5g, triple rare 6g, slot unlock 5g / 9g, reroll 1g +1 (−1 Scales).

## Endless (v22) · Reaper (v20) · Statuses
- Clearing floor 12 unlocks the next depth and offers Endless. Depth d = enemies × (1 + 0.1·d), no ceiling. Reaper +3 max HP per kill (cap +60). Poison stacks/tick then −1; Burn `BURN_DMG=2` × stacks then halves; Chill −10% speed per stack (max 5); Shield first; Armor flat (min 1).

## Gem system
- 8 basic gems with socket-dependent passives; 2/3/4 open slots at ★/★★/★★★ (player picks which). 10 skills per hero; recipes count essences regardless of socket; rare gems = essences + bonus/drawback; composites = union of parts, not re-fusable. Combined skills should share essences (4-slot limit).

## Balance tooling (scratchpad)
- `tune.js N depth` (fight vs elite, bonus forge, sockets; env `ELITE_P`, `NOEVENT`, `ENDLESS`, `G1 G2 G3 GE ACT3`, `NAIVE`, `FORCE_RELIC`, `EVEN`, `ENGINE`; prints deaths by floor), `arena.js`, `slotab.js`.
- Playwright: `mv.js`, `fz.js`, `st.js`, `mock4.js`, `rel.js`, `van.js`, `allrel*.js`, `unl.js`, `gk.js`, `forge.js`, `camp2.js` (compact camp), `ev.js` (all five bonus events), `mkt.js`/`gemmock.js` (mock-ups), `bt.js` (battle rows), `chain.js` (caps), plus inline checks for speed timing, sticky footer, boss preview, one-shot freeze.

## Unlocks (meta, localStorage)
Plague Doctor: beat Act 1 boss · Bard: reach floor 8 · Reaper: 150 lifetime kills · Frost Mage: win a run · Depth N+1: win at depth N.

## Ideas not yet built
Proper name, more fight variants (Bounty, Gauntlet, Ambush), Cursed Shrine with its own cursed relics, socket-art variants for enchanted sockets, a real STS-style map, more summoner heroes, endless modifiers, seeded/daily runs, sprite animation frames, gem/relic pixel icons, dedicated Slimelet sprite, socket-kind variants for rare gems, a forge icon. Relic ideas not chosen: Hourglass of Second Chances, Gambler's Die, Chained Fate, Echo Chamber, Timekeeper's Watch, Merchant's Ledger, Whetstone, Honeyed Words.
