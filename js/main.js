// Arranque: cuenta atrás, revelado por scroll y efectos (respetando reduced-motion).
import { getRemaining } from './countdown.js';
import { startLightning, startChains } from './fx.js';

const root = document.documentElement;
root.classList.add('reveal-ready');

/* ---------- Cuenta atrás ---------- */
const cd = {
  days: document.getElementById('cd-days'),
  hours: document.getElementById('cd-hours'),
  minutes: document.getElementById('cd-minutes'),
  seconds: document.getElementById('cd-seconds'),
};
const cdDone = document.getElementById('cd-done');
const pad = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

function tick() {
  const r = getRemaining(Date.now());
  const finished = r.done || (r.days === 0 && r.hours === 0 && r.minutes === 0 && r.seconds === 0);
  for (const key of Object.keys(cd)) {
    const node = cd[key];
    if (!node) continue;
    const text = finished ? '00' : pad(r[key]);
    if (node.textContent !== text) node.textContent = text;
  }
  if (finished) {
    if (cdDone) cdDone.hidden = false;
    return;
  }
  // Alineado al cambio de segundo para que no se salte ninguno.
  setTimeout(tick, 1000 - (Date.now() % 1000) + 15);
}
tick();

/* ---------- Revelado por scroll ---------- */
const reveals = document.querySelectorAll('.reveal');
if (typeof IntersectionObserver === 'undefined') {
  reveals.forEach((n) => n.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  reveals.forEach((n) => io.observe(n));
}

/* ---------- Efectos ---------- */
const canvas = document.getElementById('bolt-canvas');
const logo = document.getElementById('hero-logo');
const trigger = logo ? logo.parentElement || logo : null;
const chainSvgs = [
  document.getElementById('chain-left'),
  document.getElementById('chain-right'),
  ...document.querySelectorAll('.chain-divider'),
].filter(Boolean);

const motionQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

let lightning = null;
let chains = null;

function applyMotion() {
  if (lightning) lightning.stop();
  if (chains) chains.stop();
  lightning = null;
  chains = null;
  const reduce = !!(motionQuery && motionQuery.matches);
  // Con movimiento reducido: cadenas estáticas, sin rayos ni destellos.
  chains = startChains(chainSvgs, { animate: !reduce });
  if (!reduce && canvas) {
    lightning = startLightning(canvas, trigger, {
      onStrike: (info) => { if (chains && chains.impulse) chains.impulse(info); },
    });
  }
}

applyMotion();
if (motionQuery) {
  if (typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', applyMotion);
  else if (typeof motionQuery.addListener === 'function') motionQuery.addListener(applyMotion);
}
