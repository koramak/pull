# PULL — session bootstrap

Before doing anything else:

1. **`git pull` first.** Local clones on this Mac have gone stale before (once
   9 commits behind, which made repo files look missing). Sync, then orient.
2. **Read `docs/pull-status.md`** — current state, next steps, dev workflow.
3. **Read `docs/pull-build-instructions.md`** — Zane's per-item rulings
   (approvals/rejections/modifications, IDs like F1/M3/P5). Where it and
   `docs/pull-improvement-report.md` disagree, the instructions win.

Standing rules:

- **One session owns this repo at a time** (Zane's rule after a three-session
  collision). If another session may be active, ask Zane before writing.
- Parked items (M7, X1–X4, P3, P6, P7, L2, daily seed) are not to be built
  without Zane's explicit go-ahead. No passive gold income, no rubber-banding,
  no streaks — permanent rulings.
- All tuning values live in `app/src/config.ts`. `app/` is the game;
  `prototype/` is frozen history. Deploy = push to `main` (GitHub Actions).
- **End every session by updating `docs/pull-status.md`** and pushing — it is
  the cross-session handoff document.

Delegate mechanical grunt work (bulk file reading, searching, scripted
playtests) to subagents to keep the main context lean; keep design decisions
and code authorship in the main loop.
