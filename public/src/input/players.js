// Spillerlisten: telefoner, controllere og bots som ens spillere. Ren logik (test/players.test.js).
// Et spil læser kun player.input = { x, y, a, b, aPressed, bPressed }; aPressed er sand i præcis den frame, knappen
// gik ned -- også når den gik ned og op igen mellem to frames (latch).
export const COLORS = ['#ff4d5e', '#3fa7ff', '#ffd23f', '#3ddc84', '#b469ff', '#ff8c3a', '#2ee6d6', '#ff6fcf', '#a8e05f', '#f2f2f2',
  '#c08552', '#8fa3b8'];
export const MAX_PLAYERS = 12;
export const STALE_MS = 1000;
const ZERO = { x: 0, y: 0, a: 0, b: 0 };

export function createRoster({ max = MAX_PLAYERS } = {}) {
  const list = [];
  const get = (id) => list.find((p) => p.id === id) ?? null;
  return {
    get size() { return list.length; },
    list: () => list,
    get,
    add({ id, name, source }, now = 0) {
      let p = get(id);
      if (p) {
        p.connected = true; p.goneAt = null; p.seen = now;
        p.an = p.bn = undefined;                   // en genindlæst controller tæller tryk forfra
        if (name) p.name = name;
        return p;
      }
      if (list.length >= max) return null;
      const used = new Set(list.map((q) => q.color));
      p = {
        id, name, source, color: COLORS.find((c) => !used.has(c)),
        connected: true, lost: false, goneAt: null, ready: false,
        link: source === 'pad' ? 'pad' : source === 'bot' ? 'bot' : 'relay',
        input: { ...ZERO, aPressed: false, bPressed: false },
        raw: { ...ZERO }, seen: now, lastS: -Infinity, latchA: false, latchB: false,
      };
      list.push(p);
      return p;
    },
    remove(id) {
      const i = list.findIndex((p) => p.id === id);
      if (i >= 0) list.splice(i, 1);
    },
    setConnected(id, on, now = 0) {
      const p = get(id);
      if (!p) return;
      p.connected = on;
      p.goneAt = on ? null : now;
      if (!on) p.raw = { ...ZERO };
    },
    // Ping-tid til telefonen (ms), glattet; første måling tages, som den er.
    setRtt(id, ms) {
      const p = get(id);
      if (p) p.rtt = p.rtt === undefined ? ms : p.rtt * 0.7 + ms * 0.3;
    },
    setLink(id, link) {
      const p = get(id);
      if (p) p.link = link;
    },
    setInput(id, inp, now = 0) {
      const p = get(id);
      if (!p || !inp) return false;
      if (inp.s !== undefined) {
        if (inp.s <= p.lastS) return false;
        p.lastS = inp.s;
      }
      // Trykketællere (an/bn) fra telefonen gentages i hver pakke, så et tryk, hvis eneste a:1-pakke gik tabt på den
      // upålidelige kanal, alligevel tæller. Kilder uden tællere (controllere, bots) latches på kanten.
      if (Number.isFinite(inp.an)) { if (p.an !== undefined && inp.an > p.an) p.latchA = true; p.an = inp.an; }
      else if (inp.a && !p.raw.a) p.latchA = true;
      if (Number.isFinite(inp.bn)) { if (p.bn !== undefined && inp.bn > p.bn) p.latchB = true; p.bn = inp.bn; }
      else if (inp.b && !p.raw.b) p.latchB = true;
      p.raw = { x: inp.x, y: inp.y, a: inp.a, b: inp.b };
      p.seen = now;
      if (!p.connected) { p.connected = true; p.goneAt = null; }
      return true;
    },
    frame(now) {
      for (const p of list) {
        p.lost = p.source !== 'pad' && now - p.seen > STALE_MS;
        const r = p.lost ? ZERO : p.raw;
        p.input = { x: r.x, y: r.y, a: r.a, b: r.b, aPressed: p.latchA, bPressed: p.latchB };
        p.latchA = p.latchB = false;
      }
    },
    // Kun i lobbyen: spillere, der har været frakoblet (peer-leave, controller væk) i ms. En tavs telefon er kun
    // "tabt" -- dens forbindelse kan leve videre, mens gæsten svarer en besked, og den skal have sin plads igen.
    prune(now, ms = 10_000) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (!p.connected && p.goneAt !== null && now - p.goneAt > ms) list.splice(i, 1);
      }
    },
  };
}
