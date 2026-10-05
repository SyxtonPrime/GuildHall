const {chromium}=require('playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:400,height:900},deviceScaleFactor:2});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ const ids=Object.keys(GEMS); document.querySelectorAll('.screen').forEach(e=>e.hidden=true); const d=document.createElement('div'); d.id='mock'; d.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">${ids.map(id=>`<div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:42px;font-size:9px;color:var(--muted);text-align:center;line-height:1.1">${ic(id,'g',28)}<span>${GEMS[id].name}</span></div>`).join('')}</div>`; document.getElementById('app').appendChild(d); });
 await (await p.$('#mock')).screenshot({path:'./out/gems-v33.1.png'}); console.log('errors',errs); await b.close(); })();
