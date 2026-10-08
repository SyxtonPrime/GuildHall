// ---------- Classes (the hero tree) ----------
// CLASS_DATA is the gem recipe bench's snapshot (design/gem-recipe-bench/recipes.json), inlined by tools/build.js. Roots (Mage, Warrior,
// Rogue) have no essences and are never hired; starters have one essence, tier 3 two, capstones three or four. A hero is {id: its current
// class, root, path: every class it has been, lv, gems, open, row}. Training (unlockSlot) promotes it to an upgrade whose essences its
// gems meet; the old class's skills stay with it. Effects live in HOOKS, keyed by class name then skill name ('passive' for the class
// passive); a skill with no entry shows its text and does nothing yet. See docs/hero-refactor-plan.md.
const ESS_ORDER=['venom','ember','frost','ward','vital','edge','swift','gilt'];
const ESS_LETTER={venom:'V',ember:'E',frost:'F',ward:'W',vital:'H',edge:'K',swift:'S',gilt:'G'};
const needLetters=ess=>ess.slice().sort((a,b)=>ESS_ORDER.indexOf(a)-ESS_ORDER.indexOf(b)).map(e=>ESS_LETTER[e]).join('');
const ROW_MAX=4; // cells per row, both sides
// Where each class stands. Stats are a sum along the route: the root's base plus one contribution per class, by role and tier,
// so a capstone reached by two routes has different stats. 'mid' classes start in the back row and may move.
const CLASS_ROLE={
 Swordsman:'front','Fire mage':'back','Frost mage':'back',Thief:'mid',Acrobat:'mid',Poisoner:'back',Healer:'back',Sentinel:'front',
 Duelist:'mid',Mercenary:'mid',Flamecaller:'back',Elementalist:'back',Berserker:'front',Hearthguard:'front',Frostblade:'mid',Rimecaller:'back',
 'Glacier Warden':'front',Merchant:'back',Bard:'back',Windrunner:'mid',Cutthroat:'mid',Apothecary:'back',Plaguecaller:'back','Plague doctor':'back',
 Monk:'front','Blood mage':'back',Cleric:'back',Shieldmaiden:'front',
 Blademaster:'mid',Bulwark:'front',Cryomancer:'back',Guildmaster:'back',Pyromancer:'back','Shadow Archer':'back',Vampire:'mid',Venomancer:'back',
 Alchemist:'back',Assassin:'mid','Blade dancer':'mid',Bladestorm:'mid','Bounty hunter':'mid',Champion:'front',Firebomber:'back','Flame dancer':'mid',
 'Frost Stalker':'mid',Herald:'back',Heretic:'mid',Icemaiden:'front','Lava strider':'front',Necrodancer:'back',Necromancer:'back',Nightblade:'mid',
 Paladin:'front',Phoenix:'front','Prismatic magus':'back',Reaper:'mid',Runeguard:'front','Silver tongue':'back',Spellblade:'mid','Storm dancer':'mid','Witch Doctor':'back'};
// Gear slots come from the class tree: a starter names its two, and each promotion adds one of the kind the new class names
// (W weapon, A armor), so a hero's sockets follow its route. Up to four of a kind: an extra slot takes a socket of the other kind,
// flipped (the ✦ badge). The Enchanter's flips (h.ench) sit on top.
const CLASS_SLOTS={
 Sentinel:'AA',Swordsman:'WA',Poisoner:'WW','Fire mage':'WW','Frost mage':'WW',Healer:'WA',Acrobat:'WA',Thief:'WA',
 Apothecary:'W',Bard:'A',Berserker:'W','Blood mage':'W',Cleric:'A',Cutthroat:'W',Duelist:'W',Elementalist:'W',Flamecaller:'W',Frostblade:'W',
 'Glacier Warden':'A',Hearthguard:'A',Mercenary:'W',Merchant:'A',Monk:'A','Plague doctor':'W',Plaguecaller:'W',Rimecaller:'W',Shieldmaiden:'W',Windrunner:'W',
 Blademaster:'W',Bulwark:'A',Cryomancer:'W',Guildmaster:'A',Pyromancer:'W','Shadow Archer':'W',Vampire:'W',Venomancer:'W',
 Alchemist:'A',Assassin:'W','Blade dancer':'A',Bladestorm:'W','Bounty hunter':'W',Champion:'A',Firebomber:'W','Flame dancer':'A','Frost Stalker':'W',
 Herald:'A',Heretic:'W',Icemaiden:'A','Lava strider':'A',Necrodancer:'A',Necromancer:'W',Nightblade:'W',Paladin:'A',Phoenix:'A','Prismatic magus':'W',
 Reaper:'W',Runeguard:'A','Silver tongue':'A',Spellblade:'W','Storm dancer':'W','Witch Doctor':'W'};
const ROOT_STATS={Mage:{hp:32,atk:5,spd:0.9,armor:0,row:'back'},Warrior:{hp:48,atk:5,spd:0.85,armor:1,row:'front'},Rogue:{hp:36,atk:6,spd:1.1,armor:0,row:'mid'}};
const ROLE_GAIN={ // [starter, tier 3, capstone]
 front:[{hp:14,atk:1,spd:0,armor:0},{hp:22,atk:2,spd:0,armor:1},{hp:30,atk:3,spd:0,armor:1}],
 mid:[{hp:8,atk:2,spd:0.05,armor:0},{hp:14,atk:3,spd:0.1,armor:0},{hp:20,atk:4,spd:0.1,armor:0}],
 back:[{hp:4,atk:3,spd:0,armor:0},{hp:8,atk:4,spd:0.05,armor:0},{hp:12,atk:5,spd:0.05,armor:0}]};
const BASE_CRIT=0.1; // every hero crits 10% of the time before gems
// Sprites: every class has its own sprite, keyed by its name in lowercase letters (art/sprites/fixes/<id>.txt); roots show their first starter's look.
const ROOT_SPR={Mage:'frostmage',Warrior:'sentinel',Rogue:'thief'};
// Effects live in HOOKS (engine/hooks.js, loaded before this file).
const CLASSES={};
for(const id in CLASS_DATA.classes){ const c=CLASS_DATA.classes[id]; const tier=c.ess.length>=3?3:c.ess.length; const H=HOOKS[c.name]||{};
  CLASSES[id]={id,name:c.name,ess:c.ess.slice(),from:(c.from||[]).slice(),passive:c.passive||'',notes:c.notes||'',tier,role:CLASS_ROLE[c.name]||(ROOT_STATS[c.name]||{}).row||'mid',need:needLetters(c.ess),skills:[],def:Object.assign({},H.passive||{})}; }
for(const rid in CLASS_DATA.recipes){ const r=CLASS_DATA.recipes[rid]; const c=CLASSES[r.classId]; if(!c) continue; const H=(HOOKS[c.name]||{})[r.name]||{};
  c.skills.push(Object.assign({id:rid,name:r.name,need:needLetters(r.need),desc:r.effect||'',cls:c.id,clsName:c.name},H)); }
for(const id in CLASSES) CLASSES[id].skills.sort((a,b)=>a.need.length-b.need.length||a.name.localeCompare(b.name));
const ROOTS=Object.keys(CLASSES).filter(id=>CLASSES[id].tier===0), STARTERS=Object.keys(CLASSES).filter(id=>CLASSES[id].tier===1);
const upgradesOf=id=>Object.keys(CLASSES).filter(k=>CLASSES[k].from.includes(id));
const rootOf=id=>{ let c=CLASSES[id]; while(c&&c.tier>0) c=CLASSES[c.from[0]]; return c?c.id:null; }; // a class's first root, for display before a hero exists
const routeTo=id=>{ const p=[id]; let c=CLASSES[id]; while(c&&c.tier>0){ c=CLASSES[c.from[0]]; p.unshift(c.id); } return p; };
const classStats=(rootId,path)=>{ const r=ROOT_STATS[CLASSES[rootId].name]; const s={hp:r.hp,atk:r.atk,spd:r.spd,armor:r.armor,crit:BASE_CRIT,dodge:0};
  path.forEach(id=>{ const c=CLASSES[id]; if(c.tier===0) return; const g=ROLE_GAIN[c.role][c.tier-1]; s.hp+=g.hp; s.atk+=g.atk; s.spd+=g.spd; s.armor+=g.armor; }); s.spd=Math.round(s.spd*100)/100; return s; };
// HEROES: what the UI reads per class (name, row, typical stats along the first route, ability text)
const HEROES={};
for(const id in CLASSES){ const c=CLASSES[id]; if(c.tier===0) continue; const s=classStats(rootOf(id),routeTo(id));
  HEROES[id]={name:c.name,row:c.role,tier:c.tier,tags:[GEMS[c.ess[0]].arch],hp:s.hp,atk:s.atk,spd:s.spd,armor:s.armor,crit:s.crit,ab:L=>c.passive,skills:c.skills}; }
const BASE_HEROES=STARTERS;
const defaultRow=id=>HEROES[id].row==='mid'?'back':HEROES[id].row; // 'mid' heroes start in the back and may move
const sprId=x=>{ const id=x&&x.id||x; const c=CLASSES[id]; if(!c) return id; if(c.tier===0) return ROOT_SPR[c.name]; return c.name==='Necromancer'?'necromancerhero':c.name.toLowerCase().replace(/[^a-z]/g,''); }; // 'necromancer' is an enemy sprite
const slotKindsOf=id=>[...(CLASS_SLOTS[CLASSES[id].name]||'')].map(c=>c==='W'?'hand':'armor');
const slotWords=id=>slotKindsOf(id).map(k=>k==='hand'?'weapon':'armor').join(' + ');
const SOCKET_PREF={hand:[0,3,2,1],armor:[1,2,3,0]}; // the sockets each kind fills, in order: its own two, then the other kind's (flipped)
function slotLayout(path){ const open=[], flip=[];
  path.forEach(id=>{ if(CLASSES[id].tier===0) return; slotKindsOf(id).forEach(kind=>{ const free=SOCKET_PREF[kind].filter(k=>!open.includes(k)); let k=free.find(k=>HAND_SLOTS.includes(k)===(kind==='hand')); if(k===undefined){ k=free[0]; flip.push(k); } open.push(k); }); });
  return {open:open.sort((a,b)=>a-b),flip}; }
// sets h.open and h.flip from the hero's route and its Enchanter flips; returns any gems left in sockets that closed (only a re-route closes any)
function relayout(h){ const L=slotLayout(heroPath(h)), en=h.ench||[]; h.open=L.open; h.flip=L.flip.filter(k=>!en.includes(k)).concat(en.filter(k=>!L.flip.includes(k)));
  const out=[]; (h.gems||[]).forEach((g,k)=>{ if(g&&!h.open.includes(k)){ out.push(g); h.gems[k]=null; } }); return out; }
function newHero(id,row){ const c=CLASSES[id]; const root=pick(c.from.filter(f=>CLASSES[f].tier===0)); const h={id,root,path:[root,id],lv:1,gems:[],ench:[],row:row||defaultRow(id),kills:0}; relayout(h); return h; }
const heroPath=h=>h.path||routeTo(h.id);
// a hero's skills: its current class's, plus every earlier class's (inherited)
function heroSkills(x){ if(typeof x==='string') return CLASSES[x].skills.slice(); const out=[]; heroPath(x).forEach(id=>{ const c=CLASSES[id]; if(c.tier===0) return; c.skills.forEach(sk=>out.push(id===x.id?sk:Object.assign({},sk,{inherited:true}))); }); return out; }
function activeSkills(h){ return heroSkills(h).filter(sk=>skillActive(h,sk)); }
const heroPassives=h=>heroPath(h).map(id=>CLASSES[id]).map(c=>Object.assign({name:c.name,passiveOf:c.id},c.def)); // root, then each class: they stack
const meetsReq=(h,ess)=>{ const have=gemCounts(h), need={}; ess.forEach(e=>need[e]=(need[e]||0)+1); return Object.keys(need).every(e=>(have[e]||0)>=need[e]); };
const upgradeOptions=h=>upgradesOf(h.id).filter(id=>meetsReq(h,CLASSES[id].ess));
function promote(h,id){ h.path=heroPath(h).concat(id); h.id=id; relayout(h); return h; } // training only ever adds a slot
// Training: a hero can only train when its gems meet at least one upgrade. Raises ★ and promotes, which adds the new class's slot: outright
// when one upgrade fits, through choose(options) when several (or left to the caller when choose is omitted). Returns the options, or null.
function trainHero(h,choose){ const opts=upgradeOptions(h); if(!opts.length) return null; h.lv++; if(opts.length===1) promote(h,opts[0]); else if(choose) promote(h,choose(opts)); return opts; }
