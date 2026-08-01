# Research digest — Psychology of fun, decision weighting & retention loops

Compiled 2026-07-31 for the PULL improvement report. Method: ~20 targeted searches; synthesized from search-result content of the primary sources listed (direct page fetches were partially blocked in the research sandbox).

## Key principles

1. **Fun is need satisfaction: competence and autonomy predict enjoyment and return play.** Ryan, Rigby & Przybylski's SDT/PENS studies: in-game competence (legible mastery, optimal challenge) and autonomy independently predict enjoyment and *future* play; "mastery of intuitive controls" is its own measured factor. Make skill growth visible; every reward should certify competence, not just pay out. (2006; 2010.)
2. **Flow lives in a narrow difficulty–skill channel and must be actively managed.** Stair-step ramp with recovery valleys; embed difficulty choices inside play so players self-adjust (Jenova Chen's flow thesis, 2006).
3. **Fun is pattern-learning; mastery without new patterns = churn.** Koster: "with games, learning is the drug." Layer techniques so there is always a next pattern.
4. **Ship at least three of Lazzaro's 4 Keys.** Hard fun (fiero), easy fun (curiosity/toy play), serious fun (meta value), people fun (competition/sharing). Best-sellers support 3+; players rotate between them within a session. A pure score-chaser is one-key.
5. **MDA: tune backward from the target emotion** (for an arcade score-chaser: challenge + sensation). (Hunicke, LeBlanc & Zubek, 2004.)
6. **Dopamine is prediction error: anticipation and surprise outpull receipt.** Schultz: neurons fire for *unpredicted* reward, go silent for expected reward, dip when predicted reward is omitted; maximal response under uncertainty. Telegraph incoming rewards; vary magnitude; occasionally over-deliver. (2016.)
7. **Near-misses recruit win circuitry and drive retry — honest in skill games, exploitative in chance games.** Slot research (Cambridge fMRI; 2020 half-century review): almost-wins arouse like wins; machines engineer them (~30% of losses). In a skill game a near-miss is truthful information ("you were close; you control the outcome"). Make failure near-miss-shaped and legible; never fabricate.
8. **Loss aversion is ~2:1; streaks weaponize it, forgiveness sustains it.** Kahneman & Tversky. Duolingo: Streak Freezes cut churn 21% for at-risk users and freeze-users hold longer streaks (17.2 vs 11.6 days) — loss aversion plus insurance beats raw loss aversion.
9. **Peak-end rule: sessions are remembered by their peak and their end — in an arcade game the end is a death.** The death screen is the most-seen designed artifact in the game; script its emotional beat deliberately. (Kahneman; FDG 2023 replication.)
10. **"One more run" = short runs + near-zero restart cost + something always gained.** Sub-2-minute runs, one-tap sub-second restart, and a takeaway from every death reframe death as feedback.
11. **Meier's player psychology:** decisions are interesting only when tradeoffs are *perceived*; players expect to win 2:1 fights nearly always and rage at two straight losses (change the math, not the players); losses loom far larger than wins — provide a stream of small wins with survivable setbacks; quietly cheat in the player's favor at unfairness hotspots. (GDC 2010.)
12. **Push-your-luck is a complete emotion engine.** Escalating reward vs. escalating bust risk, where banking must feel smart, not cowardly. PULL's core mechanic is a *continuous* push-your-luck; the design job is making the wager perceptible and the cash-out a real decision. (Costikyan, *Uncertainty in Games*, 2013.)
13. **Randomize inputs, not outcomes.** Input randomness (spawn timing, edges, mix) preserves skill expression; output randomness on the player's own action reads as betrayal. Luck also protects the ego: self-attribution bias cushions failure — one reason pure-skill games burn players out once every loss is unambiguously their fault.
14. **Fair failure = internal locus of control; durable retention runs on competence, not compulsion.** Soulslike review analysis: players of brutal-but-readable games blame themselves — the precondition for accepting difficulty. Cheap deaths are unreadable ones (off-screen causes, occlusion, no counterplay). The best-loved mobile games (Crossy Road's generosity, Alto, Wordle) show competence-and-generosity retention outperforms extraction.

## Case evidence

- **Wordle (2021–22):** one puzzle/day scarcity → ritual; streaks; identical-puzzle-for-everyone share grid converts solo play into people fun.
- **Duolingo (2023–26):** streak = loss-aversion engine; forgiveness (freezes) increases the streak's power.
- **Vampire Survivors (2022):** something good every few seconds; escalating 0→100 power arc; death as visible overwhelm — compulsion aesthetics, honest mechanics.
- **Balatro (2024):** randomness you can shape; cascading multiplier scoring; every scoring event a micro-peak.
- **Suika Game (2021/2023):** perpetual near-misses (the almost-watermelon), chain-merge jackpots, creeping threat — the closest published analogue to PULL's "threat field + physics + PB chase."
- **Crossy Road (2014, GDC 2015):** retention defined as "plays as long as they can and still wants to come back tomorrow"; generosity design built goodwill *and* revenue; the eagle makes every death fast, comedic, rule-bound.
- **Flappy-likes:** near-miss calibration; sub-second restart; death so fast it becomes cadence.
- **Downwell (GDC 2016):** one idea solving many problems — the canonical dual-purpose mechanic PULL's finger-gravity resembles.
- **Alto's Odyssey (2018):** Zen Mode proves an easy-fun channel can coexist with a score game.
- **Civ Rev (Meier, GDC 2010):** players accepted losing a 2:1 battle once, revolted at twice in a row; the math was bent to the psychology.

## Sources

- The Motivational Pull of Video Games — Ryan, Rigby & Przybylski — 2006 — https://www.researchgate.net/publication/225998888_The_Motivational_Pull_of_Video_Games_A_Self-Determination_Theory_Approach
- A Motivational Model of Video Game Engagement — 2010 — https://journals.sagepub.com/doi/10.1037/a0019440
- PENS — https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/
- Glued to Games — Rigby & Ryan — 2011 — https://selfdeterminationtheory.org/glued-games-video-games-draw-us-hold-us-spellbound/
- A Theory of Fun — Raph Koster — 2004/2013 — https://www.raphkoster.com/2025/11/03/game-design-is-simple-actually/
- The 4 Keys 2 Fun — Nicole Lazzaro — 2004 — https://www.nicolelazzaro.com/the4-keys-to-fun/
- MDA — Hunicke, LeBlanc & Zubek — 2004 — https://aaai.org/papers/ws04-04-001-mda-a-formal-approach-to-game-design-and-game-research/
- Flow in Games — Jenova Chen — 2006 — https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf
- The Psychology of Game Design — Sid Meier, GDC keynote — 2010 — https://gdcvault.com/play/1012186/The-Psychology-of-Game-Design ; notes: https://alexx-kay.livejournal.com/284738.html
- Just One More Turn — Game Developer — 2020 — https://www.gamedeveloper.com/game-platforms/just-one-more-turn---game-development-tips-and-tricks-from-the-creator-of-civilization-sid-meier-
- Dopamine Reward Prediction Error Coding — Schultz — 2016 — https://www.tandfonline.com/doi/full/10.31887/DCNS.2016.18.1/wschultz
- The Near-Miss Effect in Slot Machines: Review — J. Gambling Studies — 2020 — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7214505/
- Losses Disguised as Wins — Dixon et al. — 2010 — https://uwaterloo.ca/reasoning-decision-making-lab/sites/default/files/uploads/files/DixFugetal_10c.pdf
- Vampire Survivors gambling psychology — The Conversation — 2023 — https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613
- Uncertainty in Games — Costikyan — 2013 — https://dl.acm.org/doi/book/10.5555/2484629
- Input-Output Randomness — Skeleton Code Machine — 2023 — https://www.skeletoncodemachine.com/p/input-output-randomness-part-1
- Self-attribution bias — bioRxiv — 2025 — https://www.biorxiv.org/content/10.1101/2025.03.18.644058.full.pdf
- Struggle as Flow (Soulslike) — arXiv — 2026 — https://arxiv.org/pdf/2604.15318
- Peak-End Rule in Videogames — FDG — 2023 — https://dl.acm.org/doi/10.1145/3582437.3587195
- Deconstructing Crossy Road — GDC 2015 via Game Developer — https://www.gamedeveloper.com/business/video-deconstructing-the-successful-design-of-i-crossy-road-i-
- Polishing the Boots (Downwell) — Fumoto, GDC — 2016 — https://gdcvault.com/play/1023533/Polishing-the-Boots-Designing-Downwell
- Duolingo streak case studies — 2023–26 — https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f ; https://trophy.so/blog/duolingo-gamification-case-study
- Wordle psychology — UX Magazine — 2022 — https://uxmag.com/articles/the-fascinating-psychology-tricks-that-make-wordle-so-addictive
- Hook Model — Nir Eyal — https://www.mindtools.com/aapqtdb/the-hook-model-of-behavioral-design/
- Adjust / GameAnalytics session benchmarks — 2024–25 — https://gamedevreports.substack.com/p/adjust-mobile-games-insights-report ; https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks
- Goal Gradient Effect — Coglode — https://www.coglode.com/research/goal-gradient-effect
- Suika Game — https://en.wikipedia.org/wiki/Suika_Game
