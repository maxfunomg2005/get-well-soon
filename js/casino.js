/* Casino: hub + promo code. Games: Cowboy vs Bull (js/ranch/), Морской тир (js/fish/), sushi slots (js/slots/). Play money only. */
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
          <div class="tileDesc">5 барабанов, 10 линий, бесплатные вращения и джекпот</div>
        </button>
      </div>
      <form class="promo" id="promoForm" autocomplete="off">
        <label for="promoIn">🎁 Промокод</label>
        <div class="promoRow">
          <input id="promoIn" type="text" maxlength="20" placeholder="Введи код" autocapitalize="off" spellcheck="false">
          <button class="btn gold" type="submit">Ввести</button>
        </div>
        <div class="promoMsg" id="promoMsg"></div>
      </form>
      <p class="small">Здесь только игровые монеты — настоящие деньги не участвуют.</p>`;
    $('goPoker').addEventListener('click', () => Ranch.open());
    $('goSlots').addEventListener('click', () => Slots.open());
    $('goFish').addEventListener('click', () => FishGame.open());
    $('promoForm').addEventListener('submit', e => {
      e.preventDefault();
      const r = redeem($('promoIn').value);
      $('promoMsg').textContent = r.msg;
      $('promoMsg').className = 'promoMsg ' + (r.ok ? 'ok' : 'bad');
      if (r.ok) { $('promoIn').value = ''; Sound.fx.win(); } else Sound.fx.hit();
    });
    refillButton(root);
  }
  // Promo code: +coins only while the balance is below the limit.
  function redeem(input) {
    const p = CONFIG.promo, code = String(input || '').trim().toLowerCase();
    if (!code) return { ok: false, msg: 'Введи промокод 🙂' };
    if (!p.codes.includes(code)) return { ok: false, msg: 'Такого промокода нет 🤔' };
    if (Bank.coins >= p.maxBalance) return { ok: false, msg: `Промокод работает, когда на счету меньше ${p.maxBalance.toLocaleString('ru')} 🪙` };
    Bank.add(p.coins);
    return { ok: true, msg: `+${p.coins.toLocaleString('ru')} 🪙 от ${CONFIG.myNameGen}! 💖` };
  }
  return { hub, refillButton, redeem };
})();
