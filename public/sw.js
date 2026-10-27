// Netværk først, cache som reserve -- som Kattekaos: online får man altid den nyeste kode, og den installerede app
// starter også uden net. Signalserveren (/ws) går aldrig gennem workeren (WebSocket).
const CACHE = 'konsol-v10';
const CORE = [
  './', './index.html', './c.html', './manifest.webmanifest', './c.webmanifest',
  './src/console/main.js', './src/console/lobby-state.js', './src/console/lobby.js', './src/console/hud.js',
  './src/console/qr.js', './src/console/bots.js', './src/controller/main.js',
  './src/net/signal-client.js', './src/net/host-net.js', './src/net/pad-net.js',
  './src/input/normalize.js', './src/input/players.js', './src/input/gamepads.js',
  './src/audio.js', './src/assets.js', './src/rng.js', './src/games/index.js',
  './src/games/sumo/index.js', './src/games/sumo/physics.js', './src/games/sumo/rules.js', './src/games/sumo/ai.js',
  './src/games/sumo/view.js', './src/games/colors/index.js', './src/games/potato/index.js', './src/games/potato/rules.js', './src/games/potato/ai.js', './src/games/potato/view.js', './src/games/race/index.js', './src/games/race/track.js', './src/games/race/physics.js', './src/games/race/rules.js', './src/games/race/ai.js', './src/games/race/view.js', './src/games/quiz/index.js', './src/games/quiz/rules.js', './src/games/traitor/index.js', './src/games/traitor/rules.js', './src/games/cats/index.js', './src/games/cats/rules.js', './src/games/cats/physics.js', './src/games/cats/owner.js', './src/games/cats/ai.js', './src/games/cats/view.js', './src/games/snowball/index.js', './src/games/snowball/rules.js', './src/games/snowball/physics.js', './src/games/snowball/ai.js', './src/games/snowball/view.js', './src/games/draw/index.js', './src/games/draw/rules.js', './src/games/racer/index.js', './src/games/racer/track.js', './src/games/racer/physics.js', './src/games/racer/rules.js', './src/games/racer/ai.js', './src/games/racer/view.js', './src/games/dance/index.js', './src/games/dance/chart.js', './src/games/dance/rules.js', './src/games/dance/ai.js', './src/games/dance/view.js', './data/dance.json', './src/games/panic/index.js', './src/games/panic/rules.js', './src/games/panic/ai.js', './src/games/panic/view.js', './src/games/chairs/index.js', './src/games/chairs/rules.js', './src/games/chairs/ai.js', './src/games/chairs/view.js', './src/games/coins/index.js', './src/games/coins/rules.js', './src/games/coins/ai.js', './src/games/coins/view.js', './src/games/bombs/index.js', './src/games/bombs/rules.js', './src/games/bombs/ai.js', './src/games/bombs/view.js', './src/games/common/survival.js', './src/games/common/rink.js', './src/games/plunger/index.js', './src/games/plunger/rules.js', './src/games/simon/index.js', './src/games/simon/rules.js', './src/games/pipes/index.js', './src/games/pipes/rules.js', './src/games/tug/index.js', './src/games/tug/rules.js', './src/games/tug/ai.js', './src/games/tug/view.js', './src/games/rope/index.js', './src/games/rope/rules.js', './src/games/rope/ai.js', './src/games/rope/view.js', './src/games/bomber/index.js', './src/games/bomber/rules.js', './src/input/tilt.js', './data/draw.json', './data/quiz.json', './data/traitor.json', './src/games/colors/rules.js', './src/input/answers.js', './src/console/teams.js', './src/games/common/placeholder.js', './src/games/common/species.js', './src/games/common/scene.js',
  './vendor/three.module.js', './vendor/qrcode.js', './vendor/addons/loaders/GLTFLoader.js',
  './vendor/addons/libs/meshopt_decoder.module.js', './vendor/addons/utils/BufferGeometryUtils.js',
  './models/models.json', './voice/index.json', './music/lobby.mp3', './icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request)
    .then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => undefined); }
      return res;
    })
    .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit ?? caches.match('./index.html'))));
});
