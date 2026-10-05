const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 for(let r=0;r<6;r++){
  await p.evaluate(()=>{ run.floor=10; run.partyMax=5; run.heroes=[{id:'monk',lv:3,row:'front',gems:['swift','swift','swift','vital'],bonusHp:0},{id:'knight',lv:1,row:'front',gems:['ward'],bonusHp:0},{id:'cleric',lv:2,row:'back',gems:['vital','vital'],bonusHp:0},{id:'duelist',lv:1,row:'back',gems:['edge','swift'],bonusHp:0}]; run.enc=genEncounter(10,0); startBattle(); });
  await p.waitForTimeout(100); await p.click('#s-battle button[data-s="3"]');
  let seen=0, shots=0;
  for(let i=0;i<400;i++){ await p.waitForTimeout(60); const m=await p.$('#pside .unit.moving'); if(m){ seen++; if(shots<2){ await p.screenshot({path:'move'+shots+'.png'}); shots++; } } if(await p.evaluate(()=>battle.over)) break; }
  const log=await p.evaluate(()=>battle.log.filter(s=>/falls back|steps|slips/.test(s)).join(' | '));
  console.log('run',r,'moving frames:',seen,'log:',log);
  if(seen) break;
 }
 console.log('errors:',errs); await b.close();
})();
