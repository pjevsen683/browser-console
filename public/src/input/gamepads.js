// Bluetooth-controllere via Gamepad-API'et (højst 4 -- browserens loft). Standard-mapping: venstre pind eller d-pad,
// knap 0 = A, knap 1 = B. En controller er med, når den har trykket A i lobbyen.
import { normStick } from './normalize.js';

const on = (b, i) => (b[i]?.pressed ? 1 : 0);

export function readPad(gp) {
  const b = gp.buttons ?? [];
  let x = gp.axes?.[0] ?? 0, y = gp.axes?.[1] ?? 0;
  const dx = on(b, 15) - on(b, 14), dy = on(b, 13) - on(b, 12);
  if (dx || dy) { x = dx; y = dy; }
  const s = normStick(x, y);
  return { x: s.x, y: s.y, a: on(b, 0), b: on(b, 1) };
}

export function pollGamepads(roster, now, { allowJoin }) {
  const pads = navigator.getGamepads?.() ?? [];
  const seen = new Set();
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    const id = `pad:${gp.index}`;
    seen.add(id);
    const inp = readPad(gp);
    if (!roster.get(id)) {
      if (!allowJoin || !inp.a) continue;
      const p = roster.add({ id, name: `Controller ${gp.index + 1}`, source: 'pad' }, now);
      if (!p) continue;
      p.raw.a = 1;                               // trykket, der tilmeldte, er ikke også "klar"
    }
    roster.setInput(id, inp, now);
  }
  for (const p of roster.list()) {
    if (p.source === 'pad' && p.connected && !seen.has(p.id)) roster.setConnected(p.id, false, now);
  }
}
