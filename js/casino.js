/* Casino: hub, cowboy poker (heads-up Texas Hold'em vs the sheriff), sushi slots. Play money only. */
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
          <div class="tileIcon">🤠🃏</div>
          <div class="tileName">Ковбойский покер</div>
          <div class="tileDesc">Техасский холдем один на один против шерифа</div>
        </button>
        <button class="tile" id="goSlots">
          <div class="tileIcon">🍣🎰</div>
          <div class="tileName">Суши-слоты</div>
          <div class="tileDesc">Три одинаковых — большой выигрыш</div>
        </button>
      </div>
      <p class="small">Здесь только игровые монеты — настоящие деньги не участвуют.</p>`;
    $('goPoker').addEventListener('click', () => Poker.open());
    $('goSlots').addEventListener('click', () => Slots.open());
    refillButton(root);
  }
  return { hub, refillButton };
})();

/* ---------------- Poker ---------------- */
const Poker = (() => {
  const ANTE = 10;
  const RN = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const SU = ['♠', '♥', '♦', '♣'];
  const CAT = ['Старшая карта', 'Пара', 'Две пары', 'Сет', 'Стрит', 'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш'];
  const SAY = {
    greet: ['Ну что, партнёр, сыграем? 🤠', 'Йи-ха! Садись за стол, мэм.', 'В этом салуне я лучший игрок. Пока что.'],
    check: ['Чек.', 'Посмотрим, что дальше…', 'Я пока подожду, мэм.'],
    bet: ['Ставлю {n}. Йи-ха!', 'Поднимем ставки, партнёр: {n}.', '{n} монет — и ни центом меньше.'],
    call: ['Отвечаю.', 'Колл. Меня не напугаешь.', 'Ладно, смотрю.'],
    raise: ['Рейз! Ещё {n}. Это Дикий Запад, детка.', 'Повышаю на {n}.', 'Ещё {n} — проверим твой мотивофосфат.'],
    fold: ['Пас. Твоя взяла, мэм 🎩', 'Ух, сдаюсь. Мотивофосфат у тебя что ли?', 'Пас… шериф отступает.'],
    youFold: ['Мудрое решение, партнёр.', 'Пас? Ну, бывает.', 'Хе-хе, банк мой.'],
    botWin: ['Банк мой! Не грусти, партнёр.', 'Йи-ха! В этот раз удача на моей стороне.', 'Шериф снова на коне 🐎'],
    youWin: ['Чёрт побери, ты хороша!', 'Ну ты даёшь! Шериф повержен.', 'Ты играешь как настоящий ковбой!'],
    tie: ['Ничья! Делим банк по-честному.'],
  };
  const say = (k, n) => pick(SAY[k]).replace('{n}', n);

  /* ---- cards & evaluation ---- */
  function fullDeck() { const d = []; for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s }); return d; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function score(cat, ks) { let s = cat; for (let i = 0; i < 5; i++) s = s * 15 + (ks[i] || 0); return { score: s, cat }; }
  function straightHigh(has) {
    for (let h = 14; h >= 5; h--) {
      let ok = true;
      for (let k = 0; k < 5; k++) { const r = h - k; if (!has[r === 1 ? 14 : r]) { ok = false; break; } }
      if (ok) return h;
    }
    return 0;
  }
  function evaluate(cards) {
    const cnt = Array(15).fill(0), bySuit = [[], [], [], []];
    for (const c of cards) { cnt[c.r]++; bySuit[c.s].push(c.r); }
    const fs = bySuit.findIndex(a => a.length >= 5);
    if (fs >= 0) {
      const has = Array(15).fill(false); bySuit[fs].forEach(r => { has[r] = true; });
      const sh = straightHigh(has); if (sh) return score(8, [sh]);
    }
    const groups = [];
    for (let r = 14; r >= 2; r--) if (cnt[r]) groups.push([cnt[r], r]);
    groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const rest = from => groups.slice(from).map(g => g[1]);
    if (groups[0][0] === 4) return score(7, [groups[0][1], Math.max(...rest(1), 0)]);
    if (groups[0][0] === 3 && groups[1] && groups[1][0] >= 2) return score(6, [groups[0][1], groups[1][1]]);
    if (fs >= 0) return score(5, bySuit[fs].slice().sort((a, b) => b - a).slice(0, 5));
    const sh = straightHigh(cnt.map(c => c > 0)); if (sh) return score(4, [sh]);
    if (groups[0][0] === 3) return score(3, [groups[0][1], ...rest(1).slice(0, 2)]);
    if (groups[0][0] === 2 && groups[1] && groups[1][0] === 2) return score(2, [groups[0][1], groups[1][1], Math.max(...rest(2), 0)]);
    if (groups[0][0] === 2) return score(1, [groups[0][1], ...rest(1).slice(0, 3)]);
    return score(0, rest(0).slice(0, 5));
  }
  function equity(hole, board, iters = 300) {
    const used = new Set([...hole, ...board].map(c => c.r * 4 + c.s));
    const rest = fullDeck().filter(c => !used.has(c.r * 4 + c.s));
    const need = 2 + (5 - board.length);
    let win = 0;
    for (let i = 0; i < iters; i++) {
      for (let k = 0; k < need; k++) { const j = k + ((Math.random() * (rest.length - k)) | 0); [rest[k], rest[j]] = [rest[j], rest[k]]; }
      const b = board.concat(rest.slice(2, need));
      const me = evaluate(hole.concat(b)).score, op = evaluate([rest[0], rest[1]].concat(b)).score;
      win += me > op ? 1 : me === op ? 0.5 : 0;
    }
    return win / iters;
  }

  /* ---- game state ---- */
  let G = null, root = null, timer = null;
  const later = (f, ms = 750) => { clearTimeout(timer); timer = setTimeout(f, ms); };

  function open() {
    clearTimeout(timer);
    root = UI.openScreen('Ковбойский покер 🤠', 'casino', () => { clearTimeout(timer); refundIfMidHand(); Casino.hub(); });
    G = { phase: 'idle', you: [], bot: [], board: [], pot: 0, yb: 0, bb: 0, street: 0, raises: 0, reveal: false, said: say('greet'), result: '' };
    render();
  }
  function refundIfMidHand() {
    // leaving mid-hand: the sheriff takes the pot, like folding
    if (G && (G.phase === 'you' || G.phase === 'bot')) G.phase = 'idle';
  }
  function newHand() {
    if (!Bank.spend(ANTE)) { G.said = `Нужно хотя бы ${ANTE} монет на анте, партнёр.`; render(); return; }
    Sound.fx.chips();
    const d = shuffle(fullDeck());
    Object.assign(G, { deck: d, you: [d.pop(), d.pop()], bot: [d.pop(), d.pop()], board: [], pot: ANTE * 2,
      street: 0, reveal: false, result: '', said: pick(['Раздаю…', 'Карты на стол!', 'Поехали.']) });
    Sound.fx.card();
    startRound();
  }
  function startRound() {
    G.yb = 0; G.bb = 0; G.raises = 0;
    if (Bank.coins === 0) { G.phase = 'bot'; render(); later(endRound, 900); return; }
    G.phase = 'you'; render();
  }
  function youPut(n) { n = Math.min(n, Bank.coins); Bank.spend(n); G.yb += n; G.pot += n; return n; }
  function botPut(n) { G.bb += n; G.pot += n; }
  const raiseSize = () => Math.max(20, Math.round(G.pot / 2 / 5) * 5);

  function act(a) {
    if (G.phase !== 'you') return;
    const facing = G.bb - G.yb;
    if (a === 'fold') { G.said = say('youFold'); finish('bot'); return; }
    if (a === 'call') {
      if (facing > 0) {
        const paid = youPut(facing);
        if (paid < facing) { G.pot -= facing - paid; G.bb -= facing - paid; } // all-in for less: return the extra
        Sound.fx.chips();
        G.said = pick(['Хм…', 'Посмотрим.', 'Смело.']);
        G.phase = 'bot'; render(); later(endRound, 600);
      } else {
        G.said = '…'; G.phase = 'bot'; render(); later(() => botAct(0));
      }
      return;
    }
    const extra = a === 'allin' ? Bank.coins - facing : raiseSize();
    youPut(facing + extra); G.raises++; Sound.fx.chips();
    G.said = pick(['Ого…', 'Так-так-так…', 'Дай-ка подумать…']);
    G.phase = 'bot'; render(); later(() => botAct(G.yb - G.bb), 1000);
  }

  function botAct(facing) {
    const eq = equity(G.bot, G.board, 300);
    const canRaise = G.raises < 2 && Bank.coins > 0;
    if (facing > 0) {
      const odds = facing / (G.pot + facing);
      if (eq > 0.74 && canRaise) {
        const r = Math.min(raiseSize(), Bank.coins);
        botPut(facing + r); G.raises++; G.said = say('raise', r); Sound.fx.chips();
        G.phase = 'you'; render();
      } else if (eq + Math.random() * 0.12 > odds + 0.04 || (G.street === 0 && eq > 0.42)) {
        botPut(facing); G.said = say('call'); Sound.fx.chips();
        render(); later(endRound, 700);
      } else {
        G.said = say('fold'); finish('you');
      }
    } else {
      if ((eq > 0.62 || Math.random() < 0.12) && Bank.coins > 0) {
        const b = Math.min(Math.max(20, Math.round(G.pot * 0.6 / 5) * 5), Bank.coins);
        botPut(b); G.said = say('bet', b); Sound.fx.chips();
        G.phase = 'you'; render();
      } else {
        G.said = say('check');
        render(); later(endRound, 600);
      }
    }
  }
  function endRound() {
    if (G.street === 3) { showdown(); return; }
    G.street++;
    const n = G.street === 1 ? 3 : 1;
    for (let i = 0; i < n; i++) G.board.push(G.deck.pop());
    Sound.fx.card();
    startRound();
  }
  function showdown() {
    G.reveal = true;
    const ey = evaluate(G.you.concat(G.board)), eb = evaluate(G.bot.concat(G.board));
    const names = `У тебя: ${CAT[ey.cat]} · У шерифа: ${CAT[eb.cat]}`;
    if (ey.score > eb.score) { G.said = say('youWin'); finish('you', names); }
    else if (ey.score < eb.score) { G.said = say('botWin'); finish('bot', names); }
    else { G.said = say('tie'); finish('tie', names); }
  }
  function finish(w, names) {
    clearTimeout(timer);
    G.phase = 'done';
    if (w === 'you') { Bank.add(G.pot); G.result = `Ты выиграла ${G.pot} 🪙!`; Sound.fx.win(); }
    else if (w === 'tie') { Bank.add(Math.floor(G.pot / 2)); G.result = `Ничья: +${Math.floor(G.pot / 2)} 🪙`; Sound.fx.level(); }
    else { G.result = `Банк (${G.pot}) забрал шериф`; Sound.fx.lose(); }
    if (names) G.result = names + '\n' + G.result;
    render();
  }

  /* ---- view ---- */
  function cardHTML(c, hidden, hl) {
    if (!c) return '<div class="pcard empty"></div>';
    if (hidden) return '<div class="pcard back"></div>';
    const red = c.s === 1 || c.s === 2;
    return `<div class="pcard${red ? ' red' : ''}${hl ? ' hl' : ''}"><span>${RN[c.r] || c.r}</span><b>${SU[c.s]}</b></div>`;
  }
  function handHint() {
    if (!G.you.length) return '';
    if (G.board.length < 3) return G.you[0].r === G.you[1].r ? 'У тебя: Пара 👀' : 'Ждём флоп…';
    return 'У тебя: ' + CAT[evaluate(G.you.concat(G.board)).cat];
  }
  function render() {
    if (!root || !G) return;
    const facing = G.bb - G.yb;
    const board = [0, 1, 2, 3, 4].map(i => cardHTML(G.board[i])).join('');
    const bot = G.bot.length ? G.bot.map(c => cardHTML(c, !G.reveal)).join('') : cardHTML(null) + cardHTML(null);
    const you = G.you.length ? G.you.map(c => cardHTML(c, false, true)).join('') : cardHTML(null) + cardHTML(null);
    let actions = '';
    if (G.phase === 'idle' || G.phase === 'done') {
      actions = `<button class="btn gold" data-a="deal">${G.phase === 'done' ? 'Ещё раздача' : 'Раздать'} (анте ${ANTE} 🪙)</button>`;
    } else if (G.phase === 'you') {
      const stack = Bank.coins;
      const callLbl = facing > 0 ? `Колл ${Math.min(facing, stack)}` : 'Чек';
      const canRaise = G.raises < 2 && stack > facing;
      const r = Math.min(raiseSize(), stack - facing);
      actions =
        (facing > 0 ? '<button class="btn gray" data-a="fold">Пас</button>' : '') +
        `<button class="btn" data-a="call">${callLbl}</button>` +
        (canRaise ? `<button class="btn" data-a="raise">${facing > 0 ? 'Рейз' : 'Ставка'} +${r}</button>` : '') +
        (canRaise ? `<button class="btn gold" data-a="allin">Ва-банк (${stack})</button>` : '');
    } else {
      actions = '<div class="thinking">Шериф думает… 🤔</div>';
    }
    root.innerHTML = `
      <div class="poker">
        <div class="sheriff"><div class="avatar">🤠</div>
          <div class="bubble"><b>${esc(CONFIG.sheriff)}:</b> ${esc(G.said)}</div></div>
        <div class="row">${bot}</div>
        <div class="row">${board}</div>
        <div class="potline"><span class="pot">Банк: ${G.pot} 🪙</span>${G.result ? `<span class="result">${esc(G.result)}</span>` : ''}</div>
        <div class="row">${you}</div>
        <div class="hint">${esc(handHint())}</div>
        <div class="actions">${actions}</div>
        <details class="rules"><summary>Правила</summary>
          <p>Обе стороны ставят анте ${ANTE}. У тебя две карты, на стол выходят пять общих (флоп, тёрн, ривер).
          Собери лучшую комбинацию из пяти карт. Чек — пропустить, Колл — уравнять, Ставка/Рейз — поднять, Пас — сдаться.
          Комбинации по старшинству: старшая карта, пара, две пары, сет, стрит, флеш, фулл-хаус, каре, стрит-флеш.</p>
        </details>
      </div>`;
    root.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
      Sound.wake();
      const a = b.dataset.a;
      if (a === 'deal') newHand(); else act(a);
    }));
    if (G.phase === 'idle' || G.phase === 'done') Casino.refillButton(root.querySelector('.poker'));
  }

  return { open, evaluate, equity, CAT, _state: () => G, _act: act, _deal: () => newHand() };
})();

/* ---------------- Slots ---------------- */
const Slots = (() => {
  const SYM = [
    { e: '🍣', w: 5, x3: 8 },
    { e: '🍵', w: 5, x3: 6 },
    { e: '❤️', w: 4, x3: 12 },
    { e: '🤠', w: 3, x3: 15 },
    { e: '💊', w: 1.5, x3: 50 },
    { e: '🦠', w: 4, x3: 0 },
  ];
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
    if (pair && pair !== '🦠') { const m = pair === '❤️' ? 3 : 2; return { win: bet * m, msg: `Два ${pair} — ×${m}` }; }
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
        <div class="bets">${[5, 10, 25].map(b => `<button class="chip${b === bet ? ' on' : ''}" data-b="${b}">${b}</button>`).join('')}</div>
        <button class="btn gold big" id="spin">Крутить! 🎰</button>
        <div class="paytable">
          ${SYM.filter(s => s.x3).map(s => `<span>${s.e}${s.e}${s.e} ×${s.x3}</span>`).join('')}
          <span>Любые два ×2 (❤️❤️ ×3)</span><span>🦠🦠🦠 — апчхи!</span>
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
