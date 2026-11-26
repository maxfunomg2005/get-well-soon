/* Морской тир: renderer + input + simulated table-mates + panels. Kills/payouts are decided only by FishEngine. */
const FishGame = (() => {
  const C = FISH_CONFIG, W = C.world.w, H = C.world.h, T = C.fish;
  const KEY = 'maria_fish_v1';
  const SPR = 2; // sprite resolution (px per world unit)
  const SEAT_COL = ['#ff5c98', '#4fc3f7', '#ffd54f', '#81c784'];
  const BOT_NAMES = [['Боцман Бо', '🧔'], ['Рыбачка Соня', '👩‍🦰'], ['Дядя Миша', '👴'], ['Юнга Тим', '👦'], ['Капитан Ли', '👩‍✈️'], ['Морячка Ната', '👱‍♀️']];

  let store = { freeze: C.freeze.start };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s.freeze === 'number') store = s; } catch (e) {}
  const saveStore = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };

  // ---------- sprites (built once) ----------
  let sprites = null, bg = null, icons = null;
  function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
  function eye(g, x, y, r) {
    g.fillStyle = '#fff'; ell(g, x, y, r, r); g.fill();
    g.fillStyle = '#111'; ell(g, x + r * 0.25, y, r * 0.6, r * 0.6); g.fill();
    g.fillStyle = '#fff'; ell(g, x + r * 0.45, y - r * 0.3, r * 0.22, r * 0.22); g.fill();
  }
  function glow(g, t, r) {
    if (!t.glow) return;
    const gr = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    gr.addColorStop(0, t.glow + 'aa'); gr.addColorStop(1, t.glow + '00');
    g.fillStyle = gr; ell(g, 0, 0, r, r); g.fill();
  }
  // Draw one fish at the origin facing +x. f = 0/1 animation frame.
  function drawShape(g, t, f) {
    const L = t.len, Hh = t.h, w = f ? 0.7 : 1;
    g.lineJoin = 'round'; g.lineCap = 'round';
    glow(g, t, Math.max(L, Hh) * 0.75);
    const sh = t.shape;
    if (sh === 'jelly') {
      g.strokeStyle = t.c1; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const y = (i - 2) * Hh * 0.16; g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(-L * 0.2, y + (f ? 6 : -6), -L * 0.35, y + (f ? -6 : 6), -L * 0.5, y); g.stroke();
      }
      g.fillStyle = t.c1; g.beginPath(); g.ellipse(L * 0.05, 0, L * 0.42, Hh / 2, 0, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill();
      g.fillStyle = t.c2; ell(g, L * 0.2, -Hh * 0.12, L * 0.14, Hh * 0.12); g.fill();
      eye(g, L * 0.3, Hh * 0.1, 3);
      return;
    }
    if (sh === 'puffer') {
      const r = Hh / 2 * (f ? 0.95 : 1);
      g.fillStyle = t.c1; g.beginPath(); g.moveTo(-r * 0.8, 0); g.lineTo(-L / 2, -r * 0.5 * w); g.lineTo(-L / 2, r * 0.5 * w); g.fill();
      g.strokeStyle = '#b8912a'; g.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); g.lineTo(Math.cos(a) * r * 1.22, Math.sin(a) * r * 1.22); g.stroke(); }
      g.fillStyle = t.c1; ell(g, 0, 0, r, r); g.fill();
      g.fillStyle = t.c2; ell(g, 0, r * 0.35, r * 0.75, r * 0.55); g.fill();
      g.fillStyle = '#8a5a00'; for (let i = 0; i < 5; i++) { ell(g, -r * 0.4 + i * r * 0.2, -r * 0.45 + (i % 2) * r * 0.15, 2.2, 2.2); g.fill(); }
      eye(g, r * 0.45, -r * 0.2, r * 0.2);
      g.fillStyle = '#c0392b'; ell(g, r * 0.88, r * 0.15, r * 0.1, r * 0.08); g.fill();
      return;
    }
    if (sh === 'ray') {
      g.strokeStyle = t.c1; g.lineWidth = 3; g.beginPath(); g.moveTo(-L * 0.2, 0); g.quadraticCurveTo(-L * 0.4, f ? 6 : -6, -L * 0.55, 0); g.stroke();
      g.fillStyle = t.c1; g.beginPath(); g.moveTo(L * 0.42, 0);
      g.quadraticCurveTo(L * 0.1, -Hh * 0.5 * w, -L * 0.05, -Hh / 2 * w); g.quadraticCurveTo(-L * 0.1, -Hh * 0.1, -L * 0.25, 0);
      g.quadraticCurveTo(-L * 0.1, Hh * 0.1, -L * 0.05, Hh / 2 * w); g.quadraticCurveTo(L * 0.1, Hh * 0.5 * w, L * 0.42, 0); g.fill();
      g.fillStyle = t.c2; ell(g, L * 0.08, 0, L * 0.18, Hh * 0.14); g.fill();
      eye(g, L * 0.22, -Hh * 0.08, 3); eye(g, L * 0.22, Hh * 0.08, 3);
      return;
    }
    if (sh === 'octo') {
      g.strokeStyle = t.c1; g.lineWidth = Math.max(4, Hh * 0.1);
      for (let i = 0; i < 6; i++) {
        const y = (i - 2.5) * Hh * 0.13, s = (i % 2 ? 1 : -1) * (f ? 1 : -1) * Hh * 0.12;
        g.beginPath(); g.moveTo(-L * 0.05, y * 0.6); g.bezierCurveTo(-L * 0.25, y + s, -L * 0.38, y - s, -L * 0.5, y * 1.3); g.stroke();
      }
      g.fillStyle = t.c1; ell(g, L * 0.18, 0, L * 0.3, Hh * 0.42); g.fill();
      g.fillStyle = t.c2; for (let i = 0; i < 4; i++) { ell(g, L * 0.05 + i * L * 0.08, -Hh * 0.18 + (i % 2) * Hh * 0.1, Hh * 0.05, Hh * 0.05); g.fill(); }
      eye(g, L * 0.32, -Hh * 0.14, Math.max(3, Hh * 0.09)); eye(g, L * 0.32, Hh * 0.14, Math.max(3, Hh * 0.09));
      return;
    }
    if (sh === 'turtle') {
      g.fillStyle = t.c2;
      const fa = f ? 0.5 : -0.2;
      ell(g, L * 0.18, -Hh * 0.38, L * 0.16, Hh * 0.1, -0.6 + fa); g.fill(); ell(g, L * 0.18, Hh * 0.38, L * 0.16, Hh * 0.1, 0.6 - fa); g.fill();
      ell(g, -L * 0.22, -Hh * 0.3, L * 0.1, Hh * 0.07, 0.5 - fa); g.fill(); ell(g, -L * 0.22, Hh * 0.3, L * 0.1, Hh * 0.07, -0.5 + fa); g.fill();
      ell(g, L * 0.4, 0, L * 0.1, Hh * 0.13); g.fill();
      g.fillStyle = t.c1; ell(g, 0, 0, L * 0.33, Hh * 0.38); g.fill();
      g.strokeStyle = '#2a7a4b'; g.lineWidth = 2;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j += 2) { ell(g, i * L * 0.16, j * Hh * 0.12, L * 0.07, Hh * 0.08); g.stroke(); }
      eye(g, L * 0.44, -Hh * 0.04, 3);
      return;
    }
    if (sh === 'whale' || sh === 'orca') {
      g.fillStyle = t.c1; g.beginPath(); g.moveTo(-L * 0.3, 0);
      g.quadraticCurveTo(-L * 0.42, 0, -L * 0.5, -Hh * 0.35 * w); g.lineTo(-L * 0.42, 0); g.lineTo(-L * 0.5, Hh * 0.35 * w); g.quadraticCurveTo(-L * 0.42, 0, -L * 0.3, 0); g.fill();
      g.beginPath(); g.moveTo(L * 0.45, 0); g.bezierCurveTo(L * 0.45, -Hh * 0.6, -L * 0.2, -Hh * 0.5, -L * 0.36, 0);
      g.bezierCurveTo(-L * 0.2, Hh * 0.4, L * 0.45, Hh * 0.55, L * 0.45, 0); g.fill();
      if (sh === 'orca') {
        g.fillStyle = t.c2; ell(g, L * 0.25, -Hh * 0.16, L * 0.07, Hh * 0.07); g.fill();
        g.beginPath(); g.moveTo(L * 0.42, Hh * 0.12); g.quadraticCurveTo(L * 0.1, Hh * 0.42, -L * 0.15, Hh * 0.18); g.quadraticCurveTo(L * 0.1, Hh * 0.2, L * 0.42, Hh * 0.12); g.fill();
        g.fillStyle = t.c1; g.beginPath(); g.moveTo(-L * 0.02, -Hh * 0.38); g.lineTo(-L * 0.1, -Hh * 0.75); g.lineTo(-L * 0.14, -Hh * 0.36); g.fill();
        eye(g, L * 0.3, -Hh * 0.05, 3);
      } else {
        g.strokeStyle = t.c2; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(L * 0.4, Hh * (0.1 + i * 0.06)); g.quadraticCurveTo(L * 0.05, Hh * (0.28 + i * 0.05), -L * 0.15, Hh * (0.12 + i * 0.04)); g.stroke(); }
        eye(g, L * 0.3, -Hh * 0.02, 4);
        g.fillStyle = '#ffffffaa'; ell(g, L * 0.1, -Hh * 0.47, 3, 6); g.fill();
      }
      return;
    }
    // fish-like: fish, tall, long, shark, angler, boss
    const rx = L * (sh === 'long' ? 0.32 : 0.38), ry = Hh / 2 * (sh === 'tall' ? 0.78 : 0.95), cx = L * 0.06;
    g.fillStyle = sh === 'tall' ? t.c2 : t.c1;
    g.beginPath(); g.moveTo(cx - rx * 0.85, 0); g.lineTo(-L / 2, -Hh * 0.42 * w); g.quadraticCurveTo(-L * 0.4, 0, -L / 2, Hh * 0.42 * w); g.closePath(); g.fill();
    if (sh === 'tall') {
      g.beginPath(); g.moveTo(cx + rx * 0.3, -ry * 0.8); g.lineTo(cx - rx * 0.9, -Hh * 0.5); g.lineTo(cx - rx * 0.5, -ry * 0.4); g.fill();
      g.beginPath(); g.moveTo(cx + rx * 0.3, ry * 0.8); g.lineTo(cx - rx * 0.9, Hh * 0.5); g.lineTo(cx - rx * 0.5, ry * 0.4); g.fill();
    } else {
      g.fillStyle = sh === 'shark' ? t.c1 : t.c2;
      g.beginPath(); g.moveTo(cx + rx * 0.2, -ry * 0.85); g.lineTo(cx - rx * (sh === 'shark' ? 0.1 : 0.4), -ry * (sh === 'shark' ? 1.7 : 1.35)); g.lineTo(cx - rx * 0.55, -ry * 0.8); g.fill();
    }
    if (sh === 'long') { g.fillStyle = t.c2; g.beginPath(); g.moveTo(cx + rx * 0.9, -2); g.lineTo(L / 2, 0); g.lineTo(cx + rx * 0.9, 2); g.fill(); }
    g.fillStyle = t.c1;
    if (sh === 'shark') { g.beginPath(); g.moveTo(L * 0.48, 0); g.bezierCurveTo(L * 0.3, -ry * 1.1, -rx * 0.8, -ry, cx - rx, 0); g.bezierCurveTo(-rx * 0.8, ry, L * 0.3, ry * 1.1, L * 0.48, 0); g.fill(); }
    else { ell(g, cx, 0, rx, ry); g.fill(); }
    g.fillStyle = t.c2; g.save(); g.beginPath();
    if (sh === 'shark') { g.moveTo(L * 0.46, ry * 0.15); g.bezierCurveTo(L * 0.3, ry * 0.9, -rx * 0.6, ry * 0.6, cx - rx * 0.9, ry * 0.1); g.closePath(); g.fill(); }
    else if (sh !== 'tall') { g.ellipse(cx, ry * 0.35, rx * 0.8, ry * 0.5, 0, 0, Math.PI); g.fill(); }
    g.restore();
    if (t.stripes) {
      g.fillStyle = sh === 'tall' ? t.c1 : t.c2; g.strokeStyle = '#222'; g.lineWidth = 1.2;
      for (const k of sh === 'tall' ? [-0.4, 0.05] : [-0.45, 0.05, 0.5]) { ell(g, cx + rx * k, 0, rx * 0.11, ry * 0.92); g.fill(); g.stroke(); }
    }
    if (sh === 'tall') { g.fillStyle = t.c1; ell(g, cx, 0, rx * 0.5, ry * 0.8); g.fill(); }
    if (sh === 'shark') { g.strokeStyle = '#5c6772'; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(L * 0.18 - i * 5, -ry * 0.3); g.lineTo(L * 0.16 - i * 5, ry * 0.2); g.stroke(); } }
    if (sh === 'angler') {
      g.strokeStyle = t.c2; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + rx * 0.4, -ry * 0.8); g.quadraticCurveTo(L * 0.45, -Hh * 0.75, L * 0.55, -Hh * 0.35); g.stroke();
      g.fillStyle = t.glow; ell(g, L * 0.55, -Hh * 0.35, 5, 5); g.fill();
      g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx + rx * 0.7 + i * 3, ry * 0.15); g.lineTo(cx + rx * 0.72 + i * 3, ry * 0.35); g.lineTo(cx + rx * 0.75 + i * 3, ry * 0.15); g.fill(); }
    }
    if (sh === 'boss') {
      g.strokeStyle = '#e0a800'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) for (let j = -1; j <= 1; j++) { g.beginPath(); g.arc(cx - rx * 0.5 + i * rx * 0.25, j * ry * 0.35, 9, -Math.PI / 2, Math.PI / 2); g.stroke(); }
      g.fillStyle = '#ffdf00'; g.strokeStyle = '#b8860b'; g.lineWidth = 2;
      g.beginPath(); const bx = cx + rx * 0.15, by = -ry * 0.95;
      g.moveTo(bx - 28, by); g.lineTo(bx - 32, by - 30); g.lineTo(bx - 14, by - 14); g.lineTo(bx, by - 36); g.lineTo(bx + 14, by - 14); g.lineTo(bx + 32, by - 30); g.lineTo(bx + 28, by); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff4f8b'; ell(g, bx, by - 8, 5, 5); g.fill();
      g.fillStyle = '#ff4f8b'; ell(g, cx + rx * 0.62, ry * 0.25, 10, 6); g.fill();
    }
    eye(g, cx + rx * 0.6, -ry * 0.25, Math.max(2.6, Math.min(9, Hh * 0.11)));
  }
  function buildSprites() {
    sprites = T.map(t => {
      const pad = t.glow ? 1.6 : 1.35;
      const w = Math.ceil(t.len * pad), h = Math.ceil(Math.max(t.h * 1.9, t.len * (t.glow ? 1.2 : 0.4)) + (t.boss ? 40 : 0));
      const frames = [0, 1].map(fr => {
        const c = document.createElement('canvas'); c.width = w * SPR; c.height = h * SPR;
        const g = c.getContext('2d'); g.scale(SPR, SPR); g.translate(w / 2, h / 2 + (t.boss ? 14 : 0)); drawShape(g, t, fr);
        return c;
      });
      return { frames, w, h, oy: t.boss ? 14 : 0 };
    });
    icons = sprites.map(s => { const c = document.createElement('canvas'), k = 56 / Math.max(s.w, s.h); c.width = 56 * 2; c.height = 56 * 2; const g = c.getContext('2d'); g.scale(2, 2); g.drawImage(s.frames[0], 28 - s.w * k / 2, 28 - s.h * k / 2, s.w * k, s.h * k); return c.toDataURL(); });
    // background
    bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b5f86'); gr.addColorStop(0.55, '#0a3f66'); gr.addColorStop(1, '#06253f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.07; g.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) { const x = 40 + i * 95; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 50, 0); g.lineTo(x - 80, H); g.lineTo(x - 150, H); g.fill(); }
    g.globalAlpha = 1;
    g.fillStyle = '#c9a66b'; g.beginPath(); g.moveTo(0, H - 40);
    for (let x = 0; x <= W; x += 30) g.quadraticCurveTo(x + 15, H - 52 + Math.sin(x) * 6, x + 30, H - 42);
    g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#2e8b57';
    for (const x of [30, 110, 300, 470, 515]) { for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + k * 7, H - 70 - k * 8, 5, 34 + k * 6, (k - 1) * 0.25, 0, Math.PI * 2); g.fill(); } }
    g.fillStyle = '#ff8fa3'; for (const x of [70, 250, 420]) { g.beginPath(); g.arc(x, H - 48, 10, Math.PI, 0); g.fill(); }
  }

  // ---------- pools for effects ----------
  const coins = [], rings = [], texts = [], bubbles = [];
  for (let i = 0; i < 260; i++) coins.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, sx: 0, sy: 0, tx: 0, ty: 0, t: 0, seat: 0 });
  for (let i = 0; i < 60; i++) rings.push({ on: false, x: 0, y: 0, t: 0, col: '', big: false });
  for (let i = 0; i < 30; i++) texts.push({ on: false, x: 0, y: 0, t: 0, s: '', big: false });
  for (let i = 0; i < 40; i++) bubbles.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 3, v: 15 + Math.random() * 30 });
  const take = arr => { for (let i = 0; i < arr.length; i++) if (!arr[i].on) return arr[i]; return arr[0]; };

  // ---------- state ----------
  let root, wrap, cv, ctx, eng = null, raf = 0, last = 0, scale = 1, dpr = 1;
  let level = C.shot.defaultLevel, auto = false, lock = null, lockId = 0, autoTarget = null, hold = null, toastT = 0;
  let bots = [], session, banners = [], bannerT = 0, recoil = [0, 0, 0, 0], labelT = 0;
  const music = { on: true, ac: null, timer: 0, step: 0 };

  // her wallet: Bank.spend is all-or-nothing, so a shot either pays and fires or does nothing
  const myWallet = { spend: n => Bank.spend(n), add: n => Bank.add(n) };
  const seatPos = i => C.seats[i];
  const labelPos = [{ x: 250, y: 934 }, { x: 135, y: 878 }, { x: 135, y: 80 }, { x: 405, y: 80 }]; // name/balance pills; coins fly here

  function open() {
    if (!sprites) buildSprites();
    root = UI.openScreen('Морской тир 🐠', 'fishscr', close);
    session = { shots: 0, spent: 0, won: 0, refunded: 0, catches: [] };
    const her = esc(CONFIG.herName);
    root.innerHTML = `
      <div class="fwrap" id="fWrap">
        <canvas id="fCv"></canvas>
        <button class="fbtn fclose" id="fClose" aria-label="Закрыть">✕</button>
        <button class="fbtn fmusic" id="fMusic" aria-label="Музыка">🎵</button>
        <div class="fside">
          <button class="fbtn" id="fPrices" aria-label="Цены рыб">🐟</button>
          <button class="fbtn" id="fWins" aria-label="Улов">🏆</button>
          <button class="fbtn" id="fRules" aria-label="Правила">?</button>
        </div>
        <div class="fpanel" id="fPanel"><div class="fph">Цена рыб <small>× ставка</small></div>
          ${T.map((t, i) => `<div class="fpr"><img src="${icons[i]}" alt=""><span>${t.name}</span><b>×${t.mult.toLocaleString('ru')}</b></div>`).join('')}</div>
        <div class="fbanner" id="fBanner"></div>
        <div class="flabel me" id="fL0" style="left:${labelPos[0].x / W * 100}%;top:${labelPos[0].y / H * 100}%"><span class="fav" id="fAv">👸</span><span><b>${her}</b><br>🪙 <span class="coinval">${Bank.coins}</span></span></div>
        ${[1, 2, 3].map(i => `<div class="flabel" id="fL${i}" style="left:${labelPos[i].x / W * 100}%;top:${labelPos[i].y / H * 100}%"></div>`).join('')}
        <button class="fbtn fcost" id="fMinus" style="left:${(seatPos(0).x - 66) / W * 100}%">−</button>
        <button class="fbtn fcost" id="fPlus" style="left:${(seatPos(0).x + 66) / W * 100}%">+</button>
        <div class="fright">
          <button class="fbtn fauto" id="fAuto">АВТО</button>
          <button class="fbtn ffreeze" id="fFreeze"></button>
        </div>
        <div class="rmodal" id="fModal"><div class="rmbox"><div class="rmhead"><div class="rmtabs" id="fmTabs"></div><button class="rmclose" id="fmClose" aria-label="Закрыть">✕</button></div><div class="rmbody" id="fmBody"></div></div></div>
      </div>`;
    wrap = $('fWrap'); cv = $('fCv'); ctx = cv.getContext('2d');
    herAvatar();

    // table-mates
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    bots = [1, 2, 3].map(i => ({ seat: i, name: names[i][0], av: names[i][1], coins: 5000 + ((Math.random() * 40) | 0) * 1000, cost: C.shot.levels[(Math.random() * 3) | 0], t: 1 + Math.random() * 2, target: null, mood: 0 }));
    const botWallet = b => ({ spend(n) { if (b.coins < n) b.coins += 20000; b.coins -= n; return true; }, add(n) { b.coins += n; } });

    eng = FishEngine.createEngine({
      config: C, wallets: [myWallet, ...bots.map(botWallet)],
      on: { fire: onFire, hit: onHit, kill: onKill, refund: onRefund, bossWarn: () => banner('🐋 Приближается большая рыба!', true) },
    });
    eng.prefill(8);

    // input
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', e => { if (hold) { const p = toWorld(e); hold.x = p.x; hold.y = p.y; } });
    const up = () => { hold = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
    $('fClose').onclick = close;
    $('fMusic').onclick = () => { music.on = !music.on; $('fMusic').textContent = music.on ? '🎵' : '🔇'; music.on ? startMusic() : stopMusic(); };
    $('fPrices').onclick = () => $('fPanel').classList.toggle('show');
    $('fWins').onclick = winsModal; $('fRules').onclick = rulesModal;
    $('fmClose').onclick = () => $('fModal').classList.remove('show');
    $('fModal').onclick = e => { if (e.target.id === 'fModal') $('fModal').classList.remove('show'); };
    $('fMinus').onclick = () => { level = Math.max(0, level - 1); Sound.fx.tick(); };
    $('fPlus').onclick = () => { level = Math.min(C.shot.levels.length - 1, level + 1); Sound.fx.tick(); };
    $('fAuto').onclick = () => { auto = !auto; if (!auto) { lock = null; autoTarget = null; } Sound.fx.tick(); updateButtons(); };
    $('fFreeze').onclick = useFreeze;
    if (Bank.coins < C.shot.levels[level]) level = 0;
    updateButtons();
    window.addEventListener('resize', fit);
    fit();
    last = 0; raf = requestAnimationFrame(frame);
    Casino.refillButton(root);
  }

  function close() {
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('resize', fit);
    if (eng) eng.shutdown(); // refunds her bullets still in flight
    eng = null; stopMusic(); hold = null; lock = null; auto = false;
    Casino.hub();
  }

  function herAvatar() {
    if (!CONFIG.herPhoto) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const cr = CONFIG.herPhotoCrop || { x: 0, y: 0, size: 1 }, s = cr.size * img.naturalWidth;
      c.getContext('2d').drawImage(img, cr.x * img.naturalWidth, cr.y * img.naturalHeight, s, s, 0, 0, 64, 64);
      const av = $('fAv'); if (av) av.innerHTML = `<img src="${c.toDataURL()}" alt="">`;
    };
    img.src = CONFIG.herPhoto;
  }

  function fit() {
    if (!wrap) return;
    const box = root.getBoundingClientRect(), vw = box.width || innerWidth, vh = innerHeight;
    scale = Math.min(vw / W, vh / H); dpr = Math.min(2, window.devicePixelRatio || 1);
    wrap.style.width = W * scale + 'px'; wrap.style.height = H * scale + 'px'; wrap.style.fontSize = 16 * scale + 'px';
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  }
  function toWorld(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }

  // ---------- input / firing ----------
  function onDown(e) {
    e.preventDefault(); Sound.wake(); if (music.on && !music.ac) startMusic();
    $('fPanel').classList.remove('show');
    const p = toWorld(e), f = eng.fishAt(p.x, p.y);
    if (auto) { lock = f; lockId = f ? f.id : 0; return; } // in auto, tapping picks (or clears) the target
    hold = p; tryFire(p.x, p.y, null);
  }
  function tryFire(x, y, lockFish) {
    const cost = C.shot.levels[level];
    const r = eng.fire(0, x, y, cost, lockFish);
    if (r === 'ok') { session.shots++; session.spent += cost; return true; }
    if (r === 'coins' && eng.time - toastT > 2) {
      toastT = eng.time; auto = false; hold = null; updateButtons();
      UI.toast(level > 0 ? 'Не хватает монет — уменьши ставку кнопкой − 🪙' : 'Монетки кончились 🪙');
      Casino.refillButton(root);
    }
    return false;
  }
  const validLock = () => lock && lock.id === lockId && eng.alive(lock) && eng.onScreen(lock);
  function updatePlayer() {
    if (auto) {
      if (!validLock()) { lock = null; if (!autoTarget || !eng.alive(autoTarget) || !eng.onScreen(autoTarget)) autoTarget = eng.randomTarget(); }
      const t = lock || autoTarget;
      if (t) tryFire(t.x, t.y, lock);
    } else if (hold) tryFire(hold.x, hold.y, null);
  }
  function updateBots(dt) {
    for (const b of bots) {
      b.t -= dt;
      if (b.t > 0) continue;
      b.t = 0.22 + Math.random() * 0.45;
      if (Math.random() < 0.01) b.cost = C.shot.levels[(Math.random() * 4) | 0];
      if (!b.target || !eng.alive(b.target) || !eng.onScreen(b.target) || Math.random() < 0.08) b.target = eng.randomTarget();
      if (b.target) eng.fire(b.seat, b.target.x, b.target.y, b.cost, Math.random() < 0.3 ? b.target : null);
    }
  }
  function useFreeze() {
    if (eng.frozen > 0) return;
    if (store.freeze <= 0) {
      if (!Bank.spend(C.freeze.price)) { UI.toast(`Заморозка стоит ${C.freeze.price} 🪙`); return; }
      store.freeze++;
    }
    store.freeze--; saveStore(); eng.freeze(C.freeze.seconds);
    Sound.fx.power(); banner('❄️ Заморозка! Рыбы замерли на 5 секунд', false);
    updateButtons();
  }
  function updateButtons() {
    if (!$('fAuto')) return;
    $('fAuto').classList.toggle('on', auto);
    $('fFreeze').innerHTML = store.freeze > 0 ? `❄️<small>${store.freeze}</small>` : `❄️<small>${C.freeze.price}🪙</small>`;
  }

  // ---------- engine events ----------
  function onFire(seat) { recoil[seat] = 1; if (seat === 0) Sound.fx.tick(); }
  function onHit(seat, f, x, y) { const r = take(rings); r.on = true; r.x = x; r.y = y; r.t = 0; r.col = SEAT_COL[seat]; r.big = false; }
  function onRefund(seat, cost) { if (seat === 0) { session.refunded += cost; session.spent -= cost; } }
  function onKill(seat, f, win, cost) {
    const r = take(rings); r.on = true; r.x = f.x; r.y = f.y; r.t = 0; r.col = '#ffd23f'; r.big = true;
    const n = Math.min(40, 4 + Math.round(Math.log2(f.t.mult) * 2.5));
    const lp = labelPos[seat];
    for (let i = 0; i < n; i++) {
      const c = take(coins); const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
      c.on = true; c.x = c.sx = f.x; c.y = c.sy = f.y; c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp; c.tx = lp.x; c.ty = lp.y; c.t = -i * 0.015; c.seat = seat;
    }
    const tx = take(texts); tx.on = true; tx.x = f.x; tx.y = f.y - 10; tx.t = 0; tx.s = '+' + win.toLocaleString('ru'); tx.big = f.t.mult >= C.bigCatch;
    const who = seat === 0 ? CONFIG.herName : bots[seat - 1].name;
    if (seat === 0) {
      session.won += win; session.catches.unshift({ type: f.type, cost, win });
      if (session.catches.length > 200) session.catches.length = 200;
      f.t.mult >= C.bigCatch ? Sound.fx.win() : Sound.fx.coin();
    }
    if (f.t.mult >= C.bigCatch) banner(`${seat === 0 ? '🎉 ' : ''}${esc(who)} ${seat === 0 ? 'поймала' : 'поймал(а)'} «${f.t.name}» ×${f.t.mult.toLocaleString('ru')} — +${win.toLocaleString('ru')} 🪙`, seat === 0);
  }
  function banner(html, gold) { banners.push({ html, gold }); if (banners.length > 4) banners.shift(); }

  // ---------- frame ----------
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
    if (!eng) return;
    updatePlayer(); updateBots(dt);
    eng.step(dt);
    updateFx(dt);
    draw();
    labelT -= dt;
    if (labelT <= 0) { labelT = 0.25; updateLabels(); }
  }
  function updateFx(dt) {
    for (let i = 0; i < 4; i++) recoil[i] = Math.max(0, recoil[i] - dt * 6);
    for (const b of bubbles) { b.y -= b.v * dt; if (b.y < -5) { b.y = H + 5; b.x = Math.random() * W; } }
    for (const r of rings) if (r.on && (r.t += dt) > (r.big ? 0.6 : 0.35)) r.on = false;
    for (const t of texts) if (t.on && (t.t += dt) > 1.4) t.on = false;
    for (const c of coins) {
      if (!c.on) continue;
      c.t += dt; if (c.t < 0) continue;
      if (c.t < 0.35) { c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.92; c.vy *= 0.92; c.sx = c.x; c.sy = c.y; }
      else {
        const k = Math.min(1, (c.t - 0.35) / 0.5), e = k * k;
        c.x = c.sx + (c.tx - c.sx) * e; c.y = c.sy + (c.ty - c.sy) * e;
        if (k >= 1) c.on = false;
      }
    }
    if (bannerT > 0) bannerT -= dt;
    if (bannerT <= 0 && banners.length) {
      const b = banners.shift(), el = $('fBanner');
      el.innerHTML = b.html; el.className = 'fbanner show' + (b.gold ? ' gold' : ''); bannerT = 2.6;
    } else if (bannerT <= 0) $('fBanner').className = 'fbanner';
  }
  function updateLabels() {
    for (const b of bots) {
      const el = $('fL' + b.seat); if (!el) continue;
      const s = `<span class="fav">${b.av}</span><span><b>${esc(b.name)}</b><br>🪙 ${b.coins.toLocaleString('ru')}</span>`;
      if (el.innerHTML !== s) el.innerHTML = s;
    }
    if (eng.frozen <= 0 && $('fFreeze').classList.contains('active')) $('fFreeze').classList.remove('active');
    if (eng.frozen > 0) $('fFreeze').classList.add('active');
  }

  function draw() {
    const g = ctx, k = scale * dpr;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.drawImage(bg, 0, 0, W, H);
    // bubbles
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (const b of bubbles) { g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); }
    // fish
    const fl = eng.fish;
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i];
      if (!f.active || f.u < 0) continue;
      const sp = sprites[f.type], fr = sp.frames[eng.frozen > 0 ? 0 : ((f.age * (f.t.len > 120 ? 3 : 7) + f.id) | 0) & 1];
      g.save(); g.translate(f.x, f.y); g.rotate(f.angle);
      if (Math.cos(f.angle) < 0) g.scale(1, -1); // keep fish upright
      if (f.dying > 0) { const d = f.dying / 0.8; g.globalAlpha = d; g.rotate((1 - d) * 4); g.scale(1 + (1 - d) * 0.4, 1 + (1 - d) * 0.4); }
      g.drawImage(fr, -sp.w / 2, -sp.h / 2 - sp.oy, sp.w, sp.h);
      if (f.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(fr, -sp.w / 2, -sp.h / 2 - sp.oy, sp.w, sp.h); g.globalCompositeOperation = 'source-over'; }
      g.restore();
    }
    // lock marker
    if (auto && validLock()) {
      const r = Math.max(lock.t.len, lock.t.h) * 0.55 + 6, a = performance.now() / 300;
      g.strokeStyle = '#ff5c98'; g.lineWidth = 3; g.setLineDash([10, 8]); g.lineDashOffset = -a * 10;
      g.beginPath(); g.arc(lock.x, lock.y, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    // bullets
    const bl = eng.bullets;
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i]; if (!b.active) continue;
      g.fillStyle = SEAT_COL[b.seat]; g.globalAlpha = 0.35; g.beginPath(); g.arc(b.x, b.y, 9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1; g.beginPath(); g.arc(b.x, b.y, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x - 1.5, b.y - 1.5, 2, 0, Math.PI * 2); g.fill();
    }
    // hit rings (nets)
    for (const r of rings) {
      if (!r.on) continue;
      const d = r.t / (r.big ? 0.6 : 0.35);
      g.strokeStyle = r.col; g.globalAlpha = 1 - d; g.lineWidth = r.big ? 4 : 2;
      g.beginPath(); g.arc(r.x, r.y, (r.big ? 20 : 8) + d * (r.big ? 70 : 22), 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    // cannons
    for (let i = 0; i < 4; i++) drawCannon(g, i);
    // coins
    for (const c of coins) {
      if (!c.on || c.t < 0) continue;
      g.fillStyle = '#b8860b'; g.beginPath(); g.arc(c.x, c.y, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(c.x - 0.8, c.y - 0.8, 5.6, 0, Math.PI * 2); g.fill();
    }
    // floating +X
    g.textAlign = 'center'; g.lineJoin = 'round';
    for (const t of texts) {
      if (!t.on) continue;
      const sz = t.big ? 34 : 22, y = t.y - t.t * 40;
      g.globalAlpha = Math.min(1, 2.5 - t.t * 1.8);
      g.font = `700 ${sz}px Comfortaa, sans-serif`; g.lineWidth = 5; g.strokeStyle = '#5a2a00'; g.strokeText(t.s, t.x, y);
      g.fillStyle = t.big ? '#fff36b' : '#ffe08a'; g.fillText(t.s, t.x, y);
    }
    g.globalAlpha = 1;
    // freeze overlay
    if (eng.frozen > 0) {
      g.fillStyle = 'rgba(180,230,255,0.18)'; g.fillRect(0, 0, W, H);
      g.font = '700 26px Comfortaa, sans-serif'; g.fillStyle = '#e8f8ff'; g.fillText('❄️ ' + Math.ceil(eng.frozen), W / 2, H / 2);
    }
  }
  function drawCannon(g, i) {
    const s = eng.seats[i], col = SEAT_COL[i], up = s.dir < 0;
    g.save(); g.translate(s.x, s.y);
    g.fillStyle = '#2b3a4a'; g.beginPath(); g.arc(0, 0, 34, up ? Math.PI : 0, up ? 0 : Math.PI); g.fill();
    g.save(); g.rotate(s.aim);
    const rc = recoil[i] * 6;
    g.fillStyle = col; g.fillRect(-rc, -9, 44 - rc, 18);
    g.fillStyle = '#ffffff55'; g.fillRect(-rc, -9, 44 - rc, 5);
    g.fillStyle = '#1d2733'; g.fillRect(38 - rc, -11, 8, 22);
    g.restore();
    g.fillStyle = col; g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '700 12px Comfortaa, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const cost = i === 0 ? C.shot.levels[level] : bots[i - 1].cost;
    g.fillText(cost >= 1000 ? cost / 1000 + 'K' : cost, 0, 1);
    g.textBaseline = 'alphabetic';
    g.restore();
  }

  // ---------- modals ----------
  function modal(tabs) {
    $('fmTabs').innerHTML = tabs.map((t, i) => `<button class="rmtab ${i ? '' : 'on'}" data-i="${i}">${t.name}</button>`).join('');
    const show = i => { $('fmBody').innerHTML = tabs[i].html(); $('fmTabs').querySelectorAll('.rmtab').forEach((b, j) => b.classList.toggle('on', j === i)); };
    $('fmTabs').onclick = e => { const b = e.target.closest('.rmtab'); if (b) show(+b.dataset.i); };
    show(0); $('fModal').classList.add('show');
  }
  function winsModal() {
    const s = session, net = s.won - s.spent;
    modal([{ name: 'Улов за игру', html: () => `
      <div class="stats">
        <div class="stat"><span>🎯 Выстрелов</span><b>${s.shots}</b></div>
        <div class="stat"><span>🐟 Поймано</span><b>${s.catches.length}</b></div>
        <div class="stat"><span>💸 Потрачено</span><b>${s.spent.toLocaleString('ru')}</b></div>
        <div class="stat"><span>🪙 Выиграно</span><b>${s.won.toLocaleString('ru')}</b></div>
      </div>
      <p style="text-align:center;margin:10px 0"><b>Итог: ${net >= 0 ? '+' : ''}${net.toLocaleString('ru')} 🪙</b></p>
      <table class="rt"><tr><th></th><th>Рыба</th><th>Ставка</th><th>Выигрыш</th></tr>
      ${s.catches.slice(0, 80).map(c => `<tr><td><img class="ficon" src="${icons[c.type]}" alt=""></td><td>${T[c.type].name} ×${T[c.type].mult}</td><td>${c.cost}</td><td class="wc">+${c.win.toLocaleString('ru')}</td></tr>`).join('') || '<tr><td colspan="4">Пока никого не поймала — целься в рыбок!</td></tr>'}
      </table>` }]);
  }
  function rulesModal() {
    const pct = Math.round(C.targetRTP * 100);
    modal([{ name: 'Как играть', html: () => `
      <p>Нажми на рыбу — пушка выстрелит туда. Держи палец, чтобы стрелять очередью. Пули отскакивают от краёв, пока не попадут в рыбу.</p>
      <p>Каждый выстрел стоит текущую ставку (кнопки − и + у пушки: ${C.shot.levels.join(' / ')}).</p>
      <p>Попала — рыба может быть поймана. Тогда выигрыш = <b>ставка × цена рыбы</b> (список — кнопка 🐟). Чем больше рыба, тем она дороже, медленнее и реже, и тем труднее её поймать.</p>
      <p>Шанс поймать при попадании = ${pct}% ÷ цена рыбы. Например, Килька ×12 ловится примерно с каждого ${Math.round(12 / C.targetRTP)}-го попадания, Акула ×1000 — с каждого ${Math.round(1000 / C.targetRTP)}-го. В среднем каждое попадание возвращает ${pct}% ставки.</p>
      <p>Если пуля ни в кого не попала за ${C.shot.life} секунд, ставка возвращается.</p>` },
    { name: 'Авто и заморозка', html: () => `
      <p><b>АВТО</b> — пушка сама стреляет по случайным рыбам. Нажми на рыбу, и авто-огонь возьмёт её на прицел (пули летят за ней), пока она не поймана или не уплыла. Нажми на пустую воду, чтобы снять прицел.</p>
      <p><b>❄️ Заморозка</b> останавливает всех рыб на ${C.freeze.seconds} секунд. Сначала у тебя ${C.freeze.start} бесплатных, потом — ${C.freeze.price} 🪙 за штуку.</p>
      <p>Каждые пару минут приплывает <b>Царь-рыба Мотивофосфат</b> ×200 000 — о ней предупредит объявление.</p>
      <p class="small">Соседи по столу — ненастоящие игроки. Только игровые монеты.</p>` }]);
  }

  // ---------- music: soft underwater arpeggio ----------
  function startMusic() {
    if (!music.on || music.timer) return;
    try { music.ac = music.ac || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    if (music.ac.state === 'suspended') music.ac.resume();
    const notes = [[220, 277, 330, 415], [196, 247, 294, 370], [174, 220, 262, 330], [196, 247, 294, 392]];
    music.timer = setInterval(() => {
      if (Sound.muted) return;
      const ac = music.ac, t0 = ac.currentTime, ch = notes[(music.step >> 3) & 3], n = ch[music.step & 3] * (music.step & 4 ? 2 : 1);
      const o = ac.createOscillator(), gn = ac.createGain();
      o.type = 'sine'; o.frequency.value = n;
      gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.035, t0 + 0.03); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(gn); gn.connect(ac.destination); o.start(t0); o.stop(t0 + 1);
      music.step++;
    }, 280);
  }
  function stopMusic() { clearInterval(music.timer); music.timer = 0; }

  return { open, _engine: () => eng };
})();
