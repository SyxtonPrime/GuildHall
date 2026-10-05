// Rebuilds the derived files from game/guildhall.html (the single source of truth):
//   game/engine.js                  the DOM-free engine script, for the node tools
//   game/Guildhall-standalone.html  the same body under the standalone <head>
// Run after every edit to the game: `node tools/build.js` (or `npm run build`).
const fs=require('fs'), path=require('path');
const G=path.join(__dirname,'../game');
const body=s=>s.slice(s.indexOf('<body>')+6);
const head=s=>s.slice(0,s.indexOf('<body>')+6);
const html=fs.readFileSync(path.join(G,'guildhall.html'),'utf8');
const standalone=path.join(G,'Guildhall-standalone.html');
fs.writeFileSync(path.join(G,'engine.js'),html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]);
fs.writeFileSync(standalone,head(fs.readFileSync(standalone,'utf8'))+body(html));
console.log('wrote game/engine.js and game/Guildhall-standalone.html');
