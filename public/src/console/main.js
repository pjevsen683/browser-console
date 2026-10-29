// Konsollen: telefonen i HDMI-kablet. Lobby (QR, pladser, spilvalg) -> spil -> resultat, i en 16:9-scene.
// Uden telefoner: ?bots=N (falske spillere), &auto=1 (start første spil med det samme), &game=<id>, &seed=N,
// &prewarm=N (simulér N sekunder uden at tegne, til headless-billeder), &nosw=1, &ws=<url>.
import * as THREE from 'three';
import { createRoster, MAX_PLAYERS } from '../input/players.js';
import { parseInput } from '../input/normalize.js';
import { parseCtl } from '../input/answers.js';
import { pollGamepads } from '../input/gamepads.js';
import { HostNet } from '../net/host-net.js';
import { createLobby, lobbyStep, canStart } from './lobby-state.js';
import { renderLobby } from './lobby.js';
import { createHud, esc } from './hud.js';
import { createBots } from './bots.js';
import { drawQr } from './qr.js';
import { GAMES } from '../games/index.js';
import * as audio from '../audio.js';
import { mulberry32 } from '../rng.js';

const q = new URLSearchParams(location.search);
const BOTS = Math.min(MAX_PLAYERS, Number(q.get('bots')) || 0);
const PREWARM = Number(q.get('prewarm')) || 0;
const SEED = q.has('seed') ? Number(q.get('seed')) : (Math.random() * 2 ** 32) >>> 0;
const rng = mulberry32(SEED);
const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* privat fane */ } },
};

// --- scene og renderer -------------------------------------------------------------------------------------------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true });
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
function fit() {
  const W = innerWidth, H = innerHeight, w = Math.min(W, (H * 16) / 9), h = (w * 9) / 16;
  Object.assign(stage.style, { width: `${w}px`, height: `${h}px`, left: `${(W - w) / 2}px`, top: `${(H - h) / 2}px`, fontSize: `${h / 36}px` });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
}
addEventListener('resize', fit);
fit();

// --- spillere og netværk -----------------------------------------------------------------------------------------
const roster = createRoster();
const peers = new Map();                           // peer-nummer -> { id, name }
let code = null;
// Konsol-telefonens eget id: med det må en genindlæst (eller hængt) konsol overtage sit rum hos serveren.
let token = store.get('konsol-token');
if (!token) { token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => (b % 36).toString(36)).join(''); store.set('konsol-token', token); }

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function drawJoin(c) {
  const url = new URL(`c.html?g=${c}`, location.href).href;
  drawQr($('qr'), url);
  $('code').textContent = c;
  $('url').textContent = url.replace(/^https?:\/\//, '');
}

const net = new HostNet({
  url: q.get('ws') || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
  code: store.get('konsol-code'),
  token,
  onRoom(c) { code = c; store.set('konsol-code', c); drawJoin(c); },
  onStatus(s) {
    $('net').textContent = s === 'online' ? '' : s === 'offline' ? 'Cannot reach the server — only controllers work'
      : s === 'replaced' ? 'The console is open in another tab — use that one' : `Server error (${s})`;
  },
  onJoin(peer, { pid, name }) {
    const id = `phone:${pid}`;
    peers.set(peer, { id, name });
    const p = roster.add({ id, name, source: 'phone' }, performance.now());
    if (!p) { net.send(peer, { t: 'full' }); return; }
    net.send(peer, { t: 'you', color: p.color, name: p.name });
    net.send(peer, (screen === 'play' && game?.layoutFor?.(id)) || PAD);
    if (screen === 'lobby') notifyReady(p, true);
    else net.send(peer, game?.hello?.(id) ?? { t: 'state', text: 'A game is on — wait for the next one', score: '' });
  },
  onCtl(peer, m) {
    const who = peers.get(peer), msg = parseCtl(m);
    if (!who || !msg) return;
    if (msg.t === 'pong') { roster.setRtt(who.id, performance.now() - msg.at); return; }
    ctlLog.push({ name: who.name, msg });
    if (ctlLog.length > 50) ctlLog.shift();
    if (msg.t === 'tap') msg.recv = performance.now();       // Dance Beat: ankomsttiden i konsollens ur
    if (screen === 'play') game?.onAnswer?.(who.id, msg);
  },
  onLeave(peer) { const id = peers.get(peer)?.id; if (id) roster.setConnected(id, false, performance.now()); },
  onInput(peer, m) {
    const who = peers.get(peer);
    if (!who) return;
    if (!roster.get(who.id) && screen === 'lobby') roster.add({ id: who.id, name: who.name, source: 'phone' }, performance.now());
    roster.setInput(who.id, parseInput(m), performance.now());
  },
  onLink(peer, link) { const id = peers.get(peer)?.id; if (id) roster.setLink(id, link); },
});

function notify(id, msg) {
  for (const [peer, who] of peers) if (who.id === id) net.send(peer, msg);
}
const PAD = { t: 'layout', kind: 'pad' };
const notifyAll = (msg) => { for (const peer of peers.keys()) net.send(peer, msg); };
const ctlLog = [];                                 // de seneste svar (til tests)
// Ping hvert 2. sekund; telefonens pong giver ping-tiden (roster.setRtt), som Dance Beat skal bruge.
setInterval(() => { for (const peer of peers.keys()) net.send(peer, { t: 'ping', at: performance.now() }); }, 2000);

const readyShown = new Map();
function notifyReady(p, force = false) {
  if (!force && readyShown.get(p.id) === p.ready) return;
  readyShown.set(p.id, p.ready);
  notify(p.id, { t: 'state', text: p.ready ? 'Ready ✓ — waiting for the others' : 'Press A when you are ready', score: '' });
}

const bots = createBots(BOTS, roster, performance.now());

// --- skærmene ----------------------------------------------------------------------------------------------------
// Sidste kort i lobbyen: et tilfældigt spil blandt dem, der passer til antallet.
const RANDOM = { id: 'random', title: 'Random game', emoji: '🎲', how: 'surprise!', minPlayers: 1, maxPlayers: 12, random: true };
const CARDS = [...GAMES, RANDOM];
const lobby = createLobby(CARDS);
if (q.has('game') && !q.has('auto')) lobby.sel = Math.max(0, CARDS.findIndex((g) => g.id === q.get('game')));   // kortet er valgt i lobbyen
const lobbyEls = { games: $('games'), slots: $('slots'), countdown: $('countdown') };
let screen = 'lobby', game = null, resultAt = 0;
const show = (s) => { screen = s; document.body.dataset.screen = s; };

function startGame(def) {
  const players = roster.list().filter((p) => p.connected);
  if (def.random) {
    const fit = GAMES.filter((g) => canStart(g, players));
    if (fit.length) def = fit[Math.floor(rng() * fit.length)];
  }
  if (!canStart(def, players)) { toast(`${def.title}: ${def.minPlayers}–${def.maxPlayers} players`); return; }
  lobby.countdown = null;
  show('play');
  notifyAll(PAD);                                  // et spil sætter selv andre layouts
  audio.music(def.music ?? def.id);                 // music: false = spillet styrer selv musikken (Dance Beat)
  game = def.start({ players, rng, audio, hud: createHud($('hud')), notify, seed: SEED });
}

function endGame() {
  const { ranking, title } = game.done;            // title: et holdspil kårer holdet ("Red team")
  game.dispose();
  game = null;
  notifyAll(PAD);
  $('winner').textContent = `🏆 ${title ?? ranking[0]?.name ?? ''}`;
  $('rank').innerHTML = ranking.map((r, i) => `<div>${i + 1}. <i style="background:${r.color}"></i>${esc(r.name)} <b>${r.text !== undefined ? esc(r.text) : '●'.repeat(r.score)}</b></div>`).join('');
  show('result');
  resultAt = performance.now();
}

function toLobby() {
  for (const p of roster.list()) { p.ready = false; notifyReady(p, true); }
  show('lobby');
  audio.music('lobby');
}
audio.music('lobby');

$('start').addEventListener('click', () => startGame(CARDS[lobby.sel]));
$('games').addEventListener('click', (e) => { const c = e.target.closest('.gcard'); if (c) lobby.sel = Number(c.dataset.i); });
$('result').addEventListener('click', toLobby);

// Første tryk på konsollen: lyd, fuld skærm, landscape og skærmen tændt. (Modulets `screen` er skærmtilstanden og
// skygger for window.screen -- derfor window.screen.orientation.)
let wake = null;
async function keepAwake() { try { wake = await navigator.wakeLock?.request('screen'); } catch { /* ikke tilladt */ } }
addEventListener('pointerdown', () => {
  audio.unlock();
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().then(() => window.screen.orientation?.lock?.('landscape')).catch(() => {});
  if (!wake) keepAwake();
}, { capture: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wake) keepAwake(); });

// --- løkken ------------------------------------------------------------------------------------------------------
function tick(now, dt, draw) {
  pollGamepads(roster, now, { allowJoin: screen === 'lobby' });
  bots.update(now, game, screen === 'lobby');
  roster.frame(now);
  const list = roster.list();
  if (screen === 'lobby') {
    roster.prune(now);
    const g = lobbyStep(lobby, list, dt);
    for (const p of list) notifyReady(p);
    if (draw) renderLobby(lobbyEls, { games: CARDS, sel: lobby.sel, players: list, countdown: lobby.countdown, max: MAX_PLAYERS });
    if (g) startGame(g);
  } else if (screen === 'play') {
    game.update(dt, list);
    if (draw) game.render(renderer);
    if (game.done) endGame();
  } else if (screen === 'result') {
    if (now - resultAt > 1500 && list.some((p) => p.input.aPressed)) toLobby();
  }
}

if (q.has('auto')) {
  const def = CARDS.find((g) => g.id === q.get('game')) ?? GAMES[0];   // også 'random'
  // Spil med data (quiz, traitor) har et ready-løfte; prewarm skal først køre, når data er der.
  Promise.resolve(def.ready).then(() => {
    startGame(def);
    let t = performance.now();
    for (let i = 0; i < PREWARM * 60 && screen === 'play'; i++) { tick(t, 1 / 60, false); t += 1000 / 60; }
  });
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(now, dt, true);
}
requestAnimationFrame(frame);

if (!q.has('nosw') && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

window.__konsol = {
  code: () => code,
  screen: () => screen,
  players: () => roster.list().map((p) => ({ id: p.id, name: p.name, color: p.color, link: p.link, ready: p.ready, connected: p.connected, rtt: p.rtt, input: { ...p.input } })),
  notifyAll,
  ctlLog: () => ctlLog.slice(),
  music: () => audio.currentMusic(),
};
