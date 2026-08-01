# PULL

**Your finger is gravity.**

A one-thumb mobile arcade game. A space station sits center screen while
asteroids stream in from every edge. You never touch the station and you never
shoot — pressing anywhere bends every moving object toward your fingertip:
curve rocks away from the station, slam them into each other, and curl gold
ore into the station to bank it. Three hull points. When they're gone, the
run ends.

Every push to `main` builds and deploys the game to GitHub Pages via Actions.
The prototypes are published alongside it under `/prototype/`.

## Repo layout

| path | what |
| --- | --- |
| `app/` | Production game — Vite + vanilla TypeScript + Canvas 2D, no engine |
| `prototype/pull.html` | The original prototype. **Feel/tuning baseline — source of truth.** |
| `prototype/phosphor.html` | Phosphor CRT presentation prototype |
| `docs/` | Design brief and engineering brief |
| `design/icon/` | App icon kit ("gold core" direction) |

## Architecture (app/)

The visual + systems spec is the Claude Design "PULL — Phosphor Kit"
(chosen direction: phosphor CRT). Everything emits, nothing reflects;
threat sits on the dim tube, reward on the bright one.

- `src/config.ts` — every tuning value in one hot-reloadable object, in
  kit units (the design's 393×852 stage; the renderer scales uniformly)
- `src/state.ts` — kit 24a state machine: TITLE · FIRSTRUN · RUN · CHOICE ·
  PAUSED · COLLAPSE · RESULT · SETTINGS
- `src/sim/` — fixed-timestep simulation (120 Hz, interpolated render):
  pooled objects, uniform-grid collisions, the monolith/rubble rock ladder
  (each smash yields the next class down; nothing has fewer than four
  sides), hull sections 3→6, the reservoir, ships on the r61 patrol,
  42 ms hit-stop, near-miss detection
- `src/render/` — the phosphor tube: wireframe sprites with baked bloom,
  rotating three-layer starfield (150/240/400 s), station structure buffer
  (ring + flares + truss rails + tooth comb), the 31a contracting-ring well
  with dust, 13e echoes under the finger, hull-hit tear + flicker scaled by
  hull resolution, the CRT power-off collapse, and the shell screens
- `src/upgrade.ts` — the choice: reservoir full + release → freeze to 16%,
  three preview plates in a triangle, flick, white lock flash, inward
  surge, structure builds over live play
- `src/intensity.ts` — 22a–22d as one float driving bloom, scanline alpha,
  vignette and starfield (pressure-driven; the clock only sets the floor)
- `src/firstrun.ts` — wordless onboarding: bank one ore, dodge one rock,
  make one choice
- `src/fx/`, `src/events.ts` — typed event bus + pooled transient visuals
- `src/audio.ts`, `src/haptics.ts` — WebAudio synth + vibration map, both
  behind the SETTINGS toggles
- `src/storage.ts` — saved keys: best · runs · sound · haptics ·
  reduceMotion · seenFirstRun · savedRun

Debug overlay + console handle (`window.__pull`): append `?debug`.

## Develop

```bash
cd app
npm install
npm run dev
```

## Native wrap (iOS / Android)

The web build is Capacitor-ready (`app/capacitor.config.json`, relative asset
paths, viewport-safe layout). With Xcode / Android Studio installed:

```bash
cd app
npm install -D @capacitor/core @capacitor/cli
npm run build
npx cap add ios      # or: npx cap add android
npx cap sync
npx cap open ios     # build & run from Xcode / Android Studio
```
