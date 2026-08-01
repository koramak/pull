# Research digest — Game feel & juice

Compiled 2026-07-31 for the PULL improvement report. Method: ~20 targeted searches; synthesized from search-result content of the primary sources listed (direct page fetches were partially blocked in the research sandbox).

## Key principles

1. **The 100ms/240ms response law.** Steve Swink defines game feel as "real-time control of virtual objects in a simulated space, with interactions emphasized by polish," and puts hard numbers on "real-time": response under ~100ms is perceived as instantaneous; beyond ~240ms, players register lag and get frustrated. Below ~100ms the brain binds action and effect into a single perceived cause, producing the proprioceptive illusion that the on-screen object is an extension of the body. (Swink, *Game Feel*, 2009; "Game Feel: The Secret Ingredient," Gamasutra 2007.)

2. **On touch, the bar is far stricter — the finger sits on the evidence.** Microsoft Research (Ng, Dietz et al.) showed users can perceive as little as ~2.4ms of latency when *dragging*; Jota et al. (CHI 2013) found task performance degrades above ~25ms. Real phones deliver ~35–140ms touch-to-photon. Direct touch gives the eye a physical reference point, so latency reads as spatial error, not delay. You can't beat hardware latency, so you *mask* it — respond on the very next painted frame, and use effects (trails, glow, elastic attachment) that make small lag look intentional.

3. **Hitstop (sleep frames) sells impact more cheaply than anything else.** Vlambeer used roughly ~20ms sleep per enemy kill; fighting games scale hitlag with damage (order 100–333ms, hard-capped ~30 frames); Sakurai devoted a Famitsu column to tuning it. The pause gives the eye 1–4 frames to register the collision; the interruption of smooth motion is itself read as transferred force. Practical band: 20–50ms small hits, 80–150ms big ones, 250ms+ only for climactic events.

4. **Screen shake should be trauma-driven, noise-sampled, and partly rotational.** Eiserloh (GDC 2016): keep `trauma` in [0,1]; add trauma per event; shake magnitude = trauma² (or ³); drive offsets with smooth noise (not per-frame rand()) and include a small roll component — in 2D, rotation reads as violent at tiny angles. Common recipe: linear trauma decay (~1s), max translation a few percent of screen size, max roll ~0.05–0.1 rad. Squaring trauma makes small events whisper and big events roar; trauma accumulation makes overlapping hits compound honestly.

5. **Never move anything linearly; pick the easing family by meaning.** Eiserloh (GDC 2015): SmoothStart (t², t³) for windups/anticipation; SmoothStop for anything that must feel responsive; arches/bells for popups. Material Design/NN/g converge: 150–200ms small elements, 300–400ms large transitions; under ~100ms reads instant, over ~400ms sluggish. Linear motion reads mechanical because nothing physical moves that way.

6. **The Vlambeer checklist: many tiny, cheap amplifiers stack.** ~30 cumulative tricks: basic animation, bigger/faster projectiles, muzzle flash, impact effects, hit reactions, knockback on both parties, camera lerp, camera kick, sleep frames, permanence (corpses, shells, smoke persist), meaning. Each channel is a redundant confirmation of the same event; redundancy across channels is what the brain reads as physicality. Permanence converts moment-to-moment juice into a visible record of player history.

7. **Juice it or lose it: maximal feedback per input; audio should ladder.** Jonasson & Purho (2012): tween everything, squash/stretch the ball, particles on every contact, pitch-vary every sound a few percent, ascending harmonized pitches on combos. Pitch variation defeats habituation; ascending ladders exploit auditory expectation.

8. **Squash and stretch can be purely procedural — derive it from the simulation.** Rosen (GDC 2014): lean into acceleration, stretch along velocity, spring back on stop. Pittman (GDC 2016): parameterize physics by designer-facing feel variables. Deformation proportional to actual sim state is honest animation — it can never desync from gameplay truth.

9. **Death deserves a designed sequence, not a state flip.** Berbece (GDC EU 2015): pre-impact pause, layered explosion, shake, displacement waves, debris, composition change, and a beat of silence before the restart prompt. Death is the highest-information event in an arcade game; duration and structure convert frustration into spectacle.

10. **Input forgiveness is invisible juice.** Celeste ships ~100ms grace windows — coyote time, jump buffering, corner correction. Players perceive their intent, not their timing; absorbing ±100ms of human error makes controls feel psychic.

11. **Haptics: sparse, exactly synced, and the web can't be trusted with them.** Apple HIG: haptics only for meaningful moments, always synchronized; 44×44pt minimum touch targets (≈ the occlusion zone of a thumb). `navigator.vibrate` works on Android Chrome; iOS Safari has never supported it (the checkbox hack was patched). Reliable iPhone haptics require the native wrap.

12. **Over-juicing is real and measurable.** CHI PLAY 2019 ("Juicy Game Design") and related studies: players rated juicy versions higher but performed worse. Failure modes: visual noise burying threat information, effects masking weak mechanics, photosensitivity harm, mobile GPU cost. Juice must amplify true game state, never decorate or contradict it.

## Case evidence

- **Royal Match (2021)** — feel edge over Candy Crush is *speed*: short animations "with just enough debris to feel satisfying yet not overwhelm the board."
- **Vampire Survivors (2022)** — slot-machine craft applied to escalating overload; feedback density rises with player power.
- **Suika Game (2021/2023)** — charm carried almost entirely by squash/wobble physics and audio.
- **Balatro (2024)** — the score sequence as juice centerpiece: cards step forward, spring-bounce, rising notes; counter rolls like a slot reel; shake scales with magnitude; big multipliers set the number on fire.
- **Survivor.io / Archero** — "a juicy core with a light meta": white hit-flashes, damage numbers, knockback, mass disintegration.
- **Crossy Road (2014)** — hold-to-stay squash, hop on release; feel doing the work of tutorializing.
- **Nuclear Throne (2015)** — living catalog of the Screenshake checklist.
- **Celeste (2018)** — ~100ms forgiveness windows as invisible feel infrastructure.

## Sources

- Game Feel — Steve Swink — 2009 — review with key numbers: https://lizengland.com/blog/review-game-feel-by-steve-swink/ ; "Game Feel: The Secret Ingredient" — https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient
- The Art of Screenshake — Jan Willem Nijman (Vlambeer) — 2013 — https://www.youtube.com/watch?v=AJdEqssNZ-U ; recreation devlog: https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog/451576/quick-breakdown-of-all-the-effects
- Juice It or Lose It — Jonasson & Purho — 2012 — https://www.youtube.com/watch?v=Fy0aCDmgnxg ; https://www.gdcvault.com/play/1016487/Juice-It-or-Lose
- Math for Game Programmers: Juicing Your Cameras With Math — Eiserloh, GDC — 2016 — https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing ; slides: http://www.mathforgameprogrammers.com/gdc2016/GDC2016_Eiserloh_Squirrel_JuicingYourCameras.pdf
- Math for Game Programmers: Fast and Funky 1D Nonlinear Transformations — Eiserloh, GDC — 2015 — https://www.youtube.com/watch?v=mr5xkf6zSzk
- Screen Shake recipe — KidsCanCode — https://kidscancode.org/godot_recipes/4.x/2d/screen_shake/index.html
- Game Feel: Why Your Death Animation Sucks — Berbece, GDC Europe — 2015 — https://gdcvault.com/play/1022759/Game-Feel-Why-Your-Death
- Animation Bootcamp: An Indie Approach to Procedural Animation — Rosen, GDC — 2014 — https://www.gdcvault.com/play/1020583/Animation-Bootcamp-An-Indie-Approach
- Math for Game Programmers: Building a Better Jump — Pittman, GDC — 2016 — https://gdcvault.com/play/1023559/Math-for-Game-Programmers-Building
- Hitlag — SmashWiki — https://www.ssbwiki.com/Hitlag ; Sakurai on hitstop — https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/
- How Fast is Fast Enough? — Jota, Ng, Dietz, Wigdor, CHI — 2013 — https://www.tactuallabs.com/papers/howFastIsFastEnoughCHI13.pdf ; How Much Faster is Fast Enough? — CHI 2015 — https://www.tactuallabs.com/papers/howMuchFasterIsFastEnoughCHI15.pdf
- Touch sampling vs refresh rate measurements — 2023 — https://www.mobile-apps-news.com/why-does-touch-sampling-rate-matter-more-than-refresh-rate-for-gamers/
- Royal Match — Deconstructor of Fun — 2021 — https://www.deconstructoroffun.com/blog/2021/3/21/royal-match-the-new-king-from-turkey
- Vampire Survivors gambling-psychology analysis — The Conversation — 2023 — https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613
- Survivor.io — Naavik — 2022 — https://naavik.co/deep-dives/survivorio-archeros-footsteps/
- Balatro juice analyses — Kokutech — https://www.kokutech.com/blog/gamedev/design-patterns/power-fantasy/balatro ; Blake Crosley — https://blakecrosley.com/guides/design/balatro ; LocalThunk interview — TouchArcade — 2024 — https://toucharcade.com/2024/03/18/balatro-interview-mobile-port-localthunk-dlc-plans-updates-new-jokers-demo-feedback/
- Suika Game design analysis — Kokutech — https://www.kokutech.com/blog/gamedev/design-patterns/unique-mechanics/suika-game
- Crossy Road: A Whale of a Time — GDC — 2015 — https://gdcvault.com/play/1021897/Crossy-Road-A-Whale-of
- Celeste & Forgiveness — Maddy Thorson — 2020 — https://maddythorson.medium.com/celeste-forgiveness-31e4a40399f1
- Playing haptics — Apple HIG — https://developer.apple.com/design/human-interface-guidelines/playing-haptics ; Material motion — https://m3.material.io/styles/motion/easing-and-duration ; NN/g — https://www.nngroup.com/articles/animation-duration/
- Haptics — Capacitor docs — https://capacitorjs.com/docs/apis/haptics
- Juicy Game Design — Hicks et al., CHI PLAY — 2019 — https://dl.acm.org/doi/abs/10.1145/3311350.3347171 ; How Does Juicy Game Feedback Motivate? — Kao et al., CHI 2024 — https://people.csail.mit.edu/dkao/pdf/3613904.3642656.pdf
- The Perils of Over-Juicing — Wayline — 2024 — https://www.wayline.io/blog/the-perils-of-over-juicing
