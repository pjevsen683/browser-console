// Sumo Survival: spillerne mod bølger af bøller på isflagen (Sumo-fysikken). En bølge er klaret, når alle bøller er i
// vandet, og mindst én spiller står; næste bølge er alle spillere med igen. Alle spillere i vandet = slut. Ren logik
// (test/waves.test.js); fysikken er sumo/physics.js.
export const COUNTDOWN = 3, BREAK = 2.5, MAX_WAVE = 20, MAX_ANIMALS = 12;

// Halvt så mange bøller som spillere i første bølge, én mere hver anden bølge; langsomme og forsigtige i starten.
export const enemyCount = (wave, n) => Math.max(1, Math.min(MAX_ANIMALS - n, Math.ceil(n / 2) + Math.ceil(wave / 2) - 1));
export const enemySpeed = (wave) => Math.min(1.1, 0.6 + 0.03 * (wave - 1));     // faktor på fart og acceleration
export const enemyEager = (wave) => Math.min(0.1, 0.02 + 0.005 * (wave - 1));    // chance pr. billede for at skubbe tæt på
export const enemyIds = (wave, n) => Array.from({ length: enemyCount(wave, n) }, (_, i) => `bully:${i}`);
export const isEnemy = (id) => String(id).startsWith('bully:');

export function createRun(ids) {
  const zero = () => Object.fromEntries(ids.map((id) => [id, 0]));
  return { ids, wave: 1, phase: 'countdown', t: COUNTDOWN, cleared: 0, won: false, pushes: zero(), falls: zero() };
}

// Et fald fra fysikken: en spiller i vandet tælles; en bølle skubbet i vandet af en spiller er et skub til ham.
export function fall(run, e) {
  if (run.ids.includes(e.id)) run.falls[e.id]++;
  else if (isEnemy(e.id) && run.ids.includes(e.by)) run.pushes[e.by]++;
}

// Giver 'start' | 'cleared' | 'won' | 'over' | 'next' eller null.
export function updateRun(run, alivePlayers, aliveEnemies, dt) {
  if (run.phase === 'countdown') {
    if ((run.t -= dt) > 0) return null;
    run.phase = 'play';
    return 'start';
  }
  if (run.phase === 'play') {
    if (alivePlayers === 0) { run.phase = 'over'; return 'over'; }
    if (aliveEnemies > 0) return null;
    run.cleared = run.wave;
    if (run.wave >= MAX_WAVE) { run.won = true; run.phase = 'over'; return 'won'; }
    run.phase = 'break';
    run.t = BREAK;
    return 'cleared';
  }
  if (run.phase === 'break') {
    if ((run.t -= dt) > 0) return null;
    run.wave++;
    run.phase = 'countdown';
    run.t = COUNTDOWN;
    return 'next';
  }
  return null;
}

export function ranking(run) {
  return [...run.ids].sort((a, b) => run.pushes[b] - run.pushes[a] || run.falls[a] - run.falls[b]);
}
