# Glorp Protocol — recovered original game

This is Arnav’s existing 3D boss-fight game, recovered from `glorp-protocol.html`. Enter a name, reveal an agent, and fight the Glorpling. Movement: A/D or left/right arrows. Space fires; on-screen movement and fire controls also work. No account, runtime API, or multiplayer backend is required.

## Provenance

The neighboring source project’s `progress.md`, “Side project: Glorp Protocol” and “Researched: real 3D-game asset pipeline on Higgsfield” sections (lines 67–101), records the user-requested original-character game, five generated portraits, and the generated, rigged hero model with walking animation. The character and media data are embedded in the recovered page. This is not a licensed Ben 10 or Rick and Morty adaptation.

The exact Three.js 0.128.0 runtime, GLTFLoader, OrbitControls, and SkeletonUtils are bundled locally from the original version’s jsDelivr package. Their MIT notice is preserved in `vendor/LICENSE`. Optional Space Grotesk and Inter typography still comes from Google Fonts with system fallbacks. No new license is imposed on the recovered game or its generated assets by this packaging note.

## Integration changes

Document/viewport wrapper, forced dark theme, local vendor paths, shared capture-context script, and safe space for the hub’s lower-right controls. Original inline game JavaScript is unchanged. No generation or paid service was invoked during packaging.

Browser rendering and human review remain separate from local syntax/HTTP validation.
