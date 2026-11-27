/* Realtime rooms for two-player games, on Firebase Realtime Database (project maria-games-q5i4g).
   This web config is public by design; access is limited by firebase/database.rules.json
   (only rooms/<5-char code> can be read or written, and rooms cannot be listed).
   A room: { game, created, updated, players: {p0, p1}, names: {p0, p1}, seen: {p0, p1}, state: JSON string } */
const DuoNet = (() => {
  const CONFIG_FB = {
    apiKey: 'AIzaSyA_kFHAi9n8LlPE_IFpo6y1YY_cj0upPkU',
    authDomain: 'maria-games-q5i4g.firebaseapp.com',
    databaseURL: 'https://maria-games-q5i4g-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'maria-games-q5i4g',
    appId: '1:932532891096:web:6b3a88614df633ff8b96ad',
  };
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 (matches the rules' regex)
  let ready = null, db = null;

  const load = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить ' + src));
    document.head.appendChild(s);
  });
  function connect() {
    if (!ready) {
      ready = load(SDK + 'firebase-app-compat.js')
        .then(() => load(SDK + 'firebase-database-compat.js'))
        .then(() => {
          const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CONFIG_FB);
          db = firebase.database(app);
          return db;
        });
      ready.catch(() => { ready = null; });
    }
    return ready;
  }
  const roomRef = code => db.ref('rooms/' + code);
  const newCode = () => Array.from({ length: 5 }, () => ALPHABET[(Math.random() * ALPHABET.length) | 0]).join('');
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  const validCode = c => /^[A-HJ-NP-Z2-9]{5}$/.test(c);

  async function createRoom(game, me) {
    await connect();
    for (let t = 0; t < 6; t++) {
      const code = newCode(), ref = roomRef(code);
      const snap = await ref.once('value');
      if (snap.exists()) continue;
      await ref.set({ game, created: Date.now(), updated: Date.now(), players: { p0: me.pid }, names: { p0: me.name }, state: '' });
      return code;
    }
    throw new Error('Не получилось создать комнату, попробуй ещё раз');
  }

  // Join (or re-join) a room. Returns { seat, game }.
  async function joinRoom(code, me, logicFor) {
    await connect();
    const ref = roomRef(code);
    const snap = await ref.once('value'); // fills the local cache so the transaction sees real data
    if (!snap.exists()) throw new Error('Комнаты с таким кодом нет');
    let seat = null, full = false;
    const res = await ref.transaction(cur => {
      if (!cur) return cur;
      const p = cur.players || {};
      if (p.p0 === me.pid) { seat = 0; return; }       // already in: nothing to write
      if (p.p1 === me.pid) { seat = 1; return; }
      if (p.p1) { full = true; return; }
      seat = 1;
      cur.players = { ...p, p1: me.pid };
      cur.names = { ...(cur.names || {}), p1: me.name };
      cur.state = JSON.stringify(logicFor(cur.game).init(Math.random));
      cur.updated = Date.now();
      return cur;
    });
    if (full) throw new Error('В этой комнате уже двое игроков');
    if (seat === null) throw new Error('Не получилось войти в комнату');
    const val = (res.snapshot && res.snapshot.val()) || snap.val();
    return { seat, game: val.game };
  }

  // Make a move. Resolves with null on success or an error message from the game rules.
  async function move(code, seat, mv, logic) {
    let err = null;
    await roomRef(code).transaction(cur => {
      err = null;
      if (!cur || !cur.state) { err = 'Игра ещё не началась'; return; }
      const r = logic.apply(JSON.parse(cur.state), seat, mv, Math.random);
      if (r.error) { err = r.error; return; }
      cur.state = JSON.stringify(r.state);
      cur.updated = Date.now();
      return cur;
    });
    return err;
  }

  function watch(code, cb) {
    const ref = roomRef(code);
    const h = ref.on('value', s => cb(s.val()));
    return () => ref.off('value', h);
  }
  function heartbeat(code, seat) { return roomRef(code).child('seen/p' + seat).set(Date.now()).catch(() => {}); }
  function onConnection(cb) {
    const ref = db.ref('.info/connected'), h = ref.on('value', s => cb(!!s.val()));
    return () => ref.off('value', h);
  }

  return { connect, createRoom, joinRoom, move, watch, heartbeat, onConnection, normCode, validCode };
})();
