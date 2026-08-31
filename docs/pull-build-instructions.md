# PULL — Approved Build Instructions

**Source:** decisions made by Zane in a walkthrough of `PULLIMPROVEMENTREPORT.md` (2026-07-31).
**Status:** These are rulings, not suggestions. Item IDs (F1, M3, P5…) map back to the report.
**Rule:** Where this document and the report disagree, this document wins.

---

## ADDENDUM — 2026-08-30 upgrade rebuild (overrides everything below)

Zane's direction: "we like the feel of this build, so be laser-focused with
upgrades." The three-plate choice is rebuilt around exactly that:

- **SHIPS REPLACED BY SHIELD.** The ship track is gone (darts, tracers,
  targeting — all removed). In its place: a phosphor ring at r54 that
  **blocks hits from broken pieces** — objects born from a split (mediums
  off a monolith, shards, chips, rubble shards; tagged `frag` at fragment
  time). Whole spawned asteroids and ore pass straight through. One charge:
  after a block it recharges over time, redrawing itself clockwise from 12.
  - Levels (3, like ships): L1 = 10s recharge, L2 = 6s, L3 = 3.5s.
  - **Final level: blocked hits pay gold** — +1 reservoir unit per block,
    straight into the core (Zane's explicit spec; the no-passive-income rule
    stands — this is event-driven pay for an upgrade you bought).
  - All numbers in `config.ts → shield`.
- **CAPACITY REPLACED BY REPAIR.** The repair-or-greed decision now lives on
  its own plate: REPAIR relights the first dead section, and is enabled only
  while one is dead. HULL is pure growth again (3 → 6 sections) — M6's
  "HULL repairs while wounded" dual behavior is superseded.
- Consequences of capacity leaving, accepted: the reservoir cap never grows
  (every upgrade costs a flat 40 units / 8 banks) and spill is a flat 25%
  (`reservoir.spillFrac`). M4's spill buy-down and cap growth are retired.
- **M9 and N3 are moot** (no ships to tune or fix).
- **The pre-shield build is preserved**: playable archive at
  `prototype/archive-2026-08-30/` →
  https://koramak.github.io/pull/prototype/archive-2026-08-30/ and git tag
  `pre-shield-2026-08-30` on the source.

---

## ADDENDUM — 2026-08-01 playtest rulings (these override the sections below)

- **F1 REVERTED.** The well envelope (attack ramp, release decay, slip
  forgiveness) shipped in Phase 1 and was reverted after play: the
  pre-review binary feel — full pull the frame you touch, zero the frame
  you lift — is canon. Do not reintroduce ramps, decay, or forgiveness
  on the well. Force constants were never changed and stay as they are.
- **First-run trajectory guide REMOVED.** The kit-era dashed line ahead of
  the tutorial ore (bending under the pull to preview its path) is gone.
  No predictive/aim lines anywhere in the game, tutorial included. The
  tutorial's three beats and fingertip hint stay.
- **L1 trails STAY.** Zane initially asked to remove "preview trails";
  on inspection he meant the tutorial guide above. The L1 motion trails
  are liked and remain.
- **Ore is fully rigid — verified.** No deformation of any kind on ore
  (the Phase-1 ruling held; the "squishy floating ore" report traced to
  the tutorial guide, not to ore rendering).
- **F10 web-side LANDED and KEPT** (coalesced pointer path, desynchronized
  canvas). Ruled kept after the F1 revert — it changes tracking fidelity,
  not forces. The sub-50ms tap-pulse part of F10 remains unbuilt, pending
  the tuning-vs-wrap ruling.
- **C2 RESOLVED.** Zane's iPhone check on the live build: ~60fps, smooth.
  No further glow pre-baking needed before tuning.
- **F2 REMOVED** (later the same day): no procedural deformation — sprites
  are rigid, rocks included. The station's bank gulp (F9) stays.
- **F3 REMOVED:** no hit-stop tiers. One flat 0.042s stop on smash and
  hull hit, none on bank — the artifact-era beat. Death stops 42ms then
  collapses.
- **F5 and M5's slow-motion REMOVED:** time never bends — no near-miss
  slow-mo, no clutch-save slow-mo. Near-miss detection, scoring (M1),
  flare and whoosh stay; the rest of M5's critical state (heartbeat,
  sparks, cold wash, intensity floor) stays.
- Context for the three removals: the claude.ai artifact ("PULL — Phosphor
  Prototype", single version) is the canonical touch/feel reference. Its
  core gravity constants were verified identical to the app's
  (9.5e6 / 3600 / 2400 / 120, dt 1/120, same world scaling), so the feel
  gap was these event-driven layers, not the force law. With F1 already
  reverted, the touch stack now matches the artifact era: binary well,
  flat 42ms stop, rigid sprites, unbent time.

---

## 0. BLOCKING TASK — Source of truth (report item C1)

Nothing else in this document should be built until this is resolved.

### What was found (verified 2026-07-31)

The improvement report contains a factual error. Its header claims
`prototype/phosphor.html` is "identical to `pull.html` in this repo." It is not.

- `prototype/pull.html` is the small original prototype: 343 lines, ~11KB, human-readable.
  It contains **none** of the phosphor-era systems (no reservoir, monolith, ships,
  upgrades, tutorial, near-miss, or collapse sequence). The README correctly calls it
  the feel/tuning baseline.
- There is **no `phosphor.html` anywhere**: not in the working tree, not in git history,
  not elsewhere under `AI Folders/`. The repo has 2 commits, one branch, no stashes.
- `app/` is confirmed a generation behind: 1,948 lines across 21 TypeScript files,
  containing none of the phosphor systems.
- **The phosphor build is live** at `https://koramak.github.io/pull/prototype/phosphor.html`
  (page title: "PULL — Phosphor Prototype").
- `.github/workflows/deploy.yml` builds only `app/` and publishes `app/dist`. It has no
  knowledge of `prototype/phosphor.html`. That file reached GitHub Pages by some other
  route and is **untracked**. A clean redeploy from `main` may destroy the only copy.

### Do these in order

1. **Back it up first.** Download the live `phosphor.html` and commit it to the repo at
   `prototype/phosphor.html`. Do this before touching anything else. Verify the saved file
   actually contains the game (search for `reservoir`, `monolith`, `tutorial`, `collapse`)
   rather than a redirect or error page.
2. **Check for a sourcemap.** Look for a `//# sourceMappingURL=` comment in the bundle and
   try fetching any `.map` file alongside it. If a sourcemap with `sourcesContent` exists,
   the original TypeScript is directly recoverable. Extract it into `app/src/` and stop here.
3. **If no sourcemap, report back before proceeding.** The two remaining options are
   (a) recover the source from the Claude artifact/session that generated the build, which
   Zane would need to locate, or (b) port the phosphor systems into `app/` by hand, reading
   the bundle as reference. Do not start (b) without confirmation, it is a large job.
4. **After resolution, the rule is:** `app/` is the game. `prototype/` is frozen history.
   The deployed page is built from `app/` by the existing Action. All tuning values live in
   `app/src/config.ts`.

Do not develop features directly in the minified bundle under any circumstances.

---

## 1. FEEL — all approved

**F1. Well attack/release envelope.** ⚠ REVERTED 2026-08-01 — see Addendum; the well is binary again, permanently. Original ruling kept for history: Replace binary on/off well force. Ramp strength in over
60–90ms with ease-out, decay over ~120ms after release. The decay doubles as input forgiveness
so a thumb slip mid-slingshot does not drop the curve. Keep total ramp under 100ms so it still
reads as instant.

**F2. Procedural squash and stretch.** Derive deformation from the sim. Stretch along velocity
when objects whip through the well (`scaleAlong = 1 + k·speed`, squeeze the perpendicular axis
to conserve area), squash on impact for 80–100ms, elastic return over ~200ms with overshoot.
Ore gets a subtle idle shimmer/wobble so the eye finds it.

**F3. Tiered hit-stop.** Replace the single 42ms value:
bank ~30ms plus a station "gulp" squash; smash 40–60ms; hull hit 100–140ms; death ~300ms full
stop before the collapse begins. **Critical:** freeze the world, not the finger. Keep sampling
the pointer and keep the well ring live during hit-stop.

**F4. Trauma-based screen shake.** Accumulate `trauma` 0–1 per event, amplitude = trauma²,
drive offsets with smooth coherent noise rather than per-frame random, add up to ~0.05 rad of
roll, cap trauma at 1.0. Budget: bank 0.1, smash near station 0.2, hull hit 0.5.

**F5. Near-miss slow-motion.** On a detected near-miss, ~200ms at 0.85× time (or a 60–100ms
hit-stop) plus the whoosh. Also fires on the last-hull save, see M5.

**F6. Score theater.** Roll the score counter rather than jumping it. Fly a "+25" chip from the
bank point to the score with ease-out over ~250ms. Pulse the counter. Scale counter intensity
with streaks, expressed in phosphor language (glow, then shake, then bloom).

**F7. Permanence.** Shatter fragments tumble and fade over 2–3s. Faint scorch marks on hull
sections that took hits. Brief phosphor burn spots from large smashes. Cap counts to stay bounded.

**F8. Fix the hull-hit blackout.** Currently the field drops to 6% alpha for ~0.16s at 3 hull
sections, a near-blackout during the most dangerous moment. Floor the dip at 40–50% and shorten
to ~0.1s. Keep the tear and the shake. Juice must never mask threat information.

**F9. Station personality.** Flinch on hull hit, small "gulp" squash on bank, core brightening
as the reservoir fills (already present), anxious flicker at 1 section. Behavior only, no faces
on rocks.

**F10. Input plumbing.** `getCoalescedEvents()` so the well tracks the true 120–240Hz finger
path. `desynchronized: true` canvas hint. Process the latest pointer inside the same rAF tick
that renders. Treat a sub-50ms tap as a deliberate gravity pulse rather than a no-op.

---

## 2. SOUND & HAPTICS — all approved

Context: the game is being **tested on web for a while but designed for phone**. Web builds
still get played on phones, so the speaker constraints in S1 apply immediately, not at wrap time.

**S1. Re-voice the low end.** The hull hit (130–170Hz saw) and collapse tail (90→40Hz sine)
are largely inaudible on phone speakers, which reproduce almost nothing below 150–200Hz. Get
menace from envelope instead: hard attack, longer decay, energy centered 250–700Hz, high-pass
at ~150Hz. Duck all other audio by 6–10dB for ~250ms on hull hits so the gap in the mix carries
the impact. Test on a real phone speaker, not headphones.

**S2. Pitch ladders.** Consecutive banks without a hull hit step up a **pentatonic** ladder
(pentatonic guarantees overlapping chimes stay consonant). Reset on hull hit or ~5s without
banking. Same treatment for smash chains inside the combo window. Additionally, pitch-randomize
every repeated SFX by ±2–6% to defeat habituation.

**S3. Ambient bed.** A quiet phosphor hum (filtered noise plus low triangle) that confirms audio
is on, rises in brightness and pitch with the existing intensity system, and drops to a filtered
heartbeat pulse at 1 hull (see M5). Design it not to loop audibly over long runs.

**S4. Event budget and voice discipline.** Deflect (+5) is the most frequent and least important
event: make it near-subliminal and drop it entirely when more than ~4 sounds are in flight. When
a smash and a bank land on the same frame, play the bank only. Reserve long sounds exclusively
for new-best and death.

**S5. Web audio hygiene.** Resume the AudioContext on `touchend`, re-resume on `visibilitychange`,
schedule against `AudioContext.currentTime` (never `setTimeout`), pre-warm with a one-sample
silent buffer on first gesture. Implement the silent-`<audio>`-element trick so the iOS ringer
switch does not mute the game, with the in-game sound toggle as the escape hatch.

**S6. Real haptics (native wrap only).** iOS Safari has never supported `navigator.vibrate`, so
web iPhone players get nothing. Build the real map at wrap time via `@capacitor/haptics`:
bank = light impact (every 5th = success notification), smash = medium/rigid, hull hit = heavy
100ms thud, near-miss = sharp light tick (currently has no haptic at all), death = error
notification plus a falling 300ms continuous, choice lock = selection tick. No continuous buzz
while the well is held. Instead fire a featherweight tick as each object enters the well's grip.
Minimum 80–100ms between transients. Coincident events collapse to the strongest. If timing
slips, let the haptic be late rather than early.

**S7. Keep the WebAudio synth.** Do not move to samples.

---

## 3. MECHANICS & LOOP

**M1. Approved. Score pays for risk and style.**
- Chain smashes within ~1.5s escalate 10 → 20 → 40, capped around 4 steps.
- Proximity bonus: smashes and deflections inside a danger ring (~120px of the hull) pay
  +50–100%.
- Near-misses award points. The detection already exists and is currently score-inert.

**M2. Approved. Make the push-your-luck legible.** The full-reservoir double-pay state stays
(see M4), so this item stands as written. Show "×2" on bank floats. Show spilled units as a
visible negative gold counter when hit. Display a one-time explanatory line the first two times
the reservoir fills. The wager must be perceptible to function as a wager.

**M3. REJECTED as written. No waves.** Zane wants continuous, unbroken play with no chapter
structure, no wave stamps, and no timed lulls.

**Replacement:** keep the existing smooth difficulty curve but make it **asymptotic and endless**.
It must never flatten at 210s as it does today. Spawn interval, speed, and monolith share should
continue approaching their limits indefinitely so the game eventually becomes genuinely
impossible. Escalation should read as a continuous slope, never as steps.

**M3-telemetry. Approved.** Log run-end death timestamps locally from day one. A cluster of
deaths at one time value identifies a churn wall. This is wanted regardless of the rest of M3.

Note: the relief function that wave lulls would have provided is delivered instead by N4 below,
which is player-earned rather than timer-driven.

**M4. Approved with modifications.** The report proposed three mutually exclusive fixes. The
ruling takes a different combination:
- **Keep** capacity's existing ×1.5 reservoir cap increase.
- **Capacity buys down spill damage:** 25% → 15% → 8%. This is the report's option (b).
- **Reject the passive trickle** (report option (c)) permanently. Gold must always be actively
  banked. There is never a passive or idle gold income of any kind.
- **Keep the full-reservoir points multiplier** as the reward for risk. Do not remove the
  double-pay state.
- Exact numbers are open for tuning later.

**M5. Approved with modification.** Make the last hull point a state, not a number. `hullCritical`
is already computed and unused. At 1 section: feed hull into the intensity formula (it currently
weighs only rock count 60% and reservoir fill 40%), cool the palette slightly, drop ambient audio
to the heartbeat layer from S3, and spark the station. Grant a ~300ms slow-motion beat on a
successful clutch deflection.
**Modification: do not display the word "SAVED" or any text.** The slow-motion beat carries it.
Also: no red vignette and no darkening, per F8.

**M6. Approved.** Add a comeback arc. When hull is damaged, the HULL choice-plate repairs a
destroyed section rather than adding a new one (alternatively, banking 10 ore at 1 hull relights
a section). Keep it expensive. The goal is to make "repair or greed" a real decision.

**M7. PARKED.** Teaching release via a tutorial beat or early mission is **not** being built now.
Retain as an idea only. Do not implement.
(Related: the mission pool in P1 can carry short-pull objectives if that emerges naturally, but
do not build a dedicated tutorial beat.)

**M8. Approved.** Add a telegraphed ore surge: a "VEIN INBOUND" announcement plus edge shimmer,
then ~5 ore over 10s. Telegraph it. Anticipation is the point.

**M9. Approved on the reload floor only.** Keep ship reload at ≥2s and range modest.
**Blocked and to be revisited:** see N3. The report described ships as well-implemented with
collision-course prediction, but playtesting shows they do not actually destroy asteroids. M9's
tuning guidance was written against code that does not work. Fix N3 first, then re-evaluate
whether the 3-ship cap needs lowering to 2.

---

## 4. PROGRESSION

**P1. Approved.** Three concurrent rotating missions drawn from a pool keyed to PULL's verbs
(smash 12 in one run, bank 3 ore in 10s, deflect 20 without smashing, 3 near-misses in one run,
bank while at 1 hull, and similar). Completions accumulate toward **ranks**. Ranks were called
out specifically as the appealing part. The critical property: a bad-score run must still make
progress, so failed runs are not wasted.

**P2. Approved with significant modifications.**
- **Build:** challenge links. A shareable link carries a seed so you can challenge a specific
  person to your exact run.
- **Scoring rule (hard):** only runs on a **fresh random seed** are eligible for the high score
  list. Any run on a shared or known seed is ineligible.
- **Challenge seeds get one attempt, no practice runs.** Low priority to enforce, but that is
  the intended rule.
- **No streaks.** Do not build streak counters or streak repair tokens.
- **Daily seeded run: PARKED.** Not now. Revisit later, and if it returns it needs its own
  separate leaderboard because of the fresh-seed rule above.
- Note: the report's share block encoded one emoji square per wave. Waves do not exist (M3), so
  the share artifact needs a different encoding. Suggest survival time or depth, with a mark per
  hull lost.

**P3. DEFERRED.** Cosmetic collection (station skins, trail styles, phosphor palettes) is
interesting but explicitly later. Do not build now. When it happens: strictly cosmetic, never
power.

**P4. Approved.** Put the personal best inside the run. Show "BEST 4820" small beneath the live
score. When the live score crosses ~85% of PB, brighten the counter and the ambient. On death
near PB, state it directly, for example "92% of your best."

**P5. Approved with one replacement.** Redesign the death screen:
- **No cause of death.** Rejected. There is only one hazard type, so the line carries no
  information. **Replace it with a quote gallery:** display a short quote on every death, drawn
  from a pool of science fiction writing about death, dying in space, asteroids, and the void.
  **Public domain only** — this was decided explicitly. Verify public domain status per quote
  before including it. Safe territory includes Verne, Wells, Poe, Shelley, Flammarion, and other
  pre-1929 US publications. Do not include in-copyright authors.
- **Delta to best.** Show it.
- **One signature stat from the run,** and **give these named titles.** Zane's example: "Houdini"
  for a run with many narrow escapes. Write a small set of named awards keyed to run stats
  (near-miss count, best chain, deflections, time at 1 hull) rather than printing raw numbers.
- **Mission progress ticks** from P1.
- **A medal** scored against the player's own history. The last-5-runs data is already written to
  storage and never displayed; use it. Bronze around personal median, gold around personal top 10%.
- **Tap to skip the collapse into instant restart.** Keep the full collapse sequence for the
  first death only. Current lockout is ~4.3s (2.75s collapse plus a 1.5s result gate) with taps
  swallowed during it. Take it toward zero after the first death.

**P6. Approved but later.** Lifetime stats page (rocks smashed, ore banked, deflections,
near-misses, total runs). The event bus already emits everything needed. Not a priority.

**P7. NOT NOW.** Add-to-home-screen prompting is rejected for this pass. Be aware of the
underlying risk: iOS Safari can silently clear localStorage after ~7 days of disuse, so a lapsed
player may return to find their best score gone. Do not build a prompt, but if there is a cheap
way to harden score persistence, note it rather than implementing it.

---

## 5. LOOK

**L1. Approved. Trails.** The phosphor echo currently renders only within 190px of the active
finger, so objects elsewhere have no motion history. The per-object position ring buffer already
exists (20 points) and is simply not drawn outside that radius. Give **every** object a short
tapered phosphor-decay trail. Ore gets a warmer, slightly longer trail. Keep the existing
finger-local echo layered on top. This is the highest-priority visual change in the report.

**L2. PARKED.** Spawn telegraphs at the screen edges are not being built now.
**Known accepted risk:** with L2 parked and cause-of-death removed from P5, a player who dies to
an object entering behind their thumb has no way to understand what happened. This was raised and
the decision stands. Revisit if playtesting shows unattributable deaths are a problem.

**L3. Approved with modification.** Rocks and station currently share a colour temperature
(rocks #9fd6e8, station #5ef2d6) and converge under motion blur and peripheral vision.
**Change rocks to grey/steel. Leave the station colour exactly as it is.** Verify the separation
holds under heavy late-game bloom. Ore versus everything is already good and should not change.

**L4. Approved.** The intensity system currently makes the screen harder to read as danger rises
(scanlines 0.30 → 0.54 alpha, vignette closing, stars dimming). Keep the direction but rebalance:
let bloom and the audio hum carry the tension, cap scanline alpha at ~0.42, and exempt the
playfield core (station ±200px) from vignette encroachment.

**L5. Approved.** Run a slow attract-mode field behind the title: drifting rocks, a ghost finger
pressing down, everything bending toward it. The sim already supports field-only rendering via
the `clearField`/cull paths. Combine with N1 below.

**L6. Approved.** Compose the result screen so a raw screenshot is already shareable: legible at
chat-thumbnail size, built around the station burn-in ghost motif already being drawn. Feeds P2's
challenge links.

**L7. Approved.** Thumb-shadow discipline. Bias particle bursts outward from the contact point,
keep floating text spawning above the touch, keep tap targets out of the bottom-centre dead zone
during play. Choice plates and buttons already comply.

---

## 6. FIRST MINUTE — REJECTED IN FULL

The entire section is rejected. Do not build X1 (teaching release), X2 (first-runs mercy /
rubber-banding), X3 (instrumented 30-second test), or X4. No difficulty rubber-banding for new
players of any kind.

The death-timestamp logging under M3-telemetry is approved and covers the useful part of X3.

---

## 7. CODE HEALTH — approved

**C1.** See section 0. Blocking.

**C2. Approved.** Verify performance on a real mid-range Android phone before deep tuning. Open
with `?debug` and watch the fps counter at high object counts. The bundle pre-bakes glow into
sprites in places but still draws live `shadowBlur` glow every frame for score text, station core,
well rings, and floats, which is the classic mobile canvas performance trap. If fps dips, pre-bake
the remaining glows the same way sprites already are.

**C3. Approved.** Housekeeping: wire up `hullCritical` (M5 uses it), display the last-5-runs
history (P5 medals use it), plumb the seedable RNG class (P2 challenge seeds use it), and stop
duplicating `pull.html` into the Test repo, link the Pages URL instead.

---

## 8. NEW ITEMS FROM PLAYTESTING

These came from Zane directly and are not in the report.

**N1. Play button restyled and centred.** The play button should use the same visual treatment as
the asteroid/rock objects, and sit in the centre of the screen. Combine with L5's attract mode so
the title screen is a live field with a centred asteroid-styled play target.

**N2. Upgrades are too expensive.** It currently takes too long to reach an upgrade choice. In the
measured playtest the first choice did not arrive until t=77s. Lower the cost so choices arrive
meaningfully sooner. Tune against the M4 economy.

**N3. BUG — ships do not destroy asteroids.** Ships are not working correctly. Investigate and
fix. This blocks re-evaluating M9.

**N4. Post-upgrade clear pulse.** After the player takes an upgrade, fire a pulse that pushes
**all** objects away from the station and off screen, giving the player a break. This is the
earned, player-triggered replacement for the timed breathers rejected in M3, and should feel like
a reward beat.

---

## 9. Suggested order

Not a ruling, adjust as needed.

**Phase 0.** C1 (backup, sourcemap check, establish `app/` as the single source of truth). Nothing
else starts first.

**Phase 1, feel core.** F1, F2, F3, F4, F8, S1, S2, M2, N1, N2, N3.

**Phase 2, loop and economy.** M1, M4, M5, M6, M8, M3 (asymptotic curve), M3-telemetry, N4, L1,
L3, L4, P4.

**Phase 3, return-reason layer.** P1, P2 (challenge links), P5 (death screen and quote gallery),
L5, L6, F5, F6, F7, F9, S3, S4, S5, L7, C2, C3.

**Phase 4, native wrap.** F10, S6, C2 verification, store prep.

**Later / parked, do not build:** M7, M9 cap change (pending N3), P3, P6, P7, the daily seeded run,
L2, all of section 6.
