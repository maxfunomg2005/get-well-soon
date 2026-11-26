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
    spawn: { interval: 0.55, maxFish: 22, schoolSize: [3, 5], schoolBelow: 4 }, // types 0..3 come in schools
    boss: { every: 150, first: 60, warn: 5 },       // seconds
    freeze: { seconds: 5, start: 3, price: 200 },   // free freezes at first visit; then buy for coins
    bigCatch: 300,                                  // announce catches at or above this multiplier
    // shape: how the fish is drawn; len/h = hitbox ellipse (px); speed px/s; w = spawn weight; colors are 6-digit hex
    fish: [
      { mult: 12,    name: 'Килька',          shape: 'fish',   len: 30,  h: 14,  speed: 100, w: 40,  c1: '#7fc8ff', c2: '#e8f6ff' },
      { mult: 20,    name: 'Гуппи',           shape: 'fish',   len: 34,  h: 18,  speed: 95,  w: 32,  c1: '#ff9f43', c2: '#ffe0b8' },
      { mult: 30,    name: 'Рыба-клоун',      shape: 'fish',   len: 38,  h: 22,  speed: 90,  w: 26,  c1: '#ff7a1a', c2: '#ffffff', stripes: 1 },
      { mult: 50,    name: 'Зеленушка',       shape: 'fish',   len: 44,  h: 24,  speed: 85,  w: 20,  c1: '#5fd35f', c2: '#d9ffd0' },
      { mult: 80,    name: 'Рыба-ангел',      shape: 'tall',   len: 46,  h: 44,  speed: 75,  w: 15,  c1: '#ffd84a', c2: '#3a3a3a', stripes: 1 },
      { mult: 100,   name: 'Медуза',          shape: 'jelly',  len: 46,  h: 40,  speed: 60,  w: 12,  c1: '#ff9ad5', c2: '#ffd6ef' },
      { mult: 150,   name: 'Иглобрюх',        shape: 'puffer', len: 52,  h: 48,  speed: 65,  w: 10,  c1: '#f5d76e', c2: '#fff6cf' },
      { mult: 200,   name: 'Неонка',          shape: 'fish',   len: 58,  h: 26,  speed: 90,  w: 8,   c1: '#24e0e0', c2: '#ff4f8b', glow: '#55ffff' },
      { mult: 250,   name: 'Скат',            shape: 'ray',    len: 72,  h: 64,  speed: 60,  w: 6.5, c1: '#9b6bd6', c2: '#e6d6ff' },
      { mult: 300,   name: 'Осьминог',        shape: 'octo',   len: 76,  h: 56,  speed: 55,  w: 5.5, c1: '#e8505b', c2: '#ffc1c5' },
      { mult: 500,   name: 'Черепаха',        shape: 'turtle', len: 86,  h: 66,  speed: 45,  w: 4,   c1: '#3fa66b', c2: '#a7e3a1' },
      { mult: 800,   name: 'Рыба-меч',        shape: 'long',   len: 120, h: 30,  speed: 80,  w: 3,   c1: '#8fa7c8', c2: '#e9f0fa' },
      { mult: 1000,  name: 'Акула',           shape: 'shark',  len: 130, h: 48,  speed: 60,  w: 2.4, c1: '#7d8b99', c2: '#f2f4f6' },
      { mult: 1500,  name: 'Золотая рыбка',   shape: 'fish',   len: 96,  h: 56,  speed: 55,  w: 1.8, c1: '#ffc61a', c2: '#fff1a8', glow: '#ffe066' },
      { mult: 2000,  name: 'Рыба-фонарь',     shape: 'angler', len: 110, h: 70,  speed: 45,  w: 1.4, c1: '#4b3a6b', c2: '#9d86c9', glow: '#fff36b' },
      { mult: 3000,  name: 'Кальмар',         shape: 'octo',   len: 140, h: 70,  speed: 50,  w: 1,   c1: '#b05cd6', c2: '#ecc8ff' },
      { mult: 5000,  name: 'Кит',             shape: 'whale',  len: 190, h: 90,  speed: 35,  w: 0.6, c1: '#4a7fd6', c2: '#cfe0ff' },
      { mult: 8000,  name: 'Касатка',         shape: 'orca',   len: 190, h: 80,  speed: 45,  w: 0.4, c1: '#1e2430', c2: '#ffffff' },
      { mult: 10000, name: 'Кракен',          shape: 'octo',   len: 210, h: 130, speed: 30,  w: 0.3, c1: '#2f7d6a', c2: '#a6e6cf', glow: '#7fffd4' },
      { mult: 200000, name: 'Царь-рыба Мотивофосфат', shape: 'boss', len: 250, h: 150, speed: 28, w: 0, c1: '#ffcc33', c2: '#fff3b0', glow: '#ffe066', boss: true },
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
