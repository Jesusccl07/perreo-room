// Física pura de las cadenas (sin DOM).
const MAX_DT = 0.05;

// Péndulo amortiguado, Euler semi-implícito (primero velocidad, luego posición).
export function stepPendulum(s, dt, opts = {}) {
  const { gravity = 9.81, length = 1, damping = 1.2 } = opts;
  const h = Math.min(Math.max(dt, 0), MAX_DT);
  let vel = s.vel + (-(gravity / length) * Math.sin(s.angle) - damping * s.vel) * h;
  const angle = s.angle + vel * h;
  return { angle, vel };
}

// Centros de `count` eslabones en línea recta desde el ancla.
// angle 0 = colgando hacia abajo (+y).
export function chainLinks(anchor, angle, count, linkLen) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const links = [];
  for (let i = 0; i < count; i++) {
    const d = (i + 0.5) * linkLen;
    links.push({ x: anchor.x - sin * d, y: anchor.y + cos * d, rot: angle });
  }
  return links;
}
