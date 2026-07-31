# PULL

**Your finger is gravity.**

A one-thumb mobile arcade game. A space station sits center screen while
asteroids stream in from every edge. You never touch the station and you never
shoot — pressing anywhere bends every moving object toward your fingertip:
curve rocks away from the station, slam them into each other, and curl gold
ore into the station to bank it. Three hull points. When they're gone, the
run ends.

Every push to `main` builds and deploys the game to GitHub Pages via Actions.

## Repo layout

| path | what |
| --- | --- |
| `app/` | Production game — Vite + vanilla TypeScript + Canvas 2D, no engine |
| `prototype/pull.html` | The original prototype. **Feel/tuning baseline — source of truth.** |
| `docs/` | Design brief and engineering brief |
| `design/icon/` | App icon kit ("gold core" direction) |

## Architecture (app/)

- `src/config.ts` — every tuning value in one hot-reloadable object; the
  difficulty director is a keyframed curve sampled by run time
- `src/sim/` — fixed-timestep simulation (120 Hz, interpolated render):
  pooled objects, uniform-grid collisions, table-driven spawner
- `src/render/` — Canvas 2D renderer, reads sim state + interpolation alpha
- `src/fx/` — pooled particles, floating text, screen shake, well infall
- `src/events.ts` — typed event bus (spawn / smash / bank / hullHit /
  deflect / death) so meta systems attach without touching the sim
- `src/audio.ts` — WebAudio synth, created on first gesture
- `src/rng.ts` — seedable RNG seam for a future daily-run mode
- `src/storage.ts` — storage adapter (localStorage with in-memory fallback)

Debug overlay: append `?debug` to the URL (fps, object count, ramp values).

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
