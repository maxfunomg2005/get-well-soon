/* Shared UI: overlay card, full screens, toast, sound. */
const $ = id => document.getElementById(id);

const Sound = (() => {
  let AC = null, muted = false;
  function wake() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (AC.state === 'suspended') AC.resume();
  }
  function tone(f1, f2, dur, type = 'sine', vol = 0.12, delay = 0) {
    if (!AC || muted) return;
    const t0 = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  const seq = (notes, step, type = 'triangle', dur = 0.18) => notes.forEach((f, i) => tone(f, f, dur, type, 0.1, i * step));
  const fx = {
    jump: () => tone(420, 700, 0.14, 'sine', 0.12),
    jump2: () => tone(600, 1000, 0.14, 'sine', 0.1),
    pick: () => { tone(880, 880, 0.08, 'triangle', 0.12); tone(1320, 1320, 0.12, 'triangle', 0.1, 0.07); },
    coin: () => { tone(1250, 1250, 0.05, 'square', 0.04); tone(1660, 1660, 0.1, 'square', 0.04, 0.05); },
    power: () => seq([660, 880, 1100, 1320], 0.06, 'triangle', 0.1),
    hit: () => tone(240, 90, 0.25, 'square', 0.05),
    level: () => seq([523, 659, 784, 1047], 0.1),
    win: () => seq([523, 659, 784, 1047, 784, 1047, 1319], 0.13, 'triangle', 0.25),
    card: () => tone(300, 200, 0.05, 'triangle', 0.08),
    chips: () => { tone(2000, 1800, 0.04, 'square', 0.03); tone(2300, 2100, 0.04, 'square', 0.03, 0.05); },
    tick: () => tone(900, 900, 0.03, 'square', 0.025),
    lose: () => seq([392, 330, 262], 0.15, 'triangle', 0.22),
    buy: () => seq([784, 988, 1175, 1568], 0.07),
  };
  return {
    wake, fx,
    get muted() { return muted; },
    toggle() { muted = !muted; return muted; },
  };
})();

const UI = (() => {
  const ov = $('ov'), ovBtns = $('ovBtns');
  let primaryCb = null, ready = false, readyTimer = null;

  function overlay(title, text, buttons) {
    $('ovTitle').textContent = title;
    $('ovText').textContent = text;
    ovBtns.innerHTML = '';
    primaryCb = null; ready = false;
    buttons.forEach((b, i) => {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (b.alt) el.className = 'alt';
      el.disabled = true;
      const run = () => { if (!ready) return; Sound.wake(); hide(); b.cb && b.cb(); };
      el.addEventListener('click', run);
      if (i === 0) primaryCb = run;
      ovBtns.appendChild(el);
    });
    ov.classList.add('show');
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      ready = true;
      Array.from(ovBtns.children || []).forEach(b => { b.disabled = false; });
      try { ovBtns.firstChild && ovBtns.firstChild.focus(); } catch (e) {}
    }, 550);
  }
  function hide() { ov.classList.remove('show'); }
  const isOpen = () => ov.classList.contains('show');
  function pressPrimary() { if (isOpen() && primaryCb) primaryCb(); }

  const scr = $('screen'), body = $('scrBody');
  let backCb = null;
  function openScreen(title, cls, onBack) {
    hide();
    scr.className = 'screen show ' + cls;
    $('scrTitle').textContent = title;
    backCb = onBack;
    body.innerHTML = '';
    scr.scrollTop = 0;
    return body;
  }
  function closeScreen() { scr.className = 'screen'; backCb = null; }
  const screenOpen = () => scr.classList.contains('show');
  $('scrBack').addEventListener('click', () => { Sound.wake(); if (backCb) backCb(); });

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  Bank.onChange(c => {
    document.querySelectorAll('.coinval').forEach(e => { e.textContent = c; });
  });
  $('mute').addEventListener('click', () => {
    Sound.wake();
    $('mute').textContent = Sound.toggle() ? '🔈' : '🔊';
  });

  return { overlay, hide, isOpen, pressPrimary, openScreen, closeScreen, screenOpen, toast };
})();

const pick = arr => arr[(Math.random() * arr.length) | 0];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
