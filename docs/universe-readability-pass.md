# Web universe readability and atmosphere pass

Date: 2026-09-30

Promise: find a world, understand its first action, keep a discovery, and optionally share a trail without mandatory sign-in.
Audience: first-time browser visitor using mouse, touch or keyboard.
Direction: an inhabited space garden with clear wayfinding; warm gold and restrained light/material motion.
User preferences: readable overhead labels, richer 360 scenery, compact controls, quick visual help, automatic captures, optional real-person competition, no lobby like, Poe stories.

Implemented in this pass:
- One labelled Help entry point replaces the separate text-heavy embedded-world panel. Three manual slides use the existing scene preview, concise instructions and control chips. Reset reloads the current world without clearing saved progress; fullscreen and source notes are available.
- The capture camera saves directly. Last 10s is visible, disabled while a replay buffer is incomplete. The replay is silent and exported from a bounded local frame cache. Completed clips save in the library; the sharing preview opens only on request. The duplicate picture item was removed from the options menu.
- Lobby does not show a like control. Four quick garden emotes use existing server-accepted greetings and rate limits, with an immediate feed refresh after successful send.
- Poe has reading mode for three original short retellings, explicitly distinguished from the source stories and films. Movie selection remains available.
- Compact leaderboard uses actual optional participant state, distinct loading/error/empty states and plain world-count ranks. No fabricated people or scores. Sign-in configuration is still required for public joining.
- Screen-sized portal labels show the world name and a short description near/hovered portals. Original southern gateway, side cupolas, an instanced horizon ridge, analytic spiral galaxies and an eight-minute sky/light/water cycle enrich the 360 view. Motion off freezes the cycle.
- Card changes fracture and fade in place before the next card condenses; reduced-motion skips the effect. Swipes browse, they do not delete saved discoveries.

Verification boundary:
- TypeScript and targeted achievement/authentication/capture-storage/audio tests pass.
- Root reviewed desktop Help slides, Escape/focus restoration and Poe reading/story switching.
- Existing repository-wide lint debt remains; the new Help component has no lint errors. Existing no-img warning is expected for local preview images.
- Human comprehension and device gameplay review: NOT_TESTED.
- LinkedIn URL is pending from the owner.

Remaining requested work:
- Real screenshots for each individual instructional step (this guide uses existing scene previews).
- Further geometry/material realism and measurable frame-time comparison. Current analytic waves must not be described as Poseidon FFT/Tessendorf water.
- Broader visual polish across each game's own HUD and gameplay mechanics.
- Public leaderboard sign-in configuration, live payments and Android launch gates remain separate.
