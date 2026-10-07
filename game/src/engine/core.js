// ============================================================
//  GUILDHALL — engine (pure logic, no DOM)
// ============================================================
const ri=n=>Math.floor(Math.random()*n), pick=a=>a[ri(a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ENV=(k,d)=>+((typeof process!=='undefined'&&process.env&&process.env[k])||d); // tuning knobs the balance bot can override (browser: defaults)

// ---------- Statuses ----------
// Chill slows 2.5% a stack (up to 20 stacks). A unit at 20 or more is Frozen: its next attack deals half damage (a quarter at 40, and so on)
// and consumes 20; under 20, attacking halves its Chill. Burn deals 1 a stack a second and halves each second; a unit that reaches 10 is Ablaze
// and its Burn never decays below 10 unless something removes it. Poison deals 1 a stack a second (ignoring Armor and Shield) and loses 1; at 15
// a unit is Festering: Armor counts as 0 and it cannot be healed or gain Shield. Frozen, Ablaze and Festering are the afflictions.
// Two afflictions at once mark a unit for the rest of the fight: Brittle (Frozen + Ablaze: every Chill or Burn application is +1), Blighted
// (Ablaze + Festering: +25% damage from statuses), Crippled (Frozen + Festering: attacks 25% slower). All three: Ruined (+50% damage from
// everything, and all three marks). The rules are the same for heroes and enemies.
const BURN_DMG=ENV('BURNDMG',1); // Burn deals this × its stacks per tick
const FROZEN_AT=20, ABLAZE_AT=10, FESTER_AT=ENV('FESTER',15), CHILL_SLOW=ENV('CHILLSLOW',0.025), CHILL_SLOW_MAX=20;
const isFrozen=u=>(u.st.chill||0)>=FROZEN_AT, isAblaze=u=>!!u.ablaze, isFestering=u=>(u.st.poison||0)>=FESTER_AT;
const chill5=u=>Math.min(5,u.st.chill||0); // content written against the old 5-stack Chill cap reads Chill through this
const STATUS_KEYS=['poison','burn','chill'];
const afflictions=u=>(isFrozen(u)?1:0)+(isAblaze(u)?1:0)+(isFestering(u)?1:0);
// Crit and dodge chance halve after each success and reset on the first failure, so stacked chance never means a guaranteed streak.
// Guaranteed crits and dodges (forceCrit / forceDodge) always succeed and leave the streak alone.
const STREAKS=ENV('STREAK',1), CHILL_SHED=ENV('CHILLSHED',1); // bot knobs: STREAK=0 restores plain rolls, CHILLSHED=0 stops attacking from halving Chill
const streakRoll=(chance,unit,key)=>{ if(Math.random()<chance/(STREAKS?Math.pow(2,unit[key]||0):1)){ unit[key]=(unit[key]||0)+1; return true; } unit[key]=0; return false; };

