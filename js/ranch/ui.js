/* Ranch Showdown screen: "Ковбой против Быка". All logic lives in RanchEngine; this only draws. */
const Ranch = (() => {
  const E = RanchEval, P = RanchPayouts, R = P.RANCH, X = RanchEngine;
  const RK = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const SU = ['♠', '♥', '♦', '♣'];
  const ZN = Object.fromEntries(R.zones.map(z => [z.id, z]));
  const WIN_RU = { cowboy: 'Ковбой', bull: 'Бык', draw: 'Ничья' };
  // when each card turns over during REVEAL (ms): both hands, then board cards 2..5
  const REVEAL_AT = { holes: 300, b1: 1100, b2: 1800, b3: 2500, b4: 3200 };

  let root = null, chip = R.chips[0], off = null, tick = null, sig = {}, lastTick = -1, revealSeen = 0;

  const fmt = n => n >= 10000 ? Math.round(n / 1000) + 'K' : n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : String(n);
  function cardHTML(c, hidden, empty) {
    if (empty) return '<div class="pcard empty"></div>';
    if (hidden) return '<div class="pcard back"></div>';
    const r = E.rankOf(c), s = E.suitOf(c);
    return `<div class="pcard ${s === 1 || s === 2 ? 'red' : ''}"><b>${RK[r] === 'T' ? '10' : RK[r] || r}</b>${SU[s]}</div>`;
  }
  // set innerHTML only when the content actually changed (keeps animations from restarting)
  function put(id, html) { if (sig[id] === html) return; sig[id] = html; const el = $(id); if (el) el.innerHTML = html; }

  function open() {
    root = UI.openScreen('Ковбой против Быка 🤠🐂', 'casino ranchscr', close);
    sig = {}; revealSeen = 0;
    root.innerHTML = `
      <div class="ranch">
        <div class="rtop">
          <div class="rid" id="rId"></div>
          <div class="jp">💰 Джекпот <b id="rJp"></b></div>
        </div>
        <div class="rtools">
          <button class="trend" id="rTrend" aria-label="Тренды"></button>
          <button class="ricon" data-m="lb" aria-label="Рейтинг">🏆</button>
          <button class="ricon" data-m="rec" aria-label="Мои ставки">📜</button>
          <button class="ricon" data-m="rules" aria-label="Правила">❓</button>
        </div>
        <div class="rtimer"><div class="rbar" id="rBar"></div><span id="rPhase"></span></div>
        <div class="rtable">
          <div class="rside cowboy" id="rCow"><div class="who">🤠 Ковбой</div><div class="row" id="rCowC"></div><div class="hand" id="rCowH"></div></div>
          <div class="rside bull" id="rBull"><div class="who">🐂 Бык</div><div class="row" id="rBullC"></div><div class="hand" id="rBullH"></div></div>
          <div class="row board" id="rBoard"></div>
        </div>
        <div class="rbanner" id="rBanner"></div>
        <div class="zones" id="rZones"></div>
        <div class="chips" id="rChips"></div>
        <div class="balline"><span>Баланс 🪙 <b class="coinval">${Bank.coins}</b></span><span id="rWin">Выигрыш: 0</span></div>
        <div class="top5"><div class="zlabel">Топ-5 ставок раунда</div><div id="rTop"></div></div>
        <p class="small">Только игровые монеты — настоящие деньги не участвуют.</p>
      </div>
      <div class="rmodal" id="rModal"><div class="rmbox"><div class="rmhead"><div class="rmtabs" id="rmTabs"></div><button class="rmclose" id="rmClose" aria-label="Закрыть">✕</button></div><div class="rmbody" id="rmBody"></div></div></div>`;

    buildZones();
    buildChips();
    root.querySelector('.rtools').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      Sound.wake();
      if (b.id === 'rTrend') trendModal(); else ({ lb: lbModal, rec: recModal, rules: rulesModal })[b.dataset.m]();
    });
    $('rmClose').addEventListener('click', closeModal);
    $('rModal').addEventListener('click', e => { if (e.target.id === 'rModal') closeModal(); });

    off = X.on(ev => {
      if (ev === 'round') { revealSeen = 0; Sound.fx.chips(); }
      if (ev === 'result') onResult();
      render();
    });
    tick = setInterval(render, 150);
    X.start();
    render();
    const reward = X.claimReward();
    if (reward) UI.toast(`Вчера ты заняла ${reward.rank} место в рейтинге: +${reward.prize} 🪙 🏆`);
    Casino.refillButton(root.querySelector('.ranch'));
  }

  function close() {
    X.stop(); off && off(); clearInterval(tick); off = null; tick = null;
    Casino.hub();
  }

  // ---------- zones ----------
  function zoneHTML(z) {
    return `<button class="zone z-${z.group} ${z.id === 'cowboy' ? 'zc' : z.id === 'bull' ? 'zb' : z.id === 'draw' ? 'zd' : ''}" data-z="${z.id}">
      <div class="zn">${z.name}</div><div class="zm">x${z.mult}</div>
      <div class="zt" id="zt_${z.id}"></div><div class="zme" id="zme_${z.id}"></div>
      <div class="dots" id="zd_${z.id}"></div>${z.rare ? `<div class="zs" id="zs_${z.id}"></div>` : ''}
    </button>`;
  }
  function buildZones() {
    const by = g => R.zones.filter(z => z.group === g).map(zoneHTML).join('');
    $('rZones').innerHTML = `
      <div class="zgrid g3">${by('main')}</div>
      <div class="zlabel">Любая рука · карты Ковбоя или Быка</div>
      <div class="zgrid g3">${by('any')}</div>
      <div class="zlabel">Выигрышная рука · комбинация победителя</div>
      <div class="zgrid g3 gwin">${by('win')}</div>`;
    $('rZones').addEventListener('click', e => {
      const b = e.target.closest('.zone'); if (!b) return;
      Sound.wake();
      const res = X.bet(b.dataset.z, chip);
      if (res.ok) { Sound.fx.chips(); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
      else if (res.why === 'coins') UI.toast('Не хватает монет — выбери фишку поменьше 🪙');
      else if (res.why === 'closed') UI.toast('Ставки закрыты, подожди следующий раунд ⏳');
    });
  }
  function buildChips() {
    $('rChips').innerHTML = R.chips.map(c => `<button class="rchip c${c}" data-c="${c}">${fmt(c)}</button>`).join('');
    $('rChips').addEventListener('click', e => {
      const b = e.target.closest('.rchip'); if (!b) return;
      chip = +b.dataset.c; Sound.fx.tick(); render();
    });
  }

  // ---------- render ----------
  function render() {
    const r = X.round;
    if (!root || !r) return;
    const t = Date.now(), left = Math.max(0, r.ends - t);
    const dur = R.roundSeconds[r.phase] * 1000, el = dur - left;

    $('rId').textContent = `Раунд #${r.id}`;
    $('rJp').textContent = Math.floor(X.state.jackpot).toLocaleString('ru');
    $('rBar').style.width = (left / dur * 100) + '%';
    $('rBar').className = 'rbar ' + r.phase + (r.phase === 'betting' && left < 4000 ? ' hurry' : '');
    $('rPhase').textContent = r.phase === 'betting' ? `Делайте ставки: ${Math.ceil(left / 1000)} с`
      : r.phase === 'reveal' ? 'Ставки закрыты — раздача…' : `Следующий раунд через ${Math.ceil(left / 1000)} с`;
    if (r.phase === 'betting' && left < 3500) { const s = Math.ceil(left / 1000); if (s !== lastTick) { lastTick = s; Sound.fx.tick(); } }

    // cards
    const d = r.dealt;
    const shown = r.phase === 'betting' ? 0 : r.phase === 'result' ? Infinity : el;
    const holes = shown >= REVEAL_AT.holes;
    const boardN = r.phase === 'betting' ? 1 : 1 + ['b1', 'b2', 'b3', 'b4'].filter(k => shown >= REVEAL_AT[k]).length;
    const flips = (holes ? 1 : 0) + boardN;
    if (r.phase === 'reveal' && flips > revealSeen) { revealSeen = flips; Sound.fx.card(); }
    put('rCowC', d.cowboy.map(c => cardHTML(c, !holes)).join(''));
    put('rBullC', d.bull.map(c => cardHTML(c, !holes)).join(''));
    put('rBoard', d.board.map((c, i) => cardHTML(c, i >= boardN && r.phase !== 'betting', i >= boardN && r.phase === 'betting')).join(''));
    const res = r.result;
    put('rCowH', res ? E.CAT_NAME_RU[res.cowboyCat] : '');
    put('rBullH', res ? E.CAT_NAME_RU[res.bullCat] : '');
    $('rCow').classList.toggle('won', !!res && res.winner === 'cowboy');
    $('rBull').classList.toggle('won', !!res && res.winner === 'bull');
    $('rCow').classList.toggle('lost', !!res && res.winner === 'bull');
    $('rBull').classList.toggle('lost', !!res && res.winner === 'cowboy');

    // banner
    let banner = '';
    if (res) {
      banner = res.winner === 'draw' ? `🤝 Ничья! ${E.CAT_NAME_RU[res.winCat]}` : `${res.winner === 'cowboy' ? '🤠 Победил Ковбой' : '🐂 Победил Бык'} · ${E.CAT_NAME_RU[res.winCat]}`;
      if (r.myWin) banner += `<br><b class="wintxt">Ты выиграла ${r.myWin} 🪙${r.jackpotWin ? ` (джекпот +${r.jackpotWin}!)` : ''}</b>`;
      else if (r.players.has('__me')) banner += '<br>В этот раз мимо — следующий раунд твой 🍀';
    } else if (r.phase === 'betting') banner = 'Кто победит — Ковбой или Бык? Выбери фишку и нажми на поле.';
    else banner = 'Карты открываются…';
    put('rBanner', banner);
    $('rWin').textContent = `Выигрыш: ${r.result ? r.myWin : 0}`;

    // zones
    for (const z of R.zones) {
      const b = r.bets[z.id], st = X.zoneStats(z.id);
      put('zt_' + z.id, `🪙 ${fmt(b.total)}`);
      put('zme_' + z.id, b.me ? `моя: ${fmt(b.me)}` : '');
      put('zd_' + z.id, st.last7.map(h => `<i class="${h ? 'hit' : ''}"></i>`).join('') + '<i class="ph"></i>'.repeat(7 - st.last7.length));
      if (z.rare) put('zs_' + z.id, st.since === null ? '' : st.since ? `${st.since}${st.sinceCapped ? '+' : ''} р. без попадания` : 'было в прошлом раунде');
      const btn = root.querySelector(`.zone[data-z="${z.id}"]`);
      btn.classList.toggle('hit', !!res && res.hits.has(z.id));
      btn.classList.toggle('miss', !!res && !res.hits.has(z.id));
      btn.classList.toggle('mine', b.me > 0);
      btn.disabled = r.phase !== 'betting';
    }
    root.querySelectorAll('.rchip').forEach(c => {
      c.classList.toggle('on', +c.dataset.c === chip);
      c.disabled = +c.dataset.c > Bank.coins;
    });

    // trend strip + top 5
    put('rTrend', X.state.history.slice(0, 10).reverse().map(h => `<i class="t-${h.winner}"></i>`).join('') || '<span>тренды</span>');
    const top = X.topBettors(5);
    put('rTop', top.length ? top.map(p => `<div class="tb ${p.me ? 'me' : ''}"><div class="tav">${p.av}</div><div class="tnm">${esc(p.name)}</div><div class="tam">${fmt(p.amount)}${res && p.win ? ` <span class="tw">+${fmt(p.win)}</span>` : ''}</div></div>`).join('') : '<span class="small">Пока никто не поставил</span>');
  }

  function onResult() {
    const r = X.round;
    if (!r.players.has('__me')) return;
    if (r.jackpotWin) { Sound.fx.win(); UI.toast(`ДЖЕКПОТ! +${r.jackpotWin} 🪙 💰`); }
    else if (r.myWin >= 1000 || r.result.hits.has('wQuadsPlus') || r.result.hits.has('pocketAces')) Sound.fx.win();
    else if (r.myWin > 0) Sound.fx.pick();
    else Sound.fx.lose();
    if (Bank.coins < 20) Casino.refillButton(root.querySelector('.ranch'));
  }

  // ---------- modals ----------
  function modal(tabs, active = 0) {
    $('rmTabs').innerHTML = tabs.map((t, i) => `<button class="rmtab ${i === active ? 'on' : ''}" data-i="${i}">${t.name}</button>`).join('');
    const show = i => {
      $('rmBody').innerHTML = typeof tabs[i].html === 'function' ? tabs[i].html() : tabs[i].html;
      $('rmTabs').querySelectorAll('.rmtab').forEach((b, j) => b.classList.toggle('on', j === i));
      tabs[i].after && tabs[i].after();
    };
    $('rmTabs').onclick = e => { const b = e.target.closest('.rmtab'); if (b) show(+b.dataset.i); };
    show(active);
    $('rModal').classList.add('show');
  }
  function closeModal() { $('rModal').classList.remove('show'); }

  function trendModal() {
    const h = X.state.history;
    const cw = h.filter(x => x.winner === 'cowboy').length, bl = h.filter(x => x.winner === 'bull').length, dr = h.length - cw - bl;
    const pc = n => h.length ? Math.round(n / h.length * 100) : 0;
    const trend = () => `
      <div class="wbar"><div class="wc" style="flex:${cw || 1}">🤠 ${pc(cw)}%</div>${dr ? `<div class="wd" style="flex:${dr}">${pc(dr)}%</div>` : ''}<div class="wb" style="flex:${bl || 1}">${pc(bl)}% 🐂</div></div>
      <p class="small">По последним ${h.length} раундам</p>
      <table class="rt"><tr><th>#</th><th>🤠 Ковбой</th><th>🐂 Бык</th></tr>
      ${h.slice(0, 30).map(x => `<tr><td>${x.id}</td>
        <td class="${x.winner === 'cowboy' ? 'wc' : x.winner === 'draw' ? 'wd' : ''}">${E.CAT_NAME_RU[x.cowboyCat]}</td>
        <td class="${x.winner === 'bull' ? 'wb' : x.winner === 'draw' ? 'wd' : ''}">${E.CAT_NAME_RU[x.bullCat]}</td></tr>`).join('') || '<tr><td colspan="3">Ещё не было раундов</td></tr>'}
      </table>`;
    const t = X.state.today;
    const todayTab = () => `
      <div class="stats">
        ${[['🤠 Победы Ковбоя', t.cowboy], ['🐂 Победы Быка', t.bull], ['🤝 Ничьи', t.draw], ['🅰️ Карманные тузы', t.aces],
           ['👯 Карманные пары', t.pairs], ['🔗 Одной масти / связанные', t.sc], ['💥 Каре и выше', t.quads], ['🎲 Всего раундов', t.rounds]]
          .map(([n, v]) => `<div class="stat"><span>${n}</span><b>${v}</b></div>`).join('')}
      </div>`;
    modal([{ name: 'Тренды', html: trend }, { name: 'Сегодня', html: todayTab }]);
  }

  function lbModal() {
    const rows = X.leaderboard(), mine = X.myRank();
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const mins = Math.round((mid - now) / 60000);
    const list = () => `
      <p class="small">Самый большой выигрыш за сегодня. Сброс в 00:00 — через ${Math.floor(mins / 60)} ч ${mins % 60} мин.<br>${mine ? `Ты сейчас на <b>${mine}</b> месте` : 'Выиграй хоть раз, чтобы попасть в рейтинг'}</p>
      <div class="lb">${rows.slice(0, 100).map((p, i) => `<div class="lbr ${p.me ? 'me' : ''}"><span class="lbn">${i + 1}</span><span>${p.av}</span><span class="lbname">${esc(p.name)}</span><b>${p.won.toLocaleString('ru')}</b><span class="lbp">${X.rewardFor(i + 1) ? '+' + X.rewardFor(i + 1) : ''}</span></div>`).join('') || '<p class="small">Сегодня ещё никто не выигрывал</p>'}</div>`;
    const rewards = () => `<table class="rt"><tr><th>Место</th><th>Награда</th></tr>${R.leaderboard.rewards.map(t => `<tr><td>${t.from === t.to ? t.from : t.from + '–' + t.to}</td><td>🪙 ${t.prize}</td></tr>`).join('')}</table><p class="small">Награду за вчерашнее место получишь, когда зайдёшь сюда на следующий день.</p>`;
    modal([{ name: 'Рейтинг дня', html: list }, { name: 'Награды', html: rewards }]);
  }

  function recModal() {
    const rec = X.state.records;
    const name = z => z === 'jackpot' ? '💰 Джекпот' : ZN[z].name;
    const total = rec.reduce((s, r) => s + r.win - r.amt, 0);
    modal([{ name: 'Мои ставки', html: () => `
      <p class="small">Итого: <b>${total >= 0 ? '+' : ''}${total}</b> 🪙 за последние ${rec.length} ставок</p>
      <table class="rt"><tr><th>#</th><th>Поле</th><th>Ставка</th><th>Выигрыш</th></tr>
      ${rec.slice(0, 100).map(r => `<tr><td>${r.id}</td><td>${name(r.zone)}</td><td>${r.amt || ''}</td><td class="${r.win ? 'wc' : ''}">${r.win ? '+' + r.win : '—'}</td></tr>`).join('') || '<tr><td colspan="4">Ставок пока нет</td></tr>'}</table>` }]);
  }

  function rulesModal() {
    const z = id => `<b>x${ZN[id].mult}</b>`;
    const sh = R.jackpot.share, C = E.CAT;
    const game = `
      <p>Каждый раунд Ковбой 🤠 и Бык 🐂 получают по 2 карты, на стол выкладываются 5 общих карт — как в техасском холдеме. У кого лучшая комбинация из 5 карт (из своих 2 + 5 общих), тот и победил. Одинаковые комбинации — ничья.</p>
      <p>Раунд: <b>${R.roundSeconds.betting} секунд на ставки</b> (одна общая карта уже открыта) → раздача остальных карт → результат.</p>
      <p><b>Главные ставки:</b> Ковбой ${z('cowboy')} · Ничья ${z('draw')} · Бык ${z('bull')}. При ничьей ставки на Ковбоя и Быка проигрывают.</p>
      <p><b>Любая рука</b> — смотрим на карманные карты обоих: одной масти или соседние по старшинству (A-K и A-2 тоже) ${z('suitedConn')}, карманная пара ${z('pocketPair')}, карманные тузы ${z('pocketAces')}.</p>
      <p><b>Выигрышная рука</b> — комбинация победителя (при ничьей — общая): старшая карта/пара ${z('wHighPair')}, две пары ${z('wTwoPair')}, сет/стрит/флеш ${z('wTSF')}, фулл-хаус ${z('wFull')}, каре/стрит-флеш/роял ${z('wQuadsPlus')}.</p>
      <p>Множитель — это сколько вернётся с каждой монеты вместе со ставкой. Ставить можно на несколько полей и много раз, пока идёт таймер.</p>
      <p>Точки под полем — попадало ли оно в последних 7 раундах.</p>`;
    const jp = `
      <p>${R.jackpot.feePercent}% от каждой ставки всех игроков пополняет джекпот 💰 (из доли казино — твой выигрыш от этого не уменьшается).</p>
      <p>Если ты поставила на победившую сторону (Ковбой / Бык / Ничья), а у победителя:</p>
      <table class="rt"><tr><td>Каре</td><td><b>${sh[C.QUADS] * 100}%</b> джекпота</td></tr><tr><td>Стрит-флеш</td><td><b>${sh[C.STRAIGHT_FLUSH] * 100}%</b> джекпота</td></tr><tr><td>Роял-флеш</td><td><b>${sh[C.ROYAL] * 100}%</b> джекпота</td></tr></table>
      <p>Если таких игроков несколько, выигрыш делится пропорционально ставкам.</p>`;
    const last = X.state.history[0];
    const fair = () => `
      <p>Перед ставками показывается <b>хэш</b> (SHA-256) секретного зерна раунда. Все карты вычисляются из этого зерна, поэтому подменить их после ставок нельзя. После раунда зерно открывается — можно проверить, что хэш совпадает и карты те же.</p>
      ${X.provable ? '' : '<p><b>Проверка недоступна:</b> страница открыта не по https.</p>'}
      ${X.round && X.round.phase !== 'result' ? `<p class="mono">Текущий раунд #${X.round.id}<br>хэш: ${X.round.hash || '—'}<br>зерно: откроется после раунда</p>` : ''}
      ${last ? `<p class="mono">Прошлый раунд #${last.id}<br>хэш: ${last.hash || '—'}<br>зерно: ${last.seed}</p><button class="btn gold" id="rVerify">Проверить раунд #${last.id}</button><p id="rVerOut"></p>` : ''}
      <p class="small">Как считаются карты: блоки SHA-256(«зерно:0»)…SHA-256(«зерно:7») → 32-битные числа → тасовка Фишера–Йетса; первые 9 карт: Ковбой 2, Бык 2, стол 5.</p>`;
    modal([{ name: 'Правила игры', html: game }, { name: 'Джекпот', html: jp }, {
      name: 'Честность', html: fair, after: () => {
        const b = $('rVerify'); if (!b) return;
        b.addEventListener('click', async () => {
          const ok = await X.verify(last);
          $('rVerOut').textContent = ok === null ? 'Проверка недоступна в этом браузере.' : ok ? '✅ Всё сходится: хэш и карты совпадают.' : '❌ Не совпадает!';
        });
      },
    }]);
  }

  return { open };
})();
