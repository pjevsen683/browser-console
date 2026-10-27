# Adding a game

A game is one folder in `public/src/games/<id>/` plus one line in `public/src/games/index.js`. The console handles the
lobby, the countdown, players joining and leaving, and the result screen. Your game only runs the match.

## House rules

- **2–12 players.** Every game must work with 2 and with 12 (`minPlayers: 2, maxPlayers: 12`; a few games need 4+).
- **English** for everything players see or hear. Short texts, because they're read from the sofa.
- **No points carry over between games**, and there is no kids' mode.
- **Every game has a bot**, so it can be played and tested with `?bots=N` and no phones.
- **Rules are pure and tested.** Keep logic (rules, physics, AI) in plain modules with no DOM or three.js, and test them
  in `test/<id>.test.js` with `node --test`. Look at `games/sumo/` for the pattern: `physics.js`, `rules.js`, `ai.js`
  are tested, while `view.js` (3D) and `index.js` (glue) are not.
- Use `ctx.rng`, never `Math.random`, so `&seed=N` replays a match.
- Add your new files to the `CACHE` list in `public/sw.js` and bump its version.
- Mario Party *style* ideas are welcome. Nintendo names and characters are not.

## The module

```js
export default {
  id: 'mygame', title: 'My Game', emoji: '🎯', how: 'one line shown in the lobby',
  minPlayers: 2, maxPlayers: 12,
  music: 'mygame',     // optional: a track in public/music/ (defaults to id; false = the game plays its own)
  ready: promise,      // optional: resolves when the game's data has loaded
  start(ctx) {
    // ctx = { players, rng, audio, hud, notify(id, msg), seed }
    return {
      done: null,                  // set to { ranking: [{ id, name, color, score?, text? }, ...] } to end the game
      update(dt, livePlayers) {},  // every frame; time-based effects must age here (not in render)
      render(renderer) {},         // three.js WebGLRenderer; DOM-only games can leave it empty
      dispose() {},
      bot(id) {},                  // optional: input for a bot -> { x, y, a, b }
      hello(id) {},                // optional: state for a phone that (re)joins mid-game
      layoutFor(id) {},            // optional: which phone layout that player should have now
      onAnswer(id, msg) {},        // optional: messages from the phone (answer / stroke / tap)
    };
  },
};
```

A live player is `{ id, name, color, source: 'phone'|'pad'|'bot', rtt, input: { x, y, a, b, aPressed, bPressed } }`.
`x, y` is the stick in −1…1; `aPressed`/`bPressed` are true for exactly one frame per press.

### The TV

- **3D:** build on `games/common/scene.js` (sea, animals with name rings). For an arena, use `common/rink.js` with the
  sumo physics (`games/sumo/physics.js`: sliding, pushing with A, falling off). Six games already share it.
- **DOM:** `ctx.hud.layer` is an empty layer for games with no 3D (see `colors/`, `simon/`, `pipes/`).
- `ctx.hud`: `scores(rows)` (the chip row; a row can have `text`), `center(text)`, `banner(text, sub)`, `tick(text)`.
- `ctx.audio`: `blip()`, `thud(n)`, `whoosh()`, `fanfare()`, `whistle()`, `say(line)` (pre-recorded lines in
  `public/voice/`; a missing line is silent), `music(name)`.
- `games/common/survival.js` handles "last one standing" (best of 3 with 2–3 players; if everyone would be out at once,
  nobody is).

### The phones

Send to one phone with `ctx.notify(id, msg)`:

| message | what the phone shows |
|---|---|
| `{t:'state', text, score}` | a status line and a score |
| `{t:'buzz', ms}` | vibration |
| `{t:'layout', kind:'pad'}` | stick + A/B (the default) |
| `{t:'layout', kind:'choices', prompt, options:[{label, color}]}` | 2–6 big buttons; answers `{t:'answer', value}` |
| `{t:'layout', kind:'text', prompt, max}` | a text field; answers `{t:'answer', value}` |
| `{t:'layout', kind:'draw', prompt}` | a canvas; sends `{t:'stroke', …}` |
| `{t:'layout', kind:'beat'}` | 4 arrow buttons; sends `{t:'tap', lane, at}` |
| `{t:'layout', kind:'tilt'}` | pad + "Use tilt": the phone's tilt drives the stick |

Phones reconnect, and players drop out mid-game. Return the current layout from `layoutFor(id)` and the current state
from `hello(id)`, and don't wait forever for a phone that is gone.

## Check your game

```bash
npm test
npm start
# play it with bots:
open "http://localhost:8091/?bots=2&auto=1&game=mygame&nosw=1"
open "http://localhost:8091/?bots=12&auto=1&game=mygame&nosw=1"
```

Headless, it must reach the result screen with no errors. `--dump-dom` should show `data-screen="result"` and an
empty `#errors`:

```bash
google-chrome --headless=new --dump-dom --virtual-time-budget=600000 \
  "http://localhost:8091/?bots=12&auto=1&game=mygame&nosw=1&prewarm=5" | grep -o 'data-screen="[a-z]*"'
```

`tools/shot.sh out.png 'bots=6&auto=1&game=mygame&prewarm=6'` takes a 1280×720 screenshot.

## Ideas

`docs/ideer.md` and `docs/spilplan.md` (in Danish) list ideas that were considered. Open an issue or a pull request.
