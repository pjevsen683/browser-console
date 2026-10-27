# Fase 7 — fire spil på telefonens knapper (Mario Party-idéer)

Dato: 2026-10-25. Fortsættelse af fase 6 (Peter: "Gør det hele").

| spil | regler |
|---|---|
| **Plunger Roulette** (`plunger/`) — Bowser's Big Blast | lige så mange udløsere som spillere tilbage, én er bomben; på skift vælger man på telefonen (7 s, ellers vælges der for en); trommehvirvel 1,8 s; bomben = ude, ny runde med én færre, og en ny begynder; sidste mand står (`common/survival.js`) |
| **Simon Says** (`simon/`) — Shy Guy Says | værten råber RED!/BLUE! (de første 4), så også NOT RED!/NOT BLUE! (= den anden) og fra den 9. DON'T TOUCH! (tryk ikke); tidsgrænsen går fra 2 s til 1 s; forkert, for sent eller et tryk ved DON'T TOUCH = ude; alle forkert = ingen ude |
| **Pipe Maze** (`pipes/`) | en "stige" med 5 rør (A–E) og tværrør; vandet drejer ved hvert tværrør; ét rør fører til skatten; 12 s til at vælge på telefonen; rigtigt = 100 + op til 100 for fart; 6 runder, labyrinten bliver tættere; vandet vises løbe ned ad det rigtige rør bagefter |
| **Tug of War** (`tug/`) | rød mod blå (`teams.js`); hvert A-tryk trækker rebet 0,1 delt med holdets størrelse (tempoet pr. spiller tæller); ±1 vinder runden, ellers hælder rebet efter 30 s; først til 2 (højst 5 runder) |

De tre første er DOM i `hud.layer` (ingen 3D) og bruger layoutet `choices`; Tug of War er 3D med pad (A). Regler og
bots **testet**. Musik pr. spil; værten siger kommandoerne i Simon Says.
