const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 const st=()=>p.evaluate(()=>({floor:run.floor,choices:run.choices.map(c=>c.kind),pick:run.pick,enc:run.enc&&run.enc.kind,resting:!!run.resting,btn:document.querySelector('.fightbar button').textContent,paths:document.querySelectorAll('[data-path]').length,market:!!document.querySelector('.shop')}));
 console.log('floor1',JSON.stringify(await st()));
 // win floor 1 quickly
 const winFight=async()=>{ await p.evaluate(()=>{ battle=createBattle(run.heroes,run.enc,run.relics); battle.units.forEach(u=>{ if(u.side==='e'){u.alive=false;u.hp=0;} }); battle.over=true; battle.winner='p'; endBattle(); }); await p.waitForTimeout(150); await p.click('#sheet button[data-next]'); await p.waitForTimeout(200); const fp=await p.$('#sheet button[data-fp]'); if(fp){ await fp.click(); await p.waitForTimeout(200); } };
 await p.evaluate(()=>{ run.bag=['venom','frost','ward']; run.heroes[0].gems=['edge',null]; });
 await winFight();
 console.log('floor2',JSON.stringify(await st()));
 await p.screenshot({path:'forge0.png',fullPage:true});
 // force a forge offer and take it
 await p.evaluate(()=>{ run.choices=[{kind:'fight',enc:genEncounter(run.floor,0,'fight')},{kind:'forge'}]; pickPath(1); renderCamp(); });
 console.log('picked forge',JSON.stringify(await st()));
 await p.click('[data-a="forge"]'); await p.waitForTimeout(150);
 console.log('forge items:',await p.evaluate(()=>[...document.querySelectorAll('[data-fg] .o')].map(x=>x.textContent).join(' | ')));
 await p.click('[data-fg="0"]'); await p.click('[data-fg="3"]'); await p.waitForTimeout(100); await p.screenshot({path:'forge1.png'});
 console.log('preview:',await p.evaluate(()=>document.querySelector('#sheet .card b')&&document.querySelector('#sheet .card b').textContent));
 await p.click('button[data-fz="merge"]'); await p.waitForTimeout(200);
 console.log('after merge',JSON.stringify(await st()),'bag',await p.evaluate(()=>JSON.stringify(run.bag)),'hero gems',await p.evaluate(()=>JSON.stringify(run.heroes[0].gems)),'merged',await p.evaluate(()=>JSON.stringify(run.merged)),'mergeAct',await p.evaluate(()=>run.mergeAct));
 await p.screenshot({path:'forge2.png',fullPage:true});
 // gem sheet of the merged gem
 await p.evaluate(()=>{ gemIdx=0; gemSheet(run.heroes[0].gems[0]||run.bag[run.bag.length-1],run.heroes[0].gems[0]?'slot':'bag',0); }); await p.waitForTimeout(100); await p.screenshot({path:'forge3.png'});
 await p.evaluate(()=>{ $('#sheet').onclick=null; closeModal(); });
 // reload persistence
 await p.reload(); await p.waitForTimeout(500); await p.click('button[data-a="continue"]'); await p.waitForTimeout(300);
 console.log('after reload',JSON.stringify(await st()),'GEMS.m1?',await p.evaluate(()=>!!GEMS.m1),'stats ok',await p.evaluate(()=>computeStats(run.heroes[0],run.relics).maxHp));
 // boss floor
 await p.evaluate(()=>{ run.floor=4; offerPaths(); renderCamp(); }); console.log('floor4',JSON.stringify(await st()));
 console.log('errors',errs); await b.close();
})();
