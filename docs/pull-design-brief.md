# PULL — Design Brief

## What this is
A one-thumb mobile arcade game. Your finger is a gravity well. A small space station sits center screen while asteroids stream in from every edge. You never touch the station and you never shoot. Pressing anywhere bends every moving object toward your fingertip: you curve rocks away from the station, slam them into each other, and curl gold ore into the station to bank it. The station has three hull points. When they're gone, the run ends.

The working prototype (pull.html) is the source of truth for feel and layout. This brief is for the visual identity, UI, and motion language built on top of it.

## The fantasy
You are gravity. Not a ship, not a gun, not a cursor. A force. Everything on screen obeys your finger, including the things trying to kill you, which means every save you make also drags danger closer to your own hand. The game should feel like conducting an orbit, calm and godlike at low intensity, white-knuckle at high intensity.

## Tone
Warm-blooded space, not cold sci-fi. Think tactile, toy-like celestial objects with weight and charm. Confident and minimal. No lore, no faces on the rocks, no cockpit chrome. The emotional register is "planetarium meets pinball."

## What the player must always read at a glance
The station and its remaining hull.
Which objects are threats (rocks) versus rewards (ore). This distinction carries the entire game and must survive peripheral vision, motion blur, and a thumb covering 15% of the screen.
Where the well is and that it is active.
Trajectories. Curved motion trails are not decoration here, they are the primary game information.

## Visual system to design
A palette and shape language for: deep space background, rocks, ore, the station, the gravity well, impact/shatter effects, and score feedback. Prototype starting points: near-black indigo field, slate rocks, gold ore, cyan station, violet well. Treat these as placeholders to beat, but preserve the hue-contrast logic (threat and reward must never share a temperature).
The gravity well effect. This is the signature visual of the game and the thing screenshots get judged on. Currently concentric rotating dashed rings. Explore: lensing distortion, particle infall, starfield warp. It must stay legible under the finger and cannot occlude gameplay.
Trails. Explore taper, glow, and how trail curvature can be beautiful enough that players screenshot their best saves.
HUD: score, hull pips, and nothing else during play. Title, death, and pause states.
App icon and key art built from the well motif.

## Motion principles
Every state change is physical: squash, shatter, recoil, screen shake on hull hits. Nothing fades politely.
The well should feel alive the instant a finger lands, zero perceptible latency between touch and visual response.
Death of the station is the biggest moment in the game and deserves a designed sequence, not just particles.

## Deliverables
Art direction boards (2 to 3 directions), then a chosen direction applied to: one full gameplay mock at mid intensity, title screen, death screen, HUD kit, well effect motion study, app icon.

## References for register, not style
Suika's object charm, Osmos's ambient space physics, Two Dots' HUD restraint, pinball light shows for the smash feedback.
