/* Суши-слоты 5x3 engine: reel strips, spin, line wins (with wild), scatters, jackpot. No DOM. */
(function (root) {
  function secureRandom() {
    const buf = new Uint32Array(1024);
    let i = buf.length;
    return () => {
      if (i === buf.length) { root.crypto.getRandomValues(buf); i = 0; }
      return buf[i++] / 4294967296;
    };
  }

  // Build a fixed strip per reel from symbol counts, spreading equal symbols apart (deterministic).
  function buildStrips(cfg) {
    return cfg.reels.map((counts, ri) => {
      const ids = Object.keys(counts);
      const total = ids.reduce((s, k) => s + counts[k], 0);
      const slots = [];
      for (const id of ids) for (let k = 0; k < counts[id]; k++) slots.push({ id, pos: (k + 0.5) / counts[id] + ids.indexOf(id) * 0.013 + ri * 0.007 });
      slots.sort((a, b) => (a.pos % 1) - (b.pos % 1));
      const strip = slots.map(s => s.id);
      if (strip.length !== total) throw new Error('strip size');
      return strip;
    });
  }

  function createSlots(cfg, opts = {}) {
    const rnd = opts.random || secureRandom();
    const strips = buildStrips(cfg);
    const S = cfg.symbols;
    const lineCount = cfg.lines.length;

    // grid[reel][row]
    function spinGrid() {
      return strips.map(strip => {
        const n = strip.length, stop = (rnd() * n) | 0;
        return [strip[stop], strip[(stop + 1) % n], strip[(stop + 2) % n]];
      });
    }

    function evalLine(grid, line) {
      const syms = line.map((row, r) => grid[r][row]);
      if (S[syms[0]].scatter || S[syms[0]].jackpot) return null;
      // run of wilds from the left
      let w = 0; while (w < 5 && S[syms[w]].wild) w++;
      // run for the first non-wild symbol (wilds substitute)
      let best = null;
      const base = syms.find(s => !S[s].wild);
      if (base && !S[base].scatter && !S[base].jackpot) {
        let n = 0; while (n < 5 && (syms[n] === base || S[syms[n]].wild)) n++;
        if (n >= 3) best = { sym: base, count: n, mult: S[base].pay[n - 3] };
      }
      if (w >= 3) { const m = S.wild.pay[w - 3]; if (!best || m > best.mult) best = { sym: 'wild', count: w, mult: m }; }
      return best;
    }

    const countAnywhere = (grid, pred) => {
      let reels = 0; const cells = [];
      grid.forEach((col, r) => { let hit = false; col.forEach((s, row) => { if (pred(S[s])) { hit = true; cells.push([r, row]); } }); if (hit) reels++; });
      return { reels, cells };
    };

    // One spin. bet = total bet; free = this is a free spin (no charge, wins multiplied).
    // Returns everything the UI needs; does not touch coins (the caller pays/charges).
    function evaluate(grid, bet, free, jackpotPool) {
      const lineBet = bet / lineCount, mult = free ? cfg.freeSpins.multiplier : 1;
      const lines = [];
      let win = 0;
      cfg.lines.forEach((line, li) => {
        const r = evalLine(grid, line);
        if (!r) return;
        const amount = Math.round(r.mult * lineBet * mult);
        win += amount;
        lines.push({ line: li, sym: r.sym, count: r.count, amount, cells: line.slice(0, r.count).map((row, reel) => [reel, row]) });
      });
      const stars = countAnywhere(grid, s => s.scatter);
      const freeSpins = cfg.freeSpins.award[Math.min(5, stars.reels)] || 0;
      const money = countAnywhere(grid, s => s.jackpot);
      let moneyWin = 0, jackpotWin = 0;
      if (money.reels >= 5) jackpotWin = Math.floor(jackpotPool * Math.min(1, bet / cfg.jackpot.fullBet));
      else if (cfg.money[money.reels]) moneyWin = Math.round(bet * cfg.money[money.reels] * mult);
      win += moneyWin + jackpotWin;
      return { grid, lines, win, lineWin: win - moneyWin - jackpotWin, moneyWin, jackpotWin, freeSpins, stars, money, free };
    }

    function spin(bet, free, jackpotPool) { return evaluate(spinGrid(), bet, free, jackpotPool); }

    return { spin, evaluate, strips, spinGrid };
  }

  const api = { createSlots, buildStrips, secureRandom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlotsEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
