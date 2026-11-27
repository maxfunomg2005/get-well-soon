const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../js/slots/config.js');
const { createSlots } = require('../js/slots/engine.js');
const slots = createSlots(cfg);
// grid helper: rows top->bottom as strings of ids per reel
const G = rows => [0, 1, 2, 3, 4].map(r => [rows[0][r], rows[1][r], rows[2][r]]);
const t = 'tea', s = 'sushi', w = 'wild', h = 'heart', st = 'star', m = 'money', c = 'cowboy', ri = 'rice', sh = 'shrimp';
const bet = 1000, lb = bet / cfg.lines.length;

test('strips have the configured symbol counts', () => {
  slots.strips.forEach((strip, r) => {
    for (const [id, n] of Object.entries(cfg.reels[r])) assert.equal(strip.filter(x => x === id).length, n, `reel ${r} ${id}`);
  });
});

test('3/4/5 in a row from the left on the middle line', () => {
  const r3 = slots.evaluate(G([[t, ri, sh, c, h], [s, s, s, t, ri], [ri, sh, c, h, t]]), bet, false, 0);
  const mid = r3.lines.find(l => l.line === 0);
  assert.equal(mid.count, 3); assert.equal(mid.amount, lb * cfg.symbols.sushi.pay[0]);
  const r5 = slots.evaluate(G([[t, ri, sh, c, h], [s, s, s, s, s], [ri, sh, c, h, t]]), bet, false, 0);
  assert.equal(r5.lines.find(l => l.line === 0).amount, lb * cfg.symbols.sushi.pay[2]);
  // not from the left -> no win on that line
  const r0 = slots.evaluate(G([[t, ri, sh, c, h], [ri, s, s, s, s], [ri, sh, c, h, t]]), bet, false, 0);
  assert.ok(!r0.lines.find(l => l.line === 0));
});

test('wild substitutes, and a pure wild run pays the wild table when better', () => {
  const r = slots.evaluate(G([[t, ri, sh, c, h], [w, s, w, s, t], [ri, sh, c, h, ri]]), bet, false, 0);
  assert.equal(r.lines.find(l => l.line === 0).count, 4);
  const ww = slots.evaluate(G([[t, ri, sh, c, h], [w, w, w, t, ri], [ri, sh, c, h, t]]), bet, false, 0);
  const l = ww.lines.find(x => x.line === 0);
  // wild x3 (30) pays more than tea x4 (15), so the line pays as wilds
  assert.equal(l.sym, 'wild'); assert.equal(l.count, 3);
  assert.equal(l.amount, lb * cfg.symbols.wild.pay[0]);
});

test('free spins from stars anywhere, wins doubled during free spins', () => {
  const g = G([[st, ri, st, c, h], [s, s, s, st, ri], [ri, sh, c, h, t]]);
  const r = slots.evaluate(g, bet, false, 0);
  assert.equal(r.freeSpins, cfg.freeSpins.award[3]);
  const f = slots.evaluate(g, bet, true, 0);
  assert.equal(f.lineWin, r.lineWin * cfg.freeSpins.multiplier);
});

test('money: 3/4 pay x bet, one on every reel wins the jackpot share', () => {
  const r3 = slots.evaluate(G([[m, ri, m, c, h], [s, t, ri, m, ri], [ri, sh, c, h, t]]), bet, false, 0);
  assert.equal(r3.moneyWin, bet * cfg.money[3]);
  const g5 = G([[m, m, m, m, m], [s, t, ri, sh, ri], [ri, sh, c, h, t]]);
  const pool = 80000;
  assert.equal(slots.evaluate(g5, cfg.jackpot.fullBet, false, pool).jackpotWin, pool);
  assert.equal(slots.evaluate(g5, 100, false, pool).jackpotWin, Math.floor(pool * 100 / cfg.jackpot.fullBet));
});
