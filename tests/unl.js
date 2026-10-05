const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.gold=30; run.heroes[0]={id:'knight',lv:1,gems:[],open:[0,1],row:'front',kills:0}; run.bag=['ward','edge','vital']; renderGems(0); });
 await p.waitForTimeout(150);
 console.log('unlock buttons:',await p.evaluate(()=>[...document.querySelectorAll('[data-unlock]')].map(x=>x.dataset.unlock+':'+x.innerText.replace(/\n/g,' ')).join(' | ')));
 console.log('train button present:',await p.evaluate(()=>!!document.querySelector('[data-g="train"]')));
 await p.screenshot({path:'unl0.png'});
 await p.click('[data-unlock="3"]'); await p.waitForTimeout(150);
 console.log('after unlock shield:',await p.evaluate(()=>JSON.stringify({lv:run.heroes[0].lv,open:run.heroes[0].open,gold:run.gold})));
 // slot three gems: first two auto? bag tap with multiple open -> pick
 await p.click('[data-bag="0"]'); await p.waitForTimeout(100); await p.click('[data-slot="3"]'); await p.waitForTimeout(100);
 await p.click('[data-bag="0"]'); await p.waitForTimeout(100); await p.click('[data-slot="0"]'); await p.waitForTimeout(100);
 await p.click('[data-bag="0"]'); await p.waitForTimeout(100);
 console.log('gems:',await p.evaluate(()=>JSON.stringify(run.heroes[0].gems)),'bag',await p.evaluate(()=>JSON.stringify(run.bag)));
 await p.click('[data-unlock="2"]'); await p.waitForTimeout(150);
 console.log('after 2nd unlock:',await p.evaluate(()=>JSON.stringify({lv:run.heroes[0].lv,open:run.heroes[0].open,gold:run.gold,unlockLeft:document.querySelectorAll('[data-unlock]').length})));
 await p.screenshot({path:'unl1.png'});
 // legacy hero (no open) at lv2
 await p.evaluate(()=>{ run.heroes[1]=Object.assign({},run.heroes[1],{lv:2,gems:['swift'],open:undefined}); delete run.heroes[1].open; renderGems(1); });
 console.log('legacy lv2 slots:',await p.evaluate(()=>JSON.stringify({open:openSet(run.heroes[1]),unlock:[...document.querySelectorAll('[data-unlock]')].map(x=>x.dataset.unlock)})));
 // camp + hero sheet
 await p.evaluate(()=>{ renderCamp(); heroSheet(0); }); await p.waitForTimeout(100);
 console.log('hero sheet buttons:',await p.evaluate(()=>[...document.querySelectorAll('#sheet button')].map(x=>x.innerText.replace(/\n/g,' ')).join(' | ')));
 console.log('errors:',errs); await b.close();
})();
