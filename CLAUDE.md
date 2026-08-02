# PULL — session bootstrap

Zane usually opens with "continue as lead — where do things stand?" The job:
sync, verify (recipe below), give a short status + what's next, then get to
work. Most sessions exist to put the latest design live (push to `main` →
Actions deploys) and keep this local clone synced as the backup copy.

Before doing anything else:

1. **`git pull` first.** Local clones on this Mac have gone stale before (once
   9 commits behind, which made repo files look missing). Sync, then orient.
2. **Read `docs/pull-status.md`** — current state, next steps, dev workflow.
3. **Read `docs/pull-build-instructions.md`** — Zane's per-item rulings
   (approvals/rejections/modifications, IDs like F1/M3/P5). Where it and
   `docs/pull-improvement-report.md` disagree, the instructions win.
4. **Skim `docs/pull-lessons.md`** — a one-bullet-per-mistake log of process
   errors past sessions made, with fixes. When you make and solve a new one
   this session, append it there immediately (one bullet, symptom → cause →
   fix). This is how sessions compound instead of repeating each other.

## Environment (Zane's Mac — verified 2026-08-01)

- Available: `git` (HTTPS auth via keychain), `python3`, `curl`; shell is zsh
  (known zsh scripting gotchas are in the lessons log).
- NOT available: node/npm, `gh`, Homebrew, Xcode, Playwright. The npm and
  scripted-playtest workflows in the status doc only work in cloud (CCR)
  sessions — don't run them here, they fail. If local build tooling is ever
  needed, ask Zane before installing anything.
- Deploying needs no local tooling: push to `main`, Actions builds + deploys.
- Fast state check (works from any machine, no npm):
  - `git status && git log --oneline -3` — tree clean, synced with origin?
  - `curl -s "https://api.github.com/repos/koramak/pull/actions/runs?per_page=1"`
    — latest run `"conclusion": "success"`?
  - After pushing, verify that exact commit deployed:
    `curl -s "https://api.github.com/repos/koramak/pull/actions/runs?head_sha=$(git rev-parse HEAD)&per_page=1"`
    — the API needs the full 40-char SHA; a short SHA silently matches nothing.
  - `curl -s https://koramak.github.io/pull/ | grep -m1 '<title>'` — live page up?
  - Hands-on checks: play the live URL in the in-app browser.
- `DELETE ME/` at the repo root is untracked, verified-redundant staging —
  it is Zane's to delete whenever he wants. Ignore it.

Standing rules:

- **End every "done" message with the clickable live link** so Zane can test
  immediately: https://koramak.github.io/pull/ (add `?debug` for the fps HUD).
  Every time, no exceptions — Zane's rule, 2026-08-01.

- **One session owns this repo at a time** (Zane's rule after a three-session
  collision). If another session may be active, ask Zane before writing.
- Parked items (M7, X1–X4, P3, P6, P7, L2, daily seed) are not to be built
  without Zane's explicit go-ahead. No passive gold income, no rubber-banding,
  no streaks — permanent rulings.
- All tuning values live in `app/src/config.ts`. `app/` is the game;
  `prototype/` is frozen history. Deploy = push to `main` (GitHub Actions).
- **End every session by updating `docs/pull-status.md`** and pushing — it is
  the cross-session handoff document. Leave nothing unpushed: the remote is
  the product, this clone is the backup, and both should match at handoff.

Delegate mechanical grunt work (bulk file reading, searching, scripted
playtests) to subagents to keep the main context lean; keep design decisions
and code authorship in the main loop.
