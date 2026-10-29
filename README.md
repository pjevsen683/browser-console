# Browser Console

A party-game console in the browser. One phone is the **console**: it runs this PWA in landscape and is mirrored to a TV
over HDMI. **2–12 players** scan a QR code and use their own phones as controllers (up to 4 Bluetooth gamepads can join
too). Everyone is on the same wifi. No app store, no build step.

Live: https://konsol.mobil.peter87.dk/ (controller: `/c.html?g=CODE`)

There are 23 games so far: Ice Floe Sumo, Penguin Race, Mini Racers, Hot Potato, Color Panic, Musical Chairs, Coin Grab,
Bombs Away, Tug of War, Bomber King, Tightrope, Cat Chaos, Snowball Fight, Color Rush, Plunger Roulette, Simon Says,
Pipe Maze, Draw & Guess, Dance Beat, Quiz Night, Who's the Traitor?, Tower Stack and Sumo Survival (the last two can
also be played alone and keep a local high score).

**Want to add a game?** Read [CONTRIBUTING.md](CONTRIBUTING.md).

## Run it

```bash
npm install
./sync-vendor.sh     # copies three.js and the QR encoder into public/vendor/
npm test             # pure logic (node --test)
npm start            # http://localhost:8091/  (PORT=8093 npm start if 8091 is taken)
npm run e2e          # headless Chrome: console + 2 controllers over real WebRTC (needs Chrome installed)
```

You don't need phones to develop. Open the console with fake players:

| console URL (`/`) | effect |
|---|---|
| `?bots=N` | N fake players, each driven by the game's own bot |
| `&auto=1` | skip the lobby and start right away |
| `&game=<id>` | which game `auto` starts |
| `&seed=N` | fixed randomness |
| `&prewarm=N` | simulate N seconds before drawing (for headless screenshots) |
| `&nosw=1` | no service worker (use this while developing) |

Example: `http://localhost:8091/?bots=6&auto=1&game=sumo&nosw=1`. To join as a real controller, open
`http://<your-lan-ip>:8091/c.html` on a phone on the same wifi, or open `/c.html?g=CODE&name=Me` in another tab.

## Layout

```
public/            the static site (console = index.html, controller = c.html)
  src/console/     lobby, HUD, game loop
  src/controller/  the phone controller
  src/net/         WebRTC + WebSocket fallback
  src/input/       players, gamepads, phone messages, tilt
  src/games/<id>/  one folder per game; games/index.js lists them
  data/ music/ voice/ models/   game data and generated assets
server/            signalling server (rooms, WebRTC handshake, fallback relay)
test/              node --test, pure logic
tools/             e2e tests, screenshots, asset generation
docs/              design specs per phase (in Danish)
```

`CLAUDE.md` is the maintainer's full technical notes (in Danish). It is also what an AI coding assistant reads first.
Code comments and docs are in Danish; **everything players see or hear is in English**.

The deploy scripts (`deploy.sh`, `deploy-server.sh`) and the asset tools in `tools/` target the maintainer's own
machines; you don't need them.
