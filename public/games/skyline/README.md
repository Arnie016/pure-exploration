# Skyline Swing: NYC Rush

A Subway-Surfers-style swinging runner through New York. Swing between lanes on an energy line, hop over and dive under obstacles, take corners, and outrun the Ink Hound across rooftops, downtown avenues and subway tunnels.

## Run locally

```sh
python3 tools/serve.py 8124
```

Open http://localhost:8124. (Any static server works; `tools/serve.py` just disables caching during development. Opening `index.html` via `file://` will not work because of ES modules.)

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Switch lane / take a corner | ← → or A D | swipe left / right |
| Hop | ↑, W or Space | tap or swipe up |
| Dive | ↓ or S | swipe down |
| Shockwave (charged by coins) | E or Shift | SHOCK WAVE button |
| Pause | P or Esc | II button |

## Structure

- `src/main.js` — game loop, run state, camera, collisions
- `src/world/` — path + corners (`path.js`), zone builders (`zones.js`), props, sky
- `src/entities/` — hero, Ink Hound, coins / power-ups / swing line / particles
- `src/render/` — post pipeline (ink outline, halftone, bloom), materials, procedural textures
- `src/game/` — input, audio (procedural WebAudio), UI, story intro, save
- `vendor/` — three.js r186 (MIT)

See `CREDITS.md` for third-party assets.
