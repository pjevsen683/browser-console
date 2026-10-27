import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiltToStick, MAX_DEG } from '../public/src/input/tilt.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('i landscape (vinkel 90) er venstre/højre beta og frem/tilbage gamma; nulpunktet trækkes fra', () => {
  const zero = { beta: 0, gamma: -40 };
  const s = tiltToStick({ beta: MAX_DEG / 2, gamma: -40 }, 90, zero);
  assert.ok(close(s.x, 0.5) && close(s.y, 0));
  const f = tiltToStick({ beta: 0, gamma: -40 - MAX_DEG / 2 }, 90, zero);
  assert.ok(close(f.x, 0) && close(f.y, 0.5), 'højre kant (= skærmens top) op: pinden mod en selv, som i portræt');
  assert.ok(close(tiltToStick({ beta: 30 - MAX_DEG / 2, gamma: 0 }, 0, { beta: 30, gamma: 0 }).y, -0.5), 'portræt: toppen væk = frem');
});

test('vendt den anden vej (vinkel 270 eller -90) er venstre og højre byttet om', () => {
  const zero = { beta: 0, gamma: 40 };
  assert.ok(close(tiltToStick({ beta: 10, gamma: 40 }, 270, zero).x, -tiltToStick({ beta: 10, gamma: -40 }, 90, { beta: 0, gamma: -40 }).x));
  assert.deepEqual(tiltToStick({ beta: 10, gamma: 40 }, -90, zero), tiltToStick({ beta: 10, gamma: 40 }, 270, zero));
});

test('i portræt er venstre/højre gamma; udslaget klippes til enhedscirklen; en lille dødzone', () => {
  const zero = { beta: 30, gamma: 0 };
  assert.ok(close(tiltToStick({ beta: 30, gamma: MAX_DEG / 2 }, 0, zero).x, 0.5));
  const big = tiltToStick({ beta: 30 + MAX_DEG * 3, gamma: MAX_DEG * 3 }, 0, zero);
  assert.ok(Math.hypot(big.x, big.y) <= 1 + 1e-9);
  assert.deepEqual(tiltToStick({ beta: 31, gamma: 1 }, 0, zero), { x: 0, y: 0 });
  assert.deepEqual(tiltToStick({ beta: null, gamma: null }, 0, zero), { x: 0, y: 0 });
});
