# Third-party notices

Exact package versions are locked in `package-lock.json`. The JavaScript utilities and renderer use the MIT License.

| Package | Version | Copyright / project | Use in Light Years From Home |
|---|---:|---|---|
| `gl-matrix` | 3.4.4 | Brandon Jones, Colin MacKenzie IV, contributors | Double-precision-compatible vector primitives inside the custom reference-frame layer |
| `xstate` | 5.32.5 | David Khourshid, contributors | Explicit mission and playback statecharts |
| `howler` | 2.2.4 | James Simpson, GoldFire Studios, contributors | Restrained browser interface sonification |
| `three` | r160, vendored ES module | Three.js Authors | Browser-native WebGL scene rendering; no physics authority |

## NASA visualization asset

`public/assets/textures/earth-blue-marble-2048.png` is the NASA/GSFC Scientific Visualization Studio Blue Marble mosaic from [SVS item 2915](https://svs.gsfc.nasa.gov/2915/). Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio; Blue Marble data courtesy of Reto Stockli (NASA/GSFC) and NASA Earth Observatory. It is used for this educational visualization under [NASA’s images and media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/); no NASA endorsement is implied. Exact provenance and the SHA-256 digest are stored beside the asset in `earth-blue-marble-2048.json`.

The project does not use a prefab star-map, spacecraft controller, orbital package, or generic physics engine. Scientific equations, clock behavior, coordinate rebasing, mission snapshots, validation, and educational caveats are project-owned code.

Full license texts remain in each installed package under `node_modules/<package>/LICENSE*` and can be reproduced in a distributable notice bundle before any approved public deployment.

## Constellation and Moon data

Constellation figures: Marc van der Sluys, ConstellationLines (2005–2023), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [source](https://github.com/MarcvdSluys/ConstellationLines), DOI 10.5281/zenodo.10397192. The original lab converted source figures to its BSC5 coordinate arrays; this bundle retains those arrays without alteration. Bright stars: Bright Star Catalogue, 5th Revised Edition (BSC5 / V/50), CDS. Exact source hashes and coordinate limitations remain in the data files.

Moon maps: NASA Scientific Visualization Studio; Ernie Wright (USRA), Noah Petro (NASA/GSFC), LROC WAC and LRO LOLA teams. The educational-use provenance and visual-only limitations remain in `assets/textures/moon-cgi-kit.json`. Generated fictional surfaces retain their original generation and fidelity records beside the textures.

This lab-only bundle uses the vendored Three.js runtime. The atlas's gl-matrix, xstate and howler entrypoints are not included. No new license is applied to project-owned source or generated media by this packaging note.
