#!/usr/bin/env python3
# Takterne i Dance Beats sange (ACE-Step med fast tempo), fundet på udviklingsmaskinen med librosa -- ikke live.
# librosas beat-tracker hoppede mellem slag og efterslag i to af sangene, så i stedet søges det jævne gitter
# (tempo ±3 % omkring det ønskede, fase i 4 ms-trin), der rammer flest anslag (onset-styrke). Gitteret tjekkes i
# 8 s-vinduer (afvigelsen udskrives) og klippes til der, hvor musikken spiller. Resultat: public/data/dance.json.
# Navne og tempo står i asset-generation/music.json (dance-*).
#   python3 tools/beats.py
import json, sys
from pathlib import Path
import numpy as np
import librosa

ROOT = Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / 'asset-generation/music.json').read_text())
TITLES = {'dance-disco': 'Disco Fever', 'dance-pop': 'Neon Pop', 'dance-latin': 'Fiesta', 'dance-chip': 'Pixel Party'}
HOP = 128
songs = []
for name, c in cfg.items():
    if not name.startswith('dance-'):
        continue
    y, sr = librosa.load(ROOT / f'public/music/{name}.mp3', sr=22050, mono=True)
    dur = len(y) / sr
    fps = sr / HOP
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    env = env / env.max()
    best = (0, 0, 0)
    for bpm in np.arange(c['bpm'] * 0.97, c['bpm'] * 1.03, 0.02):
        per = 60 / bpm
        for ph in np.arange(0, per, 0.004):
            fr = (np.arange(ph, dur - 0.5, per) * fps).astype(int)
            s = env[fr].mean()
            if s > best[0]:
                best = (s, bpm, ph)
    score, bpm, ph = best
    per = 60 / bpm
    grid = np.arange(ph, dur, per)
    # hvor musikken spiller: RMS over 25 % af medianen (ACE-Step fader ud til sidst)
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    on = np.where(rms > 0.25 * np.median(rms))[0]
    start, end = on[0] / fps, on[-1] / fps - 1.0
    grid = grid[(grid >= start) & (grid <= end)]
    offs = []
    for w0 in range(0, int(dur), 8):
        m = (grid >= w0) & (grid < w0 + 8)
        if not m.any():
            continue
        cand = [(env[np.clip(((grid[m] + d) * fps).astype(int), 0, len(env) - 1)].mean(), d) for d in np.arange(-0.1, 0.1, 0.004)]
        offs.append(round(max(cand)[1] * 1000))
    print(f'{name}: {bpm:.2f} bpm (ønsket {c["bpm"]}), {len(grid)} takter {grid[0]:.2f}-{grid[-1]:.2f} s af {dur:.1f} s, '
          f'afvigelse pr. 8 s: {offs} ms', file=sys.stderr)
    songs.append({'id': name, 'title': TITLES.get(name, name), 'bpm': round(float(bpm), 2),
                  'duration': round(dur, 2), 'beats': [round(float(t), 3) for t in grid]})
(ROOT / 'public/data/dance.json').write_text(json.dumps({'songs': songs}, separators=(',', ':')) + '\n')
print(f'{len(songs)} sange -> public/data/dance.json', file=sys.stderr)
