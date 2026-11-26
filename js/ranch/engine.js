/* Ranch Showdown round engine (runs in the browser; play coins only).
   BETTING (first board card face up; waits until she presses «Раздать») -> REVEAL -> RESULT -> next round.
   Each round: seed = 32 random bytes; its SHA-256 is shown before betting; the deal is derived
   from the seed (SHA-256(seed:i) blocks -> uint32 stream -> Fisher-Yates), and the seed is revealed after. */
const RanchEngine = (() => {
  const E = RanchEval, P = RanchPayouts, R = P.RANCH;
  const KEY = 'maria_ranch_v1';
  const ZONES = R.zones.map(z => z.id);
  const MAIN = ['cowboy', 'draw', 'bull'];

  // ---------- persistent state ----------
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const blankToday = () => ({ cowboy: 0, bull: 0, draw: 0, aces: 0, pairs: 0, sc: 0, quads: 0, rounds: 0 });
  const S = { nextId: 1, jackpot: R.jackpot.seed, history: [], records: [], day: today(), today: blankToday(), lb: {}, reward: null };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s.nextId === 'number') Object.assign(S, s);
  } catch (e) { /* no storage: play without saving */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  // ---------- simulated players ----------
  const NAMES = ['Джо', 'Билли', 'Дейзи', 'Хэнк', 'Молли', 'Джесси', 'Клем', 'Энни', 'Бак', 'Рокси', 'Тэдди', 'Лулу',
    'Кэлвин', 'Сэди', 'Уайатт', 'Грейс', 'Дасти', 'Белла', 'Коди', 'Руби', 'Сэм', 'Келли', 'Джейк', 'Мэгги', 'Рэй'];
  const TAGS = ['Быстрый', 'Ржавый', 'Счастливчик', 'Тихий', 'Кактус', 'Мустанг', 'Шпора', 'Пыльный'];
  const AV = ['🤠', '👒', '🐴', '🌵', '🦬', '🎩', '🪕', '🐎', '🧢', '👢', '🦅', '🐍'];
  const BOTS = [];
  for (let i = 0; i < 100; i++) {
    BOTS.push({ name: `${NAMES[i % NAMES.length]} ${TAGS[(i * 7 + (i / NAMES.length | 0)) % TAGS.length]}`, av: AV[(i * 5) % AV.length] });
  }
  const ME = () => ({ name: CONFIG.herName, av: '👸', me: true });

  // ---------- crypto helpers ----------
  const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
  const subtle = window.crypto && window.crypto.subtle;
  async function sha256(str) { return subtle.digest('SHA-256', new TextEncoder().encode(str)); }
  async function dealFromSeed(seed) {
    const blocks = await Promise.all([...Array(8)].map((_, i) => sha256(seed + ':' + i)));
    const words = [];
    blocks.forEach(b => { const v = new DataView(b); for (let i = 0; i < 8; i++) words.push(v.getUint32(i * 4)); });
    let k = 0;
    return E.deal(E.makeRandInt(() => words[k++ % words.length]));
  }
  async function verify(round) {
    if (!subtle || !round.seed) return null;
    const h = hex(await sha256(round.seed));
    const d = await dealFromSeed(round.seed);
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    return h === round.hash && same(d.cowboy, round.cowboy) && same(d.bull, round.bull) && same(d.board, round.board);
  }

  // ---------- live round ----------
  let cur = null, timer = null, running = false, listeners = [];
  const emit = ev => listeners.forEach(f => f(ev));
  const now = () => Date.now();

  function rollDay() {
    if (S.day === today()) return;
    // pay yesterday's leaderboard reward once
    const rank = myRank();
    const prize = rank ? rewardFor(rank) : 0;
    if (prize) S.reward = { rank, prize };
    S.day = today(); S.today = blankToday(); S.lb = {};
    save();
  }
  function claimReward() {
    if (!S.reward) return null;
    const r = S.reward; S.reward = null; Bank.add(r.prize); save(); return r;
  }
  function rewardFor(rank) {
    for (const t of R.leaderboard.rewards) if (rank >= t.from && rank <= t.to) return t.prize;
    return 0;
  }
  function leaderboard() {
    const rows = Object.entries(S.lb).filter(([, v]) => v > 0).map(([k, v]) => {
      const p = k === '__me' ? ME() : BOTS[+k];
      return { ...p, won: v };
    });
    rows.sort((a, b) => b.won - a.won);
    return rows;
  }
  function myRank() { const i = leaderboard().findIndex(r => r.me); return i < 0 ? 0 : i + 1; }

  async function newRound() {
    rollDay();
    const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
    const seed = hex(bytes);
    let hash = '', dealt;
    if (subtle) { hash = hex(await sha256(seed)); dealt = await dealFromSeed(seed); }
    else dealt = E.deal(E.makeRandInt(E.secureU32())); // insecure context (file://): no proof
    if (!running) return; // left the table while the round was being prepared
    cur = {
      id: S.nextId++, seed, hash, dealt, phase: 'betting', ends: 0, // betting has no timer: she deals when ready
      bets: Object.fromEntries(ZONES.map(z => [z, { me: 0, total: 0 }])),
      players: new Map(), myWin: 0, result: null, jackpotWin: 0,
    };
    save();
    scheduleBots();
    emit('round');
    clearTimeout(timer);
  }

  function scheduleBots() {
    const r = cur, n = 3 + ((Math.random() * 7) | 0);
    const amounts = [10, 10, 20, 20, 50, 50, 100, 200, 500];
    for (let i = 0; i < n; i++) {
      const bot = (Math.random() * BOTS.length) | 0;
      const bets = 1 + ((Math.random() * 3) | 0);
      for (let j = 0; j < bets; j++) {
        const at = 600 + Math.random() * 6000;
        setTimeout(() => {
          if (cur !== r || r.phase !== 'betting') return;
          const roll = Math.random();
          const zone = roll < 0.6 ? pick(['cowboy', 'bull']) : roll < 0.68 ? 'draw' : pick(ZONES.slice(3));
          addBet(r, bot, zone, pick(amounts));
          emit('bets');
        }, at);
      }
    }
  }

  function addBet(r, who, zone, amt) {
    r.bets[zone].total += amt;
    if (who === '__me') r.bets[zone].me += amt;
    const p = r.players.get(who) || { amount: 0, bets: {} };
    p.amount += amt; p.bets[zone] = (p.bets[zone] || 0) + amt;
    r.players.set(who, p);
    S.jackpot += amt * R.jackpot.feePercent / 100; // fee comes out of the house edge, not the stake
  }

  // Her bet. Spend + record happen together, or not at all. Rejected once the cards are being dealt.
  function bet(zone, amt) {
    const r = cur;
    if (!r || r.phase !== 'betting') return { ok: false, why: 'closed' };
    if (!ZONES.includes(zone) || !(amt > 0)) return { ok: false, why: 'bad' };
    if (!Bank.spend(amt)) return { ok: false, why: 'coins' };
    addBet(r, '__me', zone, amt);
    save();
    emit('bets');
    return { ok: true };
  }

  const myBets = r => (r && r.players.get('__me')) || null;

  // She presses «Раздать»: betting closes and the cards are dealt. Needs at least one bet.
  function deal() {
    const r = cur;
    if (!r || r.phase !== 'betting') return { ok: false, why: 'closed' };
    if (!myBets(r)) return { ok: false, why: 'nobet' };
    toReveal();
    return { ok: true };
  }

  // Take back all her bets this round (only before dealing).
  function cancelBets() {
    const r = cur, p = myBets(r);
    if (!r || r.phase !== 'betting' || !p) return 0;
    for (const [z, a] of Object.entries(p.bets)) { r.bets[z].total -= a; r.bets[z].me -= a; }
    S.jackpot -= p.amount * R.jackpot.feePercent / 100;
    r.players.delete('__me');
    Bank.add(p.amount);
    save(); emit('bets');
    return p.amount;
  }

  // Place the same bets as her last round. Returns how much was placed.
  function repeatBets() {
    let placed = 0;
    for (const [z, a] of Object.entries(S.lastBets || {})) if (bet(z, a).ok) placed += a;
    return placed;
  }

  function toReveal() {
    if (!cur) return;
    cur.phase = 'reveal'; cur.ends = now() + R.roundSeconds.reveal * 1000;
    emit('phase');
    clearTimeout(timer);
    timer = setTimeout(toResult, cur.ends - now());
  }

  function settle(r) {
    const res = P.resolve(r.dealt);
    r.result = res;
    const mult = Object.fromEntries(R.zones.map(z => [z.id, z.mult]));
    // jackpot: winners on the winning main zone split share% of the pool by stake
    const share = P.jackpotShare(res);
    let jpPay = {};
    if (share) {
      const elig = [...r.players].filter(([, p]) => p.bets[res.winner] > 0);
      const stake = elig.reduce((s, [, p]) => s + p.bets[res.winner], 0);
      if (stake > 0) {
        const pool = Math.floor(S.jackpot * share);
        S.jackpot -= pool;
        elig.forEach(([who, p]) => { jpPay[who] = Math.floor(pool * p.bets[res.winner] / stake); });
      }
    }
    for (const [who, p] of r.players) {
      let win = 0;
      for (const [z, a] of Object.entries(p.bets)) if (res.hits.has(z)) win += Math.floor(a * mult[z]);
      win += jpPay[who] || 0;
      p.win = win;
      if (win > 0) S.lb[who] = (S.lb[who] || 0) + win;
      if (who === '__me') {
        S.lastBets = { ...p.bets };
        r.myWin = win; r.jackpotWin = jpPay.__me || 0;
        if (win > 0) Bank.add(win);
        for (const [z, a] of Object.entries(p.bets)) {
          S.records.unshift({ id: r.id, zone: z, amt: a, win: res.hits.has(z) ? Math.floor(a * mult[z]) : 0, t: Date.now() });
        }
        if (r.jackpotWin) S.records.unshift({ id: r.id, zone: 'jackpot', amt: 0, win: r.jackpotWin, t: Date.now() });
        S.records.length = Math.min(S.records.length, 300);
      }
    }
    const d = r.dealt;
    S.history.unshift({
      id: r.id, hash: r.hash, seed: r.seed, cowboy: d.cowboy, bull: d.bull, board: d.board,
      winner: res.winner, cowboyCat: res.cowboyCat, bullCat: res.bullCat, winCat: res.winCat, hits: [...res.hits],
    });
    S.history.length = Math.min(S.history.length, 100);
    const t = S.today;
    t.rounds++; t[res.winner]++;
    if (res.hits.has('pocketAces')) t.aces++;
    if (res.hits.has('pocketPair')) t.pairs++;
    if (res.hits.has('suitedConn')) t.sc++;
    if (res.winCat >= E.CAT.QUADS) t.quads++;
    save();
  }

  function toResult() {
    if (!cur) return;
    settle(cur);
    cur.phase = 'result'; cur.ends = now() + R.roundSeconds.result * 1000;
    emit('result');
    clearTimeout(timer);
    timer = setTimeout(() => { if (running) newRound(); }, cur.ends - now());
  }

  function start() { if (running) return; running = true; newRound(); }
  // Leaving the table: bets not yet dealt are returned; a round already being dealt is finished instantly.
  function stop() {
    running = false; clearTimeout(timer);
    if (cur && cur.phase === 'betting') cancelBets();
    else if (cur && cur.phase === 'reveal' && cur.players.has('__me')) settle(cur);
    cur = null;
  }

  // ---------- read-only views ----------
  function zoneStats(zone) {
    const h = S.history;
    const last7 = h.slice(0, 7).map(r => r.hits.includes(zone));
    let since = h.findIndex(r => r.hits.includes(zone));
    if (since < 0) since = h.length || null; // null: no finished rounds yet
    return { last7, since, sinceCapped: since === h.length && h.length >= 100 };
  }
  function topBettors(n = 5) {
    if (!cur) return [];
    return [...cur.players].map(([k, p]) => ({ ...(k === '__me' ? ME() : BOTS[+k]), amount: p.amount, win: p.win || 0 }))
      .sort((a, b) => b.amount - a.amount).slice(0, n);
  }

  return {
    start, stop, bet, deal, cancelBets, repeatBets, verify, claimReward, leaderboard, myRank, rewardFor, zoneStats, topBettors,
    on(f) { listeners.push(f); return () => { listeners = listeners.filter(g => g !== f); }; },
    get round() { return cur; },
    get state() { return S; },
    get running() { return running; },
    get provable() { return !!subtle; },
    get canRepeat() { return !!S.lastBets && Object.keys(S.lastBets).length > 0; },
  };
})();
