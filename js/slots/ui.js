/* Суши-слоты 5x3 screen: spin animation, paylines, free spins, jackpot. Payouts come from SlotsEngine. */
const Slots = (() => {
  const C = SLOTS_CONFIG, S = C.symbols, IDS = Object.keys(S);
  const KEY = 'maria_slots_v1';
  const LINE_COL = ['#ffd23f', '#ff5c98', '#4fc3f7', '#81c784', '#ff9f43', '#b388ff', '#f06292', '#4dd0e1', '#dce775', '#ffffff'];
  const engine = SlotsEngine.createSlots(C);

  let st = { jackpot: C.jackpot.seed, fsLeft: 0, fsBet: 0, fsTotal: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s.jackpot === 'number') st = Object.assign(st, s); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  let root = null, bet = C.bets[0], spinning = false, fsTimer = 0;
  const fmt = n => n.toLocaleString('ru');
  const short = n => n >= 1000 ? (n / 1000) + 'K' : String(n);

  function open() {
    spinning = false;
    root = UI.openScreen('Суши-слоты 🍣', 'casino', close);
    if (bet > Bank.coins && !st.fsLeft) bet = C.bets[0];
    root.innerHTML = `
      <div class="slots5">
        <div class="sjp">💰 ДЖЕКПОТ <b id="sJp"></b></div>
        <div class="sfs" id="sFs"></div>
        <div class="smachine">
          <div class="sgrid" id="sGrid">${[0, 1, 2, 3, 4].map(r => `<div class="scol" id="sCol${r}">${[0, 1, 2].map(row => `<div class="scell" id="c${r}${row}">${S[engine.strips[r][row]].e}</div>`).join('')}</div>`).join('')}</div>
          <svg class="slines" id="sLines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
        </div>
        <div class="smsg" id="sMsg">10 линий · ⭐⭐⭐ — бесплатные вращения · 💰 на всех 5 барабанах — джекпот</div>
        <div class="bets sbets" id="sBets">${C.bets.map(b => `<button class="chip" data-b="${b}">${short(b)}</button>`).join('')}</div>
        <div class="srow">
          <button class="btn gray sinfo" id="sInfo" aria-label="Выплаты">?</button>
          <button class="btn gold big" id="sSpin">Крутить! 🎰</button>
        </div>
        <div id="slRefill"></div>
      </div>
      <div class="rmodal" id="sModal"><div class="rmbox"><div class="rmhead"><div class="rmtabs"><button class="rmtab on">Выплаты</button></div><button class="rmclose" id="sClose" aria-label="Закрыть">✕</button></div><div class="rmbody" id="sBody"></div></div></div>`;
    $('sBets').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b || spinning || st.fsLeft) return;
      bet = +b.dataset.b; Sound.fx.tick(); paint();
    });
    $('sSpin').addEventListener('click', () => spin());
    $('sInfo').addEventListener('click', payModal);
    $('sClose').addEventListener('click', () => $('sModal').classList.remove('show'));
    $('sModal').addEventListener('click', e => { if (e.target.id === 'sModal') $('sModal').classList.remove('show'); });
    paint();
    if (st.fsLeft) { msg(`⭐ У тебя остались бесплатные вращения: ${st.fsLeft}`); fsTimer = setTimeout(spin, 1200); }
  }
  function close() {
    if (spinning) return;
    clearTimeout(fsTimer);
    Casino.hub();
  }

  function paint() {
    if (!root) return;
    $('sJp').textContent = fmt(Math.floor(st.jackpot));
    const fs = st.fsLeft > 0;
    if (fs) bet = st.fsBet;
    root.querySelectorAll('.sbets .chip').forEach(c => {
      c.classList.toggle('on', +c.dataset.b === bet);
      c.disabled = fs || (+c.dataset.b > Bank.coins && +c.dataset.b !== bet);
    });
    $('sFs').innerHTML = fs ? `⭐ Бесплатные вращения: <b>${st.fsLeft}</b> · выигрыши ×${C.freeSpins.multiplier} · всего +${fmt(st.fsTotal)}` : '';
    $('sFs').classList.toggle('show', fs);
    $('sSpin').textContent = fs ? `Бесплатно ⭐ ${st.fsLeft}` : `Крутить ${short(bet)} 🎰`;
    $('sSpin').disabled = spinning;
  }
  const msg = (html, cls = '') => { $('sMsg').innerHTML = html; $('sMsg').className = 'smsg ' + cls; };

  function spin() {
    Sound.wake();
    if (spinning || !root) return;
    const free = st.fsLeft > 0;
    if (!free) {
      if (!Bank.spend(bet)) {
        msg(Bank.coins < C.bets[0] ? `Не хватает монет 🪙 — промокод в казино поможет 😉` : 'Не хватает монет — выбери ставку поменьше 🪙', 'bad');
        Casino.refillButton($('slRefill'));
        return;
      }
      st.jackpot += bet * C.jackpot.feePercent / 100;
    } else { st.fsLeft--; }
    save();
    spinning = true; paint();
    $('sLines').innerHTML = '';
    root.querySelectorAll('.scell').forEach(c => c.classList.remove('win', 'dim'));
    msg(free ? '⭐ Бесплатное вращение…' : 'Крутим…');

    const res = engine.spin(bet, free, st.jackpot);
    // animate: every column flickers, then stops left to right
    const cols = [0, 1, 2, 3, 4].map(r => $('sCol' + r));
    cols.forEach(c => c.classList.add('spin'));
    const iv = setInterval(() => {
      cols.forEach((col, r) => {
        if (!col.classList.contains('spin')) return;
        col.querySelectorAll('.scell').forEach(cell => { cell.textContent = S[IDS[(Math.random() * 7) | 0]].e; });
      });
      Sound.fx.tick();
    }, 75);
    cols.forEach((col, r) => setTimeout(() => {
      col.classList.remove('spin');
      res.grid[r].forEach((id, row) => { $('c' + r + row).textContent = S[id].e; });
      Sound.fx.card();
      if (r === 4) { clearInterval(iv); finish(res, free); }
    }, 550 + r * 230 + (free ? -150 : 0)));
  }

  function finish(res, free) {
    // pay
    if (res.jackpotWin) { st.jackpot = Math.max(C.jackpot.seed, st.jackpot - res.jackpotWin); }
    if (res.win) Bank.add(res.win);
    if (free) st.fsTotal += res.win;
    if (res.freeSpins) {
      if (!free) { st.fsBet = bet; st.fsTotal = 0; }
      st.fsLeft += res.freeSpins;
    }
    save();

    // show winning lines and cells
    const winCells = new Set();
    res.lines.forEach(l => l.cells.forEach(([r, row]) => winCells.add(r + '' + row)));
    if (res.moneyWin || res.jackpotWin) res.money.cells.forEach(([r, row]) => winCells.add(r + '' + row));
    if (res.freeSpins) res.stars.cells.forEach(([r, row]) => winCells.add(r + '' + row));
    if (winCells.size) root.querySelectorAll('.scell').forEach(c => c.classList.toggle(winCells.has(c.id.slice(1)) ? 'win' : 'dim', true));
    $('sLines').innerHTML = res.lines.map(l => `<polyline points="${C.lines[l.line].map((row, r) => `${(r + 0.5) * 20},${(row + 0.5) * 33.33}`).join(' ')}" stroke="${LINE_COL[l.line]}" />`).join('');

    // message
    const parts = res.lines.slice(0, 3).map(l => `${S[l.sym].e}×${l.count} +${fmt(l.amount)}`);
    if (res.lines.length > 3) parts.push(`ещё ${res.lines.length - 3} лин.`);
    if (res.moneyWin) parts.push(`💰×${res.money.reels} +${fmt(res.moneyWin)}`);
    let text = '', cls = '';
    if (res.jackpotWin) { text = `💰💰💰 ДЖЕКПОТ! +${fmt(res.jackpotWin)} 🪙 💰💰💰`; cls = 'jack'; Sound.fx.win(); UI.toast(`ДЖЕКПОТ! +${fmt(res.jackpotWin)} 🪙`); }
    else if (res.win >= bet * 10) { text = `БОЛЬШОЙ ВЫИГРЫШ! +${fmt(res.win)} 🪙<br><small>${parts.join(' · ')}</small>`; cls = 'big'; Sound.fx.win(); }
    else if (res.win) { text = `+${fmt(res.win)} 🪙<br><small>${parts.join(' · ')}</small>`; cls = 'won'; Sound.fx.pick(); }
    else text = free ? 'Мимо — следующее вращение бесплатно ⭐' : pick(['Мимо… ещё разок?', 'Почти!', 'Удача уже близко 🍀']);
    if (res.freeSpins) { text = `⭐ ${res.stars.reels} звезды — ${res.freeSpins} бесплатных вращений!${res.win ? `<br><small>+${fmt(res.win)} 🪙</small>` : ''}`; cls = 'big'; Sound.fx.power(); }
    if (!res.win && !res.freeSpins) Sound.fx.lose();
    msg(text, cls);

    spinning = false;
    paint();
    if (st.fsLeft > 0) fsTimer = setTimeout(spin, res.win || res.freeSpins ? 1600 : 900);
    else if (free) {
      setTimeout(() => { if (root) msg(`⭐ Бесплатные вращения закончились: всего +${fmt(st.fsTotal)} 🪙`, st.fsTotal ? 'big' : ''); }, 1300);
    }
    if (Bank.coins < C.bets[0] && !st.fsLeft) Casino.refillButton($('slRefill'));
  }

  function payModal() {
    const lb = n => fmt(Math.round(bet / C.lines.length * n));
    const rows = IDS.filter(id => S[id].pay).map(id => `<tr><td class="spe">${S[id].e}</td><td>${S[id].name}${S[id].wild ? ' — заменяет любой символ' : ''}</td><td>${S[id].pay.map(lb).join(' / ')}</td></tr>`).join('');
    const mini = l => `<svg viewBox="0 0 50 30" class="smini">${[0, 1, 2].map(row => [0, 1, 2, 3, 4].map(r => `<rect x="${r * 10 + 1}" y="${row * 10 + 1}" width="8" height="8" rx="2" fill="${l[r] === row ? '#d4a017' : '#e8dcc0'}"/>`).join('')).join('')}</svg>`;
    $('sBody').innerHTML = `
      <p>Ставка <b>${fmt(bet)}</b> играет на всех 10 линиях. Выигрыш — 3, 4 или 5 одинаковых символов подряд <b>слева направо</b> по линии. Ниже выплаты в монетах за 3 / 4 / 5 при текущей ставке.</p>
      <table class="rt">${rows}</table>
      <p><b>⭐ Звёзды</b> в любом месте: 3 / 4 / 5 → ${C.freeSpins.award[3]} / ${C.freeSpins.award[4]} / ${C.freeSpins.award[5]} бесплатных вращений с той же ставкой, все выигрыши <b>×${C.freeSpins.multiplier}</b>. Новые звёзды добавляют вращения.</p>
      <p><b>💰 Мешки</b> в любом месте: 3 → ×${C.money[3]} ставки, 4 → ×${C.money[4]} ставки, <b>по одному на всех 5 барабанах → ДЖЕКПОТ</b> (сейчас ${fmt(Math.floor(st.jackpot))}). ${C.jackpot.feePercent}% каждой ставки пополняет джекпот. Ставка от ${fmt(C.jackpot.fullBet)} забирает его целиком, меньшая — свою долю (ставка ÷ ${fmt(C.jackpot.fullBet)}).</p>
      <p><b>Линии:</b></p><div class="slinesmap">${C.lines.map((l, i) => `<div>${i + 1}${mini(l)}</div>`).join('')}</div>
      <p class="small">Только игровые монеты.</p>`;
    $('sModal').classList.add('show');
  }

  return { open, _engine: engine, _state: () => st };
})();
