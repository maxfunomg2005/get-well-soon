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
  const f = eng.randomTarget(10);
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
    const f = eng.randomTarget(10);
    fixed = cfg.targetRTP / f.t.mult + delta;   // only the kill roll uses this value
    eng.fire(0, f.x, f.y, 10, f);
    for (let i = 0; i < 120 && !ev.kills.length; i++) eng.step(1 / 60);
    assert.equal(ev.kills.length > 0, expectKill, f.t.name + ' delta ' + delta);
  }
});

test('a gun only catches fish in its range: locked shot refused, stray bullets pass through', () => {
  const big = cfg.fish[16]; // Кит x5000: guns 200 / 500 / 1000 only
  const fishOnly = { ...cfg, fish: [big], spawn: { ...cfg.spawn, maxFish: 1, schoolBelow: 0 }, boss: { ...cfg.boss, first: 1e9 } };
  const { eng, w, ev } = setup(10000, () => 0, {});
  // replace the engine with one whose only fish type needs gun 1000
  const s2 = (function () {
    const wl = { coins: 10000, spend(n) { if (this.coins < n) return false; this.coins -= n; return true; }, add(n) { this.coins += n; } };
    const inf = { spend: () => true, add() {} };
    const evs = { kills: 0, refunds: 0 };
    let r = 0;
    const e = require('../js/fish/engine.js').createEngine({ config: fishOnly, random: () => (r = (r + 0.37) % 1), wallets: [wl, inf, inf, inf],
      on: { kill: () => evs.kills++, refund: () => evs.refunds++ } });
    return { e, wl, evs };
  })();
  for (let i = 0; i < 600 && !s2.e.fish.some(f => f.active && s2.e.onScreen(f)); i++) s2.e.step(1 / 30);
  const f = s2.e.fish.find(x => x.active && s2.e.onScreen(x));
  assert.ok(f, 'big fish on screen');
  assert.equal(s2.e.fire(0, f.x, f.y, 10, f), 'gun');
  assert.equal(s2.wl.coins, 10000, 'refused shot costs nothing');
  assert.equal(s2.e.canHit(f, 1000), true);
  assert.equal(s2.e.randomTarget(50), null);
  assert.equal(s2.e.canHit(f, 200), true);
  assert.equal(s2.e.fishAt(f.x, f.y, 18, 10), f, 'touch still finds it so the UI can explain');
  // a straight 10-shot aimed through it never hits; it is refunded after its lifetime
  assert.equal(s2.e.fire(0, f.x, f.y, 10, null), 'ok');
  for (let i = 0; i < 30 * (cfg.shot.life + 1); i++) s2.e.step(1 / 30);
  assert.equal(s2.evs.kills, 0);
  assert.equal(s2.evs.refunds, 1);
  assert.equal(s2.wl.coins, 10000);
});

test('gun ranges match the table', () => {
  const { eng } = setup(0);
  const can = (mult, gun) => eng.canHit({ t: { mult } }, gun);
  const table = [[10, 12, 500], [30, 12, 2000], [50, 12, 3000], [200, 200, 10000], [500, 300, 200000], [1000, 800, 200000]];
  for (const [gun, lo, hi] of table) {
    for (const f of cfg.fish) assert.equal(can(f.mult, gun), f.mult >= lo && f.mult <= hi, `gun ${gun} vs x${f.mult}`);
  }
  assert.equal(can(150, 200), false, '200 gun ignores fish up to x150');
});
