const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/duo/battleship.js');
const D = require('../js/duo/durak.js');
const rnd = Math.random;

// ---------- Морской бой ----------
test('battleship fleet: right sizes, straight, inside the board, no touching', () => {
  for (let k = 0; k < 300; k++) {
    const ships = B.randomFleet(rnd);
    assert.deepEqual(ships.map(s => s.length).sort((a, b) => b - a), [...B.FLEET].sort((a, b) => b - a));
    const owner = new Map();
    ships.forEach((s, i) => {
      const rows = new Set(s.map(c => c[0])), cols = new Set(s.map(c => c[1]));
      assert.ok(rows.size === 1 || cols.size === 1, 'straight');
      s.forEach(([r, c]) => { assert.ok(r >= 0 && r < 10 && c >= 0 && c < 10); owner.set(r * 10 + c, i); });
    });
    for (const [cell, i] of owner) {
      const r = Math.floor(cell / 10), c = cell % 10;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const o = owner.get((r + dy) * 10 + (c + dx));
        if (r + dy >= 0 && r + dy < 10 && c + dx >= 0 && c + dx < 10 && o !== undefined) assert.equal(o, i, 'ships touch');
      }
    }
  }
});

test('battleship: miss passes the turn, hit keeps it, sinking marks the ring, last ship wins', () => {
  let s = B.init(rnd, 0);
  assert.ok(B.apply(s, 0, { type: 'fire', r: 0, c: 0 }).error, 'cannot fire while placing');
  s = B.apply(s, 0, { type: 'ready' }).state; s = B.apply(s, 1, { type: 'ready' }).state;
  assert.equal(s.phase, 'play');
  assert.ok(B.apply(s, 1, { type: 'fire', r: 0, c: 0 }).error, 'not your turn');
  // find an empty cell on player 1's board -> miss
  const occupied = new Set(s.ships[1].flat().map(([r, c]) => r * 10 + c));
  let empty = 0; while (occupied.has(empty)) empty++;
  s = B.apply(s, 0, { type: 'fire', r: Math.floor(empty / 10), c: empty % 10 }).state;
  assert.equal(s.turn, 1);
  assert.ok(B.apply(s, 1, { type: 'fire', r: 0, c: 0 }).state);
  // player 0 sinks every ship of player 1 (player 1 always misses on free cells in between)
  s = B.init(rnd, 0); s.phase = 'play';
  for (const ship of s.ships[1]) {
    for (const [r, c] of ship) {
      s.turn = 0;
      const out = B.apply(s, 0, { type: 'fire', r, c });
      s = out.state;
      if (s.phase === 'over') break;
      assert.equal(s.turn, 0, 'hit keeps the turn');
    }
    if (s.phase === 'over') break;
    // ring around the sunk ship is marked
    for (const [r, c] of ship) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const y = r + dy, x = c + dx;
      if (y >= 0 && y < 10 && x >= 0 && x < 10) assert.notEqual(s.shots[1][y * 10 + x], '.');
    }
  }
  assert.equal(s.phase, 'over'); assert.equal(s.winner, 0);
  assert.equal(B.shipsLeft(s, 1), 0);
  const again = B.apply(s, 0, { type: 'rematch' }, rnd).state;
  assert.equal(again.phase, 'place'); assert.equal(again.turn, 1, 'loser starts the rematch');
});

// ---------- Дурак ----------
test('durak deal: 6 cards each, trump under the deck, lowest trump attacks', () => {
  for (let k = 0; k < 200; k++) {
    const s = D.init(rnd);
    assert.equal(s.hands[0].length, 6); assert.equal(s.hands[1].length, 6); assert.equal(s.deck.length, 24);
    assert.equal(s.deck[s.deck.length - 1], s.trumpCard); assert.equal(D.suit(s.trumpCard), s.trump);
    const low = h => Math.min(...h.filter(c => D.suit(c) === s.trump).map(D.rank), 99);
    if (low(s.hands[0]) !== low(s.hands[1])) assert.equal(s.attacker, low(s.hands[0]) < low(s.hands[1]) ? 0 : 1);
  }
});

test('durak beats(): higher same suit, trump over non-trump', () => {
  const card = (r, su) => su * 9 + (r - 6);
  assert.ok(D.beats(card(10, 0), card(7, 0), 2));
  assert.ok(!D.beats(card(7, 0), card(10, 0), 2));
  assert.ok(D.beats(card(6, 2), card(14, 0), 2), 'trump six beats non-trump ace');
  assert.ok(!D.beats(card(14, 1), card(6, 2), 2), 'non-trump cannot beat trump');
  assert.ok(!D.beats(card(14, 1), card(6, 0), 2), 'other suit');
});

// random legal play until the end: no errors, 36 cards always accounted for
function legalMoves(s) {
  const out = [], a = s.attacker, d = 1 - a;
  for (const c of s.hands[a]) out.push([a, { type: 'attack', card: c }]);
  if (s.table.length) out.push([a, { type: 'done' }]);
  if (!s.taking) {
    s.table.forEach((p, i) => { if (p.d === null) for (const c of s.hands[d]) if (D.beats(c, p.a, s.trump)) out.push([d, { type: 'defend', card: c, i }]); });
    if (s.table.some(p => p.d === null)) out.push([d, { type: 'take' }]);
  }
  return out;
}
test('durak: 300 random games end properly and never lose a card', () => {
  for (let g = 0; g < 300; g++) {
    let s = D.init(rnd), steps = 0;
    while (s.phase === 'play' && steps++ < 2000) {
      const moves = legalMoves(s).filter(([seat, m]) => !D.apply(s, seat, m, rnd).error);
      assert.ok(moves.length, 'someone can always move');
      const [seat, m] = moves[(rnd() * moves.length) | 0];
      s = D.apply(s, seat, m, rnd).state;
      const total = s.deck.length + s.hands[0].length + s.hands[1].length + s.discard + s.table.reduce((n, p) => n + 1 + (p.d !== null), 0);
      assert.equal(total, 36);
      assert.ok(s.table.length <= 6);
    }
    assert.equal(s.phase, 'over');
    assert.equal(s.deck.length, 0);
    if (s.winner === 'draw') assert.ok(!s.hands[0].length && !s.hands[1].length);
    else { assert.equal(s.hands[s.winner].length, 0); assert.ok(s.hands[1 - s.winner].length > 0, 'the дурак keeps cards'); }
  }
});

test('durak rules: only matching ranks can be added, defender may take, attacker can add while taking', () => {
  const s0 = D.init(rnd);
  const a = s0.attacker, d = 1 - a;
  let s = D.apply(s0, a, { type: 'attack', card: s0.hands[a][0] }, rnd).state;
  const r0 = D.rank(s.table[0].a);
  const other = s.hands[a].find(c => D.rank(c) !== r0);
  if (other !== undefined) assert.ok(D.apply(s, a, { type: 'attack', card: other }, rnd).error);
  assert.ok(D.apply(s, a, { type: 'done' }, rnd).error, 'cannot say бито with an unbeaten card');
  s = D.apply(s, d, { type: 'take' }, rnd).state;
  assert.ok(s.taking);
  const before = s.hands[d].length;
  s = D.apply(s, a, { type: 'done' }, rnd).state;
  assert.equal(s.hands[d].length, before + 1);
  assert.equal(s.attacker, a, 'attacker keeps attacking after a take');
});
