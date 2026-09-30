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

## Validation

- 15 Node engine/progression regression tests pass, including a 2,400-tick
  12-fighter simulation, aim, pickup, throw, depletion and transformation cases.
- Changed JavaScript modules pass Node syntax checks; `git diff --check` passes.
- HTML has no duplicate IDs or missing local asset references. New module imports
  resolve to real files.
- Browser/WebGL visual acceptance has **not passed** in this environment. The
  cloud browser could not create a WebGL context for the existing preview and
  blocked localhost. Local Chromium could not create its process socket; the
  environment's approval policy rejected the elevated browser run.
- A runnable browser smoke pass is included. Before production, run it with
  Playwright, inspect its desktop/mobile screenshots, and play the camera and
  combat transitions. Also run the host application's normal typecheck/build.

No replacement models, extra arenas, generated opening movie, MP4 recording or
multiplayer backend are included in this pass. Existing replay storage and
showcase media remain available. No production deployment is part of this change.
