# Plan: 9 spil mere til Konsol

Skrevet 2026-10-23, rettet 2026-10-25 efter Peters svar. Konsollen har ét spil (Ice Floe Sumo) og
plads til 2–12 spillere. Målet er 10 spil i alt.

**Faste regler for alle spil (Peter, 2026-10-25):**
- **Altid 2–12 spillere.** Intet spil har et lavere loft (Mini-racer og Kattekaos-arena er rettet til 12).
- **Al tekst, spillerne ser, er på engelsk** — på fjernsynet og på telefonen. Værten taler engelsk
  (Chatterbox med `language: en`). Spørgsmål, ord og ordpar laves på engelsk.
- **Ingen børneudgave.**
- **Ingen point på tværs af spil**; hvert spil kårer sin egen vinder. Hvert spil er et modul i `public/src/games/<id>/` med ren, testet
logik som `sumo/` og bruger samme pipeline til 3D, billeder, tale og musik på asset-serveren.

## Hvad spillene skal kunne, som konsollen ikke kan i dag

I dag har en telefon kun pind + A/B og en tekstlinje. Halvdelen af idéerne nedenfor kræver mere,
så **fase 0 er platformen**, før de spil, der har brug for den:

| udvidelse | hvad | bruges af |
|---|---|---|
| **Controller-layouts** | konsollen sender `{t:'layout', kind}`: `pad` (som nu), `choices` (2–6 store knapper med tekst/farve), `text` (tastatur + send), `draw` (lærred) | Quiz, Tegn og gæt, Forræderen, Rytme |
| **Svar fra telefonen** | ny besked på `ctl`-kanalen (pålidelig): `{t:'answer', value}`; spillet får `onAnswer(id, value)` | samme |
| **Tegning over nettet** | strøg som korte punktlister (`{t:'stroke', pts}`) på `ctl`, tegnet på fjernsynet efterhånden | Tegn og gæt |
| **Hold** | `ctx.teams(n)` deler spillerne i n lige store hold med holdfarver; lobbyen viser dem | Snebold, Bilbane (valgfrit) |
| **Musik pr. spil** | `public/music/<spil>.mp3` fra ACE-Step, afspillet af `audio.music(id)` med fade | alle |
| **Latens-måling** | konsollen pinger hver telefon over `ctl` og kender dens forsinkelse (ms) | Rytme |
| **Fælles 3D-scene** | lys, hav/gulv, kamera der følger alle spillere, navneskilte — ud af `sumo/view.js` til `games/common/` | alle 3D-spil |

Fase 0 er én opgave med tests (layouts og svar kan testes som `net.test.js` med falske kanaler)
og et lille demo-spil ("Hvem er hurtigst?": tryk på den rigtige farve), der bruger `choices`.

## De 9 spil

Rækkefølgen er valgt, så hvert spil enten genbruger noget, der findes, eller bygger det, de næste
skal bruge. **S/M/L** er omfang (S ≈ som Sumo, L ≈ dobbelt).

### 1. Penguin Race (Pingvinræs) — 2–12 · S
Alle glider på maven ned ad en lang isbane med sving, hop og fisk. Pind = styr, A = spring.
Kameraet følger førerfeltet; den, der falder ud bag kameraet, er ude af runden (først over
målstregen vinder). **Genbruger** alle 12 dyr og isflagens fysik (glid, stød).
**Assets:** banedele (isblokke, fisk, flag) som 3D, musik (hurtig, glad).
**Ny platform:** fælles 3D-scene med kamera, der følger mange.

### 2. Quiz Night (Hvem ved mest?) — 2–12 · M
Fjernsynet viser spørgsmålet, værten læser det op på engelsk, telefonerne viser 4 svarknapper.
Hurtigste rigtige svar giver flest point. Kategorier: Danmark, dyr, film, mad, sport (på engelsk).
**Spørgsmålene** laves på forhånd på engelsk med serverens LLM (Gemma) og tjekkes af et
andet LLM-kald + stikprøver; de ligger som JSON i spillet (ingen live-LLM under spillet).
**Assets:** et billede pr. spørgsmål (Z-Image), værtens oplæsning (Chatterbox `en`, tjekket med Whisper),
studie-musik. **Ny platform:** `choices`-layout, `onAnswer`.

### 3. Kattekaos-arena — 2–12 · M
Alle er katte på mormors store spisebord (langbord, så der er plads til 12). Slå ting ned for point; når mormor vender sig, skal man
stå stille, ellers mister man point. Man kan skubbe hinanden. **Genbruger** Kattekaos' modeller,
mormors tilstande (`kattekaos/src/owner.js` kopieres) og stemme. **Assets:** 12 kattevarianter
(farver) + flere ting. Mormors replikker indtales igen på engelsk. **Ny platform:** ingen.

### 4. Draw & Guess (Tegn og gæt) — 3–12 · M
Én spiller får et ord på telefonen og tegner det på telefonens lærred; tegningen vises live på
fjernsynet. De andre gætter ved at skrive på telefonen. Point til tegneren og de hurtigste gættere.
**Ordlister** fra LLM'en (engelsk). **Ny platform:** `draw`- og `text`-layout,
strøg over nettet. **Risiko:** stavefejl i gæt — sammenlign uden store/små bogstaver og med
afstand ≤ 1.

### 5. Snowball Fight (Snebold-krig) — 2–12, hold · M
To hold på en snedækket bane med forter. Pind = løb, A = kast (hold for længere), B = dukke.
Tre træffere og man er ude til runden er slut. **Genbruger** idéer fra `vr/sneboldkamp/`.
**Assets:** fort, træer, snemænd, dyrene i halstørklæde i holdfarve (tint i stedet for nye modeller).
**Ny platform:** hold.

### 6. Hot Potato (Varm kartoffel) — 3–12 · S
En tikkende bombe (en fisk, der blinker) ryger rundt. Man giver den videre ved at støde ind i
nogen. Når den springer, er bæreren ude. Sidste overlevende vinder. Kort, kaotisk, godt
mellem længere spil. **Genbruger** Sumo-fysikken næsten uændret.
**Assets:** bomben, lyde (tik, bang). **Ny platform:** ingen.

### 7. Mini-racer — 2–12 · L
Små 3D-biler på et stort bord set fra oven (Micro Machines); banen er bred nok til 12. Pind = styr, A = speeder, B = bak.
Falder man bag kameraet, får de andre et point. Godt med Bluetooth-controllere.
**Assets:** biler (en pr. farve via tint), baneting (bøger, kopper, blyanter som forhindringer).
**Ny platform:** ingen, men bilfysik er mere arbejde end resten.

### 8. Who's the Traitor? (Hvem er forræderen?) — 4–12 · M
Alle får et hemmeligt ord på telefonen — undtagen forræderen, der får et lignende ord. Man siger
på skift ét ord højt om sit ord (fjernsynet viser rækkefølgen), og derefter stemmer alle på
telefonen. **Ordpar** fra LLM'en (engelsk). Intet 3D; fjernsynet viser en flot illustreret scene (Z-Image)
og afstemningen. **Ny platform:** private skærme (findes i grunden: `notify` pr. spiller) og
`choices` med spillernavne.

### 9. Dance Beat (Dansetakt) — 2–12 · M
Dyrene danser på en scene; pile/farver ruller mod en linje, og man trykker A (eller pinden i
retningen) i takt. Musikken laves med ACE-Step, og takterne findes med en beat-tracker på
udviklingsmaskinen (ikke live). **Ny platform:** latens-måling pr. telefon (WebRTC + wifi er
30–80 ms; uden kompensation føles det forkert). **Risiko:** størst af alle — prøv latensen med
to rigtige telefoner, før resten bygges.

## Rækkefølge og milepæle

| fase | indhold | hvorfor her |
|---|---|---|
| 0 | platform: layouts, svar, fælles 3D-scene, musik | låser op for 2, 4, 8, 9 |
| 1 | Pingvinræs, Varm kartoffel | små, genbruger Sumo — hurtigt flere spil i menuen |
| 2 | Hvem ved mest?, Hvem er forræderen? | første spil med telefon-skærme; ingen 3D-risiko |
| 3 | Kattekaos-arena, Snebold-krig (+ hold) | større 3D-spil med kendte assets |
| 4 | Tegn og gæt | kræver tegning over nettet |
| 5 | Mini-racer, Dansetakt | mest fysik / latens-risiko til sidst |

Efter hver fase: spil det med rigtige telefoner i stuen, før næste fase starter.

## Lobbyen med 10 spil

Spilkortene bliver en vandret karrusel (pinden ←/→, som nu), med antal spillere og en
lille animation af spillets dyr. Spil, der ikke passer til antallet i rummet, vises dæmpet med
"3–12 spillere". En "Tilfældigt spil"-knap til sidst.

## Asset-plan (GPU, ét job ad gangen)

| spil | 3D | billeder | tale | musik | sfx |
|---|---|---|---|---|---|
| Pingvinræs | ~8 banedele | – | 3 replikker | 1 | 3 |
| Hvem ved mest? | – | ~150 (ét pr. spørgsmål) | ~150 spørgsmål + 10 replikker | 1 | 4 |
| Kattekaos-arena | 7 katte, ~6 ting | – | genbrug mormor | 1 | genbrug |
| Tegn og gæt | – | – | 5 replikker | 1 | 2 |
| Snebold-krig | ~6 | – | 4 replikker | 1 | 4 |
| Varm kartoffel | 1 | – | 3 replikker | 1 | 2 |
| Mini-racer | ~4 biler, ~8 ting | – | 3 replikker | 1 | 4 |
| Forræderen | – | ~10 scener | 6 replikker | 1 | 2 |
| Dansetakt | scene, 2 ting | – | 3 replikker | 4 sange | 2 |

Quizzen er den største GPU-post (~300 job); kør den om natten. Replikkerne tjekkes med Whisper på engelsk (`tools/tts-check.py en`).

## Status

- **Fase 0 færdig** (2026-10-25): layouts (`choices`, `text`, `draw`), svar over `ctl`, ping-tid, hold
  (`teams.js`), musik pr. spil, fælles 3D-scene (`games/common/`), lobby-karrusel med "Random game".
  Demo-spillet blev til et rigtigt spil: **Color Rush**.
- **Fase 1 færdig**: **Penguin Race** og **Hot Potato**. Afvigelse: i Penguin Race er man ude 20 m (ikke 28 m)
  bag føreren, så den sidste er i billedet.
- **Fase 2 færdig** (2026-10-25): **Quiz Night** (131 spørgsmål med billede og oplæsning) og **Who's the
  Traitor?** (63 ordpar, 6 baggrunde). Afgørelser: højst 3 omgange ledetråde pr. runde (så slipper forræderen
  væk); en uafgjort afstemning tæller som en omgang; 7 ordpar fjernet, fordi ordene næsten betød det samme.
- **Fase 3 færdig** (2026-10-25): **Cat Chaos** (Kattekaos-arena; mormor fra Kattekaos, op til 12 katte på et
  16 × 8 m bord) og **Snowball Fight** (rød mod blå). Afvigelser: kattene farves med spillerens farve i stedet for 12
  nye modeller; bordet fyldes op med nye ting, når der er under 10 tilbage (12 katte tømmer det på få sekunder);
  mormor taler engelsk med den danske stemme `coral_nic`. Snebold: ingen nye 3D-modeller — fort og træer af primitiver.
- **Fase 4 færdig** (2026-10-25): **Draw & Guess** (227 ord; alle tegner én gang, med 2–4 spillere to gange).
  Tegnestrøg har nu lærredets format med, så tegningen ikke forvrænges på fjernsynet.
- **Fase 5 færdig** (2026-10-25): **Mini Racers** og **Dance Beat** — alle 11 spil er bygget. Afvigelser: bilerne er
  af primitiver i spillerens farve (ingen genererede biler); pinden peger, hvor bilen skal hen (ikke venstre/højre),
  fordi bilen ofte kører nedad set oppefra; afstanden, man må være bagud, skrumper fra 20 til 8 m i løbet af en runde
  (ellers varede runderne med bots altid til tidsgrænsen), og ingen er ude de første 4 s (køen fra startgitteret).
  **Dance Beat blev bygget uden prøven med to rigtige telefoner** (Peter: "bare tag det hele"); i stedet stempler
  telefonen trykket med konsollens ur, og resultatlisten viser hver spillers gennemsnitlige afvigelse, så prøven kan
  laves med selve spillet. Alle danser samme koreografi (12 baner ville ikke være til at se).
- **Fase 6–8** (2026-10-25, Peter: "Gør det hele" om 10 Mario Party-idéer): **Color Panic**, **Musical Chairs**,
  **Coin Grab**, **Bombs Away** (Sumo-fysikken; fælles "sidste mand står" i `common/survival.js`), **Plunger Roulette**,
  **Simon Says**, **Pipe Maze**, **Tug of War** (telefonknapper), **Tightrope** (ny platform: telefonens hældning) og
  **Bomber King** (1 mod alle). Konsollen har nu 21 spil. Specs: `docs/superpowers/specs/2026-10-25-fase-6/7/8-design.md`.
- Næste: spil fase 3–8 i stuen; prøv Dance Beat med rigtige telefoner (se afvigelsen på resultatlisten; `?beat=<ms>`,
  hvis fjernsynet forsinker lyden).

## Afklaret

- Ingen børneudgave, altid 12 spillere, ingen point på tværs (Peter, 2026-10-25).
- Alt, der skal læses, er på engelsk; konsollen og Sumo er oversat samme dag, og dommeren taler engelsk.
