# Optional explorer leaderboard checkpoint

The trophy route is a people table; world popularity is the Most explored rail in portal shelves, ordered by observed 30-day visits with tied ranks. No-login exploration is preserved.

/api/explorers stores opt-in profiles and distinct worlds imported from the browser's server-held journey. Clerk verifies session signatures and authorized party before changes. Sign-in alone creates no public profile. Join requires an explicit chosen name and consent in the UI. Leave hides immediately; Delete removes profile and shared discoveries. Sign-out does not hide a public profile. Only public UUID, chosen name, rank and world count are returned in rankings. No email, Clerk subject, captures, notes or locally claimed achievement score is public. These are exploration milestones, not cheat-resistant game scores. Latest discoveries require the explicit Share latest discoveries action.

Clerk is loaded only after choosing sign-in using the official Clerk 6 / UI 1 script-tag route. This avoids bundling the provider's full UI/wallet dependency tree into the game. Provider UI and Google configuration require real instance verification.

## Configuration and remaining proof

Worker bindings: CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY (the latter is public). Optional CLERK_JWT_KEY is the public verification PEM for offline JWT verification; never a signing private key. The local Keychain frontend entry NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be mapped to the Worker public binding during intended-instance setup. Keep secrets in the provider/keychain, not source.

Read-only check on this run: CLERK_SECRET_KEY present, Clerk /v1/instance HTTP 403; NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY absent. No instance creation, Google connection change, account login, production environment update or deployment performed. Configure Google sign-in and allowed production/local origins in the intended Clerk instance before activation.

Apply migration 0007_explorer_profiles through the authorized deployment route. No production migration performed. Runtime table creation follows this project's existing activity service, with idempotent migration coverage.

## Evidence

- Typecheck and hosted build passed.
- Five tests passed: anonymous/unconfigured access, real signed JWT opt-in separation and wrong-origin/forged-token rejection, catalog-only unique discoveries and replay/leave/delete, tied ranks/private-profile exclusion, all migrations on a clean SQLite database.
- Actual local Worker empty-state response rendered at desktop and 390px. Most explored shelf opened and returned to board through UI.
- Screenshots: ../proof/explorer-board-desktop.png and ../proof/explorer-board-narrow.png.
- Human comprehension: NOT_TESTED. Actual Google sign-in, opt-in writes against production D1, cross-device identity, authenticated UI flow and public deployment: NOT_TESTED.
- Production account moderation, game-specific score verification, abuse resistance and pagination beyond the top 100 remain further work; no competitive game-score claims are made.

Primary sources (BOUNDED_EXPERIMENT): https://clerk.com/docs/js-frontend/getting-started/quickstart and https://clerk.com/docs/reference/backend/verify-token .
