# PULL — Project Status (handoff)

**Updated:** 2026-08-01 · **Live build:** https://koramak.github.io/pull/
**Read this + `pull-build-instructions.md` before doing anything.** The
instructions doc holds Zane's rulings (approvals/rejections per item ID);
where it and the improvement report disagree, the instructions win.

## Where things stand

Phases 0–3 of the build program are **implemented, verified, and deployed**
(see the commit history on `main` — each phase is one detailed commit):

- **Phase 0** — source of truth recovered: `app/` (Vite + TS + Canvas) IS the
  game; `prototype/` is frozen history; every push to `main` deploys via
  Actions. All tuning lives in `app/src/config.ts`.
- **Phase 1 (feel core)** — F1 well attack/release envelope (+ slip
  forgiveness), F2 squash/stretch (rocks only — **ore stays rigid**, playtest
  ruling), F3 tiered hit-stop, F4 trauma shake + roll, F8 flicker floored
  (never blinds), S1 speaker-safe audio + ducking, S2 pentatonic streak
  ladders, M2 legible ×2 wager, N1 asteroid PLAY on a live title field,
  N2 reservoir 60→40, N3 ships fixed (2 dmg + knockback + wounded-finisher).
- **Phase 2 (loop & economy)** — M1 chain/proximity/near-miss scoring,
  M3 asymptotic endless curve + local death telemetry (`loadDeaths()` on
  `?debug`), M4 capacity spill armor (25→15→8→4%), M5 one-section critical
  state (intensity floor, cold wash, sparks, heartbeat, clutch slow-mo),
  M6 repair-or-greed HULL plate, M8 telegraphed ore veins, N4 post-upgrade
  clear pulse, L1 phosphor trails, L3 steel rocks, L4 readability rebalance,
  P4 PB-in-run. Hotfix: reservoir display resets between runs.
- **Phase 3 (return-reason)** — P1 missions→ranks (pool in
  `app/src/missions.ts`), P2 challenge links (`?c=<seed36>&t=<score>`;
  seeded determinism verified; challenge runs are one-attempt and NEVER
  ranked), P5 death screen (PD quote gallery in `app/src/quotes.ts` —
  pre-1929 only, keep it that way; named awards; personal medals vs 50-run
  history; tap-to-skip collapse after first death), L5 ghost-finger attract,
  L6 shareable result, F5 near-miss slow-mo, F6 rolling counter + chip
  flights, F7 phosphor burns, F9 station flinch, S3 intensity-driven hum.

## Parked / not built (deliberate rulings — do not build without Zane)

M7 (teach release), all of section 6 (X1–X4: no mercy, no rubber-banding),
M9 ship-cap change (revisit now that N3 works), P3 cosmetics, P6 stats page,
P7 A2HS prompting, L2 spawn telegraphs (accepted risk: unattributable
thumb deaths — watch the telemetry), daily seeded run (needs its own
leaderboard if it returns).

## Next: Phase 4 (native wrap) + open questions for Zane

1. **C2 on-device check (needs Zane's phone):** open the live game with
   `?debug`, report the fps number at high object counts. If it dips:
   pre-bake the remaining live `shadowBlur` glows (score text, core, well
   rings, floats) the way sprites already bake theirs.
2. **F10** input plumbing (getCoalescedEvents, desynchronized canvas,
   sub-50ms tap = gravity pulse) and **S6** real haptics via
   `@capacitor/haptics` (mapping table in the build instructions §S6) —
   wrap-time work. Capacitor config exists (`app/capacitor.config.json`).
3. **Tuning feel checks:** first choice lands ~45-50s (target 35-45;
   `reservoir.baseCapacity` is the knob), ship damage/knockback (2/90),
   chain window/cap, vein cadence. All in `config.ts`.

## Dev workflow

- Build tooling (node/npm, Playwright) exists only in cloud (CCR) sessions —
  Zane's Mac has git/python3/curl only (see CLAUDE.md → Environment, which
  also has the no-npm state-check recipe). In a cloud session:
  `cd app && npm install && npm run typecheck && npm run build`; dev server
  `npm run dev`. Deploy from anywhere = push to `main` (Actions builds
  `app/dist` + copies `prototype/`). Verify the run goes green.
- **Playtesting headless:** serve `app/dist` (`python3 -m http.server`),
  open with Playwright (chromium at `/opt/pw-browsers/…` in CCR sandboxes),
  add `?debug` — `window.__pull` exposes `{sim, game, sampleDifficulty,
  loadDeaths}`. Drive input by dispatching `PointerEvent`s on `#game`
  (`pointerdown/move/up`, world coords = CSS px). A competent bot: hold
  perpendicular to the most urgent threat's path at ~115px, else escort ore
  halfway to the station; tap plates directly during `choice`. Note: pages
  sharing a browser context share localStorage — clear `pull.savedRun`
  between probe pages or taps will hit the PAUSED screen.
- Storage keys all start `pull.` (best/runs/deaths/missions/settings/…).
- One session owns this repo at a time (Zane's rule after a three-session
  collision). The improvement report is `docs/pull-improvement-report.md`
  (the instructions doc's item IDs map to it), with its playtest stills and
  the six research digests alongside in `docs/report-assets/`. Everything
  is self-contained in this repo; koramak/Test is no longer needed.
