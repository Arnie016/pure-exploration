# Pure Exploration

A universe of original interactive worlds by [Arnav](https://x.com/itsArnz), built with Codex.

- A shared fox garden with walkable portals, nature and technology.
- A telescope in a midnight study, with an optical bench and an eyepiece preview.
- A night airport where sensors, stale data, power use and fleet decisions affect a simulated terminal.
- Small, automatically rotating world cards. No gallery or top navigation bar.
- One-tap canvas video capture, screenshots, editable social captions and a private exploration trail.

Public exploration is free and requires no account. Paid remix conveniences and a newsletter are staged at US$2.99/month; no checkout or charging is enabled. Public source stays free. Sharing never posts on someone's behalf.

## Run locally

Node 22.13+ is required. Node 24+ is recommended for the built-in TypeScript test runner.

```sh
npm install
npm run dev -- --port 4317
npm run typecheck
npm test
npm run build
```

The app uses React, Three.js, vinext and Cloudflare D1. `.openai/hosting.json` holds only a logical database binding and the hosting project ID. Secrets belong in runtime environment settings, or ignored `.dev.vars` for local development. No provider key is needed to explore or run the simulations.

### Owner studio

`/studio` shows private suggestions, dislikes, per-browser journeys and activity reports. Configure `OWNER_KEY_HASH` as the SHA-256 digest of a random high-entropy owner key. Keep the raw key in a password manager. Owner sessions are HttpOnly, scoped to the admin API, expire after 12 hours and are invalidated when the configured hash changes.

On Arnav's Mac, the production owner key is stored under `PURE_EXPLORATION_OWNER_KEY` in Keychain. Do not put it in source, a URL, chat or a screenshot.

To run the API test locally, put the SHA-256 of a local-only test key in `.dev.vars` as `OWNER_KEY_HASH`; provide the matching key as `TEST_OWNER_KEY` in the test process environment. The default test-only key in the test file is never a production credential.

```sh
npm run test:api
node tests/presence-load.mjs
```

The presence test is restricted to localhost. It creates 100 temporary browser identities, checks that every one is returned, and forgets them. It does not prove 100 real browsers can render concurrently or that a production service has been load-tested.

## Data and counts

Public counters aggregate browser sessions, portal opens, shares and current favorites. They are not unique-person counts, verified follows or confirmed social posts. Written feedback and dislikes are private. Visitor journeys are visible only to that browser and the owner. Positions and visitor-supplied profile links are shared in the lobby. The privacy page explains retention and includes a Forget this browser action. A separate Pure Exploration Google Analytics property is connected only after explicit visitor opt-in. First-party source categories store only X, GitHub, search, tagged share, other or direct/unknown. They measure arrivals on this site, not social-platform impressions.

Schema changes live in `db/schema.ts` and versioned `drizzle/` migrations. The runtime initializes matching tables defensively. Queries use bound parameters; mutations require a same-origin request and valid random browser cookies. Suggestions and greetings have rate limits. This is a small-production starting point, not a promise of unlimited anonymous abuse resistance or 100,000 concurrent visitors.

## Model boundaries

The telescope is an educational model: ideal paraxial ray paths, deliberately compressed physical lengths, approximate eyepiece images and dated teaching presets rather than live astronomy. Scientific details and sources are in its field notes.

The airport is an original simulated terminal, not a Changi digital twin or an operational fleet controller. Energy and packet sizes are teaching assumptions. Its adaptive policy uses rules; uncertainty is a heuristic. A separate learning bench trains a seeded tabular Q-learning agent and compares it with two baselines on unseen episodes; this teaching agent does not control the fleet. The simulator has no calibrated real-world probabilities, live IoT ingestion or certified planner. Stale telemetry and occupied seats reject movement or dispatch in the model.

Garden presence is real first-party browser activity. Environmental animations are scenery. Cosmetic transformations are not a combat system. The expanded walkable footprint is 10 times wider on each axis, giving 100 times the original area.

## Add a world

Update `app/projects.ts` with a verified playable destination, provenance and optional actual screenshot/trailer. Featured destinations should be immersive games, stories or labs. Conventional SaaS tools are excluded. New links shared in Arnav's Codex chat can be reviewed and added; there is no automatic X monitoring.

Linked games retain their own authorship and licenses. Some services prohibit embedding. The world frame provides a clear original-site handoff in those cases; a frame load event is not evidence that a cross-origin game successfully initialized. Same-origin bundled games record their canvas or film directly. External frames require the browser's explicit tab picker.

## Credits and assets

Original garden, telescope, airport geometry and interface: Arnav with Codex. Interaction reference: [Ryan Sael's Plane of Focus](https://sael.net/plane-of-focus/), used as a reference for direct manipulation and linked discovery, not copied source or assets. The new lab and garden architecture is procedural. No paid Fab asset was purchased or imported. Recovered worlds preserve their credits; Galevein includes a documented CC0 creature asset. Third-party linked worlds and bundled editions keep their own license terms. Fonts and libraries retain their respective licenses.

Human acceptance of this revision remains pending; browser checks and automated tests are not a substitute for a person's comprehension or game-feel review.

## This release

Fifteen worlds are defined in this repository's current catalog: the garden is a dedicated lobby, not a shuffled destination. The public lobby was checked on 5 October 2026 and exposes 20 connected worlds. Five of those live destinations—Ways of Seeing, Field Garden, Last Call at the Flamingo, Apex Aura and Arcade Golf—do not have matching definitions on `main`; recover their verified URLs, descriptions and provenance before the next production publish rather than guessing them here. Skyline Swing, Lightning, Poe, Galevein, Universe Clash, Tides, AEOLITH, Fable Flight and Thirty Steps Down preserve recovered project sources with edition boundaries in the How to play panels. The recovered original Space-Time Visualization Lab and telescope remain educational approximations. Reef / Memory now preserves the original OpenCode reef archive with honest simulated readings and private local notes. Ben 10 / Omni Tournament has surviving trailers but its playable checkout was not recovered.

The telescope has a full 360-degree teaching sky and alt-az aiming, not a live astronomical pointing service. The garden contains one shrine per real catalog world, with room for 24. Public presence is anonymous first-party browser activity; these changes do not establish production capacity for 100 simultaneous rendered clients.

Recording offers the next 10, 30 or 60 seconds and a previous-ten-seconds replay. The replay uses a bounded compressed image cache on the device (640px desktop / 480px mobile, about 6.7 sampled frames per second); it starts after a world loads and clears when leaving. Export prefers MP4/H.264 where supported, otherwise WebM. Next clips include the original site score when enabled; the previous-ten-second replay is silent. No microphone or embedded-game audio is captured. Native file sharing can send the actual video to a compatible app. X's web composer accepts a caption but cannot attach a local video through an intent URL; no X OAuth upload service is connected.

Glorp Protocol was recovered and locally launched, but remains outside the featured portal catalog pending a fuller visual pass. Its recovered source is preserved with provenance.

## Keepsakes and sound

The on-device library stores annotated pictures, recordings, notes, imported audio and personal achievement cards in IndexedDB (80 items / 200 MB, 40 MB per item). It never silently deletes old entries. Storage failure offers a download fallback for captures. Clearing browser data removes local keepsakes; export first. No cloud sync is implied.

Optional heart reflections ask three world-specific questions and save privately to the owner report. The library contains six browser-local achievements with shareable cards. They are mementos, not verified game scores, redeemable credits or guaranteed discounts. Reward provenance is recorded in docs/rewards-verification.md.

Music starts only after visitor activation. The original local flute score responds to nearby portals and destination moods, suspends offscreen and ducks under visible media. Sound generation provenance, exact provider credit usage and the unshipped ElevenLabs candidate are recorded in app/audio/PRODUCTION.md.
