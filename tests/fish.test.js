const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../js/fish/config.js');
const { createEngine } = require('../js/fish/engine.js');

function setup(coins, random, extra = {}) {
  const w = { coins, spend(n) { if (this.coins < n) return false; this.coins -= n; return true; }, add(n) { this.coins += n; } };
  const inf = { spend: () => true, add() {} };
  const ev = { kills: [], refunds: 0 };
  const eng = createEngine({ config: { ...cfg, ...extra }, random, wallets: [w, inf, inf, inf],
    on: { kill: (s, f, win) => ev.kills.push(win), refund: () => ev.refunds++ } });
  return { eng, w, ev };
}

test('shot is rejected when balance < cost, and nothing is charged', () => {
  const { eng, w } = setup(40);
  assert.equal(eng.fire(0, 270, 400, 50), 'coins');
  assert.equal(w.coins, 40);
  assert.equal(eng.fire(0, 270, 400, 10), 'ok');
  assert.equal(w.coins, 30);
});

test('rate limit and unknown shot costs', () => {
  const { eng } = setup(10000);
  assert.equal(eng.fire(0, 270, 400, 50), 'ok');
  assert.equal(eng.fire(0, 270, 400, 50), 'rate');
  eng.step(cfg.shot.minInterval);
  assert.equal(eng.fire(0, 270, 400, 50), 'ok');
  eng.step(cfg.shot.minInterval);
  assert.equal(eng.fire(0, 270, 400, 77), 'bad');
});

test('a hit with a winning roll pays cost x multiplier; a bullet that hits nothing is refunded', () => {
  // random() = 0 -> every kill roll succeeds
  const { eng, w, ev } = setup(1000, () => 0, { boss: { ...cfg.boss, first: 1e9 } });
  eng.prefill(6);
  const f = eng.randomTarget();
  assert.ok(f, 'fish on screen');
  assert.equal(eng.fire(0, f.x, f.y, 10, f), 'ok');      // locked (homing) shot
  for (let i = 0; i < 120 && !ev.kills.length; i++) eng.step(1 / 60);
  assert.equal(ev.kills.length, 1);
  assert.equal(ev.kills[0], 10 * f.t.mult);
  assert.equal(w.coins, 1000 - 10 + 10 * f.t.mult);

  const e2 = setup(100, Math.random, { spawn: { ...cfg.spawn, maxFish: 0 }, boss: { ...cfg.boss, first: 1e9 } });
  assert.equal(e2.eng.fire(0, 10, 10, 50), 'ok');
  for (let i = 0; i < 60 * (cfg.shot.life + 1); i++) e2.eng.step(1 / 60);
  assert.equal(e2.ev.refunds, 1);
  assert.equal(e2.w.coins, 100);
});

test('kill chance is targetRTP / multiplier (roll just above vs just below)', () => {
  for (const [delta, expectKill] of [[1e-6, false], [-1e-6, true]]) {
    let fixed = null;
    const { eng, ev } = setup(1e9, () => (fixed === null ? Math.random() : fixed), { boss: { ...cfg.boss, first: 1e9 } });
    eng.prefill(6);
    const f = eng.randomTarget();
    fixed = cfg.targetRTP / f.t.mult + delta;   // only the kill roll uses this value
    eng.fire(0, f.x, f.y, 10, f);
    for (let i = 0; i < 120 && !ev.kills.length; i++) eng.step(1 / 60);
    assert.equal(ev.kills.length > 0, expectKill, f.t.name + ' delta ' + delta);
  }
});
