# Fable Flight — public edition, offline lessons

Recovered from the creator's public GitHub Pages edition on 29 September 2026: https://arnie016.github.io/flight-simulator-fable5/ . This package preserves its deterministic island flight simulator, cockpit, lessons, local progress and text coaching. It is not labeled as the newer experimental local source. Original checkout preserved.

Same-origin adaptation: Three.js r152 and GLTFLoader are vendored locally; the provider voice connection is disabled, its unavailable controls hidden, and the existing synthesized engine/wind/ground audio retained. No server, secret, private log, microphone request or paid provider call is included. Original reusable source code is described as MIT in the project README; asset terms remain separate.

Assets included:
- Cartoon Plane by antonmoek, CC BY 4.0: https://sketchfab.com/3d-models/cartoon-plane-f312ec9f87794bdd83630a3bc694d8ea . Converted from GLB to vertex-colour embedded JavaScript by the original project. License: https://creativecommons.org/licenses/by/4.0/ .
- Kenney Nature Kit 2.1, CC0: https://kenney.nl/assets/nature-kit . Original island-runtime-pack conversion; license: https://creativecommons.org/publicdomain/zero/1.0/ .
- Airfield props and landmarks: original project Blender primitive generators, preserved from the existing generated JavaScript.
- Primary instrument pack, engine quadrant, systems console and flight-control pedestal: original project Blender primitive/text-geometry builders, with source scripts inspected.
- Destination images and preview media: original Fable Flight runtime captures.
- Three.js / GLTFLoader / utilities r152: MIT, retained notice under licenses.

The uncertain imported yoke and astrolabe compass models are excluded. Their existing procedural cockpit fallbacks remain active. External prerecorded sound packs and generated audio are excluded; simulation-based engine and wind sound continue. No Fab files are included.

Local syntax/dependency validation does not establish browser gameplay or human acceptance.
