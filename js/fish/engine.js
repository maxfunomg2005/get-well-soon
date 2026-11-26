/* Морской тир engine: authoritative spawn, movement, bullets, hits, kill rolls and payouts.
   No DOM. The renderer only calls fire()/freeze() and reads the pooled fish/bullet arrays.
   Runs in the browser and in Node (sim/fish.js, tests). */
(function (root) {
  // Secure [0,1) from crypto.getRandomValues, buffered.
  function secureRandom() {
    const buf = new Uint32Array(2048);
    let i = buf.length;
    return () => {
      if (i === buf.length) { root.crypto.getRandomValues(buf); i = 0; }
      return buf[i++] / 4294967296;
    };
  }

  function createEngine(opts) {
    const cfg = opts.config;
    const W = cfg.world.w, H = cfg.world.h, S = cfg.shot;
    const rnd = opts.random || secureRandom();
    const on = opts.on || {};
    const wallets = opts.wallets; // per seat: { spend(n) -> bool, add(n) }
    const types = cfg.fish;
    const normalTypes = types.map((t, i) => i).filter(i => !types[i].boss);
    const weightSum = normalTypes.reduce((s, i) => s + types[i].w, 0);
    const bossType = types.findIndex(t => t.boss);

    // ---------- pools (allocated once) ----------
    const fish = [];
    for (let i = 0; i < cfg.pool.fish; i++) fish.push({
      active: false, id: 0, type: 0, t: null, u: 0, du: 0, off: 0,
      x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0,
      x: -999, y: -999, angle: 0, flash: 0, dying: 0, age: 0,
    });
    const bullets = [];
    for (let i = 0; i < cfg.pool.bullets; i++) bullets.push({
      active: false, seat: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, cost: 0, target: null, targetId: 0,
    });
    const seats = cfg.seats.map(s => ({ ...s, last: -1, inFlight: 0, aim: s.dir < 0 ? -Math.PI / 2 : Math.PI / 2 }));

    let time = 0, nextId = 1, spawnT = 0, frozen = 0, fishCount = 0;
    let bossT = cfg.boss.first, bossWarned = false;

    // ---------- fish ----------
    function freeFish() { for (let i = 0; i < fish.length; i++) if (!fish[i].active) return fish[i]; return null; }

    // Cubic Bezier path from one edge to the opposite-ish edge, control points inside the screen.
    function makePath(f, t) {
      const m = t.len; // start/end fully off-screen
      const side = (rnd() * 4) | 0;
      const rx = () => W * (0.1 + rnd() * 0.8), ry = () => H * (0.15 + rnd() * 0.7);
      let ax, ay, bx, by;
      if (side === 0) { ax = -m; ay = ry(); bx = W + m; by = ry(); }
      else if (side === 1) { ax = W + m; ay = ry(); bx = -m; by = ry(); }
      else if (side === 2) { ax = rx(); ay = -m; bx = rx(); by = H + m; }
      else { ax = rx(); ay = H + m; bx = rx(); by = -m; }
      f.x0 = ax; f.y0 = ay; f.x3 = bx; f.y3 = by;
      f.x1 = W * (0.15 + rnd() * 0.7); f.y1 = H * (0.2 + rnd() * 0.6);
      f.x2 = W * (0.15 + rnd() * 0.7); f.y2 = H * (0.2 + rnd() * 0.6);
      // approximate length via chord sampling -> constant-ish speed
      let len = 0, px = ax, py = ay;
      for (let k = 1; k <= 12; k++) {
        const u = k / 12; bez(f, u);
        len += Math.hypot(f.x - px, f.y - py); px = f.x; py = f.y;
      }
      f.du = t.speed / len;
    }
    function bez(f, u) {
      const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
      f.x = a * f.x0 + b * f.x1 + c * f.x2 + d * f.x3;
      f.y = a * f.y0 + b * f.y1 + c * f.y2 + d * f.y3;
    }
    function place(f) {
      const u = Math.min(1, Math.max(0, f.u));
      // tangent
      const v = 1 - u;
      const tx = 3 * v * v * (f.x1 - f.x0) + 6 * v * u * (f.x2 - f.x1) + 3 * u * u * (f.x3 - f.x2);
      const ty = 3 * v * v * (f.y1 - f.y0) + 6 * v * u * (f.y2 - f.y1) + 3 * u * u * (f.y3 - f.y2);
      bez(f, u);
      const tl = Math.hypot(tx, ty) || 1;
      if (f.off) { f.x += -ty / tl * f.off; f.y += tx / tl * f.off; }
      f.angle = Math.atan2(ty, tx);
    }

    function spawn(typeIdx, copyOf, k) {
      const f = freeFish(); if (!f) return null;
      const t = types[typeIdx];
      f.active = true; f.id = nextId++; f.type = typeIdx; f.t = t; f.flash = 0; f.dying = 0; f.age = 0;
      if (copyOf) {
        f.x0 = copyOf.x0; f.y0 = copyOf.y0; f.x1 = copyOf.x1; f.y1 = copyOf.y1;
        f.x2 = copyOf.x2; f.y2 = copyOf.y2; f.x3 = copyOf.x3; f.y3 = copyOf.y3; f.du = copyOf.du;
        f.u = -k * (t.len * 1.1) * f.du / t.speed;           // follow the leader
        f.off = (rnd() - 0.5) * t.h * 2.4;
      } else { makePath(f, t); f.u = 0; f.off = 0; }
      place(f);
      fishCount++;
      on.spawn && on.spawn(f);
      return f;
    }
    function pickType() {
      let r = rnd() * weightSum;
      for (let i = 0; i < normalTypes.length; i++) { r -= types[normalTypes[i]].w; if (r <= 0) return normalTypes[i]; }
      return normalTypes[0];
    }
    function spawnWave() {
      const ti = pickType();
      const lead = spawn(ti, null, 0);
      if (lead && ti < cfg.spawn.schoolBelow) {
        const [a, b] = cfg.spawn.schoolSize, n = a + ((rnd() * (b - a + 1)) | 0);
        for (let k = 1; k < n; k++) spawn(ti, lead, k);
      }
    }
    function removeFish(f) { if (f.active) { f.active = false; fishCount--; } }

    const onScreen = f => f.x > 0 && f.x < W && f.y > 0 && f.y < H;
    const alive = f => f.active && f.dying === 0 && f.u >= 0;

    // ---------- shots ----------
    // aim at a point; optional lockFish makes the bullet home on that fish (hits nothing else).
    function fire(seatIdx, ax, ay, cost, lockFish) {
      const s = seats[seatIdx];
      if (!(cost > 0) || !S.levels.includes(cost)) return 'bad';
      if (time - s.last < S.minInterval - 1e-9 && s.last >= 0) return 'rate';
      if (s.inFlight >= S.maxPerSeat) return 'max';
      let b = null;
      for (let i = 0; i < bullets.length; i++) if (!bullets[i].active) { b = bullets[i]; break; }
      if (!b) return 'max';
      if (!wallets[seatIdx].spend(cost)) return 'coins';
      const ang = Math.atan2(ay - s.y, ax - s.x);
      s.aim = ang; s.last = time; s.inFlight++;
      b.active = true; b.seat = seatIdx; b.cost = cost; b.life = S.life;
      b.x = s.x + Math.cos(ang) * 34; b.y = s.y + Math.sin(ang) * 34;
      b.vx = Math.cos(ang) * S.speed; b.vy = Math.sin(ang) * S.speed;
      b.target = lockFish && alive(lockFish) ? lockFish : null; b.targetId = b.target ? b.target.id : 0;
      on.fire && on.fire(seatIdx, b);
      return 'ok';
    }

    function hitTest(f, x, y, pad) {
      const dx = x - f.x, dy = y - f.y, c = Math.cos(f.angle), s = Math.sin(f.angle);
      const lx = dx * c + dy * s, ly = -dx * s + dy * c;
      const a = f.t.len / 2 + pad, bb = f.t.h / 2 + pad;
      return (lx * lx) / (a * a) + (ly * ly) / (bb * bb) <= 1;
    }

    function resolveHit(b, f) {
      b.active = false; seats[b.seat].inFlight--;
      f.flash = 0.12;
      const t = f.t, p = Math.min(1, cfg.targetRTP / t.mult);
      if (rnd() < p) {
        f.dying = 0.8;
        const win = b.cost * t.mult;
        wallets[b.seat].add(win);
        on.kill && on.kill(b.seat, f, win, b.cost);
      } else on.hit && on.hit(b.seat, f, b.x, b.y, b.cost);
    }

    function stepBullets(dt) {
      const r = S.radius;
      for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        if (!b.active) continue;
        b.life -= dt;
        if (b.life <= 0) { // never hit anything: refund
          b.active = false; seats[b.seat].inFlight--; wallets[b.seat].add(b.cost);
          on.refund && on.refund(b.seat, b.cost);
          continue;
        }
        if (b.target && (!alive(b.target) || b.target.id !== b.targetId || !onScreen(b.target))) b.target = null;
        if (b.target) { // homing
          const dx = b.target.x - b.x, dy = b.target.y - b.y, d = Math.hypot(dx, dy) || 1;
          b.vx = dx / d * S.speed; b.vy = dy / d * S.speed;
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < r) { b.x = 2 * r - b.x; b.vx = -b.vx; } else if (b.x > W - r) { b.x = 2 * (W - r) - b.x; b.vx = -b.vx; }
        if (b.y < r) { b.y = 2 * r - b.y; b.vy = -b.vy; } else if (b.y > H - r) { b.y = 2 * (H - r) - b.y; b.vy = -b.vy; }
        if (b.target) { if (hitTest(b.target, b.x, b.y, r)) resolveHit(b, b.target); continue; }
        for (let j = 0; j < fish.length; j++) {
          const f = fish[j];
          if (!alive(f) || !onScreen(f)) continue;
          if (hitTest(f, b.x, b.y, r)) { resolveHit(b, f); break; }
        }
      }
    }

    function stepFish(dt) {
      if (frozen > 0) frozen = Math.max(0, frozen - dt);
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        if (!f.active) continue;
        if (f.flash > 0) f.flash -= dt;
        if (f.dying > 0) { f.dying -= dt; if (f.dying <= 0) removeFish(f); continue; }
        if (frozen > 0) continue;
        f.age += dt;
        f.u += f.du * dt;
        if (f.u >= 1) { removeFish(f); continue; }
        if (f.u >= 0) place(f);
      }
    }

    function step(dt) {
      time += dt;
      // boss timer
      bossT -= dt;
      if (bossType >= 0 && !bossWarned && bossT <= cfg.boss.warn) { bossWarned = true; on.bossWarn && on.bossWarn(types[bossType]); }
      if (bossType >= 0 && bossT <= 0) { bossT = cfg.boss.every; bossWarned = false; spawn(bossType, null, 0); }
      // regular waves (paused while frozen)
      if (frozen <= 0) {
        spawnT -= dt;
        if (spawnT <= 0) { spawnT = cfg.spawn.interval * (0.6 + rnd() * 0.8); if (fishCount < cfg.spawn.maxFish) spawnWave(); }
      }
      // substeps keep fast bullets from tunnelling through small fish
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let k = 0; k < n; k++) { stepFish(dt / n); stepBullets(dt / n); }
    }

    // Fish under a point (topmost/biggest first), for tap-to-target.
    function fishAt(x, y, pad = 12) {
      let best = null;
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        if (alive(f) && onScreen(f) && hitTest(f, x, y, pad) && (!best || f.t.len > best.t.len)) best = f;
      }
      return best;
    }
    function randomTarget() {
      let n = 0, pickF = null;
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        if (alive(f) && f.x > 20 && f.x < W - 20 && f.y > 60 && f.y < H - 60) { n++; if (rnd() * n < 1) pickF = f; }
      }
      return pickF;
    }
    // Leaving: refund every bullet still in flight, clear fish.
    function shutdown() {
      for (const b of bullets) if (b.active) { b.active = false; seats[b.seat].inFlight--; wallets[b.seat].add(b.cost); }
      for (const f of fish) f.active = false;
      fishCount = 0;
    }
    function prefill(seconds) { for (let t = 0; t < seconds; t += 1 / 30) step(1 / 30); }

    return {
      step, fire, fishAt, randomTarget, shutdown, prefill, alive, onScreen,
      freeze(sec) { frozen = Math.max(frozen, sec); },
      fish, bullets, seats, types,
      get time() { return time; }, get frozen() { return frozen; }, get bossIn() { return bossT; },
    };
  }

  const api = { createEngine, secureRandom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FishEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
