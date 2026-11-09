// Lógica pura de rayos: sin DOM, sin Math.random (el azar entra por opts.rng).

const MAX_DEPTH = 2;

function num(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

export function generateBolt(x1, y1, x2, y2, opts = {}) {
  const rng = typeof opts.rng === 'function' ? opts.rng : () => 0.5;
  const detail = Math.max(1, Math.min(8, Math.floor(num(opts.detail, 6))));
  const branchChance = Math.max(0, Math.min(1, num(opts.branchChance, 0.25)));
  const jitter = Math.max(0, num(opts.jitter, 0.25));
  const out = [];

  function r() {
    const v = rng();
    return Number.isFinite(v) ? v : 0.5;
  }

  function subdivide(ax, ay, bx, by, level, depth) {
    if (level <= 0) {
      out.push({ x1: ax, y1: ay, x2: bx, y2: by, depth });
      return;
    }
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let mx = (ax + bx) / 2;
    let my = (ay + by) / 2;
    if (len > 0) {
      // Desplazamiento perpendicular proporcional a la longitud del segmento.
      const off = (r() - 0.5) * 2 * jitter * len;
      mx += (-dy / len) * off;
      my += (dx / len) * off;
    }
    subdivide(ax, ay, mx, my, level - 1, depth);
    if (depth < MAX_DEPTH && len > 0 && r() < branchChance) {
      // Rama: sale del punto medio, desviada del sentido principal, más corta.
      const angle = (r() - 0.5) * Math.PI * 0.8;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const scale = 0.5 + r() * 0.3;
      const ex = mx + (dx * cos - dy * sin) * scale;
      const ey = my + (dx * sin + dy * cos) * scale;
      subdivide(mx, my, ex, ey, Math.max(1, level - 2), depth + 1);
    }
    subdivide(mx, my, bx, by, level - 1, depth);
  }

  subdivide(x1, y1, x2, y2, detail, 0);
  return out;
}

export function createFlashLimiter(maxPerSecond) {
  const max = Math.max(0, Math.floor(num(maxPerSecond, 0)));
  const stamps = [];
  return {
    tryFlash(nowMs) {
      while (stamps.length && nowMs - stamps[0] >= 1000) stamps.shift();
      if (stamps.length >= max) return false;
      stamps.push(nowMs);
      return true;
    },
  };
}
