const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:360,height:780}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.gold=30; run.floor=6; run.partyMax=5; run.relics=['warhorn','cloak']; run.heroes=[{id:'shieldmaiden',lv:3,gems:['ward','ward','venom','edge'],open:[0,1,2,3],row:'front',kills:0},{id:'plaguedoctor',lv:2,gems:['venom',null,'vital'],open:[0,1,2],row:'back',kills:0},{id:'monk',lv:1,gems:['swift','swift'],open:[0,1],row:'front',kills:0},{id:'rogue',lv:1,gems:[],open:[0,1],row:'back',kills:0}]; run.bag=['frost','ember','gilt','sunstone']; offerPaths(); renderCamp(); });
 await p.waitForTimeout(150); await p.screenshot({path:'camp2.png',fullPage:true});
 console.log('page height',await p.evaluate(()=>document.body.scrollHeight),'hint present',await p.evaluate(()=>document.body.innerText.includes('Tap a hero for')));
 await p.click('[data-a="equip"]'); await p.waitForTimeout(150); await p.screenshot({path:'equip2.png'});
 console.log('slots row width',await p.evaluate(()=>{ const r=[...document.querySelectorAll('.slotw')].map(x=>x.getBoundingClientRect()); return r.map(x=>Math.round(x.top)).join(',')+' | '+Math.round(r[r.length-1].right); }));
 await p.evaluate(()=>{ renderCamp(); heroSheet(0); }); await p.waitForTimeout(100);
 console.log('sheet buttons:',await p.evaluate(()=>[...document.querySelectorAll('#sheet button')].map(x=>x.innerText.replace(/\n/g,' ')).join(' | ')));
 console.log('errors',errs); await b.close();
})();
