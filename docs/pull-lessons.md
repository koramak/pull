# PULL — process lessons log

One entry per mistake a session actually made, with the fix. Newest first.
Skim at bootstrap (CLAUDE.md). When you make and solve a new process mistake,
append it here **immediately** — one bullet, symptom → cause → fix. Don't log
one-off typos or anything already encoded as a bootstrap rule; do log anything
a future session would plausibly repeat.

- **2026-08-30 — in the in-app pane, `sim.width` can be 0: resize before
  driving frames.** Hand-spawned objects vanished within a frame while
  probing live logic via `__pull.sim.frame` — the hidden pane's canvas never
  got real dimensions, so world size was 0×0 and everything offscreen-culled
  instantly (margin 90 from a zero-width world). Call
  `__pull.sim.resize(393, 852)` (the kit stage) before manual sim tests,
  and treat "objects disappear immediately" as a zero-size world, not a bug.
- **2026-08-01 — map playtest feedback to the exact draw call before acting.**
  Zane's "remove the preview trails" got mapped to L1 motion trails; the real
  culprit was the first-run tutorial's dashed trajectory guide (firstrun.ts) —
  a different feature he'd only ever seen because his test profile was fresh.
  Grep for what literally draws the described visual (setLineDash, the colour,
  the phase) and state the mapping back before cutting anything. His
  "state your plan first" checkpoint is what caught it — honor it.
- **2026-08-01 — the in-app browser pane suppresses requestAnimationFrame.**
  Game time freezes (t stuck near 0, objs 0) while screenshots still render
  and the console is clean — it looks exactly like a crashed frame loop but
  is the pane parking rAF between tool interactions (an independent rAF test
  loop also never fires). Verify live-sim behavior by driving it manually:
  `window.__pull.sim.frame(1/60, {active,x,y}, spawning)` in a loop via the
  pane's JS tool, then assert on time/pool/velocities. On-device checks and
  cloud Playwright remain the real playtest paths.
- **2026-08-01 — "cancelled" deploy runs after rapid pushes are normal.** The
  Pages workflow uses a `cancel-in-progress` concurrency group, so a
  superseded commit's run shows `cancelled`, not `failure`. Judge the newest
  run only.
- **2026-08-01 — Actions API `head_sha` filter needs the full 40-char SHA.**
  A short SHA matches nothing and returns an empty list that reads as "no run
  found". Use `$(git rev-parse HEAD)` (correct command is in CLAUDE.md's
  recipe).
- **2026-08-01 — zsh: `status` is a read-only builtin.** `status=$(...)` in a
  script dies with "read-only variable"; `path` is tied to PATH and
  assigning it clobbers the script's PATH. Pick other variable names in zsh.
- **2026-08-01 — ran the documented npm workflow without checking the tools
  exist.** This Mac has no node/npm/gh (CLAUDE.md → Environment). On any
  machine, `command -v <tool>` before following a workflow doc that was
  written on a different machine.
- **2026-08-01 — burned time re-investigating `DELETE ME/`.** Untracked notes
  age silently — its open caveat had already been resolved by a later commit.
  Rulings about odd repo objects live in CLAUDE.md; check there before
  re-deriving.
