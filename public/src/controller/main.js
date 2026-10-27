// Controlleren: en gæsts telefon. Flydende pind til venstre, A og B til højre. Input går til konsollen 30 gange i
// sekundet og straks ved et knaptryk. ?g=KODE udfylder koden; &name=X tilmelder med det samme; &nortc=1 tvinger
// reserven (test); &nosw=1; &ws=<url>.
import { PadNet } from '../net/pad-net.js';
import { tiltToStick } from '../input/tilt.js';

const q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* privat fane */ } },
};
let pid = store.get('konsol-pid');
if (!pid) {
  pid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
  store.set('konsol-pid', pid);
}

const ERR = { 'no-room': 'No console with that code', full: 'The game is full', 'bad-name': 'Type a name', replaced: 'You joined from another tab' };
const LINK = { connecting: 'Connecting …', 'waiting-host': 'Waiting for the console …', direct: '⚡ direct', relay: '📶 via server' };
// an/bn: antal tryk, gentaget i hver pakke -- så et tryk ikke går tabt, hvis dets ene a:1-pakke gør (players.js).
const state = { x: 0, y: 0, a: 0, b: 0, an: 0, bn: 0, color: null, link: 'connecting' };
let net = null, seq = 0;

const show = (s) => { document.body.dataset.screen = s; };
const codeIn = $('code-in'), nameIn = $('name-in');
const urlCode = (q.get('g') || '').toUpperCase();
codeIn.value = urlCode;
if (urlCode) codeIn.style.display = 'none';
nameIn.value = q.get('name') || store.get('konsol-name') || '';

function fail(text) { net?.stop(); net = null; $('msg-t').textContent = text; show('msg'); }

function join() {
  const code = codeIn.value.trim().toUpperCase(), name = nameIn.value.trim();
  if (!/^[A-Z]{4}$/.test(code)) { codeIn.style.display = ''; codeIn.focus(); return; }
  if (!name) { nameIn.focus(); return; }
  store.set('konsol-name', name);
  $('me').textContent = name;
  show('pad');
  net = new PadNet({
    url: q.get('ws') || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
    code, name, pid, noRtc: q.has('nortc'),
    onState(s) {
      if (s?.error) { if (ERR[s.error]) fail(ERR[s.error]); return; }
      state.link = s;
      $('link').textContent = LINK[s] ?? s;
    },
    onCtl(m) {
      if (m.t === 'you') { state.color = m.color; document.documentElement.style.setProperty('--me', m.color); }
      else if (m.t === 'state') {
        $('text').textContent = m.text ?? ''; $('score').textContent = m.score ?? '';
        if (document.body.dataset.layout === 'beat') $('prompt').textContent = [m.text, m.score].filter(Boolean).join(' · ');
      }
      else if (m.t === 'buzz') navigator.vibrate?.(Math.min(1000, m.ms | 0));
      else if (m.t === 'full') fail(ERR.full);
      else if (m.t === 'layout') setLayout(m);
      else if (m.t === 'ping') { clockSample(m.at); net?.sendCtl({ t: 'pong', at: m.at }); }
    },
  });
}
$('go').addEventListener('click', join);
$('again').addEventListener('click', () => location.reload());
if (urlCode && q.get('name')) join();

function send() {
  if (!net) return;
  seq = Math.max(seq + 1, Date.now());
  net.sendInput({ s: seq, x: Math.round(state.x * 100) / 100, y: Math.round(state.y * 100) / 100, a: state.a, b: state.b, an: state.an, bn: state.bn });
}
setInterval(send, 33);

let first = true;
function firstTap() {
  if (!first) return;
  first = false;
  document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  navigator.wakeLock?.request('screen').catch(() => {});
}

// Pinden: hvor tommelfingeren rammer venstre halvdel, dér er midten.
const left = $('left'), base = $('base'), knob = $('knob'), R = 60;
let stickId = null, cx = 0, cy = 0;
function setStick(x, y) { state.x = x; state.y = y; knob.style.transform = x || y ? `translate(${x * R}px, ${y * R}px)` : ''; }
function move(e) {
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  setStick(dx / R, dy / R);
}
left.addEventListener('pointerdown', (e) => {
  if (stickId !== null || tilt.on) return;
  stickId = e.pointerId;
  left.setPointerCapture(e.pointerId);
  const r = left.getBoundingClientRect();
  cx = e.clientX; cy = e.clientY;
  Object.assign(base.style, { display: 'block', left: `${cx - r.left}px`, top: `${cy - r.top}px` });
  move(e);
  firstTap();
});
left.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) move(e); });
const end = (e) => { if (e.pointerId !== stickId) return; stickId = null; base.style.display = 'none'; setStick(0, 0); };
left.addEventListener('pointerup', end);
left.addEventListener('pointercancel', end);

for (const k of ['a', 'b']) {
  const el = $(k);
  const set = (v) => (e) => {
    e.preventDefault();
    if (state[k] === v) return;
    state[k] = v;
    if (v) state[`${k}n`]++;
    el.classList.toggle('on', !!v);
    send();
    if (v) { navigator.vibrate?.(10); firstTap(); }
  };
  el.addEventListener('pointerdown', set(1));
  el.addEventListener('pointerup', set(0));
  el.addEventListener('pointercancel', set(0));
  el.addEventListener('pointerleave', set(0));
}

// Konsollens ur: ping har konsollens tid; konsollens tid minus telefonens ved modtagelsen er ur-forskellen minus
// envejs-forsinkelsen. Den største af de seneste 10 er den med mindst forsinkelse. Dance Beat stempler tryk med den.
const skews = [];
function clockSample(at) {
  if (!Number.isFinite(at)) return;
  skews.push(at - performance.now());
  if (skews.length > 10) skews.shift();
}
const consoleNow = () => (skews.length ? performance.now() + Math.max(...skews) : undefined);

// --- layouts: konsollen bestemmer, hvad telefonen viser (pad, choices, text, draw, beat) -------------------------
const choices = $('choices'), textin = $('textin'), textIn = $('text-in'), canvas = $('draw');
const HEX = /^#[0-9a-f]{6}$/i;
function setLayout(m) {
  const kind = ['pad', 'choices', 'text', 'draw', 'beat', 'tilt'].includes(m.kind) ? m.kind : 'pad';
  if (kind !== 'tilt') setTilt(false);
  document.body.dataset.layout = kind;
  $('prompt').textContent = typeof m.prompt === 'string' ? m.prompt : '';
  if (kind === 'choices') {
    choices.classList.remove('locked');
    choices.classList.toggle('many', (m.options?.length ?? 0) > 6);   // 7-12 knapper: mindre tekst
    choices.replaceChildren(...(Array.isArray(m.options) ? m.options.slice(0, 12) : []).map((o, i) => {
      const b = document.createElement('button');
      b.textContent = String(o?.label ?? '');
      if (HEX.test(o?.color ?? '')) b.style.setProperty('--c', o.color);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (choices.classList.contains('locked')) return;
        choices.classList.add('locked');
        b.classList.add('chosen');
        navigator.vibrate?.(20);
        net?.sendCtl({ t: 'answer', value: i });
      });
      return b;
    }));
  } else if (kind === 'text') {
    textIn.maxLength = Math.min(40, m.max | 0 || 40);
    textIn.value = '';
    textIn.focus();
  } else if (kind === 'draw') {
    clearCanvas();
  }
}
textin.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = textIn.value.trim();
  if (v) net?.sendCtl({ t: 'answer', value: v });
  textIn.value = '';
});

// Tegning: punkter i 0-1, sendt i bidder hvert 50 ms (højst 64 pr. strøg-besked).
const g2 = canvas.getContext('2d');
let pending = [], drawing = null;
function clearCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, r.width * devicePixelRatio); canvas.height = Math.max(1, r.height * devicePixelRatio);
  g2.fillStyle = '#fff'; g2.fillRect(0, 0, canvas.width, canvas.height);
  g2.lineWidth = 4 * devicePixelRatio; g2.lineCap = g2.lineJoin = 'round'; g2.strokeStyle = '#111';
}
const norm = (e) => { const r = canvas.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
canvas.addEventListener('pointerdown', (e) => { drawing = e.pointerId; canvas.setPointerCapture(e.pointerId); const p = norm(e); pending = [p]; g2.beginPath(); g2.moveTo(p[0] * canvas.width, p[1] * canvas.height); });
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== drawing) return;
  const p = norm(e);
  pending.push(p);
  g2.lineTo(p[0] * canvas.width, p[1] * canvas.height); g2.stroke();
});
const lift = (e) => { if (e.pointerId === drawing) { drawing = null; flush(); } };
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);
function flush() {
  while (pending.length > 1) {
    const part = pending.splice(0, 64);
    net?.sendCtl({ t: 'stroke', ar: Math.round((canvas.width / canvas.height) * 100) / 100,
      pts: part.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]) });
    if (pending.length) pending.unshift(part[part.length - 1]);  // strøget hænger sammen over bidderne
    else if (drawing !== null) pending.push(part[part.length - 1]);
  }
}
setInterval(() => { if (drawing !== null) flush(); }, 50);
// Hældning (layout tilt): pinden styres af telefonens hældning. iOS kræver tilladelse ved et tryk. Nulpunktet er
// stillingen ved første måling efter "Use tilt" (eller Recenter); Flip vender retningen, hvis den føles forkert.
const tilt = { on: false, zero: null, flip: false, last: null };
const level = $('level').firstChild;
function onOrient(e) {
  tilt.last = { beta: e.beta, gamma: e.gamma };
  if (!tilt.on) return;
  if (!tilt.zero) tilt.zero = { ...tilt.last };
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  let { x, y } = tiltToStick(tilt.last, angle, tilt.zero);
  if (tilt.flip) { x = -x; y = -y; }
  setStick(x, y);
  level.style.transform = `translate(${x * 55}px, ${y * 55}px)`;
}
function setTilt(on) {
  if (tilt.on === on) return;
  tilt.on = on;
  tilt.zero = null;
  document.body.classList.toggle('tilting', on);
  $('tilt-on').hidden = on;
  for (const id of ['tilt-zero', 'tilt-flip', 'tilt-off']) $(id).hidden = !on;
  setStick(0, 0);
}
if (!('DeviceOrientationEvent' in window)) { $('tilt-on').textContent = 'No tilt on this phone — use the stick'; $('tilt-on').disabled = true; }
$('tilt-on').addEventListener('click', async () => {
  const denied = () => { $('tilt-on').textContent = 'Tilt not allowed — use the stick'; };
  try { if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') { denied(); return; } } catch { denied(); return; }
  addEventListener('deviceorientation', onOrient);
  tilt.last = null;
  setTilt(true);
  setTimeout(() => {                                   // ingen målinger (ingen sensor, http, nægtet): tilbage til pinden
    if (tilt.on && (!tilt.last || !Number.isFinite(tilt.last.beta))) { setTilt(false); $('tilt-on').textContent = 'No tilt here — use the stick'; }
  }, 1500);
});
$('tilt-zero').addEventListener('click', () => { tilt.zero = null; });
$('tilt-flip').addEventListener('click', () => { tilt.flip = !tilt.flip; });
$('tilt-off').addEventListener('click', () => setTilt(false));

// Dance Beat: et tryk sendes straks, stemplet med konsollens ur.
[...$('beat').children].forEach((b, lane) => {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const at = consoleNow();
    net?.sendCtl(at === undefined ? { t: 'tap', lane } : { t: 'tap', lane, at: Math.round(at * 10) / 10 });
    b.classList.add('on');
    navigator.vibrate?.(8);
  });
  const up = () => b.classList.remove('on');
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
});
$('clear').addEventListener('click', () => { clearCanvas(); net?.sendCtl({ t: 'stroke', clear: true }); });
$('done').addEventListener('click', () => net?.sendCtl({ t: 'answer', value: 'done' }));

if (!q.has('nosw') && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

window.__pad = {
  tap(k) { state[k] = 1; state[`${k}n`]++; send(); setTimeout(() => { state[k] = 0; send(); }, 120); },
  stick: setStick,
  state: () => ({ ...state }),
  clock: () => consoleNow(),
};
