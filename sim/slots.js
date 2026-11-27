/* Суши-слоты 5x3 economy: simulate paid spins (free spins they trigger are played out and counted
   toward the paid spin that triggered them). Usage: node sim/slots.js [spins=2000000] */
const cfg = require('../js/slots/config.js');
const { createSlots } = require('../js/slots/engine.js');
const N = +process.argv[2] || 2_000_000;
const slots = createSlots(cfg);
const bet = 1000;

let staked = 0, won = 0, anyWin = 0, bigWin = 0, fsTriggers = 0, fsSpins = 0, fsWon = 0, jackpots = 0, jpWon = 0, moneyWon = 0, lineWon = 0;
let pool = cfg.jackpot.seed;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  staked += bet;
  pool += bet * cfg.jackpot.feePercent / 100;
  let r = slots.spin(bet, false, pool);
  let total = r.win;
  lineWon += r.lineWin; moneyWon += r.moneyWin;
  if (r.jackpotWin) { jackpots++; jpWon += r.jackpotWin; pool = pool - r.jackpotWin < cfg.jackpot.seed ? cfg.jackpot.seed : pool - r.jackpotWin; }
  let left = r.freeSpins;
  if (left) fsTriggers++;
  while (left > 0) {
    left--; fsSpins++;
    const f = slots.spin(bet, true, pool);
    total += f.win; fsWon += f.win;
    if (f.jackpotWin) { jackpots++; jpWon += f.jackpotWin; pool = Math.max(cfg.jackpot.seed, pool - f.jackpotWin); }
    left += f.freeSpins;
  }
  won += total;
  if (total > 0) anyWin++;
  if (total > bet) bigWin++;
}
const pct = x => (x * 100).toFixed(2) + '%';
console.log(`\nСуши-слоты 5x3 — ${N.toLocaleString('en')} paid spins in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`RTP total:            ${pct(won / staked)}`);
console.log(`  lines (base game):  ${pct(lineWon / staked)}`);
console.log(`  💰 3/4 prizes:      ${pct(moneyWon / staked)}`);
console.log(`  free spins:         ${pct(fsWon / staked)}   (triggered 1 in ${(N / fsTriggers).toFixed(0)} spins, avg ${(fsSpins / fsTriggers).toFixed(1)} spins)`);
console.log(`  jackpot:            ${pct(jpWon / staked)}   (hit 1 in ${jackpots ? (N / jackpots).toFixed(0) : '∞'} spins)`);
console.log(`Any win:              1 in ${(N / anyWin).toFixed(2)} spins (${pct(anyWin / N)})`);
console.log(`Win more than bet:    1 in ${(N / bigWin).toFixed(2)} spins (${pct(bigWin / N)})`);
