/* Морской тир economy check: fire N shots with random targeting through the real engine and report RTP.
   Usage: node sim/fish.js [shots=1000000] [cost=50|random] */
const cfg = require('../js/fish/config.js');
const { createEngine } = require('../js/fish/engine.js');
const N = +process.argv[2] || 1_000_000;
const COST = process.argv[3] === 'random' ? 0 : +process.argv[3] || 50;

// 4 seats with unlimited wallets; count everything.
const T = cfg.fish.length;
const st = { spent: 0, won: 0, refunded: 0, shots: 0, hits: 0, kills: new Array(T).fill(0), wonBy: new Array(T).fill(0), hitsBy: new Array(T).fill(0) };
let sumR = 0, sumR2 = 0, expWon = 0; // expWon: expected payout given the hits (removes kill-roll luck) // per-shot return in units of its cost (for the standard error)
const wallet = { spend(n) { st.spent += n; return true; }, add(n) { st.won += n; } };
const eng = createEngine({
  config: { ...cfg, shot: { ...cfg.shot, minInterval: 0, maxPerSeat: 1e9 }, pool: { fish: 64, bullets: 400 } },
  wallets: [wallet, wallet, wallet, wallet],
  on: {
    kill(seat, f, win, cost) { expWon += cost * Math.min(f.t.mult, cfg.targetRTP); st.kills[f.type]++; st.wonBy[f.type] += win; st.hits++; st.hitsBy[f.type]++; const r = win / cost; sumR += r; sumR2 += r * r; },
    hit(seat, f, x, y, cost) { expWon += cost * Math.min(f.t.mult, cfg.targetRTP); st.hits++; st.hitsBy[f.type]++; },
    refund(seat, cost) { expWon += cost; st.refunded += cost; st.won -= cost; sumR += 1; sumR2 += 1; },
  },
});
const levels = cfg.shot.levels;
const r = Math.random;
eng.prefill(10);
const t0 = Date.now();
const dt = 1 / 60;
while (st.shots < N) {
  for (let k = 0; k < 6 && st.shots < N; k++) {
    const seat = (r() * 4) | 0, f = eng.randomTarget(), cost = COST || levels[(r() * levels.length) | 0];
    const lock = r() < 0.25 ? f : null; // some shots use auto-lock (homing)
    const ax = f ? f.x : r() * 540, ay = f ? f.y : r() * 960;
    if (eng.fire(seat, ax, ay, cost, lock) === 'ok') st.shots++;
  }
  eng.step(dt);
}
for (let i = 0; i < 60 * 10; i++) eng.step(dt); // let bullets in flight land
const secs = (Date.now() - t0) / 1000;

const rtp = st.won / st.spent;
const mean = sumR / st.shots, se = Math.sqrt(Math.max(0, sumR2 / st.shots - mean * mean) / st.shots);
const pct = x => (x * 100).toFixed(2) + '%';
console.log(`\nМорской тир — ${st.shots.toLocaleString('en')} shots in ${secs.toFixed(1)}s, targetRTP ${cfg.targetRTP}`);
console.log(`Hit rate ${pct(st.hits / st.shots)}, refunded (hit nothing) ${pct(st.refunded / st.spent)} of stake`);
console.log(`\nActual RTP: ${pct(rtp)}   (per-shot mean ${pct(mean)} ± ${pct(1.96 * se)} at 95%)`);
const noBossWon = st.won - st.wonBy[T - 1];
console.log(`Expected RTP given these hits (no kill-roll luck): ${pct(expWon / st.spent)}`);
console.log(`RTP without boss kills: ${pct(noBossWon / st.spent)}   — the boss pays x200000 but dies ~once per ${Math.round(200000 / cfg.targetRTP).toLocaleString('en')} hits\n`);
console.log('Fish'.padEnd(26) + 'mult'.padStart(8) + 'hits'.padStart(10) + 'kills'.padStart(8) + 'kill %'.padStart(9) + '  expected');
cfg.fish.forEach((t, i) => console.log(t.name.padEnd(26).slice(0, 26) + String(t.mult).padStart(8) + String(st.hitsBy[i]).padStart(10) + String(st.kills[i]).padStart(8) +
  (st.hitsBy[i] ? (st.kills[i] / st.hitsBy[i] * 100).toFixed(3) + '%' : '—').padStart(9) + '  ' + (Math.min(1, cfg.targetRTP / t.mult) * 100).toFixed(3) + '%'));
