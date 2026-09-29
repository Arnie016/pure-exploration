# Pure Exploration sound pass

The shipped sound is an original local composition, silent by default. A sparse flute-like phrase gives the garden room to breathe; approaching a portal crossfades into a related curiosity, tide, adventure, or mystery motif. The telescope uses the curiosity motif. UI chimes are short, quiet, and rate-limited. Music is absent on embedded game routes so their original soundtracks remain intact.

A small owned Web Audio graph was chosen over an additional library because this scope only needs scheduled harmonic tones, gain ramps, stereo placement, and a short echo. It adds no media download, sample license, new package, third-party call, or rendering load. Notes have a capped voice pool and explicit cleanup. Audio starts after a trusted visitor gesture and only when enabled. Leaving the tab suspends the context. Playing local media ducks the score. UI effects and music have independent volume controls.

## Interfaces

- Mount default `Soundscape` once in the root layout.
- `pe-open-sound`: open controls. No automatic enabling.
- `pe-sound`: detail `{kind: 'favorite' | 'portal' | 'capture' | 'achievement', worldId?: string}`.
- `pe-portal-proximity`: detail `{worldId: string, distance: number}`; garden emits at most twice a second. Music blends from 18 scene units to 5 scene units.
- `getSoundCaptureTrack()` from `app/audio/director.ts`: returns a clone of the local master track only when sound is enabled and running; otherwise `null`. Recording owns/stops the clone. No microphone request; no embedded game audio.
- Settings: `pure-exploration-sound-v1` in local storage. No tracking or remote persistence.

## Provider experiment

One original ElevenLabs request, four seconds, was generated on 2026-09-30. The provider returned four variants in the single generation. UI quote: 52 credits; observed balance delta: 53 credits (7,247 to 7,194). No purchase, upgrade, credit top-up, or new terms acceptance. Generation remained private. No other generation requests were made.

The MP3 export control did not deliver a retrievable local artifact within the bounded browser attempt. The generated variants remain in the account's Sound Effects history; they are **not shipped** and the app has no speculative file reference. Proof screenshot lives outside the public site at `outputs/elevenlabs-sound-generation-proof.png`.

Prompt: “A welcoming science-garden portal opening, exactly four seconds: soft breath of air gathering into one clear rounded glass shimmer, warm low resonance, airy tail fading into silence. Gentle, luminous and curious. Clean close sound, no voice, no music, no percussion, no sharp chime, no bass impact, no harsh fizz or distortion.”

Provider rights sources checked: [billing](https://elevenlabs.io/docs/overview/administration/billing), [publishing generated content](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform). No third-party generated file is included in this release.

Suno was accessible, but the generation credit cost was not surfaced. No Suno generation or spend occurred. Retained original instrumental brief: “An intimate, unhurried science garden at blue hour. Breath-soft wooden flute, warm low sustained tones, occasional rounded glass notes, generous silence. 49 BPM, D major with a light Lydian lift, no vocals, no drums, no recognizable melody, no artist imitation. The music invites exploration rather than demanding attention. A gently evolving loop suitable for a quiet interactive garden.”

## Proof boundary

`node --test app/audio/sound.test.mjs` covers safe defaults and corrupt preferences, destination routing, continuous proximity blending, gesture-before-creation, rate limiting, mute, hidden-tab pause/resume, and disposal. Typecheck covers the React integration. These are machine checks. **Human listening, speaker/headphone balance, and physical-device auditory comfort: NOT_TESTED.**
