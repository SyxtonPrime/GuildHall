// ---------- boot ----------
function start(){ buildSprite(); buildPixelSprites(); renderTitle(); }
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start();
