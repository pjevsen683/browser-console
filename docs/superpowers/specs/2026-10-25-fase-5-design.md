# Fase 5 — Mini Racers og Dance Beat

Dato: 2026-10-25. Bygger på `docs/spilplan.md` (fase 5) og Peters "bare tag det hele" (han sov; ingen prøve med
rigtige telefoner før bygningen — se Dance Beat).

## Mini Racers (`games/racer/`) — 2–12

- **Bane**: en lukket sløjfe (radius som sum af sinusser, så den aldrig krydser sig selv) på et kæmpe køkkenbord set
  fra oven, 8 m bred. Uden for vejen er dugen (langsom, glat); uden for bordkanten falder bilen ned og sættes på vejen
  igen efter 1,5 s; mere end 10 m fra vejen inde midt på bordet er bilen "væk" og kommer tilbage på samme måde (ingen
  genvej over dugen). Bøger, kopper, kander osv. (Kattekaos' modeller) står rundt om banen; nogle få tæt på vejen er
  forhindringer.
- **Styring**: pinden peger, hvor bilen skal køre hen på skærmen (bilen drejer mod retningen) — lettere end venstre/højre
  set oppefra, når bilen kører nedad. A = speeder, B = bremse/bak. Bluetooth-controllere virker ens.
- **Micro Machines-regel**: kameraet følger feltet. Mere end `OUT_GAP` bag føreren (målt langs banen) = ude af runden, og
  alle, der stadig kører, får 1 point. `OUT_GAP` skrumper fra 20 til 8 m i løbet af runden (kameraet zoomer ind), og ingen er
  ude de første 4 s (køen fra startgitteret). Runden slutter, når én er tilbage (eller efter 60 s). Næste runde starter alle
  på rækker ved førerens plads. 5 runder; flest point vinder (lige: bedst i sidste runde).
- **Biler**: af primitiver i spillerens farve (krop, kabine, hjul, navneskilt) i stedet for genererede modeller — 12
  tydelige farver betyder mere end detaljer i 1,2 m-størrelse oppefra.

## Dance Beat (`games/dance/`) — 2–12

- **Alle danser samme koreografi**: pile i 4 baner (◀ ▲ ▼ ▶) ruller mod en linje nederst på fjernsynet; dyrene danser
  på en scene ovenover og får "Perfect/Great/Good/Miss" over hovedet. Én sang pr. spil (~80 s), skiftevis blandt 4.
- **Telefonen**: nyt layout `beat` med 4 store pileknapper. Et tryk sendes straks som `{t:'tap', lane, at}`.
- **Latens**: telefonen holder en ur-forskydning fra konsollens ping (`at` i ping minus telefonens tid; største værdi af
  de seneste 10 = mindst forsinkelse). Et tryk stemples med konsollens ur, så wifi-ryk ikke flytter trykket; konsollen
  lægger halv ping-tid til. Stemplet gælder, til det er ping-tiden + 0,5 s gammelt (et wifi-ryk gør det kun ældre), og
  en pil er først Miss 0,35 s efter Good-vinduet, så et stemplet tryk kan nå frem. Bluetooth-controllere: pind/d-pad i
  en retning eller A (= banen med den nærmeste pil). Tryk før første pil ignoreres.
- **Bedømmelse**: |afvigelse| ≤ 50 ms Perfect 300, ≤ 100 Great 200, ≤ 150 Good 100; en pil, der passerer uden tryk, er
  Miss. Et tryk uden pil i nærheden bryder kæden. Kæde-gange: ×1, ×1,5 fra 10, ×2 fra 20, ×2,5 fra 30.
- **Takter**: musik fra ACE-Step med fast tempo; takterne findes med librosa på udviklingsmaskinen
  (`tools/beats.py` → `public/data/dance.json`). Koreografien laves af takterne ved spilstart (frø): hver anden takt i
  starten, så hver takt, så halve takter i stykker mod slutningen.
- **Ur**: sangens `currentTime`, når musikken spiller; uret står stille, til sangen er begyndt (højst 3 s); headless og
  før første tryk: spillets eget ur.
- **Til prøven med rigtige telefoner**: resultatlisten viser hver spillers gennemsnitlige afvigelse ("+35 ms late").
  `?beat=<ms>` forsinker spillets ur (pile, lys og bedømmelse), hvis fjernsynet forsinker lyden.
- **Risiko (fra planen)**: latensen er ikke prøvet med to rigtige telefoner. Spillet er bygget, så prøven kan laves
  med selve spillet.

## Platform

- `answers.js`: `{t:'tap', lane: 0–3, at}` — **testet**.
- Controlleren: layout `beat`; ur-forskydning fra ping.
- `audio.js`: `song(name)` afspiller en sang én gang fra start og giver dens tid.

## Ren logik (testet)

`racer/track.js`, `racer/physics.js`, `racer/rules.js`, `racer/ai.js`; `dance/chart.js` (koreografi og bedømmelse),
`dance/rules.js`.
