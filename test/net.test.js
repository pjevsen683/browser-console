// Browserens netværksmoduler med falske WebSocket og RTCPeerConnection: de tilfælde, e2e-testen ikke kan fremkalde
// (en død forbindelse, der stadig ser åben ud; en fane, der er overtaget; en signalserver, der genstarter).
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeWS {
  static all = [];
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; FakeWS.all.push(this); }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  recv(m) { this.onmessage?.({ data: JSON.stringify(m) }); }
}
class FakePC {
  static all = [];
  constructor() { this.connectionState = 'new'; this.channels = []; this.closed = false; FakePC.all.push(this); }
  createDataChannel(label) {
    const ch = { label, readyState: 'connecting', sent: [], send(s) { this.sent.push(s); } };
    this.channels.push(ch);
    return ch;
  }
  async createOffer() { return { type: 'offer', sdp: 'o' }; }
  async createAnswer() { return { type: 'answer', sdp: 'a' }; }
  async setLocalDescription(d) { this.localDescription = { ...d, toJSON: () => ({ type: d.type, sdp: d.sdp }) }; }
  async setRemoteDescription(d) { this.remoteDescription = d; }
  async addIceCandidate() {}
  close() { this.closed = true; this.connectionState = 'closed'; }
}
globalThis.WebSocket = FakeWS;
globalThis.RTCPeerConnection = FakePC;
const { HostNet } = await import('../public/src/net/host-net.js');
const { PadNet } = await import('../public/src/net/pad-net.js');
const flush = () => new Promise((r) => setImmediate(r));

function host() {
  FakeWS.all.length = 0; FakePC.all.length = 0;
  const log = { link: [], status: [] };
  const net = new HostNet({
    url: 'ws://x/ws', code: null, token: 'tok-aaaaaaaa',
    onRoom() {}, onStatus: (s) => log.status.push(s), onJoin() {}, onLeave() {}, onInput() {},
    onLink: (peer, l) => log.link.push([peer, l]),
  });
  const ws = FakeWS.all[0];
  ws.open();
  return { net, ws, log };
}

test('konsollen sender sin token med, når den beder om et rum', () => {
  const { ws } = host();
  assert.deepEqual(ws.sent[0], { t: 'host', token: 'tok-aaaaaaaa' });
});

test('en controller, der beder om nyt tilbud, får det, selv om konsollens gamle forbindelse ser åben ud', async () => {
  const { ws } = host();
  ws.recv({ t: 'peer-join', peer: 1, pid: 'p', name: 'A' });
  await flush();
  const first = FakePC.all[0];
  first.channels[0].readyState = 'open';           // døde kanaler kan blive stående 'open' i op til 30 s
  ws.recv({ t: 'relay', from: 1, data: { k: 'reoffer' } });
  await flush();
  assert.equal(FakePC.all.length, 2);
  assert.equal(first.closed, true);
});

test('når konsollens WebRTC-forbindelse fejler, går beskeder til den telefon via serveren', async () => {
  const { net, ws, log } = host();
  ws.recv({ t: 'peer-join', peer: 1, pid: 'p', name: 'A' });
  await flush();
  const pc = FakePC.all[0];
  pc.channels.forEach((c) => { c.readyState = 'open'; });
  pc.connectionState = 'failed';
  pc.onconnectionstatechange();
  assert.deepEqual(log.link.at(-1), [1, 'relay']);
  ws.sent.length = 0;
  net.send(1, { t: 'buzz', ms: 50 });
  assert.equal(ws.sent[0]?.t, 'relay');
  assert.equal(pc.channels[1].sent.length, 0);
});

test('en konsol, der er overtaget af en nyere fane, stopper og forbinder ikke igen', () => {
  const { net, ws, log } = host();
  ws.recv({ t: 'error', error: 'replaced' });
  assert.equal(net.sig.stopped, true);
  assert.equal(log.status.at(-1), 'replaced');
});

function pad() {
  FakeWS.all.length = 0;
  const log = { state: [] };
  const net = new PadNet({ url: 'ws://x/ws', code: 'ABCD', name: 'A', pid: 'pid-aaaaaaaa', onState: (s) => log.state.push(s), onCtl() {} });
  const ws = FakeWS.all[0];
  ws.open();
  return { net, ws, log };
}

test('en controller-fane, der er overtaget af en anden fane, stopper', () => {
  const { net, ws, log } = pad();
  ws.recv({ t: 'error', error: 'replaced' });
  assert.deepEqual(log.state.at(-1), { error: 'replaced' });
  assert.equal(net.sig.stopped, true);
  net.stop();
});

test('no-room lige efter en genstart af serveren er forbigående for en controller, der var med', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const { net, ws, log } = pad();
  ws.recv({ t: 'joined', peer: 1, code: 'ABCD', host: true });
  ws.recv({ t: 'error', error: 'no-room' });
  assert.equal(log.state.some((s) => s?.error), false);
  ws.sent.length = 0;
  t.mock.timers.tick(2000);
  assert.equal(ws.sent.at(-1)?.t, 'join');
  t.mock.timers.tick(40_000);
  ws.recv({ t: 'error', error: 'no-room' });         // efter 30 s giver den op
  assert.deepEqual(log.state.at(-1), { error: 'no-room' });
  net.stop();
});

test('no-room for en controller, der aldrig var med, er en rigtig fejl', () => {
  const { net, ws, log } = pad();
  ws.recv({ t: 'error', error: 'no-room' });
  assert.deepEqual(log.state.at(-1), { error: 'no-room' });
  net.stop();
});

test('konsollen får beskeder fra telefonen på ctl-kanalen og via serveren', async () => {
  FakeWS.all.length = 0; FakePC.all.length = 0;
  const got = [];
  const net = new HostNet({ url: 'ws://x/ws', onRoom() {}, onStatus() {}, onJoin() {}, onLeave() {}, onInput() {}, onLink() {},
    onCtl: (peer, m) => got.push([peer, m]) });
  const ws = FakeWS.all[0];
  ws.open();
  ws.recv({ t: 'peer-join', peer: 2, pid: 'p', name: 'B' });
  await flush();
  FakePC.all[0].channels[1].onmessage({ data: JSON.stringify({ t: 'answer', value: 1 }) });
  ws.recv({ t: 'relay', from: 2, data: { k: 'ctl', m: { t: 'pong', at: 5 } } });
  assert.deepEqual(got, [[2, { t: 'answer', value: 1 }], [2, { t: 'pong', at: 5 }]]);
  net.sig.stop();
});

test('telefonen sender ctl over kanalen, når den er åben, og ellers via serveren', () => {
  const { net, ws } = pad();
  ws.recv({ t: 'joined', peer: 1, code: 'ABCD', host: true });
  ws.sent.length = 0;
  net.sendCtl({ t: 'answer', value: 2 });
  assert.deepEqual(ws.sent[0], { t: 'relay', data: { k: 'ctl', m: { t: 'answer', value: 2 } } });
  const ch = { label: 'ctl', readyState: 'open', sent: [], send(s) { this.sent.push(s); } };
  net.channel(ch);
  net.sendCtl({ t: 'pong', at: 1 });
  assert.deepEqual(JSON.parse(ch.sent[0]), { t: 'pong', at: 1 });
  net.stop();
});

test('datakanalerne afviser for store beskeder og for mange pr. sekund', async () => {
  FakeWS.all.length = 0; FakePC.all.length = 0;
  const ctl = [], inp = [];
  const net = new HostNet({ url: 'ws://x/ws', onRoom() {}, onStatus() {}, onJoin() {}, onLeave() {}, onLink() {},
    onInput: (p, m) => inp.push(m), onCtl: (p, m) => ctl.push(m) });
  const ws = FakeWS.all[0];
  ws.open();
  ws.recv({ t: 'peer-join', peer: 3, pid: 'p', name: 'C' });
  await flush();
  const [inCh, ctlCh] = FakePC.all[0].channels;
  ctlCh.onmessage({ data: JSON.stringify({ t: 'answer', value: 'x'.repeat(5000) }) });
  assert.equal(ctl.length, 0);
  for (let i = 0; i < 200; i++) ctlCh.onmessage({ data: JSON.stringify({ t: 'pong', at: i }) });
  assert.ok(ctl.length > 10 && ctl.length <= 40, `ctl ${ctl.length}`);
  for (let i = 0; i < 500; i++) inCh.onmessage({ data: JSON.stringify({ s: i }) });
  assert.ok(inp.length > 30 && inp.length <= 90, `in ${inp.length}`);
  net.sig.stop();
});
