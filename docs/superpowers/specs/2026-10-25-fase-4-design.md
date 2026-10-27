# Fase 4 — Draw & Guess

Dato: 2026-10-25. Bygger på `docs/spilplan.md` (fase 4) og Peters "Du giver den bare gas".

## Spillet (`games/draw/`) — 2–12

- **En tur**: tegneren får 3 ord på telefonen (`choices`, 10 s; ellers det første) og tegner det valgte med
  fingeren (`draw`, 60 s). Tegningen vises live på fjernsynet. De andre skriver gæt (`text`); forkerte gæt vises på
  fjernsynet (det er sjovt), næsten-rigtige ("So close!") kun på gætterens telefon, så ordet ikke afsløres.
- **Gæt**: uden store/små bogstaver, mellemrum og tegn; én stavefejl er ok i ord på 5+ bogstaver (afstand ≤ 1),
  afstand 1 over grænsen er "close".
- **Ledetråd**: ordets bogstaver som streger; et bogstav afsløres ved halv tid og ét til ved 3/4 (højst længde/4).
- **Point**: rigtigt gæt 50 + op til 150 for fart; tegneren 50 pr. gætter. Turen slutter, når alle (tilsluttede)
  har gættet, eller tiden er gået. Afsløring 5 s.
- **Ture**: alle tegner én gang; med 2–4 spillere to gange (aldrig den samme to gange i træk).
- **Frafald**: forsvinder tegneren, springes turen over; en gætter, der forsvinder, ventes der ikke på.
- **Ord**: `public/data/draw.json` — 260 fra serverens LLM (`tools/drawwords.mjs`, 12 temaer), 33 fjernet ved
  gennemlæsning (dubletter, svære at tegne, tvetydige) → 227. Brugte ord huskes i `localStorage`
  (`konsol-draw-used`) og kommer bagerst.

## Platform

- Et tegnestrøg har lærredets format med (`ar` = bredde/højde, 0,3–4), så fjernsynet tegner uden at forvrænge.
  **Testet** (answers).
- `?game=<id>` uden `auto` vælger kortet i lobbyen (til tests).
- `tools/e2e-draw.mjs` (med i `npm run e2e`): to telefoner, ordvalg, tegning med musen, strøgene på fjernsynet,
  forkert og rigtigt gæt, afsløring.

## Lyd

Værten: "Draw and guess!", "Time's up!", "Everybody got it!"; musik `draw`.

## Ren logik

`games/draw/rules.js` — **testet**: `judge`, `hint`, turrækkefølge, ordvalg med timeout, ingen ord to gange,
point efter tid og til tegneren, turens slutning, frafald, brugte ord bagerst, rangliste.
