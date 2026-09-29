# World recovery — 30 September 2026

## Promoted: Reef / Memory

Disposition: **BOUNDED_EXPERIMENT**, original project recovered and integrated.

- Original project: `reef-memory`, from OpenCode's **Building insane Codex-inspired project** session.
- The original conversation explicitly described the inspiration as Wildflow's “Google Docs for Coral Reefs.” This is Arnav's original procedural interpretation, not a copy of Wildflow's product, scans, or datasets.
- Entry: `/world/coral-memory`; bundled scene: `/games/coral-memory/index.html?auto=1`.
- Source recovery: `/Users/arnav/Documents/Default Project/reef-memory/{index.html,main.js,styles.css}`. The source was read only. SHA-256 hashes of the three original files are in `public/games/coral-memory/BUILD_ORIGIN.json`.
- The original inline module exactly matched `main.js`; the hub uses the extracted module to avoid maintaining two copies.

### Preserved

Procedural reef, colony selection, six genus tags, colony history, simulated 2019–2026 environmental timeline, visual similarity comparison, night fluorescence, guided tour, notes anchored to colonies, and photo mode.

### Integration changes

- Enter straight into the water; the original opening overlay is skipped in the hub.
- Retain the host's Back, lobby, portal deck, recording and sharing tools.
- Self-host the exact Three.js r160 modules and original typefaces; no CDN, Google Fonts, API key, sign-in, or remote service is required.
- Clearly identify simulated reef data and browser-local notes. Remove named sample notes and third-party station branding. No simulated users or fake community activity.
- Escape all saved note text before rendering. Validate persisted note IDs and values, limit note length/count, and show a truthful storage-failure state.
- Reserve space for the portal deck and keep the station controls usable on smaller viewports. Respect reduced motion.
- Start quiet; the original optional underwater sound remains off until selected.
- Enable canvas capture for the host's recording and annotation library.

### Verification

- `node --check` passed for the adapted main module.
- TypeScript check passed for the whole host app.
- Local note safety checks passed for HTML escaping, prototype keys, bounds, and genus values.
- Browser rendered the original reef inside the host at 1280×720, entered automatically, and kept sound off.
- One host-side MutationObserver error was reported to the root agent for its parallel HUD/capture changes. No reef module exception was observed.
- Full interaction and mobile visual review: delegated to root for the final integrated build. Human acceptance: **NOT_TESTED**.

## Minecraft: not promoted as a browser portal

Disposition: **REFERENCE_ONLY**.

The current Codex chat **Explore Minecraft creation options** points to the native Ashfall 26.3 Ultra Realism profile, with Java/Fabric mods and shader/resource packs. It requires a native Minecraft installation and the player's Minecraft account. No browser build or browser-playable public world was found in this bounded check. The hub does not expose private server addresses, credentials, or native world files.

HOLLOWDEEP exists as a separate browser project, but it was explicitly removed from this universe earlier and has not been silently reintroduced under Minecraft's name.

## Recent OpenCode candidates

A bounded read-only scan of recent parent-session titles found:

- **Dragon Ball Super Tournament multiplayer 3D fighting game** — already represented by Universe Clash. No duplicate card.
- **Fox Adventure UE 5.8 enhancements** — native Unreal work; no verified browser build. REFERENCE_ONLY.
- **godot prototype swing game** — native Godot work; no verified browser build in this pass. REFERENCE_ONLY.
- **Remake Minecraft site upgrades 5-point plan** — HOLLOWDEEP; retain its explicit removal. REFERENCE_ONLY.
- Other recent sessions concerned research, developer tools, native apps or services and did not meet the immersive-browser-world scope.

Only the authentic reef was added in this pass. A title or agent completion message alone was not used as proof of playable quality or public deployment.
