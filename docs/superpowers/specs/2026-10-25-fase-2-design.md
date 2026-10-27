# Fase 2 — Quiz Night og Who's the Traitor?

Dato: 2026-10-25. Bygger på `docs/spilplan.md` (fase 2) og Peters "Ja gør det og fortsæt".
Regler: altid op til 12 spillere, alt spillerne læser og hører er på engelsk, ingen børneudgave,
ingen point på tværs af spil.

## Platform

- **Op til 12 svarknapper** (`choices`): Traitor skal kunne stemme på 11 andre. `parseCtl` tillader
  indeks 0–11; telefonen viser op til 12 knapper i et gitter. **Testet** (answers).
- **`audio.clip(path)`**: afspil én bestemt lydfil (et spørgsmål læst op); stille, hvis den mangler.

## Quiz Night — 2–12

- **Spørgsmål** (`public/data/quiz.json`): `{ id, cat, q, a: [4], correct, img? , voice? }`, engelsk,
  6 kategorier (Denmark, Animals, Film & TV, Food, Sport, Science) × ~20.
  Laves med serverens LLM (`tools/quiz.mjs`): den skriver dem i bidder, en anden forespørgsel svarer på
  hvert spørgsmål uden facit (med blandede svar), og kun dem, hvor svaret stemmer, beholdes. Claude
  læser derefter alle igennem og fjerner tvivlsomme eller tvetydige.
- **Billeder**: ét pr. spørgsmål (Z-Image, 16:9, `public/quiz/<id>.webp`). **Oplæsning**: spørgsmålet
  læst op af værten (Chatterbox `en`, Whisper-tjekket, `public/voice/quiz/<id>.mp3`).
- **Spillet**: 10 spørgsmål blandet fra kategorierne; samme konsol får ikke de samme spørgsmål igen,
  før alle er brugt (husket i `localStorage`). 15 s pr. spørgsmål. Fjernsynet viser kategori, billede,
  spørgsmål og de fire svar (A–D i farver); telefonerne viser de fire svar som knapper. Rigtigt svar giver
  500 + op til 500 for fart; forkert 0. Efter hvert spørgsmål: det rigtige svar, hvor mange der valgte
  hvad, og stillingen. Flest point vinder.
- Ren logik: `games/quiz/rules.js` (**testet**: udvælgelse uden gentagelse, kun første svar,
  point efter tid, runden slutter når alle har svaret eller tiden er gået, rangliste).

## Who's the Traitor? — 4–12

- **Ordpar** (`public/data/traitor.json`): `[[civilWord, traitorWord], …]`, ~60 par af beslægtede ting
  (beach/desert, guitar/violin), laves med LLM'en og læses igennem.
- **En runde**: alle får et hemmeligt ord på telefonen; én tilfældig spiller er forræderen og får det
  andet ord (ved ikke selv, at han er forræder). Fjernsynet viser talerækkefølgen; på sin tur siger man
  ét ord højt om sit ord og trykker **Done** (eller efter 20 s). Derefter stemmer alle på telefonen
  (knapper med de andres navne). Flest stemmer er ude (uafgjort: ingen ude). Var det forræderen, vinder
  de andre; ellers en ny omgang ledetråde med de tilbageværende, til forræderen er fanget, eller der kun
  er to tilbage (så vinder forræderen).
- **Point**: 3 runder med nye ord og ny forræder. Fanget forræder: +1 til alle andre tilbageværende og +1
  ekstra til hver, der stemte på forræderen i den afgørende afstemning. Forræder, der slipper væk: +4.
- **Fjernsynet**: en illustreret baggrund (Z-Image, ~6 scener), talerækkefølgen, hvem der har stemt (ikke
  på hvem), afsløringen.
- Ren logik: `games/traitor/rules.js` (**testet**: tildeling, rækkefølge, Done/timeout, afstemning med
  uafgjort, sejr til begge sider, point over 3 runder, en spiller der forsvinder).

## Værtens replikker (Chatterbox `en`)

`quiz-intro` "Welcome to Quiz Night!", `quiz-last` "Last question!", `tr-clues` "Give your clues!",
`tr-vote` "Time to vote!", `tr-caught` "The traitor has been caught!", `tr-escaped` "The traitor got away!".

## Opgaver

1. 12 svarknapper + `audio.clip` (test først).
2. `tools/quiz.mjs` + `tools/traitor.mjs` (LLM), gennemlæsning, data i git.
3. Assets i baggrunden på GPU'en, ét job ad gangen: quiz-billeder, oplæsning, replikker, Traitor-scener.
4. Quiz Night (regler med tests, modul, visning).
5. Who's the Traitor? (regler med tests, modul, visning).
6. Docs, e2e, udrulning, gennemgang med frisk reviewer.
