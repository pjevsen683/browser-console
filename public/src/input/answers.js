// Beskeder fra en telefon på ctl-kanalen (svar fra layouts, tegnestrøg, tryk i Dance Beat, pong), renset. Alt andet -> null.
// Ren logik (test/answers.test.js).
export const MAX_TEXT = 40;       // et skrevet svar
export const MAX_POINTS = 64;     // punkter i ét tegnestrøg
export const MAX_CHOICE = 11;     // højeste knap-indeks (12 knapper: stem på en af 11 andre)

const unit = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

export function parseCtl(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.t === 'answer') {
    const v = m.value;
    if (Number.isInteger(v)) return v >= 0 && v <= MAX_CHOICE ? { t: 'answer', value: v } : null;
    if (typeof v !== 'string') return null;
    const text = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    return text ? { t: 'answer', value: text } : null;
  }
  if (m.t === 'stroke') {
    if (m.clear === true) return { t: 'stroke', clear: true };
    const pts = m.pts;
    if (!Array.isArray(pts) || pts.length === 0 || pts.length > MAX_POINTS) return null;
    if (!pts.every((p) => Array.isArray(p) && p.length === 2 && unit(p[0]) && unit(p[1]))) return null;
    const out = { t: 'stroke', pts: pts.map(([x, y]) => [x, y]) };
    if (typeof m.ar === 'number' && m.ar >= 0.3 && m.ar <= 4) out.ar = m.ar;     // lærredets bredde/højde
    return out;
  }
  if (m.t === 'tap') {                                                       // Dance Beat: bane og konsollens tid
    if (!Number.isInteger(m.lane) || m.lane < 0 || m.lane > 3) return null;
    return Number.isFinite(m.at) ? { t: 'tap', lane: m.lane, at: m.at } : { t: 'tap', lane: m.lane };
  }
  if (m.t === 'pong') return Number.isFinite(m.at) ? { t: 'pong', at: m.at } : null;
  return null;
}
