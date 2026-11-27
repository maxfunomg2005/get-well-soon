/* Морской тир (fish-shooting arcade): all tunable numbers. Shared by the browser and sim/fish.js.
   World is a fixed portrait 540x960 coordinate space; the screen scales it to fit. */
(function (root) {
  const FISH_CONFIG = {
    // Kill chance per hit = targetRTP / multiplier, so every hit returns targetRTP x shot cost on average.
    // 0.95 = house keeps 5%; above 1 the player wins on average (it's a gift — play coins only).
    targetRTP: 1.10,
    world: { w: 540, h: 960 },
    shot: {
      levels: [10, 50, 100, 500, 1000],
      defaultLevel: 1,          // index into levels -> 50
      speed: 760,               // px/s
      radius: 5,
      life: 8,                  // s; a bullet that hits nothing by then is refunded
      minInterval: 0.15,        // s between shots per seat (rate limit)
      maxPerSeat: 25,           // bullets in flight per seat
    },
    spawn: { interval: 0.8, maxFish: 16, schoolSize: [3, 4], schoolBelow: 4 }, // types 0..3 come in schools
    boss: { every: 150, first: 60, warn: 5 },       // seconds
    freeze: { seconds: 5, start: 3, price: 200 },   // free freezes at first visit; then buy for coins
    bigCatch: 300,                                  // announce catches at or above this multiplier
    // shape: how the fish is drawn; len/h = size + hitbox ellipse (px); speed px/s; w = spawn weight;
    // gun = smallest shot cost that can catch it (smaller bullets pass through); colors are 6-digit hex
    fish: [
      { mult: 12,    name: 'Килька',          gun: 10,   shape: 'fish',   len: 46,  h: 22,  speed: 55, w: 40,  c1: '#7fc8ff', c2: '#e8f6ff' },
      { mult: 20,    name: 'Гуппи',           gun: 10,   shape: 'fish',   len: 52,  h: 27,  speed: 52, w: 32,  c1: '#ff9f43', c2: '#ffe0b8' },
      { mult: 30,    name: 'Рыба-клоун',      gun: 10,   shape: 'fish',   len: 58,  h: 34,  speed: 50, w: 26,  c1: '#ff7a1a', c2: '#ffffff', stripes: 1 },
      { mult: 50,    name: 'Зеленушка',       gun: 10,   shape: 'fish',   len: 64,  h: 35,  speed: 48, w: 20,  c1: '#5fd35f', c2: '#d9ffd0' },
      { mult: 80,    name: 'Рыба-ангел',      gun: 50,   shape: 'tall',   len: 66,  h: 62,  speed: 42, w: 15,  c1: '#ffd84a', c2: '#3a3a3a', stripes: 1 },
      { mult: 100,   name: 'Медуза',          gun: 50,   shape: 'jelly',  len: 66,  h: 58,  speed: 34, w: 12,  c1: '#ff9ad5', c2: '#ffd6ef' },
      { mult: 150,   name: 'Иглобрюх',        gun: 50,   shape: 'puffer', len: 72,  h: 66,  speed: 36, w: 10,  c1: '#f5d76e', c2: '#fff6cf' },
      { mult: 200,   name: 'Неонка',          gun: 50,   shape: 'fish',   len: 80,  h: 36,  speed: 48, w: 8,   c1: '#24e0e0', c2: '#ff4f8b', glow: '#55ffff' },
      { mult: 250,   name: 'Скат',            gun: 100,  shape: 'ray',    len: 96,  h: 86,  speed: 34, w: 6.5, c1: '#9b6bd6', c2: '#e6d6ff' },
      { mult: 300,   name: 'Осьминог',        gun: 100,  shape: 'octo',   len: 100, h: 74,  speed: 30, w: 5.5, c1: '#e8505b', c2: '#ffc1c5' },
      { mult: 500,   name: 'Черепаха',        gun: 100,  shape: 'turtle', len: 112, h: 86,  speed: 26, w: 4,   c1: '#3fa66b', c2: '#a7e3a1' },
      { mult: 800,   name: 'Рыба-меч',        gun: 500,  shape: 'long',   len: 150, h: 38,  speed: 44, w: 3,   c1: '#8fa7c8', c2: '#e9f0fa' },
      { mult: 1000,  name: 'Акула',           gun: 500,  shape: 'shark',  len: 160, h: 60,  speed: 34, w: 2.4, c1: '#7d8b99', c2: '#f2f4f6' },
      { mult: 1500,  name: 'Золотая рыбка',   gun: 500,  shape: 'fish',   len: 120, h: 70,  speed: 30, w: 1.8, c1: '#ffc61a', c2: '#fff1a8', glow: '#ffe066' },
      { mult: 2000,  name: 'Рыба-фонарь',     gun: 500,  shape: 'angler', len: 136, h: 86,  speed: 26, w: 1.4, c1: '#4b3a6b', c2: '#9d86c9', glow: '#fff36b' },
      { mult: 3000,  name: 'Кальмар',         gun: 500,  shape: 'octo',   len: 170, h: 86,  speed: 28, w: 1,   c1: '#b05cd6', c2: '#ecc8ff' },
      { mult: 5000,  name: 'Кит',             gun: 1000, shape: 'whale',  len: 220, h: 104, speed: 20, w: 0.6, c1: '#4a7fd6', c2: '#cfe0ff' },
      { mult: 8000,  name: 'Касатка',         gun: 1000, shape: 'orca',   len: 220, h: 92,  speed: 24, w: 0.4, c1: '#1e2430', c2: '#ffffff' },
      { mult: 10000, name: 'Кракен',          gun: 1000, shape: 'octo',   len: 236, h: 146, speed: 17, w: 0.3, c1: '#2f7d6a', c2: '#a6e6cf', glow: '#7fffd4' },
      { mult: 200000, name: 'Царь-рыба Мотивофосфат', gun: 1000, shape: 'boss', len: 280, h: 168, speed: 16, w: 0, c1: '#ffcc33', c2: '#fff3b0', glow: '#ffe066', boss: true },
    ],
    // 4 cannon seats (world coords). Seat 0 = her, bottom-right.
    seats: [
      { x: 405, y: 936, dir: -1 },
      { x: 135, y: 936, dir: -1 },
      { x: 135, y: 24, dir: 1 },
      { x: 405, y: 24, dir: 1 },
    ],
    pool: { fish: 64, bullets: 160 },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = FISH_CONFIG;
  else root.FISH_CONFIG = FISH_CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
