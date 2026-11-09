import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBolt, createFlashLimiter } from '../js/lightning.js';

function makeRng(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('el tronco empieza en (x1,y1) y termina en (x2,y2)', () => {
  const segs = generateBolt(100, 0, 300, 500, { rng: makeRng() });
  const trunk = segs.filter((s) => s.depth === 0);
  assert.ok(trunk.length >= 1);
  assert.equal(trunk[0].x1, 100);
  assert.equal(trunk[0].y1, 0);
  assert.equal(trunk[trunk.length - 1].x2, 300);
  assert.equal(trunk[trunk.length - 1].y2, 500);
});

test('con branchChance 1 hay al menos una rama', () => {
  const segs = generateBolt(0, 0, 0, 400, { rng: makeRng(7), branchChance: 1 });
  assert.ok(segs.some((s) => s.depth >= 1));
});

test('ningun valor es NaN', () => {
  const segs = generateBolt(10, 10, 200, 600, { rng: makeRng(99), branchChance: 0.5, detail: 5, jitter: 0.4 });
  for (const s of segs) {
    for (const k of ['x1', 'y1', 'x2', 'y2', 'depth']) {
      assert.ok(Number.isFinite(s[k]), `${k} no finito`);
    }
  }
});

test('segmento de longitud cero no produce NaN', () => {
  const segs = generateBolt(5, 5, 5, 5, { rng: makeRng() });
  for (const s of segs) {
    for (const k of ['x1', 'y1', 'x2', 'y2']) assert.ok(Number.isFinite(s[k]));
  }
});

test('createFlashLimiter(3): ventana deslizante de 1000 ms', () => {
  const l = createFlashLimiter(3);
  assert.equal(l.tryFlash(0), true);
  assert.equal(l.tryFlash(100), true);
  assert.equal(l.tryFlash(200), true);
  assert.equal(l.tryFlash(300), false);
  assert.equal(l.tryFlash(1100), true);
});

test('un flash rechazado no se registra', () => {
  const l = createFlashLimiter(1);
  assert.equal(l.tryFlash(0), true);
  assert.equal(l.tryFlash(500), false);
  assert.equal(l.tryFlash(1000), true);
});
