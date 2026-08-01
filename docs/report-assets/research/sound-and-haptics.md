# Research digest — Mobile sound design & haptics

Compiled 2026-07-31 for the PULL improvement report. Method: ~20 targeted searches; synthesized from search-result content of the primary sources listed (direct page fetches were partially blocked in the research sandbox).

## Key principles

1. **Design for silence; sound is amplifier, not carrier.** Muted-play stats vary by methodology: a 2022 TapResearch survey found >91% of respondents play with sound off; Appington's 2013 device-level data found only ~27% muted; Metacore (Merge Mansion) budgets for 25–40% sound-on; AudioMob/YouGov: 61% at least sometimes play over their own music. Honest read: plausibly half or more of sessions are silent → no gameplay information may live only in audio; audio multiplies perceived quality for sessions that hear it. Second-order: bad audio actively causes muting, and muted players rarely return.
2. **Feedback hierarchy.** Frequent events get small, quiet, short sounds; loud/long/voiced sounds are reserved for rare high-value moments (Candy Crush audio breakdown; Metacore).
3. **Pitch escalation is the canonical streak encoder.** Semitone step ≈ ×1.06 per chain link; Peggle plays ascending diatonic scales keyed to the current music phrase, climaxing in Ode to Joy; Balatro compresses the same grammar (per-card rising notes, "ka-ching" mult layer, bass drop at threshold).
4. **Mix for a 3 cm speaker.** Phone speakers roll off steeply below ~200 Hz, effectively silent by ~100 Hz; sub-bass doesn't exist on-device. Put "low" energy at ~250–700 Hz, rely on the missing-fundamental illusion, high-pass below ~150 Hz. Test through the actual speaker.
5. **Few voices, clear ducking.** On a mono microspeaker simultaneous sounds smear; collapse coincident events into the most important one; duck ambience ~200–300 ms under damage events.
6. **Synthesized retro SFX are a solved recipe** (sfxr/jsfxr lineage): square/saw + fast pitch ramp = zap; sine/triangle up-step + short decay = coin; filtered noise burst = impact; 5–15 ms attacks avoid clicks.
7. **Latency discipline: ≤20 ms feels instant; schedule on the audio clock.** `latencyHint:'interactive'`, resume on gesture, schedule with `AudioContext.currentTime`; iOS can enter an "interrupted" state after backgrounding and must be re-resumed.
8. **Haptics: transient, sparse, never buzzy.** Apple HIG: reinforce a clear cause, in sync, avoid overuse. Android: given a choice between buzzy haptics and none, choose none. Pulses under ~25 ms often aren't felt; transients need ~30–80 ms of energy. Mobile vibrations measurably amplify reward response (JCR 2025) — haptics are a reward channel, not decoration.
9. **Sync haptic to the audio transient within the binding window — never let the haptic lead.** Audio-tactile binding is asymmetric: ~200 ms tolerated when touch follows sound, only ~50 ms when touch precedes. Fire haptic+audio in the same frame; if anything slips, let the haptic be late. Astro's Playroom (haptics rendered from audio waveforms) is the design north star.
10. **The "satisfying"/ASMR trend is multisensory congruence at low latency.** Tap/drag paired with materially plausible sounds and matched micro-haptics inside the binding window reads as physical contact, not UI. Apple Design Awards 2025–26 repeatedly cite haptic specificity as award-worthy.

## Platform constraints (verified current)

**iOS Safari (web PULL today):** `navigator.vibrate` NOT supported at all — zero haptics on iPhone web. (A checkbox-switch Taptic hack existed from Safari 17.4; Apple patched it ~iOS 26.5. Treat as a curiosity, not a plan.) Web Audio requires gesture unlock (touchend most reliable); the ringer/silent switch mutes WebAudio while `<audio>`-element playback is exempt — the unmute.js trick (play a silent HTML audio track on first gesture) promotes the page to the media channel; decide deliberately. `outputLatency` unimplemented in WebKit.

**Android Chrome:** `navigator.vibrate(msOrPattern)` works (sticky-activation-gated) — crude on/off motor, no intensity/sharpness, quality varies by device. WebAudio suspended until gesture (since M70).

**Capacitor wrap (PULL later):** `@capacitor/haptics` exposes impact Light/Medium/Heavy, notification Success/Warning/Error, vibrate(duration), selection ticks; maps to UIImpactFeedbackGenerator and Android predefined effects; no-ops gracefully. Full Core Haptics (AHAP: transient vs continuous, intensity/sharpness envelopes, synchronized audio, 30 s continuous cap) and Android VibrationEffect.Composition primitives (CLICK, TICK, LOW_TICK, THUD, QUICK_RISE) need a community plugin or a few dozen lines of native code. Native wrap also solves the silent-switch properly via AVAudioSession `playback`.

## Case evidence

| Game | Year | Detail |
|---|---|---|
| Peggle / Peggle Blast | 2007/2014 | Peg hits play ascending diatonic scales keyed to the music phrase; harp base + marimba accent on orange pegs; Ode to Joy payoff |
| Candy Crush | 2012→ | Frequent match sounds small; cascades escalate to voiced lines; "Sugar Crush" is the reserved full ceremony |
| Alto's Odyssey | 2018 | Layered, randomized dynamic score designed not to loop audibly over endless runs |
| Sayonara Wild Hearts | 2019 | Music-first structure; levels iterated jointly with songs |
| Astro's Playroom | 2020 | Haptics driven from audio waveforms; "feel what you hear" benchmark |
| Beatstar | 2021 | Praised haptic+visual sync; "HeartBeat" system pitch-modulates all UI audio to keep a subliminal musical pulse |
| Balatro | 2024–25 | Rising per-card notes; ADA cited its gem-unlock haptics |
| ASMR hyper-casual wave | 2020–26 | Soft material sounds + micro-haptics = no-fail loops built on satisfying contact |

## Event → feedback mapping proposed for PULL

| Event | Sound (WebAudio synth) | Web haptic (Android) | Native (Capacitor / Core Haptics ideal) |
|---|---|---|---|
| Well engage | 60 ms soft noise "grab," low-pass opens upward | vibrate(10) | impact Light (transient 0.4/0.3) |
| Well hold | quiet shimmer loop, gain ∝ captured objects | none | selection ticks per capture (~0.25), no continuous |
| Well release | reverse whoosh, pitch falls | none | none |
| Rock-rock smash (+10) | noise burst + 200 Hz saw thump, ±2 st random | vibrate(20) | impact Medium (0.7/0.7 "rigid") |
| Ore banked (+25) | two-note up-chime; streak steps up pentatonic ladder | vibrate(10) | impact Light; every 5th: success notification |
| Deflect (+5) | 30 ms quiet blip; dropped when busy | none | none |
| Hull hit (−1) | 160–220 Hz saw + noise, 250 ms; duck mix −8 dB | vibrate([30,40,60]) | impact Heavy (1.0/0.3 thud, 80 ms decay) |
| Station death | 400→150 Hz sweep + noise crash, then 400 ms silence | vibrate([60,80,120]) | notification Error + falling continuous 300 ms |
| New best | 4-note arpeggio in current ladder key | vibrate([15,30,15]) | notification Success |

Rules: min ~80–100 ms between haptic transients; coincident events collapse into the strongest (hull hit always wins); ceremony (long feedback) reserved for new-best and death only.

## Sources

- TapResearch — 2022 — https://blog.tapresearch.com/how-sound-preferences-impact-player-engagement
- Appington data via Destructoid — 2013 — https://www.destructoid.com/73-of-mobile-gamers-play-with-the-volume-on/
- Hear me out: Designing Sound for Mobile Games — Metacore — 2023 — https://metacoregames.com/news/hear-me-out-designing-sound-for-mobile-games
- International Sound Directory — 2025 — https://www.international-sound-directory.com/2025/12/07/do-people-really-play-mobile-games-without-sound-myth-or-reality/
- AudioMob/YouGov — 2020 — https://audiomob.com/blog/yougov-survey
- Peggle Blast peg-hit music system — Audiokinetic — 2015 — https://blog.audiokinetic.com/peggle-blast-peg-hits-and-the-music-system/ ; Winifred Phillips — https://winifredphillips.wpcomstaging.com/2015/04/15/midi-in-wwise-for-the-game-music-composer-peggle-blast/
- The Power of Pitch Shifting — Game Developer — 2019 — https://www.gamedeveloper.com/audio/the-power-of-pitch-shifting
- Candy Crush audio breakdown — Game Developer — 2014 — https://www.gamedeveloper.com/audio/why-candy-crush-saga-is-so-engaging---an-audio-breakdown
- Balatro: Juicy Feedback — Blake Crosley — 2024 — https://blakecrosley.com/guides/design/balatro
- Apple Design Awards — 2025–26 — https://www.apple.com/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/
- Playing haptics — Apple HIG — https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- Introducing Core Haptics — WWDC19 — https://developer.apple.com/videos/play/wwdc2019/520/ ; Practice audio haptic design — WWDC21 — https://developer.apple.com/videos/play/wwdc2021/10278/
- Android haptics principles — https://developer.android.com/develop/ui/views/haptics/haptics-principles ; custom effects — https://developer.android.com/develop/ui/views/haptics/custom-haptic-effects ; AOSP constants — https://source.android.com/docs/core/interaction/haptics/haptics-constants-primitives
- Navigator.vibrate — MDN — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
- ios-haptics hack (patched) — https://tijnjh-ios-haptics.mintlify.app/
- Haptics — Capacitor — https://capacitorjs.com/docs/apis/haptics
- Chrome autoplay policy — 2018 — https://developer.chrome.com/blog/autoplay
- unmute (iOS silent-switch workaround) — https://github.com/swevans/unmute
- AudioContext "interrupted" — WebAudio issue #2585 — https://github.com/WebAudio/web-audio-api/issues/2585
- Smartphone loudness & frequency response — Audiokinetic — 2019 — https://blog.audiokinetic.com/loudness-and-frequency-response-on-popular-smart-phones/
- Bass on phone speakers — LANDR — https://blog.landr.com/make-bass-audible-phone-speakers/
- jsfxr — https://sfxr.me/ ; Arcade Audio for js13k — https://codepen.io/jackrugile/post/arcade-audio-for-js13k-games
- WebAudio sync/latency — https://www.jamieonkeys.dev/posts/web-audio-api-output-latency/
- Temporal binding windows — JASA 2022 — https://pubs.aip.org/asa/jasa/article/151/4_Supplement/A221/2838808/ ; J. Neurosci 2009 — https://www.jneurosci.org/content/29/39/12265 ; leading-modality — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4915493/
- Tactile feedback in gaming review — PMC 2025 — https://pmc.ncbi.nlm.nih.gov/articles/PMC12099099/ ; Haptic Rewards — JCR 2025 — https://academic.oup.com/jcr/advance-article/doi/10.1093/jcr/ucaf025/8120234
- Beatstar HeartBeat — Ludocious — 2021 — https://ludocious.com/index.php?p=blog&u=beatstar
- Alto's Odyssey sound — Snowman — 2022 — https://builtbysnowman.medium.com/uncovering-the-sound-and-music-of-altos-odyssey-the-lost-city-75a5916e7e3e
- Sayonara Wild Hearts — Nintendo Life — 2019 — https://www.nintendolife.com/features/sayonara-wild-hearts-composer-on-creating-the-first-pop-album-video-game
- Astro's Playroom haptics — MP1st — 2020 — https://mp1st.com/features/deep-dive-look-at-haptic-feedback-of-astros-playroom
- Core Haptics 30 s cap — Exyte — 2020 — https://exyte.com/blog/creating-haptic-feedback-with-core-haptics
