import {notFound} from 'next/navigation';
import {projects} from '../../projects';
import ExternalWorld from '../external-world';
export default async function WorldPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const project=projects.find(p=>p.id===slug&&p.url&&(!p.url.startsWith('/')||p.embed==='frame'));
 if(!project)notFound();
 return <ExternalWorld project={project}/>;
}
