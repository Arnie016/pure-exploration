# Universe Clash — The Convergence

Recovered from the existing Universe Clash 0.8.0 project on 29 September 2026. Source build allowlist preserved; paths adapted for an embedded same-origin release. No server, credential, private log or deployment configuration is included. Online rooms are disabled. Practice, AI duels, training and local tournaments are included.

Original fan fighting prototype by Arnav. Dragon Ball characters and associated marks remain the property of their respective owners; this bundle does not confer commercial or redistribution rights to that IP. No blanket open-source license is asserted for original content. Three.js 0.180.0 is MIT licensed; its notice is preserved in vendor/THREE-LICENSE.txt. The existing locally produced arena and demonstration assets are preserved.

This playability update adds a 16-episode original fan saga, a live Fighter Studio,
saved milestones, a player-centered follow camera and contextual arena controls.
Story episodes use fixed characters and arenas; Duel and Pit use your menu selections.
All 16 roster characters appear in the opening tournament draw. Progress saves in
this browser. The existing ten arenas and procedural character meshes are retained,
with character light bands, ink shading and larger previews.

| Input | Action |
| --- | --- |
| WASD | Move relative to the view |
| Click arena, then mouse | Free look and aim; Esc releases the pointer and pauses |
| J / K or mouse buttons | Light / heavy strike; J, J, K queues a launcher |
| X | Pick up a nearby highlighted object; tap again to throw where you look. Blast when no object is nearby |
| L | Tap for blast; hold 0.35s for beam or 1.2s for ultimate, then release (8 / 35 / 100 Ki) |
| U / V | Direct beam / ultimate shortcuts |
| Hold T | Charge Ki while stationary on the ground or hovering |
| R | Transform when both Resolve and Ki requirements are met |
| Z | Teleport up to six meters where you look (16 Ki, two-second cooldown) |
| Space | Toggle flight; E ascends, C descends |
| C / Q | Guard / evade |
| H / Home | Next target / recenter |

The HUD names the next form, shows both resource thresholds and explains why a
charge or transformation is unavailable. The form path lists upkeep as well as
entry costs. Goku's implemented path is Base → SS1 → SS2 → SS3 → God → Blue →
Ultra Instinct; SS4 is not implemented. A completed transformation has two seconds
to recover Ki before empty-energy reversion resumes.

Fighter Studio combines forms, equipped gear and move information. The guided
tutorial practices ten actions using the real combat engine. Solo melee hits have
a brief impact pause; reduced effects disables it. Arena and Tactical cameras
still provide wider views. The parent site's navigation clears during a fight
and returns when a dialog opens.

## Development

The embedded game remains dependency-free at runtime. From the repository root:

```sh
python -m http.server 4199 --directory public
```

Open `http://localhost:4199/games/universe-clash/`. Run engine regression checks with
`npm run test:universe-clash`. The optional `npm run test:universe-clash:browser`
requires Playwright and Chromium; `UC_URL` and `UC_BROWSER` override the target
URL and browser executable. It exercises real UI/input and writes screenshots to
the ignored `work/universe-clash-qa` directory.

Validation status and outstanding visual acceptance checks are recorded in
`docs/universe-convergence-pass.md` at the repository root.
