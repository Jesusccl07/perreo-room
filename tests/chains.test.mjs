import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPendulum, chainLinks } from '../js/chains.js';

test('pendulum en reposo se mantiene', () => {
  const s = stepPendulum({ angle: 0, vel: 0 }, 1 / 60);
  assert.equal(s.angle, 0);
  assert.equal(s.vel, 0);
});

test('pendulum con angle 0.5 se amortigua tras 600 pasos y nunca da NaN', () => {
  let s = { angle: 0.5, vel: 0 };
  for (let i = 0; i < 600; i++) {
    s = stepPendulum(s, 1 / 60);
    assert.ok(Number.isFinite(s.angle) && Number.isFinite(s.vel));
  }
  assert.ok(Math.abs(s.angle) < 0.05, `angle=${s.angle}`);
});

test('pendulum estable con dt grande (se limita a 0.05)', () => {
  let s = { angle: 1, vel: 5 };
  for (let i = 0; i < 1000; i++) {
    s = stepPendulum(s, 1);
    assert.ok(Number.isFinite(s.angle) && Math.abs(s.angle) < 10);
  }
});

test('chainLinks devuelve centros en línea recta hacia abajo', () => {
  const links = chainLinks({ x: 0, y: 0 }, 0, 3, 10);
  assert.equal(links.length, 3);
  [5, 15, 25].forEach((y, i) => {
    assert.ok(Math.abs(links[i].x) < 1e-9);
    assert.ok(Math.abs(links[i].y - y) < 1e-9);
    assert.equal(links[i].rot, 0);
  });
});

test('chainLinks rota con el ángulo', () => {
  const a = Math.PI / 2;
  const links = chainLinks({ x: 0, y: 0 }, a, 2, 10);
  assert.ok(Math.abs(links[0].x + 5) < 1e-9);
  assert.ok(Math.abs(links[0].y) < 1e-9);
  assert.equal(links[0].rot, a);
});
