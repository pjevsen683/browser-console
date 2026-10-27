# Did the speech server say the line? Whisper with the language forced (argv[1], default da): the share of
# the expected words heard (0-1), plus how much the detector thinks it sounds like that language ("lang").
# Run with the faster-whisper venv:  ~/privat/ai-film/.venv/bin/python tools/tts-check.py [en|da]
# Reads lines of "file<TAB>expected text" on stdin, prints JSON per line.
import sys, json, re, difflib
from faster_whisper import WhisperModel
lang = sys.argv[1] if len(sys.argv) > 1 else 'da'
m = WhisperModel('small', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^a-zæøå ]', '', s.lower()).split()
for line in sys.stdin:
    f, want = line.rstrip('\n').split('\t', 1)
    segs, _ = m.transcribe(f, language=lang, beam_size=5)
    heard = ' '.join(s.text.strip() for s in segs)
    _, det = m.transcribe(f, language=None)
    p = dict(det.all_language_probs or []).get(lang, 0)
    match = difflib.SequenceMatcher(None, norm(want), norm(heard)).ratio()
    print(json.dumps({'file': f, 'match': round(match, 2), 'lang': round(p, 2), 'heard': heard}, ensure_ascii=False), flush=True)
