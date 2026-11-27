/* «Играть вдвоём»: lobby + rooms + Морской бой and Дурак boards. Moves go through DuoNet; rules live in
   js/duo/battleship.js and js/duo/durak.js. */
const Duo = (() => {
  const KEY = 'maria_duo_v1';
  const GAMES = {
    battleship: { name: 'Морской бой', icon: '🚢', logic: Battleship, desc: 'Расставь флот и потопи корабли соперника' },
    durak: { name: 'Дурак', icon: '🃏', logic: Durak, desc: 'Подкидной дурак на двоих, 36 карт' },
  };
  const logicFor = g => GAMES[g].logic;
  const LETTERS = 'АБВГДЕЖЗИК';

  let me = { pid: '', name: '', rooms: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.pid) me = Object.assign(me, s); } catch (e) {}
  if (!me.pid) me.pid = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(me)); } catch (e) {} };
  save();

  let root = null, room = null; // room: { code, seat, game, data, unwatch, beat, unconn, connected, sel }
  const isHer = () => me.name === CONFIG.herName;
  const g = (fem, masc) => (isHer() ? fem : masc);              // verb forms for "you"
  const oppName = () => (room && room.data && room.data.names && room.data.names['p' + (1 - room.seat)]) || 'соперник';
  const oppIsHer = () => oppName() === CONFIG.herName;
  const og = (fem, masc) => (oppIsHer() ? fem : masc);           // verb forms for the opponent

  // ---------- entry ----------
  function open(code) {
    root = UI.openScreen('Играть вдвоём 🎮', 'duo', () => { leaveRoom(); App.menu(); });
    if (!me.name) return pickName(() => (code ? enter(code) : lobby()));
    code ? enter(code) : lobby();
  }

  function pickName(next) {
    root.innerHTML = `
      <div class="duobox">
        <h2>Кто играет на этом телефоне?</h2>
        <div class="duonames">
          <button class="tile" data-n="${esc(CONFIG.herName)}"><div class="tileIcon">👸</div><div class="tileName">${esc(CONFIG.herName)}</div></button>
          <button class="tile" data-n="${esc(CONFIG.myName)}"><div class="tileIcon">🤴</div><div class="tileName">${esc(CONFIG.myName)}</div></button>
        </div>
      </div>`;
    root.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => { me.name = b.dataset.n; save(); next(); }));
  }

  function lobby() {
    leaveRoom();
    const recent = Object.entries(me.rooms || {}).sort((a, b) => b[1].t - a[1].t).slice(0, 3);
    root.innerHTML = `
      <div class="duobox">
        <p class="small">Ты играешь как <b>${esc(me.name)}</b> · <a href="#" id="dChange">сменить</a></p>
        <div class="hub">
          ${Object.entries(GAMES).map(([id, gm]) => `
            <div class="tile duotile">
              <div class="tileIcon">${gm.icon}</div><div class="tileName">${gm.name}</div><div class="tileDesc">${gm.desc}</div>
              <button class="btn gold" data-new="${id}">Создать игру</button>
            </div>`).join('')}
        </div>
        <form class="promo" id="dJoin" autocomplete="off">
          <label for="dCode">🔑 Войти по коду</label>
          <div class="promoRow">
            <input id="dCode" type="text" maxlength="5" placeholder="Например K7XQ2" autocapitalize="characters" spellcheck="false">
            <button class="btn gold" type="submit">Войти</button>
          </div>
          <div class="promoMsg bad" id="dMsg"></div>
        </form>
        ${recent.length ? `<div class="duorecent"><div class="small">Недавние игры:</div>${recent.map(([c, r]) => `<button class="btn gray" data-code="${c}">${GAMES[r.game] ? GAMES[r.game].icon : '🎮'} ${c}</button>`).join('')}</div>` : ''}
        <p class="small">Один создаёт игру и говорит код, второй вводит его у себя. Ходы видны сразу на обоих телефонах.</p>
      </div>`;
    $('dChange').addEventListener('click', e => { e.preventDefault(); me.name = ''; save(); pickName(lobby); });
    root.querySelectorAll('[data-new]').forEach(b => b.addEventListener('click', () => create(b.dataset.new, b)));
    root.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => enter(b.dataset.code)));
    $('dJoin').addEventListener('submit', e => {
      e.preventDefault();
      const code = DuoNet.normCode($('dCode').value);
      if (!DuoNet.validCode(code)) { $('dMsg').textContent = 'Код — 5 букв и цифр, например K7XQ2'; return; }
      enter(code);
    });
  }

  function busy(text) { root.innerHTML = `<div class="duobox"><p class="duowait">${text}</p></div>`; }
  function fail(e) {
    busy(`😕 ${esc(e && e.message ? e.message : e)}<br><br><button class="btn gold" id="dBack">Назад</button>`);
    $('dBack').addEventListener('click', lobby);
  }

  async function create(game, btn) {
    if (btn) btn.disabled = true;
    busy('Подключаемся…');
    try {
      const code = await DuoNet.createRoom(game, me);
      enter(code);
    } catch (e) { fail(e.message.includes('загрузить') ? 'Нет связи с игровым сервером. Проверь интернет.' : e); }
  }

  async function enter(code) {
    leaveRoom();
    busy('Подключаемся…');
    try {
      const { seat, game } = await DuoNet.joinRoom(code, me, logicFor);
      me.rooms[code] = { game, seat, t: Date.now() };
      const keep = Object.entries(me.rooms).sort((a, b) => b[1].t - a[1].t).slice(0, 6);
      me.rooms = Object.fromEntries(keep); save();
      room = { code, seat, game, data: null, sel: null, connected: true };
      room.unwatch = DuoNet.watch(code, data => { if (!room || room.code !== code) return; const prev = room.data; room.data = data; onUpdate(prev, data); });
      room.unconn = DuoNet.onConnection(ok => { if (room) { room.connected = ok; render(); } });
      DuoNet.heartbeat(code, seat);
      room.beat = setInterval(() => DuoNet.heartbeat(code, seat), 15000);
      try { history.replaceState(null, '', location.pathname + '?room=' + code); } catch (e) {}
    } catch (e) { fail(e.message.includes('загрузить') ? 'Нет связи с игровым сервером. Проверь интернет.' : e); }
  }

  function leaveRoom() {
    if (!room) return;
    room.unwatch && room.unwatch(); room.unconn && room.unconn(); clearInterval(room.beat);
    room = null;
    try { if (location.search.includes('room=')) history.replaceState(null, '', location.pathname); } catch (e) {}
  }

  const stateOf = d => (d && d.state ? JSON.parse(d.state) : null);
  function onUpdate(prev, data) {
    if (!data) { fail('Комната исчезла'); return; }
    const a = stateOf(prev), b = stateOf(data);
    // sounds for the opponent's moves / game end
    if (a && b && b.last && JSON.stringify(a.last) !== JSON.stringify(b.last)) {
      if (b.kind === 'battleship') (b.last.res === 'miss' ? Sound.fx.tick : b.last.res === 'sunk' ? Sound.fx.lose : Sound.fx.hit)();
      else Sound.fx.card();
    }
    if (a && b && a.phase !== 'over' && b.phase === 'over') (b.winner === room.seat ? Sound.fx.win : Sound.fx.lose)();
    if (!a && b) Sound.fx.level();
    render();
  }

  async function send(mv) {
    const err = await DuoNet.move(room.code, room.seat, mv, logicFor(room.game));
    if (err) UI.toast(err);
    return !err;
  }

  // ---------- room screen ----------
  function shareRoom() {
    const url = location.origin + location.pathname + '?room=' + room.code;
    const text = `Сыграем в «${GAMES[room.game].name}»? Код: ${room.code}`;
    if (navigator.share) navigator.share({ title: 'Играть вдвоём', text, url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text + '\n' + url).then(() => UI.toast('Ссылка скопирована 📋'), () => UI.toast(url));
    else UI.toast(url);
  }

  function render() {
    if (!root || !room || !room.data) return;
    const d = room.data, st = stateOf(d), gm = GAMES[room.game];
    const seen = d.seen && d.seen['p' + (1 - room.seat)];
    const online = seen && Date.now() - seen < 45000;
    const head = `
      <div class="duohead">
        <button class="btn gray" id="dLobby">← Игры</button>
        <div class="duoroom">${gm.icon} ${gm.name}<br><small>код <b>${room.code}</b></small></div>
        <button class="btn gold" id="dShare">Позвать 📨</button>
      </div>
      ${!room.connected ? '<div class="duowarn">Нет связи… переподключаемся</div>' : ''}`;
    let body;
    if (!st) {
      body = `<div class="duobox"><p class="duowait">Скажи код второму игроку:</p><div class="duocode">${room.code}</div>
        <p class="duowait small">Ждём соперника… Он(а) открывает «Играть вдвоём» → «Войти по коду».</p></div>`;
    } else {
      const who = `<div class="duoplayers"><span>${esc(me.name)} (ты)</span><span class="${online ? 'on' : 'off'}">${online ? '🟢' : '⚪'} ${esc(oppName())}</span></div>`;
      body = who + (room.game === 'battleship' ? battleHTML(st) : durakHTML(st));
    }
    root.innerHTML = `<div class="duobox">${head}${body}</div>`;
    $('dLobby').addEventListener('click', lobby);
    $('dShare').addEventListener('click', shareRoom);
    if (st) (room.game === 'battleship' ? battleBind : durakBind)(st);
  }

  // ---------- Морской бой ----------
  function grid(shots, ships, enemy, last) {
    const shipSet = new Set((ships || []).flat().map(([r, c]) => r * 10 + c));
    let h = '<div class="bgrid"><div></div>' + [...Array(10)].map((_, c) => `<div class="blab">${LETTERS[c]}</div>`).join('');
    for (let r = 0; r < 10; r++) {
      h += `<div class="blab">${r + 1}</div>`;
      for (let c = 0; c < 10; c++) {
        const i = r * 10 + c, s = shots[i];
        const cls = ['bc'];
        if (!enemy && shipSet.has(i)) cls.push('ship');
        if (s === 'o') cls.push('miss'); else if (s === 'x') cls.push('hit'); else if (s === '#') cls.push('sunk');
        if (enemy && s === '.') cls.push('aim');
        if (last && last.r === r && last.c === c) cls.push('last');
        h += `<div class="${cls.join(' ')}" ${enemy && s === '.' ? `data-r="${r}" data-c="${c}"` : ''}></div>`;
      }
    }
    return h + '</div>';
  }
  function battleHTML(s) {
    const me_ = room.seat, foe = 1 - me_;
    let status;
    if (s.phase === 'place') status = s.ready[me_] ? `Ждём, пока ${esc(oppName())} ${og('расставит', 'расставит')} корабли…` : 'Расставь корабли: «Перемешать», пока не понравится, потом «Готово»';
    else if (s.phase === 'play') status = s.turn === me_ ? '🎯 Твой ход — стреляй по полю соперника!' : `⏳ Стреляет ${esc(oppName())}…`;
    else status = s.winner === me_ ? `🎉 ${g('Ты победила', 'Ты победил')}! Весь флот соперника на дне` : `💥 ${esc(oppName())} ${og('победила', 'победил')}… Реванш?`;
    const lastTxt = s.last ? `${s.last.by === me_ ? 'Ты' : esc(oppName())}: ${LETTERS[s.last.c]}${s.last.r + 1} — ${{ miss: 'мимо', hit: 'ранил', sunk: 'потопил!' }[s.last.res]}` : '';
    const lastFoe = s.last && s.last.by === me_ ? s.last : null, lastMine = s.last && s.last.by === foe ? s.last : null;
    return `
      <div class="duostatus ${s.phase === 'play' && s.turn === me_ ? 'myturn' : ''}">${status}</div>
      ${s.phase === 'place' ? `
        <div class="bwrap"><div class="btitle">Твоё поле</div>${grid(s.shots[me_], s.ships[me_], false, null)}</div>
        <div class="duobtns">${s.ready[me_] ? '' : '<button class="btn gray" id="bShuffle">Перемешать 🔀</button><button class="btn gold" id="bReady">Готово ✔</button>'}</div>` : `
        <div class="bwrap"><div class="btitle">Поле: ${esc(oppName())} · кораблей ${Battleship.shipsLeft(s, foe)}</div>${grid(s.shots[foe], s.phase === 'over' ? s.ships[foe] : null, s.phase === 'play' && s.turn === me_, lastFoe)}</div>
        <div class="small blast">${lastTxt}</div>
        <div class="bwrap small-board"><div class="btitle">Твоё поле · кораблей ${Battleship.shipsLeft(s, me_)}</div>${grid(s.shots[me_], s.ships[me_], false, lastMine)}</div>`}
      ${s.phase === 'over' ? '<div class="duobtns"><button class="btn gold big" id="dAgain">Ещё раз 🔁</button></div>' : ''}`;
  }
  function battleBind(s) {
    const b = id => $(id);
    if (b('bShuffle')) b('bShuffle').addEventListener('click', () => { Sound.fx.tick(); send({ type: 'shuffle' }); });
    if (b('bReady')) b('bReady').addEventListener('click', () => { Sound.fx.pick(); send({ type: 'ready' }); });
    if (b('dAgain')) b('dAgain').addEventListener('click', () => send({ type: 'rematch' }));
    root.querySelectorAll('.bc[data-r]').forEach(cell => cell.addEventListener('click', () => {
      Sound.wake();
      cell.classList.add('pending');
      send({ type: 'fire', r: +cell.dataset.r, c: +cell.dataset.c });
    }));
  }

  // ---------- Дурак ----------
  const D = () => Durak;
  function card(c, extra = '', attrs = '') {
    const su = D().suit(c), red = su === 1 || su === 2;
    const r = D().rank(c), rl = { 11: 'В', 12: 'Д', 13: 'К', 14: 'Т' }[r] || r;
    return `<div class="pcard dcard ${red ? 'red' : ''} ${extra}" ${attrs}><b>${rl}</b>${D().SUITS[su]}</div>`;
  }
  function durakHTML(s) {
    const me_ = room.seat, foe = 1 - me_, att = s.attacker === me_, def = !att;
    const undefended = s.table.some(p => p.d === null), allBeaten = s.table.length && !undefended;
    let status;
    if (s.phase === 'over') {
      status = s.winner === 'draw' ? '🤝 Ничья — никто не остался в дураках!'
        : s.winner === me_ ? `🎉 ${g('Ты выиграла', 'Ты выиграл')}! ${esc(oppName())} — ${og('дурочка', 'дурак')} 😄`
        : `🙈 ${g('Ты осталась в дурочках', 'Ты остался в дураках')}… Реванш?`;
    } else if (att) {
      status = s.taking ? `${esc(oppName())} ${og('берёт', 'берёт')} — можешь подкинуть ещё, потом «Пусть берёт»`
        : !s.table.length ? '🃏 Твой ход — выбери карту'
        : allBeaten ? 'Всё побито — подкинь ещё или нажми «Бито»' : `${esc(oppName())} ${og('отбивается', 'отбивается')}…`;
    } else {
      status = s.taking ? `Ты берёшь… ждём ${esc(oppName())}`
        : !s.table.length ? `⏳ Ходит ${esc(oppName())}…`
        : undefended ? '🛡️ Отбивайся: нажми свою карту (и карту на столе, если надо) или «Беру»' : `Ждём: ${esc(oppName())} подкинет или скажет «Бито»`;
    }
    const hand = D().sortHand([...s.hands[me_]], s.trump);
    const sel = room.sel;
    return `
      <div class="duostatus ${(!s.taking && ((att && (!s.table.length || allBeaten)) || (def && undefended))) && s.phase === 'play' ? 'myturn' : ''}">${status}</div>
      <div class="dopp">${esc(oppName())}: ${s.hands[foe].length} карт<div class="dfan">${'<i></i>'.repeat(Math.min(12, s.hands[foe].length))}</div></div>
      <div class="dmid">
        <div class="ddeck">${s.deck.length ? `<div class="dtrump">${card(s.trumpCard)}</div><div class="dback">${s.deck.length}</div>` : `<div class="dtrumpsuit ${s.trump === 1 || s.trump === 2 ? 'red' : ''}">козырь ${D().SUITS[s.trump]}</div>`}</div>
        <div class="dtable">${s.table.map((p, i) => `<div class="dpair" data-i="${i}">${card(p.a, p.d === null && def && !s.taking ? 'target' : '')}${p.d !== null ? card(p.d, 'cover') : ''}</div>`).join('') || '<div class="small">стол пуст</div>'}</div>
        <div class="dbito small">бито: ${s.discard}</div>
      </div>
      <div class="dhand">${hand.map(c => card(c, c === sel ? 'sel' : '', `data-card="${c}"`)).join('')}</div>
      <div class="duobtns">
        ${s.phase === 'play' && att && s.taking ? '<button class="btn gold" id="dDone">Пусть берёт</button>' : ''}
        ${s.phase === 'play' && att && !s.taking && allBeaten ? '<button class="btn gold" id="dDone">Бито ✔</button>' : ''}
        ${s.phase === 'play' && def && !s.taking && undefended ? '<button class="btn" id="dTake">Беру</button>' : ''}
        ${s.phase === 'over' ? '<button class="btn gold big" id="dAgain">Ещё раз 🔁</button>' : ''}
      </div>`;
  }
  function durakBind(s) {
    const me_ = room.seat, att = s.attacker === me_;
    if ($('dDone')) $('dDone').addEventListener('click', () => { Sound.fx.card(); send({ type: 'done' }); });
    if ($('dTake')) $('dTake').addEventListener('click', () => { Sound.fx.card(); room.sel = null; send({ type: 'take' }); });
    if ($('dAgain')) $('dAgain').addEventListener('click', () => { room.sel = null; send({ type: 'rematch' }); });
    const open = s.table.map((p, i) => (p.d === null ? i : -1)).filter(i => i >= 0);
    root.querySelectorAll('.dhand [data-card]').forEach(el => el.addEventListener('click', () => {
      Sound.wake();
      const c = +el.dataset.card;
      if (s.phase !== 'play') return;
      if (att) { send({ type: 'attack', card: c }); return; }
      if (s.taking || !open.length) return;
      const can = open.filter(i => D().beats(c, s.table[i].a, s.trump));
      if (!can.length) { UI.toast('Эта карта ничего не бьёт'); return; }
      if (can.length === 1) { room.sel = null; send({ type: 'defend', card: c, i: can[0] }); return; }
      room.sel = c; render(); UI.toast('Теперь нажми карту на столе, которую бьёшь');
    }));
    root.querySelectorAll('.dpair').forEach(el => el.addEventListener('click', () => {
      if (room.sel === null || room.sel === undefined) return;
      const i = +el.dataset.i, c = room.sel; room.sel = null;
      send({ type: 'defend', card: c, i });
    }));
  }

  return { open, _me: () => me, _room: () => room };
})();
