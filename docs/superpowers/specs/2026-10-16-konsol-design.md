# Konsol — design

Dato: 2026-10-16. Status: godkendt i samtale, venter på gennemlæsning.

## Formål

En spillekonsol, der er en telefon. Telefonen sidder i et HDMI-kabel til
fjernsynet og kører en PWA i landscape; skærmen spejles. Op til 10 personer
spiller sammen i stuen. Alle er på samme wifi — det er en spilleregel, ikke en
antagelse, der skal bygges uden om.

Peter sagde:
- PWA i landscape, HDMI til fjernsyn, Bluetooth-controllere.
- Op til 10 spillere.
- Assets fra GPU-pc'en som de andre spil (`../../ASSETS-BILLEDER-OG-3D.md`).
- "Du skal lave det hele."
- Telefoner som controllere er hovedvejen; 4-spiller-spil kan godt bruge
  rigtige controllere; blanding er i orden.
- WebRTC direkte på wifi'et, med reserve over server — godkendt.
- GPU-pc'en er optaget resten af uge 42 (til og med 2026-10-18).

Antaget (ret mig):
- Konsol-telefonen kan sende video ud over USB-C (Pixel 8+, Samsung, iPhone 15+).
- Al tekst er på dansk, som Kattekaos.
- Adressen bliver `konsol.mobil.peter87.dk`.

Succes: Peter sætter telefonen i fjernsynet, åbner Konsol, 2–10 personer
scanner en QR-kode (eller trykker A på en controller) og spiller Sumo på
isflagen uden mærkbar forsinkelse.

## Hvorfor ikke 10 Bluetooth-controllere

Chromium og Safari giver højst 4 pladser i Gamepad-API'et, og telefonens
Bluetooth klarer i praksis 4–5 controllere. Derfor er gæsternes egne telefoner
controllere (som Kart Party i `../../Mario-cart/`), og op til 4 Bluetooth-
controllere kan blandes ind.

## Delene

| del | sti | ansvar |
|---|---|---|
| Konsollen | `public/index.html`, `src/console/` | Spilmenu, lobby, QR og kode, rendering, Wake Lock |
| Controlleren | `public/c.html`, `src/controller/` | Navn og farve, pind + A/B, vibration |
| Netværket | `src/net/` | Signalering, WebRTC-datakanal, WebSocket-reserve (bruges af begge sider) |
| Input-laget | `src/input/` | Gør gamepads og telefoner til ens spillere |
| Spillene | `src/games/<id>/` | Ét modul pr. spil |
| Signalserveren | `server/` | Rum pr. kode, videresender håndtryk og reserve-input. Egen container |
| Dev-serveren | `server.js` | Statiske filer + signalserveren i samme proces, lokalt |

Ingen byggekæde: ES-moduler og en import map; three.js kopieres ind i
`public/vendor/` af `sync-vendor.sh` som i Kattekaos. QR-koden tegnes af en lille
indlejret QR-encoder (ren JS, vendoret), så intet hentes udefra.

## Netværk

### Signalserveren (`server/`)

Node uden afhængigheder. WebSocket-implementeringen kopieres fra
`vr/red-alert/server/mp/ws.mjs` (RFC 6455, testet). Selvstændig kopi — en
rettelse dér når ikke hertil.

Rum:
- Konsollen sender `{t:'host'}` og får `{t:'room', code}`: 4 store bogstaver
  uden forvekslelige (ingen I, O, 0, 1). Sender konsollen `{t:'host', code}`
  efter en genindlæsning, genoptager den samme kode, hvis den er ledig.
- En controller sender `{t:'join', code, name, color, pid?}`. `pid` er et id,
  telefonen selv har gemt i `localStorage`; kommer den samme `pid` igen, er det
  den samme spiller (genforbindelse midt i spillet).
- Serveren giver hver controller et `peer`-nummer og fortæller konsollen
  `{t:'peer-join', peer, pid, name, color}` / `{t:'peer-leave', peer}`.
- `{t:'signal', to, data}` videresendes uændret mellem konsol og controller
  (SDP og ICE-kandidater).
- `{t:'relay', to?, data}` er reserven: input fra controller til konsol og
  beskeder fra konsol til controller, når datakanalen ikke er oppe.
- Grænser: højst 10 controllere pr. rum, beskeder højst 4 KB, højst 100 rum, et
  rum uden konsol i 60 s nedlægges. `Origin` skal være sitets egen adresse
  (miljøvariablen `ORIGINS`), som i Tinsoldats relay.

Serveren husker intet på disk. En genstart lukker rummene; konsollen opretter
selv et nyt, og controllerne forbinder igen.

### WebRTC

- Konsollen er den, der tilbyder (offer); hver controller har én
  `RTCPeerConnection` til konsollen. Stjernenet, ingen controller-til-controller.
- To datakanaler: `in` (uordnet, `maxRetransmits: 0`) til input og `ctl`
  (pålidelig) til vibration, spillets tilstand på controllerens skærm og
  genstart.
- Ingen STUN/TURN: samme wifi, så værtskandidater (mDNS `.local`) er nok.
  Kommer kanalen ikke op inden for 3 s, eller lukker den, skifter controlleren
  til `relay` over WebSocket og prøver WebRTC igen hvert 10. s i baggrunden.
- Konsollen viser pr. spiller, om forbindelsen er direkte (⚡) eller via server.

### Input-beskeder

Controlleren sender 30 gange i sekundet, og straks når en knap skifter:
`{s, x, y, a, b}` — løbenummer, pind i [-1, 1] (cirkel-klippet, dødzone 0,12),
knapper som 0/1. Konsollen bruger kun den nyeste (højeste `s`). Mangler en
spiller input i 1 s, sættes pinden til 0, og spilleren markeres som "tabt
forbindelse".

## Input-laget (`src/input/`)

Et spil ser kun:

```js
{ id, name, color, source: 'pad' | 'phone', connected, input: { x, y, a, b, aPressed, bPressed } }
```

`aPressed`/`bPressed` er sande i præcis den frame, knappen gik ned (beregnet i
input-laget ud fra forrige frame), så et spil ikke selv skal holde styr på kanter.

- `players.js` — listen af spillere, farver (10 tydelige farver), tilmelding og
  afmelding. Ren logik, testet.
- `gamepads.js` — aflæser `navigator.getGamepads()` hver frame. Standard-
  mapping: venstre pind eller d-pad → x/y, knap 0 → A, knap 1 → B. En controller
  tilmelder sig ved at trykke A i lobbyen og får navnet "Controller 1–4".
- `phones.js` — modtager input fra netværket og lægger det på spilleren.

Blanding er tilladt. Hvert spil har `minPlayers`/`maxPlayers`; lobbyen kan
ikke starte et spil uden for grænserne.

## Spilmoduler (`src/games/`)

```js
export default {
  id: 'sumo', title: 'Sumo på isflagen', minPlayers: 2, maxPlayers: 10,
  start(ctx) { /* ctx: { scene, camera, renderer, players, audio, assets, net, seed } */
    return { update(dt) {}, dispose() {}, done /* sættes, når spillet er slut: { ranking } */ };
  },
};
```

`src/games/index.js` er listen over spil. Et nyt spil er en ny mappe og én linje
dér. Konsollen ejer menu, lobby og resultatskærm; spillet ejer kun det, der
sker mellem start og slut.

## Første spil: Sumo på isflagen

- 2–10 dyr på en rund isflage i et koldt hav, set skråt oppefra, så alle er på
  skærmen.
- Pinden accelererer dyret; isen er glat (lav friktion, fart bevares). A er et
  skub: et kort fremstød med nedkøling på 1,2 s. Rammer to dyr hinanden, deles
  stødet efter fart og masse; et skub giver et ekstra stort stød.
- Flagen krymper i trin, når runden har varet 20 s, så runden altid ender.
- Falder et dyr over kanten, er det ude af runden, og telefonen vibrerer.
  Sidste dyr på flagen får et point. Først til 3 point vinder (ved 2 spillere
  også først til 3).
- Controllerens skærm viser dyrets farve, point og "ude"/"klar".
- Fysikken (`src/games/sumo/physics.js`) og runderne (`rules.js`) er ren logik
  uden three.js og testet. Rendering i `view.js`.

### Assets — uge 42 uden GPU

GPU-pc'en er optaget til og med 2026-10-18. Indtil da:
- Dyrene er lavpolygon-figurer af three.js-primitiver i spillerens farve
  (`src/games/sumo/placeholder.js`), isflage og hav er procedurale.
- Lyde syntetiseres i WebAudio; dommerens replikker vises som tekst.
- `asset-generation/assets.json` får prompts til pingvin, sæl, isbjørn, hvalros,
  rensdyr, polarræv, snehare, lunde, moskusokse, havørn og isflagen, og
  replikkerne til dommeren (serverens `roest`-model). Værktøjerne kopieres fra
  Kattekaos (`gen.mjs`, `models-all.sh`, `prepare.mjs`, `voices.mjs`) og
  tilpasses.
- `src/assets.js` henter `public/models/<navn>.glb`, hvis filen findes, og
  bruger ellers pladsholderen. Lyde tilsvarende. Når GPU'en er ledig, skal der
  kun genereres filer — ingen kodeændringer.

## Konsollens skærme

1. **Menu:** spillene som kort med titel og antal spillere. Vælges med
   controller eller ved tryk på telefonens skærm.
2. **Lobby:** QR-kode + kode i stort, adressen skrevet ud, spillerne som
   farvede pladser med navn og ⚡/server-mærke. "Tryk A på en controller for at
   være med." Hver spiller trykker A for "klar"; spillet starter 3 s efter, at
   alle er klar og der er mindst `minPlayers`. Et tryk på konsollens egen
   skærm starter med det samme (med de spillere, der er).
3. **Spil**, derefter **resultat** med "igen" / "andet spil". Spillerne bliver i
   rummet mellem spillene.

Konsollen holder skærmen tændt med Wake Lock, beder om fuldskærm og
`screen.orientation.lock('landscape')` ved første tryk, og tegner i
fjernsynets 16:9-format midt på skærmen uanset telefonens format.

## Fejl og kanttilfælde

- Konsollen genindlæses: genopretter sin kode; controllerne forbinder igen med
  deres `pid` og beholder plads og farve.
- En controller lukker browseren: spilleren markeres tabt; i lobbyen fjernes
  den efter 10 s, i et spil bliver dyret stående stille.
- 11. telefon: får "Rummet er fuldt".
- Forkert kode: "Ingen konsol med den kode".
- Signalserveren er nede: konsollen viser "Kan ikke nå serveren — kun
  controllere" og kan stadig bruges med Bluetooth-controllere.

## Test og værktøjer

- `npm test` (node --test): rum og beskeder i signalserveren (med rigtige
  WebSocket-forbindelser fra `connectWs()`), spillerlisten og kant-logikken,
  input-normalisering, sumo-fysik og -regler.
- `?bots=N` på konsollen: N falske telefon-spillere, der kører rundt og skubber.
  `&auto=1` springer menu og lobby over; `&seed=N`, `&prewarm=N`, `&nosw=1` som
  i Kattekaos.
- `tools/shot.sh` tager headless-screenshots i 16:9 (Chrome headless).
- En ende-til-ende-test i headless Chrome: konsol og to controller-faner
  forbinder over WebRTC lokalt, og et input når frem.

## Udrulning

- `deploy.sh`: tests, `rsync public/` til
  `/home/peter/dockers/home-proxy/public/mobil/konsol`.
- `deploy-server.sh`: `rsync server/` til `/home/peter/dockers/konsol-signal/`
  og kør `docker-run.sh` der (build, stop, rm, run; `127.0.0.1:<ledig port>`,
  `--read-only`, `--memory 128m`), som Tinsoldats relay.
- Caddy-blok `konsol.mobil.peter87.dk` med `encode zstd gzip`, `handle /ws` →
  signalserveren og ellers `file_server`. `caddy validate` før `reload`.
- Et kort på forsiden (`../landing/public/index.html`) og en række i
  `../CLAUDE.md`'s adressetabel.

## Uden for denne omgang

- Presentation API (andet indhold på fjernsynet end på telefonen).
- Flere spil end Sumo. Grænsefladen er lavet til dem; idéerne står i
  `docs/ideer.md` (Kattekaos-arena, bilbane fra oven, quiz med Røst-vært).
- Spil på tværs af netværk, STUN/TURN.
- Gemte resultater og brugerkonti.
