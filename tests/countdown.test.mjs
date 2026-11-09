import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TARGET, getRemaining } from '../js/countdown.js';

test('TARGET es 2026-12-03T23:00:00Z', () => {
  assert.equal(TARGET, Date.parse('2026-12-03T23:00:00Z'));
});

test('desglosa días, horas, minutos y segundos', () => {
  const now = TARGET - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
  assert.deepEqual(getRemaining(now), { done: false, days: 2, hours: 3, minutes: 4, seconds: 5 });
});

test('now === TARGET -> done con ceros', () => {
  assert.deepEqual(getRemaining(TARGET), { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('now pasado -> done con ceros', () => {
  assert.deepEqual(getRemaining(TARGET + 1e9), { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('now NaN -> done sin NaN', () => {
  const r = getRemaining(NaN);
  assert.equal(r.done, true);
  for (const k of ['days', 'hours', 'minutes', 'seconds']) assert.equal(r[k], 0);
});
