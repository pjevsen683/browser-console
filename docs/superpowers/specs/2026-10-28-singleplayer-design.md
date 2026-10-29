# Singleplayer — Tower Stack og Sumo Survival

Dato: 2026-10-28. Peter: "Kan du ikke lave 2 singleplayer spil så grid bliver komplet" (lobbyens gitter har 6
kolonner; 22 kort + 2 = 4 fulde rækker). Reglen "altid 2–12 spillere" bøjes for disse to: de kan spilles alene, men
tager også flere med, så kortene ikke er grå, når flere telefoner er forbundet.

## Tower Stack (`games/stack/`) — 1–12

- En klods glider frem og tilbage over tårnets top; A taber den. Det, der stikker ud over klodsen nedenunder, skæres af
  og falder; resten er den nye top. Rammer man helt ved siden af, er tårnet færdigt.
- **Perfect** (afvigelse ≤ 4 % af en fuld klods): klodsen lægges præcis, intet skæres af; 3 i træk gør klodsen lidt
  bredere igen (højst fuld bredde).
- Farten stiger med højden (0,7 → 2,4 enheder/s).
- Alle bygger samtidig, hver sit tårn side om side (2D-lærred i `hud.layer`, en kolonne pr. spiller, hver kolonne
  ruller med sit tårn). Alene: ét stort tårn midt på skærmen. Spillet slutter, når alle tårne er færdige (højst 180 s).
- Point = højde. Rekorden (højeste tårn nogensinde) gemmes i konsollens `localStorage` og vises; ingen point på tværs
  af spil.

## Sumo Survival (`games/waves/`) — 1–6

- Sumo-fysikken: spillerne står på isflagen mod bølger af grå "Bully"-dyr. Første bølge har halvt så mange bøller som
  spillere (mindst 1), og der kommer én mere hver anden bølge (højst 12 dyr i alt); bøllerne starter langsomme og bliver
  hurtigere og skubber oftere for hver bølge.
- Bølgen er klaret, når alle bøller er i vandet, og mindst én spiller står. Næste bølge: alle spillere er med igen (også
  dem, der faldt i), og flagen er hel igen. Alle spillere i vandet = slut. Bølge 20 klaret = vundet.
- Bøllerne går efter den nærmeste spiller; spiller-bots (`?bots`) efter den nærmeste bølle.
- Resultat: "Survived N waves"; listen ordnet efter skub (bøller skubbet i vandet). Rekorden (flest bølger) gemmes.

## Platform

- "Random game"-kortet: 1–12 spillere (alene vælger det blandt spillene for 1).
- Lobbyens kort viser antal spillere, når det ikke er 2–12.
- `common/record.js`: rekord pr. nøgle i `localStorage` (tåler en privat fane).
- `sumo/view.js`: dyr, der ikke er i verdenen, skjules (Sumo Survival har bøller, der kommer og går).

## Ren logik (testet)

`stack/rules.js`, `stack/ai.js`, `waves/rules.js`, `waves/ai.js`, `common/record.js`, `lobby-state.js` (1 spiller).
