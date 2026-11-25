/* Coins + purchases, saved in this browser. */
const Bank = (() => {
  const KEY = 'maria_game_v1';
  const d = { coins: CONFIG.startCoins, owned: [], equip: { hat: null, dress: null, pet: null } };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s.coins === 'number') {
      d.coins = s.coins;
      d.owned = Array.isArray(s.owned) ? s.owned : [];
      Object.assign(d.equip, s.equip || {});
    }
  } catch (e) { /* storage unavailable: play without saving */ }
  const subs = [];
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    subs.forEach(f => f(d.coins));
  }
  return {
    get coins() { return d.coins; },
    add(n) { d.coins = Math.max(0, Math.round(d.coins + n)); save(); },
    spend(n) { n = Math.round(n); if (n < 0 || d.coins < n) return false; d.coins -= n; save(); return true; },
    has(id) { return d.owned.includes(id); },
    buy(id, price) {
      if (this.has(id) || !this.spend(price)) return false;
      d.owned.push(id); save(); return true;
    },
    equip(slot, id) { d.equip[slot] = id; save(); },
    equipped(slot) { return d.equip[slot] || null; },
    onChange(f) { subs.push(f); f(d.coins); },
  };
})();
