const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/ranch/eval.js');
const P = require('../js/ranch/payouts.js');
const { CAT, parse, evaluate } = E;

const ev = s => evaluate(parse(s));
const cmp = (a, b) => Math.sign(ev(a).score - ev(b).score);

test('every hand rank is recognised (7 cards)', () => {
  const cases = [
    ['As Ks Qs Js Ts 2d 3c', CAT.ROYAL],
    ['9h 8h 7h 6h 5h Ac Kd', CAT.STRAIGHT_FLUSH],
    ['7c 7d 7h 7s Kd 2c 3h', CAT.QUADS],
    ['Qc Qd Qh 4s 4d 2c 9h', CAT.FULL_HOUSE],
    ['Ad 9d 7d 4d 2d Kc Qh', CAT.FLUSH],
    ['9c 8d 7h 6s 5d Ac Ah', CAT.STRAIGHT],
    ['Jc Jd Jh 9s 5d 3c 2h', CAT.TRIPS],
    ['Kc Kd 8h 8s 5d 3c 2h', CAT.TWO_PAIR],
    ['Tc Td 8h 6s 5d 3c 2h', CAT.PAIR],
    ['Ac Qd 9h 7s 5d 3c 2h', CAT.HIGH],
  ];
  for (const [hand, cat] of cases) assert.equal(ev(hand).cat, cat, hand);
});

test('category order: each rank beats the one below', () => {
  const ladder = [
    'Ac Qd 9h 7s 5d 3c 2h', 'Tc Td 8h 6s 5d 3c 2h', 'Kc Kd 8h 8s 5d 3c 2h', 'Jc Jd Jh 9s 5d 3c 2h',
    '9c 8d 7h 6s 5d Ac Kh', 'Ad 9d 7d 4d 2d Kc Qh', 'Qc Qd Qh 4s 4d 2c 9h', '7c 7d 7h 7s Kd 2c 3h',
    '9h 8h 7h 6h 5h Ac Kd', 'As Ks Qs Js Ts 2d 3c',
  ];
  for (let i = 1; i < ladder.length; i++) assert.equal(cmp(ladder[i], ladder[i - 1]), 1, ladder[i]);
});

test('wheel straight A-2-3-4-5', () => {
  const w = ev('Ac 2d 3h 4s 5d 9c Kh');
  assert.equal(w.cat, CAT.STRAIGHT);
  assert.equal(cmp('2c 3d 4h 5s 6d 9c Kh', 'Ac 2d 3h 4s 5d 9c Kh'), 1, '6-high straight beats wheel');
  assert.equal(cmp('Ac 2d 3h 4s 5d 9c Kh', 'Kc Kd 8h 8s 5d 3c 2h'), 1, 'wheel beats two pair');
  // steel wheel is a straight flush, not royal; it loses to 6-high straight flush
  assert.equal(ev('Ah 2h 3h 4h 5h 9c Kd').cat, CAT.STRAIGHT_FLUSH);
  assert.equal(cmp('2h 3h 4h 5h 6h 9c Kd', 'Ah 2h 3h 4h 5h 9c Kd'), 1);
  // no wrap-around: Q-K-A-2-3 is not a straight
  assert.equal(ev('Qc Kd Ah 2s 3d 8c 9h').cat, CAT.HIGH);
});

test('broadway beats lower straights; 6-card straight uses the top five', () => {
  assert.equal(cmp('Tc Jd Qh Ks Ad 2c 3h', '9c Tc Jd Qh Ks 2c 3h'), 1);
  assert.equal(cmp('4c 5d 6h 7s 8d 9c 2h', '4c 5d 6h 7s 8d 2c 2h'), 1);
});

test('kickers decide pair, two pair, trips, quads, high card, flush', () => {
  assert.equal(cmp('Tc Td Ah 6s 5d 3c 2h', 'Tc Td Kh 6s 5d 3c 2h'), 1, 'pair kicker');
  assert.equal(cmp('Tc Td Ah 9s 5d 3c 2h', 'Tc Td Ah 8s 5d 3c 2h'), 1, 'pair 3rd kicker');
  assert.equal(cmp('Kc Kd 8h 8s Ad 3c 2h', 'Kc Kd 8h 8s Qd 3c 2h'), 1, 'two pair kicker');
  assert.equal(cmp('Kc Kd 9h 9s 5d 3c 2h', 'Kc Kd 8h 8s Ad 3c 2h'), 1, 'second pair beats kicker');
  assert.equal(cmp('Jc Jd Jh As 5d 3c 2h', 'Jc Jd Jh Ks Qd 3c 2h'), 1, 'trips kicker');
  assert.equal(cmp('7c 7d 7h 7s Ad 2c 3h', '7c 7d 7h 7s Kd Qc Jh'), 1, 'quads kicker');
  assert.equal(cmp('Ac Qd 9h 7s 6d 3c 2h', 'Ac Qd 9h 7s 5d 3c 2h'), 1, 'high card 5th kicker');
  assert.equal(cmp('Ad Kd 7d 4d 3d Qc Jh', 'Ad Qd 9d 7d 4d Kc Jh'), 1, 'flush 2nd card');
});

test('only the best five cards count (6th/7th cards are ignored)', () => {
  // three pairs: best two pairs + best kicker; the 3rd pair's rank can act as kicker
  assert.equal(ev('Kc Kd 8h 8s 5d 5c Ah').cat, CAT.TWO_PAIR);
  assert.equal(cmp('Kc Kd 8h 8s 5d 5c 2h', 'Kc Kd 8h 8s 4d 3c 2h'), 1);
  assert.equal(cmp('Kc Kd 8h 8s 5d 5c Ah', 'Kc Kd 8h 8s Ad 3c 2h'), 0, 'same best five = tie');
  assert.equal(cmp('Ac Qd 9h 7s 5d 3c 2h', 'Ac Qd 9h 7s 5d 4c 3h'), 0, 'only top 5 high cards');
  // two trips -> full house with the lower trips as the pair
  assert.equal(ev('9c 9d 9h 5s 5d 5c 2h').cat, CAT.FULL_HOUSE);
  assert.equal(cmp('9c 9d 9h 5s 5d 5c 2h', '9c 9d 9h 4s 4d Ac Kh'), 1);
  // full house: trips rank first, then pair rank
  assert.equal(cmp('Qc Qd Qh 2s 2d 3c 4h', 'Jc Jd Jh As Ad 3c 4h'), 1);
  // quads + trips on board: quads with best kicker
  assert.equal(ev('7c 7d 7h 7s Kd Kc Kh').cat, CAT.QUADS);
  // flush with 6+ suited cards uses top five
  assert.equal(cmp('Ad Kd 9d 7d 5d 3d 2c', 'Ad Kd 9d 7d 5d 4c 2c'), 0);
  // flush beats straight when both present
  assert.equal(ev('5d 6d 7d 8c 9d 2d Kh').cat, CAT.FLUSH);
});

test('ties between two players sharing a board', () => {
  const board = '2c 3d 4h 5s 6c';
  assert.equal(cmp(`Ah Kd ${board}`, `Qs Jc ${board}`), 0, 'board plays: same straight');
  assert.equal(cmp(`Ac Kd As Ks Qh Jh Th`, `Ah Kh As Ks Qh Jh Th`), -1, 'royal beats broadway straight');
  assert.equal(cmp('Ac Kd Qs Js Ts 9h 2h', 'Ah Kc Qs Js Ts 9h 2h'), 0, 'suits do not break ties');
});

test('resolve(): winner, draws and zones', () => {
  const deal = (c, b, board) => ({ cowboy: parse(c), bull: parse(b), board: parse(board) });
  let r = P.resolve(deal('Ah Ad', 'Kc Qc', '2s 7d 9h Jc 3d'));
  assert.equal(r.winner, 'cowboy');
  assert.ok(r.hits.has('pocketAces') && r.hits.has('pocketPair') && r.hits.has('suitedConn') && r.hits.has('wHighPair'));
  r = P.resolve(deal('Ah Kd', 'As Kc', '2s 7d 9h Jc 3d'));
  assert.equal(r.winner, 'draw');
  assert.ok(r.hits.has('draw') && r.hits.has('wHighPair') && !r.hits.has('pocketPair'));
  r = P.resolve(deal('2h 7d', '9s 9c', '9h 9d 2s 2c 4d'));
  assert.equal(r.winner, 'bull');
  assert.equal(r.winCat, CAT.QUADS);
  assert.ok(r.hits.has('wQuadsPlus'));
  assert.equal(P.jackpotShare(r), P.RANCH.jackpot.share[CAT.QUADS]);
  assert.ok(!r.hits.has('suitedConn'), '2-7 offsuit and 9-9 are neither suited nor connected');
  assert.ok(P.isConnected(parse('Ac 2d')) && P.isConnected(parse('Ac Kd')) && !P.isConnected(parse('Ac 3d')));
});

test('deal(): 9 distinct cards, uniform enough', () => {
  const ri = E.makeRandInt(E.secureU32());
  const counts = new Array(52).fill(0);
  for (let i = 0; i < 52000; i++) {
    const d = E.deal(ri);
    const all = [...d.cowboy, ...d.bull, ...d.board];
    assert.equal(new Set(all).size, 9);
    counts[d.cowboy[0]]++;
  }
  for (const c of counts) assert.ok(c > 800 && c < 1200, 'card frequency ' + c);
});

// Independent reference: score every 5-card subset with a naive evaluator and take the best.
function naive5(cards) {
  const rs = cards.map(E.rankOf).sort((a, b) => b - a);
  const flush = new Set(cards.map(E.suitOf)).size === 1;
  const uniq = [...new Set(rs)];
  let st = 0;
  if (uniq.length === 5 && rs[0] - rs[4] === 4) st = rs[0];
  if (uniq.length === 5 && rs[0] === 14 && rs[1] === 5) st = 5;
  const cnt = {}; rs.forEach(r => (cnt[r] = (cnt[r] || 0) + 1));
  const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const order = groups.map(g => g[1]);
  const shape = groups.map(g => g[0]).join('');
  let cat;
  if (st && flush) return [8, st];
  if (shape === '41') cat = 7; else if (shape === '32') cat = 6; else if (flush) return [5, ...rs];
  else if (st) return [4, st]; else if (shape === '311') cat = 3; else if (shape === '221') cat = 2;
  else if (shape === '2111') cat = 1; else cat = 0;
  return [cat, ...order];
}
const lex = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
function naive7(c) {
  let best = null;
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
    const five = c.filter((_, i) => i !== a && i !== b);
    const s = naive5(five);
    if (!best || lex(s, best) > 0) best = s;
  }
  return best;
}

test('fast evaluator agrees with brute force on 200k random hand pairs', () => {
  const ri = E.makeRandInt(E.secureU32());
  for (let i = 0; i < 200000; i++) {
    const d = E.deal(ri);
    const A = [...d.cowboy, ...d.board], B = [...d.bull, ...d.board];
    const fa = evaluate(A), fb = evaluate(B);
    const na = naive7(A), nb = naive7(B);
    assert.equal(Math.min(fa.cat, 8), na[0], 'category');
    assert.equal(Math.sign(fa.score - fb.score), Math.sign(lex(na, nb)), 'comparison');
  }
});
