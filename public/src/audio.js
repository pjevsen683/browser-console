// Lydeffekter syntetiseret i WebAudio (intet at hente eller licensere) og dommerens replikker fra public/voice/,
// når asset-serveren har lavet dem (voice/index.json: { nøgle: [filer] }). Mangler en, er der bare stille.
let ctx = null, master = null, noise = null, voices = {};

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  fetch('./voice/index.json').then((r) => (r.ok ? r.json() : {})).then((j) => { voices = j; }).catch(() => {});
  if (track?.paused) start(track);                 // musik, der blev bedt om før første tryk
}

// Musik: public/music/<navn>.mp3 i løkke med fade. Før første tryk må browseren ikke spille; så startes den i
// unlock(). music(null) stopper; ms er fadens længde (Musical Chairs stopper brat).
const MUSIC_VOL = 0.45;
let track = null, trackName = null;
function fade(a, to, ms = 800, done) {
  const from = a.volume, t0 = performance.now();
  clearInterval(a._fade);
  a._fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = from + (to - from) * k;
    if (k === 1) { clearInterval(a._fade); done?.(); }
  }, 30);
}
// Når play() løser, kan der være skiftet spor imens (første tryk er ofte Start): så stoppes det gamle.
const start = (a) => a.play().then(() => { if (a === track) fade(a, MUSIC_VOL); else a.pause(); }).catch(() => {});
export function music(name, ms = 800) {
  if (name === trackName) return;
  const old = track;
  if (old) fade(old, 0, ms, () => old.pause());
  trackName = name;
  track = null;
  if (!name) return;
  track = new Audio(`./music/${name}.mp3`);
  track.loop = true;
  track.volume = 0;
  start(track);
}
export const currentMusic = () => trackName;

// En sang, der spilles én gang fra start (Dance Beat), og dens tid. time() er null, før den spiller (og headless).
export function song(name) {
  music(null);
  const a = new Audio(`./music/${name}.mp3`);
  a.volume = 0.8;
  let playing = false;
  return {
    // true: den prøver at spille (lyden er låst op); false: stille (headless, før første tryk)
    play() { if (!ctx) return false; a.play().then(() => { playing = true; }).catch(() => {}); return true; },
    time: () => (playing && !a.paused && !a.ended ? a.currentTime : null),
    stop() { playing = false; a.pause(); a.removeAttribute('src'); a.load(); },
  };
}

function env(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(freq, dur, { type = 'sine', peak = 0.3, at = 0, to = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, peak, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hiss(dur, { freq = 1500, to = null, q = 1, peak = 0.3, at = 0, type = 'bandpass' } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, peak, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

export const blip = (high = false) => tone(high ? 1320 : 880, 0.15, { type: 'square', peak: 0.12 });
export const whoosh = () => hiss(0.25, { freq: 600, to: 2400, q: 0.8, peak: 0.2 });
export function thud(strength = 3) {
  const p = Math.min(0.5, 0.08 + strength * 0.05);
  tone(140, 0.18, { peak: p, to: 60 });
  hiss(0.08, { freq: 900, peak: p * 0.5 });
}
export function splash() {
  hiss(0.6, { freq: 1200, to: 300, q: 0.6, peak: 0.45, type: 'lowpass' });
  hiss(0.35, { freq: 3000, q: 1.5, peak: 0.2, at: 0.05 });
}
// Porcelæn, der knuser (Cat Chaos), og en snebold, der rammer (Snowball Fight).
export function crash() {
  hiss(0.45, { freq: 4200, q: 1.2, peak: 0.32 });
  [2650, 3420, 4100].forEach((f, i) => tone(f, 0.12, { type: 'triangle', peak: 0.07, at: 0.02 + i * 0.04 }));
  tone(180, 0.12, { peak: 0.25, to: 70 });
}
export function poof() { hiss(0.22, { freq: 800, to: 250, q: 0.7, peak: 0.35, type: 'lowpass' }); }
export function whistle() { tone(2300, 0.5, { peak: 0.22 }); tone(2450, 0.5, { peak: 0.1 }); }
export function fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.18, { type: 'triangle', peak: 0.22, at: i * 0.14 })); }

// Én bestemt lydfil (fx et quizspørgsmål læst op). Stille før første tryk, og hvis filen mangler.
export function clip(path) {
  if (!ctx) return false;
  const a = new Audio(path);
  a.play().catch(() => {});
  return true;
}

export function say(key) {
  const list = voices[key];
  if (!ctx || !list?.length) return false;
  new Audio(`./voice/${list[Math.floor(Math.random() * list.length)]}`).play().catch(() => {});
  return true;
}
