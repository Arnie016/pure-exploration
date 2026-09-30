import {notFound} from 'next/navigation';
import {projects,worldHref} from '../../projects';
import {creationNotes,sharedCreationNote} from '../../creation-notes';
import './notes.css';
export default async function CreationNotes({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,project=projects.find(p=>p.id===slug);if(!project)notFound();
 const note=creationNotes[slug]||sharedCreationNote;
 return <main className="creation-notebook">
  <a className="notebook-return" href={worldHref(project)}>← Return to {project.title}</a>
  <article>
   <span className="notebook-kicker">ARNAV’S NOTEBOOK · {project.title}</span>
   <h1>Behind <em>this world.</em></h1>
   <p className="notebook-intro">An idea, a prompt, and a question you can take further.</p>
   <section aria-label="Selected prompt"><h2>{note.kind === 'Session excerpt' ? 'Inside the session' : 'The design direction'}</h2><blockquote>{note.prompt}</blockquote><details className="notebook-provenance"><summary>Where this prompt comes from</summary><p className="notebook-source">{note.context}.</p><p className="notebook-source">{note.kind === 'Session excerpt' ? 'A selected user-authored excerpt from the original session. Full conversation logs are not published here.' : 'A selected excerpt from the Pure Exploration conversation. This is direction for the experience, not an original build transcript for this world.'}</p></details></section>
   <section><h2>What to investigate</h2><p>{note.reading}</p><p className="notebook-source">Editorial interpretation of the prompt.</p></section>
   <section><h2>Look closer</h2><ul className="notebook-questions">{note.questions.map(question=><li key={question}>{question}</li>)}</ul></section>
   <section><h2>Take the idea further</h2><p>{note.experiment}</p><p>Keep a note of what you changed, what you tested, and what surprised you. If you build on this idea, credit Arnav and the world that inspired you; check the project’s own terms before reusing its code or assets.</p></section>
   <a className="notebook-enter" href={worldHref(project)}>Try it in {project.title} ↗</a>
   <nav className="notebook-related" aria-label="More creation notes"><h2>Another page in the notebook</h2>{projects.filter(p=>p.id!==slug&&creationNotes[p.id]).map(p=><a key={p.id} href={`/notes/${p.id}`}>{p.title} <span aria-hidden="true">↗</span></a>)}</nav>
  </article>
 </main>;
}
