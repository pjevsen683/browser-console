# Konsol

Telefonen er spillekonsollen. Den sidder i et HDMI-kabel til fjernsynet og kører
denne PWA i landscape; skærmen spejles. 2–12 spillere scanner QR-koden og
bruger deres egen telefon som controller (op til 4 Bluetooth-controllere kan
blandes ind). Alle er på samme wifi — det er en spilleregel. **Al tekst, spillerne
ser, er på engelsk** (fra 2026-10-25; dokumentation og kommentarer er på dansk).
Offentligt fra 2026-10-16.

**Adresse:** https://konsol.mobil.peter87.dk/ (controller: `/c.html?g=KODE`)

Spillene (alle 2–12 spillere):

| spil | mappe | kort |
|---|---|---|
| **Ice Floe Sumo** | `games/sumo/` | dyr på en isflage, der smelter; A skubber; sidste på isen vinder runden, først til 3 |
| **Penguin Race** | `games/race/` | glid ned ad en bugtet isbane; A hopper, fisk giver fart; mere end 20 m bag føreren = ude; 3 løb |
| **Mini Racers** | `games/racer/` | små biler på et køkkenbord set oppefra; pinden peger, A speeder, B bremser; for langt bagud = ude, de andre +1; 5 runder |
| **Hot Potato** | `games/potato/` | en bombe går videre ved stød; sprænger den, er bæreren ude; sidste overlevende vinder |
| **Color Panic** | `games/panic/` | en farve meldes; stå på et felt i den farve, før resten synker; sidste mand står |
| **Musical Chairs** | `games/chairs/` | musikken stopper: én pude færre end spillere; den uden pude er ude |
| **Coin Grab** | `games/coins/` | saml faldende mønter; et A-skub får den ramte til at tabe mønter; flest efter 60 s |
| **Bombs Away** | `games/bombs/` | undgå bombernes skygger og vandet; sidste mand står |
| **Tug of War** | `games/tug/` | rød mod blå; hamr på A for at trække rebet; tempoet pr. spiller tæller; først til 2 |
| **Bomber King** | `games/bomber/` | 1 mod alle: skiftevis er én bombemand (pind sigter, A smider), de andre undviger |
| **Tightrope** | `games/rope/` | gå over kløften på din line; vip telefonen (layout `tilt`) eller pinden imod vindstødene |
| **Cat Chaos** | `games/cats/` | katte på mormors lange bord; slå ting ned for point; står man ikke stille, når mormor kigger: −250; 90 s |
| **Snowball Fight** | `games/snowball/` | rød mod blå; A holdt nede lader op, slip kaster, B dukker; 3 træffere og ude; først til 2 runder |
| **Color Rush** | `games/colors/` | tryk på blækkets farve på telefonen (svarknapper); 10 runder |
| **Plunger Roulette** | `games/plunger/` | på skift vælger man en udløser på telefonen; én er bomben; sidste mand står |
| **Simon Says** | `games/simon/` | RED!/BLUE!/NOT RED!/DON'T TOUCH! — tryk rigtigt i tide, ellers ude |
| **Pipe Maze** | `games/pipes/` | følg rørene: hvilket fører vandet til skatten? hurtigt og rigtigt giver point; 6 runder |
| **Draw & Guess** | `games/draw/` | én tegner sit ord på telefonen, tegningen vises live; de andre skriver gæt; alle tegner |
| **Dance Beat** | `games/dance/` | pile ruller mod en linje; tryk pilen på telefonen i takt (Perfect/Great/Good, kæde); én sang pr. spil |
| **Quiz Night** | `games/quiz/` | 10 spørgsmål med billede og oplæsning; svar på telefonen; fart giver point |
| **Who's the Traitor?** (4–12) | `games/traitor/` | hemmelige ord; én har et andet ord; ét ord hver, så stemmer alle; 3 runder |

Lobbyen har også et "Random game"-kort.

Design og plan: `docs/superpowers/specs/2026-10-16-konsol-design.md` og
`docs/superpowers/plans/2026-10-16-konsol.md`. **Planen for 9 spil mere:**
`docs/spilplan.md` (de første idéer: `docs/ideer.md`).

## Kom i gang

```bash
npm install          # three.js, qrcode-generator, puppeteer-core (e2e), gltf-transform (værktøj)
./sync-vendor.sh     # kopierer three.js og QR-encoderen ind i public/vendor/ (genereret, git-ignoreret)
npm test             # ren logik: signalserver, spillerliste, lobby, sumo
npm run e2e          # headless Chrome: konsol + 2 controllere over rigtig WebRTC og via server; Draw & Guess hele vejen; Dance Beats tryk
node server.js       # http://localhost:8091/  (luk med: kill $(cat server.pid) — aldrig pkill -f)
```

Ingen byggekæde: ES-moduler og en import map. Browserkoden ligger i `public/src/`.

## Uden telefoner

| konsol (`/`) | virkning |
|---|---|
| `?bots=N` | N falske spillere (de trykker selv A i lobbyen og spiller med spillets bot) |
| `&auto=1` | spring lobbyen over og start spillet med det samme |
| `&game=<id>` | hvilket spil `auto` starter (standard: det første); uden `auto` er kortet valgt i lobbyen |
| `&seed=N` | fast tilfældighed |
| `&prewarm=N` | simulér N sekunder uden at tegne (til headless-billeder) |
| `&nosw=1` | ingen service worker |
| `&ws=<url>` | en anden signalserver |

| controller (`/c.html`) | virkning |
|---|---|
| `?g=KODE` | udfylder koden (QR-koden giver den) |
| `&name=X` | tilmelder med det samme |
| `&nortc=1` | ingen WebRTC — alt går via serveren (test af reserven) |
| `&nosw=1`, `&ws=<url>` | som på konsollen |

`tools/shot.sh ud.png 'bots=6&auto=1&prewarm=6'` tager et 1280×720-screenshot;
`tools/shot.sh ud.png 'g=KODE&name=X' 844,390 c.html` et af controlleren.
Fejlboksen nederst på konsollen viser JS-fejl (kan læses med `--dump-dom`).
Konsollen har `window.__konsol` og controlleren `window.__pad` til tests.

## Filerne

| fil | ansvar |
|---|---|
| `server/signal.mjs` | signalserveren: rum pr. kode, håndtryk og reserve videresendes — **testet** |
| `server/ws.mjs` | WebSocket (RFC 6455), kopi af Tinsoldats med én rettelse (se Faldgruber) |
| `server.js` | dev-server: `public/` + signalserveren på `/ws` |
| `public/src/input/players.js` | spillerlisten: farver, latch af knaptryk, løbenummer, "tabt" efter 1 s — **testet** |
| `public/src/input/normalize.js` | dødzone og cirkel-klip, rensning af input — **testet** |
| `public/src/input/gamepads.js` | Bluetooth-controllere via Gamepad-API'et — `readPad` **testet** |
| `public/src/net/signal-client.js` | WebSocket, der genåbner sig selv |
| `public/src/net/host-net.js` | konsollens WebRTC: tilbud, kanalerne `in`/`ctl`, reserve |
| `public/src/net/pad-net.js` | controllerens WebRTC og reserve |
| `public/src/console/main.js` | konsollen: 16:9-scene, lobby → spil → resultat, løkken |
| `public/src/console/lobby-state.js` | klar, spilvalg, nedtælling — **testet** |
| `public/src/console/lobby.js` | lobbyens DOM |
| `public/src/console/hud.js` | overlaget under et spil (point, banner, strimmel), `esc()` |
| `public/src/console/qr.js` | QR-koden |
| `public/src/console/bots.js` | `?bots=N` |
| `public/src/controller/main.js` | controllerens pind, A/B, vibration |
| `public/src/input/answers.js` | renser beskeder fra telefonens ctl-kanal (svar, tegnestrøg, pong) — **testet** |
| `public/src/console/teams.js` | holdinddeling til holdspil — **testet** |
| `public/src/games/index.js` | listen over spil |
| `public/src/games/common/` | fælles 3D: `scene.js` (scene, hav, dyr med ring/skilt), `placeholder.js`, `species.js` |
| `public/src/games/race/` | Penguin Race: `track.js`, `physics.js`, `rules.js`, `ai.js` (**testet**), `view.js`, `index.js` |
| `public/src/games/potato/` | Hot Potato: `rules.js`, `ai.js` (**testet**), `view.js`, `index.js` (bruger sumo-fysikken med `walls`) |
| `public/src/games/colors/` | Color Rush: `rules.js` (**testet**), `index.js` (DOM i `hud.layer`, ingen 3D) |
| `public/src/games/quiz/` | Quiz Night: `rules.js` (**testet**), `index.js`; data i `public/data/quiz.json`, billeder i `public/quiz/`, oplæsning i `public/voice/quiz/` |
| `public/src/games/traitor/` | Who's the Traitor?: `rules.js` (**testet**), `index.js`; ordpar i `public/data/traitor.json`, baggrunde i `public/traitor/` |
| `public/src/games/cats/` | Cat Chaos: `owner.js` (mormor, kopieret fra Kattekaos), `physics.js`, `rules.js`, `ai.js` (**testet**), `view.js`, `index.js`; modellerne er Kattekaos' (`table`, `owner`, `cat`, 13 ting) |
| `public/src/games/snowball/` | Snowball Fight: `physics.js`, `rules.js`, `ai.js` (**testet**), `view.js`, `index.js`; hold fra `console/teams.js` |
| `public/src/games/draw/` | Draw & Guess: `rules.js` (**testet**), `index.js` (DOM i `hud.layer`); ord i `public/data/draw.json` |
| `public/src/games/common/survival.js` | sidste mand står (2–3 spillere: bedst af 3; alle ude på én gang = ingen ude) — **testet** |
| `public/src/games/common/rink.js` | rund arena til spillene på Sumo-fysikken |
| `public/src/games/panic/`, `chairs/`, `coins/`, `bombs/` | fase 6 (Mario Party-idéer): `rules.js`, `ai.js` (**testet**), `view.js`, `index.js`; alle på `sumo/physics.js` |
| `public/src/games/plunger/`, `simon/`, `pipes/` | fase 7: `rules.js` (**testet**), `index.js` (DOM i `hud.layer`, layout `choices`) |
| `public/src/games/tug/` | Tug of War: `rules.js`, `ai.js` (**testet**), `view.js`, `index.js` |
| `public/src/input/tilt.js` | telefonens hældning som pind (layout `tilt`) — **testet** |
| `public/src/games/rope/`, `bomber/` | fase 8: `rules.js` (+ `ai.js` i rope) **testet**, `view.js` (rope), `index.js`; Bomber King genbruger `bombs/view.js` og `bombs/ai.js` |
| `public/src/games/racer/` | Mini Racers: `track.js` (lukket sløjfe, bord, ting), `physics.js`, `rules.js`, `ai.js` (**testet**), `view.js` (biler af primitiver), `index.js`; tingene er Kattekaos' modeller |
| `public/src/games/dance/` | Dance Beat: `chart.js` (koreografi, bedømmelse), `rules.js` (tryk, Miss, `tapTime`), `ai.js` (**testet**), `view.js` (scene, dyr), `index.js` (pilebane på et lærred i `hud.layer`); sange og takter i `public/data/dance.json` |
| `public/src/games/sumo/physics.js` | isflagen: glid, skub, stød, fald, smeltning — **testet** |
| `public/src/games/sumo/rules.js` | runder, point, først til 3 — **testet** |
| `public/src/games/sumo/ai.js` | botten — **testet** |
| `public/src/games/sumo/view.js` | 3D: hav, flage, dyr, navneskilte |
| `public/src/games/sumo/index.js` | spilmodulet, der binder det sammen |
| `public/src/audio.js` | syntetiske lyde; dommerens stemme fra `public/voice/`, når den findes |
| `public/src/assets.js` | GLB fra `public/models/`, når den findes, ellers `null` |

## Netværk

- Konsollen sender `{t:'host', code?}` og får en kode på 4 bogstaver (intet I/O). Koden gemmes, så en genindlæst konsol får den samme.
- En controller sender `{t:'join', code, name, pid}`; `pid` ligger i telefonens `localStorage`, så samme telefon får samme plads og farve igen.
- Konsollen tilbyder WebRTC (én forbindelse pr. controller); `signal`-beskeder går gennem serveren. Kanalen `in` er uordnet uden gentagelser (input), `ctl` er pålidelig (farve, tekst, vibration).
- **Ingen STUN/TURN:** alle er på samme wifi, så værtskandidater er nok.
- **Reserve:** indtil `in` er åben, går input som `relay` over WebSocket; controlleren beder om et nyt tilbud hvert 10. s. Løbenummeret `s` i hver inputbesked fjerner dubletter og gammelt input.
- Grænser i serveren: 12 controllere pr. rum, 4 KB pr. besked, 100 rum, 120 beskeder/s, rum uden konsol lukkes efter 60 s, `ORIGINS` tjekkes.

## Telefonens layouts (fase 0, 2026-10-25)

Konsollen sender `{t:'layout', kind}` på `ctl`: `pad` (pind + A/B), `choices` (`prompt`, `options:
[{label, color}]`, 2–6 knapper, ét svar), `text` (`prompt`, `max`), `draw` (`prompt`; lærred, Clear,
Done), `beat` (4 pileknapper, Dance Beat), `tilt` (pad + "Use tilt": telefonens hældning styrer pinden; Recenter, Flip, Stick). Telefonen svarer med `{t:'answer', value}`, `{t:'stroke', pts|clear, ar}` (`ar`: lærredets bredde/højde) og `{t:'tap', lane, at}` via `PadNet.sendCtl`
(over `ctl`-kanalen, ellers via serveren); konsollen renser dem med `parseCtl` og giver dem til
`game.onAnswer(id, msg)`. Ved spilstart og -slut får alle `pad`. Konsollen pinger hver telefon hvert
2. s; `player.rtt` er ping-tiden (vises i lobbyen). Telefonen holder konsollens ur ud fra pingenes `at` (største
forskel af de seneste 10 = mindst forsinkelse) og stempler Dance Beats tryk med det (`at`); konsollen lægger halv
ping-tid til og stoler kun på stemplet, hvis det passer med ping-tiden (`dance/rules.js` `tapTime`).

## Et nyt spil

En mappe i `public/src/games/<id>/` og én linje i `games/index.js`. Modulet:

```js
export default {
  id, title, emoji, how, minPlayers, maxPlayers,
  start(ctx) {   // ctx: { players, rng, audio, hud, notify(id, msg), seed }
    return { update(dt, players), render(renderer), dispose(), done: null /* {ranking, title?} */,
      bot(id), hello(id), layoutFor(id), onAnswer(id, msg) /* alle valgfri */ };
  },
};
```

En spiller er `{ id, name, color, source, rtt, input: { x, y, a, b, aPressed, bPressed } }`.
`hud` har `layer` (et tomt DOM-lag til spil uden 3D), `scores(rows)` (en række kan have `text` i stedet
for prikker), `center`, `banner`, `tick`. 3D-spil bygger på `games/common/scene.js`. `def.music`
(standard `def.id`) vælger musikken i `public/music/`. `ranking`-rækker kan have `text`.
`notify(id, {t:'state', text, score})` og `{t:'buzz', ms}` når spillerens telefon.
Hold logikken ren og testet som i `sumo/`. Husk filerne i `public/sw.js`.

## Udrulning

```bash
./deploy.sh          # tests + rsync public/ -> /home/peter/dockers/home-proxy/public/mobil/konsol
./deploy-server.sh   # tests + rsync server/ -> /home/peter/dockers/konsol-signal + docker-run.sh
```

Caddy-blokken `konsol.mobil.peter87.dk` (indsat 2026-10-16, backup
`Caddyfile.bak-2026-10-16-before-konsol`): `handle /ws` → `127.0.0.1:3260`,
ellers `file_server`. `caddy validate` før `reload` — Caddyfilen fronter alle sites.

## Assets

Lavet på asset-serveren (nu `10.1.0.21:8200`) 2026-10-18; noterne pr. model står i
`asset-generation/generated/<navn>.md`, rækkefølgen i `asset-generation/generated/README.md`.

| art | status |
|---|---|
| pingvin, sæl, rensdyr, polarræv, snehare | gode første gang (res 1024, faces 8000, remesh 384) |
| havørn | job ae1a931b (extra 5,13 % — består efter serverens nye grænse på 10 % for extra) |
| isbjørn, lunde | ødelagte skaller indtil serverrettelsen 2026-10-18; nu ac97363c, a04680a0 (res 1024) |
| hvalros, moskusokse | res 512 (1024 løber tør for VRAM på 8 GB); nu 0a4266d9, ff87973d efter serverens nye forsøg; moskusoksen har `yaw -90` |
| narhval, lemming | 2026-10-23, til spiller 11 og 12: 53a37100 (res 1024), 60f3357c (res 512; 1024 løb tør for VRAM) |

Serverens fejl (rettet 2026-10-18 af dens egen agent): UDF-remeshen lavede en indadvendt indre skal,
som overlevede, når den havde flest trekanter (pels, runde former), og på res 512 voksede de to skaller
sammen. Kendetegn: face-tallet endte 13–24 % under målet. Serveren fjerner nu alle indadvendte skaller
og prøver et fejlet job én gang til med en grovere decimeringskilde (128³), så et sådant job tager ca.
dobbelt tid. De ødelagte filer ligger som `generated/*-broken.glb`. `public/dev.html?m=a,b` viser
modeller fra fire sider; sæt yaw med `node tools/prepare.mjs <navn> --yaw <grader>`.

**Port 8091 kan være optaget** af et andet projekt på maskinen; så start dev-serveren med
`PORT=8093 node server.js` og `PORT=8093 tools/shot.sh …`.

Ordene til Draw & Guess (fase 4): `node tools/drawwords.mjs` (LLM'en, 12 temaer), læst igennem af Claude.

Quiz og ordpar (fase 2): `node tools/quiz.mjs` og `node tools/traitor.mjs` spørger serverens LLM (Gemma på
CPU'en, uden for GPU-køen; ~16 tokens/s — 144 spørgsmål tog ~1½ time). Quizzen krydstjekkes af LLM'en selv
(svarer uden facit; uenighed = forkastet), og kandidaterne læses igennem af Claude, før de kommer i
`public/data/`: af 144 blev 3 forkastet af krydstjekket og 13 fjernet ved gennemlæsning (forkerte, tvetydige,
afslører svaret). `node tools/quiz-assets.mjs` laver billede (Z-Image, `tools/images.mjs`, 960×540 WebP) og
oplæsning (Chatterbox `en`, Whisper ≥ 0,75) pr. spørgsmål. Et spil med data har `ready` (et løfte), som
`auto`/`prewarm` venter på.

Musik (ACE-Step, `node tools/music.mjs`, prompts i `asset-generation/music.json`, 96 kbit/s):
`lobby`, `sumo`, `colors`, `potato`, `race`, `cats`, `snowball`, `draw`, `racer`, `panic`, `chairs`, `coins`, `bombs`, `plunger`, `simon`, `pipes`, `tug`, `rope`, `bomber` — afspillet i løkke med fade (`audio.music`).
Dance Beats 4 sange (`dance-disco`, `dance-pop`, `dance-latin`, `dance-chip`, 80 s, fast tempo) spilles én gang af
`audio.song`; spillet har `music: false`. Takterne: `python3 tools/beats.py` (librosa på udviklingsmaskinen) søger det
jævne gitter, der rammer flest anslag — beat-trackeren hoppede mellem slag og efterslag i to af sangene — og skriver
`public/data/dance.json`. "Fiesta" blev 102,5 bpm, ikke de ønskede 104. `?beat=<ms>` forsinker spillets ur (pile, lys
og bedømmelse), hvis fjernsynet forsinker lyden.

Dommerens stemme (engelsk fra 2026-10-25; Chatterbox `language: en` med den indbyggede stemme):
"Three!", "Two!", "One!", "Push!", "Go, go, go!", "Round over!", "Splash! Only one left!", "We have a
winner!", "What a sumo champion!" — alle hørt fuldt af Whisper (`tools/tts-check.py en`). Mormor i Cat Chaos
taler med serverens kvindelige danske stemme `coral_nic` på engelsk (dansk accent; Whisper hørte alle ord, 0,68–0,99
engelsk). Replikkerne pr. spil står i `tools/voices.mjs`. Den danske
udgave (Røst + `coral_dk`) kunne ikke sige "vinder", og Whisper kunne ikke tjekke danske enstavelsesord.

## Faldgruber

**Højst 4 Bluetooth-controllere.** Det er browserens loft i Gamepad-API'et
(Chromium og Safari), ikke vores. Derfor er telefoner hovedvejen.

**Konsol-telefonen skal kunne sende video ud over USB-C** (fx Pixel 8+,
Samsung, iPhone 15+). Ellers bliver fjernsynet sort.

**`server/ws.mjs` afviger fra Tinsoldats.** En http-servers sockets er
halvåbne (`allowHalfOpen`), så en browser, der lukker, giver kun `end` og
aldrig `close`. Vores kopi lytter på `end`; uden det blev en forsvundet
telefon først opdaget af idle-tjekket efter 45 s. Tinsoldats kopi har samme
fejl og er ikke rettet.

**Brug aldrig `pkill -f "node server.js"`** — luk dev-serveren på `server.pid`.
`npm run e2e` starter sin egen server på port 8191 uden pid-fil og lukker den selv.
