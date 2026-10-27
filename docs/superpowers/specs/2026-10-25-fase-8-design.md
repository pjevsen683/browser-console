# Fase 8 — hældning og 1 mod alle

Dato: 2026-10-25. Sidste del af Mario Party-listen (Peter: "Gør det hele").

## Platform: hældning (`input/tilt.js`, layout `tilt`)

- Layoutet `tilt` er pad (pind + A/B) plus en knap **Use tilt**. Trykkes den (iOS spørger om lov), styrer telefonens
  hældning pinden: input går som almindeligt pind-input, så spillene og Bluetooth-controllere er uændrede, og pinden
  er reserve, hvis telefonen ikke har en sensor eller man ikke vil.
- Nulpunktet er stillingen ved første måling (**Recenter** måler igen); **Flip** vender retningen; **Stick** slår fra.
  Venstre side viser et vaterpas i stedet for pinden.
- `tiltToStick(beta, gamma, skærmvinkel, nulpunkt)`: landscape bytter beta/gamma om; 25° = fuldt udslag; lille
  dødzone; klippet til enhedscirklen. **Testet.** Fortegnene er regnet ud, ikke prøvet på en rigtig telefon — derfor Flip.

## Tightrope (`rope/`) — 2–12

Hver spiller går på sin line over en kløft og vipper som et omvendt pendul; vindstød (hvert 2.–4,5 s) og gangen skubber,
og man styrer imod (hældning eller pind, x). Man går selv, hurtigst når man står lige. Over 0,9 rad: ned i kløften og
tilbage ved sidste flag (hver 10 m) efter 2 s. 40 m; først over vinder, ellers længst efter 75 s. Regler og bot **testet**.

## Bomber King (`bomber/`) — 2–12, 1 mod alle

Hver spiller er bombemand én runde (tilfældig rækkefølge; 30/25/20 s efter antal spillere). Bombemanden flytter et sigte
med pinden og smider bomber med A (0,7 s nedkøling; springer efter 1,1 s, 1,7 m). De andre undviger på Bombs Away's ø og
kan skubbe hinanden i vandet. Bombemanden får 2 point pr. ram; hver overlevende undviger 1. Flest point vinder.
Regler **testet**; botterne som undvigere ser først bomben efter en reaktionstid (ellers ramte botbombemanden aldrig).
