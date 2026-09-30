# Universe Clash: Convergence playability pass

The source is the recovered 0.8.0 game embedded in Pure Exploration. The separate
Mac-local 0.9 build and OpenCode history from the user's pasted logs were not
available in this workspace. This change extends the accessible repository.

## Implemented

- Story Saga, Duel and 12-Fighter Pit are the primary menu choices. Tournament is
  full screen; Watch AI and Aura Series remain secondary choices.
- The third-person camera follows the player instead of fitting two fighters.
  Mouse look rotates the fighter, moves are relative to the view, and Escape
  releases pointer lock and pauses. Close attacks assist toward visible opponents.
- X picks up a highlighted prop within 6.5 meters for 10 Ki and holds it until the
  next tap throws. Pausing clears input and drops it safely on resume. Legacy G
  hold/release remains compatible. The prompt and simulation share selection rules.
- Z teleports up to 6 meters along the camera direction, bounded by the arena.
  Its 16 Ki cost and 2s cooldown are enforced by the engine.
- T charges, R transforms and Space toggles flight. The HUD reports missing
  Resolve and Ki separately, displays charge blockers, and lists all actual forms.
  Exact-cost transformations no longer immediately revert; high-upkeep forms give
  the player two seconds to recharge before reverting on empty Ki.
- The Convergence introduces all 16 fighters and connects 16 original story
  episodes to playable matches. Wins unlock the next episode and save locally.
- Fighter Studio offers an enlarged rotatable live model, roster carousel, form
  previews, gear and moves. Nine milestones award one-time XP for real events.
- Ten guided tutorial steps cover movement, look, combos, guarding, shooting,
  charging, teleport, objects, transformations and flight.
- Character materials add light bands and view-dependent ink edges without an
  extra outline draw pass. Solo melee impacts pause briefly; reduced effects
  disables the pause. Host navigation hides during active matches.
- Free-aim shots converge on the point under the shoulder-camera reticle. Aim
  assistance selects a living opponent within a narrow cone, including opponents
  other than the currently tracked rival in Pit. The reticle names the assisted
  opponent; an edge arrow locates an off-screen tracked rival.
- L now shares the on-screen energy button's tap/hold behavior: tap for a blast,
  hold 350ms for a beam, or hold 1.2s for an ultimate, then release. Costs and
  cooldowns are still enforced by the simulation. U/V remain direct shortcuts.
- Camera & visuals settings save sensitivity, vertical inversion, camera
  distance, field of view and aim assistance. Four graphics presets change the
  actual pixel-ratio cap, shadow resolution and decorative particle count;
  Performance retains contact markers and combat warnings without shadow maps.
- The camera's forward lead and higher look point clear the reticle above the
  player's silhouette while fitting the full body. Paused menus stop redundant
  arena rendering; Fighter Studio remains live, and resize/settings redraw once.
- On phones, abilities use two short rows at the bottom, with movement and look
  controls above them. Ki and form requirements sit below the health bars so the
  player's body remains visible. Main ability targets are at least 44px high.
- Touch-generated clicks no longer enter the keyboard/assistive activation
  fallback, which could toggle flight twice for one tap.

## Validation

- 19 Node engine/progression regression tests pass, including a 2,400-tick
  12-fighter simulation, aim, pickup, throw, depletion and transformation cases.
- Additional regressions cover shoulder-camera parallax, target selection in a
  crowded arena, disabling aim assistance, and corrupted/out-of-range preferences.
- Changed JavaScript modules pass Node syntax checks; `git diff --check` passes.
- The host application's `npm run typecheck` and `npm run build` both pass.
  The build still reports a large-chunk warning; no new host dependency is added.
- HTML has no duplicate IDs or missing local asset references. New module imports
  resolve to real files.
- The workspace browser remains unavailable: the cloud browser failed WebGL
  and blocked localhost, and local Chromium could not create its process socket.
  No local elevation is used. A read-only GitHub Actions job now runs the game in
  software WebGL, exercises real UI/input, and retains screenshots and renderer
  diagnostics as a seven-day artifact. It uses no deployment credentials.
- Remote runs captured the menu, camera settings, enlarged Fighter Studio,
  story scene and active fight. Inspection exposed the avatar blocking the
  reticle; camera framing was adjusted. A teleport assertion during active AI
  combat timed out and is now tested in training. The extended acceptance run
  passed on commit `c6e6f8c`. Screenshot review then exposed the mobile HUD covering
  the player. The revised phone layout passed its visibility check on `322fa4b`;
  touch input exposed a duplicate flight activation, now fixed and being rechecked.
- Before production, complete the revised mobile acceptance pass and play the
  camera/combat transitions on a hardware-accelerated
  browser. Software WebGL acceptance does not establish a real-device frame-rate
  target.

No replacement models, extra arenas, generated opening movie, MP4 recording or
multiplayer backend are included in this pass. Existing replay storage and
showcase media remain available. No production deployment is part of this change.
