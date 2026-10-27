// Konsollens signalserver (spec 2026-10-16, *Netværk*): rum pr. kode med én konsol og op til 12 controllere. Den
// videresender WebRTC-håndtrykket (signal) og, som reserve, input og beskeder (relay) uden at læse dem. Den husker
// intet på disk; en genstart lukker rummene, og konsol og controllere forbinder selv igen. Kun Node-builtins.
import http from 'node:http';
import { randomInt } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { acceptUpgrade, CLOSE } from './ws.mjs';

export const LIMITS = {
  pads: 12,               // controllere (telefoner) i ét rum
  pids: 50,               // forskellige telefoner, et rum husker i sin levetid
  rooms: 100,
  maxMessage: 4096,       // et SDP-tilbud til en datakanal er ~600 bytes
  rate: 120,              // beskeder pr. sekund pr. forbindelse: 30 Hz input + knapskift + håndtryk
  hostGoneMs: 60_000,     // så længe venter et rum på, at konsollen kommer tilbage
  pingMs: 20_000,
  idleMs: 45_000,
  conns: 500,             // forbindelser i alt: serveren er offentlig
};
export const PATH = '/ws';
export const HEALTH = '/health';
export const NAME_MAX = 12;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';     // intet I eller O: læses højt i stuen
export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
const PID_RE = /^[A-Za-z0-9_-]{8,32}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NAME_MAX);

export function createSignal({ origins = [], limits: over = {} } = {}) {
  const limits = { ...LIMITS, ...over };
  const rooms = new Map();
  const conns = new Set();

  const send = (conn, msg) => { if (conn?.open) conn.send(JSON.stringify(msg)); };
  const fail = (conn, error) => send(conn, { t: 'error', error });

  function newCode() {
    for (let i = 0; i < 1000; i++) {
      let c = '';
      for (let j = 0; j < 4; j++) c += ALPHABET[randomInt(ALPHABET.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  }

  function closeRoom(room) {
    clearTimeout(room.hostGoneTimer);
    rooms.delete(room.code);
    for (const p of room.pads.values()) {
      p.conn.room = null;
      fail(p.conn, 'no-room');
      p.conn.close(CLOSE.NORMAL, 'room closed');
    }
  }

  function host(conn, msg) {
    if (conn.role) return fail(conn, 'bad-message');
    // token: konsol-telefonens eget hemmelige id (localStorage). Samme token = samme konsol, som må overtage sit rum,
    // også når den gamle forbindelse endnu ikke er opdaget død; en anden token får aldrig rummet.
    const token = TOKEN_RE.test(String(msg.token ?? '')) ? msg.token : null;
    let room = CODE_RE.test(msg.code) ? rooms.get(msg.code) : null;
    if (room?.token && room.token !== token) room = null;
    if (room?.host && !room.token) room = null;  // en anden konsol har koden: denne får en ny
    if (room?.host) {
      const old = room.host;
      old.room = null;                           // dens 'close' må ikke melde konsollen væk
      fail(old, 'replaced');
      old.close(CLOSE.NORMAL, 'replaced');
      room.host = null;
    }
    if (!room) {
      if (rooms.size >= limits.rooms) return fail(conn, 'busy');
      const code = CODE_RE.test(msg.code) && !rooms.has(msg.code) ? msg.code : newCode();
      if (!code) return fail(conn, 'busy');
      room = { code, token, host: null, pads: new Map(), pids: new Map(), nextPeer: 1, hostGoneTimer: null };
      rooms.set(code, room);
    }
    clearTimeout(room.hostGoneTimer);
    room.host = conn;
    conn.role = 'host';
    conn.room = room;
    send(conn, { t: 'room', code: room.code });
    for (const [peer, p] of room.pads) {
      send(conn, { t: 'peer-join', peer, pid: p.pid, name: p.name });
      send(p.conn, { t: 'host-back' });
    }
  }

  function join(conn, msg) {
    if (conn.role) return fail(conn, 'bad-message');
    const room = rooms.get(String(msg.code ?? '').toUpperCase());
    if (!room) return fail(conn, 'no-room');
    const name = cleanName(msg.name);
    if (!name) return fail(conn, 'bad-name');
    if (!PID_RE.test(String(msg.pid ?? ''))) return fail(conn, 'bad-message');
    let peer = room.pids.get(msg.pid);
    const old = peer !== undefined ? room.pads.get(peer) : null;
    if (old) {
      old.conn.room = null;                      // dens 'close' må ikke melde spilleren væk
      fail(old.conn, 'replaced');                // den gamle fane skal stoppe, ikke forbinde igen og slås om pladsen
      old.conn.close(CLOSE.NORMAL, 'replaced');
    } else if (room.pads.size >= limits.pads) {
      return fail(conn, 'full');
    }
    if (peer === undefined) {
      if (room.pids.size >= limits.pids) return fail(conn, 'full');
      peer = room.nextPeer++;
      room.pids.set(msg.pid, peer);
    }
    room.pads.set(peer, { conn, pid: msg.pid, name });
    conn.role = 'pad';
    conn.room = room;
    conn.peer = peer;
    send(conn, { t: 'joined', peer, code: room.code, host: !!room.host });
    send(room.host, { t: 'peer-join', peer, pid: msg.pid, name });
  }

  function forward(conn, msg) {
    const room = conn.room;
    if (!room) return fail(conn, 'bad-message');
    if (conn.role === 'host') {
      const p = room.pads.get(msg.to);
      if (p) send(p.conn, { t: msg.t, data: msg.data });
    } else {
      send(room.host, { t: msg.t, from: conn.peer, data: msg.data });
    }
  }

  function leave(conn) {
    conns.delete(conn);
    const room = conn.room;
    if (!room) return;
    conn.room = null;
    if (conn.role === 'host') {
      room.host = null;
      for (const p of room.pads.values()) send(p.conn, { t: 'host-gone' });
      room.hostGoneTimer = setTimeout(() => closeRoom(room), limits.hostGoneMs);
      room.hostGoneTimer.unref?.();
    } else if (room.pads.get(conn.peer)?.conn === conn) {
      room.pads.delete(conn.peer);
      send(room.host, { t: 'peer-leave', peer: conn.peer });
    }
  }

  function onConnection(conn) {
    conns.add(conn);
    conn.role = null;
    conn.room = null;
    conn.win = 0;
    conn.winStart = Date.now();
    conn.on('message', (raw) => {
      const now = Date.now();
      if (now - conn.winStart >= 1000) { conn.winStart = now; conn.win = 0; }
      if (++conn.win > limits.rate) return;      // for mange: smides væk, forbindelsen lever
      let msg;
      try { msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')); } catch { return fail(conn, 'bad-message'); }
      if (!msg || typeof msg !== 'object') return fail(conn, 'bad-message');
      try {
        if (msg.t === 'host') host(conn, msg);
        else if (msg.t === 'join') join(conn, msg);
        else if (msg.t === 'signal' || msg.t === 'relay') forward(conn, msg);
        else fail(conn, 'bad-message');
      } catch { fail(conn, 'bad-message'); }
    });
    conn.on('close', () => leave(conn));
  }

  function handleUpgrade(req, socket, head) {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname !== PATH) { socket.destroy(); return; }
    if (conns.size >= limits.conns) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return;
    }
    if (origins.length && !origins.includes(req.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return;
    }
    const conn = acceptUpgrade(req, socket, head, { maxMessage: limits.maxMessage });
    if (conn) onConnection(conn);
  }

  const timer = setInterval(() => {
    const now = Date.now();
    for (const c of conns) { if (now - c.lastSeen > limits.idleMs) c.terminate(); else c.ping(); }
  }, limits.pingMs);
  timer.unref?.();

  return {
    handleUpgrade,
    rooms,
    stop() { clearInterval(timer); for (const c of conns) c.terminate(); for (const r of rooms.values()) clearTimeout(r.hostGoneTimer); },
  };
}

export function createSignalServer(opts) {
  const signal = createSignal(opts);
  const server = http.createServer((req, res) => {
    if (req.url === HEALTH) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, rooms: signal.rooms.size }));
    }
    res.writeHead(404);
    res.end();
  });
  server.on('upgrade', (req, socket, head) => signal.handleUpgrade(req, socket, head));
  // En opgraderet socket er ikke længere http-serverens, og server.close() venter på den: skær dem først.
  const close = server.close.bind(server);
  server.close = (cb) => { signal.stop(); return close(cb); };
  return server;
}

// Containeren: node signal.mjs
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const PORT = Number(process.env.PORT) || 3260;
  const origins = (process.env.ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  createSignalServer({ origins }).listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`konsol-signal på ${PORT}`));
}
