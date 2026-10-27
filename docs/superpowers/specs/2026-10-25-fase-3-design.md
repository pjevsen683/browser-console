# Fase 3 — Cat Chaos og Snowball Fight

Dato: 2026-10-25. Bygger på `docs/spilplan.md` (fase 3) og Peters "Du giver den bare gas".
Regler: 2–12 spillere, alt spillerne læser og hører er på engelsk, ingen point på tværs af spil.

## Cat Chaos (`games/cats/`) — 2–12

Alle er katte på mormors lange spisebord (16 × 8 m i spillets mål; dyrene er 0,55 m i radius som i de andre
spil). Mormor sidder for bordenden i lænestolen med ryggen til og læser.

- **Pind** går, **A** slår med poten (det, der står foran katten, flyver; en kat foran får et skub).
  Katte skubber også ting og hinanden ved at gå ind i dem.
- **Point ved kanten**: en ting, der forlader bordet, giver sin værdi (100–500) til den kat, der sidst rørte
  den (også via en anden ting, der stødte ind i den). Som i Kattekaos tæller kanten, ikke landingen.
- **Mormor** (`owner.js`, kopieret fra Kattekaos): læser → drejer (advarsel, telefonerne summer) → kigger →
  læser. Et brag får hende til at kigge hurtigere. Mens hun kigger, bliver hver kat, der bevæger sig
  (> 0,6 m/s) eller slår, **taget**: −250 point (ikke under 0) og 1,5 s på sin plads. Hver kat højst én gang pr.
  kig. Falder en ting ned, mens hun kigger, får katten pointene, men er også taget. Et skub fra en anden kat,
  mens hun kigger, får dig taget — det er meningen.
- **Slut**: efter 90 s, eller når bordet er tomt. Flest point vinder.
- **3D**: Kattekaos' modeller (bord, mormor i lænestol, 13 slags ting, katten). Katten farves med spillerens
  farve (blandet med hvid, så teksturen stadig ses) + ring og navneskilt som i de andre spil.
- **Lyd**: mormors replikker på engelsk med serverens kvindelige stemme `coral_nic` (dansk accent er charmen),
  musik `cats`.
- Ren logik: `physics.js` (bord, katte, ting, slag, fald) og `rules.js` (point, mormor, taget, slut) —
  **testet**; `owner.js` **testet**; `ai.js` (bot: gå om bag nærmeste ting set fra kanten, slå; fryse, når
  mormor drejer, med en tilfældig reaktionstid, så bots også bliver taget).

## Snowball Fight (`games/snowball/`) — 2–12, 2 hold

Rød mod blå på en snemark (22 × 12 m). Hvert hold har sin halvdel; midterlinjen kan ikke krydses.
Tre snefort på hver side tager imod snebolde og står i vejen.

- **Pind** løber, **A** holdt nede lader op (0–1 s), slip kaster (rækkevidde 7–16 m). Kastet sigter mod den
  modstander, der er nærmest kasteretningen (inden for 30°), så det kan lade sig gøre fra en telefon.
  **B** dukker sig (0,8 s, ikke igen før 1,5 s efter): bolde flyver over, men man står stille.
- **Tre træffere**, og man er ude resten af runden. Et hold uden spillere taber runden. Først til 2 runder.
  Efter 90 s vinder holdet med flest "liv" tilbage (uafgjort: ingen vinder runden). Højst 5 runder; derefter
  vinder holdet med flest runder, ellers flest træffere.
- **Hold**: `assignTeams(ids, 2)` (skiftevis i tilmeldingsrækkefølge). Med 2 spillere er det én mod én.
- **Rangliste**: vinderholdet først, inden for holdet flest træffere.
- **3D**: snemark, midterlinje, fort af primitiver, grantræer rundt om, dyrene med halstørklæde og ring i
  holdfarven, tre prikker over hovedet for livene, en bue der viser opladningen.
- **Lyd**: værten ("Snowball fight!", "You're out!", "Red team wins!", "Blue team wins!"), musik `snowball`.
- Ren logik: `physics.js` (bevægelse i egen halvdel, fort, opladning, kast, sigtehjælp, træf, dukke) og
  `rules.js` (liv, ude, runder, tid, rangliste) — **testet**; `ai.js` (bot: flytter sig, kaster mod nærmeste,
  dukker sig nogle gange for en bold på vej).

## Opgaver

1. Assets i baggrunden: replikker og to musikspor (GPU, ét job ad gangen). Kattekaos' modeller kopieres.
2. Cat Chaos: owner/physics/rules med tests først, bot, view, modul.
3. Snowball Fight: physics/rules med tests først, bot, view, modul.
4. Service worker, docs, e2e, screenshots, gennemgang med frisk reviewer, udrulning.
