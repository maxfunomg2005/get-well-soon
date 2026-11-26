/* Ranch Showdown: cards + 7-card hand evaluator. Shared by browser, tests and simulation.
   Card = integer 0..51: rank = (c >> 2) + 2 (2..14, 14 = ace), suit = c & 3. */
(function (root) {
  const CAT = { HIGH: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8, ROYAL: 9 };
  const CAT_NAME_RU = ['Старшая карта', 'Пара', 'Две пары', 'Сет', 'Стрит', 'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш', 'Роял-флеш'];

  const rankOf = c => (c >> 2) + 2;
  const suitOf = c => c & 3;
  const card = (rank, suit) => ((rank - 2) << 2) | suit;

  // "As", "Td", "2c" -> card int (used by tests)
  const RCH = '23456789TJQKA', SCH = 'shdc';
  function parse(str) {
    return str.trim().split(/\s+/).map(t => {
      const r = RCH.indexOf(t[0].toUpperCase()), s = SCH.indexOf(t[1].toLowerCase());
      if (r < 0 || s < 0) throw new Error('bad card ' + t);
      return card(r + 2, s);
    });
  }

  // Highest straight top rank inside a 15-bit rank mask (bit r set = rank r present), 0 if none.
  function straightTop(mask) {
    if (mask & (1 << 14)) mask |= 1 << 1; // ace also plays low (wheel A-2-3-4-5)
    for (let top = 14; top >= 5; top--) {
      const need = 0b11111 << (top - 4);
      if ((mask & need) === need) return top;
    }
    return 0;
  }

  // Score: category in the high bits, then up to five tiebreak ranks (4 bits each).
  // Bigger score = better hand; equal score = exact tie.
  function pack(cat, ranks) {
    let s = cat;
    for (let i = 0; i < 5; i++) s = s * 16 + (ranks[i] || 0);
    return s;
  }

  // Evaluate the best 5-card hand out of any 5..7 cards.
  function evaluate(cards) {
    const rc = new Array(15).fill(0), sc = [0, 0, 0, 0], sm = [0, 0, 0, 0];
    let mask = 0;
    for (const c of cards) {
      const r = rankOf(c), s = suitOf(c);
      rc[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r;
    }
    // Flush / straight flush
    let flushSuit = -1;
    for (let s = 0; s < 4; s++) if (sc[s] >= 5) flushSuit = s;
    if (flushSuit >= 0) {
      const top = straightTop(sm[flushSuit]);
      if (top) return { cat: top === 14 ? CAT.ROYAL : CAT.STRAIGHT_FLUSH, score: pack(CAT.STRAIGHT_FLUSH, [top]) };
    }
    // Group ranks by count, high rank first
    const quads = [], trips = [], pairs = [], singles = [];
    for (let r = 14; r >= 2; r--) {
      if (rc[r] === 4) quads.push(r);
      else if (rc[r] === 3) trips.push(r);
      else if (rc[r] === 2) pairs.push(r);
      else if (rc[r] === 1) singles.push(r);
    }
    const kickers = (exclude, n) => {
      const out = [];
      for (let r = 14; r >= 2 && out.length < n; r--) if (rc[r] && !exclude.includes(r)) out.push(r);
      return out;
    };
    if (quads.length) return { cat: CAT.QUADS, score: pack(CAT.QUADS, [quads[0], ...kickers([quads[0]], 1)]) };
    if (trips.length && (trips.length > 1 || pairs.length)) {
      const t = trips[0], p = Math.max(trips[1] || 0, pairs[0] || 0);
      return { cat: CAT.FULL_HOUSE, score: pack(CAT.FULL_HOUSE, [t, p]) };
    }
    if (flushSuit >= 0) {
      const fr = [];
      for (let r = 14; r >= 2 && fr.length < 5; r--) if (sm[flushSuit] & (1 << r)) fr.push(r);
      return { cat: CAT.FLUSH, score: pack(CAT.FLUSH, fr) };
    }
    const st = straightTop(mask);
    if (st) return { cat: CAT.STRAIGHT, score: pack(CAT.STRAIGHT, [st]) };
    if (trips.length) return { cat: CAT.TRIPS, score: pack(CAT.TRIPS, [trips[0], ...kickers([trips[0]], 2)]) };
    if (pairs.length >= 2) {
      const [a, b] = pairs;
      return { cat: CAT.TWO_PAIR, score: pack(CAT.TWO_PAIR, [a, b, ...kickers([a, b], 1)]) };
    }
    if (pairs.length) return { cat: CAT.PAIR, score: pack(CAT.PAIR, [pairs[0], ...kickers([pairs[0]], 3)]) };
    return { cat: CAT.HIGH, score: pack(CAT.HIGH, kickers([], 5)) };
  }

  // Unbiased integer in [0, n) from a source of uint32s (rejection sampling).
  function makeRandInt(nextU32) {
    return n => {
      const limit = Math.floor(0x100000000 / n) * n;
      let x;
      do { x = nextU32(); } while (x >= limit);
      return x % n;
    };
  }

  // Secure uint32 source from crypto.getRandomValues (browser + Node 19+), buffered for speed.
  function secureU32() {
    const buf = new Uint32Array(4096);
    let i = buf.length;
    return () => {
      if (i === buf.length) { root.crypto.getRandomValues(buf); i = 0; }
      return buf[i++];
    };
  }

  // Deal one round: partial Fisher–Yates, 9 cards. Order: cowboy 2, bull 2, board 5.
  function deal(randInt) {
    const d = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 0; i < 9; i++) {
      const j = i + randInt(52 - i);
      const t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return { cowboy: [d[0], d[1]], bull: [d[2], d[3]], board: d.slice(4, 9) };
  }

  const api = { CAT, CAT_NAME_RU, rankOf, suitOf, card, parse, evaluate, straightTop, makeRandInt, secureU32, deal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RanchEval = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
