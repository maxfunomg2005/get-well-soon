/* Суши-слоты 5x3: all tunable numbers. Shared by the browser and sim/slots.js.
   Reels are strips of symbols; a spin stops each reel at a random position and shows 3 symbols. */
(function (root) {
  const SLOTS_CONFIG = {
    bets: [100, 500, 5000, 50000, 100000],   // total bet per spin (covers all 10 lines)
    lines: [                                  // row index (0 top, 1 middle, 2 bottom) on reels 1..5
      [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
      [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
    ],
    // pay = multiplier x line bet (line bet = bet / 10) for 3 / 4 / 5 in a row from the left
    symbols: {
      tea:   { e: '🍵', name: 'Чай',    pay: [5, 15, 50] },
      rice:  { e: '🍙', name: 'Онигири', pay: [5, 15, 50] },
      shrimp:{ e: '🍤', name: 'Темпура', pay: [8, 25, 90] },
      sushi: { e: '🍣', name: 'Суши',   pay: [10, 35, 120] },
      heart: { e: '❤️', name: 'Сердце', pay: [15, 60, 250] },
      cowboy:{ e: '🤠', name: 'Ковбой', pay: [25, 100, 500] },
      wild:  { e: '💊', name: 'Мотивофосфат', wild: true, pay: [30, 150, 1000] },
      star:  { e: '⭐', name: 'Звезда', scatter: true },
      money: { e: '💰', name: 'Джекпот', jackpot: true },
    },
    // how many of each symbol sits on each reel's strip (order of strips is fixed, see engine)
    reels: [
      { tea: 7, rice: 7, shrimp: 5, sushi: 4, heart: 3, cowboy: 2, wild: 2, star: 1, money: 2 },
      { tea: 7, rice: 7, shrimp: 5, sushi: 4, heart: 3, cowboy: 2, wild: 3, star: 1, money: 2 },
      { tea: 7, rice: 7, shrimp: 5, sushi: 4, heart: 3, cowboy: 2, wild: 3, star: 2, money: 2 },
      { tea: 7, rice: 7, shrimp: 5, sushi: 4, heart: 3, cowboy: 2, wild: 3, star: 1, money: 2 },
      { tea: 7, rice: 7, shrimp: 5, sushi: 4, heart: 3, cowboy: 2, wild: 2, star: 1, money: 2 },
    ],
    // ⭐ anywhere: 3 / 4 / 5 stars -> free spins at the same bet, all wins multiplied
    freeSpins: { award: { 3: 10, 4: 15, 5: 20 }, multiplier: 2 },
    // 💰 anywhere: 3 / 4 -> x bet, 5 (one on every reel) -> jackpot pool
    money: { 3: 2, 4: 10 },
    jackpot: {
      feePercent: 1,       // of every paid spin goes into the pool (from the house's share)
      seed: 50000,         // pool restarts from this
      fullBet: 5000,       // bets below this win a proportional part: share = bet / fullBet
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SLOTS_CONFIG;
  else root.SLOTS_CONFIG = SLOTS_CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
