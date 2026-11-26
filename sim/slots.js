/* Exact odds for the sushi slots (enumerates every reel combination). Usage: node sim/slots.js */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/casino.js', 'utf8');
const SYM = eval(src.match(/const SYM = (\[[\s\S]*?\]);/)[1]);
const PAIR = eval('(' + (src.match(/const PAIR = (\{[\s\S]*?\});/) || [, "{ def: 2, '❤️': 3 }"])[1] + ')');
const TOTAL = SYM.reduce((s, x) => s + x.w, 0);
let rtp = 0, anyWin = 0; const rows = {};
for (const a of SYM) for (const b of SYM) for (const c of SYM) {
  const p = a.w * b.w * c.w / TOTAL ** 3;
  let m = 0, key;
  if (a.e === b.e && b.e === c.e) { m = a.x3; key = a.e.repeat(3); }
  else {
    const pair = a.e === b.e ? a.e : b.e === c.e ? b.e : a.e === c.e ? a.e : null;
    if (pair && pair !== '🦠') { m = PAIR[pair] || PAIR.def; key = 'пара ' + pair; }
  }
  if (!key) continue;
  rows[key] = rows[key] || { p: 0, m }; rows[key].p += p;
  rtp += p * m; if (m) anyWin += p;
}
console.log('Комбинация      шанс 1 из   множ.   вклад в RTP');
for (const [k, r] of Object.entries(rows)) console.log(k.padEnd(14), (1 / r.p).toFixed(1).padStart(10), ('x' + r.m).padStart(7), (r.p * r.m * 100).toFixed(2).padStart(10) + '%');
console.log(`\nRTP: ${(rtp * 100).toFixed(2)}%   любой выигрыш: 1 из ${(1 / anyWin).toFixed(2)} спинов`);
