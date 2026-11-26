/* Casino: hub, Cowboy vs Bull (js/ranch/), Морской тир (js/fish/), sushi slots. Play money only. */
const Casino = (() => {
  function refillButton(root) {
    if (!root || Bank.coins >= 20 || root.querySelector('.refill')) return;
    const b = document.createElement('button');
    b.className = 'btn gold refill';
    b.textContent = `Попросить монет у ${CONFIG.myNameGen} 💸`;
    b.addEventListener('click', () => {
      Bank.add(50); Sound.fx.coin();
      UI.toast(`${CONFIG.myName}: держи +50, только не всё на мотивофосфат 😄`);
      b.remove();
    });
    root.appendChild(b);
  }
  function hub() {
    const root = UI.openScreen('Казино «Дикий Запад» 🤠', 'casino', () => App.menu());
    root.innerHTML = `
      <div class="hub">
        <button class="tile" id="goPoker">
          <div class="tileIcon">🤠🃏🐂</div>
          <div class="tileName">Ковбой против Быка</div>
          <div class="tileDesc">Ставь на победителя раздачи, комбинации и джекпот</div>
        </button>
        <button class="tile" id="goFish">
          <div class="tileIcon">🐠🔫</div>
          <div class="tileName">Морской тир</div>
          <div class="tileDesc">Стреляй по рыбкам — чем больше рыба, тем больше выигрыш</div>
        </button>
        <button class="tile" id="goSlots">
          <div class="tileIcon">🍣🎰</div>
          <div class="tileName">Суши-слоты</div>
          <div class="tileDesc">Три одинаковых — большой выигрыш</div>
        </button>
      </div>
      <p class="small">Здесь только игровые монеты — настоящие деньги не участвуют.</p>`;
    $('goPoker').addEventListener('click', () => Ranch.open());
    $('goSlots').addEventListener('click', () => Slots.open());
    $('goFish').addEventListener('click', () => FishGame.open());
    refillButton(root);
  }
  return { hub, refillButton };
})();

/* ---------------- Slots ---------------- */
const Slots = (() => {
  // w = how often a symbol lands on a reel, x3 = payout for three in a row. Exact odds: node sim/slots.js
  const SYM = [
    { e: '🍣', w: 5, x3: 15 },
    { e: '🍵', w: 5, x3: 12 },
    { e: '❤️', w: 4, x3: 30 },
    { e: '🤠', w: 3, x3: 60 },
    { e: '💊', w: 2.5, x3: 250 },
    { e: '🦠', w: 1.5, x3: 0 },
  ];
  const PAIR = { def: 1.5, '❤️': 2 };   // any two of a kind (not viruses)
  const BETS = [10, 50, 100, 500, 1000];
  const TOTAL = SYM.reduce((s, x) => s + x.w, 0);
  let bet = 10, spinning = false, root = null;
  function roll() { let r = Math.random() * TOTAL; for (const s of SYM) { r -= s.w; if (r <= 0) return s; } return SYM[0]; }
  function payout(res) {
    const [a, b, c] = res.map(s => s.e);
    if (a === b && b === c) {
      if (a === '🦠') return { win: 0, msg: 'Апчхи! Вирусы съели ставку 🦠' };
      const m = res[0].x3;
      return { win: bet * m, msg: a === '💊' ? `МОТИВОФОСФАТ ДЖЕКПОТ! ×${m} 💊✨` : `Три ${a}! ×${m}` };
    }
    const pair = a === b ? a : b === c ? b : a === c ? a : null;
    if (pair && pair !== '🦠') { const m = PAIR[pair] || PAIR.def; return { win: bet * m, msg: `Два ${pair} — ×${m}` }; }
    return { win: 0, msg: pick(['Мимо… ещё разок?', 'Почти!', 'Удача уже близко 🍀']) };
  }
  function open() {
    spinning = false;
    root = UI.openScreen('Суши-слоты 🍣', 'casino', () => { if (!spinning) Casino.hub(); });
    root.innerHTML = `
      <div class="slots">
        <div class="machine">
          <div class="reels"><div class="reel">🍣</div><div class="reel">💊</div><div class="reel">🤠</div></div>
          <div class="slmsg" id="slMsg">Три одинаковых — большой выигрыш!</div>
        </div>
        <div class="bets">${BETS.map(b => `<button class="chip${b === bet ? ' on' : ''}" data-b="${b}">${b}</button>`).join('')}</div>
        <button class="btn gold big" id="spin">Крутить! 🎰</button>
        <div class="paytable">
          ${SYM.filter(s => s.x3).map(s => `<span>${s.e}${s.e}${s.e} ×${s.x3}</span>`).join('')}
          <span>Любые два ×${PAIR.def} (❤️❤️ ×${PAIR['❤️']})</span><span>🦠🦠🦠 — апчхи!</span>
        </div>
        <div id="slRefill"></div>
      </div>`;
    root.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => {
      if (spinning) return;
      bet = +b.dataset.b;
      root.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
    }));
    $('spin').addEventListener('click', spin);
    Casino.refillButton($('slRefill'));
  }
  function spin() {
    Sound.wake();
    if (spinning) return;
    if (!Bank.spend(bet)) { $('slMsg').textContent = 'Не хватает монет 🪙'; Casino.refillButton($('slRefill')); return; }
    spinning = true; $('spin').disabled = true;
    const reels = root.querySelectorAll('.reel');
    const res = [roll(), roll(), roll()];
    const iv = setInterval(() => {
      reels.forEach((r, i) => { if (!r.dataset.stop) r.textContent = SYM[(Math.random() * SYM.length) | 0].e; });
      Sound.fx.tick();
    }, 80);
    reels.forEach(r => { delete r.dataset.stop; r.classList.add('spin'); });
    res.forEach((s, i) => setTimeout(() => {
      reels[i].dataset.stop = '1'; reels[i].textContent = s.e; reels[i].classList.remove('spin'); Sound.fx.card();
      if (i === 2) {
        clearInterval(iv);
        const p = payout(res);
        if (p.win) { Bank.add(p.win); p.win >= bet * 8 ? Sound.fx.win() : Sound.fx.pick(); }
        else Sound.fx.lose();
        $('slMsg').textContent = p.msg + (p.win ? ` +${p.win} 🪙` : '');
        $('slMsg').classList.toggle('won', p.win > 0);
        spinning = false; $('spin').disabled = false;
        if (Bank.coins < 20) Casino.refillButton($('slRefill'));
      }
    }, 650 + i * 400));
  }
  return { open, payout: (r, b) => { bet = b; return payout(r); }, SYM };
})();
