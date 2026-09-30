// Public excerpts selected from Arnav's project direction in this conversation.
// The reef iteration excerpt was checked against its original OpenCode session.
// Only selected user-authored text is exported, never full session logs or IDs.
type CreationNote={prompt:string;context:string;kind:'Session excerpt'|'Design direction';reading:string;experiment:string;questions:string[]};
export const sharedCreationNote:CreationNote={
 prompt:'I want full immersion.',
 context:'Arnav’s direction for Pure Exploration',
 kind:'Design direction',
 reading:'Keep the world in view. Navigation should appear when you need it, then let you return to exploring.',
 experiment:'Build one small scene with controls that fade after inactivity. Keep keyboard focus visible and make every control easy to bring back.',
 questions:['Which control interrupts your attention most?','What should remain visible when everything else fades?','Can a new player bring the controls back without help?']
};
export const creationNotes:Record<string,CreationNote>={
 telescope:{prompt:"if you're approaching a telescope, it's more of a curiosity type of music.",context:'Arnav’s sound direction for the telescope portal',kind:'Design direction',reading:'The sound is part of the invitation: approaching a scientific instrument should make you want to investigate it.',experiment:'Try two quiet soundscapes around a telescope. Ask which one makes someone want to adjust the focus, and why.',questions:['What does “curiosity” sound like to you?','Does the sound suggest an action, or only set a mood?','Does the invitation still work with sound muted?']},
 'coral-memory':{prompt:'make the actual looks and texture much more relasim',context:'Original OpenCode session: Building insane Codex-inspired project. Spelling preserved',kind:'Session excerpt',reading:'This follow-up asks for more convincing appearance and texture. Investigate what creates that feeling: silhouette, surface variation, light, or motion. The prompt alone does not prove the result succeeded.',experiment:'Choose one coral. Change its surface variation while keeping the light and camera fixed, then compare the two versions. Keep observations attached to that colony.',questions:['Is realism coming from the surface, the light, or the motion?','Which visible detail helps you distinguish one colony from another?','How would you rewrite this prompt so the next change is easy to compare?']},
};
