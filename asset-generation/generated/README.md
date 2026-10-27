# Rå output fra asset-serveren

Kørt 2026-10-18 (se `../../CLAUDE.md`, *Assets*). Rækkefølgen:

1. `node tools/gen.mjs images penguin,seal,polarbear,walrus,reindeer,arcticfox,hare,puffin,muskox,eagle --seeds 1,2`
   — se billederne, vælg et pr. dyr.
2. `tools/models-all.sh penguin seal …` (eller `navn=<billed-job>` for et andet billede end seed 1).
3. `node tools/prepare.mjs penguin seal …` — `--yaw` pr. model, så næsen peger mod +z.
4. `node tools/voices.mjs` — dommerens replikker (Røst, `coral_dk`), tjekket med Whisper.

Spillet bruger modellerne af sig selv, når de står i `public/models/models.json`; ingen kodeændring.
Ét job ad gangen (../../../ASSETS-BILLEDER-OG-3D.md).
