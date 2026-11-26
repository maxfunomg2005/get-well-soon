/* Ranch Showdown: bet zones, multipliers, jackpot. Tune numbers here.
   Multiplier = total returned per 1 coin staked (stake included): x2.02 on 100 pays 202. */
(function (root) {
  const E = typeof module !== 'undefined' && module.exports ? require('./eval.js') : root.RanchEval;
  const { CAT, rankOf, suitOf, evaluate } = E;

  const RANCH = {
    roundSeconds: { reveal: 4, result: 5 },   // betting waits for her «Раздать»
    chips: [10, 50, 100, 500, 1000],     // scaled to the game's coin economy (spec: 50/500/1K/3K/10K)
    jackpot: {
      feePercent: 1,          // % of every bet that goes into the pool
      seed: 5000,             // pool restarts from this after it's paid out
      // share of the pool for winning-side bettors when the winner's hand is:
      share: { [CAT.QUADS]: 0.20, [CAT.STRAIGHT_FLUSH]: 0.30, [CAT.ROYAL]: 0.50 },
    },
    // Daily leaderboard: biggest total winnings today (resets 00:00 her local time). Prize paid next day.
    leaderboard: {
      rewards: [
        { from: 1, to: 1, prize: 1000 }, { from: 2, to: 2, prize: 600 }, { from: 3, to: 3, prize: 400 },
        { from: 4, to: 10, prize: 200 }, { from: 11, to: 20, prize: 100 }, { from: 21, to: 50, prize: 50 },
        { from: 51, to: 100, prize: 20 },
      ],
    },
    zones: [
      // main
      { id: 'cowboy', group: 'main', name: 'Ковбой', mult: 2.02 },
      { id: 'draw',   group: 'main', name: 'Ничья',  mult: 30 },
      { id: 'bull',   group: 'main', name: 'Бык',    mult: 2.02 },
      // any hand: either side's hole cards
      { id: 'suitedConn', group: 'any', name: 'Одной масти / связанные', mult: 1.67 },
      { id: 'pocketPair', group: 'any', name: 'Карманная пара', mult: 10, rare: true },
      { id: 'pocketAces', group: 'any', name: 'Карманные тузы', mult: 150, rare: true },
      // winning hand: category of the winner's best hand (on a draw, the tied hand)
      { id: 'wHighPair', group: 'win', name: 'Старшая карта / Пара', mult: 2.25 },
      { id: 'wTwoPair',  group: 'win', name: 'Две пары', mult: 3.1 },
      { id: 'wTSF',      group: 'win', name: 'Сет / Стрит / Флеш', mult: 4.8 },
      { id: 'wFull',     group: 'win', name: 'Фулл-хаус', mult: 25, rare: true },
      { id: 'wQuadsPlus',group: 'win', name: 'Каре / Стрит-флеш / Роял', mult: 400, rare: true },
    ],
  };

  // Hole-card features
  function isSuited(h) { return suitOf(h[0]) === suitOf(h[1]); }
  function isConnected(h) {
    const a = rankOf(h[0]), b = rankOf(h[1]);
    const d = Math.abs(a - b);
    return d === 1 || (Math.min(a, b) === 2 && Math.max(a, b) === 14); // A-2 counts as connected
  }
  function isPair(h) { return rankOf(h[0]) === rankOf(h[1]); }
  function isAces(h) { return rankOf(h[0]) === 14 && rankOf(h[1]) === 14; }

  function winGroup(cat) {
    if (cat <= CAT.PAIR) return 'wHighPair';
    if (cat === CAT.TWO_PAIR) return 'wTwoPair';
    if (cat <= CAT.FLUSH) return 'wTSF';
    if (cat === CAT.FULL_HOUSE) return 'wFull';
    return 'wQuadsPlus';
  }

  // Resolve a dealt round -> winner, hand categories, set of zone ids that hit.
  function resolve(dealt) {
    const c = evaluate([...dealt.cowboy, ...dealt.board]);
    const b = evaluate([...dealt.bull, ...dealt.board]);
    const winner = c.score > b.score ? 'cowboy' : b.score > c.score ? 'bull' : 'draw';
    const winCat = winner === 'bull' ? b.cat : c.cat; // on a draw both are equal
    const hits = new Set([winner, winGroup(winCat)]);
    const hands = [dealt.cowboy, dealt.bull];
    if (hands.some(h => isSuited(h) || isConnected(h))) hits.add('suitedConn');
    if (hands.some(isPair)) hits.add('pocketPair');
    if (hands.some(isAces)) hits.add('pocketAces');
    return { winner, cowboyCat: c.cat, bullCat: b.cat, winCat, hits };
  }

  // Jackpot share triggered this round (0 if none). Only bettors on the winning main zone qualify.
  function jackpotShare(result) {
    return RANCH.jackpot.share[result.winCat] || 0;
  }

  const api = { RANCH, resolve, jackpotShare, isSuited, isConnected, isPair, isAces, winGroup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RanchPayouts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
