/* Monte Carlo for Ranch Showdown: hit rate + RTP of every bet zone.
   Usage: node sim/montecarlo.js [rounds=1000000] [targetRTP=0.97] */
const E = require('../js/ranch/eval.js');
const P = require('../js/ranch/payouts.js');

const N = +process.argv[2] || 1_000_000;
const TARGET = +process.argv[3] || 0.97;
const { zones, jackpot } = P.RANCH;

const ri = E.makeRandInt(E.secureU32());
const hits = Object.fromEntries(zones.map(z => [z.id, 0]));
const winCat = new Array(10).fill(0);
let jpRounds = { 7: 0, 8: 0, 9: 0 };
// Jackpot simulation: every round each zone receives 1 unit; pool gets fee% of all; pays share to winning main side.
let pool = jackpot.seed, jpPaidToMain = 0, mainStaked = 0;

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = P.resolve(E.deal(ri));
  for (const id of r.hits) hits[id]++;
  winCat[r.winCat]++;
  pool += zones.length * jackpot.feePercent / 100;
  mainStaked += 3;
  const share = P.jackpotShare(r);
  if (share) { jpRounds[r.winCat]++; const pay = pool * share; pool -= pay; jpPaidToMain += pay; }
}
const secs = (Date.now() - t0) / 1000;

const pct = (x, d = 3) => (x * 100).toFixed(d) + '%';
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

console.log(`\nRanch Showdown — ${N.toLocaleString('en')} rounds in ${secs.toFixed(1)}s (crypto RNG)\n`);
console.log(pad('Zone', 28) + lpad('Hit rate', 10) + lpad('1 in', 9) + lpad('Mult', 8) + lpad('RTP', 10) + lpad(`Mult@${pct(TARGET, 0)}`, 11));
console.log('-'.repeat(76));
let group = '';
for (const z of zones) {
  if (z.group !== group) { group = z.group; console.log(`[${{ main: 'Main', any: 'Any hand', win: 'Winning hand' }[group]}]`); }
  const h = hits[z.id] / N;
  // RTP after the jackpot fee is deducted from the stake
  const rtp = h * z.mult;
  console.log(pad('  ' + z.id + ' (' + z.name + ')', 28).slice(0, 28) + lpad(pct(h), 10) + lpad((1 / h).toFixed(1), 9) + lpad('x' + z.mult, 8) + lpad(pct(rtp, 2), 10) + lpad('x' + (TARGET / h).toFixed(2), 11));
}

const se = p => Math.sqrt(p * (1 - p) / N);
console.log('\nWinner hand categories:');
E.CAT_NAME_RU.forEach((n, c) => console.log('  ' + pad(n, 16) + lpad(pct(winCat[c] / N, 4), 10)));
console.log(`\nJackpot (fee ${jackpot.feePercent}% of each bet, 20/30/50% of pool on quads/SF/royal):`);
console.log(`  triggers: quads ${jpRounds[7]}, straight flush ${jpRounds[8]}, royal ${jpRounds[9]}  (1 in ${(N / (jpRounds[7] + jpRounds[8] + jpRounds[9])).toFixed(0)} rounds)`);
console.log(`  extra RTP for main-zone bettors if every zone is bet equally: +${pct(jpPaidToMain / mainStaked, 2)}`);
console.log(`\nStandard error of the draw rate: ±${pct(se(hits.draw / N), 3)}`);
