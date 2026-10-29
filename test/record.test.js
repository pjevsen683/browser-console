import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecord } from '../public/src/games/common/record.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('en ny rekord gemmes, en lavere gør ikke', () => {
  const store = memStore();
  const r = createRecord('stack', store);
  assert.equal(r.best, 0);
  assert.equal(r.submit(12), true);
  assert.equal(createRecord('stack', store).best, 12);
  assert.equal(createRecord('stack', store).submit(12), false);
  assert.equal(createRecord('waves', store).best, 0);
});

test('en lagring, der kaster (privat fane), giver ingen rekord, men ingen fejl', () => {
  const bad = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); } };
  const r = createRecord('stack', bad);
  assert.equal(r.best, 0);
  assert.equal(r.submit(5), true);
  assert.equal(createRecord('stack', undefined).best, 0);
});
