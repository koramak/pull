# PULL — process lessons log

One entry per mistake a session actually made, with the fix. Newest first.
Skim at bootstrap (CLAUDE.md). When you make and solve a new process mistake,
append it here **immediately** — one bullet, symptom → cause → fix. Don't log
one-off typos or anything already encoded as a bootstrap rule; do log anything
a future session would plausibly repeat.

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
