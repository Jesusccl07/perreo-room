// Efectos visuales del hero: rayos (canvas) y cadenas cromadas (SVG).
// Toda la lógica pura vive en lightning.js y chains.js; aquí solo hay DOM.
import { generateBolt, createFlashLimiter } from './lightning.js';
import { stepPendulum, chainLinks } from './chains.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FADE_MS = 250;
const MIN_GAP_MS = 3000;
const GAP_RANGE_MS = 4000;
const MAX_DT = 0.05;

const now = () => (typeof performance !== 'undefined' && Number.isFinite(performance.now()) ? performance.now() : Date.now());
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const noop = () => {};

function observeVisibility(el, cb) {
  if (!el || typeof IntersectionObserver === 'undefined') {
    cb(true);
    return noop;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) cb(e.isIntersecting);
  });
  io.observe(el);
  return () => io.disconnect();
}

function observeResize(el, cb) {
  if (typeof ResizeObserver !== 'undefined' && el) {
    const ro = new ResizeObserver(() => cb());
    ro.observe(el);
    return () => ro.disconnect();
  }
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

/* =========================================================
   RAYOS
   ========================================================= */

// Pasadas de trazo por capa: halo rojo ancho, fucsia medio, núcleo blanco fino.
const BOLT_PASSES = [
  { color: 'rgba(255, 0, 60, 0.30)', width: 9, blur: 26, shadow: '#FF003C' },
  { color: 'rgba(255, 0, 110, 0.80)', width: 3.2, blur: 9, shadow: '#FF006E' },
  { color: '#FFFFFF', width: 1.3, blur: 3, shadow: '#FFFFFF' },
];
const DEPTH_SCALE = [1, 0.55, 0.34];
const DEPTH_ALPHA = [1, 0.7, 0.45];

function boltPaths(segments) {
  const paths = [];
  const last = [];
  for (const s of segments) {
    const d = Math.min(s.depth, DEPTH_SCALE.length - 1);
    if (!paths[d]) paths[d] = new Path2D();
    const p = paths[d];
    const l = last[d];
    if (!l || l.x !== s.x1 || l.y !== s.y1) p.moveTo(s.x1, s.y1);
    p.lineTo(s.x2, s.y2);
    last[d] = { x: s.x2, y: s.y2 };
  }
  return paths;
}

export function startLightning(canvas, trigger, opts = {}) {
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return { stop: noop };

  const onStrike = typeof opts.onStrike === 'function' ? opts.onStrike : noop;
  const limiter = createFlashLimiter(3);
  const area = canvas.parentElement || canvas;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let bolts = [];
  let raf = 0;
  let timer = 0;
  let inView = true;
  let active = false;
  let stopped = false;

  // Destello de pantalla completa: un único nodo reutilizado.
  let flash = null;
  if (document.body) {
    flash = document.createElement('div');
    flash.className = 'bolt-flash';
    flash.setAttribute('aria-hidden', 'true');
    document.body.appendChild(flash);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bolts.length) draw(now());
  }

  function targetPoint() {
    const cr = canvas.getBoundingClientRect();
    const tr = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : null;
    if (tr && tr.width > 0) {
      return {
        x: tr.left - cr.left + tr.width * (0.5 + (Math.random() - 0.5) * 0.55),
        y: tr.top - cr.top + tr.height * (0.18 + Math.random() * 0.3),
      };
    }
    return { x: w * (0.3 + Math.random() * 0.4), y: h * (0.35 + Math.random() * 0.15) };
  }

  function strike() {
    if (stopped || !active || w < 2) return false;
    // Cada rayo es un destello: siempre pasa por el limitador (máx. 3/s).
    if (!limiter.tryFlash(now())) return false;

    const end = targetPoint();
    const startX = clamp(end.x + (Math.random() - 0.5) * w * 0.7, w * 0.06, w * 0.94);
    const len = Math.hypot(end.x - startX, end.y + 20);
    const segments = generateBolt(startX, -20, end.x, end.y, {
      rng: Math.random,
      detail: len > 420 ? 7 : 6,
      branchChance: 0.32,
      jitter: 0.2,
    });
    bolts.push({ paths: boltPaths(segments), born: now() });

    if (flash && typeof flash.animate === 'function') {
      flash.style.setProperty('--fx', `${((end.x / w) * 100).toFixed(1)}%`);
      flash.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }],
        { duration: 280, easing: 'ease-out' },
      );
    }
    onStrike({ x: end.x / w });
    if (!raf) raf = requestAnimationFrame(loop);
    return true;
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const b of bolts) {
      const k = clamp((t - b.born) / FADE_MS, 0, 1);
      const a = Math.pow(1 - k, 1.6);
      if (a <= 0) continue;
      for (const pass of BOLT_PASSES) {
        ctx.strokeStyle = pass.color;
        ctx.shadowColor = pass.shadow;
        ctx.shadowBlur = pass.blur * dpr;
        b.paths.forEach((p, d) => {
          if (!p) return;
          ctx.globalAlpha = a * DEPTH_ALPHA[d];
          ctx.lineWidth = Math.max(0.6, pass.width * DEPTH_SCALE[d]);
          ctx.stroke(p);
        });
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  }

  function loop(ts) {
    raf = 0;
    const t = Number.isFinite(ts) ? ts : now();
    bolts = bolts.filter((b) => t - b.born < FADE_MS);
    draw(t);
    if (bolts.length) raf = requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, w, h);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = 0;
      if (!active) return;
      strike();
      schedule();
    }, MIN_GAP_MS + Math.random() * GAP_RANGE_MS);
  }

  // Pausa total fuera de pantalla o con la pestaña oculta. Al volver se
  // programa un único rayo nuevo: nunca se acumulan ni salen en ráfaga.
  function update() {
    const want = !stopped && inView && !document.hidden;
    if (want === active) return;
    active = want;
    if (active) {
      schedule();
    } else {
      clearTimeout(timer);
      timer = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      bolts = [];
      ctx.clearRect(0, 0, w, h);
    }
  }

  const onPointer = (e) => {
    if (e.type === 'pointerenter' && e.pointerType !== 'mouse') return;
    strike();
  };

  resize();
  const unResize = observeResize(canvas, resize);
  const unView = observeVisibility(area, (v) => { inView = v; update(); });
  document.addEventListener('visibilitychange', update);
  if (trigger) {
    trigger.addEventListener('pointerdown', onPointer);
    trigger.addEventListener('pointerenter', onPointer);
  }
  update();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      update();
      unResize();
      unView();
      document.removeEventListener('visibilitychange', update);
      if (trigger) {
        trigger.removeEventListener('pointerdown', onPointer);
        trigger.removeEventListener('pointerenter', onPointer);
      }
      if (flash) flash.remove();
      flash = null;
    },
  };
}

/* =========================================================
   CADENAS
   ========================================================= */

let uid = 0;

function el(name, attrs, parent) {
  const n = document.createElementNS(SVG_NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function gradient(defs, id, x2, y2, stops) {
  const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs);
  for (const [offset, color, opacity = 1] of stops) {
    el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, g);
  }
}

// Degradados de cromo líquido (por SVG, con ids únicos).
function chromeDefs(svg) {
  const id = `pr-chain-${++uid}`;
  const defs = el('defs', {}, svg);
  gradient(defs, `${id}-ring`, 1, 1, [
    [0, '#FFFFFF'],
    [0.22, '#C0C0C0'],
    [0.5, '#C0C0C0', 0.28],
    [0.68, '#C0C0C0', 0.9],
    [0.86, '#FFFFFF'],
    [1, '#C0C0C0', 0.6],
  ]);
  gradient(defs, `${id}-edge`, 1, 0, [
    [0, '#C0C0C0', 0.35],
    [0.3, '#FFFFFF'],
    [0.55, '#C0C0C0'],
    [0.8, '#C0C0C0', 0.4],
    [1, '#C0C0C0', 0.15],
  ]);
  return id;
}

// Un eslabón centrado en (0,0) con el eje largo en Y; `p` = paso entre eslabones.
function makeLink(parent, id, p, flat) {
  const g = el('g', {}, parent);
  const t = p * 0.17;
  const b = p * 0.64;
  if (flat) {
    const a = p * 0.36;
    el('ellipse', { rx: a, ry: b, fill: 'none', stroke: '#020104', 'stroke-width': t + 2.2 }, g);
    el('ellipse', { rx: a, ry: b, fill: 'none', stroke: `url(#${id}-ring)`, 'stroke-width': t }, g);
    // Brillo especular a la izquierda y reflejo neón a la derecha.
    el('ellipse', {
      rx: a, ry: b, fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.85,
      'stroke-width': Math.max(0.6, t * 0.22), 'stroke-linecap': 'round',
      pathLength: 100, 'stroke-dasharray': '16 84', 'stroke-dashoffset': -42,
    }, g);
    el('ellipse', {
      rx: a, ry: b, fill: 'none', stroke: '#FF003C', 'stroke-opacity': 0.55,
      'stroke-width': Math.max(0.5, t * 0.2), 'stroke-linecap': 'round',
      pathLength: 100, 'stroke-dasharray': '12 88', 'stroke-dashoffset': 6,
    }, g);
  } else {
    const ew = t * 1.25;
    const rect = { x: -ew / 2, y: -b, width: ew, height: b * 2, rx: ew / 2 };
    el('rect', { ...rect, fill: '#020104', stroke: '#020104', 'stroke-width': 1.6 }, g);
    el('rect', { ...rect, fill: `url(#${id}-edge)` }, g);
    el('line', {
      x1: -ew * 0.14, y1: -b + ew * 0.7, x2: -ew * 0.14, y2: b - ew * 0.7,
      stroke: '#FFFFFF', 'stroke-opacity': 0.8, 'stroke-width': Math.max(0.5, ew * 0.16), 'stroke-linecap': 'round',
    }, g);
  }
  return g;
}

function setLink(g, x, y, rotRad, sy = 1) {
  const deg = (rotRad * 180) / Math.PI;
  g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg.toFixed(2)})${sy !== 1 ? ` scale(1 ${sy.toFixed(3)})` : ''}`);
}

function sizeOf(svg) {
  const r = svg.getBoundingClientRect();
  return { w: Math.max(0, r.width), h: Math.max(0, r.height) };
}

// Cadena colgante: dos tramos (superior absoluto + inferior relativo) para
// que la punta haga un ligero latigazo en vez de oscilar como una barra.
function buildHanging(svg) {
  const { w, h } = sizeOf(svg);
  svg.textContent = '';
  if (w < 4 || h < 4) return null;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const id = chromeDefs(svg);
  const narrow = window.innerWidth < 640;
  const count = narrow ? 7 : clamp(Math.round(h / 62), 8, 12);
  const p = Math.min((h * 0.92) / (count + 0.5), w * (narrow ? 0.8 : 1.15), 64);
  const top = Math.ceil(count * 0.55);
  const anchor = { x: w / 2, y: -p * 0.3 };
  const links = [];
  const layerFlat = el('g', {}, svg);
  const layerEdge = el('g', {}, svg);
  for (let i = 0; i < count; i++) {
    const flat = i % 2 === 0;
    links.push(makeLink(flat ? layerFlat : layerEdge, id, p, flat));
  }
  return { svg, links, count, top, p, anchor };
}

function renderHanging(c, upper, lower) {
  const a = chainLinks(c.anchor, upper, c.top, c.p);
  const joint = {
    x: c.anchor.x - Math.sin(upper) * c.top * c.p,
    y: c.anchor.y + Math.cos(upper) * c.top * c.p,
  };
  const b = chainLinks(joint, upper + lower, c.count - c.top, c.p);
  const all = a.concat(b);
  for (let i = 0; i < c.links.length; i++) setLink(c.links[i], all[i].x, all[i].y, all[i].rot);
}

// Separador horizontal: tensión 1 = recta y estirada, 0 = colgando (catenaria aprox.).
function buildDivider(svg) {
  const { w, h } = sizeOf(svg);
  svg.textContent = '';
  if (w < 4 || h < 4) return null;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const id = chromeDefs(svg);
  const p = clamp(h * 0.4, 13, 24);
  const x0 = p;
  const x1 = w - p;
  const count = Math.max(4, Math.round((x1 - x0) / p));
  const layerFlat = el('g', {}, svg);
  const layerEdge = el('g', {}, svg);
  const links = [];
  for (let i = 0; i < count; i++) {
    const flat = i % 2 === 0;
    links.push(makeLink(flat ? layerFlat : layerEdge, id, p, flat));
  }
  return { svg, links, count, x0, x1, h, drawn: NaN };
}

function renderDivider(d, tension) {
  if (Math.abs(tension - d.drawn) < 0.0015) return;
  d.drawn = tension;
  const tt = clamp(tension, -0.2, 1.2);
  const yMid = d.h * 0.32;
  const sag = (1 - clamp(tt, 0, 1)) * d.h * 0.42;
  const span = d.x1 - d.x0;
  const stretch = 1 + 0.07 * clamp(tt, 0, 1.2);
  for (let i = 0; i < d.count; i++) {
    const u = (i + 0.5) / d.count;
    const x = d.x0 + span * u;
    const y = yMid + sag * 4 * u * (1 - u);
    const slope = (sag * 4 * (1 - 2 * u)) / span;
    setLink(d.links[i], x, y, Math.atan2(slope, 1) - Math.PI / 2, stretch);
  }
}

function dividerTarget(svg) {
  const r = svg.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  const progress = clamp((vh - r.top) / (vh + r.height), 0, 1);
  return 1 - Math.abs(2 * progress - 1);
}

export function startChains(svgs, opts = {}) {
  const animate = opts.animate !== false;
  const list = Array.from(svgs || []).filter((s) => s && s.namespaceURI === SVG_NS);
  const hangingEls = list.filter((s) => !s.classList.contains('chain-divider'));
  const dividerEls = list.filter((s) => s.classList.contains('chain-divider'));

  let stopped = false;
  let raf = 0;
  let last = 0;
  let lastScroll = window.scrollY || 0;
  let heroVisible = true;
  const visibleDividers = new Set();
  const cleanups = [];

  let hanging = [];
  let dividers = [];

  function build() {
    hanging = hangingEls.map((svg) => {
      const c = buildHanging(svg);
      if (!c) return null;
      // Lado: izquierda empuja hacia ángulo positivo (−x, hacia fuera).
      c.side = svg.id === 'chain-right' ? -1 : 1;
      c.upper = { angle: 0, vel: 0 };
      c.lower = { angle: 0, vel: 0 };
      renderHanging(c, 0, 0);
      return c;
    }).filter(Boolean);
    dividers = dividerEls.map((svg) => {
      const d = buildDivider(svg);
      if (!d) return null;
      d.state = { angle: 0, vel: 0 };
      d.tension = animate ? dividerTarget(svg) : 0.5;
      renderDivider(d, d.tension);
      return d;
    }).filter(Boolean);
  }

  let resizeQueued = false;
  function onResize() {
    if (resizeQueued || stopped) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      if (!stopped) { build(); kick(); }
    });
  }

  build();
  // Reconstruye solo al cambiar el tamaño de verdad (ResizeObserver avisa al observar).
  const sizes = new Map(list.map((s) => [s, sizeOf(s)]));
  for (const s of list) {
    cleanups.push(observeResize(s, () => {
      const prev = sizes.get(s);
      const cur = sizeOf(s);
      if (prev && Math.abs(prev.w - cur.w) < 1 && Math.abs(prev.h - cur.h) < 1) return;
      sizes.set(s, cur);
      onResize();
    }));
  }

  if (!animate) {
    return {
      impulse: noop,
      stop() {
        stopped = true;
        cleanups.forEach((f) => f());
      },
    };
  }

  function kick() {
    if (!stopped && !raf && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function frame(ts) {
    raf = 0;
    if (stopped || document.hidden) return;
    const t = Number.isFinite(ts) ? ts : now();
    const dt = last ? clamp((t - last) / 1000, 0, MAX_DT) : 1 / 60;
    last = t;
    let moving = false;

    const sy = window.scrollY || 0;
    const dy = clamp(sy - lastScroll, -60, 60);
    lastScroll = sy;

    if (heroVisible) {
      for (const c of hanging) {
        // La velocidad de scroll abre las dos cadenas hacia fuera.
        if (dy) c.upper.vel += c.side * dy * 0.0016;
        const prevVel = c.upper.vel;
        c.upper = stepPendulum(c.upper, dt, { length: 1.5, damping: 0.55 });
        c.upper.angle = clamp(c.upper.angle, -0.6, 0.6);
        // Inercia del tramo inferior: reacciona al revés que el superior.
        c.lower.vel -= (c.upper.vel - prevVel) * 0.85;
        c.lower = stepPendulum(c.lower, dt, { length: 0.7, damping: 0.9 });
        c.lower.angle = clamp(c.lower.angle, -0.5, 0.5);
        renderHanging(c, c.upper.angle, c.lower.angle);
        const e = Math.abs(c.upper.angle) + Math.abs(c.upper.vel) + Math.abs(c.lower.angle) + Math.abs(c.lower.vel);
        if (e > 0.0015) moving = true;
      }
    }

    for (const d of dividers) {
      if (!visibleDividers.has(d.svg)) continue;
      const target = dividerTarget(d.svg);
      // Muelle subamortiguado hacia la tensión objetivo: pequeño rebote al frenar.
      d.state.angle = d.tension - target;
      d.state = stepPendulum(d.state, dt, { gravity: 9.81, length: 0.15, damping: 9 });
      d.tension = target + d.state.angle;
      renderDivider(d, d.tension);
      if (Math.abs(d.state.angle) + Math.abs(d.state.vel) > 0.002) moving = true;
    }

    if (moving || dy) raf = requestAnimationFrame(frame);
  }

  const onScroll = () => kick();
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));

  const onVis = () => { if (!document.hidden) { lastScroll = window.scrollY || 0; kick(); } };
  document.addEventListener('visibilitychange', onVis);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVis));

  if (hangingEls.length) {
    const hero = hangingEls[0].parentElement || hangingEls[0];
    cleanups.push(observeVisibility(hero, (v) => {
      heroVisible = v;
      if (v) kick();
    }));
  }
  for (const s of dividerEls) {
    cleanups.push(observeVisibility(s, (v) => {
      if (v) visibleDividers.add(s);
      else visibleDividers.delete(s);
      if (v) kick();
    }));
  }

  return {
    // Empujón de un rayo; x = posición horizontal normalizada (0..1) del impacto.
    impulse(info = {}) {
      if (stopped) return;
      const x = Number.isFinite(info.x) ? clamp(info.x, 0, 1) : 0.5;
      const mag = 0.32 + Math.random() * 0.22;
      for (const c of hanging) {
        const near = c.side > 0 ? 1 - x : x;
        c.upper.vel = clamp(c.upper.vel + c.side * mag * (0.55 + 0.45 * near), -0.6, 0.6);
      }
      kick();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      cleanups.forEach((f) => f());
    },
  };
}
