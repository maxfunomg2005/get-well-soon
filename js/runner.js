/* The runner game: jump, heal, dodge viruses, fly to him. */
const Runner = (() => {
'use strict';
const cv = $('c'), ctx = cv.getContext('2d');
const FONT = '"Comfortaa", "Trebuchet MS", system-ui, sans-serif';
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = k => k < 0 ? 0 : k > 1 ? 1 : k;
const ease = k => { k = clamp01(k); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
const sfx = Sound.fx;

/* ---------- canvas sizing ---------- */
const H = 450, GROUND = 380;
let W = 800, S = 1, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  W = Math.round(Math.max(520, Math.min(1000, H * vw / vh)));
  S = Math.min(vw / W, vh / H);
  cv.style.width = (W * S) + 'px'; cv.style.height = (H * S) + 'px';
  cv.width = Math.round(W * S * DPR); cv.height = Math.round(H * S * DPR);
}
window.addEventListener('resize', resize); resize();

/* ---------- photos (optional) ---------- */
function loadImg(src) {
  const o = { img: null };
  if (!src || typeof Image === 'undefined') return o;
  const im = new Image();
  im.onload = () => { o.img = im; };
  im.src = src;
  return o;
}
const herPhoto = loadImg(CONFIG.herPhoto), myPhoto = loadImg(CONFIG.myPhoto);

/* ---------- game data ---------- */
const LEVELS = [
  { theme: 'bedroom', name: 'Уровень 1 · Побег из-под одеяла', speed: 240, length: 28, gapMin: 1.35, gapMax: 2.3, fly: 0,    dbl: 0 },
  { theme: 'city',    name: 'Уровень 2 · Город микробов',       speed: 275, length: 30, gapMin: 1.15, gapMax: 2.0, fly: 0.35, dbl: 0.1 },
  { theme: 'sky',     name: 'Уровень 3 · Над облаками',         speed: 305, length: 30, gapMin: 1.05, gapMax: 1.8, fly: 0.4,  dbl: 0.2 },
];
const PICKS = [
  { k: 'heart', v: 3,  w: 4,   txt: '+3 ♥' },
  { k: 'sushi', v: 6,  w: 2,   txt: 'Суши! +6' },
  { k: 'roll',  v: 6,  w: 2,   txt: 'Роллы! +6' },
  { k: 'tea',   v: 4,  w: 1.5, txt: 'Тёплый чай +4' },
  { k: 'motiv', v: 12, w: 0.5, txt: 'Мотивофосфат! +12' },
];
const HIT_TXT = ['Апчхи!', 'Фу, микробы!', 'Шмыг…', 'Кхе-кхе!'];
const G = 2100, J1 = 760, J2 = 650;
const LEVEL_COINS = 20, WIN_COINS = 50;

const P = { x: 140, y: GROUND, vy: 0, onGround: true, jumps: 0, coyote: 0, buffer: 0, inv: 0, sq: 0, shield: false };
let state = 'title', level = 0, theme = 'bedroom', lvlT = 0, worldX = 0, spd = 240, t = 0;
let health = 10, shownHealth = 10, healedOnce = false, petY = GROUND;
let viruses = [], pickups = [], parts = [], texts = [];
let obsT = 0, pickT = 0, banner = 0, shake = 0, fT = 0, fin = null;

function setState(s) {
  state = s;
  document.body.classList.toggle('playing', s === 'play' || s === 'finale');
}
function status(h) {
  return h >= 100 ? 'Полностью здорова! 💪' : h >= 70 ? 'Почти здорова 😊' : h >= 35 ? 'Уже лучше 🙂' : 'Болею 🤒';
}
function dressColor() {
  const id = Bank.equipped('dress');
  const it = id && typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS.find(i => i.id === id);
  return it ? it.color : CONFIG.colors.herDress;
}

/* ---------- flow ---------- */
function toIdle() {
  setState('title'); theme = 'bedroom';
  viruses = []; pickups = []; banner = 0;
  P.x = 140; P.y = GROUND; P.vy = 0; P.onGround = true; P.inv = 0;
}
function startLevel(i) {
  level = i; theme = LEVELS[i].theme; lvlT = 0;
  viruses = []; pickups = []; obsT = 1.6; pickT = 0.6;
  P.y = GROUND; P.vy = 0; P.onGround = true; P.jumps = 0; P.inv = 0; P.x = 140;
  P.shield = Bank.has('shield');
  banner = 2.4; setState('play');
}
function startNew() {
  health = 10; shownHealth = 10; healedOnce = false; worldX = 0;
  parts = []; texts = [];
  startLevel(0);
}
function endLevel() {
  if (level < LEVELS.length - 1) {
    setState('card'); sfx.level();
    theme = LEVELS[level + 1].theme;
    Bank.add(LEVEL_COINS);
    const note = CONFIG.levelNotes[level] ? fill(CONFIG.levelNotes[level]) + '\n\n' : '';
    UI.overlay(`Уровень ${level + 1} пройден! 🎉`,
      `${note}Здоровье: ${Math.round(health)}% — ${status(health)}\n🪙 +${LEVEL_COINS} монет за уровень`,
      [{ label: 'Дальше ▶', cb: () => startLevel(level + 1) }]);
  } else startFinale();
}
function startFinale() {
  setState('finale'); fT = 0; banner = 0; viruses = [];
  fin = { sx: P.x, sy: P.y, hx: W + 80, met: false, shown: false, emit: 0 };
  sfx.win();
}

/* ---------- input ---------- */
function tryJump() {
  if (P.onGround || P.coyote > 0) {
    P.vy = -J1; P.onGround = false; P.coyote = 0; P.jumps = 1; sfx.jump();
    puff(P.x, GROUND, 5, '#ffffff');
  } else if (P.jumps < 2) {
    P.vy = -J2; P.jumps = 2; sfx.jump2();
    for (let i = 0; i < 8; i++) parts.push({ x: P.x, y: P.y - 10, vx: rand(-90, 90), vy: rand(20, 120), g: 0, life: 0.5, max: 0.5, kind: 'spark', c: '#ffe066', s: rand(2, 4) });
  } else P.buffer = 0.15;
}
window.addEventListener('pointerdown', e => {
  if (e.target.closest && (e.target.closest('button') || e.target.closest('.card') || e.target.closest('.screen'))) return;
  Sound.wake();
  if (state === 'play') { tryJump(); if (e.cancelable) e.preventDefault(); }
}, { passive: false });
window.addEventListener('keydown', e => {
  if (UI.screenOpen()) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
    e.preventDefault();
    if (e.repeat) return;
    Sound.wake();
    if (UI.isOpen()) UI.pressPrimary();
    else if (state === 'play') tryJump();
  }
});

/* ---------- spawning ---------- */
function spawnVirus(L) {
  const x = W + 40;
  const fly = Math.random() < L.fly;
  if (fly) {
    const fy = herPhoto.img ? rand(116, 122) : rand(92, 100);
    viruses.push({ x, baseY: GROUND - fy, y: GROUND - fy, r: 16, fly: true, ph: rand(0, 6), c: '#b48ef0', c2: '#8a63d2' });
  } else {
    const r = rand(15, 21);
    viruses.push({ x, y: GROUND - r, r, fly: false, ph: rand(0, 6), c: '#8bd66f', c2: '#5fae4a' });
    if (Math.random() < L.dbl) viruses.push({ x: x + r + 22, y: GROUND - 16, r: 16, fly: false, ph: rand(0, 6), c: '#8bd66f', c2: '#5fae4a' });
  }
  // never force a hit to get a pickup
  for (const p of pickups) if (Math.abs(p.x - x) < 70 && p.y > GROUND - 120) p.y = GROUND - 160;
  return fly;
}
function spawnPickup() {
  const x = W + 40;
  const nearV = viruses.some(v => Math.abs(v.x - x) < 90);
  const roll = Math.random();
  if (!nearV && roll < 0.16) {
    for (let i = 0; i < 5; i++)
      pickups.push({ x: x + i * 34, y: GROUND - 40 - Math.sin(i / 4 * Math.PI) * 110, k: 'heart', v: 2, txt: '+2 ♥', ph: i });
    pickT += 0.6; return;
  }
  if (!nearV && roll < 0.5) {
    const y = pick([GROUND - 30, GROUND - 30, GROUND - 100]);
    for (let i = 0; i < 4; i++) pickups.push({ x: x + i * 30, y, k: 'coin', v: 0, ph: i * 0.6 });
    pickT += 0.4; return;
  }
  let tot = 0; PICKS.forEach(p => tot += p.w);
  let r = Math.random() * tot, tp = PICKS[0];
  for (const p of PICKS) { r -= p.w; if (r <= 0) { tp = p; break; } }
  const heights = [GROUND - 30, GROUND - 30, GROUND - 95, GROUND - 155];
  const y = nearV ? GROUND - 160 : heights[(Math.random() * heights.length) | 0];
  pickups.push({ x, y, k: tp.k, v: tp.v, txt: tp.txt, ph: rand(0, 6) });
}

/* ---------- effects ---------- */
function puff(x, y, n, c) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: rand(-80, 80), vy: rand(-60, -10), g: 100, life: 0.4, max: 0.4, kind: 'dot', c, s: rand(3, 6) });
}
function heartBurst(x, y, n, big) {
  const cols = ['#ff5c98', '#ff8ab8', '#ff3d6e', '#ffb3d1'];
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(60, big ? 260 : 160);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 160, life: big ? 1.6 : 0.8, max: big ? 1.6 : 0.8, kind: 'heart', c: cols[i % 4], s: rand(5, big ? 11 : 7) });
  }
}
function floatText(x, y, s, c, big) { texts.push({ x, y, s, c, life: big ? 1.8 : 1.0, max: big ? 1.8 : 1.0, big }); }

/* ---------- update ---------- */
function hitsPlayer(cx, cy, r) {
  const rx = P.x - 11, ry = P.y - 50, rw = 22, rh = 46;
  const nx = Math.max(rx, Math.min(cx, rx + rw)), ny = Math.max(ry, Math.min(cy, ry + rh));
  const rr = r * 0.85;
  return (cx - nx) ** 2 + (cy - ny) ** 2 < rr * rr;
}
function physics(dt) {
  P.coyote -= dt; P.buffer -= dt;
  P.vy += G * dt; P.y += P.vy * dt;
  if (P.y >= GROUND) {
    if (!P.onGround) { P.sq = 0.14; puff(P.x, GROUND, 4, '#ffffff'); }
    P.y = GROUND; P.vy = 0; P.onGround = true; P.jumps = 0; P.coyote = 0.1;
    if (P.buffer > 0) { P.buffer = 0; tryJump(); }
  } else P.onGround = false;
}
function addHealth(v) {
  health = Math.min(100, health + v);
  if (health >= 100 && !healedOnce) {
    healedOnce = true;
    floatText(W / 2, 150, 'Полностью здорова! 💪', '#2fa84f', true);
    heartBurst(P.x, P.y - 30, 24, true);
  }
}
function updatePlay(dt) {
  const L = LEVELS[level];
  lvlT += dt;
  spd = L.speed * (1 + 0.12 * Math.min(1, lvlT / L.length));
  worldX += spd * dt;
  physics(dt);

  if (lvlT < L.length) {
    obsT -= dt;
    if (obsT <= 0) { const fly = spawnVirus(L); obsT = rand(L.gapMin, L.gapMax) + (fly ? 0.25 : 0); }
    pickT -= dt;
    if (pickT <= 0) { spawnPickup(); pickT = rand(0.7, 1.4); }
  }

  for (const v of viruses) {
    v.x -= spd * dt;
    if (v.fly) v.y = v.baseY + Math.sin(t * 3 + v.ph) * 12;
    if (P.inv <= 0 && hitsPlayer(v.x, v.y, v.r)) {
      P.inv = 1.2;
      if (P.shield) {
        P.shield = false; sfx.power();
        floatText(P.x + 10, P.y - 70, 'Щит мотивофосфата! 🛡️', '#e0890b');
        heartBurst(P.x, P.y - 30, 10, false);
      } else {
        health = Math.max(5, health - 6); shake = 7; sfx.hit();
        floatText(P.x + 10, P.y - 70, pick(HIT_TXT) + ' −6', '#7a4fc9');
        puff(P.x, P.y - 30, 10, '#b7f0a0');
      }
    }
  }
  viruses = viruses.filter(v => v.x > -60);

  const magnet = Bank.has('magnet');
  for (const p of pickups) {
    p.x -= spd * dt;
    let dx = p.x - P.x, dy = p.y - (P.y - 28);
    if (p.k === 'coin' && magnet && dx * dx + dy * dy < 160 * 160) {
      p.x -= dx * Math.min(1, dt * 9); p.y -= dy * Math.min(1, dt * 9);
      dx = p.x - P.x; dy = p.y - (P.y - 28);
    }
    const R = p.k === 'coin' ? 30 : 36;
    if (!p.got && dx * dx + dy * dy < R * R) {
      p.got = true;
      if (p.k === 'coin') { Bank.add(1); sfx.coin(); parts.push({ x: p.x, y: p.y, vx: 0, vy: -80, g: 0, life: 0.3, max: 0.3, kind: 'dot', c: '#ffd23f', s: 6 }); }
      else {
        addHealth(p.v);
        if (p.k === 'motiv') { sfx.power(); heartBurst(p.x, p.y, 18, true); floatText(p.x, p.y - 20, p.txt, '#e0890b', true); }
        else { sfx.pick(); heartBurst(p.x, p.y, 6, false); floatText(p.x, p.y - 20, p.txt, '#d63d7a'); }
      }
    }
  }
  pickups = pickups.filter(p => !p.got && p.x > -60);

  if (lvlT > L.length + (W + 220 - P.x) / spd) endLevel();
}
function updateFinale(dt) {
  fT += dt;
  const slow = Math.max(0, 1 - fT / 2);
  worldX += spd * slow * dt;
  for (const p of pickups) p.x -= spd * slow * dt;
  pickups = pickups.filter(p => p.x > -60);
  health += (100 - health) * Math.min(1, dt * 1.5);
  if (fT > 3) health = 100;

  const himX = W - 150, top = GROUND - 110;
  fin.hx = lerp(W + 80, himX, ease(fT / 2.2));
  if (fT < 1.2) {
    P.y = lerp(fin.sy, GROUND - 200, ease(fT / 1.2));
  } else {
    const k = ease((fT - 1.2) / 2.6);
    P.x = lerp(fin.sx, himX - 40, k);
    P.y = lerp(GROUND - 200, top, k) + Math.sin(fT * 3) * 6 * (1 - k);
  }
  if (fT > 3.85 && !fin.met) {
    fin.met = true; sfx.level();
    heartBurst(himX - 20, top - 40, 40, true);
  }
  if (fin.met && fT < 9) {
    fin.emit -= dt;
    if (fin.emit <= 0) { fin.emit = 0.18; heartBurst(himX - 20 + rand(-60, 60), top - 60, 2, false); }
  }
  if (fT > 5.6 && !fin.shown) {
    fin.shown = true;
    Bank.add(WIN_COINS);
    UI.overlay(fill(CONFIG.finalTitle), fill(CONFIG.finalMessage) + `\n\n🪙 +${WIN_COINS} монет за победу!`, [
      { label: 'В меню ♥', cb: () => App.menu() },
      { label: 'Сыграть ещё ↺', cb: startNew, alt: true },
    ]);
  }
}
function update(dt) {
  t += dt;
  shownHealth += (health - shownHealth) * Math.min(1, dt * 6);
  shake = Math.max(0, shake - dt * 30);
  banner = Math.max(0, banner - dt);
  P.inv = Math.max(0, P.inv - dt);
  P.sq += (0 - P.sq) * Math.min(1, dt * 12);

  if (state === 'play') updatePlay(dt);
  else if (state === 'finale') updateFinale(dt);
  else worldX += 90 * dt;
  petY += (P.y - petY) * Math.min(1, dt * 7);

  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  for (const s of texts) { s.y -= 40 * dt; s.life -= dt; }
  texts = texts.filter(s => s.life > 0);
}

/* ---------- drawing helpers ---------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function circ(x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
function disc(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); circ(x, y, r); ctx.fill(); }
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function tri(a, b, c, d, e, f) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.closePath(); ctx.fill(); }
function heartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + 0.9 * s);
  ctx.bezierCurveTo(x - 1.3 * s, y + 0.1 * s, x - 0.9 * s, y - 1.0 * s, x, y - 0.4 * s);
  ctx.bezierCurveTo(x + 0.9 * s, y - 1.0 * s, x + 1.3 * s, y + 0.1 * s, x, y + 0.9 * s);
  ctx.closePath();
}
function cloud(x, y, s, a) {
  ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath();
  circ(x, y, 20 * s); circ(x + 22 * s, y - 10 * s, 24 * s); circ(x + 48 * s, y, 20 * s); circ(x + 24 * s, y + 6 * s, 18 * s);
  ctx.fill();
}

/* ---------- backgrounds ---------- */
function makeSkyline(seed, total, minW, maxW, minH, maxH) {
  let s = seed; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const arr = []; let x = 0;
  while (x < total) { const w = minW + r() * (maxW - minW); arr.push({ x, w, h: minH + r() * (maxH - minH), win: r() }); x += w + 4 + r() * 14; }
  return { arr, total: x };
}
const farCity = makeSkyline(7, 1400, 50, 110, 110, 220), nearCity = makeSkyline(42, 1600, 60, 130, 60, 150);
function drawSkyline(sl, par, color, windows) {
  const off = -((worldX * par) % sl.total);
  for (let base = off; base < W; base += sl.total) {
    for (const b of sl.arr) {
      const x = base + b.x; if (x > W || x + b.w < 0) continue;
      ctx.fillStyle = color; ctx.fillRect(x, GROUND - b.h, b.w, b.h);
      if (windows) {
        ctx.fillStyle = 'rgba(255,236,150,0.85)';
        for (let wy = GROUND - b.h + 12; wy < GROUND - 18; wy += 22)
          for (let wx = 10; wx < b.w - 14; wx += 20)
            if (((wx * 7 + (wy - GROUND) * 3 + b.win * 100) | 0) % 5 !== 0) ctx.fillRect(x + wx, wy, 9, 11);
      }
    }
  }
}
const CLOUDS_FAR = [[0, 70, 1.6], [380, 120, 1.3], [720, 60, 1.8], [1100, 110, 1.4]];
const CLOUDS_NEAR = [[100, 190, 1.0], [520, 240, 1.2], [900, 170, 0.9], [1300, 230, 1.1]];
function drawClouds(list, par, a, period) {
  const off = -((worldX * par) % period);
  for (let base = off - period; base < W + period; base += period)
    for (const [x, y, s] of list) cloud(base + x, y, s, a);
}
function bgBedroom() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#ffeaf2'); g.addColorStop(1, '#ffd2e3');
  ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, GROUND + 10);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  const o = -((worldX * 0.25) % 60);
  ctx.beginPath();
  for (let x = o - 60; x < W + 60; x += 60) for (let y = 30, row = 0; y < GROUND - 20; y += 60, row++) circ(x + (row % 2 ? 30 : 0), y, 5);
  ctx.fill();
  const o2 = -((worldX * 0.5) % 560);
  for (let x = o2 - 560; x < W + 560; x += 560) {
    rr(x + 80, 70, 150, 130, 12); ctx.fillStyle = '#fff'; ctx.fill();
    rr(x + 90, 80, 130, 110, 8); ctx.fillStyle = '#bfe6ff'; ctx.fill();
    cloud(x + 115, 125, 0.6, 0.95);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; line(x + 155, 80, x + 155, 190); line(x + 90, 135, x + 220, 135);
    ctx.fillStyle = '#ff9cc4';
    ctx.beginPath(); ctx.moveTo(x + 72, 62); ctx.lineTo(x + 120, 62); ctx.quadraticCurveTo(x + 95, 140, x + 72, 215); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 238, 62); ctx.lineTo(x + 190, 62); ctx.quadraticCurveTo(x + 215, 140, x + 238, 215); ctx.fill();
    rr(x + 330, 95, 90, 74, 8); ctx.fillStyle = '#f7c873'; ctx.fill();
    rr(x + 338, 103, 74, 58, 4); ctx.fillStyle = '#fff6ea'; ctx.fill();
    heartPath(x + 375, 132, 14); ctx.fillStyle = '#ff5c98'; ctx.fill();
    ctx.fillStyle = '#e8a77a'; rr(x + 440, GROUND - 70, 70, 70, 6); ctx.fill();
    ctx.fillStyle = '#c98458'; ctx.fillRect(x + 448, GROUND - 46, 54, 4);
    ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(x + 458, GROUND - 120); ctx.lineTo(x + 492, GROUND - 120); ctx.lineTo(x + 500, GROUND - 92); ctx.lineTo(x + 450, GROUND - 92); ctx.fill();
    ctx.fillStyle = '#b07a58'; ctx.fillRect(x + 472, GROUND - 92, 6, 22);
  }
  ctx.fillStyle = '#d49a6a'; ctx.fillRect(-10, GROUND, W + 20, H - GROUND + 10);
  ctx.fillStyle = '#b97f52'; ctx.fillRect(-10, GROUND, W + 20, 6);
  ctx.strokeStyle = 'rgba(120,70,40,.3)'; ctx.lineWidth = 2;
  line(-10, GROUND + 38, W + 10, GROUND + 38);
  const o3 = -(worldX % 90);
  for (let x = o3; x < W + 90; x += 90) { line(x, GROUND + 6, x, GROUND + 38); line(x + 45, GROUND + 38, x + 45, H); }
}
function bgCity() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#c9b2ff'); g.addColorStop(1, '#ffc7a1');
  ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, GROUND + 10);
  disc(W * 0.72, 120, 46, 'rgba(255,241,184,.9)');
  drawClouds(CLOUDS_FAR, 0.08, 0.35, 1500);
  drawSkyline(farCity, 0.15, '#b9a3e3', false);
  drawSkyline(nearCity, 0.4, '#8f78c4', true);
  ctx.fillStyle = '#9e95b5'; ctx.fillRect(-10, GROUND, W + 20, H - GROUND + 10);
  ctx.fillStyle = '#c8c1da'; ctx.fillRect(-10, GROUND, W + 20, 10);
  ctx.fillStyle = '#f4efe0';
  const o = -(worldX % 80);
  for (let x = o; x < W + 80; x += 80) ctx.fillRect(x, GROUND + 40, 40, 5);
}
function bgSky() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#7cc8ff'); g.addColorStop(1, '#e2f4ff');
  ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
  if (state === 'finale') drawRainbow(ease((fT - 2.5) / 2));
  drawClouds(CLOUDS_FAR, 0.1, 0.5, 1500);
  drawClouds(CLOUDS_NEAR, 0.35, 0.85, 1500);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-10, GROUND + 10, W + 20, H - GROUND);
  ctx.beginPath();
  const o = -(worldX % 50);
  for (let x = o - 50; x < W + 50; x += 50) circ(x, GROUND + 14, 22);
  ctx.fill();
  ctx.fillStyle = '#e3f1ff'; ctx.fillRect(-10, H - 18, W + 20, 30);
}
function drawRainbow(k) {
  if (k <= 0) return;
  const cx = W - 170, cy = GROUND + 120;
  const cols = ['#ff7a9c', '#ffb36b', '#ffe57a', '#8fe39a', '#7cc8ff', '#b79cff'];
  ctx.globalAlpha = 0.55 * k; ctx.lineWidth = 12;
  cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, 330 - i * 12, Math.PI, TAU); ctx.stroke(); });
  ctx.globalAlpha = 1;
}

/* ---------- sprites ---------- */
function drawVirus(v) {
  ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(Math.sin(t * 4 + v.ph) * 0.25);
  const r = v.r;
  ctx.strokeStyle = v.c2; ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + t * 0.8;
    line(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
    disc(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5), 4.5, v.c2);
  }
  disc(0, 0, r, v.c);
  disc(-r * 0.45, r * 0.45, r * 0.15, v.c2); disc(r * 0.5, r * 0.3, r * 0.1, v.c2);
  disc(-r * 0.35, -r * 0.12, r * 0.28, '#fff'); disc(r * 0.3, -r * 0.12, r * 0.28, '#fff');
  disc(-r * 0.42, -r * 0.08, r * 0.13, '#2b2b2b'); disc(r * 0.23, -r * 0.08, r * 0.13, '#2b2b2b');
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2.2;
  line(-r * 0.62, -r * 0.5, -r * 0.15, -r * 0.35); line(r * 0.55, -r * 0.5, r * 0.08, -r * 0.35);
  ctx.beginPath(); ctx.arc(0, r * 0.5, r * 0.22, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.restore();
}
function drawCoin(x, y) {
  const sx = Math.abs(Math.cos(t * 4 + x * 0.02)) * 0.8 + 0.2;
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
  disc(0, 0, 10, '#e0a800'); disc(0, 0, 8, '#ffd23f');
  ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 1.5; ctx.beginPath(); circ(0, 0, 5.5); ctx.stroke();
  disc(-3, -3, 2, 'rgba(255,255,255,.8)');
  ctx.restore();
}
function drawPickup(p) {
  if (p.k === 'coin') { drawCoin(p.x, p.y + Math.sin(t * 4 + p.ph) * 3); return; }
  const y = p.y + Math.sin(t * 4 + p.ph) * 4, x = p.x;
  disc(x, y, 22 + Math.sin(t * 6 + p.ph) * 2, p.k === 'motiv' ? 'rgba(255,230,120,.55)' : 'rgba(255,255,255,.45)');
  ctx.lineWidth = 2;
  if (p.k === 'heart') {
    heartPath(x, y + 2, 12); ctx.fillStyle = '#ff4f8b'; ctx.fill();
    disc(x - 5, y - 3, 2.5, 'rgba(255,255,255,.8)');
  } else if (p.k === 'sushi') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08);
    rr(-16, -2, 32, 13, 6); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#e5ddd2'; ctx.stroke();
    rr(-18, -9, 36, 11, 5); ctx.fillStyle = '#ff8a5c'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i += 7) line(i - 2, -8, i + 3, 1);
    ctx.fillStyle = '#2f4f3a'; ctx.fillRect(-3, -9, 6, 20);
    ctx.restore();
  } else if (p.k === 'roll') {
    disc(x, y, 14, '#2f4f3a');
    disc(x, y, 11, '#ffffff');
    disc(x - 2, y - 1, 5, '#ff8a5c'); disc(x + 3, y + 2, 3.5, '#8fd16a');
  } else if (p.k === 'tea') {
    ctx.strokeStyle = '#ff9cc4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + 11, y + 2, 6, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    rr(x - 12, y - 9, 22, 22, 5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#ff9cc4'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#c17a3a'; ctx.fillRect(x - 10, y - 7, 18, 4);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2;
    for (const dx of [-5, 3]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 12); ctx.quadraticCurveTo(x + dx + 4 * Math.sin(t * 5), y - 18, x + dx, y - 24); ctx.stroke(); }
  } else if (p.k === 'motiv') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6 + Math.sin(t * 3) * 0.15);
    rr(-18, -8, 36, 16, 8); ctx.fillStyle = '#ffd23f'; ctx.fill();
    ctx.save(); rr(-18, -8, 36, 16, 8); ctx.clip(); ctx.fillStyle = '#ff5c98'; ctx.fillRect(-18, -8, 18, 16); ctx.restore();
    rr(-18, -8, 36, 16, 8); ctx.strokeStyle = '#c2416f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(-12, -5, 22, 4, 2); ctx.fill();
    ctx.restore();
    ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#c2416f';
    ctx.fillText('МОТИВОФОСФАТ', x, y + 26);
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + i * 2.1;
      disc(x + Math.cos(a) * 22, y + Math.sin(a) * 16, 2.2, '#ffe066');
    }
  }
}
function drawFace(photoObj, r, girl, cy) {
  const c = CONFIG.colors;
  if (!photoObj.img) return false;
  const im = photoObj.img, cr = girl && CONFIG.herPhotoCrop;
  let sx, sy, s;
  if (cr) { s = cr.size * im.width; sx = cr.x * im.width; sy = cr.y * im.height; }
  else { s = Math.min(im.width, im.height); sx = (im.width - s) / 2; sy = (im.height - s) / 2 * 0.6; }
  ctx.save(); ctx.beginPath(); circ(0, cy, r); ctx.clip();
  ctx.drawImage(im, sx, sy, s, s, -r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = girl ? dressColor() : c.myShirt; ctx.lineWidth = 2.5;
  ctx.beginPath(); circ(0, cy, r); ctx.stroke();
  return true;
}
function drawHat(id, top) {
  if (id === 'hat_cowboy') {
    ctx.fillStyle = '#a8692f';
    ctx.beginPath(); ctx.ellipse(0, top + 5, 22, 5.5, 0, 0, TAU); ctx.fill();
    rr(-10, top - 11, 20, 16, 6); ctx.fill();
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-10, top + 0, 20, 3.5);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); circ(0, top + 1.7, 1.8); ctx.fill();
  } else if (id === 'hat_crown') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(-11, top + 4); ctx.lineTo(-11, top - 8); ctx.lineTo(-5.5, top - 2); ctx.lineTo(0, top - 11);
    ctx.lineTo(5.5, top - 2); ctx.lineTo(11, top - 8); ctx.lineTo(11, top + 4); ctx.closePath(); ctx.fill();
    disc(0, top, 2, '#ff4f93'); disc(-6.5, top + 1, 1.5, '#5b8def'); disc(6.5, top + 1, 1.5, '#5fd38a');
  } else if (id === 'hat_cat') {
    ctx.fillStyle = '#3b2a26';
    tri(-13, top + 7, -10, top - 9, -2, top + 2); tri(2, top + 2, 10, top - 9, 13, top + 7);
    ctx.fillStyle = '#ff9cc4';
    tri(-10.5, top + 4, -9, top - 4, -5, top + 2); tri(5, top + 2, 9, top - 4, 10.5, top + 4);
  }
}
function drawPet(x, y, id, moving) {
  const hop = moving ? Math.abs(Math.sin(t * 9)) * 7 : 0;
  ctx.save(); ctx.translate(x, y - hop);
  if (id === 'pet_sushi') {
    rr(-13, -12, 26, 12, 6); ctx.fillStyle = '#fff'; ctx.fill();
    rr(-14, -18, 28, 9, 5); ctx.fillStyle = '#ff8a5c'; ctx.fill();
    ctx.fillStyle = '#2f4f3a'; ctx.fillRect(-2.5, -18, 5, 18);
    disc(-6, -6, 1.6, '#333'); disc(6, -6, 1.6, '#333');
    disc(-8.5, -3.5, 2, 'rgba(255,120,150,.5)'); disc(8.5, -3.5, 2, 'rgba(255,120,150,.5)');
  } else if (id === 'pet_cat') {
    ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-11, -10); ctx.quadraticCurveTo(-22, -14 + Math.sin(t * 6) * 4, -18, -26); ctx.stroke();
    ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.ellipse(0, -9, 13, 8, 0, 0, TAU); ctx.fill();
    disc(11, -19, 8, '#9aa0a6');
    tri(5, -24, 7, -32, 11, -26); tri(12, -26, 16, -32, 17, -23);
    disc(10, -20, 1.4, '#222'); disc(15, -20, 1.4, '#222');
    disc(13, -16.5, 1.2, '#ff8fb3');
    ctx.fillStyle = '#9aa0a6'; ctx.fillRect(-9, -4, 4, 4); ctx.fillRect(5, -4, 4, 4);
  }
  ctx.restore();
}
function drawPerson(x, y, o) {
  const c = CONFIG.colors, sk = c.skin;
  const photo = o.girl ? herPhoto : myPhoto;
  const hat = o.girl ? Bank.equipped('hat') : null;
  ctx.save(); ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  const sq = o.sq || 0; ctx.scale(1 + sq, 1 - sq);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.wings) {
    const f = Math.sin(t * 16);
    for (const a of [-0.35, -0.95]) {
      ctx.save(); ctx.translate(-5, -33); ctx.rotate(a + f * 0.35);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = '#ffb3d1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-15, 0, 17, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  if (o.girl && !photo.img) {
    ctx.fillStyle = c.herHair;
    ctx.beginPath(); ctx.ellipse(-3, -45, 14, 15, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(-13, -42); ctx.rotate(0.5 + Math.sin(t * 10) * 0.12);
    ctx.beginPath(); ctx.ellipse(0, 8, 6, 13, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  const sw = o.run != null && !o.air ? Math.sin(o.run) * 8 : 0;
  ctx.strokeStyle = o.girl ? sk : '#3b4a7a'; ctx.lineWidth = 5;
  const leg = (x1, y1, x2, y2) => { line(x1, y1, x2, y2); ctx.fillStyle = '#5a3b4a'; ctx.beginPath(); ctx.ellipse(x2 + 2, y2 - 1, 4.5, 3, 0, 0, TAU); ctx.fill(); };
  if (o.air) { leg(-3, -16, -9, -5); leg(3, -16, 6, -3); }
  else { leg(-3, -16, -3 + sw, -1); leg(3, -16, 3 - sw, -1); }
  if (o.girl) {
    ctx.fillStyle = dressColor(); ctx.beginPath();
    ctx.moveTo(-7, -37); ctx.lineTo(7, -37); ctx.lineTo(14, -14); ctx.quadraticCurveTo(0, -11, -14, -14); ctx.closePath(); ctx.fill();
    disc(-4, -22, 1.6, 'rgba(255,255,255,.7)'); disc(5, -27, 1.6, 'rgba(255,255,255,.7)'); disc(2, -18, 1.6, 'rgba(255,255,255,.7)');
  } else { rr(-10, -38, 20, 23, 6); ctx.fillStyle = c.myShirt; ctx.fill(); }
  ctx.strokeStyle = sk; ctx.lineWidth = 4.5;
  const arm = (x2, y2) => line(0, -33, x2, y2);
  if (o.arms === 'up') { arm(-9, -46); arm(10, -47); }
  else if (o.arms === 'wave') { arm(-6, -21); arm(9 + Math.sin(t * 10) * 4, -50); }
  else if (o.arms === 'hug') { arm(14, -31); arm(15, -26); }
  else { const a = o.run != null ? Math.sin(o.run) * 7 : 0; arm(-a, -21); arm(a + 2, -21); }
  const hr = photo.img ? 20 : 13, hcy = photo.img ? -56 : -50;
  if (!drawFace(photo, hr, o.girl, hcy)) {
    disc(0, -49, 13, sk);
    ctx.fillStyle = o.girl ? c.herHair : c.myHair;
    ctx.beginPath(); ctx.arc(0, -52, 13.5, Math.PI, TAU); ctx.closePath(); ctx.fill();
    if (o.girl) {
      ctx.beginPath(); ctx.ellipse(-10, -46, 5, 9, 0.2, 0, TAU); ctx.fill();
      if (!hat) { disc(-9, -64, 3.5, '#ff4f93'); disc(-3, -64, 3.5, '#ff4f93'); disc(-6, -64, 2, '#c2416f'); }
    } else {
      ctx.beginPath(); ctx.moveTo(-4, -64); ctx.lineTo(4, -70); ctx.lineTo(6, -63); ctx.fill();
    }
    disc(3, -48, 1.9, '#3a2530'); disc(9, -48, 1.9, '#3a2530');
    disc(1, -43, 2.6, 'rgba(255,120,150,.45)'); disc(11, -43, 2.6, 'rgba(255,120,150,.45)');
    ctx.strokeStyle = '#3a2530'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(6, -45, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  if (hat) drawHat(hat, hcy - hr - (photo.img ? 5 : 0));
  ctx.restore();
}
function nameTag(x, y, s, c) {
  ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center';
  const w = ctx.measureText(s).width + 18;
  rr(x - w / 2, y - 12, w, 22, 11); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
  ctx.fillStyle = c; ctx.fillText(s, x, y + 4);
}
function cloudPlatform(cx, top) {
  ctx.fillStyle = '#e3f1ff'; rr(cx - 95, top + 6, 190, 30, 15); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath();
  for (let x = cx - 80; x <= cx + 80; x += 32) circ(x, top + 10, 20);
  ctx.fill();
}

/* ---------- HUD ---------- */
function drawHUD() {
  const bw = Math.min(250, W * 0.36), x = 14, y = 12;
  rr(x, y, bw + 20, 50, 14); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fill();
  ctx.font = `700 13px ${FONT}`; ctx.fillStyle = '#c2416f'; ctx.textAlign = 'left';
  ctx.fillText(`Здоровье ${CONFIG.herNameGen}`, x + 10, y + 19);
  ctx.textAlign = 'right'; ctx.fillText(`${Math.round(shownHealth)}%`, x + bw + 10, y + 19);
  rr(x + 10, y + 28, bw, 13, 6.5); ctx.fillStyle = '#ffe0ea'; ctx.fill();
  const g = ctx.createLinearGradient(x + 10, 0, x + 10 + bw, 0);
  g.addColorStop(0, '#ff6f91'); g.addColorStop(0.5, '#ffc15e'); g.addColorStop(1, '#5fd38a');
  rr(x + 10, y + 28, Math.max(13, bw * shownHealth / 100), 13, 6.5); ctx.fillStyle = g; ctx.fill();

  rr(x, y + 56, 92, 28, 14); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fill();
  drawCoin(x + 16, y + 70);
  ctx.font = `700 14px ${FONT}`; ctx.fillStyle = '#9a6a00'; ctx.textAlign = 'left';
  ctx.fillText(String(Bank.coins), x + 32, y + 75);

  if (state === 'play') {
    const L = LEVELS[level], pw = Math.min(190, W * 0.3), px = W - 64 - pw - 20;
    rr(px, y, pw + 20, 50, 14); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fill();
    ctx.font = `700 11px ${FONT}`; ctx.fillStyle = '#7a5a6a'; ctx.textAlign = 'left';
    ctx.fillText(L.name.split(' · ')[0], px + 10, y + 19);
    rr(px + 10, y + 28, pw, 10, 5); ctx.fillStyle = '#efe4f7'; ctx.fill();
    rr(px + 10, y + 28, Math.max(10, pw * Math.min(1, lvlT / L.length)), 10, 5); ctx.fillStyle = '#b48ef0'; ctx.fill();
  }
}
function drawBanner() {
  if (banner <= 0 || state !== 'play') return;
  ctx.globalAlpha = clamp01(Math.min(banner / 0.5, (2.4 - banner) / 0.3));
  ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center';
  const s = LEVELS[level].name, w = ctx.measureText(s).width + 40;
  rr(W / 2 - w / 2, 120, w, 50, 25); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
  ctx.fillStyle = '#d63d7a'; ctx.fillText(s, W / 2, 154);
  ctx.globalAlpha = 1;
}

/* ---------- render ---------- */
function render() {
  ctx.setTransform(S * DPR, 0, 0, S * DPR, 0, 0);
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  if (theme === 'bedroom') bgBedroom(); else if (theme === 'city') bgCity(); else bgSky();

  if (state === 'finale') {
    const top = GROUND - 110;
    cloudPlatform(fin.hx - 20, top);
    drawPerson(fin.hx, top, { girl: false, flip: true, arms: fin.met ? 'hug' : 'wave' });
    if (fin.met) {
      heartPath(fin.hx - 20, top - 100, 22 + Math.sin(t * 6) * 3); ctx.fillStyle = '#ff4f8b'; ctx.fill();
    }
    if (fT > 2) {
      ctx.globalAlpha = ease((fT - 2) / 0.8);
      const close = fin.hx - P.x < 120;
      nameTag(fin.hx + (close ? 32 : 0), top - 78, CONFIG.myName, '#3f6fd8');
      nameTag(P.x - (close ? 32 : 0), P.y - (herPhoto.img ? 112 : 78), CONFIG.herName, '#d63d7a');
      ctx.globalAlpha = 1;
    }
  }
  pickups.forEach(drawPickup);
  viruses.forEach(drawVirus);

  const pet = Bank.equipped('pet');
  if (pet) drawPet(P.x - 46, Math.min(petY, GROUND), pet, state !== 'finale' || !fin.met);

  const flying = state === 'finale' && !fin.met;
  ctx.globalAlpha = P.inv > 0 && ((t * 10) | 0) % 2 ? 0.45 : 1;
  drawPerson(P.x, P.y, {
    girl: true, sq: P.sq,
    run: state === 'finale' ? null : t * (state === 'play' ? 16 : 10),
    air: flying || (state === 'play' && !P.onGround),
    wings: state === 'finale',
    arms: state === 'finale' ? (fin.met ? 'hug' : 'up') : (state === 'play' && !P.onGround ? 'up' : null),
  });
  ctx.globalAlpha = 1;
  if (state === 'play' && P.shield) {
    ctx.strokeStyle = `rgba(255,200,60,${0.55 + Math.sin(t * 5) * 0.2})`; ctx.lineWidth = 3;
    ctx.beginPath(); circ(P.x, P.y - 32, 40); ctx.stroke();
  }

  for (const p of parts) {
    ctx.globalAlpha = clamp01(p.life / p.max);
    if (p.kind === 'heart') { heartPath(p.x, p.y, p.s); ctx.fillStyle = p.c; ctx.fill(); }
    else disc(p.x, p.y, p.s, p.c);
  }
  ctx.globalAlpha = 1;
  for (const s of texts) {
    ctx.globalAlpha = clamp01(s.life / s.max * 2);
    ctx.font = `700 ${s.big ? 24 : 16}px ${FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(s.s, s.x, s.y);
    ctx.fillStyle = s.c; ctx.fillText(s.s, s.x, s.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (state === 'play' || state === 'finale') drawHUD();
  drawBanner();
}

/* ---------- loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000)); last = now;
  if (!UI.screenOpen()) { update(dt); render(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

return {
  startNew, toIdle, startLevel, startFinale, update, render, tryJump,
  setHealth(h) { health = h; },
  get state() { return state; }, get level() { return level; }, get health() { return health; },
  get P() { return P; }, get viruses() { return viruses; },
};
})();
