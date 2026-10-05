// Regenerates game/engine.js (the DOM-free engine script) from game/guildhall.html so node tools can require() it.
const fs=require('fs'), path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../game/guildhall.html'),'utf8');
fs.writeFileSync(path.join(__dirname,'../game/engine.js'),html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]);
console.log('wrote game/engine.js');
