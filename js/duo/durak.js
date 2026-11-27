/* Дурак подкидной, two players. Pure game logic: state in, state out. Shared by browser and tests.
   Card = 0..35: suit = floor(c / 9) (0 ♠, 1 ♥, 2 ♦, 3 ♣), rank = 6 + c % 9 (6..14, 14 = ace). */
(function (root) {
  const suit = c => Math.floor(c / 9), rank = c => 6 + (c % 9);
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = { 11: 'В', 12: 'Д', 13: 'К', 14: 'Т' };
  const label = c => (RANKS[rank(c)] || rank(c)) + SUITS[suit(c)];

  function shuffled(rnd) {
    const d = Array.from({ length: 36 }, (_, i) => i);
    for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  // does card b beat card a with this trump?
  function beats(b, a, trump) {
    if (suit(b) === suit(a)) return rank(b) > rank(a);
    return suit(b) === trump && suit(a) !== trump;
  }

  function init(rnd, prevLoser) {
    const deck = shuffled(rnd);
    const trumpCard = deck[deck.length - 1], trump = suit(trumpCard);
    const hands = [[], []];
    for (let k = 0; k < 6; k++) { hands[0].push(deck.shift()); hands[1].push(deck.shift()); }
    // first attacker: lowest trump; if nobody has one, the previous loser (or random)
    const low = h => Math.min(...h.filter(c => suit(c) === trump).map(rank), 99);
    let attacker = low(hands[0]) < low(hands[1]) ? 0 : low(hands[1]) < low(hands[0]) ? 1 : null;
    if (attacker === null) attacker = prevLoser === 0 || prevLoser === 1 ? prevLoser : (rnd() < 0.5 ? 0 : 1);
    return {
      kind: 'durak', phase: 'play', deck, trump, trumpCard, hands, table: [], attacker,
      taking: false, limit: 6, discard: 0, winner: null, last: null, round: 1,
    };
  }

  const defender = s => 1 - s.attacker;
  const tableRanks = s => new Set(s.table.flatMap(p => (p.d === null ? [p.a] : [p.a, p.d])).map(rank));
  const sortHand = (h, trump) => h.sort((a, b) => (suit(a) === trump) - (suit(b) === trump) || suit(a) - suit(b) || rank(a) - rank(b));

  function refill(s, first) {
    for (const p of [first, 1 - first]) while (s.hands[p].length < 6 && s.deck.length) s.hands[p].push(s.deck.shift());
  }
  function checkEnd(s) {
    if (s.deck.length) return;
    const e0 = !s.hands[0].length, e1 = !s.hands[1].length;
    if (e0 && e1) { s.phase = 'over'; s.winner = 'draw'; }
    else if (e0 || e1) { s.phase = 'over'; s.winner = e0 ? 0 : 1; } // the other one is the дурак
  }
  function canAdd(s, card) {
    if (s.table.length >= s.limit) return false;
    if (!s.table.length) return true;
    return tableRanks(s).has(rank(card));
  }

  function apply(st, seat, move, rnd) {
    const s = JSON.parse(JSON.stringify(st));
    if (move.type === 'rematch') {
      if (s.phase !== 'over') return { error: 'Игра ещё идёт' };
      const n = init(rnd, s.winner === 'draw' ? null : 1 - s.winner);
      n.round = (s.round || 1) + 1;
      return { state: n };
    }
    if (s.phase !== 'play') return { error: 'Игра окончена' };
    const def = defender(s), hand = s.hands[seat];
    if (move.type === 'attack') {
      if (seat !== s.attacker) return { error: 'Сейчас ты отбиваешься' };
      const c = move.card;
      if (!hand.includes(c)) return { error: 'Нет такой карты' };
      if (!s.table.length) s.limit = Math.min(6, s.hands[def].length);
      const undefended = s.table.filter(p => p.d === null).length;
      if (!canAdd(s, c)) return { error: s.table.length >= s.limit ? 'Больше подкидывать нельзя' : 'Подкидывать можно только карты того же достоинства' };
      if (!s.taking && undefended + 1 > s.hands[def].length) return { error: 'У соперника не хватит карт' };
      hand.splice(hand.indexOf(c), 1);
      s.table.push({ a: c, d: null });
      s.last = { by: seat, type: 'attack', card: c };
      return { state: s };
    }
    if (move.type === 'defend') {
      if (seat !== def) return { error: 'Сейчас ты ходишь' };
      if (s.taking) return { error: 'Ты уже берёшь' };
      const c = move.card, p = s.table[move.i];
      if (!hand.includes(c)) return { error: 'Нет такой карты' };
      if (!p || p.d !== null) return { error: 'Эту карту уже побили' };
      if (!beats(c, p.a, s.trump)) return { error: 'Эта карта не бьёт' };
      hand.splice(hand.indexOf(c), 1);
      p.d = c;
      s.last = { by: seat, type: 'defend', card: c };
      return { state: s };
    }
    if (move.type === 'take') {
      if (seat !== def) return { error: 'Брать может только отбивающийся' };
      if (!s.table.some(p => p.d === null)) return { error: 'Всё уже побито' };
      s.taking = true;
      s.last = { by: seat, type: 'take' };
      return { state: s };
    }
    if (move.type === 'done') { // attacker: «Бито» (all beaten) or «Пусть берёт» (defender is taking)
      if (seat !== s.attacker) return { error: 'Это решает атакующий' };
      if (!s.table.length) return { error: 'Сначала сходи' };
      if (s.taking) {
        for (const p of s.table) { s.hands[def].push(p.a); if (p.d !== null) s.hands[def].push(p.d); }
        s.table = []; s.taking = false;
        refill(s, s.attacker);
        s.last = { by: def, type: 'took' };
        // attacker attacks again
      } else {
        if (s.table.some(p => p.d === null)) return { error: 'Не все карты побиты' };
        s.discard += s.table.length * 2;
        s.table = [];
        refill(s, s.attacker);
        s.last = { by: seat, type: 'bito' };
        s.attacker = def;
      }
      checkEnd(s);
      return { state: s };
    }
    return { error: 'Неизвестный ход' };
  }

  const api = { init, apply, beats, suit, rank, label, SUITS, sortHand, canAdd, defender };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Durak = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
