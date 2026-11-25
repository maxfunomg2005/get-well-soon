/* Shop: cosmetics, pets, perks, and real-life coupons. */
const SHOP_ITEMS = [
  { id: 'hat_cowboy', slot: 'hat',   icon: '🤠', name: 'Ковбойская шляпа', price: 150, desc: 'Для настоящей королевы покера' },
  { id: 'hat_cat',    slot: 'hat',   icon: '🐱', name: 'Кошачьи ушки',     price: 120, desc: 'Мяу' },
  { id: 'hat_crown',  slot: 'hat',   icon: '👑', name: 'Корона',           price: 300, desc: 'Потому что ты принцесса' },
  { id: 'dress_mint', slot: 'dress', color: '#4fcfa8', name: 'Мятное платье',     price: 80,  desc: 'Свежо!' },
  { id: 'dress_lav',  slot: 'dress', color: '#a98bf0', name: 'Лавандовое платье', price: 80,  desc: 'Нежно' },
  { id: 'dress_red',  slot: 'dress', color: '#e8364f', name: 'Красное платье',    price: 150, desc: 'Как у ковбойши в салуне' },
  { id: 'dress_gold', slot: 'dress', color: '#f2b92c', name: 'Золотое платье',    price: 400, desc: 'Для победительницы' },
  { id: 'pet_sushi',  slot: 'pet',   icon: '🍣', name: 'Суши-питомец', price: 250, desc: 'Бежит рядом и улыбается' },
  { id: 'pet_cat',    slot: 'pet',   icon: '🐈', name: 'Котик',        price: 350, desc: 'Бежит рядом и мурчит' },
  { id: 'magnet',     slot: 'perk',  icon: '🧲', name: 'Магнит для монет', price: 200, desc: 'Монеты сами летят к тебе' },
  { id: 'shield',     slot: 'perk',  icon: '🛡️', name: 'Щит мотивофосфата', price: 300, desc: 'Первый вирус на каждом уровне не страшен' },
];

const Shop = (() => {
  let root = null;
  const SECTIONS = [
    ['Шляпки', 'hat'], ['Платья', 'dress'], ['Питомцы', 'pet'], ['Суперсилы', 'perk'],
  ];
  function open() {
    root = UI.openScreen('Магазин 🛍️', 'shop', () => App.menu());
    render();
  }
  function itemCard(it) {
    const owned = Bank.has(it.id);
    const on = it.slot !== 'perk' && Bank.equipped(it.slot) === it.id;
    const icon = it.color ? `<span class="swatch" style="background:${it.color}"></span>` : it.icon;
    let btn;
    if (!owned) btn = `<button class="btn${Bank.coins < it.price ? ' gray' : ''}" data-buy="${it.id}">${it.price} 🪙</button>`;
    else if (it.slot === 'perk') btn = '<button class="btn gray" disabled>Активно ✓</button>';
    else btn = on ? `<button class="btn gray" data-off="${it.slot}">Снять</button>` : `<button class="btn" data-on="${it.id}">Надеть</button>`;
    return `<div class="item${on ? ' on' : ''}"><div class="ic">${icon}</div><div class="nm">${esc(it.name)}</div><div class="ds">${esc(it.desc)}</div>${btn}</div>`;
  }
  function couponCard(c) {
    const owned = Bank.has(c.id);
    const btn = owned
      ? `<button class="btn gold" data-show="${c.id}">Показать 🎟️</button>`
      : `<button class="btn${Bank.coins < c.price ? ' gray' : ''}" data-coupon="${c.id}">${c.price} 🪙</button>`;
    return `<div class="item coupon"><div class="ic">${c.icon}</div><div class="nm">${esc(c.name)}</div><div class="ds">Настоящий купон от ${esc(CONFIG.myNameGen)}</div>${btn}</div>`;
  }
  function render() {
    if (!root) return;
    root.innerHTML = `<div class="shopwrap">` +
      SECTIONS.map(([title, slot]) =>
        `<h2>${title}</h2><div class="grid">${SHOP_ITEMS.filter(i => i.slot === slot).map(itemCard).join('')}</div>`).join('') +
      `<h2>Купоны от ${esc(CONFIG.myNameGen)} 💌</h2><div class="grid">${CONFIG.coupons.map(couponCard).join('')}</div>` +
      `<p class="small">Купи купон и покажи его ${esc(CONFIG.myNameDat)} — он обязан выполнить 😌</p></div>`;
    root.querySelectorAll('button[data-buy]').forEach(b => b.addEventListener('click', () => buy(b.dataset.buy)));
    root.querySelectorAll('button[data-on]').forEach(b => b.addEventListener('click', () => {
      const it = SHOP_ITEMS.find(i => i.id === b.dataset.on); Bank.equip(it.slot, it.id); Sound.fx.pick(); render();
    }));
    root.querySelectorAll('button[data-off]').forEach(b => b.addEventListener('click', () => { Bank.equip(b.dataset.off, null); render(); }));
    root.querySelectorAll('button[data-coupon]').forEach(b => b.addEventListener('click', () => buyCoupon(b.dataset.coupon)));
    root.querySelectorAll('button[data-show]').forEach(b => b.addEventListener('click', () => showCoupon(b.dataset.show)));
  }
  function buy(id) {
    Sound.wake();
    const it = SHOP_ITEMS.find(i => i.id === id);
    if (!Bank.buy(id, it.price)) { UI.toast(`Не хватает монет: нужно ${it.price} 🪙`); return; }
    if (it.slot !== 'perk') Bank.equip(it.slot, it.id);
    Sound.fx.buy(); UI.toast(`Куплено: ${it.name} ✨`); render();
  }
  function buyCoupon(id) {
    Sound.wake();
    const c = CONFIG.coupons.find(x => x.id === id);
    if (!Bank.buy(id, c.price)) { UI.toast(`Не хватает монет: нужно ${c.price} 🪙`); return; }
    Sound.fx.win(); render(); showCoupon(id);
  }
  function showCoupon(id) {
    const c = CONFIG.coupons.find(x => x.id === id);
    UI.overlay('🎟️ Купон', `${c.icon} ${c.name}\n\nВыдан: ${CONFIG.herName}\nДействует: всегда\n\nПокажи этот экран ${CONFIG.myNameDat} 💌`,
      [{ label: 'Ок ♥', cb: () => {} }]);
  }
  return { open };
})();
