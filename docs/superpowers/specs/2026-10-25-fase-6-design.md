# Fase 6 — fire spil på Sumo-fysikken (Mario Party-idéer)

Dato: 2026-10-25. Peter spurgte, om flere Mario Party-minispil kunne laves; svaret var en liste på 10, og han sagde
"Gør det hele". Fase 6 er de fire, der bygger på isflagens fysik; fase 7 er telefonknap-spillene, fase 8 tilt og
1 mod alle. Vi tager idéerne, ikke Nintendos navne eller figurer.

## Fælles

- `games/common/survival.js` — sidste mand står: ude én ad gangen, den sidste vinder runden; 2–3 spillere = bedst af 3
  (ellers er et spil overstået på sekunder); ville alle tilbageværende gå ud på én gang, går ingen ud. **Testet.**
- `games/common/rink.js` — rund arena (gulv/ø, kant, hav, dyr, kamera), som spillene lægger deres ting i.
- Sumo-fysikkens stød melder nu `dasher` (hvem der skubbede med A). **Testet.**
- `audio.music(name, ms)` — fadens længde (Musical Chairs stopper musikken brat).

## Spillene (alle 2–12, A skubber)

| spil | regler |
|---|---|
| **Color Panic** (`panic/`) — Mushroom Mix-Up/Hexagon Heat | gulvet er felter i 4 farver (lige mange af hver); en farve meldes (værten siger den, fjernsynet og telefonerne viser den); efter kaldetiden (4 s → 1,8 s) synker resten i 1,6 s; den, der står forkert eller går ud på et hul, falder |
| **Musical Chairs** (`chairs/`) — Musical Mushroom | musik i 4–9 s; når den stopper (telefonerne summer), dukker én pude færre op end spillere; den nærmeste inden for 0,8 m sætter sig og kan ikke skubbes væk; når alle puder er taget (eller efter 6 s), er den, der står, ude |
| **Coin Grab** (`coins/`) — Grab Bag | mønter regner ned (10 % er store, 5); et A-skub, der rammer, får den ramte til at tabe 30 % (mindst 2, højst 10) rundt om sig, og den ramte kan ikke samle op i 1 s; flest mønter efter 60 s |
| **Bombs Away** (`bombs/`) | skygger viser i 1,6 s, hvor bomberne lander; inden for 1,5 m = ude, trykbølgen skubber dem tæt på; ø uden kant (vandet tager også); salverne kommer tættere og bliver større; den første i hver salve sigter efter en spiller |

Bots i alle fire (`ai.js`, **testet**). Musik pr. spil og værtens replikker (farverne siges højt i Color Panic).
