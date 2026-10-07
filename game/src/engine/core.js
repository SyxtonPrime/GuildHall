// ============================================================
//  GUILDHALL — engine (pure logic, no DOM)
// ============================================================
const ri=n=>Math.floor(Math.random()*n), pick=a=>a[ri(a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ENV=(k,d)=>+((typeof process!=='undefined'&&process.env&&process.env[k])||d); // tuning knobs the balance bot can override (browser: defaults)

