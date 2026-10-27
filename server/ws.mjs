// A minimal RFC 6455 WebSocket, Node builtins only (spec 2026-10-01 B: the relay has no dependencies). Enough for the
// relay and its tests: the opening handshake (server and client side), text and binary messages, fragmentation,
// ping/pong, close, masking, and a cap on a message's size. No extensions (no permessage-deflate: RSV bits must be 0)
// and no subprotocols. Node 18 has no WebSocket client, so the tests use connectWs().
import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import https from 'node:https';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const OP = { CONT: 0, TEXT: 1, BINARY: 2, CLOSE: 8, PING: 9, PONG: 10 };
export const CLOSE = { NORMAL: 1000, GOING_AWAY: 1001, PROTOCOL: 1002, DATA: 1003, BAD_DATA: 1007, POLICY: 1008,
  TOO_BIG: 1009, ERROR: 1011 };
export const MAX_MESSAGE = 64 * 1024;

export const acceptKey = (key) => createHash('sha1').update(key + GUID).digest('base64');

// One frame's bytes. mask: a client's frames are masked (RFC 6455 5.3), a server's never.
export function encodeFrame(opcode, payload = Buffer.alloc(0), { mask = false, fin = true } = {}) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const n = data.length;
  const ext = n < 126 ? 0 : n < 65536 ? 2 : 8;
  const head = Buffer.alloc(2 + ext + (mask ? 4 : 0));
  head[0] = (fin ? 0x80 : 0) | opcode;
  head[1] = (mask ? 0x80 : 0) | (ext === 0 ? n : ext === 2 ? 126 : 127);
  if (ext === 2) head.writeUInt16BE(n, 2);
  else if (ext === 8) head.writeBigUInt64BE(BigInt(n), 2);
  if (!mask) return Buffer.concat([head, data]);
  const key = randomBytes(4);
  key.copy(head, 2 + ext);
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) out[i] = data[i] ^ key[i & 3];
  return Buffer.concat([head, out]);
}

class ProtocolError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Frames in, messages out. masked: whether the peer must mask (a server's peer does, a client's must not).
export class FrameReader {
  constructor({ masked, maxMessage = MAX_MESSAGE }) {
    this.masked = masked;
    this.maxMessage = maxMessage;
    this.buf = Buffer.alloc(0);
    this.parts = null;       // a fragmented message's pieces so far
    this.partsLen = 0;
    this.partsOp = 0;
    this.text = new TextDecoder('utf-8', { fatal: true });
  }

  // Returns the frames that became whole: [{ op, data }] with data a string for text, a Buffer otherwise. Throws a
  // ProtocolError (with its close code) on a broken frame.
  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const out = [];
    for (;;) {
      const f = this.#frame();
      if (!f) break;
      const m = this.#message(f);
      if (m) out.push(m);
    }
    return out;
  }

  #frame() {
    const b = this.buf;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
    if (b[0] & 0x70) throw new ProtocolError(CLOSE.PROTOCOL, 'reserved bits set');
    if (masked !== this.masked) throw new ProtocolError(CLOSE.PROTOCOL, masked ? 'a server frame was masked' : 'a client frame was not masked');
    let n = b[1] & 0x7f, at = 2;
    if (n === 126) {
      if (b.length < 4) return null;
      n = b.readUInt16BE(2); at = 4;
    } else if (n === 127) {
      if (b.length < 10) return null;
      const big = b.readBigUInt64BE(2);
      if (big > BigInt(this.maxMessage)) throw new ProtocolError(CLOSE.TOO_BIG, 'message too big');
      n = Number(big); at = 10;
    }
    if (op >= 8 && (n > 125 || !fin)) throw new ProtocolError(CLOSE.PROTOCOL, 'bad control frame');
    if (n > this.maxMessage) throw new ProtocolError(CLOSE.TOO_BIG, 'message too big');
    const need = at + (masked ? 4 : 0) + n;
    if (b.length < need) return null;
    let data = b.subarray(at + (masked ? 4 : 0), need);
    if (masked) {
      const key = b.subarray(at, at + 4), out = Buffer.alloc(n);
      for (let i = 0; i < n; i++) out[i] = data[i] ^ key[i & 3];
      data = out;
    } else {
      data = Buffer.from(data);       // off the buffer that is sliced away below
    }
    this.buf = b.subarray(need);
    return { fin, op, data };
  }

  #message({ fin, op, data }) {
    if (op >= 8) {
      if (op !== OP.CLOSE && op !== OP.PING && op !== OP.PONG) throw new ProtocolError(CLOSE.PROTOCOL, `unknown opcode ${op}`);
      return { op, data };
    }
    if (op === OP.CONT) {
      if (!this.parts) throw new ProtocolError(CLOSE.PROTOCOL, 'a continuation without a message');
    } else if (op === OP.TEXT || op === OP.BINARY) {
      if (this.parts) throw new ProtocolError(CLOSE.PROTOCOL, 'a new message inside a fragmented one');
      this.parts = []; this.partsLen = 0; this.partsOp = op;
    } else {
      throw new ProtocolError(CLOSE.PROTOCOL, `unknown opcode ${op}`);
    }
    this.partsLen += data.length;
    if (this.partsLen > this.maxMessage) throw new ProtocolError(CLOSE.TOO_BIG, 'message too big');
    this.parts.push(data);
    if (!fin) return null;
    const whole = this.parts.length === 1 ? this.parts[0] : Buffer.concat(this.parts);
    const mop = this.partsOp;
    this.parts = null;
    if (mop === OP.BINARY) return { op: mop, data: whole };
    try { return { op: mop, data: this.text.decode(whole) }; } catch {
      throw new ProtocolError(CLOSE.BAD_DATA, 'text that is not UTF-8');
    }
  }
}

// One open WebSocket over a socket. Events: 'message' (string | Buffer), 'pong', 'close' ({ code, reason }), once.
export class WsConnection extends EventEmitter {
  constructor(socket, { client = false, maxMessage = MAX_MESSAGE, head = null } = {}) {
    super();
    this.socket = socket;
    this.client = client;
    this.reader = new FrameReader({ masked: !client, maxMessage });
    this.open = true;
    this.closeSent = false;
    this.lastSeen = Date.now();
    socket.setNoDelay?.(true);
    socket.on('data', (chunk) => this.#data(chunk));
    socket.on('error', () => this.#gone(CLOSE.GOING_AWAY, 'socket error'));
    socket.on('close', () => this.#gone(CLOSE.GOING_AWAY, 'socket closed'));
    // Konsol: en http-servers sockets er halvåbne (allowHalfOpen), så en browser, der lukker (FIN), giver kun 'end'
    // og aldrig 'close'. Uden denne linje blev en telefon, der forsvandt, først opdaget af idle-tjekket (45 s).
    socket.on('end', () => { this.#gone(CLOSE.GOING_AWAY, 'socket ended'); socket.destroy(); });
    if (head && head.length) queueMicrotask(() => this.#data(head));
  }

  // Bytes written but not yet taken by the peer (the relay cuts a connection that stops reading).
  get buffered() { return this.socket.writableLength; }

  send(data) {
    if (!this.open || this.closeSent) return false;
    const op = typeof data === 'string' ? OP.TEXT : OP.BINARY;
    this.socket.write(encodeFrame(op, data, { mask: this.client }));
    return true;
  }

  ping(data = Buffer.alloc(0)) {
    if (this.open && !this.closeSent) this.socket.write(encodeFrame(OP.PING, data, { mask: this.client }));
  }

  // The closing handshake: our close frame, and the socket ends once the peer's comes back (or after a second).
  close(code = CLOSE.NORMAL, reason = '') {
    if (!this.open || this.closeSent) return;
    this.closeSent = true;
    const r = Buffer.from(String(reason).slice(0, 100));
    const p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code, 0);
    r.copy(p, 2);
    try { this.socket.write(encodeFrame(OP.CLOSE, p, { mask: this.client })); } catch { /* gone */ }
    const t = setTimeout(() => this.socket.destroy(), 1000);
    t.unref?.();
    this.#gone(code, reason, false);
  }

  // No handshake: the socket is simply cut (a dead peer, a misbehaving one).
  terminate() {
    this.socket.destroy();
    this.#gone(CLOSE.GOING_AWAY, 'terminated');
  }

  #data(chunk) {
    if (!this.open && !this.closeSent) return;
    this.lastSeen = Date.now();
    let frames;
    try { frames = this.reader.push(chunk); } catch (e) {
      this.close(e.code || CLOSE.PROTOCOL, e.message);
      return;
    }
    for (const f of frames) {
      if (f.op === OP.PING) { this.socket.write(encodeFrame(OP.PONG, f.data, { mask: this.client })); continue; }
      if (f.op === OP.PONG) { this.emit('pong'); continue; }
      if (f.op === OP.CLOSE) {
        const code = f.data.length >= 2 ? f.data.readUInt16BE(0) : CLOSE.NORMAL;
        if (this.closeSent) { this.socket.end(); return; }
        this.close(code, 'closed by the peer');
        this.socket.end();
        return;
      }
      if (this.open) this.emit('message', f.data);
    }
  }

  #gone(code, reason, destroy = true) {
    if (!this.open) { if (destroy) this.socket.destroy(); return; }
    this.open = false;
    this.emit('close', { code, reason });
  }
}

const bad = (socket, status, text) => {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
  return null;
};

// The server side of the opening handshake, for an http(s) server's 'upgrade' event. A request that is not a
// WebSocket handshake gets a 400 and its socket closed; returns the connection or null.
export function acceptUpgrade(req, socket, head, { maxMessage = MAX_MESSAGE } = {}) {
  const key = req.headers['sec-websocket-key'];
  const upgrade = String(req.headers.upgrade || '').toLowerCase();
  const connection = String(req.headers.connection || '').toLowerCase().split(/\s*,\s*/);
  if (req.method !== 'GET' || upgrade !== 'websocket' || !connection.includes('upgrade')
      || req.headers['sec-websocket-version'] !== '13' || typeof key !== 'string'
      || Buffer.from(key, 'base64').length !== 16) {
    return bad(socket, 400, 'Bad Request');
  }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
    + `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`);
  return new WsConnection(socket, { client: false, maxMessage, head });
}

// A client (tests and tools): resolves with an open WsConnection, rejects when the server says no.
export function connectWs(url, { maxMessage = MAX_MESSAGE, headers = {}, rejectUnauthorized = true } = {}) {
  const u = new URL(url);
  const secure = u.protocol === 'wss:' || u.protocol === 'https:';
  const key = randomBytes(16).toString('base64');
  return new Promise((resolve, reject) => {
    const req = (secure ? https : http).request({
      host: u.hostname, port: u.port || (secure ? 443 : 80), path: u.pathname + u.search, method: 'GET',
      rejectUnauthorized,
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key, ...headers },
    });
    req.on('upgrade', (res, socket, head) => {
      if (res.headers['sec-websocket-accept'] !== acceptKey(key)) {
        socket.destroy();
        reject(new Error('the server answered with the wrong accept key'));
        return;
      }
      resolve(new WsConnection(socket, { client: true, maxMessage, head }));
    });
    req.on('response', (res) => { res.resume(); reject(new Error(`the server said ${res.statusCode}`)); });
    req.on('error', reject);
    req.end();
  });
}
