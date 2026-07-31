# PULL — Engineering Brief

## Summary
Build the production version of PULL, a one-touch mobile arcade game where the player's finger is a gravity well that bends incoming asteroids around a central station. A working HTML canvas prototype (pull.html) exists and defines the game feel. Treat its physics constants and loop structure as the tuning baseline; the job is to productionize, not reinvent.

## Targets
Mobile web first (portrait, touch-first, playable in Safari iOS and Chrome Android). Architecture should keep a native wrap (Capacitor or equivalent) cheap later. 60fps on a mid-tier phone is the performance bar. Single-pointer input only; ignore multitouch beyond the first finger for v1.

## Core loop (from prototype)
State machine: ready, play, dead. Instant restart on tap from dead.
Station fixed at (0.5W, 0.52H), radius 26, 3 hull points.
Objects spawn at random screen edges aimed at the station with plus or minus ~0.45 rad spread. Two types: rock (threat) and ore (reward, spawn probability 0.32).
While the finger is down, every object accelerates toward it.
Rock touches station: minus 1 hull. Ore touches station: score plus 25.
Two objects overlapping with closing speed above 180 px/s: both destroyed; if both rocks, plus 10; if ore involved, ore is lost.
A rock that was meaningfully accelerated by the well and exits the play field: plus 5 (deflection bonus).
Run ends at 0 hull.

## Physics constants (baseline, expose all in a tuning config)
Well acceleration: a = 9.5e6 / (d^2 + 3600), capped at 2400 px/s^2, applied toward the finger.
Spawn speed: 70 to 140 px/s, plus up to 70 more over a 90-second ramp.
Spawn interval: 1.7s shrinking to ~0.55s over 90 seconds, with per-spawn jitter of 0.7x to 1.3x.
Slow overlaps (closing speed under 180) resolve as a positional separation plus velocity swap (soft bounce).
Object radii: rocks 15 to 24, ore 13.

All gameplay values live in one hot-reloadable config object. Nothing tuned inline.

## Systems to build properly (beyond the prototype)
Fixed-timestep simulation (e.g. 120Hz sim, interpolated render) so feel is identical across devices and frame drops. The prototype uses variable dt with a 33ms clamp; keep the clamp behavior as a fallback only.
Spatial partitioning for pairwise collisions once object counts grow (simple uniform grid is fine; prototype is O(n^2)).
Object pooling for objects, particles, and trails. Zero allocation in the frame loop.
Trail rendering as a ring buffer per object (prototype stores 9 points; production should support longer tapered trails cheaply).
Difficulty director: extract the ramp into a data-driven curve (spawn rate, speed, ore ratio, and later object types keyed to elapsed time and score).
Juice layer: particles, screen shake, floating text, haptics (navigator.vibrate with feature guard), and WebAudio synth or sample playback initialized on first user gesture. Keep the prototype's event-to-feedback mapping: coin-class chime on ore bank, low sawtooth plus heavy shake on hull hit, distinct smash sound for rock-on-rock.
Persistence: best score in localStorage for the production build (note: not available in the claude.ai artifact sandbox, so gate behind a storage adapter).
Pause on visibilitychange.

## Nice-to-have hooks (build the seams, not the features)
Event bus for game events (spawn, smash, bank, hull hit, death) so meta systems (missions, stats, daily seed) can attach later.
Seeded RNG behind an interface for a future daily-run mode.
Second object type slot in the spawner (e.g. a heavy rock or a splitter) with zero refactor cost.

## Code expectations
Vanilla TypeScript plus Canvas 2D unless there is a concrete reason for a framework; no game engine. Vite build. Modules: sim, render, input, audio, fx, config, state. The renderer consumes sim state read-only. Ship with a debug overlay (fps, object count, current ramp values) toggled by query param.

## Acceptance
Feels indistinguishable from or better than pull.html on a phone. 60fps with 40 simultaneous objects plus particles on a mid-tier Android device. All tuning values changeable in one file without touching logic. Clean pause/resume, clean restart with no state leaks across runs.
