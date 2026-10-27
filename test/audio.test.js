// Musikkens tilstand med en falsk Audio: et spor, der først når at starte, efter at der er skiftet, skal stoppe.
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeAudio {
  static all = [];
  constructor(src) { this.src = src; this.paused = true; this.volume = 1; FakeAudio.all.push(this); this.go = null; }
  play() { return new Promise((resolve) => { this.go = () => { this.paused = false; resolve(); }; }); }
  pause() { this.paused = true; }
}
globalThis.Audio = FakeAudio;
const audio = await import('../public/src/audio.js');

test('et spor, der når at starte efter et skift, stoppes i stedet for at spille med', async () => {
  audio.music('lobby');
  const lobby = FakeAudio.all.at(-1);
  audio.music('sumo');
  const sumo = FakeAudio.all.at(-1);
  lobby.go();                                        // lobby-sporets play() løser først nu
  sumo.go();
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(lobby.paused, true);
  assert.equal(sumo.paused, false);
  assert.equal(audio.currentMusic(), 'sumo');
  audio.music(null);
  await new Promise((r) => setTimeout(r, 900));
  assert.equal(sumo.paused, true);
});

test('clip afspiller en bestemt fil (efter første tryk) og gør ingenting før', () => {
  const before = FakeAudio.all.length;
  assert.equal(audio.clip('./voice/quiz/q1.mp3'), false);   // ingen AudioContext endnu: stille
  assert.equal(FakeAudio.all.length, before);
  globalThis.window = { AudioContext: class { constructor() { this.currentTime = 0; this.destination = {}; this.sampleRate = 8000; this.state = 'running'; }
    createGain() { return { gain: { value: 1 }, connect() {} }; } createBuffer() { return { getChannelData: () => new Float32Array(8000) }; } } };
  globalThis.fetch = async () => ({ ok: false });
  audio.unlock();
  assert.equal(audio.clip('./voice/quiz/q1.mp3'), true);
  assert.equal(FakeAudio.all.at(-1).src, './voice/quiz/q1.mp3');
});
