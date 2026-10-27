// Quiz Night og Who's the Traitor? med falsk ctx og falsk fetch: data, der ikke kan hentes, og spillere, der
// forsvinder midt i en afstemning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../public/src/rng.js';

const el = () => ({ style: {}, textContent: '', innerHTML: '', classList: { toggle() {}, add() {} }, querySelector: () => el() });
function fakeCtx(n, sent = []) {
  return {
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#ff4d5e' })),
    rng: mulberry32(1), notify: (id, msg) => sent.push([id, msg]),
    audio: { blip() {}, fanfare() {}, thud() {}, say() {}, clip() {} },
    hud: { layer: { innerHTML: '', querySelector: el, querySelectorAll: () => [el(), el(), el(), el()] }, scores() {}, banner() {}, tick() {}, clear() {} },
  };
}
const live = (ctx, gone = new Set()) => ctx.players.map((p) => ({ ...p, connected: !gone.has(p.id), input: {} }));

test('kan quizzens data ikke hentes, slutter spillet i stedet for at hænge', async () => {
  globalThis.fetch = async () => ({ ok: false });
  const quiz = (await import('../public/src/games/quiz/index.js?fail')).default;
  await quiz.ready;
  const ctx = fakeCtx(2);
  const g = quiz.start(ctx);
  await new Promise((r) => setTimeout(r, 10));
  g.update(0.1, live(ctx));
  assert.ok(g.done, 'done er sat');
});

test('forsvinder en spiller under afstemningen, får de andre nye knapper uden ham', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => [['beach', 'desert'], ['tea', 'coffee'], ['cat', 'dog']] });
  const traitor = (await import('../public/src/games/traitor/index.js?ok')).default;
  await traitor.ready;
  const sent = [];
  const ctx = fakeCtx(5, sent);
  const g = traitor.start(ctx);
  for (let i = 0; i < 2000; i++) {
    g.update(0.1, live(ctx));
    const last = sent.filter(([, m]) => m.t === 'layout').at(-1)?.[1];
    if (last?.options?.length > 1) break;                // afstemningen er i gang
    const speaker = sent.filter(([, m]) => m.t === 'layout' && m.options?.length === 1).at(-1)?.[0];
    if (speaker) g.onAnswer(speaker, { t: 'answer', value: 0 });
  }
  // Forræderen har det afvigende ord ("Your word: X"); den, der forsvinder, skal være en almindelig spiller.
  const wordOf = new Map(sent.filter(([, m]) => m.t === 'layout' && /Your word: /.test(m.prompt ?? '')).map(([id, m]) => [id, m.prompt.match(/Your word: (\w+)/)[1]]));
  const counts = {};
  for (const w of wordOf.values()) counts[w] = (counts[w] ?? 0) + 1;
  const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const gone = [...wordOf].find(([, w]) => w === common)[0];
  sent.length = 0;
  g.update(0.1, live(ctx, new Set([gone])));
  const votes = sent.filter(([id, m]) => id !== gone && m.t === 'layout' && m.options?.length > 1);
  assert.ok(votes.length > 0, 'nye stemmeknapper sendt');
  assert.ok(votes.every(([, m]) => m.options.every((o) => o.label !== gone.toUpperCase())));
});
