/* Main menu + boot. */
const App = {
  menu() {
    UI.closeScreen();
    Runner.toIdle();
    let txt = fill(CONFIG.intro) + `\n\nУ тебя 🪙 ${Bank.coins} монет.`;
    if (window.innerHeight > window.innerWidth) txt += '\n📱 Совет: поверни телефон горизонтально.';
    UI.overlay(fill(CONFIG.title), txt, [
      { label: 'Играть ♥', cb: () => Runner.startNew() },
      { label: 'Казино 🤠', cb: () => Casino.hub(), alt: true },
      { label: 'Магазин 🛍️', cb: () => Shop.open(), alt: true },
      { label: 'Вдвоём 🎮', cb: () => Duo.open(), alt: true },
    ]);
  },
};

(() => {
  // ?preview=2 / 3 / end / casino / ranch / fish / slots / shop / duo; ?room=CODE opens a two-player room  (&ff=seconds fast-forwards the runner)
  const qs = new URLSearchParams(location.search), pv = qs.get('preview'), roomCode = qs.get('room');
  if (roomCode) Duo.open(DuoNet.normCode(roomCode)); // invite link: ?room=CODE
  else if (pv === 'duo') Duo.open();
  else if (pv === 'end') { Runner.startLevel(2); Runner.startFinale(); }
  else if (pv === '2' || pv === '3') { Runner.setHealth(50); Runner.startLevel(+pv - 1); }
  else if (pv === 'casino') Casino.hub();
  else if (pv === 'poker' || pv === 'ranch') Ranch.open();
  else if (pv === 'slots') Slots.open();
  else if (pv === 'fish') FishGame.open();
  else if (pv === 'shop') Shop.open();
  else App.menu();
  const ff = Math.min(60, +qs.get('ff') || 0);
  for (let i = 0; i < ff * 60; i++) Runner.update(1 / 60);
})();
