/* Морской бой (two players). Pure game logic: state in, state out. Shared by browser and tests.
   Board 10x10. Fleet 4,3,3,2,2,2,1,1,1,1; ships may not touch, even diagonally.
   Shot maps are 100-char strings per board: '.' unknown, 'o' miss, 'x' hit, '#' sunk. */
(function (root) {
  const N = 10, FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  const idx = (r, c) => r * N + c;

  function randomFleet(rnd) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const taken = new Array(N * N).fill(false), ships = [];
      let ok = true;
      for (const len of FLEET) {
        let placed = false;
        for (let t = 0; t < 300 && !placed; t++) {
          const horiz = rnd() < 0.5;
          const r = (rnd() * (horiz ? N : N - len + 1)) | 0, c = (rnd() * (horiz ? N - len + 1 : N)) | 0;
          const cells = [];
          for (let k = 0; k < len; k++) cells.push(horiz ? [r, c + k] : [r + k, c]);
          if (cells.some(([y, x]) => taken[idx(y, x)])) continue;
          // reserve the ship and its surrounding ring
          for (const [y, x] of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy >= 0 && yy < N && xx >= 0 && xx < N) taken[idx(yy, xx)] = true;
          }
          ships.push(cells); placed = true;
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return ships;
    }
    throw new Error('could not place fleet');
  }

  function init(rnd, starter) {
    return {
      kind: 'battleship', phase: 'place',
      ships: [randomFleet(rnd), randomFleet(rnd)],
      shots: ['.'.repeat(N * N), '.'.repeat(N * N)],  // shots[i] = shots fired AT player i
      ready: [false, false],
      turn: starter === 0 || starter === 1 ? starter : (rnd() < 0.5 ? 0 : 1),
      winner: null, last: null, round: 1,
    };
  }

  const shipAt = (ships, r, c) => ships.find(s => s.some(([y, x]) => y === r && x === c));
  const setCh = (s, i, ch) => s.slice(0, i) + ch + s.slice(i + 1);

  // Apply a move from `seat`. Returns { state } or { error }.
  function apply(st, seat, move, rnd) {
    const s = JSON.parse(JSON.stringify(st));
    if (move.type === 'shuffle') {
      if (s.phase !== 'place' || s.ready[seat]) return { error: 'Расстановка уже подтверждена' };
      s.ships[seat] = randomFleet(rnd);
      return { state: s };
    }
    if (move.type === 'ready') {
      if (s.phase !== 'place') return { error: 'Игра уже идёт' };
      s.ready[seat] = true;
      if (s.ready[0] && s.ready[1]) s.phase = 'play';
      return { state: s };
    }
    if (move.type === 'fire') {
      if (s.phase !== 'play') return { error: 'Сейчас нельзя стрелять' };
      if (s.turn !== seat) return { error: 'Сейчас ход соперника' };
      const { r, c } = move, foe = 1 - seat;
      if (!(r >= 0 && r < N && c >= 0 && c < N)) return { error: 'Мимо поля' };
      const i = idx(r, c);
      if (s.shots[foe][i] !== '.') return { error: 'Сюда уже стреляли' };
      const ship = shipAt(s.ships[foe], r, c);
      let res = 'miss';
      if (!ship) { s.shots[foe] = setCh(s.shots[foe], i, 'o'); s.turn = foe; }
      else {
        s.shots[foe] = setCh(s.shots[foe], i, 'x'); res = 'hit';
        if (ship.every(([y, x]) => s.shots[foe][idx(y, x)] !== '.')) {
          res = 'sunk';
          for (const [y, x] of ship) {
            s.shots[foe] = setCh(s.shots[foe], idx(y, x), '#');
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const yy = y + dy, xx = x + dx;
              if (yy >= 0 && yy < N && xx >= 0 && xx < N && s.shots[foe][idx(yy, xx)] === '.') s.shots[foe] = setCh(s.shots[foe], idx(yy, xx), 'o');
            }
          }
          if (s.ships[foe].every(sh => sh.every(([y, x]) => s.shots[foe][idx(y, x)] === '#'))) { s.phase = 'over'; s.winner = seat; }
        }
        // a hit keeps the turn
      }
      s.last = { by: seat, r, c, res };
      return { state: s };
    }
    if (move.type === 'rematch') {
      if (s.phase !== 'over') return { error: 'Игра ещё идёт' };
      const n = init(rnd, 1 - s.winner); // the loser shoots first
      n.round = (s.round || 1) + 1;
      return { state: n };
    }
    return { error: 'Неизвестный ход' };
  }

  const shipsLeft = (s, seat) => s.ships[seat].filter(sh => sh.some(([y, x]) => s.shots[seat][idx(y, x)] !== '#')).length;

  const api = { N, FLEET, init, apply, randomFleet, shipsLeft, idx };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Battleship = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
