// Mormor i lænestolen. Kopieret uændret fra Kattekaos (kattekaos/public/src/owner.js, 2026-10-25), derfor engelske
// kommentarer. Hvem der bliver taget, står i rules.js (her er der op til 12 katte, ikke én).
//
//   reading    back turned, reading the paper -- the cat is free
//   turning    the chair starts to swivel: a fair warning, freeze now
//   looking    facing the table; anything moving and the cat is caught
//   scolding   she caught the cat; a short pause, then back to reading
//
// A crash makes her curious: the reading timer is cut short, so after every
// crash the cat has about a second to sit still and look innocent.

export function createOwner(level, rng = Math.random) {
  return { state: 'reading', t: readTime(level, rng), level, rng, turn: 0, caughtCount: 0 };
}

function readTime(level, rng) {
  return level.readMin + rng() * (level.readMax - level.readMin);
}

/** Advance; returns an event name when the state changes, else null. */
export function updateOwner(o, dt) {
  o.t -= dt;
  // turn: 0 = back to the table, 1 = facing it. Eased by the renderer.
  const target = o.state === 'reading' ? 0 : o.state === 'turning' ? 0.35 : 1;
  o.turn += (target - o.turn) * (1 - Math.exp(-(o.state === 'looking' ? 14 : 6) * dt));
  if (o.t > 0) return null;
  const L = o.level;
  switch (o.state) {
    case 'reading':
      o.state = 'turning'; o.t = L.warn; return 'turning';
    case 'turning':
      o.state = 'looking'; o.t = L.lookMin + o.rng() * (L.lookMax - L.lookMin); return 'looking';
    case 'looking':
    case 'scolding':
      o.state = 'reading'; o.t = readTime(L, o.rng); return 'reading';
  }
  return null;
}

/** She heard something. Only shortens the wait; never lengthens it. */
export function hearNoise(o) {
  if (o.state !== 'reading') return;
  o.t = Math.min(o.t, 0.5 + o.rng() * 0.6);
}

export function isWatching(o) {
  return o.state === 'looking';
}

export function catch_(o) {
  o.state = 'scolding';
  o.t = 2.0;
  o.caughtCount++;
}
