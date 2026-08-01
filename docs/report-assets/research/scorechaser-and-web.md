# Research digest — Score-chaser / "one-more-run" design & mobile-web arcade specifics

Compiled 2026-07-31 for the PULL improvement report. Method: ~20 targeted searches; synthesized from search-result content of the primary sources listed (direct page fetches were partially blocked in the research sandbox).

## Key principles

1. **Death-to-retry latency is a first-class design number; the target is "nothing."** McMillen/Super Meat Boy doctrine: "the penalty is how much time it takes to start playing again… take that down to nothing." Flappy Bird's death→new-run cycle ≈ 0.3 s (fan frame analyses). Anything between corpse and next attempt is a tax on "one more run."
2. **The goal-gradient effect makes proximity-to-PB the strongest retry fuel.** Effort spikes as a goal nears (Hull; Kivetz). The PB must be visible *during* the run; a player who dies at 92% of best is in the highest-motivation state the game can produce — but only if told.
3. **Run length sets the retry economics; mobile's budget is a 5–6 min session.** Flappy (seconds; reflexive retries) → Crossy (~30 s–2 min) → Downwell (5–15 min) → Vampire Survivors (hard 30:00, compensated by permanent progress every run). The longer the run, the more the game must pay out on failed runs. 60–120 s runs yield 3–5 attempts per median session.
4. **The difficulty ramp IS the level design — it needs shape, not slope.** Tetris: stepwise speed with *named* levels players narrate. Endless-runner guidance: deliberate lulls for emotional relief between clusters. A monotonic ramp produces correct pressure but an illegible run: no chapters, no breathers, nothing for experts past the end.
5. **Missions layered on the endless run convert every failed run into progress.** Jetpack Joyride (canonical): exactly 3 concurrent missions, 1–3 stars, stars fill ranks — "even games that don't end with a high score are still useful." Missions double as curriculum for advanced technique (Alto's 3 goals per level).
6. **Progression-without-power protects score integrity; generosity drives spread.** Crossy Road: all unlocks change flavor, never scoring power ("money never touches gameplay"); secret in-world unlocks generated years of discovery content. Vampire Survivors: the unlock avalanche — something unlocks nearly every run. For a PB game, cosmetic-only keeps comparisons honest.
7. **The daily seeded run + a spoiler-free text artifact is the proven web-native growth loop.** Spelunky Daily (canonical): one shared seed, one attempt, daily leaderboard. Wordle added distribution: once-a-day scarcity + the emoji grid (invented by a player, formalized Dec 2021) — text, legible in any chat, spoiler-free, braggable. Attempt-policy variants: Isaac dailies = one scored run + unlimited unscored practice.
8. **Global leaderboards demotivate almost everyone; friend cohorts and percentiles motivate.** A global board motivates ~the top 100; percentile framing ("top 24%") flips the same data into progress; friend boards raise stakes because the reference group matters (Yu-kai Chou/Octalysis).
9. **Near-misses are dopamine events — manufacture the presentation, never the outcome.** Detect and dramatize real close calls (whoosh, flash of time dilation, small bonus). Last-stand states: music-synced heartbeat (Axiom Verge), pulsing last heart (Zelda). Anti-pattern: red screens that impair the vision needed to survive the clutch (Kotaku).
10. **One input, many verbs is how thumb games buy depth — community technique-naming is the proof.** Fumoto/Downwell: ≤3 inputs; depth moves into when/why. Slither.io: one pointer, but the community named coiling and cutting, and a 200-mass snake can kill a 50,000-mass one. When players name maneuvers you didn't, you have depth.
11. **Score systems should price risk, not just survival — ideally with banking tension.** Downwell combos (no-ground-touch chains), Gem High; Luftrausers: heal only while not shooting vs. decaying ×20 multiplier; Tony Hawk: the combo is worthless until landed. The high-score play and the safe play must be different actions; greed must be voluntary.
12. **On the web, the link is the store.** Slither.io: ~200M players in a year, no install, skins for sharing a link. Wordle spread as a URL. Suika's 2023 global moment was substantially browser versions. Distribution strength; retention weakness (no icon, no push) — see technical notes.

## Web/PWA technical notes

- Safari historically caps rAF at 60 Hz even on 120 Hz ProMotion (unlock behind feature flags; WebKit bug 173434); Low Power Mode throttles rAF to 30–60 Hz — the sim must be fixed-timestep or difficulty changes with battery state. Chrome/Android supports `desynchronized: true` canvas to cut compositor latency; Safari ignores it.
- Audio: AudioContext must be created/resumed in a user gesture; the hardware mute switch silences WebAudio; use WebAudio (not `<audio>`) for SFX latency.
- Haptics: `navigator.vibrate` Android-only; never existed on iOS Safari; the 17.4 checkbox hack was patched (~26.5). Real iOS haptics arrive with the Capacitor wrap.
- Viewport/touch: `dvh`/`svh` not `100vh`; `viewport-fit=cover` + `env(safe-area-inset-*)`; `touch-action:none` (kills double-tap-zoom delay); `overscroll-behavior:none` (kills pull-to-refresh mid-run — run-ending in a hold-drag game).
- Storage fragility: WebKit ITP caps script-writable storage (incl. localStorage) at ~7 days of Safari non-use for plain web pages — a lapsed player's best score can be erased. Home-screen-installed apps are exempt. Mitigate: mirror PB into share codes; pitch A2HS as "keep your score safe."
- Push/install: iOS Web Push only for home-screen web apps (16.4+, 2023); A2HS is a buried 4+ tap flow; reachable push audience ~10–15× smaller than native. The web build's growth loop must be the share artifact, not notifications.

## Case evidence

| Game | Year | Detail |
|---|---|---|
| Super Meat Boy | 2010 | Instant respawn as doctrine (canonical) |
| Jetpack Joyride | 2011 | 3 concurrent missions, stars → ranks; near-miss missions (canonical template) |
| Flappy Bird | 2013 | Seconds-long runs; sub-second restart; retry as reflex |
| Spelunky HD daily | 2013 | One world-seed, one attempt, daily reset (canonical) |
| Crossy Road | 2014 | Cosmetic-only unlocks incl. secret in-world ones; eagle punishes idling so runs never stall |
| Luftrausers | 2014 | Heal-vs-shoot: one resource, two desires |
| Alto's Adventure | 2015 | 3 goals/level × 60; goals teach techniques |
| Downwell | 2015 | ≤3 inputs; no-ground combos; Gem High risk banking; Fumoto GDC 2016 |
| slither.io | 2016 | One-pointer depth; named techniques; skins-for-shares; 200M players/yr no install |
| Wordle | 2021 | Daily scarcity; player-invented share grid formalized |
| Vampire Survivors | 2021 | 30:00 cap; every run banks unlocks |
| Suika Game | 2021/2023 | Browser versions carried global distribution |
| Balatro | 2024 | Score-vs-rising-target; designed anticipation |
| Axiom Verge etc. | var. | Last-stand feedback: music-synced heartbeat — tension without blinding |

## Sources

- Polishing the Boots — Fumoto, GDC — 2016 — https://gdcvault.com/play/1023533/Polishing-the-Boots-Designing-Downwell ; Thumbsticks writeup — https://www.thumbsticks.com/gdc-2016-ojiro-fumoto-on-polishing-downwells-gun-boots/
- Crossy Road: A Whale of a Time — GDC — 2015 — https://gdcvault.com/play/1021897/Crossy-Road-A-Whale-of ; design lessons — https://www.gamedeveloper.com/design/what-design-lessons-can-we-learn-from-crossy-road-
- Jetpack Joyride breakdown — Adrian Crook — https://adriancrook.com/design-breakdown-jetpack-joyride/ ; missions wiki — https://jetpackjoyride.fandom.com/wiki/Jetpack_Joyride/Missions
- Alto's goals — AppUnwrapper — 2015 — https://www.appunwrapper.com/2015/02/20/altos-adventure-list-of-goals-for-all-levels/
- Super Meat Boy postmortem — Game Developer — 2011 — https://www.gamedeveloper.com/audio/postmortem-team-meat-s-i-super-meat-boy-i- ; Raw Meat tips — https://www.moddb.com/games/super-meat-boy/news/raw-meat-game-design-tips-from-team-meats-edmund-mcmillen
- Wordle share grid — Wardle tweet — Dec 2021 — https://x.com/powerlanguish/status/1471493886031773707 ; TechCrunch — 2022 — https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle/ ; Slate — https://slate.com/culture/2022/01/wordle-game-creator-wardle-twitter-scores-strategy-stats.html
- Vampire Survivors psychology — The Conversation — 2023 — https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613
- Spelunky Daily — https://spelunky.fandom.com/wiki/Daily_Challenge_Mode ; Isaac dailies — https://bindingofisaacrebirth.wiki.gg/wiki/Daily_Challenges
- Leaderboard design — Yu-kai Chou — https://yukaichou.com/gamification-analysis/leaderboard-design-definitive-guide-octalysis/ ; Trophy.so — https://trophy.so/blog/leaderboards-feature-gamification-examples
- Near-miss psychology — Casino Player — https://www.casinocenter.com/slot-machine-psychology-how-the-near-miss-effect-drives-player-behavior-in-online-gaming/ ; Kotaku red-screen — 2021 — https://kotaku.com/enough-with-the-red-screen-of-almost-death-1846752628 ; Critical Annoyance — https://tvtropes.org/pmwiki/pmwiki.php/Main/CriticalAnnoyance
- Downwell combos — https://downwell.fandom.com/wiki/Combos ; Luftrausers — https://en.wikipedia.org/wiki/Luftrausers
- slither.io — https://en.wikipedia.org/wiki/Slither.io ; behind the scenes — https://root-nation.com/en/games-en/games-articles-en/en-slither-io-and-agar-io-behind-the-game-scene/
- Suika in browser — TouchArcade — 2023 — https://toucharcade.com/2023/10/11/how-to-play-suika-watermelon-game-free-on-mobile-browser-iphone-android/
- Session data — GameAnalytics 2020 — https://www.gameanalytics.com/blog/2020-in-metrics-understanding-casual-and-hypercasual-gaming-markets ; Udonis — https://www.blog.udonis.co/mobile-marketing/mobile-games/session-length ; Segwise — https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies
- rAF throttling — https://motion.dev/magazine/when-browsers-throttle-requestanimationframe ; WebKit 120 Hz — https://bugs.webkit.org/show_bug.cgi?id=173434
- iOS Web Push — WebKit blog — 2023 — https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ ; Notificare — 2024 — https://notificare.com/blog/2024/09/16/web-push-in-ios-add-to-home-screen/
- Unlock Web Audio on iOS — https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos
- ios-haptics (patched) — https://github.com/tijnjh/ios-haptics
- Endless runner design — Game Developer — https://www.gamedeveloper.com/design/endless-runner-games-how-to-think-and-design-plus-some-history-
- Balatro interview — Rogueliker — 2024 — https://rogueliker.com/balatro-interview/
- Goal gradient — LogRocket — https://blog.logrocket.com/ux-design/goal-gradient-effect/
