import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSignalServer, CODE_RE, cleanName } from '../server/signal.mjs';
import { connectWs } from '../server/ws.mjs';

async function start(opts = {}) {
  const server = createSignalServer(opts);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  const clients = [];
  return {
    async client(headers = {}) {
      const ws = await connectWs(url, { headers });
      const inbox = [], waiters = [];
      ws.on('message', (d) => {
        const m = JSON.parse(d);
        const i = waiters.findIndex((w) => w.pred(m));
        if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
      });
      const c = {
        ws,
        send: (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
        next(pred = () => true, ms = 1000) {
          const i = inbox.findIndex(pred);
          if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
          return new Promise((resolve, reject) => {
            const w = { pred, resolve };
            waiters.push(w);
            setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); reject(new Error('timeout')); } }, ms);
          });
        },
        closed: new Promise((r) => ws.on('close', r)),
      };
      clients.push(c);
      return c;
    },
    async stop() { for (const c of clients) c.ws.terminate(); await new Promise((r) => server.close(r)); },
  };
}
const is = (t) => (m) => m.t === t;
const pid = (n) => `testpid-${n}-abcdef`;

async function hostAndPad(s, name = 'Anna', n = 1) {
  const host = await s.client();
  host.send({ t: 'host' });
  const { code } = await host.next(is('room'));
  const pad = await s.client();
  pad.send({ t: 'join', code, name, pid: pid(n) });
  return { host, pad, code, joined: await pad.next(is('joined')), pj: await host.next(is('peer-join')) };
}

test('konsollen får en kode på 4 bogstaver uden I og O', async () => {
  const s = await start();
  try {
    const host = await s.client();
    host.send({ t: 'host' });
    const m = await host.next(is('room'));
    assert.match(m.code, CODE_RE);
  } finally { await s.stop(); }
});

test('en controller slutter sig til, og håndtryk går begge veje med afsender', async () => {
  const s = await start();
  try {
    const { host, pad, joined, pj } = await hostAndPad(s);
    assert.equal(joined.host, true);
    assert.deepEqual([pj.peer, pj.name, pj.pid], [joined.peer, 'Anna', pid(1)]);
    host.send({ t: 'signal', to: joined.peer, data: { sdp: 'offer' } });
    assert.deepEqual((await pad.next(is('signal'))).data, { sdp: 'offer' });
    pad.send({ t: 'signal', data: { sdp: 'answer' } });
    const back = await host.next(is('signal'));
    assert.deepEqual([back.from, back.data.sdp], [joined.peer, 'answer']);
    pad.send({ t: 'relay', data: { k: 'in', m: { s: 1 } } });
    assert.equal((await host.next(is('relay'))).data.m.s, 1);
    host.send({ t: 'relay', to: joined.peer, data: { k: 'ctl', m: { t: 'buzz' } } });
    assert.equal((await pad.next(is('relay'))).data.m.t, 'buzz');
  } finally { await s.stop(); }
});

test('forkert kode, tomt navn og affald giver fejl, men forbindelsen kan bruges bagefter', async () => {
  const s = await start();
  try {
    const c = await s.client();
    c.send({ t: 'join', code: 'ZZZZ', name: 'A', pid: pid(1) });
    assert.equal((await c.next(is('error'))).error, 'no-room');
    c.send('ikke json');
    assert.equal((await c.next(is('error'))).error, 'bad-message');
    const host = await s.client();
    host.send({ t: 'host' });
    const { code } = await host.next(is('room'));
    c.send({ t: 'join', code, name: '   ', pid: pid(1) });
    assert.equal((await c.next(is('error'))).error, 'bad-name');
    c.send({ t: 'join', code: code.toLowerCase(), name: 'Bo', pid: pid(1) });
    assert.equal((await c.next(is('joined'))).code, code);
  } finally { await s.stop(); }
});

test('navne renses: kontroltegn og <> fjernes, højst 12 tegn, æøå bevares', () => {
  assert.equal(cleanName('  <b>Søs</b>\n '), 'bSøs/b');
  assert.equal(cleanName('abcdefghijklmnop'), 'abcdefghijkl');
  assert.equal(cleanName(null), '');
});

test('den 13. controller afvises, men en kendt pid kommer ind igen og overtager sin plads', async () => {
  const s = await start();
  try {
    const host = await s.client();
    host.send({ t: 'host' });
    const { code } = await host.next(is('room'));
    const pads = [];
    for (let i = 0; i < 12; i++) {
      const p = await s.client();
      p.send({ t: 'join', code, name: `P${i}`, pid: pid(i) });
      pads.push({ c: p, j: await p.next(is('joined')) });
    }
    const extra = await s.client();
    extra.send({ t: 'join', code, name: 'X', pid: pid(99) });
    assert.equal((await extra.next(is('error'))).error, 'full');
    const again = await s.client();
    again.send({ t: 'join', code, name: 'P3', pid: pid(3) });
    assert.equal((await again.next(is('joined'))).peer, pads[3].j.peer);
    await pads[3].c.closed;                       // den gamle forbindelse lukkes
    const pj = await host.next((m) => m.t === 'peer-join' && m.pid === pid(3) && m.peer === pads[3].j.peer);
    assert.ok(pj);
  } finally { await s.stop(); }
});

test('konsollen genindlæses: samme kode, og den får peer-join for dem, der venter', async () => {
  const s = await start();
  try {
    const { host, pad, code, joined } = await hostAndPad(s);
    host.ws.terminate();
    await pad.next(is('host-gone'));
    const host2 = await s.client();
    host2.send({ t: 'host', code });
    assert.equal((await host2.next(is('room'))).code, code);
    assert.equal((await host2.next(is('peer-join'))).peer, joined.peer);
    await pad.next(is('host-back'));
  } finally { await s.stop(); }
});

test('en anden konsol med en optaget kode får en ny kode', async () => {
  const s = await start();
  try {
    const a = await s.client();
    a.send({ t: 'host' });
    const { code } = await a.next(is('room'));
    const b = await s.client();
    b.send({ t: 'host', code });
    const m = await b.next(is('room'));
    assert.notEqual(m.code, code);
  } finally { await s.stop(); }
});

test('rummet nedlægges, når konsollen har været væk for længe', async () => {
  const s = await start({ limits: { hostGoneMs: 50 } });
  try {
    const { host, pad } = await hostAndPad(s);
    host.ws.terminate();
    assert.equal((await pad.next(is('error'))).error, 'no-room');
  } finally { await s.stop(); }
});

test('en controller, der går, meldes til konsollen', async () => {
  const s = await start();
  try {
    const { host, pad, joined } = await hostAndPad(s);
    pad.ws.terminate();
    assert.equal((await host.next(is('peer-leave'))).peer, joined.peer);
  } finally { await s.stop(); }
});

test('ORIGINS: en fremmed side kan ikke åbne en forbindelse', async () => {
  const s = await start({ origins: ['https://konsol.mobil.peter87.dk'] });
  try {
    await assert.rejects(s.client({ Origin: 'https://evil.example' }), /403/);
    const ok = await s.client({ Origin: 'https://konsol.mobil.peter87.dk' });
    ok.send({ t: 'host' });
    assert.match((await ok.next(is('room'))).code, CODE_RE);
  } finally { await s.stop(); }
});

test('samme konsol (samme token) overtager sit rum, selv om den gamle forbindelse ikke er opdaget død', async () => {
  const s = await start();
  try {
    const a = await s.client();
    a.send({ t: 'host', token: 'tok-aaaaaaaa' });
    const { code } = await a.next(is('room'));
    const pad = await s.client();
    pad.send({ t: 'join', code, name: 'Bo', pid: pid(1) });
    const { peer } = await pad.next(is('joined'));
    const b = await s.client();
    b.send({ t: 'host', code, token: 'tok-aaaaaaaa' });
    assert.equal((await b.next(is('room'))).code, code);
    assert.equal((await b.next(is('peer-join'))).peer, peer);
    assert.equal((await a.next(is('error'))).error, 'replaced');
    pad.send({ t: 'relay', data: { k: 'in', m: { s: 1 } } });
    assert.equal((await b.next(is('relay'))).from, peer);
  } finally { await s.stop(); }
});

test('en anden token får en ny kode, også når rummet venter på sin konsol', async () => {
  const s = await start();
  try {
    const a = await s.client();
    a.send({ t: 'host', token: 'tok-aaaaaaaa' });
    const { code } = await a.next(is('room'));
    a.ws.terminate();
    await new Promise((r) => setTimeout(r, 20));
    const b = await s.client();
    b.send({ t: 'host', code, token: 'tok-bbbbbbbb' });
    assert.notEqual((await b.next(is('room'))).code, code);
  } finally { await s.stop(); }
});

test('den gamle fane med samme pid får besked om, at den er overtaget', async () => {
  const s = await start();
  try {
    const { code, pad } = await hostAndPad(s);
    const again = await s.client();
    again.send({ t: 'join', code, name: 'Anna', pid: pid(1) });
    await again.next(is('joined'));
    assert.equal((await pad.next(is('error'))).error, 'replaced');
  } finally { await s.stop(); }
});

test('loft over forbindelser: den næste får 503', async () => {
  const s = await start({ limits: { conns: 2 } });
  try {
    await s.client();
    await s.client();
    await assert.rejects(s.client(), /503/);
  } finally { await s.stop(); }
});
